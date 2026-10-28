# TASK-024 — Development database execution plan

## Approved database package completed — 27 October 2026

After Backend verified the approved parent stop and child exit, Root released the
single user-authorized retry. The corrected local guard reported quiescent.
The exact fixed-target runner then exited **0**, with all eight transactions
**committed and verified**, in the approved order. Source and destination TLS/
baseline checks passed; exact setup memberships were restored and compared.
The four restricted principals passed verified-TLS/read-only probes; `fmt_app_dev`
also passed the actual own-role billing database readiness guard. Safe receipts,
published SQL hashes and bounded check counts are in the
[execution evidence](monthly-subscription-database-execution-evidence.json).

| Target | Applied and verified | Final catalog state |
| --- | --- | --- |
| Development source `hbkooiknruimukkhshrk` | 0010 → 0011 → 0012 → 0013, then audit0006 → audit0007 | 27-table billing/offer runtime profile, immutable guards, billing/portal parser chain |
| Development audit destination `ynygqodmtgjrngiudalw` | audit0006 → audit0007 before source audit changes | Billing/portal parser chain, prior event/retention contracts preserved |

Only the prepared 0012 initial immutable EUR1900-cent catalog revision/current
pointer were seeded; no legacy manual source import, paid projection cutover or
application fixture/session write occurred. No worker claims, app startup,
Stripe call, private configuration edit, backup/export/restore or deployment ran.
The user explicitly waived backups; no recovery point is claimed. Keep committed
objects/history; a destructive rollback/repair/restore is not authorized.

This completes the approved **database setup/catalog-readiness package**, not
end-to-end billing acceptance. Later app/session/Stripe sandbox and real
transactional fixture/concurrency/worker checks remain separately scoped. Do not
rerun the apply command: its exact-predecessor guards intentionally reject an
already applied installation. Earlier stop/preparation sections below are
historical and do not describe the current applied state. No unchanged suites
were repeated for this successful attempt.

## Approved Backend stop, then one DB attempt — 27 October 2026

User replied **"yes, stop it."** to Root's concrete combined process-stop and
single-DB-retry proposal. Backend owns identity-revalidated stop of watch parent
17744 then application 50916 only. DB does not terminate processes and waits for
Backend's explicit verified stop/quiescence result or Root's release before the
one newly authorized guarded setup attempt. The exact two-target DB-only package,
backup waiver, first-failure/no-retry handling and all application/fixture/Stripe/
deployment exclusions remain unchanged. Existing runner/tests are reused.

## User-reported stop: new attempt stopped at unchanged process — 27 October 2026

User explicitly answered **"Stopped — retry DB setup"**. Root authorized the same
DB executor to make one new guarded attempt of the existing narrow development
package, retaining the backup waiver and all exclusions. The runner refreshed
quiescence once and still observed application `node.exe` PID **50916**, creation
**2026-10-26T15:25:46.6737900Z**, parent `node.exe` PID **17744**, creation
**2026-10-20T10:34:25.0836300Z**. These unchanged creation identities show this
process remains, rather than a reused PID. Its scanner project classification
remained unresolved; Backend's separate owner/project review is held by Root.

The attempt stopped at `LOCAL_PRODUCER_OR_WORKER_NOT_ABSENT`, before private
inputs, sockets or SQL. **Zero commits; all migrations/role probes remain
unattempted.** User-reported Ctrl+C does not override the observed prerequisite.
No further inventory/setup retry, process termination or tests ran. No automatic
repair or new scope was inferred; Root received the exact safe evidence.

## Fresh attempt stopped at unresolved application identity — 27 October 2026

The single newly authorized setup attempt ran the corrected local inventory and
stopped with `LOCAL_PRODUCER_OR_WORKER_NOT_ABSENT`. Fresh safe evidence:

