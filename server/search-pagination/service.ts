import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {currentLocation} from '../../shared/locations';
import type {ServiceWithProvider} from '../../shared/schema';
import type {SearchPage,SearchPageMode,SearchSort} from '../../shared/search-pagination';
import {SearchError,type SearchFilters} from '../searchInput';
import type {SearchPageRequest,SearchPageRow,SearchPosition} from './query';

export type SearchPageStore={rows(request:SearchPageRequest):Promise<SearchPageRow[]>;hydrate(ids:number[]):Promise<ServiceWithProvider[]>};
export type SearchPageInput={filters:SearchFilters;sort:SearchSort;limit:number;cursor?:string;semanticQuery?:string;signal:AbortSignal};
type EmbeddingContext={embedding:number[];expires:number;hash:string};
const cursorSchema=z.object({v:z.literal(1),hash:z.string().regex(/^[a-f0-9]{64}$/),mode:z.enum(['text','semantic','text-fallback']),position:z.array(z.union([z.number().finite(),z.string().max(40),z.null()])).min(2).max(3),expires:z.number().int().positive(),context:z.string().uuid().optional()}).strict();
const vector=z.array(z.number().finite().min(-1e100).max(1e100)).min(1).max(8192).refine(values=>{const norm=values.reduce((sum,value)=>sum+value*value,0);return norm>0&&Number.isFinite(norm);});
const invalid=()=>new SearchError(400,'INVALID_SEARCH_CURSOR','Search continuation does not match this search. Start again.');
const expired=()=>new SearchError(410,'SEARCH_EXPIRED','This search continuation expired. Start the search again.');
export function createSearchPageService(store:SearchPageStore,embed:(query:string,signal:AbortSignal)=>Promise<number[]>,options:{now?:()=>number;secret?:Buffer;ttlMs?:number;maxContexts?:number}={}){
 const now=options.now??Date.now,secret=options.secret??randomBytes(32),ttl=options.ttlMs??600_000,maxContexts=options.maxContexts??100;
 const contexts=new Map<string,EmbeddingContext>();
 const signature=(body:string)=>createHmac('sha256',secret).update(body).digest('base64url');
 const encode=(payload:z.infer<typeof cursorSchema>)=>{const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+signature(body);};
 function decode(token:string){
  try{
   const parts=token.split('.');if(parts.length!==2||!parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)))throw invalid();
   const supplied=Buffer.from(parts[1],'base64url'),expected=Buffer.from(signature(parts[0]),'base64url');
   if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw invalid();
   return cursorSchema.parse(JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')));
  }catch{throw invalid();}
 }
 return {
  async page(input:SearchPageInput):Promise<SearchPage>{
   const filters={...input.filters};delete filters.limit;
   const normalized={...filters,...(filters.ageGroups?{ageGroups:[...filters.ageGroups].sort()}:{}),sort:input.sort,semanticQuery:input.semanticQuery??null};
   const hash=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(normalized).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
   for(const [id,context] of Array.from(contexts))if(context.expires<=now())contexts.delete(id);
   const continuation=input.cursor?decode(input.cursor):undefined;
   if(continuation&&continuation.hash!==hash)throw invalid();
   if(continuation&&continuation.expires<=now())throw expired();
   let mode:SearchPageMode=continuation?.mode??'text',contextId=continuation?.context,embedding:number[]|undefined,rows:SearchPageRow[];
   const expiresAt=continuation?.expires??now()+ttl;
   const exactFilters=input.semanticQuery?{...filters,searchQuery:input.semanticQuery}:filters;
   if(continuation?.mode==='semantic'){
    const context=contextId?contexts.get(contextId):undefined;if(!context||context.hash!==hash||context.expires<=now())throw expired();embedding=context.embedding;
    rows=await store.rows({filters,sort:input.sort,limit:input.limit,position:continuation.position,embedding});
   }else if(continuation){
    rows=await store.rows({filters:exactFilters,sort:input.sort,limit:input.limit,position:continuation.position});
   }else{
    rows=await store.rows({filters:exactFilters,sort:input.sort,limit:input.limit});
    if(input.semanticQuery&&!rows.length){
     if(!(await store.rows({filters,sort:input.sort,limit:1,requireEmbedding:true})).length)return {services:[],nextCursor:null,mode:'semantic'};
     try{
      embedding=vector.parse(await embed(input.semanticQuery,input.signal));
     }catch(error){
      if(error instanceof SearchError)throw error;
      mode='text-fallback';embedding=undefined;contextId=undefined;
      rows=await store.rows({filters:exactFilters,sort:input.sort,limit:input.limit});
     }
     if(embedding){
      mode='semantic';contextId=randomUUID();
      while(contexts.size>=maxContexts)contexts.delete(contexts.keys().next().value!);
      contexts.set(contextId,{embedding,hash,expires:expiresAt});
      rows=await store.rows({filters,sort:input.sort,limit:input.limit,embedding});
     }
    }
   }
   const selected=rows.slice(0,input.limit),hydrated=await store.hydrate(selected.map(row=>row.id));const byId=new Map(hydrated.map(service=>[service.id,service]));
   const services=selected.flatMap(row=>{
    const service=byId.get(row.id);if(!service?.isActive||!service.companyActive)return [];
    const dto=currentLocation({...service,...(row.distance!=null?{distance:Math.round(row.distance*10)/10}:{})});
    return filters.latitude!==undefined&&dto.distance===undefined?[]:[dto];
   });
   const last=selected.at(-1);
   const nextCursor=rows.length>input.limit&&last?encode({v:1,hash,mode,position:last.keys,expires:expiresAt,...(contextId?{context:contextId}:{})}):null;
   return {services,nextCursor,mode};
  },
 };
}
