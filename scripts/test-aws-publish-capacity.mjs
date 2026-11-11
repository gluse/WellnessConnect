import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import tls from 'node:tls';
import { DATABASE_RELEASE_ROLES, validateDatabaseReceipt } from './aws-publish-db-contract.mjs';
import { capacityClientOptions, capacityConnection, parseCapacityOptions, runCapacity, validateCapacityEnvironment, validateCapacityInput } from './aws-publish-capacity.mjs';

const now = Date.parse('2026-11-11T12:00:00.000Z');
const secret = 'fixture_only_secret_payload';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function synchronize(payload) {
  payload.context.runtimeDatabaseSha256 = hash({ AUDIT_CAPTURE_DATABASE_URL: payload.connectionUrls.capture,
    AUDIT_DATABASE_URL: payload.connectionUrls.writer, AUDIT_SOURCE_DATABASE_URL: payload.connectionUrls.worker, DATABASE_URL: payload.connectionUrls.app });
  payload.context.auditSettingsSha256 = hash(payload.auditSettings);
  for (const key of ['runtimeDatabaseSha256', 'auditSettingsSha256']) payload.approval[key] = payload.context[key];
}
function fixture() {
  const context = { releaseId: 'fixture-capacity-001', project: '674200807170', region: 'eu-north-1', service: 'fitsmytime-staging-20261109',
    sourceManifestSha256: 'a'.repeat(64), baselineFingerprint: 'b'.repeat(64), runtimeDatabaseSha256: 'c'.repeat(64), auditSettingsSha256: 'd'.repeat(64),
    quiescentVersion: 2, quiescentFingerprint: 'e'.repeat(64), quiescentVerifiedAt: '2026-11-11T11:59:00.000Z',
    allPreviousDeploymentsInactive: true, noPendingDeployment: true, maintenanceCommandsVerified: true, origin: 'https://fixture.example', baselineVersion: 1 };
  const bound = Object.fromEntries(Object.entries(context).filter(([key]) => ['releaseId','project','region','service','sourceManifestSha256','baselineFingerprint','runtimeDatabaseSha256','auditSettingsSha256'].includes(key)));
  const approval = { version: 1, ...bound, databaseOwner: '/root/db-fixture', backendOwner: '/root/backend-fixture', approvalReference: 'docs/fixture#acceptance',
    expiresAt: '2026-11-11T13:00:00.000Z', compatibilityAccepted: true, transition: 'maintenance', recovery: 'stop-and-inspect',
    schema: { profile: 'customer-service-notifications-current42', tableCount: 42, applicationChecks: 44, verifiedApplied: true,
      sourceProject: 'hbkooiknruimukkhshrk', destinationProject: 'ynygqodmtgjrngiudalw' } };
  const connectionUrls = Object.fromEntries(DATABASE_RELEASE_ROLES.map(role => [role.kind,
    `postgresql://${role.principal}:${secret}@db.${role.target === 'source' ? 'hbkooiknruimukkhshrk' : 'ynygqodmtgjrngiudalw'}.supabase.co/postgres?sslmode=verify-full&sslrootcert=%2Fapp%2Fcerts%2Fsupabase-ca.crt`]));
  const auditSettings = { AUDIT_EXPORT_USER_IDS: 'a0140000-0000-4000-8000-000000000001', AUDIT_PRODUCER_CONTRACT: 'completion-0008',
    AUDIT_READER_DATABASE_URL: connectionUrls.reader, AUDIT_READER_USER_IDS: 'a0140000-0000-4000-8000-000000000001' };
  const payload = { context, approval, connectionUrls, auditSettings }; synchronize(payload); return payload;
}

