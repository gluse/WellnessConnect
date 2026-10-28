# TASK-014 runtime preparation and metadata preflight

## Final development result — 23 October 2026

**Development audit transport is implemented, verified and enabled.** This result
supersedes the historical disabled/preparation gates below. Execution reused the
user's all-required-TASK-014 approval on the same named development pair; the
assigned DB Analyst was the executor. No production deployment occurred.

Protected owner-credential relocation and guarded password transactions
completed, followed by immutable source/destination 0004 rehearsal setup and
restricted-login enablement. Actual native application-pool verification,
`createCaptureRuntime`, `createWorkerRuntime`, capture/worker ports and the shared
worker loop all passed connected acceptance. The source application profile now
includes the separately reviewed, empty seventeenth location table.

Connected evidence covers transactional enqueue visibility and rollback, abort on
enqueue error, least-privilege denials, invalid/expired input, rollback-only
maintenance/retention boundaries, distinct concurrent claims, genuine thirty-second
lease recovery and stale-ack rejection, destination commit before missing source
ack with unchanged first receipt, one intended hash conflict, and injected
destination failure with queued-event preservation, normal restricted-app read,
health attention and recovery. Temporary maintenance grants/fixtures rolled back;
no real user/Auth/business mutation was exercised.

Exactly twelve fixed anonymous synthetic event IDs were committed and delivered;
all source/destination hashes and occurrence-based expiries matched, destination
receipts remained unique, and one intended integrity incident was preserved. Both
fixed manifests now record twelve passed outcomes and completed runs with P1
retention of at least one year from completion. No evidence was deleted.

The original outage attempt stopped because the client clock led the database by
825 ms. Reconciliation proved five delivered events, one queued event and six
absent events. The narrow resume used the database clock and the inspector's
actual zero-count/null-metadata absence representation; it preserved delivered
events and the queued event's original hash. Seven focused absence assertions
passed. `resume-outage --exclusive-runtime-window` then exited 0; the original
fresh-seed command was never rerun against those committed IDs.

Final command:

```powershell
node --import tsx migrations/audit/finalize-runtime-development.mjs
```

Exit 0. Destination then source cleanup transactions committed, disabling
`fmt_audit_test_dev` LOGIN, schema USAGE and all six rehearsal helper EXECUTEs.
Exact preexisting owner-membership rows/options/grantors were restored. Fresh
active destination and seventeen-table source profiles passed with test access
disabled. Protected files read back `AUDIT_ENABLED=true`, worker-file
`AUDIT_WORKER_ENABLED=true`, app-file worker flag false, and
`AUDIT_AUTH_EVENTS_ENABLED=false`. The final actual bounded worker loop was
healthy: zero claimed, pending, leased, quarantined, expired or failure counts.
Focused offline finalization lifecycle checks also passed; these are separate
from the connected SQL/catalog evidence.

**No background worker or application HTTP server remains running.** Start the
worker alongside the development app when needed:

```powershell
npm run audit:worker
```

Remote Auth producers remain staged behind the false Auth flag until TASK-015's
durable intent/reconciliation contract exists. This does not prevent local atomic
capture and denial-event transport. No daemon deployment, real provider outage,
production load, or broad language/browser matrix is claimed. Future language
checks are en/lv/ru only; the other eight locales/RTL remain deferred.

Recovery preserves the protected original-byte and ACL backups, separated setup,
worker and test files, manifests, incidents and all applied SQL. Do not rerun
provisioning/enablement/rehearsal/finalization commands blindly after this success;
their preconditions deliberately describe earlier states. On a later failure,
inspect the exact committed state first. A reversible capture/worker stop uses
the protected flags and normal process shutdown; never restore owner URLs into
runtime or drop/delete audit evidence automatically. No further database action
is required for this accepted development result.

## Resumed completion authorization — 23 October 2026

The user explicitly approved all actions necessary to complete TASK-014. Root
routed execution to the assigned DB Analyst on the existing development source
`hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`, preserving selected
C/R1/P1, Choice 1 and the twelve-event rehearsal manifest. This supersedes prior
per-phase execution holds for necessary development completion. It includes
logging-safety discovery, safe protected provisioning/recovery, least-privilege
rehearsal setup/tests and required runtime enablement after verification. Applied
SQL stays immutable; new database changes use new versions. Exact location
dependency integration is reviewed separately against TASK-026's prepared scope.
No production/deployment/billing, real business/Auth mutation, destructive broad
cleanup or secret/verifier disclosure is authorized. No credential material is
sent before logging safety is established. Record concrete command/review/results
and recovery for every new persistent step; no repeated phase permission asks
are needed within this authorization.

### Completion dependency: location-enabled application profile

Before credential relocation, DB owner accepted TASK-026's reviewed location
package as the necessary seventeen-table application compatibility dependency.
Only source `hbkooiknruimukkhshrk` is written; `0009_user_search_locations.sql`
hash `fcd68625be336928dc992354d2b0ef8e96bce416022c7eb34e673fcc98302838`
is unchanged. Backend reviewed the isolated profile additions (all-seventeen
no-restrictive-policy check and exact source cron baseline) and shared protected
setup-loader integration; 163 offline package checks and manifest command passed.
Execution under the completion authorization: one
`node migrations/execute-search-location.mjs apply-location`, while runtime
roles remain NOLOGIN. Fresh sixteen-table foundation gates precede the pinned
transaction, followed by seventeen-table catalogs and private-RLS/shape semantic
review. No user/location rows, API/Auth operation, sequence grant, audit payload,
credential or destination write is included. On uncertainty or post-COMMIT
failure preserve the empty table/evidence; no automatic retry or DROP.

Actual location dependency result: exit 0, source COMMIT/receipt and all seventeen
table/shape/private-ACL/runtime/policy checks passed. The deparsed CHECK was
reviewed against the pinned creation SQL; accepted public-definition SHA-256 is
`a6e723c3ec870b2190c8d34c87762ca13e3d6016045c804e8611e91576fec574`.
This is a schema-definition digest, never a credential fingerprint. No user or
location rows were inserted. The migration is now immutable.

### Completion credential preparation and exact operation

Logging discovery found `log_statement=ddl`, pg_stat_statements top/utility
tracking, automatic plans after ten seconds and ordinary parameter logging.
The first non-secret `set_config` probe was denied 42501 for superuser settings;
the literal `SET LOCAL` ProcessUtility probe then established the supported
Supautils path on both targets. Required effective session controls are:
statement/duration logging off, ordinary/error bind parameters zero, error
statement/minimum-message severity PANIC, pg_stat_statements none/utility off,
pgaudit none/empty object role/no statement text, auto_explain disabled/parameters
zero. Immutable safe defaults are checked each time: sampled duration disabled,
transaction sample rate zero, pgaudit parameters off, no local preload logger and
SCRAM-SHA-256 encryption. Denied verbosity/activity controls do not produce a
false safety claim: bound credential values enter a transaction-local GUC, and a
constant role-scoped DO reads it for ALTER ROLE, then clears it. No password is
literal in top-level activity SQL. Trusted privileged database administration is
unchanged; absolute secrecy from server administrators/memory is not claimed.
No global or persistent role logging setting is changed.

