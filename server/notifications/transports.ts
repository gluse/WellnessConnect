import { createHash, createHmac, randomUUID, sign, timingSafeEqual } from "node:crypto";
import type { CommunicationMethod } from "../../shared/notifications";

export type NotificationConfig = ReturnType<typeof notificationConfig>;
export function notificationConfig(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.NOTIFICATIONS_ENABLED === "true";
  const config = { enabled, automationEnabled: enabled && env.NOTIFICATIONS_AUTOMATION_ENABLED === "true",
    applicationId: env.VONAGE_APPLICATION_ID ?? "", privateKey: (env.VONAGE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    apiKey: env.VONAGE_API_KEY ?? "", signatureSecret: env.VONAGE_SIGNATURE_SECRET ?? "",
    smsFrom: env.VONAGE_SMS_FROM ?? "", whatsappFrom: env.VONAGE_WHATSAPP_FROM ?? "",
    whatsappTemplates: env.VONAGE_WHATSAPP_TEMPLATES_JSON ?? "{}",
    resendKey: env.RESEND_API_KEY ?? "", emailFrom: env.NOTIFICATIONS_EMAIL_FROM ?? "", resendSecret: env.NOTIFICATIONS_RESEND_WEBHOOK_SECRET ?? "",
    verificationEnabled: enabled && env.NOTIFICATIONS_VERIFICATION_ENABLED === "true" };
  return config;
}
type Template = { name: string; language: string; namespace: string };
export function templateFor(config: NotificationConfig, language: string, kind: string): Template | null {
  try {
    const value = JSON.parse(config.whatsappTemplates)[`${language}:${kind}`];
    return value && [value.name, value.language, value.namespace].every(v => typeof v === "string" && /^[a-zA-Z0-9_-]{1,150}$/.test(v)) ? value : null;
  } catch { return null; }
}
export function transportReady(config: NotificationConfig, channel: CommunicationMethod, language = "en", kind = "reminder") {
  if (!config.automationEnabled) return false;
  if (channel === "email") return Boolean(config.resendKey && config.emailFrom && config.resendSecret);
  const common = Boolean(config.applicationId && config.privateKey && config.apiKey && config.signatureSecret);
  return common && (channel === "sms" ? Boolean(config.smsFrom) : Boolean(config.whatsappFrom && templateFor(config, language, kind)));
}
export function verificationReady(config: NotificationConfig) { return config.verificationEnabled && Boolean(config.applicationId && config.privateKey); }
function jwt(config: NotificationConfig) {
  const now = Math.floor(Date.now() / 1000), head = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ application_id: config.applicationId, iat: now, exp: now + 120, jti: randomUUID() })).toString("base64url");
  return `${head}.${payload}.${sign("RSA-SHA256", Buffer.from(`${head}.${payload}`), config.privateKey).toString("base64url")}`;
}
export class TransportError extends Error {
  constructor(public outcome: "failed" | "unknown", public code: string) { super(code); }
}
export function createTransports(config: NotificationConfig, fetcher: typeof fetch = fetch) {
  async function post(url: string, auth: string, body: unknown, idempotencyKey?: string) {
    try {
      const response = await fetcher(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000), headers: {
        Authorization: `Bearer ${auth}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      }, body: JSON.stringify(body) });
      // No retries: a 5xx/timeout can follow remote acceptance.
      if (!response.ok) { await response.body?.cancel(); throw new TransportError(response.status >= 500 ? "unknown" : "failed", response.status === 429 ? "rate_limited" : "provider_rejected"); }
      const reader = response.body?.getReader();
      if (!reader) throw new TransportError("unknown", "invalid_response");
      const parts: Uint8Array[] = []; let size = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16_384) { await reader.cancel(); throw new TransportError("unknown", "invalid_response"); } parts.push(value); }
      return JSON.parse(Buffer.concat(parts).toString("utf8")) as Record<string, unknown>;
    } catch (error) { if (error instanceof TransportError) throw error; throw new TransportError("unknown", "transport_unknown"); }
  }
  return {
    async startVerification(phone: string) {
      if (!verificationReady(config)) throw new TransportError("failed", "not_configured");
      const result = await post("https://api.nexmo.com/v2/verify", jwt(config), { brand: "FitsMyTime", code_length: 6, channel_timeout: 300, workflow: [{ channel: "sms", to: phone.slice(1) }] });
      if (typeof result.request_id !== "string" || !/^[a-f0-9-]{36}$/i.test(result.request_id)) throw new TransportError("unknown", "invalid_response");
      return result.request_id;
    },
    async checkVerification(requestId: string, code: string) {
      const result = await post(`https://api.nexmo.com/v2/verify/${encodeURIComponent(requestId)}`, jwt(config), { code });
      return result.status === "completed" && result.request_id === requestId;
    },
    async send(input: { channel: CommunicationMethod; recipient: string; subject: string; message: string; jobId: string; language: string; kind: string; service: string; date: string; oldDate: string }) {
      if (!transportReady(config, input.channel, input.language, input.kind)) throw new TransportError("failed", "not_configured");
      if (input.channel === "email") {
        const result = await post("https://api.resend.com/emails", config.resendKey, { from: config.emailFrom, to: [input.recipient], subject: input.subject, text: input.message }, input.jobId);
        if (typeof result.id !== "string" || result.id.length > 255) throw new TransportError("unknown", "invalid_response");
        return { provider: "resend" as const, messageId: result.id };
      }
      const template = templateFor(config, input.language, input.kind);
      const message = input.channel === "sms" ? { channel: "sms", message_type: "text", text: input.message, from: config.smsFrom }
        : { channel: "whatsapp", message_type: "template", from: config.whatsappFrom, whatsapp: { policy: "deterministic", locale: template!.language },
          template: { name: `${template!.namespace}:${template!.name}`, parameters: [input.service, input.date, ...(input.kind === "rescheduled" ? [input.oldDate] : [])] } };
      const result = await post("https://api.nexmo.com/v1/messages", jwt(config), { ...message, to: input.recipient.replace(/^\+/, ""), client_ref: input.jobId });
      if (typeof result.message_uuid !== "string" || result.message_uuid.length > 255) throw new TransportError("unknown", "invalid_response");
      return { provider: "vonage" as const, messageId: result.message_uuid };
    },
  };
}
function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export function verifyVonage(raw: Buffer, authorization: string, config: NotificationConfig, now = Date.now()): string | null {
  try {
    if (!config.signatureSecret || authorization.length > 8192) return null;
    const token = authorization.replace(/^Bearer /, ""); const parts = token.split("."); if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString()), data = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (header.alg !== "HS256" || !equal(createHmac("sha256", config.signatureSecret).update(`${parts[0]}.${parts[1]}`).digest("base64url"), parts[2])) return null;
    if (data.iss !== "Vonage" || data.api_key !== config.apiKey || (data.application_id && data.application_id !== config.applicationId)
      || typeof data.iat !== "number" || Math.abs(now / 1000 - data.iat) > 300 || typeof data.jti !== "string" || data.jti.length > 255
      || !equal(createHash("sha256").update(raw).digest("hex"), data.payload_hash ?? "")) return null;
    return data.jti;
  } catch { return null; }
}
export function verifyResend(raw: Buffer, headers: { id: string; timestamp: string; signature: string }, secret: string, now = Date.now()) {
  if (!secret || !headers.id || headers.id.length > 255 || !/^\d{10}$/.test(headers.timestamp) || Math.abs(now / 1000 - Number(headers.timestamp)) > 300 || headers.signature.length > 4096) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.`).update(raw).digest("base64");
  return headers.signature.split(" ").some(value => value.startsWith("v1,") && equal(value.slice(3), expected));
}
