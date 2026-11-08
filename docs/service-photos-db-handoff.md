# TASK-048 service photos — database handoff

8 November 2026. **Local implementation and authorized development activation
completed. Migration 0022 committed once and all 36 current readiness gates pass.
No backup was taken under the fresh TASK-048 waiver. App/audit worker remain stopped.**

## Owner, authority and scope

Requester/coordinator `/root` assigned DB Analyst/Developer
`/root/service_photos_database` through live agent tools. Owner accepted routine
local schema/migration/readiness preparation and mocked checks under the user's
service-photo request and AGENTS.md standing cooperation. Owner specifically
delegated necessary reversible local TASK-048 DB-file fixes/offline checks to root,
retaining DB review. Backend/frontend owners own their application integration.

At the end of initial preparation, no connected database, private configuration
read, migration execution, ACL change, backup operation, provider call or deployment
had been performed for this task. Current activation status is recorded below.
Historical currency/audit execution approvals and no-backup exceptions do not
transfer. Existing unrelated repository changes are preserved.

## Chosen local contract and compatibility

`services.image_urls` is `text[] NOT NULL DEFAULT ARRAY[]::text[]`. It stores the
ordered gallery, maximum ten pictures. A nonempty gallery must be one-dimensional,
use a one-based lower bound, have no null/empty members, and have
`image_url = image_urls[1]` with a nonnull cover. Empty arrays permit a legacy
single `image_url`; consumers fall back to that cover. The API insert validator
accepts omitted galleries for old clients and rejects duplicate paths, over ten
entries and entries over 1,024 characters. Actual storage validation and plan
entitlement remain server responsibilities; the database does not attempt a
cross-row subscription CHECK. No indexes, grants, roles, policies or new tables
are needed for this bounded same-record gallery.

The exported transport `Service.imageUrls` property is optional for old API/cache
payloads and fixtures. The actual Drizzle database field remains required.
Backend normalizes canonical writes to both gallery and first-cover fields.

Migration `migrations/service-photos/0022_service_photos.sql` adds the column and
two CHECK constraints, then backfills every nonempty legacy cover as a one-picture
gallery. It preserves existing covers and all other service/booking fields. Empty
or null legacy covers receive `[]`. It takes an ACCESS EXCLUSIVE service-table
lock, with a 5-second lock timeout and 60-second statement timeout. This can block
service requests; it must run during a quiesced development cutover.

**Stop the old app/service writers and audit worker/capture processes before
migration and keep them stopped through verification and new-app cutover.** Old
code can create legacy empty-array rows after expansion, but a cover edit on a
backfilled row would violate the cover constraint. Therefore old-code/new-schema
compatibility is partial, not a supported mixed-writer rollout. Updated code on
the old database fails readiness and cannot start; its Drizzle service selects
also require the new column. Apply migration before starting the updated app.

## Audit compatibility and backfill effects

The existing generic service trigger remains enabled. Its production body uses
`to_jsonb(OLD/NEW)` and serializes only changed field names with `redacted:true`;
it does not include array values/object paths. The new service column keeps the
record under the parser's 64-field limit. Backfill captures one redacted
`image_urls` change event per previously imaged service. No trigger bypass, parser
replacement, synthetic business mutation, or history deletion is prepared.

The prepared executor checks the current source application/parser baseline,
current destination parser hash and restricted writer capability with SELECT-only
queries. It requires an empty source backlog before migration, keeps delivery
stopped, then expects exactly the backfilled-picture count of pending audit events.
It does not claim/deliver/ack events. Normal audit delivery must be resumed after
successful cutover under the applicable execution scope.

## Concrete activation preparation

Reviewed command (subsequently executed once under the authorization below):

```powershell
node --import tsx migrations/service-photos/execute-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --approval=TASK-048
```

Executor is DB owner `/root/service_photos_database`. Proposed target is development
source `hbkooiknruimukkhshrk`; audit destination `ynygqodmtgjrngiudalw` is accessed
only for bounded read-only readiness. Existing protected configuration helpers
validate exact targets/principals, pinned CA and verified TLS; private values never
enter receipts. Required new authorization must cover those private configuration
reads, one source migration with its trigger-generated audit events, source and
destination read-only checks, executor/target, and the user's recovery choice.
During preparation `REVIEWED_EXECUTION_APPROVAL` and `REVIEWED_RECOVERY` were null.
The owner recorded the fresh authorization/waiver below before execution; command
flags alone never authorize execution. The existing execution receipt now blocks
re-execution. Do not rerun, remove the receipt or overwrite it.

