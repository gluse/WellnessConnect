import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Panel from "../client/src/components/provider/monthly-billing-panel.tsx";
import { BillingClientError, parseBillingStatus, parseHostedResult } from "../client/src/lib/monthly-billing.ts";
import { billingStatus, billingTarget, deferred } from "./fixtures/monthly-billing.mjs";
import PriceEditor from "../client/src/components/admin-billing-price.tsx";
import { createBillingRuntime, normalizeMonthlyAmount } from "../client/src/lib/billing-http.ts";

globalThis.React = React;
globalThis.requestAnimationFrame = callback => callback();
globalThis.fetch = () => { throw Error("Unexpected network request in isolated billing test"); };
const { act, create } = renderer;
const resources = Object.fromEntries(await Promise.all(["en", "lv", "ru"].map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const i18n = i18next.createInstance();
await i18n.use(initReactI18next).init({ lng: "en", fallbackLng: "en", resources, interpolation: { escapeValue: false } });
const text = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : node?.children?.map(text).join("") || "";
const flush = () => act(async () => { await Promise.resolve(); });
function transport(read = async () => billingStatus()) {
  const calls = { read: [], checkout: [], portal: [], navigate: [] };
  return { calls, hostedOrigins: ["https://billing.example.test"],
    read: async (scope, signal) => { calls.read.push({ scope, signal }); return read(scope, signal); },
    checkout: async (scope, input, signal) => { calls.checkout.push({ scope, input, signal }); return { state: "pending", target: scope.target }; },
    portal: async (scope, signal) => { calls.portal.push({ scope, signal }); return { state: "redirect", target: scope.target, url: "https://billing.example.test/secure" }; },
  };
}
async function mount(api, extra = {}) {
  let component;
  let props = { actorId: "synthetic-actor", target: billingTarget, transport: api, navigate: url => api?.calls.navigate.push(url), ...extra };
  const element = () => React.createElement(I18nextProvider, { i18n }, React.createElement(Panel, props));
  await act(async () => { component = create(element()); });
  const findButton = key => component.root.findAllByType("button").find(button => text(button.toJSON ? button.toJSON() : { children: button.children }) === i18n.t(`monthlyBilling.${key}`));
  return {
    component, body: () => text(component.toJSON()), button: findButton,
    click: async key => { const button = findButton(key); assert.ok(button, key); assert.equal(Boolean(button.props.disabled), false, key + " enabled"); await act(async () => { button.props.onClick(); }); },
    accept: async () => { await act(async () => { component.root.findByType("input").props.onChange({ target: { checked: true } }); }); },
    update: async next => { props = { ...props, ...next }; await act(async () => component.update(element())); },
    close: async () => { await act(async () => component.unmount()); },
  };
}

test("strict server state and workspace binding; access is independent of future payment dates", () => {
  assert.throws(() => parseBillingStatus(billingStatus({ target: { kind: "company", id: 99 } }), billingTarget));
  assert.throws(() => parseBillingStatus(billingStatus({ effectiveAccess: { hasPro: true, until: null } }), billingTarget));
  assert.throws(() => parseBillingStatus(billingStatus({ offer: { ...billingStatus().offer, interval: "year" } }), billingTarget));
  assert.throws(() => parseBillingStatus(billingStatus({ offer: { ...billingStatus().offer, amount: "0.49" } }), billingTarget));
  const result = parseBillingStatus(billingStatus({ paidThrough: "2030-03-01T00:00:00Z" }), billingTarget);
  assert.equal(result.effectiveAccess.hasPro, false);
});
test("hosted URL boundary rejects unsafe/unconfigured origins and cross-workspace responses", () => {
  const result = url => ({ state: "redirect", target: billingTarget, url });
  for (const url of ["javascript:alert(1)", "/relative", "http://billing.example.test/x", "https://billing.example.test.evil/x", "https://user:pass@billing.example.test/x", "https://evil.test"]) {
    assert.throws(() => parseHostedResult(result(url), billingTarget, ["https://billing.example.test"]));
  }
  assert.throws(() => parseHostedResult(result("https://billing.example.test/x"), billingTarget, []));
  assert.throws(() => parseHostedResult({ ...result("https://billing.example.test/x"), target: { kind: "user", id: "another" } }, billingTarget, ["https://billing.example.test"]));
  assert.equal(parseHostedResult(result("https://billing.example.test/x"), billingTarget, ["https://billing.example.test"]), "https://billing.example.test/x");
});
test("inactive runtime has no checkout, price, status request or invented free state", async () => {
  const view = await mount(undefined);
  assert.match(view.body(), /currently unavailable/); assert.doesNotMatch(view.body(), /12.34|No paid subscription/);
  assert.equal(view.component.root.findAllByType("button").length, 0); await view.close();
});
test("checkout requires recurring terms; duplicate clicks stay locked and request carries no price", async () => {
  const held = deferred(), api = transport();
  api.checkout = async (scope, input) => { api.calls.checkout.push({ scope, input }); return held.promise; };
  const view = await mount(api);
  assert.equal(view.button("checkout").props.disabled, true); await view.accept(); await view.click("checkout");
  assert.equal(view.button("checkout"), undefined); // uncertain operation hides another financial action immediately
  assert.equal(api.calls.checkout.length, 1);
  assert.deepEqual(Object.keys(api.calls.checkout[0].input).sort(), ["idempotencyKey", "offerRevision", "termsVersion"]);
  assert.match(api.calls.checkout[0].input.idempotencyKey, /^[\w-]{16,128}$/);
  await act(async () => held.resolve({ state: "pending", target: billingTarget }));
  assert.match(view.body(), /Awaiting confirmed/); assert.equal(api.calls.navigate.length, 0); await view.close();
});
test("ambiguous checkout is not retried; explicit resolved server state enables a fresh attempt", async () => {
  let state = billingStatus(); const api = transport(async () => state);
  api.checkout = async (scope, input) => { api.calls.checkout.push({ scope, input }); throw Error("synthetic timeout"); };
  const view = await mount(api); await view.accept(); await view.click("checkout");
  assert.match(view.body(), /outcome is not confirmed/); assert.equal(api.calls.checkout.length, 1);
  state = billingStatus({ operation: "unknown" }); await view.click("refresh");
  assert.equal(view.button("checkout"), undefined); assert.equal(api.calls.checkout.length, 1);
  state = billingStatus(); await view.click("refresh"); assert.equal(view.button("checkout").props.disabled, true);
  await view.accept(); await view.click("checkout"); assert.equal(api.calls.checkout.length, 2);
  assert.notEqual(api.calls.checkout[0].input.idempotencyKey, api.calls.checkout[1].input.idempotencyKey); await view.close();
});
test("checkout return only reads server state and cannot grant access", async () => {
  const api = transport(async () => billingStatus({ state: "pending", operation: "pending", offer: null, capabilities: { checkout: false, recover: false, manage: false } }));
  const view = await mount(api, { returned: true });
  assert.match(view.body(), /access will update after confirmation/); assert.match(view.body(), /Pro access is currently inactive/);
  assert.equal(api.calls.checkout.length, 0); assert.equal(api.calls.portal.length, 0); await view.close();
});
test("manual grants, paid renewal, cancellation and expiry preserve separate server facts", async () => {
  let state = billingStatus({ state: "active", manualUntil: "2030-01-01T00:00:00Z", paidThrough: "2030-02-01T00:00:00Z", effectiveAccess: { hasPro: true, until: "2030-02-01T00:00:00Z" }, cancelAtPeriodEnd: true, offer: null, capabilities: { checkout: false, recover: false, manage: true } });
  const api = transport(async () => state), view = await mount(api);
  assert.match(view.body(), /Manual Pro grant until/); assert.match(view.body(), /Cancellation at period end is confirmed/);
  assert.match(view.body(), /Pro access is active/); assert.equal(view.component.root.findAllByType("time").length, 3);
  await view.click("manage"); assert.deepEqual(api.calls.navigate, ["https://billing.example.test/secure"]);
  state = billingStatus({ state: "expired", offer: null, capabilities: { checkout: false, recover: false, manage: false } });
  await view.click("refresh"); assert.match(view.body(), /Subscription expired/); assert.match(view.body(), /Pro access is currently inactive/); await view.close();
});
test("payment failure and authentication recovery require an explicit server capability", async () => {
  const api = transport(async () => billingStatus({ state: "payment_failed", offer: null, capabilities: { checkout: false, manage: false, recover: true } }));
  const view = await mount(api); assert.match(view.body(), /Payment failed/); await view.click("recover");
  assert.equal(api.calls.portal.length, 1); assert.equal(api.calls.checkout.length, 0); await view.close();
});
test("denied and unauthenticated reads hide private facts and preserve usable recovery", async () => {
  for (const code of ["denied", "unauthorized", "unavailable"]) {
    const api = transport(async () => { throw new BillingClientError(code); }); const view = await mount(api);
    assert.ok(view.component.root.findByProps({ role: "alert" })); assert.equal(view.button("checkout"), undefined);
    assert.doesNotMatch(view.body(), /Synthetic tax disclosure/); assert.equal(api.calls.read.length, 1); await view.close();
  }
});
test("workspace/identity change clears terms and rejects late read and hosted redirect", async () => {
  const held = deferred(), api = transport(async scope => scope.target.id === 42 ? held.promise : billingStatus({ target: scope.target, offer: null }));
  const view = await mount(api); const oldSignal = api.calls.read[0].signal;
  await view.update({ actorId: "other-actor", target: { kind: "company", id: 43 } }); assert.equal(oldSignal.aborted, true);
  await act(async () => held.resolve(billingStatus())); assert.doesNotMatch(view.body(), /Synthetic tax disclosure/);
  await view.close();
  const checkout = deferred(), api2 = transport();
  api2.checkout = async () => checkout.promise;
  const view2 = await mount(api2); await view2.accept(); await view2.click("checkout");
  await view2.update({ actorId: "other-actor", transport: undefined });
  await act(async () => checkout.resolve({ state: "redirect", target: billingTarget, url: "https://billing.example.test/x" }));
  assert.deepEqual(api2.calls.navigate, []); assert.match(view2.body(), /currently unavailable/); await view2.close();
});
test("invalid hosted responses never navigate; lost permissions clear financial details", async () => {
  const api = transport(); api.portal = async () => { throw new BillingClientError("denied"); };
  const view = await mount(api); await view.close();
  const api2 = transport(async () => billingStatus({ capabilities: { checkout: false, manage: true, recover: false } }));
  api2.portal = async () => ({ state: "redirect", target: billingTarget, url: "https://evil.test" });
  const view2 = await mount(api2); await view2.click("manage"); assert.equal(api2.calls.navigate.length, 0); assert.match(view2.body(), /could not be verified/);
  api2.portal = async () => { throw new BillingClientError("denied"); }; await view2.click("manage");
  assert.doesNotMatch(view2.body(), /Synthetic tax disclosure/); assert.match(view2.body(), /do not have permission/); await view2.close();
});
test("en/lv/ru retain interpolation and live language changes without accepting terms", async () => {
  const view = await mount(transport());
  for (const language of ["en", "lv", "ru"]) {
    await act(async () => i18n.changeLanguage(language));
    assert.match(view.body(), new RegExp(resources[language].translation.monthlyBilling.title));
    assert.doesNotMatch(view.body(), /monthlyBilling\.|\{\{price\}\}/);
    assert.equal(view.button("checkout").props.disabled, true);
    for (const [key, value] of Object.entries(resources.en.translation.monthlyBilling)) {
      assert.equal(typeof resources[language].translation.monthlyBilling[key], "string");
      assert.deepEqual(resources[language].translation.monthlyBilling[key].match(/\{\{\w+\}\}/g), value.match(/\{\{\w+\}\}/g));
    }
  }
  await view.close(); await i18n.changeLanguage("en");
});

test("exact EUR entry accepts decimal comma without floating arithmetic and rejects unsafe inputs", () => {
  for (const [value, expected] of [["19", "19.00"], ["19,95", "19.95"], ["0.50", "0.50"], ["0,5", "0.50"], ["999999.99", "999999.99"], [" 123.4 ", "123.40"]]) assert.equal(normalizeMonthlyAmount(value), expected);
  for (const value of ["0", "0.01", "0.49", "-1", "1e3", "01.00", "1.001", "1,000.00", "", "NaN", "1000000.00"]) assert.equal(normalizeMonthlyAmount(value), null, value);
});
test("HTTP runtime is opt-in; authenticated no-store adapters send only agreed fields and map errors", async () => {
  const calls = [];
  let code = 200, value = { amount: "19.00", revision: "1", currency: "EUR", interval: "month", taxIncluded: true };
  const fetcher = async (url, options) => { calls.push({ url, options }); return Response.json(value, { status: code }); };
  const dormant = createBillingRuntime({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] }, fetcher);
  assert.equal(dormant.subscriptionTransport, undefined); assert.equal(dormant.adminPricingTransport, undefined); assert.equal(calls.length, 0);
  const runtime = createBillingRuntime({ subscriptionsReady: true, administrationReady: true, hostedOrigins: ["https://billing.example.test"] }, fetcher);
  const signal = new AbortController().signal, scope = { actorId: "never-send-actor", target: billingTarget };
  await runtime.adminPricingTransport.read(signal); await runtime.adminPricingTransport.save({ amount: "20.05", expectedRevision: "1" }, signal);
  await runtime.subscriptionTransport.read(scope, signal);
  await runtime.subscriptionTransport.checkout(scope, { termsVersion: "v1", offerRevision: billingStatus().offer.offerRevision, idempotencyKey: "synthetic-key-0001" }, signal);
  await runtime.subscriptionTransport.portal(scope, signal);
  assert.deepEqual(calls.map(call => call.url), ["/api/admin/billing/offer", "/api/admin/billing/offer", "/api/billing/subscription?kind=company&id=42", "/api/billing/checkout", "/api/billing/portal"]);
  assert.ok(calls.every(({ options }) => options.cache === "no-store" && options.credentials === "include" && options.redirect === "error" && options.signal === signal));
  assert.deepEqual(JSON.parse(calls[1].options.body), { amount: "20.05", expectedRevision: "1" });
  assert.deepEqual(Object.keys(JSON.parse(calls[3].options.body)).sort(), ["idempotencyKey", "offerRevision", "target", "termsVersion"]);
  assert.ok(calls.every(call => !JSON.stringify(call.options).includes("never-send-actor")));
  for (const [httpCode, expected] of [[401, "unauthorized"], [403, "denied"], [409, "conflict"], [400, "invalid"], [503, "unavailable"]]) {
    code = httpCode; await assert.rejects(runtime.adminPricingTransport.read(signal), error => error.code === expected);
  }
});

const priceOffer = (amount = "19.00", revision = "1") => ({ amount, revision, currency: "EUR", interval: "month", taxIncluded: true });
async function mountPrice(api, overrides = {}) {
  let component, props = { actorId: "synthetic-admin", authorized: true, transport: api, ...overrides };
  const render = () => React.createElement(I18nextProvider, { i18n }, React.createElement(PriceEditor, props));
  await act(async () => { component = create(render()); });
  const input = () => component.root.findByType("input");
  const button = key => component.root.findAllByType("button").find(node => text({ children: node.children }) === i18n.t(`monthlyBilling.${key}`));
  return { component, input, button, body: () => text(component.toJSON()),
    set: async value => act(async () => input().props.onChange({ target: { value } })),
    save: async () => act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })),
    reload: async () => act(async () => button("priceReload").props.onClick()),
    update: async next => { props = { ...props, ...next }; await act(async () => component.update(render())); },
    close: async () => act(async () => component.unmount()),
  };
}
test("Administration amount edits only new-subscription offer, validates input and prevents duplicate saves", async () => {
  const held = deferred(), saves = [];
  const api = { read: async () => priceOffer(), save: async input => { saves.push(input); return held.promise; } };
  const view = await mountPrice(api);
  assert.equal(view.input().props.value, "19.00"); assert.match(view.body(), /Existing subscribers keep their agreed price/);
  await view.set("1e3"); await view.save(); assert.equal(view.input().props["aria-invalid"], true); assert.equal(saves.length, 0);
  await view.set("0,49"); await view.save(); assert.equal(view.input().props["aria-invalid"], true); assert.equal(saves.length, 0);
  await view.set("20,05"); await view.save(); await view.save();
  assert.deepEqual(saves, [{ amount: "20.05", expectedRevision: "1" }]);
  await act(async () => held.resolve(priceOffer("20.05", "2")));
  assert.match(view.body(), /Saved. This price applies to new subscriptions/); assert.equal(view.input().props.value, "20.05"); await view.close();
});
test("price CAS conflict preserves draft and requires explicit reload before another save", async () => {
  const saves = [], api = { read: async () => priceOffer("21.00", "2"), save: async value => { saves.push(value); throw new BillingClientError("conflict"); } };
  const view = await mountPrice(api); await view.set("22.10"); await view.save();
  assert.equal(view.input().props.value, "22.10"); assert.match(view.body(), /price changed/);
  assert.equal(view.button("priceSave").props.disabled, true); await view.save(); assert.equal(saves.length, 1);
  await view.reload(); assert.equal(view.input().props.value, "21.00"); assert.equal(view.button("priceSave").props.disabled, false); await view.close();
});
test("ambiguous or mismatched saved prices preserve the draft and never report success", async () => {
  for (const save of [async () => { throw Error("Synthetic timeout"); }, async () => priceOffer("99.00", "2"), async () => priceOffer("20.00", "1")]) {
    const view = await mountPrice({ read: async () => priceOffer(), save }); await view.set("20.00"); await view.save();
    assert.equal(view.input().props.value, "20.00"); assert.equal(view.button("priceSave").props.disabled, true);
    assert.doesNotMatch(view.body(), /Saved. This price/); assert.equal(view.component.root.findAllByProps({ role: "alert" }).length, 1); await view.close();
  }
});
test("admin authorization/readiness fail closed and late saves never cross identity", async () => {
  let reads = 0; const held = deferred();
  const api = { read: async () => { reads++; return priceOffer(); }, save: async () => held.promise };
  const denied = await mountPrice(api, { authorized: false }); assert.equal(reads, 0); assert.equal(denied.component.root.findAllByType("input").length, 0); await denied.close();
  const unavailable = await mountPrice(undefined); assert.match(unavailable.body(), /currently unavailable/); await unavailable.close();
  const view = await mountPrice(api); await view.set("20.00"); await view.save();
  await view.update({ actorId: "another-user", authorized: false });
  await act(async () => held.resolve(priceOffer("20.00", "2")));
  assert.doesNotMatch(view.body(), /Saved/); assert.equal(view.component.root.findAllByType("input").length, 0); await view.close();
  const accessErrors = [];
  const revoked = await mountPrice({ read: async () => priceOffer(), save: async () => { throw new BillingClientError("denied"); } }, { onAccessError: err => accessErrors.push(err.message) });
  await revoked.save(); assert.equal(revoked.component.root.findAllByType("input").length, 0); assert.match(accessErrors[0], /^403:/); await revoked.close();
});
test("manual grant wait and offer revision conflict cannot create a checkout", async () => {
  let state = billingStatus({ unavailableReason: "manual_grant", manualUntil: "2030-01-01T00:00:00Z", effectiveAccess: { hasPro: true, until: "2030-01-01T00:00:00Z" } });
  const api = transport(async () => state), view = await mount(api);
  assert.match(view.body(), /after your manual Pro access expires/); assert.equal(view.button("checkout"), undefined);
  state = billingStatus(); await view.click("refresh"); await view.accept();
  api.checkout = async () => { throw new BillingClientError("conflict"); }; await view.click("checkout");
  assert.match(view.body(), /offer changed/); assert.equal(view.button("checkout"), undefined); await view.close();
});
test("confirmed access expiry triggers a status read and stale past access is rejected", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.UTC(2029, 0, 1) });
  let reads = 0;
  const api = transport(async () => ++reads === 1 ? billingStatus({ effectiveAccess: { hasPro: true, until: new Date(Date.now() + 40).toISOString() }, capabilities: { checkout: false, recover: false, manage: false }, offer: null }) : billingStatus({ state: "expired", offer: null }));
  const view = await mount(api); await act(async () => { context.mock.timers.tick(80); });
  assert.equal(reads, 2); assert.match(view.body(), /Subscription expired/); await view.close();
  assert.throws(() => parseBillingStatus(billingStatus({ effectiveAccess: { hasPro: true, until: "2000-01-01T00:00:00Z" } }), billingTarget));
});
test("repeated expired server snapshot fails closed after one expiry refresh without a timer loop", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.UTC(2029, 0, 1) });
  let reads = 0;
  const snapshot = billingStatus({ effectiveAccess: { hasPro: true, until: new Date(Date.now() + 60).toISOString() }, capabilities: { checkout: false, recover: false, manage: false }, offer: null });
  const api = transport(async () => { reads++; return snapshot; }), view = await mount(api);
  await act(async () => { context.mock.timers.tick(160); });
  await act(async () => { context.mock.timers.tick(30_000); });
  assert.equal(reads, 2); assert.match(view.body(), /could not be verified/); assert.doesNotMatch(view.body(), /Pro access is active/);
  await view.close();
});
test("pending return polls status at most eight times and never repeats checkout", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.UTC(2029, 0, 1) });
  const api = transport(async () => billingStatus({ state: "pending", operation: "pending", offer: null, capabilities: { checkout: false, manage: false, recover: false } }));
  const view = await mount(api, { returned: true });
  for (let index = 0; index < 8; index++) await act(async () => { context.mock.timers.tick(3001); });
  await act(async () => { context.mock.timers.tick(60_000); });
  assert.equal(api.calls.read.length, 9); assert.equal(api.calls.checkout.length, 0); assert.equal(api.calls.portal.length, 0); await view.close();
});
