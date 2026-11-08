// Mocked one-shot executor boundary only: no settings, network, DB, SQL execution.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execute, admission, authorize, TARGET, DESTINATION, EXECUTOR, MIGRATION_SHA256, REVIEWED_EXECUTION_APPROVAL, REVIEWED_RECOVERY, SOURCE_METADATA_SQL, FINGERPRINT_SQL, POSTFLIGHT_SQL, DESTINATION_READINESS_SQL, AUDIT_HEALTH_SQL } from './execute-approved.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL as BASE_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS as BASE_KEYS } from '../workspace-pricing/application-readiness.mjs';
import { CURRENCY_READINESS_SQL } from '../currencies/application-readiness.mjs';
import { SERVICE_PHOTO_READINESS_SQL } from './application-readiness.mjs';
const args=['--apply-approved-source='+TARGET,'--approval=TASK-048'];
assert.equal(REVIEWED_EXECUTION_APPROVAL.task,'TASK-048');assert.equal(REVIEWED_EXECUTION_APPROVAL.executor,EXECUTOR);
assert.equal(REVIEWED_RECOVERY.task,'TASK-048');assert.equal(REVIEWED_RECOVERY.project,TARGET);assert.equal(authorize().backupWaived,true);
assert.throws(()=>authorize(null,null),/TASK048_NEW_EXECUTION_APPROVAL_REQUIRED/);
for(const invalid of [[],[args[0]],['--apply-approved-source=wrong',args[1]],[args[0],'--approval=TASK-044'],[...args,'--retry']])assert.throws(()=>admission(invalid));
admission(args);
const approval={task:'TASK-048',executor:EXECUTOR,source:TARGET,destination:DESTINATION,localRecord:'synthetic-approval',privateConfigRead:true,sourceMigration:true,auditReadOnly:true};
const recovery={task:'TASK-048',project:TARGET,localRecord:'synthetic-recovery',backupWaived:true,explicitUserWaiver:true};
assert.equal(authorize(approval,recovery).backupWaived,true);
for(const invalid of [{...approval,executor:'/root/currency_db'},{...approval,source:DESTINATION},{...approval,auditReadOnly:false}])assert.throws(()=>authorize(invalid,recovery));
for(const invalid of [{...recovery,task:'TASK-044'},{...recovery,explicitUserWaiver:false},{...recovery,backupWaived:false}])assert.throws(()=>authorize(approval,invalid));
assert.equal(authorize(approval,{task:'TASK-048',project:TARGET,localRecord:'synthetic-verified',verifiedRecoverable:true,evidenceSha256:'a'.repeat(64),verifiedAt:new Date().toISOString()}).backupWaived,false);
const actual=await readFile(new URL('./0022_service_photos.sql',import.meta.url));
assert.equal(createHash('sha256').update(actual).digest('hex'),MIGRATION_SHA256);
assert.ok(SOURCE_METADATA_SQL.includes("'fmt_audit_worker_dev','fmt_audit_capture_dev'"),'Preflight refuses an independently running audit worker/capture connection after closing its own health client');
const meta={identity:true,database:true,version:true,read_only:true,gallery_absent:true,trigger_enabled:true,table_count:41,service_count:27,booking_count:32,legacy_image_count:3,other_writers:0};
const post={service_count:27,booking_count:32,image_count:3,exact_backfill:true,trigger_enabled:true};
function fixture(options={}){
 const state={prepares:0,submissions:0,fingerprints:0,health:0,outputs:[],receipts:[],queries:[]};
 const deps={authorize:()=>authorize(approval,recovery),async script(){return 'PINNED_0022';},async create(value){if(options.receiptExists)throw new Error('private://secret');state.receipts.push(structuredClone(value));},async save(value){state.receipts.push(structuredClone(value));},
 async prepare(){state.prepares++;return{appValue:'app',ownerValue:'owner',workerValue:'worker',destinationValue:'destination',appCA:{},ownerCA:{},workerCA:{},destinationCA:{}};},async connect(){},
 async client(){return{async query(text,values){state.queries.push({text,values});
  if(typeof text==='object'){state.submissions++;assert.equal(text.text,'PINNED_0022');assert.equal(text.query_timeout,125000);if(options.failMigration)throw Object.assign(new Error('private://secret@target'),{code:'57014'});return [{command:'UPDATE',rowCount:3},{command:'SELECT',rows:[{legacy_images_backfilled:3}]},{command:options.noCommit?'ROLLBACK':'COMMIT'}];}
  if(text===BASE_SQL)return{rows:[Object.fromEntries(BASE_KEYS.map(key=>[key,options.baselineFailure&&key===BASE_KEYS[0]?false:true]))]};
  if(text===CURRENCY_READINESS_SQL)return{rows:[{currency_columns:true,currency_constraints:true}]};
  if(text===SERVICE_PHOTO_READINESS_SQL)return{rows:[{service_photo_column:true,service_photo_constraints:!options.galleryFailure}]};
  if(text===SOURCE_METADATA_SQL)return{rows:[{...meta,...options.metadata}]};
  if(text===DESTINATION_READINESS_SQL)return{rows:[{identity:true,read_only:true,writer_capability:true,no_base_access:true,parser_current:!options.destinationFailure}]};
  if(text===FINGERPRINT_SQL){state.fingerprints++;return{rows:[{services:(options.changed&&state.fingerprints>1?'b':'a').repeat(32),bookings:'c'.repeat(32)}]};}
  if(text===POSTFLIGHT_SQL)return{rows:[{...post,...options.post}]};
  if(text===AUDIT_HEALTH_SQL){state.health++;return{rows:state.health===1?(options.backlog?[{status:'pending',event_count:1,expired_count:0}]:[]):[{status:'pending',event_count:options.auditMismatch?2:3,expired_count:0}]};}
  assert.ok(['BEGIN TRANSACTION READ ONLY','COMMIT'].includes(text));return{rows:[]};},async end(){}};},emit(value){state.outputs.push(value);}};
 return{state,deps};
}
let {state,deps}=fixture(),result=await execute(args,deps);
assert.equal(result.passed,true);assert.equal(state.submissions,1);assert.equal(result.receipt.script.committed,true);assert.equal(result.receipt.existingServiceAndBookingFieldsPreserved,true);assert.equal(result.receipt.postflightChecks,36);assert.equal(result.receipt.auditBackfillEventsPending,3);
assert.ok(!JSON.stringify(result.receipt).includes('a'.repeat(32)),'Hashes stay in memory');
for(const [options,expected,submitted,committed] of [
 [{metadata:{other_writers:1}},'TASK048_ACTIVE_WRITERS',0,false],
 [{metadata:{gallery_absent:false}},'TASK048_SOURCE_BASELINE_CHANGED',0,false],
 [{metadata:{service_count:10001}},'TASK048_SOURCE_BASELINE_CHANGED',0,false],
 [{baselineFailure:true},'TASK048_BASELINE_NOT_READY',0,false],
 [{destinationFailure:true},'TASK048_DESTINATION_NOT_READY',0,false],
 [{backlog:true},'TASK048_AUDIT_BACKLOG_REQUIRES_REVIEW',0,false],
 [{failMigration:true},'57014',1,false],
 [{noCommit:true},'TASK048_COMMIT_NOT_CONFIRMED',1,false],
 [{changed:true},'TASK048_POSTFLIGHT_FAILED',1,true],
 [{post:{image_count:2}},'TASK048_POSTFLIGHT_FAILED',1,true],
 [{galleryFailure:true},'TASK048_GALLERY_NOT_READY',1,true],
 [{auditMismatch:true},'TASK048_POSTFLIGHT_FAILED',1,true],
 [{receiptExists:true},'TASK048_RECEIPT_EXISTS_OR_UNWRITABLE',0,false]
]){
 ({state,deps}=fixture(options));result=await execute(args,deps);assert.equal(result.passed,false);assert.equal(result.safeCode,expected);assert.equal(state.submissions,submitted);if(result.receipt){assert.equal(result.receipt.script.committed,committed);assert.equal(result.receipt.commitOutcomeUnknown,submitted===1&&!committed);}assert.ok(!JSON.stringify(state).includes('secret'));
}
({state,deps}=fixture());result=await execute(args,{...deps,authorize:()=>authorize(null,null)});assert.equal(result.safeCode,'TASK048_NEW_EXECUTION_APPROVAL_REQUIRED');assert.equal(state.prepares,0);assert.equal(state.receipts.length,0);
for(const [failure,expected] of [['WRONG_TARGET','WRONG_TARGET'],['PRIVATE_ACL_OR_IGNORE_FAILED','PRIVATE_ACL_OR_IGNORE_FAILED'],['private://secret','TASK048_UNCLASSIFIED_FAILURE']]){
 ({state,deps}=fixture());result=await execute(args,{...deps,prepare:async()=>{throw Object.assign(new Error('private://secret'),{safeCode:failure});}});assert.equal(result.safeCode,expected);assert.equal(state.submissions,0);assert.ok(!JSON.stringify(state).includes('secret'));
}
const inert=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',"await import('./migrations/service-photos/execute-approved.mjs');process.stdout.write('inert')"],{encoding:'utf8'});
assert.equal(inert.status,0,inert.stderr);assert.equal(inert.stdout,'inert');
console.log('PASS: exact TASK-048 approval/fresh no-backup waiver and unset-approval refusal, pinned migration, source/destination/empty-queue readiness, counts/field preservation, one submission, stop/no retry, uncertain commit and committed failure, redacted receipts and inert imports. Mocked adapters only.');
