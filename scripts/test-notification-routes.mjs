import assert from "node:assert/strict";
import express from "express";
import { build } from "esbuild";
import { createHash, createHmac, generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { memoryDatabase } from "./fixtures/notification-database.mjs";

// Real Express routes, preferences and webhook handlers. Only authentication,
// storage transport, DB and outbound provider HTTP are synthetic boundaries.
const root = process.cwd();
const temporary = await mkdtemp(path.join(root, ".notifications-api-check-"));
const state = { memory: null, booking: null, actor: "provider", providerRequests: [], providerAction: null };
globalThis.__notificationTest = state;
const environment = process.env, realFetch = globalThis.fetch;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env = { NODE_ENV: "test", NOTIFICATIONS_ENABLED: "true", NOTIFICATIONS_AUTOMATION_ENABLED: "true", NOTIFICATIONS_VERIFICATION_ENABLED: "true",
  VONAGE_APPLICATION_ID: "00000000-0000-4000-8000-000000000001", VONAGE_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  VONAGE_API_KEY: "synthetic-key", VONAGE_SIGNATURE_SECRET: "synthetic-signature", VONAGE_SMS_FROM: "37120000002", VONAGE_WHATSAPP_FROM: "37120000003",
  RESEND_API_KEY: "synthetic", NOTIFICATIONS_EMAIL_FROM: "notify@example.test", NOTIFICATIONS_RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from("synthetic-webhook").toString("base64")}` };
globalThis.fetch = async (url, options) => {
  assert.ok(url.startsWith("https://api.nexmo.com/"), "Unexpected provider boundary");
  state.providerRequests.push({ url, body: JSON.parse(options.body) });
  if (state.providerAction) return state.providerAction(url, options);
  return Response.json(url.endsWith("/v2/verify") ? { request_id: "00000000-0000-4000-8000-000000000099" } : { request_id: "00000000-0000-4000-8000-000000000099", status: "completed" });
};
const defaultWorkspace = () => ({ company: null, membership: null, workspaces: [], permissions: { manageBookings: true, readAll: true, manageServices: true } });
state.workspace = defaultWorkspace();
const prefs = () => ({ userId: "customer", phone: "+37120000001", phoneVerifiedAt: null, preferredMethod: "email", language: "en", smsOptIn: false, whatsappOptIn: false, emailSuppressed: false });
function reset(values = {}) {
  state.memory = memoryDatabase({ user_communication_preferences: [prefs()], users: [{ id: "customer", email: "customer@example.test" }], ...values });
  state.actor = "provider"; state.workspace = defaultWorkspace(); state.providerRequests = []; state.providerAction = null;
  state.booking = { id: 1, providerId: "provider", companyId: null, seekerId: "customer", employeeId: 7, serviceId: 10, status: "confirmed", notificationRevision: 1, scheduledDate: new Date(Date.now() + 3 * 86400000),
    service: { id: 10, name: "Synthetic service", reminderEnabled: false }, seeker: { firstName: "Synthetic", lastName: "Customer", email: "customer@example.test" } };
}
let server;
try {
  const artifact = await build({ stdin: { contents: 'export { setupNotificationRoutes } from "./server/notifications/routes.ts"; export { mountNotificationWebhooks } from "./server/notifications/webhooks.ts";', resolveDir: root },
    bundle: true, write: false, platform: "node", packages: "external", format: "esm", plugins: [{ name: "isolated-notification-boundaries", setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)db$/ }, () => ({ path: "database", namespace: "notification-test" }));
      builder.onResolve({ filter: /(?:^|\/)auth$/ }, () => ({ path: "auth", namespace: "notification-test" }));
      builder.onResolve({ filter: /(?:^|\/)storage$/ }, () => ({ path: "storage", namespace: "notification-test" }));
      builder.onLoad({ filter: /.*/, namespace: "notification-test" }, args => ({ contents: args.path === "database" ? 'export const db = new Proxy({}, {get(_target, key) { return globalThis.__notificationTest.memory.database[key]; }});'
        : args.path === "auth" ? 'export const isAuthenticated = (req,res,next) => { const actor = req.get("x-test-actor"); if (!actor) return res.sendStatus(401); req.user = {claims:{sub:actor}}; req.workspace=globalThis.__notificationTest.workspace; req.session={}; next(); };'
          : 'export const storage = { async getBookingById(id) { const booking=globalThis.__notificationTest.booking; return booking?.id===id ? booking : undefined; }};' }));
    } }] });
  const modulePath = path.join(temporary, "handlers.mjs"); await writeFile(modulePath, artifact.outputFiles[0].text);
  const handlers = await import(pathToFileURL(modulePath).href);
  const app = express();
  handlers.mountNotificationWebhooks(app); // exact raw body before general JSON
  app.use(express.json()); handlers.setupNotificationRoutes(app);
  server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(url, { actor = state.actor, method = "GET", body, headers = {}, raw } = {}) {
    const response = await realFetch(`${origin}${url}`, { method, headers: { ...(actor ? { "x-test-actor": actor } : {}), ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await response.text(); return { status: response.status, body: text && response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text, headers: response.headers };
  }
  let cases = 0;
  reset();
  assert.equal((await request("/api/account/communication", { actor: null })).status, 401); cases++;
  let response = await request("/api/account/communication", { actor: "customer" });
  assert.equal(response.status, 200); assert.equal(response.body.phoneVerified, false); assert.match(response.headers.get("cache-control"), /no-store/); cases++;
  response = await request("/api/account/communication", { actor: "customer", method: "PATCH", body: { phoneVerified: true } });
  assert.equal(response.status, 400); assert.equal(state.memory.data.user_communication_preferences[0].phoneVerifiedAt, null); cases++;
  response = await request("/api/account/communication", { actor: "customer", method: "PATCH", body: { preferredMethod: "sms", smsOptIn: true } });
  assert.equal(response.status, 400); assert.equal(response.body.code, "unverified_phone"); cases++;

  reset({ user_communication_preferences: [{ ...prefs(), phoneVerifiedAt: new Date(), preferredMethod: "sms", smsOptIn: true, whatsappOptIn: true }],
    phone_verification_challenges: [{ id: "older", userId: "customer", phone: "+37120000001", status: "pending" }] });
  response = await request("/api/account/communication", { actor: "customer", method: "PATCH", body: { phone: "+37120000004", preferredMethod: "whatsapp", whatsappOptIn: true } });
  assert.equal(response.status, 200); assert.equal(response.body.phoneVerified, false); assert.equal(response.body.preferredMethod, "email"); assert.equal(response.body.smsOptIn, false); assert.equal(response.body.whatsappOptIn, false); assert.equal(state.memory.data.phone_verification_challenges[0].status, "expired"); cases++;
  reset({ user_communication_preferences: [{ ...prefs(), phoneVerifiedAt: new Date(), preferredMethod: "sms", smsOptIn: true }] });
  response = await request("/api/account/communication", { actor: "customer", method: "PATCH", body: { smsOptIn: false } });
  assert.equal(response.status, 200); assert.equal(response.body.preferredMethod, "email"); cases++;

  reset();
  response = await request("/api/account/communication/verify/start", { actor: "customer", method: "POST", body: {} });
  assert.equal(response.status, 200); assert.equal(response.body.status, "pending"); assert.equal(state.providerRequests.length, 1); cases++;
  assert.equal((await request("/api/account/communication/verify/start", { actor: "customer", method: "POST", body: {} })).status, 429); assert.equal(state.providerRequests.length, 1); cases++;
  response = await request("/api/account/communication/verify/check", { actor: "customer", method: "POST", body: { code: "123456" } });
  assert.equal(response.status, 200); assert.equal(response.body.status, "verified"); assert.ok(state.memory.data.user_communication_preferences[0].phoneVerifiedAt instanceof Date); cases++;
  response = await request("/api/account/communication/verify/check", { actor: "other-customer", method: "POST", body: { code: "123456" } });
  assert.equal(response.status, 400); cases++;

  reset();
  await request("/api/account/communication/verify/start", { actor: "customer", method: "POST", body: {} });
  state.providerAction = async () => { state.memory.data.user_communication_preferences[0].phone = "+37120000005"; return Response.json({ request_id: "00000000-0000-4000-8000-000000000099", status: "completed" }); };
  response = await request("/api/account/communication/verify/check", { actor: "customer", method: "POST", body: { code: "123456" } });
  assert.equal(response.status, 409); assert.equal(response.body.code, "phone_changed"); assert.equal(state.memory.data.user_communication_preferences[0].phoneVerifiedAt, null); cases++;
  reset();
  await request("/api/account/communication/verify/start", { actor: "customer", method: "POST", body: {} });
  state.providerAction = async () => Response.json({ request_id: "00000000-0000-4000-8000-000000000098", status: "completed" });
  assert.equal((await request("/api/account/communication/verify/check", { actor: "customer", method: "POST", body: { code: "123456" } })).status, 400); assert.equal(state.memory.data.user_communication_preferences[0].phoneVerifiedAt, null); cases++;
  state.providerAction = async () => { throw new Error("synthetic timeout"); };
  response = await request("/api/account/communication/verify/check", { actor: "customer", method: "POST", body: { code: "123456" } });
  assert.equal(response.status, 503); assert.equal(response.body.code, "verification_unknown"); cases++;

  reset();
  response = await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder", timeZone: "Europe/Riga" } });
  assert.equal(response.status, 200); assert.ok(response.body.channels.email.href.startsWith("mailto:")); assert.equal(response.body.channels.sms.href, null); cases++;
  response = await request("/api/bookings/1/notification-preview", { actor: "other-provider", method: "POST", body: { kind: "reminder" } });
  assert.equal(response.status, 403); cases++;
  state.workspace = { ...defaultWorkspace(), company: { id: 6 }, membership: { role: "provider", employeeId: 8 }, permissions: { manageBookings: true, readAll: false } };
  state.booking.companyId = 6;
  assert.equal((await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } })).status, 403); cases++;
  state.workspace.membership.employeeId = 7;
  assert.equal((await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } })).status, 200); cases++;
  reset({ provider_subscriptions: [{ userId: "provider", companyId: null, plan: "pro", proUntil: new Date(Date.now() + 86400000) }] });
  for (const language of ["en", "lv", "ru"]) {
    state.memory.data.user_communication_preferences[0].language = language;
    const beforePreview = structuredClone(state.memory.data);
    response = await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder", timeZone: "Europe/Riga" } });
    assert.equal(response.status, 200, "PRO with service automation off must support manual reminders");
    assert.ok(response.body.message.startsWith({ en: "Reminder:", lv: "Atgādinājums:", ru: "Напоминание:" }[language])); assert.ok(response.body.channels.email.href.startsWith("mailto:"));
    assert.equal(state.providerRequests.length, 0, "Manual preview must not send through a provider");
    assert.deepEqual(state.memory.data, beforePreview, "Manual preview must not change persisted data");
    assert.equal(state.memory.operations.length, 0, "Manual preview must not create a job or attempt any write"); cases++;
  }
  response = await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "status" } });
  assert.equal(response.status, 409); assert.equal(response.body.code, "automatic_mode"); cases++;
  state.booking.service.reminderEnabled = true;
  response = await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } });
  assert.equal(response.status, 409); assert.equal(response.body.code, "automatic_mode"); assert.equal(response.body.channels, undefined); cases++;
  delete state.booking.service.reminderEnabled;
  assert.equal((await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } })).status, 409, "Unknown automation setting must fail closed"); cases++;
  state.booking.service.reminderEnabled = false;
  for (const status of ["pending", "rejected", "cancelled", "completed"]) {
    state.booking.status = status;
    response = await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } });
    assert.equal(response.status, 409); assert.equal(response.body.code, "reminder_ineligible"); assert.equal(response.body.channels, undefined); cases++;
  }
  state.booking.status = "confirmed"; state.booking.scheduledDate = new Date("2000-01-01T00:00:00Z");
  response = await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } });
  assert.equal(response.status, 409); assert.equal(response.body.code, "reminder_ineligible"); cases++;
  reset();
  state.booking.service.reminderEnabled = true;
  assert.equal((await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } })).status, 200, "Free workspaces retain manual reminders regardless of stored automation setting"); cases++;
  state.booking.status = "pending"; state.memory.data.provider_subscriptions = [];
  assert.equal((await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "reminder" } })).status, 409); cases++;
  assert.equal((await request("/api/bookings/1/notification-preview", { method: "POST", body: { kind: "status", recipient: "attacker@example.test" } })).status, 400); cases++;

  reset({ notification_jobs: [{ id: "00000000-0000-4000-8000-000000000011", eventId: "event", state: "accepted", leaseToken: null, leaseUntil: null }],
    notification_delivery_attempts: [{ id: "attempt", jobId: "00000000-0000-4000-8000-000000000011", provider: "vonage", providerMessageId: "message-1", state: "accepted" }] });
  function vonageHeaders(raw, id) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "Vonage", api_key: process.env.VONAGE_API_KEY, iat: Math.floor(Date.now() / 1000), jti: id, payload_hash: createHash("sha256").update(raw).digest("hex") })).toString("base64url");
    return { authorization: `Bearer ${header}.${payload}.${createHmac("sha256", process.env.VONAGE_SIGNATURE_SECRET).update(`${header}.${payload}`).digest("base64url")}` };
  }
  let raw = JSON.stringify({ message_uuid: "message-1", channel: "sms", status: "delivered" });
  assert.equal((await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: { authorization: "Bearer forged" } })).status, 401); cases++;
  response = await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: vonageHeaders(raw, "receipt-1") });
  assert.equal(response.status, 204); assert.equal(state.memory.data.notification_jobs[0].state, "delivered"); cases++;
  response = await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: vonageHeaders(raw, "receipt-1") });
  assert.equal(response.status, 204); assert.equal(state.memory.data.notification_callbacks.length, 1, "Repeated signed callback is idempotent"); cases++;
  raw = JSON.stringify({ message_uuid: "message-1", channel: "sms", status: "failed" });
  response = await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: vonageHeaders(raw, "receipt-2") });
  assert.equal(response.status, 204); assert.equal(state.memory.data.notification_jobs[0].state, "delivered", "Out-of-order failure cannot undo delivery"); assert.ok(!state.memory.data.notification_jobs[0].reasonCode, "Delivered status cannot display stale failure reason"); cases++;
  raw = JSON.stringify({ message_uuid: "unknown-message", channel: "sms", status: "delivered" });
  response = await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: vonageHeaders(raw, "uncorrelated") });
  assert.equal(response.status, 503); assert.equal(state.memory.data.notification_callbacks.length, 2, "Uncorrelated callbacks roll back replay marker for provider retry"); cases++;
  reset({ notification_jobs: [{ id: "email-job", eventId: "event", state: "accepted", leaseToken: null, leaseUntil: null }],
    notification_delivery_attempts: [{ id: "email-attempt", jobId: "email-job", provider: "resend", providerMessageId: "email-1", state: "accepted" }] });
  raw = JSON.stringify({ type: "email.delivered", data: { email_id: "email-1" } });
  const emailHeaders = { "svix-id": "email-receipt-1", "svix-timestamp": String(Math.floor(Date.now() / 1000)) };
  emailHeaders["svix-signature"] = `v1,${createHmac("sha256", Buffer.from(process.env.NOTIFICATIONS_RESEND_WEBHOOK_SECRET.replace("whsec_", ""), "base64")).update(`${emailHeaders["svix-id"]}.${emailHeaders["svix-timestamp"]}.${raw}`).digest("base64")}`;
  assert.equal((await request("/api/notifications/webhooks/resend", { actor: null, method: "POST", raw, headers: { ...emailHeaders, "svix-signature": "v1,forged" } })).status, 401); cases++;
  assert.equal((await request("/api/notifications/webhooks/resend", { actor: null, method: "POST", raw, headers: emailHeaders })).status, 204); assert.equal(state.memory.data.notification_jobs[0].state, "delivered"); cases++;
  assert.equal((await request("/api/notifications/webhooks/resend", { actor: null, method: "POST", raw, headers: emailHeaders })).status, 204); assert.equal(state.memory.data.notification_callbacks.length, 1); cases++;
  reset({ user_communication_preferences: [{ ...prefs(), phoneVerifiedAt: new Date(), preferredMethod: "sms", smsOptIn: true }] });
  raw = JSON.stringify({ message_uuid: "inbound-stop", channel: "sms", from: "37120000001", to: "37120000002", text: "STOP" });
  response = await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: vonageHeaders(raw, "stop-1") });
  assert.equal(response.status, 204); assert.equal(state.memory.data.user_communication_preferences[0].smsOptIn, false); assert.equal(state.memory.data.user_communication_preferences[0].preferredMethod, "email"); cases++;
  process.env.NOTIFICATIONS_ENABLED = "false";
  assert.equal((await request("/api/account/communication", { actor: "customer" })).status, 503); cases++;
  assert.equal((await request("/api/notifications/webhooks/vonage", { actor: null, method: "POST", raw, headers: vonageHeaders(raw, "stop-2") })).status, 503); cases++;
  console.log(`Notification API/preferences/webhooks: ${cases} real-handler scenarios passed (mock auth/ORM/providers; loopback HTTP only).`);
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  process.env = environment; globalThis.fetch = realFetch; delete globalThis.__notificationTest;
  assert.equal(path.dirname(temporary), root); assert.ok(path.basename(temporary).startsWith(".notifications-api-check-"));
  await rm(temporary, { recursive: true, force: true });
}
