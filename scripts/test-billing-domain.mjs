import assert from "node:assert/strict";
import { test } from "node:test";
import { startCheckout } from "../server/billing/checkout.ts";
import { coverageAt, invoiceCoverage } from "../server/billing/coverage.ts";
import { receiveBillingEvent } from "../server/billing/events.ts";
import { reconcileBilling } from "../server/billing/reconcile.ts";

// Only pure billing modules + in-memory adapters: no dotenv, server, auth, DB or network imports.
const authority = { provider: "fixture", merchantAccount: "merchant-a", mode: "live" };
const binding = { ...authority, workspaceId: 7 };
const actorId = "f4868c24-87f1-405b-bb82-6116a86662ba";
const otherActor = "33e0ec7c-86bd-4b40-8d03-1de69cce0214";
const offer = { reference: "approved-monthly", currency: "EUR", interval: "month", quantity: 1, termsVersion: "v1" };
const request = { workspaceId: 7, idempotencyKey: "fixture-request-0001", termsVersion: "v1" };
const hasCode = code => error => error?.code === code;
const paidOnly = invoice => invoice.status === "paid" ? "grant" : "withhold";

function checkoutFixture() {
  let operation, providerCalls = 0, authorizations = 0;
  const repository = {
    async reserve(candidate) {
      if (operation) {
        if (operation.idempotencyKey === candidate.idempotencyKey && operation.fingerprint !== candidate.fingerprint)
          throw Object.assign(new Error("conflict"), { code: "CONFLICT" });
        return { kind: operation.idempotencyKey === candidate.idempotencyKey ? "replay" : "busy", operation: structuredClone(operation) };
      }
      operation = structuredClone(candidate);
      return { kind: "reserved", operation: structuredClone(operation) };
    },
    async complete(id, remoteCheckoutId) { assert.equal(id, operation.id); operation = { ...operation, state: "completed", remoteCheckoutId }; },
    async markUnknown(id) { assert.equal(id, operation.id); if (operation.state !== "completed") operation.state = "unknown"; },
  };
  const deps = { authority, offer, hostedOrigins: ["https://checkout.fixture.test"], repository,
    async authorize() { authorizations++; return { actorId, binding }; },
    provider: { async create() { providerCalls++; return { remoteCheckoutId: "checkout-1", url: "https://checkout.fixture.test/session-secret" }; } } };
  return { deps, get operation() { return operation; }, get providerCalls() { return providerCalls; }, get authorizations() { return authorizations; } };
}

test("current interval extends across adjacency, never across an unpaid gap or future start", () => {
  assert.deepEqual(coverageAt([{ start: 10, end: 20 }, { start: 20, end: 30 }, { start: 40, end: 50 }], 15),
    { proUntil: 30, nextChangeAt: 30 });
  assert.deepEqual(coverageAt([{ start: 40, end: 50 }], 30), { proUntil: null, nextChangeAt: 40 });
  assert.deepEqual(coverageAt([{ start: 10, end: 20 }], 20), { proUntil: null, nextChangeAt: null });
  assert.equal(coverageAt([{ start: 10, end: 20 }], 10).proUntil, 20);
  assert.throws(() => coverageAt([{ start: 20, end: 20 }], 20));
  assert.throws(() => coverageAt([], NaN), hasCode("INVALID_INPUT"));
});

test("duplicate invoices never add time, conflicting evidence is rejected, policy is explicit", () => {
  const invoice = { processorInvoiceId: "invoice-1", period: { start: 10, end: 20 }, status: "paid" };
  assert.equal(invoiceCoverage([invoice, invoice], 15, paidOnly).proUntil, 20);
  assert.throws(() => invoiceCoverage([invoice, { ...invoice, status: "reversed" }], 15, paidOnly), hasCode("CONFLICT"));
  assert.equal(invoiceCoverage([{ ...invoice, status: "unpaid" }], 15, () => "grant").proUntil, null);
  assert.equal(invoiceCoverage([{ ...invoice, status: "reversed" }], 15, paidOnly).proUntil, null);
  assert.throws(() => invoiceCoverage([invoice], 15, () => "review"), hasCode("POLICY_REVIEW"));
});

