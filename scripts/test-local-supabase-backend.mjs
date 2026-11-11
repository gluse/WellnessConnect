// Pure/injected decisions only: no dotenv, real credentials or connected services.
import assert from 'node:assert/strict';
import { auditConnection, auditApplicationConnection, assertAuditActivation, assertAuditTransport,
  assertLocalAuditIsolation, AUDIT_USERS } from '../server/audit/config.ts';
import { parseAuditReaderConnection } from '../server/audit/viewer-runtime.ts';
import { verifyAuditApplicationPool } from '../server/audit/application.ts';
import { createCaptureRuntime, createWorkerRuntime } from '../server/audit/runtime.ts';
import { prepareLocalDevelopmentEnvironment, assembleLocalProfile, localDormantOperation, planLocalPortMigration } from './start-local-development.mjs';
import { readSettings } from '../migrations/audit/runtime-support.mjs';
import { runHistoricalOperation, HISTORICAL_COMMANDS } from './guard-historical-local-operation.mjs';

const uri = (user, port) => `postgresql://${user}:synthetic-only@127.0.0.1:${port}/postgres?sslmode=disable`;
const profile = {
  NODE_ENV: 'development', AUDIT_RUNTIME_PROFILE: 'local-docker', AUDIT_ENVIRONMENT: 'development',
  AUDIT_ENABLED: 'true', AUDIT_WORKER_ENABLED: 'true', AUDIT_AUTH_EVENTS_ENABLED: 'false',
  SUPABASE_URL: 'http://127.0.0.1:15421', APP_URL: 'http://localhost:5000',
  DATABASE_URL: uri('fmt_app_dev', 15422), AUDIT_CAPTURE_DATABASE_URL: uri(AUDIT_USERS.capture, 15422),
  AUDIT_SOURCE_DATABASE_URL: uri(AUDIT_USERS.worker, 15422), AUDIT_DATABASE_URL: uri(AUDIT_USERS.writer, 15432),
  AUDIT_READER_DATABASE_URL: uri('fmt_audit_reader_dev', 15432),
};
assertAuditActivation(profile);
const app = auditApplicationConnection(profile.DATABASE_URL, profile);
assert.equal(app.local, true); assert.equal(app.port, 15422); assert.equal(app.user, 'fmt_app_dev');
for (const kind of ['capture', 'worker', 'writer']) {
  const url = profile[kind === 'capture' ? 'AUDIT_CAPTURE_DATABASE_URL' : kind === 'worker' ? 'AUDIT_SOURCE_DATABASE_URL' : 'AUDIT_DATABASE_URL'];
  const config = auditConnection(url, kind, profile);
  assert.equal(config.local, true); assert.equal(config.user, AUDIT_USERS[kind]);
  assert.throws(() => auditConnection(url, kind), 'Local URL requires explicit development opt-in');
  for (const bad of [url.replace('127.0.0.1', 'localhost'), url.replace('127.0.0.1', 'evil.invalid'),
    url.replace('127.0.0.1', '127.0.0.2'), url.replace('127.0.0.1', '2130706433'), url.replace(AUDIT_USERS[kind], 'postgres'),
    url.replace('/postgres', '/other'), url.replace('disable', 'require'), url + '&host=evil.invalid',
    url + '&sslmode=disable', url + '#fragment', url + '\n', url.replace(':synthetic-only', ':')]) {
    assert.throws(() => auditConnection(bad, kind, profile));
  }
}
const reader = parseAuditReaderConnection(profile.AUDIT_READER_DATABASE_URL, profile);
assert.equal(reader.local, true); assert.equal(reader.port, 15432);
assert.throws(() => parseAuditReaderConnection(profile.AUDIT_READER_DATABASE_URL));
assert.throws(() => auditApplicationConnection(profile.DATABASE_URL));
assert.throws(() => auditApplicationConnection(profile.DATABASE_URL.replace('15422', '15432'), profile));
assert.throws(() => parseAuditReaderConnection(profile.AUDIT_READER_DATABASE_URL.replace('15432', '15422'), profile));

