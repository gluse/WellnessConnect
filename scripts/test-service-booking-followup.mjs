// Offline only: VM replaces DB/Auth/config imports before module evaluation.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as drizzle from 'drizzle-orm';
import {PgDialect} from 'drizzle-orm/pg-core';
import {z} from 'zod';
import * as schema from '../shared/schema.ts';
import * as scheduling from '../shared/scheduling.ts';
import * as protection from '../server/service-booking-protection.ts';
import * as money from '../server/money.ts';
import * as serviceImages from '../server/serviceImages.ts';
import {authProfileImage} from '../server/social-auth.ts';
import {createInboxService} from '../server/wishlist/inbox.ts';

async function load(path, dependencies) {
  const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{Date,Map,Set,JSON,console},{filename:path})(name=>{
    assert.ok(Object.hasOwn(dependencies,name),`Blocked import: ${path} -> ${name}`);return dependencies[name];
  },module,module.exports);
  return module.exports;
}
const dialect=new PgDialect(), now=new Date('2035-06-01T12:00:00Z');
let listing={id:1,providerId:'provider',companyId:null,employeeId:null,addressId:null,name:'Conference',description:'Original',category:'education',serviceType:'group',price:'25.00',currency:'EUR',duration:60,cleanupTime:15,maxCapacity:10,ageGroups:[],targetGender:'both',instantBooking:false,advancePaymentPercent:50,imageUrl:null,imageUrls:[],externalUrl:null,reminderEnabled:false,reminderMethod:'email',reminderHours:24,reminderMessage:'',isActive:true};
let bookings=[],notices=[],locked=false,failNotification=false,events=[];
function ormPredicate(row,predicate){
  if(!predicate)return true;const query=dialect.sqlToQuery(predicate);let result=true;
  for(const match of query.sql.matchAll(/"services"\."(\w+)" (= \$(\d+)|is null)/gi)){
    const key=match[1].replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());
    result&&=match[3]!==undefined?row[key]===query.params[Number(match[3])-1]:row[key]==null;
  }
  return result;
}
const db={select(){let predicate,joined=false,table;const chain={from(value){table=drizzle.getTableName(value);return chain;},leftJoin(){joined=true;return chain;},innerJoin(){return chain;},groupBy(){return chain;},orderBy(){return chain;},where(value){predicate=value;return chain;},as(){return {};},then(resolve,reject){return Promise.resolve(table==='services'&&ormPredicate(listing,predicate)?[joined?{services:listing,addresses:null,users:{id:'provider'},companies:null,employees:null}:{...listing}]:[]).then(resolve,reject);}};return chain;},async transaction(action){const before=structuredClone({listing,notices});locked=false;events=[];
  const tx={select(){let table,predicate;const chain={from(value){table=drizzle.getTableName(value);return chain;},where(value){predicate=value;return chain;},for(mode){assert.equal(table,'services');assert.ok(['update','share'].includes(mode));locked=true;events.push('locked');return chain;},then(resolve,reject){return Promise.resolve(table==='services'&&ormPredicate(listing,predicate)?[{...listing}]:[]).then(resolve,reject);}};return chain;},
    update(table){assert.equal(drizzle.getTableName(table),'services');assert.ok(locked);let updates;const chain={set(value){updates=value;return chain;},where(){return chain;},returning(){return chain;},then(resolve,reject){listing={...listing,...updates};events.push('updated');return Promise.resolve([{...listing}]).then(resolve,reject);}};return chain;},
    async execute(input){assert.ok(locked);const query=dialect.sqlToQuery(input);events.push('query');
      if(query.sql.startsWith('SELECT id FROM public.bookings')){
        const excluded=query.sql.match(/status NOT IN \(([^)]+)\)/)[1].match(/'[^']+'/g).map(value=>value.slice(1,-1));
        const id=query.params[0];return {rows:bookings.filter(row=>row.serviceId===id&&(row.status==null||!excluded.includes(row.status))).slice(0,1)};
      }
      if(query.sql.startsWith('INSERT INTO public.customer_service_notifications')){
        if(failNotification)throw Error('synthetic notification insert failure');
        const statuses=query.sql.match(/b.status IN \(([^)]+)\)/)[1].match(/'[^']+'/g).map(value=>value.slice(1,-1));
        const [fields,createdAt,expiresAt,id]=query.params;
        for(const row of bookings.filter(row=>row.serviceId===id&&statuses.includes(row.status)))notices.push({bookingId:row.id,seekerId:row.seekerId,serviceId:id,fields:JSON.parse(fields),createdAt,expiresAt});
        return {rows:[]};
      }
      throw Error(`Unexpected offline SQL ${query.sql}`);
    }};
  try{return await action(tx);}catch(error){listing=before.listing;notices=before.notices;throw error;}finally{locked=false;}
}};
const noop=()=>{};
const store=await load('server/storage.ts',{'@shared/schema':schema,'./db':{db},'drizzle-orm':drizzle,'@shared/provider':{},'./storefronts':{},'./addresses':{serviceLocation:value=>value},'./audit/context':{},'./audit/events':{},'./audit/capture':{},'@shared/scheduling':scheduling,'@shared/reviews':{},'./searchInput':{},'./customerBookings':{},'./notifications/repository':{assertReminderConfiguration:noop,reconcileServiceReminders:noop},'./notifications/policy':{},'node:crypto':{},'./money':money,'@shared/storefront':{},'./serviceImages':serviceImages,'./service-booking-protection':protection});
const storage=new store.DatabaseStorage();
const reservation=(id,status,serviceId=1)=>({id,status,serviceId,seekerId:`customer-${id}`,bookingDuration:60,bookingCleanupTime:15,totalAmount:'25.00'});
for(const status of ['pending','confirmed',null,'unrecognized']){
  bookings=[reservation(1,status)];await assert.rejects(()=>storage.deleteService(1),/Complete or cancel/);assert.equal(listing.isActive,true);assert.deepEqual(events,['locked','query']);
}
bookings=[reservation(1,'completed'),reservation(2,'cancelled'),reservation(3,'confirmed',2)];
await storage.deleteService(1);assert.equal(listing.isActive,false);assert.ok(listing.deletedAt instanceof Date);assert.equal(bookings.length,3);assert.equal(events[0],'locked');
await assert.rejects(()=>storage.updateService(1,{isActive:true}),/Service not found/);
assert.equal(await storage.getServiceById(1),undefined,'Deleted services cannot be reopened by public ID');
assert.equal((await storage.getServicesByProvider('provider')).length,0,'Deleted services leave provider management catalogs');
assert.equal(await storage.copyService(1,'provider'),undefined,'Copy cannot revive a deleted listing');
listing.isActive=true;listing.deletedAt=null;
bookings=['pending','confirmed','completed','cancelled'].map((status,index)=>reservation(index+1,status));
const snapshots=structuredClone(bookings);
await storage.updateService(1,{description:'Changed venue guidance',duration:90});
assert.deepEqual(notices.map(row=>row.bookingId),[1,2]);assert.deepEqual(notices[0].fields,['description','duration']);assert.deepEqual(bookings,snapshots);
assert.equal(Date.parse(notices[0].expiresAt)-Date.parse(notices[0].createdAt),90*86400000);
assert.deepEqual(events.slice(0,2),['locked','updated']);
await storage.updateService(1,{description:'Changed venue guidance',duration:90});assert.equal(notices.length,2,'No-op saves do not notify again');
await storage.updateService(1,{price:'25.0'});assert.equal(notices.length,2,'Canonical price saves are no-ops');
failNotification=true;const original=listing.description;
await assert.rejects(()=>storage.updateService(1,{description:'Must roll back'}),/insert failure/);assert.equal(listing.description,original);assert.equal(notices.length,2);failNotification=false;

