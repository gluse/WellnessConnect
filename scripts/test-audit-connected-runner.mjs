import assert from 'node:assert/strict';
import {runConnectedRehearsal,guardedPorts} from './rehearse-audit-db.mjs';
if(process.argv[2]!=='offline'||process.argv.length!==3)throw Error('MODE_REJECTED');
let checks=0;
await assert.rejects(()=>runConnectedRehearsal({exclusiveWindow:false,ports:{}}),/EXCLUSIVE_RUNTIME_WINDOW_REQUIRED/);checks++;
for(const failure of ['existing-id','retention']){
 let captured=false,closed=false;
 const observer={allAbsent:async()=>failure!=='existing-id',queueSafe:async()=>true};
 const ports={source:observer,destination:observer,assertFreshManifest:async()=>{},rollbackProbes:async()=>{},
  permissionProbes:async()=>{},invalidExpiryProbes:async()=>{},maintenanceRollbackProbes:async()=>{throw Error('CONTROLLED_RETENTION_STOP');},
  capture:async()=>{captured=true;},close:async()=>{closed=true;}};
 await assert.rejects(()=>runConnectedRehearsal({exclusiveWindow:true,ports}));checks++;
 assert.equal(captured,false);checks++;assert.equal(closed,true);checks++;
}
let claimed=false;
await assert.rejects(()=>guardedPorts({claim:async()=>{claimed=true;return[];}},{queueSafe:async()=>false}).claim(1,new AbortController().signal),/UNRELATED_AUDIT_QUEUE/);checks++;
assert.equal(claimed,false);checks++;
await assert.rejects(()=>guardedPorts({claim:async()=>[{event_id:'not-approved'}]},{queueSafe:async()=>true}).claim(1,new AbortController().signal));checks++;
process.stdout.write(JSON.stringify({stage:'connected-runner-tests',status:'passed',checks,privateFileAccess:false,databaseAccess:false})+'\n');
