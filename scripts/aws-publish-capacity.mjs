// DB-owned one-shot capacity hook. Import/default plan has no file, private or network I/O.
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { createHash, X509Certificate } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { DATABASE_RELEASE_ROLES, validateDatabaseApproval, validateDatabaseReceipt } from './aws-publish-db-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'outputs/aws-staging-build');
const targets = { source: 'hbkooiknruimukkhshrk', destination: 'ynygqodmtgjrngiudalw' };
const auditKeys = ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS'];
const boundKeys = ['releaseId', 'project', 'region', 'service', 'sourceManifestSha256', 'baselineFingerprint', 'runtimeDatabaseSha256', 'auditSettingsSha256'];
const caPin = '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';
const requireThat = (ok, code) => { if (!ok) throw Error(code); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const safeCode = error => /^DB_[A-Z_]+$/.test(error?.message || '') ? error.message : 'DB_CAPACITY_OPERATION_FAILED';
const stringValue = z.string().min(1).max(16384);
const contextSchema = z.object({ releaseId: stringValue, project: stringValue, region: stringValue, service: stringValue,
  sourceManifestSha256: stringValue, baselineFingerprint: stringValue, runtimeDatabaseSha256: stringValue, auditSettingsSha256: stringValue,
  quiescentVersion: z.number().int().positive(), quiescentFingerprint: stringValue, quiescentVerifiedAt: stringValue,
  allPreviousDeploymentsInactive: z.boolean(), noPendingDeployment: z.boolean(), maintenanceCommandsVerified: z.boolean() }).passthrough();
const payloadSchema = z.object({ context: contextSchema, approval: z.object({ version: z.literal(1) }).passthrough(),
  connectionUrls: z.object({ app: stringValue, capture: stringValue, worker: stringValue, writer: stringValue, reader: stringValue }).strict(),
  auditSettings: z.object({ AUDIT_EXPORT_USER_IDS: stringValue, AUDIT_PRODUCER_CONTRACT: stringValue,
    AUDIT_READER_DATABASE_URL: stringValue, AUDIT_READER_USER_IDS: stringValue }).strict() }).strict();
function parsePayload(value) {
  const result = payloadSchema.safeParse(value);
  requireThat(result.success, 'DB_CAPACITY_PAYLOAD_SHAPE_REJECTED');
  return result.data;
}

export function capacityConnection(value, role) {
  try {
    requireThat(typeof value === 'string' && !/[\x00-\x20\x7f]/.test(value), 'DB_CAPACITY_URL_REJECTED');
    const u = new URL(value), host = u.hostname.toLowerCase();
    const user = decodeURIComponent(u.username), password = decodeURIComponent(u.password);
    requireThat(['postgres:', 'postgresql:'].includes(u.protocol) && !u.hash && (!u.port || u.port === '5432')
      && decodeURIComponent(u.pathname) === '/postgres' && password && !/[<>\x00-\x1f\x7f]/.test(user + password), 'DB_CAPACITY_URL_REJECTED');
    const direct = host === `db.${targets[role.target]}.supabase.co`;
    const pooled = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host) && user === `${role.principal}.${targets[role.target]}`;
    requireThat((direct && user === role.principal) || pooled, 'DB_CAPACITY_TARGET_OR_PRINCIPAL_CHANGED');
    requireThat([...u.searchParams.keys()].every(key => ['sslmode', 'sslrootcert'].includes(key) && u.searchParams.getAll(key).length === 1)
      && u.searchParams.get('sslmode') === 'verify-full' && u.searchParams.get('sslrootcert') === '/app/certs/supabase-ca.crt', 'DB_CAPACITY_TLS_OPTIONS_CHANGED');
    return { host, user, password, database: 'postgres' };
  } catch (error) { throw Error(safeCode(error)); }
}

