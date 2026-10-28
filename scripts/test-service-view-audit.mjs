// Actual handler/event/capture with synthetic boundaries; no dotenv/DB/Auth/HTTP.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setupServiceViewRoutes} from '../server/serviceViewRoutes.ts';
import {setAuditSink} from '../server/audit/http.ts';
import {createAuditContext} from '../server/audit/context.ts';
import {createAuditEvent,parseAuditEnvelope,auditEventExpiresAt} from '../server/audit/events.ts';
const userId='11111111-1111-4111-8111-111111111111';
const context={actor:{kind:'anonymous'},scope:{kind:'unknown'},target:{type:'service',id:'42'},
 source:{application:'fitsmytime',environment:'development',component:'service'},requestId:randomUUID(),operationId:randomUUID()};
const action={eventName:'service.viewed.v1',outcome:'succeeded',changes:[]};
const event=createAuditEvent(createAuditContext(context),action,{now:()=>new Date('2026-10-23T12:00:00.000Z'),newId:randomUUID});
assert.equal(event.envelope.retentionClass,'R');assert.equal(auditEventExpiresAt(event.envelope),'2027-01-21T12:00:00.000Z');
assert.deepEqual(parseAuditEnvelope(event.envelope),event.envelope);
for(const patch of [{retentionClass:'B'},{retentionClass:'S'},{changes:[{field:'name',redacted:true}]},
 {outcome:'denied',reasonCode:'FORBIDDEN'},{reasonCode:'NO_CHANGE'},{source:{...context.source,component:'auth'}},
 {scope:{kind:'personal',workspaceId:userId}},{target:{type:'request'}},
 {actor:{kind:'user',userId,effectiveRole:'support'}},{target:{type:'service',id:'2147483648'}},
 {actor:{kind:'anonymous',userId}},{search:'CANARY_query'}])assert.throws(()=>parseAuditEnvelope({...event.envelope,...patch}));
// Existing contracts cannot reuse the new resolved anonymous target or R retention.
assert.throws(()=>parseAuditEnvelope({...event.envelope,eventName:'auth.oauth_started.v1',retentionClass:'S'}));
const captured=[],gaps=[],originalError=console.error,oldAudit=process.env.AUDIT_ENABLED,oldViews=process.env.AUDIT_SERVICE_VIEWS_ENABLED;
console.error=(...args)=>gaps.push(args.join(' '));
let service={id:42,isActive:true,companyActive:true},reads=0,verified=0,failCapture=false,identity='valid';
const paths=[];setupServiceViewRoutes({post(path,...handlers){paths.push({path,handlers});}}, {
 async getService(id){reads++;assert.equal(id,42);if(service==='error')throw Error('CANARY_private_query');return service;},
 async verifyActor(token,expected){verified++;assert.equal(token,'CANARY_token');assert.equal(expected,userId);
  if(identity==='unavailable')throw Error('CANARY_provider');return identity==='anonymous'?{kind:'anonymous'}:{kind:'user',userId,effectiveRole:'seeker'};}
});
assert.deepEqual(paths.map(p=>p.path),['/api/services/:id/view']);
const handler=paths[0].handlers.at(-1),response=()=>({statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},
 status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;},sendStatus(code){this.statusCode=code;return this;}});
