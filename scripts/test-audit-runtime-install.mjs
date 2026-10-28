// Offline executor/metadata-control tests. No PostgreSQL clone, private I/O,
// application imports, connected fixture or real ACL/SQL operation.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../migrations/audit/runtime-support.mjs';
import {METADATA_SQL} from '../migrations/audit/execute-runtime-setup.mjs';
import {RUNTIME_FILES,INSTALL_SQL,MIGRATION_TIMEOUT_MS,installedFunctionContracts,loadRuntimeScripts,roleContracts,
 relationContracts,entryContracts,assertInstallPreflight,requireBooleans,checkCommit,
 installDisabled,preflightInstall,verifyInstalled} from '../migrations/audit/execute-runtime-disabled.mjs';
if(process.argv.length!==3||process.argv[2]!=='offline'){
 process.stdout.write(JSON.stringify({stage:'stopped',code:'MODE_REJECTED'})+'\n');process.exit(1);
}
let checks=0;const check=work=>{work();checks++;};
const scripts=loadRuntimeScripts();
check(()=>assert.deepEqual([...scripts.keys()],Object.values(RUNTIME_FILES)));
for(const [target,count]of [['source',15],['destination',8]]){
 const contracts=installedFunctionContracts(target);
 check(()=>assert.equal(contracts.length,count));
 check(()=>assert.equal(new Set(contracts.map(c=>c.schema+'.'+c.name+'('+c.args+')')).size,count));
 for(const c of contracts){check(()=>assert.match(c.body_hash,/^[a-f0-9]{64}$/));check(()=>assert.ok(c.language));}
 const sql=scripts.get(RUNTIME_FILES[target]);
 for(const expected of ['SET TRANSACTION READ WRITE;','AS runtime_version_recorded;',
  'owner_memberships_before','WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',
  'GRANTED BY %I RESTRICT','observed IS DISTINCT FROM original'])check(()=>assert.ok(sql.includes(expected)));
 check(()=>assert.doesNotMatch(sql,/\bPASSWORD\b|\bLOGIN\s*;|audit_rehearsal|log_statement|ALTER\s+(?:DATABASE|SYSTEM)/i));
 check(()=>assert.ok(roleContracts(target).every(r=>r.groups&&!r.name.includes('test'))));
}
check(()=>assert.equal(relationContracts('source').filter(r=>r.name==='user_search_locations').length,0));
check(()=>assert.equal(relationContracts('source').filter(r=>r.schema==='public').length,32));
check(()=>assert.deepEqual(relationContracts('destination'),[]));
check(()=>assert.equal(entryContracts('source').length,6));
check(()=>assert.equal(entryContracts('destination').length,1));
const snapshot=()=>({identity:{no_set_role:true,setup_principal:true,version_17:true,utf8:true,
 may_create_roles:true,runtime_names_free:true,rehearsal_name_free:true,setup_owner_admin_option:true,
 setup_owner_member:true,setup_owner_effective_usage:false,setup_owner_may_set:false},rights:{ok:true},schema:{ok:true}});
check(()=>assertInstallPreflight(snapshot()));
for(const key of Object.keys(snapshot().identity)){
 if(key==='setup_owner_member')continue;
 const bad=snapshot();bad.identity[key]=!bad.identity[key];check(()=>assert.throws(()=>assertInstallPreflight(bad)));
}
check(()=>assert.throws(()=>requireBooleans({rows:[{ok:false}]},'REJECT')));
check(()=>assert.throws(()=>requireBooleans({rows:[{ok:null}]},'REJECT')));
const receipt=()=>[{command:'BEGIN'},{command:'SELECT',fields:[{name:'runtime_version_recorded'}],rows:[{runtime_version_recorded:true}]},{command:'COMMIT'}];
check(()=>checkCommit(receipt()));
for(const bad of [receipt().slice(0,-1),[{command:'COMMIT'}],
 [{command:'SELECT',fields:[{name:'runtime_version_recorded'}],rows:[{runtime_version_recorded:false}]},{command:'COMMIT'}]])
 check(()=>assert.throws(()=>checkCommit(bad)));

