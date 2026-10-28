import type Stripe from "stripe";
import { billingReturnOrigin } from "./origin";
import { BillingError, type Authority, type Binding, type MonthlyOffer } from "./contracts";
import type { CheckoutProvider } from "./checkout";
import type { PriceMappingRepository } from "./pricing";

export const STRIPE_API_VERSION = "2025-06-30.basil" as const;
export const STRIPE_HOSTED_ORIGINS = ["https://checkout.stripe.com", "https://billing.stripe.com"] as const;
type Client = Pick<Stripe, "prices" | "checkout" | "billingPortal" | "webhooks" | "subscriptions" | "invoices" | "charges" | "paymentIntents">;
const id = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
export interface StripeBillingConfig {
  authority: Authority; ready(): boolean; newCheckoutsReady(): boolean; returnOrigin: string; webhookSecret: string;
  portalConfigurationId: string; automaticTaxEnabled: boolean; now(): number; environment?: string; localSandbox?: boolean;
}
/** Explicit local-test fixture policy; no production cancellation/refund policy is selected. */
export function assertSandboxPortalConfiguration(portal: Stripe.BillingPortal.Configuration, configurationId: string) {
  // SDK18's pinned configuration schema omits retention. Reject any returned extension;
  // the separate sandbox setup acknowledgement also requires dashboard retention offers off.
  const retention = (portal.features.subscription_cancel as typeof portal.features.subscription_cancel & { retention?: unknown }).retention;
  if (portal.id !== configurationId || portal.livemode || !portal.active || portal.application || portal.features.subscription_update.enabled ||
    !portal.features.payment_method_update.enabled || !portal.features.subscription_cancel.enabled ||
    retention !== undefined && retention !== null ||
    portal.features.subscription_cancel.mode !== "at_period_end" || portal.features.subscription_cancel.proration_behavior !== "none")
    throw new BillingError("POLICY_REVIEW");
}
function requiredId(value: string | undefined): string { if (!value) throw new BillingError("UNTRUSTED_PROVIDER"); return value; }

/** Inject an SDK18 client configured for the pinned API version, maxNetworkRetries:0 and timeout.
 * No constructor, environment reads or network effects occur at module import. */
