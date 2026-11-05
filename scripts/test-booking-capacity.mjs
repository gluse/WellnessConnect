import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
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
import * as money from "../server/money.ts";

// Never import server/db, dotenv, Auth, external providers or server startup.
// --original demonstrates the regression against tracked pre-fix modules.
const original = process.argv.includes("--original");
async function load(path, dependencies) {
  const source = original && ["shared/scheduling.ts", "server/storage.ts", "server/schedulingRoutes.ts"].includes(path)
    ? execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" })
    : await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, process: { env: {} }, console: { error() {} } }, { filename: path })(
    name => { assert.ok(Object.hasOwn(dependencies, name), `Blocked external import: ${path} -> ${name}`); return dependencies[name]; }, module, module.exports,
  );
  return module.exports;
}
const scheduling = await load("shared/scheduling.ts", {});
const date = "2099-06-04", at = time => new Date(`${date}T${time}:00Z`);
const service = { id: 1, providerId: "provider", companyId: null, employeeId: null, serviceType: "group", maxCapacity: 6,
  duration: 30, cleanupTime: 15, isActive: true, companyActive: true, instantBooking: true, currency: "EUR", price: "10", advancePaymentPercent: 0 };
const schedule = { id: 1, providerId: "provider", companyId: null, serviceId: null, scheduleType: "specific", specificDate: at("00:00"),
  startTime: "09:00", endTime: "12:00", timezone: "UTC", breaks: [], isActive: true };
const booking = (id, status = "confirmed", participantCount = 2, time = "09:00", overrides = {}) => ({ id, serviceId: 1, seekerId: `customer-${id}`,
  providerId: "provider", companyId: null, employeeId: null, scheduledDate: at(time), status, participantCount,
  bookingDuration: 30, bookingCleanupTime: 15, notificationRevision: 0, currency: "EUR", totalAmount: "20", advanceAmount: "0", ...overrides });
const slots = (bookings = [], overrides = {}) => scheduling.bookableSlots({ service, schedules: [schedule], bookings,
  date, timezone: "UTC", now: new Date("2099-01-01"), ...overrides });
const slot = (bookings, time = "09:00", overrides) => slots(bookings, overrides).find(row => row.startTime === time);

for (const status of ["pending", "cancelled"]) {
  assert.ok(slot([booking(1, status)]), `${status} must leave a slot available`);
  assert.ok(slot([booking(1, status)], "09:00", { service: { ...service, serviceType: "one_to_one" } }));
}
assert.equal(slot([booking(1)]).availableCapacity, 4, "Two participants leave four places");
assert.equal(slot([booking(1), booking(2, "confirmed", 3)]).availableCapacity, 1, "Reservations add their participant counts");
assert.equal(slot([booking(1), booking(2, "cancelled", 3)]).availableCapacity, 4, "Cancelling releases only that reservation's participants");
assert.equal(slot([booking(1), booking(2, "pending", 6)]).availableCapacity, 4, "Requests do not consume places");
assert.equal(slot([booking(1), booking(2, "completed", 4)]), undefined, "Confirmed/completed fill capacity together");
assert.equal(slot([booking(1, "confirmed", null)]).availableCapacity, 5, "Legacy participant count defaults to one");
assert.equal(slot([booking(1)], "09:00", { participantCount: 5 }), undefined);
assert.equal(slot([booking(1)], "09:00", { participantCount: 4 }).availableCapacity, 4);
for (const overrides of [{ serviceId: 2 }, { bookingDuration: 45 }, { bookingCleanupTime: 0 }]) {
  assert.equal(slot([booking(1, "confirmed", 1, "09:00", overrides)]), undefined, "Different service/session shapes cannot share a resource");
}
assert.equal(slot([booking(1)], "09:15"), undefined, "Overlapping different session cannot use spare places");
assert.equal(slot([booking(1)], "09:30"), undefined, "Cleanup remains occupied");
assert.ok(slot([booking(1)], "09:45"), "Exact cleanup-end boundary is free");
assert.equal(slot([booking(1)], "09:00", { service: { ...service, serviceType: "one_to_one" } }), undefined);

