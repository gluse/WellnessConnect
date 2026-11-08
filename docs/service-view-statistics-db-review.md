# Service view statistics — database review, 7 November 2026

Status: completed offline; Backend query contract approved. No connected execution.

Requester `/root` assigned DB Analyst/Developer
`/root/service_views_database_review` under the user's Service view statistics
request and [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope is read-only repository analysis and offline review of the Backend owner's
query/DTO contract. No database connection, private configuration, live SQL,
schema/grants/RLS/retention changes, migration application or deployment is
authorized. The existing TASK-042 applied migration/runtime receipts and all
execution holds remain unchanged. Backend owns application SQL/API code; Frontend
owns capture/UI changes. This review uses the PostgreSQL practices skill.

## Existing data and selected source

- `product_activity_events` stores private `service_views` events with an
  occurrence timestamp, UTC reporting day, workspace snapshot and expiry no later
  than 90 days after occurrence. Processed source rows remain until expiry.
- View events represent explicit service-detail opens, including anonymous views.
  They are not unique visitors. Only wishlist additions have a daily identity
  uniqueness constraint. Recognized provider/team views are excluded by the
  existing capture service; view capture does not deduplicate repeat opens.
- `service_activity_groups` is unsuitable as the report's primary count source:
  the worker claims only prior UTC days, processes at most 200 events per tick and
  can be stopped or lag. Joining source and group counts would double count.
- Root accepted reading unexpired raw source events. Count both processed and
  unprocessed rows once, independently of worker progress. No new table, migration,
  index or retention policy is required by the reviewed design.
- Source capture is registered only when `PRODUCT_ACTIVITY_ENABLED=true`.
  Disabled capture/storage failure must not be presented as a successful zero
  report. No durable capture-start/gap record exists; do not promise complete
  historical observations before tracking or during capture outages. Rows can
  also disappear under existing expiry and viewer/service deletion cascades.
  This is a count of retained recorded observations, not an immutable lifetime
  page-view total. Do not change deletion/retention behavior for this report.

Evidence: [schema](../shared/schema.ts),
[capture service](../server/wishlist/service.ts),
[capture registration](../server/routes.ts),
[source persistence](../server/wishlist/postgres.ts),
[daily worker](../server/wishlist/worker.ts),
[TASK-042 operation limits](wishlist-handoff.md).

## Query contract

- Use selected UTC dates as half-open instants: `occurred_at >= from UTC midnight`
  and `< day-after-to UTC midnight`; also exclude timestamps after the request's
  fixed `asOf` and rows whose `expires_at <= asOf` even if cleanup is stopped.
- The earliest fully retained UTC calendar day is `todayUTC - 89 days`, through
  today inclusive. `todayUTC - 90 days` contains already-expired observations for
  part of that day and must not be offered as complete coverage.
- Start from the permitted current service catalogue and LEFT JOIN matching raw
  events. All event kind/scope/time/expiry predicates belong in the JOIN condition;
  putting them in WHERE would remove zero-view services. Use `count(event.id)`,
  not `count(*)`, group by stable service ID/name/employee, return count text and
  sum with application `BigInt` rather than an unsafe integer cast.
- The current personal scope requires the user's provider ID and null company;
  company scope requires the selected company and fresh active-company/membership
  checks. An employee without `readAll` sees only currently assigned services.
  Optional employee filters further narrow this set; they cannot expand it.
  Event workspace snapshots must match the permitted service/workspace scope.
- Events have no employee snapshot. Employee statistics consequently refer to
  the current service assignment, unlike booking revenue's booked-employee
  snapshots. Cross-workspace employee names must not leak through joins.
- Backend must enforce active workspace Pro before querying statistics. A client
  capability check, disabled button or possession of a service ID is insufficient.
  Return aggregate counts only, never viewer IDs or event-level visitor records.
- A 10,001-row sentinel with a controlled error above the 10,000-service response
  limit avoids silently returning an incomplete catalogue. The 90-day time bound,
  ownership predicates and endpoint rate limits bound access; LIMIT after GROUP
  BY does not itself bound all database work.

Existing provider/company/service source indexes can support scope and joins.
No live cardinalities or plans were inspected, so no new index or performance
claim is justified. If measured load later requires a compound/partial index,
prepare that as a separate reviewed local dependency and obtain any missing
connected execution scope before application.

## Runtime privileges and audit compatibility

The existing [0019 runtime activation](../migrations/wishlist/0019_wishlist_runtime.sql)
already grants `SELECT, INSERT, UPDATE, DELETE` on `product_activity_events` to
`fm_app_runtime`, with the `fmt_wishlist_server` FOR ALL RLS policy using/checking
true. This server-only policy depends on application authorization; public/anon/
authenticated/service-role direct access remains excluded. It is not an
insert-only capture permission.

The current [runtime contract](../migrations/wishlist/runtime-contract.mjs) and
inherited readiness checks include required SELECT, exact table privileges,
private ACLs, the sole server policy and `pg_has_role(current_user,
'fm_app_runtime', 'USAGE')`. The historical
[TASK-042 activation receipt](../migrations/wishlist/source-activation-receipt.json)
records passing required DML/private ACL/policy/schema-access gates. This is
preserved historical evidence, not a new check of the connected target. The
report adds no objects or privilege dependency, so no new grant, RLS change,
migration, runtime profile or activation is needed under this contract.

Backend added the exact authenticated statistics GET to `protectedReadAction`
using the existing `services.provider` category with workspace scope. This is a
provider service-catalog/aggregate-count read, with truthful actor/scope metadata;
it reuses the existing read-event contract rather than inventing a new action.
Root accepted this semantically valid mapping. Existing denial capture and durable
successful-read interception remain in effect. No applied audit 0008 file or
destination allowlist changed.

## Verification and recovery

Read repository code, role/skill, TASKS and relevant coordination/handoff records.
Reviewed final `server/service-view-report/store.ts`, its injected service/routes
and shared DTO/window helper. Approved the source-only LEFT JOIN query, parameter
binding, personal/company snapshot predicates, fresh membership/assignment
checks, name isolation, exact count strings and controlled overflow sentinel.
Company history follows the stable company snapshot rather than imposing a
current provider/creator match; personal event/name joins retain provider checks.

- `node --import tsx scripts/test-service-view-report-db-review.mjs` passed.
  This compiles actual production Drizzle SQL using `PgDialect` without opening a
  connection. Checks cover zero-preserving event predicates, source-only counts,
  processed/unprocessed rows, UTC/future/expiry boundaries, exact 90-day window,
  personal/company/member/employee scope, bound hostile actor strings, and the
  10,001 sentinel. This proves compiled shape/binding, not live query results.
- `node --import tsx migrations/wishlist/check.mjs` passed 269 existing offline
  ORM/DDL/runtime/readiness checks. Its metadata imports and generated DDL are
  inert: no environment files, database or external service calls.
- Scoped whitespace check passed. Only this handoff and the new DB-review test
  are owned by this DB task; existing schema, migrations and receipts were not
  edited. Backend owns its application query/API/audit integration and tests.

No database SQL execution, application startup or connected tests have run.
No language tests are required by this DB-only review; any shared task tests are
limited to en/lv/ru. ar (including RTL), zh, fr, de, hi, ja, pt, es remain deferred.

Recovery is to revert only the new report API/query and UI feature through their
owners; no database rollback is required because no database objects change.
Root owns integration and the final user handoff. Live counts, grants/RLS and
query plans remain unverified by this offline review.
