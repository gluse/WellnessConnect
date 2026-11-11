// DB-owned TASK-036 release preflight. Inert import/plan; connected mode is one-shot.
// Five restricted principals only; SELECT metadata, no claims, DDL or data writes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { ROOT, connection, trustedCA, client, connect, requireThat, safeCode } from '../migrations/audit/runtime-support.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS,
  workspacePricingApplicationReadinessArguments, assertWorkspacePricingApplicationReadiness } from '../migrations/workspace-pricing/application-readiness.mjs';
import { CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS, currencyReadinessArguments, assertCurrencyReadiness } from '../migrations/currencies/application-readiness.mjs';
import { SERVICE_PHOTO_READINESS_SQL, SERVICE_PHOTO_READINESS_KEYS, servicePhotoReadinessArguments, assertServicePhotoReadiness } from '../migrations/service-photos/application-readiness.mjs';
import { SERVICE_REMINDER_MESSAGE_READINESS_SQL, SERVICE_REMINDER_MESSAGE_READINESS_KEYS,
  serviceReminderMessageReadinessArguments, assertServiceReminderMessageReadiness } from '../migrations/service-reminder-message/application-readiness.mjs';
import { EXPECTED_COMPLETION_AUDIT_PARSERS } from '../migrations/audit/application-readiness.mjs';
import { verifyAuditApplicationPool } from '../server/audit/application.ts';
import { assertAuditRuntimeRole } from '../server/audit/runtime.ts';
import { assertAuditReaderRole } from '../server/audit/viewer-runtime.ts';

export const AUTHORIZATION = 'TASK-036-PUBLISH-2026-11-09';
export const ROLES = Object.freeze([
  { kind: 'app', target: 'source', principal: 'fmt_app_dev', key: 'DATABASE_URL', cap: 5 },
  { kind: 'capture', target: 'source', principal: 'fmt_audit_capture_dev', key: 'AUDIT_CAPTURE_DATABASE_URL', cap: 2 },
  { kind: 'worker', target: 'source', principal: 'fmt_audit_worker_dev', key: 'AUDIT_SOURCE_DATABASE_URL', cap: 2 },
  { kind: 'writer', target: 'destination', principal: 'fmt_audit_writer_dev', key: 'AUDIT_DATABASE_URL', cap: 2 },
  { kind: 'reader', target: 'destination', principal: 'fmt_audit_reader_dev', key: 'AUDIT_READER_DATABASE_URL', cap: 2 },
]);
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
export const PROFILE = Object.freeze({ tables: JSON.parse(workspacePricingApplicationReadinessArguments()[0]).length,
  workspace: WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.length, currency: CURRENCY_READINESS_KEYS.length,
  photos: SERVICE_PHOTO_READINESS_KEYS.length, reminder: SERVICE_REMINDER_MESSAGE_READINESS_KEYS.length, total: 38 });