const dialect = new PgDialect();
let rows = [], events = [], id = 100, lock = false, transactionActive = false;
const camel = value => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
// A small relational adapter evaluates the actual parameterized WHERE clauses.
// It knows no booking status policy or capacity rule; those run in production code.
function matches(row, table, predicate) {
  if (!predicate) return true;
  const { sql, params } = dialect.sqlToQuery(predicate);
  let accepted = true;
  const value = index => params[Number(index) - 1];
  for (const match of sql.matchAll(/"(\w+)"\."(\w+)" (=|<>|>=|<=|>|<) \$(\d+)(?!\d)/g)) {
    if (match[1] !== table) continue;
    let left = row[camel(match[2])], right = value(match[4]);
    if (left instanceof Date) { left = left.getTime(); right = new Date(right).getTime(); }
    accepted &&= ({ "=": () => left === right, "<>": () => left !== right, ">=": () => left >= right,
      "<=": () => left <= right, ">": () => left > right, "<": () => left < right })[match[3]]();
  }
  for (const match of sql.matchAll(/"(\w+)"\."(\w+)" in \(([^)]+)\)/g)) {
    if (match[1] === table) accepted &&= [...match[3].matchAll(/\$(\d+)/g)].some(item => value(item[1]) === row[camel(match[2])]);
  }
  for (const match of sql.matchAll(/"(\w+)"\."(\w+)" is null/gi)) if (match[1] === table) accepted &&= row[camel(match[2])] == null;
  const busyEnd = sql.match(/interval '1 minute' > \$(\d+)::timestamp/);
  if (busyEnd) accepted &&= new Date(row.scheduledDate).getTime() + ((row.bookingDuration ?? service.duration) + (row.bookingCleanupTime ?? 0)) * 60_000 > Date.parse(value(busyEnd[1]));
  return accepted;
}
function select(fields) {
  let table, predicate, joined = false;
  const query = {
    from(value) { table = drizzle.getTableName(value); return query; },
    leftJoin() { joined = true; return query; }, innerJoin() { return query; }, groupBy() { return query; }, orderBy() { return query; },
    where(value) { predicate = value; return query; }, for() { return query; },
    as() { return { serviceId: drizzle.sql`review_stats.service_id`, rating: drizzle.sql`review_stats.rating`, reviewCount: drizzle.sql`review_stats.review_count` }; },
    then(resolve, reject) {
      const data = table === "bookings" ? rows : table === "services" ? [service] : table === "availability" ? [schedule] : [];
      if (transactionActive && fields?.booking && table === "bookings") { assert.equal(lock, true, "Check capacity only under the provider lock"); events.push("capacity"); }
      const result = data.filter(row => matches(row, table, predicate)).map(row => fields?.booking ? { booking: { ...row }, duration: service.duration }
        : joined && table === "bookings" ? { bookings: { ...row }, services: service, users: { id: "provider", providerType: "individual" }, companies: null, employees: null }
          : { ...row });
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}
const db = { select,
  async execute() { lock = true; events.push("provider-lock"); },
  insert() { return { values(input) { return { returning: async () => { assert.ok(lock); events.push("insert"); const created = { ...input, id: input.id ?? id++ }; rows.push(created); return [{ ...created }]; } }; } }; },
  update() { let changes, predicate; const query = { set(value) { changes = value; return query; }, where(value) { predicate = value; return query; },
    async returning() { assert.ok(lock); events.push("update"); return rows.filter(row => matches(row, "bookings", predicate)).map(row => Object.assign(row, changes)); } }; return query; },
  async transaction(work) { const before = rows.map(row => ({ ...row })); lock = false; transactionActive = true; try { return await work(db); } catch (error) { rows = before; throw error; } finally { lock = false; transactionActive = false; } },
};
const dependencies = {
  "./money": money,
  "node:crypto": await import("node:crypto"),
  "@shared/schema": schema, "./db": { db }, "drizzle-orm": drizzle, "@shared/provider": provider,
  "./storefronts": {}, "./addresses": { serviceLocation: value => value }, "@shared/scheduling": scheduling,
  "@shared/reviews": reviews, "./searchInput": searchInput, "./customerBookings": customerBookings,
  "./audit/context": auditContext, "./audit/events": auditEvents, "./audit/capture": auditCapture,
  // Concurrent TASK-032 notification capture/reminders are separate adapters.
  "./notifications/repository": { assertReminderConfiguration() {}, async captureStatusEvent() { return { mode: "none" }; }, async reconcileBookingReminder() {}, async reconcileServiceReminders() {} },
  "./notifications/policy": { statusAction: () => null },
};
const storageModule = await load("server/storage.ts", dependencies);
const storage = new storageModule.DatabaseStorage();
const conflict = error => error instanceof storageModule.BookingConflictError;
const reset = data => { rows = data.map(row => ({ ...row })); events = []; lock = false; };
const create = (count = 1, status = "confirmed", time = "09:00", overrides = {}) => storage.createBooking(booking(undefined, status, count, time, overrides));

reset([booking(1, "pending", 6)]);
await create(2); await create(4);
await assert.rejects(() => create(1), conflict);
assert.equal(rows.length, 3, "Rejected booking leaves records untouched");
reset([booking(1, "pending", 6)]);
await create(6, "pending"); await create(6, "pending");
assert.equal(rows.length, 3, "Multiple requests leave capacity open");
await storage.updateBookingStatus(1, "confirmed");
await assert.rejects(() => storage.updateBookingStatus(rows[1].id, "confirmed"), conflict);
assert.equal(rows[1].status, "pending", "Rejected approval stays pending");
assert.ok(events.indexOf("provider-lock") < events.indexOf("capacity"));
reset([booking(1, "confirmed", 2), booking(2, "pending", 4)]);
await storage.updateBookingStatus(2, "confirmed");
assert.equal(rows[1].status, "confirmed");
reset([booking(1, "confirmed", 2), booking(2, "pending", 4)]);
service.duration = 60; service.cleanupTime = 120;
await storage.updateBookingStatus(2, "confirmed");
assert.equal(rows[1].status, "confirmed", "Approval uses saved duration/cleanup after listing edits");
await assert.rejects(() => create(1), conflict);
service.duration = 30; service.cleanupTime = 15;
reset([booking(1, "confirmed", 2), booking(2, "pending", 5)]);
await assert.rejects(() => storage.updateBookingStatus(2, "confirmed"), conflict);
await assert.rejects(() => storage.updateBookingStatus(2, "completed"), conflict);
await assert.rejects(() => storage.updateBookingStatus(2, "confirmed", "customer-2"), conflict);
await assert.rejects(() => storage.updateBookingStatus(2, "cancelled", "other-customer"), error => error instanceof customerBookings.CustomerBookingError && error.status === 403);
await storage.updateBookingStatus(2, "cancelled", "customer-2");
assert.equal(rows[1].status, "cancelled");
reset([booking(1, "confirmed", 2), booking(2, "confirmed", 4, "10:00")]);
await storage.rescheduleBooking(2, at("09:00"));
assert.equal(rows[1].scheduledDate.getTime(), at("09:00").getTime());
reset([booking(1, "confirmed", 2), booking(2, "pending", 5, "10:00")]);
await assert.rejects(() => storage.rescheduleBooking(2, at("09:00")), conflict);
assert.equal(rows[1].scheduledDate.getTime(), at("10:00").getTime());
reset([booking(1, "pending", 6), booking(2, "confirmed", 6, "10:00")]);
await storage.rescheduleBooking(2, at("09:00"));
reset([booking(1, "confirmed", 1, "09:00", { serviceId: 2 })]);
await assert.rejects(() => create(1), conflict);
await assert.rejects(() => create(1, "confirmed", "09:30"), conflict);
await create(1, "confirmed", "09:45");
reset([booking(1, "confirmed", 6, "09:00", { employeeId: 2 })]);
await create(6);
reset([booking(1, "confirmed", 6, "09:00", { providerId: "other-provider" })]);
await create(6);
for (const count of [0, -1, 1.5, 7]) { reset([]); await assert.rejects(() => create(count), conflict); }
service.serviceType = "one_to_one";
reset([booking(1, "pending", 1)]);
await create(1);
await assert.rejects(() => create(1), conflict);
await assert.rejects(() => storage.updateBookingStatus(1, "confirmed"), conflict);
service.serviceType = "group";

// Range/day queries used by scheduling APIs must exclude requests, while list
// endpoints retain them. Adapter's lock assertion applies only to writes.
reset([booking(1, "pending"), booking(2), booking(3, "completed"), booking(4, "cancelled")]);
assert.deepEqual(Array.from(await storage.getBookingsForResourceRange(service, at("08:00"), at("12:00")), row => row.id), [2, 3]);
assert.deepEqual(Array.from(await storage.getBookingsForServiceOnDate(1, at("00:00")), row => row.id), [2, 3]);
assert.deepEqual(Array.from(await storage.getBookingsForProviderOnDate("provider", at("00:00")), row => row.id), [2, 3]);
assert.deepEqual(Array.from(await storage.getBookingsBySeeker("customer-1"), row => row.id), [1], "Customer lists retain pending requests");
assert.deepEqual(Array.from(await storage.getBookingsByProvider("provider"), row => row.id), [1, 2, 3, 4], "Provider lists retain all statuses");

const access = await load("server/companyAccess.ts", { "./db": { db }, "drizzle-orm": drizzle, "@shared/schema": schema, "./customerBookings": customerBookings });
storage.getServiceById = async () => ({ ...service });
storage.getAvailabilityByProvider = async () => [schedule];
storage.getBookingById = async id => { const row = rows.find(row => row.id === id); return row && { ...row, service: { ...service } }; };
const schedulingRoutes = await load("server/schedulingRoutes.ts", { zod: { z }, "@shared/scheduling": scheduling,
  "./storage": { storage }, "./auth": { isAuthenticated: (_req, _res, next) => next() }, "./companyAccess": access, "./customerBookings": customerBookings });
const routes = [], app = () => {};
app.use = app.set = () => app;
for (const method of ["get", "post", "patch", "put", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
const noop = () => {};
class ProviderError extends Error {}
const routeDependencies = { ...dependencies, http: { createServer: () => ({ close() {} }) }, "./storage": { ...storageModule, storage },
  "./search-pagination/store": { createSearchPageStore: () => ({}) },
  "./wishlist/routes": { setupWishlistRoutes: noop }, "./wishlist/postgres": { createWishlistStore: () => ({}) },
  "./wishlist/service": { createWishlistService: () => ({}) }, "./wishlist/inbox": { createInboxService: () => ({}) },
  "./auth": { setupAuth: noop, isAuthenticated: noop }, zod: { z }, "./companyAccess": access, "./schedulingRoutes": schedulingRoutes,
  "./supabase": {}, "./imageStorage": { ImageStorageError: ProviderError }, "./embeddings": {}, "./geocoding": { GeocodingError: ProviderError },
  "./registeredLocations": {}, "./searchLocations": {}, "./categories": {}, "@shared/categories": { CategoryError: ProviderError }, "./audit/http": {},
  "./notifications/routes": { setupNotificationRoutes: noop }, "./appointments/routes": { setupAppointmentRoutes: noop }, "./notifications/transports": { notificationConfig: () => ({ enabled: false }) }, "@shared/notifications": notifications };
for (const [module, method] of Object.entries({ publicSearch: "setupPublicSearchRoutes", searchLocationRoutes: "setupSearchLocationRoutes", payments: "setupPaymentRoutes",
  companyRoutes: "setupCompanyRoutes", adminRoutes: "setupAdminRoutes", categoryRoutes: "setupCategoryRoutes", reviewRoutes: "setupReviewRoutes",
  providerCatalogRoutes: "setupProviderCatalogRoutes", storefrontRoutes: "setupStorefrontRoutes", serviceViewRoutes: "setupServiceViewRoutes" })) routeDependencies[`./${module}`] = { [method]: noop };
const { registerRoutes } = await load("server/routes.ts", routeDependencies);
await registerRoutes(app);
async function request(method, path, extra = {}) {
  let code = 200, data;
  const res = { status(value) { code = value; return this; }, json(value) { data = value; return this; } };
  await routes.find(route => route.method === method && route.path === path).handlers.at(-1)({ user: { claims: { sub: "provider" } },
    workspace: { company: null, permissions: { manageBookings: true, readAll: true } }, params: { id: "2", serviceId: "1" },
    query: { date, timezone: "UTC" }, body: {}, ...extra }, res);
  return { code, data };
}
reset([booking(1, "confirmed", 2), booking(2, "pending", 5, "10:00")]);
const daily = await request("get", "/api/availability/slots/:serviceId");
assert.equal(daily.data.slots.find(row => row.startTime === "09:00").availableCapacity, 4);
const monthly = await request("get", "/api/availability/month/:serviceId", { query: { month: "2099-06", timezone: "UTC" } });
assert.equal(monthly.data.days.find(day => day.date === date).availableSlots, daily.data.slots.length);
const preview = await request("get", "/api/bookings/:id/available-times");
assert.equal(preview.data.slots.some(row => row.startTime === "09:00"), false, "Move previews require all five existing participants");
const previewMonth = await request("get", "/api/bookings/:id/available-times", { query: { month: "2099-06", timezone: "UTC" } });
assert.equal(previewMonth.data.days.find(day => day.date === date).availableSlots, preview.data.slots.length);
rows[1].scheduledDate = at("09:00");
const rejected = await request("patch", "/api/bookings/:id/status", { body: { status: "confirmed" } });
assert.equal(rejected.code, 409); assert.equal(rows[1].status, "pending");
const forbidden = await request("patch", "/api/bookings/:id/status", { user: { claims: { sub: "other-provider" } }, body: { status: "confirmed" } });
assert.equal(forbidden.code, 403); assert.equal(rows[1].status, "pending");
const unchangedDate = rows[1].scheduledDate.getTime();
for (const actor of ["provider", "customer-2"]) {
  const consent = await request("patch", "/api/bookings/:id/reschedule", { user: { claims: { sub: actor } }, body: { scheduledDate: at("11:00").toISOString() } });
  assert.equal(consent.code, 409); assert.equal(consent.data.code, "consent_required");
  assert.equal(rows[1].scheduledDate.getTime(), unchangedDate, "The legacy API cannot bypass recipient agreement");
}
reset([]); service.instantBooking = false;
const pending = await request("post", "/api/bookings", { body: { serviceId: 1, expectedPrice: service.price, expectedCurrency: service.currency, expectedAdvancePaymentPercent: service.advancePaymentPercent ?? 0, scheduledDate: at("09:00").toISOString(), participantCount: 2, status: "confirmed", seekerId: "spoofed" } });
assert.equal(pending.code, 200); assert.equal(pending.data.status, "pending"); assert.equal(pending.data.seekerId, "provider");
service.instantBooking = true;
const first = await request("post", "/api/bookings", { body: { serviceId: 1, expectedPrice: service.price, expectedCurrency: service.currency, expectedAdvancePaymentPercent: service.advancePaymentPercent ?? 0, scheduledDate: at("09:00").toISOString(), participantCount: 2 } });
const second = await request("post", "/api/bookings", { body: { serviceId: 1, expectedPrice: service.price, expectedCurrency: service.currency, expectedAdvancePaymentPercent: service.advancePaymentPercent ?? 0, scheduledDate: at("09:00").toISOString(), participantCount: 4 } });
const full = await request("post", "/api/bookings", { body: { serviceId: 1, expectedPrice: service.price, expectedCurrency: service.currency, expectedAdvancePaymentPercent: service.advancePaymentPercent ?? 0, scheduledDate: at("09:00").toISOString(), participantCount: 1 } });
assert.equal(first.code, 200); assert.equal(second.code, 200); assert.equal(full.code, 409);
console.log("Passed: pending availability, shared group capacity, exclusive employee sessions, cleanup/snapshots, creation/approval/reschedule conflicts, participant validation, SQL filters, daily/month previews, server-owned status/identity and API 403/409. Only injected in-memory adapters; no live clients or environment files loaded.");
