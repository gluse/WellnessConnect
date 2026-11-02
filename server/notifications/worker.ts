import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import { bookings, services, users, notificationEvents, notificationJobs, notificationDeliveryAttempts, type NotificationJob } from "../../shared/schema";
import { channelReason, renderMessage } from "./policy";
import { cleanupNotificationMetadata, preferencesFor, reconcileBookingReminder, workspacePro } from "./repository";
import { createTransports, notificationConfig, TransportError, transportReady } from "./transports";
import type { db as applicationDb } from "../db";

export async function notificationWorkerTick(database: typeof applicationDb, options: { now?: Date; transports?: ReturnType<typeof createTransports>; shouldStop?: () => boolean } = {}) {
  const config = notificationConfig(), now = options.now ?? new Date();
  const clock = () => options.now ?? new Date();
  if (!config.enabled) return { processed: 0 };
  if (!config.automationEnabled) { await cleanupNotificationMetadata(database, now); return { processed: 0 }; }
  // A crashed process after reserving a remote attempt cannot safely resend it.
  await database.update(notificationJobs).set({ state: "unknown", reasonCode: "lease_expired", leaseToken: null, leaseUntil: null, updatedAt: now })
    .where(and(eq(notificationJobs.state, "leased"), lt(notificationJobs.leaseUntil, now), gt(notificationJobs.attemptedAt, new Date(0))));
  await database.update(notificationJobs).set({ state: "queued", reasonCode: null, leaseToken: null, leaseUntil: null, updatedAt: now })
    .where(and(eq(notificationJobs.state, "leased"), lt(notificationJobs.leaseUntil, now), isNull(notificationJobs.attemptedAt)));
  // Keyset batches keep memory bounded while revisiting existing appointments
  // after subscription reactivation, without needing billing-owner permissions.
  let cursor = 0;
  for (;;) {
    if (options.shouldStop?.()) return { processed: 0 };
    const upcoming = await database.select().from(bookings).where(and(eq(bookings.status, "confirmed"), gt(bookings.scheduledDate, now), gt(bookings.id, cursor))).orderBy(asc(bookings.id)).limit(100);
    if (!upcoming.length) break;
    for (const booking of upcoming) {
      if (options.shouldStop?.()) return { processed: 0 };
      await database.transaction(async tx => {
      const [current] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for("update");
      if (current) await reconcileBookingReminder(tx, current, clock());
      });
    }
    cursor = upcoming[upcoming.length - 1].id;
  }
  let processed = 0;
  const transports = options.transports ?? createTransports(config);
  for (let count = 0; count < 100 && !options.shouldStop?.(); count++) {
    const claim = await database.transaction(async tx => {
      const [job] = await tx.select().from(notificationJobs).where(and(eq(notificationJobs.state, "queued"), lte(notificationJobs.dueAt, clock())))
        .orderBy(asc(notificationJobs.dueAt)).limit(1).for("update", { skipLocked: true });
      if (!job) return null;
      const token = randomUUID();
      const claimTime = clock();
      const [leased] = await tx.update(notificationJobs).set({ state: "leased", leaseToken: token, leaseUntil: new Date(claimTime.getTime() + 60_000), updatedAt: claimTime }).where(eq(notificationJobs.id, job.id)).returning();
      return leased;
    });
    if (!claim) break;
    await processNotificationJob(database, claim, transports, options.now); processed++;
  }
  await cleanupNotificationMetadata(database, now);
  return { processed };
}
export async function processNotificationJob(database: typeof applicationDb, job: NotificationJob, transports: ReturnType<typeof createTransports>, injectedNow?: Date) {
  const config = notificationConfig();
  const prepared = await database.transaction(async tx => {
    const [event] = await tx.select().from(notificationEvents).where(eq(notificationEvents.id, job.eventId));
    if (!event) return null;
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, event.bookingId)).for("update");
    const [current] = await tx.select().from(notificationJobs).where(and(eq(notificationJobs.id, job.id), eq(notificationJobs.state, "leased"), eq(notificationJobs.leaseToken, job.leaseToken!))).for("update");
    if (!current) return null;
    if (booking) {
      const workspaceKey = booking.companyId != null ? `company:${booking.companyId}` : `user:${booking.providerId}`;
      // Serialize attempts across worker replicas before refreshing the dispatch
      // clock and checking current subscription/contact eligibility.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`notification-send:${workspaceKey}`}, 32033))`);
    }
    const now = injectedNow ?? new Date();
    async function stop(reasonCode: string, state: "skipped" | "cancelled" = "skipped") {
      await tx.update(notificationJobs).set({ state, reasonCode, leaseToken: null, leaseUntil: null, updatedAt: now }).where(eq(notificationJobs.id, job.id)); return null;
    }
    if (!booking || booking.scheduledDate.getTime() !== event.scheduledDate.getTime()) return stop("superseded", "cancelled");
    if (!config.enabled || !config.automationEnabled || !await workspacePro(tx, booking, now.getTime())) return stop("pro_inactive", "cancelled");
    if (current.expiresAt && current.expiresAt < now) return stop("expired");
    if (event.kind !== "reminder" && (booking.notificationRevision !== event.bookingRevision || event.kind === "rejected" && booking.status !== "cancelled"
      || event.kind === "accepted" && booking.status !== "confirmed" || event.kind === "rescheduled" && !["pending", "confirmed"].includes(booking.status ?? ""))) return stop("superseded", "cancelled");
    const [service] = await tx.select().from(services).where(eq(services.id, booking.serviceId));
    if (!service || event.kind === "reminder" && (!service.reminderEnabled || booking.status !== "confirmed" || booking.scheduledDate <= now)) return stop("reminder_ineligible", "cancelled");
    const prefs = await preferencesFor(tx, booking.seekerId);
    const [user] = await tx.select().from(users).where(eq(users.id, booking.seekerId));
    const channel = prefs.preferredMethod ?? (event.kind === "reminder" ? service.reminderMethod : "email");
    const reason = channelReason(channel, prefs, user?.email ?? null);
    if (reason) return stop(reason);
    if (!transportReady(config, channel, prefs.language, event.kind)) return stop("not_configured");
    const message = renderMessage({ kind: event.kind, service: service.name, date: event.scheduledDate, oldDate: event.previousScheduledDate, language: prefs.language, timeZone: event.timezone });
    // Bounds protect paid sends from repeated reschedule/status requests without
    // storing contacts. Advisory lock above covers count plus attempt reservation.
    const quota = await tx.execute(sql`SELECT count(*)::int AS workspace_attempts,
      count(*) FILTER (WHERE b.seeker_id = ${booking.seekerId})::int AS customer_attempts
      FROM notification_delivery_attempts a JOIN notification_jobs j ON j.id = a.job_id
      JOIN notification_events e ON e.id = j.event_id JOIN bookings b ON b.id = e.booking_id
      WHERE a.created_at >= ${new Date(now.getTime() - 3600_000)} AND
      ${booking.companyId != null ? sql`b.company_id = ${booking.companyId}` : sql`b.company_id IS NULL AND b.provider_id = ${booking.providerId}`}`);
    const usage = quota.rows[0] as { workspace_attempts?: unknown; customer_attempts?: unknown } | undefined;
    if (!usage || typeof usage.workspace_attempts !== "number" || typeof usage.customer_attempts !== "number") throw new Error("Notification quota unavailable");
    if (usage.workspace_attempts >= 1000 || usage.customer_attempts >= 10) return stop("rate_limited");
    const [attempt] = await tx.insert(notificationDeliveryAttempts).values({ id: randomUUID(), jobId: current.id, provider: channel === "email" ? "resend" : "vonage", state: "reserved", createdAt: now }).onConflictDoNothing().returning();
    if (!attempt) return stop("already_attempted");
    await tx.update(notificationJobs).set({ channel, attemptedAt: now, updatedAt: now }).where(eq(notificationJobs.id, current.id));
    return { channel, recipient: channel === "email" ? user!.email! : prefs.phone!, ...message, jobId: current.id, language: prefs.language, kind: event.kind, service: service.name.slice(0, 250), attemptId: attempt.id };
  });
  if (!prepared) return;
  let outcome: { state: "accepted" | "failed" | "unknown"; messageId?: string; reasonCode?: string };
  try { const sent = await transports.send(prepared); outcome = { state: "accepted", messageId: sent.messageId }; }
  catch (error) { outcome = { state: error instanceof TransportError ? error.outcome : "unknown", reasonCode: error instanceof TransportError ? error.code : "transport_unknown" }; }
  await database.transaction(async tx => {
    // A callback may already have delivered the message using client_ref.
    const [current] = await tx.select().from(notificationJobs).where(eq(notificationJobs.id, job.id)).for("update");
    if (!current) return;
    const state = current.state === "delivered" || current.state === "failed" ? current.state : outcome.state;
    const reasonCode = state === "delivered" || state === "accepted" ? null : current.state === "failed" ? current.reasonCode : outcome.reasonCode ?? current.reasonCode;
    await tx.update(notificationJobs).set({ state, providerMessageId: outcome.messageId ?? current.providerMessageId, reasonCode, leaseToken: null, leaseUntil: null, updatedAt: new Date() }).where(eq(notificationJobs.id, job.id));
    await tx.update(notificationDeliveryAttempts).set({ state, providerMessageId: outcome.messageId ?? current.providerMessageId, errorCode: reasonCode, updatedAt: new Date() }).where(eq(notificationDeliveryAttempts.id, prepared.attemptId));
  });
}
