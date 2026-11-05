import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { createAppointmentRepository } from "../server/appointments/repository.ts";
import { memoryDatabase } from "./fixtures/notification-database.mjs";
import { z } from "zod";
import * as drizzle from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema.ts";
import * as provider from "../shared/provider.ts";
import * as reviews from "../shared/reviews.ts";
import * as searchInput from "../server/searchInput.ts";
import * as auditContext from "../server/audit/context.ts";
import * as auditEvents from "../server/audit/events.ts";
import * as auditCapture from "../server/audit/capture.ts";
import * as customerBookings from "../server/customerBookings.ts";
import * as notifications from "../shared/notifications.ts";

// Production route/storage logic runs with explicit in-memory boundaries. Never
// import DB clients, auth providers, dotenv, notification transports or startup.
async function load(file, dependencies) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, process: { env: {} }, console: { error(...args) { logs.push(args); } } }, { filename: file })(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Blocked external import: ${file} -> ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const scheduling = await load("shared/scheduling.ts", {});
const day = "2099-06-04", at = time => new Date(`${day}T${time}:00Z`);
const service = { id: 7, providerId: "provider", companyId: null, employeeId: null, serviceType: "group", maxCapacity: 6,
  duration: 30, cleanupTime: 0, isActive: true, companyActive: true, instantBooking: false, price: "10", advancePaymentPercent: 0 };
const schedule = { id: 1, providerId: "provider", companyId: null, serviceId: null, scheduleType: "specific", specificDate: at("00:00"), startTime: "09:00", endTime: "12:00", timezone: "UTC", breaks: [], isActive: true };
const dialect = new PgDialect();
let rows = [], messages = [], reminders = [], logs = [], id = 1, notificationsEnabled = false, failMessage = false, failReminder = false;
const camel = name => name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
function matches(row, table, predicate) {
  if (!predicate) return true;
  const query = dialect.sqlToQuery(predicate), value = index => query.params[Number(index) - 1];
  for (const match of query.sql.matchAll(/"(\w+)"\."(\w+)" (=|<>|>=|<=|>|<) \$(\d+)(?!\d)/g)) {
    if (match[1] !== table) continue;
    let left = row[camel(match[2])], right = value(match[4]);
    if (left instanceof Date) { left = left.getTime(); right = new Date(right).getTime(); }
    if (!({ "=": () => left === right, "<>": () => left !== right, ">=": () => left >= right,
      "<=": () => left <= right, ">": () => left > right, "<": () => left < right })[match[3]]()) return false;
  }
  for (const match of query.sql.matchAll(/"(\w+)"\."(\w+)" is null/gi)) if (match[1] === table && row[camel(match[2])] != null) return false;
  for (const match of query.sql.matchAll(/"(\w+)"\."(\w+)" in \(([^)]+)\)/g)) {
    if (match[1] === table && ![...match[3].matchAll(/\$(\d+)/g)].some(item => value(item[1]) === row[camel(match[2])])) return false;
  }
  return true;
}
const db = {
  select(fields) {
    let table, predicate, joined = false;
    const query = {
      from(value) { table = drizzle.getTableName(value); return query; },
      where(value) { predicate = value; return query; },
      leftJoin() { joined = true; return query; }, innerJoin() { return query; }, groupBy() { return query; }, orderBy() { return query; }, for() { return query; },
      as() { return { serviceId: drizzle.sql`review_stats.service_id`, rating: drizzle.sql`review_stats.rating`, reviewCount: drizzle.sql`review_stats.review_count` }; },
      then(resolve, reject) {
        const data = table === "bookings" ? rows : table === "services" ? [service] : table === "availability" ? [schedule] : [];
        return Promise.resolve(data.filter(row => matches(row, table, predicate)).map(row => fields?.booking ? { booking: { ...row }, duration: service.duration }
          : joined && table === "bookings" ? { bookings: { ...row }, services: { ...service }, users: { id: row.seekerId, firstName: "Synthetic" }, addresses: null }
            : { ...row })).then(resolve, reject);
      },
    };
    return query;
  },
  async execute() {},
  insert(table) {
    const name = drizzle.getTableName(table);
    assert.ok(["bookings", "booking_messages"].includes(name));
    return { values(input) {
      const persist = () => {
        if (name === "booking_messages" && failMessage) throw new Error(`PRIVATE query parameters: ${input.body}`);
        const row = { ...input, id: input.id ?? id++ };
        (name === "bookings" ? rows : messages).push(row);
        return [{ ...row }];
      };
      return { returning: async () => persist(), then: (yes, no) => Promise.resolve().then(persist).then(yes, no) };
    } };
  },
  async transaction(work) {
    const previous = [rows.slice(), messages.slice(), reminders.slice()];
    try { return await work(db); } catch (error) { [rows, messages, reminders] = previous; throw error; }
  },
};
const dependencies = {
  "@shared/schema": schema, "./db": { db }, "drizzle-orm": drizzle, "@shared/provider": provider, "node:crypto": { randomUUID },
  "./storefronts": {}, "./addresses": { serviceLocation: value => value }, "@shared/scheduling": scheduling,
  "@shared/reviews": reviews, "./searchInput": searchInput, "./customerBookings": customerBookings,
  "./audit/context": auditContext, "./audit/events": auditEvents, "./audit/capture": auditCapture,
  "./notifications/repository": { assertReminderConfiguration() {}, async captureStatusEvent() {}, async reconcileBookingReminder(_tx, booking) { reminders.push(booking.id); if (failReminder) throw Error("PRIVATE reminder failure"); }, async reconcileServiceReminders() {},
    async bookingReminderSummaries(_db, visible) { return new Map(visible.map(row => [row.id, { state: "off" }])); } },
  "./notifications/policy": { statusAction: () => null },
};
const storageModule = await load("server/storage.ts", dependencies), storage = new storageModule.DatabaseStorage();
storage.getServiceById = async () => ({ ...service });
const access = await load("server/companyAccess.ts", { "./db": { db }, "drizzle-orm": drizzle, "@shared/schema": schema, "./customerBookings": customerBookings });
const noop = () => {};
const isAuthenticated = (req, res, next) => req.user?.claims?.sub ? next() : res.status(401).json({ message: "Unauthorized" });
class ProviderError extends Error {}
const routeDependencies = { ...dependencies, http: { createServer: () => ({ close() {} }) }, "./storage": { ...storageModule, storage },
  "./wishlist/routes": { setupWishlistRoutes: noop }, "./wishlist/postgres": { createWishlistStore: () => ({}) },
  "./wishlist/service": { createWishlistService: () => ({}) }, "./wishlist/inbox": { createInboxService: () => ({}) },
  "./auth": { setupAuth: noop, isAuthenticated }, zod: { z }, "./companyAccess": access,
  "./supabase": {}, "./imageStorage": { ImageStorageError: ProviderError }, "./embeddings": {}, "./geocoding": { GeocodingError: ProviderError },
  "./registeredLocations": {}, "./searchLocations": {}, "./categories": {}, "@shared/categories": { CategoryError: ProviderError }, "./audit/http": {},
  "./notifications/transports": { notificationConfig: () => ({ enabled: notificationsEnabled }) }, "@shared/notifications": notifications };