export function validateCapacityInput({ payload, publicContext, now = Date.now() }) {
  payload = parsePayload(payload);
  requireThat(exactKeys(payload, ['context', 'approval', 'connectionUrls', 'auditSettings']) && isDeepStrictEqual(payload.context, publicContext), 'DB_CAPACITY_PUBLIC_CONTEXT_CHANGED');
  const { context, approval, connectionUrls, auditSettings } = payload;
  validateDatabaseApproval({ approval, context, now });
  requireThat(context.allPreviousDeploymentsInactive === true && context.noPendingDeployment === true
    && context.maintenanceCommandsVerified === true && Number.isSafeInteger(context.quiescentVersion) && context.quiescentVersion > 0
    && /^[a-f0-9]{64}$/.test(context.quiescentFingerprint || ''), 'DB_CAPACITY_MAINTENANCE_REQUIRED');
  const quiescedAt = Date.parse(context.quiescentVerifiedAt);
  requireThat(typeof context.quiescentVerifiedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(context.quiescentVerifiedAt)
    && Number.isFinite(quiescedAt) && now - quiescedAt >= 30_000 && now - quiescedAt <= 15 * 60_000, 'DB_CAPACITY_FRESH_DRAIN_REQUIRED');
  requireThat(exactKeys(connectionUrls, DATABASE_RELEASE_ROLES.map(role => role.kind)) && exactKeys(auditSettings, auditKeys)
    && auditKeys.every(key => typeof auditSettings[key] === 'string'), 'DB_CAPACITY_PAYLOAD_SHAPE_REJECTED');
  requireThat(auditSettings.AUDIT_PRODUCER_CONTRACT === 'completion-0008'
    && auditSettings.AUDIT_READER_DATABASE_URL === connectionUrls.reader, 'DB_CAPACITY_AUDIT_CONTRACT_CHANGED');
  for (const key of ['AUDIT_EXPORT_USER_IDS', 'AUDIT_READER_USER_IDS']) requireThat(auditSettings[key].split(',').every(value =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())), 'DB_CAPACITY_AUDIT_MEMBERSHIP_REJECTED');
  const runtime = { AUDIT_CAPTURE_DATABASE_URL: connectionUrls.capture, AUDIT_DATABASE_URL: connectionUrls.writer,
    AUDIT_SOURCE_DATABASE_URL: connectionUrls.worker, DATABASE_URL: connectionUrls.app };
  const audit = Object.fromEntries(auditKeys.map(key => [key, auditSettings[key]]));
  requireThat(hash(runtime) === context.runtimeDatabaseSha256 && hash(audit) === context.auditSettingsSha256, 'DB_CAPACITY_PRIVATE_FINGERPRINT_CHANGED');
  return DATABASE_RELEASE_ROLES.map(role => ({ ...role, connection: capacityConnection(connectionUrls[role.kind], role) }));
}

function publicReceipt(context, approval, now) {
  return { version: 1, ...Object.fromEntries(boundKeys.map(key => [key, context[key]])), receiptId: `capacity-${createHash('sha256').update(context.releaseId).digest('hex')}`,
    executor: approval.databaseOwner, approvalReference: approval.approvalReference, quiescentVersion: context.quiescentVersion,
    quiescentFingerprint: context.quiescentFingerprint, quiescentVerifiedAt: context.quiescentVerifiedAt,
    allPreviousDeploymentsInactive: context.allPreviousDeploymentsInactive, noPendingDeployment: context.noPendingDeployment,
    maintenanceCommandsVerified: context.maintenanceCommandsVerified,
    startedAt: new Date(now).toISOString(), state: 'attempted', passed: false, allConnectionsClosed: false,
    writes: false, claims: false, retry: false, roles: [] };
}

