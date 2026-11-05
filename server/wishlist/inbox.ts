import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { BookingWithDetails } from "../../shared/schema";
import type { InboxMessages, InboxNotifications, InboxNotification, InboxScope, InboxSummary } from "../../shared/wishlist";
import { queryRows, type ProductDatabase, type ProductQuery } from "./postgres";
import { WishlistError } from "./service";

export type InboxActor = InboxScope & { userId: string };
const contextKey = (actor: InboxActor) => actor.scope === "customer" ? "customer" : actor.companyId == null ? "provider:personal" : `provider:company:${actor.companyId}`;
// Every query rechecks current membership/assignment rather than trusting a cache or client role.
export function bookingAccess(actor: InboxActor): SQL {
  if (actor.scope === "customer") return sql`b.seeker_id=${actor.userId}`;
  if (actor.scope === "all") return sql`(b.seeker_id=${actor.userId} OR (${bookingAccess({...actor,scope:"provider"})}))`;
  if (actor.companyId == null) return sql`b.provider_id=${actor.userId} AND b.company_id IS NULL`;
  return sql`b.company_id=${actor.companyId} AND EXISTS(SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id=m.company_id
    WHERE c.is_active AND m.company_id=b.company_id AND m.user_id=${actor.userId}
    AND (m.role IN ('owner','admin') OR m.employee_id=b.employee_id))`;
}
export function groupAccess(actor: InboxActor): SQL {
  if (actor.scope === "customer") return sql`false`;
  if (actor.companyId == null) return sql`g.provider_id=${actor.userId} AND g.company_id IS NULL AND s.company_id IS NULL AND s.provider_id=${actor.userId}`;
  return sql`g.company_id=${actor.companyId} AND s.company_id=g.company_id AND EXISTS(SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id=m.company_id
    WHERE c.is_active AND m.company_id=g.company_id AND m.user_id=${actor.userId} AND (m.role IN ('owner','admin') OR m.employee_id=s.employee_id))`;
}
const unread = (actor: InboxActor) => sql`bm.author_id<>${actor.userId} AND NOT EXISTS(SELECT 1 FROM public.booking_message_reads r
  WHERE r.message_id=bm.id AND r.user_id=${actor.userId} ${actor.scope==="all"?sql``:sql`AND r.context_key=${contextKey(actor)}`})`;
