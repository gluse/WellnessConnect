import { randomUUID, createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { billingAccounts, billingOperations, billingSubscriptions, billingEvents, billingInvoices, providerSubscriptions } from "../../shared/schema";
import { BillingError, type Authority, type Binding, type BillingSnapshot } from "./contracts";
import type { BillingDatabase } from "./repository";
import type { createStripeBillingAdapter } from "./stripe";
import type { createLifecycleRepository } from "./lifecycle";
import type { ServiceAudit } from "./service";
import { reconcileBilling } from "./reconcile";

type Adapter = ReturnType<typeof createStripeBillingAdapter>;
type Lifecycle = ReturnType<typeof createLifecycleRepository>;
export type StripeEnvelope = { eventId: string; eventType: string; objectId: string; occurredAt: number;
  customerId: string | null; subscriptionId: string | null; operationId: string | null; chargeId: string | null };
const reference = (value: unknown): string | null => typeof value === "string" ? value : value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : null;
const checkoutEvents = new Set(["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
const subscriptionEvents = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
const invoiceEvents = new Set(["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required", "invoice.updated"]);
/** Called only after SDK verification. External metadata remains a lookup hint, never authority. */
export function normalizeStripeEvent(event: Stripe.Event): StripeEnvelope | null {
  if (!checkoutEvents.has(event.type) && !subscriptionEvents.has(event.type) && !invoiceEvents.has(event.type) &&
    event.type !== "charge.refunded" && event.type !== "charge.dispute.created") return null;
  const object = event.data.object as unknown as Record<string, unknown>;
  const parent = object.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  const metadata = object.metadata as Record<string, unknown> | undefined;
  const operation = checkoutEvents.has(event.type) ? object.client_reference_id ?? metadata?.operation_id : null;
  const objectId = reference(object);
  if (!objectId) throw new BillingError("UNTRUSTED_PROVIDER");
  return { eventId: event.id, eventType: event.type, objectId, occurredAt: event.created * 1000,
    customerId: reference(object.customer), subscriptionId: subscriptionEvents.has(event.type) ? objectId
      : reference(object.subscription ?? parent?.subscription_details?.subscription),
    operationId: typeof operation === "string" && /^[a-f0-9-]{36}$/.test(operation) ? operation : null,
    chargeId: event.type === "charge.refunded" ? objectId : event.type === "charge.dispute.created" ? reference(object.charge) : null };
}

export function createStripeInbox(db: BillingDatabase, authority: Authority, audit: ServiceAudit, now: () => number) {
  return {
    async ingest(envelope: StripeEnvelope) {
      const fingerprint = createHash("sha256").update(JSON.stringify([envelope.eventId, envelope.eventType,
        envelope.objectId, envelope.occurredAt, envelope.customerId, envelope.subscriptionId, envelope.operationId, envelope.chargeId])).digest("hex");
      return db.transaction(async tx => {
        const [operation] = envelope.operationId ? await tx.select().from(billingOperations).where(and(eq(billingOperations.id, envelope.operationId),
          eq(billingOperations.provider, authority.provider), eq(billingOperations.merchantAccount, authority.merchantAccount),
          eq(billingOperations.mode, authority.mode), eq(billingOperations.kind, "checkout"))) : [];
        if (operation?.remoteCheckoutId && operation.remoteCheckoutId !== envelope.objectId) throw new BillingError("BINDING_MISMATCH");
        let [account] = operation ? await tx.select().from(billingAccounts).where(eq(billingAccounts.id, operation.accountId))
          : envelope.customerId ? await tx.select().from(billingAccounts).where(and(eq(billingAccounts.provider, authority.provider),
            eq(billingAccounts.merchantAccount, authority.merchantAccount), eq(billingAccounts.mode, authority.mode), eq(billingAccounts.customerId, envelope.customerId))) : [];
        let chargeInvoice: typeof billingInvoices.$inferSelect | undefined;
        if (!account && envelope.chargeId) {
          [chargeInvoice] = await tx.select().from(billingInvoices).where(and(eq(billingInvoices.provider, authority.provider),
            eq(billingInvoices.merchantAccount, authority.merchantAccount), eq(billingInvoices.mode, authority.mode),
            eq(billingInvoices.paymentReference, envelope.chargeId)));
          if (chargeInvoice) [account] = await tx.select().from(billingAccounts).where(and(eq(billingAccounts.id, chargeInvoice.accountId),
            eq(billingAccounts.workspaceId, chargeInvoice.workspaceId), eq(billingAccounts.provider, authority.provider),
            eq(billingAccounts.merchantAccount, authority.merchantAccount), eq(billingAccounts.mode, authority.mode)));
        }
        let contract: typeof billingSubscriptions.$inferSelect | undefined;
        if (account) {
          await tx.select({ id: providerSubscriptions.id }).from(providerSubscriptions).where(eq(providerSubscriptions.id, account.workspaceId)).for("update");
          if (envelope.subscriptionId) [contract] = await tx.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.accountId, account.id),
            eq(billingSubscriptions.processorSubscriptionId, envelope.subscriptionId)));
          else if (envelope.chargeId) {
            const [invoice] = chargeInvoice ? [chargeInvoice] : await tx.select().from(billingInvoices).where(and(eq(billingInvoices.accountId, account.id), eq(billingInvoices.paymentReference, envelope.chargeId)));
            if (invoice) [contract] = await tx.select().from(billingSubscriptions).where(eq(billingSubscriptions.id, invoice.subscriptionId));
          }
        }
        const mapped = Boolean(operation || contract), id = randomUUID();
        const [inserted] = await tx.insert(billingEvents).values({ id, ...authority, accountId: account?.id ?? null,
          workspaceId: account?.workspaceId ?? null, operationId: operation?.id ?? null, eventId: envelope.eventId,
          eventType: envelope.eventType, objectId: checkoutEvents.has(envelope.eventType) ? envelope.objectId : contract?.processorSubscriptionId ?? envelope.objectId, fingerprint,
          state: mapped ? "pending" : "quarantined", failureCode: mapped ? null : "UNMAPPED_BINDING", occurredAt: new Date(envelope.occurredAt),
          receivedAt: new Date(now()), nextAttemptAt: new Date(now()) }).onConflictDoNothing({ target: [billingEvents.provider,
            billingEvents.merchantAccount, billingEvents.mode, billingEvents.eventId] }).returning({ id: billingEvents.id });
        if (!inserted) {
          const [old] = await tx.select().from(billingEvents).where(and(eq(billingEvents.provider, authority.provider),
            eq(billingEvents.merchantAccount, authority.merchantAccount), eq(billingEvents.mode, authority.mode), eq(billingEvents.eventId, envelope.eventId))).for("update");
          if (!old) throw new BillingError("CONFLICT");
          if (old.fingerprint === fingerprint) return old.id;
          await tx.update(billingEvents).set({ state: "quarantined", processedAt: null, failureCode: "IDENTITY_CONFLICT", leaseToken: null, leaseUntil: null }).where(eq(billingEvents.id, old.id));
          await audit(tx, { kind: "event.quarantined", workspaceId: old.workspaceId, reference: old.id }); return old.id;
        }
        if (contract) await tx.update(billingSubscriptions).set({ generation: contract.generation + 1, nextReconcileAt: new Date(now()) }).where(eq(billingSubscriptions.id, contract.id));
        await audit(tx, { kind: mapped ? "event.accepted" : "event.quarantined", workspaceId: account?.workspaceId ?? null, reference: id });
        return id;
      });
    },
    async pending(id: string) {
      const [event] = await db.select().from(billingEvents).where(and(eq(billingEvents.id, id), eq(billingEvents.provider, authority.provider),
        eq(billingEvents.merchantAccount, authority.merchantAccount), eq(billingEvents.mode, authority.mode)));
      return event && ["pending", "processing"].includes(event.state) ? event : null;
    },
    async contract(workspaceId: number, processorSubscriptionId: string) {
      const [contract] = await db.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.workspaceId, workspaceId),
        eq(billingSubscriptions.provider, authority.provider), eq(billingSubscriptions.merchantAccount, authority.merchantAccount),
        eq(billingSubscriptions.mode, authority.mode), eq(billingSubscriptions.processorSubscriptionId, processorSubscriptionId)));
      if (!contract) throw new BillingError("BINDING_MISMATCH"); return contract;
    },
    async finishCheckoutEvent(id: string) {
      // Conversion is already audited/idempotent; mark only a checkout event with a resolved local operation.
      await db.transaction(async tx => {
        const [initial] = await tx.select().from(billingEvents).where(eq(billingEvents.id, id));
        if (!initial?.workspaceId || !initial.operationId) throw new BillingError("BINDING_MISMATCH");
        await tx.select({ id: providerSubscriptions.id }).from(providerSubscriptions).where(eq(providerSubscriptions.id, initial.workspaceId)).for("update");
        const [operation] = await tx.select().from(billingOperations).where(eq(billingOperations.id, initial.operationId));
        if (!operation?.resolvedAt) return;
        await tx.update(billingEvents).set({ state: "processed", processedAt: new Date(now()), leaseToken: null, leaseUntil: null })
          .where(and(eq(billingEvents.id, id), inArray(billingEvents.state, ["pending", "processing"])));
      });
    },
  };
}

