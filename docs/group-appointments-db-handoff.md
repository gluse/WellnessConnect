# Group appointments — DB implementation handoff

2 November 2026. Local implementation complete. Approved development-source
activation applied once and verified read-only; see the connected receipt below.

## Assignment and approval

User approved implementation of the v2/v3 appointment designs on 2 November:
“go ahead. implement changes”. Requester/integrator `/root` assigned
`/root/appointments_db` as DB Analyst/Developer. DB owner accepted the routine
local dependency under AGENTS.md standing cooperation, read the DB role and
PostgreSQL practices skill, and owns the task additions to `shared/schema.ts`
and `migrations/appointments/`. Approvals cover reversible local files and
offline checks initially. The later exact-source connected approval and explicit
no-verified-backup selection below authorize only that recorded activation.
No application/fixture writes, real messages, purge or deployment were performed.

**Retention selection, 2 November:** user chose 12 calendar months after the
later of completion/cancellation and last message; unresolved bookings retain
history until resolved. Root delivered that choice to DB/Backend. This authorizes
local retention preparation/checks, not connected purging. DB owner delegates
the local bounded query/policy helper in `server/appointments/retention.ts` and
its mocked tests to Backend, subject to DB review.

Backend owner `/root/appointments_backend` accepted the schema contract and
owns application operations. DB owner specifically delegated routine local
integration of the new DB readiness fragments into the current
`migrations/billing/application-readiness.mjs`/declaration and matching current
readiness tests to that owner. Historical audit/billing migration profiles are
not expanded. Frontend has its own assigned owner.

## Prepared data contract

- `booking_messages`: UUID identity, booking, author identity/role, bounded
  nonblank body, client request ID, optional provider broadcast ID, timestamp.
  Each customer sees only their own booking's messages. Conversations are stable
  through rescheduling because they refer to the booking, not its time.
- `booking_reschedule_requests`: UUID identity, booking, requester identity/role,
  original/proposed instants, timezone, keep-original/cancel-booking fallback,
  pending/accepted/declined/withdrawn/superseded state, optional provider batch,
  client request ID, optional note, base booking notification revision, responder
  identity/time and creation timestamp. No expiry or automatic cancellation is
  introduced; silence remains pending.
- Idempotency is unique on author/requester + client request ID + booking.
  One pending request per booking is enforced by a partial unique index.
  History indexes lead with booking then creation timestamp and UUID for stable
  cursor pagination. Broadcast/batch lookup indexes are partial on nonnull IDs.
- Checks bound message text to 4,000 characters and request note to 2,000, roles
  and states, provider-only batch/broadcast references, nonnegative base revision,
  different old/new times and terminal accepted/declined response identities.
  Pending records cannot already have response fields; response time cannot
  precede creation.
- Booking deletion cascades its private records; user references use NO ACTION.
  No user/booking lifecycle deletion is added. The selected retention policy
  deletes eligible message content only; reschedule decision records have no
  newly selected purge policy.
- The exact event identity uses existing booking snapshots (workspace/provider,
  service, employee/resource, start, saved duration/cleanup). No dedicated event
  entity is needed. A nullable `bookings.closed_at` timestamptz is the server-owned
  terminal-transition snapshot required for accurate retention: payment updates
  must not move the anchor. Booking input cannot set it. The check permits a
  nonnull value only for completed/cancelled records. Backend snapshots it on
  actual terminal transitions and preserves it on same-state retries.

Foreign keys prove object existence, not permission or tenant consistency.
Server authorization must check current booking/customer/workspace/employee
access for every read/write and subscription for broadcasts. Application owner
must serialize provider/resource mutations and request decisions in a transaction;
the pending unique index alone does not protect scheduling capacity.

## Migration and runtime access

- [0016 expansion](../migrations/appointments/0016_appointments.sql) creates
  the two new tables, five FKs, four checks (including the booking timestamp
  check) and ten indexes including PKs. It adds only nullable `closed_at` plus a
  partial `(closed_at,id)` terminal-booking retention index to
  existing bookings. Existing closed reservations are backfilled to migration
  time conservatively; their actual historical closure time is unknown and
  must not be inferred from timezone-less, payment-mutable `updated_at`.
  This gives those records a full initial retention window and cannot early-purge
  newly introduced history. Newly closed bookings receive the actual timestamp.
