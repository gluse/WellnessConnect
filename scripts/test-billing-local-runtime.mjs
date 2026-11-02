import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import Stripe from "stripe";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { once } from "node:events";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.ts";
import { parseLocalBillingConfig, LOCAL_BILLING_ACK } from "../server/billing/local-config.ts";
import { billingReturnOrigin } from "../server/billing/origin.ts";
import { createLocalBillingRuntime } from "../server/billing/runtime.ts";
import { mountBillingBodyBoundaries } from "../server/billing/middleware.ts";
import { assertSandboxPortalConfiguration, createStripeBillingAdapter } from "../server/billing/stripe.ts";
import { createBillingJobs, createBillingJobRepository, billingBackoff } from "../server/billing/jobs.ts";
import { createLifecycleRepository } from "../server/billing/lifecycle.ts";
import { createSelectedBillingService } from "../server/billing/service.ts";
import { assertLegacyManualWritable } from "../server/billing/manual-writer.ts";
import { BillingError } from "../server/billing/contracts.ts";
import { createAuditContext } from "../server/audit/context.ts";
import { createAuditEvent } from "../server/audit/events.ts";

// No private env, app/server startup, ports, DB, sessions or external requests.
const actor = "11111111-1111-4111-8111-111111111111";
const op = "22222222-2222-4222-8222-222222222222", account = "33333333-3333-4333-8333-333333333333";
const grant = "44444444-4444-4444-8444-444444444444", offer = "b0241900-0000-4000-8000-000000000001";
const now = Date.parse("2026-10-26T10:00:00.000Z"), end = now + 86400000;
const authority = { provider: "stripe", merchantAccount: "acct_synthetic", mode: "test" };
const credentials = { STRIPE_BILLING_API_KEY: "rk_test_synthetic", STRIPE_BILLING_ACCOUNT_ID: authority.merchantAccount,
  STRIPE_BILLING_WEBHOOK_SECRET: "whsec_synthetic", STRIPE_BILLING_PORTAL_CONFIGURATION_ID: "bpc_synthetic" };
const profile = { STRIPE_LOCAL_APP_ENABLED: "true", STRIPE_LOCAL_TEST_ACK: LOCAL_BILLING_ACK,
  STRIPE_LOCAL_DATABASE_URL: "postgres://fmt_app_dev:synthetic@db.hbkooiknruimukkhshrk.supabase.co:5432/postgres?sslmode=require",
  STRIPE_LOCAL_CHECKOUTS_ENABLED: "true", STRIPE_LOCAL_WORKER_ENABLED: "false", STRIPE_LOCAL_ORIGIN: "http://localhost:5000" };
