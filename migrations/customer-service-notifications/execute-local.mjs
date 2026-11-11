// Prepared one-shot LOCAL-only operation. --plan never reads private files,
// starts a process, opens a connection or writes a receipt. Execute only after
// new user authorization recorded in the linked runbook; the flag is not approval.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PgDialect } from 'drizzle-orm/pg-core';
import { loadLocalDevelopmentEnvironment } from '../../scripts/start-local-development.mjs';
import { verifyWorkspacePricingDatabaseReadiness } from '../workspace-pricing/application-readiness.mjs';
import { verifyCurrencyDatabaseReadiness } from '../currencies/application-readiness.mjs';
import { verifyServicePhotoDatabaseReadiness } from '../service-photos/application-readiness.mjs';
import { verifyServiceReminderMessageDatabaseReadiness } from '../service-reminder-message/application-readiness.mjs';
import { verifyCustomerServiceNotificationDatabaseReadiness } from './application-readiness.mjs';
import { searchPageSQL } from '../../server/search-pagination/query.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const EXECUTION_FLAG = '--execute=LOCAL-FRONTEND-2026-11-11';
export const PINNED_SQL = Object.freeze([
  { file: '0024_customer_service_notifications.sql', sha256: '8f77a99fdb498af89b7a8258e6c7f171e974c4a80beaf5030d3402e9b0a917ca' },
  { file: '0025_customer_service_notifications_runtime.sql', sha256: '034447d839864963ad3e03c3c846b746cb9ed24e3270693deecb9f2547ca4718' },
]);
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
export function localConnection(value, principal) {
  const uri = new URL(value);
  requireThat(['postgres:', 'postgresql:'].includes(uri.protocol) && uri.hostname === '127.0.0.1' && uri.port === '15422'
    && uri.pathname === '/postgres' && decodeURIComponent(uri.username) === principal && uri.password && !uri.hash
    && (uri.search === '' || uri.search === '?sslmode=disable'), 'LOCAL_MIGRATION_ENDPOINT_REJECTED');
  return { host: '127.0.0.1', port: 15422, database: 'postgres', user: principal, password: decodeURIComponent(uri.password),
    ssl: false, connectionTimeoutMillis: 5000, query_timeout: 120000, application_name: 'frontend-followup-local-migration-20261111',
    options: '-c search_path=pg_catalog,public -c statement_timeout=60000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000' };
}
function files() {
  return PINNED_SQL.map(file => {
    const text = fs.readFileSync(new URL(file.file, import.meta.url), 'utf8');
    requireThat(createHash('sha256').update(text).digest('hex') === file.sha256, 'PINNED_MIGRATION_CHANGED');
    return { ...file, text };
  });
}
function fixed(program, args, environment = {}) {
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000,
    maxBuffer: 1024 * 1024, env: { ...process.env, ...environment } });
  requireThat(!result.error && result.status === 0, 'LOCAL_MIGRATION_PROCESS_CHECK_FAILED');
  return result.stdout;
}
function requireStopped() {
  requireThat(process.platform === 'win32', 'LOCAL_MIGRATION_WINDOWS_REQUIRED');
  const count = fixed('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop';@([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq 5000).Count"]);
  requireThat(count.trim() === '0', 'LOCAL_APPLICATION_MUST_BE_STOPPED');
  const bindings = JSON.parse(fixed('docker.exe', ['inspect', 'fitsmytime-local-ingress', '--format', '{{json .NetworkSettings.Ports}}']));
  const source = bindings['54322/tcp'];
  requireThat(source?.length === 1 && source[0].HostIp === '127.0.0.1' && source[0].HostPort === '15422', 'LOCAL_GATEWAY_MAPPING_REJECTED');
  const state = fixed('docker.exe', ['inspect', 'supabase_db_fitsmytime-local', '--format', '{{.State.Running}}']);
  requireThat(state.trim() === 'true', 'LOCAL_DATABASE_MUST_ALREADY_BE_RUNNING');
}
function protectedStatus() {
  const directory = path.join(root, 'outputs/supabase-local-private');
  const filename = path.join(directory, 'supabase-status.json');
  for (const value of [directory, filename]) requireThat(fs.existsSync(value) && !fs.lstatSync(value).isSymbolicLink()
    && fs.realpathSync(value).toLowerCase() === value.toLowerCase(), 'LOCAL_STATUS_PATH_REJECTED');
  fixed('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', 'scripts/protect-local-supabase-private.ps1', '-VerifyOnly']);
  fixed('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop';try {
    Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1');
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=Get-Acl -LiteralPath $env:FMT_MIGRATION_STATUS_PATH;
    $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));
    if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or $rules.Count -ne 1 -or
     $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].AccessControlType -ne 'Allow' -or
     $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl){exit 1};exit 0
   }catch{exit 1}`], { FMT_MIGRATION_STATUS_PATH: filename });
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
async function connect(configuration) {
  const client = new pg.Client(configuration);
  client.on('error', () => {});
  try {
    await client.connect();
    const address = client.connection.stream.remoteAddress;
    requireThat(address === '127.0.0.1' || address === '::ffff:127.0.0.1', 'LOCAL_PEER_REJECTED');
    return client;
  } catch (error) { await client.end().catch(() => {}); throw error; }
}
async function noWriters(client) {
  const { rows: [row] } = await client.query(`SELECT current_user='postgres' AND current_user=session_user AND current_database()='postgres'
    AND current_setting('server_version_num')::integer/10000=17 AND to_regclass('audit.events') IS NULL AS identity,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'
      AND usename IN ('postgres','supabase_admin','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev')) AS stopped,
    (SELECT count(*) FROM pg_catalog.pg_roles WHERE (rolname='fmt_app_dev' AND rolconnlimit=5) OR
      (rolname IN ('fmt_audit_capture_dev','fmt_audit_worker_dev') AND rolconnlimit=2))=3 AS capacity`);
  requireThat(row.identity && row.stopped && row.capacity, 'LOCAL_IDENTITY_WRITERS_OR_CAPACITY_REJECTED');
}
async function fingerprint(client) {
  const { rows: [row] } = await client.query(`SELECT
    (SELECT count(*)::int FROM public.services) AS services,
    (SELECT count(*)::int FROM public.bookings) AS bookings,
    (SELECT md5(coalesce(string_agg(md5((to_jsonb(s)-'deleted_at')::text),'' ORDER BY id),'')) FROM public.services s) AS service_hash,
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' ORDER BY id),'')) FROM public.bookings b) AS booking_hash`);
  return row;
}
async function verifyApp(client, after) {
  await client.query('BEGIN READ ONLY');
  try {
    const query = (text, values) => client.query(text, values);
    await (after ? verifyCustomerServiceNotificationDatabaseReadiness : verifyWorkspacePricingDatabaseReadiness)(query);
    await verifyCurrencyDatabaseReadiness(query);
    await verifyServicePhotoDatabaseReadiness(query);
    await verifyServiceReminderMessageDatabaseReadiness(query);
    if (after) {
      const dialect = new PgDialect();
      for (const filters of [{}, { availableOnly: true, date: '2026-11-11', dateEnd: '2026-11-18' },
        { availableOnly: true, date: '2026-11-11', time: '09:00', timeEnd: '10:30' }]) {
        const statement = dialect.sqlToQuery(searchPageSQL({ filters, sort: 'default', limit: 24 }));
        await client.query('EXPLAIN (FORMAT JSON, COSTS true) ' + statement.sql, statement.params);
      }
      const { rows: [row] } = await client.query(`SELECT
       (((timestamp '2026-03-29 00:30:00' AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Riga')::date=date '2026-03-29') AND
       (((timestamp '2026-11-08 12:30:00' AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Kiritimati')::date=date '2026-11-09') AS dates`);
      requireThat(row.dates === true, 'LOCAL_CALENDAR_CONVERSION_CHECK_FAILED');
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
}
export async function main(args = process.argv.slice(2), hooks = {}) {
  let stage = 'plan', receipt, receiptCreated = false, record, admin, app;
  const checkStopped = hooks.checkStopped ?? requireStopped;
  const readEnvironment = hooks.readEnvironment ?? loadLocalDevelopmentEnvironment;
  try {
    const migrations = files();
    if (!args.length || args.length === 1 && args[0] === '--plan') {
      emit({ state: 'prepared-only', target: '127.0.0.1:15422/postgres', setupPrincipal: 'postgres', appPrincipal: 'fmt_app_dev',
        sourceTables: 41, resultingTables: 42, migrations: PINNED_SQL, connected: false, privateRead: false, writes: false,
        requiresNewUserApproval: true, executeFlag: EXECUTION_FLAG, restart: false }); return 0;
    }
    requireThat(args.length === 1 && args[0] === EXECUTION_FLAG, 'LOCAL_MIGRATION_MODE_REJECTED');
    stage = 'stopped_target'; checkStopped();
    const directory = hooks.attemptDirectory ?? path.join(root, 'output/frontend-followup-2026-11-11');
    fs.mkdirSync(directory, { recursive: true });
    requireThat(!fs.lstatSync(directory).isSymbolicLink() && fs.realpathSync(directory).toLowerCase() === path.resolve(directory).toLowerCase(), 'LOCAL_RECEIPT_PATH_REJECTED');
    receipt = path.join(directory, 'local-database-migration-attempt.json');
    record = { state: 'attempted', target: '127.0.0.1:15422/postgres', executor: '/root/publish_db_contract',
      startedAt: new Date().toISOString(), migrations: [], retry: false, restart: false, hostedAccess: false };
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    receiptCreated = true;
    stage = 'protected_local_configuration';
    const environment = readEnvironment(), status = protectedStatus();
    const setup = localConnection(status.DB_URL, 'postgres'), runtime = localConnection(environment.DATABASE_URL, 'fmt_app_dev');
    stage = 'local41_preflight'; admin = await connect(setup);
    await admin.query('BEGIN READ ONLY'); await noWriters(admin); record.before = await fingerprint(admin); await admin.query('COMMIT');
    app = await connect(runtime); await verifyApp(app, false); await app.end(); app = undefined;
    await noWriters(admin); checkStopped();
    for (const migration of migrations) {
      stage = migration.file;
      await admin.query(migration.text);
      record.migrations.push({ file: migration.file, sha256: migration.sha256, committed: true });
      fs.writeFileSync(receipt, JSON.stringify({ ...record, stage }, null, 2) + '\n');
    }
    stage = 'local42_verification';
    await admin.query('BEGIN READ ONLY'); await noWriters(admin); record.after = await fingerprint(admin);
    requireThat(JSON.stringify(record.before) === JSON.stringify(record.after), 'LOCAL_BUSINESS_FINGERPRINT_CHANGED');
    const { rows: [row] } = await admin.query(`SELECT count(*)=0 AS empty FROM public.customer_service_notifications`);
    requireThat(row.empty === true, 'LOCAL_NEW_NOTIFICATION_TABLE_NOT_EMPTY'); await admin.query('COMMIT');
    app = await connect(runtime); await verifyApp(app, true); await app.end(); app = undefined;
    await noWriters(admin); checkStopped();
    record = { ...record, state: 'passed', stage: 'complete', current42Readiness: true, explainOnlyQueries: 3,
      calendarChecks: true, existingDataUnchanged: true, allConnectionsClosed: true, completedAt: new Date().toISOString() };
    await admin.end(); admin = undefined;
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2) + '\n'); emit(record); return 0;
  } catch (error) {
    if (app) await app.end().catch(() => {});
    if (admin) { await admin.query('ROLLBACK').catch(() => {}); await admin.end().catch(() => {}); }
    const code = /^[0-9A-Z_]{5,80}$/.test(error?.code || error?.message || '') ? error.code || error.message : 'LOCAL_MIGRATION_STOPPED';
    const result = { ...record, state: 'stopped', stage, code, retry: false, restart: false, allConnectionsClosed: true };
    if (receiptCreated) fs.writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n');
    emit(result); return 1;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main();