for (const patch of [
  { NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { NODE_ENV: undefined }, { AUDIT_RUNTIME_PROFILE: 'local' },
  { DATABASE_URL: profile.DATABASE_URL.replace('127.0.0.1', 'db.hbkooiknruimukkhshrk.supabase.co') },
  { AUDIT_DATABASE_URL: profile.AUDIT_DATABASE_URL.replace('127.0.0.1', 'db.ynygqodmtgjrngiudalw.supabase.co') },
  { AUDIT_CAPTURE_DATABASE_URL: '' }, { AUDIT_SOURCE_DATABASE_URL: '' }, { AUDIT_DATABASE_URL: '' },
  { SUPABASE_URL: 'https://hbkooiknruimukkhshrk.supabase.co' }, { SUPABASE_URL: undefined },
  { SUPABASE_URL: 'http://localhost:15421' }, { APP_URL: 'https://example.invalid' },
  { APP_URL: 'http://localhost:5000/other' }, { APP_URL: 'http://user@localhost:5000' },
  { SUPABASE_GOOGLE_ENABLED: 'true' }, { NOTIFICATIONS_ENABLED: 'true' }, { STRIPE_BILLING_ENABLED: 'true' },
  { PRODUCT_ACTIVITY_ENABLED: 'true' },
]) assert.throws(() => assertAuditActivation({ ...profile, ...patch }));
// An ambient cloud URL remains rejected even when all audit flags are dormant.
assert.throws(() => assertLocalAuditIsolation({ ...profile, AUDIT_ENABLED: 'false', AUDIT_WORKER_ENABLED: 'false',
  DATABASE_URL: 'postgresql://postgres:synthetic@remote.invalid/postgres' }));
assert.doesNotThrow(() => assertAuditActivation({ AUDIT_RUNTIME_PROFILE: 'local-docker', NODE_ENV: 'development',
  AUDIT_ENVIRONMENT: 'development', AUDIT_WORKER_ENABLED: 'true',
  AUDIT_SOURCE_DATABASE_URL: profile.AUDIT_SOURCE_DATABASE_URL, AUDIT_DATABASE_URL: profile.AUDIT_DATABASE_URL }));

for (const remoteAddress of ['127.0.0.1', '::ffff:127.0.0.1']) assertAuditTransport(app, { remoteAddress });
for (const stream of [undefined, {}, { remoteAddress: '10.0.0.2' }, { remoteAddress: '127.0.0.2' },
  { remoteAddress: 'remote.invalid', encrypted: true, authorized: true }]) assert.throws(() => assertAuditTransport(app, stream));
const hosted = auditApplicationConnection('postgresql://fmt_app_dev:synthetic@db.hbkooiknruimukkhshrk.supabase.co/postgres?sslmode=verify-full');
assert.equal(hosted.local, undefined);
assertAuditTransport(hosted, { encrypted: true, authorized: true });
for (const stream of [undefined, {}, { remoteAddress: '127.0.0.1' }, { encrypted: true, authorized: false }]) assert.throws(() => assertAuditTransport(hosted, stream));

const role = { principal: 'fmt_app_dev', rolcanlogin: true, rolinherit: true, rolconnlimit: 5,
  app_member: true, capture_member: true, may_enqueue: true, rolsuper: false, rolbypassrls: false,
  rolcreaterole: false, rolcreatedb: false, rolreplication: false, extra_role: false, membership_admin: false,
  owns_objects: false, permanent_ddl: false, audit_base_access: false };
for (const scenario of ['valid', 'wrong-peer', 'owner', 'mixed-route']) {
  let connects = 0, queries = 0; const released = [];
  const pool = { async connect() { connects++; return {
    connection: { stream: { remoteAddress: scenario === 'wrong-peer' ? '192.0.2.1' : '127.0.0.1' } },
    async query() { queries++; return { rows: [{ ...role, principal: scenario === 'owner' ? 'postgres' : role.principal }] }; },
    release(destroy) { released.push(destroy); },
  }; } };
  const input = scenario === 'mixed-route' ? { ...profile, AUDIT_DATABASE_URL: 'postgresql://postgres:synthetic@remote.invalid/postgres' } : profile;
  if (scenario === 'valid') await verifyAuditApplicationPool(pool, input);
  else await assert.rejects(() => verifyAuditApplicationPool(pool, input));
  assert.equal(connects, scenario === 'mixed-route' ? 0 : 1);
  assert.equal(queries, ['valid', 'owner'].includes(scenario) ? 1 : 0);
  assert.deepEqual(released, scenario === 'mixed-route' ? [] : [scenario !== 'valid']);
}
// Mixed capture/worker configurations must fail synchronously before creating any pool/socket.
for (const factory of [createCaptureRuntime, createWorkerRuntime]) {
  await assert.rejects(() => factory({ ...profile, AUDIT_DATABASE_URL: 'postgresql://postgres:synthetic@remote.invalid/postgres' }), /Invalid audit runtime configuration/);
}

const launchProfile = { ...profile, AUDIT_PRODUCER_CONTRACT: 'completion-0008', PORT: '5000',
  SUPABASE_PUBLISHABLE_KEY: 'synthetic-local-public', SUPABASE_SECRET_KEY: 'synthetic-local-private',
  SUPABASE_STORAGE_BUCKET: 'service-images', SESSION_SECRET: 'synthetic-local-session-secret-minimum-32-characters' };
const legacyProfile = Object.fromEntries(Object.entries(launchProfile).map(([key, value]) => [key,
  ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'AUDIT_SOURCE_DATABASE_URL', 'AUDIT_DATABASE_URL', 'AUDIT_READER_DATABASE_URL', 'SUPABASE_URL'].includes(key)
    ? value.replace(':15421', ':54321').replace(':15422', ':54322').replace(':15432', ':54332') : value]));