| Entry role | PID / name | Creation (UTC) | Parent PID / name | Parent creation (UTC) | Project |
| --- | --- | --- | --- | --- | --- |
| application | 50916 / `node.exe` | 2026-10-26T15:25:46.6737900Z | 17744 / `node.exe` | 2026-10-20T10:34:25.0836300Z | unresolved relative entry |

This classifier recognized the actual executable entry, not source text in a
tool/test argument. It reported no audit-worker match. The project cannot be
established from the relative application entry and immediate parent entry, so
the guard failed closed. This fresh observation supersedes the earlier reported
absence for current quiescence purposes; PID alone is not identity or permission
to stop a process. Root received the bounded evidence for owner coordination.

**No private inputs read, database sockets opened, SQL executed or commits made.
All migrations/restricted-role probes remain unattempted.** No further inventory,
setup retry or process termination occurred. Existing service-control scope still
does not authorize stopping these processes. The next prerequisite is precise
project/owner identity and coordinated quiescence; backup is explicitly waived.
The new 23 scanner tests and immutable migration pin checks passed; unchanged
suites were not repeated.

## Fresh guarded attempt authorized — 27 October 2026

User reiterated that the projects use Supabase Free/test data and asked **"Can you
procees without backup?"**. Root routed this as one fresh guarded attempt by the
same DB executor, with the existing no-backup exception and exact two-project
DB-only package. No service termination or broader activity is authorized.
Backend's bounded follow-up found the two 26 October PIDs no longer present;
those historical PIDs do not establish current process identity.

DB corrected a local scanner flaw before the fresh attempt: substring matching
could mistake source text/tool arguments for an application. The new
[argument classifier](../migrations/billing/local-quiescence.mjs) recognizes actual
Node/tsx entry arguments, project paths and immediate parent identity, ignores
eval/check/test source arguments and refuses unresolved relative producers.
One bounded live inventory will emit only matching PID/creation/parent/role and
project-verification metadata. Raw command lines remain transient in memory.
[23 synthetic checks](../scripts/test-monthly-subscription-quiescence.mjs) passed;
the unchanged 34/109/190/236 evidence was reused. SQL pins remain unchanged.

## Execution stopped at local quiescence preflight — 26 October 2026

The assigned DB executor ran the approved fixed-target command once:

```text
node --import tsx migrations/billing/execute-development-setup.mjs apply-development-without-backup
```

It exited 1 with `LOCAL_PRODUCER_OR_WORKER_NOT_ABSENT`, before private inputs,
database sockets or SQL. A single bounded read-only diagnostic then established
that process inventory works and found `node.exe` PIDs **17744** and **50916**
matching the application-or-billing category (`server/index.ts`, billing worker
or `billing:dev` patterns). It reported no audit-worker-category match. Raw
command lines, environment values and query/row payloads were not output.

**Confirmed commits: none. All eight migrations and restricted-role probes remain
unattempted.** No service was stopped and setup was not retried. The remaining
prerequisite is coordinated quiescence of these actual processes, or a separately
reviewed precise scanner correction if their owner establishes a false match.
Current authority does not include stopping another service. This is independent
of the user-authorized no-backup exception below.

The new [inert executor](../migrations/billing/execute-development-setup.mjs)
pins all migration bytes, uses explicit fixed-target/CA/principal parsing and
stage receipts, verifies matching 17/23/27/audit catalog profiles, compares exact
setup memberships and uses only read-only restricted probes. Private audit ledger
versions are checked within each pinned migration under its temporary owner;
inert-owner follow-up uses receipts and parser catalog fingerprints, without
expanding ledger access. The
[focused offline suite](../scripts/test-monthly-subscription-execution.mjs) passed
**34 checks**, covering stage order, pins, selected-only field parsing, receipts,
first statement/verification failures and uncertain commits/no retry. Existing
109/190/236 evidence was reused; no unrelated suites ran.

## No-backup execution exception — 26 October 2026

