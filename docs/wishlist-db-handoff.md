# TASK-042 wishlist, activity and message-read database handoff

## Authority and current state

Accepted 4 November 2026 by assigned DB Analyst/Developer
`/root/wishlist_database_plan`, requested by `/root` after the user's explicit
instruction to implement TASK-042. Scope: reversible local ORM definitions, new
SQL/migration/readiness profiles, DB-specific offline checks and this handoff.
Backend owns queries/routes/worker; Frontend owns controls/navigation/resources;
root owns integrated task/coordination/plan records. Schema/API decisions were
coordinated directly with Backend before implementation.

**Applied once and runtime-verified on development project hbkooiknruimukkhshrk.**
The initial read-only preflight stopped at its backup gate. The user then explicitly
selected TASK-042 activation without a verified backup; the reviewed continuation
committed 0018/0019 once and passed all 26 restricted40 checks. Authority and actual
results follow below. No private configuration changes, service startup, workflow
writes, deployment or publishing occurred. Existing scratch and historical
migration files were preserved. No verified backup is claimed.

### Exact-target activation authorization — 4 November 2026

The user subsequently instructed: **“Authorize the DB role to activate TASK-042 on
development project hbkooiknruimukkhshrk, checking backup/recovery first and stopping
on any failure.”** Assigned executor is `/root/wishlist_database_plan`. Root recorded
this scope in [the integrated handoff](wishlist-handoff.md#connected-authorization).
This authorizes necessary existing protected source-owner/application access through
the approved ACL/ignore-verified local method, bounded read-only target/35-table/
runtime/backup/recovery preflight, 0018 once then 0019 once after all gates pass,
and restricted 40-table read-only catalog verification. It does not authorize
private configuration or ACL changes, audit-destination access, service/app/worker
startup, flag edits, workflow/fixture writes, cleanup, sends or deployment.

**Stop on the first actual failed gate, connection, query or operation.** No retry,
reapply, privilege repair, destructive recovery or inherited backup waiver is
permitted. An uncertain COMMIT would be preserved for separately authorized
read-only reconciliation. Existing TASK-024/TASK-037 no-backup exceptions do not
cover TASK-042. Before the one connected preflight attempt, preserve this record
and obtain Backend's offline safety review. Any preflight receipt must be retained;
never delete it to bypass the single-attempt guard.

Initial current local discovery found no matching database backup archive/evidence
file and no `pg_dump` on PATH. Enabled WAL archiving/backup-function metadata would
not establish recoverability. No available Supabase backup-management connector
was discovered. These observations do not claim that the provider has no backups;
an independently verified current backup/restore path is not yet available to this
executor. A missing verified recovery gate stops before any DDL or grants.

Backend `/root/wishlist_backend_plan` independently reviewed the new source-only
`migrations/wishlist/preflight-approved.mjs` and cleared it for this one read-only
attempt. Review covers exact project/principal/TLS pinning, existing protected
ACL-verified reads, exclusive receipt creation, finite/getter-safe error redaction,
normalized metadata, existing35 readiness and the unconditional missing-recovery
stop. Both owners ran `node migrations/wishlist/test-preflight.mjs`: 140 synthetic
checks passed, with no private reads, receipts or network connections. The runner
has no DDL, backup export, restore, waiver or service-start path.

Approved single-attempt preflight command:

```powershell
node migrations/wishlist/preflight-approved.mjs --preflight-approved-source=hbkooiknruimukkhshrk
```

Use escalated process/network access for this one command upfront; an actual
connection/query/gate failure is a stop, not permission to rerun it. Preserve the
sanitized `migrations/wishlist/source-preflight-receipt.json` regardless of outcome.

### Historical read-only preflight and recovery stop

The single reviewed command ran on 4 November 2026, 20:23:17–20:23:21 UTC
(22:23 Europe/Riga), with approved process/network escalation upfront. There was
no automatic approval rejection. It exited 1 at the first failed gate:
`TASK042_RECOVERABLE_BACKUP_NOT_VERIFIED`. It was not retried.

[The immutable sanitized receipt](../migrations/wishlist/source-preflight-receipt.json)
records the actual outcome:

- Only development project **hbkooiknruimukkhshrk** was accessed, through the existing
  protected source settings. Target/principal checks, pinned CA/certificate hostname
  verification and encrypted authenticated TLS passed for both connections.
- Restricted `fmt_app_dev` read-only preflight passed all **20** historical
  integrated35 schema/runtime checks. The owner metadata transaction independently
  verified `postgres`, database `postgres`, PostgreSQL 17, read-only mode, exactly
  35 public tables and absence of all five new wishlist/activity/receipt tables.
- There were **zero other application connections** in that metadata snapshot.
- `archive_mode=on`, archive-command configuration and the backup function were
  present. These are backup-related configuration observations, **not evidence of
  an independently verified current backup or working restoration path**.
- The recovery gate remained unverified. No local backup archive, usable dump/
  recovery capability or managed-backup restore evidence had been independently
  verified for this package. This does not assert that provider backups do not exist.
- Both `0018_wishlist.sql` and `0019_wishlist_runtime.sql` remain
  `attempted=false`, `committed=false`. No DDL, grants, backup/export/restore,
  workflow/session fixtures, cleanup, destination access, private edits, services,
  worker or application startup occurred. Both read-only transactions committed
  and their clients closed before the recovery gate stopped execution.

At that checkpoint execution stopped. Preserve the receipt and prepared SQL; no more connected
operations follow automatically. The original target/migration authorization is
recorded, but the missing recovery decision must be resolved before a separately
reviewed continuation. Practical user choices are:

1. Verify a current managed backup and the same project's concrete restoration
   path, then resume the accepted migration scope. Backup metadata alone is not
   a restore rehearsal; any actual restore needs its own approved target/operation.
2. Authorize protected backup/export preparation and suitable recovery verification;
   missing PostgreSQL client tooling and any installation/export/restore scope
   must be resolved explicitly. No backup was created by this task.
3. Explicitly accept applying **0018/0019 for TASK-042 on this exact development
   project without a verified backup**. This is a new material risk decision;
   neither prior task waiver nor the activation instruction selects it implicitly.

Root received the stop result immediately and owns presenting the missing recovery
choice. Independent local work and evidence review can continue; the database
remained on its verified 35-table baseline until the explicit continuation below.

### Explicit TASK-042 backup waiver and continuation — 4 November 2026

The user answered the exact-project recovery question: **“Proceed with 0018/0019
without a verified backup on this development project, retaining stop-on-failure.”**
The question named development project **hbkooiknruimukkhshrk**. This is the new
TASK-042-specific selection `TASK-042-2026-11-04`; it resolves the recovery stop
above without claiming a backup exists or importing another task's exception.
The same assigned DB executor accepted continuation. Root owns the corresponding
task/coordination/integrated authorization record.

The original preflight receipt remains immutable, pinned at SHA256
`19dee27a8399dd2d63667b2b54991d34a68d26c2ada60e3fbe58a76956b458fd`.
The separate `activate-approved.mjs` requires this exact target/dated waiver and
unchanged SQL pins, creates a new exclusive `source-activation-receipt.json`,
freshly rechecks restricted35/TLS/PG17/no-new-tables/zero other app connections,
submits 0018 once then 0019 once, and requires each result's success flag and
confirmed COMMIT. It records attempts, confirmed commits and uncertain outcomes
without retries. Postflight uses the restricted application's **26** integrated40
read-only conditions. A known COMMIT is also emitted safely if receipt persistence
fails; no raw driver errors/private values are exposed.

`node migrations/wishlist/test-activation.mjs` passed **204** synthetic target,
waiver/pin/history-preservation, failure-stop, redaction, commit-uncertainty and
readiness checks without private files, real receipts or connections. Backend
independently reviews the new runner/tests before its single connected execution.
Backend returned final clearance after independently passing all 204 synthetic
checks, whitespace review and rehashing the unchanged historical preflight receipt.
No remaining local review blocker was reported for this exact single attempt.
The waiver does not authorize any privilege repair, reapply, destructive recovery,
destination connection, service/worker startup, private/flag edit, workflow writes
or deployment.

Continuation command (one attempt after review, with network/process escalation
upfront):

```powershell
node migrations/wishlist/activate-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --backup-waived=TASK-042-2026-11-04
```

### Actual activation result

The reviewed continuation ran once on **4 November 2026, 20:37:55–20:37:59 UTC
(22:37 Europe/Riga)** with approved process/network escalation. Exit code was 0;
no automatic approval rejection, failed gate, retry or uncertain COMMIT occurred.

- Fresh restricted35 preflight passed all 20 conditions. The source-owner
  read-only guard verified the exact project/principals, authenticated TLS,
  PostgreSQL 17, the 35-table baseline, all new tables absent and zero other
  application connections immediately before migration submission.
- `0018_wishlist.sql` committed once at `2026-11-04T20:37:58.503Z`, SHA256
  `4abd4acdcce0d83016c5f7466708bc98a996aa34378c2cd24e20a452a6651beb`.
- `0019_wishlist_runtime.sql` committed once at `2026-11-04T20:37:58.590Z`, SHA256
  `bb4c08065166c800f62cde02161428247cab28bd4dddcffce0eef99a005555c3`.
- Restricted `fmt_app_dev` read-only postflight passed **all 26** conditions on
  the exact 40-table runtime, including new column/default/constraint/FK/index/
  direction, private ACL, policy and schema-access checks. Existing billing,
  notification, appointment and audit-parser conditions remain passing.
- No connected operation beyond these two approved schema/runtime scripts and
  the bounded read-only guards/postflight was performed. No application/worker
  started, no product flag/private configuration changed, no audit destination
  was accessed, and no live user workflow/fixture/cleanup/deployment ran.

[The activation receipt](../migrations/wishlist/source-activation-receipt.json)
records `state=verified`, both scripts attempted/committed and
`commitOutcomeUnknown=false`. Its SHA256 is
`aaaf2c1d05bb13777e67b465487ff0479fa07f95d92398c315b9097665a21332`.
The historical failed-recovery preflight receipt still hashes to its original
`19dee27a8399dd2d63667b2b54991d34a68d26c2ada60e3fbe58a76956b458fd`.
Neither receipt should be deleted or used to justify a reapply. Backup remains
explicitly waived for this task; no backup/export/restore was performed or verified.

DB activation has no outstanding gate. Application use, product-activity flags,
worker operation, live workflow acceptance and deployment retain their respective
separate scopes. The database now requires a compatible **40-table** application;
an old exact35 build cannot restart against it.

## Implemented local contract

Five new private RLS-enabled tables in `shared/schema.ts`:

| Table | Contract |
| --- | --- |
| `wishlist_services` | One implicit account-wide wishlist: primary key `(user_id, service_id)`, original `saved_at`, newest-first listing index and service FK index. No wishlist container or copied service content. |
| `product_activity_events` | UUID source/outbox, `wishlist_additions` / `service_views`, optional actor for anonymous views, service and seller-scope snapshot, UTC reporting day, occurrence/expiry and processing timestamps. Wishlist actor/service/day uniqueness survives unsave; views remain event counts. Pending/expiry/FK access paths are indexed. |
| `service_activity_groups` | UUID daily service/seller-scope group, positive count/revision, update/expiry timestamps. Unique `(kind, service_id, reporting_day, scope_key)` and canonical `provider:<id>` / `company:<id>` binding preserve source workspace attribution. |
| `service_activity_reads` | Per-user/group read revision; primary key `(user_id, group_id)`. Nonnegative read revision; Backend bounds it to an authorized observed version and advances monotonically. |
| `booking_message_reads` | Explicit per-user/message/context receipts. Contexts are `customer`, `provider:personal`, `provider:company:<positive id>`. Primary key includes context, so readers/contexts do not clear one another's unread state. |

All thirteen new foreign keys cascade on deletion of their referenced account,
service, company, group or message. Consequently hard deletion cleans associated
wishlist/source/read state; normal unpublishing changes no membership and
republishing restores the same save. Source deletion never decrements an already
computed aggregate. The five tables have 31 columns, 22 constraints and 22 indexes.

The user selected UTC daily reporting, 90-day notification/activity/deduplication
history, and selections lasting until unsave/account/service deletion. Event
constraints enforce the UTC day, required wishlist actor, positive expiry with a
maximum 2160-hour lifetime and sane processing order. Group/receipt constraints
enforce positive totals/versions and valid context/scope. Backend enforces current
visibility, 90-day cleanup, eligibility/self-team exclusion and transaction-safe
outbox processing; these application rules are not falsely presented as cross-row
SQL constraints.

Source records retain private user/service/day linkage after unsave for the chosen
90-day deduplication period; providers see aggregate counts only. No message bodies,
visitor/saver directory, location, contact or credential fields are copied. Existing
booking/message tables and 12-calendar-month conversation retention are unchanged;
message purge cascades its receipts without extending history.

Backend's coordinated transaction locks a user/service pair, creates membership
and an eligible deduplicated event atomically, and makes repeated PUT/DELETE
idempotent. Unavailable membership removal needs no current public-service access.
The worker claims bounded pending completed-day rows, updates daily groups and
processing markers in one transaction; rollback/replay cannot double-count. Late
commits remain pending for later processing. Count increases increment revisions;
read state belongs to each viewer, with no sender-facing seen receipts.

## Migrations and runtime compatibility

- `migrations/wishlist/0018_wishlist.sql`: additive five-table expansion, explicit
  private-role revocation, expected PostgreSQL 17/restricted-role baseline, exact
  35-table precondition and no-existing-new-table guard. No existing rows or
  message schema are changed or backfilled.
- `0019_wishlist_runtime.sql`: separate runtime activation, expected 40-table
  baseline, exact five-table owner/RLS/no-policy/no-extra-ACL checks, grants and
  `fmt_wishlist_server` policies only for `fm_app_runtime`. Browser/authenticated/
  service/audit roles receive no new access. Backend authorization enforces
  account/booking/workspace boundaries, matching the existing server model.
- Both immutable scripts were initially prepared with transaction wrappers,
  bounded lock/statement timeouts and first-failure stops. Their prepared-state
  header comments remain unchanged; the actual one-time commits are established
  by the activation receipt above. Never reapply them or rewrite their SQL.
- New inert `migrations/wishlist/application-readiness.mjs` composes the historical
  profile into an exact **40-table** inventory and adds column/default/constraint/
  FK/index/direction/ACL/policy checks. Backend switches its application readiness
  import to this new version. The historical integrated **35-table** module,
  manifests and applied SQL remain unchanged.

The approved execution sequence is complete: fresh target/35-table guards,
zero other application connections, one expansion, one runtime activation, and
restricted40 read-only catalog readiness. Starting a compatible application or
worker was outside this operation and did not follow automatically.

An old exact-35 build cannot restart against the expanded 40-table database, even
with UI flags off. Recovery should disable new producers/worker/UI and run a build
that still understands the 40-table inventory, preserving saved data. Returning to
35 tables requires a separately reviewed destructive migration/data decision; no
drop rollback is supplied or authorized. Before application, local recovery is
reverting only this task's attributable files.

## Verification

Passed after script/import inspection:

- `node --import tsx migrations/wishlist/prepare.mjs`: generated only local new SQL
  and static manifest files; no environment/configuration or database access.
- `node --import tsx migrations/wishlist/check.mjs`: **268 offline checks** for
  generated ORM/SQL parity, unchanged existing tables, identity keys, UTC/expiry,
  constraints/cascades, private runtime and all 26 integrated readiness conditions,
  malformed/failing readiness results and inert import. Static PG17 deparser
  fixtures cover the new check expression grammar; they are not live catalog proof.
- `node --import tsx migrations/appointments/check.mjs`: **147 existing checks**
  passed, retaining historical integrated35 and message-retention/idempotency proof.
- `node --import tsx migrations/notifications/check.mjs`: existing offline
  notification ORM/SQL, additive/private RLS/ACL/default/uniqueness checks passed.
- Scoped `git diff --check` passed.

The actual activation now verifies new-table live catalog SQL/RLS/ACL/index/check
expression compatibility and integrated40 readiness, in addition to the fresh
35-table preflight. This is not live workflow, query-plan, lock-contention,
cascade/data-write, concurrent transaction or restore-rehearsal evidence. Backend owns actual
query/worker mock tests; root reports integrated type/build/frontend evidence.
Fresh language coverage is restricted to en/lv/ru. ar/RTL, zh, fr, de, hi, ja,
pt and es testing remains deferred; this DB package runs no locale matrix.

Next: root reviews the sanitized activation receipt and records the completed DB
activation separately from application/worker operation and live user acceptance.
No further connected DB action is needed for this activation. Preserve both
receipts and applied SQL; no retry, reapply or automatic operation is authorized.

## Commit preparation — 5 November 2026

At root's request under the user's instruction to commit TASK-042 changes, DB
added `migrations/wishlist/.gitattributes` for `*.sql` and
`source-*-receipt.json` with `text eol=lf`. The repository's `core.autocrlf=true`
would otherwise allow a future Windows checkout to change hash-pinned bytes.
This task-local setting preserves LF without changing unrelated repository files.

Git attribute/clean-filter checks and raw SHA256 verification confirmed that both
applied SQL files and both receipts retain their recorded hashes. No SQL or
receipt was rewritten, no shared Git index was changed by this owner, and no
connected/database operation occurred.
