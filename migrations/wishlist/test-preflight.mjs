// Synthetic adapters only: no private files, network, database or receipts.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {admission,preflight,APPROVED_SOURCE,SOURCE_METADATA_SQL,SCRIPT_PINS,failureCode} from './preflight-approved.mjs';
import {BILLING_APPLICATION_READINESS_KEYS} from '../billing/application-readiness.mjs';
let checks=0;const check=fn=>{fn();checks++;};
const flag='--preflight-approved-source='+APPROVED_SOURCE;
check(()=>assert.doesNotThrow(()=>admission([flag])));
for(const args of [[],['--preflight-approved-source=other'],[flag,flag],[flag,'--backup-waived=TASK-037-2026-11-02'],['--apply-approved-source='+APPROVED_SOURCE]])check(()=>assert.throws(()=>admission(args)));
for(const pin of SCRIPT_PINS){const text=await readFile(new URL('./'+pin.name,import.meta.url),'utf8');check(()=>assert.equal(createHash('sha256').update(text).digest('hex'),pin.sha256));}
const canary='SYNTHETIC_PRIVATE_TOKEN_DO_NOT_EMIT';let getters=0;
const hostile={};Object.defineProperties(hostile,{safeCode:{get(){getters++;throw new Error(canary);}},code:{get(){getters++;throw new Error(canary);}},checks:{get(){getters++;return [canary];}}});
check(()=>assert.equal(failureCode(hostile),'TASK042_UNCLASSIFIED_FAILURE'));
check(()=>assert.equal(getters,0));
check(()=>assert.equal(failureCode({safeCode:canary,code:canary}),'TASK042_UNCLASSIFIED_FAILURE'));
check(()=>assert.equal(failureCode({code:'28P01'}),'28P01'));
function fixture(options={}){
 const calls=[],emitted=[],saved=[];let receiptExists=false;
 const clean=Object.fromEntries(BILLING_APPLICATION_READINESS_KEYS.map(key=>[key,true]));
 const metadata={expected_principal:true,expected_database:true,expected_version:true,read_only:true,public_table_count:35,wishlist_tables_absent:true,archive_mode:'on',archive_command_configured:true,backup_function_present:true,other_application_connections:0};
 function step(name){calls.push(name);if(options.fail===name)throw options.error??hostile;}
 const deps={
  async pins(){step('pins');},async create(value){step('create');receiptExists=true;saved.push(structuredClone(value));},async save(value){step('save');saved.push(structuredClone(value));},
  async prepare(){step('prepare');return {appValue:'synthetic-app',ownerValue:'synthetic-owner',appCA:{},ownerCA:{}};},
  async client(value,target,ca,principal){check(()=>assert.equal(target,'source'));step('client:'+principal);return {principal,async query(sql){
   const operation=sql==='BEGIN TRANSACTION READ ONLY'?'begin':sql==='COMMIT'?'commit':principal==='fmt_app_dev'?'readiness':'metadata';
   step(principal+':'+operation);
   if(operation==='readiness')return {rows:options.readiness??[{...clean,...options.baseline}]};
   if(operation==='metadata')return {rows:options.metadataRows??[{...metadata,...options.metadata}]};
   return {rows:[],command:operation};
  },async end(){step(principal+':end');}};},
  async connect(x){step(x.principal+':connect');},emit(value){emitted.push(value);},
 };
 return {deps,calls,emitted,saved,get receiptExists(){return receiptExists;}};
}
const valid=fixture();const result=await preflight([flag],valid.deps);
check(()=>assert.equal(result.safeCode,'TASK042_RECOVERABLE_BACKUP_NOT_VERIFIED'));
check(()=>assert.equal(result.stage,'verified_recovery_gate'));
check(()=>assert.equal(result.receipt.scripts.every(script=>!script.attempted&&!script.committed),true));
check(()=>assert.equal(result.receipt.sourceMetadata.public_table_count,35));
check(()=>assert.equal(result.receipt.backupVerified,false));
check(()=>assert.equal(result.receipt.recovery.priorTaskWaiverReusable,false));
check(()=>assert.equal(valid.calls.filter(call=>call.endsWith(':connect')).length,2));
check(()=>assert.equal(valid.calls.filter(call=>call.endsWith(':begin')).length,2));
check(()=>assert.equal(valid.calls.filter(call=>call.endsWith(':commit')).length,2));
check(()=>assert.doesNotMatch(JSON.stringify(valid.saved),new RegExp(canary)));
for(const fail of ['pins','create','prepare','client:fmt_app_dev','fmt_app_dev:connect','fmt_app_dev:begin','fmt_app_dev:readiness','fmt_app_dev:commit','client:postgres','postgres:connect','postgres:begin','postgres:metadata','postgres:commit']){
 const f=fixture({fail}),r=await preflight([flag],f.deps);
 check(()=>assert.equal(r.passed,false,fail));
 check(()=>assert.equal(f.calls.filter(call=>call===fail).length,1,'single attempt '+fail));
 check(()=>assert.doesNotMatch(JSON.stringify({emitted:f.emitted,saved:f.saved}),new RegExp(canary)));
 const failedIndex=f.calls.indexOf(fail);
 check(()=>assert.equal(f.calls.slice(failedIndex+1).every(call=>call==='save'||call.endsWith(':end')),true,'no further work after '+fail));
}
for(const options of [{baseline:{required_dml:false}},{readiness:[]},{readiness:[{extra:canary}]},{metadata:{public_table_count:40}},{metadata:{wishlist_tables_absent:false}},{metadata:{archive_mode:canary}},{metadataRows:[]},{metadata:{expected_principal:false}}]){
 const f=fixture(options),r=await preflight([flag],f.deps);
 check(()=>assert.equal(r.passed,false));
 check(()=>assert.notEqual(r.stage,'verified_recovery_gate','stop before recovery if prior gate fails'));
 check(()=>assert.doesNotMatch(JSON.stringify({emitted:f.emitted,saved:f.saved}),new RegExp(canary)));
 check(()=>assert.equal(r.receipt?.ddlAttempted,false));
}
const text=await readFile(new URL('./preflight-approved.mjs',import.meta.url),'utf8');
check(()=>assert.doesNotMatch(SOURCE_METADATA_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|pg_backup_start\s*\()\b/i));
check(()=>assert.doesNotMatch(text,/privateWrite|replaceSettings|readiness40|\.env\.audit-worker|\.env\.audit-test|TARGETS\.destination/));
check(()=>assert.match(text,/flag:'wx'/));
check(()=>assert.match(text,/No unverified JSON assertion/));
console.log(`Passed ${checks} synthetic TASK-042 preflight target/stop/redaction/recovery-gate checks; no private files, receipts or connected operations.`);
