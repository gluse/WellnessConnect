import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { storefrontSchema, storefrontSlugSchema, subscriptionOptionsSchema, subscriptionUpdateSchema, hasPro, StorefrontError } from "../shared/storefront.ts";
import { isAllowedAuthReturnTo } from "../shared/navigation.ts";
import { categoryFixtures } from "./fixtures/categories.mjs";

const translation = JSON.parse(await readFile(new URL("../client/public/locales/en/translation.json", import.meta.url), "utf8"));
await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation } } });
for (const locale of ["lv","ru","de","fr","es","pt","ar","ja","zh","hi"]) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const [key, value] of Object.entries(translation.storefront)) {
    assert.ok(data.storefront[key], `${locale}: missing ${key}`);
    assert.deepEqual(data.storefront[key].match(/{{\w+}}/g) ?? [], value.match(/{{\w+}}/g) ?? [], `${locale}: placeholders for ${key}`);
  }
}
const future = new Date(Date.now() + 86400_000).toISOString();
const target = { kind: "company", id: 7 };
const draft = { slug: "riga-studio", name: "Riga studio", description: "About our studio", logoUrl: null, coverUrl: null, isPublished: false };
assert.equal(hasPro({ plan: "pro", proUntil: future }), true);
assert.equal(hasPro({ plan: "pro", proUntil: new Date(1000) }, 1000), false, "Expiry boundary is exclusive");
for (const subscription of [null, { plan: "free", proUntil: future }, { plan: "pro", proUntil: null }, { plan: "pro", proUntil: "invalid" }]) assert.equal(hasPro(subscription), false);
for (const slug of ["bad space", "UPPER", "ab", "a--b", "-abc", "abc-", "../account", "a".repeat(65)]) assert.equal(storefrontSlugSchema.safeParse(slug).success, false);
for (const path of ["/providers/riga-studio", "/providers/riga-studio?book=23", "/my-services/settings/storefront"]) assert.equal(isAllowedAuthReturnTo(path), true);
for (const path of ["//evil.test/providers/store", "/providers/store?returnTo=//evil.test", "/providers/store/../../account", "/providers/store?book=1&next=evil", "/providers/store?book=0"]) assert.equal(isAllowedAuthReturnTo(path), false);
for (const input of [{ ...draft, companyId: 8 }, { ...draft, subscriptionId: 1 }, { ...draft, logoUrl: "https://external.test/image.png" }]) assert.equal(storefrontSchema.safeParse(input).success, false);
for (const input of [{ target, plan: "pro", proUntil: null }, { target, plan: "pro", proUntil: new Date(0).toISOString() }, { target, plan: "pro", proUntil: future, updatedBy: "support" }]) assert.equal(subscriptionUpdateSchema.safeParse(input).success, false);
for (const input of [{ kind: "other" }, { kind: "company", page: 0 }, { kind: "user", page: "1x" }, { kind: "company", search: "x".repeat(201) }, { kind: "user", search: ["name"] }, { kind: "company", userId: "owner" }]) assert.equal(subscriptionOptionsSchema.safeParse(input).success, false);

globalThis.React = React;
globalThis.window = { location: { origin: "http://localhost", pathname: "/providers/riga-studio", search: "", hash: "" }, history: { replaceState() {} },
  setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } } };
globalThis.document = { title: "FitsMyTime", visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: StorefrontPage, StorefrontView } = await import("../client/src/pages/storefront.tsx");
const { default: StorefrontEditor } = await import("../client/src/components/provider/storefront-editor.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { default: BookingModal, BookingSignInActions } = await import("../client/src/components/booking-modal.tsx");
const { default: Administration } = await import("../client/src/pages/administration.tsx");
const { act, create } = renderer;
const service = (id, name, category, price) => ({ id, name, category, price, duration: 30, serviceType: "one_to_one", providerId: "owner", companyId: 7, employee: null, provider: { providerType: "company", companyName: "Riga studio" } });
const services = [service(1, "Massage", "health_wellness", "30"), service(2, "Lessons", "education", "10")];
const context = { company: { id: 7, name: "Riga studio" }, membership: { role: "admin" }, permissions: { manageServices: true }, workspaces: [] };
let component, requests = [], settings = { subscription: null, hasPro: false, storefront: null }, publicStatus = 200, writeStatus = 200, adminAllowed = true, choicesStatus = 200, holdChoices = false, releaseChoices;
const userId = "c1870dc9-563f-4631-bb7d-1c0fad052b12";
const respond = (body, status = 200) => new Response(JSON.stringify(body), { status });
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method ?? "GET", body: options.body ? JSON.parse(options.body) : null });
  if (url === "/api/categories") return respond(categoryFixtures);
  if (url === "/api/admin/access") return respond({ isAdmin: adminAllowed });
  if (url.startsWith("/api/admin/users?")) return respond({ users: [], page: 1, pageSize: 50, total: 0, totalPages: 1, hasNextPage: false });
  if (url.startsWith("/api/admin/subscriptions/options?")) {
    const params = new URL(url, "http://localhost").searchParams;
    const user = params.get("kind") === "user";
    const options = user ? [{ target: { kind: "user", id: userId }, name: "Personal Provider", detail: "owner@example.test", isActive: null }]
      : [{ target, name: "Riga studio", detail: "owner@example.test · #7", isActive: true }, { target: { kind: "company", id: 8 }, name: "Second studio", detail: "other@example.test · #8", isActive: false }];
    const search = params.get("search").toLowerCase();
    const filtered = options.filter(option => `${option.name} ${option.detail}`.toLowerCase().includes(search));
    const page = Number(params.get("page"));
    const response = () => respond(choicesStatus === 200 ? { items: filtered.slice(page - 1, page), hasMore: filtered.length > page } : { message: "Lookup denied" }, choicesStatus);
    return holdChoices ? new Promise(resolve => { releaseChoices = () => resolve(response()); }) : response();
  }
  if (url.startsWith("/api/admin/subscriptions")) return respond({ name: "Riga studio", subscription: { plan: "pro", proUntil: future } }, writeStatus);
  if (url === "/api/provider/storefront") {
    if (options.method === "PUT") {
      if (writeStatus !== 200) return respond({ message: "Denied" }, writeStatus);
      settings.storefront = { id: 1, subscriptionId: 2, updatedAt: new Date().toISOString(), ...JSON.parse(options.body) }; return respond(settings.storefront);
    }
    return respond(settings);
  }
  if (url.startsWith("/api/services/catalog?")) return respond(services);
  if (url.startsWith("/api/storefronts/")) return respond(publicStatus === 200 ? { ...draft, services } : { message: "Unavailable" }, publicStatus);
  if (/\/reviews\?/.test(url)) return respond({ reviews: [], page: 1, hasMore: false });
  if (url === "/api/auth/user") return respond(null);
  throw new Error(`Unexpected request: ${url}`);
};
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
const text = () => JSON.stringify(component.toJSON());
const buttons = label => component.root.findAllByType("button").filter(node => node.children.includes(label));
const click = async label => { await act(async () => buttons(label)[0].props.onClick()); await flush(); };
const edit = async (id, value) => act(async () => component.root.findByProps({ id }).props.onChange({ target: { value } }));
async function mount(child, path = "/providers/riga-studio", signedIn = false) {
  if (component) await act(async () => component.unmount());
  queryClient.clear(); requests = [];
  queryClient.setQueryData(["/api/auth/user"], signedIn ? { id: "manager", firstName: "Manager" } : null);
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path }).hook }, child))); });
  await flush(); await flush();
}
await mount(React.createElement(Route, { path: "/providers/:slug", component: StorefrontPage }));
assert.equal(component.root.findAllByType(ServiceCard).length, 2);
assert.equal(document.title, "Riga studio | FitsMyTime");
await edit("storefront-category", "education"); assert.equal(component.root.findAllByType(ServiceCard).length, 1);
await edit("storefront-category", ""); await edit("storefront-search", "massage"); assert.equal(component.root.findAllByType(ServiceCard).length, 1);
await edit("storefront-search", "missing"); assert.ok(text().includes(translation.storefront.empty));
await edit("storefront-search", ""); await edit("storefront-sort", "price");
assert.equal(component.root.findAllByType(ServiceCard)[0].props.service.id, 2);
await act(async () => component.root.findAllByType(ServiceCard)[0].props.onBook());
assert.equal(component.root.findByType(BookingModal).props.returnTo, "/providers/riga-studio?book=2");
assert.ok(!requests.some(request => request.url.startsWith("/api/availability/") || request.url === "/api/bookings"));
publicStatus = 404;
await act(async () => queryClient.invalidateQueries({ queryKey: ["/api/storefronts"] })); await flush();
assert.ok(text().includes(translation.storefront.unavailable)); assert.equal(component.root.findAllByType(ServiceCard).length, 0, "Revocation removes stale public content");
publicStatus = 503; await mount(React.createElement(Route, { path: "/providers/:slug", component: StorefrontPage }));
assert.ok(text().includes(translation.storefront.loadError)); publicStatus = 200; await click(translation.catalog.retry);
assert.equal(component.root.findAllByType(ServiceCard).length, 2);
window.location.search = "?book=1";
await mount(React.createElement(StorefrontView, { page: { ...draft, services } }));
assert.equal(component.root.findByType(BookingModal).props.service.id, 1, "Sign-in return reopens the intended service");
window.location.search = "";
await mount(React.createElement(BookingSignInActions, { isLoading: false, onClose() {}, returnTo: "/providers/riga-studio?book=2" }));
assert.ok(component.root.findAllByType("a").some(node => node.props.href === "/login?returnTo=%2Fproviders%2Friga-studio%3Fbook%3D2"));
await mount(React.createElement(StorefrontEditor, { context }), "/my-services/settings/storefront", true);
assert.ok(text().includes(translation.storefront.proRequired)); assert.equal(component.root.findAllByType("form").length, 0);
settings = { subscription: { plan: "pro", proUntil: future }, hasPro: true, storefront: null };
await mount(React.createElement(StorefrontEditor, { context }), "/my-services/settings/storefront", true);
await edit("storefront-slug", draft.slug); await edit("storefront-description", draft.description);
await click(translation.storefront.preview);
assert.equal(component.root.findByType(StorefrontView).props.page.description, draft.description);
assert.equal(component.root.findAllByType(ServiceCard).length, 2);
await click(translation.storefront.closePreview);
await act(async () => component.root.findAllByType("input").find(node => node.props.type === "checkbox").props.onChange({ target: { checked: true } }));
assert.ok(!requests.some(request => request.method === "PUT"), "No writes until submit");
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush();
assert.ok(text().includes(translation.storefront.saved));
assert.equal(component.root.findByProps({ id: "storefront-slug" }).props.disabled, true);
assert.ok(requests.some(request => request.method === "PUT" && request.body.slug === draft.slug));
assert.equal(settings.storefront.isPublished, true);
assert.equal(component.root.findByProps({ id: "storefront-share" }).props.value, "http://localhost/providers/riga-studio");
await mount(React.createElement(StorefrontEditor, { context }), "/my-services/settings/storefront", true);
assert.equal(component.root.findByProps({ id: "storefront-name" }).props.value, "Riga studio");
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush();
assert.ok(text().includes(translation.storefront.saved), "Saved metadata does not break strict edit validation");
writeStatus = 403; await edit("storefront-name", "Updated studio");
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush();
assert.ok(text().includes(translation.storefront.proRequired)); writeStatus = 200;
await mount(React.createElement(StorefrontEditor, { context: { ...context, permissions: { manageServices: false } } }), "/my-services/settings/storefront", true);
assert.ok(text().includes(translation.storefront.denied)); assert.ok(!requests.some(request => request.url === "/api/provider/storefront"));
await mount(React.createElement(Administration), "/administration", true);
await click(translation.storefront.subscriptions);
const loadButton = () => buttons(translation.storefront.loadSubscription)[0];
const input = () => component.root.findByProps({ id: "subscription-target" });
const options = () => component.root.findAllByProps({ role: "option" });
const searchChoices = async value => { await edit("subscription-target", value); await act(async () => { await new Promise(resolve => setTimeout(resolve, 230)); }); await flush(); };
assert.equal(input().props.role, "combobox");
assert.equal(loadButton().props.disabled, true);
await act(async () => input().props.onFocus()); await flush();
await searchChoices("Personal");
assert.equal(options().length, 1);
assert.equal(loadButton().props.disabled, true, "Typing a name alone never selects a workspace");
assert.ok(!requests.some(request => request.url.startsWith("/api/admin/subscriptions?")));
await act(async () => input().props.onKeyDown({ key: "Enter", preventDefault() {} }));
assert.equal(loadButton().props.disabled, false);
assert.equal(input().props.value, "Personal Provider");
assert.equal(input().props["aria-expanded"], false);
assert.ok(text().includes("owner@example.test"));
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush();
assert.ok(requests.some(request => request.url === `/api/admin/subscriptions?kind=user&id=${userId}`));
await edit("subscription-kind", "company");
assert.equal(input().props.value, "", "Switching workspace type clears the previous selection");
assert.equal(loadButton().props.disabled, true);
assert.equal(component.root.findAllByType("form").length, 1, "The previous personal subscription cannot be edited after switching type");
assert.ok(text().includes(translation.storefront.companySearchHelp));
await act(async () => input().props.onFocus()); await flush();
assert.equal(options().length, 1);
await click(translation.storefront.moreChoices);
assert.equal(options().length, 2, "More results remain searchable/selectable beyond the first page");
assert.ok(text().includes(translation.storefront.closedCompany));
await act(async () => input().props.onKeyDown({ key: "ArrowDown", preventDefault() {} }));
assert.equal(input().props["aria-activedescendant"], "subscription-option-1");
await act(async () => input().props.onKeyDown({ key: "Escape", preventDefault() {} }));
assert.equal(options().length, 0);
await searchChoices("Riga");
assert.equal(options().length, 1);
await act(async () => options()[0].props.onClick());
assert.equal(loadButton().props.disabled, false);
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush();
assert.ok(text().includes("Riga studio"));
await searchChoices("No such company");
assert.equal(loadButton().props.disabled, true, "Editing a chosen name clears the loaded subscription");
assert.equal(component.root.findAllByType("form").length, 1);
assert.ok(text().includes(translation.storefront.noChoices));
choicesStatus = 503; await searchChoices("Riga studio");
assert.ok(text().includes(translation.storefront.choicesError)); assert.equal(options().length, 0);
choicesStatus = 200; await click(translation.catalog.retry);
await act(async () => options()[0].props.onClick());
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush();
await act(async () => component.root.findAllByType("form")[1].props.onSubmit({ preventDefault() {} })); await flush();
assert.ok(requests.some(request => request.url === "/api/admin/subscriptions" && request.body.target.kind === "company" && request.body.target.id === 7));
assert.ok(text().includes(translation.storefront.subscriptionSaved));
assert.ok(queryClient.getQueryCache().findAll({ queryKey: ["/api/admin/users"] }).every(query => query.state.isInvalidated), "Changing Pro access invalidates directory subscription statuses");
await edit("subscription-kind", "user");
assert.equal(input().props.value, "");
assert.equal(loadButton().props.disabled, true);
assert.ok(text().includes(translation.storefront.providerSearchHelp));
holdChoices = true;
await act(async () => input().props.onFocus()); await flush();
await edit("subscription-kind", "company");
holdChoices = false; await act(async () => releaseChoices()); await flush();
assert.equal(options().length, 0, "A late individual lookup cannot populate a company dropdown");
assert.equal(loadButton().props.disabled, true);
choicesStatus = 403; await act(async () => input().props.onFocus()); await flush();
assert.ok(text().includes("Application support access is required"));
assert.equal(component.root.findAllByProps({ role: "combobox" }).length, 0, "Revoked support access hides the picker"); choicesStatus = 200;
await act(async () => component.unmount()); queryClient.clear();
delete globalThis.window; delete globalThis.document;

