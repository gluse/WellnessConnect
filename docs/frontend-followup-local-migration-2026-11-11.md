# Prepared local migration execution — 11 November 2026

## Root development restart — verified after migration

The user explicitly approved stopping project dev consumers, applying these local
migrations once, verifying and restarting development, including the bounded
protected local credential reads. Fresh process/listener inspection found no
matching dev/worker processes and no5000 listener, so no process was terminated.
After the DB owner's successful consumed receipt below, Root accepted its
current42/schema/capacity evidence and started the existing `npm run dev` command
once as a hidden background process. Private output/error logs inherit the
verified owner-only `outputs/supabase-local-private` directory; no ACL or credential
values were changed. Actual npmPID31692; applicationPID20620. The listener belongs
to `server/index.ts` and is bound only to127.0.0.1:5000. The dev instance is left
running for the user; do not start a duplicate.

Fresh read-only GET checks passed on both `http://localhost:5000` and
`http://127.0.0.1:5000`: `/health/live`200/statusok, `/health/ready`200/statusready,
and `/`200/applicationHTML. All six responses were cookie-free; no account login,
booking/content mutation or browser locale matrix was exercised. Protected startup
stderr contains no application-startup refusal. No separate audit/notification/
activity worker was started. This is local startup/HTTP acceptance, not hosted
schema, AWS release or full browser acceptance. Test scope remains en/lv/ru;
all other languages/RTL remain deferred.

Public restart metadata/checks:
`output/frontend-followup-2026-11-11/local-app-restart-20261111.json`.
Migration evidence remains in its original immutable attempt receipt. Neither
command nor migration was retried. Future stops must revalidate process creation,
identity and listener association; do not kill arbitrary Node processes or clear
the consumed migration guard. Hosted configuration, audit15432 and AWS were not
accessed by this repair.

Status: **local0024/0025 committed once and verified; Root's development restart
and localhost health/page checks passed; app is running**. Prior local copy/port approvals did not
cover this migration. `/root/availability_booking_database`
prepared this exact operation at Root's request for the final user decision.

**Explicit approval, 11 November:** the user replied **"yes"** to Root's final
request to stop this project's development watcher/workers, apply0024/0025 once
to `127.0.0.1:15422/postgres`, verify the schema and restart development. The
request included the bounded protected local credential reads defined below.
Current DB executor is `/root/publish_db_contract`; Root owns verified project
process stop/restart and must explicitly release DB after consumers are stopped.
DB runs the unchanged guarded command once, returns before application restart,
and preserves stop-on-failure/no-retry. This is the new exact local execution
approval; it does not authorize audit15432, hosted Supabase, AWS or other work.

**Startup-error follow-up, 11 November:** the user reports `npm run dev` refusing
startup with `CUSTOMER_SERVICE_NOTIFICATION_DB_NOT_READY` and failed table-count,
DML and customer-notification metadata gates. Root assigned the repository-only
DB dependency to current DB Analyst/Developer `/root/publish_db_contract`, who
accepted it using PostgreSQL practices. TASK-065, the queue and this runbook still
record0024/0025 as prepared/unapplied and explicitly held for exact local approval.
This matches the reported old41/new42 schema mismatch; no fresh database
inspection is claimed. The existing one-shot attempt file was absent at the
repository check. The prior local copy/port approvals and AWS in-memory
capacity-hook implementation approval do not authorize this local schema/grant
operation. The former preparation owner's ID is historical; the runner's public
executor metadata now names `/root/publish_db_contract`. Versioned SQL, its pinned
hashes and execution guards are unchanged.

The concrete approval requested during preparation was for current DB executor
`/root/publish_db_contract` to read only the two protected local configuration
sources below, execute the one guarded0024→0025 operation on the exact local
application target, and perform its bounded metadata/data-fingerprint/plain
EXPLAIN/calendar verification. Root/Backend must first stop only verified
project-managed application/watch and worker consumers; keep Docker databases
running. DB returns with consumers stopped and before any restart. Root handles
the separately included restart scope after reviewing the successful receipt.
No connected operation, protected read or process control occurred in this
follow-up preparation. Failed/uncertain checks consume the one-shot attempt;
retain evidence and stop without retry or automatic rollback/restart.
Fresh inert `--plan`, duplicate-receipt/endpoint guard tests and attributable
diff checks passed. Both SQL SHA256 values still match the pins below, and no
real attempt receipt was created. These checks used repository/public fixtures
only, with no database, protected configuration or process-control calls.

