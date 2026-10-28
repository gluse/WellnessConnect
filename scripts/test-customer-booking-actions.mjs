// Real route/access/scheduling/storage decisions, with all service/DB imports replaced
// before evaluation. No dotenv, credentials, sockets, database or server startup.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { build } from "esbuild";
import { assertCustomerBookingChange } from "../server/customerBookings.ts";

const chain = result => new Proxy({}, { get(_target, name) {
  if (name === "then") return (yes, no) => Promise.resolve(result()).then(yes, no);
  return () => chain(result);
} });
let rows = [], writes = [], locks = 0;
const fakeDb = {
  select: () => chain(() => []),
  async transaction(callback) {
    const tx = {
      select: () => chain(() => { assert.ok(rows.length, "Unexpected DB read"); return rows.shift(); }),
      async execute() { locks++; },
      update: () => ({ set(value) { writes.push(value); return chain(() => [{ ...current, ...value }]); } }),
    };
    return callback(tx);
  },
};
globalThis.__bookingDependencies = { db: fakeDb };
async function loadBackend(entry, allow) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", packages: "external", write: false,
    plugins: [{ name: "isolated-booking-boundaries", setup(builder) {
      builder.onResolve({ filter: /^[a-z@]/ }, args => {
        if (args.path.startsWith("@shared/") || args.path.startsWith("node:")) return;
        return { path: import.meta.resolve(args.path), external: true };
      });
      builder.onResolve({ filter: /^\.\// }, async args => {
        if (!args.importer.replaceAll("\\", "/").includes("/server/")) return;
        const path = resolve(dirname(args.importer), args.path).replaceAll("\\", "/");
        if (allow.some(name => path.endsWith(`/server/${name}`))) return;
        const source = await readFile(args.importer, "utf8");
        const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
          .filter(match => match[2] === args.path).flatMap(match => match[1].split(",").map(name => name.trim()).filter(name => name && !name.startsWith("type ")));
        assert.ok(imports.length, `Unexpected side-effect/default import: ${args.path}`);
        return { path: JSON.stringify(imports), namespace: "booking-fixture" };
      });
      builder.onLoad({ filter: /.*/, namespace: "booking-fixture" }, args => ({ contents: JSON.parse(args.path).map(name =>
        /Error$|Unavailable$/.test(name) ? `export const ${name}=globalThis.__bookingDependencies.${name} ?? class ${name} extends Error {};`
          : `export const ${name}=globalThis.__bookingDependencies.${name} ?? (()=>{});`).join("\n"), loader: "js" }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const date = "2099-06-04", at = time => new Date(`${date}T${time}:00Z`);
const service = { id: 1, providerId: "provider", companyId: null, employeeId: null, duration: 30, cleanupTime: 120, serviceType: "one_to_one", isActive: true };
const schedule = { serviceId: null, scheduleType: "specific", specificDate: at("00:00"), startTime: "09:00", endTime: "12:00", timezone: "UTC", breaks: [], isActive: true };
const baseline = { id: 7, seekerId: "customer", serviceId: 1, providerId: "provider", companyId: null, employeeId: null, status: "confirmed", scheduledDate: at("09:00"), bookingDuration: 30, bookingCleanupTime: 15, participantCount: 1, totalAmount: "25.00", service };
let current = baseline;
const { storage: actualStorage, BookingConflictError } = await loadBackend("server/storage.ts", ["storage", "customerBookings", "searchInput"]);
const fixtures = {
  ...globalThis.__bookingDependencies, BookingConflictError,
  isAuthenticated(req, res, next) { if (!req.user) return res.status(401).json({ message: "Unauthorized" }); next(); },
  storage: {
    async getBookingById() { return current; },
    async getAvailabilityByProvider() { return [schedule]; },
    async getBookingsForResourceRange() { return [current, { ...baseline, id: 8, scheduledDate: at("10:00") }]; },
    async updateBookingStatus(...args) { writes.push(args); return { ...current, status: args[1] }; },
    async rescheduleBooking(...args) { writes.push(args); return { ...current, scheduledDate: args[1] }; },
  },
};
globalThis.__bookingDependencies = fixtures;
const { registerRoutes } = await loadBackend("server/routes.ts", ["routes", "companyAccess", "customerBookings", "schedulingRoutes"]);
const registered = [], app = () => {};
app.use = app.set = () => app;
for (const method of ["get", "post", "put", "patch", "delete"]) app[method] = (path, ...handlers) => { registered.push({ method, path, handlers }); return app; };
await registerRoutes(app);
const workspace = { company: null, permissions: { manageBookings: true, readAll: true } };
async function request(path, body = {}, extra = {}) {
  const route = registered.find(row => row.path === path && row.method === (path.endsWith("available-times") ? "get" : "patch"));
  const req = { user: { claims: { sub: "customer" } }, workspace, params: { id: "7" }, query: { date, timezone: "UTC" }, body, ...extra };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  let authorized = false;
  await route.handlers[0](req, res, () => { authorized = true; });
  if (authorized) await route.handlers.at(-1)(req, res);
  return res;
}
const statusPath = "/api/bookings/:id/status", movePath = "/api/bookings/:id/reschedule", timesPath = "/api/bookings/:id/available-times";
const move = { scheduledDate: at("11:00").toISOString(), seekerId: "attacker", totalAmount: "0" };
const oldError = console.error; console.error = () => {};
try {
  assert.equal((await request(statusPath, { status: "cancelled" })).code, 200);
  assert.deepEqual(writes.pop(), [7, "cancelled", "customer"]);
  assert.equal((await request(movePath, move)).code, 200);
  assert.deepEqual(writes.pop(), [7, at("11:00"), "customer"]);
  current = { ...baseline, status: "pending" };
  assert.equal((await request(statusPath, { status: "cancelled" })).code, 200); writes.pop();
  assert.equal((await request(movePath, move)).code, 200); writes.pop();
  current = baseline;
  // Customer access stays valid even with a provider workspace selected.
  assert.equal((await request(statusPath, { status: "cancelled" }, { workspace: { invalid: true } })).code, 200); writes.pop();
  for (const status of ["pending", "confirmed", "completed"]) assert.equal((await request(statusPath, { status })).code, 403);
  for (const path of [statusPath, movePath, timesPath]) {
    const body = path === statusPath ? { status: "cancelled" } : move;
    assert.equal((await request(path, body, { user: undefined })).code, 401);
    assert.equal((await request(path, body, { user: { claims: { sub: "other-customer" } } })).code, 403);
    current = undefined; assert.equal((await request(path, body)).code, 403); current = baseline;
    for (const status of ["cancelled", "completed"]) { current = { ...baseline, status }; assert.equal((await request(path, body)).code, 409); }
    current = { ...baseline, scheduledDate: new Date(0) }; assert.equal((await request(path, body)).code, 409); current = baseline;
    for (const id of ["7garbage", "0", "-1", "1.5"]) assert.equal((await request(path, body, { params: { id } })).code, 400);
  }
  assert.equal(writes.length, 0, "Denied calls have no write effects");
  assert.equal((await request(statusPath, { status: "unknown" })).code, 400);
  assert.equal((await request(timesPath, {}, { query: { date, timezone: "invalid" } })).code, 400);
  for (const scheduledDate of ["bad", "2020-01-01T00:00:00.000Z", null]) assert.equal((await request(movePath, { scheduledDate })).code, 400);
  const slots = (await request(timesPath)).data.slots;
  assert.equal(slots[0].startTime, "09:00", "Moving booking excludes itself");
  assert.equal(slots.at(-1).startTime, "11:15", "Saved cleanup replaces changed service cleanup");
  assert.ok(!slots.some(slot => slot.startTime === "10:00"), "Other bookings remain unavailable");
  const month = await request(timesPath, {}, { query: { month: "2099-06", timezone: "UTC" } });
  assert.equal(month.code, 200); assert.equal(month.data.days.find(day => day.date === date).availableSlots, slots.length);
  // Existing provider and employee boundaries still apply.
  assert.equal((await request(statusPath, { status: "completed" }, { user: { claims: { sub: "provider" } } })).code, 200); assert.equal(writes.pop()[2], undefined);
  current = { ...baseline, seekerId: "provider", scheduledDate: new Date(0) };
  assert.equal((await request(statusPath, { status: "completed" }, { user: { claims: { sub: "provider" } } })).code, 200, "Provider who is also customer retains provider rights for past bookings"); assert.equal(writes.pop()[2], undefined);
  current = baseline;
  assert.equal((await request(movePath, move, { user: { claims: { sub: "provider" } }, workspace: { company: null, permissions: { manageBookings: false } } })).code, 403);
  const employee = { user: { claims: { sub: "employee" } }, workspace: { company: { id: 3, providerId: "provider" }, membership: { employeeId: 4 }, permissions: { manageBookings: true, readAll: false } } };
  current = { ...baseline, companyId: 3, employeeId: 5 }; assert.equal((await request(movePath, move, employee)).code, 403);
  current = { ...current, employeeId: 4 }; assert.equal((await request(movePath, move, employee)).code, 200); writes.pop();
  current = baseline;
  fixtures.storage.rescheduleBooking = async () => { throw new BookingConflictError("This time slot is no longer available."); };
  assert.equal((await request(movePath, move)).code, 409);
  fixtures.storage.rescheduleBooking = async () => { throw new Error("PRIVATE_canary"); };
  const failure = await request(movePath, move); assert.equal(failure.code, 500); assert.ok(!JSON.stringify(failure.data).includes("PRIVATE_canary"));
  // Real transaction methods use locked state, before any update.
  const reset = locked => { current = baseline; rows = [[baseline], [locked]]; writes = []; locks = 0; };
  for (const method of ["cancel", "reschedule"]) {
    const invoke = () => method === "cancel" ? actualStorage.updateBookingStatus(7, "cancelled", "customer") : actualStorage.rescheduleBooking(7, at("11:00"), "customer");
    for (const locked of [{ ...baseline, status: "completed" }, { ...baseline, scheduledDate: new Date(0) }, { ...baseline, seekerId: "other" }]) {
      reset(locked); await assert.rejects(invoke); assert.equal(writes.length, 0); assert.equal(locks, 1);
    }
    reset(baseline);
    if (method === "reschedule") rows.push([service], [schedule], []);
    const updated = await invoke(); assert.equal(writes.length, 1); assert.equal(rows.length, 0);
    assert.equal(method === "cancel" ? updated.status : updated.scheduledDate.toISOString(), method === "cancel" ? "cancelled" : at("11:00").toISOString());
  }
  reset(baseline); await assert.rejects(actualStorage.updateBookingStatus(7, "completed", "customer")); assert.equal(writes.length, 0);
  reset(baseline); rows.push([service], [schedule]); await assert.rejects(actualStorage.rescheduleBooking(7, at("08:00"), "customer")); assert.equal(writes.length, 0);
  reset(baseline); rows.push([service], [schedule], [{ id: 8 }]); await assert.rejects(actualStorage.rescheduleBooking(7, at("11:00"), "customer")); assert.equal(writes.length, 0);
  assert.throws(() => assertCustomerBookingChange(baseline, "customer", baseline.scheduledDate), /future/, "Exact start time is no longer changeable");
} finally { console.error = oldError; delete globalThis.__bookingDependencies; }
console.log("Passed: customer booking authorization, future/state/input boundaries, provider permissions, saved availability and self-exclusion, safe failures, transactional rechecks, schedule/overlap conflict enforcement. Offline mocked adapters only.");
