// Offline only. Exercise lifecycle/gate orchestration, never emulate PostgreSQL.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ACTIVE_SQL,activeRoleContracts,activeCheckPlan,verifyActiveRuntime,
 LOCATION_ACCEPTED_CHECK_SHA256} from '../migrations/audit/runtime-active-profile.mjs';
import {INSTALL_SQL} from '../migrations/audit/execute-runtime-disabled.mjs';
import {LOCATION_SQL,LOCATION_TABLES} from '../migrations/audit/search-location-runtime.mjs';
assert.equal(process.argv.length,3);assert.equal(process.argv[2],'offline');
let checks=0;
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(v,message)=>{assert.ok(v,message);checks++;};
const throws=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
equal(activeRoleContracts('source').map(r=>[r.name,r.login,r.cap]),[
 ['fm_app_runtime',false,-1],['fmt_app_dev',true,5],['fmt_audit_capture_dev',true,2],['fmt_audit_worker_dev',true,2]]);
equal(activeRoleContracts('destination').map(r=>[r.name,r.login,r.cap]),[['fmt_audit_writer_dev',true,2]]);
throws(()=>activeRoleContracts('other'),/ACTIVE_TARGET_REJECTED/);
for(const options of [undefined,{}, {testAccess:'yes'},{testAccess:true}])throws(()=>activeCheckPlan('source',options),/ACTIVE_TEST_ACCESS_REJECTED/);
throws(()=>activeCheckPlan('other',{testAccess:'enabled'}),/ACTIVE_TARGET_REJECTED/);
equal(LOCATION_ACCEPTED_CHECK_SHA256,'a6e723c3ec870b2190c8d34c87762ca13e3d6016045c804e8611e91576fec574');
ok(ACTIVE_SQL.runtimeRoles.includes('r.rolcanlogin IS DISTINCT FROM e.login'));
ok(ACTIVE_SQL.runtimeRoles.includes('m.admin_option OR NOT m.inherit_option OR NOT m.set_option'));
ok(ACTIVE_SQL.ownerState.includes('NOT m.inherit_option AND NOT m.set_option'));
ok(ACTIVE_SQL.ownerState.includes("n.nspname='audit_rehearsal'"));
ok(ACTIVE_SQL.ownerState.includes('AS exact_retained_evidence_relations'));
ok(ACTIVE_SQL.testState.includes('r.rolcanlogin=$1::boolean'));
ok(ACTIVE_SQL.testState.includes("has_schema_privilege('fmt_audit_test_dev','audit_rehearsal','USAGE')=$1::boolean"));
ok(ACTIVE_SQL.rehearsalFunctions.includes("has_function_privilege('fmt_audit_test_dev',p.oid,'EXECUTE')=$2::boolean"));
ok(ACTIVE_SQL.rehearsalFunctions.includes("encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.body_hash"));
ok(ACTIVE_SQL.rehearsalFunctions.includes('a.grantee=0'));
for(const name of ['no_usable_test_relation_grants','no_usable_test_column_grants','no_usable_test_sequence_grants',
 'no_test_audit_entrypoints','no_test_geocoding_maintenance','no_test_future_grants'])ok(ACTIVE_SQL.testState.includes(name));
ok(!Object.values(ACTIVE_SQL).some(sql=>/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CREATE|ALTER|DROP)\b\s+(?:INTO|FROM|ON|TABLE|ROLE|SCHEMA)/.test(sql)));

