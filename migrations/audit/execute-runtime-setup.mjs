// TASK-014 preparation and bounded metadata inspection only. No mutation mode.
// Import is inert: no private file, process, database or network access.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {APP_TABLES,APP_SEQUENCES,EVENT_IDS,RUN_ID,ROLES,TARGETS} from './runtime-contract.mjs';
import {ROOT,requireThat,safeCode,emit,readSettings,connection,trustedCA,client,connect,
 privatePath,privatePreflight,privateRead} from './runtime-support.mjs';

// Pinned bytes of NEW SQL. Never include the previously applied setup executor.
export const MANIFEST=Object.freeze({
 '0003_destination_runtime.sql':'28a8403d4145751e684c2b5f4965964c47587a3b09751fd20031058413ed7b53',
 '0003_source_runtime.sql':'964cde32cb2dd43e308d7cfdf96b73f715d3112dd95dbc1b5ca4be3682c6d025',
 '0003_destination_rehearsal.sql':'17001360f0b99e0ebef9e6a76dd43a4c6f5aa12f49aab8c3eaf4d45c6de507bd',
 '0003_source_rehearsal.sql':'7b22fe97804a38c84ebbbb9d51c8c54c8d96abb16004abd441251eec8ee5629c',
});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function loadManifest(){
 const result=new Map();
 for(const [file,hash] of Object.entries(MANIFEST)){
  const bytes=fs.readFileSync(path.join(ROOT,'migrations/audit',file));
  requireThat(digest(bytes)===hash,'MANIFEST_DIGEST_MISMATCH');
  const sql=bytes.toString('utf8');
  requireThat((sql.match(/^BEGIN;$/gm)||[]).length===1&&(sql.match(/^COMMIT;$/gm)||[]).length===1&&
   !/^\s*\\/m.test(sql)&&sql.includes("SET LOCAL lock_timeout='5s'")&&
   sql.includes("SET LOCAL statement_timeout='60s'"),'SQL_WRAPPER_REJECTED');
  result.set(file,sql);
 }return result;
}
export function repositoryCompatibility(text){
 const declared=[...text.matchAll(/\bpgTable\(\s*["']([a-z0-9_]+)["']/g)].map(m=>m[1]);
 return {expectedCount:APP_TABLES.length,declaredCount:declared.length,
  missingCount:APP_TABLES.filter(t=>!declared.includes(t)).length,
  unexpectedCount:declared.filter(t=>!APP_TABLES.includes(t)).length,
  matches:declared.length===APP_TABLES.length&&APP_TABLES.every(t=>declared.includes(t))};
}
function selectedSettings(text,names){
 return readSettings(text.split(/\r?\n/).filter(line=>names.some(name=>
  new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line))).join('\n'));
}

// Catalog-only SQL: SELECTs inside BEGIN READ ONLY. No SET ROLE, DDL, row queries,
// arbitrary SQL input, startup, API calls, probe writes or connection parameters.
export const METADATA_SQL=Object.freeze({
 identity:`SELECT current_user=session_user AS no_set_role,current_user='postgres' AS setup_principal,
 current_setting('server_version_num')::integer/10000=17 AS version_17,
 current_setting('server_encoding')='UTF8' AS utf8,
 (SELECT rolcreaterole OR rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) AS may_create_roles,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])) AS runtime_names_free,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='audit_rehearsal') AS rehearsal_name_free,
 coalesce((SELECT pg_has_role(current_user,r.oid,'MEMBER') FROM pg_catalog.pg_roles r WHERE r.rolname=$2),false) AS setup_owner_member,
 coalesce((SELECT pg_has_role(current_user,r.oid,'USAGE') FROM pg_catalog.pg_roles r WHERE r.rolname=$2),false) AS setup_owner_effective_usage,
 coalesce((SELECT pg_has_role(current_user,r.oid,'SET') FROM pg_catalog.pg_roles r WHERE r.rolname=$2),false) AS setup_owner_may_set,
 (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) OR
 EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles g ON g.oid=m.roleid
 WHERE m.member=current_user::regrole AND g.rolname=$2 AND m.admin_option) AS setup_owner_admin_option`,
 publicRights:`SELECT
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n,
 LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
 WHERE a.grantee=0 AND a.privilege_type='CREATE') AS public_permanent_schema_create_absent,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_database d,
 LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
 WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='CREATE') AS public_database_create_absent`,
 source:`SELECT
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[]))=16 AS app_tables_present,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relname=ANY($1::text[])) AS no_unreviewed_app_tables,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND
 (c.relkind<>'r' OR NOT c.relrowsecurity OR c.relowner<>current_user::regrole)) AS app_owner_rls_match,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname=ANY($1::text[]) AND (NOT p.polpermissive OR p.polname='fmt_app_server')) AS app_policy_compatible,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='S' AND c.relname=ANY($2::text[]))=10 AS app_sequences_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='audit_capture' AND c.relname='audit_outbox' AND c.relkind='r') AS outbox_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='audit_capture' AND p.proname='enqueue' AND p.pronargs=3
 AND oidvectortypes(p.proargtypes)='text, text, text') AS enqueue_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='audit_capture' AND p.proname='claim' AND p.pronargs=1
 AND oidvectortypes(p.proargtypes)='integer') AS claim_present`,
 destination:`SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('users','bookings')) AS independent_destination,
 EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='audit' AND c.relname='events' AND c.relkind='r') AS events_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='audit' AND p.proname='accept' AND p.pronargs=3
 AND oidvectortypes(p.proargtypes)='text, text, text') AS accept_present`,
 logging:`SELECT
 coalesce((SELECT setting='none' FROM pg_catalog.pg_settings WHERE name='log_statement'),false) AS no_statement_logging,
 coalesce((SELECT setting='-1' FROM pg_catalog.pg_settings WHERE name='log_min_duration_statement'),false) AS no_duration_statement_logging,
 coalesce((SELECT setting='-1' FROM pg_catalog.pg_settings WHERE name='log_min_duration_sample'),false) AS no_sampled_statement_logging,
 coalesce((SELECT setting='0' FROM pg_catalog.pg_settings WHERE name='log_statement_sample_rate'),false) AS no_sample_rate,
 coalesce((SELECT setting='0' FROM pg_catalog.pg_settings WHERE name='log_parameter_max_length_on_error'),false) AS no_error_parameters,
 coalesce((SELECT setting='none' FROM pg_catalog.pg_settings WHERE name='pgaudit.log'),false) AS pgaudit_known_disabled`,
 runtimeRoles:`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
 AS e(name text,groups text[],app boolean)) SELECT
 (SELECT count(*) FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name)=jsonb_array_length($1::jsonb) AS runtime_roles_present,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN LATERAL unnest(e.groups) required(name) WHERE NOT EXISTS
 (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname=required.name
 AND pg_has_role(r.oid,g.oid,'MEMBER') AND pg_has_role(r.oid,g.oid,'USAGE') AND pg_has_role(r.oid,g.oid,'SET'))) AS runtime_required_groups_effective,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 JOIN pg_catalog.pg_auth_members m ON m.member=r.oid WHERE m.admin_option) AS runtime_no_membership_admin,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS runtime_attributes_restricted,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_roles g WHERE g.oid<>r.oid AND NOT g.rolname=ANY(e.groups)
 AND pg_has_role(r.oid,g.oid,'MEMBER')) AS runtime_memberships_restricted,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_namespace n WHERE has_schema_privilege(r.oid,n.oid,'CREATE')) AS runtime_schema_create_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE has_database_privilege(r.oid,current_database(),'CREATE')) AS runtime_database_create_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner=r.oid)) AS runtime_ownership_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p') AND n.nspname IN ('audit','audit_capture','audit_rehearsal')
 AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS runtime_audit_base_access_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT e.app AND c.relkind IN ('r','p') AND n.nspname='public'
 AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS independent_accounts_no_business_access`,
});
export function booleanSnapshot(result){
 requireThat(result.rows.length===1,'METADATA_SHAPE_REJECTED');
 const row=result.rows[0];requireThat(Object.values(row).every(v=>typeof v==='boolean'),'METADATA_BOOLEAN_REQUIRED');
 return row;
}
export async function inspectMetadata(x,target){
 await x.query('BEGIN READ ONLY');
 try{
  await x.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='1s'; SET LOCAL idle_in_transaction_session_timeout='15s'");
  const names=target==='source'?[ROLES.app,ROLES.capture,ROLES.worker,ROLES.test,'fm_app_runtime']:[ROLES.writer,ROLES.test];
  const owner=target==='source'?'fm_audit_source_owner':'fm_audit_destination_owner';
  const identity=booleanSnapshot(await x.query(METADATA_SQL.identity,[names,owner]));
  requireThat(identity.no_set_role&&identity.setup_principal&&identity.version_17&&identity.utf8,'SETUP_IDENTITY_REJECTED');
  const rights=booleanSnapshot(await x.query(METADATA_SQL.publicRights));
  const schema=booleanSnapshot(await x.query(METADATA_SQL[target],target==='source'?[APP_TABLES,APP_SEQUENCES]:[]));
  const logging=booleanSnapshot(await x.query(METADATA_SQL.logging));
  const expected=target==='source'?[
   {name:ROLES.app,groups:['fm_app_runtime','fm_audit_capture'],app:true},
   {name:ROLES.capture,groups:['fm_audit_capture'],app:false},
   {name:ROLES.worker,groups:['fm_audit_delivery','fm_audit_source_monitor'],app:false},
   {name:ROLES.test,groups:[],app:false}]:[
   {name:ROLES.writer,groups:['fm_audit_writer'],app:false},{name:ROLES.test,groups:[],app:false}];
  const runtime=booleanSnapshot(await x.query(METADATA_SQL.runtimeRoles,[JSON.stringify(expected)]));
  return {identity,rights,schema,logging,runtime};
 }finally{await x.query('ROLLBACK');}
}
export async function inspectPair(configs,cas,onResult,{makeClient=client,open=connect,inspect=inspectMetadata}={}){
 const clients=[];
 try{
  for(const target of ['destination','source']){
   const x=await makeClient(configs[target],target,cas[target]);clients.push(x);
   await open(x);const metadata=await inspect(x,target);await onResult(target,metadata);
  }
 }finally{for(const x of clients)try{await x.end();}catch{/* Never output a driver error. */}}
}
export function offline(){
 const files=loadManifest();
 assert.equal(EVENT_IDS.length,12);assert.equal(new Set(EVENT_IDS).size,12);
 for(const target of ['source','destination']){
  const role=target==='source'?ROLES.worker:ROLES.writer;
  const url=`postgresql://${role}:synthetic@db.${TARGETS[target]}.supabase.co/postgres?sslmode=verify-full`;
  assert.equal(connection(url,target,role).principal,role);
  for(const bad of [url.replace('/postgres','/other'),url.replace(':synthetic',':%0A'),
   url.replace('?sslmode=verify-full','?sslmode=disable'),url+'&sslmode=verify-full',url+'&host=evil.invalid',
   url.replace(role,'postgres'),url.replace('.supabase.co/','.supabase.co:6543/')])
   assert.throws(()=>connection(bad,target,role));
  assert.throws(()=>connection(url,target==='source'?'destination':'source',role));
 }
 assert.deepEqual(readSettings('X="a\\\\b"\nY=\'value\''),{X:'a\\b',Y:'value'});
 for(const text of ['X=a\nX=b','X="bad','X=a #comment','X="line\\nsecret"'])assert.throws(()=>readSettings(text));
 assert.deepEqual(selectedSettings('IGNORED="bad\nX=value',['X']),{X:'value'});
 assert.equal(repositoryCompatibility(APP_TABLES.map(t=>`pgTable("${t}", {})`).join('\n')).matches,true);
 assert.equal(repositoryCompatibility('pgTable("user_search_locations", {})').matches,false);
 assert.throws(()=>booleanSnapshot({rows:[{ok:null}]}));
 const state=repositoryCompatibility(fs.readFileSync(path.join(ROOT,'shared/schema.ts'),'utf8'));
 emit('offline',{status:'passed',files:[...files.keys()],runId:RUN_ID,repository:state,
  databaseAccess:false,privateFileAccess:false,sqlExecuted:false,
  mutationModes:[],requiresBeforeMutation:['location-table-choice','private-provisioning-review','live-metadata-and-provider-logging-review']});
 return state;
}
export function loadPrivateConfiguration(){
 const sid=privatePreflight();
 const dedicated=fs.existsSync(privatePath('.env.audit-setup.local'));
 const names=dedicated?['AUDIT_SETUP_SOURCE_DATABASE_URL','AUDIT_SETUP_DESTINATION_DATABASE_URL']:['DATABASE_URL','AUDIT_DATABASE_URL'];
 const settings=selectedSettings(privateRead(dedicated?'.env.audit-setup.local':'.env',sid),names);
 const configs={source:settings[names[0]],destination:settings[names[1]]};
 // Both fixed targets/principals/CA files are checked before opening either socket.
 const sourceConfig=connection(configs.source,'source');
 const destinationConfig=connection(configs.destination,'destination');
 const cas={source:trustedCA(sourceConfig)};
 const destinationHasCA=destinationConfig.u.searchParams.has('sslrootcert');
 // The same independently pinned provider root already used by the installed
 // setup executor, in memory only. Never accept the server-presented certificate.
 cas.destination=destinationHasCA?trustedCA(destinationConfig):cas.source;
 return {configs,cas,destinationHasCA};
}
async function main(){
 const mode=process.argv[2];
 requireThat(process.argv.length===3&&['offline','preflight'].includes(mode),'MODE_REJECTED');
 if(mode==='offline'){offline();return;}
 loadManifest();
 const repository=repositoryCompatibility(fs.readFileSync(path.join(ROOT,'shared/schema.ts'),'utf8'));
 // Read-only diagnostics intentionally report repository drift without blocking
 // inspection. They can never approve mutation or credential cutover.
 const {configs,cas,destinationHasCA}=loadPrivateConfiguration();
 await inspectPair(configs,cas,(target,metadata)=>{
   emit('metadata-preflight',{target,projectRef:TARGETS[target],tlsVerified:true,
    trustSource:target==='destination'&&!destinationHasCA?'existing-pinned-source-provider-root':'explicit-pinned-provider-root',repository,
    ...metadata,activationReady:false,mutationsPerformed:false,
    note:'Catalog observations only; password/provider logging, capacity and private handoff still require review.'});
 });
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('stopped',{code:safeCode(e)});process.exitCode=1;}
}
