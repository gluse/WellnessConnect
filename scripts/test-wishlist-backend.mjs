import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {PgDialect} from 'drizzle-orm/pg-core';
import {createWishlistService,WishlistError,retentionExpiry} from '../server/wishlist/service.ts';
import {processActivityTick,ACTIVITY_BATCH_SIZE} from '../server/wishlist/worker.ts';
import {setupWishlistRoutes} from '../server/wishlist/routes.ts';
import {bookingAccess,groupAccess,createInboxService} from '../server/wishlist/inbox.ts';
import {isAllowedAuthReturnTo} from '../shared/navigation.ts';
import {setupServiceViewRoutes} from '../server/serviceViewRoutes.ts';

// Real business service, worker and route code; synthetic transactional storage,
// authentication, booking hydration and loopback transport. No server bootstrap,
// configuration, DB client, external service or persisted session is imported.
let checks=0;const check=(action)=>{action();checks++;};
let clock=new Date('2026-11-04T23:59:00.000Z');
const service={id:11,providerId:'seller',companyId:8,isActive:true,companyActive:true,name:'Synthetic Yoga'};
let state={saved:[],events:[],processed:[],groups:[]};let failActivity=false,failGroup=false;
const serial={tail:Promise.resolve()};
const store={
  async transaction(action){const previous=serial.tail;let release;serial.tail=new Promise(resolve=>{release=resolve;});await previous;const before=structuredClone(state);
    try{return await action({async lock(){},async service(id){return id===service.id?{...service}:undefined;},async isTeam(id){return id==='team';},
      async insert(userId,serviceId,savedAt){if(state.saved.some(row=>row.userId===userId&&row.serviceId===serviceId))return false;state.saved.push({userId,serviceId,savedAt});return true;},
      async remove(userId,serviceId){state.saved=state.saved.filter(row=>row.userId!==userId||row.serviceId!==serviceId);},
      async activity(event){if(failActivity)throw new Error('synthetic private failure');if(event.kind==='wishlist_additions'&&state.events.some(row=>row.kind===event.kind&&row.userId===event.userId&&row.serviceId===event.serviceId&&row.reportingDay===event.reportingDay))return;state.events.push(event);}});
    }catch(error){state=before;throw error;}finally{release();}},
  async list(userId,before,limit){return state.saved.filter(row=>row.userId===userId&&(!before||row.savedAt<before.savedAt||+row.savedAt===+before.savedAt&&row.serviceId<before.serviceId)).sort((a,b)=>b.savedAt-a.savedAt||b.serviceId-a.serviceId).slice(0,limit);},
  async membership(userId,ids){return state.saved.filter(row=>row.userId===userId&&ids.includes(row.serviceId)).map(row=>row.serviceId).sort((a,b)=>a-b);},
};
const wishlist=createWishlistService(store,async id=>id===11?{...service}:undefined,()=>clock);
await Promise.all([wishlist.save('reader',11),wishlist.save('reader',11)]);
check(()=>{assert.equal(state.saved.length,1);assert.equal(state.events.length,1);assert.equal(state.events[0].reportingDay,'2026-11-04');assert.equal(+state.events[0].expiresAt-+clock,90*86400000);});
await wishlist.remove('reader',11);await wishlist.remove('reader',11);await wishlist.save('reader',11);
check(()=>{assert.equal(state.saved.length,1);assert.equal(state.events.length,1);});
clock=new Date('2026-11-05T00:01:00.000Z');await wishlist.remove('reader',11);await wishlist.save('reader',11);
check(()=>assert.equal(state.events.length,2));
await wishlist.save('seller',11);await wishlist.save('team',11);
check(()=>{assert.equal(state.saved.length,3);assert.equal(state.events.length,2);});
check(()=>assert.deepEqual(state.events.map(row=>row.userId),['reader','reader']));
await wishlist.remove('reader',11);failActivity=true;
await assert.rejects(()=>wishlist.save('reader2',11),/synthetic private failure/);checks++;
check(()=>assert.equal(state.saved.some(row=>row.userId==='reader2'),false));failActivity=false;
service.isActive=false;await assert.rejects(()=>wishlist.save('reader',11),error=>error instanceof WishlistError&&error.status===404);checks++;
check(()=>assert.equal((state.saved.filter(row=>row.userId==='reader')).length,0));
let page=await wishlist.list('seller',undefined,24);check(()=>{assert.equal(page.items[0].available,false);assert.equal('service' in page.items[0],false);});
service.isActive=true;page=await wishlist.list('seller',undefined,24);check(()=>assert.equal(page.items[0].available,true));
check(()=>assert.deepEqual((state.saved.filter(row=>row.userId==='team')).map(row=>row.serviceId),[11]));
service.companyActive=false;await assert.rejects(()=>wishlist.save('reader',11),error=>error.status===404);checks++;service.companyActive=true;
await assert.rejects(()=>wishlist.list('seller','malformed',24),error=>error.status===400);checks++;
state.saved.push({userId:'seller',serviceId:10,savedAt:new Date('2026-11-04T00:00:00Z')});
page=await wishlist.list('seller',undefined,1);const next=await wishlist.list('seller',page.nextCursor,1);
check(()=>{assert.equal(page.items[0].serviceId,11);assert.equal(next.items[0].serviceId,10);assert.equal(next.items[0].available,false);assert.equal(next.nextCursor,null);});
await wishlist.recordView(11,'seller');await wishlist.recordView(11,'team');await wishlist.recordView(11,null);await wishlist.recordView(11,'reader');
check(()=>assert.deepEqual(state.events.filter(row=>row.kind==='service_views').map(row=>row.userId),[null,'reader']));