test("checkout uses server offer and durable operation as remote idempotency reference", async () => {
  const fixture = checkoutFixture();
  let received;
  fixture.deps.provider.create = async value => { received = value; return { remoteCheckoutId: "checkout-1", url: "https://checkout.fixture.test/session-secret" }; };
  const result = await startCheckout(request, fixture.deps);
  assert.equal(result.status, "created");
  assert.equal(received.operationId, fixture.operation.id);
  assert.deepEqual(received.offer, offer);
  assert.equal(fixture.operation.state, "completed");
  assert.equal(fixture.authorizations, 3);
  assert.equal("url" in fixture.operation, false);
});

test("price, interval, redirect and unknown input are rejected before reservation/provider", async () => {
  const fixture = checkoutFixture();
  for (const extra of [{ amount: 1 }, { priceId: "browser-price" }, { interval: "year" }, { returnUrl: "https://evil.test" }])
    await assert.rejects(startCheckout({ ...request, ...extra }, fixture.deps));
  await assert.rejects(startCheckout({ ...request, termsVersion: "stale" }, fixture.deps), hasCode("CONFLICT"));
  assert.equal(fixture.operation, undefined);
  assert.equal(fixture.providerCalls, 0);
});

test("parallel/repeated checkout returns durable status without a second remote call or URL", async () => {
  const fixture = checkoutFixture();
  const results = await Promise.all([startCheckout(request, fixture.deps), startCheckout(request, fixture.deps),
    startCheckout({ ...request, idempotencyKey: "fixture-other-key1" }, fixture.deps)]);
  assert.equal(results.filter(result => result.status === "created").length, 1);
  assert.equal(fixture.providerCalls, 1);
  for (const result of results.filter(value => value.status === "pending")) assert.equal("url" in result, false);
  await assert.rejects(startCheckout(request, { ...fixture.deps, offer: { ...offer, reference: "different-offer" } }), hasCode("CONFLICT"));
  const later = await startCheckout({ ...request, idempotencyKey: "after-url-created1" }, fixture.deps);
  assert.equal(later.status, "pending"); assert.equal(fixture.providerCalls, 1);
  assert.equal(fixture.operation.resolvedAt, null);
});

test("remote timeout or local completion failure leaves reserved/unknown intent, with no automatic retry", async () => {
  for (const failCompletion of [false, true]) {
    const fixture = checkoutFixture();
    if (failCompletion) fixture.deps.repository.complete = async () => { throw new Error("DB unavailable"); };
    else fixture.deps.provider.create = async () => { throw new Error("secret provider error"); };
    await assert.rejects(startCheckout(request, fixture.deps), hasCode("UNAVAILABLE"));
    assert.equal(fixture.operation.state, "unknown");
    assert.equal((await startCheckout(request, fixture.deps)).status, "pending");
  }
});

test("authorization, account/mode and workspace mismatches prevent provider effects", async () => {
  for (const change of [{ workspaceId: 8 }, { mode: "test" }, { merchantAccount: "other" }]) {
    const fixture = checkoutFixture();
    fixture.deps.authorize = async () => ({ actorId, binding: { ...binding, ...change } });
    await assert.rejects(startCheckout(request, fixture.deps), hasCode("BINDING_MISMATCH"));
    assert.equal(fixture.operation, undefined);
    assert.equal(fixture.providerCalls, 0);
  }
  const fixture = checkoutFixture();
  fixture.deps.authorize = async () => { throw new Error("membership revoked"); };
  await assert.rejects(startCheckout(request, fixture.deps), /revoked/);
  assert.equal(fixture.providerCalls, 0);
});

