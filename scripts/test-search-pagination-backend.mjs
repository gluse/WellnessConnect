import assert from 'node:assert/strict';
import express from 'express';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Duplex} from 'node:stream';
import {once} from 'node:events';
import {PgDialect} from 'drizzle-orm/pg-core';
import {setupPublicSearchRoutes} from '../server/publicSearch.ts';
import {createSearchPageService} from '../server/search-pagination/service.ts';
import {searchPageSQL} from '../server/search-pagination/query.ts';
import {createSearchPageStore} from '../server/search-pagination/store.ts';

// Production route/service/query builder with synthetic rows, injected vector
// provider and an in-process HTTP stream. No sockets, DB engine, env loading,
// private configuration, embedding provider or application startup is involved.
let checks=0;const check=fn=>{fn();checks++;};
const data=Array.from({length:620},(_,index)=>{const id=index+1;return {id,name:`Service ${id}`,currency:'EUR',price:id%9===0?'-1':String(id%37),rating:id%8===0?null:(id%5)+1,
 isActive:true,companyActive:true,category:id%2?'education':'wellness',created:`2026-01-01T00:00:00.${String(id).padStart(6,'0')}`,score:(id%17)/16,
 distance:id%10===0?null:(id%60)/10,locationSource:'manual',latitude:0,longitude:0};});