// Test the actual readonly gate/verification query lifecycle using a scripted
// catalog adapter. Responses are not evidence of SQL syntax or live privileges.
const memberships=[{roleid:'11',member:'12',grantor:'13',admin_option:true,inherit_option:false,set_option:false}];
for(const target of ['destination','source']){
 const calls=[];
 const x={async query(sql){calls.push(sql);
  if(sql===METADATA_SQL.identity)return {rows:[snapshot().identity]};
  if(sql===INSTALL_SQL.ownerMemberships)return {rows:memberships};
  return {rows:[{ok:true}]};
 }};
 const before=await preflightInstall(x,target);checks++;
 check(()=>assert.deepEqual(before.memberships,memberships));
 check(()=>assert.equal(calls.filter(c=>c==='BEGIN READ ONLY').length,2));
 check(()=>assert.equal(calls.filter(c=>c==='ROLLBACK').length,2));
 calls.length=0;
 await verifyInstalled(x,target,before);checks++;
 check(()=>assert.equal(calls[0],'BEGIN READ ONLY'));
 check(()=>assert.equal(calls.at(-1),'ROLLBACK'));
 check(()=>assert.ok(calls.includes(INSTALL_SQL.entrypoints)));
 check(()=>assert.equal(calls.includes(INSTALL_SQL.policies),target==='source'));
 const failing={async query(sql){if(sql===INSTALL_SQL.ownerMemberships)return{rows:[]};return{rows:[{ok:true}]};}};
 await assert.rejects(()=>verifyInstalled(failing,target,before));checks++;
}

