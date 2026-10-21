import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation: JSON.parse(await readFile(new URL("../client/public/locales/en/translation.json", import.meta.url), "utf8")) } } });

globalThis.React = React;
globalThis.window = { confirm: () => true };
const { default: AccountAddresses } = await import("../client/src/components/account-addresses.tsx");
const { default: ServiceLocationFields } = await import("../client/src/components/provider/service-location-fields.tsx");
const { createServiceDraft } = await import("../client/src/components/provider/service-draft.ts");
const { act, create } = renderer;
const saved = { id: 7, providerId: "owner", companyId: null, address: "Street 10, Riga, Latvia", latitude: 0, longitude: 0, locationSource: "manual", locationKey: null, locationPlaceId: null, locationExpiresAt: null, locationAddressSource: "user" };
const records = [], requests = [];
const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async ({ queryKey }) => (await fetch(queryKey[0])).json() } } });
client.setQueryData(["/api/company/context"], { company: null, permissions: { manageServices: true } });
globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes("api.openai.com")) return Response.json({ data: [{ embedding: [1, 2, 3] }] });
  requests.push({ url, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined });
  if (url === "/api/addresses" && options.method === "POST") { records.push({ ...saved, ...JSON.parse(options.body) }); return Response.json(records[0]); }
  if (url === "/api/addresses") return Response.json(records);
  if (url === "/api/company/context") return Response.json({ company: null, permissions: { manageServices: true } });
  throw new Error(`Unexpected request: ${url}`);
};
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
let component;
await act(async () => { component = create(React.createElement(QueryClientProvider, { client }, React.createElement(AccountAddresses))); });
await flush();
await act(async () => component.root.findAllByType("button").find(node => node.children.includes("Add address")).props.onClick({ currentTarget: null }));
for (const [id, value] of [["address", saved.address], ["latitude", "0"], ["longitude", "0"]]) {
  await act(async () => component.root.findAllByType("input").find(node => node.props.id === id).props.onChange({ target: { value } }));
}
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} }));
await flush();
assert.equal(records.length, 1); assert.equal(records[0].latitude, 0);
assert.equal(requests.some(request => request.url === "/api/geocode"), false);
await act(async () => component.unmount());
let selected;
function Harness() {
  const [draft, setDraft] = React.useState(createServiceDraft()); selected = draft;
  return React.createElement(ServiceLocationFields, { newService: draft, setNewService: setDraft });
}
await act(async () => { component = create(React.createElement(QueryClientProvider, { client }, React.createElement(Harness))); });
await flush();
await act(async () => component.root.findByType("select").props.onChange({ target: { value: "7" } }));
assert.equal(selected.addressId, 7);
assert.equal(component.root.findAllByType("input").length, 0, "Services select saved addresses without entering coordinates");
assert.equal(requests.some(request => request.url === "/api/geocode"), false, "Selecting a saved address never geocodes");
await act(async () => component.unmount()); client.clear(); delete globalThis.window;
if (process.argv.includes("--frontend-only")) {
  console.log("Passed: mocked address editor and saved-address service selection; backend section not loaded.");
  process.exit(0);
}

// Real route handlers with local stores and all external requests mocked.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_SECRET_KEY = process.env.OPENAI_API_KEY = "fixture-key";
process.env.SESSION_SECRET = "fixture-secret-for-local-tests-only-123456";
const { registerRoutes } = await import("../server/routes.ts");
const { addressStore } = await import("../server/addresses.ts");
const { storage } = await import("../server/storage.ts");
const { categoryStore } = await import("../server/categories.ts");
const { locationStore } = await import("../server/registeredLocations.ts");
const { AccessError } = await import("../server/companyAccess.ts");
const { isAuthenticated } = await import("../server/auth.ts");
const { pool } = await import("../server/db.ts");
const routes = [], app = () => {};
app.set = app.use = () => app;
for (const method of ["get", "post", "patch", "put", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
const server = await registerRoutes(app);
let serviceWrites = 0, addressWrites = 0, lookupCalls = 0;
globalThis.fetch = async url => {
  assert.ok(String(url).includes("api.openai.com"), "Service saves must never call Google");
  return Response.json({ data: [{ embedding: [1, 2, 3] }] });
};
categoryStore.list = async () => [{ key: "education", name: "Education" }];
addressStore.list = async () => [saved];
addressStore.get = async (id, owner) => {
  if (id !== 7 || owner.providerId !== "owner" || owner.companyId != null) throw new AccessError(403, "Choose an address from this workspace.");
  return saved;
};
addressStore.save = async (value, owner) => { addressWrites++; return { ...saved, ...value, providerId: owner.providerId }; };
addressStore.remove = async () => { throw { cause: { code: "23503" } }; };
locationStore.get = async () => { lookupCalls++; throw new Error("Service save must not access geocoding cache"); };
storage.createService = async value => { serviceWrites++; return { ...saved, ...value, id: 1 }; };
storage.updateService = async (id, value) => { serviceWrites++; return { id, ...value }; };
storage.getServiceById = async () => ({ id: 1, providerId: "owner", companyId: null, addressId: 7, employeeId: null, ...saved });
storage.upsertServiceEmbedding = async () => {};
async function request(method, path, body = {}, { allowed = true, companyId } = {}) {
  const route = routes.find(route => route.method === method && route.path === path);
  assert.equal(route.handlers[0], isAuthenticated);
  const req = { body, params: path.includes(":id") ? { id: "7" } : {}, user: { claims: { sub: "owner" } }, workspace: { company: companyId ? { id: companyId, providerId: "owner" } : null, permissions: { manageServices: allowed } } };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, sendStatus(code) { this.code = code; return this; } };
  await route.handlers.at(-1)(req, res); return res;
}
try {
  assert.equal((await request("get", "/api/addresses", {}, { allowed: false })).code, 403);
  assert.equal((await request("post", "/api/addresses", saved)).code, 201);
  assert.equal(addressWrites, 1);
  assert.equal((await request("post", "/api/addresses", { address: "invalid" })).code, 400);
  assert.equal((await request("patch", "/api/addresses/:id", saved, { companyId: 1 })).code, 403);
  assert.equal((await request("delete", "/api/addresses/:id")).code, 409);
  const input = { name: "Fixture", category: "education", serviceType: "one_to_one", price: "10", duration: 30, addressId: 7, providerId: "forged" };
  const created = await request("post", "/api/services", input);
  assert.equal(created.code, 200); assert.equal(created.data.providerId, "owner");
  assert.equal((await request("post", "/api/services", { ...input, addressId: 99 })).code, 403);
  assert.equal((await request("post", "/api/services", { ...input, addressId: null })).code, 400);
  assert.equal((await request("post", "/api/services", input, { allowed: false })).code, 403);
  assert.equal((await request("post", "/api/services", input, { companyId: 1 })).code, 403);
  assert.equal((await request("patch", "/api/services/:id", { addressId: 99 })).code, 403);
  assert.equal((await request("patch", "/api/services/:id", { name: "Changed name" })).code, 200);
  assert.equal(serviceWrites, 2); assert.equal(lookupCalls, 0);
  console.log("Passed: account address creation, manual zero coordinates, saved-address selector, no geocoding on service saves, required IDs, workspace authorization, and deletion conflicts.");
} finally { server.close(); await pool.end(); }