- [0017 activation](../migrations/appointments/0017_appointments_runtime.sql)
  separately grants SELECT/INSERT/UPDATE/DELETE to the existing NOLOGIN
  `fm_app_runtime` group and adds the sole `fmt_appointment_server` RLS policy
  per table. Browser `anon`/`authenticated`, `service_role` and audit roles are
  denied access. No roles/memberships/default privileges are created or changed.
- Both scripts use explicit `public` qualification, a trusted local search path,
  transaction, lock/statement timeouts, postgres/session identity and PG17 checks.
  Expansion fails if either table exists; activation fails if preexisting policy,
  owner/RLS/group or unexpected table ACL state differs. Stop on any error and
  inspect the actual target; these scripts are deliberately not blind-retry or
  IF NOT EXISTS migration runners.
- [Runtime manifest](../migrations/appointments/runtime-contract.json) describes
  25 columns, eleven constraints (two PKs, five FKs, four checks), ten indexes,
  both private ACL/policy profiles. The pure runtime module exports the rights,
  JSON and six strict catalog-readiness booleans with parameter `$4`. Backend
  integrates them into the current 35-table startup profile. No connection or
  schema mutation occurs on import.

## Commands and compatibility order

Already executed locally, without database/configuration/network access:

```powershell
node --import tsx migrations/appointments/prepare.mjs
node --import tsx migrations/appointments/check.mjs
```

The checker passed **142** assertions covering exact ORM/SQL/manifest parity,
only the reviewed existing-table timestamp extension, additive DDL, private RLS/ACL activation,
idempotency/history/request indexes and constraint/readiness shapes.
The initial checker had a column-count estimate and source-token assertion
corrected to the original two-table column/column-ACL contract; the selected
retention timestamp subsequently brings the current manifest to 25 columns. The final check
passes. Two additional static PG17 deparser fixtures cover message and response
checks. A further 24 assertions verify the integrated current 35-table rights,
four parameters and fail-closed handling of each new readiness result.
The response constraint spells exclusion with two explicit comparisons
instead of NOT IN so the existing limited catalog normalizer compares it faithfully.
This is static evidence, not a PostgreSQL execution/rehearsal or live
permission/concurrency result.

After separately obtaining exact target/executor authorization and a current
recoverable backup, an approved DB executor should:

1. Verify the application target is the expected PG17 project database and
   roles/schemas match; do not infer the target from an available credential.
2. Apply expansion once using an explicit reviewed connection and
   `psql -X --set ON_ERROR_STOP=1 --file migrations/appointments/0016_appointments.sql`.
3. Apply runtime activation once using the same target and
   `psql -X --set ON_ERROR_STOP=1 --file migrations/appointments/0017_appointments_runtime.sql`.
4. Verify the exact catalog/runtime readiness as the nonprivileged app role,
   new policies/ACLs and no privileged browser/audit access. Rehearse concurrency
   and tenant denial in an approved isolated database before production rollout.
5. Deploy/start only the compatible application build whose current readiness
   manifest includes both tables; then perform separately authorized live checks.

These command examples deliberately contain no connection string. The target,
connection mechanism and connected test scope must be supplied by an approved
executor, and no such command was run here. Existing app builds enforce exactly
33 public tables and can refuse restart after expansion, so coordinate the
maintenance/app cutover; an expansion does not make the old startup check valid.
CREATE TABLE/index work occurs on the new empty tables; foreign keys lock the
referenced bookings/users. Adding the nullable timestamp takes a bookings
AccessExclusive lock, the check can scan bookings, and the conservative backfill
updates existing closed rows with row locks and WAL. The script has a 5-second
lock timeout and 60-second statement timeout and must be rehearsed against target
size/load before rollout. Actual target lock behavior, scan/backfill size and
production availability remain unverified.

## Recovery, limits and next action

Before each script commits, errors roll back that transaction. If expansion
commits but activation fails, tables remain server-inaccessible; do not retry
until the failure is understood. If application cutover fails after writes,
preserve messages/request decisions and pause the affected feature/service.
[disable-runtime.sql](../migrations/appointments/disable-runtime.sql) is a
separately reviewed emergency ACL/policy disable transaction, prepared only;
it preserves data and requires target-specific permission. It does not restore
compatibility with an old exact-33-table build. Use a compatible recovery build
or obtain a reviewed data-preserving schema rollback plan; do not DROP populated
tables or pretend an old application can be restarted unchanged.