assert.throws(() => assertAuditActivation(legacyProfile), 'Windows-reserved legacy host ports must no longer be accepted');
const legacyText = '# Keep this comment and CRLF exactly.\r\n' + Object.entries(legacyProfile).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\r\n') + '\r\n';
const migration = planLocalPortMigration(legacyText), migrated = readSettings(migration.text);
const endpointKeys = ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'AUDIT_SOURCE_DATABASE_URL', 'AUDIT_DATABASE_URL', 'AUDIT_READER_DATABASE_URL', 'SUPABASE_URL'];
assert.deepEqual(migration.changedKeys.sort(), endpointKeys.sort());
assert.deepEqual(migrated, launchProfile);
assert.ok(migration.text.startsWith('# Keep this comment and CRLF exactly.\r\n'));
assert.equal(migration.text.split('\r\n').length, legacyText.split('\r\n').length);
for (const [key, value] of Object.entries(legacyProfile)) if (!endpointKeys.includes(key)) assert.equal(migrated[key], value);
for (const key of endpointKeys.filter(key => key !== 'SUPABASE_URL')) {
  const before = new URL(legacyProfile[key]), after = new URL(migrated[key]);
  for (const field of ['protocol', 'hostname', 'username', 'password', 'pathname', 'search', 'hash']) assert.equal(after[field], before[field]);
}
assert.throws(() => planLocalPortMigration(migration.text), 'Do not rewrite a profile that already migrated');
for (const patch of [{ SUPABASE_URL: 'https://remote.invalid' }, { DATABASE_URL: legacyProfile.DATABASE_URL.replace('127.0.0.1', 'remote.invalid') },
  { AUDIT_DATABASE_URL: legacyProfile.AUDIT_DATABASE_URL.replace('54332', '54322') }, { AUDIT_READER_DATABASE_URL: '' }]) {
  const badText = Object.entries({ ...legacyProfile, ...patch }).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n');
  assert.throws(() => planLocalPortMigration(badText));
}
const inherited = { Path: 'synthetic-bin-path', TEMP: 'synthetic-temp', AWS_ACCESS_KEY_ID: 'CANARY',
  OPENAI_API_KEY: 'CANARY', GOOGLE_MAPS_API_KEY: 'CANARY', NODE_OPTIONS: '--import ./unsafe.mjs',
  PGHOST: 'remote.invalid', DATABASE_URL: 'remote.invalid', DOTENV_CONFIG_PATH: '.env', OTHER_SECRET: 'CANARY' };
const child = prepareLocalDevelopmentEnvironment(launchProfile, inherited);
assert.equal(child.Path, inherited.Path); assert.equal(child.TEMP, inherited.TEMP);
for (const name of ['AWS_ACCESS_KEY_ID', 'OPENAI_API_KEY', 'GOOGLE_MAPS_API_KEY', 'NODE_OPTIONS', 'PGHOST', 'OTHER_SECRET']) assert.equal(child[name], undefined);
assert.equal(child.DATABASE_URL, profile.DATABASE_URL);
assert.equal(child.AUDIT_WORKER_ENABLED, 'false');
assert.ok(child.DOTENV_CONFIG_PATH.endsWith('.env.local-docker.local'));
assert.equal(prepareLocalDevelopmentEnvironment(launchProfile, inherited, { worker: true }).AUDIT_WORKER_ENABLED, 'true');
for (const patch of [{ OPENAI_API_KEY: 'CANARY' }, { NODE_OPTIONS: 'CANARY' }, { PORT: '5001' }, { SESSION_SECRET: 'too-short' },
  { AUDIT_ENABLED: 'false' }, { AUDIT_AUTH_EVENTS_ENABLED: 'true' }, { AUDIT_PRODUCER_CONTRACT: '' },
  { AUDIT_SOURCE_DATABASE_URL: '' }, { SUPABASE_SECRET_KEY: '' }, { APP_URL: '' }]) assert.throws(() => prepareLocalDevelopmentEnvironment({ ...launchProfile, ...patch }, inherited));
