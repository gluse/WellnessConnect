// Synthetic server-handler tests, real Auth SDK over mocked HTTP only.
// Redirect dotenv before any application import; no .env/credentials are read.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const noEnv = fileURLToPath(new URL("../.audit-unit-no-env", import.meta.url));
assert.equal(existsSync(noEnv), false);
process.env.DOTENV_PATH = process.env.DOTENV_CONFIG_PATH = noEnv;
process.env.DOTENV_DEBUG = "false"; process.env.DOTENV_QUIET = "true";
Object.assign(process.env, { AUDIT_ENABLED: "false", AUDIT_WORKER_ENABLED: "false", NODE_ENV: "test",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture", SUPABASE_URL: "http://127.0.0.1:1",
  OPENAI_API_KEY: "synthetic-key",
  SUPABASE_PUBLISHABLE_KEY: "fixture", SUPABASE_SECRET_KEY: "fixture", APP_URL: "http://localhost:5000",
  SESSION_SECRET: "synthetic-secret-for-offline-tests-only-123456", SUPABASE_GOOGLE_ENABLED: "true", APP_ADMIN_USER_IDS: "" });
const { setAuditSink } = await import("../server/audit/http.ts");
const { createAuditContext } = await import("../server/audit/context.ts");
const { randomUUID } = await import("node:crypto");
const { setupAuth, isAuthenticated, requireSameOrigin } = await import("../server/auth.ts");
const { requireAppAdmin } = await import("../server/appAdmin.ts");
const { updatePassword } = await import("../server/password.ts");
const { storage } = await import("../server/storage.ts");
const { pool, db } = await import("../server/db.ts");
pool.connect = pool.query = async () => { throw new Error("Unexpected offline DB access"); };
db.transaction = async () => { throw new Error("Unexpected offline DB transaction"); };
const userId = "11111111-1111-4111-8111-111111111111";
const user = { id: userId, email: "canary-email@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z", aud: "authenticated", user_metadata: {}, app_metadata: {} };
const secrets = [user.email, "CANARY-access-token", "CANARY-refresh-token", "CanaryPassword123!", "CanaryNewPassword456!"];
const events = [], gaps = [], originalError = console.error;
let unavailable = false, unavailableBefore = false, provider = "success", failSave = false, passwordWrites = 0;
console.error = (...values) => { gaps.push(values.join(" ")); };
setAuditSink(async event => { if (unavailable) throw new Error("CANARY-private-driver-error"); events.push(event); },
  async () => { if (unavailableBefore) throw new Error("CANARY-private-driver-error"); });
storage.getUser = async id => id === userId ? { id, currentRole: "provider", providerType: "individual" } : undefined;
storage.upsertUser = async data => ({ ...data, currentRole: "provider", providerType: "individual" });
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input); assert.equal(url.origin, process.env.SUPABASE_URL);
  if (url.pathname === "/auth/v1/token") {
    if (provider === "denied") return new Response('{"code":"invalid_credentials","msg":"CANARY-provider-error"}', { status: 400 });
    return new Response(JSON.stringify({ access_token: secrets[1], refresh_token: secrets[2], expires_in: 3600, token_type: "bearer", user }));
  }
  if (url.pathname === "/auth/v1/user" && options.method === "PUT") {
    passwordWrites++;
    if (provider === "update-timeout") throw new Error("CANARY-provider-timeout");
    return new Response(JSON.stringify(user));
  }
  if (url.pathname === "/auth/v1/user") return new Response(JSON.stringify(user));
  if (url.pathname.endsWith("logout")) return new Response(null, { status: 204 });
  throw new Error("Unexpected mocked Auth operation");
};
const routes = [], middleware = [];
await setupAuth({ set() {}, use(...args) { middleware.push(args); }, get(path, ...handlers) { routes.push({ method: "get", path, handlers }); }, post(path, ...handlers) { routes.push({ method: "post", path, handlers }); } });
function request(extra = {}) {
  const req = { body: {}, query: {}, ...extra };
  const session = () => ({ auth: { userId, accessToken: secrets[1], refreshToken: secrets[2], expiresAt: Date.now() / 1000 + 3600 },
    regenerate(callback) { req.session = session(); callback(); }, save(callback) { callback(failSave ? new Error("CANARY-session-error") : undefined); },
    destroy(callback) { req.session = {}; callback(); } });
  req.session = session(); return req;
}
function response() { return { code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; },
  set() { return this; }, clearCookie() {}, redirect(url) { this.code = 302; this.url = url; return this; } }; }
