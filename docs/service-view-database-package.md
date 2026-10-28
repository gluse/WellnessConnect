# Single service-view event: database package

## Actual execution result — 25 October 2026

The user selected **Apply and activate**; the assigned DB Analyst executed the
exact development scope recorded in the
[connected approval](audit-service-view-execution.md#connected-execution-approval).
Destination and source 0005 transactions **committed and verified**, in that
order. Protected `AUDIT_SERVICE_VIEWS_ENABLED=true` was read back after acceptance
and health verification. No daemon, application HTTP server or deployment was
started. The flag takes effect when the development app loads/reloads its
configuration; run the updated `npm run audit:worker` alongside the app when needed.

Actual commands:

```powershell
node migrations/audit/execute-service-view.mjs apply
node --import tsx migrations/audit/execute-service-view.mjs activate
node migrations/audit/execute-service-view.mjs verify
```

Apply, activation and final read-only verification all exited 0. Final verification
reported `service-view-verified` / `passed` independently on both projects.
Fresh old profiles passed on both projects before
writes. Destination then source version receipts/COMMITs were confirmed; fresh
extended profiles and exact preservation of function OIDs/owners/ACLs and setup
owner memberships passed. The applied SQL hashes are listed below and are now
immutable, including their historical preparation headers.

On **each** database, actual rollback-only probes passed: anonymous service R90
enqueue/accept, valid seeker/provider parsing, exact occurrence-based 90-day
expiry, old S365 acceptance at age 91 days, expired R refusal and eight invalid
service variants. All synthetic rows and temporary grants rolled back; original
owner memberships matched afterward. **Zero synthetic events committed.** No
real Auth, session, service or business mutation was exercised.

The fixed local process check found no known old audit worker/rehearsal process,
and catalog checks found no existing source-worker/destination-writer sessions.
The updated native worker opened, queried health only and closed. Health:
`pending=0`, `leased=0`, `quarantined=0`, `expired=0`, `oldestAgeSeconds=0`;
`claimsAttempted=false`. No queue item was claimed or delivered by readiness.
No process was terminated. Protected app-file replacement preserved unrelated
bytes and passed exact readback. Existing credentials/ACLs were not changed.

### Reconciled syntax correction

The first apply attempt passed both fresh gates but destination stopped with
SQLSTATE `42601`; ROLLBACK was confirmed and source was never attempted. The
unapplied entrypoint drafts used unparenthesized CASE inside a PL/pgSQL IF
expression. PostgreSQL 17's expression reader treats an unparenthesized THEN as
the IF terminator. Root reviewed the sole correction to
`occurred+(CASE ... END)<=n`; retention, accepted events and grants did not change.
The shared parser stayed unchanged. The old, never-applied draft hashes were:
destination `7a6f6bf1f9c6b585242d970b1d0171a09a4e5554eba06cf3feae8dda510d6752`,
source `5dd3d97d78a6c4098209bbea933d6fb5f2b21026ddbae0f2cb49d7e4aa6d7c32`.
Two focused regression assertions increased the offline result to **65 passed**.
The corrected pinned attempt reran both fresh old gates, then committed normally;
this was a reviewed correction after a known rollback, not an uncertain retry.

## Historical local preparation and approved design

Prepared locally on 23 October 2026 by assigned DB Analyst `/root/audit_database`,
following Root's accepted sequential owner request and the user's single-event
choice. [Cross-role execution scope](audit-service-view-execution.md) and
[Backend contract](service-view-audit-handoff.md) govern this package. This is
the **historical preparation record**, superseded by the execution result above.
No private configuration, ACL, process inventory,
database connection or connected fixture was accessed for this preparation.
TASK-014's earlier execution approval does not authorize this new event's writes.

## Choice and exact change

Recommend the prepared forward extension on the existing development source
`hbkooiknruimukkhshrk` and audit destination `ynygqodmtgjrngiudalw`. It adds only
`service.viewed.v1`: unknown scope, service component, positive canonical int32
service-ID string, succeeded outcome, no reason/changes, anonymous or user
seeker/provider actor, selected P1 class R and 90-day occurrence-based expiry.
No search/location/service content or claimed identity fields are added.

The new shared parser definition preserves the old eleven event rules with
explicit additions for this event. `CREATE OR REPLACE` retains the existing
function identities, owners and privileges. Source enqueue/destination accept
use 90 days only for validated R events; B/S remain 365 days. Each storage table's
two original retention checks are replaced by one validated, event-specific
R90/B-S365 check. Old checks must match exact referenced columns and normalized
PG17 definitions first; unknown definitions stop instead of being guessed or
silently dropped. Generated constraint names are not assumed.

No new tables, indexes, roles, credentials, reader access, jobs, framework or
committed rehearsal cohort is introduced. Existing data, immutability triggers,
RLS, grants, maintenance policy and all previously applied SQL remain intact.
The original strict verifiers remain unchanged; the new helper chooses an
explicit extended active-runtime profile, preserving all seventeen source-table
checks, exact provider/cron latent-ACL guards and disabled rehearsal access.

The alternative is to defer this extension and keep
`AUDIT_SERVICE_VIEWS_ENABLED` unset/false. The details UI and endpoint can still
work, but no service-view event is captured. The recommended extension enables
the requested event with a short bounded development maintenance window. It
replaces CHECK constraints and validates existing rows under an ACCESS EXCLUSIVE
table lock; no table rewrite is requested. Lock timeout is 5 seconds, each
statement 60 seconds and the driver's migration-batch budget 180 seconds. The
source and destination cannot commit atomically together.

## Files and immutable execution manifest

| New file under `migrations/audit/` | SHA-256 |
| --- | --- |
| `_service_view_v1.sql` | `4eb10c1922b7d27c6acf9c4dfb42578a01f7009932219b5804c68a9adb76f3b8` |
| `0005_destination_service_view.sql` | `205852b34350eb922b13cf48e9ad6a37a331a3d2651b6cae90e6d82f3c106c5d` |
| `0005_source_service_view.sql` | `a04a9f5bf9d16768d66b4eec135a5d0789f334acf1fb01c0fec293160fe90a83` |

[`execute-service-view.mjs`](../migrations/audit/execute-service-view.mjs) pins and
expands the one shared include using literal-preserving replacement. It accepts
only fixed modes, files, principals and targets; no arbitrary SQL/URI arguments.
It reuses the existing protected setup loader, current-user ACL verification and
certificate/hostname-verified TLS. It never prints URIs, raw driver errors,
private ACLs or credentials. Neither password nor logging configuration changes
are part of this extension.

Each migration temporarily enables SET access to the installed contract/storage
owners, preserving all original membership rows, grantors and ADMIN/INHERIT/SET
options. It restores and asserts exact equality and inert effective access before
COMMIT. Function OIDs/owners/ACLs are privately compared before and after; fresh
function-body hashes, retention shape and the full active privilege profile must
pass. Contract and target-specific version receipts are written in the same
transaction as the changes. Confirmed COMMIT plus receipt proves installation;
fresh catalog verification is reported separately from that historical receipt.

## Concrete execution and activation scope submitted for approval

The final approval should name the assigned DB Analyst as executor, both named
development projects and this complete bounded operation:

1. Privately read existing protected setup/app/worker settings and configured
   public CA files, verifying existing ACLs/TLS without altering ACLs or secrets.
   Require the new producer flag off before migrations and activation testing.
2. Freshly verify **both** old active contracts before writes. Apply destination
   0005 in its own transaction; require COMMIT, receipt, exact owner-membership/
   function-ACL preservation and new catalog profile. Only then attempt source
   0005 and the same verification. Record sanitized commit states at every stop.
3. Verify no known local Node audit-worker/rehearsal process remains through the
   fixed local Windows process-metadata check, and no source-worker/destination-
   writer sessions remain through bounded catalog counts. These checks neither
   print command lines nor terminate processes. If an existing worker is found,
   stop; shut down the identified development worker normally before continuing.
   The executor maintains the known local exclusive worker window; no global
   distributed-process absence guarantee or process supervisor is added.
4. In always-rolled-back owner-scoped transactions on each project, exercise the
   actual R90 parser/enqueue or accept, valid anonymous/seeker/provider shapes,
   exact 90-day expiry, old S365 behavior at age 91 days, R expiry refusal and
   eight invalid service-view variants. Only two fixed synthetic fixture IDs are
   used; collision checks run first. Temporary owner grants and synthetic audit
   rows roll back, and original membership equality is checked afterward. No
   Auth, application, session or real business mutation is exercised.
5. Open the updated native worker runtime in this fresh Node process and query
   health only. Require zero pending/leased/quarantined/expired counts, then close
   it. This path never accesses claim or executes a worker step, so it cannot
   deliver queued real records. No other producer/worker may enter this window.
6. Recheck local worker absence; replace only the protected app setting
   `AUDIT_SERVICE_VIEWS_ENABLED=true` using unchanged-byte protection immediately
   before rename and exact protected readback. Existing app/capture/worker/Auth
   bindings and credentials remain unchanged. Start/restart the development app
   and updated worker normally when needed; this helper starts no HTTP server
   and leaves no daemon running. Frontend's one explicit details callback is
   verified separately by its owner.

Exact commands after approval:

```powershell
node migrations/audit/execute-service-view.mjs apply
node --import tsx migrations/audit/execute-service-view.mjs activate
```

Read-only fresh verification, also within that approval:

```powershell
node migrations/audit/execute-service-view.mjs verify
```

The helper is command-ready preparation, not a production deployment. After the
app reloads its flag, keep the **updated** worker running alongside it with the
existing `npm run audit:worker` command. Its command does not watch source files;
an older process must not handle R90 events. The native health-only check proves
updated runtime readiness, not fresh committed R90 transport. R90 database checks
are rollback-only; Backend's actual worker R90 test uses injected committed-operation
ports. TASK-014's twelve-event connected B/S transport evidence is retained as
separate evidence. No new committed service-view test event is claimed.

## Failure and recovery

Any failed fresh gate stops before writes. Deterministic pre-COMMIT migration
errors can be reported rolled back only after a successful ROLLBACK. Transport,
cancellation/timeout or otherwise uncertain COMMIT outcomes remain uncertain;
ROLLBACK alone does not prove no COMMIT. No automatic migration retry, privilege
repair, payload deletion, backup restore or destructive rollback is implemented.

If destination committed and source never attempted/definitively rolled back,
retain the compatible destination extension, leave the new producer off, inspect
the recorded safe results, and correct only the concrete source blocker. The
fixed recovery command is available **only for this reconciled state**:

```powershell
node migrations/audit/execute-service-view.mjs continue-source
```

It verifies the installed destination's extended catalogs, verifies the source's
old profile, writes source only, and never reapplies destination. For an uncertain
write, reconcile the exact target/version state first; do not run this command
as an automatic retry. A fully committed extension can remain while the new flag
stays off; the old eleven events remain compatible.

Rollback-only probe failure preserves the deployed extension and flag-off state;
all its fixtures/grants are bounded by ROLLBACK. Worker/readiness failure also
leaves the producer off. A concurrent app-file edit stops flag replacement and
preserves that edit; the helper removes only its own protected temporary file.
If a later activation problem occurs, disable only this producer flag with the
same protected unchanged-byte/readback discipline and reload the app; retain
already accepted events under their R90 policy. Do not restore owner URLs into
runtime, weaken checks/grants, or rewrite applied SQL to recover.

## Local validation

Executed without private/process/database access:

```powershell
node migrations/audit/execute-service-view.mjs offline
node scripts/test-service-view-database.mjs
```

Manifest/preprocessing passed; **65 focused checks passed**. Coverage includes
inert import/private-I/O/network guards, unchanged old function contracts except
the parser and one entrypoint, literal-preserving SQL expansion, explicit old/new
profile selection, read-only verification cleanup, both-gates-before-writes,
destination-first order, source-only continuation, receipt/COMMIT checks, ACL
drift stops, partial commits, cancellation uncertainty and a health-only readiness
assertion which fails on any access to claim. These are static and
injected-driver checks, not a PostgreSQL syntax engine or live catalog/fixture
proof. Actual PG17 deparse compatibility, locks, owner/grant semantics and R90 SQL
acceptance were pending at preparation time; the connected result above records
their subsequently completed checks separately.

No locale matrix was run for this DB-only preparation. Fresh application checks
are limited to en/lv/ru; all other locales/RTL remain deferred.

Technical review: PostgreSQL 17 documents that
[`CREATE OR REPLACE FUNCTION`](https://www.postgresql.org/docs/17/sql-createfunction.html)
preserves ownership/permissions and that
[`ALTER TABLE` CHECK validation](https://www.postgresql.org/docs/17/sql-altertable.html)
can scan existing rows and takes the applicable table lock. These support the
prepared design; they are not connected execution evidence.