const activityStore={
  async transaction(action){const before=structuredClone(state);try{return await action({
    async claim(now,limit){return state.events.filter(row=>!state.processed.includes(row.id)&&row.reportingDay<now.toISOString().slice(0,10)&&row.expiresAt>now).slice(0,limit);},
    async add(group,now){if(failGroup)throw new Error('synthetic group failure');const existing=state.groups.find(row=>row.kind===group.kind&&row.serviceId===group.serviceId&&row.reportingDay===group.reportingDay&&row.scopeKey===group.scopeKey);if(existing){existing.count+=group.count;existing.revision++;}else state.groups.push({...group,revision:1,updatedAt:now});},
    async processed(ids){state.processed.push(...ids);},
  });}catch(error){state=before;throw error;}},
  async cleanup(now){state.events=state.events.filter(row=>row.expiresAt>now);state.groups=state.groups.filter(row=>row.expiresAt>now);},
};
let result=await processActivityTick(activityStore,clock);
check(()=>{assert.equal(result.processed,1);assert.equal(state.groups.length,1);assert.equal(state.groups[0].count,1);});
result=await processActivityTick(activityStore,clock);check(()=>assert.equal(result.processed,0));
// A late-committing event for the completed day is incorporated exactly once.
const late={...state.events[0],id:randomUUID(),userId:'late'};state.events.push(late);
await processActivityTick(activityStore,clock);
check(()=>{assert.equal(state.groups[0].count,2);assert.equal(state.groups[0].revision,2);});
state.events.push({...late,id:randomUUID(),userId:'rollback'});const savedProcessed=state.processed.length;
failGroup=true;await assert.rejects(()=>processActivityTick(activityStore,clock),/group failure/);checks++;
check(()=>{assert.equal(state.groups[0].count,2);assert.equal(state.processed.length,savedProcessed);});failGroup=false;
await processActivityTick(activityStore,clock);check(()=>assert.equal(state.groups[0].count,3));
clock=new Date('2026-11-06T00:00:00Z');await processActivityTick(activityStore,clock);
check(()=>{assert.equal(state.groups.find(row=>row.kind==='service_views').count,2);assert.equal(state.groups.filter(row=>row.kind==='wishlist_additions').length,2);});
clock=new Date('2027-03-01T00:00:00Z');await processActivityTick(activityStore,clock);
check(()=>{assert.equal(state.groups.length,0);assert.equal(state.events.length,0);});
check(()=>assert.equal(ACTIVITY_BATCH_SIZE,200));

for(const target of ['/wishlist','/inbox','/search?service=1','/search?service=2147483647'])check(()=>assert.equal(isAllowedAuthReturnTo(target),true));
for(const target of ['/search?service=0','/search?service=01','/search?service=2147483648','/search?service=1&service=2','/search?service=1&save=1','//evil.test','/wishlist?save=1'])check(()=>assert.equal(isAllowedAuthReturnTo(target),false));
const dialect=new PgDialect();const injected='reader\'); DELETE FROM users; --';
for(const scope of [{userId:injected,scope:'customer'},{userId:injected,scope:'provider'},{userId:injected,scope:'provider',companyId:8}]){
  for(const filter of [bookingAccess(scope),groupAccess(scope)]){const query=dialect.sqlToQuery(filter);check(()=>{assert.equal(query.sql.includes(injected),false);if(query.sql!=='false')assert.ok(query.params.includes(injected));});}
}

