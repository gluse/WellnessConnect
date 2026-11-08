// Synthetic in-process HTTP only; no app/DB/config imports or external requests.
import assert from 'node:assert/strict';
import express from 'express';
import {createAuditContext} from '../server/audit/context.ts';
import {createAuditEvent,parseAuditEnvelope,auditEventExpiresAt} from '../server/audit/events.ts';
import {capturePreparedAudit,setAuditSink} from '../server/audit/http.ts';
import {locationObservationSchema,locationObservationEvent,setupLocationAuditRoutes} from '../server/audit/location.ts';
const userId='11111111-1111-4111-8111-111111111111';
const base={requestId:'22222222-2222-4222-8222-222222222222',operationId:'33333333-3333-4333-8333-333333333333',source:{application:'fitsmytime',environment:'development',component:'audit'},actor:{kind:'user',userId,effectiveRole:'support'},scope:{kind:'global'},target:{type:'request'}};
let checks=0;
for(const eventName of ['audit.records_viewed.v1','audit.records_exported.v1']) {
 const event=createAuditEvent(createAuditContext(base),{eventName,outcome:'succeeded',changes:[]});
 assert.equal(event.envelope.retentionClass,'R');checks++;
 for(const patch of [{actor:{kind:'anonymous'},scope:{kind:'unknown'}},{actor:{kind:'user',userId,effectiveRole:'provider'},scope:{kind:'personal',workspaceId:userId}},{source:{...base.source,component:'authorization'}},{target:{type:'user',id:userId}}]) {
  assert.throws(()=>createAuditEvent(createAuditContext({...base,...patch}),{eventName,outcome:'succeeded',changes:[]}));checks++;
 }
}
const dbContext={...base,actor:{kind:'service',serviceId:'database-runtime'},scope:{kind:'unknown'},target:{type:'database_record',id:'company_memberships:7|'+userId},source:{...base.source,component:'database'}};
for(const eventName of ['data.record_created.v1','data.record_updated.v1','data.record_deleted.v1']) {
 const event=createAuditEvent(createAuditContext(dbContext),{eventName,outcome:'succeeded',changes:[{field:'first_name',redacted:true}]});
 assert.equal(event.envelope.retentionClass,'B');checks++;
 for(const changes of [[],[{field:'email',before:'secret',after:'private',redacted:true}],[{field:'email'}],[{field:'email',redacted:true},{field:'email',redacted:true}],[{field:'unknown.field',redacted:true}]]) {
  assert.throws(()=>parseAuditEnvelope({...event.envelope,changes}));checks++;
 }
 for(const patch of [{actor:{kind:'user',userId,effectiveRole:'support'}},{scope:{kind:'global'}},{target:{type:'database_record',id:'users:secret@example.org'}}]) {
  assert.throws(()=>createAuditContext({...dbContext,...patch}));checks++;
 }
}
const location={stage:'requested',outcome:'requested',storageScope:'none',noticeVersion:'location-2026-11-07',language:'en'};
for(const language of ['en','lv','ru']) for(const actor of [{kind:'anonymous'},{kind:'user',userId,effectiveRole:'seeker'}]) {
 for(const patch of [{},{stage:'permission_observed',outcome:'granted'},{stage:'permission_observed',outcome:'already_granted'},{stage:'permission_observed',outcome:'denied'},{stage:'permission_observed',outcome:'timeout'},{stage:'permission_observed',outcome:'unavailable'},{stage:'permission_observed',outcome:'policy_blocked'},{stage:'remember_chosen',outcome:'remember',storageScope:'cookie'},{stage:'withdrawn',outcome:'forget',storageScope:'profile'}]) {
  const event=locationObservationEvent({...location,language,...patch},actor,'development');
  assert.equal(event.envelope.eventName,'location.observation_recorded.v1');
  assert.equal(event.envelope.retentionClass,'R');
  assert.ok(!event.canonicalJson.includes('latitude'));checks++;
 }
}
for(const patch of [{latitude:56.9},{longitude:24.1},{placeId:'secret'},{guestId:'tracking'},{stage:'requested',outcome:'granted'},{stage:'remember_chosen',outcome:'remember',storageScope:'none'},{stage:'permission_observed',outcome:'forget'},{language:'unsupported'}]) {
 assert.equal(locationObservationSchema.safeParse({...location,...patch}).success,false);checks++;
}
let received=[];
setAuditSink(async event=>{received.push(event);});
await capturePreparedAudit(locationObservationEvent(location,{kind:'anonymous'},'development'));
assert.equal(received.length,1);checks++;
setAuditSink(async()=>{throw Error('CANARY_private');});
const originalError=console.error;console.error=()=>{};
await assert.rejects(()=>capturePreparedAudit(locationObservationEvent(location,{kind:'anonymous'},'development')),error=>!error.message.includes('CANARY'));checks++;
console.error=originalError;setAuditSink();
const app=express();app.use(express.json());let unavailable=false;let verified=false;
setupLocationAuditRoutes(app,{environment:()=> 'development',verifyActor:async()=>{if(unavailable)throw Error('CANARY');return verified?{kind:'user',userId,effectiveRole:'provider'}:{kind:'anonymous'};},capture:async event=>{if(unavailable)throw Error('CANARY');received.push(event);}});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try {
 const endpoint=`http://127.0.0.1:${server.address().port}/api/audit/location-observations`;
 const post=body=>fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 let response=await post(location);assert.equal(response.status,204);checks++;
 verified=true;response=await post({...location,stage:'permission_observed',outcome:'denied'});assert.equal(response.status,204);assert.equal(received.at(-1).envelope.actor.userId,userId);checks++;
 const count=received.length;response=await post({...location,latitude:56});assert.equal(response.status,400);assert.equal(received.length,count);checks++;
 unavailable=true;response=await post(location);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('CANARY'));checks++;
} finally {await new Promise(resolve=>server.close(resolve));}
console.log(`Passed ${checks} audit producer/viewer/location policy and HTTP checks (synthetic; en/lv/ru).`);
