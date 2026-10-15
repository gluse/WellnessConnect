import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";

globalThis.React = React;
globalThis.window = { location: { pathname: "/administration", search: "", hash: "" }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Administration } = await import("../client/src/pages/administration.tsx");
const { isAllowedAuthReturnTo } = await import("../shared/navigation.ts");
const { act, create } = renderer;
const user = { id: "support-user", email: "support@example.com" };
const entry = { id: "registered-user", name: "Registered Customer", email: "customer@example.com", emailVerified: false, accountStatus: "active", companies: [{ id: 7, name: "Acme Wellness", role: "admin", isActive: true }], createdAt: "2026-10-01T10:00:00Z", lastSignInAt: null };
let component, location, allowed = true, requests = [], userStatus = 200, accessStatus = 200, empty = false, hold = false, release;
globalThis.fetch = async url => {
  requests.push(url);
  if (url === "/api/admin/access") return new Response(JSON.stringify({ isAdmin: allowed }), { status: accessStatus });
  const parsed = new URL(url, "http://localhost");
  assert.equal(parsed.pathname, "/api/admin/users");
  const page = Number(parsed.searchParams.get("page"));
  const pageSize = Number(parsed.searchParams.get("pageSize"));
  const result = { users: empty ? [] : [{ ...entry, name: page === 1 ? entry.name : "Second page user" }], page, pageSize, total: empty ? 0 : 51, totalPages: empty ? 1 : Math.ceil(51 / pageSize), hasNextPage: page === 1 && !empty };
  const response = () => new Response(JSON.stringify(userStatus === 200 ? result : { message: "Unavailable" }), { status: userStatus });
  if (hold) return new Promise(resolve => { release = () => resolve(response()); });
  return response();
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
const button = label => component.root.findAllByType("button").find(node => node.children.includes(label));
const click = async label => { await act(async () => button(label).props.onClick()); await flush(); };
const edit = async (id, value) => act(async () => component.root.findAllByType(id.includes("search") || id.includes("registered") ? "input" : "select").find(node => node.props.id === id).props.onChange({ target: { value } }));
const submitFilters = async () => { await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush(); };
const lastParams = () => new URL(requests.filter(url => url.startsWith("/api/admin/users?")).at(-1), "http://localhost").searchParams;
async function mount(signedIn = true) {
  if (component) await act(async () => component.unmount());
  queryClient.clear(); requests = [];
  queryClient.setQueryData(["/api/auth/user"], signedIn ? user : null);
  location = memoryLocation({ path: "/administration", record: true });
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(Router, { hook: location.hook }, React.createElement(Switch, null,
      React.createElement(Route, { path: "/administration", component: Administration }),
      React.createElement(Route, { path: "/login" }, React.createElement("p", null, "Sign in")))))); });
  await flush(); await flush();
}
await mount(false);
assert.equal(location.history.at(-1), "/login?returnTo=%2Fadministration");
assert.deepEqual(requests, []);
assert.equal(isAllowedAuthReturnTo("/administration"), true);
assert.equal(isAllowedAuthReturnTo("/administration/other"), false);
assert.equal(isAllowedAuthReturnTo("//example.com/administration"), false);
allowed = false;
await mount();
assert.ok(component.root.findByProps({ role: "alert" }));
assert.deepEqual(requests, ["/api/admin/access"], "Regular users must not request the user directory");
allowed = true; hold = true;
await mount();
assert.ok(component.root.findByProps({ role: "status" }).children.includes("Loading registered users…"));
hold = false;
await act(async () => release()); await flush();
assert.ok(component.root.findAllByType("td").some(node => node.children.includes(entry.email)));
assert.ok(component.root.findAllByType("td").some(node => node.children.includes("Never")), "Show accounts without a first sign-in");
assert.equal(button("Previous").props.disabled, true);
assert.equal(button("Next").props.disabled, false);
await click("Next"); await flush();
assert.equal(lastParams().get("page"), "2");
assert.equal(button("Next").props.disabled, true);
assert.equal(button("Previous").props.disabled, false);
await click("Previous"); await flush();
assert.ok(component.root.findAllByType("td").some(node => node.children.includes(entry.email)));
assert.ok(component.root.findAllByType("p").some(node => node.children.includes("Acme Wellness")));
assert.ok(component.root.findAllByType("th").some(node => node.children.includes("Account status")));
assert.ok(component.root.findAllByType("th").some(node => node.children.includes("Email verification")));
await click("Next"); await flush();
const beforeDraft = requests.length;
for (const [id, value] of [["admin-user-search", " customer@ "], ["admin-company-search", "Acme"], ["admin-email-status", "pending"], ["admin-account-status", "active"], ["admin-registered-from", "2026-10-01"], ["admin-registered-to", "2026-10-15"], ["admin-sort-by", "name"], ["admin-sort-direction", "asc"]]) await edit(id, value);
assert.equal(requests.length, beforeDraft, "Editing drafts must not fetch a full directory on each keystroke");
await submitFilters(); await flush();
assert.equal(lastParams().get("page"), "1", "Applying filters resets pagination");
for (const [key, value] of Object.entries({ search: "customer@", company: "Acme", emailStatus: "pending", accountStatus: "active", registeredFrom: "2026-10-01", registeredTo: "2026-10-15", sortBy: "name", sortDirection: "asc", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })) assert.equal(lastParams().get(key), value);
await edit("admin-page-size", "25"); await flush();
assert.equal(lastParams().get("pageSize"), "25");
assert.equal(lastParams().get("page"), "1");
assert.equal(lastParams().get("company"), "Acme", "Paging must retain all applied filters");
const beforeInvalid = requests.length;
await edit("admin-registered-to", "2026-09-01"); await submitFilters();
assert.equal(requests.length, beforeInvalid);
assert.ok(component.root.findByProps({ role: "alert" }));
await click("Clear filters"); await flush();
assert.equal(lastParams().get("search"), "");
assert.equal(lastParams().get("accountStatus"), "all");
assert.equal(component.root.findAllByProps({ role: "alert" }).length, 0);
userStatus = 503;
await click("Refresh");
assert.ok(component.root.findByProps({ role: "alert" }));
assert.equal(component.root.findAllByType("table").length, 0, "Hide stale directory rows when a refresh fails");
userStatus = 200;
await click("Try again");
assert.equal(component.root.findAllByProps({ role: "alert" }).length, 0);
userStatus = 403;
await click("Refresh"); await flush();
assert.equal(component.root.findAllByType("table").length, 0);
assert.equal(queryClient.getQueryData(["/api/admin/access"]).isAdmin, false);
assert.equal(queryClient.getQueriesData({ queryKey: ["/api/admin/users"] }).some(([, data]) => Boolean(data)), false, "Revoked support access must discard cached directory records");
userStatus = 200; empty = true;
await mount();
assert.ok(component.root.findAllByType("p").some(node => node.children.includes("No registered users yet.")));
userStatus = 401;
await mount();
assert.equal(location.history.at(-1), "/login?returnTo=%2Fadministration");
assert.equal(queryClient.getQueryData(["/api/auth/user"]), null);
userStatus = 200; accessStatus = 503;
await mount();
assert.ok(component.root.findByProps({ role: "alert" }));
assert.deepEqual(requests, ["/api/admin/access"]);
accessStatus = 200;
await click("Try again"); await flush();
assert.equal(component.root.findAllByProps({ role: "alert" }).length, 0);
await act(async () => component.unmount()); queryClient.clear();
delete globalThis.window; delete globalThis.document;