const portal = () => ({ id: "bpc_synthetic", livemode: false, active: true, application: null,
  features: { subscription_update: { enabled: false }, payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" } } });
const code = value => error => error?.code === value;

function scriptedDb(replies = []) {
  const writes = [], queries = []; let commits = 0, rollbacks = 0;
  const client = { async query(config, values) {
    const text = typeof config === "string" ? config : config.text; queries.push({ text, values });
    if (text === "begin") return { rows: [] };
    if (text === "commit") { commits++; return { rows: [] }; }
    if (text === "rollback") { rollbacks++; return { rows: [] }; }
    if (text.includes("to_regclass")) return { rows: replies.shift() };
    const selection = text.startsWith("select") ? text.slice(7, text.indexOf(" from ")) : text.includes(" returning ") ? text.split(" returning ")[1] : null;
    if (!text.startsWith("select")) writes.push({ text, values });
    if (!selection) return { rows: [] };
    const rows = replies.shift(); assert.ok(rows, `Unexpected query: ${text.slice(0, 70)}`);
    const fields = [...selection.matchAll(/"([^\"]+)"/g)].map(match => match[1].replace(/_([a-z])/g, (_, char) => char.toUpperCase()));
    return { rows: rows.map(row => fields.map(field => row[field] ?? null)) };
  } };
  return { db: drizzle({ client, schema }), writes, queries, get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}
async function request(app, path, { method = "GET", body = "", headers = {} } = {}) {
  const chunks = [];
  const socket = new Duplex({ read() {}, write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  const req = new IncomingMessage(socket); req._read = () => {}; req.complete = true; req.url = path; req.method = method;
  req.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  if (body) req.headers["content-length"] = String(Buffer.byteLength(body));
  const res = new ServerResponse(req); res.assignSocket(socket); const done = once(res, "finish");
  app.handle(req, res); queueMicrotask(() => { if (body) req.push(Buffer.from(body)); req.push(null); });
  await Promise.race([done, new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`Stream fixture timeout: ${method} ${path}`)), 1500).unref())]); socket.destroy();
  const wire = Buffer.concat(chunks).toString();
  const text = wire.slice(wire.indexOf("\r\n\r\n") + 4);
  return { status: res.statusCode, body: JSON.parse(text), cache: res.getHeader("cache-control") };
}

test("local profile requires explicit restricted target, sandbox acknowledgement and complete test credentials", () => {
  const selected = parseLocalBillingConfig(profile, credentials);
  assert.equal(selected.origin, "http://localhost:5000"); assert.equal(selected.worker, false);
  for (const patch of [{ STRIPE_LOCAL_APP_ENABLED: "false" }, { STRIPE_LOCAL_TEST_ACK: "yes" },
    { STRIPE_LOCAL_DATABASE_URL: "" }, { STRIPE_LOCAL_DATABASE_URL: "postgres://postgres:x@localhost/postgres" },
    { STRIPE_LOCAL_WORKER_ENABLED: "1" }, { STRIPE_LOCAL_ORIGIN: "http://example.test:5000" }, { EXTRA: "value" }])
    assert.throws(() => parseLocalBillingConfig({ ...profile, ...patch }, credentials));
  for (const patch of [{ STRIPE_BILLING_API_KEY: "sk_live_synthetic" }, { STRIPE_BILLING_ENABLED: "true" },
    { STRIPE_BILLING_PORTAL_CONFIGURATION_ID: "" }, { STRIPE_BILLING_WEBHOOK_SECRET: "" }])
    assert.throws(() => parseLocalBillingConfig(profile, { ...credentials, ...patch }));
});

test("HTTP return exception is exact loopback + development + test + explicit opt-in", () => {
  const context = { environment: "development", mode: "test", localSandbox: true };
  for (const origin of ["http://localhost:5000", "http://127.0.0.1:5000", "http://[::1]:5000"])
    assert.equal(billingReturnOrigin(origin, context).origin, origin);
  for (const origin of ["http://localhost.example:5000", "http://user@localhost:5000", "http://localhost:5000/", "http://localhost:5000?x=1"])
    assert.throws(() => billingReturnOrigin(origin, context));
  for (const changed of [{ ...context, mode: "live" }, { ...context, environment: "production" }, { ...context, localSandbox: false }, undefined])
    assert.throws(() => billingReturnOrigin("http://localhost:5000", changed));
});

test("dormant public flags and webhook bypass body/session/auth work", async () => {
  const app = express(); let sessions = 0;
  mountBillingBodyBoundaries(app); app.use((_req, res) => { sessions++; res.sendStatus(500); });
  const flags = await request(app, "/api/billing/runtime");
  assert.deepEqual(flags.body, { subscriptionsReady: false, administrationReady: false, hostedOrigins: [] });
  assert.equal(flags.cache, "no-store");
  assert.equal((await request(app, "/api/billing/webhook", { method: "POST", body: "not-json", headers: { "content-type": "application/json" } })).status, 503);
  assert.equal(sessions, 0);
});

function runtimeFixture({ databaseFailure = false, accountFailure = false, portalFailure = false, db = scriptedDb().db, config = parseLocalBillingConfig(profile, credentials) } = {}) {
  let accountReads = 0, portalReads = 0;
  const sdk = new Stripe("sk_test_synthetic", { apiVersion: "2025-06-30.basil" });
  const client = { webhooks: sdk.webhooks, billingPortal: { configurations: { async retrieve() { portalReads++; if (portalFailure) throw new Error("synthetic portal failure"); return portal(); } } } };
  const runtime = createLocalBillingRuntime(db, config, {
    authenticate: (req, _res, next) => { req.user = { claims: { sub: actor } }; next(); }, requireAdmin: (_req, _res, next) => next(),
    isAdmin: () => true, stripe: client, verifyAccount: async () => { accountReads++; if (accountFailure) throw new Error("synthetic account failure"); },
    verifyDatabase: async () => { if (databaseFailure) throw new Error("synthetic"); },
  });
  return { runtime, sdk, get accountReads() { return accountReads; }, get portalReads() { return portalReads; } };
}

test("startup stages identify the first failing billing guard without advancing or retrying", async () => {
  for (const [options, expected, accountReads, portalReads] of [
    [{ databaseFailure: true }, ["billing_database"], 0, 0],
    [{ accountFailure: true }, ["billing_database", "billing_account"], 1, 0],
    [{ portalFailure: true }, ["billing_database", "billing_account", "billing_portal"], 1, 1],
  ]) {
    const fixture = runtimeFixture(options), stages = [];
    await assert.rejects(fixture.runtime.verify(stage => stages.push(stage)));
    assert.deepEqual(stages, expected); assert.equal(fixture.accountReads, accountReads); assert.equal(fixture.portalReads, portalReads); fixture.runtime.stop();
  }
  const fixture = runtimeFixture(), stages = [];
  await fixture.runtime.verify(stage => stages.push(stage));
  assert.deepEqual(stages, ["billing_database", "billing_account", "billing_portal"]);
  assert.equal(fixture.accountReads, 1); assert.equal(fixture.portalReads, 1); fixture.runtime.stop();
});

test("failed database guard makes no provider requests or advertised capability", async () => {
  const fixture = runtimeFixture({ databaseFailure: true }), app = express();
  await assert.rejects(fixture.runtime.verify()); mountBillingBodyBoundaries(app, fixture.runtime);
  assert.equal((await request(app, "/api/billing/runtime")).body.subscriptionsReady, false);
  assert.equal(fixture.accountReads, 0); assert.equal(fixture.portalReads, 0); fixture.runtime.stop();
});

test("actual server assembly preserves signed raw bytes and avoids sessions; worker-off blocks checkout", async () => {
  const fixture = runtimeFixture(), app = express(); let sessions = 0;
  await fixture.runtime.verify(); mountBillingBodyBoundaries(app, fixture.runtime);
  app.use((_req, _res, next) => { sessions++; next(); }); fixture.runtime.mountAuthenticated(app);
  const body = JSON.stringify({ id: "evt_synthetic", object: "event", type: "unhandled.synthetic", livemode: false,
    created: Math.floor(Date.now() / 1000), data: { object: { id: "synthetic" } } }, null, 2);
  const signature = fixture.sdk.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_synthetic" });
  assert.equal((await request(app, "/api/billing/webhook", { method: "POST", body, headers: { "content-type": "application/json", "stripe-signature": signature } })).status, 200);
  assert.equal((await request(app, "/api/billing/webhook", { method: "POST", body: body + " ", headers: { "content-type": "application/json", "stripe-signature": signature } })).status, 400);
  assert.equal(sessions, 0); assert.equal(fixture.accountReads, 1); assert.equal(fixture.portalReads, 1);
  const flags = await request(app, "/api/billing/runtime"); assert.equal(flags.body.subscriptionsReady, true);
  assert.equal((await request(app, "/api/billing/checkout", { method: "POST", body: "{}", headers: { "content-type": "application/json", origin: profile.STRIPE_LOCAL_ORIGIN } })).status, 503);
  fixture.runtime.stop(); assert.equal((await request(app, "/api/billing/runtime")).body.subscriptionsReady, false);
});

test("named portal configuration cannot change prices, grant coupons or cancel immediately", () => {
  assert.doesNotThrow(() => assertSandboxPortalConfiguration(portal(), "bpc_synthetic"));
  for (const patch of [{ active: false }, { livemode: true }, { id: "other" }, { application: "connect" }])
    assert.throws(() => assertSandboxPortalConfiguration({ ...portal(), ...patch }, "bpc_synthetic"), code("POLICY_REVIEW"));
  for (const [feature, patch] of [["subscription_update", { enabled: true }], ["payment_method_update", { enabled: false }],
    ["subscription_cancel", { mode: "immediately" }], ["subscription_cancel", { proration_behavior: "create_prorations" }],
    ["subscription_cancel", { retention: { type: "coupon_offer", coupon_offer: { coupon: "coupon_synthetic" } } }]]) {
    const value = portal(); Object.assign(value.features[feature], patch);
    assert.throws(() => assertSandboxPortalConfiguration(value, value.id), code("POLICY_REVIEW"));
  }
});

test("worker retries with bounded backoff, quarantines reviewed/max attempts and never overlaps", async () => {
  const released = [], queue = [{ id: "retry", attempts: 1 }, { id: "review", attempts: 1 }, { id: "max", attempts: 9 }];
  let processCount = 0, claims = 0, releaseProcess;
  const wait = new Promise(resolve => { releaseProcess = resolve; });
  const jobs = createBillingJobs({ async claim() { claims++; return queue.shift() ?? null; },
    async release(job, review) { released.push([job.id, review]); }, async dueContracts() { return []; } }, {
    async process(id) { processCount++; if (id === "retry") { await wait; throw new Error("synthetic"); } throw new BillingError("POLICY_REVIEW"); },
    async reconcile() { throw new Error("unexpected"); },
  }, () => true);
  const pending = jobs.tick(); await Promise.resolve(); await jobs.tick(); assert.equal(claims, 1);
  releaseProcess(); await pending;
  assert.deepEqual(released, [["retry", false], ["review", true], ["max", true]]); assert.equal(processCount, 2);
  assert.equal(billingBackoff(1), 5000); assert.equal(billingBackoff(99), 3600000);
  jobs.stop(); await jobs.tick(); assert.equal(claims, 4);
});

test("event repository scopes claim, skips locked leases, and only releases the owned token", async () => {
  const event = { id: op, workspaceId: 7, attempts: 7 };
  const fixture = scriptedDb([[event], [{ id: op }]]), audit = [];
  const repository = createBillingJobRepository(fixture.db, authority, () => now, async (_tx, value) => audit.push(value));
  const job = await repository.claim(); await repository.release(job, false);
  const query = fixture.queries.find(value => value.text.startsWith("select"));
  assert.match(query.text, /skip locked/); assert.ok(query.values.includes(authority.merchantAccount)); assert.ok(query.values.includes("test"));
  const release = fixture.writes[1]; assert.match(release.text, /lease_token/); assert.ok(release.values.includes(job.token));
  assert.ok(release.values.includes("quarantined")); assert.equal(audit[0].kind, "event.quarantined");
  const stale = scriptedDb([[]]); await createBillingJobRepository(stale.db, authority, () => now, async () => assert.fail("stale lease audited")).release(job, true);
});

const workspace = { id: 7, companyId: null, userId: actor, plan: "pro", proUntil: new Date(end), updatedAt: new Date(now) };
test("manual removal preserves paid source, with projection and audit inside the same transaction", async () => {
  const manual = { id: grant, workspaceId: 7, startsAt: new Date(now - 1), endsAt: new Date(end), revokedAt: null };
  const paid = { periodStart: new Date(now - 1), periodEnd: new Date(end + 1000), amountRefunded: "0", refundReferences: [], disputeReferences: [] };
  const replies = () => [[{ id: actor }], [workspace], [{ workspaceId: 7 }], [manual], [], [paid]];
  const fixture = scriptedDb(replies()), audit = [];
  const lifecycle = createLifecycleRepository(fixture.db, { authority, now: () => now, sourcesReady: () => true, isAdmin: id => id === actor,
    audit: async (_tx, value) => audit.push(value) });
  const effective = await lifecycle.updateManualEntitlement(actor, { target: { kind: "user", id: actor }, plan: "free" });
  assert.equal(effective.proUntil, end + 1000); assert.equal(audit[0].reference, grant); assert.equal(fixture.commits, 1);
  assert.equal(fixture.writes.some(value => /update "billing_(invoices|subscriptions)"/.test(value.text)), false);
  const broken = scriptedDb(replies());
  await assert.rejects(createLifecycleRepository(broken.db, { authority, now: () => now, sourcesReady: () => true, isAdmin: () => true,
    audit: async () => { throw new Error("synthetic"); } }).updateManualEntitlement(actor, { target: { kind: "user", id: actor }, plan: "free" }));
  assert.equal(broken.commits, 0); assert.equal(broken.rollbacks, 1);
});

test("ordinary/manual rollback cannot overwrite a workspace with imported source marker", async () => {
  for (const replies of [[[{ present: false }]], [[{ present: true }], []]]) {
    const fixture = scriptedDb(replies); await assertLegacyManualWritable(fixture.db, 7); assert.equal(fixture.writes.length, 0);
  }
  const corrupt = scriptedDb([[]]); await assert.rejects(assertLegacyManualWritable(corrupt.db, 7), code("UNAVAILABLE"));
  const imported = scriptedDb([[{ present: true }], [{ workspaceId: 7 }]]);
  await assert.rejects(assertLegacyManualWritable(imported.db, 7), code("UNAVAILABLE")); assert.equal(imported.writes.length, 0);
});

test("portal stores a durable operation/session ID, never URL, and reauthorizes disclosure", async () => {
  const contract = { id: op, accountId: account, approvedOfferRef: offer };
  const replies = () => [[{ id: actor }], [workspace], [workspace], [{ id: actor }], [workspace], [contract], [{ id: account, customerId: "cus_synthetic" }], [workspace], [{ id: actor }], [workspace]];
  const fixture = scriptedDb(replies()), audit = [], calls = [];
  const service = createSelectedBillingService(fixture.db, { authority, now: () => now, newCheckoutsReady: () => false, terms: null,
    audit: async (_tx, value) => audit.push(value), provider: {}, hostedOrigins: ["https://billing.stripe.com"],
    portal: async (customer, operation) => { calls.push([customer, operation]); return { sessionId: "bps_synthetic", url: "https://billing.stripe.com/session" }; } });
  const result = await service.portal(actor, { kind: "user", id: actor });
  assert.equal(result.state, "redirect"); assert.equal(calls[0][0], "cus_synthetic");
  assert.deepEqual(audit.map(value => value.kind), ["portal.reserved", "portal.created"]);
  assert.ok(fixture.writes.some(value => value.values.includes("bps_synthetic")));
  assert.equal(fixture.writes.some(value => value.values.some(item => typeof item === "string" && item.startsWith("https://"))), false);
});

test("portal audit actor/outcome contract allows scoped worker unknown and denies worker success", () => {
  const base = { scope: { kind: "personal", workspaceId: actor }, target: { type: "billing_operation", id: op },
    source: { application: "fitsmytime", environment: "development", component: "billing" }, requestId: op, operationId: op };
  for (const phase of ["reserved", "created", "unknown"]) {
    const context = createAuditContext({ ...base, actor: { kind: "user", userId: actor, effectiveRole: "provider" } });
    assert.doesNotThrow(() => createAuditEvent(context, { eventName: `billing.portal_${phase}.v1`, outcome: phase === "unknown" ? "unknown" : "succeeded",
      ...(phase === "unknown" ? { reasonCode: "PROVIDER_TIMEOUT" } : {}), changes: [] }));
  }
  const worker = createAuditContext({ ...base, actor: { kind: "service", serviceId: "billing-worker" } });
  assert.doesNotThrow(() => createAuditEvent(worker, { eventName: "billing.portal_unknown.v1", outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT", changes: [] }));
  assert.throws(() => createAuditEvent(worker, { eventName: "billing.portal_created.v1", outcome: "succeeded", changes: [] }));
});

test("checkout becomes available only after an enabled worker completes its first healthy batch", async () => {
  const settings = { currentOfferId: offer, revision: 1 }, offerRow = { id: offer, amountMinor: 1900 };
  const status = () => [[{ id: actor }], [{ ...workspace, plan: "free", proUntil: null }], [settings], [offerRow], [], [], [], []];
  const db = scriptedDb([...status(), [], [], ...status()]);
  const fixture = runtimeFixture({ db: db.db, config: parseLocalBillingConfig({ ...profile, STRIPE_LOCAL_WORKER_ENABLED: "true" }, credentials) });
  try {
    await fixture.runtime.verify();
    assert.equal((await fixture.runtime.application.service.status(actor, { kind: "user", id: actor })).capabilities.checkout, false);
    await fixture.runtime.start();
    assert.equal((await fixture.runtime.application.service.status(actor, { kind: "user", id: actor })).capabilities.checkout, true);
  } finally { fixture.runtime.stop(); }
});

test("portal audit rollback leaves durable unknown; known configuration rejection does not invent timeout", async () => {
  const contract = { accountId: account, approvedOfferRef: offer };
  const reserve = () => [[{ id: actor }], [workspace], [workspace], [{ id: actor }], [workspace], [contract], [{ customerId: "cus_synthetic" }]];
  for (const knownRejection of [false, true]) {
    const fixture = scriptedDb([...reserve(), [workspace], ...(!knownRejection ? [[workspace]] : [])]), audits = [];
    let calls = 0;
    const service = createSelectedBillingService(fixture.db, { authority, now: () => now, newCheckoutsReady: () => false, terms: null, provider: {}, hostedOrigins: [],
      audit: async (_tx, value) => { if (value.kind === "portal.created") throw new Error("synthetic audit unavailable"); audits.push(value); },
      portal: async () => { calls++; if (knownRejection) throw new BillingError("POLICY_REVIEW"); return { url: "https://billing.stripe.com/synthetic", sessionId: "bps_synthetic" }; } });
    await assert.rejects(service.portal(actor, { kind: "user", id: actor }), code(knownRejection ? "POLICY_REVIEW" : "UNAVAILABLE"));
    assert.equal(calls, 1);
    if (knownRejection) {
      assert.deepEqual(audits.map(value => value.kind), ["portal.reserved"]);
      assert.ok(fixture.writes.at(-1).values.includes("failed"));
    } else {
      assert.deepEqual(audits.map(value => value.kind), ["portal.reserved", "portal.unknown"]);
      assert.equal(audits.at(-1).actorId, undefined); assert.equal(fixture.rollbacks, 1);
      assert.ok(fixture.writes.at(-1).values.includes("unknown"));
    }
  }
});

test("authoritative retrieval has a total read budget below the reconciliation lease", async () => {
  let clock = now, intentReads = 0; const timeouts = [];
  const client = { subscriptions: { async retrieve(_id, _params, options) { timeouts.push(options.timeout); clock += 20000;
    return { id: "sub_synthetic", livemode: false, customer: "cus_synthetic", items: { data: [{ quantity: 1, price: { id: "price_synthetic", currency: "eur", tax_behavior: "inclusive", recurring: { interval: "month", interval_count: 1 } } }] } }; } },
    invoices: { async list(_params, options) { timeouts.push(options.timeout); clock += 6000; return { has_more: false, data: [{ id: "in_synthetic", livemode: false, currency: "eur", customer: "cus_synthetic",
      amount_due: 1900, amount_paid: 1900, lines: { has_more: false, data: [{ parent: { subscription_item_details: { subscription: "sub_synthetic", proration: false } }, currency: "eur", quantity: 1, pricing: { price_details: { price: "price_synthetic" } } }] },
      payments: { has_more: false, data: [{ status: "paid", amount_paid: 1900, payment: { type: "payment_intent", payment_intent: "pi_synthetic" } }] } }] }; } },
    paymentIntents: { async retrieve() { intentReads++; throw new Error("unexpected"); } } };
  const adapter = createStripeBillingAdapter(client, {}, { authority, ready: () => true, newCheckoutsReady: () => false, returnOrigin: "https://app.fixture.test",
    now: () => clock, webhookSecret: "whsec_synthetic", portalConfigurationId: "bpc_synthetic", automaticTaxEnabled: false });
  await assert.rejects(adapter.fetchSubscription("sub_synthetic"), code("UNAVAILABLE"));
  assert.deepEqual(timeouts, [10000, 5000]); assert.equal(intentReads, 0);
});