const calls=[];let vectors=0,failEmbedding=false,invalidVector=false,failRanking=false;
function ranked(request){
 const {filters,sort,embedding}=request;let rows=data.filter(row=>row.isActive&&row.companyActive&&(!filters.category||row.category===filters.category));
 if(filters.searchQuery)rows=rows.filter(row=>row.name.toLowerCase().includes(filters.searchQuery.toLowerCase()));
 if(filters.availableOnly)rows=rows.filter(row=>row.id%4!==0);
 if(filters.latitude!==undefined)rows=rows.filter(row=>row.distance!==null&&row.distance<=filters.radius);
 if(embedding)rows=rows.filter(row=>row.score>=.3);
 const priceSortAvailable=rows.every(row=>row.currency==='EUR'||row.currency==='USD')&&new Set(rows.map(row=>row.currency)).size<=1;
 const keys=row=>sort==='default'?embedding?[row.score,row.id]:filters.latitude!==undefined?[row.distance,row.created,row.id]:[row.created,row.id]
  :[sort.startsWith('price')?(priceSortAvailable&&Number(row.price)>=0?Number(row.price):null):sort.startsWith('rating')?row.rating:row.distance,row.id];
 const directions=sort==='default'?(embedding?[-1,1]:filters.latitude!==undefined?[1,-1,-1]:[-1,-1]):[sort.endsWith('desc')?-1:1,1];
 function compare(a,b){for(let index=0;index<a.length;index++){if(a[index]===b[index])continue;if(a[index]===null)return 1;if(b[index]===null)return -1;return (a[index]<b[index]?-1:1)*directions[index];}return 0;}
 return rows.map(row=>({id:row.id,keys:keys(row),priceSortAvailable,currency:row.currency,distance:filters.latitude!==undefined?row.distance:null})).sort((a,b)=>compare(a.keys,b.keys)).filter(row=>!request.position||compare(row.keys,request.position)>0).slice(0,request.limit+1);
}
const store={async rows(request){calls.push(structuredClone(request));if(failRanking&&request.embedding)throw Error('PRIVATE_SQL_CANARY');return ranked(request);},async hydrate(ids){return ids.slice().reverse().map(id=>data.find(row=>row.id===id)).filter(Boolean);}};
let now=100000;const pager=createSearchPageService(store,async()=>{vectors++;if(failEmbedding)throw Error('PRIVATE_PROVIDER_CANARY');return invalidVector?[1e-300,0]:[1,0];},{now:()=>now,secret:Buffer.alloc(32,7)});
const signal=new AbortController().signal;
async function collect(input){const pages=[],ids=[];let cursor;for(let attempts=0;attempts<100;attempts++){const page=await pager.page({...input,signal,...(cursor?{cursor}:{})});pages.push(page);ids.push(...page.services.map(row=>row.id));if(!page.nextCursor)return {pages,ids};assert.notEqual(page.nextCursor,cursor);cursor=page.nextCursor;}throw Error('Pagination failed to terminate');}
let result=await collect({filters:{},sort:'default',limit:24});
check(()=>{assert.equal(result.ids.length,620);assert.equal(new Set(result.ids).size,620);assert.equal(result.pages[0].services.length,24);assert.equal(result.pages.at(-1).nextCursor,null);assert.deepEqual(result.ids,Array.from({length:620},(_,i)=>620-i));});
check(()=>assert.equal(calls[1].position[0],'2026-01-01T00:00:00.000597','timestamp microseconds survive opaque continuation without Date rounding'));
const originalCreated=data.slice(0,2).map(row=>row.created);data[0].created=null;data[1].created=null;
const missingCreated=await collect({filters:{},sort:'default',limit:24});
check(()=>assert.deepEqual(missingCreated.ids.slice(-2),[2,1],'nullable default timestamps remain last and retain the unique ID tie order'));
data[0].created=originalCreated[0];data[1].created=originalCreated[1];
for(const sort of ['price-asc','price-desc','rating-asc','rating-desc','distance-asc','distance-desc']){
 const filters=sort.startsWith('distance')?{latitude:0,longitude:0,radius:10}:{};
 result=await collect({filters,sort,limit:50});
 const expected=ranked({filters,sort,limit:1000}).map(row=>row.id);
 check(()=>{assert.deepEqual(result.ids,expected,sort+' globally ordered through every page');assert.equal(new Set(result.ids).size,result.ids.length);assert.ok(result.ids.length>500);});
}
result=await collect({filters:{category:'education',availableOnly:true,date:'2026-11-05'},sort:'price-asc',limit:24});
check(()=>{assert.ok(result.ids.length>50);assert.ok(result.ids.every(id=>id%2===1&&id%4!==0));});
// Currency eligibility is calculated over all filtered matches before any page.
data[0].currency='USD';
const mixed=await pager.page({filters:{},sort:'price-asc',limit:24,signal});
check(()=>{assert.equal(mixed.priceSortAvailable,false);assert.equal(mixed.effectiveSort,'default');assert.deepEqual(mixed.services.map(row=>row.id),Array.from({length:24},(_,i)=>620-i));assert.ok(!mixed.services.some(row=>row.currency==='USD'),'foreign currency can lie beyond the visible page');});
const mixedTraversal=await collect({filters:{},sort:'price-desc',limit:24});
check(()=>{assert.equal(mixedTraversal.ids.length,620);assert.equal(new Set(mixedTraversal.ids).size,620);assert.ok(mixedTraversal.pages.every(page=>page.effectiveSort==='default'&&!page.priceSortAvailable));});
const singleFiltered=await pager.page({filters:{category:'wellness'},sort:'price-asc',limit:24,signal});
check(()=>{assert.equal(singleFiltered.priceSortAvailable,true);assert.equal(singleFiltered.effectiveSort,'price-asc');});
data[0].currency=null;
check(()=>assert.equal(ranked({filters:{},sort:'default',limit:1})[0].priceSortAvailable,false));
assert.equal((await pager.page({filters:{},sort:'price-asc',limit:24,signal})).effectiveSort,'default');checks++;
data[0].currency='EUR';
const beforeCurrencyChange=await pager.page({filters:{},sort:'price-asc',limit:24,signal});
data[0].currency='USD';
await assert.rejects(()=>pager.page({filters:{},sort:'price-asc',limit:24,signal,cursor:beforeCurrencyChange.nextCursor}),error=>error.code==='SEARCH_CURRENCY_CHANGED');checks++;
data[0].currency='EUR';
const hydrationMutation=createSearchPageService({...store,async hydrate(ids){return (await store.hydrate(ids)).map((row,index)=>index===0?{...row,currency:'USD'}:row);}},async()=>[1,0],{secret:Buffer.alloc(32,9)});
for(const sort of ['default','price-asc','price-desc']){
 await assert.rejects(()=>hydrationMutation.page({filters:{},sort,limit:24,signal}),error=>error.code==='SEARCH_CURRENCY_CHANGED');checks++;
}
const first=await pager.page({filters:{},sort:'default',limit:24,signal});
await assert.rejects(()=>pager.page({filters:{category:'education'},sort:'default',limit:24,signal,cursor:first.nextCursor}),error=>error.status===400);checks++;
await assert.rejects(()=>pager.page({filters:{},sort:'price-asc',limit:24,signal,cursor:first.nextCursor}),error=>error.status===400);checks++;
await assert.rejects(()=>pager.page({filters:{},sort:'default',limit:24,signal,cursor:first.nextCursor.slice(0,-3)+'aaa'}),error=>error.status===400);checks++;
now+=600001;await assert.rejects(()=>pager.page({filters:{},sort:'default',limit:24,signal,cursor:first.nextCursor}),error=>error.status===410);checks++;
now=100000;vectors=0;result=await collect({filters:{},sort:'default',semanticQuery:'semantic-intent',limit:24});
check(()=>{assert.ok(result.ids.length>100);assert.equal(new Set(result.ids).size,result.ids.length);assert.equal(vectors,1);assert.ok(result.pages.every(page=>page.mode==='semantic'));});
const beforeText=vectors;const textPage=await pager.page({filters:{},sort:'default',semanticQuery:'Service 1',limit:24,signal});
check(()=>{assert.equal(textPage.mode,'text');assert.equal(vectors,beforeText,'exact matches avoid paid work');});
failEmbedding=true;const fallback=await pager.page({filters:{},sort:'default',semanticQuery:'provider-failure',limit:24,signal});failEmbedding=false;
check(()=>{assert.equal(fallback.mode,'text-fallback');assert.equal(fallback.nextCursor,null);});
invalidVector=true;const underflow=await pager.page({filters:{},sort:'default',semanticQuery:'underflow-vector',limit:24,signal});invalidVector=false;
check(()=>assert.equal(underflow.mode,'text-fallback','zero/underflow squared norm cannot reach SQL division'));
failRanking=true;await assert.rejects(()=>pager.page({filters:{},sort:'default',semanticQuery:'ranking-failure',limit:24,signal}),/PRIVATE_SQL_CANARY/);checks++;failRanking=false;
const evicting=createSearchPageService(store,async()=>[1,0],{now:()=>now,secret:Buffer.alloc(32,8),maxContexts:1});
const oldContext=await evicting.page({filters:{},sort:'default',semanticQuery:'intent-one',limit:24,signal});await evicting.page({filters:{},sort:'default',semanticQuery:'intent-two',limit:24,signal});
await assert.rejects(()=>evicting.page({filters:{},sort:'default',semanticQuery:'intent-one',limit:24,signal,cursor:oldContext.nextCursor}),error=>error.status===410);checks++;

