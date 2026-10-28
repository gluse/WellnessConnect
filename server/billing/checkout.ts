import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { assertAuthority, assertBinding, authoritySchema, bindingSchema, BillingError,
  checkoutRequestSchema, offerSchema, operationSchema,
  type Authority, type Binding, type CheckoutOperation, type MonthlyOffer } from "./contracts";

export interface CheckoutRepository {
  /** Atomic workspace+mode reservation and key/fingerprint conflict check; no network under lock.
   * A DB adapter must recheck actor authority inside that transaction before eventual cutover. */
  reserve(operation: CheckoutOperation): Promise<{ kind: "reserved" | "replay" | "busy"; operation: CheckoutOperation }>;
  /** Records hosted-session creation but leaves resolvedAt null and the checkout slot held. */
  complete(operationId: string, remoteCheckoutId: string): Promise<void>;
  /** Never release an unresolved slot after ambiguous remote/local failure. */
  markUnknown(operationId: string): Promise<void>;
  customer?(operationId: string): Promise<string | null>;
}
export interface CheckoutProvider {
  create(input: { operationId: string; binding: Binding; offer: MonthlyOffer; customerId?: string }): Promise<unknown>;
}
type Actor = { actorId: string; binding: Binding };
export interface CheckoutDependencies {
  authority: Authority;
  offer: MonthlyOffer;
  hostedOrigins: readonly string[];
  /** Trusted server policy; identity/membership/workspace selection must be fresh each call. */
  authorize(workspaceId: number): Promise<Actor>;
  repository: CheckoutRepository;
  provider: CheckoutProvider;
}
export type CheckoutResult = { status: "created"; operationId: string; url: string } |
  { status: "pending"; operationId: string; state: CheckoutOperation["state"] };

/** Dormant service: no route registration, environment reads, SQL or real provider. */
export async function startCheckout(input: unknown, deps: CheckoutDependencies): Promise<CheckoutResult> {
  const request = checkoutRequestSchema.parse(input);
  const offer = offerSchema.parse(deps.offer);
  const authority = authoritySchema.parse(deps.authority);
  if (request.termsVersion !== offer.termsVersion) throw new BillingError("CONFLICT");
  if (request.offerRevision && request.offerRevision !== offer.reference) throw new BillingError("CONFLICT");
  const actor = await deps.authorize(request.workspaceId);
  z.string().uuid().parse(actor.actorId);
  const binding = bindingSchema.parse(actor.binding);
  assertAuthority(binding, authority);
  if (binding.workspaceId !== request.workspaceId) throw new BillingError("BINDING_MISMATCH");
  const fingerprint = createHash("sha256").update(JSON.stringify([
    binding.workspaceId, binding.provider, binding.merchantAccount, binding.mode,
    offer.reference, offer.currency, offer.interval, offer.quantity, offer.termsVersion,
    offer.amountMinor ?? null, offer.taxIncluded ?? null,
  ])).digest("hex");
  const candidate: CheckoutOperation = { id: randomUUID(), binding, actorId: actor.actorId,
    idempotencyKey: request.idempotencyKey, fingerprint, requestedOffer: offer.reference,
    termsVersion: offer.termsVersion, state: "reserved", remoteCheckoutId: null, resolvedAt: null };
  const reserved = await deps.repository.reserve(candidate);
  const operation = operationSchema.parse(reserved.operation);
  assertBinding(operation.binding, binding);
  if (reserved.kind !== "reserved") {
    if (reserved.kind === "replay" && operation.fingerprint !== fingerprint) throw new BillingError("CONFLICT");
    return { status: "pending", operationId: operation.id, state: operation.state };
  }
  if (operation.id !== candidate.id || operation.fingerprint !== fingerprint || operation.actorId !== actor.actorId ||
    operation.state !== "reserved") throw new BillingError("CONFLICT");

  let result: { remoteCheckoutId: string; url: string };
  try {
    // No automatic retries: the stable operation ID is the provider idempotency key.
    const current = await deps.authorize(binding.workspaceId);
    assertBinding(bindingSchema.parse(current.binding), binding);
    if (current.actorId !== actor.actorId) throw new BillingError("BINDING_MISMATCH");
    const customerId = await deps.repository.customer?.(operation.id) ?? undefined;
    result = z.object({ remoteCheckoutId: z.string().min(1).max(255), url: z.string().max(4096) }).strict()
      .parse(await deps.provider.create({ operationId: operation.id, binding, offer, customerId }));
    await deps.repository.complete(operation.id, result.remoteCheckoutId);
  } catch {
    // A failed local completion can follow successful remote creation. Keep durable intent.
    await deps.repository.markUnknown(operation.id).catch(() => {});
    throw new BillingError("UNAVAILABLE");
  }
  let url: URL;
  try { url = new URL(result.url); } catch { throw new BillingError("UNTRUSTED_PROVIDER"); }
  if (url.protocol !== "https:" || url.username || url.password || !deps.hostedOrigins.includes(url.origin))
    throw new BillingError("UNTRUSTED_PROVIDER");
  const current = await deps.authorize(binding.workspaceId);
  assertBinding(bindingSchema.parse(current.binding), binding);
  if (current.actorId !== actor.actorId) throw new BillingError("BINDING_MISMATCH");
  return { status: "created", operationId: operation.id, url: url.href };
}
