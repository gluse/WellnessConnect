import { z } from "zod";

const reference = z.string().trim().min(1).max(255);
const instant = z.number().int().min(0).max(8_640_000_000_000_000);
export const authoritySchema = z.object({
  provider: z.string().trim().min(1).max(64), merchantAccount: reference, mode: z.enum(["test", "live"]),
}).strict();
export const bindingSchema = authoritySchema.extend({ workspaceId: z.number().int().positive().max(2147483647) }).strict();
export type Authority = z.infer<typeof authoritySchema>;
export type Binding = z.infer<typeof bindingSchema>;
export const checkoutRequestSchema = z.object({
  workspaceId: bindingSchema.shape.workspaceId,
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  termsVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
  offerRevision: z.string().uuid().optional(),
}).strict();
export const offerSchema = z.object({
  reference, currency: z.literal("EUR"), interval: z.literal("month"), quantity: z.literal(1),
  termsVersion: checkoutRequestSchema.shape.termsVersion,
  amountMinor: z.number().int().min(1).max(99999999).optional(),
  taxIncluded: z.literal(true).optional(),
}).strict();
export type MonthlyOffer = z.infer<typeof offerSchema>;
export const operationSchema = z.object({
  id: z.string().uuid(), binding: bindingSchema, actorId: z.string().uuid(),
  idempotencyKey: checkoutRequestSchema.shape.idempotencyKey,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  requestedOffer: reference, termsVersion: checkoutRequestSchema.shape.termsVersion,
  state: z.enum(["reserved", "unknown", "completed", "failed"]),
  remoteCheckoutId: reference.nullable(),
  resolvedAt: instant.nullable(),
}).strict();
export type CheckoutOperation = z.infer<typeof operationSchema>;
export const periodSchema = z.object({ start: instant, end: instant }).strict()
  .refine(value => value.start < value.end, "Period must end after it starts");
export type Period = z.infer<typeof periodSchema>;
export const invoiceSchema = z.object({
  processorInvoiceId: reference, period: periodSchema,
  status: z.enum(["paid", "unpaid", "reversed"]),
  currency: z.literal("EUR").optional(),
  amountDue: z.string().regex(/^(0|[1-9]\d{0,17})$/).optional(), amountPaid: z.string().regex(/^(0|[1-9]\d{0,17})$/).optional(),
  amountRefunded: z.string().regex(/^(0|[1-9]\d{0,17})$/).optional(), paymentReference: reference.nullable().optional(),
  refundReferences: z.array(reference).max(100).optional(), disputeReferences: z.array(reference).max(100).optional(),
  exceptionsReviewed: z.literal(true).optional(),
}).strict();
export type InvoiceEvidence = z.infer<typeof invoiceSchema>;
export const snapshotSchema = z.object({
  binding: bindingSchema, processorSubscriptionId: reference,
  requestedOffer: reference, currency: z.literal("EUR"), interval: z.literal("month"),
  // Adapter must fetch a complete relevant period set, not one webhook payload.
  evidenceComplete: z.literal(true), invoices: z.array(invoiceSchema).max(1000),
  state: z.enum(["pending", "running", "attention", "ended"]).optional(), processorStatus: z.string().min(1).max(64).optional(),
  period: periodSchema.optional(), cancelAtPeriodEnd: z.boolean().optional(),
}).strict();
export type BillingSnapshot = z.infer<typeof snapshotSchema>;
export const leaseSchema = z.object({
  binding: bindingSchema, processorSubscriptionId: reference,
  generation: z.number().int().nonnegative(), revision: z.number().int().nonnegative(),
  token: z.string().uuid(), expiresAt: instant,
  offerReference: reference.optional(),
}).strict();
export type ReconciliationLease = z.infer<typeof leaseSchema>;
export const verifiedEventSchema = authoritySchema.extend({
  eventId: reference, eventType: z.string().min(1).max(128), customerId: reference,
  processorSubscriptionId: reference, occurredAt: instant,
}).strict();
export type VerifiedEvent = z.infer<typeof verifiedEventSchema>;

export class BillingError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "BINDING_MISMATCH" | "CONFLICT" |
    "UNAVAILABLE" | "POLICY_REVIEW" | "UNTRUSTED_PROVIDER" | "FORBIDDEN" | "MANUAL_GRANT_ACTIVE") {
    super(code); this.name = "BillingError";
  }
}
export function assertAuthority(actual: Authority, expected: Authority): void {
  if (actual.provider !== expected.provider || actual.merchantAccount !== expected.merchantAccount ||
    actual.mode !== expected.mode) throw new BillingError("BINDING_MISMATCH");
}
export function assertBinding(actual: Binding, expected: Binding): void {
  assertAuthority(actual, expected);
  if (actual.workspaceId !== expected.workspaceId) throw new BillingError("BINDING_MISMATCH");
}
