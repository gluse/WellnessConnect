// Opt-in TASK-026 profile. Preserve the active TASK-014 sixteen-table package.
// Import is inert: no files, credentials, clients or network are accessed.
import {APP_TABLES, APP_SEQUENCES, ROLES} from './runtime-contract.mjs';
import {requireThat} from './runtime-support.mjs';
import {INSTALL_SQL, roleContracts, relationContracts, entryContracts,
  installedFunctionContracts, requireBooleans, readonly, verifyInstalled} from './execute-runtime-disabled.mjs';

export const LOCATION_TABLE='user_search_locations';
export const LOCATION_TABLES=Object.freeze([...APP_TABLES,LOCATION_TABLE]);
export const LOCATION_RIGHTS=Object.freeze(['SELECT','INSERT','UPDATE','DELETE']);
export function locationRelationContracts() {
  return relationContracts('source').concat(['fm_app_runtime',ROLES.app].map(role=>({
    role,schema:'public',name:LOCATION_TABLE,rights:[...LOCATION_RIGHTS],
  })));
}
export function locationRepositoryCompatibility(text) {
  const declared=[...text.matchAll(/\bpgTable\(\s*["']([a-z0-9_]+)["']/g)].map(m=>m[1]);
  return declared.length===LOCATION_TABLES.length && new Set(declared).size===declared.length &&
    LOCATION_TABLES.every(name=>declared.includes(name));
}
export const LOCATION_SQL=Object.freeze({
  identity:`SELECT current_user='postgres' AND current_user=session_user AS setup_identity,
    current_setting('server_version_num')::integer/10000=17 AS version_17,
    current_setting('server_encoding')='UTF8' AS utf8,
    current_setting('transaction_read_only')='on' AS read_only`,
  absence:`SELECT to_regclass('public.user_search_locations') IS NULL AS location_absent`,
  foundation:`SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p'))=16 AS exactly_sixteen_tables,
    NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t(name) WHERE NOT EXISTS
      (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t.name AND c.relkind='r'
      AND c.relowner=current_user::regrole AND c.relrowsecurity)) AS foundation_owner_rls`,
  tables:`SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p'))=17 AS exactly_seventeen_tables,
    NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t(name) WHERE NOT EXISTS
      (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t.name AND c.relkind='r'
      AND c.relowner=current_user::regrole AND c.relrowsecurity)) AS all_expected_owner_rls`,
  shape:`WITH location AS (SELECT * FROM pg_catalog.pg_class
      WHERE oid=to_regclass('public.user_search_locations')) SELECT
    EXISTS(SELECT 1 FROM location WHERE relkind='r' AND relowner=current_user::regrole
      AND relrowsecurity AND NOT relforcerowsecurity) AS location_owner_rls,
    (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull)
      ORDER BY a.attnum) FROM pg_catalog.pg_attribute a JOIN location c ON c.oid=a.attrelid
      WHERE a.attnum>0 AND NOT a.attisdropped)=
      '[["user_id","character varying",true],["source","character varying",true],
      ["input_text","character varying(300)",false],["place_id","character varying(512)",false],
      ["latitude","double precision",false],["longitude","double precision",false],
      ["updated_at","timestamp with time zone",true]]'::jsonb AS exact_columns,
    EXISTS(SELECT 1 FROM pg_catalog.pg_attrdef d JOIN location c ON c.oid=d.adrelid
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.adnum
      WHERE a.attname='updated_at' AND pg_get_expr(d.adbin,d.adrelid)='now()') AS timestamp_default,
    (SELECT count(*) FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid)=3 AS exactly_three_constraints,
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid
      WHERE q.contype='p' AND q.convalidated AND q.conkey=ARRAY[1]::smallint[]) AS owner_primary_key,
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid
      WHERE q.contype='f' AND q.convalidated AND q.confdeltype='c' AND q.conkey=ARRAY[1]::smallint[]
      AND q.confrelid=to_regclass('public.users') AND q.confkey=ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.users') AND attname='id')]::smallint[])
      AS cascading_owner_foreign_key,
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid
      WHERE q.contype='c' AND q.conname='search_location_shape' AND q.convalidated) AS validated_shape_constraint`,
  policy:`SELECT (SELECT count(*) FROM pg_catalog.pg_policy
    WHERE polrelid=to_regclass('public.user_search_locations'))=1 AS one_location_policy,
    EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=to_regclass('public.user_search_locations')
      AND p.polname='fmt_app_server' AND p.polcmd='*' AND p.polpermissive
      AND p.polroles=ARRAY['fm_app_runtime'::regrole::oid]
      AND pg_get_expr(p.polqual,p.polrelid)='true'
      AND pg_get_expr(p.polwithcheck,p.polrelid)='true') AS server_only_policy`,
  privateAcl:`SELECT
    (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]))=3 AS private_roles_present,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
      WHERE r.rolname=ANY($1::text[]) AND c.oid=to_regclass('public.user_search_locations')
      AND has_table_privilege(r.oid,c.oid,p.privilege)) AS browser_and_service_no_table_access,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_attribute a
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
      WHERE r.rolname=ANY($1::text[]) AND a.attrelid=to_regclass('public.user_search_locations')
      AND a.attnum>0 AND NOT a.attisdropped
      AND has_column_privilege(r.oid,a.attrelid,a.attnum,p.privilege)) AS browser_and_service_no_column_access,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL
      aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=to_regclass('public.user_search_locations') AND
      (a.grantee NOT IN (c.relowner,'fm_app_runtime'::regrole::oid) OR a.is_grantable
      OR (a.grantee='fm_app_runtime'::regrole::oid AND a.privilege_type NOT IN ('SELECT','INSERT','UPDATE','DELETE'))))
      AS no_unreviewed_location_acl`,
  definition:`SELECT pg_get_constraintdef(oid) AS definition FROM pg_catalog.pg_constraint
    WHERE conrelid=to_regclass('public.user_search_locations') AND conname='search_location_shape' AND contype='c'`,
});

export async function preflightLocation(x) {
  const before=await readonly(x,async()=>{
    for(const [sql,args] of [[LOCATION_SQL.identity,[]],[LOCATION_SQL.absence,[]],
      [LOCATION_SQL.foundation,[APP_TABLES]],
      [INSTALL_SQL.groups,[['fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor']]],
      [INSTALL_SQL.functions,[JSON.stringify(installedFunctionContracts('source'))]]])
      requireBooleans(await x.query(sql,args),'LOCATION_FOUNDATION_REJECTED');
    const memberships=(await x.query(INSTALL_SQL.ownerMemberships,['fm_audit_source_owner'])).rows;
    requireThat(memberships.length>0 && memberships.every(row=>row.inherit_option===false && row.set_option===false),
      'LOCATION_OWNER_BASELINE_REJECTED');
    return {memberships};
  });
  // Old verifier intentionally rejects location-first and any unreviewed grant.
  await verifyInstalled(x,'source',before);
  return before;
}

export async function verifyLocationRuntime(x,before) {
  return readonly(x,async()=>{
    const roles=roleContracts('source'), names=roles.map(role=>role.name), checks={};
    for(const [key,sql,args] of [
      ['identity',LOCATION_SQL.identity,[]],
      ['tables',LOCATION_SQL.tables,[LOCATION_TABLES]],
      ['shape',LOCATION_SQL.shape,[]],['privateAcl',LOCATION_SQL.privateAcl,[['anon','authenticated','service_role']]],
      ['locationPolicy',LOCATION_SQL.policy,[]],
      ['roles',INSTALL_SQL.roleState,[JSON.stringify(roles)]],
      ['inaccessibleCronBaseline',INSTALL_SQL.sourceProviderBaseline,[]],
      ['relations',INSTALL_SQL.relations,[names,JSON.stringify(locationRelationContracts())]],
      ['sequences',INSTALL_SQL.sequences,[names,['fm_app_runtime',ROLES.app],APP_SEQUENCES]],
      ['entrypoints',INSTALL_SQL.entrypoints,[names,JSON.stringify(entryContracts('source'))]],
      ['grantOptions',INSTALL_SQL.grantOptions,[names]],
      ['policyCompatibility',INSTALL_SQL.installedSourcePolicies,[LOCATION_TABLES]],
      ['foundationPolicies',INSTALL_SQL.policies,[APP_TABLES]],
    ]) checks[key]=requireBooleans(await x.query(sql,args),'LOCATION_RUNTIME_VERIFICATION_REJECTED');
    const observed=(await x.query(INSTALL_SQL.ownerMemberships,['fm_audit_source_owner'])).rows;
    requireThat(JSON.stringify(observed)===JSON.stringify(before.memberships),'LOCATION_OWNER_MEMBERSHIP_CHANGED');
    const definitions=(await x.query(LOCATION_SQL.definition)).rows;
    requireThat(definitions.length===1 && typeof definitions[0].definition==='string','LOCATION_DEFINITION_MISSING');
    // Return the actual deparsed CHECK for DB review; do not pretend a name-only
    // catalog assertion proves semantic equivalence to the pinned migration.
    return {checks,shapeDefinition:definitions[0].definition,shapeSemanticReviewRequired:true};
  });
}
