import { sql, type SQL } from "drizzle-orm";
import type { db } from "../db";
import type { ActivityEvent, ProductService, SavedRow, WishlistStore, WishlistTransaction } from "./service";

export type ProductDatabase = typeof db;
export type ProductQuery = Pick<ProductDatabase, "execute">;
export async function queryRows<T>(db: ProductQuery, query: SQL): Promise<T[]> { return (await db.execute(query)).rows as T[]; }
export function createWishlistStore(database: ProductDatabase): WishlistStore {
  function adapter(tx: ProductQuery): WishlistTransaction {
    return {
      async lock(userId, id) { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`wishlist:${userId}:${id}`},0))`); },
      async service(id) {
        const [row] = await queryRows<ProductService>(tx, sql`SELECT s.id,s.provider_id AS "providerId",s.company_id AS "companyId",s.is_active AS "isActive",
          (c.id IS NULL OR c.is_active) AS "companyActive" FROM public.services s LEFT JOIN public.companies c ON c.id=s.company_id WHERE s.id=${id} FOR SHARE OF s`);
        return row;
      },
      async isTeam(userId, service) {
        if (service.companyId == null) return false;
        const rows = await queryRows(tx, sql`SELECT 1 FROM public.company_memberships WHERE company_id=${service.companyId} AND user_id=${userId} LIMIT 1`);
        return rows.length > 0;
      },
      async insert(userId, id, at) {
        return (await queryRows(tx, sql`INSERT INTO public.wishlist_services(user_id,service_id,saved_at) VALUES(${userId},${id},${at.toISOString()}::timestamptz)
          ON CONFLICT(user_id,service_id) DO NOTHING RETURNING service_id`)).length > 0;
      },
      async remove(userId, id) { await tx.execute(sql`DELETE FROM public.wishlist_services WHERE user_id=${userId} AND service_id=${id}`); },
      async activity(row: ActivityEvent) {
        await tx.execute(sql`INSERT INTO public.product_activity_events(id,kind,user_id,service_id,provider_id,company_id,reporting_day,occurred_at,expires_at)
          VALUES(${row.id}::uuid,${row.kind},${row.userId},${row.serviceId},${row.providerId},${row.companyId},${row.reportingDay}::date,${row.occurredAt.toISOString()}::timestamptz,${row.expiresAt.toISOString()}::timestamptz)
          ON CONFLICT DO NOTHING`);
      },
    };
  }
  return {
    transaction: action => database.transaction(tx => action(adapter(tx))),
    async list(userId, before, limit) {
      const rows = await queryRows<{serviceId:number;savedAt:Date}>(database, sql`SELECT service_id AS "serviceId",saved_at AS "savedAt" FROM public.wishlist_services
        WHERE user_id=${userId} ${before ? sql`AND (saved_at,service_id)<(${before.savedAt.toISOString()}::timestamptz,${before.serviceId})` : sql``}
        ORDER BY saved_at DESC,service_id DESC LIMIT ${limit}`);
      return rows.map(row => ({ ...row, savedAt: new Date(row.savedAt) }));
    },
    async membership(userId, ids) {
      if (!ids.length) return [];
      return (await queryRows<SavedRow>(database, sql`SELECT service_id AS "serviceId" FROM public.wishlist_services WHERE user_id=${userId}
        AND service_id IN (${sql.join(ids.map(id => sql`${id}`),sql`,`)}) ORDER BY service_id`)).map(row => row.serviceId);
    },
  };
}