let scenarios = 0;
async function exercise({ mutate = () => {}, failedKind, field, replacement, failStage, consumed = false } = {}) {
  const payload = fixture(); mutate(payload);
  const calls = [], clients = []; let claimed = consumed, receipt;
  const open = async connection => {
    const role = DATABASE_RELEASE_ROLES.find(role => connection.user === role.principal);
    calls.push(role.kind);
    if (role.kind === failedKind && failStage === 'open') throw Error(secret);
    const client = { connection: { stream: { encrypted: true, authorized: true } }, closed: false, queries: [],
      async connect() { if (role.kind === failedKind && failStage === 'connect') throw Error(secret); },
      async query(sql) {
        this.queries.push(sql);
        if (role.kind === failedKind && failStage === 'query' && sql.startsWith('SELECT')) throw Error(secret);
        if (role.kind === failedKind && failStage === 'rollback' && sql === 'ROLLBACK') throw Error(secret);
        if (!sql.startsWith('SELECT')) return { rows: [] };
        const row = { principal: role.principal, same_principal: true, major_version: 17, read_only: true, rolcanlogin: true,
          rolconnlimit: role.connectionLimit, own_connections_including_probe: 1 };
        if (role.kind === failedKind && field) row[field] = replacement;
        return { rows: [row] };
      },
      async end() { this.closed = true; if (role.kind === failedKind && failStage === 'close') throw Error(secret); } };
    if (role.kind === failedKind && failStage === 'tls') client.connection.stream.authorized = false;
    if (role.kind === failedKind && failStage === 'async') client.capacityAsyncError = true;
    clients.push(client); return client;
  };
  const claim = async () => { assert.equal(claimed, false, 'DB_CAPACITY_ALREADY_ATTEMPTED'); claimed = true; return async value => { receipt = value; }; };
  const result = await runCapacity({ payload, publicContext: payload.context, open, claim, now: () => now });
  assert.equal(receipt, result);
  assert(!JSON.stringify(receipt).includes(secret));
  assert(clients.every(client => client.closed));
  assert(clients.every(client => !client.queries.some(sql => /COMMIT|INSERT|UPDATE|DELETE|CREATE|ALTER|GRANT/.test(sql))));
  if (failedKind) assert.equal(calls.length, DATABASE_RELEASE_ROLES.findIndex(role => role.kind === failedKind) + 1);
  scenarios++; return { result, payload, clients, calls, claim, open };
}

const passed = await exercise();
assert.equal(passed.result.passed, true);
assert.equal(passed.calls.length, 5);
assert.equal(validateDatabaseReceipt({ approval: passed.payload.approval, receipt: passed.result, context: passed.payload.context, now }).accepted, true);
assert(passed.clients.every(client => client.queries.length === 3 && client.queries[0] === 'BEGIN TRANSACTION READ ONLY' && client.queries.at(-1) === 'ROLLBACK'));
await assert.rejects(() => runCapacity({ payload: passed.payload, publicContext: passed.payload.context, open: passed.open, claim: passed.claim, now: () => now }), /DB_CAPACITY_ALREADY_ATTEMPTED/); scenarios++;