export async function verifyCapacityRole({ role, open }) {
  const client = await open(role.connection);
  let began = false, failure, result;
  try {
    await client.connect();
    requireThat(client.connection?.stream?.encrypted === true && client.connection.stream.authorized === true, 'DB_CAPACITY_TLS_UNVERIFIED');
    await client.query('BEGIN TRANSACTION READ ONLY'); began = true;
    const { rows } = await client.query(`SELECT current_user AS principal,current_user=session_user AS same_principal,
      current_setting('server_version_num')::integer/10000 AS major_version,
      current_setting('transaction_read_only')='on' AS read_only,r.rolcanlogin,r.rolconnlimit,
      (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity a WHERE a.usename=current_user AND a.backend_type='client backend') AS own_connections_including_probe
      FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`);
    const row = rows?.[0];
    requireThat(rows?.length === 1 && row?.principal === role.principal && row.same_principal === true && row.major_version === 17
      && row.read_only === true && row.rolcanlogin === true && row.rolconnlimit === role.connectionLimit, 'DB_CAPACITY_IDENTITY_VERSION_OR_CAP_CHANGED');
    requireThat(row.own_connections_including_probe === 1, 'DB_CAPACITY_OTHER_CONNECTIONS_PRESENT');
    requireThat(client.capacityAsyncError !== true, 'DB_CAPACITY_ASYNC_CONNECTION_FAILED');
    result = { kind: role.kind, target: role.target, principal: role.principal, connectionLimit: role.connectionLimit,
      otherConnections: 0, passed: true, tlsVerified: true, readOnly: true };
  } catch (error) { failure = Error(safeCode(error)); }
  finally {
    if (began) try { await client.query('ROLLBACK'); } catch { failure ||= Error('DB_CAPACITY_ROLLBACK_FAILED'); }
    try { await client.end(); } catch { failure = Error('DB_CAPACITY_CLOSE_FAILED'); }
    if (client.capacityAsyncError === true) failure ||= Error('DB_CAPACITY_ASYNC_CONNECTION_FAILED');
  }
  if (failure) throw failure;
  return result;
}

// claim() creates the immutable once-only attempt and reserves the public receipt before sockets.
// open()/claim()/now() are explicit injection seams for tests; CLI always uses fixed implementations.
export async function runCapacity({ payload, publicContext, open, claim, now = Date.now }) {
  payload = parsePayload(payload);
  requireThat(exactKeys(payload, ['context', 'approval', 'connectionUrls', 'auditSettings']) && isDeepStrictEqual(payload.context, publicContext), 'DB_CAPACITY_PUBLIC_CONTEXT_CHANGED');
  validateDatabaseApproval({ approval: payload.approval, context: payload.context, now: now() });
  const receipt = publicReceipt(payload.context, payload.approval, now());
  const finish = await claim({ releaseId: receipt.releaseId, startedAt: receipt.startedAt, executor: receipt.executor });
  try {
    const roles = validateCapacityInput({ payload, publicContext, now: now() });
    for (const role of roles) receipt.roles.push(await verifyCapacityRole({ role, open }));
    Object.assign(receipt, { state: 'passed', passed: true, allConnectionsClosed: true, completedAt: new Date(now()).toISOString() });
    validateDatabaseReceipt({ approval: payload.approval, receipt, context: payload.context, now: now() });
  } catch (error) {
    Object.assign(receipt, { state: 'stopped', passed: false, error: safeCode(error), completedAt: new Date(now()).toISOString() });
  }
  await finish(receipt);
  return receipt;
}

function pinnedCA() {
  const filename = path.join(root, 'deploy/aws-staging/supabase-ca.crt');
  requireThat(fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), 'DB_CAPACITY_CA_FILE_REJECTED');
  const pem = fs.readFileSync(filename, 'utf8'), cert = new X509Certificate(pem);
  requireThat((pem.match(/BEGIN CERTIFICATE/g) || []).length === 1 && cert.ca && cert.fingerprint256 === caPin
    && cert.checkIssued(cert) && cert.verify(cert.publicKey) && Date.parse(cert.validFrom) <= Date.now() && Date.parse(cert.validTo) > Date.now(), 'DB_CAPACITY_CA_REJECTED');
  return pem;
}

export function capacityClientOptions({ connection, ca }) {
  return { ...connection, port: 5432, ssl: { ca, rejectUnauthorized: true, servername: connection.host,
    checkServerIdentity: tls.checkServerIdentity, minVersion: 'TLSv1.2' },
  options: '-c default_transaction_read_only=on -c search_path=pg_catalog -c statement_timeout=10000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=15000',
  replication: 'false', sslnegotiation: 'postgres', application_name: 'fitsmytime-publish-capacity', client_encoding: 'UTF8',
  connectionTimeoutMillis: 10000, query_timeout: 15000 };
}

export function validateCapacityEnvironment(environment) {
  requireThat(!environment.PGBINARY && !Object.hasOwn(environment, 'NODE_PG_FORCE_NATIVE'), 'DB_CAPACITY_DRIVER_OVERRIDE_REJECTED');
}