After approving the narrow setup package, the user instructed: **"Can you Proceed
without backup? I have only test data here"**. The assigned DB executor accepts
this explicit exception for the two exact development targets and the same
DB-only package below. It supersedes the recovery-confirmation hold, without
authorizing any backup/export/install/restore or expanded application activity.
There is no verified recovery point. Failed atomic transactions can roll back;
already committed stages cannot be promised a lossless rollback. Preserve
committed objects/data, stop at the first failure or uncertain commit and report
the last confirmed stage; no automatic repair, retry or destructive down migration.
Bounded local/connected worker-absence checks are allowed; stopping a service is
not. No fixture, session, worker claim, app startup or Stripe operation is included.

## Approved setup scope — recovery confirmation pending, 26 October 2026

User explicitly replied **"Approve the DB plan"**. The existing DB executor
`/root/subscription_database` accepts the narrow setup package for development
source `hbkooiknruimukkhshrk` and audit destination `ynygqodmtgjrngiudalw`: the
named private setup/runtime inputs below, bounded identity/TLS/schema/role
preflight, source 0010 → 0011 → 0012 → 0013, destination audit 0006 → 0007 then
source audit 0006 → 0007, their required permissions and staged metadata and
restricted-role checks. No fixture/cohort/session writes, worker claims, app
startup, Stripe operations, production or deployment are approved. The broader
rehearsal described below remains future scope. Stop on first failure or
uncertain commit; no automatic retry, repair or destructive rollback.

**Execution is held: restorable managed recovery points for BOTH projects have
not been confirmed.** Approval does not establish backup availability. The project
owner must confirm each project's recovery point date/time and restoration method
through Supabase Dashboard, following the
[local setup guide](stripe-local-app-testing.md).
Current DB connection inputs cannot establish managed backup availability;
provider API/UI access, logical export, backup ACLs/temporary owner delegation,
tool installation and restore are outside this approval. The logical-backup
alternative below is not ready or authorized. Once the factual prerequisite is
confirmed, the same approved setup scope needs no repeated permission request.

No private input was read, connection opened or preflight attempted while waiting.
No SQL, migration, ACL/configuration write or backup has run. The following
preparation record is historical; this section supersedes its unapproved-target
status only for the narrow package above.

