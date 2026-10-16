import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { categoryFixtures } from "./fixtures/categories.mjs";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation: {} } } });

globalThis.React = React;
globalThis.window = { location: { pathname: "/administration", search: "", hash: "" }, HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Administration } = await import("../client/src/pages/administration.tsx");
const { default: Landing } = await import("../client/src/pages/landing.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { default: ServiceDetailsFields } = await import("../client/src/components/provider/service-details-fields.tsx");
const { default: ServiceFilters } = await import("../client/src/components/service-filters.tsx");
const { createServiceDraft } = await import("../client/src/components/provider/service-draft.ts");
const { SelectContent } = await import("../client/src/components/ui/select.tsx");
const { act, create } = renderer;
let component, location, records = structuredClone(categoryFixtures), allowed = true, writeStatus = 200, failList = false, requests = [];
const respond = (body, status = 200) => new Response(JSON.stringify(body), { status });
globalThis.fetch = async (url, options = {}) => {
  const method = options.method ?? "GET";
  requests.push({ url, method });
  if (url === "/api/admin/access") return respond({ isAdmin: allowed });
  if (url.startsWith("/api/admin/users?")) return respond({ users: [], page: 1, pageSize: 50, total: 0, totalPages: 1, hasNextPage: false });
  if (url === "/api/categories") return respond(failList ? { message: "Unavailable" } : records, failList ? 503 : 200);
  assert.ok(url.startsWith("/api/admin/categories"));
  if (writeStatus !== 200) return respond({ message: "Category operation refused." }, writeStatus);
  const key = url.split("/")[4];
  if (method === "DELETE") records = records.filter(record => record.key !== key);
  else if (method === "POST") records.push(JSON.parse(options.body));
  else Object.assign(records.find(record => record.key === key), JSON.parse(options.body));
  return respond({ message: "OK" });
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
const buttons = label => component.root.findAllByType("button").filter(node => node.children.includes(label));
const click = async (label, index = 0) => { await act(async () => buttons(label)[index].props.onClick()); await flush(); };
const edit = async (id, value) => act(async () => component.root.findByProps({ id }).props.onChange({ target: { value } }));
const submit = async () => { await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush(); };
const text = () => JSON.stringify(component.toJSON());
async function mount(admin = true) {
  if (component) await act(async () => component.unmount());
  queryClient.clear(); allowed = admin; requests = [];
  queryClient.setQueryData(["/api/auth/user"], { id: "support-user" });
  location = memoryLocation({ path: "/administration", record: true });
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: location.hook },
    React.createElement(Switch, null, React.createElement(Route, { path: "/administration", component: Administration }), React.createElement(Route, { path: "/login" }, "Sign in"))))); });
  await flush(); await flush();
}
await mount(false);
assert.equal(buttons("Categories").length, 0);
assert.ok(!requests.some(request => request.url.includes("categories")), "Regular users must not load category management");
await mount(); await click("Categories");
assert.ok(text().includes("Health & Wellness"));
await edit("category-key", "sports"); await edit("category-name", "  Sports  "); await edit("category-icon", "⚽"); await edit("category-keywords", "fitness");
await submit();
assert.ok(records.some(record => record.key === "sports" && record.name === "Sports"));
assert.ok(text().includes("Sports"));
await click("Edit", 3);
assert.equal(component.root.findByProps({ id: "category-key" }).props.disabled, true);
await edit("category-name", "Exercise"); await submit();
assert.ok(text().includes("Exercise"));
assert.equal(records[3].key, "sports");
await edit("category-key", "all"); await edit("category-name", "Reserved");
const before = requests.length; await submit();
assert.equal(requests.length, before, "Invalid keys must not submit");
await click("Delete", 3); await click("Keep category");
assert.equal(records.length, 4, "Deletion requires confirmation");
await click("Delete", 3); writeStatus = 409; await click("Confirm deletion");
assert.ok(text().includes("Category operation refused.")); assert.equal(records.length, 4);
writeStatus = 200; await click("Confirm deletion"); assert.equal(records.length, 3);
failList = true; await click("Refresh categories");
assert.ok(text().includes("Unable to load categories"));
assert.equal(component.root.findAllByType("form").length, 0, "Do not edit a failed catalog snapshot");
failList = false; await click("Refresh categories");
// The public landing page and cards must use catalog values, including a newly added category.
records.push({ key: "custom", name: "Custom activities", icon: "🧩", searchKeywords: "" });
await act(async () => component.unmount()); queryClient.clear();
const filters = { category: "", ageGroups: [], searchQuery: "", searchMode: "exact", serviceType: "", distance: 50, date: "", dateEnd: "", time: "", timeEnd: "", availableOnly: false };
await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: location.hook }, React.createElement(React.Fragment, null,
  React.createElement(Landing), React.createElement(ServiceCard, { service: { id: 1, category: "custom", name: "Puzzle class", duration: 30, price: "10", provider: {}, employee: null }, onBook() {}, onViewDetails() {} }),
  React.createElement(ServiceDetailsFields, { newService: createServiceDraft(), setNewService() {}, company: false, employees: [] }),
  React.createElement(ServiceFilters, { filters, onFiltersChange() {}, locationName: "", onLocationNameChange() {}, onUseCurrentLocation() {}, async onGeocodeLocation() {} }))))); });
