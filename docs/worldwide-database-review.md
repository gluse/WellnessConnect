# TASK-047 database release review

Reviewed: 8 November 2026, Europe/Riga.
Owner/executor: `/root/release_database_review`, assigned DB Analyst/Developer.
Requester: `/root`; originating task and acceptance: [worldwide release plan](worldwide-release-plan.md).

## Accepted scope and evidence limits

Accepted the assigned read-only repository review, existing offline/mocked checks
and this document under AGENTS.md standing cooperation. Read the DB role and
PostgreSQL practices skill. Own this document only. No schema, ORM, query,
configuration, script, private file, database, service or deployment was changed.
No connection, SQL execution, fixture write, restore, installation or cloud call
was performed. Existing dirty work is preserved.

Production readiness remains incomplete. The following findings distinguish
confirmed source behavior from missing operational evidence. Line references
refer to the working tree reviewed today, not a deployed snapshot.

During this review Root relayed the user's selections: **99.9% monthly
availability**, **EUR 100–300/month** operating planning budget excluding
development/store fees, and **worldwide-ready architecture with an initial
Latvia/EU launch**. These select requirements, not a database target, retention
policy, provisioning or connected-operation scope. Recovery and connection-budget
proposals must fit these selected requirements.

## Prioritized release findings

### 1. Production target isolation needs a complete configuration contract

**Confirmed release blocker for a separate production target.**
[audit/config.ts](../server/audit/config.ts:6) pins the development source and
destination projects and development capture/worker/writer principals.
The application parser pins `fmt_app_dev` at line 43 and rejects an audit
environment other than `development` at line 51. Additional checks independently
pin the app principal and its role limits in
[audit/application.ts](../server/audit/application.ts:7), the destination reader
in [viewer-runtime.ts](../server/audit/viewer-runtime.ts:11), and the base startup
SQL in [billing/application-readiness.mjs](../migrations/billing/application-readiness.mjs:15).

Changing only deployment URLs would not make this a production-isolated app:
the reviewed guards reject another target or principal. Existing restrictive
checks protect staging and should remain intact. Disabling audit or relabeling
production traffic as development is not proposed as a resolution.

**Next owner contract:** Backend + DB design an explicit environment identity
profile that preserves current development pins and binds each approved production
environment to its exact source/destination identities, expected principals,
runtime memberships, parser/schema contracts and connection budget. CI/CD selects
the profile through reviewed deployment configuration, never an end-user input.
DB separately prepares/verifies the corresponding production least-privilege
roles and migration history after target/execution selection.

### 2. Scaling processes must respect shared database-role limits

**Confirmed configuration constraint; actual saturation not measured.**
[server/db.ts](../server/db.ts:25) permits five connections per process, while
[application.ts](../server/audit/application.ts:8) requires the application login
role to have a connection limit of exactly five. The reviewed source-role SQL
sets that limit in [0003_source_runtime.sql](../migrations/audit/0003_source_runtime.sql:34).
Notification and activity workers import this same application pool when enabled:
[notification entry](../server/notifications/run-worker.ts:13) and
[activity entry](../server/wishlist/run-worker.ts:10).

