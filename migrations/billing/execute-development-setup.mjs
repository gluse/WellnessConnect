// TASK-024 exact development-only setup. Import/offline never reads private inputs
// or connects. No app startup, fixtures, worker calls, Stripe or automatic retry.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ROOT,requireThat,safeCode,emit,privatePreflight,privateRead,readSettings,connection,trustedCA,client,connect} from '../audit/runtime-support.mjs';
import {activeCheckPlan} from '../audit/runtime-active-profile.mjs';
import {functionContracts as serviceContracts,SQL as SERVICE_SQL,RETENTION_NEW} from '../audit/execute-service-view.mjs';
import {readonly,requireBooleans,deterministicPrecommitError} from '../audit/execute-runtime-disabled.mjs';
import {billingCheckPlan,BILLING_SQL} from './runtime-profile.mjs';
import {billingV2CheckPlan} from './v2-runtime-profile.mjs';
import {loadBillingAuditScripts,billingAuditCheckPlan} from '../audit/billing-package.mjs';
import {loadPortalAuditScripts,portalAuditCheckPlan} from '../audit/billing-portal-package.mjs';
import {requireLocalQuiescence} from './local-quiescence.mjs';

export const PINS=Object.freeze({
 '0010_monthly_billing.sql':'8cef42902a4c7fe6d0a2a56e6b4393a0da040b422874eb54bbc3400bc5f28385',
 '0011_monthly_billing_runtime.sql':'f5bf16e8adb538cff19c613d569d123f85fdcc08a68b65425804aa0bacf3f4e5',
 '0012_monthly_billing_offers.sql':'ffd4c75021941a61b00d91f22c3d7c3f60fa613f452b54481a4eea0f0eed635e',
 '0013_monthly_billing_offers_runtime.sql':'550b1d011b85e36ae81a07657c844876245421bf110a426c3e9d3de09382ae10',
});
const RECEIPTS=['billing_dormant_expansion_created','billing_runtime_extension_created','billing_local_offers_created','billing_offer_runtime_created'];
const OPTIONS=Object.freeze({testAccess:'disabled',billingAccess:'runtime',offerAccess:'runtime'});
export const STAGES=Object.freeze([
 ...Object.keys(PINS).map((file,i)=>({target:'source',file,receipt:RECEIPTS[i],profile:['v1-dormant','v1-runtime','v2-dormant','v2-runtime'][i]})),
 ...['destination','source'].flatMap(target=>[
  {target,file:`0006_${target}_billing.sql`,receipt:'billing_audit_contract_created',profile:'billing'},
  {target,file:`0007_${target}_billing_portal.sql`,receipt:'billing_portal_audit_contract_created',profile:'portal'},
 ]),
]);
export function loadScripts(){
 const scripts=new Map();
 for(const[file,pin]of Object.entries(PINS)){
  const bytes=fs.readFileSync(path.join(ROOT,'migrations',file));
  requireThat(createHash('sha256').update(bytes).digest('hex')===pin,'BILLING_MIGRATION_PIN_REJECTED');
  const sql=bytes.toString('utf8');
  requireThat((sql.match(/^BEGIN;$/gm)||[]).length===1&&(sql.match(/^COMMIT;$/gm)||[]).length===1&&!/^\s*\\/m.test(sql),'BILLING_TRANSACTION_REJECTED');
  scripts.set(file,sql);
 }
 for(const[target,sql]of loadBillingAuditScripts())scripts.set(`0006_${target}_billing.sql`,sql);
 for(const[target,sql]of loadPortalAuditScripts())scripts.set(`0007_${target}_billing_portal.sql`,sql);
 return scripts;
}
export function selectedSettings(text,names){
 return readSettings(text.split(/\r?\n/).filter(line=>names.some(name=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line))).join('\n'));
}
function loadInputs(){
 const sid=privatePreflight();
 const setup=selectedSettings(privateRead('.env.audit-setup.local',sid),['AUDIT_SETUP_SOURCE_DATABASE_URL','AUDIT_SETUP_DESTINATION_DATABASE_URL']);
 const app=selectedSettings(privateRead('.env',sid),['DATABASE_URL','AUDIT_CAPTURE_DATABASE_URL','AUDIT_ENABLED','AUDIT_ENVIRONMENT']);
 const worker=selectedSettings(privateRead('.env.audit-worker.local',sid),['AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL','AUDIT_ENVIRONMENT']);
 requireThat(app.AUDIT_ENABLED==='true'&&app.AUDIT_ENVIRONMENT==='development'&&worker.AUDIT_ENVIRONMENT==='development','BILLING_RUNTIME_ENVIRONMENT_REJECTED');
 const urls={source:setup.AUDIT_SETUP_SOURCE_DATABASE_URL,destination:setup.AUDIT_SETUP_DESTINATION_DATABASE_URL};
 const parsed={source:connection(urls.source,'source'),destination:connection(urls.destination,'destination')};
 const cas={source:trustedCA(parsed.source)};
 cas.destination=parsed.destination.u.searchParams.has('sslrootcert')?trustedCA(parsed.destination):cas.source;
 const probes=[['app','source','fmt_app_dev',app.DATABASE_URL],['capture','source','fmt_audit_capture_dev',app.AUDIT_CAPTURE_DATABASE_URL],
  ['worker','source','fmt_audit_worker_dev',worker.AUDIT_SOURCE_DATABASE_URL],['writer','destination','fmt_audit_writer_dev',worker.AUDIT_DATABASE_URL]];
 for(const[,target,role,url]of probes){const p=connection(url,target,role);if(p.u.searchParams.has('sslrootcert'))trustedCA(p);}
 return{urls,cas,probes};
}
const ACTIVITY_SQL=`SELECT count(*)=0 AS runtime_connections_absent FROM pg_catalog.pg_stat_activity
 WHERE pid<>pg_backend_pid() AND (usename=ANY($1::text[]) OR application_name ~* '(fitsmytime.*(?:worker|billing)|audit-worker|billing-worker)')`;
