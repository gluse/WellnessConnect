import type {Express,Request,RequestHandler} from "express";
import {rateLimit} from "express-rate-limit";
import {z} from "zod";
import {inboxScopeSchema,messageReadSchema,notificationReadSchema,positiveServiceId,wishlistPageSchema} from "../../shared/wishlist";
import type {User} from "../../shared/schema";
import {WishlistError,type WishlistService} from "./service";
import type {InboxActor,InboxService} from "./inbox";

export function setupWishlistRoutes(app:Express,authenticate:RequestHandler,wishlist:WishlistService,inbox:InboxService,getUser:(id:string)=>Promise<User|undefined>){
  const limit=rateLimit({windowMs:60_000,limit:120,standardHeaders:'draft-7',legacyHeaders:false,message:{code:'rate_limited',message:'Please try again shortly.'}});
  app.use(['/api/wishlist','/api/inbox'],(_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
  const handle=(action:(req:Request)=>Promise<unknown>,empty=false):RequestHandler=>(req,res)=>{void(async()=>{try{
    const result=await action(req);if(empty)res.sendStatus(204);else res.json(result);
  }catch(error){const known=error instanceof WishlistError;res.status(known?error.status:error instanceof z.ZodError?400:503).json({code:known?error.code:error instanceof z.ZodError?'invalid_input':'inbox_unavailable',message:'Unable to complete this request.'});}})();};
  const user=(req:Request)=>req.user!.claims.sub;
  const id=(req:Request)=>positiveServiceId.parse(req.params.id);
  const page=(req:Request)=>wishlistPageSchema.parse({...(req.query.cursor!==undefined?{cursor:req.query.cursor}:{}),...(req.query.limit!==undefined?{limit:req.query.limit}:{})});
  async function actor(req:Request):Promise<InboxActor>{
    const parsed=inboxScopeSchema.parse({scope:req.query.scope,...(req.query.companyId!==undefined?{companyId:req.query.companyId}:{})});
    if(parsed.scope==='customer'){if(parsed.companyId!=null)throw new WishlistError(400,'invalid_scope');return {...parsed,userId:user(req)};}
    const profile=await getUser(user(req));const ctx=req.workspace;
    // Provider pages are an ownership/workspace view, not a profile-role switch.
    // A personal service owner can still have the default seeker profile role.
    if(!profile||!['provider','seeker'].includes(profile.currentRole??'')||!ctx||ctx.invalid||ctx.company?.isActive===false||(ctx.company?.id??null)!==(parsed.companyId??null))throw new WishlistError(403,'invalid_scope');
    return {...parsed,userId:user(req)};
  }
  const scopeQuery=z.object({scope:z.enum(['customer','provider','all']),companyId:z.string().optional(),cursor:z.string().max(300).optional(),limit:z.coerce.number().int().min(1).max(50).optional()}).strict();
  async function explicitActor(req:Request):Promise<InboxActor>{const current=await actor(req);if(current.scope==='all')throw new WishlistError(400,'explicit_scope_required');return current;}
  const empty=z.object({}).strict();
  app.get('/api/wishlist/services',authenticate,limit,handle(async req=>{const q=wishlistPageSchema.parse(req.query);return wishlist.list(user(req),q.cursor,q.limit);}));
  app.get('/api/wishlist/membership',authenticate,limit,handle(async req=>{
    const q=z.object({serviceIds:z.string().max(1200)}).strict().parse(req.query);
    const ids=z.array(positiveServiceId).min(1).max(100).parse(q.serviceIds.split(','));
    if(new Set(ids).size!==ids.length)throw new WishlistError(400,'invalid_input');return wishlist.membership(user(req),ids);
  }));
  app.put('/api/wishlist/services/:id',authenticate,limit,handle(async req=>{empty.parse(req.query);empty.parse(req.body??{});await wishlist.save(user(req),id(req));},true));
  app.delete('/api/wishlist/services/:id',authenticate,limit,handle(async req=>{empty.parse(req.query);empty.parse(req.body??{});await wishlist.remove(user(req),id(req));},true));
  app.get('/api/inbox/summary',authenticate,limit,handle(async req=>{inboxScopeSchema.parse(req.query);return inbox.summary(await actor(req));}));
  app.get('/api/inbox/messages',authenticate,limit,handle(async req=>{scopeQuery.parse(req.query);const q=page(req);return inbox.messages(await actor(req),q.cursor,q.limit);}));
  app.get('/api/inbox/messages/:id',authenticate,limit,handle(async req=>{inboxScopeSchema.parse(req.query);return inbox.booking(await explicitActor(req),id(req));}));
  app.post('/api/inbox/messages/:id/read',authenticate,limit,handle(async req=>{inboxScopeSchema.parse(req.query);const body=messageReadSchema.parse(req.body);await inbox.readMessages(await explicitActor(req),id(req),body.messageIds);},true));
  app.get('/api/inbox/notifications',authenticate,limit,handle(async req=>{scopeQuery.parse(req.query);const q=page(req);return inbox.notifications(await actor(req),q.cursor,q.limit);}));
  app.post('/api/inbox/notifications/read',authenticate,limit,handle(async req=>{inboxScopeSchema.parse(req.query);await inbox.readNotifications(await actor(req),notificationReadSchema.parse(req.body).items);},true));
}