Local recovery removes only this task's new ORM definitions and appointments
artifacts while preserving unrelated dirty work. The user selected message
retention, but no connected purge has been executed. No paid messaging service,
backup creation or infrastructure was accessed. The later approved connected
phase used existing protected source credentials and aggregate/catalog reads
only; it performed no personal-data export.

Remaining DB acceptance: separately scoped live application/tenant-denial and
concurrent scheduling tests. Source migration and runtime metadata verification
are now complete under the connected approval below.
The backend/frontend can continue local implementation and mocked checks.
Locale tests remain en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt, es are deferred.
No fresh locale/device coverage is claimed by these schema checks.

## DB-owner integrated query review

Read-only review of `server/appointments/repository.ts` and integrated readiness
confirmed matching provider-user then booking lock order, event mutation
serialization under that same provider lock, and proposal records that do not
reserve capacity or alter original bookings. Actual booking status revision
invalidates pending requests, intentionally requiring a fresh proposal rather
than applying an old request after a changed reservation state.

DB review requested the Backend owner preserve legacy null-duration occupancy
fallback per occupied service, not an unconditional 60 minutes, when replacing
the initial history-wide query. Backend reports correcting the actual overlap
query with the same saved-duration/service-duration/60 fallback and excluding
the current booking. The root independently identified the old-history bound
and customer batch-link exposure; Backend owns those corrections/regressions.
New schema constraints and response writes align; current readiness arguments
and expected rights include both private tables. No additional DB-file correction
or connected verification was required by this read-only review.

## Selected message-retention query review

Backend's final delegated `server/appointments/retention.ts` is reviewed. Expiry
is the forward UTC anniversary of the anchor plus 12 calendar months, clamped at
month end/leap day rather than approximated with 365 days. In SQL, the exact
predicate is `((anchor AT TIME ZONE 'UTC') + interval '12 months') AT TIME ZONE
'UTC' <= now`. A Feb29 anchor therefore expires the following Feb28 at the same
UTC time; an inverse year subtraction alone would incorrectly delay that expiry.
The inverse cutoff plus one day is only a broad index-friendly candidate bound;
exact forward-expiry predicates and post-lock JavaScript anniversary checks
decide eligibility. Only completed/cancelled bookings with a nonnull terminal
anchor qualify, and the last-message anniversary must also have elapsed.
Unresolved bookings and recent messages preserve the entire history.

Each tick first locks at most 100 eligible bookings with SKIP LOCKED; it needs
no provider lock and therefore does not reverse the existing provider-then-booking
mutation lock order. A fresh statement after lock acquisition rechecks latest
message timestamps. It then locks/deletes at most 1,000 message IDs. Empty
histories are excluded from the first page to prevent maintenance starvation;
DB requested this condition and Backend added its regression. The `(closed_at,id)`
partial index supports the candidate filter/order, while the booking/message
history index supports existence/latest checks. Actual live plans remain unverified.

The app's timer runs hourly independently of PRO/notification settings and does
not perform an immediate startup purge. Only a compatible, migrated app that is
actually run will execute ticks. No timer connected to a real database was run
by this task. This code adds no new service credentials, privileged purge function,
scheduled database job or HTTP maintenance endpoint. It deletes message content,
not bookings or reschedule decision records.

DB independently inspected and ran
`node --import tsx scripts/test-booking-message-retention.mjs`: **16 in-memory
scenarios pass**, covering forward UTC calendar/leap anniversary, the previous
day and one-millisecond-before-expiry boundaries, terminal vs
unresolved status, last-message extension, empty-history starvation, both batch
bounds, new-message race protection and maintenance lifecycle isolation.
The mock adapter evaluates parameterized predicates without SQL execution;
actual PostgreSQL lock behavior and real expiry deletion still need the separately
authorized rehearsal/live checks above.
## Approved source activation — 2 November 2026

