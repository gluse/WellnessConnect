# Frontend follow-up database dependency — 11 November 2026

Status: local database files prepared and offline checks pass; **not applied to any database**.

Requester/approver: user's 11 November feature request, routed by assigned Front End
Developer `/root` under [standing owner cooperation](../AGENTS.md). Assigned
DB Analyst/Developer `/root/availability_booking_database` accepted the routine
local schema/query dependency, coordinated the contracts with assigned Backend
`/root/availability_booking_backend`, and used the PostgreSQL practices skill.
Authority covers reversible repository files and offline/injected tests only.
No configuration/credentials, database inspection/execution, service calls,
deployment or spending are included. Existing target/operation holds remain.

Availability already stores specific dates/times and recurring schedule end
conditions (`recurrenceEndType=on_date`, `recurrenceEndValue=YYYY-MM-DD`).
The end date is inclusive in the schedule timezone. No availability schema change
is necessary. Backend owns validated weekly input and shared daily schedule
selection so Search, booking slots and specific-only empty-weekly sentinels agree.
Existing general-hours inheritance remains available for ordinary schedules.
Backend additionally delegated the raw paginated Search query file
`server/search-pagination/query.ts` to DB, which accepted and implemented its
availability/deletion contract locally. Its parameterized availability EXISTS now
honors specific service overrides, general overrides, closed service-week
sentinels, inclusive recurring end dates, existing after-event counts, and deleted
listing exclusion before ranking/pagination. Schedule presence controls precedence
even when that schedule has expired or contains no openings; it cannot reopen
through fallback. Finite break-boundary checks recognize fully closed ranges,
and guarded date/timezone/JSON/numeric expressions avoid unsafe legacy casts.
The existing timed-search break overlap policy is preserved. No database query
was executed, and query-planner/performance/physical-result evidence is pending.

DB approved Backend's deletion transaction: lock the service `FOR UPDATE`, reject
any related booking not completed/cancelled (including overdue unfinished rows),
then set `is_active=false` and the server-owned `deleted_at` tombstone. Booking creation already locks the service `FOR SHARE`,
so concurrent creation either finishes before the closed-booking check or observes
the inactive listing. Existing reservation snapshots/history remain. Backend owns
implementation and offline application tests; no live concurrency evidence exists.
Joint local owner choice accepted by `/root`: a durable nullable deletion marker
distinguishes deleted listings from unpublished drafts. Provider/public catalogs
exclude deleted services, direct update/copy/booking paths refuse them, and all
historical reservation joins retain the row. The public input schema strips the
marker, so callers cannot set or clear it. A database CHECK requires deleted
services to remain explicitly inactive. Existing rows receive NULL; no backfill
or history rewrite is needed. Backend owns those visibility and mutation guards.

The new `customer_service_notifications` table stores UUID identity, recipient,
booking/service references, a bounded allowlist of changed **field names**, optional
read timestamp, and creation/expiry timestamps. No old/new personal values,
customer contact information or reservation snapshot copies are stored. Three
foreign keys retain entity integrity; customer inbox queries additionally join
the original booking and verify both recipient and service identity, so mismatched
denormalized identities are never disclosed. Backend's atomic service update
captures notices for pending/confirmed bookings without changing booking money,
currency, time or saved durations. Current customer/global inboxes display them;
provider inboxes do not acquire customer-notice access.

The existing inbox's 90-day maximum retention is reused, with an explicit database
expiry/read-timestamp CHECK, expiry filtering and bounded activity-worker cleanup.
Indexes support recipient pagination, expiry cleanup and the booking/service foreign
keys. This is a routine local dependency; no additional tracking, channel delivery,
subscription entitlement or retention policy was introduced.

The additive Drizzle descriptor is in [shared/schema.ts](../shared/schema.ts).
New SQL is [0024 expansion](../migrations/customer-service-notifications/0024_customer_service_notifications.sql)
then [0025 restricted runtime activation](../migrations/customer-service-notifications/0025_customer_service_notifications_runtime.sql).
This new, unapplied expansion also adds the nullable service marker/check and
uses a bounded exclusive lock on services; no existing versioned SQL was edited.
Historical migrations/profiles remain unchanged. Expansion defaults to private
RLS with all browser/audit/runtime grants revoked; activation grants only the
existing restricted server role, matching the established server-enforced
authorization model. There are no browser policies or privileged functions.
PostgreSQL's [RLS semantics](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
and [constraint behavior](https://www.postgresql.org/docs/17/sql-createtable.html)
were checked against official PG17 documentation.

The new injected [current42 readiness profile](../migrations/customer-service-notifications/application-readiness.mjs)
composes the current pricing/audit/application metadata profile with exact new
columns, checks, FKs, indexes, grants and RLS policy checks, including the service
deletion column/inactive invariant. Backend updates startup
and billing consumers to this profile. It fails closed until the schema and runtime
activation are installed, and reports safe error codes without driver details.

Validation:

- `node --import tsx migrations/customer-service-notifications/prepare.mjs` generated
  new SQL/metadata locally only.
- `node --import tsx migrations/customer-service-notifications/check.mjs` passes
  exact Drizzle/generated SQL parity, timestamp/FK/index shape, bounded field-only
  payload and retention, nullable server-owned service deletion marker/inactive
  constraint, private expansion/restricted activation, current42
  table/DML profile, malformed/missing/false metadata rejection and safe error
  redaction. It also checks generated paginated Search SQL's bound date inputs,
  recurrence/precedence/deletion clauses and retained ranking limit. These SQL
  checks establish generated contract shape, not physical result correctness.
  No SQL executed.
- `node --import tsx scripts/test-search-pagination-backend.mjs` passes 57 existing
  synthetic route/service/query regressions, including parameter binding, bounded
  ranking, cursor/sort/currency behavior and semantic fallback. Its synthetic rows
  do not execute the new availability SQL in PostgreSQL.
- Backend owns query/transaction/worker regression checks and full TypeScript.

Concrete execution preparation is now in the
[local migration runbook](frontend-followup-local-migration-2026-11-11.md) and its
guarded `execute-local.mjs` command. Default/`--plan` validates repository SQL
hashes only; `test-execute-local.mjs` passes actual duplicate-attempt receipt
preservation with no private reads, subprocesses or connections. No execution
approval is inferred from these files or CLI flags.

No live metadata, physical SQL rehearsal, grants, concurrent bookings or worker
retention were verified. Exact database-target execution and capacity/recovery
authorization remain required before applying 0024 → 0025 and accepting the new
application. Prepared migration assumes existing PG17/current41 schema through
0023, setup principal `postgres`, and existing named roles; do not run against a
different target or retry failed guards. Stop app/activity writers before change,
inspect schema/ACL after migration and pass the current42 startup guard under the
actual application principal before restart. No automatic execution helper or
database startup was invoked or added.

Recovery: before execution, reverse only this task's attributable schema/new-file
hunks; no database recovery is needed. After a separately approved application,
keep writers stopped on failure and inspect transaction state; both migrations
are transactional, never replay blindly. Existing application compatibility
requires deliberate rollback of its readiness consumer alongside the new feature;
do not remove a populated notification table without an approved retention/recovery
decision. Existing booking data/schema is not rewritten by these migrations.

Language verification, where applicable, is en/lv/ru only. ar (including RTL), zh,
fr, de, hi, ja, pt and es remain deferred; no fresh coverage is claimed for them.
