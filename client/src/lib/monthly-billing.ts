import { z } from "zod";
import { subscriptionTargetSchema, type SubscriptionTarget } from "@shared/storefront";

const instant = z.string().datetime({ offset: true }).nullable();
const text = z.string().trim().min(1).max(2000);
export const monthlyBillingStatusSchema = z.object({
  target: subscriptionTargetSchema,
  state: z.enum(["none", "pending", "active", "payment_failed", "action_required", "canceled", "expired"]),
  manualUntil: instant, paidThrough: instant,
  effectiveAccess: z.object({ hasPro: z.boolean(), until: instant }).strict(),
  cancelAtPeriodEnd: z.boolean(), operation: z.enum(["none", "pending", "unknown", "unavailable"]),
  unavailableReason: z.enum(["manual_grant", "not_ready"]).nullable(),
  capabilities: z.object({ checkout: z.boolean(), manage: z.boolean(), recover: z.boolean() }).strict(),
  offer: z.object({
    amount: z.string().regex(/^(?:0|[1-9]\d{0,5})\.\d{2}$/)
      .refine(value => value.split(".")[0] !== "0" || value.split(".")[1] >= "50"), currency: z.literal("EUR"), interval: z.literal("month"),
    taxDisclosure: text, termsText: text, termsVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
    offerRevision: z.string().uuid(),
  }).strict().nullable(),
}).strict().refine(value => !value.effectiveAccess.hasPro || value.effectiveAccess.until !== null, "Confirmed Pro access needs an expiry");
export type MonthlyBillingStatus = z.infer<typeof monthlyBillingStatusSchema>;
// actorId scopes local state only. The server MUST derive the actor from its verified session.
export type BillingScope = { actorId: string; target: SubscriptionTarget };
export type BillingClientCode = "unauthorized" | "denied" | "unavailable" | "invalid" | "conflict";
export class BillingClientError extends Error {
  constructor(readonly code: BillingClientCode) { super(code); }
}
// Deliberately injected: no runtime routes, vendor, permissions or price are enabled here.
// A future HTTP adapter must bind the authenticated actor/workspace and use no-store responses.
export interface MonthlyBillingTransport {
  read(scope: BillingScope, signal: AbortSignal): Promise<unknown>;
  checkout(scope: BillingScope, input: { termsVersion: string; offerRevision: string; idempotencyKey: string }, signal: AbortSignal): Promise<unknown>;
  portal(scope: BillingScope, signal: AbortSignal): Promise<unknown>;
  readonly hostedOrigins: readonly string[];
}
export function sameBillingTarget(a: SubscriptionTarget, b: SubscriptionTarget) {
  return a.kind === b.kind && a.id === b.id;
}
export function parseBillingStatus(value: unknown, target: SubscriptionTarget): MonthlyBillingStatus {
  const parsed = monthlyBillingStatusSchema.safeParse(value);
  if (!parsed.success || !sameBillingTarget(parsed.data.target, target)) throw new BillingClientError("invalid");
  if (parsed.data.effectiveAccess.hasPro && Date.parse(parsed.data.effectiveAccess.until!) <= Date.now()) throw new BillingClientError("invalid");
  return parsed.data;
}
export function parseHostedResult(value: unknown, target: SubscriptionTarget, origins: readonly string[]): string | null {
  const parsed = z.discriminatedUnion("state", [
    z.object({ state: z.literal("pending"), target: subscriptionTargetSchema }).strict(),
    z.object({ state: z.literal("redirect"), target: subscriptionTargetSchema, url: z.string().max(4096) }).strict(),
  ]).safeParse(value);
  if (!parsed.success || !sameBillingTarget(parsed.data.target, target)) throw new BillingClientError("invalid");
  if (parsed.data.state === "pending") return null;
  let url: URL;
  try { url = new URL(parsed.data.url); } catch { throw new BillingClientError("invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || !origins.some(origin => {
    try { const allowed = new URL(origin); return allowed.protocol === "https:" && allowed.origin === origin && url.origin === origin; }
    catch { return false; }
  })) throw new BillingClientError("invalid");
  return url.href;
}
