import assert from "node:assert/strict";
import React, { useState } from "react";
import renderer from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { readFile } from "node:fs/promises";
import AccountPricingSettings from "../client/src/components/account-pricing-settings.tsx";
import AddressLocationFields, { createLocationDraft } from "../client/src/components/address-location-fields.tsx";
import { getQueryFn } from "../client/src/lib/queryClient.ts";

// Isolated renderer checks. Every request is handled in memory; no app startup.
globalThis.React = React;
const focused = [];
globalThis.document = { getElementById: id => ({ focus: () => focused.push(id) }) };
const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
await i18next.use(initReactI18next).init({ lng: "en", resources, interpolation: { escapeValue: false } });
const endpoint = "/api/workspace/pricing-settings", actorId = "synthetic-pricing-owner";
const workspace = { company: null, providerId: actorId, workspaces: [], invalid: false, permissions: { manageServices: true } };
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : (node?.children ?? []).map(text).join(" ");
const flush = () => renderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
const unexpected = [], writes = [];
let current, getStatus, patchStatus, pendingGet, pendingPatch, component, client;
globalThis.fetch = async (url, options = {}) => {
  if (url !== endpoint) { unexpected.push(url); throw new Error("Unexpected request: " + url); }
  if (options.method === "PATCH") {
    const input = JSON.parse(options.body); writes.push(input);
    if (patchStatus === "pending") return new Promise(resolve => { pendingPatch = () => { current = { ...current, ...input, revision: current.revision + 1 }; delete current.expectedRevision; delete current.expectedWorkspace; resolve(Response.json(current)); }; });
    if (patchStatus !== 200) return Response.json({ code: "WORKSPACE_PRICING_CHANGED" }, { status: patchStatus });
    current = { ...current, defaultCurrency: input.defaultCurrency, businessCountryCode: input.businessCountryCode, revision: current.revision + 1 };
    return Response.json(current);
  }
  if (getStatus === "pending") return new Promise(resolve => { pendingGet = () => resolve(Response.json(current)); });
  return Response.json(getStatus === 200 ? current : { message: "Synthetic unavailable" }, { status: getStatus });
};
async function mount(extra = {}, context = workspace) {
  current = { workspace: { kind: "user", id: actorId }, defaultCurrency: null, businessCountryCode: null, revision: 0, canEdit: true, ...extra };
  getStatus = 200; patchStatus = 200; writes.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0, queryFn: getQueryFn({ on401: "throw" }) }, mutations: { retry: false } } });
  client.setQueryData(["/api/company/context"], context);
  await renderer.act(async () => { component = renderer.create(React.createElement(QueryClientProvider, { client }, React.createElement(AccountPricingSettings, { actorId })), { createNodeMock: element => element.type === "form" ? { querySelector: () => ({ focus: () => focused.push("pricing-error") }) } : null }); });
  await flush();
}
const select = id => component.root.findAllByType("select").find(node => node.props.id === id);
const change = (id, value) => renderer.act(async () => select(id).props.onChange({ target: { value } }));
const submit = async () => { await renderer.act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush(); };
const click = async label => { await renderer.act(async () => component.root.findAllByType("button").find(node => text(node).trim() === label).props.onClick()); await flush(); };
const unmount = async () => { await renderer.act(async () => component.unmount()); client.clear(); };

for (const language of ["en", "lv", "ru"]) {
  await i18next.changeLanguage(language);
  const t = resources[language].translation;
  for (const [key, original] of Object.entries(resources.en.translation.pricingSettings)) {
    assert.ok(t.pricingSettings[key]?.trim());
    assert.deepEqual(t.pricingSettings[key].match(/{{\w+}}/g)?.sort(), original.match(/{{\w+}}/g)?.sort());
  }
  await mount();
  assert.ok(text(component.toJSON()).includes(t.pricingSettings.personal));
  assert.equal(select("pricing-default-currency").props.value, "");
  await change("pricing-business-country", "GB");
  assert.equal(select("pricing-default-currency").props.value, "GBP", "Country can suggest initially empty currency");
  await change("pricing-business-country", "LV");
  assert.equal(select("pricing-default-currency").props.value, "EUR", "Untouched suggestion follows later country edits");
  await change("pricing-business-country", "");
  assert.equal(select("pricing-default-currency").props.value, "", "Unknown country clears untouched suggestion");
  await change("pricing-default-currency", "CAD");
  await change("pricing-business-country", "LV");
  assert.equal(select("pricing-default-currency").props.value, "CAD", "Country never replaces deliberate currency");
  await submit();
  assert.deepEqual(writes[0], { expectedWorkspace: { kind: "user", id: actorId }, expectedRevision: 0, defaultCurrency: "CAD", businessCountryCode: "LV" });
  assert.ok(text(component.toJSON()).includes(t.pricingSettings.saved));
  assert.equal(client.getQueryData([endpoint, actorId, "personal"]).revision, 1);
  await unmount();
}