/** Trusted composition: webhook acceptance is durable before ANY Stripe retrieval.
 * An approved scheduler invokes process(id); nothing starts a worker or mounts routes here. */
export function createStripeDispatcher(deps: { adapter: Adapter; inbox: ReturnType<typeof createStripeInbox>;
  lifecycle: Lifecycle; authority: Authority; now(): number; ready(): boolean }) {
  async function reconcile(workspaceId: number, subscriptionId: string) {
    const contract = await deps.inbox.contract(workspaceId, subscriptionId);
    const binding: Binding = { ...deps.authority, workspaceId };
    return reconcileBilling(binding, { authority: deps.authority, offerReference: contract.approvedOfferRef,
      now: deps.now, policy: invoice => invoice.status === "paid" ? "grant" : "withhold",
      repository: deps.lifecycle.reconciliationFor(contract.id), provider: { async fetch() {
        const current = await deps.adapter.fetchSubscription(subscriptionId);
        if (current.subscription.metadata.offer_revision !== contract.approvedOfferRef) throw new BillingError("BINDING_MISMATCH");
        return { binding, processorSubscriptionId: subscriptionId, requestedOffer: contract.approvedOfferRef,
          currency: "EUR", interval: "month", evidenceComplete: true, invoices: current.invoices,
          state: ["canceled", "incomplete_expired"].includes(current.subscription.status) ? "ended"
            : current.subscription.status === "active" ? "running" : "attention",
          processorStatus: current.subscription.status, period: current.period, cancelAtPeriodEnd: current.subscription.cancel_at_period_end } satisfies BillingSnapshot;
      } },
    });
  }
  return {
    async webhook(raw: Uint8Array, signature: string) {
      if (!deps.ready()) throw new BillingError("UNAVAILABLE");
      const envelope = normalizeStripeEvent(deps.adapter.verify(raw, signature));
      if (envelope) await deps.inbox.ingest(envelope); // response only after durable insertion/audit
    },
    async process(eventId: string) {
      if (!deps.ready()) throw new BillingError("UNAVAILABLE");
      const event = await deps.inbox.pending(eventId);
      if (!event || event.workspaceId === null) return;
      if (checkoutEvents.has(event.eventType)) {
        const fact = await deps.adapter.retrieveCheckout(event.objectId);
        const session = fact.session;
        const subscription = typeof session.subscription === "object" ? session.subscription : null;
        const item = subscription?.items.data[0];
        await deps.lifecycle.resolveCheckout({ operationId: fact.operationId, sessionId: session.id,
          workspaceId: Number(fact.workspaceId), offerRevision: fact.offerRevision, mode: session.livemode ? "live" : "test",
          status: session.status, customerId: fact.customerId ?? null, subscriptionId: fact.subscriptionId ?? null,
          priceId: item?.price.id ?? null, processorStatus: subscription?.status ?? null,
          period: item ? { start: item.current_period_start * 1000, end: item.current_period_end * 1000 } : null }, event.id);
        if (fact.subscriptionId) await reconcile(event.workspaceId, fact.subscriptionId);
      } else await reconcile(event.workspaceId, event.objectId);
    },
    reconcile,
  };
}
