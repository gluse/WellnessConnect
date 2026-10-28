// Fixed TASK-014 enablement for controlled rehearsal, flags remain false.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {privatePreflight,privatePath,privateWrite,privateRead,readSettings,connection,trustedCA,roleURL,client,connect,requireThat,emit,safeCode} from './runtime-support.mjs';
import {ROLES} from './runtime-contract.mjs';
import {roleContracts,requireBooleans,readonly} from './execute-runtime-disabled.mjs';
import {activeCheckPlan,ACTIVE_SQL,activeRoleContracts,verifyActiveRuntime} from './runtime-active-profile.mjs';
import {REHEARSAL_SQL} from './rehearsal-setup.mjs';
import {beginPrivateSession,bindRolePassword,finishPrivateSession,forgetPrivateSession} from './private-session.mjs';
export async function verifyBeforeEnable(x,target){return readonly(x,async()=>{
 for(const[key,sql,args]of activeCheckPlan(target,{testAccess:'enabled'})){
  if(key==='runtimeRoles')requireBooleans(await x.query(sql,[JSON.stringify(roleContracts(target).map(r=>({...r,login:false})))]),'PRE_ENABLE_RUNTIME_REJECTED');
  else if(key==='testState')requireBooleans(await x.query(REHEARSAL_SQL.state,[`fm_audit_${target}_owner`]),'PRE_ENABLE_TEST_REJECTED');
  else requireBooleans(await x.query(sql,args),'PRE_ENABLE_CONTRACT_REJECTED');
 }
});}
export async function enableForRehearsal({configs,cas,passwords,makeClient=client,open=connect,preflight=verifyBeforeEnable,
 secureBegin=beginPrivateSession,bind=bindRolePassword,finish=finishPrivateSession,verify=verifyActiveRuntime,onEvent=()=>{}}){
 const xs={},commits={destination:'not-attempted',source:'not-attempted'};let target,stage='enable-preflight';
 try{
  for(target of ['destination','source']){xs[target]=await makeClient(configs[target],target,cas[target]);await open(xs[target]);await preflight(xs[target],target);}
  for(target of ['destination','source']){
   stage='enable-transaction';await secureBegin(xs[target]);commits[target]='uncertain';
   await bind(xs[target],target,ROLES.test,passwords[target]);
   for(const role of target==='destination'?[ROLES.writer,ROLES.test]:[ROLES.app,ROLES.capture,ROLES.worker,ROLES.test])
    await xs[target].query(`ALTER ROLE ${role} LOGIN`);
   requireBooleans(await xs[target].query(ACTIVE_SQL.runtimeRoles,[JSON.stringify(activeRoleContracts(target))]),'ENABLED_RUNTIME_ROLE_REJECTED');
   requireBooleans(await xs[target].query(ACTIVE_SQL.testState,[true]),'ENABLED_TEST_ROLE_REJECTED');
   stage='enable-commit';await finish(xs[target],true);commits[target]='committed';
   stage='enable-verification';const result=await verify(xs[target],target,{testAccess:'enabled'});
   onEvent({stage,target,status:'verified',commits:{...commits},profile:result.profile,flagsEnabled:false});
  }return{commits};
 }catch(e){if(xs[target]){forgetPrivateSession(xs[target]);try{await xs[target].query('ROLLBACK');}catch{}}
  onEvent({stage,target,status:'stopped',code:safeCode(e),commits:{...commits},automaticRetry:false});throw e;
 }finally{for(const x of Object.values(xs))try{await x.end();}catch{}}
}
async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');const{configs,cas}=loadPrivateConfiguration(),sid=privatePreflight();
 for(const name of ['.env','.env.audit-worker.local']){
  const flags=readSettings(privateRead(name,sid).split(/\r?\n/).filter(line=>/^\s*(?:AUDIT_ENABLED|AUDIT_WORKER_ENABLED|AUDIT_AUTH_EVENTS_ENABLED)\s*=/.test(line)).join('\n'));
  requireThat(Object.values(flags).every(value=>value==='false')&&flags.AUDIT_WORKER_ENABLED==='false','REHEARSAL_FLAGS_MUST_REMAIN_FALSE');
 }
 let passwords;
 if(fs.existsSync(privatePath('.env.audit-test.local'))){
  const prior=readSettings(privateRead('.env.audit-test.local',sid));
  requireThat(prior.AUDIT_ENVIRONMENT==='development'&&Object.keys(prior).length===3,'PRIVATE_TEST_HANDOFF_SCOPE_REJECTED');
  const source=connection(prior.AUDIT_TEST_SOURCE_DATABASE_URL,'source',ROLES.test);
  const destination=connection(prior.AUDIT_TEST_DESTINATION_DATABASE_URL,'destination',ROLES.test);
  trustedCA(source);trustedCA(destination);passwords={source:source.password,destination:destination.password};
 }else{
 passwords={source:randomBytes(32).toString('base64url'),destination:randomBytes(32).toString('base64url')};
 requireThat(passwords.source!==passwords.destination,'TEST_PASSWORD_INDEPENDENCE_REJECTED');
 const source=roleURL(configs.source,'source',ROLES.test,passwords.source,cas.source.certPath);
 const destination=roleURL(configs.destination,'destination',ROLES.test,passwords.destination,cas.destination.certPath);
 const content='AUDIT_ENVIRONMENT="development"\r\nAUDIT_TEST_SOURCE_DATABASE_URL='+JSON.stringify(source)
  +'\r\nAUDIT_TEST_DESTINATION_DATABASE_URL='+JSON.stringify(destination)+'\r\n';
 privateWrite('.env.audit-test.local',content,sid,{newOnly:true});
 requireThat(privateRead('.env.audit-test.local',sid)===content,'PRIVATE_TEST_READBACK_REJECTED');
 }
 requireThat(Object.values(passwords).every(value=>/^[A-Za-z0-9_-]{43}$/.test(value))&&passwords.source!==passwords.destination,'PRIVATE_TEST_CREDENTIALS_REJECTED');
 await enableForRehearsal({configs,cas,passwords,onEvent:event=>emit('rehearsal-enablement',event)});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('rehearsal-enablement-stopped',{code:safeCode(e),automaticRetry:false});process.exitCode=1;}
}
