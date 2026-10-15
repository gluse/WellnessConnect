import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClientProvider } from "@tanstack/react-query";

globalThis.React = React;
globalThis.window = {
  location: { pathname: "/account", search: "", hash: "" },
  addEventListener() {}, removeEventListener() {},
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Account } = await import("../client/src/pages/account.tsx");
const { act, create } = renderer;
const originalUser = { id: "fixture-user", email: "fixture@example.com", firstName: "Old", lastName: "Name", currentRole: "seeker" };
const workspace = { company: { name: "Example company" }, workspaces: [] };
let currentUser = { ...originalUser };
let responseStatus = 200;
const writes = [];
globalThis.fetch = async (url, options = {}) => {
  if (url === "/api/auth/user" && options.method === "PATCH") {
    const names = JSON.parse(options.body);
    writes.push(names);
    if (responseStatus !== 200) return new Response(JSON.stringify({ message: "Unable to save" }), { status: responseStatus });
    currentUser = { ...currentUser, ...names };
    return new Response(JSON.stringify(currentUser));
  }
  if (url === "/api/auth/user") return new Response(JSON.stringify(currentUser));
  if (url === "/api/company/context") return new Response(JSON.stringify(workspace));
  throw new Error(`Unexpected request: ${url}`);
};
queryClient.setQueryData(["/api/auth/user"], currentUser);
queryClient.setQueryData(["/api/company/context"], workspace);
const location = memoryLocation({ path: "/account", record: true });
let component;
await act(async () => {
  component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: location.hook }, React.createElement(Account))));
});
const input = id => component.root.findAllByType("input").find(node => node.props.id === id);
const edit = async (id, value) => act(async () => input(id).props.onChange({ target: { value } }));
const submit = async () => {
  await act(async () => {
    component.root.findByProps({ id: "account-details-form" }).props.onSubmit({ preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 40));
  });
};
assert.equal(input("account-name").props.value, "Old");
assert.equal(input("account-surname").props.value, "Name");
assert.ok(component.root.findAllByType("dd").some(node => node.children.includes("fixture@example.com")));
assert.ok(component.root.findAllByType("dd").some(node => node.children.includes("Example company")));
assert.equal(component.root.findAllByProps({ role: "dialog" }).length, 0);
await edit("account-name", "  Āna  ");
await edit("account-surname", "  O’Neil-Smith  ");
await submit();
assert.deepEqual(writes[0], { firstName: "Āna", lastName: "O’Neil-Smith" });
assert.equal(queryClient.getQueryData(["/api/auth/user"]).firstName, "Āna");
assert.equal(input("account-name").props.value, "Āna");
assert.ok(component.root.findByProps({ role: "status" }).children.includes("Account details saved."));
responseStatus = 503;
await edit("account-name", "Retry name");
await submit();
assert.ok(component.root.findByProps({ role: "alert" }).children.join("").includes("try again"));
assert.equal(input("account-name").props.value, "Retry name", "Keep edits after a failed save");
assert.equal(queryClient.getQueryData(["/api/auth/user"]).firstName, "Āna");
responseStatus = 200;
await submit();
assert.equal(queryClient.getQueryData(["/api/auth/user"]).firstName, "Retry name");
await edit("account-name", "x".repeat(101));
await submit();
assert.equal(writes.length, 3, "Reject names over the limit before sending");
responseStatus = 401;
await edit("account-name", "Expired session");
await submit();
assert.equal(queryClient.getQueryData(["/api/auth/user"]), null);
assert.equal(location.history.at(-1), "/login?returnTo=%2Faccount");
await act(async () => component.unmount());
queryClient.clear();
delete globalThis.window;
delete globalThis.document;

