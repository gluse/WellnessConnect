// Explicit post-activation profiles. No CLI, credentials, connections or I/O on import.
// Call only with the authorized setup client. Every database statement is read-only.
import {requireThat} from './runtime-support.mjs';
import {APP_TABLES,APP_SEQUENCES,ROLES} from './runtime-contract.mjs';
import {INSTALL_SQL,roleContracts,relationContracts,entryContracts,installedFunctionContracts,
 requireBooleans,readonly} from './execute-runtime-disabled.mjs';
import {LOCATION_SQL,LOCATION_TABLES,locationRelationContracts} from './search-location-runtime.mjs';
import {REHEARSAL_FILES,REHEARSAL_OWNER,TEST_ROLE} from './rehearsal-contract.mjs';
import {loadRehearsalScripts,rehearsalFunctionContracts} from './rehearsal-setup.mjs';

// Fixed PG17 deparse accepted by DB during the 23 October connected location review.
export const LOCATION_ACCEPTED_CHECK_SHA256='a6e723c3ec870b2190c8d34c87762ca13e3d6016045c804e8611e91576fec574';
export function activeRoleContracts(target){
 requireThat(['source','destination'].includes(target),'ACTIVE_TARGET_REJECTED');
 return roleContracts(target).map(role=>({...role,login:role.name!=='fm_app_runtime'}));
}
export const ACTIVE_SQL=Object.freeze({
 identity:`SELECT current_user=session_user AND current_user='postgres' AS setup_principal,
 current_setting('server_version_num')::integer/10000=17 AND current_setting('server_encoding')='UTF8' AS version_encoding,
 current_setting('transaction_read_only')='on' AS read_only,
 CASE WHEN $1='source' THEN to_regclass('public.users') IS NOT NULL AND to_regclass('public.bookings') IS NOT NULL
 ELSE to_regclass('public.users') IS NULL AND to_regclass('public.bookings') IS NULL END AS database_separation`,
 runtimeRoles:`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,cap integer,groups text[],login boolean)) SELECT
 (SELECT count(*) FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name)=jsonb_array_length($1::jsonb) AS exact_runtime_roles_present,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
  WHERE r.rolcanlogin IS DISTINCT FROM e.login OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
  OR r.rolconnlimit<>e.cap OR NOT r.rolinherit) AS exact_login_and_restricted_attributes,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
  WHERE EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner=r.oid)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.proowner=r.oid)
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
  WHERE NOT(m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)
  AND NOT EXISTS(SELECT 1 FROM expected member_expected WHERE member_expected.name=member_role.rolname
   AND target.name=ANY(member_expected.groups) AND NOT m.admin_option AND m.inherit_option AND m.set_option)) AS no_unexpected_runtime_delegation,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE r.rolname IN (SELECT name FROM expected)) AS no_runtime_future_grants`,
 ownerState:`WITH owners AS(SELECT oid,rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
  FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])) SELECT
 (SELECT count(*) FROM owners)=cardinality($1::text[]) AS owners_present,
 NOT EXISTS(SELECT 1 FROM owners r WHERE r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)) AS owners_restricted_without_parents,
 NOT EXISTS(SELECT 1 FROM owners r JOIN pg_catalog.pg_auth_members m ON m.roleid=r.oid
  WHERE NOT(m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)) AS only_inert_creator_delegation,
 NOT EXISTS(SELECT 1 FROM owners r WHERE pg_has_role(current_user,r.oid,'USAGE') OR pg_has_role(current_user,r.oid,'SET')) AS setup_owner_access_inert,
 EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=$2::regrole AND m.member=current_user::regrole AND m.admin_option)
  AND EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid='fm_audit_rehearsal_owner'::regrole
  AND m.member=current_user::regrole AND m.admin_option) AS setup_retains_required_inert_admin,
 EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='audit_rehearsal' AND n.nspowner='fm_audit_rehearsal_owner'::regrole) AS protected_rehearsal_namespace,
 NOT has_schema_privilege($2,'audit_rehearsal','CREATE') AS temporary_inspector_create_removed,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='audit_rehearsal')=4 AS exact_retained_evidence_relations,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='audit_rehearsal' AND c.relname IN ('run','cohort') AND c.relkind='r'
  AND c.relrowsecurity AND c.relowner='fm_audit_rehearsal_owner'::regrole)=2 AS retained_evidence_rls_owner,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner='fm_audit_rehearsal_owner'::regrole AND n.nspname<>'audit_rehearsal')
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relowner='fm_audit_rehearsal_owner'::regrole AND n.nspname<>'audit_rehearsal'
   AND NOT(n.nspname='pg_toast' AND EXISTS(SELECT 1 FROM pg_catalog.pg_class parent
    JOIN pg_catalog.pg_namespace parent_schema ON parent_schema.oid=parent.relnamespace
    WHERE parent_schema.nspname='audit_rehearsal' AND parent.relname IN ('run','cohort')
    AND parent.relkind='r' AND parent.relowner='fm_audit_rehearsal_owner'::regrole
    AND (parent.reltoastrelid=c.oid OR EXISTS(SELECT 1 FROM pg_catalog.pg_index i
      WHERE i.indexrelid=c.oid AND i.indrelid=parent.reltoastrelid)))))
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE p.proowner='fm_audit_rehearsal_owner'::regrole AND n.nspname<>'audit_rehearsal') AS rehearsal_owner_scope`,
 locationDefinition:`SELECT count(*)=1 AND coalesce(bool_and(
  encode(sha256(convert_to(pg_get_constraintdef(q.oid),'UTF8')),'hex')=$1),false) AS exact_accepted_location_shape_definition
  FROM pg_catalog.pg_constraint q WHERE q.conrelid=to_regclass('public.user_search_locations')
  AND q.conname='search_location_shape' AND q.contype='c' AND q.convalidated`,
 rehearsalFunctions:`WITH expected AS(SELECT * FROM jsonb_to_recordset($1::jsonb)
  AS e(name text,args text,owner text,returns text,body_hash text)) SELECT
 (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='audit_rehearsal')=6 AS exact_rehearsal_function_count,
 NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang
  WHERE n.nspname='audit_rehearsal' AND p.proname=e.name AND oidvectortypes(p.proargtypes)=e.args
  AND p.prokind='f' AND p.proowner=e.owner::regrole AND p.prosecdef AND NOT p.proisstrict AND p.provolatile='v'
  AND l.lanname IN ('sql','plpgsql') AND pg_get_function_result(p.oid)=e.returns
  AND cardinality(p.proconfig)=1 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
  AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.body_hash
  AND has_function_privilege('fmt_audit_test_dev',p.oid,'EXECUTE')=$2::boolean
  AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))) AS exact_rehearsal_function_contracts_and_access`,
 testState:`SELECT
 EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='fmt_audit_test_dev'
  AND r.rolcanlogin=$1::boolean AND r.rolconnlimit=2 AND r.rolinherit
  AND NOT(r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls)) AS exact_test_login_attributes,
 has_schema_privilege('fmt_audit_test_dev','audit_rehearsal','USAGE')=$1::boolean AS exact_test_schema_access,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member='fmt_audit_test_dev'::regrole) AS no_test_parent_memberships,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid='fmt_audit_test_dev'::regrole
  AND NOT(m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)) AS no_effective_test_delegation,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE has_schema_privilege('fmt_audit_test_dev',n.oid,'CREATE'))
  AND NOT has_database_privilege('fmt_audit_test_dev',current_database(),'CREATE') AS no_test_ddl,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner='fmt_audit_test_dev'::regrole)
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner='fmt_audit_test_dev'::regrole)
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.proowner='fmt_audit_test_dev'::regrole) AS no_test_ownership,
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

export function activeCheckPlan(target,{testAccess}={}){
 requireThat(['source','destination'].includes(target),'ACTIVE_TARGET_REJECTED');
 requireThat(['enabled','disabled'].includes(testAccess),'ACTIVE_TEST_ACCESS_REJECTED');
 const enabled=testAccess==='enabled',roles=activeRoleContracts(target),names=roles.map(r=>r.name),owner=`fm_audit_${target}_owner`;
 const scripts=loadRehearsalScripts();
 return [
  ['identity',ACTIVE_SQL.identity,[target]],
  ['runtimeRoles',ACTIVE_SQL.runtimeRoles,[JSON.stringify(roles)]],
  ['baseGroups',INSTALL_SQL.groups,[target==='source'?['fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor']:['fm_audit_writer']]],
  ['originalFunctions',INSTALL_SQL.functions,[JSON.stringify(installedFunctionContracts(target))]],
  ['ownerState',ACTIVE_SQL.ownerState,[[owner,REHEARSAL_OWNER],owner]],
  ['rehearsalFunctions',ACTIVE_SQL.rehearsalFunctions,[JSON.stringify(rehearsalFunctionContracts(target,scripts.get(REHEARSAL_FILES[target]))),enabled]],
  ['testState',ACTIVE_SQL.testState,[enabled]],
  [target==='source'?'inaccessibleCronBaseline':'inaccessibleProviderBaseline',target==='source'?INSTALL_SQL.sourceProviderBaseline:INSTALL_SQL.destinationProviderBaseline,[]],
  ['relations',INSTALL_SQL.relations,[names,JSON.stringify(target==='source'?locationRelationContracts():relationContracts(target))]],
  ['sequences',INSTALL_SQL.sequences,[names,target==='source'?['fm_app_runtime',ROLES.app]:[],target==='source'?APP_SEQUENCES:[]]],
  ['entrypoints',INSTALL_SQL.entrypoints,[names,JSON.stringify(entryContracts(target))]],
  ['grantOptions',INSTALL_SQL.grantOptions,[[...names,TEST_ROLE]]],
  ...(target==='source'?[
   ['tables',LOCATION_SQL.tables,[LOCATION_TABLES]],['shape',LOCATION_SQL.shape,[]],
   ['shapeDefinition',ACTIVE_SQL.locationDefinition,[LOCATION_ACCEPTED_CHECK_SHA256]],
   ['privateLocationAcl',LOCATION_SQL.privateAcl,[['anon','authenticated','service_role']]],
   ['locationPolicy',LOCATION_SQL.policy,[]],['allPoliciesPermissive',INSTALL_SQL.installedSourcePolicies,[LOCATION_TABLES]],
   ['foundationPolicies',INSTALL_SQL.policies,[APP_TABLES]],
  ]:[]),
 ];
}
export async function verifyActiveRuntime(x,target,options){
 const plan=activeCheckPlan(target,options);
 return readonly(x,async()=>{
  const checks={};for(const[key,sql,args]of plan)checks[key]=requireBooleans(await x.query(sql,args),'ACTIVE_RUNTIME_VERIFICATION_REJECTED');
  return {profile:target==='source'?'active-seventeen-table-runtime':'active-destination-runtime',testAccess:options.testAccess,checks};
 });
}
