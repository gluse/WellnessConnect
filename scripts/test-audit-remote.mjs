import assert from 'node:assert/strict';
import {setAuditSink} from '../server/audit/http.ts';
import {auditRemoteOperation} from '../server/audit/remote.ts';
const userId='11111111-1111-4111-8111-111111111111';
const req={user:{claims:{sub:userId}},auditPersonalRole:'provider'};
const operations=['login','signup','oauth_start','oauth_callback','recovery','invite_session','invite_password','logout','password_verify','password_change','session_refresh','profile_update'];
let checks=0,events=[],effects=0;
const originalError=console.error;console.error=()=>{};
try {
 for(const operation of operations) for(const [status,outcome,reason] of [[null,'succeeded',undefined],[400,'rejected','INVALID_INPUT'],[401,'denied','INVALID_CREDENTIALS'],[403,'denied','INVALID_CREDENTIALS'],[429,'denied','RATE_LIMITED'],[503,'failed','PROVIDER_UNAVAILABLE']]) {
  events=[];setAuditSink(async event=>events.push(event));
  const result={error:status?{status,message:'CANARY_private_payload'}:null,data:{password:'CANARY_password'}};
  assert.equal(await auditRemoteOperation(req,operation,async()=>{assert.equal(events.length,1,'Intent persists before any provider effect');effects++;return result;}),result);
  assert.equal(events.length,2);assert.equal(events[0].envelope.eventName,'auth.operation_requested.v1');assert.equal(events[1].envelope.eventName,'auth.operation_reported.v1');
  assert.equal(events[1].envelope.parentEventId,events[0].envelope.eventId);assert.equal(events[1].envelope.operationId,events[0].envelope.operationId);
  assert.equal(events[1].envelope.outcome,outcome);assert.equal(events[1].envelope.reasonCode,reason);
  assert.ok(!JSON.stringify(events).includes('CANARY'));checks++;
 }
 events=[];setAuditSink(async event=>events.push(event));
 const thrown=new Error('CANARY_network');
 await assert.rejects(()=>auditRemoteOperation({},'login',async()=>{throw thrown;}),error=>error===thrown);
 assert.equal(events.length,2);assert.equal(events[1].envelope.outcome,'unknown');assert.equal(events[1].envelope.reasonCode,'PROVIDER_TIMEOUT');checks++;
 let effectCalled=false;setAuditSink(async()=>{throw Error('CANARY_capture');});
 await assert.rejects(()=>auditRemoteOperation(req,'password_change',async()=>{effectCalled=true;return{error:null};}),error=>error.status===503);
 assert.equal(effectCalled,false,'Capture failure leaves remote state untouched');checks++;
 events=[];setAuditSink(async event=>{if(event.envelope.eventName==='auth.operation_reported.v1')throw Error('CANARY_capture_after_success');events.push(event);});
 let writes=0;
 await assert.rejects(()=>auditRemoteOperation(req,'password_change',async()=>{writes++;return{error:null};}),error=>error.status===503);
 assert.equal(writes,1);assert.equal(events.length,1);assert.equal(events[0].envelope.eventName,'auth.operation_requested.v1');checks++;
 events=[];setAuditSink(async event=>events.push(event),undefined,{authEvents:false});
 await auditRemoteOperation({},'login',async()=>({error:null}));assert.equal(events.length,0);checks++;
} finally {setAuditSink();console.error=originalError;}
console.log(`Passed ${checks} durable Auth intent/outcome tests; all effects synthetic, no provider/database access.`);
