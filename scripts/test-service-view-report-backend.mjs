import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { PgDialect } from "drizzle-orm/pg-core";
import { createServiceViewReportService } from "../server/service-view-report/service.ts";
import { createServiceViewReportStore, serviceViewAccessQuery, serviceViewStatisticsQuery } from "../server/service-view-report/store.ts";
import { setupServiceViewReportRoutes } from "../server/service-view-report/routes.ts";
import { serviceViewCapabilitiesSchema, serviceViewReportSchema, serviceViewReportWindow, validServiceViewPeriod } from "../shared/service-view-report.ts";
import { protectedReadAction, protectedReadAudit } from "../server/audit/reads.ts";

// Pure application + actual in-process Express HTTP with injected persistence/auth/audit.
// No server bootstrap, env file, DB/session store or real Auth is imported.
const userId = "11111111-1111-4111-8111-111111111111", actor = { userId, companyId: null };
let now = new Date("2026-11-07T13:00:00Z"), enabled = true, statsCalls = 0, accessCalls = 0;
let access = { plan: "pro", proUntil: new Date("2026-11-08T00:00:00Z"), active: true };
let values = [{ serviceId: 7, service: "Ārstēšana — Услуга", employeeId: null, employeeName: null, views: "9007199254740993" }, { serviceId: 8, service: "Unviewed", employeeId: 11, employeeName: "Synthetic employee", views: "0" }];
const calls = [];
const store = { async access() { accessCalls++; return access; }, async rows(...args) { statsCalls++; calls.push(args); return values; } };
const service = createServiceViewReportService(store, () => enabled, () => new Date(now));
const query = { from: "2026-11-01", to: "2026-11-07", employee: "all" };
const reject = async (input, code) => { const before = statsCalls; await assert.rejects(() => service.report(actor, input), error => error.code === code); assert.equal(statsCalls, before, `${code} invokes no protected statistics query`); };
assert.deepEqual(serviceViewReportWindow(now), { availableFrom: "2026-08-10", availableTo: "2026-11-07" });
assert.equal(validServiceViewPeriod("2026-08-10", "2026-11-07", now), true);
for (const [from, to] of [["2026-08-09", "2026-11-07"], ["2026-11-07", "2026-11-08"], ["2026-11-07", "2026-11-06"], ["2026-02-30", "2026-11-07"], ["garbage", "2026-11-07"]]) assert.equal(validServiceViewPeriod(from, to, now), false);
assert.deepEqual(serviceViewReportWindow(new Date("2028-03-01T00:00:00Z")), { availableFrom: "2027-12-03", availableTo: "2028-03-01" });

access = { ...access, plan: "free" };
const free = serviceViewCapabilitiesSchema.parse(await service.capabilities(actor));
assert.equal(free.hasPro, false); assert.equal(free.historyCoverage, "unknown"); assert.equal(free.captureStartedAt, null);
assert.equal(statsCalls, 0);
await reject(query, "pro_required");
access = { ...access, plan: "pro", proUntil: new Date(now) }; await reject(query, "pro_required");
access = { ...access, proUntil: null }; await reject(query, "pro_required");
access = { ...access, proUntil: new Date("2026-11-08T00:00:00Z"), active: false }; await reject(query, "workspace_unavailable");
access = null; await reject(query, "workspace_unavailable");
access = { plan: "pro", proUntil: new Date("2026-11-08T00:00:00Z"), active: true };
enabled = false; await reject(query, "tracking_unavailable"); assert.equal((await service.capabilities(actor)).trackingEnabled, false); enabled = true;
await reject({ ...query, from: "2026-08-09" }, "period_out_of_range");
for (const invalid of [{ ...query, unknown: "x" }, { ...query, employee: "0" }, { ...query, employee: "2147483648" }, { ...query, employee: ["11"] }]) {
  const before = statsCalls; await assert.rejects(() => service.report(actor, invalid)); assert.equal(statsCalls, before);
}
const report = serviceViewReportSchema.parse(await service.report(actor, query));
assert.equal(report.totalViews, "9007199254740993", "Aggregate counts remain exact above Number's integer limit");
assert.equal(report.rows[1].views, "0"); assert.equal(report.proUntil, "2026-11-08T00:00:00.000Z");
assert.equal(report.measurement, "recorded_detail_opens"); assert.equal(report.timezone, "UTC");
assert.deepEqual(calls.at(-1).slice(0, 2), [actor, query]);
values = []; assert.equal((await service.report(actor, query)).totalViews, "0");
values = [{ serviceId: 7, service: "bad", employeeId: null, employeeName: null, views: "-1" }];
await assert.rejects(() => service.report(actor, query), error => error.code === "report_unavailable");
values = Array(10001).fill({ serviceId: 7, service: "bounded", employeeId: null, employeeName: null, views: "0" });
await assert.rejects(() => service.report(actor, query), error => error.code === "report_too_large");
const expiring = createServiceViewReportService({ access: async () => ({ ...access }), rows: async () => { now = new Date("2026-11-08T00:00:00Z"); return []; } }, () => true, () => new Date(now));
await assert.rejects(() => expiring.report(actor, query), error => error.code === "pro_required", "Expiry during execution cannot release protected data");
now = new Date("2026-11-07T13:00:00Z");

