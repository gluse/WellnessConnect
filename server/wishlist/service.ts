import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ActivityKind, WishlistPage } from "../../shared/wishlist";
import type { ServiceWithProvider } from "../../shared/schema";

export class WishlistError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export type SavedRow = { serviceId: number; savedAt: Date };
export type ActivityEvent = { id: string; kind: ActivityKind; userId: string | null; serviceId: number; providerId: string;
  companyId: number | null; reportingDay: string; occurredAt: Date; expiresAt: Date };
export type ProductService = { id: number; providerId: string; companyId: number | null; isActive: boolean | null; companyActive: boolean };
export type WishlistTransaction = {
  lock(userId: string, serviceId: number): Promise<void>;
  service(serviceId: number): Promise<ProductService | undefined>;
  isTeam(userId: string, service: ProductService): Promise<boolean>;
  insert(userId: string, serviceId: number, at: Date): Promise<boolean>;
  remove(userId: string, serviceId: number): Promise<void>;
  activity(event: ActivityEvent): Promise<void>;
};
export type WishlistStore = {
  transaction<T>(action: (tx: WishlistTransaction) => Promise<T>): Promise<T>;
  list(userId: string, before: SavedRow | null, limit: number): Promise<SavedRow[]>;
  membership(userId: string, serviceIds: number[]): Promise<number[]>;
};
export const retentionExpiry = (at: Date) => new Date(at.getTime() + 90 * 86400000);
export const reportingDay = (at: Date) => at.toISOString().slice(0, 10);
const cursorSchema = z.object({ serviceId: z.number().int().positive(), savedAt: z.string().datetime() }).strict();
export function readWishlistCursor(cursor?: string): SavedRow | null {
  if (!cursor) return null;
  try { const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))); return { ...parsed, savedAt: new Date(parsed.savedAt) }; }
  catch { throw new WishlistError(400, "invalid_cursor"); }
}
export function createWishlistService(store: WishlistStore, hydrate: (id: number) => Promise<ServiceWithProvider | undefined>, now = () => new Date()) {
  const event = (service: ProductService, userId: string | null, kind: ActivityKind, at: Date): ActivityEvent => ({ id: randomUUID(), kind, userId,
    serviceId: service.id, providerId: service.providerId, companyId: service.companyId, reportingDay: reportingDay(at), occurredAt: at, expiresAt: retentionExpiry(at) });
  return {
    async list(userId: string, cursor: string | undefined, limit: number): Promise<WishlistPage> {
      const rows = await store.list(userId, readWishlistCursor(cursor), limit + 1);
      const page = rows.slice(0, limit);
      const items = await Promise.all(page.map(async row => {
        const service = await hydrate(row.serviceId);
        const base = { serviceId: row.serviceId, savedAt: row.savedAt.toISOString() };
        return service?.isActive && service.companyActive ? { ...base, available: true as const, service } : { ...base, available: false as const };
      }));
      const last = page.at(-1);
      return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ serviceId: last.serviceId, savedAt: last.savedAt.toISOString() })).toString("base64url") : null };
    },
    async membership(userId: string, ids: number[]) { return { serviceIds: await store.membership(userId, ids) }; },
    async save(userId: string, serviceId: number) {
      return store.transaction(async tx => {
        await tx.lock(userId, serviceId);
        const service = await tx.service(serviceId);
        if (!service?.isActive || !service.companyActive) throw new WishlistError(404, "service_unavailable");
        const at = now();
        const inserted = await tx.insert(userId, serviceId, at);
        if (inserted && userId !== service.providerId && !await tx.isTeam(userId, service)) await tx.activity(event(service, userId, "wishlist_additions", at));
      });
    },
    async remove(userId: string, serviceId: number) {
      return store.transaction(async tx => { await tx.lock(userId, serviceId); await tx.remove(userId, serviceId); });
    },
    async recordView(serviceId: number, userId: string | null) {
      return store.transaction(async tx => {
        const service = await tx.service(serviceId);
        if (!service?.isActive || !service.companyActive || userId === service.providerId || userId && await tx.isTeam(userId, service)) return;
        await tx.activity(event(service, userId, "service_views", now()));
      });
    },
  };
}
export type WishlistService = ReturnType<typeof createWishlistService>;
