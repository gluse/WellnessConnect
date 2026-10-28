// TASK-026: approved fixed-target catalog inspection only. No application imports.
import { pathToFileURL } from 'node:url';
import {
  DIAGNOSTIC_OPTIONS, privatePreflight, privateRead, readSettings,
  connection, trustedCA, requireThat, safeCode, connect,
} from '../migrations/audit/runtime-support.mjs';

const project = 'hbkooiknruimukkhshrk';
const roles = ['postgres', 'fmt_app_dev', 'fm_app_runtime', 'anon', 'authenticated'];
export const queries = Object.freeze({
  identity: `SELECT current_database() AS database, current_user AS principal,
    session_user AS session_principal, current_setting('server_version') AS version,
    current_setting('server_version_num') AS version_number,
    current_setting('transaction_read_only') AS read_only,
    current_setting('default_transaction_read_only') AS default_read_only,
    current_setting('server_encoding') AS encoding`,
  relations: `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
    r.rolname AS owner, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_roles r ON r.oid=c.relowner
    WHERE n.nspname='public' AND c.relname IN ('users','user_search_locations')
    ORDER BY c.relname LIMIT 2`,
  columns: `SELECT c.relname AS table_name, a.attname AS name,
    pg_catalog.format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('users','user_search_locations')
    AND a.attnum>0 AND NOT a.attisdropped
    AND (c.relname='user_search_locations' OR a.attname='id')
    ORDER BY c.relname,a.attnum LIMIT 20`,
  constraints: `SELECT c.relname AS table_name, q.conname AS name, q.contype AS type,
    q.convalidated AS validated, pg_catalog.pg_get_constraintdef(q.oid) AS definition
    FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND
    (c.relname='user_search_locations' OR (c.relname='users' AND q.contype='p'))
    ORDER BY c.relname,q.conname LIMIT 20`,
  roles: `SELECT r.rolname AS name, r.rolcanlogin AS login, r.rolsuper AS superuser,
    r.rolbypassrls AS bypass_rls, r.rolinherit AS inherit,
    pg_catalog.has_schema_privilege(r.oid,'public','USAGE') AS schema_usage,
    pg_catalog.has_schema_privilege(r.oid,'public','CREATE') AS schema_create
    FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[]) ORDER BY r.rolname LIMIT 5`,
  tablePrivileges: `SELECT r.rolname AS role, c.relname AS table_name, p.privilege,
    pg_catalog.has_table_privilege(r.oid,c.oid,p.privilege) AS allowed
    FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','REFERENCES']) p(privilege)
    WHERE r.rolname=ANY($1::text[]) AND n.nspname='public'
    AND c.relname IN ('users','user_search_locations')
    ORDER BY r.rolname,c.relname,p.privilege LIMIT 50`,
  policies: `SELECT p.polname AS name, p.polcmd AS command, p.polpermissive AS permissive,
    ARRAY(SELECT CASE WHEN role_id=0 THEN 'PUBLIC' ELSE role_id::regrole::text END
      FROM unnest(p.polroles) AS role_id) AS roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS using_expression,
    pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
    FROM pg_catalog.pg_policy p WHERE p.polrelid=pg_catalog.to_regclass('public.user_search_locations')
    ORDER BY p.polname LIMIT 20`,
  defaults: `SELECT r.rolname AS creator,
    COALESCE(n.nspname,'all schemas') AS schema, d.defaclobjtype AS object_type,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
    a.privilege_type AS privilege, a.is_grantable AS grantable
    FROM pg_catalog.pg_default_acl d JOIN pg_catalog.pg_roles r ON r.oid=d.defaclrole
    LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
    WHERE d.defaclobjtype='r' AND (d.defaclnamespace=0 OR n.nspname='public')
    AND r.rolname=current_user ORDER BY schema,grantee,privilege LIMIT 100`,
  migrationJournals: `SELECT n.nspname AS schema, c.relname AS name
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p')
    AND c.relname IN ('__drizzle_migrations','schema_migrations','migrations')
    ORDER BY n.nspname,c.relname LIMIT 6`,
});

export async function inspect(x, principal) {
  const report = {};
  await x.query('BEGIN READ ONLY');
  try {
    const identity = (await x.query(queries.identity)).rows;
    requireThat(identity.length===1 && identity[0].principal===principal &&
      identity[0].session_principal===principal && identity[0].database==='postgres' &&
      identity[0].read_only==='on' && identity[0].default_read_only==='on', 'IDENTITY_OR_READ_ONLY_REJECTED');
    report.identity = identity[0];
    for (const [name, sql] of Object.entries(queries)) {
      if (name==='identity') continue;
      report[name] = (await x.query(sql, ['roles','tablePrivileges'].includes(name)?[roles]:[])).rows;
    }
    return report;
  } finally { await x.query('ROLLBACK'); }
}

async function main() {
  requireThat(process.argv.length===3 && process.argv[2]==='run', 'MODE_REJECTED');
  const sid = privatePreflight();
  const settings = readSettings(privateRead('.env',sid));
  const value = settings.DATABASE_URL;
  let configuredUser;
  try { configuredUser=decodeURIComponent(new URL(value).username).replace(`.${project}`,''); }
  catch { requireThat(false,'BAD_CONNECTION'); }
  requireThat(['postgres','fmt_app_dev'].includes(configuredUser),'UNREVIEWED_RUNTIME_PRINCIPAL');
  const config = connection(value,'source',configuredUser), ca=trustedCA(config);
  if (settings.SUPABASE_URL) {
    let matched=false;
    try { matched=new URL(settings.SUPABASE_URL).origin===`https://${project}.supabase.co`; } catch {}
    requireThat(matched,'API_PROJECT_MISMATCH');
  }
  requireThat(!process.env.PGBINARY,'BINARY_STARTUP_OVERRIDE_REJECTED');
  const {default:pg}=await import('pg');
  const {default:tls}=await import('node:tls');
  const x = new pg.Client({host:config.host,port:5432,user:config.user,password:config.password,
    database:config.database,ssl:{ca:ca.pem,rejectUnauthorized:true,servername:config.host,
      checkServerIdentity:tls.checkServerIdentity,minVersion:'TLSv1.2'},
    options:DIAGNOSTIC_OPTIONS,replication:'false',sslnegotiation:'postgres',client_encoding:'UTF8',
    application_name:'fitsmytime-task026-metadata-preflight',connectionTimeoutMillis:10000,query_timeout:15000});
  x.on('notice',()=>{}); x.on('error',()=>{});
  try {
    await connect(x);
    const report=await inspect(x,configuredUser);
    console.log(JSON.stringify({project,tlsVerified:true,configuredRuntimePrincipal:configuredUser,
      scope:'catalog-only',mutationsPerformed:false,...report},null,2));
  } finally { await x.end(); }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(JSON.stringify({stage:'task026-preflight',code:safeCode(error)}));process.exitCode=1;});
}
