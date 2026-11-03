import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as drizzle from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema.ts";
import * as provider from "../shared/provider.ts";
import * as scheduling from "../shared/scheduling.ts";
import * as reviews from "../shared/reviews.ts";
import * as searchInput from "../server/searchInput.ts";
import * as auditContext from "../server/audit/context.ts";
import * as auditEvents from "../server/audit/events.ts";
import * as auditCapture from "../server/audit/capture.ts";

// Execute the actual storage module against an injected query adapter. The
// import whitelist deliberately prevents loading server/db or any live client.
const fixtures = new Map(), executed = [];
const dialect = new PgDialect();
let slugsLoaded = 0;
const db = { select() {
  let table, predicate, limit, ordering;
  const query = {
    from(value) { table = drizzle.getTableName(value); return query; },
    leftJoin() { return query; }, innerJoin() { return query; }, groupBy() { return query; },
    where(value) { predicate = value; return query; },
    orderBy(...values) { ordering = values; return query; },
    limit(value) { limit = value; return query; },
    as() { return { serviceId: drizzle.sql`review_stats.service_id`, rating: drizzle.sql`review_stats.rating`, reviewCount: drizzle.sql`review_stats.review_count` }; },
    then(resolve, reject) {
      executed.push({ table, limit, where: predicate && dialect.sqlToQuery(predicate), ordering });
      const rows = fixtures.get(table) ?? [];
      return Promise.resolve(limit === undefined ? rows : rows.slice(0, limit)).then(resolve, reject);
    },
  };
  return query;
} };
const dependencies = {
  "@shared/schema": schema, "./db": { db }, "drizzle-orm": drizzle,
  "@shared/provider": provider,
  "./storefronts": { storefrontStore: { async slugs() { slugsLoaded++; return new Map(); } } },
  "./addresses": { serviceLocation: (service, address) => ({ ...service, latitude: address?.latitude ?? null, longitude: address?.longitude ?? null }) },
  "@shared/scheduling": scheduling, "@shared/reviews": reviews, "./searchInput": searchInput,
  "./audit/context": auditContext, "./audit/events": auditEvents, "./audit/capture": auditCapture,
  "./customerBookings": { assertCustomerBookingChange() { throw new Error("Unexpected booking mutation"); } },
  "./notifications/repository": new Proxy({}, { get() { return () => { throw new Error("Unexpected notification operation"); }; } }),
  "./notifications/policy": { statusAction() { throw new Error("Unexpected booking status action"); } },
};
const source = await readFile(new URL("../server/storage.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, console }, { filename: "server/storage.ts" })(
  name => { assert.ok(Object.hasOwn(dependencies, name), `Blocked live import: ${name}`); return dependencies[name]; }, module, module.exports,
);
const storage = new module.exports.DatabaseStorage();
const result = (id, companyId = null) => ({
  services: { id, providerId: "fixture-provider", companyId, employeeId: null, name: "Fixture", duration: 60, isActive: true, ageGroups: ["adults"], createdAt: new Date("2026-01-01") },
  users: { id: "fixture-provider", providerType: "individual", firstName: "Fixture" },
  addresses: { latitude: 0, longitude: 0 }, companies: companyId == null ? null : { id: companyId, name: "Fixture company", isActive: true },
  employees: null, review_stats: null,
});
const tooBroad = error => error instanceof searchInput.SearchError && error.status === 422 && error.code === "SEARCH_TOO_BROAD";

await assert.rejects(() => storage.searchServices({ availableOnly: true, date: "2026-01-01", dateEnd: "9999-12-31" }));
assert.equal(executed.length, 0, "Invalid range must fail before any query");
fixtures.set("services", Array.from({ length: 501 }, (_, id) => result(id + 1)));
await assert.rejects(() => storage.searchServices({}), tooBroad);
assert.equal(executed.at(-1).limit, 501);
assert.equal(slugsLoaded, 0, "Overflow must stop before hydration/enrichment");
const scoped = await storage.searchServices({ providerId: "fixture-provider" });
assert.equal(scoped.length, 501, "Scoped catalog compatibility is retained until separate pagination work");
assert.equal(executed.at(-1).limit, undefined);
const scopeQuery = executed.at(-1).where;
assert.ok(scopeQuery.params.includes("fixture-provider"));
assert.match(scopeQuery.sql, /"services"\."company_id" is null/);

fixtures.set("services", [result(1)]);
await storage.searchServices({ category: "health_wellness", ageGroups: ["adults"], searchQuery: "needle", latitude: 0, longitude: 0, radius: 50 });
const narrowed = executed.at(-1);
assert.equal(narrowed.limit, 501);
assert.ok(narrowed.where.params.includes("adults"));
assert.ok(narrowed.where.params.includes("health_wellness"));
assert.ok(narrowed.where.params.includes("%needle%"));
assert.ok(narrowed.where.params.includes(50));
assert.match(narrowed.where.sql, /\?\| ARRAY\[/);
assert.match(narrowed.where.sql, /"addresses"\."location_expires_at" > now\(\)/);
assert.match(narrowed.where.sql, /"services"\."is_active"/);
assert.match(narrowed.where.sql, /"companies"\."is_active"/);
const priorQueries = executed.length;
assert.deepEqual(Array.from(await storage.searchServices({ serviceIds: [] })), []);
assert.equal(executed.length, priorQueries);

// A time window limits service duration independently of the availability toggle.
const durationResult = (id, duration) => {
  const row = result(id); row.services.duration = duration; return row;
};
fixtures.set("services", [durationResult(1, 30), durationResult(2, 60), durationResult(3, 61), durationResult(4, 180)]);
const hourWindow = { date: "2026-11-13", dateEnd: "2026-11-13", time: "08:00", timeEnd: "09:00" };
for (const availabilityFilter of [{}, { availableOnly: false }, { availableOnly: true }]) {
  fixtures.set("availability", [{ id: 1, providerId: "fixture-provider", companyId: null, serviceId: null,
    isActive: true, scheduleType: "specific", specificDate: new Date("2026-11-13"), startTime: "08:00", endTime: "18:00", breaks: [] }]);
  const matches = await storage.searchServices({ ...hourWindow, ...availabilityFilter });
  assert.deepEqual(Array.from(matches, row => row.id), [1, 2], "08:00–09:00 includes 60 minutes and excludes 61/180, regardless of availability toggle");
  const serviceQuery = executed.findLast(query => query.table === "services");
  assert.match(serviceQuery.where.sql, /"services"\."duration" <= \$/);
  assert.ok(serviceQuery.where.params.includes(60), "Duration cap is parameterized before SQL result limiting");
}
assert.deepEqual(Array.from(await storage.searchServices({ ...hourWindow, dateEnd: "2026-11-14" }), row => row.id), [1, 2], "Multiple dates retain the existing daily time-window contract");
assert.deepEqual(Array.from(await storage.searchServices({ date: hourWindow.date }), row => row.id), [1, 2, 3, 4], "No time filter preserves longer services");
assert.deepEqual(Array.from(await storage.searchServices({ date: hourWindow.date, timeEnd: "01:00" }), row => row.id), [1, 2], "End-only time starts at 00:00");
assert.deepEqual(Array.from(await storage.searchServices({ date: hourWindow.date, time: "23:00" }), row => row.id), [1], "Start-only time ends at the existing 23:59 bound");
assert.deepEqual(Array.from(await storage.searchServices({ ...hourWindow, timeEnd: "08:30", serviceIds: [1, 2, 3, 4] }), row => row.id), [1], "Semantic hydration retains the duration limit");
fixtures.set("service_embeddings", [{ serviceId: 1, embedding: [1, 0] }]);
await storage.getPublicServiceEmbeddings(hourWindow);
assert.match(executed.at(-1).where.sql, /"services"\."duration" <= \$/);
assert.ok(executed.at(-1).where.params.includes(60), "Semantic candidates use the same duration constraint before their cap");

// Public result caps are applied in SQL without the legacy 500-match failure.
fixtures.set("services", Array.from({ length: 501 }, (_, id) => result(id + 1)));
assert.equal((await storage.searchServices({ latitude: 0, longitude: 0, radius: 25, limit: 50 })).length, 50);
assert.equal(executed.at(-1).limit, 50);
assert.ok(executed.at(-1).where.params.includes(25));

// Availability filtering must consider matches after the first 50 candidates.
fixtures.set("services", Array.from({ length: 100 }, (_, id) => result(id + 1, 7)));
fixtures.set("availability", Array.from({ length: 50 }, (_, id) => ({ id: id + 1, serviceId: id + 51,
  providerId: "fixture-provider", companyId: 7, isActive: true, scheduleType: "specific",
  specificDate: new Date("2099-06-04"), startTime: "09:00", endTime: "10:00", breaks: [] })));
const availablePage = await storage.searchServices({ latitude: 0, longitude: 0, radius: 25, limit: 50, date: "2099-06-04", availableOnly: true });
assert.deepEqual(Array.from(availablePage, row => row.id), Array.from({ length: 50 }, (_, id) => id + 51));

fixtures.set("service_embeddings", Array.from({ length: 501 }, (_, index) => ({ serviceId: index + 1, embedding: [1, 0] })));
await assert.rejects(() => storage.getPublicServiceEmbeddings({ category: "education" }), tooBroad);
assert.equal(executed.at(-1).limit, 501);
assert.ok(executed.at(-1).where.params.includes("education"));

fixtures.set("services", [result(1, 7)]);
fixtures.set("availability", Array.from({ length: 5001 }, (_, id) => ({ id })));
await assert.rejects(() => storage.searchServices({ date: "2099-06-04", availableOnly: true }), tooBroad);
const schedules = executed.at(-1);
assert.equal(schedules.table, "availability"); assert.equal(schedules.limit, 5001);
assert.ok(schedules.where.params.includes(7));
assert.match(schedules.where.sql, /"availability"\."company_id" in/);
assert.match(schedules.where.sql, /"availability"\."service_id" is null/);

// A general company schedule must not make the original owner's separate
// personal service available, even when an adapter returns both relevant rows.
fixtures.set("services", [result(1, 7), result(2)]);
fixtures.set("availability", [{ id: 1, providerId: "fixture-provider", companyId: 7, serviceId: null,
  isActive: true, scheduleType: "specific", specificDate: new Date("2099-06-04"), startTime: "09:00", endTime: "10:00", breaks: [] }]);
assert.deepEqual(Array.from(await storage.searchServices({ date: "2099-06-04", availableOnly: true }), row => row.id), [1]);
console.log("Passed: inclusive service-duration limits and toggle/partial-time/multi-date/semantic regressions, actual storage query/result bounds, scoped catalog compatibility, SQL-bound filters/expiry, date rejection, bounded schedules, and company/personal availability isolation. No DB client loaded or SQL executed.");