Prepared migration SHA-256:
`ceae2a5dd684aea626e9cc63a09b71cd360eda91dc5dc895d7ed6bf8a90e0775`.
The executor verifies this digest and creates its receipt exclusively (`wx`),
so an existing receipt stops another attempt. It then:

1. Checks restricted current workspace-pricing/currency readiness (34 gates),
   destination parser/capability and an empty source audit backlog.
2. Closes its own worker health client. Verifies PG17/postgres identity, 41 public
   tables, old schema, enabled service trigger, counts, and no other app, owner,
   audit-worker or capture connections. Refuses unexpected large catalogs
   (over 10,000 services or 100,000 bookings) for separate review.
3. Holds in-memory hashes of every original service field and every booking field,
   excluding only the added gallery column. Submits the pinned transaction once.
4. Requires confirmed COMMIT/backfill count, exact gallery backfill, unchanged
   counts/original-field hashes, enabled trigger, current 36 readiness gates and
   the exact pending audit-event count. Hashes/raw rows do not enter the receipt.

Stop on first failure; no automatic retry. A timeout/disconnect after submission
records commit outcome unknown and must be reconciled read-only. A postflight
failure after confirmed COMMIT records committed state and keeps app/worker stopped.
The runner neither edits private configuration nor starts services.

## Recovery

Before execution, select verified current recoverability or explicitly approve a
new TASK-048 development-only no-backup exception. This task does not infer a waiver
from prior work. The prepared guard accepts a reviewed, task-specific explicit user
waiver or reviewed evidence of a recoverable backup verified within 24 hours, with
its pinned evidence digest/reference. It does not create or restore a backup.

Before COMMIT, failure rolls back with connection closure. After COMMIT, prefer a
forward fix while service writers remain stopped. Reverting application code alone
is unsafe for old cover edits. A schema rollback would require preserving any
newly added gallery references and a separately authorized plan; dropping
`image_urls` would lose additional photos and is intentionally not automated.
For local source recovery, remove only attributable gallery schema lines and the
new `migrations/service-photos` files after confirming no activation occurred.

## Verification and limits

Passing offline commands:

```powershell
node --import tsx migrations/service-photos/prepare.mjs
node --import tsx migrations/service-photos/check.mjs
node --import tsx migrations/service-photos/test-execution.mjs
node --import tsx migrations/currencies/check.mjs
node --import tsx migrations/workspace-pricing/check.mjs
node migrations/workspace-pricing/test-readiness.mjs
```

Checks cover ORM/generated SQL parity, narrow DDL/backfill, optional/invalid/
duplicate/max-ten arrays, strict readiness results/error redaction, generic audit
compatibility, exact admission and unset-approval hold, pinned SQL, one submission,
active-writer/backlog/drift refusals, count/field preservation, unknown COMMIT,
committed verification failure, sanitized receipts and inert imports.
`application-readiness.d.mts` supplies the backend TypeScript contract.