User answered “yes” to the concrete proposal for the DB owner to apply the
prepared migrations/runtime grants to development project
**hbkooiknruimukkhshrk** and then verify read-only. Assigned executor:
`/root/appointments_db`. Allowed private access covers only necessary existing
protected source owner/application configuration. No audit target, fixture/session
writes, cleanup execution, real messages, app startup, deployment, spending or
role-membership changes were approved.

Backup inspection found no local backup archive or PostgreSQL client binaries
on PATH or the targeted PostgreSQL/DBeaver client locations. The existing
27 October no-backup exception was explicitly limited to the earlier TASK-024
package and was not reused. An optional inspection of already-running browser
windows could not obtain dashboard evidence because Computer Use app approval
timed out; there was no browser input, login or settings change and no retry.
Neither `archive_mode=on` nor presence of backup functions proves recoverability.

After receiving those concrete findings, the user explicitly chose
**“Apply migrations 0016/0017 without a verified backup”** for this package.
That new selection resolved the backup gate; no backup, restore point,
installation or data export is claimed.

The protected source owner credential in `.env.audit-setup.local` and restricted
application credential in `.env` both passed current-user-only ACL/ignore checks.
Only their source connection keys were used. The independently named audit URL
was never connected. A metadata inventory noticed broad inherited ACLs on the
unrelated Stripe app profile; that profile was not used for execution or edited
and its ACL was not changed under this task.

### Commands and execution controls

```powershell
node --check migrations/appointments/connected-preflight.mjs
node migrations/appointments/connected-preflight.mjs
node --check migrations/appointments/execute-approved.mjs
node migrations/appointments/execute-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --backup-waived=TASK-037-2026-11-02
```

The connection commands ran through reviewed network-capable execution. The
executor also supports a current DB-owner recovery-evidence file via
`--backup-evidence=<workspace-relative-json>` instead of the waiver flag, but
that path was not used. Four pure admission checks passed without private reads
or connections before activation.

The guarded executor pins both SQL SHA-256 hashes, validates fixed source/role,
uses verified hostname/CA TLS, refuses URI overrides and reads no app startup
module. A create-exclusive local receipt prevents an accidental second attempt.
It freshly verifies the source baseline read-only, runs 0016 then 0017 once each
and verifies with a fresh restricted-app read-only connection. Per-script client
timeout is 125 seconds, above the scripts' 60-second statement and 5-second lock
timeouts; failure/timeout/connection loss stops with a sanitized code and no
automatic retry or destructive recovery. A missing confirmed COMMIT is recorded
as uncertain rather than guessed successful. Notices/raw driver errors and
connection strings are suppressed.

### Actual results

Source read-only preflight passed: verified TLS, postgres=current session
principal, PostgreSQL 17, database postgres, exactly 33 public tables before
expansion, both new tables and new column absent, expected runtime roles.
Six already-closed reservations needed the conservative timestamp backfill.
Four other client connections were visible in that bounded snapshot; none
was stopped and no connection limit was changed.

The single activation completed on **2 November 2026, 15:27:13–15:27:15 Riga time**
(`13:27:13–13:27:15Z`):

| Step | Verified result |
| --- | --- |
| Fresh owner read-only guard | All six baseline checks true; exact source/TLS confirmed. |
| 0016 | COMMIT confirmed; two private tables, timestamp/check/index expansion and six closed-at backfills applied. |
| 0017 | COMMIT confirmed; only the prepared runtime DML grants and server policies applied. |
| Restricted fmt_app_dev read-only guard | All 20 current application readiness checks true, including exact 35-table profile, columns, constraints, indexes, RLS policies, private ACLs and effective rights. |
| Aggregate private row counts | 0 messages; 0 reschedule requests. |

The sanitized, single-use [activation receipt](../migrations/appointments/source-activation-receipt.json)
records both digests, attempt/commit timestamps, approved backup waiver and all
verification booleans. Exit code 0. No failed database gate, partial commit,
migration retry, test-data write, cleanup or subsequent database call occurred.

These results verify source schema and runtime metadata only. They do not prove
live API permissions, scheduling races, real notification delivery, app startup
or deployment. Those remain separate acceptance scopes. Do not rerun the executor
or remove its receipt to bypass the single-attempt guard. Generic “prepared only”
comments in reusable SQL artifacts are historical preparation labels; this
explicit target/executor approval and receipt identify the actual activation.

