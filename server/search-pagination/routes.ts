import type {Express,RequestHandler} from 'express';
import {z} from 'zod';
import {SEARCH_SORTS} from '../../shared/search-pagination';
import {SearchError,publicSearchSchema,semanticSearchSchema} from '../searchInput';
import {createSearchPageService} from './service';
import type {PublicSearchDependencies,PublicSearchPolicy} from '../publicSearch';

export function setupSearchPageRoutes(app:Express,deps:PublicSearchDependencies,policy:PublicSearchPolicy,readLimits:RequestHandler[],semanticLimits:RequestHandler[]){
 let active=0;
 const pager=deps.searchPageStore?createSearchPageService(deps.searchPageStore,async(query,signal)=>{
  if(active>=policy.concurrentEmbeddings)throw new SearchError(429,'SEARCH_RATE_LIMITED','Search is busy. Please try again shortly.');
  active++;try{return await deps.generateEmbedding(query,{timeout:8000,maxRetries:0,signal});}finally{active--;}
 }):undefined;
 const controls=z.object({sort:z.enum(SEARCH_SORTS).default('default'),cursor:z.string().max(4000).optional(),limit:z.preprocess(value=>typeof value==='string'&&value.trim()!==''?Number(value):value,z.number().int().min(1).max(50).default(24))}).strict();
 function route(semantic:boolean):RequestHandler{return (req,res)=>{void(async()=>{
  res.set('Cache-Control','no-store');const controller=new AbortController();const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
  try{
   if(!pager)throw new SearchError(503,'SEARCH_UNAVAILABLE','Search is temporarily unavailable.');
   const {sort,cursor,limit,...raw}=req.query;
   const input=controls.parse({...(sort!==undefined?{sort}:{}),...(cursor!==undefined?{cursor}:{}),...(limit!==undefined?{limit}:{})});
   const parsed=semantic?semanticSearchSchema.parse(raw):publicSearchSchema.parse(raw);
   const semanticQuery='query' in parsed?parsed.query:undefined;
   const filters='query' in parsed?(({query,...rest})=>rest)(parsed):parsed;
   const page=await pager.page({...input,filters,semanticQuery,signal:controller.signal});res.json(page);
  }catch(error){
   if(error instanceof SearchError){if(error.status===429)res.set('Retry-After','1');res.status(error.status).json({code:error.code,message:error.message});}
   else res.status(error instanceof z.ZodError?400:503).json({code:error instanceof z.ZodError?'INVALID_SEARCH':'SEARCH_UNAVAILABLE',message:error instanceof z.ZodError?'Choose valid search filters.':'Search is temporarily unavailable. Please try again.'});
  }finally{res.off('close',close);}
 })();};}
 app.get('/api/services/search/page',...readLimits,route(false));
 const firstPageBudget=semanticLimits.map(limit=>(req,res,next)=>req.query.cursor?next():limit(req,res,next)) as RequestHandler[];
 app.get('/api/services/semantic-search/page',...readLimits,...firstPageBudget,route(true));
}
