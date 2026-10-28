// Additive opt-in portal extension; import performs no private/configuration I/O.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {billingAuditCheckPlan,billingAuditFunctionContracts} from './billing-package.mjs';
import {requireThat} from './runtime-support.mjs';import {requireBooleans,readonly} from './execute-runtime-disabled.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));const digest=s=>createHash('sha256').update(s).digest('hex');
export const PORTAL_AUDIT_EVENTS=Object.freeze(['billing.portal_reserved.v1','billing.portal_created.v1','billing.portal_unknown.v1']);
export const PORTAL_AUDIT_PINS=Object.freeze({
 '_billing_portal_v1.sql':'87ddd50e14518aa2fdca358fcc353b43ed95470381235d60b63c5af61a214134',
 '0007_source_billing_portal.sql':'f022e6e2dbc9280cd1f6b8b690ce9a1d680b5f0be431c73159a6159352bbd8c0',
 '0007_destination_billing_portal.sql':'e7c1f5a5c57fee9998a6c58fd9ca2e9b54d2281acec00ea320f308cb69c94642',
});
export function loadPortalAuditScripts(){
 const raw=new Map(Object.entries(PORTAL_AUDIT_PINS).map(([file,pin])=>{
  const bytes=fs.readFileSync(path.join(directory,file));requireThat(digest(bytes)===pin,'PORTAL_AUDIT_PIN_REJECTED');return[file,bytes.toString('utf8')];
 }));
 return new Map(['source','destination'].map(target=>{
  const wrapper=raw.get(`0007_${target}_billing_portal.sql`);
  requireThat((wrapper.match(/^\\ir _billing_portal_v1.sql$/gm)||[]).length===1,'PORTAL_AUDIT_INCLUDE_REJECTED');
  const sql=wrapper.replace(/^\\ir _billing_portal_v1.sql$/m,()=>raw.get('_billing_portal_v1.sql'));
  requireThat((sql.match(/^BEGIN;$/gm)||[]).length===1 && (sql.match(/^COMMIT;$/gm)||[]).length===1
   && !/^\s*\\/m.test(sql) && !/\b(?:PASSWORD|TRUNCATE|DROP\s+(?:TABLE|FUNCTION)|CREATE\s+(?:TABLE|ROLE|INDEX))\b/i.test(sql),'PORTAL_AUDIT_SCOPE_REJECTED');
  return[target,sql];
 }));
}
export function portalAuditFunctionContracts(target,scripts=loadPortalAuditScripts()){
 const base=billingAuditFunctionContracts(target).map(c=>({...c}));const current=base.find(c=>c.name==='parse_event'&&c.schema==='audit_contract');
 const previous={...current,name:'parse_event_before_portal'};
 const body=scripts.get(target)?.match(/AS \$portal\$([\s\S]*?)\$portal\$;/)?.[1];requireThat(current && typeof body==='string','PORTAL_AUDIT_BODY_REJECTED');
 current.body_hash=digest(body);return[...base,previous];
}
export const PORTAL_AUDIT_SQL=Object.freeze({version:`SELECT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='billing-portal-v1-0007') AS portal_contract_installed`});
export function portalAuditCheckPlan(target,options,scripts=loadPortalAuditScripts()){
 return billingAuditCheckPlan(target,options).map(([key,sql,args])=>{
  if(key==='originalFunctions')return[key,sql,[JSON.stringify(portalAuditFunctionContracts(target,scripts))]];
  if(key==='billingAuditParserAcl')return[key,sql.replace("'parse_event','parse_event_before_billing'","'parse_event','parse_event_before_billing','parse_event_before_portal'"),args];
  return[key,sql,args];
 }).concat([['portalAuditVersion',PORTAL_AUDIT_SQL.version,[]]]);
}
export async function verifyPortalAuditRuntime(client,target,options,scripts=loadPortalAuditScripts()){
 const plan=portalAuditCheckPlan(target,options,scripts);
 return readonly(client,async()=>{const checks={};for(const[key,sql,args]of plan)checks[key]=requireBooleans(await client.query(sql,args),'PORTAL_AUDIT_VERIFICATION_REJECTED');return{profile:`billing-portal-audit-${target}`,checks};});
}
