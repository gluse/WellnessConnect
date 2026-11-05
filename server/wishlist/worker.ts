import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { ActivityEvent } from "./service";
import { reportingDay } from "./service";
import { queryRows, type ProductDatabase } from "./postgres";

export const ACTIVITY_INTERVAL_MS=15*60_000;
export const ACTIVITY_BATCH_SIZE=200;
export type ActivityBatch=ActivityEvent & {scopeKey:string;count:number};
export type ActivityTransaction={claim(now:Date,limit:number):Promise<ActivityEvent[]>;add(group:ActivityBatch,now:Date):Promise<void>;processed(ids:string[],now:Date):Promise<void>};
export type ActivityStore={transaction<T>(action:(tx:ActivityTransaction)=>Promise<T>):Promise<T>;cleanup(now:Date,limit:number):Promise<void>};
export async function processActivityTick(store:ActivityStore,now=new Date()) {
  const processed=await store.transaction(async tx=>{
    const events=await tx.claim(now,ACTIVITY_BATCH_SIZE);
    const groups=new Map<string,ActivityBatch>();
    for(const event of events){
      const scopeKey=event.companyId==null?`provider:${event.providerId}`:`company:${event.companyId}`;
      const key=JSON.stringify([event.kind,event.serviceId,event.reportingDay,scopeKey]);const existing=groups.get(key);
      if(existing){existing.count++;if(event.expiresAt>existing.expiresAt)existing.expiresAt=event.expiresAt;}
      else groups.set(key,{...event,scopeKey,count:1});
    }
    // All workers acquire group locks in the same order.
    for(const [,group] of Array.from(groups).sort(([a],[b])=>a.localeCompare(b)))await tx.add(group,now);
    if(events.length)await tx.processed(events.map(event=>event.id),now);
    return events.length;
  });
  await store.cleanup(now,ACTIVITY_BATCH_SIZE);
  return {processed};
}
export function createActivityStore(database:ProductDatabase):ActivityStore {
  return {
    transaction:action=>database.transaction(async tx=>action({
      async claim(now,limit){
        const rows=await queryRows<ActivityEvent>(tx,sql`SELECT id,kind,user_id AS "userId",service_id AS "serviceId",provider_id AS "providerId",company_id AS "companyId",
          reporting_day::text AS "reportingDay",occurred_at AS "occurredAt",expires_at AS "expiresAt" FROM public.product_activity_events
          WHERE processed_at IS NULL AND reporting_day<${reportingDay(now)}::date AND expires_at>${now.toISOString()}::timestamptz
          ORDER BY reporting_day,occurred_at,id LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
        return rows.map(row=>({...row,occurredAt:new Date(row.occurredAt),expiresAt:new Date(row.expiresAt)}));
      },
      async add(group,now){
        await tx.execute(sql`INSERT INTO public.service_activity_groups(id,kind,service_id,provider_id,company_id,scope_key,reporting_day,count,revision,updated_at,expires_at)
          VALUES(${randomUUID()}::uuid,${group.kind},${group.serviceId},${group.providerId},${group.companyId},${group.scopeKey},${group.reportingDay}::date,${group.count},1,${now.toISOString()}::timestamptz,${group.expiresAt.toISOString()}::timestamptz)
          ON CONFLICT(kind,service_id,reporting_day,scope_key) DO UPDATE SET count=service_activity_groups.count+EXCLUDED.count,
          revision=service_activity_groups.revision+1,updated_at=EXCLUDED.updated_at,expires_at=GREATEST(service_activity_groups.expires_at,EXCLUDED.expires_at)`);
      },
      async processed(ids,now){await tx.execute(sql`UPDATE public.product_activity_events SET processed_at=${now.toISOString()}::timestamptz WHERE id IN (${sql.join(ids.map(id=>sql`${id}::uuid`),sql`,`)})`);},
    })),
    async cleanup(now,limit){
      await database.transaction(async tx=>{
        await tx.execute(sql`DELETE FROM public.product_activity_events WHERE id IN (SELECT id FROM public.product_activity_events WHERE expires_at<=${now.toISOString()}::timestamptz ORDER BY expires_at,id LIMIT ${limit} FOR UPDATE SKIP LOCKED)`);
        await tx.execute(sql`DELETE FROM public.service_activity_groups WHERE id IN (SELECT id FROM public.service_activity_groups WHERE expires_at<=${now.toISOString()}::timestamptz ORDER BY expires_at,id LIMIT ${limit} FOR UPDATE SKIP LOCKED)`);
      });
    },
  };
}
