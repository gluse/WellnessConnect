import assert from 'node:assert/strict';
import {setAuditSink} from '../server/audit/http.ts';
import {auditIntegration} from '../server/audit/integrations.ts';
import {geocodeAddress} from '../server/geocoding.ts';
let checks=0,events=[];const originalError=console.error;console.error=()=>{};
try {
 for(const operation of ['geocoding','embedding','notification_batch','activity_batch']) {
  events=[];setAuditSink(async event=>events.push(event));
  const result={privateInput:'CANARY_address_search_text',privateOutput:'CANARY_embedding'};
  assert.equal(await auditIntegration(operation,async()=>{assert.equal(events.length,1);return result;}),result);
  assert.equal(events.length,2);assert.equal(events[0].envelope.eventName,'integration.operation_requested.v1');
  assert.equal(events[1].envelope.eventName,'integration.operation_reported.v1');assert.equal(events[1].envelope.outcome,'succeeded');
  assert.equal(events[1].envelope.actor.serviceId,'integration-runtime');assert.equal(events[1].envelope.scope.kind,'unknown');
  assert.equal(events[1].envelope.parentEventId,events[0].envelope.eventId);assert.equal(events[1].envelope.retentionClass,'R');
  assert.ok(!JSON.stringify(events).includes('CANARY'));checks++;
  events=[];await auditIntegration(operation,async()=>({ok:false}),value=>value.ok);
  assert.equal(events[1].envelope.outcome,'failed');assert.equal(events[1].envelope.reasonCode,'PROVIDER_UNAVAILABLE');checks++;
  events=[];const error=Error('CANARY_network');
  await assert.rejects(()=>auditIntegration(operation,async()=>{throw error;}),value=>value===error);
  assert.equal(events[1].envelope.outcome,'unknown');assert.equal(events[1].envelope.reasonCode,'PROVIDER_TIMEOUT');checks++;
 }
 let effect=false;setAuditSink(async()=>{throw Error('CANARY_capture');});
 await assert.rejects(()=>auditIntegration('embedding',async()=>{effect=true;return[];}),error=>error.status===503);assert.equal(effect,false);checks++;
 events=[];setAuditSink(async event=>{if(event.envelope.eventName.endsWith('reported.v1'))throw Error('CANARY_capture');events.push(event);});
 let calls=0;await assert.rejects(()=>auditIntegration('notification_batch',async()=>{calls++;return{processed:1};}),error=>error.status===503);
 assert.equal(calls,1);assert.equal(events.length,1);checks++;
 setAuditSink(async event=>events.push(event));
 process.env.GOOGLE_GEOCODING_API_KEY='synthetic_geocoding_key';
 for(const status of ['OK','ZERO_RESULTS','REQUEST_DENIED','OVER_QUERY_LIMIT']) {
  events=[];
  const request=async()=>new Response(JSON.stringify({status,results:status==='OK'?[{geometry:{location:{lat:56,lng:24}},formatted_address:'CANARY_address'}]:[]}));
  if(status==='OK')assert.equal((await geocodeAddress('CANARY_address',request)).lat,56);
  else await assert.rejects(()=>geocodeAddress('CANARY_address',request));
  assert.equal(events.length,2);assert.equal(events[1].envelope.outcome,status==='OK'?'succeeded':'failed');
  assert.ok(!JSON.stringify(events).includes('CANARY'));checks++;
 }
 const originalFetch=globalThis.fetch;
 try {
  process.env.OPENAI_API_KEY='synthetic_embedding_key';
  globalThis.fetch=async input=>{
   assert.equal(new URL(typeof input==='string'?input:input.url).origin,'https://api.openai.com');
   return new Response(JSON.stringify({object:'list',model:'text-embedding-3-small',data:[{object:'embedding',index:0,embedding:Buffer.from(new Float32Array([0.25,0.5]).buffer).toString('base64')}],usage:{prompt_tokens:1,total_tokens:1}}),{headers:{'content-type':'application/json'}});
  };
  const {generateEmbedding,generateEmbeddings}=await import('../server/embeddings.ts');
  events=[];assert.deepEqual(await generateEmbedding('CANARY_search_text'),[0.25,0.5]);
  assert.equal(events.length,2);assert.equal(events[1].envelope.outcome,'succeeded');assert.ok(!JSON.stringify(events).includes('CANARY'));checks++;
  events=[];assert.deepEqual(await generateEmbeddings(['CANARY_search_text']),[[0.25,0.5]]);
  assert.equal(events.length,2);assert.equal(events[1].envelope.outcome,'succeeded');checks++;
 } finally {globalThis.fetch=originalFetch;}
} finally {setAuditSink();console.error=originalError;}
console.log(`Passed ${checks} integration/job audit tests (all effects synthetic; no paid services, jobs or database).`);