Approve only the existing Docker **application** database at
`127.0.0.1:15422/postgres`, container `supabase_db_fitsmytime-local`, mapped through
`fitsmytime-local-ingress`. Exclude the audit database on15432, hosted Supabase,
AWS, Auth/Storage operations, deployments, billing, customer messages and real
booking/session writes. DB setup principal is `postgres`; no role substitution or
privilege expansion is permitted. Actual readiness uses `fmt_app_dev` (cap5),
with one probe connection. Existing source capture/worker roles retain cap2 each
and must have zero consumers. No destination connection is opened.

The new operation requires bounded protected reads of `.env.local-docker.local`
and `outputs/supabase-local-private/supabase-status.json` solely for local app/setup
credentials. Existing owner ACLs are verified; secrets/configuration are never
printed, copied, changed or passed as command-line arguments. The setup/status URL
must name `postgres@127.0.0.1:15422/postgres`; the app URL must name `fmt_app_dev` at
that exact endpoint. Direct connection fields and loopback peer checks reject
alternate hosts, ports, database names and URL override options.

The reviewable command, from `C:\Source\Private\WellnessConnect`, is:

```powershell
node --import tsx migrations/customer-service-notifications/execute-local.mjs --plan
```

That default/plan branch reads only the two repository SQL files and validates
their pinned hashes. It performs no private read, subprocess, connection or write.
After a new recorded user approval for this operation, DB executes **once**:

```powershell
node --import tsx migrations/customer-service-notifications/execute-local.mjs --execute=LOCAL-FRONTEND-2026-11-11
```

The CLI flag is a deliberate execution guard, not a substitute for user approval.
Offline verification passed:
`node --import tsx migrations/customer-service-notifications/test-execute-local.mjs`.
It exercises the actual duplicate-attempt failure path with stopped-state/private
load fixtures, proving the previous receipt stays byte-for-byte intact and that
private loading never begins. It also rejects alternate target/principal URLs.
The executor verifies the local app listener5000 is absent and the expected Docker
gateway mapping/source container is already running; it does not start/stop a
database or terminate unrelated processes. Before execution, Root/Backend must
stop only this project's managed app/watch and worker consumers through their
existing terminal/process controls. Keep the local Docker databases running.
The script also refuses other `postgres`, `supabase_admin`, app, capture or source
worker client sessions at the database. A running local service/maintenance client
may cause refusal: stop for inspection, never terminate it indiscriminately.

The one-shot receipt is exclusively created at
`output/frontend-followup-2026-11-11/local-database-migration-attempt.json` before
private reads/connections. An existing receipt prevents replay and is never
overwritten by a subsequent invocation. Do not remove it to retry. No generic
retry loop, connection fallback, privilege change or background worker is present.

Execution stages:

1. Read-only setup identity/version/separation/capacity/quiescence checks; capture
   existing services/bookings counts and fingerprints without exposing row data.
2. Read-only **current41** metadata/readiness under the actual app principal,
   including pricing, currencies, photos, reminder message and existing audit/
   notification/appointment permissions. Close that probe, recheck stopped state.
3. Apply the pinned new0024 expansion once, followed by new0025 runtime activation
   once, as separately committed transactions. Both require PG17/current setup
   principal and exact existing41→42 table state, with5s lock and60s per-statement
   limits. Only the nullable service deletion marker/check and empty private
   customer notification table/indexes/grants/policy change.
4. Verify unchanged existing services/bookings fingerprints (excluding the newly
   added NULL deletion field), the empty new table, **current42** app-role metadata,
   and unchanged earlier feature guards. Compile three production Search query
   variants using plain `EXPLAIN (FORMAT JSON)` under a read-only app transaction:
   unfiltered, dated range, and dated/timed availability. No `ANALYZE`, fixture
   inserts, booking/session API calls or app startup occurs. Two constant SELECT
   checks verify the UTC→Europe/Riga and UTC→Pacific/Kiritimati date conversions.