Two replicas can therefore ask for ten app connections while the guarded role
permits five in total; enabled standalone workers and overlapping deployments add
more demand. Independent capture, source-worker, writer and reader pools have
additional limits in [audit/runtime.ts](../server/audit/runtime.ts:20) and
[viewer-runtime.ts](../server/audit/viewer-runtime.ts:33). PostgreSQL connection
limits apply to a role's concurrent logins, not separately to each application
process. [PostgreSQL 17 CREATE ROLE](https://www.postgresql.org/docs/17/sql-createrole.html).

**Next owner contract:** DB + Backend + CI/CD prepare a per-role budget covering
maximum web replicas, rolling-release overlap, each enabled worker, independent
audit pools and operational headroom. Evaluate supported pool mode and workload
before selecting limits. Raising only an application pool or deleting the exact
readiness assertion would not solve the contract. Any role-limit change and
connected validation need the named target/operation authority.

### 3. New booking creation has no durable request identity

**Confirmed API/storage behavior; a live duplicate was not created.**
[POST /api/bookings](../server/routes.ts:612) validates the service, quote, time
and participant count and calls storage, but accepts no booking-create idempotency
key. [createBooking](../server/storage.ts:530) serializes capacity checks and
inserts a fresh row each call. [bookings schema](../shared/schema.ts:493) has no
creation-request identity/unique constraint. Message and reschedule tables do
have request identities, showing those paths already distinguish retries.

If a booking response is lost, a retried pending request can insert another row;
pending requests intentionally do not consume capacity. A group booking can also
have spare capacity. Capacity locking alone does not identify a replay. A mobile
client must not report an ambiguous timeout as a failed booking and blindly
create another one.

**Next owner contract:** Backend + DB propose a bounded, actor-scoped creation
request identity with canonical payload fingerprint, transactional reservation and
replay of the original outcome. Define key lifetime/conflict behavior and safe
status lookup; retention is a user policy choice if it adds retained data beyond
existing scope. Frontend keeps one identity for one booking intent and handles
unknown outcomes. Test simultaneous same-key requests, changed payload, lost
response and cross-account replay before connected acceptance.

### 4. Worldwide time interpretation still needs database-boundary proof

**Confirmed mixed representations; incorrect live bookings are not established.**
[bookings.scheduledDate](../shared/schema.ts:502) is a timestamp without timezone,
while reschedule proposal and notification event dates use timestamps with
timezone. Capacity predicates include explicit `::timestamp` casts at
[storage.ts](../server/storage.ts:113). Day helpers call process-local `setHours`
at [storage.ts](../server/storage.ts:739). The application pool setup does not
establish a database session TimeZone or a process timezone contract.

A timezone-less timestamp is a local date/time representation, not an independently
specified instant; safe behavior depends on explicit conversion conventions.
[PostgreSQL 17 date/time types](https://www.postgresql.org/docs/17/datatype-datetime.html).
The current pure JavaScript and mocked-SQL checks cannot prove pg encoding,
decoding, SQL comparison and legacy-value interpretation agree across deployments.

**Next owner contract:** DB + Backend trace write/read conversions and document
the current persisted convention before proposing a conversion. First prepare
fixtures for equal instants, two provider zones, DST gaps/repeated times,
cross-midnight boundaries and different process/session timezone settings. Run
against an approved isolated target; preserve existing appointment instants and
schedule-local timezone names. Do not reinterpret legacy values by assumption.

### 5. Booking history reads are unbounded

**Confirmed query shape; no production latency regression is measured.**
[getBookingsBySeeker](../server/storage.ts:618) and
[getBookingsByProvider](../server/storage.ts:641) fetch every matching historical
booking and join details without a SQL limit/date window. Long histories increase
database work, application memory, response size and mobile transfer. Current data
volume and query plans were not inspected, so this review does not prescribe an
index, cache, sharding or performance number.

**Next owner contract:** Backend + Frontend define report/list contracts and
bounded date ranges or deterministic pagination; DB review representative plans
and indexes under scoped inspection. Preserve complete report/export semantics
instead of silently returning a partial history. Establish load acceptance against
selected dataset size and response-time targets.

### 6. Recovery and deletion remain operational release gates

**Evidence missing for production, with explicit historical limits.**
The [staging DB handoff](aws-staging-pc-db-handoff.md:71) does not establish a
backup/restore guarantee. The [7 November audit execution](audit-review-completion-2026-11-07.md:7)
explicitly used a development-only no-backup instruction; that exception must not
be promoted to a production recovery policy.

TASK-046's retention/deletion policy remains unselected. User references in
[bookings](../shared/schema.ts:496), message authors and reschedule request actors
are mandatory foreign keys, while some dependent records cascade. A generic
profile deletion would either be rejected by retained references or lose data if
constraints were casually changed. The intended retention/reporting outcome must
be selected before preparing a deletion migration or orchestrator.

**Next owner contract:** DB + CI/CD inventory protected backup coverage for
application/audit databases, Auth, objects and required role/config metadata;
propose RPO/RTO, retention and an isolated restore exercise. Backend + DB inventory
TASK-046 record dependencies and offer the concrete retention/deletion design for
user selection. Restore validation must prevent reappearance of erased/expired
data. No new retention duration is selected here.

## Existing concurrency foundations to retain

- Create/approve/reschedule paths use a provider-row transaction lock before
  capacity decisions at [storage.ts](../server/storage.ts:533), lines 682/718,
  and [appointments/repository.ts](../server/appointments/repository.ts:50).
  Those database locks can coordinate separate processes; a process-local mutex
  is not required as a replacement. They still need competing-session validation
  and measured contention at the intended provider workload.
- Activity batching claims rows with `FOR UPDATE SKIP LOCKED`, groups in a stable
  order, upserts counts and marks source rows in one transaction:
  [wishlist/worker.ts](../server/wishlist/worker.ts:13).
- Notifications use leased rows, lease tokens, a per-workspace advisory lock and
  durable delivery attempts, then call the transport outside the preparation
  transaction: [notifications/worker.ts](../server/notifications/worker.ts:38).
  Unknown outcomes are tracked; retaining these safeguards is part of the release.
- Message expiry uses bounded, locked batches:
  [appointments/retention.ts](../server/appointments/retention.ts:31). Existing
  retention policy is unchanged. Multiple scheduled processes are not by
  themselves proof of duplicate deletion; assess contention and drain behavior.

These are source-level foundations, not proof of live constraints, exactly-once
external delivery, failover safety or sustained production capacity.

## Proposed production profile acceptance

This is a reviewable proposal, not an environment selection or implementation:

1. An explicit finite environment identifier selects a complete identity profile.
   Unknown/missing/mixed source and destination settings fail before connections;
   production cannot silently fall back to development.
2. Each profile pins exact projects/approved hosts and login-role identities and
   validates verified TLS and current database capabilities using the actual
   connected principal. Reject URI overrides, alternate owner credentials,
   BYPASSRLS, extra membership/admin grants, DDL ownership and unexpected access.
3. Keep application DML, independent capture, delivery source, destination writer,
   read-only viewer and migration/maintenance authority separate. Make limits
   explicit per role/profile and tie them to deployment maximums and readiness.
4. Preserve existing development behavior/tests and historical migration/parser
   hashes. Parameterize environment-specific identity checks coherently across
   config, runtime, reader, startup SQL and migration verification; do not broadly
   allow arbitrary hosts or usernames to make production start.
5. Offline negative cases cover production/development mixups, wrong roles/projects,
   incomplete settings, query overrides, unsupported pool ports, TLS downgrade,
   drifted parser/schema/ACL and unsafe connection-budget configuration. Live
   acceptance separately verifies the selected target and restricted principals.

## Checks and next action

- Inspected `scripts/test-booking-capacity.mjs` and its strict injected VM imports
  before running. `node --import tsx scripts/test-booking-capacity.mjs` initially
  failed, exit 1, on `Blocked external import: server/routes.ts -> ./audit/remote`
  at the route-loading fixture (line 217 at observation), Node v24.22.2. This was a
  stale offline fixture boundary, not a live SQL failure. The actual DB module,
  configuration and services were not imported. Root and Backend were notified;
  Backend owns the narrowly assigned repair/rerun. Do not erase this pre-repair
  evidence or weaken the import guard. The returned repair evidence is recorded
  below when available.
- Backend owner `/root/release_backend_review` subsequently reported the scoped
  fixture repair and rerun **passed, exit 0**, retaining the strict VM loader and
  existing capacity/creation/approval/reschedule/security assertions. The owner
  added explicit adapters for the newly registered audit/report modules, including
  a throwing unexpected-use adapter for audit remote operations. The owner also
  reported passing real audit-remote and protected-read regressions. This DB review
  did not rerun those checks; Root reviews the Backend diff and evidence. The
  initial failure remains recorded above. None of this establishes competing live
  database sessions or production concurrency acceptance.
- Inspected the existing injected readiness runner and pure contract imports.
  `node migrations/workspace-pricing/test-readiness.mjs` passed, exit 0:
  41-table/32-gate profile, preserved historical profile, ACL/policy assertions and
  missing/drifted/malformed/error-response handling. Mocked metadata adapters only;
  no SQL was executed and current live readiness is unknown.
- No locale/resource or browser matrix ran. Any later language checks are limited
  to en/lv/ru; ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred.
- Local Markdown target links and trailing-whitespace checks passed for this file.

Next: Root integrates these findings with Backend/Frontend contracts and the
selected availability/budget/launch requirements. The next DB assignment should first prepare
the production identity/connection profile and booking-idempotency proposal;
connected target/restore/concurrency execution remains separately scoped.

Recovery: revise/remove only this review document. No data or runtime recovery is
needed for this review. Documentation findings do not establish release completion.
