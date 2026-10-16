import assert from "node:assert/strict";
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
const { default: Home } = await import("../client/src/pages/home.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { default: ServiceFilters } = await import("../client/src/components/service-filters.tsx");
const { default: ServiceDetailModal } = await import("../client/src/components/service-detail-modal.tsx");
const { default: BookingModal } = await import("../client/src/components/booking-modal.tsx");
const { act, create } = renderer;
const service = (id, companyId, providerId) => ({ id, companyId, providerId, name: `Service ${id}`, category: "education", serviceType: "one_to_one", price: "10", duration: 30, employee: null, provider: { firstName: "Personal", lastName: "Provider", providerType: companyId ? "company" : "individual", companyName: companyId ? "Wellness Company" : null } });
const source = service(1, 7, "team-member-1"), another = service(2, 7, "team-member-2"), personal = service(3, null, "person");
let component, requests = [], hold = true, release, fail = false, responseRows = [source, another], booked, details;
globalThis.fetch = async url => {
  requests.push(url);
  const respond = () => new Response(JSON.stringify(fail ? { message: "Unavailable" } : responseRows), { status: fail ? 500 : 200 });
  return hold ? new Promise(resolve => { release = () => resolve(respond()); }) : respond();
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
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

// The dialog's portal has no DOM target in this renderer; inspect Home's controlled dialog props.
responseRows = [source];
await act(async () => { component = create(wrap(React.createElement(Home))); });
await flush();
const filters = component.root.findAllByType(ServiceFilters)[0];
await act(async () => filters.props.onFiltersChange({ ...filters.props.filters, searchQuery: "massage", category: "health_wellness" }));
await flush();
await act(async () => component.root.findByProps({ "data-testid": "button-provider-1" }).props.onClick());
let catalog = component.root.findByType(ProviderServicesDialog);
assert.equal(catalog.props.source.companyId, 7);
assert.equal(catalog.props.open, true);
assert.equal(component.root.findAllByType(ServiceFilters)[0].props.filters.searchQuery, "massage");
await act(async () => catalog.props.onViewDetails(another));
assert.equal(component.root.findByType(ServiceDetailModal).props.service.id, 2);
assert.equal(component.root.findByType(ProviderServicesDialog).props.open, false);
await act(async () => component.root.findByType(ServiceDetailModal).props.onClose());
assert.equal(component.root.findByType(ProviderServicesDialog).props.open, true, "Return to catalog after closing service details");
await act(async () => component.root.findByType(ProviderServicesDialog).props.onBook(another));
assert.equal(component.root.findByType(BookingModal).props.service.id, 2);
assert.equal(component.root.findByType(ProviderServicesDialog).props.open, false);
await act(async () => component.root.findByType(BookingModal).props.onClose());
assert.equal(component.root.findByType(ProviderServicesDialog).props.open, true, "Return to catalog after closing booking");
await act(async () => component.root.findByType(ProviderServicesDialog).props.onClose());
assert.equal(component.root.findByType(ProviderServicesDialog).props.source, null);
assert.equal(component.root.findAllByType(ServiceFilters)[0].props.filters.category, "health_wellness", "Closing catalog preserves search filters");
await act(async () => component.root.findByType(ServiceCard).props.onViewDetails());
await act(async () => component.root.findByType(ServiceDetailModal).props.onViewProvider());
assert.equal(component.root.findByType(ProviderServicesDialog).props.source.companyId, 7, "Provider names in details open the same company catalog");
await act(async () => component.unmount()); queryClient.clear();

for (const locale of ["en", "es", "zh", "hi", "ar", "pt", "ru", "ja", "de", "fr"]) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const key of Object.keys(translation.catalog)) assert.ok(data.catalog[key], `${locale}: missing ${key}`);
}
delete globalThis.window; delete globalThis.document;
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
const { setupProviderCatalogRoutes } = await import("../server/providerCatalogRoutes.ts");
const { storage } = await import("../server/storage.ts");
const { pool } = await import("../server/db.ts");
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
