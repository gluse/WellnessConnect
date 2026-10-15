import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

globalThis.React = React;
globalThis.window = { location: { pathname: "/account", search: "", hash: "", assign: url => destinations.push(url) }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Account } = await import("../client/src/pages/account.tsx");
const { act, create } = renderer;
const user = { id: "fixture-user", email: "fixture@example.com", firstName: "Test" };
const destinations = [], writes = [];
let status = 200, requiresSignIn = false, hold = false, resolveWrite, component, location, responseMode = "json";
globalThis.fetch = async (url, options = {}) => {
  if (url === "/api/auth/user") return new Response(JSON.stringify(requiresSignIn ? null : user));
  if (url === "/api/company/context") return new Response('{"company":null,"workspaces":[]}');
  assert.equal(url, "/api/auth/password");
  assert.equal(options.method, "POST");
  writes.push(JSON.parse(options.body));
  const response = () => responseMode === "html" ? new Response("<!doctype html><html><body>Frontend fallback</body></html>", { status: 200, headers: { "Content-Type": "text/html" } })
    : responseMode !== "json" ? new Response(responseMode === "invalid-json" ? "{" : responseMode === "null" ? "null" : '{"success":true}', { status: 200, headers: { "Content-Type": "application/json" } })
    : new Response(JSON.stringify(status === 200 ? { success: true, requiresSignIn } : { message: status === 400 ? "Current password is incorrect." : "Unable to update your password. Please try again." }), { status, headers: { "Content-Type": "application/json" } });
  if (hold) return new Promise(resolve => { resolveWrite = () => resolve(response()); });
  return response();
};
async function mount() {
  queryClient.setQueryData(["/api/auth/user"], user);
  queryClient.setQueryData(["/api/company/context"], { company: null, workspaces: [] });
  location = memoryLocation({ path: "/account", record: true });
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: location.hook }, React.createElement(Account)))); });
}
const input = id => component.root.findAllByType("input").find(node => node.props.id === `account-${id}-password`);
const edit = async (id, value) => act(async () => input(id).props.onChange({ target: { value } }));
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
const submit = async () => { await act(async () => component.root.findByProps({ id: "account-password-form" }).props.onSubmit({ preventDefault() {} })); await flush(); };
const fill = async (current = "OriginalPassword1!", next = "NewPassword2!") => { await edit("current", current); await edit("new", next); await edit("confirm", next); };
await mount();
assert.equal(component.root.findAllByType("form").length, 2);
assert.equal(input("current").props.type, "password");
assert.equal(input("new").props.autoComplete, "new-password");
await submit();
assert.equal(writes.length, 0);
await fill("OriginalPassword1!", "short");
await submit();
assert.equal(writes.length, 0);
await fill();
await edit("confirm", "DifferentPassword2!");
await submit();
assert.equal(writes.length, 0);
await fill("OriginalPassword1!", "OriginalPassword1!");
await submit();
assert.equal(writes.length, 0);
await fill();
for (const mode of ["html", "invalid-json", "null", "incomplete"]) {
  responseMode = mode;
  await submit();
  assert.ok(component.root.findAllByProps({ role: "alert" }).some(node => node.children.join("").includes("Could not confirm the password update")), `Explain an unexpected ${mode} response even when the HTTP status is 200`);
  assert.equal(input("new").props.value, "NewPassword2!");
  assert.ok(!component.root.findAllByProps({ role: "status" }).some(node => node.children.includes("Password updated.")), "Do not report an invalid response as a successful password change");
}
responseMode = "json";
await fill(" original password ", " NewPassword2! ");
await submit();
assert.deepEqual(writes.at(-1), { currentPassword: " original password ", newPassword: " NewPassword2! " }, "Do not trim passwords or send confirmation");
for (const name of ["current", "new", "confirm"]) assert.equal(input(name).props.value, "");
assert.ok(component.root.findAllByProps({ role: "status" }).some(node => node.children.includes("Password updated.")));
status = 400;
await fill();
await submit();
assert.equal(queryClient.getQueryData(["/api/auth/user"]).id, user.id, "A wrong password must not log out the user");
assert.equal(input("new").props.value, "NewPassword2!", "Keep the draft for retry");
assert.ok(component.root.findAllByProps({ role: "alert" }).some(node => node.children.includes("Current password is incorrect.")));
status = 200; hold = true;
await submit();
const pendingWrites = writes.length;
await submit();
assert.equal(writes.length, pendingWrites, "Prevent duplicate submissions while pending");
assert.equal(component.root.findByProps({ id: "account-password-form" }).findByType("fieldset").props.disabled, true);
hold = false;
await act(async () => resolveWrite());
await flush();
assert.equal(input("new").props.value, "");
status = 401;
await fill();
await submit();
assert.equal(queryClient.getQueryData(["/api/auth/user"]), null);
assert.equal(location.history.at(-1), "/login?returnTo=%2Faccount");
await act(async () => component.unmount());
await mount();
status = 200; requiresSignIn = true;
await fill();
await submit();
assert.equal(destinations.at(-1), "/login?returnTo=%2Faccount&passwordUpdated=1");
await act(async () => component.unmount());
queryClient.clear();
delete globalThis.window; delete globalThis.document;