const ACL = String.raw`
$ErrorActionPreference='Stop'
try {
 Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $item=Get-Item -LiteralPath $env:FMT_PUBLISH_PRIVATE_PATH
 if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'link' }
 $acl=Get-Acl -LiteralPath $item.FullName
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or
 $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].AccessControlType -ne 'Allow' -or
 $rules[0].IsInherited -or $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'acl' }
 exit 0
} catch { exit 1 }
`;
function fixed(program, args, env = process.env) {
  const result = spawnSync(program, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, shell: false, env });
  requireThat(result.status === 0, 'PRIVATE_ACL_OR_IGNORE_FAILED');
  return result.stdout;
}
function privateSettings(name, selected) {
  requireThat(process.platform === 'win32', 'WINDOWS_PRIVATE_HANDOFF_ONLY');
  requireThat(fixed('git.exe', ['check-ignore', '--', name]).trim() === name, 'PRIVATE_FILE_NOT_IGNORED');
  const file = path.join(ROOT, name);
  requireThat(fs.existsSync(file) && fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'PRIVATE_FILE_UNSAFE');
  fixed('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ACL], { ...process.env, FMT_PUBLISH_PRIVATE_PATH: file });
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/)?.[1];
    return key && (!selected || selected.includes(key));
  });
  const keys = lines.map(line => line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/)[1]);
  requireThat(new Set(keys).size === keys.length, 'DUPLICATE_ENV_KEY');
  return parse(lines.join('\n'));
}
export function validateFlags(app, worker, audit) {
  requireThat(app.AUDIT_ENABLED === 'true' && app.AUDIT_SERVICE_VIEWS_ENABLED === 'true' && app.AUDIT_WORKER_ENABLED === 'false'
    && worker.AUDIT_WORKER_ENABLED === 'true' && app.AUDIT_ENVIRONMENT === 'development' && worker.AUDIT_ENVIRONMENT === 'development', 'AUDIT_FLAGS_CHANGED');
  requireThat(app.AUDIT_AUTH_EVENTS_ENABLED === 'false' && worker.AUDIT_AUTH_EVENTS_ENABLED === 'false', 'AUTH_ACTIVATION_HOLD');
  requireThat(['NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED', 'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED']
    .every(key => app[key] !== 'true'), 'FEATURE_ACTIVATION_HOLD');
  requireThat(!app.AUDIT_SOURCE_DATABASE_URL && !app.AUDIT_DATABASE_URL && !worker.DATABASE_URL && !worker.AUDIT_CAPTURE_DATABASE_URL
    && !worker.AUDIT_READER_DATABASE_URL, 'CREDENTIAL_BOUNDARY');
  requireThat(audit.AUDIT_PRODUCER_CONTRACT === 'completion-0008', 'COMPLETION_CONTRACT_REQUIRED');
  for (const key of ['AUDIT_READER_USER_IDS', 'AUDIT_EXPORT_USER_IDS']) {
    requireThat(typeof audit[key] === 'string' && audit[key].split(',').every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())), 'EXPLICIT_AUDIT_ACCESS_LIST_REQUIRED');
  }
  requireThat(new URL(app.SUPABASE_URL).hostname === 'hbkooiknruimukkhshrk.supabase.co', 'WRONG_API_TARGET');
}
export function prepareAuditRuntimeSettings(audit) {
  requireThat(audit.AUDIT_PRODUCER_CONTRACT === 'completion-0008', 'COMPLETION_CONTRACT_REQUIRED');
  for (const key of ['AUDIT_READER_USER_IDS', 'AUDIT_EXPORT_USER_IDS']) requireThat(typeof audit[key] === 'string'
    && audit[key].split(',').every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())), 'EXPLICIT_AUDIT_ACCESS_LIST_REQUIRED');
  const config = connection(audit.AUDIT_READER_DATABASE_URL, 'destination', 'fmt_audit_reader_dev');
  requireThat(config.u.searchParams.get('sslmode') === 'verify-full', 'VERIFY_FULL_REQUIRED');
  requireThat([...config.u.searchParams.keys()].every(key => ['sslmode', 'sslrootcert'].includes(key)), 'READER_URI_OVERRIDE_REJECTED');
  config.u.searchParams.set('sslrootcert', '/app/certs/supabase-ca.crt');
  // Stable sorted-key JSON is shared with the infrastructure release helper.
  return { AUDIT_EXPORT_USER_IDS: audit.AUDIT_EXPORT_USER_IDS, AUDIT_PRODUCER_CONTRACT: audit.AUDIT_PRODUCER_CONTRACT,
    AUDIT_READER_DATABASE_URL: config.u.href, AUDIT_READER_USER_IDS: audit.AUDIT_READER_USER_IDS };
}
export const auditSettingsFingerprint = settings => createHash('sha256').update(JSON.stringify(settings)).digest('hex');
export function runtimeDatabaseSettings(app, worker) {
  // Preserve the exact container-form strings; no URL normalization or secret output.
  const settings = { AUDIT_CAPTURE_DATABASE_URL: app.AUDIT_CAPTURE_DATABASE_URL, AUDIT_DATABASE_URL: worker.AUDIT_DATABASE_URL,
    AUDIT_SOURCE_DATABASE_URL: worker.AUDIT_SOURCE_DATABASE_URL, DATABASE_URL: app.DATABASE_URL };
  for (const role of ROLES.filter(role => role.kind !== 'reader')) {
    const config = connection(settings[role.key], role.target, role.principal);
    requireThat(config.u.searchParams.get('sslmode') === 'verify-full' && config.u.searchParams.get('sslrootcert') === '/app/certs/supabase-ca.crt', 'CONTAINER_TLS_PATH_CHANGED');
  }
  return settings;
}
export const runtimeDatabaseFingerprint = (app, worker) => auditSettingsFingerprint(runtimeDatabaseSettings(app, worker));
export function readRestrictedWorkerDiagnosticInput() {
  const settings = privateSettings('.env.aws-staging-worker.local', ['AUDIT_SOURCE_DATABASE_URL', 'AUDIT_WORKER_ENABLED', 'AUDIT_ENVIRONMENT']);
  requireThat(settings.AUDIT_WORKER_ENABLED === 'true' && settings.AUDIT_ENVIRONMENT === 'development', 'WORKER_FLAGS_CHANGED');
  const config = connection(settings.AUDIT_SOURCE_DATABASE_URL, 'source', 'fmt_audit_worker_dev');
  requireThat(config.u.searchParams.get('sslmode') === 'verify-full' && config.u.searchParams.get('sslrootcert') === '/app/certs/supabase-ca.crt', 'CONTAINER_TLS_PATH_CHANGED');
  const sourceWorkerUrlSha256 = createHash('sha256').update(settings.AUDIT_SOURCE_DATABASE_URL).digest('hex');
  config.u.searchParams.set('sslrootcert', path.join(ROOT, 'deploy/aws-staging/supabase-ca.crt'));
  return { value: config.u.href, ca: trustedCA(config), sourceWorkerUrlSha256 };
}
export function loadReleaseInventory() {
  const app = privateSettings('.env.aws-staging.local');
  const worker = privateSettings('.env.aws-staging-worker.local');
  const audit = privateSettings('.env', ['AUDIT_READER_DATABASE_URL', 'AUDIT_READER_USER_IDS', 'AUDIT_EXPORT_USER_IDS', 'AUDIT_PRODUCER_CONTRACT']);
  validateFlags(app, worker, audit);
  const auditRuntimeSettings = prepareAuditRuntimeSettings(audit);
  const runtimeDatabaseSha256 = runtimeDatabaseFingerprint(app, worker);
  const configs = ROLES.map(role => {
    const settings = role.kind === 'reader' ? audit : ['app', 'capture'].includes(role.kind) ? app : worker;
    const config = connection(settings[role.key], role.target, role.principal);
    requireThat(config.u.searchParams.get('sslmode') === 'verify-full', 'VERIFY_FULL_REQUIRED');
    if (role.kind !== 'reader') requireThat(config.u.searchParams.get('sslrootcert') === '/app/certs/supabase-ca.crt', 'CONTAINER_CA_PATH_CHANGED');
    // Validate the existing reader CA before using the identical pinned public CA on this PC.
    if (role.kind === 'reader') trustedCA(config);
    config.u.searchParams.set('sslrootcert', path.join(ROOT, 'deploy/aws-staging/supabase-ca.crt'));
    const ca = trustedCA(config);
    return { ...role, value: config.u.href, ca };
  });
  return { app: { ...app, AUDIT_PRODUCER_CONTRACT: audit.AUDIT_PRODUCER_CONTRACT, DATABASE_URL: configs[0].value }, configs,
    auditSettingsSha256: auditSettingsFingerprint(auditRuntimeSettings), runtimeDatabaseSha256 };
}
export const ROLE_SQL = `SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 pg_has_role(current_user,$1,'MEMBER') AS group_member,has_function_privilege(current_user,$2,'EXECUTE') AS may_execute,
 has_table_privilege(current_user,$3,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
 EXISTS(SELECT 1 FROM pg_roles owner_role WHERE owner_role.rolname IN('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_destination_owner') AND pg_has_role(current_user,owner_role.oid,'MEMBER')) AS owner_member,
 EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname<>current_user AND g.rolname<>$1 AND ($4<>'worker' OR g.rolname<>'fm_audit_source_monitor') AND pg_has_role(current_user,g.oid,'MEMBER')) AS extra_application_role
 FROM pg_roles r WHERE r.rolname=current_user`;