const dialect = new PgDialect(), compile = sql => dialect.sqlToQuery(sql);
const personal = compile(serviceViewStatisticsQuery(actor, query, now));
assert.ok(personal.sql.includes("count(e.id)::text"));
assert.equal(personal.sql.includes("processed_at"), false, "Processed source events are still counted without double counting worker groups");
assert.equal(personal.sql.includes("service_activity_groups"), false);
assert.ok(personal.sql.includes("e.expires_at>")); assert.ok(personal.sql.includes("e.occurred_at<="));
assert.ok(personal.params.includes("2026-11-08T00:00:00.000Z")); assert.ok(personal.params.includes(10001));
assert.ok(personal.sql.includes("s.company_id IS NULL")); assert.ok(personal.params.includes(userId));
const company = compile(serviceViewStatisticsQuery({ ...actor, companyId: 7 }, { ...query, employee: "11" }, now));
assert.ok(company.sql.includes("EXISTS(SELECT 1 FROM public.company_memberships"));
assert.ok(company.sql.includes("m.employee_id=s.employee_id")); assert.ok(company.sql.includes("c.is_active"));
assert.ok(company.params.includes(7)); assert.ok(company.params.includes(11));
assert.ok(compile(serviceViewStatisticsQuery(actor, { ...query, employee: "unassigned" }, now)).sql.includes("AND s.employee_id IS NULL"));
assert.ok(compile(serviceViewAccessQuery({ ...actor, companyId: 7 })).sql.includes("JOIN public.company_memberships"));
const statements = [];
const realStore = createServiceViewReportStore({ async execute(sql) { statements.push(compile(sql)); return { rows: statements.length === 1 ? [{ plan: "pro", proUntil: "2026-11-08T00:00:00Z", active: true }] : [] }; } });
assert.equal((await realStore.access(actor)).proUntil.toISOString(), "2026-11-08T00:00:00.000Z"); await realStore.rows(actor, query, now); assert.equal(statements.length, 2);

const reportPaths = ["/api/reports/service-views", "/api/reports/service-views/", "/API/REPORTS/SERVICE-VIEWS", "/Api/Reports/Service-Views/"];
for (const path of reportPaths) assert.equal(protectedReadAction(path)[1], "services.provider");
assert.equal(protectedReadAction("/api/reports/service-views/capabilities"), undefined);
let auditFailure = false, captured = [];
values = [{ serviceId: 7, service: "Synthetic service", employeeId: null, employeeName: null, views: "4" }];
const app = express();
app.use((req, _res, next) => { req.auditPersonalRole = "provider"; next(); });
app.use(protectedReadAudit({ enabled: () => true, async capture(event) { if (auditFailure) throw Error("private sink details"); captured.push(event.envelope); } }));
setupServiceViewReportRoutes(app, {
  authenticate(req, res, next) { if (req.headers["x-deny"]) return res.status(401).json({ message: "Unauthorized" }); req.user = { claims: { sub: userId } }; next(); },
  currentActor: () => actor, service,
});
const base = "/api/reports/service-views";
async function request(url, headers = {}) {
  const chunks = [], socket = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  const req = new IncomingMessage(socket); req._read = () => {}; req.complete = true; req.url = url; req.method = "GET"; req.headers = headers;
  const res = new ServerResponse(req); res.assignSocket(socket); const done = once(res, "finish"); app.handle(req, res); queueMicrotask(() => req.push(null));
  await done; socket.destroy(); const wire = Buffer.concat(chunks).toString(), text = wire.slice(wire.indexOf("\r\n\r\n") + 4);
  return { status: res.statusCode, headers: res.getHeaders(), text, body: text ? JSON.parse(text) : null };
}
{
  let response = await request(base, { "x-deny": "yes" }); assert.equal(response.status, 401); assert.equal(response.headers["cache-control"], "private, no-store");
  access = { ...access, plan: "free" }; response = await request(`${base}/capabilities`); assert.equal(response.status, 200); assert.equal(response.body.hasPro, false);
  const before = statsCalls; response = await request(`${base}?${new URLSearchParams(query)}`); assert.equal(response.status, 403); assert.equal(response.body.code, "pro_required"); assert.equal(statsCalls, before);
  access = { ...access, plan: "pro" };
  // Exercise Express's real case-insensitive/optional-trailing-slash route matches,
  // so an accepted alias cannot bypass durable audit capture or leak counts.
  for (const path of reportPaths) {
    const capturesBefore = captured.length;
    response = await request(`${path}?${new URLSearchParams(query)}`);
    assert.equal(response.status, 200, path); assert.equal(response.body.totalViews, "4", path);
    assert.equal(captured.length, capturesBefore + 1, `${path} durably captures exactly once`);
    assert.equal(captured.at(-1).changes[0].after, "services.provider");
    auditFailure = true;
    response = await request(`${path}?${new URLSearchParams(query)}`);
    assert.equal(response.status, 503, `${path} fails closed when audit capture fails`);
    assert.equal(response.text.includes('"views"'), false, path);
    assert.equal(response.text.includes('"totalViews"'), false, path);
    assert.equal(response.text.includes("Synthetic service"), false, path);
    auditFailure = false;
  }
  assert.equal(JSON.stringify(captured).includes("Synthetic service"), false);
  enabled = false; response = await request(`${base}?${new URLSearchParams(query)}`); assert.equal(response.status, 503); assert.equal(response.body.code, "tracking_unavailable"); enabled = true;
  response = await request(`${base}?from=2026-11-01&to=2026-11-07&employee=11&userId=other`); assert.equal(response.status, 400);
  response = await request(`${base}/capabilities?from=2026-11-01`); assert.equal(response.status, 400);
}
assert.ok(accessCalls > statsCalls, "Denied executions check entitlement without running aggregates");
console.log("Passed service-view Pro/expiry/disabled/period/bounds guards, exact counts, offline SQL compilation/store adapter, actual HTTP routes and protected-read audit failure isolation. No DB or connected service used.");
