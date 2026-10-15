import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

globalThis.React = React;
const destinations = [];
globalThis.window = { location: { pathname: "/login", search: "?returnTo=%2Fmy-bookings", hash: "", assign: url => destinations.push(url) }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Login } = await import("../client/src/pages/login.tsx");
const { socialProviders, socialProviderLabels } = await import("../shared/social-auth.ts");
const { act, create } = renderer;
const allEnabled = Object.fromEntries(socialProviders.map(provider => [provider, true]));
const allDisabled = Object.fromEntries(socialProviders.map(provider => [provider, false]));
let component, flags = allEnabled, providerError = false;
const credentialRequests = [];
const socialCompanyRequests = [];
let socialCompanyError = false;
globalThis.fetch = async (url, options = {}) => {
  if (url === "/api/auth/user") return new Response("null");
  if (options.method === "POST" && socialProviders.some(provider => url === `/api/auth/${provider}`)) {
    socialCompanyRequests.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify(socialCompanyError ? { message: "Unavailable" } : { url: "https://auth.example/authorize" }), { status: socialCompanyError ? 503 : 200 });
  }
  if (url === "/api/auth/signup" || url === "/api/auth/login") {
    credentialRequests.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify(url.endsWith("signup") ? { signedIn: false, message: "Check your email." } : { success: true }));
  }
  assert.equal(url, "/api/auth/providers");
  return new Response(JSON.stringify(flags), { status: providerError ? 503 : 200 });
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
const button = label => component.root.findAllByType("button").find(node => node.children.includes(label));
const providerButtons = () => component.root.findAllByType("button").filter(node => node.children.some(child => typeof child === "string" && child.startsWith("Continue with ")));
async function mount(seed = true) {
  if (component) await act(async () => component.unmount());
  queryClient.clear();
  queryClient.setQueryData(["/api/auth/user"], null);
  if (seed) queryClient.setQueryData(["/api/auth/providers"], flags);
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(Router, { hook: memoryLocation({ path: "/login" }).hook }, React.createElement(Login)))); });
  await flush();
}
flags = allDisabled;
await mount();
assert.equal(providerButtons().length, 0, "Unconfigured providers must not offer broken sign-in buttons");
assert.ok(button("Sign in"));
flags = allEnabled;
for (const provider of socialProviders) {
  await mount();
  assert.equal(providerButtons().length, 4);
  await act(async () => button(`Continue with ${socialProviderLabels[provider]}`).props.onClick());
  assert.equal(destinations.at(-1), `/api/auth/${provider}?returnTo=%2Fmy-bookings`);
  assert.ok(providerButtons().every(node => node.props.disabled), "Prevent another login attempt while navigation is pending");
  assert.equal(button("Please wait…").props.disabled, true);
}
flags = { ...allDisabled, google: true, apple: true };
await mount();
assert.equal(providerButtons().length, 2);
assert.equal(button("Continue with Microsoft"), undefined);
window.location.search = "?returnTo=https%3A%2F%2Fevil.example";
await mount();
await act(async () => button("Continue with Google").props.onClick());
assert.equal(destinations.at(-1), "/api/auth/google?returnTo=%2F");
window.location.search = "?returnTo=%2Fmy-bookings&error=social_cancelled&error_description=untrusted-text";
await mount();
assert.match(component.root.findByProps({ role: "alert" }).children.join(""), /cancelled/);
assert.equal(JSON.stringify(component.toJSON()).includes("untrusted-text"), false);
window.location.search = "?error=social_session_expired";
await mount();
assert.match(component.root.findByProps({ role: "alert" }).children.join(""), /expired/);
window.location.search = "?error=social_disabled";
await mount();
assert.match(component.root.findByProps({ role: "alert" }).children.join(""), /unavailable/);
window.location.search = "";
providerError = true;
await mount(false);
assert.ok(button("Retry sign-in options"));
assert.equal(button("Sign in").props.disabled, false);
providerError = false; flags = allEnabled;
await act(async () => button("Retry sign-in options").props.onClick()); await flush();
assert.equal(providerButtons().length, 4);
await act(async () => button("New here? Create an account").props.onClick());
await act(async () => component.root.findAllByType("select").find(node => node.props.id === "signup-type").props.onChange({ target: { value: "company" } }));
assert.equal(providerButtons().length, 4, "Social sign-in remains available for company signup");
const input = id => component.root.findAllByType("input").find(node => node.props.id === id);
const edit = async (id, value) => act(async () => input(id).props.onChange({ target: { value } }));
const submit = async () => { await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} })); await flush(); };
await act(async () => button("Continue with Google").props.onClick());
assert.equal(socialCompanyRequests.length, 0, "Company name is required before social sign-in");
assert.equal(input("signup-company").props["aria-invalid"], true);
assert.equal(input("confirm-password").props.required, true);
assert.equal(input("confirm-password").props.type, "password");
assert.equal(input("confirm-password").props.autoComplete, "new-password");
await edit("email", "signup@example.com");
await edit("signup-company", "Test Company");
await edit("password", "Password123!");
await submit();
assert.equal(credentialRequests.length, 0, "Missing confirmation must not submit signup");
await edit("confirm-password", "DifferentPassword123!");
await submit();
assert.equal(credentialRequests.length, 0, "Mismatched passwords must not submit signup");
assert.equal(input("confirm-password").props["aria-invalid"], true);
assert.equal(component.root.findByProps({ role: "alert" }).children.join(""), "Passwords do not match.");
await edit("confirm-password", "Password123!");
assert.equal(component.root.findAllByProps({ role: "alert" }).length, 0);
await submit();
assert.equal(credentialRequests.at(-1).url, "/api/auth/signup");
assert.equal(credentialRequests.at(-1).body.accountType, "company");
assert.equal("confirmPassword" in credentialRequests.at(-1).body, false, "Confirmation stays in the form");
assert.equal(input("password").props.value, "");
assert.equal(input("confirm-password").props.value, "");
await act(async () => component.root.findAllByType("select").find(node => node.props.id === "signup-type").props.onChange({ target: { value: "personal" } }));
await edit("password", " Password123! ");
await edit("confirm-password", "Password123!");
await submit();
assert.equal(credentialRequests.length, 1, "Passwords must match exactly, including spaces");
await edit("password", "Password123!");
assert.equal(component.root.findAllByProps({ role: "alert" }).length, 0, "Editing either password clears the mismatch message");
await submit();
assert.equal(credentialRequests.at(-1).body.accountType, "personal");
await edit("confirm-password", "UnsubmittedPassword123!");
await act(async () => button("Already have an account? Sign in").props.onClick());
assert.equal(input("confirm-password"), undefined, "Sign-in does not require confirmation");
await edit("password", "Password123!");
await submit();
assert.equal(credentialRequests.at(-1).url, "/api/auth/login");
await act(async () => button("New here? Create an account").props.onClick());
assert.equal(input("confirm-password").props.value, "", "Switching modes clears the confirmation");
for (const provider of socialProviders) {
  await mount();
  await act(async () => button("New here? Create an account").props.onClick());
  await act(async () => component.root.findAllByType("select").find(node => node.props.id === "signup-type").props.onChange({ target: { value: "company" } }));
  await edit("signup-company", "  Social Company  ");
  assert.equal(button(`Continue with ${socialProviderLabels[provider]}`).props.type, "button", "Social signup must not require email or password form fields");
  if (provider === "google") {
    socialCompanyError = true;
    await act(async () => button("Continue with Google").props.onClick()); await flush();
    assert.equal(input("signup-company").props.value, "  Social Company  ", "A failed start preserves the company name for retry");
    assert.equal(button("Continue with Google").props.disabled, false);
    socialCompanyError = false;
  }
  await act(async () => button(`Continue with ${socialProviderLabels[provider]}`).props.onClick());
  assert.deepEqual(socialCompanyRequests.at(-1), { url: `/api/auth/${provider}`, body: { companyName: "Social Company", returnTo: "/" } });
  assert.equal(destinations.at(-1), "https://auth.example/authorize");
  assert.equal(input("signup-company").props.disabled, true);
}
await act(async () => component.unmount()); queryClient.clear();
delete globalThis.window; delete globalThis.document;

