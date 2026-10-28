// Fixed TASK-014 rehearsal. Offline/import never read private files or connect.
// Connected execution belongs to the authorized DB executor in an exclusive
// producer/worker window; this script cannot establish external quiescence.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {createCaptureRuntime,createWorkerRuntime} from '../server/audit/runtime.ts';
import tls from 'node:tls';
import {verifyAuditApplicationPool} from '../server/audit/application.ts';
import {createAuditWorker,AuditPortFailure} from '../server/audit/worker.ts';
import {runAuditWorker} from '../server/audit/worker-loop.ts';
import {auditTransaction,enqueueAudit} from '../server/audit/capture.ts';
import {parseAuditEnvelope,auditEventExpiresAt} from '../server/audit/events.ts';
import {canonicalAuditJson,auditPayloadHash,AUDIT_HASH_VERSION} from '../server/audit/canonical.ts';
import {fixtureEnvelope,EVENT_IDS,RUN_ID,ROLES,SCENARIOS,assertCohort} from '../migrations/audit/runtime-contract.mjs';
import {privatePreflight,privateRead,readSettings,connection,trustedCA,client,connect,
 requireThat,safeCode,emit} from '../migrations/audit/runtime-support.mjs';
import {loadRehearsalScripts,rehearsalFunctionContracts} from '../migrations/audit/rehearsal-setup.mjs';
import {REHEARSAL_FILES} from '../migrations/audit/rehearsal-contract.mjs';
import {loadPrivateConfiguration} from '../migrations/audit/execute-runtime-setup.mjs';
import {INSTALL_SQL} from '../migrations/audit/execute-runtime-disabled.mjs';