const oldAudit=process.env.AUDIT_ENABLED;process.env.AUDIT_ENABLED='false';
const productViews=[],viewRoutes=[];let verification=0,captureFailure=false;
setupServiceViewRoutes({post(_path,...handlers){viewRoutes.push(handlers);}}, {async getService(){return {...service};},async verifyActor(){verification++;return {kind:'user',userId:'verified-reader',effectiveRole:'seeker'};},async recordProductView(id,userId){if(captureFailure)throw Error('PRIVATE_CAPTURE_CANARY');productViews.push({id,userId});}});
const viewHandler=viewRoutes[0].at(-1);
async function productView(extra={}){const res={statusCode:200,set(){return this;},status(code){this.statusCode=code;return this;},json(){return this;},sendStatus(code){this.statusCode=code;return this;}};await viewHandler({params:{id:'11'},query:{},body:{},...extra},res);return res;}
try{
 let response=await productView();check(()=>{assert.equal(response.statusCode,204);assert.deepEqual(productViews.at(-1),{id:11,userId:null});assert.equal(verification,0);});
 response=await productView({session:{auth:{accessToken:'synthetic-token',userId:'verified-reader'}}});check(()=>{assert.equal(response.statusCode,204);assert.equal(productViews.at(-1).userId,'verified-reader');assert.equal(verification,1);});
 const originalError=console.error,errors=[];console.error=(...args)=>errors.push(args.join(' '));captureFailure=true;
 try{response=await productView();check(()=>{assert.equal(response.statusCode,204);assert.equal(errors.length,1);assert.equal(errors[0].includes('CANARY'),false);});}finally{console.error=originalError;}
}finally{if(oldAudit===undefined)delete process.env.AUDIT_ENABLED;else process.env.AUDIT_ENABLED=oldAudit;}

const inboxCalls=[];const fakeInbox={async summary(actor){inboxCalls.push(actor);return {unreadMessages:3,unreadNotifications:2};},async messages(){return {items:[],nextCursor:null};},
  async booking(actor,id){inboxCalls.push({actor,id});return {id};},async readMessages(actor,id,messageIds){inboxCalls.push({actor,id,messageIds});},async notifications(){return {items:[],nextCursor:null};},async readNotifications(actor,items){inboxCalls.push({actor,items});}};