test("actor revocation/transfer after remote success withholds hosted URL and preserves operation", async () => {
  const fixture = checkoutFixture();
  let calls = 0;
  fixture.deps.authorize = async () => ({ actorId: ++calls === 3 ? otherActor : actorId, binding });
  await assert.rejects(startCheckout(request, fixture.deps), hasCode("BINDING_MISMATCH"));
  assert.equal(fixture.operation.state, "completed");
  assert.equal(fixture.providerCalls, 1);
  assert.equal((await startCheckout(request, { ...fixture.deps, authorize: async () => ({ actorId: otherActor, binding }) })).status, "pending");
});

test("unsafe hosted capabilities never reach caller", async () => {
  for (const url of ["http://checkout.fixture.test/s", "https://checkout.fixture.test.evil.test/s", "https://user:pass@checkout.fixture.test/s"]) {
    const fixture = checkoutFixture();
    fixture.deps.provider.create = async () => ({ remoteCheckoutId: "checkout-1", url });
    await assert.rejects(startCheckout(request, fixture.deps), hasCode("UNTRUSTED_PROVIDER"));
    assert.equal(fixture.operation.state, "completed");
  }
});

function eventFixture() {
  const entries = new Map();
  let generation = 0, valid = true;
  const verified = { ...authority, eventId: "event-1", eventType: "invoice.updated", customerId: "customer-1", processorSubscriptionId: "subscription-1", occurredAt: 10 };
  const deps = { authority, allowedEventTypes: ["invoice.updated"],
    verifier: { async verify() { if (!valid) throw new Error("invalid signature"); return verified; } },
    repository: { async ingest(event) {
      const key = JSON.stringify([event.provider, event.merchantAccount, event.mode, event.eventId]);
      if (entries.has(key)) return entries.get(key) === event.fingerprint ? "duplicate" : "quarantined";
      entries.set(key, event.fingerprint); generation++; return "inserted";
    } } };
  return { deps, verified, set invalid(value) { valid = !value; }, get generation() { return generation; } };
}
const raw = new TextEncoder().encode('{"synthetic":true}');

test("verified intake deduplicates events, quarantines identity conflicts and rejects wrong authority", async () => {
  const fixture = eventFixture();
  assert.equal(await receiveBillingEvent(raw, "signature", fixture.deps), "inserted");
  assert.equal(await receiveBillingEvent(raw, "signature", fixture.deps), "duplicate");
  assert.equal(await receiveBillingEvent(new TextEncoder().encode("different serialization"), "signature", fixture.deps), "duplicate");
  fixture.verified.customerId = "conflicting-customer";
  assert.equal(await receiveBillingEvent(raw, "signature", fixture.deps), "quarantined");
  assert.equal(fixture.generation, 1);
  fixture.verified.mode = "test";
  await assert.rejects(receiveBillingEvent(raw, "signature", fixture.deps), hasCode("BINDING_MISMATCH"));
  assert.equal(fixture.generation, 1);
});

test("unverified, oversized and unsupported events cannot reach durable effects", async () => {
  const fixture = eventFixture();
  fixture.invalid = true;
  await assert.rejects(receiveBillingEvent(raw, "signature", fixture.deps), hasCode("UNTRUSTED_PROVIDER"));
  await assert.rejects(receiveBillingEvent(new Uint8Array(262145), "signature", fixture.deps), hasCode("INVALID_INPUT"));
  fixture.invalid = false;
  fixture.verified.eventType = "unsupported";
  assert.equal(await receiveBillingEvent(raw, "signature", fixture.deps), "unsupported");
  assert.equal(fixture.generation, 0);
  fixture.verified.eventType = "invoice.updated";
  fixture.deps.repository.ingest = async () => { throw new Error("persistence unavailable"); };
  await assert.rejects(receiveBillingEvent(raw, "signature", fixture.deps), /persistence unavailable/);
});

