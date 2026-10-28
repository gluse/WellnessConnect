import assert from "node:assert/strict";
import { test } from "node:test";
import Stripe from "stripe";
import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { once } from "node:events";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.ts";
import { assertBillingOwner, assertManualGrantExpired } from "../server/billing/authorization.ts";
import { amountToMinor, createPricingService, assertCurrentOffer } from "../server/billing/pricing.ts";
import { startCheckout } from "../server/billing/checkout.ts";
import { createStripeBillingAdapter, STRIPE_API_VERSION } from "../server/billing/stripe.ts";
import { createBillingRouters } from "../server/billing/routes.ts";
import { createSelectedBillingService } from "../server/billing/service.ts";
import { createStripeDispatcher, createStripeInbox, normalizeStripeEvent } from "../server/billing/dispatcher.ts";
import { createLifecycleRepository } from "../server/billing/lifecycle.ts";
import { reconcileBilling } from "../server/billing/reconcile.ts";
import { createAuditContext } from "../server/audit/context.ts";
import { createAuditEvent, parseAuditEnvelope, auditEventExpiresAt } from "../server/audit/events.ts";

// Synthetic SDK/signature + scripted PG + in-process HTTP streams only. No dotenv, server/db,
// application startup, credentials, actual PostgreSQL, Stripe API or session store.
const actorId = "11111111-1111-4111-8111-111111111111", otherId = "22222222-2222-4222-8222-222222222222";
const oldOffer = "b0241900-0000-4000-8000-000000000001", newOffer = "b0241900-0000-4000-8000-000000000002";
const operationId = "55555555-5555-4555-8555-555555555555", accountId = "66666666-6666-4666-8666-666666666666";
const eventId = "77777777-7777-4777-8777-777777777777";
const now = Date.parse("2026-10-26T10:00:00.000Z"), end = now + 86400000;
const authority = { provider: "stripe", merchantAccount: "merchant-fixture", mode: "test" }, binding = { ...authority, workspaceId: 7 };
const offer = { reference: oldOffer, amountMinor: 1900, taxIncluded: true, currency: "EUR", interval: "month", quantity: 1, termsVersion: "v1" };
const code = expected => error => error?.code === expected;
const audit = async () => {};

function scriptedDb(replies = []) {
  const writes = []; let committed = 0, rollback = 0;
  const client = { async query(config, values) {
    const text = typeof config === "string" ? config : config.text;
    if (text === "begin") return { rows: [] };
    if (text === "commit") { committed++; return { rows: [] }; }
    if (text === "rollback") { rollback++; return { rows: [] }; }
    const selection = text.startsWith("select") ? text.slice(7, text.indexOf(" from "))
      : text.includes(" returning ") ? text.split(" returning ")[1] : null;
    if (!text.startsWith("select")) writes.push({ text, values });
    if (!selection) return { rows: [] };
    const rows = replies.shift(); assert.ok(rows, "scripted transport exhausted");
    const fields = [...selection.matchAll(/"([^\"]+)"/g)].map(match => match[1].replace(/_([a-z])/g, (_, char) => char.toUpperCase()));
    return { rows: rows.map(row => fields.map(field => row[field] ?? null)) };
  } };
  return { db: drizzle({ client, schema }), writes, get committed() { return committed; }, get rollback() { return rollback; } };
}
const setting = { singleton: true, currentOfferId: oldOffer, revision: 1, updatedBy: null, updatedAt: new Date(now) };
const offerRow = { id: oldOffer, version: 1, amountMinor: 1900, currency: "EUR", interval: "month", taxIncluded: true, issuedBy: null, createdAt: new Date(now) };
const workspace = { id: 7, userId: actorId, companyId: null, plan: "pro", proUntil: new Date(end), updatedBy: actorId, updatedAt: new Date(now) };
const user = { id: actorId, providerType: "individual" };

