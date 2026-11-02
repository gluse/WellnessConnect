import { and, asc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { bookingMessages, bookings } from "../../shared/schema";
import type { db } from "../db";

/** Calendar-month arithmetic in UTC, clamped at month-end (including leap day). */
export function messageRetentionCutoff(now: Date): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid retention clock");
  const cutoff = new Date(now), day = cutoff.getUTCDate();
  cutoff.setUTCDate(1); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const monthEnd = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, monthEnd));
  return cutoff;
}

export function messageHistoryExpiresAt(anchor: Date): Date {
  if (!Number.isFinite(anchor.getTime())) throw new Error("Invalid retention anchor");
  const expires = new Date(anchor), day = expires.getUTCDate();
  expires.setUTCDate(1); expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const monthEnd = new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0)).getUTCDate();
  expires.setUTCDate(Math.min(day, monthEnd));
  return expires;
}

/** One bounded batch. Callers never supply a shorter retention duration. */
export async function cleanupBookingMessages(database: typeof db, now = new Date()): Promise<number> {
  const cutoff = messageRetentionCutoff(now);
  // Inverse calendar arithmetic is not symmetric around leap day. This broad
  // index bound includes Feb29 anchors whose next anniversary clamps to Feb28;
  // exact forward anniversaries below prevent any early deletion.
  cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  return database.transaction(async tx => {
    // Lock bookings first, as sendMessage does. SKIP LOCKED prevents maintenance
    // waiting on an active conversation. A recent last message excludes the
    // booking so the first100 fresh conversations cannot starve older ones.
    const candidates = await tx.select().from(bookings).where(and(inArray(bookings.status, ["completed", "cancelled"]), isNotNull(bookings.closedAt), lte(bookings.closedAt, cutoff),
      sql`((${bookings.closedAt} AT TIME ZONE 'UTC') + interval '12 months') AT TIME ZONE 'UTC' <= ${now}`,
      sql`EXISTS (SELECT 1 FROM ${bookingMessages} WHERE ${bookingMessages.bookingId} = ${bookings.id})`,
      sql`NOT EXISTS (SELECT 1 FROM ${bookingMessages} WHERE ${bookingMessages.bookingId} = ${bookings.id} AND ((${bookingMessages.createdAt} AT TIME ZONE 'UTC') + interval '12 months') AT TIME ZONE 'UTC' > ${now})`))
      .orderBy(asc(bookings.closedAt), asc(bookings.id)).limit(100).for("update", { skipLocked: true });
    if (!candidates.length) return 0;
    // A new statement after acquiring the booking locks gets a fresh READ
    // COMMITTED snapshot. This catches a send committed while locks were acquired.
    const latest = await tx.select({ bookingId: bookingMessages.bookingId, createdAt: sql<Date>`max(${bookingMessages.createdAt})` }).from(bookingMessages)
      .where(inArray(bookingMessages.bookingId, candidates.map(row => row.id))).groupBy(bookingMessages.bookingId);
    const latestByBooking = new Map(latest.map(row => [row.bookingId, new Date(row.createdAt).getTime()]));
    const eligible = candidates.filter(row => (row.status === "completed" || row.status === "cancelled") && row.closedAt != null
      && messageHistoryExpiresAt(row.closedAt) <= now && (latestByBooking.has(row.id) ? messageHistoryExpiresAt(new Date(latestByBooking.get(row.id)!)) <= now : true)).map(row => row.id);
    if (!eligible.length) return 0;
    const expired = await tx.select({ id: bookingMessages.id }).from(bookingMessages).where(inArray(bookingMessages.bookingId, eligible))
      .orderBy(asc(bookingMessages.createdAt), asc(bookingMessages.id)).limit(1000).for("update", { skipLocked: true });
    if (!expired.length) return 0;
    const deleted = await tx.delete(bookingMessages).where(inArray(bookingMessages.id, expired.map(row => row.id))).returning({ id: bookingMessages.id });
    return deleted.length;
  });
}

/** Independent of PRO/notification settings; free private histories also expire. */
export function startBookingMessageRetention(database: typeof db, options: { intervalMs?: number; now?: () => Date; onError?: () => void } = {}) {
  let running = false, stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try { await cleanupBookingMessages(database, options.now?.() ?? new Date()); }
    catch { options.onError?.(); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, options.intervalMs ?? 3600000); timer.unref();
  return { stop() { stopped = true; clearInterval(timer); }, tick };
}