// Exercise the registered backend middleware and real Supabase SDK, with Auth
// HTTP mocked. No live accounts, database records, or privileges are changed.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.APP_ADMIN_USER_IDS = " support-user, other-support-user ";
process.env.NODE_ENV = "test";
const { setupAdminRoutes } = await import("../server/adminRoutes.ts");
const { isAuthenticated } = await import("../server/auth.ts");
const { isAppAdmin, requireAppAdmin } = await import("../server/appAdmin.ts");
const { pool } = await import("../server/db.ts");
const { companyAffiliations } = await import("../server/admin-directory.ts");
const routes = [];
const companyLinks = companyAffiliations([
  { id: 7, name: "Acme Wellness", ownerId: "other-support-user", isActive: true },
  { id: 8, name: "Closed Organization", ownerId: entry.id, isActive: false },
], [
  { companyId: 7, userId: entry.id, role: "admin" },
  { companyId: 8, userId: entry.id, role: "owner" },
  { companyId: 7, userId: "outside-user", role: "viewer" },
]);
assert.equal(companyLinks.get(entry.id).length, 2, "Owners and memberships must not duplicate a company");
assert.equal(companyLinks.get("other-support-user")[0].role, "owner", "Include owners even without a membership");
let companyRequests = 0, companyUnavailable = false;
setupAdminRoutes({ get(path, ...handlers) { routes.push({ path, handlers }); } }, async () => {
  companyRequests++;
  if (companyUnavailable) throw new Error("Database unavailable");
  return companyLinks;
});
const directory = routes.find(route => route.path === "/api/admin/users");
assert.equal(directory.handlers[0], isAuthenticated);
assert.equal(directory.handlers[1], requireAppAdmin);
assert.equal(isAppAdmin(undefined), false);
assert.equal(isAppAdmin("support-user"), true);
assert.equal(isAppAdmin("support"), false);
let activeUser = "support-user", authUnavailable = false, listUnavailable = false, failSecondBatch = false, sdkRequests = [];
const rawUsers = Array.from({ length: 1001 }, (_, i) => ({ id: `user-${String(i).padStart(4, "0")}`, email: `fixture-${i}@example.com`, created_at: "2026-09-01T00:00:00Z", user_metadata: { first_name: `Directory user ${i}`, secret_note: "private" }, app_metadata: { secret: "private" }, identities: [{ secret: "private" }], phone: "private" }));
rawUsers[0] = { ...rawUsers[0], id: entry.id, email: entry.email, created_at: entry.createdAt, user_metadata: { first_name: "New", last_name: "Registrant", accountStatus: "blocked", banned_until: "2099-01-01T00:00:00Z" } };
rawUsers[1] = { ...rawUsers[1], user_metadata: { full_name: "Alpha Verified" }, email_confirmed_at: entry.createdAt, banned_until: new Date(Date.now() + 86400_000).toISOString() };
rawUsers[2] = { ...rawUsers[2], user_metadata: { name: "beta Verified" }, email_confirmed_at: entry.createdAt, banned_until: "2000-01-01T00:00:00Z" };
rawUsers[3] = { ...rawUsers[3], deleted_at: entry.createdAt };
rawUsers[1000] = { ...rawUsers[1000], id: "outside-user", email: "outside@example.com", user_metadata: { full_name: "Outside First Batch", requested_company_name: "Untrusted Organization" }, created_at: "2026-10-01T21:30:00Z" };
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  assert.equal(url.origin, process.env.SUPABASE_URL);
  if (url.pathname === "/auth/v1/user") {
    if (authUnavailable) return new Response('{"msg":"Invalid token"}', { status: 401 });
    return new Response(JSON.stringify({ id: activeUser, email: "test@example.com", user_metadata: { isAdmin: true, role: "admin" }, app_metadata: {}, email_confirmed_at: entry.createdAt }));
  }
  assert.equal(url.pathname, "/auth/v1/admin/users");
  sdkRequests.push({ page: url.searchParams.get("page"), size: url.searchParams.get("per_page") });
  const batch = Number(url.searchParams.get("page")), size = Number(url.searchParams.get("per_page"));
  if (listUnavailable || (failSecondBatch && batch === 2)) return new Response('{"msg":"Unavailable"}', { status: 400 });
  return new Response(JSON.stringify({ users: rawUsers.slice((batch - 1) * size, batch * size) }),
    { headers: { "x-total-count": "1001", link: '<http://localhost?page=2>; rel="last"' } });
};
async function request(path, { signedIn = true, query = {} } = {}) {
  const req = { query, sessionID: "fixture-session", session: { auth: signedIn ? { userId: activeUser, accessToken: "fixture-access", refreshToken: "fixture-refresh", expiresAt: Date.now() / 1000 + 3600 } : undefined, destroy(callback) { this.auth = undefined; callback(); } } };
  const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, set(name, value) { this.headers[name] = value; return this; }, json(body) { this.body = body; return this; } };
  for (const handler of routes.find(route => route.path === path).handlers) {
    let continued = false;
    await handler(req, res, () => { continued = true; });
    if (!continued) break;
  }
  return res;
}
try {
  assert.equal((await request("/api/admin/users", { signedIn: false })).code, 401);
  activeUser = "company-owner";
  assert.deepEqual((await request("/api/admin/access")).body, { isAdmin: false });
  assert.equal((await request("/api/admin/users")).code, 403, "Company roles and self-written metadata cannot grant support access");
  assert.equal(sdkRequests.length, 0);
  assert.equal(companyRequests, 0, "Unauthorized users must not load organization data");
  activeUser = "support-user";
  assert.deepEqual((await request("/api/admin/access")).body, { isAdmin: true });
  for (const query of [{ page: "0" }, { page: "-1" }, { page: "1.5" }, { page: "oops" }, { page: "100001" }, { page: ["1", "2"] }, { page: "1", perPage: "100000" }, { pageSize: "10000" }, { search: "x".repeat(201) }, { company: ["Acme", "Other"] }, { emailStatus: "anything" }, { accountStatus: "anything" }, { registeredFrom: "2026-02-30" }, { registeredFrom: "2026-10-02", registeredTo: "2026-10-01" }, { timezone: "Invalid/Zone" }, { sortBy: "password" }, { sortDirection: "anything" }]) assert.equal((await request("/api/admin/users", { query })).code, 400);
  assert.equal(sdkRequests.length, 0, "Invalid pagination must not call privileged APIs");
  assert.equal(companyRequests, 0);
  const first = await request("/api/admin/users");
  assert.equal(first.code, 200);
  assert.equal(first.headers["Cache-Control"], "no-store");
  assert.deepEqual(sdkRequests.slice(-2), [{ page: "1", size: "1000" }, { page: "2", size: "1000" }]);
  assert.equal(first.body.users.length, 50);
  assert.deepEqual(first.body.users.find(item => item.id === entry.id), { ...entry, name: "New Registrant", companies: companyLinks.get(entry.id) });
  assert.equal(first.body.hasNextPage, true);
  assert.equal(first.body.total, 1001);
  assert.equal(first.body.totalPages, 21);
  assert.equal(JSON.stringify(first.body).includes("private"), false, "Only explicit directory fields may leave the backend");
  const later = await request("/api/admin/users", { query: { page: "13" } });
  assert.equal(later.body.page, 13);
  assert.equal(later.body.users.length, 50, "Pagination must work beyond page nine");
  const lookup = async query => (await request("/api/admin/users", { query })).body;
  const outside = await lookup({ search: "OUTSIDE@EXAMPLE.COM" });
  assert.deepEqual(outside.users.map(item => item.id), ["outside-user"], "Search must find users past the first Auth batch");
  assert.equal(outside.total, 1);
  const organizations = await lookup({ company: "ACME" });
  assert.equal(organizations.total, 2);
  assert.equal(organizations.users.find(item => item.id === "outside-user").companies[0].role, "viewer");
  assert.equal((await lookup({ company: "Closed Organization" })).total, 1);
  assert.equal((await lookup({ company: "Untrusted Organization" })).total, 0, "Signup metadata must not invent organization memberships");
  const verifiedBlocked = await lookup({ emailStatus: "verified", accountStatus: "blocked" });
  assert.deepEqual(verifiedBlocked.users.map(item => item.id), [rawUsers[1].id]);
  const verifiedActive = await lookup({ emailStatus: "verified", accountStatus: "active" });
  assert.deepEqual(verifiedActive.users.map(item => item.id), [rawUsers[2].id], "Expired bans count as active");
  assert.equal((await lookup({ accountStatus: "blocked" })).total, 2, "Current bans and deleted accounts are blocked");
  const pendingActive = await lookup({ search: entry.email, emailStatus: "pending", accountStatus: "active" });
  assert.equal(pendingActive.total, 1, "Unverified email and forged metadata must not imply a blocked account");
  const localDay = await lookup({ registeredFrom: "2026-10-02", registeredTo: "2026-10-02", timezone: "Europe/Riga" });
  assert.deepEqual(localDay.users.map(item => item.id), ["outside-user"], "Registration day boundaries must use the requested timezone");
  assert.equal((await lookup({ registeredFrom: "2026-10-01", registeredTo: "2026-10-01", timezone: "UTC" })).total, 2);
  assert.deepEqual((await lookup({ search: "Verified", sortBy: "name", sortDirection: "asc" })).users.map(item => item.name), ["Alpha Verified", "beta Verified"]);
  assert.deepEqual((await lookup({ search: "Verified", sortBy: "name", sortDirection: "desc" })).users.map(item => item.name), ["beta Verified", "Alpha Verified"]);
  assert.deepEqual(first.body.users.slice(0, 2).map(item => item.id), ["outside-user", entry.id]);
  assert.equal((await lookup({ sortBy: "registeredAt", sortDirection: "asc" })).users[0].createdAt, "2026-09-01T00:00:00Z");
  const second = await lookup({ page: "2" });
  assert.equal(new Set([...first.body.users, ...second.users].map(item => item.id)).size, 100, "Stable tie-breaking must prevent repeated rows across pages");
  const last = await lookup({ page: "100000" });
  assert.equal(last.page, 21, "Clamp pages after the result count changes");
  assert.equal(last.users.length, 1);
  assert.equal(last.hasNextPage, false);
  assert.equal((await lookup({ pageSize: "25" })).users.length, 25);
  assert.equal((await lookup({ pageSize: "100" })).users.length, 100);
  const nothing = await lookup({ search: "no-such-registered-user", page: "10" });
  assert.deepEqual({ total: nothing.total, page: nothing.page, users: nothing.users }, { total: 0, page: 1, users: [] });
  failSecondBatch = true;
  assert.equal((await request("/api/admin/users")).code, 503, "A failed later Auth batch must not return partial search results");
  failSecondBatch = false; companyUnavailable = true;
  assert.equal((await request("/api/admin/users")).code, 503, "Do not silently omit organization data on database failure");
  companyUnavailable = false;
  listUnavailable = true;
  const failure = await request("/api/admin/users");
  assert.equal(failure.code, 503);
  assert.deepEqual(Object.keys(failure.body), ["message"]);
  listUnavailable = false;
  delete process.env.APP_ADMIN_USER_IDS;
  assert.equal((await request("/api/admin/users")).code, 403, "Empty configuration must deny support access, even for an existing session");
  process.env.APP_ADMIN_USER_IDS = "support-user"; authUnavailable = true;
  assert.equal((await request("/api/admin/users")).code, 401);
} finally { await pool.end(); }
console.log("Passed: administration filters, both statuses, company affiliations/search, global search/sorting, timezone date ranges, paging, validation, refresh/retry, authorization, revocation, and response privacy. External services are mocked.");
