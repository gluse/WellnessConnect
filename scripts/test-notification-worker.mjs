import assert from "node:assert/strict";
import { memoryDatabase } from "./fixtures/notification-database.mjs";
import { processNotificationJob } from "../server/notifications/worker.ts";
import { TransportError } from "../server/notifications/transports.ts";

const now = new Date("2026-10-29T10:00:00Z"), scheduledDate = new Date("2026-10-31T10:00:00Z");
const job = { id: "job", eventId: "event", channel: "email", state: "leased", dueAt: now, expiresAt: new Date(now.getTime() + 300000), leaseToken: "lease", leaseUntil: new Date(now.getTime() + 60000), attemptedAt: null, providerMessageId: null, reasonCode: null };
const seed = () => ({
  notification_jobs: [job],
  notification_events: [{ id: "event", bookingId: 1, bookingRevision: 2, kind: "accepted", scheduledDate, previousScheduledDate: null, timezone: "Europe/Riga", automatic: true }],
  bookings: [{ id: 1, serviceId: 10, seekerId: "customer", providerId: "provider", companyId: null, notificationRevision: 2, scheduledDate, status: "confirmed" }],
  services: [{ id: 10, name: "Synthetic service", isActive: true, reminderEnabled: true, reminderMethod: "email", reminderHours: 24 }],
  users: [{ id: "customer", email: "customer@example.test" }],
  provider_subscriptions: [{ id: 9, userId: "provider", companyId: null, plan: "pro", proUntil: new Date("2026-11-30T00:00:00Z") }],
  user_communication_preferences: [{ userId: "customer", phone: "+37120000001", phoneVerifiedAt: now, preferredMethod: "sms", language: "lv", smsOptIn: true, whatsappOptIn: true, emailSuppressed: false }],
});
const savedEnvironment = process.env;
process.env = { NOTIFICATIONS_ENABLED: "true", NOTIFICATIONS_AUTOMATION_ENABLED: "true", VONAGE_APPLICATION_ID: "synthetic", VONAGE_PRIVATE_KEY: "synthetic", VONAGE_API_KEY: "synthetic", VONAGE_SIGNATURE_SECRET: "synthetic", VONAGE_SMS_FROM: "FitsMyTime", VONAGE_WHATSAPP_FROM: "37120000002", RESEND_API_KEY: "synthetic", NOTIFICATIONS_EMAIL_FROM: "notify@example.test", NOTIFICATIONS_RESEND_WEBHOOK_SECRET: "synthetic" };
const savedFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("No provider network allowed"); };
let cases = 0;
async function scenario(label, change, expected, transportAction) {
  const input = seed(); change(input);
  const memory = memoryDatabase(input), calls = [];
  const transports = { async send(message) {
    calls.push(message);
    assert.equal(memory.data.notification_delivery_attempts.find(attempt => attempt.jobId === message.jobId)?.state, "reserved", "Attempt is persisted before remote side effect");
    assert.ok(memory.data.notification_jobs[0].attemptedAt instanceof Date);
    if (transportAction) return transportAction(memory, message);
    return { provider: "vonage", messageId: "synthetic-message" };
  } };
  await processNotificationJob(memory.database, { ...job }, transports, now);
  const current = memory.data.notification_jobs[0];
  assert.equal(current.state, expected.state, label);
  assert.equal(calls.length, expected.calls, label);
  if (expected.reason) assert.equal(current.reasonCode, expected.reason, label);
  if (expected.clearReason) assert.ok(!current.reasonCode, `${label}: successful delivery clears errors`);
  if (calls.length) { assert.equal(calls[0].recipient, "+37120000001"); assert.equal(calls[0].channel, "sms", "Current customer preference wins over queued/default channel"); assert.equal(calls[0].language, "lv"); }
  await processNotificationJob(memory.database, { ...job }, transports, now);
  assert.equal(calls.length, expected.calls, `${label}: same lease/job cannot send twice`);
  cases++;
}
function historicalAttempts(input, count, { seekerId = "customer", providerId = "provider", createdAt = now } = {}) {
  for (let index = 0; index < count; index++) {
    const bookingId = index + 100;
    input.bookings.push({ ...input.bookings[0], id: bookingId, seekerId, providerId });
    input.notification_events.push({ ...input.notification_events[0], id: `previous-event-${index}`, bookingId });
    input.notification_jobs.push({ ...job, id: `previous-job-${index}`, eventId: `previous-event-${index}`, state: "accepted" });
    (input.notification_delivery_attempts ??= []).push({ id: `previous-attempt-${index}`, jobId: `previous-job-${index}`, state: "accepted", createdAt });
  }
}
try {
  await scenario("PRO accepted update", () => {}, { state: "accepted", calls: 1 });
  await scenario("Unverified phone cannot send", input => { input.user_communication_preferences[0].phoneVerifiedAt = null; }, { state: "skipped", calls: 0, reason: "unverified_phone" });
  await scenario("Revoked permission cannot send", input => { input.user_communication_preferences[0].smsOptIn = false; }, { state: "skipped", calls: 0, reason: "missing_permission" });
  await scenario("Stale status event", input => { input.bookings[0].notificationRevision++; }, { state: "cancelled", calls: 0, reason: "superseded" });
  await scenario("Stale appointment instant", input => { input.bookings[0].scheduledDate = new Date("2026-11-01T10:00:00Z"); }, { state: "cancelled", calls: 0, reason: "superseded" });
  await scenario("Expired PRO", input => { input.provider_subscriptions[0].proUntil = new Date("2026-10-28T00:00:00Z"); }, { state: "cancelled", calls: 0, reason: "pro_inactive" });
  await scenario("Other personal subscription confers no access", input => { input.provider_subscriptions[0].userId = "other-provider"; }, { state: "cancelled", calls: 0, reason: "pro_inactive" });
  await scenario("Other company subscription confers no access", input => { input.bookings[0].companyId = 6; input.companies = [{ id: 6, isActive: true }]; }, { state: "cancelled", calls: 0, reason: "pro_inactive" });
  await scenario("Inactive company cannot automate", input => { input.bookings[0].companyId = 6; input.companies = [{ id: 6, isActive: false }]; input.provider_subscriptions[0].companyId = 6; input.provider_subscriptions[0].userId = null; }, { state: "cancelled", calls: 0, reason: "pro_inactive" });
  await scenario("Reminder grace elapsed", input => { input.notification_jobs[0] = { ...job, expiresAt: new Date(now.getTime() - 1) }; }, { state: "skipped", calls: 0, reason: "expired" });
  await scenario("Pending appointments have no automatic reminder", input => { input.notification_events[0].kind = "reminder"; input.bookings[0].status = "pending"; }, { state: "cancelled", calls: 0, reason: "reminder_ineligible" });
  await scenario("Disabled reminder settings", input => { input.notification_events[0].kind = "reminder"; input.services[0].reminderEnabled = false; }, { state: "cancelled", calls: 0, reason: "reminder_ineligible" });
  await scenario("Reserved attempt is never sent again", input => { input.notification_delivery_attempts = [{ id: "previous-attempt", jobId: "job", state: "unknown" }]; }, { state: "skipped", calls: 0, reason: "already_attempted" });
  await scenario("Unknown remote outcome does not retry", () => {}, { state: "unknown", calls: 1, reason: "transport_unknown" }, () => { throw new TransportError("unknown", "transport_unknown"); });
  await scenario("Explicit provider failure does not retry", () => {}, { state: "failed", calls: 1, reason: "provider_rejected" }, () => { throw new TransportError("failed", "provider_rejected"); });
  await scenario("Early trusted callback survives send completion", () => {}, { state: "delivered", calls: 1 }, memory => { memory.data.notification_jobs[0].state = "delivered"; return { provider: "vonage", messageId: "synthetic-message" }; });
  await scenario("Trusted delivery survives HTTP timeout without false error", () => {}, { state: "delivered", calls: 1, clearReason: true }, memory => { memory.data.notification_jobs[0].state = "delivered"; throw new TransportError("unknown", "transport_unknown"); });
  await scenario("A hidden listing retains accepted booking notifications", input => { input.services[0].isActive = false; }, { state: "accepted", calls: 1 });
  await scenario("Replaced lease cannot dispatch", input => { input.notification_jobs[0] = { ...job, leaseToken: "replacement" }; }, { state: "leased", calls: 0 });
  await scenario("Customer send quota prevents repeated change spam", input => historicalAttempts(input, 10), { state: "skipped", calls: 0, reason: "rate_limited" });
  await scenario("Workspace send quota bounds aggregate automatic costs", input => historicalAttempts(input, 1000, { seekerId: "other-customer" }), { state: "skipped", calls: 0, reason: "rate_limited" });
  await scenario("Expired quota usage does not block sends", input => historicalAttempts(input, 10, { createdAt: new Date(now.getTime() - 3600001) }), { state: "accepted", calls: 1 });
  await scenario("Other workspace usage is isolated", input => historicalAttempts(input, 10, { providerId: "other-provider" }), { state: "accepted", calls: 1 });
  process.env.NOTIFICATIONS_AUTOMATION_ENABLED = "false";
  await scenario("Disabling automation stops a previously claimed job", () => {}, { state: "cancelled", calls: 0, reason: "pro_inactive" });
  process.env.NOTIFICATIONS_AUTOMATION_ENABLED = "true";
  process.env.NOTIFICATIONS_ENABLED = "false";
  await scenario("Disabling feature stops a previously claimed job", () => {}, { state: "cancelled", calls: 0, reason: "pro_inactive" });
  process.env.NOTIFICATIONS_ENABLED = "true";
  const expiredWhileWaiting = seed();
  expiredWhileWaiting.provider_subscriptions[0].proUntil = new Date(Date.now() + 30);
  const waiting = memoryDatabase(expiredWhileWaiting), transaction = waiting.database.transaction;
  waiting.database.transaction = async action => { await new Promise(resolve => setTimeout(resolve, 60)); return transaction(action); };
  let delayedCalls = 0;
  await processNotificationJob(waiting.database, { ...job }, { async send() { delayedCalls++; return { provider: "vonage", messageId: "must-not-send" }; } });
  assert.equal(delayedCalls, 0, "PRO expiry uses the clock after acquiring locks, not dispatch start");
  assert.equal(waiting.data.notification_jobs[0].reasonCode, "pro_inactive"); cases++;
  console.log(`Notification worker: ${cases} real-handler scenarios passed (in-memory ORM and provider boundaries; no database/network).`);
} finally { process.env = savedEnvironment; globalThis.fetch = savedFetch; }
