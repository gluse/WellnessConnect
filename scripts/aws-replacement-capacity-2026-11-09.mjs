// Distinct one-shot DB-owner capacity check for the approved replacement service.
// No schema preflight replay, business data, writes, claims, ACL or private edits.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { ROOT, client, connect, requireThat, safeCode } from '../migrations/audit/runtime-support.mjs';
import { ROLES, loadReleaseInventory } from './aws-publish-db-preflight-2026-11-09.mjs';

// Prior old-present preparation was never executed and is retired, not transferred.
export const AUTHORIZATION = 'TASK-036-DELETEFIRST-CAPACITY-2026-11-09';
export const SERVICE = 'fitsmytime-staging-20261109';
export const BASELINE_FINGERPRINT = '8a3596cc579dda6acdf1c4e540e5c865a710a0642a525f574e49026e9cae16c0';
export const CHECKPOINT_FILE = '.env.aws-staging-release-checkpoint-20261109.local';
export const CHECKPOINT_SHA256 = 'ef020e3668689fa5388992a5944cc667d00ec3297207880cd42ece0a330bf5c6';
const emit = detail => process.stdout.write(JSON.stringify(detail) + '\n');
export function validateProof(proof, now = Date.now()) {
  requireThat(proof.region === 'eu-north-1' && proof.project === '674200807170', 'WRONG_AWS_TARGET');
  const old = proof.oldService, next = proof.newService;
  requireThat(proof.deleteFirstAuthorized === true && proof.environmentAuditPassed === true, 'CONDITIONAL_DELETEFIRST_APPROVAL_REQUIRED');
  requireThat(old?.name === 'fitsmytime-staging' && old.absent === true, 'OLD_SERVICE_ABSENCE_REQUIRED');
  requireThat(proof.checkpointSha256 === CHECKPOINT_SHA256, 'PINNED_CHECKPOINT_REQUIRED');
  requireThat(next?.name === SERVICE && next.state === 'READY' && next.isDisabled === false && next.power === 'micro' && next.scale === 1
    && next.current === null && next.next === null, 'NEW_EMPTY_READY_REQUIRED');
  const age = now - Date.parse(proof.verifiedAt);
  requireThat(Number.isFinite(age) && age >= 30_000 && age <= 15 * 60_000, 'FRESH_DRAIN_REQUIRED');
}
export function validateCheckpoint(result, ciphertext, previous) {
  requireThat(result.prepared === true && result.checkpointFile === CHECKPOINT_FILE && result.encryption === 'Windows DPAPI CurrentUser'
    && result.ciphertextSha256 === CHECKPOINT_SHA256 && result.roundtripVerified === true && result.baselineFingerprint === BASELINE_FINGERPRINT
    && result.sourceManifestSha256 === previous.sourceManifestSha256 && result.privateSettingsPrinted === false && result.databaseConnections === false,
  'VERIFIED_CHECKPOINT_REQUIRED');
  requireThat(Buffer.isBuffer(ciphertext) && createHash('sha256').update(ciphertext).digest('hex') === CHECKPOINT_SHA256, 'CHECKPOINT_CIPHERTEXT_CHANGED');
}
export function validateSchemaReceipt(previous, manifest) {
  requireThat(previous.authorization === 'TASK-036-PUBLISH-2026-11-09' && previous.executor === '/root/aws_publish_database'
    && previous.sourceManifestSha256 === manifest && previous.state === 'passed' && previous.passed === true && previous.stage === 'complete'
    && previous.applicationChecks === 38 && previous.quiescence === 'disabled' && previous.quiescentVersion === 8
    && previous.allConnectionsClosed === true && previous.writes === false && previous.claims === false && previous.retry === false,
  'PASSED_CURRENT_SCHEMA_REQUIRED');
  requireThat(previous.roles?.length === ROLES.length && new Set(previous.roles.map(role => role.kind)).size === ROLES.length
    && ROLES.every(role => previous.roles.some(actual => actual.kind === role.kind && actual.connectionLimit === role.cap
      && actual.passed === true && actual.tlsVerified === true && actual.readOnly === true && actual.otherConnections === 0)), 'FIVE_PREVIOUS_ROLES_REQUIRED');
  requireThat(/^[a-f0-9]{64}$/.test(previous.auditSettingsSha256) && /^[a-f0-9]{64}$/.test(previous.runtimeDatabaseSha256), 'PREVIOUS_FINGERPRINTS_REQUIRED');
}
export async function verifyCapacity(role, open = client, establish = connect) {
  const x = await open(role.value, role.target, role.ca, role.principal);
  try {
    await establish(x);
    await x.query('BEGIN TRANSACTION READ ONLY');
    const rows = (await x.query(`SELECT current_user AS principal,current_user=session_user AS same_principal,
      current_setting('server_version_num')::integer/10000=17 AS expected_version,
      current_setting('transaction_read_only')='on' AS read_only,r.rolcanlogin,r.rolconnlimit,
      (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity a WHERE a.usename=current_user AND a.backend_type='client backend') AS own_connections_including_probe
      FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`)).rows;
    const row = rows[0];
    requireThat(rows.length === 1 && row.principal === role.principal && row.same_principal === true && row.expected_version === true
      && row.read_only === true && row.rolcanlogin === true && row.rolconnlimit === role.cap, 'PRINCIPAL_VERSION_OR_CAP_CHANGED');
    requireThat(row.own_connections_including_probe === 1, 'OTHER_RUNTIME_CONNECTIONS_PRESENT');
    await x.query('COMMIT');
    return { kind: role.kind, passed: true, tlsVerified: true, readOnly: true, connectionLimit: row.rolconnlimit, otherConnections: 0 };
  } finally { await x.end(); }
}
export async function main(args = process.argv.slice(2)) {
  let stage = 'plan', receipt, record;
  try {
    if (!args.length || (args.length === 1 && args[0] === '--plan')) {
      emit({ stage, authorization: AUTHORIZATION, newService: SERVICE, roles: ROLES.map(({ kind, cap }) => ({ kind, cap })), capacityOnly: true,
        writes: false, claims: false, privateRead: false, connected: false }); return 0;
    }
    requireThat(args.length === 2 && args[1] === `--execute-capacity=${AUTHORIZATION}`, 'MODE_REJECTED');
    const snapshot = path.resolve(ROOT, args[0]);
    requireThat(path.dirname(snapshot) === path.join(ROOT, 'outputs/aws-staging-build') && path.basename(snapshot).startsWith('source-'), 'SNAPSHOT_SCOPE');
    const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'));
    requireThat(/^[a-f0-9]{64}$/.test(manifest.sha256) && createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex') === manifest.sha256, 'MANIFEST_REJECTED');
    for (const file of manifest.files.filter(file => /^(migrations\/|server\/audit\/)/.test(file.path))) requireThat(file.sha256 === createHash('sha256').update(fs.readFileSync(path.join(ROOT, file.path))).digest('hex'), 'READINESS_SOURCE_CHANGED');
    const previous = JSON.parse(fs.readFileSync(path.join(snapshot, 'db-release-preflight-2026-11-09.json'), 'utf8'));
    validateSchemaReceipt(previous, manifest.sha256);
    const proof = JSON.parse(fs.readFileSync(path.join(snapshot, 'replacement-capacity-ready.json'), 'utf8'));
    validateProof(proof);
    const checkpoint = JSON.parse(fs.readFileSync(path.join(snapshot, 'encrypted-checkpoint-result.json'), 'utf8'));
    validateCheckpoint(checkpoint, fs.readFileSync(path.join(ROOT, CHECKPOINT_FILE)), previous);
    record = { authorization: AUTHORIZATION, executor: '/root/aws_publish_database', sourceManifestSha256: manifest.sha256,
      newService: SERVICE, oldServiceAbsent: true, baselineVersion: 8, checkpointSha256: CHECKPOINT_SHA256,
      environmentAuditPassed: true, deleteFirstAuthorized: true, newServiceReadyEmpty: true, proofVerifiedAt: proof.verifiedAt,
      capacityOnly: true, startedAt: new Date().toISOString(), state: 'attempted', stage, roles: [], writes: false, claims: false, retry: false };
    receipt = path.join(snapshot, 'db-replacement-capacity-2026-11-09.json');
    fs.writeFileSync(path.join(ROOT, 'outputs/aws-staging-build/db-replacement-capacity-2026-11-09-attempt.json'), JSON.stringify(record, null, 2), { flag: 'wx' });
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2), { flag: 'wx' });
    stage = 'private_inventory';
    const inventory = loadReleaseInventory();
    requireThat(inventory.auditSettingsSha256 === previous.auditSettingsSha256
      && inventory.runtimeDatabaseSha256 === previous.runtimeDatabaseSha256, 'RELEASE_CREDENTIALS_CHANGED');
    record.auditSettingsSha256 = inventory.auditSettingsSha256;
    record.runtimeDatabaseSha256 = inventory.runtimeDatabaseSha256;
    for (const role of inventory.configs) {
      stage = role.kind;
      const result = await verifyCapacity(role);
      record.roles.push(result);
      fs.writeFileSync(receipt, JSON.stringify({ ...record, stage }, null, 2));
      emit({ stage, ...result });
    }
    Object.assign(record, { stage: 'complete', state: 'passed', passed: true, completedAt: new Date().toISOString(), allConnectionsClosed: true });
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2)); emit(record); return 0;
  } catch (error) {
    const result = { stage, passed: false, safeCode: error?.code === 'EEXIST' ? 'ATTEMPT_ALREADY_EXISTS' : safeCode(error), retry: false };
    if (receipt && record && error?.code !== 'EEXIST') fs.writeFileSync(receipt, JSON.stringify({ ...record, ...result, state: 'stopped', completedAt: new Date().toISOString() }, null, 2));
    emit(result); return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