// Register real server routes with local dependencies stubbed. No external calls.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.SESSION_SECRET = "fixture-secret-for-local-tests-only-123456";
process.env.OPENAI_API_KEY = "fixture-key";
process.env.NODE_ENV = "test";
const { registerRoutes } = await import("../server/routes.ts");
const { storage } = await import("../server/storage.ts");
const { supabaseAdmin } = await import("../server/supabase.ts");
const { isAuthenticated } = await import("../server/auth.ts");
const { pool } = await import("../server/db.ts");
const routes = [];
const app = (_req, _res) => {};
app.set = app.use = () => app;
for (const method of ["get", "post", "put", "patch", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
const server = await registerRoutes(app);
const route = routes.find(route => route.method === "patch" && route.path === "/api/auth/user");
assert.equal(route.handlers[0], isAuthenticated, "Profile updates require authentication");
const metadataWrites = [];
const profileWrites = [];
let metadataError = null;
storage.getUser = async id => id === originalUser.id ? originalUser : undefined;
storage.updateUserNames = async (id, names) => { profileWrites.push({ id, names }); return { ...originalUser, ...names }; };
supabaseAdmin.auth.admin.updateUserById = async (id, data) => { metadataWrites.push({ id, data }); return { error: metadataError }; };
async function update(body, userId = originalUser.id) {
  let status = 200, result;
  const res = { status(code) { status = code; return this; }, json(value) { result = value; return this; } };
  await route.handlers.at(-1)({ body, user: { claims: { sub: userId } } }, res);
  return { status, result };
}
try {
  const saved = await update({ firstName: "  Āna ", lastName: " O’Neil-Smith " });
  assert.equal(saved.status, 200);
  assert.equal(saved.result.firstName, "Āna");
  assert.deepEqual(metadataWrites[0], { id: originalUser.id, data: { user_metadata: { first_name: "Āna", last_name: "O’Neil-Smith" } } });
  assert.deepEqual(profileWrites[0], { id: originalUser.id, names: { firstName: "Āna", lastName: "O’Neil-Smith" } });
  for (const body of [null, {}, { firstName: 1, lastName: "Name" }, { firstName: "x".repeat(101), lastName: "Name" }, { firstName: "Name", lastName: "Surname", id: "other-user" }, { firstName: "Name", lastName: "Surname", currentRole: "provider" }]) {
    assert.equal((await update(body)).status, 400);
  }
  assert.equal(metadataWrites.length, 1, "Invalid updates must not change authentication metadata");
  assert.equal((await update({ firstName: "", lastName: "" })).status, 200, "Names remain optional, as at signup");
  assert.equal((await update({ firstName: "Name", lastName: "Surname" }, "missing-user")).status, 404);
  metadataError = new Error("Auth service unavailable");
  assert.equal((await update({ firstName: "Name", lastName: "Surname" })).status, 503);
  assert.equal(profileWrites.length, 2, "Do not overwrite the profile when metadata cannot be saved");
  const login = routes.find(route => route.method === "post" && route.path === "/api/auth/login");
  const authUser = { id: originalUser.id, email: originalUser.email, user_metadata: { first_name: "Āna", last_name: "O’Neil-Smith", given_name: "Original", family_name: "Google name" } };
  globalThis.fetch = async url => {
    const path = new URL(url).pathname;
    if (path === "/auth/v1/token") return new Response(JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", expires_in: 3600, token_type: "bearer", user: authUser }));
    if (path === "/auth/v1/user") return new Response(JSON.stringify(authUser));
    throw new Error(`Unexpected auth request: ${path}`);
  };
  let restoredProfile;
  storage.upsertUser = async data => { restoredProfile = data; return { ...originalUser, ...data }; };
  async function signIn() {
    const req = { body: { email: originalUser.email, password: "fixture-password" }, session: { regenerate(callback) { callback(); }, save(callback) { callback(); } } };
    let status = 200;
    await login.handlers.at(-1)(req, { status(code) { status = code; return this; }, json() {} }, error => { throw error; });
    assert.equal(status, 200);
  }
  await signIn();
  assert.equal(restoredProfile.firstName, "Āna", "Edited names survive a new sign-in");
  assert.equal(restoredProfile.lastName, "O’Neil-Smith");
  authUser.user_metadata.first_name = "";
  authUser.user_metadata.last_name = "";
  await signIn();
  assert.equal(restoredProfile.firstName, null, "Clearing a name must not restore the original Google name");
  assert.equal(restoredProfile.lastName, null);
  let nextCalled = false, unauthorizedStatus;
  await isAuthenticated({ session: {} }, { status(code) { unauthorizedStatus = code; return this; }, json() {} }, () => { nextCalled = true; });
  assert.equal(unauthorizedStatus, 401);
  assert.equal(nextCalled, false);
} finally {
  server.close();
  await pool.end();
}
console.log("Passed: account form, saves, cache refresh, validation, retry, expired sessions, authenticated updates, and name persistence across sign-ins.");
