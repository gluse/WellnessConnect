// TASK-036 PC build: plan/inventory are offline; connected execution is explicit.
// Exact approved development projects only. No retry, claims, DDL or data writes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { parse } from 'dotenv';
import { ROOT, CA_PIN, connection, trustedCA, client, connect, requireThat, safeCode } from '../migrations/audit/runtime-support.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS,
  workspacePricingApplicationReadinessArguments, assertWorkspacePricingApplicationReadiness } from '../migrations/workspace-pricing/application-readiness.mjs';
import { CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS, currencyReadinessArguments,
  assertCurrencyReadiness } from '../migrations/currencies/application-readiness.mjs';
import { verifyAuditApplicationPool } from '../server/audit/application.ts';
import { assertAuditRuntimeRole } from '../server/audit/runtime.ts';

const emit = detail => process.stdout.write(JSON.stringify(detail) + '\n');
const profile = { tables: JSON.parse(workspacePricingApplicationReadinessArguments()[0]).length,
  profileChecks: WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.length, currencyChecks: CURRENCY_READINESS_KEYS.length };
const roles = [
  { kind: 'app', target: 'source', principal: 'fmt_app_dev', key: 'DATABASE_URL', cap: 5 },
  { kind: 'capture', target: 'source', principal: 'fmt_audit_capture_dev', key: 'AUDIT_CAPTURE_DATABASE_URL', cap: 2 },
  { kind: 'worker', target: 'source', principal: 'fmt_audit_worker_dev', key: 'AUDIT_SOURCE_DATABASE_URL', cap: 2 },
  { kind: 'writer', target: 'destination', principal: 'fmt_audit_writer_dev', key: 'AUDIT_DATABASE_URL', cap: 2 },
];
const privateFiles = ['.env.aws-staging.local', '.env.aws-staging-worker.local'];
const checkAcl = `
$ErrorActionPreference='Stop'
try {
 Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
 if ($identity.Value -ne $env:FMT_STAGING_PRIVATE_SID) { throw 'Wrong identity' }
 $target=Get-Item -LiteralPath $env:FMT_STAGING_PRIVATE_PATH
 if ($target.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse target' }
 $acl=Get-Acl -LiteralPath $target.FullName
 $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $identity.Value -or
  -not $acl.AreAccessRulesProtected -or $rules.Count -ne 1 -or
  $rules[0].IdentityReference.Value -ne $identity.Value -or $rules[0].AccessControlType -ne 'Allow' -or
  $rules[0].IsInherited -or $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'Private ACL mismatch' }
 exit 0
} catch { exit 1 }
`;
function fixed(program, args, environment = process.env) {
  const result = spawnSync(program, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, shell: false, env: environment });
  requireThat(result.status === 0, 'PRIVATE_PREFLIGHT_FAILED');
  return result.stdout;
}
function inventory() {
  requireThat(process.platform === 'win32', 'WINDOWS_PRIVATE_HANDOFF_ONLY');
  const sid = fixed('whoami.exe', ['/user', '/fo', 'csv', '/nh']).match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  requireThat(Boolean(sid), 'CURRENT_USER_SID_UNAVAILABLE');
  const settings = privateFiles.map(name => {
    requireThat(fixed('git.exe', ['check-ignore', '--', name]).trim() === name, 'PRIVATE_FILE_NOT_IGNORED');
    const file = path.join(ROOT, name);
    requireThat(fs.existsSync(file) && fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'PRIVATE_FILE_MISSING_OR_UNSAFE');
    fixed('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', checkAcl],
      { ...process.env, FMT_STAGING_PRIVATE_PATH: file, FMT_STAGING_PRIVATE_SID: sid });
    const text = fs.readFileSync(file, 'utf8');
    const keys = [...text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(match => match[1]);
    requireThat(new Set(keys).size === keys.length, 'DUPLICATE_ENV_KEY');
    return parse(text);
  });
  const [app, worker] = settings;
  requireThat(new URL(app.SUPABASE_URL).hostname === 'hbkooiknruimukkhshrk.supabase.co', 'WRONG_SUPABASE_API_TARGET');
  for (const key of ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'OPENAI_API_KEY']) requireThat(Boolean(app[key]), 'MISSING_APP_INPUT');
  requireThat((app.SESSION_SECRET || '').length >= 32, 'INVALID_SESSION_SECRET_LENGTH');
  requireThat(app.AUDIT_ENABLED === 'true' && app.AUDIT_SERVICE_VIEWS_ENABLED === 'true' && app.AUDIT_ENVIRONMENT === 'development'
    && worker.AUDIT_WORKER_ENABLED === 'true' && worker.AUDIT_ENVIRONMENT === 'development', 'AUDIT_FLAGS_NOT_PRESERVED');
  requireThat(!app.AUDIT_SOURCE_DATABASE_URL && !app.AUDIT_DATABASE_URL && !worker.DATABASE_URL && !worker.AUDIT_CAPTURE_DATABASE_URL, 'CREDENTIAL_BOUNDARY_VIOLATION');
  requireThat(app.NOTIFICATIONS_ENABLED !== 'true' && app.NOTIFICATIONS_AUTOMATION_ENABLED !== 'true'
    && app.NOTIFICATIONS_VERIFICATION_ENABLED !== 'true' && app.PRODUCT_ACTIVITY_ENABLED !== 'true', 'UNAPPROVED_WORKER_OR_PROVIDER_FLAG');
  const certFile = path.join(ROOT, 'deploy/aws-staging/supabase-ca.crt');
  for (const role of roles) {
    const value = (role.kind === 'app' || role.kind === 'capture' ? app : worker)[role.key];
    const config = connection(value, role.target, role.principal);
    requireThat(config.u.searchParams.get('sslmode') === 'verify-full' && config.u.searchParams.get('sslrootcert') === '/app/certs/supabase-ca.crt', 'STAGED_TLS_PATH_MISMATCH');
    // Host-side metadata check uses the same pinned public CA, changing no saved URI.
    config.u.searchParams.set('sslrootcert', certFile);
    role.value = config.u.href;
    role.ca = trustedCA(connection(role.value, role.target, role.principal));
  }
  const cert = new X509Certificate(roles[0].ca.pem);
  requireThat(cert.fingerprint256 === CA_PIN, 'CA_REJECTED');
  return { app: { ...app, DATABASE_URL: roles[0].value }, cert };
}
const roleSql = `SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 pg_has_role(current_user,$1,'MEMBER') AS group_member,has_function_privilege(current_user,$2,'EXECUTE') AS may_execute,
 has_table_privilege(current_user,$3,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
 EXISTS(SELECT 1 FROM pg_roles owner_role WHERE owner_role.rolname IN('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_destination_owner')
 AND pg_has_role(current_user,owner_role.oid,'MEMBER')) AS owner_member,
 EXISTS(SELECT 1 FROM pg_roles extra_role WHERE extra_role.rolname<>current_user AND extra_role.rolname<>$1
 AND ($4<>'worker' OR extra_role.rolname<>'fm_audit_source_monitor') AND pg_has_role(current_user,extra_role.oid,'MEMBER')) AS extra_application_role
 FROM pg_roles r WHERE r.rolname=current_user`;