Peer-reviewed fixed command under completion approval:

```powershell
node migrations/audit/provision-runtime-private.mjs
```

Fresh disabled destination and seventeen-table source gates must pass first.
Four independent 32-byte OS-backed passwords are generated privately. File
stages: exact protected original `.env` byte backup in
`.env.audit-before-runtime.local`; separated protected setup and worker files;
last, restricted app/capture URLs in `.env` with all three producer/worker/Auth
flags false. Setup/worker owner bindings are removed from application input.
Unchanged lines, mixed newlines and BOM are preserved; invalid UTF-8 or duplicate
selected keys stop. Immediately before application replacement, ACL-verified
text and original bytes must still match; the final byte comparison happens
after protecting/writing the replacement temp and immediately before rename.
Concurrent edits stop without overwriting them. All four protected files must
read back correctly **before** any password transaction begins.

Then destination writer and source app/capture/worker password transactions run
in that order with verified same-session logging guards. All accounts stay
NOLOGIN. No file I/O occurs during the guarded transaction. Confirmation requires
COMMIT; ambiguous outcomes stay uncertain and are never automatically retried.
The app, worker and setup files are never printed, fingerprinted or committed.
Offline evidence: 44 logging-probe, 97 private-session, 29 byte-preserving-plan
and 74 provisioning/lifecycle checks passed. Backend independently reviewed the
actual paths and reran affected checks; tests use synthetic values, no private
I/O, ACL mutation or database calls.

Partial-failure recovery is deliberately conservative. A file-stage failure
leaves passwords unattempted and roles NOLOGIN; preserve the protected backup,
setup/worker stages and any concurrent app edits. A changed app file is never
replaced with the old owner URL automatically. If a password transaction was
attempted, preserve its recorded per-target state and the matching protected
credential files; do not regenerate/reapply blindly. The assigned DB owner first
reconciles exact role state and staged-file equality privately, then performs
only the necessary scoped continuation or guarded rotation. Setup credentials
remain separated for recovery; application/worker flags remain false until
actual restricted-login/factory/rehearsal acceptance. No broad deletion or
destructive database rollback is a recovery step.

Actual credential handoff: exit 0. All protected files/readbacks and concurrent
edit guards passed; destination writer and source app/capture/worker password
transactions each confirmed COMMIT. The helper reported NOLOGIN/flags disabled
throughout. No credentials or verifier values were output. Setup recovery and
original private backup remain separate; actual restricted authentication is the
next acceptance step, not claimed by a password COMMIT alone.

### Completion rehearsal schema operation

DB owner and Backend reviewed new versioned rehearsal setup, including separate
NOLOGIN `fm_audit_rehearsal_owner`, capped NOLOGIN `fmt_audit_test_dev`, fixed
twelve-ID run/cohort provenance, and six restricted helpers. The existing audit
owners own only cohort-scoped metadata inspectors; temporary schema CREATE and
both owners' exact membership grantor/options are restored. The test login gets
no direct audit/manifest table access or ordinary capture/worker/writer entrypoint.
No existing applied migration is edited. The source accepts the already verified
seventeen-table application without changing its grants.

Execute under the completion approval:

```powershell
node migrations/audit/rehearsal-setup.mjs apply-rehearsal-disabled
```

Pinned destination 0004:
`d16ee13570c5b9c4f2f02b248e305ec6f04c8513f1b268d1e655fe109a9786d0`;
source 0004:
`eae81a53677e93991f992ef24d1c32c6322c545f48dc7adbbda3c1766303d5c9`.
Fresh fixed catalog gates on both precede destination-first transaction/receipt/
COMMIT, then bounded function/hash/ACL/owner verification. No audit event is
enqueued by setup. All logins remain disabled, no passwords are sent by this
command. Offline manifest and **295** setup checks passed; Backend independently
reviewed the concrete SQL/runner and reran checks. Keep both evidence schemas and
partial commits on failure; no automatic retry or destructive rollback.

Actual 0004 result: both targets confirmed COMMIT and all setup postchecks passed;
all old/new owner memberships restored exactly and no audit fixture enqueued.
New 0004 files are now immutable. Controlled rehearsal enablement next uses
`node migrations/audit/enable-rehearsal-runtime.mjs`: protected independent test
credentials first; both positive disabled-runtime/rehearsal preflights; guarded
test-password and fixed runtime/test LOGIN transactions, destination first; then
explicit active profiles. App/worker/Auth flags must remain false. This is within
the broad completion approval and starts no producer, worker loop or server.
Focused enablement lifecycle tests passed 18 checks; no broad test rerun.

Enablement first stopped before writes on the active verifier's owner-scope
check. Its only mismatch was internal TOAST ownership for the cohort text column.
The local correction permits only pg_toast relations/indexes linked to the
owned `audit_rehearsal.run/cohort` tables, preserving every other owner boundary.
After that preflight-only stop, validated staged test credentials were reused;
both first password/LOGIN transactions confirmed COMMIT and active catalog
verification passed. App/worker/Auth flags remain false. No cohort event had been
seeded at this point.

Connected acceptance command:

```powershell
node --import tsx scripts/rehearse-audit-db.mjs connected --exclusive-runtime-window
```

The DB executor attests the controlled window: no application listener or worker
daemon has been started by the project agents; persistent producer flags remain
false, and this bounded runner owns the new restricted connections. Fixed-ID
absence on both projects and zero unrelated pending/leased/quarantined work are
checked before seeding and before every claim. It exercises actual native app
pool/capture/worker readiness, atomic rollback with temporary transaction-only
rows, invalid/expired inputs, denied privileges, concurrent workers, genuine
30-second lease recovery, commit-before-missing-ack matching redelivery, one
same-ID conflict, injected transport failure plus harmless app-table LIMIT 0
read and catchup, and exactly the chosen twelve unique anonymous S events.
No real business/Auth/session mutation or real-backlog draining is allowed.

Retention acceptance uses transient owner access only in transactions that
**always roll back**. Table locks precede Boolean gates proving no unrelated
row could qualify for purge/disposal, including a 60-second safety margin and
unrelated maintenance evidence. Only selected cohort IDs are inserted as
backdated/fresh synthetic fixtures; actual existing maintenance functions prove
fresh retention, seven-day source cleanup and occurrence-based destination
expiry. All fixtures, maintenance rows and temporary owner membership changes
roll back; original memberships are compared afterward. No global purge is
called if unrelated eligible data exists. The final twelve committed events and
P1 run/cohort/conflict evidence are retained, never deleted for cleanup.
Offline import/contract and ten focused refusal/cleanup assertions passed.

23 October 2026. Prepared by the assigned DB Analyst/Developer with read-only
compatibility/security review by the assigned Back End Developer. **TASK-014 is
incomplete. Metadata preflight and its separately approved ACL prerequisite have
completed. Both runtime 0003 installations committed and final corrected
read-only catalog verification **passed on both targets**. All new runtime
accounts remain NOLOGIN; no passwords, cutover or activation occurred.
password provisioning, activation and connected rehearsal remain incomplete.**