process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture";
process.env.SUPABASE_SECRET_KEY = "fixture";
process.env.APP_ADMIN_USER_IDS = "support-user";
process.env.NODE_ENV = "test";
const { setupStorefrontRoutes } = await import("../server/storefrontRoutes.ts");
const { ImageStorageError } = await import("../server/imageStorage.ts");
const { pool } = await import("../server/db.ts");
pool.connect = pool.query = async () => { throw new Error("Unexpected database access in the offline storefront test"); };
const routes = [], middleware = [];
let activeUser = "support-user", pro = true, calls = [], forcedError, imageDenied = false;
const store = {
  async adminOptions(query) { calls.push(["adminOptions", query]); if (forcedError) throw forcedError; return { items: [], hasMore: false }; },
  async settings(selected) { calls.push(["settings", selected]); return { hasPro: pro, storefront: null }; },
  async save(selected, input) { calls.push(["save", selected]); if (forcedError) throw forcedError; return input; },
  async publicPage(slug) { if (forcedError) throw forcedError; return { ...draft, source: { companyId: 7 } }; },
  async adminGet(selected) { calls.push(["adminGet", selected]); return { name: "Studio", subscription: null }; },
  async adminUpdate(input, adminId) { calls.push(["adminUpdate", input, adminId]); return { name: "Studio", subscription: null }; },
};
setupStorefrontRoutes({ use(paths, handler) { middleware.push(handler); }, ...Object.fromEntries(["get", "put"].map(method => [method, (path, ...handlers) => routes.push({ method, path, handlers })])) }, store,
  { async searchServices(source) { calls.push(["catalog", source]); return services; } }, async () => { if (imageDenied) throw new ImageStorageError(403, "Not your image"); });