async function invoke(path, req, method = "post") {
  const res = response(); await routes.find(route => route.path === path && route.method === method).handlers.at(-1)(req, res, error => { res.failure = error; }); return res;
}
try {
  let req = request({ body: { email: user.email, password: secrets[3] } });
  let res = await invoke("/api/auth/login", req);
  assert.equal(res.body.success, true); assert.equal(res.failure, undefined);
  assert.deepEqual(events.map(event => event.envelope.eventName), ["auth.login.v1", "auth.session_established.v1"]);
  assert.equal(events[0].envelope.actor.userId, userId); assert.equal(events[0].envelope.actor.effectiveRole, "provider");
  assert.equal(events[0].envelope.requestId, events[1].envelope.requestId);
  assert.equal(events[0].envelope.operationId, events[1].envelope.operationId);
  events.length = 0; failSave = true;
  res = await invoke("/api/auth/login", request({ body: req.body }));
  assert.ok(res.failure); assert.equal(events[0].envelope.eventName, "auth.login.v1");
  assert.equal(events.some(event => event.envelope.eventName === "auth.session_established.v1"), false);
  failSave = false; events.length = 0; provider = "denied";
  res = await invoke("/api/auth/login", request({ body: req.body }));
  assert.equal(res.code, 401); assert.equal(events[0].envelope.outcome, "denied"); assert.equal(events[0].envelope.actor.kind, "anonymous");
  unavailable = true; res = await invoke("/api/auth/login", request({ body: req.body }));
  assert.equal(res.code, 401, "Capture outage never grants a denied login");
  unavailable = false; provider = "success"; events.length = 0;
  req = request(); req.session = {};
  res = response(); let next = false; await isAuthenticated(req, res, () => { next = true; });
  assert.equal(res.code, 401); assert.equal(next, false); assert.equal(events[0].envelope.reasonCode, "UNAUTHENTICATED");
  events.length = 0; unavailable = true;
  res = response(); await requireSameOrigin({ method: "POST", get: key => key === "Origin" ? "https://wrong.invalid" : undefined }, res, () => assert.fail());
  assert.equal(res.code, 403);
  unavailable = false; events.length = 0;
  req = request(); res = response(); await isAuthenticated(req, res, () => { next = true; });
  assert.equal(req.auditPersonalRole, "provider");
  const getUser = storage.getUser;
  for (const failing of [async () => undefined, async () => { throw new Error("CANARY-private-profile-error"); }, async () => ({ id: userId, currentRole: null })]) {
    storage.getUser = failing; const blocked = response(); let called = false;
    await isAuthenticated(request(), blocked, () => { called = true; });
    assert.equal(blocked.code, 503); assert.equal(called, false);
    assert.equal(JSON.stringify(blocked.body).includes("CANARY"), false);
  }
  storage.getUser = getUser;
  res = response(); await requireAppAdmin(req, res, () => assert.fail());
  assert.equal(res.code, 403); assert.equal(events.at(-1).envelope.reasonCode, "FORBIDDEN");
  const limiter = routes.find(route => route.path === "/api/auth/login").handlers[0];
  for (let index = 0; index < 31; index++) {
    const limited = response(); limited.setHeader = () => {};
    await limiter({ ip: "192.0.2.8", headers: {}, app: { get: () => 1 }, socket: { remoteAddress: "192.0.2.8" } }, limited, error => { if (error) throw error; });
    if (index === 30) assert.equal(limited.code, 429);
  }
  assert.equal(events.at(-1).envelope.reasonCode, "RATE_LIMITED");

  events.length = 0; req = request({ body: { currentPassword: secrets[3], newPassword: secrets[4] },
    user: { claims: { sub: userId }, email: user.email }, auditPersonalRole: "provider" });
  res = response(); failSave = true; await updatePassword(req, res);
  assert.deepEqual(res.body, { success: true, requiresSignIn: true });
  assert.equal(events[0].envelope.eventName, "auth.password_changed.v1"); assert.equal(events[0].envelope.outcome, "succeeded");
  failSave = false; unavailable = true;
  req = request({ body: { currentPassword: secrets[3], newPassword: secrets[4] }, user: { claims: { sub: userId }, email: user.email }, auditPersonalRole: "provider" });
  res = response(); await updatePassword(req, res);
  assert.equal(res.code, 503); assert.match(res.body.message, /password was saved/i);
  assert.equal(req.session.auth, undefined, "Known remote success + capture failure forces safe reauthentication");
  unavailable = false; events.length = 0;
  unavailableBefore = true;
  const writesBefore = passwordWrites;
  req = request({ body: { currentPassword: secrets[3], newPassword: secrets[4] }, user: { claims: { sub: userId }, email: user.email }, auditPersonalRole: "provider" });
  res = response(); await updatePassword(req, res);
  assert.equal(res.code, 503); assert.equal(passwordWrites, writesBefore, "Known source outage gates the remote mutation, without fabricating intent");
  unavailableBefore = false;

  // Real OAuth SDK start/exchange, all HTTP mocked; no provider URL/token stored.
  req = request(); req.session = { save(callback) { callback(); }, regenerate(callback) { callback(); } };
  res = await invoke("/api/auth/google", req, "get"); assert.equal(res.code, 302);
  req.query = { code: "CANARY-oauth-code" }; res = await invoke("/api/callback", req, "get");
  assert.equal(res.code, 302);
  assert.deepEqual(events.map(event => event.envelope.eventName), ["auth.oauth_started.v1", "auth.oauth_callback.v1", "auth.session_established.v1"]);
  events.length = 0;
  res = await invoke("/api/logout", request()); assert.equal(res.body.success, true);
  assert.equal(events.at(-1).envelope.eventName, "auth.logout.v1"); assert.equal(events.at(-1).envelope.outcome, "succeeded");
  for (const failing of [async () => ({ id: userId, currentRole: null }), async () => { throw new Error("CANARY-private-profile-error"); }]) {
    events.length = 0; storage.getUser = failing;
    const logout = request(); res = await invoke("/api/logout", logout);
    assert.equal(res.body.success, true); assert.equal(res.failure, undefined);
    assert.deepEqual(logout.session, {}); assert.deepEqual(events, [], "Unavailable attribution never invents a logout actor");
  }
  storage.getUser = getUser;
  const failedLogout = request(); failedLogout.session.destroy = callback => callback(new Error("CANARY-private-session-error"));
  res = await invoke("/api/logout", failedLogout);
  assert.equal(res.failure?.status, 503); assert.equal(res.failure?.message.includes("CANARY"), false);
  assert.equal(passwordWrites, 2);

  // Real account route/storage/Drizzle SQL path, synthetic transaction and rows.
  const { registerRoutes } = await import("../server/routes.ts");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect(), accountRoutes = [];
  const app = () => {};
  app.set = app.use = () => app;
  for (const method of ["get", "post", "patch", "put", "delete"]) app[method] = (path, ...handlers) => { accountRoutes.push({ method, path, handlers }); return app; };
  const server = await registerRoutes(app);
  try {
    let currentRole = "seeker", rejectEnqueue = true, order = [], attempts = [];
    db.transaction = async work => {
      order = [];
      const before = currentRole;
      const tx = {
        select() { return { from() { return { where() { return { for: async mode => { assert.equal(mode, "update"); order.push("lock"); return [{ id: userId, currentRole }]; } }; } }; } }; },
        update() { return { set(value) { return { where() { return { returning: async () => { order.push("update"); currentRole = value.currentRole; return [{ id: userId, currentRole }]; } }; } }; } }; },
        async execute(query) {
          order.push("enqueue");
          const compiled = dialect.sqlToQuery(query);
          assert.equal(compiled.sql, "SELECT audit_capture.enqueue($1,$2,$3) AS event_id");
          assert.equal(compiled.params.length, 3);
          attempts.push(JSON.parse(compiled.params[0]));
          if (rejectEnqueue) throw Object.assign(new Error("CANARY-db-password-and-query"), { query: compiled.sql, params: compiled.params });
          return { rows: [{ event_id: JSON.parse(compiled.params[0]).eventId }] };
        },
      };
      try { return await work(tx); } catch (error) { currentRole = before; throw error; }
    };
    const handler = accountRoutes.find(route => route.method === "patch" && route.path === "/api/users/role").handlers.at(-1);
    const accountReq = () => request({ body: { role: "provider" }, user: { claims: { sub: userId } }, auditPersonalRole: "seeker" });
    res = response(); await handler(accountReq(), res);
    assert.equal(res.code, 503); assert.equal(currentRole, "seeker", "Outbox failure rolls back the same synthetic transaction");
    assert.deepEqual(order, ["lock", "update", "enqueue"]);
    rejectEnqueue = false; res = response(); await handler(accountReq(), res);
    assert.equal(res.code, 200); assert.equal(currentRole, "provider");
    assert.deepEqual(order, ["lock", "update", "enqueue"]);
    assert.deepEqual(attempts.at(-1).changes, [{ field: "currentRole", before: "seeker", after: "provider" }]);
    assert.equal(attempts.at(-1).actor.effectiveRole, "seeker");
    res = response(); await handler(accountReq(), res);
    assert.equal(res.code, 200); assert.equal(attempts.at(-1).reasonCode, "NO_CHANGE");
    assert.deepEqual(attempts.at(-1).changes, []);
    assert.equal(attempts.at(-1).actor.effectiveRole, "provider", "Snapshot role comes from locked current row, not stale caller persona");
    const foreign = "22222222-2222-4222-8222-222222222222";
    const wrongActor = createAuditContext({ actor: { kind: "user", userId: foreign, effectiveRole: "seeker" },
      scope: { kind: "personal", workspaceId: foreign }, target: { type: "user", id: foreign },
      source: { application: "fitsmytime", environment: "development", component: "account" }, requestId: randomUUID(), operationId: randomUUID() });
    await assert.rejects(storage.updateUserRole(userId, "seeker", wrongActor));
    assert.deepEqual(order, ["lock"]); assert.equal(currentRole, "provider");
  } finally { server.close(); }
  const serialized = JSON.stringify({ events, gaps });
  for (const secret of [...secrets, "CANARY-provider-error", "CANARY-private-driver-error", "CANARY-private-profile-error", "CANARY-oauth-code", "CANARY-db-password-and-query"]) assert.equal(serialized.includes(secret), false);
} finally { setAuditSink(); console.error = originalError; await pool.end(); }
console.log("Passed: enabled login/OAuth/session/password/access hooks, provider-success/local-failure distinction, denied capture outages and safe field/correlation behavior. Mocked DB/Auth/session only; no listener, credentials or live services.");
