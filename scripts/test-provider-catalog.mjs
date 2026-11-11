import assert from "node:assert/strict";
import { categoryFixtures } from "./fixtures/categories.mjs";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { providerCatalogQuery, providerCatalogSchema } from "../shared/provider-catalog.ts";

assert.equal(providerCatalogQuery({ companyId: 7, providerId: "team-member" }), "companyId=7");
assert.equal(providerCatalogQuery({ companyId: null, providerId: "person" }), "providerId=person");
for (const input of [{}, { companyId: "0" }, { companyId: "1x" }, { providerId: " " }, { providerId: ["person"] }, { providerId: "person", companyId: 7 }, { companyId: 7, isActive: false }]) assert.equal(providerCatalogSchema.safeParse(input).success, false);

globalThis.React = React;
globalThis.window = {
  location: { pathname: "/", search: "", hash: "" }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {},
  HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } },
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const translation = JSON.parse(await readFile(new URL("../client/public/locales/en/translation.json", import.meta.url), "utf8"));
await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation } }, interpolation: { escapeValue: false } });
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { ProviderServicesList, default: ProviderServicesDialog } = await import("../client/src/components/provider-services-dialog.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { act, create } = renderer;
const service = (id, companyId, providerId) => ({ id, companyId, providerId, name: `Service ${id}`, category: "education", serviceType: "one_to_one", price: "10", duration: 30, employee: null, provider: { firstName: "Personal", lastName: "Provider", providerType: companyId ? "company" : "individual", companyName: companyId ? "Wellness Company" : null } });
const source = service(1, 7, "team-member-1"), another = service(2, 7, "team-member-2"), personal = service(3, null, "person");
let component, requests = [], hold = true, release, fail = false, responseRows = [source, another], booked, details;
globalThis.fetch = async url => {
  if (url === "/api/categories") return new Response(JSON.stringify(categoryFixtures));
  requests.push(url);
  const respond = () => new Response(JSON.stringify(fail ? { message: "Unavailable" } : responseRows), { status: fail ? 500 : 200 });
  return hold ? new Promise(resolve => { release = () => resolve(respond()); }) : respond();
};
const flush = async (milliseconds = 40) => act(async () => { await new Promise(resolve => setTimeout(resolve, milliseconds)); });
const wrap = child => React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path: "/" }).hook }, child));
async function mountList(anchor = source) {
  if (component) await act(async () => component.unmount());
  queryClient.clear();
  await act(async () => { component = create(wrap(React.createElement(ProviderServicesList, { source: anchor, onBook: row => { booked = row; }, onViewDetails: row => { details = row; } }))); });
  await flush();
}
await mountList();
assert.ok(component.root.findByProps({ role: "status" }).children.includes(translation.catalog.loading));
assert.equal(requests.at(-1), "/api/services/catalog?companyId=7");
hold = false;
await act(async () => release()); await flush();
assert.deepEqual(component.root.findAllByType(ServiceCard).map(node => node.props.service.id), [1, 2]);
assert.ok(component.root.findAllByType("p").some(node => node.children.includes("Published services: 2")));
await act(async () => component.root.findAllByType(ServiceCard)[1].props.onBook());
assert.equal(booked.id, 2);
await act(async () => component.root.findAllByType(ServiceCard)[1].props.onViewDetails());
assert.equal(details.id, 2);
fail = true;
await mountList(personal);
assert.equal(requests.at(-1), "/api/services/catalog?providerId=person");
assert.ok(component.root.findByProps({ role: "alert" }));
fail = false; responseRows = [];
await act(async () => component.root.findByType("button").props.onClick()); await flush();
assert.ok(component.root.findAllByType("p").some(node => node.children.includes(translation.catalog.empty)));
await act(async () => component.unmount()); queryClient.clear();

// Free/expired providers cannot mount the catalog window or fetch its list.
const beforeDenied = requests.length;
await act(async () => { component = create(wrap(React.createElement(ProviderServicesDialog, { source, open: true, onClose() {}, onBook() {}, onViewDetails() {} }))); });
await flush();
assert.equal(component.toJSON(), null);
assert.equal(requests.length, beforeDenied);
await act(async () => component.unmount()); queryClient.clear();
// The active-Pro public storefront link replaces the former generic catalog fallback.
await act(async () => { component = create(wrap(React.createElement(ServiceCard, { service: source, searchLayout: true, onBook() {}, onViewDetails() {} }))); });
assert.equal(component.root.findAllByType("a").length, 0);
assert.equal(component.root.findAllByProps({ "data-testid": "button-provider-1" }).length, 0);
await act(async () => component.update(wrap(React.createElement(ServiceCard, { service: { ...source, storefrontSlug: "pro-company" }, searchLayout: true, onBook() {}, onViewDetails() {} }))));
assert.equal(component.root.findByType("a").props.href, "/providers/pro-company");
await act(async () => component.unmount()); queryClient.clear();

for (const locale of ["en", "lv", "ru"]) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const key of Object.keys(translation.catalog)) assert.ok(data.catalog[key], `${locale}: missing ${key}`);
}
delete globalThis.window; delete globalThis.document;
if (process.argv.includes("--frontend-only")) {
  console.log("Passed: isolated provider catalog loading/identity/callbacks, errors/retry/empty, denied free-provider window, eligible provider link and en/lv/ru resources; backend section not loaded.");
  process.exit(0);
}
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
const { setupProviderCatalogRoutes } = await import("../server/providerCatalogRoutes.ts");
const { storage } = await import("../server/storage.ts");
const { pool } = await import("../server/db.ts");
pool.connect = pool.query = async () => { throw new Error("Unexpected database access in the offline provider-catalog test"); };
let route, calls = [], unavailable = false;
setupProviderCatalogRoutes({ get(path, ...handlers) { route = { path, handlers }; } });
assert.equal(route.path, "/api/services/catalog");
assert.equal(route.handlers.length, 1, "Published provider catalogs are public");
storage.searchServices = async filters => { calls.push(filters); if (unavailable) throw new Error("Secret database details"); return [source, another]; };
async function request(query) {
  let code = 200, data, headers = {};
  const res = { set(key, value) { headers[key] = value; return this; }, status(value) { code = value; return this; }, json(value) { data = value; return this; } };
  await route.handlers[0]({ query }, res);
  return { code, data, headers };
}
try {
  assert.equal((await request({ companyId: "7" })).code, 200);
  assert.deepEqual(calls.at(-1), { companyId: 7 });
  assert.equal((await request({ providerId: "person" })).code, 200);
  assert.deepEqual(calls.at(-1), { providerId: "person" });
  const before = calls.length;
  for (const query of [{}, { companyId: "0" }, { companyId: "1x" }, { providerId: "person", companyId: "7" }, { providerId: "person", category: "education" }, { companyId: "7", isActive: "false" }]) assert.equal((await request(query)).code, 400);
  assert.equal(calls.length, before);
  unavailable = true;
  const failed = await request({ companyId: "7" });
  assert.equal(failed.code, 500);
  assert.equal(failed.data.message.includes("Secret"), false);
  assert.equal(failed.headers["Cache-Control"], "no-store");
} finally { await pool.end(); }
console.log("Passed: provider/company identity, independent catalog loading, all returned offers, booking/details callbacks, preserved search filters, loading/errors/retry/empty states, translations, and public endpoint validation.");
