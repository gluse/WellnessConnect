// Fixed TASK-014 disabled-account installation. Preparation is authorized;
// executing apply-runtime-disabled requires separate named-target user approval.
// Import/offline do not read private configuration or open connections.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ROOT,requireThat,safeCode,emit,client,connect} from './runtime-support.mjs';
import {APP_TABLES,DELETE_TABLES,APP_SEQUENCES,ROLES,TARGETS} from './runtime-contract.mjs';
import {loadManifest,loadPrivateConfiguration,inspectMetadata,booleanSnapshot,repositoryCompatibility,MANIFEST} from './execute-runtime-setup.mjs';

export const RUNTIME_FILES=Object.freeze({destination:'0003_destination_runtime.sql',source:'0003_source_runtime.sql'});
export const MIGRATION_TIMEOUT_MS=180000;
// Only errors that necessarily abort a statement before this fixed batch's
// final COMMIT may be classified rolled back after a successful ROLLBACK.
const PRECOMMIT_ERRORS=new Set(['42501','42710','42704','42P01','42883','42601','23505','23503','23514','P0001','55P03']);
export const deterministicPrecommitError=error=>PRECOMMIT_ERRORS.has(error?.code);
export const BASELINE=Object.freeze({
 '_contract_v1.sql':'030f81d453a22216719cefdd550e052df558ec89dc99334b92460e86ee3ae64b',
 '0001_source.sql':'2cdd5712867a328779dd3062d7344ce69459594ca4405bfffbea21394838978a',
 '0001_destination.sql':'13c44e20635125ab0918f1acc5c4424a0bf64b36b2945f2a336497b3eacf3381',
});
const hash=value=>createHash('sha256').update(value).digest('hex');
// The selected boundary forbids usable extra access. These two provider views
// have a known latent PUBLIC SELECT ACL but remain inaccessible without schema
// USAGE. Match exact provenance; never ignore a schema or arbitrary raw ACL.
export const INACCESSIBLE_PROVIDER_VIEW=`r.rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','fmt_audit_writer_dev')
 AND n.nspname='extensions' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
 AND c.relkind='v' AND c.relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')
 AND NOT has_schema_privilege(r.oid,n.oid,'USAGE')
 AND EXISTS(SELECT 1 FROM aclexplode(c.relacl) a JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor
 WHERE a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable AND grantor.rolname='postgres')
 AND NOT EXISTS(SELECT 1 FROM aclexplode(c.relacl) a
 WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END
 AND NOT (a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable
 AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')))
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute attribute CROSS JOIN LATERAL aclexplode(attribute.attacl) a
 WHERE attribute.attrelid=c.oid AND attribute.attnum>0 AND NOT attribute.attisdropped
 AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END)`;
const INACCESSIBLE_SOURCE_CRON=`r.rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev')
 AND n.nspname='cron' AND c.relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin')
 AND NOT has_schema_privilege(r.oid,n.oid,'USAGE')`;
export const INACCESSIBLE_CRON_RELATION=`${INACCESSIBLE_SOURCE_CRON}
 AND c.relkind='r' AND c.relname IN ('job','job_run_details')
 AND (SELECT count(*) FROM aclexplode(c.relacl) a WHERE a.grantee=0
 AND a.privilege_type=ANY(CASE WHEN c.relname='job' THEN ARRAY['SELECT'] ELSE ARRAY['SELECT','DELETE'] END)
 AND NOT a.is_grantable AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin'))
 =CASE WHEN c.relname='job' THEN 1 ELSE 2 END
 AND NOT EXISTS(SELECT 1 FROM aclexplode(c.relacl) a
 WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END
 AND NOT(a.grantee=0 AND a.privilege_type=ANY(CASE WHEN c.relname='job' THEN ARRAY['SELECT'] ELSE ARRAY['SELECT','DELETE'] END)
 AND NOT a.is_grantable AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin')))
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute attribute CROSS JOIN LATERAL aclexplode(attribute.attacl) a
 WHERE attribute.attrelid=c.oid AND attribute.attnum>0 AND NOT attribute.attisdropped
 AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END)`;