test("selected owner policy denies company admin, stale membership, wrong owner/personal target", () => {
  const record = { userId: actorId, providerType: "company", company: { id: 7, ownerId: actorId, membershipRole: "owner", active: true } };
  assert.doesNotThrow(() => assertBillingOwner(actorId, { kind: "company", id: 7 }, record));
  for (const company of [{ ...record.company, membershipRole: "admin" }, { ...record.company, membershipRole: null }, { ...record.company, ownerId: otherId }])
    assert.throws(() => assertBillingOwner(actorId, { kind: "company", id: 7 }, { ...record, company }), code("FORBIDDEN"));
  assert.throws(() => assertBillingOwner(actorId, { kind: "user", id: otherId }, record), code("FORBIDDEN"));
  assert.doesNotThrow(() => assertBillingOwner(actorId, { kind: "user", id: actorId }, record));
  assert.throws(() => assertBillingOwner(actorId, { kind: "company", id: 7 }, { ...record, company: { ...record.company, active: false } }, "checkout"), code("FORBIDDEN"));
  assert.doesNotThrow(() => assertBillingOwner(actorId, { kind: "company", id: 7 }, { ...record, company: { ...record.company, active: false } }, "portal"));
});

test("canonical editable EUR amount obeys verified Stripe EUR-settled minimum and8digit ceiling", () => {
  assert.equal(amountToMinor("19.00"), 1900); assert.equal(amountToMinor("0.50"), 50); assert.equal(amountToMinor("999999.99"), 99999999);
  for (const value of ["0.00", "0.01", "0.49", "19", "19,00", "019.00", "19.001", "1e2", 19, "1000000.00"])
    assert.throws(() => amountToMinor(value));
});

test("admin save is immutable local revision+CAS+audit only, no existing-contract mutation", async () => {
  const fixture = scriptedDb([[setting], [offerRow], [{ ...setting, currentOfferId: newOffer, revision: 2 }]]);
  const changes = [], service = createPricingService(fixture.db, id => id === actorId, async (_tx, ...value) => changes.push(value), () => now);
  const saved = await service.save(actorId, { amount: "25.00", expectedRevision: "1" });
  assert.deepEqual(saved, { amount: "25.00", revision: "2", currency: "EUR", interval: "month", taxIncluded: true });
  assert.equal(fixture.committed, 1); assert.equal(fixture.writes.length, 2); assert.equal(changes.length, 1);
  const noOp = scriptedDb([[setting], [offerRow]]);
  assert.equal((await createPricingService(noOp.db, () => true, audit, () => now).save(actorId, { amount: "19.00", expectedRevision: "1" })).revision, "1");
  assert.equal(noOp.writes.length, 0);
});

test("admin stale CAS/authorization/audit failure and revision exhaustion fail closed", async () => {
  const stale = scriptedDb([[{ ...setting, revision: 2 }], [offerRow]]);
  await assert.rejects(createPricingService(stale.db, () => true, audit, () => now).save(actorId, { amount: "20.00", expectedRevision: "1" }), code("CONFLICT"));
  assert.equal(stale.writes.length, 0);
  const denied = scriptedDb([]);
  await assert.rejects(createPricingService(denied.db, () => false, audit, () => now).save(actorId, { amount: "20.00", expectedRevision: "1" }), code("FORBIDDEN"));
  const failed = scriptedDb([[setting], [offerRow], [{ ...setting, revision: 2 }]]);
  await assert.rejects(createPricingService(failed.db, () => true, async () => { throw new Error("audit unavailable"); }, () => now)
    .save(actorId, { amount: "20.00", expectedRevision: "1" }), /audit unavailable/);
  assert.equal(failed.committed, 0); assert.equal(failed.rollback, 1);
  const exhausted = scriptedDb([[{ ...setting, revision: 2147483647 }], [offerRow]]);
  await assert.rejects(createPricingService(exhausted.db, () => true, audit, () => now).save(actorId, { amount: "20.00", expectedRevision: "2147483647" }), code("UNAVAILABLE"));
});

test("valid legacy or imported manual grant blocks checkout until exact expiry", async () => {
  const legacy = scriptedDb([[], [workspace]]);
  await assert.rejects(legacy.db.transaction(tx => assertManualGrantExpired(tx, 7, now)), code("MANUAL_GRANT_ACTIVE"));
  const grant = { startsAt: new Date(now - 1), endsAt: new Date(end), revokedAt: null };
  const imported = scriptedDb([[{ workspaceId: 7 }], [grant]]);
  await assert.rejects(imported.db.transaction(tx => assertManualGrantExpired(tx, 7, now)), code("MANUAL_GRANT_ACTIVE"));
  const expired = scriptedDb([[], [{ ...workspace, proUntil: new Date(now) }], []]);
  await expired.db.transaction(tx => assertManualGrantExpired(tx, 7, now));
});