The user's 19 October Choice 1 and bounded synthetic rehearsal selection in
[the runtime proposal](audit-runtime-proposal.md) authorizes local preparation.
Today's request resumes that work. Executor: assigned DB Analyst/Developer.
Environment: repository only. Allowed: scoped new SQL/helper preparation and
offline/mocked checks. Limits: no private configuration/credential reads or
changes, database connections, fixture writes, application startup, deployments,
or edits to applied 0001/0002 SQL and their installed setup executor. That initial
offline-preparation pass performed none of those excluded operations. Subsequent
separate approvals authorized the ACL-only prerequisite and metadata diagnostic
described below, followed by the separately approved disabled-runtime attempt.
Preserve previous execution evidence
in [the setup report](audit-execution-report.md).

**23 October owner acceptance:** the assigned DB Analyst accepts the TASK-014
cross-role dependency in [the coordination queue](agent-coordination.md#task-014--unblock-dependent-frontendbackend-work)
under the updated standing authorization. Scope: reconcile the committed
destination's permission verification, correct routine local diagnostic defects,
coordinate Backend security review and return evidence/capture gates. Routine
local/offline corrections need no repeat user permission. Existing connected
stop/no-reapply/source-write holds and material security-policy choices remain.

## Concrete deliverables and evidence

| File | Prepared behavior |
| --- | --- |
| `migrations/audit/0003_source_runtime.sql` | Applied and verified Choice 1 grants for exactly sixteen existing application tables and ten sequences, server-role RLS policies, restricted app/capture/delivery accounts NOLOGIN. Preserve exact applied bytes/header. |
| `migrations/audit/0003_destination_runtime.sql` | Applied restricted writer NOLOGIN, installed-version and inherited-privilege checks. Preserve its exact bytes despite its historical preparation header. |
| `migrations/audit/0003_*_rehearsal.sql` | Draft protected fixed run/cohort, synthetic labels, scenario names and bounded timestamp/outcome recording, and cohort-only inspection helpers. No ordinary audit payload SELECT grants to the test login. |
| `runtime-contract.mjs` | Two fixed targets, named roles, explicit twelve-event allowlist, scenario and sixteen-table/ten-sequence manifests, anonymous denied-request synthetic envelope factory. |
| `runtime-support.mjs` and `protect-private-file.ps1` | Strict URI/principal/port/database/TLS boundaries, safe error codes, inert imports, Windows current-user-only private-file read verification. Existing write primitives remain preparation code, not a completed multi-file provisioning workflow. |
| `execute-runtime-setup.mjs` | Supported commands are `offline` and catalog-only `preflight`. Four draft SQL digests are pinned; no apply, provisioning, activation or rehearsal mutation mode exists. |
| `scripts/test-audit-db.mjs` | Offline-only contract, boundary and diagnostic-driver checks. No connected test fallback or simulated PostgreSQL queue. |
| `execute-runtime-disabled.mjs` and `scripts/test-audit-runtime-install.mjs` | Separate fixed two-script disabled-runtime executor and synthetic driver tests. Approved attempt: destination committed, source not attempted. Do not reapply this fresh-install command. Corrected exact inaccessible-provider-ACL classification grants no new rights. The ordinary metadata helper remains read-only. |
| `inspect-disabled-writer-acl.mjs` | Bounded fixed-destination/writer read-only catalog reconciliation of the committed install; schema USAGE, relation/column privilege masks and PUBLIC/direct/inherited ACL provenance only. |
| `inspect-source-runtime-acl.mjs` | Executed bounded fixed-source/all-four-runtime-role catalog reconciliation of unexpected relation/column/sequence ACLs after expected masks; no row/value/function-call or repair path. |
| `verify-runtime-disabled.mjs` | Executed successfully: fixed read-only verification of both existing committed disabled installations; no migration/reapply/repair path. |
| `continue-runtime-source.mjs` and `scripts/test-audit-source-continuation.mjs` | Prepared source-only continuation: freshly verify the existing disabled destination, then first attempt of pinned unchanged source SQL, with conservative commit/recovery state and no destination mutation path. |

Executed successfully in the repository:

```powershell
node migrations/audit/execute-runtime-setup.mjs offline
node --import tsx scripts/test-audit-db.mjs offline
node --check migrations/audit/execute-runtime-setup.mjs
node --check migrations/audit/runtime-support.mjs
node --check scripts/test-audit-db.mjs
[void][scriptblock]::Create((Get-Content migrations/audit/protect-private-file.ps1 -Raw))
```

The offline runner initially passed **239 checks**, then **243 checks** after the
narrow Windows PowerShell built-in-module compatibility correction. Evidence covers the real backend
envelope/canonical contract; exact synthetic UUID/scope rules; pinned draft SQL
boundaries; URL/control-character/override rejection; strict quoted settings;
safe failure output; unsupported-mode rejection before private I/O; inert import
under private-file/socket guards; BEGIN READ ONLY/ROLLBACK under success, malformed
metadata and query failures; closure of every created client under connection,
inspection and output failure. A synthetic `pg.Client` construction proves fixed
startup options, normal replication, SSL negotiation and verified TLS cannot be
overridden by ambient PGOPTIONS/PGREPLICATION/PGSSLNEGOTIATION/PGSSLMODE. PGBINARY
overrides are rejected. No test connected a socket or executed SQL.

Static checks are not PostgreSQL syntax, effective permission, installed version,
queue, retention or live transactional evidence. PowerShell parsing does not prove
actual file ACLs. The unrelated workspace remains intact. Backend review accepted
the offline/catalog-only scope; it does not authorize execution.

## Approved read-only development metadata operation

**Completed on both named development projects on 23 October 2026; metadata-only
success, runtime activation not ready.** The user first replied “I do approve” to
the exact metadata scope, then separately replied “yes I do aprove” to the linked
ACL-only prerequisite. The fixed protection helper succeeded, preserving `.env`
contents/owner/group/SACL and retaining protected ignored permission-recovery
metadata. No ACL restoration was needed. See [the preflight report](audit-preflight-report.md)
for exact sanitized command outputs, snapshots, recovery and preserved initial
failure evidence.

A Node-child Windows PowerShell `Get-Acl` discovery failure was corrected by
loading the installed Security module directly from that engine's `$PSHOME`.
The policy was unchanged; Backend reviewed the fix and independently passed the
affected 243 offline checks. A restricted-network `ENOTFOUND` was resolved by an
allowed narrow escalation of the same approved metadata command. Both sessions
then verified TLS and completed read-only catalog/settings inspection and cleanup.
The existing preflight mode has no database mutation operations.

Actual source checks match the sixteen-table/ten-sequence foundation; the
repository's proposed seventeenth location table is not an additional installed
application table. Runtime accounts remain absent. Setup owners have harmless
ADMIN-only membership without effective USAGE/SET; all four draft preconditions
already account for that distinction. `no_statement_logging:false` on both
projects does not establish credential-logging safety; its exact enum/provider
guarantee remains a separate gate. No password, SCRAM string or verifier has been
sent, and no source location migration, grants, credentials, fixture or runtime
activation occurred.

```powershell
node migrations/audit/execute-runtime-setup.mjs preflight
```

Approved executor: assigned DB Analyst/Developer. Targets: development source
`hbkooiknruimukkhshrk` and independent destination `ynygqodmtgjrngiudalw`, database
`postgres`, owner setup principal `postgres`, direct or session-pooler port 5432.
This is privileged connection access limited by the reviewed client to bounded
metadata reads. It does not technically turn the setup principal into a
non-privileged user.

Local read scope: four pinned draft SQL files, `shared/schema.ts`, selected
connection lines from existing ignored `.env.audit-setup.local` if present
(`AUDIT_SETUP_SOURCE_DATABASE_URL`, `AUDIT_SETUP_DESTINATION_DATABASE_URL`),
otherwise selected existing `.env` connection lines (`DATABASE_URL`,
`AUDIT_DATABASE_URL`), and their configured public CA certificate files. No private
values are printed, fingerprinted, passed as command arguments or copied to new
files. Other environment values are discarded by the selected-key parser.

The diagnostic runs `whoami.exe`, `git.exe check-ignore` and PowerShell ACL
**verification only** before reading a private file. A missing or ambiguous URI,
unprotected ACL, owner/identity mismatch, reparse point, unignored file or TLS
failure stops it. It does not fix ACLs, create a setup file, move credentials,
edit `.env`, alter trust stores or broaden approval. In particular, unknown current
`.env` ACLs might prevent the diagnostic; that is a reported prerequisite, not
permission to change them.

Both target/principal configurations are checked before either connection. TLS
uses chain verification and native hostname checks with the existing independently
pinned Supabase Root 2021 CA. If the destination URI has no CA path, this
setup-only diagnostic may reuse the verified source provider root **in memory**,
matching the previous setup report. An explicitly configured destination CA must
validate independently; it is never silently overridden. Runtime application and
worker URLs still need their own explicit verified CA configuration.

Each session starts with fixed read-only startup options and bounded timeouts.
Each target runs one BEGIN READ ONLY, fixed catalog/settings SELECTs and ROLLBACK.
No SET ROLE, grants, DDL, temporary tables, writes, sequence calls, application or
audit rows, probe function calls, credentials catalogs, startup hooks or APIs are
included. Destination inspection precedes source inspection; all created clients
close on success or failure. Output consists of fixed target labels and boolean
observations, repository counts, safe error codes and `activationReady:false`.

The observations cover PostgreSQL 17/UTF8/setup identity, role/schema-name
collisions, source table/sequence/RLS/owner/policy compatibility, basic audit
object/signature presence, inherited PUBLIC permanent CREATE rights, conditional
runtime attributes/memberships/ownership/base-table access, and selected visible
logging settings. Required owner membership, effective USAGE, SET and direct ADMIN
option are reported separately: CREATEROLE alone does not prove permission to
re-grant an existing owner role. Creator ADMIN-only membership is distinct from
effective ownership. `runtime_roles_present:false` means other negative-capability
observations are conditional on absent roles; they do not certify runtime accounts.

The diagnostic avoids privilege-sensitive qualified audit object lookup by using
pg_catalog namespace/class/procedure metadata. It does not borrow audit-owner
membership to inspect protected schemas. Qualified lookup can require schema
USAGE ([PostgreSQL 17 schema privileges](https://www.postgresql.org/docs/17/ddl-schemas.html#DDL-SCHEMAS-PRIV)).

This diagnostic does **not** prove applied migration row versions, full function
definition integrity, intended entry-point EXECUTE grants, application DML
compatibility, operational headroom, safe provider/external logging or runtime
readiness. Logging booleans are observations only; missing pgaudit visibility
remains unknown. No credentials may be provisioned on this evidence alone.

Recovery for this step: ROLLBACK and close both clients. No persisted database,
configuration or file changes should exist to reverse. Report a stopped stage
without raw driver messages, SQL parameters, private paths or connection objects.
Unexpected identity/permission/TLS state stops inspection rather than triggering
automatic repair. This approval authorizes this diagnostic only. Reuse it for the
unchanged command/targets once its private-file prerequisite is satisfied under
separate authorization; do not ask again for the same covered metadata inspection.

## Next concrete execution gate: disabled runtime installation

**Execution explicitly approved on 23 October 2026; partial committed result is
recorded below.** The user replied **“yes”** to the exact linked disabled-install request.
Approver: user; executor: assigned DB Analyst/Developer. Approval covers only the
fixed two pinned runtime scripts, fresh compatibility gates, destination-first
disabled-account installation and bounded verification/recovery documented here.
It excludes credentials/LOGIN, rehearsal, location work, startup and activation.
The previous approvals for selected settings/CA reads and protected `.env` remain
applicable. The user's existing Choice 1 also selected local preparation of these
sixteen-table runtime objects. The current source preflight matches that
foundation, so no location-feature migration or password/logging change is needed
to prepare this narrower step.

Exact command approved and attempted once (historical; **do not rerun**):

```powershell
node migrations/audit/execute-runtime-disabled.mjs apply-runtime-disabled
```

| Choice | Scope and tradeoff |
| --- | --- |
| **Recommended: install the selected runtime objects disabled** | Add the explicit restricted roles, memberships, sixteen-table app grants/policies, ten sequence USAGE grants and installation ledger versions. Every new runtime principal remains NOLOGIN with no password clause. This advances the selected audit boundary without activation or transmitting a new credential. Creates persistent roles/policies/grants and takes bounded catalog/table locks, so it needs database-mutation approval. |
| **Defer installation** | Keep the existing installed audit foundation and prepared runtime package unchanged. No new database objects/grants/policies, and operational hardening remains incomplete while provisioning/logging/rehearsal preparation continues. |

Requested executor: assigned DB Analyst/Developer. Exact development targets:
source `hbkooiknruimukkhshrk` and independent audit `ynygqodmtgjrngiudalw`, database
`postgres`, verified setup principal, direct/session-pooler port 5432. Read the
same protected selected setup connection settings and pinned public CA anchors
as the approved diagnostic; no private/configuration/ACL/file writes belong to
this operation. The destination-only provider-root reuse remains in memory.

Only these two new byte-pinned SQL files may execute, in this order:

| Order / file | SHA-256 |
| --- | --- |
| 1. `0003_destination_runtime.sql` | `28a8403d4145751e684c2b5f4965964c47587a3b09751fd20031058413ed7b53` |
| 2. `0003_source_runtime.sql` | `964cde32cb2dd43e308d7cfdf96b73f715d3112dd95dbc1b5ca4be3682c6d025` |

The separate executor has no arbitrary file/SQL/target input. It does not execute
0001/0002 or either rehearsal script. Existing applied setup files/executor remain
unchanged. New source objects: `fm_app_runtime`, `fmt_app_dev` (connection cap 5),
`fmt_audit_capture_dev` and `fmt_audit_worker_dev` (caps 2); destination:
`fmt_audit_writer_dev` (cap 2). All are restricted NOLOGIN roles. Source memberships
and exact table/DELETE/sequence masks remain those selected in the runtime
proposal; no seventeenth-table grant or tenant-isolating RLS claim is introduced.

### Fresh compatibility and post-install verification

Before any write, both targets must pass fresh read-only metadata gates, including
role/schema-name absence; PostgreSQL 17/UTF8/identity; setup direct owner ADMIN with
no effective owner USAGE/SET; PUBLIC DDL restrictions; all sixteen source tables,
ten sequences, RLS/ownership/policies; independent destination; and restricted
existing capture/delivery/monitor/writer groups. The source repository's known
seventeenth-table drift is reported and excludes application cutover, while the
exact sixteen-table installed source is required.

Additional fixed catalog checks compare function bodies, signatures, language,
volatility, strictness, SECURITY DEFINER flags, trusted search_path and restricted
owner attributes to pinned existing 0001/contract files. Comparisons return
booleans, not bodies or data. Owner membership rows/options/grantors are captured
as non-secret catalog metadata for exact later comparison; identities/rows are
not printed. Any compatibility failure stops before writing either project.

Each runtime SQL file owns one transaction. It explicitly requests READ WRITE
only for that approved migration, retaining five-second lock, sixty-second
statement and idle-transaction limits; ordinary diagnostic startup/read-only
mode is unchanged. The migration query gets a fixed 180-second client timeout
instead of the diagnostic's 15-second timeout. Timeouts still mean uncertain
outcome unless a deterministic pre-COMMIT statement failure is proved.

Within each transaction, temporary owner SET access uses an explicit current-user
grantor. Transaction-local metadata snapshots preserve every pre-existing
membership row/option/grantor, including the actual creator ADMIN-only baseline.
Cleanup restores only an altered self-grantor row or revokes only a newly added
self-grantor row, then asserts exact before/after catalog equality and no effective
USAGE/SET. No blanket removal of the pre-existing maintenance membership is used.

Each script checks the installed `source-0001`/`destination-0001` ledger entry and
inserts its own runtime version. A fixed boolean SELECT of **migration ledger
metadata only**, while already in that script's owner context, must return true;
the final command must also be COMMIT. The receipt is not an audit/business-row
read. No protected ledger access is added outside the existing transaction.

After destination COMMIT, read-only catalog verification must pass before source
starts. After source COMMIT, the same bounded verification checks exact disabled
attributes/caps, intended memberships with ADMIN false, no unexpected incoming
delegation, no ownership/permanent DDL, correct table/column DELETE masks, ten
USAGE-only sequences, required-only audit entrypoints, sixteen policies and
unchanged setup-owner memberships. Effective inherited/direct WITH GRANT OPTION
rights on schemas, tables, columns, sequences, functions and the database are
explicitly rejected; no future-object grants are permitted. No test login or
rehearsal namespace may have been installed. Password catalogs are not read:
NOLOGIN is verified; absence of password provisioning follows the fixed reviewed
CREATE ROLE statements without password clauses.

### Failure handling, exclusions and evidence

Both target preflights finish before any migration. Destination commits and is
verified first; source is untouched if that fails. There is no distributed
transaction or automatic destructive rollback across the projects. On a known
pre-COMMIT statement error, the failed local transaction is rolled back. On
transport failure, timeout/cancellation, SQLSTATE 40003 or an unrecognized outcome,
the helper preserves **uncertain** even after attempting ROLLBACK; it does not
blindly retry. A confirmed COMMIT remains **committed** if its receipt or later
verification fails. Preserve disabled objects and all evidence for bounded
read-only reconciliation; do not DROP roles/policies, restore owner runtime URLs,
broaden grants or reapply after uncertain outcomes without review.

The helper closes every created client and emits safe stages, target labels,
hashes, booleans and per-target commit states only. It keeps `loginsEnabled:false`,
`passwordsProvisioned:false` and `applicationCutover:false`. This approval would
not cover passwords/SCRAM/verifiers, logging changes, LOGIN, private-file handoff,
RLS changes beyond the sixteen scoped policies, location migration/grants, data
fixtures, rehearsal/maintenance calls, real Auth/business/session paths, startup,
deployment, activation, backup/restore, reader/export bindings or production.

Executed offline after preparing the package:

```powershell
node migrations/audit/execute-runtime-disabled.mjs offline
node scripts/test-audit-runtime-install.mjs offline
node --import tsx scripts/test-audit-db.mjs offline
node migrations/audit/execute-runtime-setup.mjs offline
```

Results: **238 disabled-install driver/boundary checks** and **243 existing
offline checks passed**; both manifest/offline commands passed. Tests exercise
fresh-before-any-write order, destination-first verification, exact fixed script
selection, receipt/COMMIT requirements, per-query timeout, failure/close lifecycle,
guarded pre-COMMIT rollback, destination/source cancellation and transport
ambiguity, committed-destination/uncertain-source preservation, safe error output,
unsupported modes and inert imports. Backend independently reviewed and passed
the 238 new checks. These are synthetic driver/static tests, not live PostgreSQL
syntax, catalog/grantor-semantics or ACL evidence. No installation SQL was run
during that offline preparation; subsequent approved execution follows.

### Actual approved attempt and bounded reconciliation

The assigned DB Analyst executed the exact command above once using narrow
network escalation (allowed by automatic review). Both fresh compatibility
preflights passed **before either write**. The destination returned the pinned
runtime-version receipt and final COMMIT; post-install verification then rejected
two permission booleans. The process exited 1 and source was never attempted:

```json
{"stage":"install-preflight","target":"destination","status":"passed"}
{"stage":"install-preflight","target":"source","status":"passed"}
{"stage":"verification","target":"destination","status":"stopped","code":"INSTALLED_RUNTIME_VERIFICATION_REJECTED","commits":{"destination":"committed","source":"not-attempted"}}
```

Repeated **only the reviewed fixed destination catalog verification** within the
approved read-only recovery scope. All eight role-state booleans passed,
including restricted NOLOGIN/caps/attributes, exact memberships, no unexpected
delegation/ownership/DDL/future grants and no rehearsal. Required audit
entrypoints, absence of extra audit entrypoints/geocoding maintenance, both
sequence checks and all six grant-option negatives passed. The two false values
were `no_extra_relation_privileges` and `no_extra_column_privileges`;
`required_relation_privileges` was true. No passwords were provisioned by the
fixed SQL. Exact owner-membership restoration was asserted inside the committed
SQL transaction; that is not a new independent comparison to the lost
transaction-local before snapshot.

The parent and Back End Developer reviewed the separate bounded metadata helper
before its approved read-only recovery execution. It targets only destination
`ynygqodmtgjrngiudalw` and `fmt_audit_writer_dev`, reuses the protected loader/TLS,
and permits at most 64 relation and 256 column metadata rows. No application/audit
table or view rows, password catalogs or function bodies are read by that ACL
drilldown; no application functions are called or writes performed.
Initial relation results identify exactly:

| Relation | Kind / owner | Effective ACL | Provenance | Schema USAGE | Grant option |
| --- | --- | --- | --- | --- | --- |
| `extensions.pg_stat_statements` | view / `postgres` | SELECT | PUBLIC, grantor `postgres` | false | false |
| `extensions.pg_stat_statements_info` | view / `postgres` | SELECT | PUBLIC, grantor `postgres` | false | false |

These are latent PUBLIC relation ACLs; the writer lacks the schema USAGE needed
to access them. The strict installed verifier nevertheless rejects any extra
effective relation/column privilege. Neither this observation nor inaccessible
schema status automatically accepts that drift. No view was queried.
The first column inventory stopped with SQLSTATE 22023: the diagnostic had
synthesized a zero-dimensional empty ACL array for NULL column ACLs. A local
one-line correction passes the actual NULL to strict `aclexplode`, preserving
zero explicit column grants. Backend reviewed the correction and Node syntax
passed. The same approved bounded read-only diagnostic then exited **0**:
two relation ACL rows and **51 column SELECT observations** (49 on
`pg_stat_statements`, two on `pg_stat_statements_info`). Every column observation
has `via_relation_privilege:true`, `origin:"relation-level"` and
`schema_usage:false`; none identifies an additional direct/inherited/PUBLIC
column ACL. All eight disabled-role checks remained true. Both diagnostic
attempts used READ ONLY, ROLLBACK and client closure. No data or recovery mutation
occurred. PostgreSQL's [ACL implementation](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/adt/acl.c)
requires one-dimensional ACL arrays; [catalog entry](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/include/catalog/pg_proc.dat)
and [strict default](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/include/catalog/pg_proc.h)
establish the NULL behavior. No applied SQL or verifier acceptance changed.

**Recovery:** retain the committed disabled destination role/ledger and immutable
0003 bytes; keep source untouched, flags false and the protected private-file
backup. Do not rerun fresh installation, DROP/revoke provider rights, grant
`extensions` USAGE, provision credentials or infer a distributed rollback. The
current executor intentionally rejects existing runtime names and is not a
continuation command. Further work needs the explicit choice below and a
separately reviewed continuation that verifies the existing committed destination
rather than bypassing its collision gate.

### Owner technical correction and prepared source-only continuation

Under the updated standing authorization, the assigned DB owner assessed the
failure as a routine verifier compatibility defect: raw table ACLs were being
classified as usable data access despite missing schema USAGE. Backend and root
concurred. The selected usable-access boundary is unchanged; no new user security
choice is inferred merely to correct this local defect. A general extensions
exclusion or accepting accessible extra relations would change that boundary and
is excluded.

The local classifier now permits **only** the two exact named `extensions` views,
owned by `postgres`, for the five already selected runtime/group names, only
PUBLIC SELECT granted by `postgres`, no grant option, no additional applicable
ACL provenance, no applicable explicit column ACL and schema USAGE **false**.
All predicates occur in the same relation/column classification statement. Any
other relation/right, owner/grantor/provenance, applicable column ACL or newly
available schema USAGE fails closed. Destination continuation additionally
requires the exact two-view baseline to exist and pass. Source uses the same
strict guard only if that precise inaccessible baseline is present; source
provider state is not assumed from destination evidence. Output names now say
`no_unreviewed_relation_privileges`/`no_unreviewed_column_privileges`; the report
explicitly acknowledges latent PUBLIC ACLs and never claims raw ACL absence.

The source-only command prepared for root review is:

```powershell
node migrations/audit/continue-runtime-source.mjs continue-source-disabled
```

It uses the same approved private loader, TLS anchors, projects and setup
principal. It has no destination migration/reapply/repair path. First it freshly
checks installed destination identity, exact restricted roles/caps/memberships,
base group/function hashes, inert owner ADMIN and all relation/column/sequence/
entrypoint/grant-option restrictions including the exact inaccessible baseline.
Destination version evidence is the **historical confirmed receipt and COMMIT**,
not a fresh protected-ledger read or borrowed owner access. Then source must pass
fresh original compatibility gates and an additional catalog-only prewrite
check of inherited base groups/PUBLIC: the two provider views must not be usable,
and `public.purge_expired_geocoding` must not confer effective EXECUTE. No function
is called. A predicted privilege failure stops before the source SQL.

Only the unchanged pinned `0003_source_runtime.sql` may then execute, once,
retaining original transaction/timeouts, version receipt/final COMMIT and exact
owner-membership restoration. Postflight verifies source restrictions and scoped
policies. Source timeout/cancellation/transport/40003 remains uncertain; rollback
does not manufacture proof of no COMMIT. A confirmed source COMMIT remains
committed on bad receipt/postflight failure. No blind retry or cross-project
destructive recovery is provided. Both clients close; destination remains
committed regardless of source outcome. Preserve disabled objects/evidence on
every stopped path.

Local checks: `node scripts/test-audit-source-continuation.mjs offline` passed
**186** focused synthetic checks; affected existing install runner passed **242**
(previous 238 is historical); Node syntax and scoped whitespace checks passed.
The checks cover destination drift before any write, inherited-access failure,
source-only ordering, receipt/commit, deterministic rollback and ambiguous
outcomes, cleanup, unsupported modes and inert/private-I/O-free imports. They do
not prove PostgreSQL syntax or fresh live ACL state. Existing diagnostic evidence
remains 243 offline checks; no unrelated application/locale tests were rerun.

Backend independently reran the focused 186 checks, affected 242 checks and
continuation offline command, and accepted the exact SQL guard. Offline checks
do not dynamically mutate PostgreSQL objects/schema/provenance; independent
static SQL review and fresh approved live verification are the corresponding
evidence. No production SQL engine/classifier was simulated.

**Root go recorded before execution, 23 October:** root reviewed the full
continuation and tests, accepted the same usable-access boundary, and authorized
reuse of the user's original named-target source operation approval for one
first attempt of unchanged source SQL. No destination write or fresh-install
retry was authorized. A connection failure before writes may use narrow network
escalation; an attempted/uncertain/committed source outcome must never be retried.
No source operation occurred during preparation. Credentials/
logging, private handoff, activation, location schema/grants and connected
rehearsal remain separate incomplete gates. Revoking provider PUBLIC privileges
or granting schema USAGE is neither needed nor authorized by this correction.

### Actual source-only continuation result

The exact continuation first stopped with `ENOTFOUND` during destination
connection, **before any source attempt**. The approved narrow network retry was
allowed by automatic review. It freshly verified destination successfully,
including the exact inaccessible PUBLIC-view baseline and all role/relation/
column/sequence/entrypoint/grant-option checks; base functions/groups and inert
owner metadata also passed. Source fresh compatibility and the inherited-access
prewrite checks passed. The unchanged pinned source script then returned the
runtime-version receipt and final COMMIT. Source verification stopped the process
(exit 1):

```json
{"stage":"source-preflight","target":"source","status":"passed","commits":{"destination":"committed","source":"not-attempted"}}
{"stage":"source-verification","target":"source","status":"stopped","code":"INSTALLED_RUNTIME_VERIFICATION_REJECTED","commits":{"destination":"committed","source":"committed"},"destinationWrites":false}
```

There was **one source migration attempt**, no destination write, credential
provisioning or activation. The source SQL's exact owner-restoration assertion
passed within the committed transaction; no later comparison to a lost before
snapshot is claimed. Both applied 0003 files and their pinned hashes are now
immutable, including historical preparation headers.

Repeated only the reviewed fixed source postflight queries in an approved
READ ONLY recovery transaction (exit 0, ROLLBACK/close). All eight runtime-role
checks passed: all four roles exist, NOLOGIN/restricted attributes and expected
caps/memberships, no ownership/permanent DDL/unexpected delegation/future grants
or rehearsal. Required relation privileges and all ten required sequence USAGE
rights passed. Required-only audit entrypoints, no geocoding maintenance EXECUTE,
all six grant-option negatives and all sixteen scoped policies passed. Remaining
false booleans are:

- `no_unreviewed_relation_privileges`
- `no_unreviewed_column_privileges`
- `no_extra_sequence_privileges`

The separately root/Backend-reviewed fixed source drilldown then executed once
within read-only recovery (exit 0, ROLLBACK/close). Its sequence default ACL kind
was corrected to PostgreSQL's lowercase `s` before execution. It found only the
following latent PUBLIC ACLs, the same for each of `fm_app_runtime`, `fmt_app_dev`,
`fmt_audit_capture_dev` and `fmt_audit_worker_dev`:

| Exact object | Kind | ACL mask | Owner / grantor | Schema USAGE | Grant option |
| --- | --- | --- | --- | --- | --- |
| `cron.job` | table | SELECT | `supabase_admin` | false | false |
| `cron.job_run_details` | table | SELECT, DELETE | `supabase_admin` | false | false |
| `cron.jobid_seq` | sequence | SELECT | `supabase_admin` | false | false |
| `cron.runid_seq` | sequence | SELECT | `supabase_admin` | false | false |

The catalog returned **12 relation ACL rows**, **76 column SELECT observations**
(19 per role, all whole-relation-derived, no applicable separate column ACL) and
**8 sequence ACL rows**. No other mismatch was found, no application/audit rows or
sequence values were read, no application functions were called, and all eight
restricted-role booleans still
passed. None of the roles has the schema USAGE required to use these rights.

DB owner, Backend and root assessed the same routine raw-ACL-versus-usable-access
defect. Under standing authorization the local verifier now recognizes only
these **source-only four-role, four-object** masks, exact table/sequence kinds,
owner/grantor `supabase_admin`, PUBLIC provenance, no WGO, no applicable column
ACL and no schema USAGE. Exact baseline checks require eight role/table and eight
role/sequence matches. Every other right/provenance/owner/schema-access change
still fails, and the earlier exact extensions guard is preserved. No general
`cron` ignore, privilege change, executable cron access or extra role was added.
Sequence output now says `no_unreviewed_sequence_privileges`; raw ACL absence
is not claimed.

Final read-only command, **root go recorded before execution**:

```powershell
node migrations/audit/verify-runtime-disabled.mjs
```

It reuses the existing private/TLS and catalog lifecycle, verifies destination
then source roles/groups/functions/owner ADMIN, exact latent baselines and all
remaining privilege/policy checks, and closes clients on every path. Both
version receipts/COMMITS remain historical proof; no fresh protected-ledger read
is made. There is no migration/file/SQL input, source/destination write, repair,
LOGIN/credential or activation mode. Focused continuation/verification checks
now pass **264**, affected install checks **246**; prior counts are historical.
Node syntax and scoped whitespace checks pass. SQL predicates have independent
static review and refusal/lifecycle tests, not a simulated SQL engine or dynamic
mutated-object/provenance coverage. The final live verification result follows.

Root independently reviewed the final exact cron predicates, installed-source
profile and restrictive-policy check after Backend accepted and reran 264/246.
Root authorized the fixed command above under the existing named-pair bounded
read-only recovery approval. It permits no migration/grant/role/LOGIN/password
write; narrow networking only uses the unchanged reviewed command.

### Final actual disabled-runtime verification — passed

Executed the exact final read-only command once with narrow network escalation
(automatic review allowed); exit **0**. Complete safe helper snapshots:

```json
{"stage":"committed-disabled-runtime-verification","target":"destination","status":"verified","checks":{"roles":{"all_runtime_roles_present":true,"all_disabled_restricted":true,"no_runtime_ownership_or_ddl":true,"no_unexpected_memberships":true,"required_memberships_present":true,"no_unexpected_runtime_delegation":true,"no_future_object_grants":true,"rehearsal_not_installed":true},"inaccessibleProviderBaseline":{"exact_inaccessible_provider_baseline":true},"relations":{"required_relation_privileges":true,"no_unreviewed_relation_privileges":true,"no_unreviewed_column_privileges":true},"sequences":{"no_unreviewed_sequence_privileges":true,"required_sequence_usage":true},"entrypoints":{"required_entrypoints":true,"no_extra_audit_entrypoints":true,"no_geocoding_maintenance":true},"grantOptions":{"no_schema_grant_options":true,"no_relation_grant_options":true,"no_column_grant_options":true,"no_sequence_grant_options":true,"no_function_grant_options":true,"no_database_grant_options":true},"ownerMembershipsPreserved":true},"versionEvidence":"historical-confirmed-version-receipt-and-COMMIT","freshLedgerRead":false,"latentProviderAcl":"two-exact-inaccessible-PUBLIC-SELECT-views","file":"0003_destination_runtime.sql","sha256":"28a8403d4145751e684c2b5f4965964c47587a3b09751fd20031058413ed7b53","databaseWrites":false,"loginsEnabled":false,"passwordsProvisioned":false,"applicationCutover":false}
{"stage":"committed-disabled-runtime-verification","target":"source","status":"verified","checks":{"roles":{"all_runtime_roles_present":true,"all_disabled_restricted":true,"no_runtime_ownership_or_ddl":true,"no_unexpected_memberships":true,"required_memberships_present":true,"no_unexpected_runtime_delegation":true,"no_future_object_grants":true,"rehearsal_not_installed":true},"inaccessibleCronBaseline":{"exact_inaccessible_cron_relations":true,"exact_inaccessible_cron_sequences":true},"relations":{"required_relation_privileges":true,"no_unreviewed_relation_privileges":true,"no_unreviewed_column_privileges":true},"sequences":{"no_unreviewed_sequence_privileges":true,"required_sequence_usage":true},"entrypoints":{"required_entrypoints":true,"no_extra_audit_entrypoints":true,"no_geocoding_maintenance":true},"grantOptions":{"no_schema_grant_options":true,"no_relation_grant_options":true,"no_column_grant_options":true,"no_sequence_grant_options":true,"no_function_grant_options":true,"no_database_grant_options":true},"policyCompatibility":{"no_restrictive_application_policies":true},"policies":{"exact_runtime_policies":true},"ownerMembershipsPreserved":true},"versionEvidence":"historical-confirmed-version-receipt-and-COMMIT","freshLedgerRead":false,"latentProviderAcl":"exact-inaccessible-cron-tables-and-sequences; exact-provider-view-rule-also-enforced","file":"0003_source_runtime.sql","sha256":"964cde32cb2dd43e308d7cfdf96b73f715d3112dd95dbc1b5ca4be3682c6d025","databaseWrites":false,"loginsEnabled":false,"passwordsProvisioned":false,"applicationCutover":false}
```

Both sessions used fixed read-only transactions, ROLLBACK and client closure.
No application/audit rows or sequence values were read, and no function bodies
were output; catalog definitions were compared privately to pinned contracts.
No repair or mutation was included in this verification. Version installation is
proved by the earlier script receipts and
COMMITS; these are fresh catalog observations of roles, functions and effective
access. `ownerMembershipsPreserved` compares the inert owner metadata across this
read-only check; the migration's original before/after equality was separately
asserted inside each committed script. Raw PUBLIC ACL absence is not asserted:
the exact inaccessible provider baselines remain explicitly reported.

**Completed state:** both selected sixteen-table runtime installations are
committed and verified **disabled**. Preserve their immutable SQL/digests and
the current-user-only `.env` plus protected ignored SDDL recovery record. There
is nothing to reapply or repair. No new credentials/LOGIN, fixture, rehearsal,
Auth/business/session call, startup, cutover, deployment or activation occurred.

**Next work:** finish safe logging/provider credential guarantees and the
byte-preserving protected multi-file provisioning/recovery plan before any
password/verifier is sent. Then prepare scoped activation and genuine connected
rehearsal evidence. Existing exact logging booleans are insufficient; no new
logging/provider query or mutation is authorized by this verification. The
TASK-026 location package has a separately selected **local preparation** scope;
it does not authorize connected location schema/grant writes or expand this
applied sixteen-table manifest. Task 014 remains open.

Installed source verification deliberately requires the original pre-install
`app_policy_compatible` collision observation to be **false** after the sixteen
`fmt_app_server` policies exist; all other schema flags must remain true. A
separate fixed catalog check rejects **any restrictive policy** on those selected
tables, and the exact sixteen-policy role/predicate/command contract still must
pass. Focused regressions reject a wrong installed profile, any other false
schema flag, a restrictive policy or wrong installed policy contract. The policy
observation is not silently ignored.

Preserve both committed disabled installations and immutable SQL. No migration
retry, ACL repair, grant expansion, DROP/revoke or activation follows from these
observations. Logging/provisioning/connected rehearsal and location rollout
remain separate incomplete work; frontend may continue its isolated/mock work.

## Known source compatibility drift: separate location-feature scope

Repository evidence now declares **seventeen tables**: the selected grant manifest
has sixteen, and `user_search_locations` is new. The approved metadata preflight
found only the sixteen selected ordinary/partitioned application tables, so the
new location table must not be treated as installed.
`server/searchLocations.ts` reads, upserts and deletes this table; migration 0009
defines `user_id` as a varchar primary key referencing users. **It has no sequence.**
Applied 0003 deliberately does not extend the selected grants, and rejected
an unreviewed live source table. An application credential cutover is not ready.
Read-only diagnostic approval does not select connected location work. The later
TASK-026 local preparation selection is separate and does not authorize live
location installation/grants or change this applied manifest.

| Later choice | Effect and tradeoff |
| --- | --- |
| **Recommended current foundation: retain the selected sixteen-table scope** | Continue the disabled-runtime installation proposal above and independent worker/capture preparation. Hold application activation until repository/deployed-feature compatibility is resolved. This does not require installing the unrelated location feature and does not claim full runtime hardening. |
| **Separate location-feature amendment when its rollout is selected** | After a specific user choice, prepare explicit SELECT, INSERT, UPDATE, DELETE on `public.user_search_locations` for `fm_app_runtime` and its scoped server policy. No sequence grant, ownership, DDL, BYPASSRLS or direct client access. The currently absent table/migration also needs that feature's own named-target approval. Tenant authorization remains in Express; this is not tenant-isolating RLS. |

Neither grant extension nor a feature rollback was implemented by this package.
The separate selected TASK-026 local dependency can proceed under its owner;
connected location execution still needs its exact scoped approval.

## Historical remaining deliverables before completion authorization

The following list records the earlier disabled-only preparation boundary. The
final development result above records its subsequently completed deliverables.
The disabled-only package was a separate concrete gate. It did not complete
the following provisioning/activation/rehearsal work, which still needs appropriate
review and scoped approvals:

1. Retain the verified sixteen-table baseline and inert owner-administration
   capabilities; reconcile any later feature rollout separately. Preserve all
   applied SQL. Future corrections need new versions and scoped execution, with
   bounded locks/timeouts and no broad privilege repair.
2. Complete byte-preserving owner-secret relocation, protected recoverable backup,
   multi-file failure handling, independently generated passwords, provider and
   session password-statement/parameter logging checks, initially disabled accounts,
   and enablement only after private persistence/grants/verification. Current
   `replaceSettings`/private-write primitives do not constitute that workflow.
   Do not print or report passwords, URLs or verifier material. Do not restore an
   owner URL into runtime automatically on failure. App/worker flags stay false.
3. Implement connected rollback/cohort adapters for the actual installed audit
   APIs. `scripts/test-audit-db.mjs` currently implements **offline only**; it has
   no connected rehearsal command. Verify rollback visibility/enqueue abort,
   expired/invalid inputs, effective permissions, genuine concurrent claims, real
   30-second lease recovery, destination commit before missing source ack,
   unchanged first receipt, conflict evidence, injected transport outage/catchup,
   retention/maintenance boundaries and payload-free health counts.
4. Resolve rehearsal-owner design before mutation approval: existing drafts use
   `audit_rehearsal` owned by each installed audit owner, rather than the proposal's
   separately named test-owner design. Test logins receive only fixed cohort
   helpers. Neither draft is execution-approved. Review least privilege and exact
   owner-only rollback fixtures; do not describe this draft choice as deployed.
5. Enforce the twelve explicit IDs and fixed run ID from `runtime-contract.mjs`.
   Confirm all twelve IDs absent on **both** projects before seeding, including
   previously delivered rows; queue count checks alone are insufficient. Actual
   claims have no ID filter: require an approved exclusive producer/worker window,
   zero unrelated pending/leased/quarantined events and drift stops before claims.
   Never drain a real backlog. At most twelve marked anonymous synthetic S events
   may commit; retain P1 evidence and manifest provenance, not early deletion.
6. Implement cleanup which disables the temporary login and revokes temporary
   probe access while preserving committed manifests/evidence. Do not drop or erase
   audit history. Unexpected/undelivered/quarantined records remain incomplete and
   require a scoped recovery plan for those exact IDs. No broad DELETE/TRUNCATE,
   production, deployment, real Auth/session/business writes, cron, backup/restore
   or provider outage manipulation belongs to this rehearsal.

Final mutation approval must name the chosen grant scope, executor, targets,
versioned SQL/command hashes, private files, role/grant/probe operations, fixture
limits, validation and recovery. Destination writer setup precedes source
bindings; runtime activation remains disabled until required checks pass. Partial
failure preserves evidence and disables affected new logins; failed local grant
transactions roll back. Do not automatically broaden privileges to pass tests.

No language/resource/browser matrix ran for this database-only preparation.
Future language verification is limited to en/lv/ru. ar/RTL, zh, fr, de, hi, ja,
pt and es remain deferred; historical coverage is preserved.

Version-sensitive review references: [PostgreSQL 17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html),
[role attributes](https://www.postgresql.org/docs/17/role-attributes.html),
[ALTER ROLE](https://www.postgresql.org/docs/17/sql-alterrole.html) and
[startup message options/replication](https://www.postgresql.org/docs/17/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE).
These support review of prepared behavior; they do not establish live compatibility.
