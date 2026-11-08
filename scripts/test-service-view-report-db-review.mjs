// Offline DB-owner review: compile production SQL only; never import/connect db.
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { serviceViewAccessQuery, serviceViewStatisticsQuery } from "../server/service-view-report/store.ts";
import { serviceViewReportWindow, validServiceViewPeriod } from "../shared/service-view-report.ts";

const dialect = new PgDialect();
const compile = query => dialect.sqlToQuery(query);
const asOf = new Date("2026-11-07T12:34:56.789Z");
const period = { from: "2026-11-01", to: "2026-11-07", employee: "all" };
const personal = compile(serviceViewStatisticsQuery({ userId: "owner", companyId: null }, period, asOf));
const company = compile(serviceViewStatisticsQuery({ userId: "member", companyId: 17 }, period, asOf));
const normalized = query => query.sql.replace(/\s+/g, " ");
const statement = normalized(personal);
const [join, where] = statement.split(" WHERE ");
assert.ok(join.includes("LEFT JOIN public.product_activity_events e ON e.service_id=s.id"));
for (const predicate of ["e.kind='service_views'", "e.company_id IS NOT DISTINCT FROM s.company_id", "e.occurred_at>=", "e.occurred_at<", "e.occurred_at<=", "e.expires_at>"]) assert.ok(join.includes(predicate), predicate + " remains in LEFT JOIN, preserving zero services");
assert.ok(statement.includes("count(e.id)::text AS views"), "Counts zero/null joins correctly without int32 cast");
assert.equal(statement.includes("processed_at"), false, "Counts processed and pending source events once");
assert.equal(statement.includes("service_activity_groups"), false, "No source/group double count or worker lag");
assert.equal(statement.includes("user_id AS"), false, "No viewer identity projected");
assert.ok(where.includes("s.provider_id=")); assert.ok(where.includes("s.company_id IS NULL"));
assert.ok(join.includes("s.company_id IS NOT NULL OR e.provider_id=s.provider_id"), "Personal event provider snapshot constrained");
assert.ok(join.includes("s.company_id IS NOT NULL OR emp.provider_id=s.provider_id"), "Personal employee names constrained");
assert.ok(personal.params.includes("2026-11-01T00:00:00.000Z"));
assert.ok(personal.params.includes("2026-11-08T00:00:00.000Z"), "Inclusive UTC end date uses exclusive next midnight");
assert.equal(personal.params.filter(value => value === asOf.toISOString()).length, 2, "Fixed future-event/expiry reference");
assert.equal(personal.params.at(-1), 10001, "Sentinel prevents silent partial response at catalog cap");

for (const fragment of ["s.company_id=", "EXISTS(SELECT 1 FROM public.company_memberships m", "c.is_active", "m.user_id=", "m.role IN ('owner','admin') OR m.employee_id=s.employee_id"]) assert.ok(normalized(company).includes(fragment), fragment);
assert.ok(company.params.includes(17)); assert.ok(company.params.includes("member"));
assert.equal(normalized(company).includes("AND e.provider_id=s.provider_id AND"), false, "Company history follows stable company snapshot, not a mutable provider");
const employee = compile(serviceViewStatisticsQuery({ userId: "member", companyId: 17 }, { ...period, employee: "23" }, asOf));
assert.match(normalized(employee), /AND s\.employee_id=\$\d+/); assert.ok(employee.params.includes(23));
const shared = compile(serviceViewStatisticsQuery({ userId: "member", companyId: 17 }, { ...period, employee: "unassigned" }, asOf));
assert.ok(normalized(shared).includes("AND s.employee_id IS NULL"));

const hostileId = "x' OR true --";
for (const query of [serviceViewStatisticsQuery({ userId: hostileId, companyId: 17 }, period, asOf), serviceViewAccessQuery({ userId: hostileId, companyId: 17 })]) {
  const bound = compile(query);
  assert.equal(bound.sql.includes(hostileId), false); assert.ok(bound.params.includes(hostileId), "Actor ID remains bound data");
}
const access = normalized(compile(serviceViewAccessQuery({ userId: "member", companyId: 17 })));
assert.ok(access.includes("JOIN public.company_memberships"));
assert.ok(access.includes("p.company_id=c.id"));
const personalAccess = normalized(compile(serviceViewAccessQuery({ userId: "owner", companyId: null })));
assert.ok(personalAccess.includes("p.company_id IS NULL"));

const window = serviceViewReportWindow(asOf);
assert.deepEqual(window, { availableFrom: "2026-08-10", availableTo: "2026-11-07" });
assert.equal(validServiceViewPeriod("2026-08-10", "2026-11-07", asOf), true);
assert.equal(validServiceViewPeriod("2026-08-09", "2026-11-07", asOf), false, "Partially expired oldest UTC day rejected");
assert.equal(validServiceViewPeriod("2026-11-07", "2026-11-08", asOf), false, "Future days rejected");
assert.equal(validServiceViewPeriod("2026-02-30", "2026-11-07", asOf), false);
console.log("Passed offline DB review of production SQL compilation/binding, workspace/employee predicates, zero-preserving source counts, UTC/expiry boundaries and 90-day window. No database connection or SQL execution.");