await i18next.changeLanguage("en");
const t = resources.en.translation;
await mount({ defaultCurrency: "EUR", businessCountryCode: "LV", revision: 4 });
await change("pricing-business-country", "GB");
assert.equal(select("pricing-default-currency").props.value, "EUR", "Persisted workspace currency survives country edits");
await change("pricing-default-currency", ""); await change("pricing-business-country", "LV");
assert.equal(select("pricing-default-currency").props.value, "", "Explicitly cleared default remains empty");
await change("pricing-default-currency", "XXX"); await submit();
assert.equal(writes.length, 0);
assert.equal(select("pricing-default-currency").props["aria-invalid"], true);
assert.ok(focused.includes("pricing-default-currency"));
await change("pricing-default-currency", "CAD");
patchStatus = 503; await submit();
assert.equal(select("pricing-default-currency").props.value, "CAD");
assert.ok(text(component.toJSON()).includes(t.pricingSettings.saveError));
patchStatus = 409; await submit();
assert.ok(text(component.toJSON()).includes(t.pricingSettings.conflict));
assert.equal(select("pricing-default-currency").props.value, "CAD");
getStatus = 503; await click(t.pricingSettings.reload);
assert.equal(select("pricing-default-currency").props.value, "CAD", "Failed conflict reload retains draft");
// The failed reload retains a retry action without making another mutation.
getStatus = 200; current = { ...current, defaultCurrency: "JPY", revision: 9 };
await click(t.pricingSettings.reload);
assert.equal(select("pricing-default-currency").props.value, "JPY");
await change("pricing-default-currency", "USD"); patchStatus = "pending";
await renderer.act(async () => { const handler = component.root.findByType("form").props.onSubmit; handler({ preventDefault() {} }); handler({ preventDefault() {} }); });
await flush();
const pendingCount = writes.length;
assert.equal(component.root.findByType("fieldset").props.disabled, true);
await renderer.act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} }));
assert.equal(writes.length, pendingCount, "Pending save prevents duplicate writes");
await renderer.act(async () => pendingPatch()); await flush();
await change("pricing-default-currency", "GBP"); patchStatus = 403; await submit();
assert.equal(component.root.findAllByType("select").length, 0, "Permission loss hides private settings and mutations");
await unmount();

await mount({ defaultCurrency: "EUR", canEdit: false });
assert.equal(component.root.findByType("fieldset").props.disabled, true);
assert.equal(component.root.findAllByType("button").some(node => node.props.type === "submit"), false);
await unmount();

for (const status of [401, 403]) {
  await mount({ defaultCurrency: "EUR" });
  getStatus = status;
  await renderer.act(async () => client.refetchQueries({ queryKey: [endpoint] })); await flush();
  assert.equal(component.root.findAllByType("select").length, 0, `GET ${status} hides cached form`);
  await unmount();
}

await mount({ defaultCurrency: "EUR" });
await change("pricing-default-currency", "CAD");
const companyContext = { ...workspace, company: { id: 2, name: "Synthetic company" } };
current = { ...current, workspace: { kind: "company", id: 2 }, defaultCurrency: "GBP", revision: 0 };
await renderer.act(async () => client.setQueryData(["/api/company/context"], companyContext)); await flush();
for (let attempt = 0; attempt < 10 && !select("pricing-default-currency"); attempt++) await flush();
assert.equal(select("pricing-default-currency").props.value, "GBP", "Workspace change discards old private draft");
assert.ok(text(component.toJSON()).includes("Synthetic company"));
await unmount();

// Location currency is independent of country and survives clearing the override.
let draft;
function AddressHarness() {
  const [value, setValue] = useState(() => createLocationDraft()); draft = value;
  return React.createElement(AddressLocationFields, { newService: value, setNewService: setValue });
}
await renderer.act(async () => { component = renderer.create(React.createElement(AddressHarness)); });
await change("address-pricing-currency", "CAD"); await change("address-country", "LV");
assert.equal(draft.pricingCurrency, "CAD"); assert.equal(draft.countryCode, "LV");
await change("address-pricing-currency", "");
assert.equal(draft.pricingCurrency, null); assert.equal(draft.countryCode, "LV");
await renderer.act(async () => component.unmount());
assert.deepEqual(unexpected, []);
console.log("PASS: en/lv/ru settings, bound CAS saves, validation, country suggestion/manual preservation, errors/draft retention, reload, duplicate prevention, permission loss, workspace reset and location override");