test("price changed after quote is rejected transactionally before remote effect", async () => {
  let providerCalls = 0;
  const current = scriptedDb([[{ ...setting, currentOfferId: newOffer }], [{ ...offerRow, id: newOffer, amountMinor: 2500 }]]);
  await assert.rejects(startCheckout({ workspaceId: 7, idempotencyKey: "fixture-quote-0001", termsVersion: "v1", offerRevision: oldOffer }, {
    authority, offer, hostedOrigins: ["https://checkout.stripe.com"], authorize: async () => ({ actorId, binding }),
    repository: { async reserve() { await current.db.transaction(tx => assertCurrentOffer(tx, oldOffer)); throw new Error("unreachable"); } },
    provider: { async create() { providerCalls++; } },
  }), code("CONFLICT"));
  assert.equal(providerCalls, 0);
});

function stripeFixture() {
  const sdk = new Stripe("sk_test_synthetic_not_a_credential", { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 0 });
  const calls = [], mappingId = "88888888-8888-4888-8888-888888888888";
  let ready = true, newReady = true, mapped = false;
  const subscription = { id: "sub-1", customer: "cus-1", livemode: false, status: "active", metadata: { offer_revision: oldOffer }, cancel_at_period_end: false,
    items: { has_more: false, data: [{ quantity: 1, current_period_start: Math.floor(now / 1000), current_period_end: Math.floor(end / 1000),
      price: { id: "price-1", currency: "eur", tax_behavior: "inclusive", recurring: { interval: "month", interval_count: 1 } } }] } };
  const invoice = { id: "in-1", customer: "cus-1", currency: "eur", livemode: false, status: "paid", amount_due: 1900, amount_paid: 1900,
    post_payment_credit_notes_amount: 0, pre_payment_credit_notes_amount: 0, discounts: [],
    lines: { has_more: false, data: [{ quantity: 1, subscription: "sub-1", currency: "eur", period: { start: now / 1000, end: end / 1000 },
      pricing: { price_details: { price: "price-1" } }, parent: { subscription_item_details: { proration: false } } }] },
    payments: { has_more: false, data: [{ status: "paid", amount_paid: 1900, payment: { type: "payment_intent", payment_intent: "pi-1" } }] } };
  const charge = { id: "ch-1", customer: "cus-1", currency: "eur", livemode: false, status: "succeeded", amount_refunded: 0, disputed: false, refunded: false };
  const client = { webhooks: sdk.webhooks,
    prices: { async create(body, options) { calls.push(["price", body, options]); return { id: "price-1", livemode: false, ...body }; } },
    checkout: { sessions: { async create(body, options) { calls.push(["checkout", body, options]); return { id: "cs-1", livemode: false,
      mode: "subscription", client_reference_id: body.client_reference_id, customer: body.customer ?? null, url: "https://checkout.stripe.com/session" }; },
    async retrieve() { calls.push(["retrieve"]); return { id: "cs-1", livemode: false, mode: "subscription", status: "complete", client_reference_id: operationId,
      metadata: { workspace_id: "7", offer_revision: oldOffer }, customer: "cus-1", subscription }; } } },
    billingPortal: { configurations: { async retrieve() { return { id: "bpc-fixture", livemode: false, active: true, application: null, features: { subscription_update: { enabled: false }, payment_method_update: { enabled: true }, subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" } } }; } }, sessions: { async create(body) { calls.push(["portal", body]); return { url: "https://billing.stripe.com/session" }; } } },
    subscriptions: { async retrieve() { return subscription; } }, invoices: { async list() { return { has_more: false, data: [invoice] }; } },
    paymentIntents: { async retrieve() { return { status: "succeeded", livemode: false, latest_charge: charge }; } }, charges: { async retrieve() { return charge; } },
  };
  const mappings = { async reserve() { return { id: mappingId, priceId: mapped ? "price-1" : null, fresh: !mapped }; },
    async complete() { mapped = true; }, async unknown() { calls.push(["unknown"]); } };
  const config = { authority, ready: () => ready, newCheckoutsReady: () => newReady, returnOrigin: "https://app.fixture.test", webhookSecret: "whsec_synthetic",
    portalConfigurationId: "bpc-fixture", automaticTaxEnabled: false, now: () => now };
  return { client, config, calls, mappings, subscription, invoice, charge, adapter: createStripeBillingAdapter(client, mappings, config),
    get sdk() { return sdk; }, set ready(value) { ready = value; }, set newReady(value) { newReady = value; } };
}

test("Stripe18 adapter creates inclusive monthly price lazily, reuses customer and fixed return path", async () => {
  const fixture = stripeFixture();
  await fixture.adapter.checkout.create({ operationId, binding, offer, customerId: "cus-1" });
  const price = fixture.calls.find(call => call[0] === "price"), checkout = fixture.calls.find(call => call[0] === "checkout");
  assert.equal(price[1].unit_amount, 1900); assert.equal(price[1].tax_behavior, "inclusive"); assert.equal(price[1].recurring.interval, "month");
  assert.equal(checkout[1].customer, "cus-1"); assert.equal(checkout[2].idempotencyKey, operationId);
  assert.equal(checkout[1].success_url, "https://app.fixture.test/my-services/settings/billing?billing_return=1");
  assert.equal(checkout[1].allow_promotion_codes, false);
  await fixture.adapter.checkout.create({ operationId, binding, offer, customerId: "cus-1" });
  assert.equal(fixture.calls.filter(call => call[0] === "price").length, 1);
});

test("stop-new-checkout preserves existing-subscriber portal/retrieval and rejects wrong customer", async () => {
  const fixture = stripeFixture(); fixture.newReady = false;
  await assert.rejects(fixture.adapter.checkout.create({ operationId, binding, offer }), code("UNAVAILABLE"));
  await fixture.adapter.portal("cus-1"); await fixture.adapter.retrieveCheckout("cs-1");
  assert.equal(fixture.calls.some(call => call[0] === "portal"), true);
  fixture.newReady = true;
  fixture.client.checkout.sessions.create = async body => ({ id: "cs-1", livemode: false, mode: "subscription", client_reference_id: body.client_reference_id,
    customer: "wrong-customer", url: "https://checkout.stripe.com/session" });
  await assert.rejects(fixture.adapter.checkout.create({ operationId, binding, offer, customerId: "cus-1" }), code("UNTRUSTED_PROVIDER"));
});

test("SDK raw signature verifies exact bytes/timestamp/mode and rejects Connect events", () => {
  const fixture = stripeFixture();
  const event = { id: "evt-1", object: "event", livemode: false, created: now / 1000, type: "invoice.paid", data: { object: { id: "in-1" } } };
  const signed = value => { const payload = JSON.stringify(value); return { payload, header: fixture.sdk.webhooks.generateTestHeaderString({ payload, secret: "whsec_synthetic", timestamp: now / 1000 }) }; };
  const valid = signed(event);
  assert.equal(fixture.adapter.verify(Buffer.from(valid.payload), valid.header).id, "evt-1");
  assert.throws(() => fixture.adapter.verify(Buffer.from(valid.payload + " "), valid.header), code("UNTRUSTED_PROVIDER"));
  for (const patch of [{ livemode: true }, { account: "acct-other" }]) {
    const value = signed({ ...event, ...patch }); assert.throws(() => fixture.adapter.verify(Buffer.from(value.payload), value.header), code("BINDING_MISMATCH"));
  }
  const expired = fixture.sdk.webhooks.generateTestHeaderString({ payload: valid.payload, secret: "whsec_synthetic", timestamp: now / 1000 - 301 });
  assert.throws(() => fixture.adapter.verify(Buffer.from(valid.payload), expired), code("UNTRUSTED_PROVIDER"));
});

test("paid invoice uses service line period and actual charge evidence; exceptions never fabricate zero", async () => {
  const fixture = stripeFixture();
  const fetched = await fixture.adapter.fetchSubscription("sub-1");
  assert.equal(fetched.invoices[0].amountPaid, "1900"); assert.equal(fetched.invoices[0].paymentReference, "ch-1");
  assert.equal(fetched.invoices[0].exceptionsReviewed, true); assert.equal(fetched.invoices[0].amountRefunded, "0");
  fixture.charge.amount_refunded = 100;
  await assert.rejects(fixture.adapter.fetchSubscription("sub-1"), code("POLICY_REVIEW"));
  fixture.charge.amount_refunded = 0; fixture.charge.disputed = true;
  await assert.rejects(fixture.adapter.fetchSubscription("sub-1"), code("POLICY_REVIEW"));
});

test("manual-only billing remains none, independently confirmed effective access is true", async () => {
  const fixture = scriptedDb([[user], [workspace], [setting], [offerRow], [], [], [], []]);
  const service = createSelectedBillingService(fixture.db, { authority, now: () => now, newCheckoutsReady: () => true,
    terms: { version: "v1", text: "Monthly terms", taxDisclosure: "Tax included" }, audit, provider: {}, hostedOrigins: [], portal: async () => ({ url: "" }) });
  const status = await service.status(actorId, { kind: "user", id: actorId });
  assert.equal(status.state, "none"); assert.equal(status.effectiveAccess.hasPro, true);
  assert.equal(status.capabilities.checkout, false); assert.equal(status.unavailableReason, "manual_grant");
});

test("existing contract renewal keeps its old offer after admin publishes a new price", async () => {
  let committed;
  const lease = { binding, processorSubscriptionId: "sub-1", offerReference: oldOffer, generation: 1, revision: 1,
    token: operationId, expiresAt: now + 30000 };
  const result = await reconcileBilling(binding, { authority, offerReference: newOffer, now: () => now,
    policy: invoice => invoice.status === "paid" ? "grant" : "withhold", repository: { async claim() { return lease; }, async commit(_lease, value) { committed = value; return true; } },
    provider: { async fetch() { return { binding, processorSubscriptionId: "sub-1", requestedOffer: oldOffer, currency: "EUR", interval: "month", evidenceComplete: true,
      invoices: [{ processorInvoiceId: "in-old-renewal", status: "paid", period: { start: now - 1, end } }] }; } } });
  assert.equal(result, "committed"); assert.equal(committed.snapshot.requestedOffer, oldOffer); assert.equal(committed.coverage.proUntil, end);
});

test("real conversion refuses wrong historical customer before resolving checkout", async () => {
  const operation = { id: operationId, ...binding, accountId, kind: "checkout", approvedOfferRef: oldOffer, remoteCheckoutId: "cs-1", resolvedAt: null };
  const fixture = scriptedDb([[operation], [workspace], [operation], [{ id: accountId, customerId: "cus-previous" }]]);
  const lifecycle = createLifecycleRepository(fixture.db, { authority, now: () => now, sourcesReady: () => false, isAdmin: () => false, audit });
  await assert.rejects(lifecycle.resolveCheckout({ operationId, sessionId: "cs-1", workspaceId: 7, offerRevision: oldOffer, mode: "test", status: "complete",
    customerId: "cus-different", subscriptionId: "sub-1", priceId: "price-1", processorStatus: "active", period: { start: now, end } }), code("BINDING_MISMATCH"));
  assert.equal(fixture.writes.length, 0); assert.equal(fixture.rollback, 1);
});

test("customerless dispute resolves only persisted authority-scoped charge invoice binding", async () => {
  const envelope = normalizeStripeEvent({ id: "evt-dispute", type: "charge.dispute.created", created: now / 1000,
    data: { object: { id: "dp-1", charge: "ch-1" } } });
  assert.equal(envelope.customerId, null); assert.equal(envelope.chargeId, "ch-1");
  const fixture = scriptedDb([[{ ...binding, accountId, subscriptionId: operationId, paymentReference: "ch-1" }],
    [{ id: accountId, ...binding, customerId: "cus-1" }], [{ id: 7 }], [{ id: operationId, processorSubscriptionId: "sub-1", generation: 1 }], [{ id: eventId }]]);
  const changes = [];
  const inbox = createStripeInbox(fixture.db, authority, async (_tx, change) => changes.push(change), () => now);
  const acceptedId = await inbox.ingest(envelope);
  assert.match(acceptedId, /^[a-f0-9-]{36}$/); assert.equal(changes[0].reference, acceptedId);
  assert.equal(changes[0].kind, "event.accepted");
  assert.equal(changes[0].workspaceId, 7); assert.equal(fixture.committed, 1);
});

test("real source reconciliation rejects stale revision and rolls back invoice/projection on audit failure", async () => {
  const lease = { binding, processorSubscriptionId: "sub-1", generation: 1, revision: 1, token: operationId, expiresAt: now + 30000, offerReference: oldOffer };
  const contract = { id: accountId, ...binding, accountId, processorSubscriptionId: "sub-1", generation: 1, revision: 1,
    leaseToken: operationId, leaseUntil: new Date(now + 30000), approvedOfferRef: oldOffer };
  const invoice = { processorInvoiceId: "in-1", status: "paid", period: { start: now - 1, end }, currency: "EUR", amountDue: "1900", amountPaid: "1900",
    amountRefunded: "0", paymentReference: "ch-1", refundReferences: [], disputeReferences: [], exceptionsReviewed: true };
  const result = { observedAt: now, coverage: { proUntil: end, nextChangeAt: end }, snapshot: { binding, processorSubscriptionId: "sub-1", requestedOffer: oldOffer,
    currency: "EUR", interval: "month", evidenceComplete: true, invoices: [invoice], state: "running", processorStatus: "active", period: invoice.period, cancelAtPeriodEnd: false } };
  const stale = scriptedDb([[workspace], [{ ...contract, revision: 2 }]]);
  const settings = { authority, now: () => now, sourcesReady: () => true, isAdmin: () => true, audit };
  assert.equal(await createLifecycleRepository(stale.db, settings).reconciliationFor(accountId).commit(lease, result), false);
  assert.equal(stale.writes.length, 0);
  const failed = scriptedDb([[workspace], [contract], [{ workspaceId: 7 }], [{ id: eventId }], [],
    [{ ...invoice, periodStart: new Date(now - 1), periodEnd: new Date(end) }]]);
  await assert.rejects(createLifecycleRepository(failed.db, { ...settings, audit: async () => { throw new Error("capture unavailable"); } })
    .reconciliationFor(accountId).commit(lease, result), /capture unavailable/);
  assert.equal(failed.committed, 0); assert.equal(failed.rollback, 1);
});

test("manual revocation returns remaining paid coverage without canceling/repricing contract", async () => {
  const grant = { id: eventId, workspaceId: 7, revokedAt: null };
  const fixture = scriptedDb([[workspace], [{ workspaceId: 7 }], [grant], [], [{ status: "paid", amountRefunded: "0", refundReferences: [], disputeReferences: [],
    periodStart: new Date(now - 1), periodEnd: new Date(end) }]]);
  const effective = await createLifecycleRepository(fixture.db, { authority, now: () => now, sourcesReady: () => true,
    isAdmin: id => id === actorId, audit }).revokeManualGrant(actorId, 7, eventId);
  assert.equal(effective.proUntil, end); assert.equal(fixture.committed, 1);
});

test("trusted dispatcher accepts durable signature envelope before provider retrieval, then converts/reconciles", async () => {
  const fixture = stripeFixture(); let received, converted, result, retrieves = 0;
  const event = { id: "evt-1", livemode: false, created: now / 1000, type: "checkout.session.completed", data: { object: {
    id: "cs-1", customer: "cus-1", subscription: "sub-1", client_reference_id: operationId } } };
  fixture.adapter.verify = () => event;
  const original = fixture.adapter.retrieveCheckout; fixture.adapter.retrieveCheckout = async value => { retrieves++; return original(value); };
  const dispatcher = createStripeDispatcher({ adapter: fixture.adapter, authority, now: () => now, ready: () => true,
    inbox: { async ingest(value) { received = value; }, async pending() { return { id: eventId, workspaceId: 7, eventType: event.type, objectId: "cs-1" }; },
      async finishCheckoutEvent() {}, async contract() { return { id: accountId, approvedOfferRef: oldOffer }; } },
    lifecycle: { async resolveCheckout(value) { converted = value; }, reconciliationFor() { return {
      async claim() { return { binding, processorSubscriptionId: "sub-1", offerReference: oldOffer, generation: 1, revision: 1, token: operationId, expiresAt: now + 30000 }; },
      async commit(_lease, value) { result = value; return true; } }; } } });
  await dispatcher.webhook(Buffer.from("verified fixture"), "signature");
  assert.equal(received.operationId, operationId); assert.equal(retrieves, 0);
  await dispatcher.process(eventId);
  assert.equal(converted.customerId, "cus-1"); assert.equal(result.snapshot.requestedOffer, oldOffer); assert.equal(result.coverage.proUntil, end);
});

test("billing audit actors/scopes/outcomes are explicit and existing expiry remains365days", () => {
  const base = { actor: { kind: "service", serviceId: "billing-worker" }, scope: { kind: "personal", workspaceId: actorId },
    target: { type: "billing_subscription", id: accountId }, source: { application: "fitsmytime", environment: "test", component: "billing" },
    requestId: eventId, operationId };
  const emit = (context = base, action = { eventName: "billing.subscription_reconciled.v1", outcome: "succeeded", changes: [] }) =>
    createAuditEvent(createAuditContext(context), action, { now: () => new Date(now), newId: () => eventId });
  const valid = emit(); assert.equal(valid.envelope.retentionClass, "B");
  assert.equal(Date.parse(auditEventExpiresAt(valid.envelope)) - now, 365 * 86400000);
  assert.deepEqual(parseAuditEnvelope(valid.envelope), valid.envelope);
  for (const patch of [{ actor: { kind: "anonymous" } }, { scope: { kind: "global" } }, { target: { type: "billing_operation", id: operationId } },
    { scope: { kind: "company", workspaceId: "9999999999" } }]) assert.throws(() => emit({ ...base, ...patch }));
  assert.throws(() => emit(base, { eventName: "billing.subscription_reconciled.v1", outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT", changes: [] }));
  const quarantine = emit({ ...base, scope: { kind: "unknown" }, target: { type: "billing_event", id: eventId } },
    { eventName: "billing.event_quarantined.v1", outcome: "rejected", reasonCode: "CONFLICT", changes: [] });
  assert.equal(quarantine.envelope.retentionClass, "S");
});

test("readiness-gated HTTP factories reject before auth/DB and strict mutations require origin/offer revision", async () => {
  let ready = false, authenticated = 0, read = 0;
  const noop = (_req, _res, next) => next();
  const app = express();
  const routers = createBillingRouters({ ready: () => ready, newCheckoutsReady: () => true, adminReady: () => ready,
    authenticate(req, res, next) { authenticated++; if (!req.get("x-fixture-auth")) return res.status(401).json({}); req.user = { claims: { sub: actorId } }; next(); },
    requireAdmin: noop, rateLimit: noop, origin: "https://app.fixture.test", selectedTarget: () => ({ kind: "user", id: actorId }),
    service: { async status() { read++; return { state: "none" }; }, async checkout() { return {}; }, async portal() { return {}; } },
    pricing: { async read() { return {}; }, async save() { return {}; } }, async webhook() {} });
  app.use("/api/billing", routers.browser); app.use("/api/admin/billing", routers.administration);
  async function request(path, options = {}) {
    const socket = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } });
    const req = new IncomingMessage(socket); req.url = path; req.method = options.method ?? "GET";
    req.headers = Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    req.body = options.body ? JSON.parse(options.body) : undefined;
    const res = new ServerResponse(req); res.assignSocket(socket); const done = once(res, "finish");
    app.handle(req, res); await done; socket.destroy();
    return { status: res.statusCode, headers: { get: name => res.getHeader(name) } };
  }
  {
    assert.equal((await request(`/api/billing/subscription?kind=user&id=${actorId}`)).status, 503);
    assert.equal(authenticated, 0); assert.equal(read, 0); ready = true;
    assert.equal((await request(`/api/billing/subscription?kind=user&id=${actorId}`)).status, 401);
    const headers = { "x-fixture-auth": "yes", "Content-Type": "application/json" };
    assert.equal((await request(`/api/billing/checkout`, { method: "POST", headers, body: "{}" })).status, 403);
    headers.Origin = "https://app.fixture.test";
    assert.equal((await request(`/api/billing/checkout`, { method: "POST", headers, body: JSON.stringify({ target: { kind: "user", id: actorId }, termsVersion: "v1", idempotencyKey: "fixture-request-0001", amount: 1 }) })).status, 400);
    const response = await request(`/api/billing/subscription?kind=user&id=${actorId}`, { headers });
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(read, 1);
  }
});
