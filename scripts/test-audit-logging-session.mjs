import assert from 'node:assert/strict';
import {PRIVATE_SESSION_SETTINGS,localSettingStatement,probeSession} from '../migrations/audit/probe-logging-session.mjs';
if(process.argv.length!==3||process.argv[2]!=='offline'){process.stdout.write('{"stage":"stopped","code":"MODE_REJECTED"}\n');process.exit(1);}
let checks=0;const check=work=>{work();checks++;};
for(const[name,value]of Object.entries(PRIVATE_SESSION_SETTINGS))check(()=>assert.equal(localSettingStatement(name,value),`SET LOCAL ${name} = '${value}'`));
for(const[name,value]of [['log_statement','all'],['log_statement;DROP ROLE x','none'],['password_encryption',"';select 1;"]])
 check(()=>assert.throws(()=>localSettingStatement(name,value),/SESSION_SETTING_SCOPE_REJECTED/));
for(const scenario of ['success','denied','mismatch']){
 const calls=[];const x={async query(sql,args){calls.push(sql);
  if(sql===localSettingStatement('log_statement','none')&&scenario==='denied'){const e=new Error('PRIVATE_DRIVER_CANARY');e.code='42501';throw e;}
  if(sql==='SELECT current_setting($1) AS value')return{rows:[{value:args[0]==='log_statement'&&scenario==='mismatch'?'ddl':PRIVATE_SESSION_SETTINGS[args[0]]}]};
  return{rows:[]};}};
 const result=await probeSession(x);
 check(()=>assert.equal(calls[0],'BEGIN READ ONLY'));check(()=>assert.equal(calls.at(-1),'ROLLBACK'));
 check(()=>assert.equal(result.log_statement.effective,scenario==='success'));
 check(()=>assert.equal(result.track_activities.effective,true));
 check(()=>assert.equal(calls.filter(c=>c==='SAVEPOINT logging_probe').length,Object.keys(PRIVATE_SESSION_SETTINGS).length));
 check(()=>assert.equal(calls.filter(c=>c==='ROLLBACK TO SAVEPOINT logging_probe').length,scenario==='success'?0:1));
 check(()=>assert.ok(!JSON.stringify(result).includes('PRIVATE_DRIVER_CANARY')));
}
process.stdout.write(JSON.stringify({stage:'logging-session-tests',status:'passed',checks,privateFileAccess:false,databaseAccess:false,sqlExecuted:false})+'\n');