const MEMBERS_SQL=`SELECT r.rolname,m.roleid,m.member,m.grantor,m.admin_option,m.inherit_option,m.set_option
 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
 WHERE r.rolname IN('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_destination_owner','fm_audit_rehearsal_owner')
 AND m.member=current_user::regrole ORDER BY r.rolname,m.grantor`;
async function verifyPlan(x,target,profile){
 let plan;
 if(profile==='baseline')plan=activeCheckPlan(target,{testAccess:'disabled'});
 else if(profile.startsWith('v1-'))plan=billingCheckPlan({...OPTIONS,billingAccess:profile==='v1-runtime'?'runtime':'dormant'});
 else if(profile.startsWith('v2-'))plan=billingV2CheckPlan({...OPTIONS,offerAccess:profile==='v2-runtime'?'runtime':'dormant'});
 else plan=profile==='portal'?portalAuditCheckPlan(target,OPTIONS):billingAuditCheckPlan(target,OPTIONS);
 return readonly(x,async()=>{
  await x.query("SET LOCAL intervalstyle='postgres'");
  const counts={groups:0,booleans:0};
  for(const[key,sql,args]of plan){
   // Private ledgers are deliberately inaccessible to the inert setup principal.
   // Each migration checks/writes its exact ledger version under the temporary
   // contract owner before COMMIT; receipt plus pinned parser catalogs verify it.
   if(key==='billingAuditVersion'||key==='portalAuditVersion')continue;
   const values=key==='originalFunctions'&&!['billing','portal'].includes(profile)?[JSON.stringify(serviceContracts(target))]:args;
   const result=await x.query(sql,values);
   const row=result.rows[0];
   requireThat(result.rows.length===1&&row&&Object.keys(row).length>0&&Object.values(row).every(v=>v===true),`PROFILE_${key.toUpperCase()}_REJECTED`);
   counts.groups++;counts.booleans+=Object.keys(row).length;
  }
  if(profile==='baseline'||profile.startsWith('v')){
   const [schema,table]=target==='source'?['audit_capture','audit_outbox']:['audit','events'];
   requireBooleans(await x.query(SERVICE_SQL.owners,[['fm_audit_contract_owner',`fm_audit_${target}_owner`]]),'AUDIT_OWNERS_REJECTED');
   requireBooleans(await x.query(SERVICE_SQL.retention,[schema,table,true,RETENTION_NEW,'unused','unused']),'AUDIT_RETENTION_REJECTED');
  }
  return counts;
 });
}
export function confirmCommit(result,receipt){
 const list=Array.isArray(result)?result:[result];
 requireThat(list.at(-1)?.command==='COMMIT','BILLING_COMMIT_UNCERTAIN');
 const receipts=list.filter(r=>r.fields?.length===1&&r.fields[0].name===receipt);
 requireThat(receipts.length===1&&receipts[0].rows.length===1&&receipts[0].rows[0][receipt]===true,'BILLING_COMMIT_RECEIPT_REJECTED');
}
export async function executeStages({clients,scripts=loadScripts(),verify=verifyPlan,onEvent=()=>{}}){
 const commits=[];let stage;
 try{
  for(stage of STAGES){
   const x=clients[stage.target];let outcome='uncertain';
   try{
    const result=await x.query({text:scripts.get(stage.file),query_timeout:180000});
    if((Array.isArray(result)?result:[result]).at(-1)?.command==='COMMIT')outcome='committed';
    confirmCommit(result,stage.receipt);commits.push(stage.file);
   }catch(e){
    if(outcome!=='committed')try{const r=await x.query('ROLLBACK');if(r.command==='ROLLBACK'&&deterministicPrecommitError(e))outcome='rolled-back';}catch{}
    onEvent({stage:stage.file,target:stage.target,status:'stopped',outcome,commits:[...commits],code:safeCode(e),automaticRetry:false});throw e;
   }
   const counts=await verify(x,stage.target,stage.profile);
   onEvent({stage:stage.file,target:stage.target,status:'committed-and-verified',...counts});
  }
  return commits;
 }catch(e){e.confirmedCommits=[...commits];e.stoppedStage=stage?.file;throw e;}
}
async function main(){
 requireThat(process.argv.length===3&&['offline','apply-development-without-backup'].includes(process.argv[2]),'BILLING_SETUP_MODE_REJECTED');
 const scripts=loadScripts();
 if(process.argv[2]==='offline'){emit('billing-setup-offline',{status:'passed',stages:STAGES.map(s=>s.file),privateAccess:false,databaseAccess:false});return;}
 requireLocalQuiescence(e=>emit('billing-local-quiescence',e));
 const inputs=loadInputs(),xs={},before={};let connectedStage='owner-preflight',confirmedCommits=[];
 try{
  for(const target of ['source','destination']){
   const x=xs[target]=await client(inputs.urls[target],target,inputs.cas[target]);await connect(x);
   requireBooleans(await x.query(ACTIVITY_SQL,[['fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','fmt_audit_writer_dev']]),'CONNECTED_PRODUCER_OR_WORKER_NOT_ABSENT');
   const counts=await verifyPlan(x,target,'baseline');
   before[target]=(await x.query(MEMBERS_SQL)).rows;
   emit('billing-setup-preflight',{target,status:'passed',tlsVerified:true,...counts});
  }
  connectedStage='migrations';
  confirmedCommits=await executeStages({clients:xs,scripts,onEvent:e=>emit('billing-setup-stage',e)});
  connectedStage='memberships';
  for(const target of ['source','destination'])requireThat(JSON.stringify((await xs[target].query(MEMBERS_SQL)).rows)===JSON.stringify(before[target]),'EXACT_SETUP_MEMBERSHIPS_NOT_RESTORED');
  connectedStage='restricted-probes';
  for(const[name,target,role,url]of inputs.probes){let x;
   try{
    x=await client(url,target,inputs.cas[target],role);await connect(x);
    requireBooleans(await x.query(`SELECT current_user=session_user AND current_user=$1 AS exact_principal,
     current_setting('server_version_num')::integer/10000=17 AND current_setting('server_encoding')='UTF8' AS version_encoding,
     current_setting('transaction_read_only')='on' AS read_only,
     NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS restricted
     FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`,[role]),'RESTRICTED_ROLE_PROBE_REJECTED');
    if(name==='app'){
     const {verifyBillingDatabaseReadiness}=await import('../../server/billing/database-readiness.ts');
     await verifyBillingDatabaseReadiness((text,values)=>x.query(text,values));
    }
    emit('billing-setup-role',{role,status:'passed',tlsVerified:true,readOnly:true});
   }finally{if(x)await x.end();}
  }
  emit('billing-setup-complete',{status:'passed',confirmedCommits:STAGES.map(s=>s.file),backupException:true,fixtures:false,applicationStarted:false});
 }catch(e){emit('billing-setup-stopped',{stage:connectedStage,code:safeCode(e),...(e.stoppedStage?{file:e.stoppedStage}:{}),confirmedCommits:e.confirmedCommits??confirmedCommits,automaticRetry:false});process.exitCode=1;}
 finally{for(const x of Object.values(xs))try{await x.end();}catch{}}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{await main();}catch(e){emit('billing-setup-stopped',{code:safeCode(e),automaticRetry:false});process.exitCode=1;}}
