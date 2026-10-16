import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { isAllowedAuthReturnTo } from "../shared/navigation.ts";

globalThis.React = React;
const record = { id: 1, providerId: "provider", companyId: 7, name: "Public service", category: "health_wellness", price: "20", duration: 30, serviceType: "one_to_one", isActive: true, companyActive: true, employee: null, rating: 4, reviewCount: 1, latitude: 56.95, longitude: 24.1, provider: { providerType: "company", companyName: "Public Company" } };
let requests = [], holdAuth = false, releaseAuth, component, location;
globalThis.fetch = async url => {
  if (String(url).startsWith("/locales/")) return new Response(await readFile(`client/public${url}`, "utf8"));
  requests.push(url);
  if (url === "/api/auth/user") {
    const response = () => new Response('{"message":"Unauthorized"}', { status: 401 });
    return holdAuth ? new Promise(resolve => { releaseAuth = () => resolve(response()); }) : response();
  }
  if (url === "/api/auth/providers") return new Response("{}");
  if (url === "/api/admin/access") return new Response('{"isAdmin":false}');
  if (url === "/api/config/maps") return new Response('{"apiKey":"fixture-key"}');
  if (url.startsWith("/api/services/search?") || url.startsWith("/api/services/semantic-search?") || url.startsWith("/api/services/catalog?")) return new Response(JSON.stringify([record]));
  if (url.startsWith("/api/services/1/reviews?")) return new Response(JSON.stringify({ reviews: [], page: 1, hasMore: false }));
  throw new Error(`Unexpected guest request: ${url}`);
};
// Initialize the real translation configuration before adding the minimal browser facade.
const { default: i18n, supportedLanguages } = await import("../client/src/lib/i18n.ts");
if (!i18n.isInitialized) await new Promise(resolve => i18n.on("initialized", resolve));
await i18n.changeLanguage("en");
for (const { code } of supportedLanguages) {
  const data = JSON.parse(await readFile(`client/public/locales/${code}/translation.json`, "utf8"));
  for (const key of Object.keys(i18n.getResourceBundle("en", "translation").guestSearch)) assert.ok(data.guestSearch[key], `${code}: missing guestSearch.${key}`);
}
globalThis.window = {
  location: { pathname: "/", search: "", hash: "" }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {},
  HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } },
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
globalThis.google = window.google = { maps: { importLibrary: async name => name === "maps" ? { Map: class {} } : { Marker: class {} } } };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: App } = await import("../client/src/App.tsx");
const { default: Home } = await import("../client/src/pages/home.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { default: ServiceFilters } = await import("../client/src/components/service-filters.tsx");
const { default: GoogleMap } = await import("../client/src/components/google-map.tsx");
const { default: ProviderServicesDialog } = await import("../client/src/components/provider-services-dialog.tsx");
const { default: ServiceDetailModal } = await import("../client/src/components/service-detail-modal.tsx");
const { default: BookingModal, BookingSignInActions } = await import("../client/src/components/booking-modal.tsx");
const { act, create } = renderer;
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
async function mount(path, user = null, pendingAuth = false) {
  if (component) await act(async () => component.unmount());
  queryClient.clear(); requests = []; holdAuth = pendingAuth;
  if (!pendingAuth) queryClient.setQueryData(["/api/auth/user"], user);
  const url = new URL(path, "http://localhost");
  window.location.pathname = url.pathname; window.location.search = url.search;
  location = memoryLocation({ path: url.pathname, record: true });
  await act(async () => { component = create(React.createElement(Router, { hook: location.hook }, React.createElement(App))); });
  await flush();
}
await mount("/");
assert.equal(component.root.findAllByType(Home).length, 0, "Keep the existing landing page for visitors");
const browse = component.root.findAllByType("a").find(node => node.props["data-testid"] === "button-browse-services");
assert.equal(browse.props.href, "/search");
await act(async () => browse.props.onClick({ button: 0, preventDefault() {} })); await flush();
assert.equal(location.history.at(-1), "/search");
assert.equal(component.root.findAllByType(Home).length, 1);
assert.equal(component.root.findAllByType(ServiceCard).length, 1);
assert.ok(component.root.findAllByType("a").some(node => node.props.href === "/login?returnTo=%2Fsearch"));
await act(async () => {
  const filters = component.root.findAllByType(ServiceFilters)[0];
  filters.props.onFiltersChange({ ...filters.props.filters, category: "health_wellness", searchQuery: "massage" });
});
await flush();
assert.ok(requests.some(url => url.includes("category=health_wellness") && url.includes("searchQuery=massage")));
await act(async () => component.root.findAllByType(ServiceFilters)[0].props.onFiltersChange({ ...component.root.findAllByType(ServiceFilters)[0].props.filters, searchMode: "semantic" }));
await flush();
assert.ok(requests.some(url => url.startsWith("/api/services/semantic-search?")));
await act(async () => component.root.findByType(ServiceCard).props.onViewDetails());
assert.equal(component.root.findByType(ServiceDetailModal).props.open, true);
await act(async () => component.root.findByType(ServiceDetailModal).props.onViewProvider());
assert.equal(component.root.findByType(ProviderServicesDialog).props.open, true);
await act(async () => component.root.findByType(ProviderServicesDialog).props.onClose());
await act(async () => component.root.findByType(ServiceCard).props.onBook());
assert.ok(component.root.findByType(BookingModal));
assert.equal(component.root.findAllByProps({ "data-testid": "dialog-booking-sign-in" }).length, 1);
assert.ok(!requests.some(url => url.startsWith("/api/availability/") || url === "/api/bookings"), "Guest booking does not fetch private data or create a reservation");
await act(async () => component.root.findByType(BookingModal).props.onClose());
assert.equal(component.root.findAllByType(ServiceFilters)[0].props.filters.searchQuery, "massage");
await act(async () => component.root.findAllByType("button").find(node => node.props["data-testid"] === "button-view-map").props.onClick()); await flush();
assert.ok(component.root.findByType(GoogleMap));
assert.ok(requests.includes("/api/config/maps"));
await mount("/search", null, true);
assert.ok(component.root.findByType(Home), "Search must not wait for the account request");
assert.equal(component.root.findAllByType(ServiceCard).length, 1);
await act(async () => releaseAuth()); await flush();
assert.equal(location.history.at(-1), "/search");
await mount("/login?returnTo=%2Fsearch");
await act(async () => component.root.findAllByType("button").find(node => node.children.includes("New here? Create an account")).props.onClick());
assert.ok(component.root.findAllByType("select").some(node => node.props.id === "signup-type"), "Search return URLs still allow company signup");
await mount("/my-bookings");
assert.equal(location.history.at(-1), "/login?returnTo=%2Fmy-bookings");
await mount("/search", { id: "customer", firstName: "Customer" });
await act(async () => component.root.findByType(ServiceCard).props.onBook());
assert.equal(component.root.findAllByProps({ "data-testid": "dialog-booking-sign-in" }).length, 0, "Signed-in bookings retain their existing form");
await act(async () => component.unmount()); queryClient.clear();
let cancelled = false;
await act(async () => { component = create(React.createElement(Router, { hook: memoryLocation({ path: "/search" }).hook }, React.createElement(BookingSignInActions, { isLoading: false, onClose: () => { cancelled = true; } }))); });
assert.equal(component.root.findByType("a").props.href, "/login?returnTo=%2Fsearch");
await act(async () => component.root.findAllByType("button").find(node => node.children.includes(i18n.t("guestSearch.continueBrowsing"))).props.onClick());
assert.equal(cancelled, true);
await act(async () => component.unmount());
assert.equal(isAllowedAuthReturnTo("/search"), true);
for (const path of ["//evil.example", "https://evil.example/search", "/search?returnTo=//evil.example", "/search-other"]) assert.equal(isAllowedAuthReturnTo(path), false);

delete globalThis.window; delete globalThis.document;
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.SESSION_SECRET = "fixture-secret-for-local-tests-only-123456";
process.env.OPENAI_API_KEY = "fixture-key";
const { registerRoutes } = await import("../server/routes.ts");
const { storage } = await import("../server/storage.ts");
const { db, pool } = await import("../server/db.ts");
const { supabaseAdmin } = await import("../server/supabase.ts");
const { isAuthenticated } = await import("../server/auth.ts");
const routes = [], app = () => {};
app.set = app.use = () => app;
for (const method of ["get", "post", "put", "patch", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
const server = await registerRoutes(app);
storage.searchServices = async () => [record];
storage.getServiceById = async () => record;
storage.getServiceReviews = async () => ({ reviews: [], page: 1, hasMore: false });
let imageRows = [], downloads = 0;
db.select = () => ({ from: () => ({ leftJoin: () => ({ where: async () => imageRows }) }) });
supabaseAdmin.storage.from = () => ({ download: async () => { downloads++; return { data: new Blob([new Uint8Array([137,80,78,71,13,10,26,10])]), error: null }; } });
async function request(method, path, extra = {}) {
  const route = routes.find(route => route.method === method && route.path === path);
  assert.ok(route, path);
  let code = 200, data, headers = {};
  const req = { session: {}, query: {}, params: { id: "1" }, body: {}, ...extra };
  const res = { status(value) { code = value; return this; }, json(value) { data = value; return this; }, set(value) { if (typeof value === "object") Object.assign(headers, value); return this; }, send(value) { data = value; return this; }, sendStatus(value) { code = value; return this; } };
  for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
  return { code, data, headers };
}
try {
  for (const [path, query] of [["/api/services/search", {}], ["/api/services/semantic-search", { query: "massage" }], ["/api/services/catalog", { companyId: "7" }], ["/api/services/:id", {}], ["/api/services/:id/reviews", {}]]) {
    assert.equal((await request("get", path, { query })).code, 200, `${path} must work without a session`);
  }
  const booking = routes.find(route => route.method === "post" && route.path === "/api/bookings");
  assert.equal(booking.handlers[0], isAuthenticated);
  assert.equal((await request("post", "/api/bookings")).code, 401);
  assert.equal((await request("post", "/api/objects/upload")).code, 401);
  const imagePath = "/objects/provider/11111111-1111-4111-8111-111111111111.png";
  imageRows = [{ service: { isActive: true, companyId: 7 }, company: { isActive: true } }];
  const image = await request("get", "/objects/:objectPath(*)", { path: imagePath });
  assert.equal(image.code, 200);
  assert.ok(Buffer.isBuffer(image.data));
  assert.equal(image.headers["Content-Type"], "image/png");
  assert.equal(downloads, 1);
  for (const rows of [[], [{ service: { isActive: false }, company: null }], [{ service: { isActive: true, companyId: 7 }, company: { isActive: false } }]]) {
    imageRows = rows;
    assert.equal((await request("get", "/objects/:objectPath(*)", { path: imagePath })).code, 401);
  }
  assert.equal(downloads, 1, "Private image bytes must not be fetched for visitors");
} finally { server.close(); await pool.end(); }
console.log("Passed: public search entry/routing, exact/semantic filters, maps, details, catalogs, guest booking prompt, safe sign-in return, authenticated booking, public API access, published images, and private image/write protection.");
