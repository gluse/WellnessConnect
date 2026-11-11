import assert from 'node:assert/strict';
import { ROLES, PROFILE, verifyOne, validateMaintenance, validateDisabled, validateFlags, prepareAuditRuntimeSettings, auditSettingsFingerprint,
  runtimeDatabaseSettings, runtimeDatabaseFingerprint, main } from './aws-publish-db-preflight-2026-11-09.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS } from '../migrations/workspace-pricing/application-readiness.mjs';
import { CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS } from '../migrations/currencies/application-readiness.mjs';
import { SERVICE_PHOTO_READINESS_SQL, SERVICE_PHOTO_READINESS_KEYS } from '../migrations/service-photos/application-readiness.mjs';
import { SERVICE_REMINDER_MESSAGE_READINESS_SQL, SERVICE_REMINDER_MESSAGE_READINESS_KEYS } from '../migrations/service-reminder-message/application-readiness.mjs';
const guards = [[WORKSPACE_PRICING_APPLICATION_READINESS_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS], [CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS],
  [SERVICE_PHOTO_READINESS_SQL, SERVICE_PHOTO_READINESS_KEYS], [SERVICE_REMINDER_MESSAGE_READINESS_SQL, SERVICE_REMINDER_MESSAGE_READINESS_KEYS]];
assert.equal(guards.reduce((n, [, keys]) => n + keys.length, 0), PROFILE.total);
assert.equal(PROFILE.total, 38);
const app = { AUDIT_ENABLED: 'true', AUDIT_ENVIRONMENT: 'development', AUDIT_SERVICE_VIEWS_ENABLED: 'true', AUDIT_WORKER_ENABLED: 'false', AUDIT_AUTH_EVENTS_ENABLED: 'false',
  DATABASE_URL: 'postgres://fmt_app_dev:fake@db.hbkooiknruimukkhshrk.supabase.co/postgres', SUPABASE_URL: 'https://hbkooiknruimukkhshrk.supabase.co' };
const worker = { AUDIT_WORKER_ENABLED: 'true', AUDIT_ENVIRONMENT: 'development', AUDIT_AUTH_EVENTS_ENABLED: 'false' };
const audit = { AUDIT_PRODUCER_CONTRACT: 'completion-0008', AUDIT_READER_USER_IDS: '00000008-0000-4000-8000-000000000008', AUDIT_EXPORT_USER_IDS: '00000008-0000-4000-8000-000000000008' };
validateFlags(app, worker, audit);
for (const change of [{ NOTIFICATIONS_ENABLED: 'true' }, { NOTIFICATIONS_AUTOMATION_ENABLED: 'true' }, { PRODUCT_ACTIVITY_ENABLED: 'true' },
  { AUDIT_AUTH_EVENTS_ENABLED: 'true' }, { AUDIT_DATABASE_URL: 'forbidden' }, { SUPABASE_URL: 'https://other.supabase.co' }]) assert.throws(() => validateFlags({ ...app, ...change }, worker, audit));
assert.throws(() => validateFlags(app, worker, { ...audit, AUDIT_READER_USER_IDS: '' }));
assert.throws(() => validateFlags(app, worker, { ...audit, AUDIT_PRODUCER_CONTRACT: '' }));
const runtime = prepareAuditRuntimeSettings({ ...audit, AUDIT_READER_DATABASE_URL: 'postgres://fmt_audit_reader_dev:fake@db.ynygqodmtgjrngiudalw.supabase.co/postgres?sslmode=verify-full&sslrootcert=C%3A%2Ffake-ca.crt' });
assert.deepEqual(Object.keys(runtime), ['AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS']);
assert.equal(new URL(runtime.AUDIT_READER_DATABASE_URL).searchParams.get('sslrootcert'), '/app/certs/supabase-ca.crt');
assert.equal(runtime.AUDIT_READER_USER_IDS, audit.AUDIT_READER_USER_IDS);
assert.match(auditSettingsFingerprint(runtime), /^[a-f0-9]{64}$/);
assert.throws(() => prepareAuditRuntimeSettings({ ...audit, AUDIT_READER_DATABASE_URL: app.DATABASE_URL }));
assert.throws(() => prepareAuditRuntimeSettings({ ...audit, AUDIT_READER_DATABASE_URL: runtime.AUDIT_READER_DATABASE_URL + '&application_name=override' }));
const staged = Object.fromEntries(ROLES.filter(role => role.kind !== 'reader').map(role => [role.key,
  `postgres://${role.principal}:fake@db.${role.target === 'source' ? 'hbkooiknruimukkhshrk' : 'ynygqodmtgjrngiudalw'}.supabase.co/postgres?sslmode=verify-full&sslrootcert=%2Fapp%2Fcerts%2Fsupabase-ca.crt`]));
