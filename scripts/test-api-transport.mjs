import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";

// Use real local HTTP and Express cookies, with Supabase HTTP mocked separately.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.APP_URL = "http://127.0.0.1:1";
process.env.NODE_ENV = "test";
const nativeFetch = globalThis.fetch;
const { isAuthenticated, requireSameOrigin } = await import("../server/auth.ts");
const { updatePassword } = await import("../server/password.ts");
const { apiNotFound } = await import("../server/api-fallback.ts");
const { updateAccountPassword, PasswordUpdateResponseError } = await import("../client/src/lib/password.ts");
const { pool } = await import("../server/db.ts");
const user = { id: "transport-fixture", email: "fixture@example.com", user_metadata: {}, app_metadata: {}, email_confirmed_at: new Date().toISOString() };
let baseUrl, cookie = "", wrongPassword = false;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input, baseUrl);
  if (url.origin === process.env.SUPABASE_URL) {
    if (url.pathname === "/auth/v1/token") {
      if (wrongPassword) return new Response('{"code":"invalid_credentials","msg":"Invalid login credentials"}', { status: 400 });
      return new Response(JSON.stringify({ access_token: "fresh-transport-access", refresh_token: "fresh-transport-refresh", expires_in: 3600, token_type: "bearer", user }));
    }
    if (url.pathname === "/auth/v1/user") return new Response(JSON.stringify(user));
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    throw new Error(`Unexpected mocked Supabase path: ${url.pathname}`);
  }
  assert.equal(url.origin, baseUrl, "Only the local fixture server may receive HTTP requests");
  const headers = new Headers(options.headers);
  if (cookie) headers.set("Cookie", cookie);
  const response = await nativeFetch(url, { ...options, headers });
  const updatedCookie = response.headers.get("Set-Cookie");
  if (updatedCookie) cookie = updatedCookie.split(";")[0];
  return response;
};
const servers = [];
async function listen(app) {
  const server = createServer(app); servers.push(server);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}
const passwords = { currentPassword: "OriginalPassword1!", newPassword: "NewPassword2!" };
try {
  const staleApp = express();
  staleApp.use("*", (_req, res) => res.type("html").send("<!doctype html><html><body>Frontend fallback</body></html>"));
  await listen(staleApp);
  const html = await globalThis.fetch("/api/auth/password", { method: "POST" });
  assert.equal(html.status, 200);
  assert.match(html.headers.get("Content-Type"), /^text\/html/);
  await assert.rejects(updateAccountPassword(passwords), PasswordUpdateResponseError, "Reproduce and identify HTML returned with status 200 over real HTTP");

  const app = express();
  const store = new session.MemoryStore();
  app.use(express.json());
  app.use(session({ store, secret: "transport-fixture-secret-for-tests-only", resave: false, saveUninitialized: false, cookie: { httpOnly: true } }));
  app.get("/test-session", (req, res) => {
    req.session.auth = { userId: user.id, accessToken: "original-transport-access", refreshToken: "original-transport-refresh", expiresAt: Date.now() / 1000 + 3600 };
    req.session.activeCompanyId = 77;
    res.json({ success: true });
  });
  app.use("/api", requireSameOrigin);
  app.post("/api/auth/password", isAuthenticated, updatePassword);
  app.get("/api/test-workspace", isAuthenticated, (req, res) => res.json({ companyId: req.session.activeCompanyId }));
  app.use("/api", apiNotFound);
  app.use("*", (_req, res) => res.type("html").send("<!doctype html><html>Frontend</html>"));
  await listen(app);
  const unknown = await globalThis.fetch("/api/not-registered", { method: "POST" });
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("Content-Type"), /^application\/json/);
  assert.deepEqual(await unknown.json(), { message: "API endpoint not found." });
  await assert.rejects(updateAccountPassword(passwords), /^Error: 401:/);
  await globalThis.fetch("/test-session");
  const originalCookie = cookie;
  wrongPassword = true;
  await assert.rejects(updateAccountPassword(passwords), /Current password is incorrect/);
  wrongPassword = false;
  assert.deepEqual(await updateAccountPassword(passwords), { success: true, requiresSignIn: false });
  assert.notEqual(cookie, originalCookie, "Express must rotate the session cookie after a password change");
  const workspace = await globalThis.fetch("/api/test-workspace");
  assert.equal(workspace.status, 200);
  assert.deepEqual(await workspace.json(), { companyId: 77 }, "The fresh cookie must authenticate subsequent requests and retain the workspace");
} finally {
  globalThis.fetch = nativeFetch;
  await Promise.all(servers.map(server => new Promise(resolve => { if (!server.listening) return resolve(); server.close(resolve); server.closeAllConnections(); })));
  await pool.end();
}
console.log("Passed: real HTTP reproduction of 200 HTML, JSON API 404s, password response parsing, Express session rotation, and authenticated follow-up requests. Supabase remains mocked.");