export function createStripeBillingAdapter(client: Client, mappings: PriceMappingRepository, config: StripeBillingConfig) {
  const origin = billingReturnOrigin(config.returnOrigin, { environment: config.environment ?? "production", mode: config.authority.mode, localSandbox: config.localSandbox === true });
  if (config.authority.provider !== "stripe")
    throw new BillingError("INVALID_INPUT");
  const guard = () => { if (!config.ready()) throw new BillingError("UNAVAILABLE"); };
  const verifyMode = (livemode: boolean) => {
    if (livemode !== (config.authority.mode === "live")) throw new BillingError("BINDING_MISMATCH");
  };
  async function price(offer: MonthlyOffer, workspaceId: number): Promise<{ priceId: string; mappingId: string }> {
    guard(); if (!config.newCheckoutsReady()) throw new BillingError("UNAVAILABLE");
    if (!offer.amountMinor || offer.taxIncluded !== true) throw new BillingError("INVALID_INPUT");
    const reserved = await mappings.reserve(offer, config.authority, workspaceId);
    if (reserved.priceId) return { priceId: reserved.priceId, mappingId: reserved.id };
    if (!reserved.fresh) throw new BillingError("UNAVAILABLE"); // Unknown remote creation requires reconciliation, never a new key.
    try {
      const created = await client.prices.create({ currency: "eur", unit_amount: offer.amountMinor,
        recurring: { interval: "month", interval_count: 1 }, tax_behavior: "inclusive",
        product_data: { name: "FitsMyTime Pro" }, metadata: { offer_revision: offer.reference, operation_id: reserved.id } },
      { idempotencyKey: reserved.id, maxNetworkRetries: 0, timeout: 10000 });
      verifyMode(created.livemode);
      if (created.currency !== "eur" || created.unit_amount !== offer.amountMinor || created.tax_behavior !== "inclusive" ||
        created.recurring?.interval !== "month" || created.recurring.interval_count !== 1) throw new BillingError("UNTRUSTED_PROVIDER");
      await mappings.complete(reserved.id, created.id, workspaceId);
      return { priceId: created.id, mappingId: reserved.id };
    } catch {
      await mappings.unknown(reserved.id, workspaceId).catch(() => {});
      throw new BillingError("UNAVAILABLE");
    }
  }
  const checkout: CheckoutProvider = { async create(input) {
    guard(); if (!config.newCheckoutsReady()) throw new BillingError("UNAVAILABLE");
    if (input.binding.provider !== config.authority.provider || input.binding.merchantAccount !== config.authority.merchantAccount ||
      input.binding.mode !== config.authority.mode) throw new BillingError("BINDING_MISMATCH");
    const { priceId } = await price(input.offer, input.binding.workspaceId);
    const metadata = { operation_id: input.operationId, workspace_id: String(input.binding.workspaceId), offer_revision: input.offer.reference };
    const session = await client.checkout.sessions.create({ mode: "subscription", ui_mode: "hosted",
      client_reference_id: input.operationId, ...(input.customerId ? { customer: input.customerId } : {}), line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: false, automatic_tax: { enabled: config.automaticTaxEnabled },
      metadata, subscription_data: { metadata },
      success_url: `${origin.origin}/my-services/settings/billing?billing_return=1`,
      cancel_url: `${origin.origin}/my-services/settings/billing?billing_return=1` },
    { idempotencyKey: input.operationId, maxNetworkRetries: 0, timeout: 10000 });
    verifyMode(session.livemode);
    if (session.mode !== "subscription" || session.client_reference_id !== input.operationId || !session.url ||
      (input.customerId && id(session.customer) !== input.customerId))
      throw new BillingError("UNTRUSTED_PROVIDER");
    return { remoteCheckoutId: session.id, url: session.url };
  } };
  return {
    checkout,
    verify(raw: Uint8Array, signature: string): Stripe.Event {
      if (!raw.byteLength || raw.byteLength > 262144 || !signature || signature.length > 2048) throw new BillingError("INVALID_INPUT");
      let event: Stripe.Event;
      try { event = client.webhooks.constructEvent(Buffer.from(raw), signature, config.webhookSecret, 300, undefined, config.now()); }
      catch { throw new BillingError("UNTRUSTED_PROVIDER"); }
      verifyMode(event.livemode);
      // This integration is for FitsMyTime's merchant account, never Connect events.
      if (event.account) throw new BillingError("BINDING_MISMATCH");
      return event;
    },
    async retrieveCheckout(sessionId: string) {
      guard();
      const session = await client.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] }, { maxNetworkRetries: 0, timeout: 10000 });
      verifyMode(session.livemode);
      if (session.mode !== "subscription") throw new BillingError("BINDING_MISMATCH");
      return { session, customerId: id(session.customer), subscriptionId: id(session.subscription),
        operationId: session.client_reference_id, offerRevision: session.metadata?.offer_revision,
        workspaceId: session.metadata?.workspace_id };
    },
    async portal(customerId: string, operationId?: string) {
      guard();
      if (!config.portalConfigurationId) throw new BillingError("UNAVAILABLE");
      // Verify the named existing configuration; never create or change its policy.
      const portal = await client.billingPortal.configurations.retrieve(config.portalConfigurationId, {}, { maxNetworkRetries: 0, timeout: 10000 });
      verifyMode(portal.livemode);
      assertSandboxPortalConfiguration(portal, config.portalConfigurationId);
      const session = await client.billingPortal.sessions.create({ customer: customerId,
        configuration: config.portalConfigurationId, return_url: `${origin.origin}/my-services/settings/billing?billing_return=1` },
      { ...(operationId ? { idempotencyKey: operationId } : {}), maxNetworkRetries: 0, timeout: 10000 });
      return { url: session.url, sessionId: session.id };
    },
    async fetchSubscription(subscriptionId: string) {
      guard();
      const deadline = config.now() + 25000;
      const requestOptions = () => {
        const remaining = deadline - config.now();
        if (remaining <= 0) throw new BillingError("UNAVAILABLE");
        return { maxNetworkRetries: 0, timeout: Math.min(10000, remaining) };
      };
      const subscription = await client.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] }, requestOptions());
      verifyMode(subscription.livemode);
      if (subscription.items.has_more || subscription.items.data.length !== 1) throw new BillingError("POLICY_REVIEW");
      const item = subscription.items.data[0], monthlyPrice = item.price;
      if (item.quantity !== 1 || monthlyPrice.currency !== "eur" || monthlyPrice.recurring?.interval !== "month" ||
        monthlyPrice.recurring.interval_count !== 1 || monthlyPrice.tax_behavior !== "inclusive") throw new BillingError("POLICY_REVIEW");
      const invoices = await client.invoices.list({ subscription: subscription.id, limit: 100, expand: ["data.payments"] }, requestOptions());
      // Bound work. Larger histories need a reviewed paginated adapter; never claim an incomplete snapshot is complete.
      if (invoices.has_more) throw new BillingError("UNAVAILABLE");
      const evidence = [];
      for (const invoice of invoices.data) {
        verifyMode(invoice.livemode);
        if (invoice.currency !== "eur" || id(invoice.customer) !== id(subscription.customer) || invoice.lines.has_more ||
          invoice.lines.data.length !== 1 || invoice.post_payment_credit_notes_amount || invoice.pre_payment_credit_notes_amount ||
          invoice.discounts?.length) throw new BillingError("POLICY_REVIEW");
        const line = invoice.lines.data[0];
        if (id(line.subscription ?? line.parent?.subscription_item_details?.subscription) !== subscription.id || line.currency !== "eur" || line.quantity !== 1 ||
          line.pricing?.price_details?.price !== monthlyPrice.id || line.parent?.subscription_item_details?.proration)
          throw new BillingError("POLICY_REVIEW");
        const numbers = [invoice.amount_due, invoice.amount_paid];
        if (numbers.some(value => !Number.isSafeInteger(value) || value < 0)) throw new BillingError("UNTRUSTED_PROVIDER");
        const payments = invoice.payments;
        if (payments?.has_more) throw new BillingError("UNAVAILABLE");
        const paid = payments?.data.filter(payment => payment.status === "paid") ?? [];
        let paymentReference: string | null = null, amountRefunded = "0";
        if (invoice.amount_paid > 0) {
          if (paid.length !== 1 || paid[0].amount_paid !== invoice.amount_paid) throw new BillingError("POLICY_REVIEW");
          let charge: Stripe.Charge;
          const payment = paid[0].payment;
          if (payment.type === "payment_intent") {
            const intent = await client.paymentIntents.retrieve(requiredId(id(payment.payment_intent)), { expand: ["latest_charge"] }, requestOptions());
            verifyMode(intent.livemode);
            if (intent.status !== "succeeded" || typeof intent.latest_charge !== "object" || !intent.latest_charge) throw new BillingError("POLICY_REVIEW");
            charge = intent.latest_charge;
          } else charge = await client.charges.retrieve(requiredId(id(payment.charge)), {}, requestOptions());
          verifyMode(charge.livemode);
          if (id(charge.customer) !== id(subscription.customer) || charge.currency !== "eur" || charge.status !== "succeeded" ||
            !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 ||
            charge.amount_refunded > 0 || charge.disputed || charge.refunded) throw new BillingError("POLICY_REVIEW");
          amountRefunded = String(charge.amount_refunded); paymentReference = charge.id;
        } else if (invoice.status === "paid") throw new BillingError("POLICY_REVIEW"); // Credits/trials/free invoices are outside this launch.
        evidence.push({ processorInvoiceId: requiredId(invoice.id), period: { start: line.period.start * 1000, end: line.period.end * 1000 },
          status: invoice.status === "paid" ? "paid" as const : "unpaid" as const, currency: "EUR" as const,
          amountDue: String(invoice.amount_due), amountPaid: String(invoice.amount_paid), amountRefunded, paymentReference,
          refundReferences: [], disputeReferences: [], exceptionsReviewed: true as const });
      }
      return { subscription, customerId: requiredId(id(subscription.customer)), priceId: monthlyPrice.id,
        period: { start: item.current_period_start * 1000, end: item.current_period_end * 1000 }, invoices: evidence };
    },
  };
}