const dialect=new PgDialect();
for(const sort of ['default','price-asc','price-desc','rating-asc','rating-desc','distance-asc','distance-desc']){
 const query=dialect.sqlToQuery(searchPageSQL({filters:{latitude:0,longitude:0,radius:10,date:'2026-11-05',dateEnd:'2026-11-20',availableOnly:true,time:'09:00',timeEnd:'11:00',ageGroups:['adults'],searchQuery:"quote' PRIVATE_BOUND_CANARY"},sort,limit:24}));
 check(()=>{assert.equal(query.sql.toLowerCase().includes('private_bound_canary'),false);assert.ok(query.params.some(value=>String(value).includes('private_bound_canary')));assert.ok(query.sql.includes('EXISTS(SELECT 1 FROM public.availability'));assert.ok(query.sql.indexOf('EXISTS(SELECT 1 FROM public.availability')<query.sql.lastIndexOf(' LIMIT '));assert.match(query.sql,/NULLS LAST/);assert.equal(query.params.at(-1),25);assert.ok(!query.params.includes(501));});
}
const vectorSQL=dialect.sqlToQuery(searchPageSQL({filters:{},sort:'default',limit:24,embedding:[1,0]}));
check(()=>{assert.match(vectorSQL.sql,/WITH ORDINALITY/);assert.match(vectorSQL.sql,/USING\(ordinality\)/);assert.match(vectorSQL.sql,/jsonb_array_length\(se.embedding\)=\$/);assert.match(vectorSQL.sql,/e.score_key<'Infinity'/);assert.ok(vectorSQL.params.includes('{1,0}'));});
const sqlCalls=[];const db={async transaction(action){return action({async execute(query){sqlCalls.push(dialect.sqlToQuery(query));return {rows:[]};}});}};
await createSearchPageStore(db,async()=>[]).rows({filters:{},sort:'default',limit:24});
check(()=>{assert.equal(sqlCalls[0].sql,'SET TRANSACTION READ ONLY');assert.match(sqlCalls[1].sql,/statement_timeout='8000ms'/);assert.equal(sqlCalls[2].params.at(-1),25);});

