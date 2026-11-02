import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import { reconcileBookingReminder, captureStatusEvent, assertReminderConfiguration } from "../server/notifications/repository.ts";

// Scripted ORM boundary: these tests execute the real scheduler's eligibility,
// timing, channel and duplicate-attempt decisions. They do not establish SQL
// predicate correctness, database locking, constraints or concurrent execution.
const now = new Date("2026-10-29T10:00:00Z"), date = new Date("2026-10-31T10:00:00Z");
const baseBooking = { id: 1, serviceId: 10, seekerId: "customer", providerId: "provider", companyId: null, notificationRevision: 2, scheduledDate: date, status: "confirmed" };
const baseService = { id: 10, reminderEnabled: true, reminderMethod: "email", reminderHours: 24 };
const basePreferences = { userId: "customer", preferredMethod: "sms", phone: "+37120000001", phoneVerifiedAt: now, smsOptIn: true, whatsappOptIn: true, language: "en", emailSuppressed: false };
function boundary(options = {}) {
  const writes = [], service = { ...baseService, ...options.service };
  let event = options.event ?? null, job = options.job ?? null;
  const database = {
    select(selection) {
      let table;
      const builder = { from(value) { table = getTableName(value); return this; }, where() { return this; }, leftJoin() { return this; }, orderBy() { return this; }, limit() { return this; }, for() { return this; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          if (table === "services") return [service];
          if (table === "provider_subscriptions") return options.pro === false ? [] : [{ plan: "pro", proUntil: new Date(Date.now() + 86400000) }];
          if (table === "user_communication_preferences") return options.preferences === null ? [] : [{ ...basePreferences, ...options.preferences }];
          if (table === "users") return [{ email: "customer@example.test" }];
          if (table === "notification_events") return selection?.event ? event ? [{ event, job }] : [] : [];
          if (table === "availability") return [{ timezone: "Europe/Riga" }];
          throw new Error(`Unexpected table ${table}`);
        }).then(resolve, reject); } };
      return builder;
    },
    update(table) {
      let values;
      const builder = { set(value) { values = value; return this; }, where() { return this; }, then(resolve, reject) { writes.push({ table: getTableName(table), operation: "update", values }); return Promise.resolve([]).then(resolve, reject); } };
      return builder;
    },
    insert(table) {
      let values, conflict;
      const builder = { values(value) { values = value; return this; }, onConflictDoNothing() { return this; }, onConflictDoUpdate(value) { conflict = value; return this; }, returning() { return this; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          const name = getTableName(table); writes.push({ table: name, operation: "insert", values, conflict });
          if (name === "notification_events") { event = { createdAt: now, ...values }; return [event]; }
          if (name === "notification_jobs") { job = job ? { ...job, ...conflict.set } : { attemptedAt: null, ...values }; return [job]; }
          throw new Error(`Unexpected insert ${name}`);
        }).then(resolve, reject); } };
      return builder;
    },
  };
  return { database, writes, get event() { return event; }, get job() { return job; } };
}
const savedEnvironment = process.env;
process.env = { NOTIFICATIONS_ENABLED: "true", NOTIFICATIONS_AUTOMATION_ENABLED: "true", VONAGE_APPLICATION_ID: "synthetic", VONAGE_PRIVATE_KEY: "synthetic", VONAGE_API_KEY: "synthetic", VONAGE_SIGNATURE_SECRET: "synthetic", VONAGE_SMS_FROM: "FitsMyTime", RESEND_API_KEY: "synthetic", NOTIFICATIONS_EMAIL_FROM: "notify@example.test", NOTIFICATIONS_RESEND_WEBHOOK_SECRET: "synthetic" };
let cases = 0;
const reconcile = async (memory, changes = {}, recalculate = false) => { await reconcileBookingReminder(memory.database, { ...baseBooking, ...changes }, now, "Europe/Riga", recalculate); cases++; };
try {
  const first = boundary(); await reconcile(first);
  assert.equal(first.job.dueAt.toISOString(), "2026-10-30T10:00:00.000Z");
  assert.equal(first.job.expiresAt.getTime() - first.job.dueAt.getTime(), 300000);
  assert.equal(first.job.channel, "sms", "Customer preference overrides service method");
  assert.equal(first.event.timezone, "Europe/Riga");
  const absent = boundary({ preferences: null }); await reconcile(absent); assert.equal(absent.job.channel, "email", "No saved preference uses service default");
  for (const status of ["pending", "cancelled", "completed"]) { const memory = boundary(); await reconcile(memory, { status }); assert.equal(memory.job, null); }
  const free = boundary({ pro: false }); await reconcile(free); assert.equal(free.job, null);
  const disabled = boundary({ service: { reminderEnabled: false } }); await reconcile(disabled); assert.equal(disabled.job, null);
  const shortNotice = boundary(); await reconcile(shortNotice, { scheduledDate: new Date(now.getTime() + 23 * 3600000) }); assert.equal(shortNotice.job, null);
  const exact = boundary(); await reconcile(exact, { scheduledDate: new Date(now.getTime() + 24 * 3600000) }); assert.equal(exact.job, null, "A recalculated due time equal to now is skipped");
  const queuedEvent = { id: "reminder", bookingId: 1, scheduledDate: date, kind: "reminder" };
  for (const state of ["accepted", "delivered", "failed", "unknown"]) {
    const memory = boundary({ event: queuedEvent, job: { id: "job", state, attemptedAt: now } }); await reconcile(memory, {}, true);
    assert.equal(memory.writes.some(write => write.operation === "insert"), false, "An attempted reminder is never rescheduled for the same instant");
  }
  const dueJob = { id: "job", state: "queued", attemptedAt: null, dueAt: new Date(now.getTime() - 1000), channel: "email" };
  const grace = boundary({ event: queuedEvent, job: dueJob }); await reconcile(grace);
  assert.equal(grace.writes.some(write => write.operation === "insert"), false, "Periodic reconciliation preserves existing due work during grace");
  const lease = boundary({ event: queuedEvent, job: { ...dueJob, state: "leased", leaseToken: "old", leaseUntil: date }, service: { reminderHours: 12 } });
  await reconcile(lease, {}, true); assert.equal(lease.job.state, "queued"); assert.equal(lease.job.leaseToken, null); assert.equal(lease.job.dueAt.toISOString(), "2026-10-30T22:00:00.000Z");
  const pastRecalculation = boundary({ event: queuedEvent, job: dueJob, service: { reminderHours: 72 } }); await reconcile(pastRecalculation, {}, true);
  assert.equal(pastRecalculation.writes.at(-1).values.state, "skipped"); assert.equal(pastRecalculation.writes.at(-1).values.reasonCode, "past_due");
  const changedMethod = boundary({ event: queuedEvent, job: { ...dueJob, dueAt: new Date("2026-10-30T10:00:00Z") }, preferences: { preferredMethod: null }, service: { reminderMethod: "whatsapp" } });
  await reconcile(changedMethod, {}, true); assert.equal(changedMethod.job.channel, "whatsapp");
  const paused = boundary({ pro: false, event: queuedEvent, job: { ...dueJob, state: "cancelled" } }); await reconcile(paused); assert.equal(paused.job.state, "cancelled");
  const reactivated = boundary({ event: queuedEvent, job: { ...dueJob, state: "cancelled" } }); await reconcile(reactivated); assert.equal(reactivated.job.state, "queued");
  await assert.rejects(assertReminderConfiguration(boundary({ pro: false }).database, baseBooking, { reminderEnabled: true }), /PRO/); cases++;
  await assertReminderConfiguration(boundary({ pro: false }).database, baseBooking, { reminderEnabled: false, reminderHours: 24, reminderMethod: "email" }); cases++;
  const manual = boundary({ pro: false }); const manualResult = await captureStatusEvent(manual.database, baseBooking, "accepted", "Europe/Riga");
  assert.equal(manualResult.mode, "manual"); assert.equal(manual.job, null); cases++;
  const automatic = boundary(); const automaticResult = await captureStatusEvent(automatic.database, baseBooking, "rescheduled", "Europe/Riga", now);
  assert.equal(automaticResult.mode, "automatic"); assert.equal(automaticResult.state, "queued"); assert.equal(automatic.event.previousScheduledDate, now); cases++;
  process.env.NOTIFICATIONS_AUTOMATION_ENABLED = "false";
  const unavailable = boundary(); const unavailableResult = await captureStatusEvent(unavailable.database, baseBooking, "rejected", "UTC");
  assert.equal(unavailableResult.mode, "automatic"); assert.equal(unavailableResult.state, "skipped"); assert.equal(unavailableResult.reasonCode, "not_configured"); cases++;
  console.log(`Notification scheduling: ${cases} real-service scenarios passed (scripted ORM; SQL concurrency unverified).`);
} finally { process.env = savedEnvironment; }