export const INACCESSIBLE_CRON_SEQUENCE=`${INACCESSIBLE_SOURCE_CRON}
 AND c.relkind='S' AND c.relname IN ('jobid_seq','runid_seq')
 AND EXISTS(SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee=0 AND a.privilege_type='SELECT'
 AND NOT a.is_grantable AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin'))
 AND NOT EXISTS(SELECT 1 FROM aclexplode(c.relacl) a
 WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END
 AND NOT(a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable
 AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin')))`;
export function installedFunctionContracts(target){
 const entries=[];
 for(const file of ['_contract_v1.sql',`0001_${target}.sql`]){
  const bytes=fs.readFileSync(path.join(ROOT,'migrations/audit',file));
  requireThat(hash(bytes)===BASELINE[file],'BASELINE_DIGEST_MISMATCH');
  const text=bytes.toString('utf8').replaceAll('\r\n','\n');
  const declarations=[...text.matchAll(/CREATE FUNCTION ([a-z_]+)\.([a-z_]+)\(([\s\S]*?)\)\s*([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)];
  requireThat(declarations.length>=3,'BASELINE_FUNCTION_EXTRACTION_FAILED');
  for(const [,schema,name,args,header,body]of declarations){
   entries.push({schema,name,args:args.split(',').map(a=>a.trim().split(/\s+/)[1]).join(', '),
    owner:schema==='audit_contract'?'fm_audit_contract_owner':`fm_audit_${target}_owner`,
    body_hash:hash(body),definer:/\bSECURITY DEFINER\b/.test(header),
    language:header.match(/\bLANGUAGE (sql|plpgsql)\b/)?.[1],
    volatility:/\bIMMUTABLE\b/.test(header)?'i':/\bSTABLE\b/.test(header)?'s':'v'});
  }
 }
 requireThat(entries.length===(target==='source'?15:8),'BASELINE_FUNCTION_COUNT_REJECTED');
 return entries;
}
export const INSTALL_SQL=Object.freeze({
 installedSourcePolicies:`SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p
 JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT p.polpermissive) AS no_restrictive_application_policies`,
 sourceProviderBaseline:`SELECT
 (SELECT count(*) FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${INACCESSIBLE_CRON_RELATION})=8 AS exact_inaccessible_cron_relations,
 (SELECT count(*) FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${INACCESSIBLE_CRON_SEQUENCE})=8 AS exact_inaccessible_cron_sequences`,
 sourceInheritedAccess:`WITH inherited AS (SELECT oid FROM pg_catalog.pg_roles
 WHERE rolname IN ('fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor')) SELECT
 NOT EXISTS(SELECT 1 FROM inherited r CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='extensions' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_table_privilege(r.oid,c.oid,'SELECT')) AS provider_views_not_usable_via_current_groups_or_public,
 NOT EXISTS(SELECT 1 FROM inherited r CROSS JOIN pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='purge_expired_geocoding'
 AND has_function_privilege(r.oid,p.oid,'EXECUTE')) AS geocoding_maintenance_not_inherited`,
 destinationProviderBaseline:`SELECT (SELECT count(*) FROM pg_catalog.pg_roles r
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE r.rolname='fmt_audit_writer_dev' AND ${INACCESSIBLE_PROVIDER_VIEW})=2 AS exact_inaccessible_provider_baseline`,
 ownerMemberships:`SELECT m.roleid::text,m.member::text,m.grantor::text,m.admin_option,m.inherit_option,m.set_option
 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
 WHERE r.rolname=$1 AND m.member=current_user::regrole ORDER BY m.grantor`,
 functions:`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
 AS e(schema text,name text,args text,owner text,body_hash text,definer boolean,language text,volatility text))
 SELECT NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_roles r ON r.oid=p.proowner JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE n.nspname=e.schema AND p.proname=e.name AND oidvectortypes(p.proargtypes)=e.args
 AND p.prokind='f' AND r.rolname=e.owner AND p.prosecdef=e.definer AND l.lanname=e.language
 AND NOT (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)
 AND p.provolatile::text=e.volatility AND NOT p.proisstrict AND cardinality(p.proconfig)=1
 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
 AND encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')=e.body_hash
 )) AS installed_function_contracts_match`,
 groups:`SELECT (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]))=cardinality($1::text[]) AS base_groups_present,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])
 AND (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid))) AS base_groups_restricted`,
 roleState:`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,cap integer,groups text[])) SELECT
 (SELECT count(*) FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name)=jsonb_array_length($1::jsonb) AS all_runtime_roles_present,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
 OR r.rolconnlimit<>e.cap OR NOT r.rolinherit) AS all_disabled_restricted,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE has_schema_privilege(r.oid,n.oid,'CREATE'))
 OR has_database_privilege(r.oid,current_database(),'CREATE')) AS no_runtime_ownership_or_ddl,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 JOIN pg_catalog.pg_auth_members m ON m.member=r.oid JOIN pg_catalog.pg_roles g ON g.oid=m.roleid
 WHERE NOT g.rolname=ANY(e.groups) OR m.admin_option OR NOT m.inherit_option OR NOT m.set_option) AS no_unexpected_memberships,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN LATERAL unnest(e.groups) g(name)
 WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles p JOIN pg_catalog.pg_auth_members m ON m.roleid=p.oid
 WHERE p.rolname=g.name AND m.member=r.oid AND NOT m.admin_option AND m.inherit_option AND m.set_option)) AS required_memberships_present,
 NOT EXISTS(SELECT 1 FROM expected target JOIN pg_catalog.pg_roles r ON r.rolname=target.name
 JOIN pg_catalog.pg_auth_members m ON m.roleid=r.oid JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
 WHERE NOT (m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)
 AND NOT EXISTS(SELECT 1 FROM expected member_expected WHERE member_expected.name=member_role.rolname
 AND target.name=ANY(member_expected.groups) AND NOT m.admin_option AND m.inherit_option AND m.set_option)) AS no_unexpected_runtime_delegation,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE r.rolname IN (SELECT name FROM expected)) AS no_future_object_grants,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fmt_audit_test_dev')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='audit_rehearsal') AS rehearsal_not_installed`,
 relations:`WITH roles AS (SELECT * FROM unnest($1::text[]) names(name)), expected AS
 (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(role text,schema text,name text,rights text[])),
 inaccessible_provider_views AS (SELECT r.oid AS role_oid,c.oid AS relation_oid,
 CASE WHEN n.nspname='cron' AND c.relname='job_run_details' THEN ARRAY['SELECT','DELETE'] ELSE ARRAY['SELECT'] END AS allowed_rights
 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE (${INACCESSIBLE_PROVIDER_VIEW}) OR (${INACCESSIBLE_CRON_RELATION})) SELECT
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.role CROSS JOIN LATERAL unnest(e.rights) needed(privilege)
 WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname=e.schema AND c.relname=e.name AND c.relkind IN ('r','p','v','m','f')
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_table_privilege(r.oid,c.oid,needed.privilege))) AS required_relation_privileges,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_table_privilege(r.oid,c.oid,needed.privilege) AND NOT EXISTS
 (SELECT 1 FROM expected a WHERE a.role=e.name AND a.schema=n.nspname AND a.name=c.relname AND needed.privilege=ANY(a.rights))
 AND NOT EXISTS(SELECT 1 FROM inaccessible_provider_views baseline
 WHERE baseline.role_oid=r.oid AND baseline.relation_oid=c.oid AND needed.privilege=ANY(baseline.allowed_rights))) AS no_unreviewed_relation_privileges,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_column_privilege(r.oid,c.oid,col.attnum,needed.privilege)
 AND NOT EXISTS(SELECT 1 FROM expected a WHERE a.role=e.name AND a.schema=n.nspname AND a.name=c.relname
 AND needed.privilege=ANY(a.rights))
 AND NOT (needed.privilege='SELECT' AND has_table_privilege(r.oid,c.oid,'SELECT')
 AND EXISTS(SELECT 1 FROM inaccessible_provider_views baseline
 WHERE baseline.role_oid=r.oid AND baseline.relation_oid=c.oid))) AS no_unreviewed_column_privileges`,
 grantOptions:`WITH roles AS (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])) SELECT
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_namespace n
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND (has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION') OR has_schema_privilege(r.oid,n.oid,'CREATE WITH GRANT OPTION'))) AS no_schema_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_table_privilege(r.oid,c.oid,needed.privilege||' WITH GRANT OPTION')) AS no_relation_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_column_privilege(r.oid,c.oid,col.attnum,needed.privilege||' WITH GRANT OPTION')) AS no_column_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) needed(privilege)
 WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_sequence_privilege(r.oid,c.oid,needed.privilege||' WITH GRANT OPTION')) AS no_sequence_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION')) AS no_function_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN unnest(ARRAY['CONNECT','CREATE','TEMPORARY']) needed(privilege)
 WHERE has_database_privilege(r.oid,current_database(),needed.privilege||' WITH GRANT OPTION')) AS no_database_grant_options`,
 sequences:`SELECT
 NOT EXISTS(SELECT 1 FROM unnest($1::text[]) names(name) JOIN pg_catalog.pg_roles r ON r.rolname=names.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) rights(privilege)
 WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_sequence_privilege(r.oid,c.oid,rights.privilege)
 AND NOT (names.name=ANY($2::text[]) AND n.nspname='public' AND c.relname=ANY($3::text[]) AND rights.privilege='USAGE')
 AND NOT(rights.privilege='SELECT' AND (${INACCESSIBLE_CRON_SEQUENCE}))) AS no_unreviewed_sequence_privileges,
 NOT EXISTS(SELECT 1 FROM unnest($2::text[]) roles(name) JOIN pg_catalog.pg_roles r ON r.rolname=roles.name
 CROSS JOIN unnest($3::text[]) seq(name) WHERE NOT EXISTS
 (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=seq.name AND c.relkind='S' AND has_sequence_privilege(r.oid,c.oid,'USAGE'))) AS required_sequence_usage`,
 entrypoints:`WITH roles AS (SELECT * FROM unnest($1::text[]) r(name)), expected AS
 (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(role text,schema text,name text,args text)) SELECT
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.role WHERE NOT EXISTS
 (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname=e.schema AND p.proname=e.name AND oidvectortypes(p.proargtypes)=e.args
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))) AS required_entrypoints,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('audit','audit_capture','audit_contract') AND has_function_privilege(r.oid,p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM expected a WHERE a.role=e.name AND a.schema=n.nspname AND a.name=p.proname
 AND a.args=oidvectortypes(p.proargtypes))) AS no_extra_audit_entrypoints,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='purge_expired_geocoding' AND has_function_privilege(r.oid,p.oid,'EXECUTE')) AS no_geocoding_maintenance`,
 policies:`SELECT (SELECT count(*) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])
 AND p.polname='fmt_app_server' AND p.polcmd='*' AND p.polpermissive
 AND p.polroles=ARRAY['fm_app_runtime'::regrole::oid] AND pg_get_expr(p.polqual,p.polrelid)='true'
 AND pg_get_expr(p.polwithcheck,p.polrelid)='true' AND c.relrowsecurity)=16 AS exact_runtime_policies`,
});
export function roleContracts(target){return target==='source'?[
 {name:'fm_app_runtime',cap:-1,groups:[]},{name:ROLES.app,cap:5,groups:['fm_app_runtime','fm_audit_capture']},
 {name:ROLES.capture,cap:2,groups:['fm_audit_capture']},{name:ROLES.worker,cap:2,groups:['fm_audit_delivery','fm_audit_source_monitor']}
 ]:[{name:ROLES.writer,cap:2,groups:['fm_audit_writer']}];}
export function relationContracts(target){
 if(target==='destination')return[];
 return ['fm_app_runtime',ROLES.app].flatMap(role=>APP_TABLES.map(name=>({role,schema:'public',name,
  rights:['SELECT','INSERT','UPDATE',...(DELETE_TABLES.includes(name)?['DELETE']:[])]}))).concat(
 ['delivery_health','maintenance_history'].map(name=>({role:ROLES.worker,schema:'audit_capture',name,rights:['SELECT']})));
}
export function entryContracts(target){
 if(target==='destination')return[{role:ROLES.writer,schema:'audit',name:'accept',args:'text, text, text'}];
 return [ROLES.app,ROLES.capture].map(role=>({role,schema:'audit_capture',name:'enqueue',args:'text, text, text'})).concat(
 [['claim','integer'],['ack','uuid, uuid'],['retry','uuid, uuid, text, integer'],['quarantine','uuid, uuid, text']]
 .map(([name,args])=>({role:ROLES.worker,schema:'audit_capture',name,args})));
}
export function requireBooleans(result,code){const row=booleanSnapshot(result);requireThat(Object.values(row).every(v=>v===true),code);return row;}
export function assertInstallPreflight(snapshot){
 for(const key of ['no_set_role','setup_principal','version_17','utf8','may_create_roles','runtime_names_free','rehearsal_name_free','setup_owner_admin_option'])
  requireThat(snapshot.identity[key]===true,'INSTALL_IDENTITY_OR_COLLISION_REJECTED');
 requireThat(snapshot.identity.setup_owner_effective_usage===false&&snapshot.identity.setup_owner_may_set===false,'SETUP_OWNER_ACCESS_REJECTED');
 requireThat(Object.values(snapshot.rights).every(v=>v===true)&&Object.values(snapshot.schema).every(v=>v===true),'INSTALL_SCHEMA_OR_RIGHTS_REJECTED');
}
export async function readonly(x,work){await x.query('BEGIN READ ONLY');try{return await work();}finally{await x.query('ROLLBACK');}}
export async function preflightInstall(x,target){
 const snapshot=await inspectMetadata(x,target);assertInstallPreflight(snapshot);
 return readonly(x,async()=>{
  const groups=target==='source'?['fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor']:['fm_audit_writer'];
  requireBooleans(await x.query(INSTALL_SQL.groups,[groups]),'BASE_GROUPS_REJECTED');
  if(target==='source')requireBooleans(await x.query(INSTALL_SQL.sourceInheritedAccess),'SOURCE_INHERITED_ACCESS_REJECTED');
  requireBooleans(await x.query(INSTALL_SQL.functions,[JSON.stringify(installedFunctionContracts(target))]),'INSTALLED_FUNCTIONS_REJECTED');
  const memberships=(await x.query(INSTALL_SQL.ownerMemberships,[`fm_audit_${target}_owner`])).rows;
  requireThat(memberships.length>0&&memberships.some(r=>r.admin_option===true)&&memberships.every(r=>r.inherit_option===false&&r.set_option===false),'OWNER_BASELINE_REJECTED');
  return {snapshot,memberships};
 });
}
export async function verifyInstalled(x,target,before){return readonly(x,async()=>{
 const roles=roleContracts(target),names=roles.map(r=>r.name);
 const checks={};
 for(const [key,sql,args]of [
  ['roles',INSTALL_SQL.roleState,[JSON.stringify(roles)]],
  ...(target==='destination'?[['inaccessibleProviderBaseline',INSTALL_SQL.destinationProviderBaseline,[]]]:[]),
  ...(target==='source'?[['inaccessibleCronBaseline',INSTALL_SQL.sourceProviderBaseline,[]]]:[]),
  ['relations',INSTALL_SQL.relations,[names,JSON.stringify(relationContracts(target))]],
  ['sequences',INSTALL_SQL.sequences,[names,target==='source'?['fm_app_runtime',ROLES.app]:[],target==='source'?APP_SEQUENCES:[]]],
  ['entrypoints',INSTALL_SQL.entrypoints,[names,JSON.stringify(entryContracts(target))]],
  ['grantOptions',INSTALL_SQL.grantOptions,[names]],
  ...(target==='source'?[['policyCompatibility',INSTALL_SQL.installedSourcePolicies,[APP_TABLES]],['policies',INSTALL_SQL.policies,[APP_TABLES]]]:[]),
 ])checks[key]=requireBooleans(await x.query(sql,args),'INSTALLED_RUNTIME_VERIFICATION_REJECTED');
 const observed=(await x.query(INSTALL_SQL.ownerMemberships,[`fm_audit_${target}_owner`])).rows;
 requireThat(JSON.stringify(observed)===JSON.stringify(before.memberships),'OWNER_MEMBERSHIP_CHANGED');
 checks.ownerMembershipsPreserved=true;return checks;
});}
export function checkCommit(result){
 const results=Array.isArray(result)?result:[result];
 requireThat(results.at(-1)?.command==='COMMIT','COMMIT_RESULT_UNCERTAIN');
 const receipts=results.filter(r=>r.command==='SELECT'&&r.fields?.length===1&&r.fields[0].name==='runtime_version_recorded');
 requireThat(receipts.length===1&&receipts[0].rows.length===1&&receipts[0].rows[0].runtime_version_recorded===true,'VERSION_RECEIPT_REJECTED');
}
export async function installDisabled({configs,cas,scripts,onEvent=()=>{},makeClient=client,open=connect,preflight=preflightInstall,verify=verifyInstalled}){
 const connections={},before={},commits={destination:'not-attempted',source:'not-attempted'};
 let target,stage='preflight';
 try{
  // Both fresh compatibility gates must pass before any write transaction.
  for(target of ['destination','source']){
   connections[target]=await makeClient(configs[target],target,cas[target]);await open(connections[target]);
   before[target]=await preflight(connections[target],target);
   onEvent({stage:'install-preflight',target,status:'passed'});
  }
  for(target of ['destination','source']){
   stage='migration';commits[target]='uncertain';
   try{
    const result=await connections[target].query({text:scripts.get(RUNTIME_FILES[target]),query_timeout:MIGRATION_TIMEOUT_MS});
    // A confirmed COMMIT remains committed even if the version receipt is bad.
    const items=Array.isArray(result)?result:[result];
    if(items.at(-1)?.command==='COMMIT')commits[target]='committed';
    checkCommit(result);
   }catch(e){
    if(commits[target]!=='committed'){
     try{await connections[target].query('ROLLBACK');
      if(PRECOMMIT_ERRORS.has(e?.code))commits[target]='rolled-back';
     }catch{/* Ambiguous outcomes remain uncertain. */}
    }throw e;
   }
   stage='verification';const checks=await verify(connections[target],target,before[target]);
   onEvent({stage:'disabled-runtime-installed',target,projectRef:TARGETS[target],status:'verified',
    file:RUNTIME_FILES[target],sha256:MANIFEST[RUNTIME_FILES[target]],version:`${target}-runtime-0003`,
    versionReceipt:true,checks,commits:{...commits},loginsEnabled:false,passwordsProvisioned:false,applicationCutover:false});
  }
  return {status:'passed',commits};
 }catch(e){onEvent({stage,target,status:'stopped',code:safeCode(e),commits:{...commits}});throw e;}
 finally{for(const x of Object.values(connections))try{await x.end();}catch{/* No error contents. */}}
}
export function loadRuntimeScripts(){
 const all=loadManifest();return new Map(Object.values(RUNTIME_FILES).map(file=>{
  const sql=all.get(file);requireThat(sql&&sql.includes('SET TRANSACTION READ WRITE;')&&sql.includes('AS runtime_version_recorded;')
   &&sql.includes('owner_memberships_before')&&sql.includes('GRANTED BY %I RESTRICT')
   &&!/(?:\bPASSWORD\b|\bALTER\s+(?:SYSTEM|DATABASE)|\blog_statement\b|\baudit_rehearsal\b)/i.test(sql),'DISABLED_SQL_SCOPE_REJECTED');
  return[file,sql];
 }));
}
async function main(){
 const mode=process.argv[2];requireThat(process.argv.length===3&&['offline','apply-runtime-disabled'].includes(mode),'MODE_REJECTED');
 const scripts=loadRuntimeScripts();
 for(const target of ['destination','source'])installedFunctionContracts(target);
 const repository=repositoryCompatibility(fs.readFileSync(path.join(ROOT,'shared/schema.ts'),'utf8'));
 if(mode==='offline'){emit('disabled-install-offline',{status:'passed',files:[...scripts.keys()],repository,privateFileAccess:false,databaseAccess:false,sqlExecuted:false});return;}
 const {configs,cas}=loadPrivateConfiguration();
 emit('disabled-install-scope',{repository,applicationCutover:false,loginsEnabled:false,passwordsProvisioned:false,
  note:'Only selected sixteen-table runtime installation; location feature, rehearsal and activation excluded.'});
 await installDisabled({configs,cas,scripts,onEvent:value=>emit('runtime-disabled-executor',value)});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('stopped',{code:safeCode(e)});process.exitCode=1;}
}