export const COHORT_LIMIT=12;
export function absentDestinationObservation(value){
 return value?.receiptCount===0&&value.incidents===0&&value.hash===null
  &&value.receivedAt===null&&value.expiresAt===null;
}
export function preparedFixture(index,occurredAt=new Date().toISOString(),reason='UNAUTHENTICATED'){
 const envelope=parseAuditEnvelope(fixtureEnvelope(index,occurredAt,reason));
 const canonicalJson=canonicalAuditJson(envelope);
 return {envelope,canonicalJson,payloadHash:auditPayloadHash(canonicalJson),hashVersion:AUDIT_HASH_VERSION};
}
export function requireExclusiveWindow(value){requireThat(value===true,'EXCLUSIVE_RUNTIME_WINDOW_REQUIRED');}
export function guardedPorts(ports,observer,onClaim=()=>{}){
 return {...ports,claim:async(limit,signal)=>{
  requireThat(await observer.queueSafe(false),'UNRELATED_AUDIT_QUEUE');
  const rows=await ports.claim(limit,signal);
  // An unexpected ID is never accepted, acked, quarantined, retried or drained.
  // This detection is not a substitute for external producer quiescence.
  assertCohort(rows);for(const row of rows)onClaim(row);return rows;
 }};
}
const signal=()=>new AbortController().signal;
export async function actualWorkerRun(ports,{steps=1,wait,report=()=>{},onClaim=()=>{}}={}){
 const worker=createAuditWorker(ports,{batchSize:1,timeoutMs:5000,pollMs:100},{now:()=>Date.now(),random:()=>0});
 const result=await runAuditWorker(worker,signal(),report,{maxSteps:steps,healthEverySteps:1},wait||((ms)=>pause(ms)));
 return {...result,health:await worker.health(signal()),metrics:worker.snapshot()};
}
export async function runConnectedRehearsal({ports,exclusiveWindow,onEvent=()=>{},wait=ms=>pause(ms),
 now=()=>Date.now(),runWorker=actualWorkerRun,resumeOutage=false}){
 requireExclusiveWindow(exclusiveWindow);
 let stage='initial-gates',completed=false;
 const resources=new Set(),claims=[];
 const event=(detail={})=>onEvent({stage,...detail});
 const open=async count=>{
  requireThat(Number.isInteger(count)&&count>=1&&count<=2,'WORKER_CONNECTION_BUDGET');
  const opened=[];
  for(let i=0;i<count;i++){
   const runtime=await ports.openWorker();resources.add(runtime);opened.push(runtime);
  }return opened;
 };
 const close=async runtime=>{resources.delete(runtime);await runtime.close();};
 const guarded=runtime=>guardedPorts(runtime.ports,ports.source,row=>claims.push(row.event_id));
 const until=async timestamp=>{
  const delay=ports.source.delayUntil?await ports.source.delayUntil(timestamp):Math.max(0,new Date(timestamp).getTime()-now()+250);
  requireThat(Number.isFinite(delay)&&delay<=35000,'UNEXPECTED_REHEARSAL_WAIT');
  event({status:'waiting',milliseconds:delay});if(delay)await wait(delay);
 };
 const inspectPair=async index=>Promise.all([ports.source.inspect(EVENT_IDS[index]),ports.destination.inspect(EVENT_IDS[index])]);
 const delivered=async index=>{
  const [source,destination]=await inspectPair(index);
  requireThat(source?.status==='delivered'&&destination?.receiptCount===1&&source.hash===destination.hash,'COHORT_DELIVERY_NOT_PROVEN');
  requireThat(destination.incidents===(index===6?1:0),'UNEXPECTED_COHORT_INCIDENTS');
  return{source,destination};
 };
 const oneClaim=async(runtime,index)=>{
  const rows=await guarded(runtime).claim(1,signal());
  requireThat(rows.length===1&&rows[0].event_id===EVENT_IDS[index],'EXPECTED_COHORT_CLAIM_MISSING');return rows[0];
 };
 try{
  if(!resumeOutage){
  requireThat(await ports.source.allAbsent()&&await ports.destination.allAbsent(),'REHEARSAL_IDS_ALREADY_PRESENT');
  requireThat(await ports.source.queueSafe(true)&&await ports.destination.queueSafe(true),'INITIAL_REHEARSAL_QUEUE_NOT_EMPTY');
  await ports.assertFreshManifest();event({status:'passed',cohortSize:COHORT_LIMIT,exclusiveWindow:'executor-attested'});
  stage='rollback-visibility-and-enqueue-abort';await ports.rollbackProbes();
  requireThat(await ports.source.allAbsent()&&await ports.destination.allAbsent(),'ROLLBACK_FIXTURE_PERSISTED');event({status:'passed'});
  stage='permission-and-invalid-input-probes';await ports.permissionProbes();await ports.invalidExpiryProbes();
  requireThat(await ports.source.allAbsent()&&await ports.destination.allAbsent(),'INVALID_FIXTURE_PERSISTED');event({status:'passed'});
  stage='rollback-only-maintenance-boundaries';await ports.maintenanceRollbackProbes();
  requireThat(await ports.source.allAbsent()&&await ports.destination.allAbsent(),'MAINTENANCE_FIXTURE_PERSISTED');event({status:'passed'});

  stage='concurrent-workers';await ports.capture([2,3]);
  const concurrent=await open(2),seen=[];
  await Promise.all(concurrent.map(runtime=>runWorker(guardedPorts(runtime.ports,ports.source,row=>{
   claims.push(row.event_id);seen.push(row.event_id);
  }),{report:value=>event({worker:value})})));
  requireThat(seen.length===2&&new Set(seen).size===2&&seen.every(id=>[EVENT_IDS[2],EVENT_IDS[3]].includes(id)),'CONCURRENT_CLAIMS_NOT_DISTINCT');
  await delivered(2);await delivered(3);for(const runtime of concurrent)await close(runtime);event({status:'passed'});

  stage='claim-crash-and-real-lease-expiry';await ports.capture([4]);
  let [runtime]=await open(1);const crashed=await oneClaim(runtime,4);await close(runtime);
  await until(crashed.lease_until);[runtime]=await open(1);
  await runWorker(guarded(runtime));await delivered(4);
  requireThat(await runtime.ports.ack(crashed,signal())===false,'STALE_LEASE_ACK_SUCCEEDED');
  requireThat(Number((await ports.source.inspect(EVENT_IDS[4])).attempts)>=2,'LEASE_NOT_RECLAIMED');await close(runtime);event({status:'passed'});

  stage='commit-before-missing-ack';await ports.capture([5]);
  [runtime]=await open(1);const unacked=await oneClaim(runtime,5);
  requireThat(await runtime.ports.accept(unacked,signal())==='inserted','FIRST_RECEIPT_NOT_INSERTED');
  const first=await ports.destination.inspect(EVENT_IDS[5]);await close(runtime);
  await until(unacked.lease_until);[runtime]=await open(1);
  const redelivery=await runWorker(guarded(runtime));requireThat(redelivery.metrics.matching===1,'REDELIVERY_NOT_MATCHING');
  const after=await delivered(5);requireThat(first.receivedAt===after.destination.receivedAt&&first.hash===after.destination.hash,'FIRST_RECEIPT_CHANGED');
  await close(runtime);event({status:'passed'});

  stage='same-identity-destination-conflict';await ports.capture([6]);[runtime]=await open(1);
  const original=await oneClaim(runtime,6);requireThat(await runtime.ports.accept(original,signal())==='inserted','CONFLICT_BASE_NOT_INSERTED');
  const variant=preparedFixture(6,JSON.parse(original.canonical_json).occurredAt,'FORBIDDEN');
  requireThat(await runtime.ports.accept({...original,canonical_json:variant.canonicalJson,payload_hash:variant.payloadHash},signal())==='conflict','VARIANT_NOT_REJECTED');
  const conflict=await ports.destination.inspect(EVENT_IDS[6]);
  requireThat(conflict.receiptCount===1&&conflict.incidents===1&&conflict.hash===original.payload_hash,'CONFLICT_EVIDENCE_NOT_PRESERVED');
  // The original source envelope still matches its first receipt. Ack that
  // original; do not replay/quarantine or mutate payloads to manufacture cleanup.
  requireThat(await runtime.ports.ack(original,signal())===true,'ORIGINAL_CONFLICT_RECEIPT_NOT_ACKED');await delivered(6);
  await close(runtime);event({status:'passed'});
  }else{
   stage='exact-outage-resume-gates';await ports.assertFreshManifest();
   requireThat(await ports.source.queueSafe(false),'UNRELATED_AUDIT_QUEUE');
   for(let index=0;index<12;index++){
    const pair=await inspectPair(index);
    if(index>=2&&index<=6){await delivered(index);ports.resumePrepared(index,pair[0]);}
    else if(index===7){requireThat(pair[0]?.status==='pending'&&Number(pair[0].attempts)===1
     &&pair[0].lastErrorCode==='DESTINATION_UNAVAILABLE'&&absentDestinationObservation(pair[1]),'OUTAGE_RESUME_STATE_CHANGED');ports.resumePrepared(index,pair[0]);}
    else requireThat(pair[0]===null&&absentDestinationObservation(pair[1]),'UNEXPECTED_PARTIAL_COHORT_EVENT');
   }event({status:'passed',deliveredEventsPreserved:5,pendingEventResumed:1});
  }
  stage='transport-failure-and-catchup';if(!resumeOutage)await ports.capture([7]);let [runtime]=await open(1);
  let failOnce=true;const reports=[];const normal=guarded(runtime);
  const outage={...normal,accept:async(row,s)=>{if(failOnce){failOnce=false;
   await ports.appReadDuringOutage();requireThat((await ports.source.inspect(EVENT_IDS[7]))?.hash===row.payload_hash,'OUTAGE_QUEUE_CHANGED');
   throw new AuditPortFailure('DESTINATION_UNAVAILABLE');}return normal.accept(row,s);}};
  const caughtUp=await runWorker(outage,{steps:2,
   report:value=>{reports.push(value);event({worker:value});},
   wait:async()=>{const row=await ports.source.inspect(EVENT_IDS[7]);requireThat(row?.status==='pending','OUTAGE_NOT_RETRIED');await until(row.nextAttemptAt);}});
  requireThat(caughtUp.metrics.retried===1&&caughtUp.metrics.destinationFailures===1&&caughtUp.metrics.delivered===1,'OUTAGE_RECOVERY_NOT_PROVEN');
  requireThat(reports.some(r=>r.attention)&&reports.some(r=>r.recovered),'OUTAGE_HEALTH_RECOVERY_NOT_PROVEN');await delivered(7);
  await close(runtime);event({status:'passed'});

  stage='remaining-fixed-cohort-and-retention';await ports.capture([0,1,8,9,10,11]);[runtime]=await open(1);
  const tail=await runWorker(guarded(runtime),{steps:6,report:value=>event({worker:value})});
  requireThat(tail.metrics.delivered===6,'REMAINING_COHORT_NOT_DELIVERED');
  for(let i=0;i<COHORT_LIMIT;i++){
   const pair=await delivered(i),expiresAt=ports.expectedExpiry(i);
   requireThat(new Date(pair.source.expiresAt).getTime()===new Date(expiresAt).getTime()
    &&new Date(pair.destination.expiresAt).getTime()===new Date(expiresAt).getTime(),'RETENTION_OCCURRENCE_CLOCK_CHANGED');
  }
  requireThat(['pending','leased','quarantined','expired'].every(k=>tail.health[k]===0),'UNRESOLVED_DELIVERY_BACKLOG');
  await close(runtime);requireThat(claims.every(id=>EVENT_IDS.includes(id)),'NON_COHORT_CLAIM');event({status:'passed',uniqueCommittedEventLimit:COHORT_LIMIT});
  stage='preserve-cohort-outcomes';await ports.recordAndFinish();completed=true;
  event({status:'passed',cohortSize:COHORT_LIMIT,evidenceRetained:true});return{status:'passed',cohortSize:COHORT_LIMIT,evidenceRetained:true};
 }catch(error){event({status:'stopped',code:safeCode(error),evidenceRetained:true});throw error;}
 finally{
  for(const runtime of resources)try{await runtime.close();}catch{}
  await ports.close();if(!completed)onEvent({stage:'rehearsal-stopped',automaticRetry:false,cleanupDeletion:false});
 }
}