// Real PKCE generation/exchange through the installed SDK. Auth HTTP and the
// application profile store are mocked; external accounts are never changed.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.SESSION_SECRET = "fixture-session-secret-with-enough-characters";
process.env.APP_URL = "http://localhost:5000";
process.env.NODE_ENV = "test";
const flagNames = { google: "SUPABASE_GOOGLE_ENABLED", facebook: "SUPABASE_FACEBOOK_ENABLED", apple: "SUPABASE_APPLE_ENABLED", microsoft: "SUPABASE_MICROSOFT_ENABLED" };
for (const flag of Object.values(flagNames)) process.env[flag] = "false";
const { setupAuth, requireSameOrigin } = await import("../server/auth.ts");
const { storage } = await import("../server/storage.ts");
const { pool } = await import("../server/db.ts");
const { authProfileNames } = await import("../server/social-auth.ts");
const profiles = new Map();
let writes = 0, expectedVerifier, tokenError = false, verificationError = false, tokenCalls = 0;
let authUser = { id: "social-user", aud: "authenticated", email: "social@example.com", email_confirmed_at: new Date().toISOString(), user_metadata: { given_name: "First", family_name: "Login" }, app_metadata: {} };
storage.getUser = async id => profiles.get(id);
storage.upsertUser = async data => {
  writes++;
  const profile = { providerType: "individual", currentRole: "seeker", companyName: null, ...profiles.get(data.id), ...data };
  profiles.set(data.id, profile); return profile;
};
const routes = [];
const middleware = [];
const app = { set() {}, use(...args) { middleware.push(args); }, get(path, ...handlers) { routes.push({ method: "get", path, handlers }); }, post(path, ...handlers) { routes.push({ method: "post", path, handlers }); } };
const ownedCompanies = new Map();
let companyCalls = 0, failCompany = false;
await setupAuth(app, async (userId, name) => {
  companyCalls++;
  if (failCompany) throw new Error("Workspace creation unavailable");
  if (!ownedCompanies.has(userId)) ownedCompanies.set(userId, { id: ownedCompanies.size + 1, name, ownerId: userId });
  const company = ownedCompanies.get(userId);
  Object.assign(profiles.get(userId), { providerType: "company", companyName: company.name, currentRole: "provider" });
  return company;
});
const invoke = async (path, req, method = "get") => {
  const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, set(name, value) { this.headers[name] = value; return this; }, json(body) { this.body = body; return this; }, redirect(url) { this.url = url; this.code = 302; return this; } };
  const route = routes.find(item => item.method === method && item.path === path);
  assert.ok(route, `Missing ${path}`);
  await route.handlers.at(-1)(req, res);
  return res;
};
function request(query = {}) {
  const req = { query, session: undefined, rotations: 0, saves: 0, failSave: false };
  const newSession = () => ({
    save(callback) { req.saves++; callback(req.failSave ? new Error("Session store unavailable") : undefined); },
    regenerate(callback) { req.rotations++; req.session = newSession(); callback(); },
  });
  req.session = newSession();
  return req;
}
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  assert.equal(url.origin, process.env.SUPABASE_URL, "Only the mocked Supabase service may receive Auth requests");
  if (url.pathname === "/auth/v1/token") {
    tokenCalls++;
    const body = JSON.parse(options.body);
    assert.equal(url.searchParams.get("grant_type"), "pkce");
    assert.equal(body.auth_code, "fixture-code");
    if (tokenError || body.code_verifier !== expectedVerifier) return new Response('{"code":"bad_code_verifier","msg":"Invalid code verifier"}', { status: 400 });
    return new Response(JSON.stringify({ access_token: "fixture-access", refresh_token: "fixture-refresh", expires_in: 3600, token_type: "bearer", user: authUser }));
  }
  assert.equal(url.pathname, "/auth/v1/user");
  return verificationError ? new Response('{"msg":"Invalid user"}', { status: 401 }) : new Response(JSON.stringify(authUser));
};
async function begin(provider, returnTo = "/my-bookings", companyName) {
  const req = request({ returnTo });
  if (companyName !== undefined) req.body = { companyName, returnTo };
  const res = await invoke(`/api/auth/${provider}`, req, companyName === undefined ? "get" : "post");
  const verifier = Object.entries(req.session.oauthStorage ?? {}).find(([key]) => key.endsWith("code-verifier"));
  expectedVerifier = verifier ? JSON.parse(verifier[1]).split("/")[0] : undefined;
  return { req, res, verifier: expectedVerifier };
}
try {
  const config = await invoke("/api/auth/providers", request());
  assert.deepEqual(config.body, allDisabled);
  assert.equal(config.headers["Cache-Control"], "no-store");
  for (const provider of socialProviders) {
    const disabled = await invoke(`/api/auth/${provider}`, request({ returnTo: "/administration" }));
    assert.equal(disabled.url, "/login?error=social_disabled&returnTo=%2Fadministration");
    assert.equal(tokenCalls, 0);
    process.env[flagNames[provider]] = "true";
  }
  assert.deepEqual((await invoke("/api/auth/providers", request())).body, allEnabled);
  for (const provider of socialProviders) {
    const { req, res, verifier } = await begin(provider);
    const url = new URL(res.url);
    assert.equal(url.origin, process.env.SUPABASE_URL);
    assert.equal(url.pathname, "/auth/v1/authorize");
    assert.equal(url.searchParams.get("provider"), provider === "microsoft" ? "azure" : provider);
    assert.equal(url.searchParams.get("redirect_to"), "http://localhost:5000/api/callback");
    assert.equal(url.searchParams.get("code_challenge_method"), "s256");
    assert.ok(verifier && !res.url.includes(verifier), "Only the PKCE challenge may go to the browser");
    if (provider === "microsoft" || provider === "facebook") assert.equal(url.searchParams.get("scopes"), "email");
    assert.ok(req.saves > 0, "Save the PKCE verifier before redirecting");
    req.query = { code: "fixture-code", returnTo: "https://evil.example" };
    const callback = await invoke("/api/callback", req);
    assert.equal(callback.url, "/my-bookings");
    assert.equal(req.session.auth.userId, authUser.id);
    assert.equal(req.rotations, 1, "Successful sign-in must rotate the session");
    assert.equal(req.session.oauthStorage, undefined);
    assert.equal(req.session.authReturnTo, undefined);
    assert.equal(profiles.get(authUser.id).firstName, "First");
    assert.equal(profiles.size, 1, "Returning social users must reuse their existing profile");
    authUser.user_metadata = {};
  }
  const current = profiles.get(authUser.id);
  assert.deepEqual(authProfileNames({ ...authUser, user_metadata: { given_name: "Old provider name" } }, { ...current, firstName: null, lastName: null }), { firstName: null, lastName: null });
  assert.deepEqual(authProfileNames({ ...authUser, user_metadata: { first_name: "", last_name: "" } }, current), { firstName: null, lastName: null });
  assert.deepEqual(authProfileNames({ ...authUser, user_metadata: { given_name: { malformed: true }, family_name: 123 } }, undefined), { firstName: null, lastName: null });
  const redirect = await begin("google", "//evil.example");
  assert.equal(redirect.req.session.authReturnTo, "/");
  redirect.req.query = { error: "access_denied", error_description: "untrusted-provider-details" };
  const cancelled = await invoke("/api/callback", redirect.req);
  assert.equal(cancelled.url, "/login?error=social_cancelled");
  assert.equal(redirect.req.session.oauthStorage, undefined);
  assert.equal(JSON.stringify(cancelled).includes("untrusted-provider-details"), false);
  const missing = request({ code: "fixture-code" }); missing.session.authReturnTo = "/account";
  assert.equal((await invoke("/api/callback", missing)).url, "/login?error=social_session_expired&returnTo=%2Faccount");
  assert.equal((await invoke("/api/callback", request())).url, "/invite", "Keep implicit invitation redirects working");
  const mismatched = await begin("facebook");
  expectedVerifier = "a-different-session-verifier";
  const previousWrites = writes;
  mismatched.req.query = { code: "fixture-code" };
  assert.match((await invoke("/api/callback", mismatched.req)).url, /social_session_expired/);
  assert.equal(writes, previousWrites, "Invalid PKCE must not establish an account");
  assert.equal(mismatched.req.session.auth, undefined);
  verificationError = true;
  const unverified = await begin("apple"); unverified.req.query = { code: "fixture-code" };
  assert.match((await invoke("/api/callback", unverified.req)).url, /login_failed/);
  assert.equal(unverified.req.session.auth, undefined);
  verificationError = false;
  const saveFailure = request({ returnTo: "/account" }); saveFailure.failSave = true;
  assert.equal((await invoke("/api/auth/microsoft", saveFailure)).url, "/login?error=login_failed&returnTo=%2Faccount");
  assert.equal(saveFailure.session.oauthStorage, undefined);
  assert.ok(routes.some(item => item.path === "/api/auth/invite-status"));
  assert.equal(routes.some(item => item.path === "/api/auth/:provider"), false, "Provider routes must not shadow invitation APIs");
  assert.ok(middleware.some(args => args[0] === "/api" && args[1] === requireSameOrigin));
  let rejectedOrigin;
  requireSameOrigin({ method: "POST", get: key => key === "Origin" ? "https://evil.example" : undefined }, { status(code) { rejectedOrigin = code; return this; }, json() {} }, () => { throw new Error("Cross-site company signup must be rejected"); });
  assert.equal(rejectedOrigin, 403);
  for (const body of [{}, { companyName: " " }, { companyName: "x".repeat(151) }, { companyName: ["Company"] }, { companyName: "Company", companyId: 99 }, { companyName: "Company", userId: "another-user" }, { companyName: "Company", role: "owner" }]) {
    const invalid = request(); invalid.body = body;
    assert.equal((await invoke("/api/auth/google", invalid, "post")).code, 400);
    assert.equal(invalid.session.socialCompanySignup, undefined);
  }
  process.env.SUPABASE_GOOGLE_ENABLED = "false";
  const disabledCompany = request(); disabledCompany.body = { companyName: "Company" };
  assert.equal((await invoke("/api/auth/google", disabledCompany, "post")).code, 503);
  process.env.SUPABASE_GOOGLE_ENABLED = "true";
  const originalUser = authUser;
  for (const provider of socialProviders) {
    authUser = { ...originalUser, id: `company-${provider}`, email: `company-${provider}@example.com`, user_metadata: {} };
    const { req, res } = await begin(provider, "/my-services", `  ${provider} Company  `);
    assert.equal(res.code, 200);
    assert.ok(res.body.url.includes("/auth/v1/authorize"));
    assert.equal(res.body.url.includes("Company"), false, "Company details stay out of provider URLs");
    assert.equal(req.session.socialCompanySignup.companyName, `${provider} Company`);
    const beforeCompany = companyCalls;
    req.query = { code: "fixture-code", companyName: "Injected Name", companyId: "99" };
    await invoke("/api/callback", req);
    assert.equal(companyCalls, beforeCompany + 1);
    assert.equal(ownedCompanies.get(authUser.id).name, `${provider} Company`);
    assert.equal(ownedCompanies.get(authUser.id).ownerId, authUser.id, "Workspace ownership follows the verified social identity");
    assert.equal(req.session.auth.userId, authUser.id);
    assert.equal(req.session.socialCompanySignup, undefined, "Creation intent must not survive a successful login");
    const repeated = await begin(provider, "/my-services", "Different Name");
    repeated.req.query = { code: "fixture-code" };
    await invoke("/api/callback", repeated.req);
    assert.equal(ownedCompanies.get(authUser.id).name, `${provider} Company`, "Returning owners must not rename or duplicate their company");
  }
  authUser = originalUser;
  const conversion = await begin("google", "/my-services", "Existing Personal Company");
  conversion.req.query = { code: "fixture-code" };
  await invoke("/api/callback", conversion.req);
  assert.equal(profiles.get(authUser.id).providerType, "company", "An existing personal account can create its company through social signup");
  const beforeFailed = ownedCompanies.size;
  authUser = { ...originalUser, id: "failed-company", user_metadata: {} };
  const failedSignup = await begin("google", "/my-services", "Failed Company");
  tokenError = true; failedSignup.req.query = { code: "fixture-code" };
  await invoke("/api/callback", failedSignup.req);
  assert.equal(ownedCompanies.size, beforeFailed, "Failed verification must not create a company");
  assert.equal(failedSignup.req.session.socialCompanySignup, undefined);
  tokenError = false;
  const expired = await begin("google", "/my-services", "Expired Company");
  expired.req.session.socialCompanySignup.expiresAt = Date.now() - 1;
  expired.req.query = { code: "fixture-code" };
  const beforeExpired = tokenCalls;
  assert.match((await invoke("/api/callback", expired.req)).url, /social_session_expired/);
  assert.equal(tokenCalls, beforeExpired);
  assert.equal(ownedCompanies.size, beforeFailed);
  const cancelledCompany = await begin("google", "/my-services", "Cancelled Company");
  cancelledCompany.req.query = { error: "access_denied" };
  await invoke("/api/callback", cancelledCompany.req);
  assert.equal(cancelledCompany.req.session.socialCompanySignup, undefined);
  assert.equal(ownedCompanies.size, beforeFailed);
  const cleared = await begin("google", "/my-services", "Stale Company");
  cleared.req.query = { returnTo: "/" };
  await invoke("/api/auth/google", cleared.req);
  assert.equal(cleared.req.session.socialCompanySignup, undefined, "A new personal sign-in clears stale company creation intent");
  const unavailable = await begin("google", "/my-services", "Unavailable Company");
  failCompany = true; unavailable.req.query = { code: "fixture-code" };
  assert.match((await invoke("/api/callback", unavailable.req)).url, /login_failed/);
  assert.equal(unavailable.req.session.auth, undefined, "Do not report company signup success when provisioning fails");
  failCompany = false;
  const failedStart = request(); failedStart.body = { companyName: "Company" }; failedStart.failSave = true;
  assert.equal((await invoke("/api/auth/google", failedStart, "post")).code, 503);
  assert.equal(failedStart.session.socialCompanySignup, undefined);
} finally { await pool.end(); }
console.log("Passed: personal/company social signup, company validation and ownership, retry/idempotence, intent expiry/cleanup, password confirmation, PKCE callbacks, session rotation, safe redirects, and invitation compatibility. External services are mocked.");