const app=express();app.use(express.json());const auth=(req,res,next)=>{const id=req.get('x-test-user');if(!id)return res.sendStatus(401);req.user={claims:{sub:id}};req.workspace={company:req.get('x-test-company')?{id:Number(req.get('x-test-company')),isActive:true}:null,invalid:false};next();};
setupWishlistRoutes(app,auth,wishlist,fakeInbox,async id=>id==='missing-profile'?undefined:{id,currentRole:id==='malformed-profile'?null:id==='seller'?'provider':'seeker'});
const realFetch=globalThis.fetch;const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try{
 const origin=`http://127.0.0.1:${server.address().port}`;
 async function request(path,{method='GET',body,user='seller',company}={}){const response=await realFetch(origin+path,{method,headers:{...(user?{'x-test-user':user}:{}),...(company?{'x-test-company':String(company)}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,headers:response.headers,body:response.headers.get('content-type')?.includes('json')?await response.json():await response.text()};}
 check(()=>assert.equal(inboxCalls.length,0));
 let response=await request('/api/wishlist/services',{user:null});check(()=>assert.equal(response.status,401));
 response=await request('/api/wishlist/services?userId=reader');check(()=>assert.equal(response.status,400));
 response=await request('/api/wishlist/membership?serviceIds=11');check(()=>{assert.equal(response.status,200);assert.deepEqual(response.body.serviceIds,[11]);assert.match(response.headers.get('cache-control'),/private, no-store/);});
 for(const query of ['serviceIds=0','serviceIds=11,11','serviceIds=2147483648','serviceIds=11&userId=reader']){response=await request('/api/wishlist/membership?'+query);check(()=>assert.equal(response.status,400));}
 response=await request('/api/wishlist/services/11',{method:'PUT',body:{userId:'another'}});check(()=>assert.equal(response.status,400));
 response=await request('/api/wishlist/services/11',{method:'PUT'});check(()=>assert.equal(response.status,204));
 response=await request('/api/wishlist/services/11',{method:'DELETE'});check(()=>assert.equal(response.status,204));
 response=await request('/api/wishlist/services/11',{method:'DELETE'});check(()=>assert.equal(response.status,204));
 response=await request('/api/inbox/summary?scope=provider');check(()=>{assert.equal(response.status,200);assert.deepEqual(response.body,{unreadMessages:3,unreadNotifications:2});assert.deepEqual(inboxCalls.at(-1),{scope:'provider',userId:'seller'});});
 response=await request('/api/inbox/summary?scope=provider&companyId=8');check(()=>assert.equal(response.status,403));
 response=await request('/api/inbox/summary?scope=provider&companyId=8',{company:8});check(()=>assert.equal(response.status,200));
 response=await request('/api/inbox/summary?scope=all&companyId=8',{user:'reader',company:8});check(()=>{assert.equal(response.status,200);assert.deepEqual(inboxCalls.at(-1),{scope:'all',companyId:8,userId:'reader'});});
 response=await request('/api/inbox/summary?scope=all&companyId=9',{user:'reader',company:8});check(()=>assert.equal(response.status,403));
 response=await request('/api/inbox/messages?scope=all',{user:'reader'});check(()=>assert.equal(response.status,200));
 response=await request('/api/inbox/messages/1?scope=all',{user:'reader'});check(()=>assert.equal(response.status,400));
 response=await request('/api/inbox/messages/1/read?scope=all',{user:'reader',method:'POST',body:{messageIds:[randomUUID()]}});check(()=>assert.equal(response.status,400));
 response=await request('/api/inbox/notifications/read?scope=all&companyId=8',{user:'reader',company:8,method:'POST',body:{items:[{id:randomUUID(),revision:2}]}});check(()=>{assert.equal(response.status,204);assert.deepEqual(inboxCalls.at(-1).actor,{scope:'all',companyId:8,userId:'reader'});});
 response=await request('/api/inbox/summary?scope=customer&companyId=8');check(()=>assert.equal(response.status,400));
 // Existing provider pages permit personal ownership without switching the
 // default seeker profile role. Route acceptance must preserve that behavior;
 // the query actor still carries only the verified reader identity/personal scope.
 response=await request('/api/inbox/summary?scope=provider',{user:'reader'});check(()=>{assert.equal(response.status,200);assert.deepEqual(inboxCalls.at(-1),{scope:'provider',userId:'reader'});const access=dialect.sqlToQuery(bookingAccess(inboxCalls.at(-1)));assert.match(access.sql,/b\.provider_id=\$1 AND b\.company_id IS NULL/);assert.deepEqual(access.params,['reader']);});
 response=await request('/api/inbox/summary?scope=provider&companyId=8',{user:'reader'});check(()=>assert.equal(response.status,403));
 for(const user of ['missing-profile','malformed-profile']){response=await request('/api/inbox/summary?scope=provider',{user});check(()=>assert.equal(response.status,403));}
 response=await request('/api/inbox/messages/1/read?scope=customer',{user:'reader',method:'POST',body:{messageIds:[randomUUID()]}});check(()=>assert.equal(response.status,204));
 response=await request('/api/inbox/messages/1/read?scope=customer',{user:'reader',method:'POST',body:{messageIds:[randomUUID()],readerId:'other'}});check(()=>assert.equal(response.status,400));
 response=await request('/api/inbox/notifications/read?scope=provider',{method:'POST',body:{items:[{id:randomUUID(),revision:2}]}});check(()=>assert.equal(response.status,204));
 response=await request('/api/inbox/notifications/read?scope=provider',{method:'POST',body:{items:[{id:randomUUID(),revision:0}]}});check(()=>assert.equal(response.status,400));
 response=await request('/api/inbox/notifications?scope=provider&allWorkspaces=true');check(()=>assert.equal(response.status,400));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

// Real inbox read mutations are monotonic and acknowledge exact delivered IDs/
// revisions. Execute is a synthetic boundary; no database engine is contacted.
const executed=[];const memoryQuery={async execute(query){const parsed=dialect.sqlToQuery(query);executed.push(parsed);if(parsed.sql.includes('SELECT b.id'))return {rows:[{id:1}]};if(parsed.sql.includes('SELECT bm.id'))return {rows:[{id:'11111111-1111-4111-8111-111111111111'}]};if(parsed.sql.includes('SELECT g.revision'))return {rows:[{revision:3}]};return {rows:[]};},async transaction(action){return action(this);}};
const inbox=createInboxService(memoryQuery,async()=>undefined,()=>new Date('2026-11-06T00:00:00Z'));
await inbox.readMessages({userId:'reader',scope:'customer'},1,['11111111-1111-4111-8111-111111111111']);
check(()=>{const insert=executed.find(query=>query.sql.includes('INSERT INTO public.booking_message_reads'));assert.ok(insert);assert.ok(insert.sql.includes('ON CONFLICT DO NOTHING'));assert.ok(insert.params.includes('11111111-1111-4111-8111-111111111111'));assert.ok(insert.params.includes('customer'));});
await assert.rejects(()=>inbox.readMessages({userId:'reader',scope:'customer'},1,[randomUUID(),randomUUID()]),error=>error.status===400);checks++;
await inbox.readNotifications({userId:'seller',scope:'provider'},[{id:randomUUID(),revision:2}]);
check(()=>assert.ok(executed.some(query=>query.sql.includes('GREATEST(service_activity_reads.read_revision,EXCLUDED.read_revision)'))));
await assert.rejects(()=>inbox.readNotifications({userId:'seller',scope:'provider'},[{id:randomUUID(),revision:4}]),error=>error.status===400);checks++;
console.log(`Passed ${checks} wishlist/backend scenarios: private account isolation, save/remove/idempotency/rollback, UTC daily dedupe, inactive lifecycle, worker replay/late events/retention, strict authenticated routes, safe redirects and bounded read acknowledgments. Synthetic persistence/Auth and loopback only.`);