function selected(text,names){return readSettings(text.split(/\r?\n/).filter(line=>names.some(name=>
 new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line))).join('\n'));}
export function loadConnectedConfiguration(){
 const sid=privatePreflight();
 const app=selected(privateRead('.env',sid),['DATABASE_URL','AUDIT_CAPTURE_DATABASE_URL','AUDIT_ENVIRONMENT','AUDIT_ENABLED','AUDIT_WORKER_ENABLED','AUDIT_AUTH_EVENTS_ENABLED']);
 const worker=selected(privateRead('.env.audit-worker.local',sid),['AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL','AUDIT_ENVIRONMENT','AUDIT_WORKER_ENABLED']);
 const test=selected(privateRead('.env.audit-test.local',sid),['AUDIT_TEST_SOURCE_DATABASE_URL','AUDIT_TEST_DESTINATION_DATABASE_URL','AUDIT_ENVIRONMENT']);
 requireThat(app.AUDIT_ENVIRONMENT==='development'&&worker.AUDIT_ENVIRONMENT==='development'&&test.AUDIT_ENVIRONMENT==='development'
  &&app.AUDIT_ENABLED==='false'&&app.AUDIT_WORKER_ENABLED==='false'&&app.AUDIT_AUTH_EVENTS_ENABLED==='false'
  &&worker.AUDIT_WORKER_ENABLED==='false','PRIVATE_REHEARSAL_FLAGS_REJECTED');
 const urls={app:app.DATABASE_URL,capture:app.AUDIT_CAPTURE_DATABASE_URL,worker:worker.AUDIT_SOURCE_DATABASE_URL,
  writer:worker.AUDIT_DATABASE_URL,testSource:test.AUDIT_TEST_SOURCE_DATABASE_URL,testDestination:test.AUDIT_TEST_DESTINATION_DATABASE_URL};
 const cas={};
 for(const[k,value]of Object.entries(urls)){
  const target=['writer','testDestination'].includes(k)?'destination':'source';
  const role=k.startsWith('test')?ROLES.test:ROLES[k];const c=connection(value,target,role);
  cas[k]=trustedCA(c);
 }
 return {urls,cas,environment:{...app,...worker,AUDIT_ENABLED:'true',AUDIT_WORKER_ENABLED:'true',AUDIT_AUTH_EVENTS_ENABLED:'false'}};
}
async function writable(x,work,{rollback=false}={}){
 await x.query('BEGIN');await x.query('SET TRANSACTION READ WRITE');
 try{const answer=await work(x);const result=await x.query(rollback?'ROLLBACK':'COMMIT');
  requireThat(result.command===(rollback?'ROLLBACK':'COMMIT'),'REHEARSAL_TRANSACTION_UNCERTAIN');return answer;
 }catch(e){try{await x.query('ROLLBACK');}catch{}throw e;}
}
export async function nativeRehearsalPorts(configuration){
 const {urls,cas,environment}=configuration,observers={},prepared=new Map();
 const raw=async(key,work)=>{
  const target=['writer','testDestination'].includes(key)?'destination':'source';
  const role=key.startsWith('test')?ROLES.test:ROLES[key];let x;
  try{x=await client(urls[key],target,cas[key],role);await connect(x);return await work(x);}
  finally{if(x)await x.end();}
 };
 const observer=target=>({
  delayUntil:async timestamp=>Math.max(0,Number((await observers[target].query('SELECT extract(epoch FROM ($1::timestamptz-clock_timestamp()))*1000 AS milliseconds',[timestamp])).rows[0].milliseconds)+250),
  inspect:async id=>{requireThat(EVENT_IDS.includes(id),'OBSERVER_ID_REJECTED');return(await observers[target].query('SELECT audit_rehearsal.inspect($1) AS value',[id])).rows[0]?.value;},
  allAbsent:async()=>((await observers[target].query('SELECT audit_rehearsal.all_absent() AS value')).rows[0]?.value)===true,
  queueSafe:async empty=>((await observers[target].query('SELECT audit_rehearsal.queue_safe($1) AS value',[empty])).rows[0]?.value)===true,
 });
 try{
  const {default:pg}=await import('pg');const app=connection(urls.app,'source',ROLES.app);
  const appPool=new pg.Pool({host:app.host,port:5432,user:app.user,password:app.password,database:app.database,max:1,
   ssl:{ca:cas.app.pem,rejectUnauthorized:true,servername:app.host,checkServerIdentity:tls.checkServerIdentity,minVersion:'TLSv1.2'},
   options:'-c statement_timeout=5000 -c lock_timeout=1000',replication:'false',sslnegotiation:'postgres',connectionTimeoutMillis:10000,query_timeout:10000});
  appPool.on('error',()=>{});
  try{await verifyAuditApplicationPool(appPool,environment);}finally{await appPool.end();}
  const captureReady=await createCaptureRuntime(environment);try{await captureReady.ready();}finally{await captureReady.close();}
  const workerReady=await createWorkerRuntime(environment);try{await workerReady.ports.health(signal());}finally{await workerReady.close();}
  emit('runtime-factory-readiness',{status:'passed',actualApplicationPool:true,actualCaptureFactory:true,actualWorkerFactory:true,businessWrites:false});
  for(const target of ['source','destination']){
   const key=target==='source'?'testSource':'testDestination';observers[target]=await client(urls[key],target,cas[key],ROLES.test);await connect(observers[target]);
  }
  const source=observer('source'),destination=observer('destination');
  const expectDenied=async(x,sql,args=[])=>{
   let denied=false;await writable(x,async()=>{try{await x.query(sql,args);}catch(e){requireThat(e.code==='42501','UNEXPECTED_PERMISSION_PROBE_ERROR');denied=true;}},{rollback:true});
   requireThat(denied,'NEGATIVE_PERMISSION_PROBE_SUCCEEDED');
  };
  return {
   source,destination,
   resumePrepared:(index,metadata)=>{const event=preparedFixture(index,new Date(Date.parse(metadata.expiresAt)-31536000000).toISOString());
    requireThat(event.payloadHash===metadata.hash,'RESUME_COHORT_PAYLOAD_CHANGED');prepared.set(index,event);},
   appReadDuringOutage:()=>raw('app',async x=>{requireThat((await x.query('SELECT id FROM public.users LIMIT 0')).rows.length===0,'OUTAGE_APPLICATION_READ_FAILED');}),
   maintenanceRollbackProbes:async()=>{
    const{configs,cas:ownerCAs}=loadPrivateConfiguration();
    for(const target of ['source','destination']){let x;const owner=`fm_audit_${target}_owner`;
     try{x=await client(configs[target],target,ownerCAs[target]);await connect(x);
      const before=(await x.query(INSTALL_SQL.ownerMemberships,[owner])).rows;
      await writable(x,async()=>{
       await x.query("SET LOCAL lock_timeout='5s'");await x.query("SET LOCAL statement_timeout='10s'");
       await x.query(`GRANT ${owner} TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres`);
       await x.query(`SET LOCAL ROLE ${owner}`);
       if(target==='source'){
        await x.query('LOCK TABLE audit_capture.audit_outbox,audit_capture.maintenance_runs IN SHARE ROW EXCLUSIVE MODE');
        const safe=(await x.query(`SELECT NOT EXISTS(SELECT 1 FROM audit_capture.audit_outbox WHERE
         (status='delivered' AND delivered_at<=clock_timestamp()+interval '60 seconds'-interval '7 days')
         OR expires_at<=clock_timestamp()+interval '60 seconds') AND NOT EXISTS(SELECT 1 FROM audit_capture.maintenance_runs
         WHERE completed_at<=clock_timestamp()+interval '60 seconds'-interval '365 days' OR run_id=ANY($1::uuid[])) AS ok`,[EVENT_IDS])).rows[0]?.ok;
        requireThat(safe===true,'UNRELATED_RETENTION_CANDIDATES');
        const insert=async(index,at,status,deliveredAt)=>{const e=preparedFixture(index,at);
         await x.query(`INSERT INTO audit_capture.audit_outbox(event_id,canonical_json,envelope,payload_hash,hash_version,occurred_at,expires_at,status,delivered_at)
          VALUES($1::uuid,$2::text,($2::text)::jsonb,$3::text,$4::text,$5::timestamptz,$5::timestamptz+interval '31536000 seconds',$6::text,$7::timestamptz)`,
          [EVENT_IDS[index],e.canonicalJson,e.payloadHash,e.hashVersion,at,status,deliveredAt]);};
        const now=new Date().toISOString();await insert(10,now,'delivered',now);
        requireThat((await x.query('SELECT audit_capture.purge_delivered($1,1) AS n',[EVENT_IDS[10]])).rows[0]?.n===0,'FRESH_DELIVERY_PURGED');
        await insert(11,new Date(Date.now()-30*86400000).toISOString(),'delivered',new Date(Date.now()-8*86400000).toISOString());
        requireThat((await x.query('SELECT audit_capture.purge_delivered($1,1) AS n',[EVENT_IDS[11]])).rows[0]?.n===1,'OLD_DELIVERY_NOT_PURGED');
        await insert(9,new Date(Date.now()-366*86400000).toISOString(),'pending',null);
        requireThat((await x.query('SELECT audit_capture.dispose_expired($1,1) AS n',[EVENT_IDS[9]])).rows[0]?.n===1,'EXPIRED_PENDING_NOT_DISPOSED');
        requireThat((await x.query('SELECT count(*)::integer AS n FROM audit_capture.audit_outbox WHERE event_id=ANY($1::uuid[])',[EVENT_IDS])).rows[0]?.n===1,'SOURCE_RETENTION_BOUNDARY_CHANGED');
       }else{
        await x.query('LOCK TABLE audit.events,audit.integrity_incidents,audit.maintenance_runs IN SHARE ROW EXCLUSIVE MODE');
        const safe=(await x.query(`SELECT NOT EXISTS(SELECT 1 FROM audit.events WHERE expires_at<=clock_timestamp()+interval '60 seconds')
         AND NOT EXISTS(SELECT 1 FROM audit.integrity_incidents WHERE detected_at<=clock_timestamp()+interval '60 seconds'-interval '365 days')
         AND NOT EXISTS(SELECT 1 FROM audit.maintenance_runs WHERE completed_at<=clock_timestamp()+interval '60 seconds'-interval '365 days'
         OR run_id=ANY($1::uuid[])) AS ok`,[EVENT_IDS])).rows[0]?.ok;
        requireThat(safe===true,'UNRELATED_DESTINATION_RETENTION_CANDIDATES');
        for(const index of [9,10]){const at=new Date(Date.now()-(index===9?366:0)*86400000).toISOString(),e=preparedFixture(index,at);
         await x.query(`INSERT INTO audit.events(event_id,canonical_json,envelope,payload_hash,hash_version,occurred_at,expires_at)
          VALUES($1::uuid,$2::text,($2::text)::jsonb,$3::text,$4::text,$5::timestamptz,$5::timestamptz+interval '31536000 seconds')`,[EVENT_IDS[index],e.canonicalJson,e.payloadHash,e.hashVersion,at]);}
        const purged=(await x.query('SELECT * FROM audit.purge_expired($1,1)',[EVENT_IDS[9]])).rows[0];
        requireThat(purged?.events_purged===1&&purged.incidents_purged===0&&purged.runs_purged===0,'DESTINATION_RETENTION_BOUNDARY_CHANGED');
        requireThat((await x.query('SELECT count(*)::integer AS n FROM audit.events WHERE event_id=ANY($1::uuid[])',[EVENT_IDS])).rows[0]?.n===1,'FRESH_DESTINATION_PURGED');
       }
      },{rollback:true});
      const after=(await x.query(INSTALL_SQL.ownerMemberships,[owner])).rows;
      requireThat(JSON.stringify(before)===JSON.stringify(after),'RETENTION_OWNER_MEMBERSHIP_CHANGED');
     }finally{if(x)await x.end();}
    }
   },
   assertFreshManifest:async()=>{
    for(const target of ['source','destination']){
     const state=(await observers[target].query('SELECT audit_rehearsal.status() AS value')).rows[0]?.value;
     requireThat(state?.runId===RUN_ID&&state.completedAt===null&&state.passed===null&&state.synthetic===true
      &&state.cohort?.length===12&&state.cohort.every((c,i)=>c.eventId===EVENT_IDS[i]&&c.scenario===SCENARIOS[i]
       &&c.completedAt===null&&c.passed===null),'REHEARSAL_MANIFEST_NOT_FRESH');
    }
   },
   rollbackProbes:async()=>raw('app',async x=>{
    for(const index of [0,1]){
     let staged=false,hidden=false,contractRejected=false,rolledBack=false;
     const event=preparedFixture(index);
     const adapter={connect:async()=>({query:async(sql,args)=>{
      try{const result=await x.query(sql,args);
       if(sql==='ROLLBACK')rolledBack=(await x.query("SELECT to_regclass('pg_temp.audit_rehearsal_tx_probe') IS NULL AS absent")).rows[0]?.absent===true;
       return result;
      }catch(e){if(e.code==='22023')contractRejected=true;throw e;}
     },release:()=>{}})};
     let rejected=false;
     try{await auditTransaction(adapter,async transaction=>{
      await transaction.query('SET TRANSACTION READ WRITE');
      await transaction.query('CREATE TEMP TABLE audit_rehearsal_tx_probe(marker boolean NOT NULL) ON COMMIT DROP');
      await transaction.query('INSERT INTO audit_rehearsal_tx_probe VALUES(true)');staged=true;
      const executor=index===1?{query:(sql,args)=>transaction.query(sql,[args[0],'0'.repeat(64),args[2]])}:transaction;
      await enqueueAudit(executor,event);hidden=(await source.inspect(EVENT_IDS[index]))===null;
      if(index===0)throw new Error('CONTROLLED_REHEARSAL_ROLLBACK');
     });}catch{rejected=true;}
     requireThat(rejected&&staged&&rolledBack&&(index===0?hidden:contractRejected),'TRANSACTION_ROLLBACK_PROBE_FAILED');
     requireThat(await source.inspect(EVENT_IDS[index])===null,'ROLLED_BACK_ENQUEUE_VISIBLE');
    }
   }),
   permissionProbes:async()=>{
    for(const key of ['app','capture','worker','writer'])await raw(key,async x=>{
     const table=key==='writer'?'audit.events':'audit_capture.audit_outbox';
     await expectDenied(x,`SELECT canonical_json FROM ${table} WHERE false`);
     if(key==='capture')await expectDenied(x,'SELECT id FROM public.users WHERE false');
     if(key==='app'||key==='capture')await expectDenied(x,'SELECT audit_capture.ack(NULL::uuid,NULL::uuid)');
    });
    for(const target of ['source','destination']){
     await expectDenied(observers[target],'SELECT event_id FROM audit_rehearsal.cohort WHERE false');
     await expectDenied(observers[target],`SELECT canonical_json FROM ${target==='source'?'audit_capture.audit_outbox':'audit.events'} WHERE false`);
    }
   },
   invalidExpiryProbes:async()=>{
    await raw('capture',async x=>{
     const event=preparedFixture(8);let rejected=false;
     await writable(x,async()=>{try{await x.query('SELECT audit_capture.enqueue($1,$2,$3)',[event.canonicalJson,'0'.repeat(64),event.hashVersion]);}
      catch(e){requireThat(e.code==='22023','INVALID_CONTRACT_SQLSTATE_CHANGED');rejected=true;}},{rollback:true});
     requireThat(rejected,'INVALID_CONTRACT_ACCEPTED');
    });
    const expired=preparedFixture(9,new Date(Date.now()-366*86400000).toISOString());
    await raw('capture',async x=>{let rejected=false;await writable(x,async()=>{try{
     await x.query('SELECT audit_capture.enqueue($1,$2,$3)',[expired.canonicalJson,expired.payloadHash,expired.hashVersion]);
    }catch(e){requireThat(e.code==='22023','EXPIRED_ENQUEUE_SQLSTATE_CHANGED');rejected=true;}},{rollback:true});requireThat(rejected,'EXPIRED_SOURCE_ACCEPTED');});
    await raw('writer',async x=>writable(x,async()=>{
     requireThat((await x.query('SELECT audit.accept($1,$2,$3) AS value',[expired.canonicalJson,expired.payloadHash,expired.hashVersion])).rows[0]?.value==='expired','EXPIRED_DESTINATION_ACCEPTED');
    },{rollback:true}));
   },
   capture:async indexes=>{
    requireThat(indexes.length<=12&&new Set(indexes).size===indexes.length&&indexes.every(i=>Number.isInteger(i)&&i>=0&&i<12&&!prepared.has(i)),'FIXED_CAPTURE_SCOPE_REJECTED');
    const runtime=await createCaptureRuntime(environment);
    try{for(const index of indexes){const event=preparedFixture(index);prepared.set(index,event);await runtime.capture(event);}}
    finally{await runtime.close();}
   },
   openWorker:()=>createWorkerRuntime(environment),
   expectedExpiry:index=>{requireThat(prepared.has(index),'FIXTURE_NOT_PREPARED');return auditEventExpiresAt(prepared.get(index).envelope);},
   recordAndFinish:async()=>{
    for(const target of ['destination','source'])await writable(observers[target],async x=>{
     for(const id of EVENT_IDS)await x.query('SELECT audit_rehearsal.record($1,true)',[id]);
     await x.query('SELECT audit_rehearsal.finish(true)');
    });
    for(const target of ['source','destination']){
     const state=(await observers[target].query('SELECT audit_rehearsal.status() AS value')).rows[0]?.value;
     requireThat(state?.passed===true&&state.completedAt&&state.cohort.length===12
      &&state.cohort.every(c=>c.passed===true&&c.completedAt)&&Date.parse(state.retainUntil)>=Date.parse(state.completedAt)+31536000000,'COHORT_COMPLETION_EVIDENCE_MISSING');
    }
   },
   close:async()=>{for(const x of Object.values(observers))await x.end();},
  };
 }catch(e){for(const x of Object.values(observers))try{await x.end();}catch{}throw e;}
}
async function main(){
 const mode=process.argv[2];requireThat(mode==='offline'&&process.argv.length===3
  ||['connected','resume-outage'].includes(mode)&&process.argv.length===4&&process.argv[3]==='--exclusive-runtime-window','REHEARSAL_MODE_REJECTED');
 const scripts=loadRehearsalScripts();for(const target of ['source','destination'])rehearsalFunctionContracts(target,scripts.get(REHEARSAL_FILES[target]));
 for(let i=0;i<12;i++)preparedFixture(i);
 if(mode==='offline'){emit('connected-rehearsal-offline',{status:'passed',cohortSize:12,privateFileAccess:false,databaseAccess:false,fixturesExecuted:false});return;}
 const configuration=loadConnectedConfiguration();const ports=await nativeRehearsalPorts(configuration);
 await runConnectedRehearsal({ports,exclusiveWindow:true,resumeOutage:mode==='resume-outage',onEvent:value=>emit('connected-rehearsal',value)});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('rehearsal-stopped',{code:safeCode(e)});process.exitCode=1;}
}
