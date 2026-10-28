// Actual worker+daemon loop with injected ports/clock waits; no files/DB/network.
import assert from 'node:assert/strict';
import {createAuditWorker,emptyWorkerMetrics} from '../server/audit/worker.ts';
import {auditWorkerReport,runAuditWorker,runAuditWorkerRuntime} from '../server/audit/worker-loop.ts';
const healthy={pending:0,leased:0,quarantined:0,expired:0,oldestAgeSeconds:0};
const metrics=emptyWorkerMetrics();
assert.equal(auditWorkerReport(metrics,healthy).status,'healthy');
for(const health of [undefined,{...healthy,quarantined:1},{...healthy,expired:1},{...healthy,oldestAgeSeconds:300}])assert.equal(auditWorkerReport(metrics,health).attention,true);
for(const key of ['sourceFailures','destinationFailures','captureGaps'])assert.equal(auditWorkerReport({...metrics,[key]:1},healthy).attention,true);
assert.equal(auditWorkerReport({...metrics,sourceFailures:1},healthy,{...metrics,sourceFailures:1},true).recovered,true);
assert.equal(auditWorkerReport(metrics,{...healthy,oldestAgeSeconds:299}).attention,false);
function fixture(){let steps=0,healthCalls=0;const ports={
 async claim(){steps++;return[];},async accept(){assert.fail();},async ack(){assert.fail();},async retry(){assert.fail();},async quarantine(){assert.fail();},
 async health(){healthCalls++;return healthy;}};
 return {ports,get steps(){return steps;},get healthCalls(){return healthCalls;}};}
let f=fixture(),reports=[],waits=0;
let result=await runAuditWorker(createAuditWorker(f.ports),new AbortController().signal,r=>reports.push(r),
 {healthEverySteps:3,maxSteps:5},async ms=>{assert.equal(ms,1000);waits++;});
assert.equal(result.steps,5);assert.equal(f.steps,5);assert.equal(waits,4);assert.equal(f.healthCalls,3);assert.equal(reports.length,3);
assert.ok(reports.every(r=>r.status==='healthy'));

// Actual worker catches a transient claim outage; daemon signals attention, then
// recovery once no further failures occur and health has caught up.
f=fixture();let claims=0;f.ports.claim=async()=>{if(++claims===1)throw Error('CANARY_private_driver');return[];};
reports=[];await runAuditWorker(createAuditWorker(f.ports),new AbortController().signal,r=>reports.push(r),{healthEverySteps:1,maxSteps:2},async()=>{});
assert.deepEqual(reports.map(r=>[r.attention,r.recovered]),[[true,false],[false,true]]);
assert.equal(reports[0].metrics.sourceFailures,1);assert.equal(JSON.stringify(reports).includes('CANARY'),false);
f=fixture();let reads=0;f.ports.health=async()=>{if(++reads===1)throw Error('CANARY_private_driver');return healthy;};
reports=[];await runAuditWorker(createAuditWorker(f.ports),new AbortController().signal,r=>reports.push(r),{healthEverySteps:1,maxSteps:2},async()=>{});
assert.deepEqual(reports.map(r=>r.status),['unavailable','healthy']);assert.equal(reports[1].recovered,true);
assert.equal(JSON.stringify(reports).includes('CANARY'),false);

const preaborted=new AbortController();preaborted.abort();let opened=0;
assert.equal(await runAuditWorkerRuntime({},preaborted.signal,()=>assert.fail(),undefined,{open:async()=>{opened++;throw Error();},wait:async()=>{}}),undefined);
assert.equal(opened,0);
for(const failure of ['none','report','wait','health','abort']){
 f=fixture();let closed=0,waited=0;const stop=new AbortController();
 if(failure==='health')f.ports.health=async()=>{throw Error('CANARY_health');};
 const work=()=>runAuditWorkerRuntime({},stop.signal,report=>{if(failure==='report')throw Error('report-failure');if(failure==='health')assert.equal(report.status,'unavailable');},
  {healthEverySteps:1,maxSteps:2},{open:async()=>({ports:f.ports,async close(){closed++;}}),
   wait:async()=>{waited++;if(failure==='wait')throw Error('wait-failure');if(failure==='abort'){stop.abort();throw Error('aborted');}}});
 if(['report','wait'].includes(failure))await assert.rejects(work);else await work();
 assert.equal(closed,1);assert.equal(f.steps,failure==='none'||failure==='health'?2:1);
 assert.equal(waited,failure==='report'?0:1);
}
// Invalid bounded-run options fail and still close the opened runtime.
f=fixture();let closed=0;
await assert.rejects(()=>runAuditWorkerRuntime({},new AbortController().signal,()=>assert.fail(),{healthEverySteps:0},
 {open:async()=>({ports:f.ports,async close(){closed++;}}),wait:async()=>assert.fail()}));
assert.equal(closed,1);assert.equal(f.steps,0);
console.log('Passed: actual worker daemon bounded cadence, transient failure/recovery, unavailable health, attention thresholds, cancellation and finally-close; offline injected ports only.');