for (const role of DATABASE_RELEASE_ROLES) {
  for (const [field, replacement] of Object.entries({ principal: 'postgres', same_principal: false, major_version: 16, read_only: false, rolcanlogin: false, rolconnlimit: 99, own_connections_including_probe: 2 })) {
    const { result } = await exercise({ failedKind: role.kind, field, replacement }); assert.equal(result.passed, false);
  }
  for (const failStage of ['open', 'connect', 'query', 'rollback', 'close', 'tls', 'async']) {
    const { result } = await exercise({ failedKind: role.kind, failStage }); assert.equal(result.passed, false);
  }
}
for (const mutate of [
  payload => { payload.context.maintenanceCommandsVerified = false; },
  payload => { payload.context.noPendingDeployment = false; },
  payload => { payload.context.allPreviousDeploymentsInactive = false; },
  payload => { payload.context.quiescentVerifiedAt = '2026-11-11T11:59:31.000Z'; },
  payload => { payload.context.quiescentVerifiedAt = '2026-11-11T11:44:59.000Z'; },
  payload => { payload.context.quiescentVerifiedAt = '2026-11-11T12:01:00.000Z'; },
  payload => { payload.connectionUrls.app = payload.connectionUrls.reader; },
  payload => { payload.auditSettings.AUDIT_READER_USER_IDS = 'other'; },
  payload => { payload.auditSettings.AUDIT_PRODUCER_CONTRACT = 'old'; },
  payload => { payload.connectionUrls.app += '&options=unsafe'; synchronize(payload); },
  payload => { payload.connectionUrls.app = payload.connectionUrls.app.replace('verify-full', 'require'); synchronize(payload); },
  payload => { payload.connectionUrls.app = payload.connectionUrls.app.replace('%2Fapp%2Fcerts%2Fsupabase-ca.crt', '%2Fprivate%2Fca'); synchronize(payload); },
  payload => { payload.connectionUrls.app = payload.connectionUrls.app.replace('hbkooiknruimukkhshrk', 'other'); synchronize(payload); },
]) {
  const { result, calls } = await exercise({ mutate }); assert.equal(result.passed, false); assert.equal(calls.length, 0);
}
for (const mutate of [payload => { payload.approval.schema.verifiedApplied = false; }, payload => { payload.approval.compatibilityAccepted = false; }, payload => { payload.approval.expiresAt = '2026-11-11T11:59:59.000Z'; }]) {
  await assert.rejects(() => exercise({ mutate }), /DB_RELEASE_/); scenarios++;
}
for (const mutate of [payload => { payload.auditSettings.EXTRA_PRIVATE_KEY = secret; }, payload => { payload.connectionUrls.extra = secret; }, payload => { payload.extra = secret; }]) {
  const payload = fixture(); mutate(payload); let opened = false, claimed = false;
  await assert.rejects(() => runCapacity({ payload, publicContext: payload.context, now: () => now,
    open: async () => { opened = true; }, claim: async () => { claimed = true; } }), /DB_CAPACITY_PAYLOAD_SHAPE_REJECTED/);
  assert.equal(opened, false); assert.equal(claimed, false); scenarios++;
}
const changed = fixture();
assert.throws(() => validateCapacityInput({ payload: changed, publicContext: { ...changed.context, origin: 'changed' }, now }), /DB_CAPACITY_PUBLIC_CONTEXT_CHANGED/); scenarios++;
const poolerRole = DATABASE_RELEASE_ROLES[0];
const pooled = `postgres://${poolerRole.principal}.hbkooiknruimukkhshrk:${secret}@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=%2Fapp%2Fcerts%2Fsupabase-ca.crt`;
assert.equal(capacityConnection(pooled, poolerRole).user, 'fmt_app_dev.hbkooiknruimukkhshrk'); scenarios++;
for (const value of [pooled.replace(':5432/', ':6543/'), pooled + '&sslmode=verify-full', pooled.replace('.hbkooiknruimukkhshrk:', '.ynygqodmtgjrngiudalw:'), 'not a URL']) {
  assert.throws(() => capacityConnection(value, poolerRole), /DB_CAPACITY_/); scenarios++;
}
const config = capacityClientOptions({ connection: { host: 'fixture.example', user: 'fixture', password: secret, database: 'postgres' }, ca: 'public-ca' });
assert.equal(config.ssl.rejectUnauthorized, true); assert.equal(config.ssl.checkServerIdentity, tls.checkServerIdentity);
assert.equal(config.ssl.servername, 'fixture.example'); assert.equal(config.ssl.minVersion, 'TLSv1.2');
assert.match(config.options, /default_transaction_read_only=on/); assert.match(config.options, /statement_timeout=10000/); assert.equal(config.connectionTimeoutMillis, 10000); scenarios++;
validateCapacityEnvironment({}); scenarios++;
for (const environment of [{ PGBINARY: '1' }, { NODE_PG_FORCE_NATIVE: '1' }, { NODE_PG_FORCE_NATIVE: '0' }, { NODE_PG_FORCE_NATIVE: '' }]) {
  assert.throws(() => validateCapacityEnvironment(environment), /DB_CAPACITY_DRIVER_OVERRIDE_REJECTED/); scenarios++;
}
for (const args of [[], ['--plan']]) assert.deepEqual(parseCapacityOptions(args), { plan: true }); scenarios += 2;
for (const args of [['--context=x', '--receipt=y'], ['--execute-authorized-capacity'], ['--context=x', '--context=z', '--execute-authorized-capacity']]) {
  assert.throws(() => parseCapacityOptions(args), /DB_CAPACITY_/); scenarios++;
}
const plan = spawnSync(process.execPath, ['scripts/aws-publish-capacity.mjs', '--plan'], { encoding: 'utf8', input: secret });
assert.equal(plan.status, 0); assert.equal(JSON.parse(plan.stdout).connected, false); assert(!plan.stdout.includes(secret)); assert.equal(plan.stderr, ''); scenarios++;
console.log(JSON.stringify({ passed: true, scenarios, connected: false, privateConfigurationRead: false, writes: false }));
