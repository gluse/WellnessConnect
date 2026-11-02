import assert from "node:assert/strict";
import express from "express";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { memoryDatabase } from "./fixtures/notification-database.mjs";

// Real Express routes/repository/schema/access rules, mocked Auth and database.
// All HTTP is loopback; no startup, dotenv, actual DB/session or paid transports.
const priorEnvironment = process.env, realFetch = globalThis.fetch;
process.env = { NODE_ENV: "test", NOTIFICATIONS_ENABLED: "false" };
globalThis.fetch = () => { throw new Error("Unexpected external request"); };
const future = new Date(Date.now() + 7 * 86400000); future.setUTCHours(9, 0, 0, 0);
const next = new Date(future); next.setUTCDate(next.getUTCDate() + 1); next.setUTCHours(11);
const data = { bookings: [1, 2].map(id => ({ id, serviceId: 10, providerId: "provider", companyId: null, employeeId: 7, seekerId: `customer-${id}`,
  status: "confirmed", scheduledDate: future, bookingDuration: 60, bookingCleanupTime: 0, participantCount: 1, notificationRevision: 0 })),
  services: [{ id: 10, providerId: "provider", companyId: null, serviceType: "group", duration: 60, cleanupTime: 0, maxCapacity: 8 }],
  users: [{ id: "provider", firstName: "Synthetic provider" }, { id: "customer-1", firstName: "Customer one" }, { id: "customer-2", firstName: "Customer two" }],
  availability: [{ id: 1, providerId: "provider", companyId: null, serviceId: 10, isActive: true, scheduleType: "recurring", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "08:00", endTime: "18:00", timezone: "UTC" }],
  provider_subscriptions: [{ id: 1, userId: "provider", companyId: null, plan: "pro", proUntil: new Date(Date.now() + 365 * 86400000) }] };
