import assert from 'node:assert/strict';
import {PgDialect} from 'drizzle-orm/pg-core';
import {createInboxService} from '../server/wishlist/inbox.ts';

// A small predicate interpreter evaluates production-generated SQL over synthetic
// rows. It implements comparisons/boolean logic/correlated EXISTS rather than
// supplying scope decisions or expected counts. No SQL engine, connection,
// credentials, configuration, session or filesystem persistence is used.
const dialect=new PgDialect();
const tables={
 'public.bookings':[
  {id:1,seeker_id:'buyer',provider_id:'reader',company_id:null,employee_id:null},
  {id:2,seeker_id:'reader',provider_id:'seller',company_id:null,employee_id:null},
  {id:3,seeker_id:'reader',provider_id:'reader',company_id:null,employee_id:null},
  {id:4,seeker_id:'someone-else',provider_id:'seller',company_id:null,employee_id:null},
  {id:5,seeker_id:'buyer',provider_id:'seller',company_id:8,employee_id:7},
  {id:6,seeker_id:'buyer',provider_id:'seller',company_id:8,employee_id:9},
  {id:7,seeker_id:'buyer',provider_id:'seller',company_id:9,employee_id:7},
  {id:8,seeker_id:'reader',provider_id:'seller',company_id:9,employee_id:9},
 ],
 'public.companies':[{id:8,is_active:true},{id:9,is_active:true}],
 'public.company_memberships':[{company_id:8,user_id:'reader',role:'viewer',employee_id:7},{company_id:9,user_id:'reader',role:'admin',employee_id:null}],
 'public.booking_message_reads':[],
};
const uuid=id=>`00000000-0000-4000-8000-${String(id).padStart(12,'0')}`;
tables['public.booking_messages']=tables['public.bookings'].map(b=>({id:uuid(b.id),booking_id:b.id,author_id:b.id===2?'seller':b.id===3?'teammate':'buyer'}));
tables['public.booking_messages'].push({id:uuid(99),booking_id:3,author_id:'reader'});

