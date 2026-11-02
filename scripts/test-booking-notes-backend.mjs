import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

// Production route/storage logic runs with explicit in-memory boundaries. Never
// import DB clients, auth providers, dotenv, notification transports or startup.
async function load(file, dependencies) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, console: { error() {} } }, { filename: file })(name => {
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
let rows = [], id = 1, notificationsEnabled = false;
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
    assert.equal(drizzle.getTableName(table), "bookings");
    return { values(input) { return { returning: async () => { const row = { ...input, id: id++ }; rows.push(row); return [{ ...row }]; } }; } };
  },
  async transaction(work) { return work(db); },
};
const dependencies = {
  "@shared/schema": schema, "./db": { db }, "drizzle-orm": drizzle, "@shared/provider": provider,
  "./storefronts": {}, "./addresses": { serviceLocation: value => value }, "@shared/scheduling": scheduling,
  "@shared/reviews": reviews, "./searchInput": searchInput, "./customerBookings": customerBookings,
  "./audit/context": auditContext, "./audit/events": auditEvents, "./audit/capture": auditCapture,
  "./notifications/repository": { assertReminderConfiguration() {}, async captureStatusEvent() {}, async reconcileBookingReminder() {}, async reconcileServiceReminders() {},
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
for (const notes of ["Bring a mat.\nLūdzu, zvaniet pie durvīm.\nПожалуйста, без звонка. <img src=x onerror=alert(1)>", null]) {
  rows = [];
  const created = await request("post", "/api/bookings", { user: { claims: { sub: "customer" } }, body: {
    serviceId: 7, scheduledDate: at("09:00").toISOString(), participantCount: 1, notes, seekerId: "spoofed", providerId: "spoofed", status: "confirmed",
  } });
  assert.equal(created.code, 200);
  assert.equal(created.data.notes, notes, "Real booking creation preserves supplied notes");
  assert.equal(rows[0].notes, notes, "Insert adapter receives exact notes");
  assert.equal(created.data.seekerId, "customer"); assert.equal(created.data.providerId, "provider"); assert.equal(created.data.status, "pending");
  const stored = await storage.getBookingsByProvider("provider");
  assert.equal(stored[0].notes, notes, "Real provider mapping retains persisted notes");
  for (notificationsEnabled of [false, true]) {
    const listed = await request("get", "/api/bookings/provider");
    assert.equal(listed.code, 200); assert.equal(listed.data.length, 1); assert.equal(listed.data[0].notes, notes, "Provider API retains notes with notifications on/off");
  }
}

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
console.log("Passed: booking POST/schema/storage/provider-list preserves multiline en/lv/ru notes and null; server identity/status, personal/company/employee visibility, auth guard and notifications mapping retained. All adapters injected; no DB clients, services, credentials or environment files loaded.");