for(const scenario of ['success','preflight-source','open-source','sql-error','transport-error','cancellation','commit-uncertain','source-cancellation',
 'commit-without-receipt','verify-destination','verify-source']){
 const calls=[],events=[],closed=[];
 const settings={configs:{destination:'synthetic',source:'synthetic'},cas:{},scripts,
  onEvent:event=>events.push(event),
  makeClient:async(_,target)=>({target,async query(query){const sql=typeof query==='string'?query:query.text;calls.push([target,sql]);
   if(sql==='ROLLBACK')return{command:'ROLLBACK'};
   check(()=>assert.equal(query.query_timeout,MIGRATION_TIMEOUT_MS));
   if(target==='destination'&&scenario==='sql-error'){const e=new Error('CANARY_PRIVATE_ERROR');e.code='42501';throw e;}
   if(target==='destination'&&scenario==='transport-error'){const e=new Error('CANARY_PRIVATE_ERROR');e.code='ETIMEDOUT';throw e;}
   if(target==='destination'&&scenario==='cancellation'){const e=new Error('CANARY_PRIVATE_ERROR');e.code='57014';throw e;}
   if(target==='destination'&&scenario==='commit-uncertain'){const e=new Error('CANARY_PRIVATE_ERROR');e.code='40003';throw e;}
   if(target==='source'&&scenario==='source-cancellation'){const e=new Error('CANARY_PRIVATE_ERROR');e.code='57014';throw e;}
   if(target==='destination'&&scenario==='commit-without-receipt')return[{command:'COMMIT'}];
   return receipt();},async end(){closed.push(target);}}),
  open:async x=>{if(scenario===`open-${x.target}`)throw new Error('CANARY_PRIVATE_ERROR');},
  preflight:async(x,target)=>{calls.push([target,'preflight']);if(scenario===`preflight-${target}`)throw new Error('CANARY_PRIVATE_ERROR');return{memberships};},
  verify:async(x,target)=>{calls.push([target,'verify']);if(scenario===`verify-${target}`)throw new Error('CANARY_PRIVATE_ERROR');return{all:true};},
 };
 if(scenario==='success'){const result=await installDisabled(settings);check(()=>assert.equal(result.status,'passed'));}
 else{await assert.rejects(()=>installDisabled(settings));checks++;}
 check(()=>assert.deepEqual(closed,['destination','source']));
 const writes=calls.filter(([,sql])=>[...scripts.values()].includes(sql)).map(([t])=>t);
 check(()=>assert.ok(calls.filter(([,sql])=>sql==='preflight').length>=1));
 if(['preflight-source','open-source'].includes(scenario))check(()=>assert.deepEqual(writes,[]));
 else check(()=>assert.deepEqual(writes,['success','verify-source','source-cancellation'].includes(scenario)?['destination','source']:['destination']));
 if(scenario==='success'){
  check(()=>assert.deepEqual(events.filter(e=>e.stage==='disabled-runtime-installed').map(e=>e.target),['destination','source']));
  check(()=>assert.ok(calls.findIndex(([,s])=>s===scripts.get(RUNTIME_FILES.destination))>calls.findIndex(([t,s])=>t==='source'&&s==='preflight')));
 }else{
  const stopped=events.at(-1);check(()=>assert.equal(stopped.status,'stopped'));
  const expected=scenario==='sql-error'?'rolled-back':['transport-error','cancellation','commit-uncertain'].includes(scenario)?'uncertain':
   ['commit-without-receipt','verify-destination','verify-source','source-cancellation'].includes(scenario)?'committed':'not-attempted';
  check(()=>assert.equal(stopped.commits.destination,expected));
  if(scenario==='source-cancellation')check(()=>assert.equal(stopped.commits.source,'uncertain'));
  check(()=>assert.ok(!JSON.stringify(stopped).includes('CANARY_PRIVATE_ERROR')));
  check(()=>assert.equal(calls.some(([,s])=>typeof s==='string'&&/^\s*(?:DROP|TRUNCATE)\b/im.test(s)),false));
 }
}
for(const sql of Object.values(INSTALL_SQL)){
 const stripped=sql.replace(/'(?:[^']|'')*'/g,"''");
 check(()=>assert.doesNotMatch(stripped,/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE)\b/i));
 check(()=>assert.doesNotMatch(sql,/\bFROM\s+(?:public|audit|audit_capture)\./i));
}
for(const mode of ['apply','provision','rehearsal']){
 const r=spawnSync(process.execPath,['migrations/audit/execute-runtime-disabled.mjs',mode],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
 check(()=>assert.equal(r.status,1));check(()=>assert.equal(r.stderr,''));
 check(()=>assert.deepEqual(JSON.parse(r.stdout),{stage:'stopped',code:'MODE_REJECTED'}));
}
// Detect accidental eager private-file reads/sockets when importing the new
// executor. No private paths are opened even when this test runs under approval.
const guarded=`const fs=await import('node:fs');const net=await import('node:net');const original=fs.default.readFileSync;
 let privateReads=0,sockets=0;fs.default.readFileSync=function(file,...args){if(/(?:^|[\\\\/])\\.env(?:\\.|$)/.test(String(file))){privateReads++;throw Error('PRIVATE_READ');}return original.call(this,file,...args);};
 net.Socket.prototype.connect=function(){sockets++;throw Error('SOCKET');};
 await import('./migrations/audit/execute-runtime-disabled.mjs');process.stdout.write(JSON.stringify({privateReads,sockets}));`;
const imported=spawnSync(process.execPath,['--input-type=module','--eval',guarded],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(imported.status,0));check(()=>assert.equal(imported.stderr,''));
check(()=>assert.deepEqual(JSON.parse(imported.stdout),{privateReads:0,sockets:0}));
process.stdout.write(JSON.stringify({stage:'disabled-install-tests',status:'passed',checks,privateFileAccess:false,
 databaseAccess:false,sqlExecuted:false,scope:'fixed-manifest disabled-install orchestration/catalog guards; synthetic driver only'})+'\n');