await flush(); assert.ok(text().includes("Custom activities")); assert.ok(text().includes("🧩"));
for (const type of [ServiceDetailsFields, ServiceFilters]) {
  const options = component.root.findByType(type).findAllByType(SelectContent)[0].props.children;
  assert.ok(React.Children.toArray(options).some(child => child.props.value === "custom"), "Custom categories must appear in both provider and search selectors");
}
await mount(); await click("Categories"); await click("Edit"); writeStatus = 403; await submit();
assert.ok(text().includes("Application support access is required")); assert.equal(component.root.findAllByType("form").length, 0);
writeStatus = 200; await mount(); await click("Categories"); await click("Edit"); writeStatus = 401; await submit();
assert.equal(location.history.at(-1), "/login?returnTo=%2Fadministration");
await act(async () => component.unmount()); queryClient.clear();
delete globalThis.window; delete globalThis.document;

process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture";
process.env.SUPABASE_SECRET_KEY = "fixture";
process.env.APP_ADMIN_USER_IDS = "support-user";
process.env.NODE_ENV = "test";
const { setupCategoryRoutes } = await import("../server/categoryRoutes.ts");
const { isAuthenticated } = await import("../server/auth.ts");
const { requireAppAdmin } = await import("../server/appAdmin.ts");
const { pool } = await import("../server/db.ts");
let activeUser = "support-user", storeCalls = 0, storeError;
const routes = [], middleware = [];
const result = async () => { storeCalls++; if (storeError) throw storeError; return records; };
setupCategoryRoutes({ use(paths, handler) { middleware.push(handler); }, ...Object.fromEntries(["get", "post", "patch", "delete"].map(method => [method, (path, ...handlers) => routes.push({ method, path, handlers })])) }, {
  list: result, create: result, update: result, remove: result,
});
globalThis.fetch = async () => respond({ id: activeUser, email_confirmed_at: new Date().toISOString(), user_metadata: { role: "admin" }, app_metadata: {} });
async function request(method, { signedIn = true, body = {}, key = "sports" } = {}) {
  const req = { body, params: { key }, sessionID: "category-fixture", session: { auth: signedIn ? { userId: activeUser, accessToken: "fixture", refreshToken: "fixture", expiresAt: Date.now() / 1000 + 3600 } : undefined, destroy(callback) { this.auth = undefined; callback(); } } };
  const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, set(name, value) { this.headers[name] = value; return this; }, json(body) { this.body = body; return this; } };
  for (const handler of [...middleware, ...routes.find(route => route.method === method).handlers]) {
    let next = false; await handler(req, res, () => { next = true; }); if (!next) break;
  }
  return res;
}
try {
  const publicResult = await request("get", { signedIn: false });
  assert.equal(publicResult.code, 200); assert.equal(publicResult.headers["Cache-Control"], "no-store");
  const valid = { key: "sports", name: "Sports", icon: "⚽", searchKeywords: "fitness" };
  for (const route of routes.filter(route => route.method !== "get")) {
    assert.equal(route.handlers[0], isAuthenticated); assert.equal(route.handlers[1], requireAppAdmin);
    const initialCalls = storeCalls;
    assert.equal((await request(route.method, { signedIn: false, body: valid })).code, 401);
    activeUser = "company-owner"; assert.equal((await request(route.method, { body: valid })).code, 403);
    assert.equal(storeCalls, initialCalls); activeUser = "support-user";
  }
  for (const body of [{ ...valid, key: "all" }, { ...valid, key: "BAD KEY" }, { ...valid, name: " " }, { ...valid, name: "x".repeat(101) }, { ...valid, unexpected: true }]) assert.equal((await request("post", { body })).code, 400);
  assert.equal((await request("post", { body: valid })).code, 201);
  assert.equal((await request("patch", { body: valid })).code, 400, "Editing cannot change the key");
  const { key, ...details } = valid;
  assert.equal((await request("patch", { body: details })).code, 200);
  assert.equal((await request("delete", { key: "../services" })).code, 400);
  storeError = { cause: { code: "23503" } }; assert.equal((await request("delete")).code, 409);
  storeError = { cause: { code: "23505" } }; assert.equal((await request("post", { body: valid })).code, 409);
  storeError = new Error("private database details");
  const failed = await request("get"); assert.equal(failed.code, 503); assert.ok(!JSON.stringify(failed.body).includes("private"));
  console.log("Category administration, public rendering, access control, validation, and error handling passed.");
} finally { await pool.end(); }
