# TASK-039 database handoff — 5 November 2026

Status: migration 0020 applied once and committed to approved development project
`hbkooiknruimukkhshrk` after the user's explicit TASK-039 no-verified-backup
selection. All 28 restricted read-only readiness gates pass; all 27 services and
32 bookings now carry EUR with exact numeric amounts and row counts preserved.
Backup was waived, not verified. No backup/export, application workflow/startup,
worker startup or deployment occurred. Historical preparation and both preflight
stops are preserved below; the final execution receipt records the applied state.

Requester/coordinator: `/root`. Assigned DB owner/executor: `/root/currency_db`.
Accepted the user's implementation instruction for
[the currency plan](currency-management-plan.md) under
[standing local cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: local ORM/validation fields, exact-money constraints, migration preparation,
injected read-only metadata guard and offline checks. This does not extend prior
target/executor-specific connected approvals or task-specific backup waivers.

## Implemented local contract

- Optional provider-confirmed `addresses.countryCode`, validated against the
  249 supported ISO alpha-2 country codes. Existing addresses remain unknown/null.
- Required explicit `services.currency` and independent `bookings.currency`.
  Neither field has a permanent EUR/default. Legacy EUR is a bounded migration
  decision, not a fallback for new or unknown records.
- Exact, unconstrained PostgreSQL numeric values with explicit nonnegative,
  maximum `99999999.99`, and currency-specific precision checks. Advances must
  not exceed totals; service advance percentages are nullable or 0–100. Currency
  codes use the shared supported allowlist.
- Local technical refinement, accepted by root: use numeric without typmod in
  place of the plan's suggested numeric(13,3). PostgreSQL applies numeric(p,s)
  coercion before CHECK, which would round an excess-precision input before the
  constraint could reject it. Explicit trunc-equality constraints preserve the
  amount limit and reject excess precision for 0-, 2- and 3-decimal currencies.
  This behavior is documented in
  [PostgreSQL 17 numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html),
  reviewed 5 November 2026.
- Currency exponent data follows the authoritative ISO 4217 SIX list, separate
  from CLDR formatting defaults. DB review identified the difference; the money
  owner corrected the shared metadata before migration generation. No exchange
  rates, currencies inferred from language, or payment-processor expansion.
- Shared Zod schemas validate supported currency/country fields while preserving
  `.partial()`/`.omit()` compatibility. Backend owns cross-field price/currency
  validation and canonical response normalization.

## Prepared artifacts

- [ORM schema](../shared/schema.ts).
- [0020 migration](../migrations/currencies/0020_currencies.sql), generated from
  [the local contract](../migrations/currencies/contract.mjs) by
  [prepare.mjs](../migrations/currencies/prepare.mjs).
- [Schema contract](../migrations/currencies/schema-contract.json).
- [Read-only postflight](../migrations/currencies/verify.sql).
- [Injected readiness guard](../migrations/currencies/application-readiness.mjs)
  and TypeScript declaration; Backend integrates its startup call.

The migration checks PG17/postgres ownership, RLS on the three affected tables,
old decimal(10,2) monetary columns and absence of the new fields. It acquires
exclusive locks on addresses/services/bookings; lock timeout is 5 seconds and
per-statement timeout is 60 seconds. It rejects invalid legacy monetary records
without repairing them, removes the three numeric typmods, adds the country and
currency columns, assigns EUR directly to every existing service and booking,
then requires/validates all seven currency/advance constraints in one transaction. It never
changes any numeric amount, joins historical bookings to today's location,
changes subscription tables, adds functions/triggers or changes privileges/RLS.
The script fails rather than silently accepting an already-applied/different state.

## Historical connected execution proposal — before authorization

The existing records identify development project `hbkooiknruimukkhshrk` as the
application source; this is a proposed target only. No private configuration was
read to confirm the current connection. The user must authorize TASK-039 inspection
and migration against the actual target and name its executor before access.
Other targets, the audit destination, and earlier no-backup exceptions are outside
this preparation scope.

1. Confirm exact project/environment/principals and verified TLS using existing
   protected connection tooling; expose no connection strings or private rows.
   Inspect current schema, aggregate row counts/invariants, active writers and
   backup/recovery evidence read-only. Compare against the prepared contract.
2. Confirm a current recoverable backup or obtain the user's explicit decision
   for this migration/target. Prior task-specific waivers do not cover TASK-039.
3. Stop old service/booking/address writers and keep them stopped through cutover.
   Required currency without a default deliberately rejects old inserts. An old
   client would still label new mixed-currency records incorrectly; do not expose
   old UI during activation.
4. With approved, privately populated PG connection settings, execute once with
   `psql -X --set ON_ERROR_STOP=1 --file migrations/currencies/0020_currencies.sql`
   or equivalent reviewed single-attempt verified-TLS tooling. This command is
   prepared, not run. Stop on any failure, timeout, target mismatch or uncertain
   outcome; inspect before any proposed retry.
5. Execute the read-only postflight, compare all definitions/types to the generated
   schema contract and run injected restricted-role readiness. Before restarting
   writers, both currency fields must be required without defaults, all seven
   constraints validated, every migrated record EUR, and counts unchanged.
6. Activate the compatible application and use separately authorized acceptance
   flows if required. The migration does not authorize session/booking fixtures,
   rollback-only test writes, app startup or deployment on a connected target.

Application owners must complete their offline contract checks before execution.
The migration's statement bounds and exclusive locks mean a busy or large target
can fail safely; a larger-window/batched alternative needs review rather than an
automatic timeout increase. No measured live size or locking behavior is claimed.

Recovery before COMMIT is transaction rollback. After COMMIT, retain the currency
fields and exact numeric data and gate writes while diagnosing. Do not downgrade
to a dollar-only app, drop currency snapshots, or cast to a two-decimal typmod
after 3-decimal records exist. A destructive down migration is intentionally not
provided. Restore/reversal requires a reviewed target-specific recovery plan.

## Cross-owner review

DB accepted/delegated Backend's local `server/storage.ts` change to read a coherent
service price/currency under the booking transaction's `FOR SHARE` lock, compare
required expected price/currency and save authoritative totals plus the currency
snapshot. Backend preserves existing schedule/capacity/authorization semantics.
This delegation covers local application queries and offline tests only.

DB reviewed/delegated local `server/search-pagination/query.ts` currency-state
aggregation across the eligible matched set after radius/semantic qualification
and before cursor/limit. Price ordering keys become null for mixed/unknown codes;
Backend falls back to the default sort and communicates effective sort metadata.
This prevents price comparisons between unlike currencies across pages.

Final concurrency follow-up: DB reviewed/accepted Backend's local projection of
the ranked service currency through the pagination result. Hydration compares
that saved ranking value with the current service currency and rejects a mismatch
with the controlled `SEARCH_CURRENCY_CHANGED` conflict. The comparison covers
default and both price sorts; it avoids returning unlike display amounts under
currency metadata calculated before a concurrent listing edit. Backend reported
57 passing mocked pagination scenarios including those races; DB reviewed the
final query/service projection and whitespace checks without executing SQL.

The shared schema and prepared SQL do not themselves prove those application
implementations; use Backend's final handoff for its tests and reviewed result.

## Verification

Passed locally:

```
node --import tsx migrations/currencies/prepare.mjs
node --import tsx migrations/currencies/check.mjs
node --import tsx migrations/currencies/test-readiness.mjs
```

Checks exercise required/invalid/supported currency inputs, optional/invalid
country handling, schema types/defaults, ISO exponent distinctions, migration/ORM
metadata consistency and EUR-only amount-preserving backfill shape. The injected
readiness tests cover complete/missing/drifted/malformed results, sanitized driver
errors and static PG17 normalization fixtures. They do not execute PostgreSQL or
establish live constraint, ACL, locking or migration behavior. Whole-app TypeScript,
build and frontend/API acceptance are owned by the respective application owners.

No language runners were invoked by DB. Application testing is restricted to
en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred. Preserve unrelated
dirty work, prior evidence and supported translations. Next action: integrated
owner verification, then obtain only the missing exact-target execution scope.

## Exact-target authorization accepted — 5 November 2026

User answered “I do aprove” to: “Approve the DB owner to preflight and apply
migration 0020 to development project hbkooiknruimukkhshrk, with verified recovery
and stop-on-first-failure?” Root routed this approval through live agent tools to
the existing DB executor `/root/currency_db`, who accepted it. This authorizes
protected target/TLS/principal inspection, bounded read-only preflight, and one
migration application only if current recovery and writer cutover are verified.
It does not waive recovery, authorize retries, application/worker startup,
workflow fixtures, deployment, other targets or private edits.

[The prepared preflight runner](../migrations/currencies/preflight-approved.mjs)
pins migration SHA-256
`e145bc2d687e03b7785d3dc3ec6041c6176213388ccdebed1c16b5e576f56094`,
uses existing protected source-only verified-TLS helpers, creates a once-only
aggregate receipt, verifies the existing restricted 40-table runtime profile,
and inspects owner metadata/readiness and active application/owner connections.
It never submits migration SQL; absent verified recovery stops the execution
chain before any migration attempt. Its mocked admission/boundary/error tests
run before the connected attempt. Local inventory found neither pg_dump nor
pg_restore on PATH and no repository database-backups directory or local archives.
Those capability facts are not a failed database operation or restore proof.

## Authorized single preflight result — stopped before SQL

Executed once:

```
node --import tsx migrations/currencies/preflight-approved.mjs --preflight-approved-source=hbkooiknruimukkhshrk
```

[Aggregate receipt](../migrations/currencies/source-preflight-receipt.json):
`state=stopped`, stage `restricted40_readonly_preflight`, safe code `ENOTFOUND`.
The configured source hostname could not be resolved.
The command used the default sandbox, without `require_escalated` or an automatic
approval review. `ENOTFOUND` may reflect the sandbox's network/DNS restrictions;
it is not evidence that the source hostname is invalid outside this environment.
The exact-target/principal
URI and pinned trusted-CA configuration guards completed locally, but the first
restricted-role connection failed before a TLS handshake or any SQL request.
There was no owner connection, live readiness/schema/count check, active-writer
inspection, migration submission, database write, backup operation or retry.
No raw hostname, connection string, credential, driver error or customer row was
printed or persisted. The configured target is approved; live identity/TLS and
writer cutover state remain unverified.

The observed recovery-capability inventory remains: pg_dump and pg_restore not
available on PATH, no repository database-backups directory, and no independently
verified current recovery point accessible to this executor. No provider backup
API capability was available, and archive settings were not queried because the
connection failed. The runner did not reach its recovery gate; it stopped at the
earlier connection failure as instructed.

Next owner action is to resolve the source connection/DNS capability and obtain
explicit authorization for a fresh bounded preflight attempt, preserving this
receipt. Before migration, independently verify a current managed recovery point
and restore method for this exact project, or authorize separate protected logical
backup/tooling/restore-verification work. Installing tools, exporting customer data
or restoring a database was not inferred from the migration approval. A different
recovery policy, including a no-backup exception, remains a user decision; none
was applied. Migration 0020 remains prepared and completely unattempted.

## One fresh network-enabled read-only preflight approved

On 5 November the user answered “approve” to root's question: “Approve one fresh
read-only preflight with network access for development project
hbkooiknruimukkhshrk?” Root routed the new exact-source scope to the same DB
executor, who accepted. The first receipt remains untouched, pinned by SHA-256
`be49a9d521506978983786845cfd71ea6b725b1f345e072ca1cbc37c06af1977`.
[A small wrapper](../migrations/currencies/preflight-network-approved.mjs) reuses
the tested preflight and writes an exclusive separate network-attempt receipt.
The execution command requests network access through `require_escalated`.
This fresh approval permits one read-only attempt only: first failure stops,
without alternate host/retry, migration, backup waiver/export, tool installation,
application/worker startup, workflow writes or deployment. Verified recovery still
conditions any later migration application.

## Network-enabled read-only result — verified recovery gate stopped

Executed once with `exec_command` `sandbox_permissions=require_escalated`:

```
node --import tsx migrations/currencies/preflight-network-approved.mjs --preflight-approved-source=hbkooiknruimukkhshrk
```

Automatic network review allowed execution; no approval rejection occurred.
[Separate network-attempt receipt](../migrations/currencies/source-network-preflight-receipt.json)
records the verified-TLS restricted and owner read-only checks. The original
default-sandbox `ENOTFOUND` receipt remains at its original path, byte-for-byte
unchanged. The failed first attempt did not establish an invalid external hostname.

Observed on the approved development project only:

- Verified TLS and exact configured source/principals: restricted `fmt_app_dev`
  and owner `postgres`; expected database and PostgreSQL 17 identity checks pass.
- All 26 existing restricted 40-table runtime readiness gates pass.
- Public table count 40, service count 27, booking count 32.
- Currency/country columns are still absent. The three existing monetary columns
  retain the expected required numeric(10,2) types; affected table ownership/RLS
  checks pass. This is the prepared migration's expected starting schema.
- Invalid service monetary/advance-percent records: 0. Invalid booking
  monetary/advance-total records: 0. Only aggregate counts were returned.
- Other application/owner connections: 0 at inspection. This verifies observed
  quiescence at that point; it is not a continuing writer lock or a startup approval.
- Archive mode is on, archive command is configured and backup-start function
  exists. These metadata facts do **not** verify a current recoverable backup,
  restore permission, recovery point, retention or successful restore.

The execution chain stopped at `verified_recovery_gate` with safe code
`TASK039_RECOVERABLE_BACKUP_NOT_VERIFIED`. The local inventory again found neither
pg_dump nor pg_restore on PATH, no database-backups directory and no local archive.
No independently verified current managed recovery point was available to this
executor. No backup was created, data exported, tooling installed or restore run.
No application/workflow write, migration submission, alternate host or retry
occurred. Both read-only connections were closed.

The exact remaining requirement is independently verified current recovery for
`hbkooiknruimukkhshrk`, including the recovery-point timestamp and an available
restore method. The project owner can supply verifiable managed recovery evidence,
or separately authorize protected logical-backup tooling/export and restore
verification. Existing migration approval remains conditional on verified recovery;
this read-only approval did not waive it. Any further connected execution must
preserve the stopped receipt and the stop-on-failure/no-automatic-retry limits.

## Reviewable recovery decision and prepared apply-once runner

No further live connection or migration was made while preparing these choices.

**A — Verify recovery.** Provide independently verifiable current managed backup
recovery-point/restore evidence for this exact project, or authorize protected
PostgreSQL backup tooling installation, a source-only logical export and restore
verification against an explicitly approved isolated target. Tool installation,
backup files/private-data handling, restore target and retention/recovery scope
must be concrete before execution. Existing archive settings alone do not qualify.

**B — Explicit development-only exception.** User may specifically select applying
TASK-039 migration 0020 once to development `hbkooiknruimukkhshrk` **without a
verified backup**, preserving stop-on-first-failure. This changes the existing
recovery condition for this task/target only. At preparation time no such selection
was recorded and the runner remained inert. It neither claims recovery proof nor reuses an
older task's waiver.

[apply-approved.mjs](../migrations/currencies/apply-approved.mjs) is prepared for
option B. It pins the migration and both prior receipts; creates a separate
exclusive activation receipt; reuses the protected exact-source/verified-TLS
configuration helper; refreshes restricted 40-table and owner/schema/amount/writer
guards; and submits the migration exactly once. It requires an explicit COMMIT
response plus expected backfill counts. Bounded read-only postflight checks exact
numeric fingerprints (kept only in memory), unchanged row counts, EUR assignment,
all 26 existing readiness gates and both currency metadata gates. It never starts
an application/worker, exercises booking/session write paths, changes configuration
or deploys. Any timeout/error/unknown commit outcome stops without retry. A
post-commit verification failure records the committed state and stops.

Only after option B is explicitly selected, the assigned executor would run once
with `exec_command` `sandbox_permissions=require_escalated`:

```
node --import tsx migrations/currencies/apply-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --backup-waived=TASK-039-2026-11-05
```

At preparation time this command was not executed; the later authorized result
is recorded in the final section below. Writer-zero checks are point-in-time observations,
not a permanent gate on other sessions. Migration table locks protect its own
transaction; before/after fingerprints detect intervening external amount/record
changes and stop acceptance rather than claiming continuous writer quiescence.
Writers must stay stopped during cutover, and no permission to terminate sessions
or start services is inferred from the recovery choice.

Offline checks passed:

```
node --import tsx migrations/currencies/test-activation.mjs
node --import tsx migrations/currencies/test-preflight.mjs
```

They verify exact-task admission, one submission, commit/amount/currency/readiness
checks, timeout stop/uncertain commit reporting, post-commit failure handling and
sanitized receipts using mocks only. Root independently reviewed the runner's
admission/TLS/query/commit/postflight flow before any proposed user selection.

## Exact TASK-039 development backup exception accepted

On 5 November 2026 the user answered “yes proceed without backup” to root's
explicit option-B question covering one migration 0020 application to development
`hbkooiknruimukkhshrk` **without a verified backup**, accepting the recovery risk.
Root routed this exact task/target decision to the existing DB executor
`/root/currency_db`, who accepted it. Selection identifier:
`TASK-039-2026-11-05`. This supersedes the verified-recovery condition only for
this one application and bounded read-only postflight. It does not claim any
backup exists or authorize retries, other targets, backup/export/install,
unrelated ACL/configuration changes, app/worker startup, workflow/session writes
or deployment. The reviewed apply-once runner and receipt pins are reused.

## Applied once and verified — 5 November 2026

Executed the exact prepared option-B command once using `require_escalated`
network access. Automatic review allowed execution. The existing protected
target/principal/trusted-CA guards and fresh restricted/owner read-only guards
passed for the approved development project. Observed other application/owner
connections were zero at the fresh guard; the migration then held its own table
locks for its transaction.

[The exclusive activation receipt](../migrations/currencies/source-activation-receipt.json)
records `state=verified`, `script.attempted=true` and `script.committed=true`.
The runner received an explicit COMMIT result. Migration 0020 ran once and made
59 currency-only backfill updates: 27 services and 32 bookings. No numeric values
were updated. Before/after exact numeric fingerprints matched; only the boolean
result `amountsPreserved=true` was persisted, not financial amounts/fingerprints.
Postflight row counts remain 27/32 and every service/booking has currency EUR.

All 28 restricted-role read-only readiness checks passed: the 26 existing runtime
gates plus exact currency column and validated-constraint metadata checks. This
verifies required service/booking currency without defaults, optional address
country, exact numeric types and all seven selected currency/advance constraints.
Existing subscription/runtime checks remain passing. Source TLS and approved
identity were verified; both connections closed normally.

No failure, automatic retry, alternate host, timeout increase, backup operation,
data export, tool installation, unrelated ACL/configuration change, application/
worker startup, booking/session fixture or deployment occurred. Backup remains
explicitly **unverified and waived for this task/target**; no restore capability
or wider recovery guarantee is claimed. The two historical preflight receipts
remain at their original paths with their pinned hashes unchanged.

The DB execution dependency is complete. Root can review the activation receipt
and update TASK-039/coordination status. Application startup and live workflow
acceptance remain outside this DB execution scope; offline application/browser
evidence is linked from the parent implementation handoff. Preserve currency
snapshots/precision during any later recovery; do not silently downgrade to an
incompatible dollar-only application or truncate 3-decimal amounts.
