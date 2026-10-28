// Opt-in prepared billing audit extension. No configuration/client/I/O on import.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {functionContracts as serviceViewContracts,SQL as SERVICE_VIEW_SQL,RETENTION_NEW} from './execute-service-view.mjs';
import {activeCheckPlan} from './runtime-active-profile.mjs';
import {billingV2CheckPlan} from '../billing/v2-runtime-profile.mjs';
import {requireThat} from './runtime-support.mjs';
import {requireBooleans,readonly} from './execute-runtime-disabled.mjs';
import {TARGETS} from './runtime-contract.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
const digest=s=>createHash('sha256').update(s).digest('hex');
export const BILLING_AUDIT_EVENTS=Object.freeze([
 'billing.checkout_reserved.v1','billing.checkout_created.v1','billing.checkout_unknown.v1',
 'billing.event_accepted.v1','billing.event_quarantined.v1','billing.subscription_reconciled.v1',
 'billing.offer_changed.v1','billing.manual_grant_changed.v1','billing.price_mapping_changed.v1',
 'billing.workspace_initialized.v1','billing.checkout_resolved.v1',
]);
export const BILLING_AUDIT_PINS=Object.freeze({
 '_billing_v1.sql':'9d200e460be0637debdbaa884439fd1b66e16a62300cbe29d73a5a6059f434cc',
 '0006_source_billing.sql':'0e0af1553e9715ab7c629ff8ad526378155be343503028515fbb168065007a46',
 '0006_destination_billing.sql':'5591c9fca54138f3263448d34cfbbd969e2fd4671586811aa037e207a332d0ab',
});
export function loadBillingAuditScripts(){
 const raw=new Map(Object.entries(BILLING_AUDIT_PINS).map(([name,pin])=>{
  const bytes=fs.readFileSync(path.join(directory,name));requireThat(digest(bytes)===pin,'BILLING_AUDIT_DIGEST_MISMATCH');return[name,bytes.toString('utf8')];
 }));
 return new Map(['source','destination'].map(target=>{
  const wrapper=raw.get(`0006_${target}_billing.sql`);
  requireThat((wrapper.match(/^\\ir _billing_v1.sql$/gm)||[]).length===1,'BILLING_AUDIT_INCLUDE_REJECTED');
  const sql=wrapper.replace(/^\\ir _billing_v1.sql$/m,()=>raw.get('_billing_v1.sql'));
  requireThat((sql.match(/^BEGIN;$/gm)||[]).length===1 && (sql.match(/^COMMIT;$/gm)||[]).length===1
   && !/^\s*\\/m.test(sql) && !/\b(?:PASSWORD|TRUNCATE|DROP\s+(?:TABLE|FUNCTION)|CREATE\s+(?:TABLE|ROLE|INDEX))\b/i.test(sql),'BILLING_AUDIT_SCOPE_REJECTED');
  return[target,sql];
 }));
}
export function billingAuditFunctionContracts(target,scripts=loadBillingAuditScripts()){
 requireThat(['source','destination'].includes(target),'BILLING_AUDIT_TARGET_REJECTED');
 const contracts=serviceViewContracts(target).map(c=>({...c}));
 const parser=contracts.find(c=>c.schema==='audit_contract'&&c.name==='parse_event');
 const previous={...parser,name:'parse_event_before_billing'};
 const body=scripts.get(target).match(/RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS \$billing\$([\s\S]*?)\$billing\$;/)?.[1];
 requireThat(parser && typeof body==='string','BILLING_AUDIT_PARSER_MISSING');parser.body_hash=digest(body);
 return [...contracts,previous];
}
export const BILLING_AUDIT_SQL=Object.freeze({version:`SELECT EXISTS(SELECT 1 FROM audit_contract.installation
 WHERE singleton AND environment='development' AND project_ref=$1) AS exact_installation,
 EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='billing-v1-0006') AS billing_contract_installed`,
 parserAcl:`SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.pronamespace='audit_contract'::regnamespace AND p.proname IN('parse_event','parse_event_before_billing')
 AND (a.grantee=0 OR a.is_grantable)) AS no_public_or_delegated_parser_execution`,
});
export function billingAuditCheckPlan(target,options,scripts=loadBillingAuditScripts()){
 requireThat(['source','destination'].includes(target),'BILLING_AUDIT_TARGET_REJECTED');
 const plan=target==='source'?billingV2CheckPlan(options):activeCheckPlan(target,{testAccess:options?.testAccess});
 return plan.map(([key,sql,args])=>[key,sql,key==='originalFunctions'?[JSON.stringify(billingAuditFunctionContracts(target,scripts))]:args]).concat([
  ['billingAuditVersion',BILLING_AUDIT_SQL.version,[TARGETS[target]]],
  ['billingAuditParserAcl',BILLING_AUDIT_SQL.parserAcl,[]],
  ['billingAuditOwners',SERVICE_VIEW_SQL.owners,[['fm_audit_contract_owner',`fm_audit_${target}_owner`]]],
  ['billingAuditRetainedRetention',SERVICE_VIEW_SQL.retention,[target==='source'?'audit_capture':'audit',target==='source'?'audit_outbox':'events',true,RETENTION_NEW,'unused-original-expiry','unused-original-class']],
 ]);
}
export async function verifyBillingAuditRuntime(client,target,options,scripts=loadBillingAuditScripts()){
 const plan=billingAuditCheckPlan(target,options,scripts);
 return readonly(client,async()=>{const checks={};for(const[key,sql,args]of plan)checks[key]=requireBooleans(await client.query(sql,args),'BILLING_AUDIT_VERIFICATION_REJECTED');return{profile:`billing-audit-${target}`,checks};});
}
