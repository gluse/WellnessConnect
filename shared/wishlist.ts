import { z } from "zod";
import type { BookingWithDetails, ServiceWithProvider } from "./schema";

export const positiveServiceId = z.string().regex(/^[1-9]\d{0,9}$/).refine(value => Number(value) <= 2147483647).transform(Number);
export const wishlistPageSchema = z.object({ cursor: z.string().max(300).optional(), limit: z.coerce.number().int().min(1).max(50).default(24) }).strict();
export const inboxScopeSchema = z.object({ scope: z.enum(["customer", "provider", "all"]), companyId: positiveServiceId.optional() }).strict();
export type InboxScope = { scope: "customer" | "provider" | "all"; companyId?: number };
export type WishlistEntry = { serviceId: number; savedAt: string } & ({ available: true; service: ServiceWithProvider } | { available: false });
export type WishlistPage = { items: WishlistEntry[]; nextCursor: string | null };
export type WishlistMembership = { serviceIds: number[] };
export type InboxSummary = { unreadMessages: number; unreadNotifications: number };
export type InboxMessage = { bookingId: number; serviceName: string; counterpartName: string; scheduledDate: string; updatedAt: string;
  unreadCount: number; canSend: boolean; viewer: "customer" | "provider"; companyId?: number | null };
export type InboxMessages = { items: InboxMessage[]; nextCursor: string | null };
export type InboxBooking = BookingWithDetails;
export type ActivityKind = "wishlist_additions" | "service_views";
export type InboxNotification = { id: string; kind: ActivityKind; serviceId: number; serviceName: string | null;
  reportingDay: string; count: number; revision: number; read: boolean; available: boolean; updatedAt: string };
export type InboxNotifications = { items: InboxNotification[]; nextCursor: string | null };
export const messageReadSchema = z.object({ messageIds: z.array(z.string().uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length) }).strict();
export const notificationReadSchema = z.object({ items: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().positive() }).strict())
  .min(1).max(100).refine(items => new Set(items.map(item => item.id)).size === items.length) }).strict();

export function serviceReturnTo(id: number): string {
  return `/search?service=${positiveServiceId.parse(String(id))}`;
}