Prepared 26 October 2026, Europe/Riga. **Reviewable preparation only. No database
target or connected operation was authorized by the user's local-app choice.**
DB owner/executor `/root/subscription_database` accepted bounded local artifacts
and offline checks; Backend explicitly delegated the injected
[readiness adapter](../server/billing/database-readiness.ts). Coordination reused
[existing decisions](monthly-subscription-decisions.md),
[queue](agent-coordination.md#task-024--monthly-pro-subscriptions) and
[DB handoff](monthly-subscription-database-handoff.md), without new agents.

## Recommended target and scope for one approval

Recommend the **existing hosted development pair** for the local application at
`http://localhost:5000`:

| Purpose | Exact project | Principal |
| --- | --- | --- |
| Application/source | `hbkooiknruimukkhshrk` | Setup: `postgres`; app and billing worker: restricted `fmt_app_dev`; independent audit failures: `fmt_audit_capture_dev` |
| Audit destination | `ynygqodmtgjrngiudalw` | Setup: `postgres`; audit delivery: restricted `fmt_audit_writer_dev` |
| Audit source delivery | Same source project | Restricted `fmt_audit_worker_dev`, distinct from the billing worker |

This is a recommendation, not a selected database. A disposable local PostgreSQL
choice instead requires a separately prepared PG17 source/audit pair, complete
baseline/role bootstrap, and explicit Supabase Auth/session assumptions. No local
server, container or database was started or silently selected.

The proposed hosted package comprises: bounded identity/schema/role/permission
preflight; recoverability confirmation before changes; the listed SQL transactions
and post-step metadata/permission verification; a named disposable test-workspace/
test-user cohort; rollback-only integrity checks and explicitly marked committed
app/session/billing/audit fixture writes; bounded billing dispatch/reconciliation
and audit delivery claims for those fixtures. Reuse prepared code and exact SQL
pins. Preserve all unrelated rows, manual Pro, paid rights and audit history.
No production, destructive restore, arbitrary data correction, purge, general
grant expansion or Stripe operation is included in the DB recommendation.

Setup/migration executor should remain the assigned DB owner. Backend owns the
separately approved local app/Stripe execution. Root records the exact cohort,
allowed committed fixture kinds/counts and bounded worker run before execution;
do not treat “rollback-only” as authorization to write. Account GET approvals are
spent and do not cover any part of this package.

## Named private inputs — approved setup scope only

No file below was opened during this preparation or conditional hold. Connection values/passwords,
certificate paths and private rows must never appear in commands or reports.

| Executor purpose | File and permitted fields |
| --- | --- |
| DB setup preflight/migrations | Protected `.env.audit-setup.local`: only `AUDIT_SETUP_SOURCE_DATABASE_URL`, `AUDIT_SETUP_DESTINATION_DATABASE_URL`; read the CA PEM referenced by each `sslrootcert`, verify the existing pin and TLS hostname. No fallback to an ambient owner URL. |
| Restricted app/capture probes | Protected `.env`: select only `DATABASE_URL`, `AUDIT_CAPTURE_DATABASE_URL` and the relevant audit enablement/environment fields; verify the named source roles and TLS. The app's other startup fields belong to Backend's separate local-app scope. |
| Audit delivery probes/claims, if included | Protected `.env.audit-worker.local`: only `AUDIT_SOURCE_DATABASE_URL`, `AUDIT_DATABASE_URL` and its explicit audit enablement/environment fields, plus referenced CAs. These URLs must never enter the app profile. |
| Local app target selection | `.env.stripe-app.local`: `STRIPE_LOCAL_DATABASE_URL`, explicitly selected restricted source URL. `STRIPE_LOCAL_APP_ENABLED=true` plus the reviewed local latch selects the opt-in runtime; no separate invented DB profile variable. Do not inherit `DATABASE_URL` silently or copy setup/worker credentials. Other profile/Stripe credential fields belong to Backend's scope in the [local testing guide](stripe-local-app-testing.md). |

Private-file ACL/ignore validation is part of the later authorized read. Existing
strict project/principal/TLS parsers remain mandatory; do not disable certificate
verification or switch to an owner connection to make a runtime check pass.

## Preconditions and ordered transactions

First confirm PostgreSQL17/UTF8, distinct exact source/destination installations,
`development` audit environment, source's previously established seventeen-table
foundation, service-view 0005 on both audit contracts, inert setup memberships and
restricted runtime roles. These facts have historical evidence, **not a fresh
connected verification in this task**. Refuse unexpected objects, principals,
versions, grants, target identities or partially applied state and report it.

Keep new checkout and billing producers off throughout preparation. Coordinate
existing worker/producer quiescence for the validator transition; this document
does not authorize stopping another session/service. Confirm the recoverability
prerequisite below before the first migration.

| Step | Prepared SQL | Required verification before proceeding |
| --- | --- | --- |
| 1 | [0010](../migrations/0010_monthly_billing.sql), source | Six new dormant tables; 23 public tables; browser/service/runtime denial; existing Pro untouched. |
| 2 | [0011](../migrations/0011_monthly_billing_runtime.sql), source | Exact SELECT/INSERT/UPDATE and role-specific policies on those six; no DELETE/DDL/sequence expansion. Verify 23-table runtime profile. |
| 3 | [0012](../migrations/0012_monthly_billing_offers.sql), source | Four new tables, nullable offer/mapping links, immutable triggers, local initial EUR1900-cent offer only; 27-table offer-dormant profile. Requires 0011 first. |
| 4 | [0013](../migrations/0013_monthly_billing_offers_runtime.sql), source | Revisions SELECT/INSERT only; settings SELECT/UPDATE; mapping/marker SELECT/INSERT/UPDATE. Verify 27-table offer-runtime profile. |
| 5 | [0006 destination](../migrations/audit/0006_destination_billing.sql), then [0007 destination](../migrations/audit/0007_destination_billing_portal.sql) | Exact predecessor hashes, new parser chain, restored setup memberships/ACLs, B/S365 and R90 unchanged. |
| 6 | [0006 source](../migrations/audit/0006_source_billing.sql), then [0007 source](../migrations/audit/0007_source_billing_portal.sql) | Same checks on source; owner-only portal profile verifies all current parser contracts. |
| 7 | Restricted role probes and approved fixtures | Existing audit app-role guard plus new own-role metadata guard; real SQL/FK/trigger/RLS/atomicity tests; explicit source-aware manual path before any paid projection. |

Use existing owner-only 17/23/27-stage profile functions for the matching stage,
then [portal audit profiles](../migrations/audit/billing-portal-package.mjs).
Return actual constraint/trigger definitions for semantic review. The later app
guard checks its own role's exact 27-table DML/column privileges, immutable guards
and all three pinned parser bodies using public catalogs only. It never reads
audit ledger rows or uses owner credentials. It complements, and does not replace,
owner verification or [verifyAuditApplicationPool](../server/audit/application.ts).
The ordinary dormant app retains that existing role check; the exact seventeen-
table owner verifier is not an application environment selector or bypass.
The current launcher deliberately accepts only the existing named hosted source
principal/target contract; an arbitrary local database URL is not supported by
changing that field alone.

Public command forms for review (connection options must be passed privately by
the authorized executor):

```text
psql <approved-source> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/0010_monthly_billing.sql
psql <approved-source> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/0011_monthly_billing_runtime.sql
psql <approved-source> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/0012_monthly_billing_offers.sql
psql <approved-source> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/0013_monthly_billing_offers_runtime.sql
psql <approved-destination> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/audit/0006_destination_billing.sql
psql <approved-destination> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/audit/0007_destination_billing_portal.sql
psql <approved-source> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/audit/0006_source_billing.sql
psql <approved-source> --no-psqlrc --set ON_ERROR_STOP=1 --file migrations/audit/0007_source_billing_portal.sql
```

**Capability:** offline `Get-Command` found no `psql`, `pg_dump` or `pg_restore`
on PATH. These forms are illustrative unless matching client tools are installed/
located separately. Existing Node `pg` is available; after authorization the DB
executor may use the strict fixed-target client and pinned, expanded SQL from the
prepared package loaders. No connected executor was run here. Do not execute a
historical all-in-one setup script, `db:push`, or the incomplete legacy transfer.

## Recoverability before changes

**First option:** owner confirms current restorable managed recovery points for
both exact development projects in Supabase Dashboard. Record timestamp, scope
and recovery method before DDL; do not assume availability, retention or restore
testing. If confirmation is unavailable, stop before DDL. No backup/restore API,
Dashboard or database was accessed by DB during preparation.

**Explicit alternative only:** obtain scope for logical export, required client
tool availability and temporary owner access; it is not hidden in the default
migration approval. Proposed ignored private bundle:
`database-backups/task024-billing-local-test-20261026/`. `git check-ignore`
confirmed this path is covered by existing rules; no directory/archive was
created. Before export, apply/verify current-user/SYSTEM-only directory ACLs and
reject links or paths outside that resolved workspace directory. Preserve the
backup until its retention/deletion is explicitly decided.

Use PostgreSQL17 `pg_dump --format=custom --no-password --schema=<scope>
--file=<fixed-private-path>` with credentials solely in a controlled child-process
environment and verified TLS/CA. Never put a password/connection URL in process
arguments, logs or chat. Archives preserve object ownership/ACLs; separately save
the inert role/membership/extension and profile metadata needed for recovery,
without role passwords. Scope archives by actual owner:

| Archive | Target/schema | Dump role |
| --- | --- | --- |
| `source-public.dump` | Source `public` | `postgres` |
| `source-audit-contract.dump` | Source `audit_contract` | `fm_audit_contract_owner` |
| `source-audit-capture.dump` | Source `audit_capture` | `fm_audit_source_owner` |
| `source-audit-rehearsal.dump` | Source `audit_rehearsal` retained evidence | `fm_audit_rehearsal_owner` |
| `destination-audit-contract.dump` | Destination `audit_contract` | `fm_audit_contract_owner` |
| `destination-audit.dump` | Destination `audit` | `fm_audit_destination_owner` |
| `destination-audit-rehearsal.dump` | Destination `audit_rehearsal` retained evidence | `fm_audit_rehearsal_owner` |

Audit owners intentionally begin inert. Where `--role` is needed, the alternative
scope must explicitly cover temporary **SET-only**, non-inheriting setup-owner
delegation, exact before snapshots, immediate exact restoration after each export
even on failure, and post-checks proving inertness. Grant nothing to the app or
worker. Do not grant blanket memberships or alter passwords/login/RLS. Without
those rights, refuse the export rather than bypassing permissions. Do not create
an ad hoc JSON/row-copy backup instead of a PostgreSQL archive.

Verify nonempty archives, SHA256 and `pg_restore --list` privately; a successful
listing does not prove a full restore drill. Exports cover the named application/
audit schemas, not a full Supabase Auth/Storage/global-role disaster recovery plan.
No destructive restore or connected restore drill is approved by this preparation.

## Source-aware app and worker acceptance

Manual edits/imports, invoice evidence, projection, audit enqueue and source marker
must share the workspace transaction/lock. Import only a valid legacy manual
grant once, preserving attribution and expiry; Free revokes manual sources only.
After any marker exists, disabling billing must **never** re-enable the old
overwrite writer. Keep the source-aware path or fail safely. Company identity
and agreed subscriber offer remain stable through ownership/price changes.
Before the first source-aware fixture write, confirm that every application
instance able to administer Pro uses that guard, or coordinate its quiescence
within explicit service-control scope. An older running writer must not race
the new source marker; this preparation did not inspect or stop other instances.

Billing dispatch uses existing app-role DML/leases and the injected pool; no new
DB role or grant is needed. Audit delivery uses its separate restricted principals
and entrypoints. Bound iterations/claims to the approved fixture cohort; no
unlimited daemon or unrelated backlog processing is implied. Verify concurrent
checkout/price saves, portal authority changes, replay/invoice dedupe, unknown
remote outcomes, generation/revision/token CAS, future-period gaps, manual wait,
source import and audit rollback with real approved SQL tests before readiness is
claimed. Existing expiry/history and paid rights remain intact.

## Stop and recovery

Stop on the first failed precondition, statement, verification or uncertain commit;
no automatic retry. Record the last confirmed commit and inspect bounded metadata
to determine state. Preserve archives, installed objects, financial/grant/audit
history and old parser helpers. Failed atomic transactions roll back; uncertain
transport does not establish rollback. Do not run a blanket down migration/drop,
restore a whole target, or revert to the legacy paid-overwriting writer.

Keep new checkout/producers off if only one audit target advances. Both new
wrappers delegate older events to the preserved parser, so unrelated audit paths
retain their contracts. Any restore, row repair, deletion, changed target or
expanded privilege needs its applicable scope. No production or business
cancellation/refund/grace policy is inferred from sandbox preparation.

Current evidence: new portal/readiness offline suite **109 checks passed**; old
236/190 suites were not repeated. No SQL, app, session, PostgreSQL/container,
Stripe call, private read/edit, ACL change, backup or deployment occurred.
en/lv/ru remain the locale test scope; ar/RTL, zh, fr, de, hi, ja, pt and es remain
deferred. The missing next decision is the database target and exact connected
execution/recoverability scope, after the local integration/setup guide is ready.