for(const target of ['source','destination'])for(const testAccess of ['enabled','disabled']){
 const plan=activeCheckPlan(target,{testAccess}),byKey=new Map(plan.map(([key,sql,args])=>[key,{sql,args}]));
 equal(new Set(plan.map(p=>p[0])).size,plan.length);
 ok(!plan.some(([,sql])=>sql===INSTALL_SQL.roleState),'legacy disabled profile is never called');
 equal(byKey.get('runtimeRoles').sql,ACTIVE_SQL.runtimeRoles);
 equal(byKey.get('testState').args,[testAccess==='enabled']);
 equal(byKey.get('rehearsalFunctions').args[1],testAccess==='enabled');
 equal(JSON.parse(byKey.get('rehearsalFunctions').args[0]).length,6);
 const runtimeNames=activeRoleContracts(target).map(r=>r.name);
 equal(byKey.get('grantOptions').args,[[...runtimeNames,'fmt_audit_test_dev']]);
 equal(byKey.get('relations').sql,INSTALL_SQL.relations);
 equal(byKey.get('entrypoints').sql,INSTALL_SQL.entrypoints);
 ok(plan.every(([,sql])=>/^\s*(?:SELECT|WITH)\b/.test(sql)),'bounded catalog-only SELECT statements');
 if(target==='source'){
  equal(byKey.get('tables').sql,LOCATION_SQL.tables);equal(byKey.get('tables').args,[LOCATION_TABLES]);
  equal(LOCATION_TABLES.length,17);ok(LOCATION_TABLES.includes('user_search_locations'));
  equal(byKey.get('shapeDefinition').args,[LOCATION_ACCEPTED_CHECK_SHA256]);
  equal(byKey.get('allPoliciesPermissive').args,[LOCATION_TABLES]);
  equal(byKey.get('foundationPolicies').args[0].length,16);
  const expected=JSON.parse(byKey.get('relations').args[1]).filter(r=>r.name==='user_search_locations');
  equal(expected.map(r=>[r.role,r.rights]),[
   ['fm_app_runtime',['SELECT','INSERT','UPDATE','DELETE']],['fmt_app_dev',['SELECT','INSERT','UPDATE','DELETE']]]);
  equal(byKey.get('privateLocationAcl').args,[['anon','authenticated','service_role']]);
  equal(byKey.get('locationPolicy').sql,LOCATION_SQL.policy);
 }else{
  ok(!byKey.has('tables')&&!byKey.has('shapeDefinition'));
  equal(JSON.parse(byKey.get('relations').args[1]),[]);
 }
 // Scripted driver results prove exact query order, fail-fast, and read-only rollback.
 // They make no claim that arbitrary SQL has been semantically executed.
 function driver({failIndex=-1,value=false,throwIndex=-1}={}){
  let index=0;const calls=[];
  return {calls,async query(sql,args){
   calls.push([sql,args]);if(sql==='BEGIN READ ONLY'||sql==='ROLLBACK')return {command:sql};
   const expected=plan[index];equal([sql,args],[expected[1],expected[2]]);
   const n=index++;if(n===throwIndex)throw Object.assign(new Error('synthetic'),{code:'57014'});
   return {rows:[{fixed_catalog_assertion:n===failIndex?value:true}]};
  }};
 }
 const x=driver();const result=await verifyActiveRuntime(x,target,{testAccess});
 equal(result.testAccess,testAccess);equal(Object.keys(result.checks),plan.map(p=>p[0]));
 equal(x.calls[0],['BEGIN READ ONLY',undefined]);equal(x.calls.at(-1),['ROLLBACK',undefined]);
 equal(x.calls.length,plan.length+2);
 for(const failIndex of [0,Math.floor(plan.length/2),plan.length-1])for(const value of [false,null]){
  const bad=driver({failIndex,value});await assert.rejects(()=>verifyActiveRuntime(bad,target,{testAccess}),
   value===null?/METADATA_BOOLEAN_REQUIRED/:/ACTIVE_RUNTIME_VERIFICATION_REJECTED/);checks++;
  equal(bad.calls.length,failIndex+3);equal(bad.calls.at(-1),['ROLLBACK',undefined]);
 }
 const transport=driver({throwIndex:2});await assert.rejects(()=>verifyActiveRuntime(transport,target,{testAccess}),{code:'57014'});checks++;
 equal(transport.calls.at(-1),['ROLLBACK',undefined]);equal(transport.calls.length,5);
}
const inert=spawnSync(process.execPath,['--input-type=module','-e',"await import('./migrations/audit/runtime-active-profile.mjs'); process.stdout.write('inert');"],{encoding:'utf8'});
equal(inert.status,0);equal(inert.stdout,'inert');equal(inert.stderr,'');
console.log(JSON.stringify({stage:'audit-active-profile-offline-tests',status:'passed',checks,
 databaseAccess:false,privateFileAccess:false,sqlExecuted:false}));
