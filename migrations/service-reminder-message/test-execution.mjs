// Mocked/injected execution only. No private configuration, DB or SQL execution.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { execute, admission, authorize, TARGET, EXECUTOR, MIGRATION_SHA256, REVIEWED_EXECUTION_APPROVAL, REVIEWED_RECOVERY, SOURCE_METADATA_SQL, FINGERPRINT_SQL, POSTFLIGHT_SQL } from './execute-approved.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL as BASE_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS as BASE_KEYS } from '../workspace-pricing/application-readiness.mjs';
import { CURRENCY_READINESS_SQL } from '../currencies/application-readiness.mjs';
import { SERVICE_PHOTO_READINESS_SQL } from '../service-photos/application-readiness.mjs';
import { SERVICE_REMINDER_MESSAGE_READINESS_SQL } from './application-readiness.mjs';
const args=['--apply-approved-source='+TARGET,'--approval=TASK-049'];
assert.equal(REVIEWED_EXECUTION_APPROVAL.task,'TASK-049');assert.equal(REVIEWED_EXECUTION_APPROVAL.executor,EXECUTOR);
assert.equal(REVIEWED_RECOVERY.task,'TASK-049');assert.equal(REVIEWED_RECOVERY.project,TARGET);assert.equal(authorize().backupWaived,true);
assert.throws(()=>authorize(null,null),/TASK049_NEW_EXECUTION_APPROVAL_REQUIRED/);
for(const invalid of [[],[args[0]],['--apply-approved-source=wrong',args[1]],[args[0],'--approval=TASK-048'],[...args,'--retry']])assert.throws(()=>admission(invalid));
admission(args);
const approval={task:'TASK-049',executor:EXECUTOR,source:TARGET,localRecord:'synthetic-approval',privateConfigRead:true,sourceMigration:true,sourceReadOnlyChecks:true};
const recovery={task:'TASK-049',project:TARGET,localRecord:'synthetic-recovery',backupWaived:true,explicitUserWaiver:true};
assert.equal(authorize(approval,recovery).backupWaived,true);
for(const invalid of [{...approval,executor:'/root/service_photos_database'},{...approval,source:'wrong'},{...approval,sourceReadOnlyChecks:false}])assert.throws(()=>authorize(invalid,recovery));
for(const invalid of [{...recovery,task:'TASK-048'},{...recovery,explicitUserWaiver:false},{...recovery,backupWaived:false}])assert.throws(()=>authorize(approval,invalid));
assert.equal(authorize(approval,{task:'TASK-049',project:TARGET,localRecord:'synthetic-verified',verifiedRecoverable:true,evidenceSha256:'a'.repeat(64),verifiedAt:new Date().toISOString()}).backupWaived,false);
assert.throws(()=>authorize(approval,{task:'TASK-049',project:TARGET,localRecord:'synthetic-old',verifiedRecoverable:true,evidenceSha256:'a'.repeat(64),verifiedAt:'2020-01-01'}));
const actual=await readFile(new URL('./0023_service_reminder_message.sql',import.meta.url));
assert.equal(createHash('sha256').update(actual).digest('hex'),MIGRATION_SHA256);
assert.ok(SOURCE_METADATA_SQL.includes("'fmt_audit_worker_dev','fmt_audit_capture_dev'"));
const meta={identity:true,database:true,version:true,read_only:true,message_absent:true,trigger_enabled:true,table_count:41,service_count:28,booking_count:36,other_writers:0};
const post={service_count:28,booking_count:36,messages_empty:true,trigger_enabled:true};
function fixture(options={}){
 const state={prepares:0,submissions:0,fingerprints:0,outputs:[],receipts:[],queries:[]};
 const deps={authorize:()=>authorize(approval,recovery),async script(){return 'PINNED_0023';},async create(value){if(options.receiptExists)throw new Error('private://secret');state.receipts.push(structuredClone(value));},async save(value){state.receipts.push(structuredClone(value));},
 async prepare(){state.prepares++;return{appValue:'app',ownerValue:'owner',appCA:{},ownerCA:{}};},async connect(){},
 async client(){return{async query(text,values){state.queries.push({text,values});
  if(typeof text==='object'){state.submissions++;assert.equal(text.text,'PINNED_0023');assert.equal(text.query_timeout,125000);if(options.failMigration)throw Object.assign(new Error('private://secret@target'),{code:'57014'});return[{command:options.noCommit?'ROLLBACK':'COMMIT'}];}
  if(text===BASE_SQL)return{rows:[Object.fromEntries(BASE_KEYS.map(key=>[key,options.baselineFailure&&key===BASE_KEYS[0]?false:true]))]};
  if(text===CURRENCY_READINESS_SQL)return{rows:[{currency_columns:true,currency_constraints:true}]};
  if(text===SERVICE_PHOTO_READINESS_SQL)return{rows:[{service_photo_column:true,service_photo_constraints:true}]};
  if(text===SERVICE_REMINDER_MESSAGE_READINESS_SQL)return{rows:[{service_reminder_message_column:true,service_reminder_message_constraint:!options.messageFailure}]};
  if(text===SOURCE_METADATA_SQL)return{rows:[{...meta,...options.metadata}]};
  if(text===FINGERPRINT_SQL){state.fingerprints++;return{rows:[{services:(options.changed&&state.fingerprints>1?'b':'a').repeat(32),bookings:'c'.repeat(32)}]};}
  if(text===POSTFLIGHT_SQL)return{rows:[{...post,...options.post}]};
  assert.ok(['BEGIN TRANSACTION READ ONLY','COMMIT'].includes(text));return{rows:[]};},async end(){}};},emit(value){state.outputs.push(value);}};
 return{state,deps};
}
let {state,deps}=fixture(),result=await execute(args,deps);
assert.equal(result.passed,true);assert.equal(state.submissions,1);assert.equal(result.receipt.script.committed,true);assert.equal(result.receipt.existingServiceAndBookingFieldsPreserved,true);
assert.ok(!JSON.stringify(result.receipt).includes('a'.repeat(32)),'Hashes stay in memory');
for(const [options,expected,submitted,committed] of [
 [{metadata:{other_writers:1}},'TASK049_ACTIVE_WRITERS',0,false],
 [{metadata:{message_absent:false}},'TASK049_SOURCE_BASELINE_CHANGED',0,false],
 [{metadata:{service_count:10001}},'TASK049_SOURCE_BASELINE_CHANGED',0,false],
 [{baselineFailure:true},'TASK049_BASELINE_NOT_READY',0,false],
 [{failMigration:true},'57014',1,false],
 [{noCommit:true},'TASK049_COMMIT_NOT_CONFIRMED',1,false],
 [{changed:true},'TASK049_POSTFLIGHT_FAILED',1,true],
 [{post:{messages_empty:false}},'TASK049_POSTFLIGHT_FAILED',1,true],
 [{post:{booking_count:35}},'TASK049_POSTFLIGHT_FAILED',1,true],
 [{messageFailure:true},'TASK049_MESSAGE_NOT_READY',1,true],
 [{receiptExists:true},'TASK049_RECEIPT_EXISTS_OR_UNWRITABLE',0,false]
]){
 ({state,deps}=fixture(options));result=await execute(args,deps);assert.equal(result.passed,false);assert.equal(result.safeCode,expected);assert.equal(state.submissions,submitted);if(result.receipt){assert.equal(result.receipt.script.committed,committed);assert.equal(result.receipt.commitOutcomeUnknown,submitted===1&&!committed);}assert.ok(!JSON.stringify(state).includes('secret'));
 if(options.receiptExists)assert.equal(state.prepares,0);
}
({state,deps}=fixture());result=await execute(args,{...deps,authorize:()=>authorize(null,null)});assert.equal(result.safeCode,'TASK049_NEW_EXECUTION_APPROVAL_REQUIRED');assert.equal(state.prepares,0);assert.equal(state.receipts.length,0);
({state,deps}=fixture());result=await execute(args,{...deps,script:async()=>{throw Object.assign(new Error('private://secret'),{safeCode:'TASK049_MIGRATION_CHANGED'});}});assert.equal(result.safeCode,'TASK049_MIGRATION_CHANGED');assert.equal(state.prepares,0);assert.equal(state.receipts.length,0);assert.equal(state.submissions,0);
({state,deps}=fixture());result=await execute(args,{...deps,prepare:async()=>{throw new Error('private://secret');}});assert.equal(result.safeCode,'TASK049_UNCLASSIFIED_FAILURE');assert.equal(state.submissions,0);assert.ok(!JSON.stringify(state).includes('secret'));
const inert=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',`
 import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).includes('.env'))throw Error('PRIVATE_READ');return original.call(this,file,...args);};
 net.Socket.prototype.connect=function(){throw Error('NETWORK_ACCESS');};syncBuiltinESMExports();
 await import('./migrations/service-reminder-message/execute-approved.mjs');process.stdout.write('inert');
`],{encoding:'utf8',windowsHide:true,shell:false});
assert.equal(inert.status,0,inert.stderr);assert.equal(inert.stdout,'inert');
console.log('PASS: held fresh approval/recovery, exact source/executor, SQL pin, no private reads before approval, immutable attempt admission, active writer/baseline refusals, preservation, one submission, no retry, uncertain COMMIT, post-COMMIT failure, redaction and inert import. Mocked adapters only.');