const bootstrap = { roles: Object.fromEntries(['fmt_app_dev', ...Object.values(AUDIT_USERS), 'fmt_audit_reader_dev'].map(role => [role, 'synthetic-password-for-local-only-32'])) };
const status = { API_URL: profile.SUPABASE_URL, ANON_KEY: 'synthetic-local-key', SERVICE_ROLE_KEY: 'synthetic-local-secret' };
const original = { APP_ADMIN_USER_IDS: '11111111-1111-4111-8111-111111111111', AUDIT_READER_USER_IDS: '22222222-2222-4222-8222-222222222222',
  AUDIT_EXPORT_USER_IDS: '', AUDIT_SERVICE_VIEWS_ENABLED: 'true' };
const assembled = assembleLocalProfile(bootstrap, status, original, launchProfile.SESSION_SECRET);
assert.equal(assembled.APP_ADMIN_USER_IDS, original.APP_ADMIN_USER_IDS);
assert.equal(assembled.AUDIT_READER_USER_IDS, original.AUDIT_READER_USER_IDS);
assert.equal(assembled.AUDIT_EXPORT_USER_IDS, '');
assert.equal(assembled.OPENAI_API_KEY, undefined);
assert.throws(() => assembleLocalProfile(bootstrap, { ...status, API_URL: 'https://remote.invalid' }, original, launchProfile.SESSION_SECRET));
assert.throws(() => assembleLocalProfile(bootstrap, status, { ...original, SUPABASE_SECRET_KEY: 'CANARY-hosted' }, launchProfile.SESSION_SECRET));
assert.throws(() => assembleLocalProfile({ roles: { ...bootstrap.roles, fmt_app_dev: '' } }, status, original, launchProfile.SESSION_SECRET));
for (const mode of ['--billing', '--notifications-worker', '--activity-worker']) assert.equal(localDormantOperation([mode]), true);
assert.equal(localDormantOperation(['--worker']), false);
assert.equal(localDormantOperation(['--billing', '--worker']), false);
for (const [operation, command] of Object.entries(HISTORICAL_COMMANDS)) {
  let invoked = 0;
  const run = (program, args) => { invoked++; assert.equal(program, process.execPath); assert.deepEqual(args, [...command, '--synthetic-argument']); return 'synthetic-executor'; };
  assert.throws(() => runHistoricalOperation(operation, ['--synthetic-argument'], { localProfilePresent: true, run }), /EXPLICIT_TARGET_REVIEW/);
  assert.equal(invoked, 0, 'An active local copy must prevent the historical executor from running');
  assert.equal(runHistoricalOperation(operation, ['--synthetic-argument'], { localProfilePresent: false, run }), 'synthetic-executor');
  assert.equal(invoked, 1);
}
assert.throws(() => runHistoricalOperation('unknown', [], { localProfilePresent: false, run: () => assert.fail() }), /UNKNOWN_HISTORICAL_OPERATION/);

// No dotenv import and no external boundary is exercised by disabled local providers.
const beforeProfile = process.env.AUDIT_RUNTIME_PROFILE;
process.env.AUDIT_RUNTIME_PROFILE = 'local-docker';
try {
  const { generateEmbedding, generateEmbeddings } = await import('../server/embeddings.ts');
  await assert.rejects(() => generateEmbedding('synthetic search'), /disabled for the local database copy/);
  await assert.rejects(() => generateEmbeddings(['synthetic search']), /disabled for the local database copy/);
  assert.deepEqual(await generateEmbeddings([]), []);
  const { geocodeAddress } = await import('../server/geocoding.ts');
  await assert.rejects(() => geocodeAddress('synthetic address', () => assert.fail('Local provider must not invoke a request')), error => error.status === 503 && error.code === 'NOT_CONFIGURED');
} finally {
  if (beforeProfile === undefined) delete process.env.AUDIT_RUNTIME_PROFILE;
  else process.env.AUDIT_RUNTIME_PROFILE = beforeProfile;
}
console.log('Passed: explicit local app/capture/worker/reader routing, no mixed targets, actual loopback peer, unchanged hosted TLS/role gates; offline only.');
