// Explicit opt-in choice-2 profile; preserves historical seventeen-table plans.
// Import performs no filesystem, environment, credential or connection access.
import {activeCheckPlan} from '../audit/runtime-active-profile.mjs';
import {locationRelationContracts} from '../audit/search-location-runtime.mjs';
import {requireBooleans,readonly} from '../audit/execute-runtime-disabled.mjs';
import {requireThat} from '../audit/runtime-support.mjs';
import {ROLES} from '../audit/runtime-contract.mjs';
import {BILLING_TABLES,BILLING_PROFILE_TABLES,BILLING_RUNTIME_RIGHTS} from './contract.mjs';
import columns from './columns.json' with {type:'json'};

export const BILLING_SQL=Object.freeze({
  tables:`SELECT (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p'))=23 AS exactly_twenty_three_tables,
    NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t(name) WHERE NOT EXISTS
      (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=t.name AND c.relkind='r'
       AND c.relowner=current_user::regrole AND c.relrowsecurity)) AS expected_owner_rls`,
  columns:`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,columns jsonb))
    SELECT NOT EXISTS(SELECT 1 FROM expected e WHERE
      (SELECT jsonb_agg(jsonb_build_array(a.attname,
        regexp_replace(replace(format_type(a.atttypid,a.atttypmod),'character varying','varchar'),'[[:space:]]','','g'),a.attnotnull)
        ORDER BY a.attnum) FROM pg_catalog.pg_attribute a WHERE a.attrelid=to_regclass('public.'||e.name)
        AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM e.columns) AS exact_billing_columns`,
  policies:`SELECT NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t(name) WHERE
    (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid=to_regclass('public.'||t.name))<>$2::integer)
    AS exact_billing_policy_count,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
      WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1::text[])
      AND NOT(p.polname='fmt_billing_server' AND p.polcmd='*' AND p.polpermissive
        AND p.polroles=ARRAY['fm_app_runtime'::regrole::oid]
        AND pg_get_expr(p.polqual,p.polrelid)='true' AND pg_get_expr(p.polwithcheck,p.polrelid)='true'))
    AS exact_billing_runtime_policy`,
  privateAcl:`SELECT
    (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=ANY($2::text[]))=cardinality($2::text[]) AS private_roles_present,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN unnest($1::text[]) t(name)
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
      WHERE r.rolname=ANY($2::text[]) AND has_table_privilege(r.oid,to_regclass('public.'||t.name),p.privilege)) AS no_browser_service_table_access,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r JOIN pg_catalog.pg_attribute a ON true
      JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
      WHERE r.rolname=ANY($2::text[]) AND n.nspname='public' AND c.relname=ANY($1::text[])
      AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(r.oid,c.oid,a.attnum,p.privilege)) AS no_browser_service_column_access,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1::text[])
      AND (a.grantee NOT IN(c.relowner,'fm_app_runtime'::regrole::oid) OR a.is_grantable
        OR (a.grantee='fm_app_runtime'::regrole::oid AND (NOT $3::boolean OR a.privilege_type NOT IN('SELECT','INSERT','UPDATE'))))) AS no_unreviewed_billing_acl`,
  definitions:`SELECT c.relname,q.conname,pg_get_constraintdef(q.oid) AS definition
    FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($1::text[]) ORDER BY c.relname,q.conname`,
});
export function billingRelationContracts(access){
  requireThat(['dormant','runtime'].includes(access),'BILLING_ACCESS_PROFILE_REJECTED');
  return locationRelationContracts().concat(access==='runtime'?['fm_app_runtime',ROLES.app].flatMap(role=>
    BILLING_TABLES.map(name=>({role,schema:'public',name,rights:[...BILLING_RUNTIME_RIGHTS]}))):[]);
}
export function billingCheckPlan({testAccess,billingAccess}={}){
  const relations=billingRelationContracts(billingAccess);
  return activeCheckPlan('source',{testAccess}).map(([key,sql,args])=>{
    if(key==='relations')return[key,sql,[args[0],JSON.stringify(relations)]];
    if(key==='tables')return[key,BILLING_SQL.tables,[BILLING_PROFILE_TABLES]];
    if(key==='allPoliciesPermissive')return[key,sql,[BILLING_PROFILE_TABLES]];
    return[key,sql,args];
  }).concat([
    ['billingColumns',BILLING_SQL.columns,[JSON.stringify(columns)]],
    ['billingPolicies',BILLING_SQL.policies,[BILLING_TABLES,billingAccess==='runtime'?1:0]],
    ['billingPrivateAcl',BILLING_SQL.privateAcl,[BILLING_TABLES,['anon','authenticated','service_role'],billingAccess==='runtime']],
  ]);
}
export async function verifyBillingRuntime(client,options){
  const plan=billingCheckPlan(options);
  return readonly(client,async()=>{
    const checks={};
    for(const[key,sql,args]of plan)checks[key]=requireBooleans(await client.query(sql,args),'BILLING_RUNTIME_VERIFICATION_REJECTED');
    const definitions=(await client.query(BILLING_SQL.definitions,[BILLING_TABLES])).rows;
    requireThat(definitions.length>0 && definitions.every(d=>typeof d.definition==='string'),'BILLING_DEFINITIONS_MISSING');
    return {profile:`billing-choice2-${options.billingAccess}`,checks,definitions,semanticReviewRequired:true};
  });
}
