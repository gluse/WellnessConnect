import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, verify as verifySignature } from "node:crypto";
import { channelReason, defaultPreferences, deliveryTransition, manualPreview, reminderDue, renderMessage, statusAction } from "../server/notifications/policy.ts";
import { createTransports, notificationConfig, templateFor, transportReady, verificationReady, verifyResend, verifyVonage } from "../server/notifications/transports.ts";
import { communicationPatchSchema, notificationTimezoneSchema } from "../shared/notifications.ts";

// Pure policy + injected HTTP only. No app bootstrap, dotenv, database, real
// credentials, messaging accounts or external network is imported or used.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Unexpected real network boundary"); };
let assertions = 0;
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions++; }
function ok(value, label) { assert.ok(value, label); assertions++; }
const now = new Date("2026-10-29T10:00:00Z");
const appointment = new Date("2026-10-31T10:00:00Z");
const phone = "+37120000001";
const prefs = { ...defaultPreferences, phone, phoneVerifiedAt: now, smsOptIn: true, whatsappOptIn: true };
const privateService = "Massage & spa <test> + jā";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const templates = Object.fromEntries(["en", "lv", "ru"].flatMap(language => ["accepted", "rejected", "rescheduled", "reminder"].map(kind => [`${language}:${kind}`, { name: `appointment_${kind}`, namespace: "test_namespace", language }])));
const config = notificationConfig({ NOTIFICATIONS_ENABLED: "true", NOTIFICATIONS_AUTOMATION_ENABLED: "true", NOTIFICATIONS_VERIFICATION_ENABLED: "true",
  VONAGE_APPLICATION_ID: "00000000-0000-4000-8000-000000000001", VONAGE_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  VONAGE_API_KEY: "synthetic-key", VONAGE_SIGNATURE_SECRET: "synthetic-webhook-signature", VONAGE_SMS_FROM: "FitsMyTime", VONAGE_WHATSAPP_FROM: "37120000002",
  VONAGE_WHATSAPP_TEMPLATES_JSON: JSON.stringify(templates), RESEND_API_KEY: "synthetic-resend-key", NOTIFICATIONS_EMAIL_FROM: "FitsMyTime <notify@example.test>",
  NOTIFICATIONS_RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from("synthetic-resend-webhook-key").toString("base64")}` });
const requestId = "00000000-0000-4000-8000-000000000002";
const sent = { channel: "email", recipient: "customer@example.test", subject: "Appointment update", message: "Synthetic test message", jobId: "00000000-0000-4000-8000-000000000003", language: "en", kind: "accepted", service: privateService, date: "31 Oct 2026 12:00 (Europe/Riga)", oldDate: "30 Oct 2026 12:00 (Europe/Riga)" };
const requests = [];
let result = {};
const fetcher = async (url, options) => {
  requests.push({ url, options, body: JSON.parse(options.body) });
  equal(options.redirect, "error", "Provider redirects are never followed");
  ok(options.signal instanceof AbortSignal, "Every outbound request has a timeout signal");
  return Response.json(result);
};
const transport = createTransports(config, fetcher);
const expectTransportError = async (operation, outcome, code) => {
  await assert.rejects(operation, error => error.outcome === outcome && (!code || error.code === code)); assertions++;
};
try {
  equal(statusAction("pending", "confirmed"), "accepted");
  equal(statusAction("pending", "cancelled"), "rejected");
  for (const [before, after] of [["confirmed", "cancelled"], ["confirmed", "completed"], ["pending", "pending"], ["confirmed", "confirmed"], ["cancelled", "confirmed"]]) equal(statusAction(before, after), null, "Excluded/no-op transitions do not notify");
  equal(reminderDue(appointment, 24, now)?.toISOString(), "2026-10-30T10:00:00.000Z");
  equal(reminderDue(new Date(now.getTime() + 24 * 3600000), 24, now), null, "Elapsed/exact-now schedule is skipped");
  equal(reminderDue(new Date(now.getTime() + 10 * 3600000), 24, now), null, "Short-notice appointments do not create immediate reminders");
  equal(channelReason("email", defaultPreferences, "customer@example.test"), null);
  equal(channelReason("email", prefs, "a\r\nb@example.test"), "missing_email");
  equal(channelReason("sms", defaultPreferences, null), "missing_phone");
  equal(channelReason("whatsapp", { ...prefs, phoneVerifiedAt: null }, null), "unverified_phone");
  equal(channelReason("sms", { ...prefs, smsOptIn: false }, null), "missing_permission");
  equal(channelReason("whatsapp", { ...prefs, whatsappOptIn: false }, null), "missing_permission");
  equal(channelReason("sms", prefs, null), null);
  equal(channelReason("whatsapp", prefs, null), null);
  ok(!communicationPatchSchema.safeParse({ phoneVerified: true }).success, "Client cannot assign verification state");
  ok(!communicationPatchSchema.safeParse({ phone: "37120000001" }).success, "Phone requires international + format");
  ok(communicationPatchSchema.safeParse({ phone, preferredMethod: "sms", smsOptIn: true, language: "lv" }).success);
  ok(!notificationTimezoneSchema.safeParse("javascript:alert(1)").success);
  equal(notificationTimezoneSchema.parse(undefined), "UTC");

  for (const language of ["en", "lv", "ru"]) {
    for (const kind of ["accepted", "rejected", "rescheduled", "reminder"]) {
      const rendered = renderMessage({ kind, service: privateService, date: appointment, oldDate: now, language, timeZone: "Europe/Riga" });
      ok(rendered.message.includes(privateService), "Customer service name is preserved as literal text");
      ok(rendered.message.includes("Europe/Riga"), "Timezone is explicit");
      ok(!rendered.message.includes("{date}") && !rendered.message.includes("{old}"), "Whole message has no template placeholders");
      if (kind === "rescheduled") { ok(rendered.message.includes(rendered.oldDate)); ok(rendered.message.includes(rendered.date)); }
      const preview = manualPreview({ customerName: "Synthetic customer", ...rendered, preferences: prefs, email: "customer+booking@example.test" });
      const sms = new URL(preview.channels.sms.href), email = new URL(preview.channels.email.href), whatsapp = new URL(preview.channels.whatsapp.href);
      equal(sms.protocol, "sms:"); equal(sms.pathname, phone); equal(sms.searchParams.get("body"), rendered.message);
      equal(email.protocol, "mailto:"); equal(decodeURIComponent(email.pathname), "customer+booking@example.test"); equal(email.searchParams.get("body"), rendered.message); equal(email.searchParams.get("subject"), rendered.subject);
      equal(whatsapp.origin, "https://wa.me"); equal(whatsapp.pathname, "/37120000001"); equal(whatsapp.searchParams.get("text"), rendered.message);
    }
  }
  const unavailable = manualPreview({ customerName: "Synthetic", subject: "Test", message: "Text", preferences: defaultPreferences, email: null });
  equal(Object.values(unavailable.channels).map(channel => channel.href), [null, null, null]);
  equal(unavailable.channels.sms.reasonCode, "missing_phone");
  equal(deliveryTransition("delivered", "failed"), "delivered", "Late failure cannot undo delivered");
  equal(deliveryTransition("failed", "accepted"), "failed", "Out-of-order accepted cannot undo failure");
  equal(deliveryTransition("failed", "delivered"), "delivered");
  equal(deliveryTransition("unknown", "delivered"), "delivered", "A trusted receipt can resolve unknown");
  equal(deliveryTransition("cancelled", "accepted"), "cancelled");
  equal(deliveryTransition("skipped", "delivered"), "skipped");

  ok(verificationReady(config));
  for (const channel of ["email", "sms", "whatsapp"]) ok(transportReady(config, channel));
  equal(templateFor({ ...config, whatsappTemplates: "malformed" }, "en", "accepted"), null);
  equal(transportReady({ ...config, whatsappTemplates: "{}" }, "whatsapp"), false, "Missing approved template does not fall back to free text");
  const disabled = notificationConfig({});
  for (const channel of ["email", "sms", "whatsapp"]) equal(transportReady(disabled, channel), false);
  equal(verificationReady(disabled), false);
  await expectTransportError(() => createTransports(disabled, fetcher).startVerification(phone), "failed", "not_configured");
  await expectTransportError(() => createTransports(disabled, fetcher).send(sent), "failed", "not_configured");
  equal(requests.length, 0, "Disabled integrations perform no provider calls");

  result = { request_id: requestId };
  equal(await transport.startVerification(phone), requestId);
  equal(requests.at(-1).url, "https://api.nexmo.com/v2/verify");
  equal(requests.at(-1).body.workflow, [{ channel: "sms", to: phone.slice(1) }], "Verification uses SMS only, no voice fallback");
  equal(requests.at(-1).body.code_length, 6);
  const token = requests.at(-1).options.headers.Authorization.replace("Bearer ", "").split(".");
  equal(JSON.parse(Buffer.from(token[0], "base64url")).alg, "RS256");
  ok(verifySignature("RSA-SHA256", Buffer.from(`${token[0]}.${token[1]}`), publicKey, Buffer.from(token[2], "base64url")), "Provider bearer is cryptographically valid");
  const claims = JSON.parse(Buffer.from(token[1], "base64url"));
  equal(claims.application_id, config.applicationId); ok(claims.exp > claims.iat && claims.exp - claims.iat <= 120);
  result = { request_id: requestId, status: "completed" };
  equal(await transport.checkVerification(requestId, "123456"), true);
  equal(requests.at(-1).body, { code: "123456" });
  result = { request_id: "different", status: "completed" };
  equal(await transport.checkVerification(requestId, "123456"), false, "Response must bind to the requested challenge");
  result = { request_id: requestId, status: "pending" };
  equal(await transport.checkVerification(requestId, "123456"), false);

  result = { id: "synthetic-email-id" };
  equal(await transport.send(sent), { provider: "resend", messageId: "synthetic-email-id" });
  equal(requests.at(-1).url, "https://api.resend.com/emails"); equal(requests.at(-1).options.headers["Idempotency-Key"], sent.jobId);
  equal(requests.at(-1).body, { from: config.emailFrom, to: [sent.recipient], subject: sent.subject, text: sent.message });
  result = { message_uuid: requestId };
  equal(await transport.send({ ...sent, channel: "sms", recipient: phone }), { provider: "vonage", messageId: requestId });
  equal(requests.at(-1).body.channel, "sms"); equal(requests.at(-1).body.to, phone.slice(1)); equal(requests.at(-1).body.text, sent.message);
  await transport.send({ ...sent, channel: "whatsapp", kind: "rescheduled", recipient: phone });
  equal(requests.at(-1).body.message_type, "template"); equal(requests.at(-1).body.whatsapp.locale, "en");
  equal(requests.at(-1).body.template.parameters, [privateService, sent.date, sent.oldDate]);
  equal(requests.at(-1).body.client_ref, sent.jobId);
  ok(!Object.hasOwn(requests.at(-1).body, "text"), "WhatsApp always uses an approved template");

  for (const [status, outcome, code] of [[429, "failed", "rate_limited"], [400, "failed", "provider_rejected"], [503, "unknown", "provider_rejected"]]) {
    let calls = 0;
    await expectTransportError(() => createTransports(config, async () => { calls++; return new Response("Synthetic private provider details", { status }); }).send(sent), outcome, code);
    equal(calls, 1, "No automatic provider retry");
  }
  await expectTransportError(() => createTransports(config, async () => { throw new Error("Synthetic timeout"); }).send(sent), "unknown", "transport_unknown");
  await expectTransportError(() => createTransports(config, async () => new Response("not JSON")).send(sent), "unknown");
  await expectTransportError(() => createTransports(config, async () => Response.json({ id: "x".repeat(20000) })).send(sent), "unknown", "invalid_response");
  await expectTransportError(() => createTransports(config, async () => Response.json({})).send(sent), "unknown", "invalid_response");

  const raw = Buffer.from(JSON.stringify({ message_uuid: requestId, status: "delivered" }));
  const signatureNow = now.getTime();
  const signedClaims = { iss: "Vonage", api_key: config.apiKey, application_id: config.applicationId, iat: signatureNow / 1000, jti: "synthetic-webhook-id", payload_hash: createHash("sha256").update(raw).digest("hex") };
  function vonageToken(data = signedClaims, algorithm = "HS256", secret = config.signatureSecret) {
    const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: "JWT" })).toString("base64url"), body = Buffer.from(JSON.stringify(data)).toString("base64url");
    return `Bearer ${header}.${body}.${createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url")}`;
  }
  equal(verifyVonage(raw, vonageToken(), config, signatureNow), signedClaims.jti);
  equal(verifyVonage(Buffer.from("tampered"), vonageToken(), config, signatureNow), null, "Signed token cannot authenticate a changed payload");
  equal(verifyVonage(raw, vonageToken(), config, signatureNow + 301000), null, "Stale webhook token is rejected");
  equal(verifyVonage(raw, vonageToken({ ...signedClaims, api_key: "other-account" }), config, signatureNow), null);
  equal(verifyVonage(raw, vonageToken({ ...signedClaims, application_id: "other-app" }), config, signatureNow), null);
  equal(verifyVonage(raw, vonageToken(signedClaims, "none"), config, signatureNow), null);
  equal(verifyVonage(raw, vonageToken(signedClaims, "HS256", "other-key"), config, signatureNow), null);
  equal(verifyVonage(raw, "Bearer malformed", config, signatureNow), null);
  const resendHeaders = { id: "synthetic-svix-id", timestamp: String(signatureNow / 1000), signature: "" };
  resendHeaders.signature = `v1,${createHmac("sha256", Buffer.from(config.resendSecret.replace("whsec_", ""), "base64")).update(`${resendHeaders.id}.${resendHeaders.timestamp}.`).update(raw).digest("base64")}`;
  equal(verifyResend(raw, resendHeaders, config.resendSecret, signatureNow), true);
  equal(verifyResend(Buffer.from("tampered"), resendHeaders, config.resendSecret, signatureNow), false);
  equal(verifyResend(raw, resendHeaders, config.resendSecret, signatureNow + 301000), false);
  equal(verifyResend(raw, { ...resendHeaders, id: "other-id" }, config.resendSecret, signatureNow), false);
  equal(verifyResend(raw, { ...resendHeaders, signature: "v1,forged" }, config.resendSecret, signatureNow), false);
  equal(verifyResend(raw, { ...resendHeaders, signature: `v1,old-invalid ${resendHeaders.signature}` }, config.resendSecret, signatureNow), true, "Key rotation signatures are accepted");

  const literalService = "Massage {date} {old} $& $` $'";
  const literal = renderMessage({ kind: "rescheduled", service: literalService, date: appointment, oldDate: now, language: "en", timeZone: "UTC" });
  ok(literal.message.includes(literalService), "User content must remain literal and cannot be reinterpreted as template placeholders/replacements");
  console.log(`Notification policy/transports: ${assertions} assertions passed (offline; en/lv/ru only).`);
} finally { globalThis.fetch = originalFetch; }