async function request(app,path){
 const chunks=[];const socket=new Duplex({read(){},write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback();}});
 Object.defineProperty(socket,'remoteAddress',{value:'127.0.0.1'});const req=new IncomingMessage(socket);req._read=()=>{};req.complete=true;req.url=path;req.method='GET';req.headers={};
 const res=new ServerResponse(req);res.assignSocket(socket);const done=once(res,'finish');app.handle(req,res);queueMicrotask(()=>req.push(null));
 await Promise.race([done,new Promise((_resolve,reject)=>setTimeout(()=>reject(Error('HTTP fixture timeout')),3000).unref())]);socket.destroy();
 const wire=Buffer.concat(chunks).toString('utf8'),body=wire.slice(wire.indexOf('\r\n\r\n')+4);return {status:res.statusCode,body:body?JSON.parse(body):null,headers:res.getHeaders()};
}
const policy={windowMs:60000,readsPerIp:1000,readsPerProcess:1000,semanticPerIp:1000,semanticPerProcess:1000,concurrentEmbeddings:2};
function appFor(overrides={},budgets=policy){const app=express();app.set('trust proxy',false);setupPublicSearchRoutes(app,{searchPageStore:store,async searchServices(){return [];},async getPublicServiceEmbeddings(){return [];},async generateEmbedding(){return [1,0];},...overrides},budgets);return app;}
const app=appFor();let response=await request(app,'/api/services/search/page');
check(()=>{assert.equal(response.status,200);assert.equal(response.body.services.length,24);assert.equal(response.body.mode,'text');assert.ok(response.body.nextCursor);assert.equal(response.headers['cache-control'],'no-store');});
for(const query of ['limit=0','limit=51','limit[]=24','limit=24&limit=24','sort=unknown','companyId=8','providerId=secret','cursor=bad','dateEnd=2026-11-05','availableOnly=true']){
 response=await request(app,'/api/services/search/page?'+query);check(()=>assert.equal(response.status,400,query));
}
response=await request(app,'/api/services/search');check(()=>{assert.equal(response.status,200);assert.ok(Array.isArray(response.body),'legacy endpoint retains array contract');});
response=await request(app,'/api/services/semantic-search/page?query=semantic-intent&sort=rating-desc');check(()=>{assert.equal(response.status,200);assert.equal(response.body.mode,'semantic');});
const limited=appFor({}, {...policy,semanticPerIp:1,semanticPerProcess:1});
response=await request(limited,'/api/services/semantic-search/page?query=intent-one');check(()=>assert.equal(response.status,200));
const next=await request(limited,'/api/services/semantic-search/page?query=intent-one&cursor='+encodeURIComponent(response.body.nextCursor));check(()=>assert.equal(next.status,200,'continuation reuses vector without consuming a new paid-work budget'));
response=await request(limited,'/api/services/semantic-search/page?query=intent-two');check(()=>assert.equal(response.status,429));
response=await request(appFor({searchPageStore:{...store,async rows(){throw Error('PRIVATE_DB_CANARY');}}}),'/api/services/search/page');check(()=>{assert.equal(response.status,503);assert.equal(JSON.stringify(response.body).includes('PRIVATE_'),false);});
let release,embeddingCalls=0;const sharedBudget=appFor({async getPublicServiceEmbeddings(){return [{serviceId:1,embedding:[1,0]}];},async generateEmbedding(){embeddingCalls++;await new Promise(resolve=>{release=resolve;});return [1,0];}}, {...policy,concurrentEmbeddings:1});
const held=request(sharedBudget,'/api/services/semantic-search/page?query=held-page-intent');
for(let attempt=0;!release&&attempt<30;attempt++)await new Promise(resolve=>setImmediate(resolve));
assert.ok(release,'synthetic provider reached');
try{response=await request(sharedBudget,'/api/services/semantic-search?query=legacy-while-page-active');check(()=>{assert.equal(response.status,429);assert.equal(embeddingCalls,1,'legacy and paged routes share the same concurrent paid-work budget');});}finally{release();}
const heldResult=await held;check(()=>assert.equal(heldResult.status,200));
console.log(`Passed ${checks} search-pagination backend scenarios:620-row traversal, global sorts/ties/nulls, exact timestamp cursors, filter/tamper/expiry checks, semantic >100/context reuse/fallback, guarded parameterized SQL, bounded readonly ranking, compatible APIs and paid-work budgets. Synthetic rows/provider/HTTP streams only.`);