5. Close probes/setup connection, recheck stopped state, record safe evidence,
   and return **before application restart**. Root/Backend review the receipt and
   coordinate the existing `npm run dev` helper in a separately authorized restart.

Pinned SHA256:

- 0024: `8f77a99fdb498af89b7a8258e6c7f171e974c4a80beaf5030d3402e9b0a917ca`
- 0025: `034447d839864963ad3e03c3c846b746cb9ed24e3270693deecb9f2547ca4718`

Expect a brief local application outage while writers are stopped. Adding the
nullable column does not backfill service content; the services CHECK scans
existing rows, and its exclusive lock can briefly block other service queries.
There are no remote calls while holding the migration lock and no new resource,
connection-cap change, cost, volume replacement or database creation.

Recovery: failures close clients and attempt transaction cleanup, record the exact
last stage and safe SQLSTATE, and stop without retry/restart. A failed transaction
normally rolls back, but a lost connection during COMMIT has an uncertain result:
inspect actual schema/receipt before any next action. A successful0024 followed by
failed0025 leaves expansion committed/private and the app stopped; prepare a new
specific recovery/activation approval after inspecting the state. Do not roll back
by dropping history or resetting/re-copying the database. Before either commit,
existing schema remains compatible; after a committed nullable expansion, old
current41 exact-table guards will refuse the resulting42-table database, so keep
the new app/recovery decision coordinated. This operation creates no new backup;
request backup scope separately if the user requires one before execution.

Timezone review: installed Drizzle0.39.1 treats timezone-less timestamp values as
UTC on read and serializes ISO UTC on write. The raw after-events expression first
interprets `availability.created_at` as UTC and then converts it to the schedule's
timezone before extracting the calendar date. Specific dates and recurrence end
values remain calendar labels. The code inspection found no double timezone shift.
At preparation, neither the migration, query plans nor constant SELECTs had run;
the offline tests established generated contracts, not live result/performance evidence.
Plain EXPLAIN will compile/plan production SQL but does not prove every schedule
result or concurrent booking race. Full transaction concurrency and synthetic
database-write exercises remain outside this proposed operation.

## Authorized local execution result

Root released the single approved command after fresh elevated process/listener
inspection found zero matching project Node/npm/cmd launcher/app/audit/notification/
wishlist worker processes and no listener5000; no process needed stopping. The
runner independently rechecked the exact Docker source mapping/container and
database quiescence. DB executor `/root/publish_db_contract` invoked the unchanged
guarded command **once** under elevated execution permitted for the approved
local migration and protected reads. It exited0, with no retry.

Execution ran on11November2026 from17:42:35.490Z to17:42:44.409Z
(19:42 Riga). Both pinned0024 expansion and0025 restricted runtime activation
committed. Exact local source/app-role identity and current42 readiness passed;
existing pricing/currency/photo/reminder/audit guards remain valid. The new
customer notification table is empty. Existing29services and36bookings retained
identical before/after counts and whole-row fingerprints, excluding only the
new nullable service deletion field as designed. All three plain Search
`EXPLAIN (FORMAT JSON)` variants compiled, and both constant calendar conversion
checks passed. No fixture/application/session/business write was exercised.

The immutable one-shot receipt is
`output/frontend-followup-2026-11-11/local-database-migration-attempt.json`,
`state:passed`, `stage:complete`, `current42Readiness:true`,
`existingDataUnchanged:true`, `allConnectionsClosed:true`, `retry:false`,
`restart:false`, `hostedAccess:false`. It is consumed: retain it and do not
replay the execution flag. DB returned with local consumers stopped, before
Root's separately approved development restart. No audit15432, hosted Supabase,
AWS, Auth/Storage or configuration edit occurred. Root may now perform that
approved restart and verify startup; this DB result does not claim a restarted
application or browser acceptance.
