// Focused offline manifest/profile/driver checks, never a SQL engine simulation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const ok=value=>{assert.ok(value);checks++;};
const read=fs.readFileSync,socket=net.Socket.prototype.connect,spawn=childProcess.spawnSync;
fs.readFileSync=function(file,...args){assert.ok(!/(?:^|[\\/])\.env(?:\.|$)/.test(String(file)),'private I/O');return read.call(this,file,...args);};
net.Socket.prototype.connect=()=>assert.fail('network I/O');childProcess.spawnSync=()=>assert.fail('process/private ACL I/O');syncBuiltinESMExports();
let helper;
try{helper=await import('../migrations/audit/execute-service-view.mjs');helper.loadScripts();checks++;}
finally{fs.readFileSync=read;net.Socket.prototype.connect=socket;childProcess.spawnSync=spawn;syncBuiltinESMExports();}
const {loadScripts,functionContracts,applyExtension,verifyProfile,checkCommit,workerHealthOnly,SQL,RETENTION_NEW}=helper;
const {installedFunctionContracts,INSTALL_SQL}=await import('../migrations/audit/execute-runtime-disabled.mjs');
const scripts=loadScripts();
for(const target of ['destination','source']){
 const text=scripts.get(target),old=installedFunctionContracts(target),next=functionContracts(target,scripts);
 eq(next.length,old.length);eq(next.filter((c,i)=>c.body_hash!==old[i].body_hash).map(c=>c.name),['parse_event',target==='source'?'enqueue':'accept']);
 eq((text.match(/^BEGIN;$/gm)||[]).length,1);eq((text.match(/^COMMIT;$/gm)||[]).length,1);
 eq((text.match(/^CREATE OR REPLACE FUNCTION /gm)||[]).length,2);
 ok(text.includes("'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$'"));
 ok(text.includes('END $$;'));ok(text.includes('7776000 seconds'));ok(text.includes('31536000 seconds'));
 ok(!/\bCREATE\s+(?:TABLE|ROLE|INDEX)\b/i.test(text));
 ok(text.includes("occurred+(CASE WHEN e->>'retentionClass'='R'"));
 for(const extended of [false,true]){
  const calls=[];const expected=extended?next:old;
  await verifyProfile({query:async(sql,args)=>{
   calls.push(sql);
   if(sql===INSTALL_SQL.functions)eq(JSON.parse(args[0]),expected);
   if(sql===SQL.retention)eq(args.slice(2,4),[extended,RETENTION_NEW]);
   if(sql===SQL.metadata)return{rows:[{value:[{name:'parse_event'},{name:'entry'}]}]};
   if(sql===SQL.memberships)return{rows:[]};return{rows:[{valid:true}]};
  }},target,{extended,scripts});eq(calls[0],'BEGIN READ ONLY');eq(calls.at(-1),'ROLLBACK');
 }
}
const receipt={command:'SELECT',fields:[{name:'service_view_version_recorded'}],rows:[{service_view_version_recorded:true}]};
checkCommit([receipt,{command:'COMMIT'}]);checks++;
assert.throws(()=>checkCommit([receipt,{command:'ROLLBACK'}]));checks++;
assert.throws(()=>checkCommit([{command:'COMMIT'}]));checks++;
async function scenario({preflightFailure,migrationFailure,verificationFailure,aclDrift,continueSource=false}={}){
 const calls=[],events=[],versions={destination:continueSource,source:false};
 const makeClient=async(_url,target)=>({query:async sql=>{
  if(typeof sql==='object'){
   calls.push(target+':write');if(migrationFailure?.[0]===target)throw Object.assign(new Error('fixture'),{code:migrationFailure[1]});
   versions[target]=true;return[receipt,{command:'COMMIT'}];
  }calls.push(target+':'+sql);return{command:sql};
 },end:async()=>calls.push(target+':closed')});
 let result,error;try{result=await applyExtension({configs:{},cas:{},scripts,continueSource,makeClient,open:async()=>{},
  verify:async(_x,target,{extended})=>{
   calls.push(target+':verify:'+extended);
   assert.equal(extended,versions[target]);
   if(!extended&&preflightFailure===target||extended&&verificationFailure===target)throw new Error('fixture');
   return{metadata:extended&&aclDrift===target?[{changed:true}]:[{same:true}],memberships:[]};
  },onEvent:e=>events.push(e)});}catch(e){error=e;}
 eq(calls.filter(c=>c.endsWith(':closed')).length,2);return{calls,events,result,error};
}
let run=await scenario();eq(run.result.commits,{destination:'committed',source:'committed'});
ok(run.calls.indexOf('source:verify:false')<run.calls.indexOf('destination:write'));
ok(run.calls.indexOf('destination:verify:true')<run.calls.indexOf('source:write'));
run=await scenario({preflightFailure:'source'});ok(run.error);eq(run.calls.filter(c=>c.endsWith(':write')),[]);
run=await scenario({migrationFailure:['destination','57014']});eq(run.events.at(-1).commits,{destination:'uncertain',source:'not-attempted'});ok(!run.calls.includes('source:write'));
run=await scenario({migrationFailure:['source','P0001']});eq(run.events.at(-1).commits,{destination:'committed',source:'rolled-back'});
run=await scenario({verificationFailure:'destination'});eq(run.events.at(-1).commits,{destination:'committed',source:'not-attempted'});
run=await scenario({aclDrift:'destination'});ok(run.error);ok(!run.calls.includes('source:write'));
run=await scenario({continueSource:true});eq(run.calls.filter(c=>c.endsWith(':write')),['source:write']);eq(run.result.commits.destination,'previously-committed');
const calls=[];await assert.rejects(verifyProfile({query:async(sql)=>{calls.push(sql);return{rows:[{valid:false}]};}},'source',{scripts}));checks++;
eq(calls.at(-1),'ROLLBACK');
const readinessCalls=[],health={pending:0,leased:0,quarantined:0,expired:0};
await workerHealthOnly({},async()=>({ports:{
 health:async()=>{readinessCalls.push('health');return health;},
 get claim(){assert.fail('readiness must never access claim');},
},close:async()=>readinessCalls.push('close')}));
eq(readinessCalls,['health','close']);
console.log(`${checks} focused service-view DB checks passed; no private, network, ACL or SQL execution`);
