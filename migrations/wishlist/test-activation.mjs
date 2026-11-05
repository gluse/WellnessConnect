// Synthetic adapters; no private files, real receipts, DB or network access.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {admission,activate,WAIVER,PREFLIGHT_RECEIPT_PIN} from './activate-approved.mjs';
import {APPROVED_SOURCE,SCRIPT_PINS,SOURCE_METADATA_SQL} from './preflight-approved.mjs';
import {BILLING_APPLICATION_READINESS_SQL,BILLING_APPLICATION_READINESS_KEYS} from '../billing/application-readiness.mjs';
import {WISHLIST_APPLICATION_READINESS_SQL,WISHLIST_APPLICATION_READINESS_KEYS} from './application-readiness.mjs';
let checks=0;const check=fn=>{fn();checks++;};
const flags=['--apply-approved-source='+APPROVED_SOURCE,'--backup-waived='+WAIVER];
check(()=>assert.doesNotThrow(()=>admission(flags)));
for(const args of [[],[flags[0]],[flags[1]],[flags[0],'--backup-waived=TASK-037-2026-11-02'],['--apply-approved-source=other',flags[1]],[...flags,'--retry'],[flags[0],flags[0]]])check(()=>assert.throws(()=>admission(args)));
const hash=text=>createHash('sha256').update(text).digest('hex');
const priorReceipt=await readFile(new URL('./source-preflight-receipt.json',import.meta.url),'utf8');
check(()=>assert.equal(hash(priorReceipt),PREFLIGHT_RECEIPT_PIN));
for(const pin of SCRIPT_PINS){const text=await readFile(new URL('./'+pin.name,import.meta.url),'utf8');check(()=>assert.equal(hash(text),pin.sha256));}
const canary='SYNTHETIC_SECRET_MUST_NOT_LEAK';let getters=0;const hostile={};
for(const key of ['safeCode','code','checks','message'])Object.defineProperty(hostile,key,{get(){getters++;throw new Error(canary);}});
function fixture(options={}){
 const calls=[],saved=[],emitted=[];let appConnections=0;
 const baseline=Object.fromEntries(BILLING_APPLICATION_READINESS_KEYS.map(key=>[key,true]));
 const postflight=Object.fromEntries(WISHLIST_APPLICATION_READINESS_KEYS.map(key=>[key,true]));
 const metadata={expected_principal:true,expected_database:true,expected_version:true,read_only:true,public_table_count:35,wishlist_tables_absent:true,archive_mode:'on',archive_command_configured:true,backup_function_present:true,other_application_connections:0};
 function step(name){calls.push(name);if(options.fail===name)throw options.error??hostile;}
 const deps={
  async scripts(){step('scripts');return SCRIPT_PINS.map((pin,index)=>({...pin,text:pin.name,flag:index===0?'wishlist_expansion_created':'wishlist_runtime_created'}));},
  async create(value){step('create');saved.push(structuredClone(value));},
  async save(value){step('save:'+value.stage);saved.push(structuredClone(value));},
  async prepare(){step('prepare');return {appValue:'synthetic-app',ownerValue:'synthetic-owner',appCA:{},ownerCA:{}};},
  async client(value,target,ca,principal){check(()=>assert.equal(target,'source'));step('client:'+principal);const tag=principal==='fmt_app_dev'?(++appConnections===1?'app35':'app40'):'owner';
   return {tag,async query(query){let operation;if(typeof query==='object')operation=query.text;else operation=query==='BEGIN TRANSACTION READ ONLY'?'begin':query==='COMMIT'?'commit':query===SOURCE_METADATA_SQL?'metadata':query===BILLING_APPLICATION_READINESS_SQL?'baseline':query===WISHLIST_APPLICATION_READINESS_SQL?'postflight':'unknown';
    step(tag+':'+operation);
    if(operation==='baseline')return {rows:options.baselineRows??[{...baseline,...options.baseline}]};
    if(operation==='postflight')return {rows:options.postflightRows??[{...postflight,...options.postflight}]};
    if(operation==='metadata')return {rows:[{...metadata,...options.metadata}]};
    if(operation.startsWith('0018')||operation.startsWith('0019'))return [{rows:[{[operation.startsWith('0018')?'wishlist_expansion_created':'wishlist_runtime_created']:true}]},{command:options.badCommit===operation?'ROLLBACK':'COMMIT',rows:[]}];
    return {command:operation,rows:[]};
   },async end(){step(tag+':end');}};
  },async connect(x){step(x.tag+':connect');},emit(value){emitted.push(value);},
 };
 return {deps,calls,saved,emitted};
}
const success=fixture(),completed=await activate(flags,success.deps);
check(()=>assert.equal(completed.passed,true));
check(()=>assert.equal(completed.receipt.state,'verified'));
check(()=>assert.equal(completed.receipt.backup.verified,false));
check(()=>assert.equal(completed.receipt.backup.selection,WAIVER));
check(()=>assert.equal(completed.receipt.scripts.every(script=>script.attempted&&script.committed),true));
check(()=>assert.equal(Object.keys(completed.receipt.verification).length,26));
for(const name of ['owner:0018_wishlist.sql','owner:0019_wishlist_runtime.sql'])check(()=>assert.equal(success.calls.filter(call=>call===name).length,1));
check(()=>assert.ok(success.calls.indexOf('owner:metadata')<success.calls.indexOf('owner:0018_wishlist.sql')));
check(()=>assert.ok(success.calls.indexOf('owner:0019_wishlist_runtime.sql')<success.calls.indexOf('app40:postflight')));
for(const fail of ['scripts','create','prepare','app35:connect','app35:begin','app35:baseline','app35:commit','app35:end','owner:connect','owner:begin','owner:metadata','owner:commit','owner:0018_wishlist.sql','owner:0019_wishlist_runtime.sql','owner:end','app40:connect','app40:begin','app40:postflight','app40:commit','app40:end']){
 const f=fixture({fail}),r=await activate(flags,f.deps);
 check(()=>assert.equal(r.passed,false,fail));
 check(()=>assert.equal(f.calls.filter(call=>call===fail).length,1,'single attempt '+fail));
 check(()=>assert.doesNotMatch(JSON.stringify({saved:f.saved,emitted:f.emitted}),new RegExp(canary)));
 const failure=f.calls.indexOf(fail);
 check(()=>assert.equal(f.calls.slice(failure+1).every(call=>call.startsWith('save:')||call.endsWith(':end')),true,'no later query after '+fail));
 if(fail==='owner:0018_wishlist.sql'){check(()=>assert.equal(r.receipt.commitOutcomeUnknown,true));check(()=>assert.equal(r.receipt.scripts[1].attempted,false));}
 if(fail==='owner:0019_wishlist_runtime.sql'){check(()=>assert.equal(r.receipt.commitOutcomeUnknown,true));check(()=>assert.equal(r.receipt.scripts[0].committed,true));}
 if(fail.startsWith('app40:'))check(()=>assert.equal(r.receipt.scripts.every(script=>script.committed),true));
}
check(()=>assert.equal(getters,0));
for(const options of [{baseline:{required_dml:false}},{baselineRows:[]},{metadata:{public_table_count:40}},{metadata:{wishlist_tables_absent:false}},{metadata:{other_application_connections:1}},{metadata:{archive_mode:canary}},{postflight:{wishlist_constraints:false}},{postflightRows:[{extra:canary}]}]){
 const f=fixture(options),r=await activate(flags,f.deps);
 check(()=>assert.equal(r.passed,false));check(()=>assert.doesNotMatch(JSON.stringify({saved:f.saved,emitted:f.emitted}),new RegExp(canary)));
 if(!options.postflight&&!options.postflightRows)check(()=>assert.equal(f.calls.some(call=>call.includes('0018')||call.includes('0019')),false));
}
for(const badCommit of ['0018_wishlist.sql','0019_wishlist_runtime.sql']){
 const f=fixture({badCommit}),r=await activate(flags,f.deps);check(()=>assert.equal(r.safeCode,'TASK042_COMMIT_NOT_CONFIRMED'));check(()=>assert.equal(r.receipt.commitOutcomeUnknown,true));
 if(badCommit==='0018_wishlist.sql')check(()=>assert.equal(r.receipt.scripts[1].attempted,false));
}
const failedSave=fixture({fail:'save:0018_wishlist.sql'}),saveResult=await activate(flags,failedSave.deps);
check(()=>assert.equal(saveResult.safeCode,'TASK042_RECEIPT_SAVE_FAILED'));
check(()=>assert.equal(failedSave.calls.filter(call=>call==='save:0018_wishlist.sql').length,1));
check(()=>assert.equal(failedSave.calls.some(call=>call==='owner:0018_wishlist.sql'),false));
check(()=>assert.equal(saveResult.receipt.commitOutcomeUnknown,false));
const source=await readFile(new URL('./activate-approved.mjs',import.meta.url),'utf8');
check(()=>assert.match(source,/flag:'wx'/));
check(()=>assert.doesNotMatch(source,/privateWrite|replaceSettings|TARGETS\.destination|\.env\.audit-worker|\.env\.audit-test|pg_dump|pg_backup_start\(/));
const priorReceiptAfter=await readFile(new URL('./source-preflight-receipt.json',import.meta.url),'utf8');
check(()=>assert.equal(hash(priorReceiptAfter),PREFLIGHT_RECEIPT_PIN,'historical receipt unchanged'));
console.log(`Passed ${checks} synthetic TASK-042 activation target/waiver/pins/stop/commit-uncertainty/redaction/readiness checks. No private files, real receipts or connections.`);