const state = { memory: memoryDatabase(data) }; globalThis.__appointmentApi = state;
const directory = await mkdtemp(path.join(process.cwd(), ".appointment-api-check-"));
let server, cases = 0;
try {
  const artifact = await build({ stdin: { contents: 'export { setupAppointmentRoutes } from "./server/appointments/routes.ts";', resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", plugins: [{ name: "isolated-appointment-boundaries", setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)db$/ }, () => ({ path: "db", namespace: "appointment-test" }));
      builder.onResolve({ filter: /(?:^|\/)auth$/ }, () => ({ path: "auth", namespace: "appointment-test" }));
      builder.onResolve({ filter: /(?:^|\/)storage$/ }, () => ({ path: "storage", namespace: "appointment-test" }));
      builder.onLoad({ filter: /.*/, namespace: "appointment-test" }, args => ({ contents: args.path === "db"
        ? 'export const db=new Proxy({}, {get(_target,key){return globalThis.__appointmentApi.memory.database[key];}});'
        : args.path === "auth" ? 'export function isAuthenticated(req,res,next){const id=req.get("x-test-actor"); if(!id)return res.sendStatus(401);req.user={claims:{sub:id}};req.workspace={company:null,invalid:false,permissions:{manageBookings:true,readAll:true}};next();}'
          : 'export const storage={async getBookingById(id){return globalThis.__appointmentApi.memory.data.bookings.find(row=>row.id===id);}};' }));
    } }] });
  const modulePath = path.join(directory, "handlers.mjs"); await writeFile(modulePath, artifact.outputFiles[0].text);
  const { setupAppointmentRoutes } = await import(pathToFileURL(modulePath).href);
  const app = express(); app.use(express.json()); setupAppointmentRoutes(app);
  server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(url, { actor = "provider", method = "GET", body } = {}) {
    const response = await realFetch(origin + url, { method, headers: { ...(actor ? { "x-test-actor": actor } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await response.text(); return { status: response.status, headers: response.headers, body: response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text };
  }
  const send = { body: "Private note\nПривет, Rīga", clientRequestId: randomUUID() };
  assert.equal((await request("/api/bookings/1/conversation", { actor: null })).status, 401); cases++;
  assert.equal((await request("/api/bookings/1/conversation", { actor: "customer-2" })).status, 403); cases++;
  assert.equal((await request("/api/bookings/1/conversation", { actor: "other-provider", method: "POST", body: send })).status, 403); cases++;
  let response = await request("/api/bookings/1/conversation", { method: "POST", body: send });
  assert.equal(response.status, 200); assert.equal(response.body.body, send.body); assert.match(response.headers.get("cache-control"), /no-store/); cases++;
  const id = response.body.id;
  assert.equal((await request("/api/bookings/1/conversation", { method: "POST", body: send })).body.id, id); cases++;
  assert.equal((await request("/api/bookings/1/conversation", { method: "POST", body: { ...send, authorId: "customer-2" } })).status, 400); cases++;
  response = await request("/api/bookings/1/conversation", { actor: "customer-1", method: "POST", body: { body: "Reply", clientRequestId: randomUUID() } });
  assert.equal(response.status, 200); assert.equal(response.body.authorRole, "customer"); cases++;
  response = await request("/api/bookings/1/conversation", { actor: "customer-1" });
  assert.equal(response.body.messages.length, 2); assert.equal(JSON.stringify(response.body).includes("customer-2"), false); cases++;
  assert.equal((await request("/api/bookings/1/conversation?before=not-a-uuid")).status, 400); cases++;
  assert.equal((await request("/api/bookings/1/conversation?other=ignored")).status, 400); cases++;
  const proposal = { scheduledDate: next.toISOString(), fallback: "cancel_booking", timeZone: "UTC", clientRequestId: randomUUID() };
  response = await request("/api/bookings/1/reschedule-requests", { method: "POST", body: proposal });
  assert.equal(response.status, 200); assert.equal(state.memory.data.bookings[0].scheduledDate.getTime(), future.getTime()); cases++;
  const requestId = response.body.requests[0].id;
  assert.equal((await request(`/api/bookings/1/reschedule-requests/${requestId}/respond`, { method: "POST", body: { decision: "accept" } })).status, 403); cases++;
  response = await request(`/api/bookings/1/reschedule-requests/${requestId}/respond`, { actor: "customer-1", method: "POST", body: { decision: "accept" } });
  assert.equal(response.status, 200); assert.equal(response.body.booking.scheduledDate, next.toISOString()); cases++;
  response = await request("/api/bookings/1/reschedule-requests", { actor: "customer-1" });
  assert.equal(response.body.requests[0].state, "accepted"); assert.equal(response.body.requests[0].batchId, null); cases++;
  assert.equal((await request("/api/bookings/1/event/reschedule-requests", { actor: "customer-1" })).status, 403); cases++;
  response = await request("/api/bookings/2/event/preview", { method: "POST", body: { action: "message" } });
  assert.deepEqual(response.body.bookingIds, [2]); cases++;
  response = await request("/api/bookings/2/event/messages", { method: "POST", body: { body: "Broadcast", clientRequestId: randomUUID(), bookingIds: [2, 1] } });
  assert.equal(response.status, 409); assert.equal(response.body.code, "event_changed"); cases++;
  state.memory.data.provider_subscriptions[0].plan = "free";
  assert.equal((await request("/api/bookings/2/event/messages", { method: "POST", body: { body: "Broadcast", clientRequestId: randomUUID(), bookingIds: [2] } })).status, 403); cases++;
  assert.equal((await request("/api/bookings/2/event/status", { actor: "customer-2", method: "POST", body: { status: "cancelled", bookingIds: [2], timeZone: "UTC" } })).status, 403); cases++;
  assert.equal((await request("/api/bookings/2/event/status", { method: "POST", body: { status: "cancelled", bookingIds: [2, 2], timeZone: "UTC" } })).status, 400); cases++;
  response = await request("/api/bookings/2/event/status", { method: "POST", body: { status: "cancelled", bookingIds: [2], timeZone: "UTC" } });
  assert.equal(response.status, 200); assert.equal(state.memory.data.bookings[1].status, "cancelled"); cases++;
  const select = state.memory.database.select; state.memory.database.select = () => { throw new Error("synthetic PRIVATE_BODY credential error"); };
  response = await request("/api/bookings/1/conversation");
  assert.equal(response.status, 500); assert.equal(JSON.stringify(response.body).includes("PRIVATE_BODY"), false); state.memory.database.select = select; cases++;
  console.log(`Passed ${cases} actual appointment API scenarios: Auth, ownership, strict validation, consent decisions, group scope/Pro, private history and safe errors. Loopback HTTP with mocked DB/Auth only.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  const resolvedDirectory = path.resolve(directory), workspace = path.resolve(process.cwd());
  assert.equal(path.dirname(resolvedDirectory).toLowerCase(), workspace.toLowerCase(), "Cleanup stays in the intended workspace");
  assert.ok(path.basename(resolvedDirectory).startsWith(".appointment-api-check-"), "Cleanup is restricted to this test's temporary directory");
  await rm(resolvedDirectory, { recursive: true, force: true }); delete globalThis.__appointmentApi;
  process.env = priorEnvironment; globalThis.fetch = realFetch;
}
