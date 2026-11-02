import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, notExists, or } from "drizzle-orm";
import { bookings, services, availability, users, companies, providerSubscriptions, userCommunicationPreferences, notificationEvents, notificationJobs, notificationCallbacks, phoneVerificationChallenges, type Booking, type BookingWithDetails, type NotificationJob } from "../../shared/schema";
import { hasPro } from "../../shared/storefront";
import { NotificationError, type CommunicationMethod, type NotificationSummary, type ReminderSummary } from "../../shared/notifications";
import type { db } from "../db";
import { channelReason, defaultPreferences, reminderDue, type Preferences } from "./policy";
import { notificationConfig, transportReady } from "./transports";

export type NotificationDatabase = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;
type Workspace = { providerId: string; companyId?: number | null };
export async function workspacePro(database: NotificationDatabase, workspace: Workspace, now = Date.now()) {
  if (workspace.companyId != null) {
    const [company] = await database.select({ active: companies.isActive }).from(companies).where(eq(companies.id, workspace.companyId));
    if (!company?.active) return false;
  }
  const [subscription] = await database.select().from(providerSubscriptions).where(workspace.companyId != null ? eq(providerSubscriptions.companyId, workspace.companyId)
    : and(eq(providerSubscriptions.userId, workspace.providerId), isNull(providerSubscriptions.companyId)));
  return hasPro(subscription ?? null, now);
}
export async function assertReminderConfiguration(database: NotificationDatabase, workspace: Workspace, updates: { reminderEnabled?: boolean; reminderMethod?: CommunicationMethod; reminderHours?: number }, previous?: { reminderEnabled: boolean; reminderMethod: CommunicationMethod; reminderHours: number }) {
  const changed = previous ? (updates.reminderEnabled !== undefined && updates.reminderEnabled !== previous.reminderEnabled)
    || (updates.reminderMethod !== undefined && updates.reminderMethod !== previous.reminderMethod) || (updates.reminderHours !== undefined && updates.reminderHours !== previous.reminderHours)
    : updates.reminderEnabled === true || updates.reminderMethod !== undefined && updates.reminderMethod !== "email" || updates.reminderHours !== undefined && updates.reminderHours !== 24;
  if (changed && !await workspacePro(database, workspace)) throw new NotificationError(403, "pro_required", "An active PRO subscription is required to change automatic reminders.");
}
export async function preferencesFor(database: NotificationDatabase, userId: string) {
  const [preferences] = await database.select().from(userCommunicationPreferences).where(eq(userCommunicationPreferences.userId, userId));
  return preferences ?? { ...defaultPreferences, userId };
}
export async function captureStatusEvent(database: NotificationDatabase, booking: Booking, kind: "accepted" | "rejected" | "rescheduled", timeZone: string, previousDate?: Date): Promise<NotificationSummary> {
  if (!notificationConfig().enabled) return { mode: "none", reasonCode: "feature_disabled" };
  const automatic = await workspacePro(database, booking);
  const [event] = await database.insert(notificationEvents).values({ id: randomUUID(), bookingId: booking.id, bookingRevision: booking.notificationRevision,
    kind, scheduledDate: booking.scheduledDate, previousScheduledDate: previousDate, timezone: timeZone, automatic }).onConflictDoNothing().returning();
  if (!event) return { mode: "none" };
  let state = "manual", reasonCode: string | null = null;
  if (automatic) {
    const prefs = await preferencesFor(database, booking.seekerId);
    const [customer] = await database.select({ email: users.email }).from(users).where(eq(users.id, booking.seekerId));
    const channel = prefs.preferredMethod ?? "email";
    reasonCode = channelReason(channel, prefs, customer?.email ?? null) ?? (transportReady(notificationConfig(), channel, prefs.language, kind) ? null : "not_configured");
    state = reasonCode ? "skipped" : "queued";
    await database.insert(notificationJobs).values({ id: randomUUID(), eventId: event.id, channel, state: reasonCode ? "skipped" : "queued", reasonCode, dueAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60_000) });
  }
  return { mode: automatic ? "automatic" : "manual", eventId: event.id, state, reasonCode };
}
export async function reconcileBookingReminder(database: NotificationDatabase, booking: Booking, now = new Date(), timeZone?: string, recalculate = false) {
  if (!notificationConfig().enabled) return;
  const [service] = await database.select().from(services).where(eq(services.id, booking.serviceId));
  // Cancel old appointment instants and all reminders when the appointment closes.
  await database.update(notificationJobs).set({ state: "cancelled", reasonCode: "booking_changed", updatedAt: now, leaseToken: null, leaseUntil: null })
    .where(and(inArray(notificationJobs.state, ["queued", "leased"]), isNull(notificationJobs.attemptedAt), inArray(notificationJobs.eventId,
      database.select({ id: notificationEvents.id }).from(notificationEvents).where(and(eq(notificationEvents.bookingId, booking.id), eq(notificationEvents.kind, "reminder"),
        booking.status === "confirmed" && service?.reminderEnabled ? ne(notificationEvents.scheduledDate, booking.scheduledDate) : undefined)))));
  if (!service?.reminderEnabled || booking.status !== "confirmed" || booking.scheduledDate <= now || !await workspacePro(database, booking, now.getTime())) return;
  const dueAt = reminderDue(booking.scheduledDate, service.reminderHours, now);
  const [existing] = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents)
    .leftJoin(notificationJobs, eq(notificationJobs.eventId, notificationEvents.id)).where(and(eq(notificationEvents.bookingId, booking.id), eq(notificationEvents.kind, "reminder"), eq(notificationEvents.scheduledDate, booking.scheduledDate)));
  if (existing?.job?.attemptedAt) return;
  if (!recalculate && existing?.job && (existing.job.state === "queued" || existing.job.state === "leased")) return;
  if (!dueAt) {
    if (existing?.job) await database.update(notificationJobs).set({ state: "skipped", reasonCode: "past_due", updatedAt: now, leaseToken: null, leaseUntil: null }).where(and(eq(notificationJobs.id, existing.job.id), isNull(notificationJobs.attemptedAt)));
    return;
  }
  const prefs = await preferencesFor(database, booking.seekerId), channel = prefs.preferredMethod ?? service.reminderMethod;
  let event = existing?.event;
  if (!event) {
    if (!timeZone) {
      const [previousEvent] = await database.select({ timezone: notificationEvents.timezone }).from(notificationEvents).where(eq(notificationEvents.bookingId, booking.id)).orderBy(desc(notificationEvents.createdAt)).limit(1);
      const [schedule] = previousEvent ? [] : await database.select({ timezone: availability.timezone }).from(availability).where(and(eq(availability.isActive, true),
        booking.companyId != null ? eq(availability.companyId, booking.companyId) : and(eq(availability.providerId, booking.providerId), isNull(availability.companyId)),
        or(eq(availability.serviceId, booking.serviceId), isNull(availability.serviceId)))).orderBy(desc(availability.serviceId)).limit(1);
      timeZone = previousEvent?.timezone ?? schedule?.timezone ?? "UTC";
    }
    [event] = await database.insert(notificationEvents).values({ id: randomUUID(), bookingId: booking.id, bookingRevision: booking.notificationRevision,
      kind: "reminder", scheduledDate: booking.scheduledDate, timezone: timeZone, automatic: true }).onConflictDoNothing().returning();
    if (!event) return;
  }
  // Existing queued jobs keep their due date on periodic reconciliation, including
  // the five-minute delivery grace. Service edits explicitly recalculate instead.
  if (existing?.job?.state === "queued" && existing.job.dueAt.getTime() === dueAt.getTime() && existing.job.channel === channel) return;
  await database.insert(notificationJobs).values({ id: randomUUID(), eventId: event.id, channel, state: "queued", dueAt, expiresAt: new Date(dueAt.getTime() + 300_000) })
    .onConflictDoUpdate({ target: notificationJobs.eventId, set: { channel, state: "queued", dueAt, expiresAt: new Date(dueAt.getTime() + 300_000), reasonCode: null, leaseToken: null, leaseUntil: null, updatedAt: now },
      setWhere: and(isNull(notificationJobs.attemptedAt), inArray(notificationJobs.state, ["queued", "leased", "cancelled", "skipped"])) });
}
export async function reconcileServiceReminders(database: NotificationDatabase, serviceId: number) {
  if (!notificationConfig().enabled) return;
  const rows = await database.select().from(bookings).where(and(eq(bookings.serviceId, serviceId), gt(bookings.scheduledDate, new Date()))).orderBy(asc(bookings.id)).for("update");
  for (const booking of rows) await reconcileBookingReminder(database, booking, new Date(), undefined, true);
}
export async function bookingNotificationState(database: NotificationDatabase, booking: Booking): Promise<{ notification: NotificationSummary; reminder: ReminderSummary }> {
  const pro = await workspacePro(database, booking);
  const [status] = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq(notificationJobs.eventId, notificationEvents.id))
    .where(and(eq(notificationEvents.bookingId, booking.id), ne(notificationEvents.kind, "reminder"))).orderBy(desc(notificationEvents.createdAt)).limit(1);
  const [reminder] = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq(notificationJobs.eventId, notificationEvents.id))
    .where(and(eq(notificationEvents.bookingId, booking.id), eq(notificationEvents.kind, "reminder"), eq(notificationEvents.scheduledDate, booking.scheduledDate))).limit(1);
  const [service] = await database.select().from(services).where(eq(services.id, booking.serviceId));
  const job = reminder?.job;
  const preferences = job ? await preferencesFor(database, booking.seekerId) : null;
  const [customer] = job && !job.attemptedAt ? await database.select({ email: users.email }).from(users).where(eq(users.id, booking.seekerId)) : [];
  return { notification: status ? { mode: status.event.automatic ? "automatic" : "manual", eventId: status.event.id, state: status.job?.state ?? "manual", reasonCode: status.job?.reasonCode } : { mode: "none" },
    reminder: summarizeReminder(pro, service, job, preferences, customer?.email ?? null) };
}
function summarizeReminder(pro: boolean, service: { reminderEnabled: boolean; reminderMethod: CommunicationMethod } | undefined,
  job: NotificationJob | null | undefined, preferences: Preferences | null, email: string | null): ReminderSummary {
  const channel = job?.attemptedAt ? job.channel : preferences?.preferredMethod ?? service?.reminderMethod ?? job?.channel;
  const unavailableReason = job && !job.attemptedAt && channel && preferences ? channelReason(channel, preferences, email)
    ?? (transportReady(notificationConfig(), channel, preferences.language, "reminder") ? null : "not_configured") : null;
  const state: ReminderSummary["state"] = job?.state === "delivered" || job?.state === "accepted" ? "sent" : job?.state === "failed" || job?.state === "unknown" ? "failed"
    : !service?.reminderEnabled ? "off" : !pro ? "paused" : !notificationConfig().automationEnabled || unavailableReason ? "unavailable" : job?.state === "queued" || job?.state === "leased" ? "scheduled" : "unavailable";
  return { state, ...(job ? { dueAt: job.dueAt.toISOString(), channel, reasonCode: unavailableReason ?? job.reasonCode } : {}) };
}
/** Batch the list's metadata; do not multiply database round trips per booking. */
export async function bookingReminderSummaries(database: NotificationDatabase, rows: BookingWithDetails[]) {
  const result = new Map<number, ReminderSummary>();
  if (!rows.length) return result;
  const pro = await workspacePro(database, rows[0]);
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200);
    const events = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq(notificationJobs.eventId, notificationEvents.id))
      .where(and(inArray(notificationEvents.bookingId, batch.map(booking => booking.id)), eq(notificationEvents.kind, "reminder")));
    const preferences = await database.select().from(userCommunicationPreferences).where(inArray(userCommunicationPreferences.userId, Array.from(new Set(batch.map(booking => booking.seekerId)))));
    const preferencesByUser = new Map(preferences.map(value => [value.userId, value]));
    const jobsByInstant = new Map(events.map(value => [`${value.event.bookingId}:${value.event.scheduledDate.toISOString()}`, value.job]));
    for (const booking of batch) result.set(booking.id, summarizeReminder(pro, booking.service,
      jobsByInstant.get(`${booking.id}:${booking.scheduledDate.toISOString()}`), preferencesByUser.get(booking.seekerId) ?? defaultPreferences, booking.seeker.email));
  }
  return result;
}
export async function cleanupNotificationMetadata(database: NotificationDatabase, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86400_000);
  // Preserve future appointments' reminder identity so a settings edit cannot
  // resend an already attempted reminder after the general retention horizon.
  await database.delete(notificationEvents).where(and(lt(notificationEvents.createdAt, cutoff), or(ne(notificationEvents.kind, "reminder"), lt(notificationEvents.scheduledDate, now)),
    notExists(database.select({ id: notificationJobs.id }).from(notificationJobs).where(and(eq(notificationJobs.eventId, notificationEvents.id),
      or(inArray(notificationJobs.state, ["queued", "leased"]), gt(notificationJobs.updatedAt, cutoff)))))));
  await database.delete(notificationCallbacks).where(lt(notificationCallbacks.receivedAt, cutoff));
  await database.delete(phoneVerificationChallenges).where(lt(phoneVerificationChallenges.expiresAt, cutoff));
}