for (const [module, method] of Object.entries({ publicSearch: "setupPublicSearchRoutes", searchLocationRoutes: "setupSearchLocationRoutes", payments: "setupPaymentRoutes",
  companyRoutes: "setupCompanyRoutes", schedulingRoutes: "setupSchedulingRoutes", adminRoutes: "setupAdminRoutes", categoryRoutes: "setupCategoryRoutes", reviewRoutes: "setupReviewRoutes",
  providerCatalogRoutes: "setupProviderCatalogRoutes", storefrontRoutes: "setupStorefrontRoutes", serviceViewRoutes: "setupServiceViewRoutes", "notifications/routes": "setupNotificationRoutes", "appointments/routes": "setupAppointmentRoutes" })) routeDependencies[`./${module}`] = { [method]: noop };
const routes = [], app = () => {};
app.use = app.set = () => app;
for (const method of ["get", "post", "patch", "put", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
await (await load("server/routes.ts", routeDependencies)).registerRoutes(app);
const personal = { company: null, membership: null, permissions: { readAll: true }, invalid: false };
async function request(method, path, options = {}) {
  let code = 200, data;
  const req = { user: { claims: { sub: "provider" } }, workspace: personal, body: {}, ...options };
  const res = { status(value) { code = value; return this; }, json(value) { data = value; return this; } };
  const route = routes.find(item => item.method === method && item.path === path);
  assert.equal(route.handlers[0], isAuthenticated, "Booking endpoint retains auth guard");
  let allowed = false;
  await route.handlers[0](req, res, () => { allowed = true; });
  if (allowed) await route.handlers.at(-1)(req, res);
  return { code, data };
}
const text = "Bring a mat.\nLūdzu, zvaniet pie durvīm.\nПожалуйста, без звонка. <img src=x onerror=alert(1)>";
const reset = () => { rows = []; messages = []; reminders = []; logs = []; failMessage = failReminder = false; };
const createBooking = input => request("post", "/api/bookings", { user: { claims: { sub: "customer" } }, body: {
  serviceId: 7, scheduledDate: at("09:00").toISOString(), participantCount: 1,
  seekerId: "spoofed", providerId: "spoofed", status: "completed", authorRole: "provider", authorId: "intruder", createdAt: "1900-01-01Z", ...input,
} });
let cases = 0;
for (const instantBooking of [false, true]) {
  service.instantBooking = instantBooking;
  for (const input of [{ initialMessage: `  ${text}\n ` }, { notes: text }, { initialMessage: text, notes: ` ${text} ` }]) {
    reset(); const created = await createBooking(input);
    assert.equal(created.code, 200); assert.equal(created.data.notes, null);
    assert.equal(created.data.seekerId, "customer"); assert.equal(created.data.providerId, "provider");
    assert.equal(created.data.status, instantBooking ? "confirmed" : "pending");
    assert.equal(messages.length, 1); assert.equal(messages[0].body, text);
    assert.equal(messages[0].bookingId, created.data.id); assert.equal(messages[0].authorId, "customer");
    assert.equal(messages[0].authorRole, "customer"); assert.equal(messages[0].broadcastId, null);
    assert.equal(messages[0].createdAt.getTime(), created.data.createdAt.getTime());
    assert.ok(created.data.createdAt.getFullYear() > 2020);
    assert.match(messages[0].clientRequestId, /^[0-9a-f-]{36}$/); assert.match(messages[0].id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(reminders, [created.data.id]);
    for (notificationsEnabled of [false, true]) {
      const listed = await request("get", "/api/bookings/provider");
      assert.equal(listed.code, 200); assert.equal(listed.data[0].notes, null);
    }
    // Read the actual inserted rows through real conversation authorization/query
    // logic, using the existing relational boundary rather than a fake message API.
    const memory = memoryDatabase({ bookings: rows, booking_messages: messages, services: [service],
      users: [{ id: "customer", firstName: "Synthetic" }, { id: "provider", firstName: "Provider" }] });
    const conversations = createAppointmentRepository(memory.database);
    for (const actor of [{ id: "customer", role: "customer" }, { id: "provider", role: "provider" }]) {
      const history = await conversations.conversation(actor, created.data.id);
      assert.equal(history.messages.length, 1); assert.equal(history.messages[0].body, text);
      assert.equal(history.messages[0].authorRole, "customer");
    }
    await assert.rejects(() => conversations.conversation({ id: "other-customer", role: "customer" }, created.data.id), error => error.code === "forbidden");
    await assert.rejects(() => conversations.conversation({ id: "provider", role: "provider", companyId: 9 }, created.data.id), error => error.code === "forbidden");
    cases++;
  }
}
service.instantBooking = false;
for (const input of [{}, { initialMessage: null }, { initialMessage: " \n " }, { notes: null }, { notes: "  " }]) {
  reset(); assert.equal((await createBooking(input)).code, 200); assert.equal(messages.length, 0); assert.equal(rows[0].notes, null); cases++;
}
reset(); assert.equal((await createBooking({ initialMessage: "x".repeat(4000) })).code, 200); assert.equal(messages[0].body.length, 4000); cases++;
for (const input of [{ initialMessage: "x".repeat(4001) }, { notes: "x".repeat(4001) }, { initialMessage: 7 }, { initialMessage: {} }, { initialMessage: "one", notes: "two" }]) {
  reset(); assert.equal((await createBooking(input)).code, 400); assert.equal(rows.length, 0); assert.equal(messages.length, 0); cases++;
}
for (const failure of ["message", "reminder"]) {
  reset(); failMessage = failure === "message"; failReminder = failure === "reminder";
  const failed = await createBooking({ initialMessage: text });
  assert.equal(failed.code, 500); assert.equal(rows.length, 0); assert.equal(messages.length, 0); assert.equal(reminders.length, 0);
  assert.equal(JSON.stringify(logs).includes(text), false); assert.equal(JSON.stringify(logs).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(failed.data).includes(text), false); cases++;
}
reset(); const first = await createBooking({ initialMessage: text, participantCount: 6 }); assert.equal(first.code, 200);
// Approval, not a pending request, occupies group capacity under existing policy.
rows[0].status = "confirmed";
assert.equal((await createBooking({ initialMessage: "Must not be saved" })).code, 409);
assert.equal(rows.length, 1); assert.equal(messages.length, 1); cases++;
assert.equal((await request("post", "/api/bookings", { user: null })).code, 401); cases++;

// Actual storage SQL filters personal/company scope; actual route scope filters
// employee visibility. Synthetic adapter interprets predicates, not note policy.
const base = { ...rows[0], notes: "Synthetic private note" };
rows = [base, { ...base, id: 10, providerId: "other-provider" }, { ...base, id: 11, companyId: 12, employeeId: 21 }, { ...base, id: 12, companyId: 12, employeeId: 22 }];
assert.deepEqual(Array.from((await request("get", "/api/bookings/provider")).data, row => row.id), [base.id]);
const employeeScope = { company: { id: 12, providerId: "provider" }, membership: { employeeId: 21 }, permissions: { readAll: false }, invalid: false };
const employee = await request("get", "/api/bookings/provider", { user: { claims: { sub: "employee" } }, workspace: employeeScope });
assert.equal(employee.code, 200); assert.deepEqual(Array.from(employee.data, row => row.id), [11]); assert.equal(employee.data[0].notes, base.notes);
assert.equal((await request("get", "/api/bookings/provider", { workspace: { ...employeeScope, invalid: true } })).code, 403);
assert.equal((await request("get", "/api/bookings/provider", { user: null })).code, 401);
console.log(`Passed ${cases} initial-message scenarios: pending/instant, alias/conflicts, blank/limits/Unicode, server identity/timestamp, atomic rollback on message/reminder failures, private conversation visibility, capacity/auth and redacted logs. Historical DTO/workspace filtering retained. All persistence in memory; no credentials or services.`);