let stage = 'plan';
try {
  requireThat(profile.tables === 41 && profile.profileChecks === 32 && profile.currencyChecks === 2, 'CURRENT_PROFILE_CHANGED');
  const args = process.argv.slice(2);
  // Prior gateway/manual grants were consumed. The referrer manual child stopped
  // in offline inventory before sockets; this fresh user-run grant requires the
  // approved disabled notification flags restored. It grants no agent execution.
  const capacityModes = ['--execute-capacity=TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06'];
  const capacityOnly = capacityModes.includes(args[0]);
  requireThat(args.length <= 1 && [undefined, '--plan', '--inventory', '--execute-readonly=TASK-036-PC-2026-11-06',
    ...capacityModes].includes(args[0]), 'MODE_REJECTED');
  emit({ stage: 'plan', profile, totalChecks: 34, targets: ['hbkooiknruimukkhshrk', 'ynygqodmtgjrngiudalw'], writes: false, claims: false });
  if (!args.length || args[0] === '--plan') process.exit(0);
  stage = 'private_inventory';
  const { app, cert } = inventory();
  emit({ stage, passed: true, approvedTargetsOnly: true, ownerCredentials: false, caFingerprint256: cert.fingerprint256,
    caPemSha256: createHash('sha256').update(roles[0].ca.pem).digest('hex') });
  if (args[0] === '--inventory') process.exit(0);
  for (const role of roles) {
    stage = role.kind;
    const x = await client(role.value, role.target, role.ca, role.principal);
    try {
      await connect(x);
      await x.query('BEGIN TRANSACTION READ ONLY');
      const rows = (await x.query(`SELECT current_user=session_user AS same_principal,
       current_setting('server_version_num')::integer/10000=17 AS expected_version,
       current_setting('transaction_read_only')='on' AS read_only,r.rolcanlogin,r.rolconnlimit,
       (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity a WHERE a.usename=current_user AND a.backend_type='client backend') AS own_connections_including_probe
       FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`)).rows;
      requireThat(rows.length === 1 && rows[0].same_principal === true && rows[0].expected_version === true
        && rows[0].read_only === true && rows[0].rolcanlogin === true && rows[0].rolconnlimit === role.cap, 'PRINCIPAL_VERSION_OR_LIMIT_MISMATCH');
      if (capacityOnly) {
        emit({ stage: 'capacity', kind: role.kind, otherConnectionsAtSnapshot: Math.max(0, rows[0].own_connections_including_probe - 1) });
        requireThat(rows[0].own_connections_including_probe === 1, 'RUNTIME_CONNECTIONS_NOT_DRAINED');
      } else if (role.kind === 'app') {
        await verifyAuditApplicationPool({ connect: async () => Object.assign(x, { release: () => {} }) }, app);
        const profileRows = (await x.query(WORKSPACE_PRICING_APPLICATION_READINESS_SQL, workspacePricingApplicationReadinessArguments())).rows;
        assertWorkspacePricingApplicationReadiness(profileRows);
        const currencyRows = (await x.query(CURRENCY_READINESS_SQL, currencyReadinessArguments())).rows;
        assertCurrencyReadiness(currencyRows);
        emit({ stage: 'app_schema', passed: true, tables: 41, checks: { ...profileRows[0], ...currencyRows[0] } });
      } else {
        const group = role.kind === 'worker' ? 'fm_audit_delivery' : role.kind === 'writer' ? 'fm_audit_writer' : 'fm_audit_capture';
        const entry = role.kind === 'writer' ? 'audit.accept(text,text,text)' : role.kind === 'worker' ? 'audit_capture.claim(integer)' : 'audit_capture.enqueue(text,text,text)';
        const object = role.kind === 'writer' ? 'audit.events' : 'audit_capture.audit_outbox';
        assertAuditRuntimeRole((await x.query(roleSql, [group, entry, object, role.kind])).rows, role.kind);
      }
      await x.query('COMMIT');
      emit({ stage, passed: true, tlsVerified: true, readOnly: true, connectionLimit: rows[0].rolconnlimit,
        otherConnectionsAtSnapshot: Math.max(0, rows[0].own_connections_including_probe - 1) });
    } finally { await x.end().catch(() => {}); }
  }
  emit({ stage: 'complete', passed: true, capacityOnly,
    capacityAuthorization: capacityOnly ? args[0].slice('--execute-capacity='.length) : undefined,
    writes: false, claims: false, allConnectionsClosed: true });
} catch (error) {
  emit({ stage, passed: false, safeCode: safeCode(error), checks: Array.isArray(error?.checks) ? error.checks : undefined, retry: false });
  process.exitCode = 1;
}
