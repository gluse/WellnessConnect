import assert from 'node:assert/strict';
import {enableForRehearsal} from '../migrations/audit/enable-rehearsal-runtime.mjs';
if(process.argv[2]!=='offline'||process.argv.length!==3)throw Error('MODE_REJECTED');
let checks=0;
for(const fail of [null,'source-preflight','destination-bind','source-commit']){
 const calls=[],events=[],closed=[];
 const args={configs:{source:'synthetic',destination:'synthetic'},cas:{},passwords:{source:'synthetic',destination:'synthetic'},
 makeClient:async(_,target)=>({target,query:async sql=>{calls.push([target,sql]);return{rows:[{ok:true}]};},end:async()=>{closed.push(target);}}),
 open:async()=>{},preflight:async(_,target)=>{calls.push([target,'preflight']);if(fail===`${target}-preflight`)throw Error('CANARY_PRIVATE');},
 secureBegin:async()=>{},bind:async(_,target)=>{if(fail===`${target}-bind`)throw Error('CANARY_PRIVATE');},
 finish:async x=>{if(fail===`${x.target}-commit`)throw Error('CANARY_PRIVATE');},verify:async()=>({profile:'synthetic'}),onEvent:e=>events.push(e)};
 if(fail)await assert.rejects(()=>enableForRehearsal(args));else await enableForRehearsal(args);checks++;
 assert.deepEqual(closed,['destination','source']);checks++;
 assert.ok(!JSON.stringify(events).includes('CANARY_PRIVATE'));checks++;
 if(fail==='source-preflight'){assert.equal(calls.filter(([,sql])=>sql.startsWith('ALTER')).length,0);checks++;}
 if(fail==='source-commit'){assert.deepEqual(events.at(-1).commits,{destination:'committed',source:'uncertain'});checks++;}
 const roles=calls.filter(([,sql])=>sql.startsWith('ALTER')).map(([,sql])=>sql);
 assert.ok(roles.every(sql=>/^ALTER ROLE fmt_(?:app_dev|audit_(?:capture|worker|writer|test)_dev) LOGIN$/.test(sql)));checks++;
}
process.stdout.write(JSON.stringify({stage:'enablement-tests',checks,status:'passed',privateFileAccess:false,databaseAccess:false})+'\n');
