import assert from "node:assert/strict";
import { build } from "esbuild";
import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { memoryDatabase } from "./fixtures/notification-database.mjs";

// Actual registerRoutes + company middleware + workspace authorization + notification
// handlers. Only session/auth, DB, storage and unrelated route owners are mocked.
// Requests use in-process streams: no listening socket, credentials or live service.
const dialect = new PgDialect(), previousEnvironment = process.env, previousFetch = globalThis.fetch;
process.env = { NODE_ENV: "test", NOTIFICATIONS_ENABLED: "true", NOTIFICATIONS_AUTOMATION_ENABLED: "true" };
globalThis.fetch = async () => { throw new Error("No provider/network access allowed"); };
const scheduledDate = new Date("2099-11-01T10:00:00Z"), eventId = "00000000-0000-4000-8000-000000000036";
const company = id => ({ id, providerId: `owner-${id}`, isActive: true, name: `Company ${id}` });
const state = { sessions: 0, booking: null, memory: null, memberships: [], companies: [] };
function reset() {
  state.sessions = 0;
  state.companies = [company(6), company(7)];
  state.memberships = [
    { companyId: 6, userId: "admin", role: "admin", employeeId: null },
    { companyId: 6, userId: "employee", role: "provider", employeeId: 7 },
    { companyId: 6, userId: "viewer", role: "viewer", employeeId: 7 },
    { companyId: 7, userId: "other-company", role: "admin", employeeId: null },
  ];
  const service = { id: 10, name: "Synthetic appointment", reminderEnabled: false, reminderMethod: "email", reminderHours: 24 };
  state.booking = { id: 36, serviceId: 10, seekerId: "customer", providerId: "provider", companyId: null, employeeId: 7,
    status: "confirmed", scheduledDate, notificationRevision: 2, service, seeker: { email: "customer@example.test", firstName: "Synthetic", lastName: "Customer" } };
  state.memory = memoryDatabase({ companies: state.companies, services: [service], users: [{ id: "customer", email: "customer@example.test" }],
    notification_events: [{ id: eventId, bookingId: 36, bookingRevision: 2, kind: "accepted", scheduledDate, automatic: false, timezone: "Europe/Riga", createdAt: new Date() }],
    user_communication_preferences: [{ userId: "customer", phone: null, phoneVerifiedAt: null, preferredMethod: "email", language: "en", smsOptIn: false, whatsappOptIn: false }],
  });
}
// Joined results are a DB transport boundary; all workspace selection, permissions
// and object authorization still run in the application's actual companyAccess code.
const db = { select(selection) {
  let table, condition, limit, ordering = [];
  return { from(value) { table = value; return this; }, innerJoin() { return this; }, leftJoin() { return this; },
    where(value) { condition = value; return this; }, limit(value) { limit = value; return this; }, orderBy(...values) { ordering = values; return this; }, for() { return this; },
    then(resolveResult, reject) { return Promise.resolve().then(async () => {
      const name = getTableName(table);
      if (name === "company_memberships") {
        const { params } = dialect.sqlToQuery(condition);
        return state.memberships.filter(membership => membership.userId === params[0]).map(membership => ({ company: state.companies.find(value => value.id === membership.companyId), membership }));
      }
      const query = state.memory.database.select(name === "notification_events" && selection?.event ? undefined : selection).from(table).where(condition);
      if (ordering.length) query.orderBy(...ordering);
      if (limit !== undefined) query.limit(limit);
      const rows = await query;
      return name === "notification_events" && selection?.event ? rows.map(event => ({ event, job: state.memory.data.notification_jobs.find(job => job.eventId === event.id) ?? null })) : rows;
    }).then(resolveResult, reject); },
  };
} };
const fixtures = {
  db,
  async setupAuth(app) {
    app.use((req, _res, next) => {
      state.sessions++; assert.equal(req.workspace, undefined, "Auth/session fixture must not inject the workspace regression under test");
      const actor = req.get("x-test-actor");
      req.session = actor ? { auth: { userId: actor }, activeCompanyId: req.get("x-test-company") ? Number(req.get("x-test-company")) : null } : {};
      next();
    });
  },
  isAuthenticated(req, res, next) { const actor = req.session.auth?.userId; if (!actor) return res.status(401).json({ message: "Unauthorized" }); req.user = { claims: { sub: actor } }; next(); },
  storage: { async getBookingById(id) { return state.booking?.id === id ? state.booking : undefined; } },
  appUrl: "http://example.test",
};
globalThis.__notificationBootstrap = fixtures;
async function loadBackend() {
  const allowed = ["routes", "companyRoutes", "companyAccess", "customerBookings", "notifications/routes", "notifications/repository", "notifications/preferences", "notifications/policy", "notifications/transports", "notifications/webhooks"];
  const artifact = await build({ stdin: { contents: 'export { registerRoutes } from "./server/routes.ts"; export { mountNotificationWebhooks } from "./server/notifications/webhooks.ts";', resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", plugins: [{ name: "actual-notification-bootstrap", setup(builder) {
      builder.onResolve({ filter: /^[a-z@]/ }, args => {
        if (args.path.startsWith("@shared/") || args.path.startsWith("node:")) return;
        return { path: import.meta.resolve(args.path), external: true };
      });
      builder.onResolve({ filter: /^\.\.?\// }, async args => {
        if (!args.importer.replaceAll("\\", "/").includes("/server/")) return;
        const full = resolve(dirname(args.importer), args.path).replaceAll("\\", "/");
        if (!full.includes("/server/") || allowed.some(name => full.endsWith(`/server/${name}`) || full.endsWith(`/server/${name}.ts`))) return;
        const source = await readFile(args.importer, "utf8");
        const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].filter(match => match[2] === args.path)
          .flatMap(match => match[1].split(",").map(name => name.trim()).filter(name => name && !name.startsWith("type ")));
        assert.ok(imports.length, `Known named dependency ${args.path}`);
        return { path: JSON.stringify(imports), namespace: "bootstrap-boundary" };
      });
      builder.onLoad({ filter: /.*/, namespace: "bootstrap-boundary" }, args => ({ contents: JSON.parse(args.path).map(name => /Error$|Unavailable$/.test(name)
        ? `export const ${name}=globalThis.__notificationBootstrap.${name} ?? class ${name} extends Error {};`
        : `export const ${name}=globalThis.__notificationBootstrap.${name} ?? (()=>{});`).join("\n"), loader: "js" }));
    } }] });
  return import(`data:text/javascript;base64,${Buffer.from(artifact.outputFiles[0].text).toString("base64")}`);
}
async function request(app, path, { actor = "provider", companyId, method = "GET", body } = {}) {
  const chunks = [], socket = new Duplex({ read() {}, write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  const req = new IncomingMessage(socket); req._read = () => {}; req.complete = true; req.url = path; req.method = method;
  req.headers = { ...(actor ? { "x-test-actor": actor } : {}), ...(companyId != null ? { "x-test-company": String(companyId) } : {}) };
  const text = body === undefined ? "" : JSON.stringify(body);
  if (text) { req.headers["content-type"] = "application/json"; req.headers["content-length"] = String(Buffer.byteLength(text)); }
  const res = new ServerResponse(req); res.assignSocket(socket); const finished = once(res, "finish");
  app.handle(req, res); queueMicrotask(() => { if (text) req.push(Buffer.from(text)); req.push(null); });
  await Promise.race([finished, new Promise((_done, reject) => setTimeout(() => reject(Error(`Stream request timed out: ${path}`)), 2000).unref())]);
  socket.destroy();
  const wire = Buffer.concat(chunks).toString(), result = wire.slice(wire.indexOf("\r\n\r\n") + 4);
  return { status: res.statusCode, body: res.getHeader("content-type")?.includes("json") ? JSON.parse(result) : result };
}
let cases = 0;
try {
  reset();
  const handlers = await loadBackend(), app = express();
  handlers.mountNotificationWebhooks(app); app.use(express.json()); await handlers.registerRoutes(app);
  const endpoints = [
    ["/api/notifications/capabilities", {}],
    ["/api/bookings/36/notifications", {}],
    ["/api/bookings/36/notification-preview", { method: "POST", body: { kind: "reminder", timeZone: "Europe/Riga" } }],
  ];
  let response = await request(app, endpoints[0][0]);
  assert.equal(response.status, 200, "Actual bootstrap must hydrate workspace before capabilities, not return the missing-workspace 403"); assert.equal(response.body.hasPro, false); cases++;
  response = await request(app, endpoints[1][0]); assert.equal(response.status, 200); assert.equal(response.body.notification.eventId, eventId); cases++;
  response = await request(app, endpoints[2][0], endpoints[2][1]); assert.equal(response.status, 200); assert.ok(response.body.channels.email.href.startsWith("mailto:")); cases++;
  for (const [url, options] of endpoints) { assert.equal((await request(app, url, { ...options, actor: null })).status, 401); cases++; }
  for (const [url, options] of endpoints) { assert.equal((await request(app, url, { ...options, actor: "admin", companyId: 99 })).status, 403); cases++; }
  for (const [url, options] of endpoints.slice(1)) { assert.equal((await request(app, url, { ...options, actor: "different-provider" })).status, 403); cases++; }
  state.booking.companyId = 6; state.booking.providerId = "owner-6";
  for (const [url, options] of endpoints) { assert.equal((await request(app, url, { ...options, actor: "admin", companyId: 6 })).status, 200); cases++; }
  state.memory.data.provider_subscriptions = [{ userId: null, companyId: 6, plan: "pro", proUntil: scheduledDate }];
  response = await request(app, endpoints[0][0], { actor: "employee", companyId: 6 }); assert.equal(response.status, 200); assert.equal(response.body.hasPro, true); cases++;
  response = await request(app, endpoints[2][0], { ...endpoints[2][1], actor: "employee", companyId: 6 }); assert.equal(response.status, 200); assert.ok(response.body.channels.email.href.startsWith("mailto:")); cases++;
  state.booking.service.reminderEnabled = true;
  response = await request(app, endpoints[2][0], { ...endpoints[2][1], actor: "employee", companyId: 6 }); assert.equal(response.status, 409); assert.equal(response.body.code, "automatic_mode"); cases++;
  state.booking.service.reminderEnabled = false;
  response = await request(app, endpoints[2][0], { actor: "employee", companyId: 6, method: "POST", body: { kind: "status" } }); assert.equal(response.status, 409); assert.equal(response.body.code, "automatic_mode"); cases++;
  for (const denied of [{ actor: "viewer", companyId: 6 }, { actor: "other-company", companyId: 7 }, { actor: null }]) {
    response = await request(app, endpoints[2][0], { ...endpoints[2][1], ...denied }); assert.equal(response.status, denied.actor ? 403 : 401); assert.equal(response.body.channels, undefined); cases++;
  }
  state.memory.data.provider_subscriptions = [];
  for (const [url, options] of endpoints) { assert.equal((await request(app, url, { ...options, actor: "employee", companyId: 6 })).status, 200); cases++; }
  state.booking.employeeId = 8;
  for (const [url, options] of endpoints.slice(1)) { assert.equal((await request(app, url, { ...options, actor: "employee", companyId: 6 })).status, 403); cases++; }
  state.booking.employeeId = 7;
  for (const [url, options] of endpoints.slice(1)) { assert.equal((await request(app, url, { ...options, actor: "viewer", companyId: 6 })).status, 403); cases++; }
  for (const [url, options] of endpoints.slice(1)) { assert.equal((await request(app, url, { ...options, actor: "other-company", companyId: 7 })).status, 403); cases++; }
  state.memberships = state.memberships.filter(value => value.userId !== "employee");
  for (const [url, options] of endpoints) { assert.equal((await request(app, url, { ...options, actor: "employee", companyId: 6 })).status, 403); cases++; }
  state.sessions = 0;
  response = await request(app, "/api/notifications/webhooks/vonage", { actor: null, method: "POST", body: { status: "delivered" } });
  assert.equal(response.status, 401); assert.equal(state.sessions, 0, "Raw signed webhook boundary remains before auth/session and workspace work"); cases++;
  console.log(`Notification actual bootstrap: ${cases} scenarios passed (real workspace middleware; in-process HTTP; no database/provider/environment access).`);
} finally { process.env = previousEnvironment; globalThis.fetch = previousFetch; delete globalThis.__notificationBootstrap; }
