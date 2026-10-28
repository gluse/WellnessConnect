import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT,replacePrivateIfUnchanged} from '../migrations/audit/runtime-support.mjs';
import {provisionPreparedPasswords} from '../migrations/audit/provision-runtime-private.mjs';
if(process.argv.length!==3||process.argv[2]!=='offline'){process.stdout.write('{"stage":"stopped","code":"MODE_REJECTED"}\n');process.exit(1);}
let checks=0;const check=work=>{work();checks++;};
for(const changed of [false,true]){
 let replaced=false;const expected=Buffer.from('synthetic-original'),current=Buffer.from(changed?'concurrent-user-edit':'synthetic-original');
 const run=()=>replacePrivateIfUnchanged(expected,()=>current,()=>{replaced=true;});
 if(changed)check(()=>assert.throws(run,/PRIVATE_INPUT_CHANGED/));else{run();checks++;}
 check(()=>assert.equal(replaced,!changed));check(()=>assert.equal(current.toString(),changed?'concurrent-user-edit':'synthetic-original'));
}
let opened=false;
await assert.rejects(()=>provisionPreparedPasswords({preparedFilesVerified:false,makeClient:async()=>{opened=true;}}),/PRIVATE_HANDOFF_NOT_VERIFIED/);checks++;
check(()=>assert.equal(opened,false));
for(const scenario of ['success','destination-guard','source-open','destination-password','source-password','destination-transport','source-commit']){
 const calls=[],closed=[],events=[];const password='synthetic-private-canary';
 const options={configs:{source:'synthetic',destination:'synthetic'},cas:{},passwords:{app:password,capture:password,worker:password,writer:password},
  preparedFilesVerified:true,onEvent:event=>events.push(event),
  makeClient:async(_,target)=>({target,async query(sql){calls.push([target,sql]);return{command:'ROLLBACK'};},async end(){closed.push(target);}}),
  open:async x=>{calls.push([x.target,'open']);if(scenario===`${x.target}-open`)throw Error(password);},
  secureBegin:async x=>{calls.push([x.target,'guard']);if(scenario===`${x.target}-guard`)throw Error(password);},
  bind:async(x,target,role,value)=>{check(()=>assert.equal(value,password));calls.push([target,'bind',role]);
   if(scenario===`${target}-password`)throw Object.assign(Error(password),{code:'42501'});
   if(scenario===`${target}-transport`)throw Object.assign(Error(password),{code:'ETIMEDOUT'});},
  finish:async x=>{calls.push([x.target,'commit']);if(scenario===`${x.target}-commit`)throw Object.assign(Error(password),{code:'ETIMEDOUT'});},
 };
 if(scenario==='success'){const result=await provisionPreparedPasswords(options);check(()=>assert.deepEqual(result.commits,{destination:'committed',source:'committed'}));}
 else{await assert.rejects(()=>provisionPreparedPasswords(options));checks++;}
 check(()=>assert.deepEqual(closed,scenario.startsWith('destination-')?['destination']:['destination','source']));
 check(()=>assert.ok(!JSON.stringify(events).includes(password)));
 check(()=>assert.ok(events.every(e=>e.loginsEnabled===false)));
 const destinationBinds=calls.filter(([target,what])=>target==='destination'&&what==='bind');
 check(()=>assert.ok(destinationBinds.every(row=>row[2]==='fmt_audit_writer_dev')));
 const sourceBinds=calls.filter(([target,what])=>target==='source'&&what==='bind');
 check(()=>assert.ok(sourceBinds.every(row=>['fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev'].includes(row[2]))));
 if(scenario==='success'){
  check(()=>assert.deepEqual(sourceBinds.map(row=>row[2]),['fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev']));
  check(()=>assert.ok(calls.findIndex(([target,what])=>target==='destination'&&what==='commit')<calls.findIndex(([target,what])=>target==='source'&&what==='bind')));
 }else{
  const last=events.at(-1),target=scenario.startsWith('destination-')?'destination':'source';
  check(()=>assert.equal(last.commits[target],scenario.endsWith('-password')?'rolled-back':scenario.endsWith('-guard')||scenario.endsWith('-open')?'not-attempted':'uncertain'));
 }
}
const guarded=`const fs=await import('node:fs'),net=await import('node:net');const original=fs.default.readFileSync;
let privateReads=0,sockets=0;fs.default.readFileSync=function(file,...args){if(/(?:^|[\\\\/])\\.env(?:\\.|$)/.test(String(file))){privateReads++;throw Error('PRIVATE_READ');}return original.call(this,file,...args);};
net.Socket.prototype.connect=function(){sockets++;throw Error('SOCKET');};await import('./migrations/audit/provision-runtime-private.mjs');
process.stdout.write(JSON.stringify({privateReads,sockets}));`;
const r=spawnSync(process.execPath,['--input-type=module','--eval',guarded],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(r.status,0));check(()=>assert.equal(r.stderr,''));check(()=>assert.deepEqual(JSON.parse(r.stdout),{privateReads:0,sockets:0}));
process.stdout.write(JSON.stringify({stage:'private-provisioning-tests',status:'passed',checks,privateFileAccess:false,databaseAccess:false,sqlExecuted:false})+'\n');
