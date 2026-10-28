// Explicit offer/source follow-up profile. No configuration/connection side effects.
import {billingCheckPlan,billingRelationContracts,BILLING_SQL} from './runtime-profile.mjs';
import {BILLING_TABLES} from './contract.mjs';
import {BILLING_V2_TABLES,BILLING_V2_PROFILE_TABLES,BILLING_V2_RIGHTS,INITIAL_OFFER_ID} from './v2-contract.mjs';
import {ROLES} from '../audit/runtime-contract.mjs';
import {requireThat} from '../audit/runtime-support.mjs';
import {requireBooleans,readonly} from '../audit/execute-runtime-disabled.mjs';
import columns from './v2-columns.json' with {type:'json'};
export const BILLING_V2_SQL=Object.freeze({
 tables:BILLING_SQL.tables.replace('=23 AS exactly_twenty_three_tables','=27 AS exactly_twenty_seven_tables'),
 // ALTER ADD COLUMN appends physical columns; compare logical names/types,
 // not ORM declaration positions, when upgrading the published v1 tables.
 columns:BILLING_SQL.columns.replace('ORDER BY a.attnum','ORDER BY a.attname COLLATE "C"'),
 guards:`WITH expected(name,relation,fn) AS (VALUES
 ('billing_offer_immutable','billing_offer_revisions','reject_billing_offer_mutation'),
 ('billing_price_identity_immutable','billing_price_mappings','guard_billing_price_mapping'),
 ('billing_offer_settings_cas','billing_offer_settings','guard_billing_offer_settings'),
 ('billing_subscription_offer_immutable','billing_subscriptions','guard_billing_subscription_offer'))
 SELECT NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
  WHERE t.tgname=e.name AND t.tgrelid=to_regclass('public.'||e.relation) AND NOT t.tgisinternal AND t.tgenabled='O'
  AND p.pronamespace='public'::regnamespace AND p.proname=e.fn AND p.proowner=current_user::regrole
  AND NOT p.prosecdef AND p.prorettype='trigger'::regtype
  AND cardinality(p.proconfig)=1 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
  AND NOT has_function_privilege('fm_app_runtime',p.oid,'EXECUTE')
  AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
 )) AS immutable_guards_present`,
 catalog:`SELECT EXISTS(SELECT 1 FROM public.billing_offer_revisions WHERE id=$1::uuid
  AND version=1 AND amount_minor=1900 AND currency='EUR' AND interval='month' AND tax_included AND issued_by IS NULL) AS initial_offer_preserved,
  EXISTS(SELECT 1 FROM public.billing_offer_settings s JOIN public.billing_offer_revisions r ON r.id=s.current_offer_id
  WHERE s.singleton AND s.revision=r.version AND s.updated_by IS NOT DISTINCT FROM r.issued_by) AS current_pointer_consistent`,
});
export function billingV2RelationContracts(billingAccess,offerAccess){
 requireThat(['dormant','runtime'].includes(offerAccess),'BILLING_OFFER_ACCESS_REJECTED');
 return billingRelationContracts(billingAccess).concat(offerAccess==='runtime'?['fm_app_runtime',ROLES.app].flatMap(role=>
  BILLING_V2_TABLES.map(name=>({role,schema:'public',name,rights:[...BILLING_V2_RIGHTS[name]]}))):[]);
}
export function billingV2CheckPlan({testAccess,billingAccess,offerAccess}={}){
 const relations=billingV2RelationContracts(billingAccess,offerAccess);
 return billingCheckPlan({testAccess,billingAccess}).map(([key,sql,args])=>{
  if(key==='relations')return[key,sql,[args[0],JSON.stringify(relations)]];
  if(key==='tables')return[key,BILLING_V2_SQL.tables,[BILLING_V2_PROFILE_TABLES]];
  if(key==='allPoliciesPermissive')return[key,sql,[BILLING_V2_PROFILE_TABLES]];
  if(key==='billingColumns')return[key,BILLING_V2_SQL.columns,[JSON.stringify(columns)]];
  return[key,sql,args];
 }).concat([
  ['offerPolicies',BILLING_SQL.policies,[BILLING_V2_TABLES,offerAccess==='runtime'?1:0]],
  ['offerPrivateAcl',BILLING_SQL.privateAcl,[BILLING_V2_TABLES,['anon','authenticated','service_role'],offerAccess==='runtime']],
  ['offerGuards',BILLING_V2_SQL.guards,[]],['offerCatalog',BILLING_V2_SQL.catalog,[INITIAL_OFFER_ID]],
 ]);
}
export async function verifyBillingV2Runtime(client,options){
 const plan=billingV2CheckPlan(options);
 return readonly(client,async()=>{
  const checks={};for(const[key,sql,args]of plan)checks[key]=requireBooleans(await client.query(sql,args),'BILLING_V2_VERIFICATION_REJECTED');
  const definitions=(await client.query(BILLING_SQL.definitions,[[...BILLING_TABLES,...BILLING_V2_TABLES]])).rows;
  requireThat(definitions.length>0,'BILLING_V2_DEFINITIONS_MISSING');
  return {profile:'billing-choice2-offers',checks,definitions,semanticReviewRequired:true};
 });
}