const request=(extra={})=>({params:{id:'42'},query:{},body:{},...extra});
const call=async(req=request())=>{const res=response();await handler(req,res);return res;};
try{
 process.env.AUDIT_SERVICE_VIEWS_ENABLED='true';
 setAuditSink(async value=>{if(failCapture)throw Error('CANARY_driver_password');captured.push(value);},undefined,{authEvents:false});
 let res=await call();assert.equal(res.statusCode,204);assert.equal(verified,0);assert.equal(captured.length,1);
 assert.deepEqual(captured[0].envelope.target,{type:'service',id:'42'});assert.deepEqual(captured[0].envelope.actor,{kind:'anonymous'});
 assert.equal(captured[0].envelope.eventName,'service.viewed.v1');assert.deepEqual(captured[0].envelope.changes,[]);
 assert.equal(res.headers['Cache-Control'],'no-store');
 const auth={session:{auth:{accessToken:'CANARY_token',userId,refreshToken:'CANARY_refresh',expiresAt:1}}};
 await call(request(auth));assert.equal(verified,1);assert.equal(captured.at(-1).envelope.actor.userId,userId);
 for(identity of ['anonymous','unavailable']){res=await call(request(auth));assert.equal(res.statusCode,204);assert.deepEqual(captured.at(-1).envelope.actor,{kind:'anonymous'});}
 const priorVerified=verified;await call(request({user:{claims:{sub:userId}},auditPersonalRole:'provider'}));
 assert.equal(verified,priorVerified);assert.deepEqual(captured.at(-1).envelope.actor,{kind:'anonymous'},'Unverified req.user/session claims cannot assign audit identity');
 let before=captured.length,beforeReads=reads;
 for(const id of ['0','-1','1.2','42garbage','042','2147483648','Infinity',''])assert.equal((await call(request({params:{id}}))).statusCode,400);
 for(const body of [{actor:userId},{search:'private'},{serviceId:42},null,[], '42'])assert.equal((await call(request({body}))).statusCode,400);
 assert.equal((await call(request({query:{location:'private'}}))).statusCode,400);
 assert.equal(reads,beforeReads);assert.equal(captured.length,before);
 for(const value of [undefined,{id:42,isActive:false,companyActive:true},{id:42,isActive:true,companyActive:false},{id:43,isActive:true,companyActive:true}]){
  service=value;assert.equal((await call()).statusCode,404);assert.equal(captured.length,before);
 }
 service='error';assert.equal((await call()).statusCode,503);assert.equal(captured.length,before);
 service={id:42,isActive:true,companyActive:true};failCapture=true;
 res=await call();assert.equal(res.statusCode,204);assert.equal(captured.length,before);assert.ok(gaps.some(line=>line==='Audit capture gap CAPTURE_UNAVAILABLE'));
 // Existing capture can remain enabled while the new producer defaults off.
 failCapture=false;before=verified;beforeReads=reads;const capturesBeforeDisabled=captured.length;
 for(const flag of [undefined,'false']){
  if(flag===undefined)delete process.env.AUDIT_SERVICE_VIEWS_ENABLED;else process.env.AUDIT_SERVICE_VIEWS_ENABLED=flag;
  res=await call(request(auth));assert.equal(res.statusCode,204);assert.equal(verified,before);assert.equal(captured.length,capturesBeforeDisabled);
 }assert.equal(reads,beforeReads+2);
 process.env.AUDIT_SERVICE_VIEWS_ENABLED='true';
 failCapture=false;setAuditSink();process.env.AUDIT_ENABLED='false';beforeReads=reads;before=verified;
 res=await call(request(auth));assert.equal(res.statusCode,204);assert.equal(reads,beforeReads+1);assert.equal(verified,before);
 const serialized=JSON.stringify({captured,gaps});for(const canary of ['CANARY','location','refreshToken','accessToken','search'])assert.equal(serialized.includes(canary),false);
 // Exercise the actual per-IP limiter independently of handler capture.
 const limiter=paths[0].handlers[0];let limited=0;
 for(let i=0;i<61;i++){const response={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},send(){limited++;}};
  await limiter({ip:'192.0.2.81',headers:{},app:{get:()=>1},socket:{remoteAddress:'192.0.2.81'}},response,error=>{if(error)throw error;});
  if(i===60)assert.equal(response.statusCode,429);
 }assert.equal(limited,1);
}finally{setAuditSink();console.error=originalError;if(oldAudit===undefined)delete process.env.AUDIT_ENABLED;else process.env.AUDIT_ENABLED=oldAudit;
 if(oldViews===undefined)delete process.env.AUDIT_SERVICE_VIEWS_ENABLED;else process.env.AUDIT_SERVICE_VIEWS_ENABLED=oldViews;}
console.log('Passed: explicit service-view handler, availability/identity boundaries, one safe R90 event per accepted notification, input/limit refusal and best-effort outage; mocked offline only.');