const cursorShape = z.object({ date: z.string().datetime(), id: z.union([z.number().int().positive(),z.string().uuid()]) }).strict();
function readCursor(value?: string) {
  if (!value) return null;
  try { return cursorShape.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8"))); }
  catch { throw new WishlistError(400,"invalid_cursor"); }
}
function cursor(date: string, id: number|string) { return Buffer.from(JSON.stringify({date,id})).toString("base64url"); }
export function createInboxService(database: ProductDatabase, hydrateBooking: (id:number)=>Promise<BookingWithDetails|undefined>, now=()=>new Date()) {
  async function requireBooking(actor:InboxActor, id:number, query:ProductQuery=database) {
    const rows=await queryRows(query,sql`SELECT b.id FROM public.bookings b WHERE b.id=${id} AND (${bookingAccess(actor)})`);
    if(!rows.length)throw new WishlistError(403,"conversation_unavailable");
  }
  return {
    async summary(actor:InboxActor):Promise<InboxSummary> {
      const [messages]=await queryRows<{count:number}>(database,sql`SELECT count(*)::int AS count FROM public.booking_messages bm JOIN public.bookings b ON b.id=bm.booking_id
        WHERE (${bookingAccess(actor)}) AND (${unread(actor)})`);
      const [notifications]=await queryRows<{count:number}>(database,sql`SELECT count(*)::int AS count FROM public.service_activity_groups g JOIN public.services s ON s.id=g.service_id
        LEFT JOIN public.service_activity_reads r ON r.group_id=g.id AND r.user_id=${actor.userId}
        WHERE (${groupAccess(actor)}) AND g.expires_at>${now().toISOString()}::timestamptz AND COALESCE(r.read_revision,0)<g.revision`);
      return {unreadMessages:messages.count,unreadNotifications:notifications.count};
    },
    async messages(actor:InboxActor,before:string|undefined,limit:number):Promise<InboxMessages> {
      const after=readCursor(before); if(after&&typeof after.id!=="number")throw new WishlistError(400,"invalid_cursor");
      const customerView=actor.scope==='all'?sql`b.seeker_id=${actor.userId}`:actor.scope==='customer'?sql`true`:sql`false`;
      type Row={bookingId:number;serviceName:string;counterpartName:string;scheduledDate:Date;updatedAt:Date;unreadCount:number;canSend:boolean;viewer:'customer'|'provider';companyId:number|null};
      const rows=await queryRows<Row>(database,sql`SELECT b.id AS "bookingId",s.name AS "serviceName",b.scheduled_date AS "scheduledDate",
        CASE WHEN ${customerView} THEN 'customer' ELSE 'provider' END AS viewer,
        CASE WHEN ${customerView} THEN NULL ELSE b.company_id END AS "companyId",
        COALESCE(NULLIF(trim(COALESCE(u.first_name,'')||' '||COALESCE(u.last_name,'')),''),CASE WHEN ${customerView} THEN 'Service provider' ELSE 'Customer' END) AS "counterpartName",
        max(bm.created_at) AS "updatedAt",count(*) FILTER(WHERE ${unread(actor)})::int AS "unreadCount",
        CASE WHEN ${customerView} THEN true ELSE ${actor.companyId==null?sql`true`:sql`EXISTS(SELECT 1 FROM public.company_memberships cm WHERE cm.company_id=b.company_id AND cm.user_id=${actor.userId} AND cm.role<>'viewer')`} END AS "canSend"
        FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.booking_messages bm ON bm.booking_id=b.id
        LEFT JOIN public.users u ON u.id=CASE WHEN ${customerView} THEN b.provider_id ELSE b.seeker_id END
        WHERE (${bookingAccess(actor)}) GROUP BY b.id,s.name,u.first_name,u.last_name
        ${after?sql`HAVING (max(bm.created_at),b.id)<(${after.date}::timestamptz,${after.id})`:sql``}
        ORDER BY max(bm.created_at) DESC,b.id DESC LIMIT ${limit+1}`);
      const items=rows.slice(0,limit).map(row=>({...row,scheduledDate:new Date(row.scheduledDate).toISOString(),updatedAt:new Date(row.updatedAt).toISOString()}));
      const last=items.at(-1);return {items,nextCursor:rows.length>limit&&last?cursor(last.updatedAt,last.bookingId):null};
    },
    async booking(actor:InboxActor,id:number) {
      if(actor.scope==='all')throw new WishlistError(400,'explicit_scope_required');
      await requireBooking(actor,id);const booking=await hydrateBooking(id);if(!booking)throw new WishlistError(404,"conversation_unavailable");return booking;
    },
    async readMessages(actor:InboxActor,id:number,messageIds:string[]) {
      if(actor.scope==='all')throw new WishlistError(400,'explicit_scope_required');
      await database.transaction(async tx=>{
        await requireBooking(actor,id,tx);
        const ids=sql.join(messageIds.map(value=>sql`${value}::uuid`),sql`, `);
        const valid=await queryRows(tx,sql`SELECT bm.id FROM public.booking_messages bm WHERE bm.booking_id=${id} AND bm.id IN (${ids})`);
        if(valid.length!==messageIds.length)throw new WishlistError(400,"invalid_messages");
        await tx.execute(sql`INSERT INTO public.booking_message_reads(user_id,message_id,context_key)
          SELECT ${actor.userId},bm.id,${contextKey(actor)} FROM public.booking_messages bm JOIN public.bookings b ON b.id=bm.booking_id
          WHERE b.id=${id} AND (${bookingAccess(actor)}) AND bm.id IN (${ids}) AND bm.author_id<>${actor.userId} ON CONFLICT DO NOTHING`);
      });
    },
    async notifications(actor:InboxActor,before:string|undefined,limit:number):Promise<InboxNotifications> {
      const after=readCursor(before);if(after&&typeof after.id!=="string")throw new WishlistError(400,"invalid_cursor");
      type Row=Omit<InboxNotification,'updatedAt'|'reportingDay'> & {updatedAt:Date;reportingDay:string};
      const rows=await queryRows<Row>(database,sql`SELECT g.id,g.kind,g.service_id AS "serviceId",CASE WHEN s.is_active THEN s.name ELSE NULL END AS "serviceName",
        g.reporting_day::text AS "reportingDay",g.count,g.revision,COALESCE(r.read_revision,0)>=g.revision AS read,s.is_active AS available,g.updated_at AS "updatedAt"
        FROM public.service_activity_groups g JOIN public.services s ON s.id=g.service_id
        LEFT JOIN public.service_activity_reads r ON r.group_id=g.id AND r.user_id=${actor.userId}
        WHERE (${groupAccess(actor)}) AND g.expires_at>${now().toISOString()}::timestamptz
        ${after?sql`AND (g.updated_at,g.id)<(${after.date}::timestamptz,${after.id}::uuid)`:sql``}
        ORDER BY g.updated_at DESC,g.id DESC LIMIT ${limit+1}`);
      const items=rows.slice(0,limit).map(row=>({...row,updatedAt:new Date(row.updatedAt).toISOString()}));const last=items.at(-1);
      return {items,nextCursor:rows.length>limit&&last?cursor(last.updatedAt,last.id):null};
    },
    async readNotifications(actor:InboxActor,items:{id:string;revision:number}[]) {
      await database.transaction(async tx=>{
        for(const item of items){
          const allowed=await queryRows<{revision:number}>(tx,sql`SELECT g.revision FROM public.service_activity_groups g JOIN public.services s ON s.id=g.service_id
            WHERE g.id=${item.id}::uuid AND (${groupAccess(actor)}) AND g.expires_at>${now().toISOString()}::timestamptz`);
          if(!allowed.length)throw new WishlistError(403,"notification_unavailable");
          if(item.revision>allowed[0].revision)throw new WishlistError(400,"invalid_revision");
          await tx.execute(sql`INSERT INTO public.service_activity_reads(user_id,group_id,read_revision) VALUES(${actor.userId},${item.id}::uuid,${item.revision})
            ON CONFLICT(user_id,group_id) DO UPDATE SET read_revision=GREATEST(service_activity_reads.read_revision,EXCLUDED.read_revision)`);
        }
      });
    },
  };
}
export type InboxService=ReturnType<typeof createInboxService>;