// Actual scheduling + ownership logic, with only the persistence adapter mocked.
const access=await load('server/companyAccess.ts',{'./db':{db},'drizzle-orm':drizzle,'@shared/schema':schema,'./customerBookings':{}});
const saved=[];
const api=await load('server/schedulingRoutes.ts',{zod:{z},'@shared/scheduling':scheduling,'./storage':{storage:{async getServiceById(){return listing;},async replaceAvailability(...args){saved.push(args);}}},'./auth':{isAuthenticated:noop},'./companyAccess':access,'./customerBookings':{CustomerBookingError:class extends Error{}}});
const routes=[];const app={};for(const method of ['get','put','delete'])app[method]=(path,...handlers)=>routes.push({method,path,handlers});api.setupSchedulingRoutes(app);
async function request(body,permission=true){const res={code:200,status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
  await routes.find(route=>route.path==='/api/availability/weekly').handlers.at(-1)({body,user:{claims:{sub:'provider'}},workspace:{company:null,permissions:{manageSchedules:permission,manageServices:permission}}},res);return res;}
const week={serviceId:1,timezone:'Europe/Riga',days:Array.from({length:7},(_,day)=>({day,intervals:day===1?[{startTime:'09:00',endTime:'12:00'}]:[]})),recurrenceEndType:'on_date',recurrenceEndValue:'2035-06-04'};
assert.equal((await request(week)).code,200);assert.equal(saved.at(-1)[4][0].recurrenceEndValue,'2035-06-04');
for(const value of [undefined,null,'2035-02-30','invalid'])assert.equal((await request({...week,recurrenceEndValue:value})).code,400);
assert.equal((await request(week,false)).code,403);
assert.equal((await request({serviceId:1,inherit:true})).code,200);assert.equal(saved.at(-1)[4].length,0);
assert.equal((await request({...week,days:week.days.map(row=>({...row,intervals:[]}))})).code,200);assert.equal(saved.at(-1)[4][0].daysOfWeek.length,0);
const weekly={...week.days[1].intervals[0],id:1,serviceId:1,scheduleType:'recurring',daysOfWeek:[1],timezone:'Europe/Riga',recurrenceEndType:'on_date',recurrenceEndValue:'2035-06-04',isActive:true};
const slots=(date,schedules,timezone='Europe/Riga')=>scheduling.bookableSlots({service:listing,schedules,bookings:[],date,timezone,now});
assert.ok(slots('2035-06-04',[weekly]).length,'Inclusive final day');assert.equal(slots('2035-06-11',[weekly]).length,0,'Expired schedule must not reopen');
const closed={...weekly,daysOfWeek:[],startTime:'00:00',endTime:'00:00',recurrenceEndType:'never'};
const general={...weekly,serviceId:null,recurrenceEndType:'never'};
const dated={...general,scheduleType:'specific',specificDate:new Date('2035-06-05'),startTime:'09:00',endTime:'12:00'};
assert.equal(slots('2035-06-04',[closed,general]).length,0);
assert.equal(slots('2035-06-05',[closed,general,dated]).length,0,'General dated openings cannot open date-only services');
assert.ok(slots('2035-06-05',[closed,general,dated,{...dated,serviceId:1}]).length);
assert.equal(slots('2035-06-06',[closed,general,dated,{...dated,serviceId:1}]).length,0);

for(const candidate of ['javascript:alert(1)','http://photo.example/avatar','file:///image','https://user:pass@example.test/image'])assert.equal(authProfileImage({user_metadata:{picture:candidate}},undefined),null);
assert.equal(authProfileImage({user_metadata:{picture:'https://photo.example/picture'}},undefined),'https://photo.example/picture');
assert.equal(authProfileImage({user_metadata:{},identities:[{identity_data:{avatar_url:'https://photo.example/identity'}}]},undefined),'https://photo.example/identity');
assert.equal(authProfileImage({user_metadata:{}},undefined),null,'Apple may omit profile photo');
assert.equal(authProfileImage({user_metadata:{avatar_url:'https://photo.example/provider'}},{profileImageUrl:'/existing.png'}),'/existing.png');

// Production-generated inbox access conditions run through a minimal evaluator;
// the boundary parses SQL values/operators rather than choosing expected users.
function matches(source,params,context){
  const tokens=source.replaceAll(/::(?:uuid|timestamptz)/g,'').match(/\$\d+|[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?|<=|>=|<>|[=<>(),]/gi)??[];let index=0;
  const value=()=>{const token=tokens[index++];if(token?.startsWith('$'))return params[Number(token.slice(1))-1];if(token==='false')return false;if(token==='true')return true;const [alias,key]=token.split('.');return context[alias]?.[key];};
  const atom=()=>{if(tokens[index]==='('){index++;const result=and();assert.equal(tokens[index++],')');return result;}const a=value();if(tokens[index]==='IS'){index++;const not=tokens[index]==='NOT';if(not)index++;assert.equal(tokens[index++],'NULL');return not?a!=null:a==null;}const operator=tokens[index];if(!['=','>','<','<=','>=','<>'].includes(operator))return Boolean(a);index++;const b=value();return a!=null&&b!=null&&(operator==='='?a===b:operator==='>'?a>b:operator==='<'?a<b:operator==='>='?a>=b:operator==='<='?a<=b:a!==b);};
  const and=()=>{let result=atom();while(tokens[index]==='AND'){index++;const next=atom();result=result&&next;}return result;};const result=and();assert.equal(index,tokens.length,`Complete predicate ${source}`);return result;
}
const id='10000000-0000-4000-8000-000000000001';
const notice={id,seeker_id:'customer',booking_id:7,service_id:1,read_at:null,expires_at:'2035-09-01T00:00:00.000Z'};
const booked={id:7,seeker_id:'customer',service_id:1};
const inboxDb={async transaction(action){return action(this);},async execute(input){const q=dialect.sqlToQuery(input);
  if(q.sql.startsWith('SELECT count(*)::int AS count FROM public.booking_messages'))return {rows:[{count:0}]};
  if(q.sql.includes('SELECT count(*) FROM public.customer_service_notifications')){
    const predicate=q.sql.slice(q.sql.indexOf('WHERE ')+6,q.sql.indexOf(')::int AS count FROM')-1);
    return {rows:[{count:matches(predicate,q.params,{n:notice,b:booked})?1:0}]};
  }
  if(q.sql.startsWith('SELECT * FROM (SELECT g.id')){
    const start=q.sql.indexOf('LEFT JOIN public.companies c ON c.id=s.company_id WHERE ')+ 'LEFT JOIN public.companies c ON c.id=s.company_id WHERE '.length;
    const predicate=q.sql.slice(start,q.sql.indexOf(') notices',start));
    return {rows:matches(predicate,q.params,{n:notice,b:booked})?[{id,kind:'service_changes',serviceId:notice.service_id,serviceName:'Conference',reportingDay:'2035-06-01',count:1,revision:1,read:notice.read_at!==null,available:true,updatedAt:now,bookingId:notice.booking_id,changedFields:['description']}]:[]};
  }
  if(q.sql.includes('SELECT g.revision'))return {rows:[]};
  if(q.sql.startsWith('UPDATE public.customer_service_notifications')){
    const predicate=q.sql.slice(q.sql.indexOf('WHERE ')+6,q.sql.indexOf(' RETURNING'));
    const allowed=matches(predicate,q.params,{n:notice,b:booked});if(allowed)notice.read_at??=q.params[0];return {rows:allowed?[{id}]:[]};
  }
  throw Error(`Unexpected inbox query ${q.sql}`);
}};
const inbox=createInboxService(inboxDb,async()=>undefined,()=>now);
for(const actor of [{scope:'all',userId:'other'},{scope:'provider',userId:'customer'},{scope:'provider',userId:'provider'}]){
  assert.equal((await inbox.summary(actor)).unreadNotifications,0);assert.equal((await inbox.notifications(actor,undefined,10)).items.length,0);
}
assert.equal((await inbox.summary({scope:'all',userId:'customer',companyId:8})).unreadNotifications,1,'Customer notice survives workspace selection');
assert.equal((await inbox.notifications({scope:'customer',userId:'customer'},undefined,10)).items[0].bookingId,7);
for(const actor of [{scope:'all',userId:'other'},{scope:'provider',userId:'customer'},{scope:'provider',userId:'provider'}])await assert.rejects(()=>inbox.readNotifications(actor,[{id,revision:1}]),error=>error.status===403);
assert.equal(notice.read_at,null);await assert.rejects(()=>inbox.readNotifications({scope:'all',userId:'customer'},[{id,revision:2}]),error=>error.status===400);
await inbox.readNotifications({scope:'all',userId:'customer'},[{id,revision:1}]);assert.equal(notice.read_at,now.toISOString());
assert.equal((await inbox.summary({scope:'all',userId:'customer'})).unreadNotifications,0);
await inbox.readNotifications({scope:'customer',userId:'customer'},[{id,revision:1}]);assert.equal(notice.read_at,now.toISOString());
booked.seeker_id='other';await assert.rejects(()=>inbox.readNotifications({scope:'all',userId:'customer'},[{id,revision:1}]),error=>error.status===403);
booked.seeker_id='customer';notice.expires_at='2035-01-01T00:00:00.000Z';await assert.rejects(()=>inbox.readNotifications({scope:'all',userId:'customer'},[{id,revision:1}]),error=>error.status===403);
console.log('Passed offline service/booking follow-up: locked unfinished deletion guards/history retention, actual transaction edit+notice rollback/no-op/snapshot protection, private notice read ownership/revision/expiry, schedule API validation+authorization+inheritance, inclusive recurring end/date-only isolation and safe OAuth photo metadata. Mock transactions do not prove database races or migration execution.');