function reconciliationFixture() {
  let now = 15, generation = 1, revision = 0, failAudit = false, committed;
  const lease = { binding, processorSubscriptionId: "subscription-1", generation, revision,
    token: "e43b14f7-4d4f-41c8-9d12-992ef88367d6", expiresAt: 100 };
  const snapshot = { binding, processorSubscriptionId: "subscription-1", requestedOffer: offer.reference,
    currency: "EUR", interval: "month", evidenceComplete: true,
    invoices: [{ processorInvoiceId: "invoice-1", period: { start: 10, end: 20 }, status: "paid" }] };
  const deps = { authority, offerReference: offer.reference, now: () => now, policy: paidOnly,
    provider: { async fetch() { return snapshot; } },
    repository: { async claim() { return structuredClone(lease); }, async commit(expected, result) {
      if (expected.generation !== generation || expected.revision !== revision || expected.expiresAt <= now) return false;
      if (failAudit) throw new Error("audit unavailable");
      committed = structuredClone(result); revision++; return true;
    } } };
  return { deps, snapshot, set now(value) { now = value; }, set dirty(value) { generation = value; },
    set auditFailure(value) { failAudit = value; }, get committed() { return committed; }, get revision() { return revision; } };
}

test("reconciliation uses current complete invoice state, not event order or browser success", async () => {
  const fixture = reconciliationFixture();
  assert.equal(await reconcileBilling(binding, fixture.deps), "committed");
  assert.equal(fixture.committed.coverage.proUntil, 20);
  const unpaid = reconciliationFixture();
  unpaid.snapshot.invoices[0].status = "unpaid";
  assert.equal(await reconcileBilling(binding, unpaid.deps), "committed");
  assert.equal(unpaid.committed.coverage.proUntil, null);
  const future = reconciliationFixture();
  future.snapshot.invoices[0].period = { start: 20, end: 30 };
  await reconcileBilling(binding, future.deps);
  assert.deepEqual(future.committed.coverage, { proUntil: null, nextChangeAt: 20 });
});

test("dirty generation, competing revision or expired lease prevents stale projection", async () => {
  const fixture = reconciliationFixture();
  fixture.deps.provider.fetch = async () => { fixture.dirty = 2; return fixture.snapshot; };
  assert.equal(await reconcileBilling(binding, fixture.deps), "stale");
  assert.equal(fixture.committed, undefined);
  const competing = reconciliationFixture();
  const results = await Promise.all([reconcileBilling(binding, competing.deps), reconcileBilling(binding, competing.deps)]);
  assert.deepEqual(results.sort(), ["committed", "stale"]);
  assert.equal(competing.revision, 1);
  const expired = reconciliationFixture();
  expired.deps.provider.fetch = async () => { expired.now = 100; return expired.snapshot; };
  assert.equal(await reconcileBilling(binding, expired.deps), "stale");
  assert.equal(expired.committed, undefined);
});

test("wrong account/mode/subscription/offer, incomplete snapshot and unresolved policy fail closed", async () => {
  for (const change of [{ requestedOffer: "other-offer" }, { processorSubscriptionId: "other-subscription" },
    { binding: { ...binding, mode: "test" } }, { evidenceComplete: false }, { interval: "year" }]) {
    const fixture = reconciliationFixture(); Object.assign(fixture.snapshot, change);
    await assert.rejects(reconcileBilling(binding, fixture.deps));
    assert.equal(fixture.committed, undefined);
  }
  const fixture = reconciliationFixture();
  fixture.deps.policy = () => "review";
  await assert.rejects(reconcileBilling(binding, fixture.deps), hasCode("POLICY_REVIEW"));
  assert.equal(fixture.committed, undefined);
});

test("audit failure preserves retryable work and does not publish a paid projection", async () => {
  const fixture = reconciliationFixture(); fixture.auditFailure = true;
  await assert.rejects(reconcileBilling(binding, fixture.deps), /audit unavailable/);
  assert.equal(fixture.committed, undefined); assert.equal(fixture.revision, 0);
  fixture.auditFailure = false;
  assert.equal(await reconcileBilling(binding, fixture.deps), "committed");
});
