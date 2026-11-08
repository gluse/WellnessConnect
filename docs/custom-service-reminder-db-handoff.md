# TASK-049 custom service reminder message — database handoff

Assigned DB Analyst/Developer `/root/custom_reminder_db` accepted root's dependency
on 8 November 2026 under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope is reversible local ORM/validation/migration/readiness preparation and
offline/mocked checks. No private configuration, credentials, connected database
or service was accessed. No migration was applied. Root owns coordination and
integrated checks; Frontend and Backend own their respective application changes.

## Contract and local implementation

`services.reminder_message` is `text NOT NULL DEFAULT ''` with named
`services_reminder_message_check` enforcing `char_length(reminder_message) <= 1000`.
`insertServiceSchema` accepts an optional trimmed string up to 1000 JavaScript
string units. This preserves internal newlines, rejects null/non-string input,
and leaves omitted old clients compatible with the database default. JavaScript
counts astral symbols more strictly than PostgreSQL's character count; ordinary
en/lv/ru strings have the same boundary. No template substitution or executable
content is stored. Backend appends this customer-visible plain text only to
reminders, preserving appointment details and the platform signature.

The new [0023 SQL](../migrations/service-reminder-message/0023_service_reminder_message.sql)
is generated from the narrow current ORM difference, after migration 0022. It adds
one column and one CHECK; no row UPDATE/backfill, existing-field change, index,
table, policy, grant, function or trigger change occurs. Existing services receive
the empty default. Old application writers may omit the field; the new application
must wait until this expansion is applied. PostgreSQL documents constant-default
column expansion and the lock/constraint behavior in
[ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html), and
`char_length` in [string functions](https://www.postgresql.org/docs/17/functions-string.html).
No target behavior has been freshly verified live.

The new [readiness guard](../migrations/service-reminder-message/application-readiness.mjs)
requires the exact column type/default/nullability and validated CHECK. It fails
closed with `SERVICE_REMINDER_MESSAGE_DB_NOT_READY`, including strict result shape
and sanitized query failure. Backend wires this guard to application startup and
the standalone notification worker. The guard reads metadata and uses injected
queries; imports perform no configuration reads or connections.

## Reviewable activation package — held

Source target: existing development Supabase project **`hbkooiknruimukkhshrk`**,
database `postgres`, PostgreSQL17; executor **`/root/custom_reminder_db`**.
The [TASK-048 handoff](service-photos-db-handoff.md#development-activation-result)
records the earlier development gallery activation and stopped app/audit workers.
That is historical evidence; current process/connection quiescence has **not** been
freshly checked. TASK-048's executor-specific authorization and no-backup exception
do not authorize TASK-049.

Migration SHA-256:
`341f702ef28c59e3e5adf289eb0a520411f3b6e93fc476a0c737ada86ba9168d`.

The prepared [one-shot runner](../migrations/service-reminder-message/execute-approved.mjs)
has **null** reviewed execution approval and recovery constants. It refuses before
private reads, connections or receipt creation until the named owner records fresh
TASK-049 user authorization and recovery selection. Flags alone are insufficient.
After that record is made, the exact command is:

```powershell
node --import tsx migrations/service-reminder-message/execute-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --approval=TASK-049
```

The missing approval covers necessary protected `.env` and
`.env.audit-setup.local` reads through existing ACL/TLS/target-verifying helpers,
one source migration, source read-only preflight/postflight, and sanitized local
receipt creation. No destination access is needed for this DDL-only change. It does
not include private configuration edits, ACL changes, app/worker startup, real
reminder sends, audit delivery, another database target, deployment or publishing.

Before the sole attempt, the owner must reconfirm the exact source and keep app,
notification worker, audit worker and owner/capture writers stopped throughout
cutover. Existing runtime helpers preserve pinned CA and verified TLS, exact
source/principal checks, and private-file protections. The runner:

1. Checks the reviewed approval/recovery and SQL digest, then exclusively creates
   `migrations/service-reminder-message/source-execution-receipt.json` (`wx`). An
   existing receipt prevents another attempt; do not remove it or overwrite it.
2. Uses restricted `fmt_app_dev` read-only metadata to verify current workspace
   pricing, currency and gallery readiness. Closes that client before writer checks.
3. Requires PG17/postgres identity, 41 public tables, absent new column, enabled
   service audit trigger and zero other app/postgres/audit-worker/capture clients.
   Unexpected catalogs above 10,000 services/100,000 bookings require separate
   review. Captures counts and aggregate field fingerprints only in memory.
4. Submits the pinned transaction once. SQL lock timeout is 5 seconds, statement
   and idle-in-transaction timeout 60 seconds, and the client submission timeout
   125 seconds. An ACCESS EXCLUSIVE service-table lock blocks concurrent service
   access while adding/checking the field; existing rows are scanned for the CHECK.
5. Requires confirmed COMMIT, unchanged service/booking counts and all original
   fields, empty new messages, enabled trigger, and restricted baseline plus new
   message readiness. The receipt contains booleans/counts only, without private
   rows, credentials, connection strings or preservation fingerprints.

This migration has no row DML and therefore is not expected to generate service
row-change audit events. Later normal message-setting saves continue through the
generic audited service update; its change metadata redacts values. Existing audit
backlog is neither claimed nor delivered, and this task does not require it empty.
DDL auditing by any host-level system remains outside this verification.

## Recovery and failure behavior

Default recovery admission requires current verified recoverability evidence,
including its reviewed digest/reference and verification within 24 hours. The
runner does not create, verify by restore, or claim the existence of a backup.
Alternatively the user may explicitly select a fresh **TASK-049 development-only
no-backup exception**; previous task waivers are insufficient. Any backup creation
or restore operation needs its own authorization if not covered by that choice.

Stop on the first failure, with no automatic retry. Failure before COMMIT closes
the transaction and rolls back. Disconnect/timeout after submission leaves COMMIT
outcome unknown; keep writers stopped and reconcile read-only before any next
decision. After confirmed COMMIT, a failed postflight leaves committed state and
writers stopped. Prefer a forward fix. An additive column can remain during an
application rollback; do not drop it after users save custom messages without
preserving them and obtaining a separately authorized plan. No schema rollback
is automated. Local source-only recovery can revert only this task's schema lines
and new package after confirming no activation occurred.

## Offline verification

Passed without configuration, database or service access:

```powershell
node --import tsx migrations/service-reminder-message/prepare.mjs
node --import tsx migrations/service-reminder-message/check.mjs
node --import tsx migrations/service-reminder-message/test-execution.mjs
node --check migrations/service-reminder-message/execute-approved.mjs
node --import tsx migrations/service-photos/check.mjs
node --import tsx migrations/notifications/check.mjs
```

Checks cover generated ORM/SQL equality, additive-only DDL and preserved history,
empty/optional/trimmed/multiline/max1000/invalid inputs, strict metadata readiness,
constraint drift, sanitized errors, generic audit compatibility, exact new task
approval/recovery/source/executor admission, no private preparation on denied
approval/digest/receipt failure, one migration submission, active-writer and
baseline refusal, field/count preservation, unknown COMMIT, committed postflight
failure, no retries and inert imports. Mocked checks do not prove live SQL,
constraints, locks, ACLs, recovery availability or provider delivery.

An additional existing `migrations/notifications/test-runtime-contract.mjs` run
stopped at line11 on its stale rights-count assertion (`35 !== 33`). Its unchanged
profiles already include later tables; the new reminder column does not alter
those profiles. No historical applied migration or that unrelated check was
rewritten. Root received this baseline limitation for integrated reporting.

Fresh language input scope is **en, lv, ru**. **ar/RTL, zh, fr, de, hi, ja, pt,
es are deferred**, with translations maintained by Frontend and historical
evidence preserved. Next owner: root for integrated review and the exact missing
activation/recovery question, then the named DB executor if approved.

## Development activation authorization — 8 November 2026

User explicitly replied **"Approve. Proceed without DB backup"** to root's concrete
TASK-049 development-source migration request. Root routed this authorization to
the named assigned DB executor `/root/custom_reminder_db`, who accepted it. This
is a fresh **TASK-049 development-only no-backup waiver**; no backup will be made
or existing restore capability claimed. Earlier preparation holds above describe
the pre-approval state and are preserved as history.

Authorized: necessary protected configuration reads through existing reviewed
helpers; one pinned 0023 transaction on source `hbkooiknruimukkhshrk`; bounded
source-only read-only preflight/postflight and sanitized local attempt receipt.
Migration digest remains
`341f702ef28c59e3e5adf289eb0a520411f3b6e93fc476a0c737ada86ba9168d`.
No destination access, ACL/configuration changes, real messages, audit delivery,
app/worker startup, deployment or other-target operation is authorized.

The owner recorded the fresh scope and explicit waiver in the runner's reviewed
approval/recovery constants. Offline denial tests still exercise null authorization,
prior-task/other-executor rejection and missing recovery refusal. Backend checks
local process quiescence before the sole connected attempt; the runner independently
requires zero other source writer clients. Stop at first failure, with no retry
or receipt deletion. No connected attempt had occurred at this recording point.

## Development activation result

Backend completed fresh process cutover before the sole command, stopping only the
positively identified project npm/dev/watch tree and preserving its terminal and
unrelated processes. The database owner's independent source metadata guard then
observed **zero other app/postgres/audit-worker/capture client connections**.

The exact approved command executed once with permitted network access, from
**16:22:48.424 UTC to 16:22:53.402 UTC on 8 November 2026 (18:22 Europe/Riga)**,
and exited0:

- Exact development source, PG17/postgres identity and 41-table baseline verified.
- Restricted workspace-pricing, currency and gallery readiness passed before
  migration and again afterward.
- Pinned migration **0023 committed once**, with unchanged SQL SHA-256
  `341f702ef28c59e3e5adf289eb0a520411f3b6e93fc476a0c737ada86ba9168d`.
- **28 services and 36 bookings** preserved. In-memory before/after fingerprints
  proved every original service and booking field unchanged.
- All new message values are empty, and the service audit trigger remains enabled.
- The new column/default/nullability and validated max1000 CHECK passed the
  restricted application-principal readiness guard. Final stage was
  `restricted_message_postflight`, with receipt state `verified` and confirmed
  COMMIT. No failure or uncertain commit outcome occurred.

Sanitized single-attempt receipt:
[source-execution-receipt.json](../migrations/service-reminder-message/source-execution-receipt.json).
Receipt SHA-256:
`c1a4c84e91ff7ae3181fe187fdb457042ad896963d0bf4d970a212ac68ce36b8`.
The receipt records fresh TASK-049 authorization and the explicit backup waiver,
executor/target, zero writers, confirmed COMMIT, original-field preservation and
counts, without credentials, connection strings, private rows or fingerprints.
Do not rerun the command, remove the receipt or overwrite it.

No backup was made or claimed. No retry, destination access, ACL/role/policy change,
private configuration edit, real message, audit delivery, app/worker startup or
deployment occurred. SQL contains no row DML, and existing row-level audit trigger
configuration was preserved; audit backlog itself was not queried or delivered.
The SQL's `PREPARED ONLY; NOT APPLIED` comment is preserved as part of the pinned
artifact; this receipt and result paragraph record its now-applied development
state. Historic offline/preparation statements above remain as history.

The database dependency is complete for this development source. Root owns final
receipt review/integrated documentation. The user may start the updated application
through their normal workflow; no service startup or live send was performed by
this task. Other targets and deployment remain outside this authorization.
