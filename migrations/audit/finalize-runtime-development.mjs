// Fixed TASK-014 dev finalization. No daemon, payload deletion or password SQL.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {loadConnectedConfiguration} from '../../scripts/rehearse-audit-db.mjs';
import {privatePreflight,privateRead,privateWrite,readSettings,client,connect,requireThat,emit,safeCode} from './runtime-support.mjs';
import {patchPrivateEnvironment} from './private-runtime-plan.mjs';
import {verifyActiveRuntime} from './runtime-active-profile.mjs';
import {EVENT_IDS,RUN_ID,ROLES} from './runtime-contract.mjs';
import {REHEARSAL_APIS} from './rehearsal-contract.mjs';
import {runAuditWorkerRuntime} from '../../server/audit/worker-loop.ts';

export function requireCompletedCohort(state){
 requireThat(state?.runId===RUN_ID&&state.passed===true&&state.completedAt&&state.cohort?.length===12
  &&new Set(state.cohort.map(c=>c.eventId)).size===12
  &&state.cohort.every(c=>EVENT_IDS.includes(c.eventId)&&c.passed===true&&c.completedAt)
  &&Date.parse(state.retainUntil)>=Date.parse(state.completedAt)+31536000000,'COMPLETED_COHORT_REQUIRED');
}
const ownerSnapshot=`SELECT m.roleid,m.member,m.grantor,m.admin_option,m.inherit_option,m.set_option,
 m.grantor=current_user::regrole AS self_grantor FROM pg_catalog.pg_auth_members m
 WHERE m.roleid=$1::regrole AND m.member=current_user::regrole ORDER BY m.grantor`;