export function parseCapacityOptions(args) {
  const parsed = z.array(z.string()).safeParse(args);
  requireThat(parsed.success, 'DB_CAPACITY_OPTIONS_REJECTED'); args = parsed.data;
  if (!args.length || (args.length === 1 && args[0] === '--plan')) return { plan: true };
  requireThat(args.length === 3 && args.filter(value => value === '--execute-authorized-capacity').length === 1, 'DB_CAPACITY_EXPLICIT_EXECUTION_REQUIRED');
  const context = args.filter(value => value.startsWith('--context=')), receipt = args.filter(value => value.startsWith('--receipt='));
  requireThat(context.length === 1 && receipt.length === 1, 'DB_CAPACITY_OPTIONS_REJECTED');
  const options = z.object({ contextFile: stringValue, receiptFile: stringValue }).strict().safeParse({ contextFile: context[0].slice(10), receiptFile: receipt[0].slice(10) });
  requireThat(options.success, 'DB_CAPACITY_OPTIONS_REJECTED'); return options.data;
}

function confinedFiles(options) {
  const contextFile = path.resolve(root, options.contextFile), receiptFile = path.resolve(root, options.receiptFile);
  const snapshot = path.dirname(contextFile);
  requireThat(path.dirname(snapshot) === artifacts && path.basename(snapshot).startsWith('source-')
    && path.dirname(receiptFile) === snapshot && path.basename(contextFile) === 'capacity-context.json'
    && path.basename(receiptFile) === 'capacity-receipt.json', 'DB_CAPACITY_OUTPUT_SCOPE_REJECTED');
  for (const target of [artifacts, snapshot, contextFile]) requireThat(!fs.lstatSync(target).isSymbolicLink()
    && fs.realpathSync(target).toLowerCase() === target.toLowerCase(), 'DB_CAPACITY_PATH_REJECTED');
  requireThat(!fs.existsSync(receiptFile), 'DB_CAPACITY_RECEIPT_EXISTS');
  return { contextFile, receiptFile };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const options = parseCapacityOptions(args);
    if (options.plan) { console.log(JSON.stringify({ plan: true, connected: false, privateConfigurationRead: false, writes: false, roles: DATABASE_RELEASE_ROLES })); return 0; }
    const files = confinedFiles(options);
    const publicContext = JSON.parse(fs.readFileSync(files.contextFile, 'utf8'));
    let input = '', bytes = 0;
    for await (const chunk of process.stdin) { bytes += Buffer.byteLength(chunk); requireThat(bytes <= 65536, 'DB_CAPACITY_INPUT_TOO_LARGE'); input += chunk; }
    const payload = parsePayload(JSON.parse(input)); input = '';
    requireThat(exactKeys(payload, ['context', 'approval', 'connectionUrls', 'auditSettings']) && isDeepStrictEqual(payload.context, publicContext), 'DB_CAPACITY_PUBLIC_CONTEXT_CHANGED');
    validateDatabaseApproval({ approval: payload.approval, context: payload.context });
    validateCapacityEnvironment(process.env);
    const ca = pinnedCA();
    const { default: pg } = await import('pg');
    const open = async config => {
      const client = new pg.Client(capacityClientOptions({ connection: config, ca }));
      client.on('notice', () => {});
      client.on('error', () => { client.capacityAsyncError = true; });
      return client;
    };
    const claim = async record => {
      try { fs.writeFileSync(path.join(artifacts, `capacity-owner-${record.releaseId}-attempt.json`), JSON.stringify(record), { flag: 'wx' }); }
      catch { throw Error('DB_CAPACITY_ALREADY_ATTEMPTED'); }
      const fd = fs.openSync(files.receiptFile, 'wx');
      return async receipt => { try { fs.writeFileSync(fd, JSON.stringify(receipt, null, 2)); } finally { fs.closeSync(fd); } };
    };
    const receipt = await runCapacity({ payload, publicContext, open, claim });
    console.log(JSON.stringify({ passed: receipt.passed, receiptId: receipt.receiptId, state: receipt.state, error: receipt.error, retry: false }));
    return receipt.passed ? 0 : 1;
  } catch (error) { console.error(JSON.stringify({ passed: false, error: safeCode(error), retry: false })); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