function predicate(source,params){
 const tokens=source.match(/'(?:''|[^'])*'|\$\d+|[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?|<>|<=|>=|[=<>(),]|\d+/gi)??[];
 let at=0;const peek=()=>tokens[at]?.toLowerCase();
 const take=expected=>{assert.equal(peek(),expected,`Supported SQL at ${tokens.slice(at).join(' ')}`);at++;};
 const value=()=>{
  const token=tokens[at++];assert.ok(token,'Complete SQL value');
  if(token[0]==='$')return ()=>params[Number(token.slice(1))-1];
  if(token[0]==="'")return ()=>token.slice(1,-1).replaceAll("''","'");
  if(/^\d+$/.test(token))return ()=>Number(token);
  if(token.toLowerCase()==='true')return ()=>true;
  if(token.toLowerCase()==='false')return ()=>false;
  if(token.toLowerCase()==='null')return ()=>null;
  const [alias,key]=token.split('.');assert.ok(key,`Qualified SQL value: ${token}`);return context=>context[alias]?.[key];
 };
 const atom=()=>{
  if(peek()==='not'){at++;const next=atom();return ctx=>!next(ctx);}
  if(peek()==='('){at++;const inner=or();take(')');return inner;}
  if(peek()==='exists'){
   at++;take('(');take('select');take('1');take('from');const table=tokens[at++],alias=tokens[at++];const joins=[];
   while(peek()==='join'){at++;const joinTable=tokens[at++],joinAlias=tokens[at++];take('on');joins.push({table:joinTable,alias:joinAlias,on:or()});}
   take('where');const where=or();take(')');
   return context=>{
    let rows=tables[table].map(row=>({...context,[alias]:row}));
    for(const join of joins)rows=rows.flatMap(ctx=>tables[join.table].map(row=>({...ctx,[join.alias]:row})).filter(join.on));
    return rows.some(where);
   };
  }
  const left=value();
  if(peek()==='is'){at++;const invert=peek()==='not';if(invert)at++;take('null');return ctx=>invert?left(ctx)!=null:left(ctx)==null;}
  if(peek()==='in'){at++;take('(');const values=[value()];while(peek()===','){at++;values.push(value());}take(')');return ctx=>left(ctx)!=null&&values.some(right=>left(ctx)===right(ctx));}
  if(['=','<>','<','>','<=','>='].includes(peek())){
   const operator=tokens[at++],right=value();return ctx=>{const a=left(ctx),b=right(ctx);if(a==null||b==null)return false;return operator==='='?a===b:operator==='<>'?a!==b:operator==='<'?a<b:operator==='>'?a>b:operator==='<='?a<=b:a>=b;};
  }
  return left;
 };
 const and=()=>{let current=atom();while(peek()==='and'){at++;const previous=current,next=atom();current=ctx=>Boolean(previous(ctx)&&next(ctx));}return current;};
 const or=()=>{let current=and();while(peek()==='or'){at++;const previous=current,next=and();current=ctx=>Boolean(previous(ctx)||next(ctx));}return current;};
 const result=or();assert.equal(at,tokens.length,`SQL predicate completely interpreted: ${tokens.slice(at).join(' ')}`);return result;
}
const where=query=>query.sql.slice(query.sql.indexOf('WHERE ')+6).replace(/ ON CONFLICT[\s\S]*$/,'').replaceAll('::uuid','');
const calls=[];
const database={
 async execute(input){
  const query=dialect.sqlToQuery(input);calls.push(query);
  if(query.sql.includes('FROM public.service_activity_groups'))return {rows:[{count:0}]};
  if(query.sql.startsWith('SELECT count(*)::int AS count FROM public.booking_messages')){
   const include=predicate(where(query),query.params);
   const count=tables['public.booking_messages'].filter(bm=>{const b=tables['public.bookings'].find(row=>row.id===bm.booking_id);return b&&include({b,bm});}).length;
   return {rows:[{count}]};
  }
  if(query.sql.startsWith('SELECT b.id')){const include=predicate(where(query),query.params);return {rows:tables['public.bookings'].filter(b=>include({b})).map(b=>({id:b.id}))};}
  if(query.sql.startsWith('SELECT bm.id')){const include=predicate(where(query),query.params);return {rows:tables['public.booking_messages'].filter(bm=>include({bm})).map(bm=>({id:bm.id}))};}
  if(query.sql.startsWith('INSERT INTO public.booking_message_reads')){
   const [_,userParameter,contextParameter]=query.sql.match(/SELECT (\$\d+),bm.id,(\$\d+) FROM/);const include=predicate(where(query),query.params);
   for(const bm of tables['public.booking_messages']){const b=tables['public.bookings'].find(row=>row.id===bm.booking_id);if(!include({b,bm}))continue;
    const row={user_id:query.params[Number(userParameter.slice(1))-1],message_id:bm.id,context_key:query.params[Number(contextParameter.slice(1))-1]};
    if(!tables['public.booking_message_reads'].some(old=>Object.keys(row).every(key=>old[key]===row[key])))tables['public.booking_message_reads'].push(row);
   }
   return {rows:[]};
  }
  throw new Error('Unexpected synthetic SQL: '+query.sql);
 },
 async transaction(action){const before=structuredClone(tables['public.booking_message_reads']);try{return await action(this);}catch(error){tables['public.booking_message_reads']=before;throw error;}},
};
const inbox=createInboxService(database,async id=>({id}),()=>new Date('2026-11-05T12:00:00Z'));
const personal={scope:'all',userId:'reader'},company={scope:'all',userId:'reader',companyId:8};
let checks=0;const equal=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};
equal((await inbox.summary(personal)).unreadMessages,4,'customer + selected personal provider, self-booking once and own messages excluded');
equal((await inbox.summary(company)).unreadMessages,4,'only assigned selected-company provider messages plus all own customer bookings');
equal((await inbox.summary({scope:'customer',userId:'reader'})).unreadMessages,3,'explicit customer scope remains separate');
equal((await inbox.summary({scope:'provider',userId:'reader',companyId:8})).unreadMessages,1,'read-only employee sees assigned bookings only');
await inbox.readMessages({scope:'provider',userId:'reader'},3,[uuid(3)]);
equal((await inbox.summary(personal)).unreadMessages,3,'a read in provider context clears the global self-booking message exactly once');
equal((await inbox.summary({scope:'customer',userId:'reader'})).unreadMessages,3,'explicit customer read context remains unchanged');
await inbox.readMessages({scope:'customer',userId:'reader'},2,[uuid(2)]);
equal((await inbox.summary(personal)).unreadMessages,2,'a customer read also clears the global count');
equal((await inbox.summary(company)).unreadMessages,2,'read state survives selected-workspace changes');
await inbox.readMessages({scope:'provider',userId:'reader',companyId:8},5,[uuid(5)]);
equal((await inbox.summary(company)).unreadMessages,1,'read-only member can acknowledge an authorized conversation');
await assert.rejects(()=>inbox.readMessages({scope:'provider',userId:'reader',companyId:8},7,[uuid(7)]),error=>error.status===403);checks++;
equal((await inbox.summary({scope:'all',userId:'unrelated'})).unreadMessages,0,'another account cannot see any message');
const before=calls.length;await assert.rejects(()=>inbox.readMessages(personal,1,[uuid(1)]),error=>error.status===400);checks++;equal(calls.length,before,'global read rejects before DB boundary');
await assert.rejects(()=>inbox.booking(personal,1),error=>error.status===400);checks++;
tables['public.booking_messages'].push({id:uuid(50),booking_id:5,author_id:'buyer'});
equal((await inbox.summary(company)).unreadMessages,2,'a newly arrived selected-workspace message remains unread');
tables['public.company_memberships']=tables['public.company_memberships'].filter(row=>row.company_id!==8);
equal((await inbox.summary(company)).unreadMessages,1,'revoked provider membership leaves only legitimately owned customer messages');
console.log(`Passed ${checks} production-SQL global inbox scenarios: one global message union, self-booking deduplication, read parity across existing contexts, selected-workspace/employee/current-membership isolation and unchanged explicit read state. Synthetic predicate interpreter only; no database engine or connected operations.`);
