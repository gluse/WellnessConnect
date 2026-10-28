// Fixed TASK-014 development credential handoff. Private files first, then
// guarded password transactions; all runtime roles remain NOLOGIN throughout.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {ROOT,privatePath,privatePreflight,privateRead,privateWrite,readSettings,requireThat,emit,safeCode,client,connect} from './runtime-support.mjs';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {INSTALL_SQL,installedFunctionContracts,requireBooleans,readonly,deterministicPrecommitError} from './execute-runtime-disabled.mjs';
import {verifyExistingDestination} from './continue-runtime-source.mjs';
import {verifyLocationRuntime} from './search-location-runtime.mjs';
import {decodePrivateUtf8,makePrivateRuntimePlan} from './private-runtime-plan.mjs';
import {beginPrivateSession,bindRolePassword,finishPrivateSession,forgetPrivateSession} from './private-session.mjs';
import {ROLES} from './runtime-contract.mjs';
function selected(text,names){return readSettings(text.split(/\r?\n/).filter(line=>names.some(name=>
 new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line))).join('\n'));}
export async function verifyDisabledBeforeHandoff(configs,cas){
 for(const target of ['destination','source']){let x;
  try{x=await client(configs[target],target,cas[target]);await connect(x);
   if(target==='destination')await verifyExistingDestination(x);
   else{
    const before=await readonly(x,async()=>{
     requireBooleans(await x.query(INSTALL_SQL.groups,[['fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor']]),'BASE_GROUPS_REJECTED');
     requireBooleans(await x.query(INSTALL_SQL.functions,[JSON.stringify(installedFunctionContracts('source'))]),'INSTALLED_FUNCTIONS_REJECTED');
     const memberships=(await x.query(INSTALL_SQL.ownerMemberships,['fm_audit_source_owner'])).rows;
     requireThat(memberships.length>0&&memberships.some(r=>r.admin_option===true)
      &&memberships.every(r=>!r.inherit_option&&!r.set_option),'OWNER_BASELINE_REJECTED');return{memberships};
    });
    await verifyLocationRuntime(x,before);
   }
  }finally{if(x)try{await x.end();}catch{}}
 }
}
export async function provisionPreparedPasswords({configs,cas,passwords,preparedFilesVerified=false,
 makeClient=client,open=connect,secureBegin=beginPrivateSession,bind=bindRolePassword,finish=finishPrivateSession,onEvent=()=>{}}){
 requireThat(preparedFilesVerified===true,'PRIVATE_HANDOFF_NOT_VERIFIED');
 const commits={destination:'not-attempted',source:'not-attempted'};let target;
 for(target of ['destination','source']){let x,stage='private-session-guard';
  try{x=await makeClient(configs[target],target,cas[target]);await open(x);await secureBegin(x);
   stage='password-transaction';commits[target]='uncertain';
   for(const key of target==='destination'?['writer']:['app','capture','worker'])await bind(x,target,ROLES[key],passwords[key]);
   stage='password-commit';await finish(x,true);commits[target]='committed';
   onEvent({stage:'runtime-password-provisioning',target,status:'committed',commits:{...commits},loginsEnabled:false});
  }catch(e){
   if(x){forgetPrivateSession(x);try{const r=await x.query('ROLLBACK');
    if(stage==='password-transaction'&&deterministicPrecommitError(e)&&r.command==='ROLLBACK')commits[target]='rolled-back';
   }catch{}}
   onEvent({stage,target,status:'stopped',code:safeCode(e),commits:{...commits},loginsEnabled:false});throw e;
  }finally{if(x)try{await x.end();}catch{}}
 }return{commits};
}
async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');const{configs,cas}=loadPrivateConfiguration(),sid=privatePreflight();
 for(const name of ['.env.audit-before-runtime.local','.env.audit-setup.local','.env.audit-worker.local'])
  requireThat(!fs.existsSync(privatePath(name)),'PRIVATE_HANDOFF_ALREADY_STARTED');
 await verifyDisabledBeforeHandoff(configs,cas);
 const verifiedText=privateRead('.env',sid),bytes=fs.readFileSync(privatePath('.env'));
 const original=decodePrivateUtf8(bytes);requireThat(original===verifiedText,'PRIVATE_INPUT_CHANGED');
 const existing=selected(original,['AUDIT_ENABLED','AUDIT_WORKER_ENABLED']);
 requireThat(![existing.AUDIT_ENABLED,existing.AUDIT_WORKER_ENABLED].includes('true'),'EXISTING_AUDIT_RUNTIME_MUST_BE_STOPPED');
 const passwords=Object.fromEntries(['app','capture','worker','writer'].map(key=>[key,randomBytes(32).toString('base64url')]));
 requireThat(new Set(Object.values(passwords)).size===4,'PRIVATE_PASSWORD_INDEPENDENCE_REJECTED');
 const plan=makePrivateRuntimePlan(original,configs,cas,passwords);
 // All file I/O completes before any private-session transaction begins.
 privateWrite('.env.audit-before-runtime.local',bytes,sid,{newOnly:true});
 privateWrite('.env.audit-setup.local',plan.setup,sid,{newOnly:true});
 privateWrite('.env.audit-worker.local',plan.worker,sid,{newOnly:true});
 requireThat(privateRead('.env',sid)===original,'PRIVATE_INPUT_CHANGED');
 privateWrite('.env',plan.app,sid,{expectedContent:bytes});
 requireThat(privateRead('.env.audit-before-runtime.local',sid)===original&&privateRead('.env.audit-setup.local',sid)===plan.setup
  &&privateRead('.env.audit-worker.local',sid)===plan.worker&&privateRead('.env',sid)===plan.app,'PRIVATE_HANDOFF_READBACK_REJECTED');
 const app=selected(plan.app,['DATABASE_URL','AUDIT_CAPTURE_DATABASE_URL','AUDIT_ENABLED','AUDIT_WORKER_ENABLED','AUDIT_AUTH_EVENTS_ENABLED',
  'AUDIT_SETUP_SOURCE_DATABASE_URL','AUDIT_SETUP_DESTINATION_DATABASE_URL','AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL']);
 requireThat(app.DATABASE_URL===plan.urls.app&&app.AUDIT_CAPTURE_DATABASE_URL===plan.urls.capture
  &&app.AUDIT_ENABLED==='false'&&app.AUDIT_WORKER_ENABLED==='false'&&app.AUDIT_AUTH_EVENTS_ENABLED==='false'
  &&['AUDIT_SETUP_SOURCE_DATABASE_URL','AUDIT_SETUP_DESTINATION_DATABASE_URL','AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL']
   .every(key=>!Object.hasOwn(app,key)),'PRIVATE_HANDOFF_SCOPE_REJECTED');
 emit('private-runtime-files',{status:'verified',protectedBackupPreserved:true,setupSeparated:true,workerSeparated:true,
  credentialValuesPrinted:false,loginsEnabled:false,applicationCutover:false});
 await provisionPreparedPasswords({configs,cas,passwords,preparedFilesVerified:true,onEvent:value=>emit('private-runtime-provisioning',value)});
 emit('private-runtime-provisioning-complete',{status:'passed',loginsEnabled:false,flagsEnabled:false,
  note:'Protected files persisted and password transactions committed; actual restricted logins/rehearsal still pending.'});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('private-runtime-provisioning-stopped',{code:safeCode(e),
  recovery:'Preserve protected backup/setup/worker files; keep audit flags false; do not rerun or restore owner runtime URLs.'});process.exitCode=1;}
}