globalThis.fetch = async () => respond({ id: activeUser, email_confirmed_at: new Date().toISOString(), user_metadata: { role: "admin" }, app_metadata: {} });
async function request(method, path, { signedIn = true, body = {}, query = {}, workspace = context } = {}) {
  const req = { body, query, workspace, params: { slug: draft.slug }, sessionID: "storefront-fixture", session: { auth: signedIn ? { userId: activeUser, accessToken: "fixture", refreshToken: "fixture", expiresAt: Date.now() / 1000 + 3600 } : undefined, destroy(callback) { this.auth = undefined; callback(); } } };
  const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, set(name, value) { this.headers[name] = value; return this; }, json(body) { this.body = body; return this; } };
  for (const handler of [...middleware, ...routes.find(route => route.method === method && route.path === path).handlers]) {
    let next = false; await handler(req, res, () => { next = true; }); if (!next) break;
  }
  return res;
}
try {
  const page = await request("get", "/api/storefronts/:slug", { signedIn: false });
  assert.equal(page.code, 200); assert.equal(page.headers["Cache-Control"], "no-store"); assert.equal(page.body.source, undefined);
  assert.deepEqual(calls.at(-1), ["catalog", { companyId: 7 }]);
  for (const path of ["/api/provider/storefront", "/api/admin/subscriptions"]) {
    assert.equal((await request("get", path, { signedIn: false })).code, 401);
    assert.equal((await request("put", path, { signedIn: false })).code, 401);
  }
  assert.equal((await request("get", "/api/admin/subscriptions/options", { signedIn: false, query: { kind: "company" } })).code, 401);
  activeUser = "company-owner";
  for (const method of ["get", "put"]) assert.equal((await request(method, "/api/admin/subscriptions", { query: target })).code, 403);
  const lookups = calls.filter(call => call[0] === "adminOptions").length;
  assert.equal((await request("get", "/api/admin/subscriptions/options", { query: { kind: "company" } })).code, 403);
  assert.equal(calls.filter(call => call[0] === "adminOptions").length, lookups, "Non-admin lookup never reads directory data");
  assert.equal((await request("put", "/api/provider/storefront", { body: draft, workspace: { ...context, permissions: { manageServices: false } } })).code, 403);
  assert.equal((await request("put", "/api/provider/storefront", { body: draft, workspace: { ...context, invalid: true } })).code, 403);
  pro = false; const saves = () => calls.filter(call => call[0] === "save").length;
  const before = saves(); assert.equal((await request("put", "/api/provider/storefront", { body: draft })).code, 403); assert.equal(saves(), before);
  pro = true; assert.equal((await request("put", "/api/provider/storefront", { body: draft })).code, 200); assert.deepEqual(calls.at(-1), ["save", target]);
  assert.equal((await request("put", "/api/provider/storefront", { body: { ...draft, companyId: 8 } })).code, 400);
  imageDenied = true;
  assert.equal((await request("put", "/api/provider/storefront", { body: { ...draft, logoUrl: "/objects/other/11111111-1111-4111-8111-111111111111.png" } })).code, 403); imageDenied = false;
  activeUser = "support-user";
  const lookup = await request("get", "/api/admin/subscriptions/options", { query: { kind: "company", search: " Riga ", page: "2" } });
  assert.equal(lookup.code, 200); assert.equal(lookup.headers["Cache-Control"], "no-store");
  assert.deepEqual(calls.at(-1), ["adminOptions", { kind: "company", search: "Riga", page: 2 }]);
  for (const query of [{ kind: "other" }, { kind: "company", page: "0" }, { kind: "user", search: ["owner"] }, { kind: "company", pageSize: 1000 }]) assert.equal((await request("get", "/api/admin/subscriptions/options", { query })).code, 400);
  assert.equal((await request("put", "/api/admin/subscriptions", { body: { target, plan: "pro", proUntil: future } })).code, 200);
  assert.equal(calls.at(-1)[2], "support-user");
  assert.equal((await request("put", "/api/admin/subscriptions", { body: { target, plan: "pro", proUntil: null } })).code, 400);
  forcedError = { cause: { code: "23505" } }; assert.equal((await request("put", "/api/provider/storefront", { body: draft })).code, 409);
  forcedError = new StorefrontError(404, "Storefront not found."); assert.equal((await request("get", "/api/storefronts/:slug")).code, 404);
  forcedError = new Error("secret connection details");
  const lookupFailed = await request("get", "/api/admin/subscriptions/options", { query: { kind: "user" } });
  assert.equal(lookupFailed.code, 503); assert.ok(!JSON.stringify(lookupFailed.body).includes("secret"));
  const failed = await request("get", "/api/storefronts/:slug"); assert.equal(failed.code, 503); assert.ok(!JSON.stringify(failed.body).includes("secret"));
  console.log("Passed: storefront browsing/filtering/sorting, guest booking/return, stale page revocation, preview/edit validation, Pro upsell, admin subscription management, workspace/API permissions, strict validation, image ownership, safe errors, and 11 locale dictionaries. External services mocked.");
} finally { await pool.end(); }