Those initial checks were mocked/static checks; live development schema/deparser
readiness and the approved backfill were later verified by the one-shot execution
below. Invalid database writes/concurrency scenarios and real audit delivery were
not exercised. PostgreSQL17
array/ALTER TABLE behavior was reviewed in the
[official array documentation](https://www.postgresql.org/docs/17/functions-array.html)
and [ALTER TABLE documentation](https://www.postgresql.org/docs/17/sql-altertable.html);
ORM metadata was checked against installed Drizzle 0.39.1 rather than inferred from
the latest docs. Root owns broader integrated types/build/application evidence.
Testing language scope is en/lv/ru where relevant; ar/RTL, zh, fr, de, hi, ja, pt,
es remain deferred, with translations supported and historical evidence preserved.

The original preparation hold above is historical. Current activation authority
and execution status are recorded below. Do not start the updated connected app
before migration.

## Development activation authorization — 8 November 2026

User explicitly replied **"Permission granted. Go without DB backup"** to root's
exact TASK-048 migration 0022 and checks request, which linked this handoff. Root
routed that authorization to assigned executor `/root/service_photos_database`,
who accepted it. This is a fresh TASK-048 development-only no-backup waiver; no
backup will be created and no existing restore capability is claimed.

Allowed: necessary protected configuration reads; one preflight/apply/postflight
for development source `hbkooiknruimukkhshrk`, using the pinned0022 migration and
its trigger-generated audit events; bounded read-only audit readiness on source
and destination `ynygqodmtgjrngiudalw`; sanitized local receipts. Stop on first
failure, with no retry. No ACL change, app/worker startup, audit delivery, deployment,
other-target access or backup operation is authorized. The owner recorded this
scope and new waiver in the runner's reviewed approval/recovery constants.

Local inspection found active app-entry node processes 52468/46504 and audit-worker
entry 39188. Quiescence must be established before the sole database attempt.
No DB attempt or process termination had occurred at that recording point.

Before the sole connected attempt, owner review found that the prepared trigger
metadata guard used a private-schema `regprocedure` lookup. PostgreSQL17 performs
schema-USAGE checks during that name resolution, while the source intentionally
keeps postgres outside the private audit schema. The owner replaced only that
lookup with equivalent `pg_trigger`/`pg_proc`/`pg_namespace` catalog joins in the
SQL and pre/postflight guards. DDL, backfill, triggers, grants and policies are
unchanged. No privilege expansion was needed. Current pinned SHA-256 is the value
above; the initial preparation hash was
`e56ada392b4c13d61af555059f5803f86b870c53c47c5276fd512fae98b40470`.
The offline generated-SQL and execution-pin tests cover the corrected guard.

## Development activation result

Assigned Backend owner verified exact workspace working directories and stopped
only the attributable app/watch and audit-worker trees, with no restart; terminal
shells and unrelated processes were preserved. DB owner waited for Backend's
15:21:50 UTC quiescence confirmation. The live source metadata guard independently
observed **zero other app/owner/worker/capture connections**.

DB owner executed the reviewed command once with permitted network access, from
15:22:10.889 UTC to 15:22:20.350 UTC on 8 November 2026 (17:22 Europe/Riga). It exited 0:

- Correct development source, PG17/postgres identity and 41-table baseline verified.
- Restricted baseline 34 readiness gates and bounded destination parser/capability
  checks passed; source audit backlog was empty before migration.
- Migration 0022 **committed once**, with SQL SHA-256
  `ceae2a5dd684aea626e9cc63a09b71cd360eda91dc5dc895d7ed6bf8a90e0775`.
- **28 services and 36 bookings** preserved, including in-memory before/after hashes
  of every original service and booking field. No original cover, money, currency,
  duration, address, booking or timestamp change was detected.
- **22 existing nonempty covers** backfilled as one-picture galleries. Exact
  backfill and unchanged counts passed; service audit trigger remains enabled.
- All **36 current application readiness gates** passed, including new gallery
  column/default and validated CHECK expressions via the restricted app principal.
- Exactly **22 pending audit events** resulted from the approved backfill; no event
  claiming/delivery/acknowledgment occurred. Leased/quarantined/expired counts were 0.

Sanitized immutable-attempt receipt:
[source-execution-receipt.json](../migrations/service-photos/source-execution-receipt.json).
Receipt SHA-256:
`c9ccf7269f73fcbc440b51d66edcaee5f98403f4a11da3347957ad4fb31ba2ea`.
It records the fresh waiver, executor/targets, confirmed COMMIT, preserved-field
result, counts and readiness; it contains no credentials, private rows, raw object
paths or preservation hashes. Root independently reviewed the receipt, its digest,
targets/executor/waiver, SQL pin, confirmed COMMIT, preserved-field/count results,
36 readiness gates and 22 pending audit events; all match the owner report.

No backup was created or claimed. No retry, ACL/role/policy change, private-config
edit, app/worker startup, audit delivery or deployment occurred. Existing migration
source comments saying PREPARED ONLY remain unchanged as part of the pinned
executed artifact; the receipt is the activation evidence.

Database dependency is complete for this development target. Next: user can start
the updated app and audit worker through their normal workflow; 22 captured audit
events await ordinary delivery. Do not start old application code against the
backfilled gallery constraint. No further connected operation is needed by this
task, and no startup/delivery is implied by this handoff.
