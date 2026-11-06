// Mocked execution boundary only. No private settings, network or database engine.
import assert from 'node:assert/strict';
import { execute, admission, TARGET, WAIVER, SOURCE_METADATA_SQL, FINGERPRINT_SQL, POSTFLIGHT_SQL } from './execute-approved.mjs';
import { WISHLIST_APPLICATION_READINESS_SQL as OLD_SQL, WISHLIST_APPLICATION_READINESS_KEYS as OLD_KEYS } from '../wishlist/application-readiness.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL as NEW_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS as NEW_KEYS } from './application-readiness.mjs';
import { CURRENCY_READINESS_SQL } from '../currencies/application-readiness.mjs';
const args=['--apply-approved-source='+TARGET,'--backup-waived='+WAIVER];
for(const invalid of [[],[args[0]],['--apply-approved-source=wrong',args[1]],[args[0],'--backup-waived=TASK-039-2026-11-05'],[...args,'--retry']])assert.throws(()=>admission(invalid));
assert.equal(admission(args),'waived');
assert.equal(admission([args[0],'--verified-recovery=REVIEWED-TASK-044']),'verified');
const metadata={identity:true,database:true,version:true,read_only:true,settings_absent:true,address_override_absent:true,table_count:40,user_count:4,company_count:2,address_count:3,service_count:27,booking_count:32,other_writers:0};
const counts={user_count:4,company_count:2,address_count:3,service_count:27,booking_count:32,personal_defaults:4,company_defaults:2,seed_values_correct:true,overrides_unset:true};
let queries=[],submissions=0,prepares=0,fingerprints=0,failMigration=false,changed=false,outputs=[],receipts=[];
const deps={async script(){return 'PINNED_0021';},async recovery(choice){return choice==='waived'?{verified:false,waived:true,selection:WAIVER}:{verified:true,waived:false,method:'managed_backup'};},
 async create(value){receipts.push(structuredClone(value));},async save(value){receipts.push(structuredClone(value));},
 async prepare(){prepares++;return {appValue:'app',ownerValue:'owner',appCA:{},ownerCA:{}};},async connect(){},
 async client(){return {async query(text){queries.push(text);if(typeof text==='object'){submissions++;assert.equal(text.text,'PINNED_0021');assert.equal(text.query_timeout,125000);
   if(failMigration)throw Object.assign(new Error('private://secret@target'),{code:'57014'});
   return [{command:'INSERT',rowCount:4},{command:'INSERT',rowCount:2},{command:'SELECT',rows:[{personal_defaults_initialized:'4',company_defaults_initialized:'2'}]},{command:'COMMIT'}];}
   if(text===OLD_SQL)return {rows:[Object.fromEntries(OLD_KEYS.map(key=>[key,true]))]};
   if(text===NEW_SQL)return {rows:[Object.fromEntries(NEW_KEYS.map(key=>[key,true]))]};
   if(text===CURRENCY_READINESS_SQL)return {rows:[{currency_columns:true,currency_constraints:true}]};
   if(text===SOURCE_METADATA_SQL)return {rows:[metadata]};
   if(text===FINGERPRINT_SQL){fingerprints++;return {rows:[{services:(changed&&fingerprints>1?'b':'a').repeat(32),bookings:'c'.repeat(32),addresses:'d'.repeat(32)}]};}
   if(text===POSTFLIGHT_SQL)return {rows:[counts]};
   assert.ok(['BEGIN TRANSACTION READ ONLY','COMMIT'].includes(text));return {rows:[]};},async end(){}};},emit(value){outputs.push(value);}};
let result=await execute(args,deps);
assert.equal(result.passed,true);assert.equal(submissions,1);assert.equal(prepares,1);assert.equal(result.receipt.script.committed,true);
assert.equal(result.receipt.existingPricesCurrenciesAndAddressesPreserved,true);assert.equal(Object.keys(result.receipt.verification).length,34);
assert.equal(result.receipt.recovery.verified,false);assert.equal(result.receipt.recovery.selection,WAIVER);
assert.ok(!JSON.stringify(result.receipt).includes('a'.repeat(32)),'Preservation hashes remain in memory');
submissions=0;fingerprints=0;failMigration=true;
result=await execute(args,deps);assert.equal(result.passed,false);assert.equal(submissions,1);assert.equal(result.receipt.commitOutcomeUnknown,true);assert.equal(result.receipt.script.committed,false);
assert.ok(!JSON.stringify(result.receipt).includes('secret'));assert.ok(!JSON.stringify(outputs).includes('secret'));
failMigration=false;changed=true;submissions=0;fingerprints=0;
result=await execute(args,deps);assert.equal(result.passed,false);assert.equal(submissions,1);assert.equal(result.receipt.script.committed,true);assert.equal(result.receipt.commitOutcomeUnknown,false);assert.equal(result.safeCode,'TASK044_POSTFLIGHT_FAILED');
changed=false;metadata.other_writers=1;submissions=0;fingerprints=0;
result=await execute(args,deps);assert.equal(result.safeCode,'TASK044_ACTIVE_WRITERS');assert.equal(submissions,0);metadata.other_writers=0;
prepares=0;submissions=0;await execute([args[0]],deps);assert.equal(prepares,0);assert.equal(submissions,0);
// Reviewed proof route is testable with a trusted injected evidence boundary;
// production admission requires an independently reviewed non-null evidence pin.
fingerprints=0;result=await execute([args[0],'--verified-recovery=REVIEWED-TASK-044'],deps);assert.equal(result.passed,true);assert.equal(result.receipt.recovery.verified,true);assert.equal(result.receipt.recovery.waived,false);
console.log('PASS: TASK-044-only recovery admission, one migration submission, baseline28/postflight34, seed/count/value preservation, active-writer stop, uncertain commit/no retry, committed verification failure and error redaction. Mocked adapters only.');
