import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React, { useEffect } from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { BillingRuntimeProvider, useBillingRuntime } from "../client/src/components/billing-runtime.tsx";
import PriceEditor from "../client/src/components/admin-billing-price.tsx";
import { deferred } from "./fixtures/monthly-billing.mjs";

globalThis.React = React;
const { act, create } = renderer;
const disabled = { subscriptionsReady: false, administrationReady: false, hostedOrigins: [] };
const enabled = { subscriptionsReady: true, administrationReady: true, hostedOrigins: ["https://checkout.stripe.com", "https://billing.stripe.com"] };
const i18n = i18next.createInstance();
await i18n.use(initReactI18next).init({ lng: "en", resources: { en: { translation: JSON.parse(await readFile("client/public/locales/en/translation.json", "utf8")) } } });
function Probe() {
  const runtime = useBillingRuntime();
  useEffect(() => {
    if (runtime.subscriptionTransport) void runtime.subscriptionTransport.read({ actorId: "synthetic-user", target: { kind: "company", id: 42 } }, new AbortController().signal);
  }, [runtime]);
  return React.createElement("output", null, JSON.stringify({ subscription: Boolean(runtime.subscriptionTransport), admin: Boolean(runtime.adminPricingTransport) }));
}
function Price() { const runtime = useBillingRuntime(); return React.createElement(PriceEditor, { actorId: "synthetic-admin", authorized: true, transport: runtime.adminPricingTransport }); }
async function mount(fetcher, props = {}) {
  let component, options = { identityId: "synthetic-user", fetcher, children: React.createElement(Probe), ...props };
  const render = () => React.createElement(I18nextProvider, { i18n }, React.createElement(BillingRuntimeProvider, options));
  await act(async () => { component = create(render()); });
  return { component, output: () => JSON.parse(component.root.findByType("output").children[0]),
    update: async next => { options = { ...options, ...next }; await act(async () => component.update(render())); },
    close: async () => act(async () => component.unmount()),
  };
}
test("signed-out runtime makes no request; ready server flags enable only their matching transports", async () => {
  const calls = [];
  const fetcher = async (path, options) => { calls.push({ path, options }); return Response.json(path === "/api/billing/runtime" ? { ...enabled, administrationReady: false } : {}); };
  const view = await mount(fetcher, { identityId: null });
  assert.deepEqual(view.output(), { subscription: false, admin: false }); assert.deepEqual(calls, []);
  await view.update({ identityId: "synthetic-user" });
  assert.deepEqual(view.output(), { subscription: true, admin: false });
  assert.deepEqual(calls.map(call => call.path), ["/api/billing/runtime", "/api/billing/subscription?kind=company&id=42"]);
  assert.ok(calls.every(call => call.options.cache === "no-store" && call.options.redirect === "error")); await view.close();
});
test("disabled, missing, malformed, wrong-origin and failed runtime config never probe private billing", async () => {
  const cases = [
    () => Response.json(disabled), () => Response.json({}, { status: 404 }),
    () => new Response("<html>SPA fallback</html>", { headers: { "Content-Type": "text/html" } }),
    () => Response.json({ ...enabled, hostedOrigins: ["http://checkout.stripe.com"] }),
    () => Response.json({ ...enabled, hostedOrigins: [] }),
    () => Response.json({ ...enabled, secret: "must not be accepted" }),
    () => { throw Error("Synthetic transport unavailable"); },
  ];
  for (const respond of cases) {
    const calls = [], view = await mount(async path => { calls.push(path); return respond(); });
    assert.deepEqual(view.output(), { subscription: false, admin: false }); assert.deepEqual(calls, ["/api/billing/runtime"]); await view.close();
  }
});
test("identity changes abort capability requests and ignore previous user's late ready response", async () => {
  const held = deferred(), calls = [];
  const fetcher = async (path, options) => { calls.push({ path, options }); return calls.length === 1 ? held.promise : Response.json(disabled); };
  const view = await mount(fetcher); await view.update({ identityId: "other-user" });
  assert.equal(calls[0].options.signal.aborted, true);
  await act(async () => held.resolve(Response.json(enabled)));
  assert.deepEqual(view.output(), { subscription: false, admin: false }); assert.equal(calls.length, 2); await view.close();
});
test("focus revalidation preserves drafts for unchanged readiness and disables stale runtime on failure", async () => {
  const priorWindow = globalThis.window, priorDocument = globalThis.document, listeners = new Map();
  const add = (event, handler) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(handler); };
  const remove = (event, handler) => listeners.get(event)?.delete(handler);
  globalThis.window = { addEventListener: add, removeEventListener: remove };
  globalThis.document = { visibilityState: "visible", addEventListener: add, removeEventListener: remove };
  let ready = true; const calls = [];
  const fetcher = async path => { calls.push(path); return Response.json(path === "/api/billing/runtime" ? ready ? enabled : disabled : { amount: "19.00", revision: "1", currency: "EUR", interval: "month", taxIncluded: true }); };
  let view;
  try {
    view = await mount(fetcher, { children: React.createElement(Price) });
    await act(async () => view.component.root.findByType("input").props.onChange({ target: { value: "25.00" } }));
    await act(async () => { for (const handler of listeners.get("focus")) handler(); });
    assert.equal(view.component.root.findByType("input").props.value, "25.00");
    assert.equal(calls.filter(path => path === "/api/admin/billing/offer").length, 1);
    ready = false; await act(async () => { for (const handler of listeners.get("focus")) handler(); });
    assert.equal(view.component.root.findAllByType("input").length, 0);
    assert.equal(calls.filter(path => path === "/api/admin/billing/offer").length, 1);
  } finally { if (view) await view.close(); globalThis.window = priorWindow; globalThis.document = priorDocument; }
});
