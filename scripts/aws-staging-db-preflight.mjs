// TASK-036: exact approved development pair, read-only metadata, no retry.
// Never import server/db, run migrations, call audit claims, or print secrets.
import { parse } from 'dotenv';
import { createHash, X509Certificate } from 'node:crypto';
import {
  privatePreflight, privateRead, connection, trustedCA, client, connect,
  requireThat, safeCode,
} from '../migrations/audit/runtime-support.mjs';
import {
  BILLING_APPLICATION_READINESS_SQL, billingApplicationReadinessArguments,
  assertBillingApplicationReadiness,
} from '../migrations/billing/application-readiness.mjs';
import { verifyAuditApplicationPool } from '../server/audit/application.ts';
import { assertAuditRuntimeRole } from '../server/audit/runtime.ts';

const emit = data => process.stdout.write(JSON.stringify(data) + '\n');
function settings(name, sid) {
  const input = privateRead(name, sid);
  const keys = [...input.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(m => m[1]);
  requireThat(new Set(keys).size === keys.length, 'DUPLICATE_ENV_KEY');
  return parse(input); // Matches application dotenv syntax; never expands/evaluates values.
}
const roleSql = `SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 pg_has_role(current_user,$1,'MEMBER') AS group_member,
 has_function_privilege(current_user,$2,'EXECUTE') AS may_execute,
 has_table_privilege(current_user,$3,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
 EXISTS(SELECT 1 FROM pg_roles owner_role WHERE owner_role.rolname IN
 ('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_destination_owner')
 AND pg_has_role(current_user,owner_role.oid,'MEMBER')) AS owner_member,
 EXISTS(SELECT 1 FROM pg_roles extra_role WHERE extra_role.rolname <> current_user
 AND extra_role.rolname <> $1 AND ($4 <> 'worker' OR extra_role.rolname <> 'fm_audit_source_monitor')
 AND pg_has_role(current_user,extra_role.oid,'MEMBER')) AS extra_application_role
 FROM pg_roles r WHERE r.rolname=current_user`;
let stage = 'private_inventory';
try {
  const sid = privatePreflight();
  const app = settings('.env', sid), worker = settings('.env.audit-worker.local', sid);
  requireThat(new URL(app.SUPABASE_URL).hostname === 'hbkooiknruimukkhshrk.supabase.co', 'WRONG_SUPABASE_API_TARGET');
  for (const key of ['SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','OPENAI_API_KEY']) requireThat(Boolean(app[key]), 'MISSING_RUNTIME_INPUT');
  requireThat((app.SESSION_SECRET || '').length >= 32, 'INVALID_SESSION_SECRET_LENGTH');
  requireThat(app.AUDIT_ENABLED === 'true' && app.AUDIT_SERVICE_VIEWS_ENABLED === 'true'
    && app.AUDIT_ENVIRONMENT === 'development' && worker.AUDIT_WORKER_ENABLED === 'true', 'EXISTING_AUDIT_FLAGS_NOT_ACTIVE');
  const probes = [
    { kind:'app', target:'source', principal:'fmt_app_dev', value:app.DATABASE_URL, cap:5 },
    { kind:'capture', target:'source', principal:'fmt_audit_capture_dev', value:app.AUDIT_CAPTURE_DATABASE_URL, cap:2 },
    { kind:'worker', target:'source', principal:'fmt_audit_worker_dev', value:worker.AUDIT_SOURCE_DATABASE_URL, cap:2 },
    { kind:'writer', target:'destination', principal:'fmt_audit_writer_dev', value:worker.AUDIT_DATABASE_URL, cap:2 },
  ];
  // Validate every target, principal and public trust anchor before any socket.
  for (const probe of probes) {
    probe.config = connection(probe.value, probe.target, probe.principal);
    probe.ca = trustedCA(probe.config);
  }
  emit({stage:'private_inventory',passed:true,approvedTargetsOnly:true,ownerCredentials:false});
  for (const probe of probes) {
    stage = probe.kind;
    const cert = new X509Certificate(probe.ca.pem);
    const x = await client(probe.value, probe.target, probe.ca, probe.principal);
    try {
      await connect(x);
      await x.query('BEGIN TRANSACTION READ ONLY');
      const identity = (await x.query(`SELECT current_user=session_user AS same_principal,
        current_setting('server_version_num')::integer/10000=17 AS expected_version,
        current_setting('transaction_read_only')='on' AS read_only,
        r.rolcanlogin,r.rolconnlimit,
        (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity a
          WHERE a.usename=current_user AND a.backend_type='client backend') AS own_connections_including_probe
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`)).rows;
      requireThat(identity.length===1 && identity[0].same_principal===true && identity[0].expected_version===true
        && identity[0].read_only===true && identity[0].rolcanlogin===true && identity[0].rolconnlimit===probe.cap,
      'PRINCIPAL_VERSION_OR_LIMIT_MISMATCH');
      if (probe.kind === 'app') {
        await verifyAuditApplicationPool({connect:async()=>Object.assign(x,{release:()=>{}})}, app);
        const readiness = (await x.query(BILLING_APPLICATION_READINESS_SQL, billingApplicationReadinessArguments())).rows;
        assertBillingApplicationReadiness(readiness);
        emit({stage:'app_schema',passed:true,checks:readiness[0]});
      } else {
        const group = probe.kind==='worker'?'fm_audit_delivery':probe.kind==='writer'?'fm_audit_writer':'fm_audit_capture';
        const entry = probe.kind==='writer'?'audit.accept(text,text,text)':probe.kind==='worker'?'audit_capture.claim(integer)':'audit_capture.enqueue(text,text,text)';
        const object = probe.kind==='writer'?'audit.events':'audit_capture.audit_outbox';
        assertAuditRuntimeRole((await x.query(roleSql,[group,entry,object,probe.kind])).rows,probe.kind);
      }
      await x.query('COMMIT');
      emit({stage:probe.kind,passed:true,tlsVerified:true,readOnly:true,
        connectionLimit:identity[0].rolconnlimit,otherConnectionsAtSnapshot:Math.max(0,identity[0].own_connections_including_probe-1),
        ca:{singleCertificate:true,isCA:cert.ca,selfSigned:cert.checkIssued(cert)&&cert.verify(cert.publicKey),
          fingerprint256:cert.fingerprint256,pemSha256:createHash('sha256').update(probe.ca.pem).digest('hex')}});
    } finally { await x.end().catch(()=>{}); }
  }
  emit({stage:'complete',passed:true,writes:false,claims:false,allConnectionsClosed:true});
} catch (error) {
  emit({stage,passed:false,safeCode:safeCode(error),checks:Array.isArray(error?.checks)?error.checks:undefined,retry:false});
  process.exitCode=1;
}
