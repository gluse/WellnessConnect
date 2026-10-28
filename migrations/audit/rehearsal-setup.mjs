// Fixed development rehearsal setup. Import/offline have no private or network I/O.
// Only the assigned DB executor may invoke the separately authorized apply mode.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT,requireThat,safeCode,emit,client,connect} from './runtime-support.mjs';
import {loadPrivateConfiguration,booleanSnapshot} from './execute-runtime-setup.mjs';
import {INSTALL_SQL,installedFunctionContracts,deterministicPrecommitError} from './execute-runtime-disabled.mjs';
import {REHEARSAL_OWNER,TEST_ROLE,REHEARSAL_FILES,REHEARSAL_MANIFEST,REHEARSAL_VERSION,
 REHEARSAL_APIS,EVENT_IDS,RUN_ID,TARGETS} from './rehearsal-contract.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const SETUP_TIMEOUT_MS=180000;
export function loadRehearsalScripts(){
 return new Map(Object.values(REHEARSAL_FILES).map(file=>{
  const bytes=fs.readFileSync(path.join(ROOT,'migrations/audit',file));
  requireThat(digest(bytes)===REHEARSAL_MANIFEST[file],'REHEARSAL_DIGEST_MISMATCH');
  const sql=bytes.toString('utf8');
  requireThat((sql.match(/^BEGIN;$/gm)||[]).length===1&&(sql.match(/^COMMIT;$/gm)||[]).length===1&&
   sql.includes('SET TRANSACTION READ WRITE;')&&sql.includes('AS rehearsal_version_recorded;')&&
   sql.includes('GRANTED BY %I RESTRICT')&&!/^\s*\\/m.test(sql)&&
   !/\b(?:PASSWORD|LOGIN\s+(?:PASSWORD|VALID)|ALTER\s+(?:SYSTEM|DATABASE))\b/i.test(sql),'REHEARSAL_SQL_SCOPE_REJECTED');
  for(const id of EVENT_IDS)requireThat(sql.includes(id),'REHEARSAL_COHORT_MISMATCH');
  requireThat(sql.includes(RUN_ID),'REHEARSAL_RUN_MISMATCH');
  return[file,sql];
 }));
}
export function rehearsalFunctionContracts(target,sql){
 const oldOwner=`fm_audit_${target}_owner`;
 const definitions=[...sql.matchAll(/CREATE FUNCTION audit_rehearsal\.(\w+)\([^;]*?\bAS \$\$([\s\S]*?)\$\$;/g)];
 requireThat(definitions.length===6,'REHEARSAL_FUNCTION_COUNT_REJECTED');
 return REHEARSAL_APIS.map(([name,args])=>{
  const found=definitions.filter(m=>m[1]===name);requireThat(found.length===1,'REHEARSAL_FUNCTION_MISSING');
  return {name,args,owner:['inspect','all_absent','queue_safe'].includes(name)?oldOwner:REHEARSAL_OWNER,
   returns:['record','finish'].includes(name)?'void':name==='status'||name==='inspect'?'jsonb':'boolean',
   body_hash:digest(found[0][2])};
 });
}
export const REHEARSAL_SQL=Object.freeze({
 identity:`SELECT current_user=session_user AND current_user='postgres' AS fixed_principal,
 current_setting('server_version_num')::integer/10000=17 AND current_setting('server_encoding')='UTF8' AS version_encoding,
 (SELECT rolcreaterole OR rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) AS may_create_roles,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])) AS names_free,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='audit_rehearsal') AS schema_free,
 NOT pg_has_role(current_user,$2,'USAGE') AND NOT pg_has_role(current_user,$2,'SET') AS owner_access_disabled,
 EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=$2::regrole AND m.member=current_user::regrole
  AND m.admin_option) AS may_delegate_owner,
 EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname=$3 AND n.nspowner=$2::regrole) AS existing_schema_owner,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  WHERE a.grantee=0 AND a.privilege_type='CREATE') AS no_public_schema_create,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
  WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='CREATE') AS no_public_database_create,
 CASE WHEN $4='source' THEN to_regclass('public.users') IS NOT NULL AND to_regclass('public.bookings') IS NOT NULL
 ELSE to_regclass('public.users') IS NULL AND to_regclass('public.bookings') IS NULL END AS database_separation`,
 functions:`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,args text,owner text,returns text,body_hash text)) SELECT
 (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='audit_rehearsal')=6 AS exact_function_count,
 NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang
  WHERE n.nspname='audit_rehearsal' AND p.proname=e.name AND oidvectortypes(p.proargtypes)=e.args
  AND p.proowner=e.owner::regrole AND p.prosecdef AND NOT p.proisstrict AND p.provolatile='v'
  AND l.lanname IN ('sql','plpgsql') AND pg_get_function_result(p.oid)=e.returns
  AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']
  AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.body_hash
  AND has_function_privilege('fmt_audit_test_dev',p.oid,'EXECUTE')
  AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))) AS exact_function_contracts`,
 state:`SELECT
 (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('fm_audit_rehearsal_owner','fmt_audit_test_dev'))=2 AS roles_present,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN ('fm_audit_rehearsal_owner','fmt_audit_test_dev')
  AND (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR NOT r.rolinherit
   OR r.rolconnlimit<>CASE WHEN r.rolname='fmt_audit_test_dev' THEN 2 ELSE -1 END)) AS disabled_restricted,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member IN ('fm_audit_rehearsal_owner'::regrole,'fmt_audit_test_dev'::regrole)) AS no_parent_memberships,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid IN ('fm_audit_rehearsal_owner'::regrole,'fmt_audit_test_dev'::regrole)
  AND NOT(m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)) AS no_effective_delegation,
 NOT pg_has_role(current_user,'fm_audit_rehearsal_owner','USAGE') AND NOT pg_has_role(current_user,'fm_audit_rehearsal_owner','SET') AS new_owner_access_disabled,
 EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='audit_rehearsal' AND n.nspowner='fm_audit_rehearsal_owner'::regrole) AS separate_schema_owner,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='audit_rehearsal')=4 AS exact_relations_and_indexes,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='audit_rehearsal' AND c.relname IN ('run','cohort') AND c.relkind='r' AND c.relrowsecurity
  AND c.relowner='fm_audit_rehearsal_owner'::regrole)=2 AS restricted_evidence_owner,
 has_schema_privilege('fmt_audit_test_dev','audit_rehearsal','USAGE') AS test_schema_usage,
 NOT has_schema_privilege($1,'audit_rehearsal','CREATE') AS inspector_create_removed,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE has_schema_privilege('fmt_audit_test_dev',n.oid,'CREATE'))
  AND NOT has_database_privilege('fmt_audit_test_dev',current_database(),'CREATE') AS no_test_ddl,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner='fmt_audit_test_dev'::regrole)
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner='fmt_audit_test_dev'::regrole) AS no_test_ownership,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) needed(privilege)
  WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
  AND has_schema_privilege('fmt_audit_test_dev',n.oid,'USAGE')
  AND has_table_privilege('fmt_audit_test_dev',c.oid,needed.privilege)) AS no_usable_test_relation_grants,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) needed(privilege)
  WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
  AND has_schema_privilege('fmt_audit_test_dev',n.oid,'USAGE')
  AND has_column_privilege('fmt_audit_test_dev',c.oid,a.attnum,needed.privilege)) AS no_usable_test_column_grants,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) needed(privilege)
  WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
  AND has_schema_privilege('fmt_audit_test_dev',n.oid,'USAGE')
  AND has_sequence_privilege('fmt_audit_test_dev',c.oid,needed.privilege)) AS no_usable_test_sequence_grants,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('audit','audit_capture','audit_contract') AND has_function_privilege('fmt_audit_test_dev',p.oid,'EXECUTE')) AS no_test_audit_entrypoints,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='purge_expired_geocoding'
  AND has_function_privilege('fmt_audit_test_dev',p.oid,'EXECUTE')) AS no_test_geocoding_maintenance,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE a.grantee='fmt_audit_test_dev'::regrole) AS no_test_future_grants`,
});
function booleans(result,code){const row=booleanSnapshot(result);requireThat(Object.keys(row).length>0&&Object.values(row).every(v=>v===true),code);return row;}
async function readonly(x,work){await x.query('BEGIN READ ONLY');try{return await work();}finally{await x.query('ROLLBACK');}}
export async function preflightRehearsal(x,target){return readonly(x,async()=>{
 const owner=`fm_audit_${target}_owner`;
 booleans(await x.query(REHEARSAL_SQL.identity,[[REHEARSAL_OWNER,TEST_ROLE],owner,target==='source'?'audit_capture':'audit',target]),'REHEARSAL_IDENTITY_REJECTED');
 booleans(await x.query(INSTALL_SQL.functions,[JSON.stringify(installedFunctionContracts(target))]),'INSTALLED_FUNCTIONS_REJECTED');
 const memberships=(await x.query(INSTALL_SQL.ownerMemberships,[owner])).rows;
 requireThat(memberships.length>0&&memberships.some(m=>m.admin_option===true)&&memberships.every(m=>m.inherit_option===false&&m.set_option===false),'REHEARSAL_OWNER_BASELINE_REJECTED');
 return {memberships};
});}
export async function verifyRehearsal(x,target,before,sql){return readonly(x,async()=>{
 const checks={roles:booleans(await x.query(REHEARSAL_SQL.state,[`fm_audit_${target}_owner`]),'REHEARSAL_STATE_REJECTED'),
  functions:booleans(await x.query(REHEARSAL_SQL.functions,[JSON.stringify(rehearsalFunctionContracts(target,sql))]),'REHEARSAL_FUNCTIONS_REJECTED'),
  grantOptions:booleans(await x.query(INSTALL_SQL.grantOptions,[[TEST_ROLE]]),'REHEARSAL_GRANT_OPTIONS_REJECTED')};
 const after=(await x.query(INSTALL_SQL.ownerMemberships,[`fm_audit_${target}_owner`])).rows;
 requireThat(JSON.stringify(after)===JSON.stringify(before.memberships),'REHEARSAL_OWNER_MEMBERSHIP_CHANGED');
 checks.ownerMembershipsPreserved=true;return checks;
});}
export function checkRehearsalCommit(result){
 const results=Array.isArray(result)?result:[result];requireThat(results.at(-1)?.command==='COMMIT','REHEARSAL_COMMIT_UNCERTAIN');
 const receipt=results.filter(r=>r.command==='SELECT'&&r.fields?.length===1&&r.fields[0].name==='rehearsal_version_recorded');
 requireThat(receipt.length===1&&receipt[0].rows.length===1&&receipt[0].rows[0].rehearsal_version_recorded===true,'REHEARSAL_RECEIPT_REJECTED');
}
export async function setupRehearsal({configs,cas,scripts,onEvent=()=>{},makeClient=client,open=connect,
 preflight=preflightRehearsal,verify=verifyRehearsal}){
 const connections={},before={},commits={destination:'not-attempted',source:'not-attempted'};
 let target,stage='rehearsal-preflight';
 try{
  for(target of ['destination','source']){
   connections[target]=await makeClient(configs[target],target,cas[target]);await open(connections[target]);
   before[target]=await preflight(connections[target],target);
   onEvent({stage,target,status:'passed'});
  }
  for(target of ['destination','source']){
   stage='rehearsal-migration';commits[target]='uncertain';
   const sql=scripts.get(REHEARSAL_FILES[target]);requireThat(typeof sql==='string','REHEARSAL_SCRIPT_MISSING');
   try{
    const result=await connections[target].query({text:sql,query_timeout:SETUP_TIMEOUT_MS});
    const items=Array.isArray(result)?result:[result];
    if(items.at(-1)?.command==='COMMIT')commits[target]='committed';
    checkRehearsalCommit(result);
   }catch(e){
    if(commits[target]!=='committed')try{await connections[target].query('ROLLBACK');if(deterministicPrecommitError(e))commits[target]='rolled-back';}catch{}
    throw e;
   }
   stage='rehearsal-verification';const checks=await verify(connections[target],target,before[target],sql);
   onEvent({stage:'rehearsal-installed',target,status:'verified',projectRef:TARGETS[target],
    version:REHEARSAL_VERSION(target),sha256:REHEARSAL_MANIFEST[REHEARSAL_FILES[target]],
    checks,commits:{...commits},loginsEnabled:false,passwordsProvisioned:false,fixturesEnqueued:false});
  }
  return {status:'passed',commits};
 }catch(e){onEvent({stage,target,status:'stopped',code:safeCode(e),commits:{...commits}});throw e;}
 finally{for(const x of Object.values(connections))try{await x.end();}catch{}}
}
async function main(){
 requireThat(process.argv.length===3&&['offline','apply-rehearsal-disabled'].includes(process.argv[2]),'REHEARSAL_MODE_REJECTED');
 const scripts=loadRehearsalScripts();
 for(const target of ['destination','source'])rehearsalFunctionContracts(target,scripts.get(REHEARSAL_FILES[target]));
 if(process.argv[2]==='offline'){emit('rehearsal-setup-offline',{status:'passed',files:[...scripts.keys()],privateFileAccess:false,databaseAccess:false,sqlExecuted:false});return;}
 const {configs,cas}=loadPrivateConfiguration();await setupRehearsal({configs,cas,scripts,onEvent:event=>emit('rehearsal-setup',event)});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('stopped',{code:safeCode(e)});process.exitCode=1;}
}
