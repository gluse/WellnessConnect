import assert from 'node:assert/strict';
import {SECRET_SESSION_CONTROLS,IMMUTABLE_SAFE_DEFAULTS,beginPrivateSession,bindRolePassword,finishPrivateSession} from '../migrations/audit/private-session.mjs';
if(process.argv.length!==3||process.argv[2]!=='offline'){process.stdout.write('{"stage":"stopped","code":"MODE_REJECTED"}\n');process.exit(1);}
let checks=0;const check=work=>{work();checks++;};
const password='x'.repeat(43),expected={...SECRET_SESSION_CONTROLS,...IMMUTABLE_SAFE_DEFAULTS};
for(const failure of [null,...Object.keys(expected),'identity','SET-denied']){
 const calls=[];const x={async query(sql,args){calls.push({sql,args});
  if(failure==='SET-denied'&&sql.startsWith('SET LOCAL'))throw Object.assign(Error('PRIVATE_DRIVER_CANARY'),{code:'42501'});
  if(sql.startsWith('SELECT name,setting'))return{rows:Object.entries(expected).map(([name,setting])=>({name,setting:name===failure?'unsafe':setting}))};
  if(sql.startsWith("SELECT current_user='postgres'"))return{rows:[{ok:failure!=='identity'}]};
  return{command:sql==='COMMIT'?'COMMIT':sql==='ROLLBACK'?'ROLLBACK':'SELECT',rows:[]};
 }};
 if(failure){await assert.rejects(()=>beginPrivateSession(x));checks++;
  await assert.rejects(()=>bindRolePassword(x,'source','fmt_audit_capture_dev',password),/PRIVATE_SESSION_GUARD_REQUIRED/);checks++;
  check(()=>assert.equal(calls.at(-1).sql,'ROLLBACK'));
  check(()=>assert.equal(calls.some(c=>c.args?.includes(password)),false));
 }else{
  await beginPrivateSession(x);await bindRolePassword(x,'source','fmt_audit_capture_dev',password);
  check(()=>assert.ok(calls.findIndex(c=>c.sql.startsWith('SELECT name,setting'))<calls.findIndex(c=>c.args?.includes(password))));
  check(()=>assert.ok(calls.every(c=>!c.sql.includes(password))));
  for(const[role,target]of [['postgres','source'],['fmt_audit_writer_dev','source'],['fmt_app_dev','destination']]){
   await assert.rejects(()=>bindRolePassword(x,target,role,password),/PRIVATE_ROLE_PASSWORD_SCOPE_REJECTED/);checks++;
  }
  await finishPrivateSession(x,true);checks++;
  await assert.rejects(()=>bindRolePassword(x,'source','fmt_audit_capture_dev',password),/PRIVATE_SESSION_GUARD_REQUIRED/);checks++;
 }
}
for(const failure of ['begin','credential-do']){
 let armed=false;const x={async query(sql){
  if(armed&&((failure==='begin'&&sql==='BEGIN')||(failure==='credential-do'&&sql.startsWith('DO $credential$'))))throw Error('PRIVATE_DRIVER_CANARY');
  if(sql.startsWith('SELECT name,setting'))return{rows:Object.entries(expected).map(([name,setting])=>({name,setting}))};
  if(sql.startsWith("SELECT current_user='postgres'"))return{rows:[{ok:true}]};
  return{command:sql==='COMMIT'?'COMMIT':'ROLLBACK',rows:[]};}};
 await beginPrivateSession(x);armed=true;
 if(failure==='begin'){await assert.rejects(()=>beginPrivateSession(x));checks++;}
 else{await assert.rejects(()=>bindRolePassword(x,'source','fmt_audit_capture_dev',password));checks++;}
 await assert.rejects(()=>bindRolePassword(x,'source','fmt_audit_capture_dev',password),/PRIVATE_SESSION_GUARD_REQUIRED/);checks++;
 await assert.rejects(()=>finishPrivateSession(x,true),/PRIVATE_SESSION_GUARD_REQUIRED/);checks++;
}
process.stdout.write(JSON.stringify({stage:'private-session-tests',status:'passed',checks,privateFileAccess:false,databaseAccess:false,sqlExecuted:false})+'\n');