export async function revokeTestAccess(x,target){
 requireThat(['source','destination'].includes(target),'FINALIZE_TARGET_REJECTED');
 let committing=false;
 try{
  await x.query('BEGIN');await x.query('SET TRANSACTION READ WRITE');
  await x.query('ALTER ROLE fmt_audit_test_dev NOLOGIN');
  for(const owner of ['fm_audit_rehearsal_owner',`fm_audit_${target}_owner`]){
   const before=(await x.query(ownerSnapshot,[owner])).rows;
   const self=before.find(r=>r.self_grantor);
   await x.query(`GRANT ${owner} TO CURRENT_USER WITH ADMIN ${self?.admin_option?'TRUE':'FALSE'}, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER`);
   await x.query(`SET LOCAL ROLE ${owner}`);
   const functions=REHEARSAL_APIS.filter(([name])=>['inspect','all_absent','queue_safe'].includes(name)===(owner!== 'fm_audit_rehearsal_owner'));
   for(const[name,args]of functions)await x.query(`REVOKE EXECUTE ON FUNCTION audit_rehearsal.${name}(${args}) FROM fmt_audit_test_dev`);
   if(owner==='fm_audit_rehearsal_owner')await x.query('REVOKE USAGE ON SCHEMA audit_rehearsal FROM fmt_audit_test_dev');
   await x.query('RESET ROLE');
   if(self)await x.query(`GRANT ${owner} TO CURRENT_USER WITH ADMIN ${self.admin_option?'TRUE':'FALSE'}, INHERIT ${self.inherit_option?'TRUE':'FALSE'}, SET ${self.set_option?'TRUE':'FALSE'} GRANTED BY CURRENT_USER`);
   else await x.query(`REVOKE ${owner} FROM CURRENT_USER GRANTED BY CURRENT_USER RESTRICT`);
   requireThat(JSON.stringify((await x.query(ownerSnapshot,[owner])).rows)===JSON.stringify(before),'FINALIZE_OWNER_RESTORE_REJECTED');
   const inert=(await x.query("SELECT NOT pg_has_role(current_user,$1,'USAGE') AND NOT pg_has_role(current_user,$1,'SET') AS ok",[owner])).rows[0];
   requireThat(inert?.ok===true,'FINALIZE_OWNER_ACCESS_REJECTED');
  }
  committing=true;const result=await x.query('COMMIT');
  requireThat(result.command==='COMMIT','FINALIZE_COMMIT_UNCERTAIN');return 'committed';
 }catch(e){try{await x.query('ROLLBACK');}catch{}if(committing)e.safeCode='FINALIZE_COMMIT_UNCERTAIN';throw e;}
}
function selectFlags(text){return readSettings(text.split(/\r?\n/).filter(line=>/^\s*(?:export\s+)?AUDIT_(?:ENABLED|WORKER_ENABLED|AUTH_EVENTS_ENABLED)\s*=/.test(line)).join('\n'));}
async function main(){
 requireThat(process.argv.length===2,'FINALIZE_MODE_REJECTED');
 const configuration=loadConnectedConfiguration(),{configs,cas}=loadPrivateConfiguration(),sid=privatePreflight();
 const xs={},commits={destination:'not-attempted',source:'not-attempted'};let stage='finalize-cohort-proof',target;
 try{
  for(target of ['destination','source']){
   const key=target==='source'?'testSource':'testDestination';let test;
   try{
    test=await client(configuration.urls[key],target,configuration.cas[key],ROLES.test);await connect(test);
    requireCompletedCohort((await test.query('SELECT audit_rehearsal.status() AS value')).rows[0]?.value);
    for(let i=0;i<12;i++){
     const row=(await test.query('SELECT audit_rehearsal.inspect($1) AS value',[EVENT_IDS[i]])).rows[0]?.value;
     requireThat(target==='source'?row?.status==='delivered':row?.receiptCount===1&&row.incidents===(i===6?1:0),'FINAL_COHORT_STATE_CHANGED');
    }
   }finally{if(test)await test.end();}
   xs[target]=await client(configs[target],target,cas[target]);await connect(xs[target]);
   await verifyActiveRuntime(xs[target],target,{testAccess:'enabled'});
  }
  for(target of ['destination','source']){
   stage='revoke-test-access';commits[target]='uncertain';commits[target]=await revokeTestAccess(xs[target],target);
   stage='final-active-profile';const result=await verifyActiveRuntime(xs[target],target,{testAccess:'disabled'});
   emit(stage,{target,status:'verified',profile:result.profile,testLogin:false,testExecute:false,commits:{...commits}});
  }
  stage='activate-protected-flags';
  const appBefore=privateRead('.env',sid),workerBefore=privateRead('.env.audit-worker.local',sid);
  const app=patchPrivateEnvironment(appBefore,{AUDIT_ENABLED:'true',AUDIT_WORKER_ENABLED:'false',AUDIT_AUTH_EVENTS_ENABLED:'false'});
  const worker=patchPrivateEnvironment(workerBefore,{AUDIT_WORKER_ENABLED:'true'});
  privateWrite('.env.audit-worker.local',worker,sid,{expectedContent:Buffer.from(workerBefore)});
  privateWrite('.env',app,sid,{expectedContent:Buffer.from(appBefore)});
  requireThat(privateRead('.env',sid)===app&&privateRead('.env.audit-worker.local',sid)===worker,'ACTIVE_PRIVATE_READBACK_REJECTED');
  const appFlags=selectFlags(app),workerFlags=selectFlags(worker);
  requireThat(appFlags.AUDIT_ENABLED==='true'&&appFlags.AUDIT_WORKER_ENABLED==='false'&&appFlags.AUDIT_AUTH_EVENTS_ENABLED==='false'
   &&workerFlags.AUDIT_WORKER_ENABLED==='true','ACTIVE_PRIVATE_FLAGS_REJECTED');
  emit(stage,{status:'verified',captureEnabled:true,workerEnabled:true,remoteAuthEventsEnabled:false});
  stage='bounded-command-readiness';
  const result=await runAuditWorkerRuntime(configuration.environment,new AbortController().signal,report=>{
   requireThat(report.status==='healthy'&&report.metrics.claimed===0&&report.health.pending===0&&report.health.leased===0
    &&report.health.quarantined===0&&report.health.expired===0,'FINAL_WORKER_READINESS_REJECTED');emit(stage,report);
  },{maxSteps:1,healthEverySteps:1});
  requireThat(result?.steps===1,'FINAL_WORKER_LOOP_MISSING');
  emit('development-audit-ready',{status:'passed',cohortSize:12,evidenceRetained:true,testAccessDisabled:true,backgroundProcess:false,httpServerStarted:false});
 }catch(e){emit('development-finalization-stopped',{stage,target,code:safeCode(e),commits,automaticRetry:false});throw e;}
 finally{for(const x of Object.values(xs))try{await x.end();}catch{}}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('development-finalization-failed',{code:safeCode(e)});process.exitCode=1;}
}