export const READER_SQL = `SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,
 pg_has_role(current_user,'fm_audit_reader','USAGE') AS reader_member,
 has_table_privilege(current_user,'audit.reader_events','SELECT') AS view_access,
 has_table_privilege(current_user,'audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
 EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname NOT IN(current_user,'fm_audit_reader') AND pg_has_role(current_user,g.oid,'MEMBER')) AS extra_role,
 has_database_privilege(current_user,current_database(),'CREATE') OR EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege(current_user,n.oid,'CREATE')) AS permanent_ddl
 FROM pg_roles r WHERE r.rolname=current_user`;
export const PARSER_SQL = `SELECT NOT EXISTS(SELECT 1 FROM jsonb_to_recordset($1::jsonb) e(name text,hash text)
 WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
 WHERE n.nspname='audit_contract' AND p.proname=e.name AND oidvectortypes(p.proargtypes)='text, text, text'
 AND p.prorettype='jsonb'::regtype AND p.prosecdef AND p.provolatile='s'
 AND owner.rolname='fm_audit_contract_owner' AND NOT(owner.rolcanlogin OR owner.rolsuper OR owner.rolbypassrls)
 AND cardinality(p.proconfig)=1 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.hash)) AS parser_chain_exact`;
export function validateMaintenance(ready, version, now = Date.now()) {
  requireThat(Number.isSafeInteger(version) && version > 0 && ready.maintenanceVersion === version && ready.active === true
    && ready.allPreviousInactive === true && ready.allCommandsDatabaseFree === true, 'MAINTENANCE_PROOF_REQUIRED');
  const age = now - Date.parse(ready.checkedAt);
  requireThat(Number.isFinite(age) && age >= 30_000 && age <= 15 * 60_000, 'FRESH_DRAIN_REQUIRED');
}
export function validateDisabled(ready, version, now = Date.now()) {
  requireThat(Number.isSafeInteger(version) && version > 0 && ready.service === 'fitsmytime-staging'
    && ready.region === 'eu-north-1' && ready.isDisabled === true && ready.serviceState === 'DISABLED'
    && ready.currentVersion === version && ready.noPending === true && /^[a-f0-9]{64}$/.test(ready.fingerprint), 'DISABLED_PROOF_REQUIRED');
  const age = now - Date.parse(ready.verifiedAt);
  requireThat(Number.isFinite(age) && age >= 30_000 && age <= 15 * 60_000, 'FRESH_DRAIN_REQUIRED');
}
export async function verifyOne(role, app, open = client, establish = connect) {
  const x = await open(role.value, role.target, role.ca, role.principal);
  try {
    await establish(x);
    await x.query('BEGIN TRANSACTION READ ONLY');
    const row = (await x.query(`SELECT current_user=session_user AS same_principal,
      current_setting('server_version_num')::integer/10000=17 AS expected_version,
      current_setting('transaction_read_only')='on' AS read_only,r.rolcanlogin,r.rolconnlimit,
      (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity a WHERE a.usename=current_user AND a.backend_type='client backend') AS own_connections_including_probe
      FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`)).rows[0];
    requireThat(row && row.same_principal === true && row.expected_version === true && row.read_only === true
      && row.rolcanlogin === true && row.rolconnlimit === role.cap, 'PRINCIPAL_VERSION_OR_CAP_CHANGED');
    requireThat(row.own_connections_including_probe === 1, 'OTHER_RUNTIME_CONNECTIONS_PRESENT');
    if (role.kind === 'app') {
      await verifyAuditApplicationPool({ connect: async () => Object.assign(x, { release() {} }) }, app);
      for (const [sql, args, assert] of [[WORKSPACE_PRICING_APPLICATION_READINESS_SQL, workspacePricingApplicationReadinessArguments(), assertWorkspacePricingApplicationReadiness],
        [CURRENCY_READINESS_SQL, currencyReadinessArguments(), assertCurrencyReadiness],
        [SERVICE_PHOTO_READINESS_SQL, servicePhotoReadinessArguments(), assertServicePhotoReadiness],
        [SERVICE_REMINDER_MESSAGE_READINESS_SQL, serviceReminderMessageReadinessArguments(), assertServiceReminderMessageReadiness]]) assert((await x.query(sql, args)).rows);
    } else if (role.kind === 'reader') assertAuditReaderRole((await x.query(READER_SQL)).rows);
    else {
      const group = role.kind === 'worker' ? 'fm_audit_delivery' : role.kind === 'writer' ? 'fm_audit_writer' : 'fm_audit_capture';
      const entry = role.kind === 'writer' ? 'audit.accept(text,text,text)' : role.kind === 'worker' ? 'audit_capture.claim(integer)' : 'audit_capture.enqueue(text,text,text)';
      const object = role.kind === 'writer' ? 'audit.events' : 'audit_capture.audit_outbox';
      assertAuditRuntimeRole((await x.query(ROLE_SQL, [group, entry, object, role.kind])).rows, role.kind);
    }
    requireThat((await x.query(PARSER_SQL, [JSON.stringify(EXPECTED_COMPLETION_AUDIT_PARSERS)])).rows[0]?.parser_chain_exact === true, 'AUDIT_PARSER_CHAIN_CHANGED');
    await x.query('COMMIT');
    return { kind: role.kind, passed: true, tlsVerified: true, readOnly: true, connectionLimit: row.rolconnlimit, otherConnections: 0,
      ...(role.kind === 'app' ? { applicationChecks: 38 } : {}) };
  } finally { await x.end(); }
}
export async function main(args = process.argv.slice(2)) {
  let stage = 'plan', receipt, record;
  try {
    requireThat(PROFILE.tables === 41 && PROFILE.workspace === 32 && PROFILE.currency === 2 && PROFILE.photos === 2 && PROFILE.reminder === 2, 'CURRENT_PROFILE_CHANGED');
    if (!args.length || (args.length === 1 && args[0] === '--plan')) {
      emit({ stage, authorization: AUTHORIZATION, profile: PROFILE, roles: ROLES.map(({ kind, target, cap }) => ({ kind, target, cap })), writes: false, claims: false, privateRead: false, connected: false });
      return 0;
    }
    requireThat(args.length === 3 && args[1] === `--execute-release=${AUTHORIZATION}` && /^--(?:maintenance|disabled)-version=[1-9]\d*$/.test(args[2]), 'MODE_REJECTED');
    const snapshot = path.resolve(ROOT, args[0]);
    requireThat(path.dirname(snapshot) === path.join(ROOT, 'outputs/aws-staging-build') && path.basename(snapshot).startsWith('source-'), 'SNAPSHOT_SCOPE');
    const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'));
    requireThat(/^[a-f0-9]{64}$/.test(manifest.sha256) && createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex') === manifest.sha256, 'MANIFEST_REJECTED');
    for (const file of manifest.files.filter(file => /^(migrations\/|server\/audit\/)/.test(file.path))) {
      requireThat(file.sha256 === createHash('sha256').update(fs.readFileSync(path.join(ROOT, file.path))).digest('hex'), 'READINESS_SOURCE_CHANGED');
    }
    const version = Number(args[2].split('=')[1]);
    const disabled = args[2].startsWith('--disabled-version=');
    if (disabled) validateDisabled(JSON.parse(fs.readFileSync(path.join(snapshot, 'disabled-ready.json'), 'utf8')), version);
    else validateMaintenance(JSON.parse(fs.readFileSync(path.join(snapshot, 'maintenance-ready.json'), 'utf8')), version);
    receipt = path.join(snapshot, 'db-release-preflight-2026-11-09.json');
    record = { authorization: AUTHORIZATION, executor: '/root/aws_publish_database', sourceManifestSha256: manifest.sha256,
      quiescence: disabled ? 'disabled' : 'maintenance', quiescentVersion: version,
      startedAt: new Date().toISOString(), state: 'attempted', stage, roles: [], writes: false, claims: false, retry: false };
    fs.writeFileSync(path.join(ROOT, 'outputs/aws-staging-build/db-release-preflight-2026-11-09-attempt.json'), JSON.stringify(record, null, 2), { flag: 'wx' });
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2), { flag: 'wx' });
    stage = 'private_inventory';
    const { app, configs, auditSettingsSha256, runtimeDatabaseSha256 } = loadReleaseInventory();
    record.auditSettingsSha256 = auditSettingsSha256;
    record.runtimeDatabaseSha256 = runtimeDatabaseSha256;
    for (const role of configs) {
      stage = role.kind;
      const result = await verifyOne(role, app);
      record.roles.push(result);
      fs.writeFileSync(receipt, JSON.stringify({ ...record, stage }, null, 2));
      emit({ stage, ...result });
    }
    stage = 'complete';
    Object.assign(record, { stage, state: 'passed', passed: true, completedAt: new Date().toISOString(), allConnectionsClosed: true, applicationChecks: 38 });
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2));
    emit(record);
    return 0;
  } catch (error) {
    const result = { stage, passed: false, safeCode: error?.code === 'EEXIST' ? 'ATTEMPT_ALREADY_EXISTS' : safeCode(error),
      checks: Array.isArray(error?.checks) ? error.checks : undefined, retry: false };
    // Never overwrite another attempt or its success/failure evidence.
    if (receipt && record && error?.code !== 'EEXIST') fs.writeFileSync(receipt, JSON.stringify({ ...record, ...result, state: 'stopped', completedAt: new Date().toISOString() }, null, 2));
    emit(result);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