// Exercise the real Supabase client against mocked HTTP responses. No external writes.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.SESSION_SECRET = "fixture-secret-for-local-tests-only-123456";
process.env.NODE_ENV = "test";
const { setupAuth, isAuthenticated, requireSameOrigin } = await import("../server/auth.ts");
const { pool } = await import("../server/db.ts");
const routes = [], middleware = [];
const app = { set() {}, use(...handlers) { middleware.push(handlers); }, get(path, ...handlers) { routes.push({ method: "get", path, handlers }); }, post(path, ...handlers) { routes.push({ method: "post", path, handlers }); } };
await setupAuth(app);
const route = routes.find(item => item.path === "/api/auth/password");
assert.equal(route.handlers[0], isAuthenticated);
assert.equal(route.handlers.length, 3, "Require authentication and rate limiting before the handler");
assert.ok(middleware.some(args => args[0] === "/api" && args[1] === requireSameOrigin));
const authUser = { id: user.id, email: user.email, user_metadata: {}, app_metadata: {}, email_confirmed_at: new Date().toISOString() };
let mode = "success", calls = [], failSave = false, failRegenerate = false;
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  const body = options.body ? JSON.parse(options.body) : undefined;
  calls.push({ path: parsed.pathname, method: options.method, body, scope: parsed.searchParams.get("scope") });
  if (parsed.pathname === "/auth/v1/token") {
    if (mode === "wrong-password") return new Response('{"code":"invalid_credentials","msg":"Invalid login credentials"}', { status: 400 });
    if (mode === "rate-limit") return new Response('{"code":"over_request_rate_limit","msg":"Too many requests"}', { status: 429 });
    if (mode === "verify-unavailable") return new Response('{"code":"unexpected_failure","msg":"Unavailable"}', { status: 500 });
    return new Response(JSON.stringify({ access_token: "fresh-fixture-access", refresh_token: "fresh-fixture-refresh", expires_in: 3600, token_type: "bearer", user: mode === "wrong-user" ? { ...authUser, id: "other-user" } : authUser }));
  }
  if (parsed.pathname === "/auth/v1/user" && options.method === "PUT") {
    if (mode === "weak-password") return new Response('{"code":"weak_password","msg":"Weak password","weak_password":{"reasons":["length"]}}', { status: 422 });
    if (mode === "update-unavailable") return new Response('{"code":"unexpected_failure","msg":"Unavailable"}', { status: 500 });
    return new Response(JSON.stringify(authUser));
  }
  if (parsed.pathname === "/auth/v1/user") return new Response(JSON.stringify(authUser));
  if (parsed.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
  throw new Error(`Unexpected auth request: ${parsed.pathname}`);
};
async function update(body = { currentPassword: "OriginalPassword1!", newPassword: "NewPassword2!" }) {
  calls = [];
  let status = 200, result, regenerated = 0, destroyed = false, clearedCookie;
  const req = { body, user: { claims: { sub: user.id }, email: user.email }, session: {
    auth: { userId: user.id, accessToken: "old-access", refreshToken: "old-refresh", expiresAt: Date.now() / 1000 + 3600 }, activeCompanyId: 77, canSetInvitationPassword: true,
    regenerate(callback) { regenerated++; this.auth = undefined; this.activeCompanyId = undefined; this.canSetInvitationPassword = undefined; callback(failRegenerate ? new Error("Session unavailable") : null); },
    save(callback) { callback(failSave ? new Error("Session unavailable") : null); },
    destroy(callback) { destroyed = true; this.auth = undefined; callback(); },
  } };
  const res = { status(code) { status = code; return this; }, json(data) { result = data; return this; }, clearCookie(name) { clearedCookie = name; } };
  await route.handlers.at(-1)(req, res);
  return { status, result, req, regenerated, destroyed, clearedCookie };
}
try {
  for (const body of [null, {}, { currentPassword: "", newPassword: "NewPassword2!" }, { currentPassword: "old", newPassword: "short" }, { currentPassword: "same-password", newPassword: "same-password" }, { currentPassword: "old", newPassword: "x".repeat(129) }, { currentPassword: "old", newPassword: "NewPassword2!", email: "other@example.com" }, { currentPassword: "old", newPassword: "NewPassword2!", userId: "other-user" }]) {
    assert.equal((await update(body)).status, 400);
    assert.equal(calls.length, 0, "Reject invalid or targeted payloads before authentication calls");
  }
  mode = "wrong-password";
  assert.equal((await update()).status, 400);
  assert.ok(!calls.some(call => call.method === "PUT"));
  mode = "wrong-user";
  assert.equal((await update()).status, 403);
  assert.ok(!calls.some(call => call.method === "PUT"));
  assert.equal(calls.find(call => call.path.endsWith("logout")).scope, "local");
  mode = "weak-password";
  assert.equal((await update()).status, 400);
  assert.equal(calls.find(call => call.path.endsWith("logout")).scope, "local");
  mode = "rate-limit";
  assert.equal((await update()).status, 429);
  for (const unavailable of ["verify-unavailable", "update-unavailable"]) { mode = unavailable; assert.equal((await update()).status, 503); }
  mode = "success";
  const saved = await update();
  assert.deepEqual(saved.result, { success: true, requiresSignIn: false });
  assert.equal(saved.regenerated, 1);
  assert.equal(saved.req.session.auth.accessToken, "fresh-fixture-access");
  assert.equal(saved.req.session.auth.refreshToken, "fresh-fixture-refresh");
  assert.equal(saved.req.session.activeCompanyId, 77);
  assert.equal(saved.req.session.canSetInvitationPassword, undefined);
  assert.equal(calls.find(call => call.path.endsWith("token")).body.email, user.email);
  const passwordUpdate = calls.find(call => call.method === "PUT").body;
  assert.equal(passwordUpdate.password, "NewPassword2!");
  assert.equal(passwordUpdate.current_password, "OriginalPassword1!");
  assert.ok(!calls.some(call => call.path.includes("admin")), "Use authenticated updates rather than bypassing password policies");
  assert.ok(!calls.some(call => call.path.endsWith("logout")), "Keep the newly verified session on success");
  for (const operation of ["save", "regenerate"]) {
    failSave = operation === "save"; failRegenerate = operation === "regenerate";
    const partial = await update();
    assert.deepEqual(partial.result, { success: true, requiresSignIn: true }, "Report an already changed password accurately if session storage fails");
    assert.equal(partial.destroyed, true);
    assert.equal(partial.clearedCookie, "wellness.sid");
  }
  let unauthorizedStatus, nextCalled = false;
  await isAuthenticated({ session: {} }, { status(code) { unauthorizedStatus = code; return this; }, json() {} }, () => { nextCalled = true; });
  assert.equal(unauthorizedStatus, 401); assert.equal(nextCalled, false);
} finally { await pool.end(); }
console.log("Passed: password form validation, retry, pending state, session expiry, authenticated password verification, policy failures, session rotation, and partial-success handling.");