const runtimeApp = { DATABASE_URL: staged.DATABASE_URL, AUDIT_CAPTURE_DATABASE_URL: staged.AUDIT_CAPTURE_DATABASE_URL };
const runtimeWorker = { AUDIT_SOURCE_DATABASE_URL: staged.AUDIT_SOURCE_DATABASE_URL, AUDIT_DATABASE_URL: staged.AUDIT_DATABASE_URL };
assert.deepEqual(Object.keys(runtimeDatabaseSettings(runtimeApp, runtimeWorker)), ['AUDIT_CAPTURE_DATABASE_URL', 'AUDIT_DATABASE_URL', 'AUDIT_SOURCE_DATABASE_URL', 'DATABASE_URL']);
assert.equal(runtimeDatabaseSettings(runtimeApp, runtimeWorker).DATABASE_URL, staged.DATABASE_URL);
assert.equal(runtimeDatabaseFingerprint(runtimeApp, runtimeWorker), auditSettingsFingerprint(runtimeDatabaseSettings(runtimeApp, runtimeWorker)));
assert.notEqual(runtimeDatabaseFingerprint(runtimeApp, runtimeWorker), runtimeDatabaseFingerprint({ ...runtimeApp, DATABASE_URL: staged.DATABASE_URL.replace(':fake@', ':other@') }, runtimeWorker));
assert.throws(() => runtimeDatabaseSettings({ ...runtimeApp, DATABASE_URL: staged.AUDIT_CAPTURE_DATABASE_URL }, runtimeWorker));
const now = Date.now();
const maintenance = { maintenanceVersion: 9, active: true, allPreviousInactive: true, allCommandsDatabaseFree: true, checkedAt: new Date(now - 31_000).toISOString() };
validateMaintenance(maintenance, 9, now);
for (const change of [{ active: false }, { allPreviousInactive: false }, { allCommandsDatabaseFree: false }, { maintenanceVersion: 8 },
  { checkedAt: new Date(now).toISOString() }, { checkedAt: new Date(now - 1_000_000).toISOString() }]) assert.throws(() => validateMaintenance({ ...maintenance, ...change }, 9, now));
const disabled = { service: 'fitsmytime-staging', region: 'eu-north-1', currentVersion: 8, isDisabled: true, serviceState: 'DISABLED', noPending: true, fingerprint: 'a'.repeat(64), verifiedAt: maintenance.checkedAt };
validateDisabled(disabled, 8, now);
for (const change of [{ isDisabled: false }, { serviceState: 'RUNNING' }, { noPending: false }, { currentVersion: 7 }, { region: 'us-east-1' }, { fingerprint: 'bad' }]) assert.throws(() => validateDisabled({ ...disabled, ...change }, 8, now));
function fake(role, changes = {}) {
  let closed = 0;
  const queries = [];
  const x = { connection: { stream: { encrypted: true, authorized: true } },
    async query(sql) {
      queries.push(sql);
      assert(/^(?:SELECT|WITH|BEGIN TRANSACTION READ ONLY|COMMIT)/.test(sql));
      let row;
      if (sql.includes('own_connections_including_probe')) row = { same_principal: true, expected_version: true, read_only: true, rolcanlogin: true, rolconnlimit: role.cap, own_connections_including_probe: 1, ...changes.identity };
      else if (guards.some(([text]) => text === sql)) { const [, keys] = guards.find(([text]) => text === sql); row = Object.fromEntries(keys.map(key => [key, changes.guard === key ? false : true])); }
      else if (sql.includes('AS parser_chain_exact')) row = { parser_chain_exact: changes.parser !== false };
      else if (sql.includes('AS app_member')) row = { principal: 'fmt_app_dev', rolcanlogin: true, rolinherit: true, rolconnlimit: 5, app_member: true, capture_member: true, may_enqueue: true,
        rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false, extra_role: false, membership_admin: false, owns_objects: false, permanent_ddl: false, audit_base_access: false };
      else if (sql.includes('AS reader_member')) row = { principal: role.principal, reader_member: true, view_access: true, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false,
        rolreplication: false, base_access: false, extra_role: false, permanent_ddl: false, ...changes.role };
      else if (sql.includes('AS group_member')) row = { principal: role.principal, group_member: true, may_execute: true, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false,
        rolreplication: false, base_access: false, owner_member: false, extra_application_role: false, ...changes.role };
      return { rows: row ? [row] : [] };
    }, async end() { closed++; } };
  return { x, queries, get closed() { return closed; } };
}
let checked = 0;
for (const role of ROLES) {
  const f = fake(role);
  const result = await verifyOne(role, app, async () => f.x, async () => {});
  assert.equal(result.passed, true); assert.equal(result.otherConnections, 0); assert.equal(f.closed, 1); assert.equal(f.queries.at(-1), 'COMMIT'); checked++;
  for (const changes of [{ identity: { own_connections_including_probe: 2 } }, { identity: { rolconnlimit: 99 } }, { identity: { expected_version: false } }, { parser: false }]) {
    const failed = fake(role, changes);
    await assert.rejects(verifyOne(role, app, async () => failed.x, async () => {}));
    assert.equal(failed.closed, 1); assert(!failed.queries.includes('COMMIT')); checked++;
  }
}
for (const [, keys] of guards) for (const guard of keys) {
  const f = fake(ROLES[0], { guard });
  await assert.rejects(verifyOne(ROLES[0], app, async () => f.x, async () => {}));
  assert.equal(f.closed, 1); assert(!f.queries.includes('COMMIT')); checked++;
}
const reader = fake(ROLES[4], { role: { base_access: true } });
await assert.rejects(verifyOne(ROLES[4], app, async () => reader.x, async () => {})); assert.equal(reader.closed, 1); checked++;
// Retired/manual authorization fails before snapshot/private reads and sockets.
assert.equal(await main(['missing', '--execute-release=TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06', '--disabled-version=8']), 1);
console.log(JSON.stringify({ passed: true, mockedRoleReadinessChecks: checked, privateReads: false, connections: false, writes: false }));
