import assert from 'node:assert/strict';
import { ROLES } from './aws-publish-db-preflight-2026-11-09.mjs';
import { AUTHORIZATION, SERVICE, BASELINE_FINGERPRINT, CHECKPOINT_FILE, CHECKPOINT_SHA256, validateProof, validateCheckpoint, validateSchemaReceipt, verifyCapacity, main } from './aws-replacement-capacity-2026-11-09.mjs';
const now = Date.now();
const proof = { region: 'eu-north-1', project: '674200807170', verifiedAt: new Date(now - 31_000).toISOString(),
  deleteFirstAuthorized: true, environmentAuditPassed: true, checkpointSha256: CHECKPOINT_SHA256,
  oldService: { name: 'fitsmytime-staging', absent: true },
  newService: { name: SERVICE, state: 'READY', isDisabled: false, power: 'micro', scale: 1, current: null, next: null } };
validateProof(proof, now);
for (const change of [{ region: 'us-east-1' }, { project: 'wrong' }, { deleteFirstAuthorized: false }, { environmentAuditPassed: false }, { checkpointSha256: 'other' },
  { verifiedAt: new Date(now).toISOString() }, { verifiedAt: new Date(now - 1000_000).toISOString() }]) assert.throws(() => validateProof({ ...proof, ...change }, now));
for (const change of [{ name: 'other' }, { absent: false }, { absent: undefined, state: 'DISABLED', isDisabled: true, currentVersion: 8 }]) assert.throws(() => validateProof({ ...proof, oldService: { ...proof.oldService, ...change } }, now));
for (const change of [{ name: 'other' }, { state: 'RUNNING' }, { isDisabled: true }, { power: 'small' }, { scale: 2 }, { current: {} }, { next: {} }]) assert.throws(() => validateProof({ ...proof, newService: { ...proof.newService, ...change } }, now));
const previous = { authorization: 'TASK-036-PUBLISH-2026-11-09', executor: '/root/aws_publish_database', sourceManifestSha256: 'a'.repeat(64), state: 'passed', passed: true, stage: 'complete',
  applicationChecks: 38, quiescence: 'disabled', quiescentVersion: 8, allConnectionsClosed: true, writes: false, claims: false, retry: false, auditSettingsSha256: 'b'.repeat(64), runtimeDatabaseSha256: 'c'.repeat(64),
  roles: ROLES.map(role => ({ kind: role.kind, connectionLimit: role.cap, passed: true, tlsVerified: true, readOnly: true, otherConnections: 0 })) };
validateSchemaReceipt(previous, 'a'.repeat(64));
const checkpoint = { prepared: true, checkpointFile: CHECKPOINT_FILE, encryption: 'Windows DPAPI CurrentUser', ciphertextSha256: CHECKPOINT_SHA256,
  roundtripVerified: true, baselineFingerprint: BASELINE_FINGERPRINT, sourceManifestSha256: previous.sourceManifestSha256, privateSettingsPrinted: false, databaseConnections: false };
// Arbitrary ciphertext cannot satisfy the pinned recovery artifact; no private file is read.
assert.throws(() => validateCheckpoint(checkpoint, Buffer.from('untrusted'), previous), /CHECKPOINT_CIPHERTEXT_CHANGED/);
for (const change of [{ roundtripVerified: false }, { ciphertextSha256: 'other' }, { sourceManifestSha256: 'd'.repeat(64) }, { checkpointFile: 'other' }, { encryption: 'none' }]) assert.throws(() => validateCheckpoint({ ...checkpoint, ...change }, Buffer.from('untrusted'), previous), /VERIFIED_CHECKPOINT_REQUIRED/);
for (const change of [{ authorization: AUTHORIZATION }, { state: 'stopped' }, { sourceManifestSha256: 'd'.repeat(64) }, { applicationChecks: 34 }, { writes: true }, { claims: true }, { retry: true },
  { roles: previous.roles.slice(0, 4) }, { roles: [previous.roles[0], ...previous.roles.slice(0, 4)] }, { auditSettingsSha256: 'missing' }, { runtimeDatabaseSha256: '' }]) assert.throws(() => validateSchemaReceipt({ ...previous, ...change }, 'a'.repeat(64)));
let scenarios = 0;
for (const role of ROLES) {
  for (const change of [undefined, { principal: 'postgres' }, { same_principal: false }, { expected_version: false }, { read_only: false }, { rolcanlogin: false }, { rolconnlimit: 99 }, { own_connections_including_probe: 2 }]) {
    let closed = 0; const statements = [];
    const x = { async query(sql) {
      statements.push(sql);
      assert(/^(?:BEGIN TRANSACTION READ ONLY|SELECT current_user AS principal|COMMIT)/.test(sql));
      if (!sql.startsWith('SELECT')) return { rows: [] };
      assert(sql.includes('pg_catalog.pg_stat_activity') && sql.includes('pg_catalog.pg_roles'));
      assert(!/audit_capture\.|audit\.|public\./.test(sql));
      return { rows: [{ principal: role.principal, same_principal: true, expected_version: true, read_only: true, rolcanlogin: true, rolconnlimit: role.cap, own_connections_including_probe: 1, ...change }] };
    }, async end() { closed++; } };
    if (change) { await assert.rejects(verifyCapacity(role, async () => x, async () => {})); assert(!statements.includes('COMMIT')); }
    else { const result = await verifyCapacity(role, async () => x, async () => {}); assert.equal(result.passed, true); assert.equal(result.otherConnections, 0); assert.equal(statements.at(-1), 'COMMIT'); }
    assert.equal(closed, 1); scenarios++;
  }
  let closed = 0;
  await assert.rejects(verifyCapacity(role, async () => ({ async end() { closed++; } }), async () => { throw Error('TLS refused'); }));
  assert.equal(closed, 1); scenarios++;
}
assert.equal(await main(['missing', '--execute-capacity=TASK-036-PUBLISH-2026-11-09']), 1);
assert.equal(await main(['missing', '--execute-capacity=TASK-036-REPLACEMENT-CAPACITY-2026-11-09']), 1);
console.log(JSON.stringify({ passed: true, mockedCapacityScenarios: scenarios, privateReads: false, connections: false, writes: false }));
