# Backend audit capture and worker handoff

Later narrow producer request: [one explicit service-details event](service-view-audit-handoff.md)
adds a local twelve-name registry and `service.viewed.v1` R90 contract. Its DB
forward migration and frontend callback are separate sequential dependencies;
the earlier eleven-event infrastructure evidence below remains historical.

Latest completion work, 23 October 2026: the user's broad TASK-014 completion
authorization supersedes the earlier phase-specific execution holds below for
necessary operations on the fixed development pair. DB remains the executor for
private configuration, credentials, SQL and connected rehearsals. Both runtime
0003 installations and the source-only 0009 location dependency are committed
and catalog-verified; the applied SQL is immutable. See the
[completion execution record](audit-completion-execution.md) for current connected
state. Historical paragraphs below describe the evidence available at that time.

Prepared 19 October 2026; final local checks 20 October 2026 by the assigned Back End Developer. Local implementation
for TASK-014 and an initial TASK-015 subset under the user's request to proceed,
selected C/R1/P1/failure behavior, and General Manager's scoped assignment.
This is **not activation or full audit coverage**. No backend agent database/service
connection, credential read/change, application startup, live Auth call, worker
activation, SQL execution or deployment occurred during this implementation.
DB execution evidence belongs to the DB Analyst's separate reports.

## Implementation and ownership

New modules in `server/audit/`:

- `capture.ts`: validates immutable prepared events; parameterized enqueue using
  the caller's existing pg/Drizzle transaction; separate transaction for independent
  failure/denial capture. Errors are replaced by safe 503-class errors, with a
  fixed capture-gap signal; no driver cause/query/parameters escape.
- `config.ts`: explicit development label, fixed source/destination references and
  exact restricted login names; direct/session connections only; rejects arbitrary
  connection-string query overrides and TLS downgrade options.
- `runtime.ts`: explicit lazy factories, strict TLS/SNI/hostname verification and
  optional per-URI public CA; no `connectionString` passed to pg. Server-side role
  checks reject owner/superuser/BYPASSRLS/create-role/create-database/base-table
  access and extra application-role memberships. Source worker monitor membership
  is allowed. No pool or connection is created merely by importing this module.
- `worker.ts`: injected committed-operation ports, bounded claims, canonical/hash
  validation, remaining-lease checks, timeouts, stable-ID retries with bounded
  exponential jitter, stale-CAS accounting, poison/conflict/expiry/configuration
  quarantine, cancellation and safe health counters.
- `http.ts`: server-generated request/operation correlation, profile-confirmed
  personal role snapshots, dormant capture sink, awaited denial capture that never
  grants access on failure, and a source availability/privilege probe.
- `run-worker.ts`: explicit separate process; never imported from server startup.

Existing BE-14A `canonical.ts`, `context.ts`, `events.ts` remain the contract.
The registry supports eleven names: auth login, OAuth start/callback, session
establishment, logout, password changes; central denial; account details/persona;
company membership/ownership changes. Registry support does not imply producers.

Changed application files: `server/auth.ts`, `server/password.ts`,
`server/appAdmin.ts`, `server/routes.ts`, `server/storage.ts`, `server/index.ts`.
Changed configuration examples/commands: `.env.example`, `package.json`.
New tests: `scripts/test-audit-worker.mjs`, `scripts/test-audit-auth.mjs`.
No frontend, shared schema, SQL, Drizzle configuration, existing test assertions,
private environment or other agents' documentation was edited by this work.

## Actually instrumented paths

| Path | Implemented behavior and limits |
| --- | --- |
| Password login | Input rejection and credential/provider rejection; verified login success and separately confirmed local session establishment. Source readiness checked before remote call. Profile upsert/company conversion are not audited atomically by this hook. |
| OAuth | Successful start, selected disabled/invalid start failures, callback rejection and verified callback/session success. No provider URL/code/verifier copied into events. Provider-specific details and correlation across separate redirect requests remain absent. |
| Logout | When remote identity and personal role can be confirmed, captures local-session completion and distinguishes a known provider revocation error from combined success. Missing/unavailable attribution produces a gap while still destroying the local session; enabled unexpected failures are sanitized. Provider interruption/reconciliation remains incomplete. |
| Password change | Checks known source availability before remote verification/update. Captures verification rejection, known provider failure, successful password write before later session restoration, or uncertain update. Confirmed password success followed by capture failure clears local session and reports that the password was saved; it never fabricates a provider rollback. |
| Access denials | Same-origin gate, actual auth rate limiter, unauthenticated/expired session decisions and application-support denials. Capture failure still denies access and emits a fixed gap signal. Company/object/employee-specific denial paths elsewhere are not comprehensively instrumented. |
| Personal persona change | `PATCH /api/users/role` → real `DatabaseStorage.updateUserRole` optional audit branch: lock user, validate actor, update and enqueue on the same Drizzle transaction. Actual before/after and action-time persona come from the locked row; no-op explicitly uses NO_CHANGE. Enqueue failure rolls back and returns 503. |

Signup/recovery/invitation/account-name/company-membership/ownership event producers,
session refresh/revocation history, sensitive-read/viewer/export capture, all other
business mutations, provider log ingestion and direct SQL/job sources remain
pending. Shared session-establishment capture can observe a confirmed session
created by an otherwise uninstrumented flow; it does not claim coverage of that
flow's signup/recovery/invitation mutation. No generic success logger was added.

## Remote Auth activation gate

The source probe checks connectivity and current enqueue-role capability; it is
**not a durable intent event or a cross-service transaction**. A source outage
after that probe, an application crash, profile/provisioning failure, or source
capture failure after a provider commit can still leave an unaudited remote Auth
mutation. Tests explicitly reproduce a successful remote password change followed
by capture failure. The password remains changed; no false failure/rollback event
is recorded. Logout and provider-created sessions also cross this boundary.

The eleven-event contract has no durable-intent/reconciliation event family, and
this package does not pretend otherwise. General app capture activation remains
gated on a reviewed intent/provider-reconciliation design and the required policy
decision for remaining remote uncertainty. It does not satisfy universal
fail-closed mutation capture or complete TASK-015. Do not enable the app flag based
only on the tests below. Supported local persona changes do have an atomic outbox
boundary; other business writers still need TASK-016 instrumentation.

## Worker/runtime interface

`createCaptureRuntime(env)` returns `{capture(prepared), ready(), close()}`.
`createWorkerRuntime(env)` returns `{ports, close()}`.
`createAuditWorker(ports, options?, dependencies?)` returns
`{step(signal), health(signal), snapshot(), pollMs}`.

Both runtime factories reject absent explicit enablement. Configuration is
development-only for source `hbkooiknruimukkhshrk`, destination
`ynygqodmtgjrngiudalw`, and restricted users `fmt_audit_capture_dev`,
`fmt_audit_worker_dev`, `fmt_audit_writer_dev` (session-pooler username includes
the matching reference). Each URI must supply its own CA path if ordinary trust
does not validate the certificate. No owner or automatic source-CA fallback is
used by runtime code. Source worker needs delivery and monitor groups; destination
writer has accept-only authority. Test-only sink injection is not an HTTP API.

Defaults: app `AUDIT_ENABLED=false`; worker `AUDIT_WORKER_ENABLED=false`;
`AUDIT_ENVIRONMENT=development`. App config contains restricted app DATABASE_URL
and AUDIT_CAPTURE_DATABASE_URL only. Worker-only ignored private file contains
AUDIT_SOURCE_DATABASE_URL/AUDIT_DATABASE_URL and its explicit flags. Setup-owner
credentials must not be available to either runtime.

After the separately approved credential handoff, database behavioral validation
and activation gates, the explicit worker command is:

```powershell
npm run audit:worker
```

This expands to `node --env-file=.env.audit-worker.local --import tsx
server/audit/run-worker.ts`. With the prepared false flag it refuses startup;
this command was **not run**. An approved bounded synthetic DB harness may inject
enabled worker configuration in memory without enabling the application.

Claim defaults: batch 10, remote deadline 5 seconds, poll 1 second. Before each
delivery the worker checks remaining 30-second lease headroom; short leases are
rescheduled, stale tokens never count as success. Abort/timeouts destroy the
runtime connection; destination commit may nevertheless have happened. Replays
keep UUID/hash and are safe through destination matching. Only committed
inserted/matching acceptance permits acknowledgment. Conflict/expired dispositions
are committed remotely, then quarantined locally. Transient retries are bounded
per delay (1–300 seconds), not silently dropped after an arbitrary attempt count.

Health reports counters/backlog age/quarantine/expiry; attention starts at a
five-minute backlog or any quarantined/expired row. CI/CD still owns real alert
routing, process supervision and clock/capacity budgets. Worker has no retention,
replay, maintenance, export or application-write privileges. Full outage,
concurrency, role, restore and practical-load proofs require the DB rehearsal.

## Verification performed

Installed tooling: Node v24.21.0, TypeScript 5.6.3, existing tsx/Zod/Drizzle/pg;
no install, upgrade or shim. Inspected package/lifecycle scripts and import chains.
Pure contract/worker tests use built-ins, validation/query builders and injected
executors; no server/database/config initialization. Enabled handler tests redirect
dotenv before imports, use synthetic UUIDs/credentials and mocked Auth HTTP,
sessions and database adapters; an unlistened route fixture exercises actual
route/storage behavior. No `server/index.ts` startup was executed.

| Command | Result |
| --- | --- |
| `node --experimental-strip-types scripts/test-audit-events.mjs` | Passed: eleven contracts, 105 rejected invalid inputs, immutability/canonical hash/redaction/expiry. |
| `node --experimental-strip-types scripts/test-audit-worker.mjs` | Passed: caller-transaction enqueue/rollback, independent capture, restricted config and actual runtime-role policy, outage/timeout/crash-after-destination-commit matching, stale CAS, quarantine, lease headroom, cancellation and metrics. Expected injected failures emit only fixed safe gap markers. |
| `node --import tsx scripts/test-audit-auth.mjs` | Passed: enabled real auth/password/access handlers, real rate limiter, unavailable profile/role, source-readiness gate, remote-success/local-failure, canary-secret protection; real persona storage branch lock/update/enqueue, rollback503, actual differences, no-op and actor mismatch. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Passed; includes all new backend TypeScript without writing incremental cache. |
| `node --import tsx scripts/test-social-auth.mjs` | Passed, including rerun after OAuth hook changes. |
| `node --import tsx scripts/test-password-update.mjs` | Passed. |
| `node --import tsx scripts/test-account-details.mjs` | Passed. |
| `node --import tsx scripts/test-administration.mjs` | Passed. |

Unchanged mixed frontend/backend suites were explicitly approved by the assigned
Front End Developer in [regression approval](audit-frontend-regression-approval.md).
Every mixed suite ran in a fresh process with:

```powershell
$auditNoEnv = Join-Path (Get-Location) '.audit-unit-no-env'
if (Test-Path -LiteralPath $auditNoEnv) { throw 'Synthetic environment path must not exist' }
$env:DOTENV_PATH = $auditNoEnv
$env:DOTENV_CONFIG_PATH = $auditNoEnv
$env:DOTENV_DEBUG = 'false'
$env:DOTENV_QUIET = 'true'
$env:AUDIT_ENABLED = 'false'
$env:AUDIT_WORKER_ENABLED = 'false'
```

The enabled auth test sets equivalent nonexistent-path protection internally and
injects its audit sink; it never creates a live capture runtime. Earlier local
typecheck failures (default target's iterator/top-level-await limitations) were
fixed in new code without changing shared compiler settings. No required local
test remains failed. These passes do not prove live grants/TLS/SQL/transactions,
provider events or deployment. File whitespace/security/diff review is recorded
with the final manager handoff. Scoped tracked and new-file whitespace checks found
no errors; Git reported only informational LF/CRLF conversion notices (the normal
`--no-index` status 1 denotes a new file differing from `NUL`).

## Specific private-config delegation and recovery

Approving authority: user-selected Choice1 and General Manager assignment;
delegating Back End Developer: `/root/audit_backend`; future executor:
`/root/audit_database`. Delegation applies only after the final named-target
execution approval, not merely preparation. Allowed private changes:

- App `.env`: DATABASE_URL to fmt_app_dev; AUDIT_CAPTURE_DATABASE_URL to capture
  login; development label and both enable flags false. Preserve all unrelated
  lines and source SUPABASE_* credentials.
- Move setup-owner DB URLs and any audit-only AUDIT_SUPABASE_URL,
  AUDIT_SUPABASE_PUBLISHABLE_KEY, AUDIT_SUPABASE_SECRET_KEY lines byte-for-byte to
  ignored current-user-only `.env.audit-setup.local`; remove those audit setup
  privileges from app environment. Never print or use those API keys.
- Restricted worker URLs/false flag to `.env.audit-worker.local`; approved
  ephemeral test credentials to `.env.audit-test.local`. No owner/API credentials
  in worker config. Existing `.gitignore` already excludes `.env.*`.

No private file was read/written by this backend agent. DB executor must perform
protected atomic handoff, validate keys/principals/project references/ACLs without
printing values, preserve a restricted recoverable backup and restore on mismatch.
No automatic app/worker activation, unrelated credential rotation, schema grant,
fixtures or deployment is delegated by this backend configuration approval.

Recovery for local code: keep both flags false, stop a faulty worker gracefully,
and revert only these scoped code/config-example additions if needed. Never delete
outbox/destination evidence or run destructive SQL to recover from code. Any
connected rollback, private credential restoration or replay remains DB/CI/CD
work under its approved scope. No commit or release was created here.

## TASK-014 resumed backend review — 23 October 2026

Approval/executor: the user's request to continue TASK-014, the recorded Back End
Developer assignment `/root/audit_backend`, and the General Manager's scoped
resumption. Local backend audit modules, the three isolated audit test scripts,
and this handoff only; no frontend, database-owned changes, private configuration,
credential reads/writes, database/provider connection, app/worker startup or
deployment. Recovery remains a scoped code revert with both enable flags false.

The runtime capability guard now also requires `rolreplication=false`. Its
server-side membership query rejects every unexpected role membership, rather
than inspecting only role names starting with `fm_`; a membership in a privileged
predefined PostgreSQL role must not bypass the restriction. Only the exact
capture/delivery/writer group and worker's source-monitor group are allowed in
addition to the login itself. Snapshot validation rejects true, null and missing
capabilities for all three principals. The live catalog query and live role grants
remain unverified by these mocked tests.

Fresh commands and results on Node v24.21.0:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types scripts/test-audit-events.mjs` | Passed: eleven contracts and 105 rejected invalid inputs. |
| `node --experimental-strip-types scripts/test-audit-worker.mjs` | Passed: transaction/rollback adapters, runtime restrictions, duplicate recovery, timeout/outage, stale leases, quarantine and cancellation. Expected injected enqueue failures produced fixed safe gap markers only. |
| `node --import tsx scripts/test-audit-auth.mjs` | Passed: actual enabled auth/access/persona behavior using injected DB/session/Auth boundaries; no listener or live service. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Passed; no incremental cache written. |

Inspected current test scripts/imports before execution. The auth suite still
redirects dotenv to an asserted nonexistent path, replaces runtime credentials
with synthetic values, injects the capture sink and rejects unexpected pool or
transaction use. The newly imported search-location store performs no query on
import or route registration. No unchanged mixed frontend suite was rerun during
this resumption. No language matrix ran; current language verification scope is
en/lv/ru. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred; historical evidence
above is preserved.

Read-only compatibility review found the current application also declares and
registers `user_search_locations`, outside Choice 1's selected sixteen-table
manifest. Its current get/upsert/remove methods need SELECT, INSERT, UPDATE and
DELETE plus an applicable server-role policy, with no sequence. The DB owner must
present an amendment/alternative and obtain the user's choice before extending
that grant scope; keep application cutover blocked in the meantime. This does not
prevent separately prepared restricted worker/synthetic rehearsal work.

The existing remote Auth intent/reconciliation gate still applies. Prepared code
and these passing offline checks do not complete TASK-014 or authorize activation,
private provisioning, connected rehearsal or production changes.

Read-only DB-package compatibility/security review also covered
`runtime-contract.mjs`, `runtime-support.mjs`, `execute-runtime-setup.mjs`, the four
new 0003 SQL files, the ACL helper's verify-only path, and
`scripts/test-audit-db.mjs`. The setup CLI exposes only `offline` and catalog-only
`preflight`: fixed SELECT statements inside a read-only transaction, safe boolean
output, no role switching or business/audit-row reads, and connection cleanup.
Destination diagnostics may reuse the existing independently pinned source
provider CA in memory only when no explicit destination CA is configured; native
chain/hostname checks remain required. This setup-only compatibility path does
not change either application's runtime TLS policy.

`node migrations/audit/execute-runtime-setup.mjs offline` and
`node --experimental-strip-types scripts/test-audit-db.mjs offline` passed; the
latter initially reported 220 checks; the final focused rerun reported **239
checks** after diagnostic hardening. These are manifest/contract/endpoint guards, static
SQL boundaries, unsupported-mode rejection and scripted metadata-adapter control
tests, including rollback after failure. They execute no SQL, read no private
file and prove no live PostgreSQL syntax, ACL, lease/concurrency, expiry, duplicate
or recovery behavior. Final diagnostics separately report principal presence,
required membership MEMBER/USAGE/SET, membership ADMIN, and setup-owner
MEMBER/USAGE/SET/ADMIN observations. These resolve the absent-role reporting
ambiguity; no live principal, membership or EXECUTE verification occurred.
Protected-write/settings primitives and a uniform-newline fixture do not establish
a completed byte-preserving, recoverable multi-file private handoff. Apply,
provisioning and connected rehearsal modes remain unimplemented in this CLI.

Final narrow review also verified dynamic driver import, explicit read-only
startup options, explicit normal-replication/SSL-negotiation values and rejection
of PGBINARY overrides. The focused offline runner constructs an actual pg client
under ambient-option canaries and a socket guard, and tests client cleanup after
connection/inspection/output failure. The corrected setup offline command also
passed with current pinned draft hashes. No blocker was found for **requesting
the user's specific approval** of the bounded metadata-only preflight described
in [runtime execution handoff](audit-runtime-execution.md); this review does not
authorize that privileged connection or any mutation.

## Accepted cross-role dependency and frontend contract — 23 October 2026

The assigned Back End Developer `/root/audit_backend` accepts the TASK-014
dependency delivered by `/root` from the
[coordination queue](agent-coordination.md#task-014--unblock-dependent-frontendbackend-work).
Acceptance uses the user's 23 October standing cross-role authorization in
AGENTS.md. It covers necessary reversible local backend contract work and
offline/mocked verification; it does not transfer DB execution permissions or
lift the existing stop-on-failure, activation, frontend ownership or deployment
holds. `/root` owns the queue record; DB retains its own SQL/helpers/evidence.

The usable interface for frontend integration is the application's normal domain
API. There is **no generic browser audit-write endpoint** and no browser audit DB
credential. The server derives authenticated identity, current authority,
workspace/object scope, timestamps and request/operation UUIDs; browser-supplied
actor, role, outcome, audit envelope or authorization claims confer no authority.
Frontend can continue its UI and mocked API contract work independently of the
disabled worker/runtime installation.

For backend producers, the implemented internal capture contract is:

| Boundary | Contract and evidence |
| --- | --- |
| Prepare an event | `createAuditContext` after real server authorization, then `createAuditEvent`. Eleven staged event names, strict safe-field/outcome rules, immutable envelope, canonical `sha256-sorted-json-v1`, and 32 KiB payload bound. The isolated event suite passes eleven contracts and 105 invalid cases. |
| Local mutation | `enqueueDrizzleAudit(tx, prepared)` or `enqueueAudit(tx, prepared)` uses the caller's transaction. Audit enqueue failure rejects the operation with a safe 503; the implemented persona-change route rolls back its domain mutation. Mocked route/storage/transaction tests pass; live atomicity remains DB rehearsal work. |
| Independent failure/denial | `captureIndependent` uses a separate transaction. `recordDenial`/`denyWithAudit` await available denial capture; a capture outage never grants access. Fixed gap signals contain no driver/query/token payload. |
| Delivery | `createAuditWorker` uses committed-operation ports, stable event UUID/hash, matching-duplicate acceptance, lease tokens, bounded backoff/timeouts, quarantine and payload-free metrics. Offline tests cover outage, timeout, ack-loss matching, stale tokens and cancellation; connected delivery is not yet verified. |
| API outcomes | Frontend renders the domain API's confirmed result. Do not infer durable audit success from a browser action or manufacture a success event. Remote Auth outcomes can differ from local capture/session outcomes; do not automatically replay an uncertain mutation. |

TASK-025's browser permission/processing-consent events are **not among the eleven
implemented names** and have no implemented HTTP intake route. Do not repurpose a
server authorization-denial event for a client-reported browser/OS permission
observation. Backend accepts the related local contract dependency: agree with
Frontend and DB on an explicit allowlisted intake/event family, mark browser
observations as client-reported, keep consent distinct from permission and saved
location restoration, and define correlation/replay bounds and outage behavior.
Coordinates, addresses, place IDs, cookies/session/token values, raw IP/user-agent
and raw browser payloads must stay out of audit. This paragraph is an acceptance
and contract boundary, not a claim that TASK-025 capture exists. Frontend may use
an explicit mock port for that pending contract; production telemetry requires
the actual reviewed backend/DB implementation and passing checks.

Current runtime evidence belongs to the DB owner's
[execution handoff](audit-runtime-execution.md). The disabled destination committed;
source installation and runtime delivery are not implied. Credential provisioning,
connected rollback/lease/duplicate/outage rehearsal, practical monitoring/recovery,
the application's extra location-table cutover scope, and remote Auth durable
intent/reconciliation remain gates. No production audit coverage or TASK-014
completion follows from these local contracts. Current test languages remain
en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

## Completion integration — 23 October 2026

Backend owns application integration and the actual capture/delivery loop;
DB owns private handoff and the bounded synthetic connected rehearsal. No real
Auth call, user/business/session mutation, application listener or connected
worker was started by this Backend agent. Production deployment remains outside
this development task.

The explicit activation contract is `AUDIT_ENABLED=true` for local transactional
capture and independent security denials, `AUDIT_WORKER_ENABLED=true` in the
separate worker process, and `AUDIT_ENVIRONMENT=development` for either enabled
runtime. **`AUDIT_AUTH_EVENTS_ENABLED=false` is required for this staged producer
scope**; true/invalid values fail startup. Remote Auth hooks remain implemented
and tested with injected adapters, but actual Auth producer activation requires
TASK-015's durable intent/reconciliation. Registry support for eleven names is
not a claim of eleven live producers. Transport activation preserves existing
login/OAuth/password/logout outcomes while continuing local persona audit and
security denial capture. There is no claim that external Auth mutations are
audited in this stage.

When capture is enabled, `server/db.ts` refuses a stale ambient owner DATABASE_URL
before creating a connection. It constructs the application pool from the exact
restricted application URI with verified TLS/hostname and fixed driver options.
`verifyAuditApplicationPool` checks actual TLS and the server's restricted
`fmt_app_dev` principal/capability snapshot before route/session registration or
listening. A connection/query/capability failure produces a safe audit error;
it never falls back to owner credentials. App startup loads its normal `.env`;
it never loads the dedicated setup file. Native pg actual-principal verification
is a separate connected acceptance check, not proved by snapshot tests.

The existing `npm run audit:worker` command explicitly selects the protected
`.env.audit-worker.local` through Node's `--env-file`. Run it from the repository
root after DB activation checks; do not substitute the setup file or put URLs in
arguments. Ambient environment values still take precedence: runtime parsers
reject owner/wrong-target connection values and unsafe flags. The application
does not launch this worker. The DB owner controls its activation after rehearsal;
no unbounded worker should run concurrently with the exclusive synthetic cohort.

`worker-loop.ts` shares the actual daemon loop with bounded connected rehearsal
(`maxSteps`), awaits reporting and closes runtime pools in `finally` on shutdown
or failure. SIGINT/SIGTERM abort the loop; interrupted/uncertain operations retain
their leases for normal expiry and stable-ID retry. Health reports occur on the
first step and every five steps by default (one-second polling), contain only
bounded counts/age and metrics, and include no envelope, UUID, credentials or
driver error. Status is `unavailable` when health cannot be read, `attention` for
new source/destination failures, quarantine, expiry, invalid claim shapes or backlog age
of at least 300 seconds, and `healthy` otherwise. `recovered=true` marks the first
healthy report after attention. These are local operational signals; no external
alerting integration or production service deployment is claimed. The worker's
`metrics.captureGaps` counts invalid claim shapes returned by its source port;
it does **not** aggregate capture failures in the separate application process.
Producer failures emit `Audit capture gap CAPTURE_UNAVAILABLE` through the
capture/HTTP adapters. Operators must inspect both worker health reports and
application gap logs: a healthy worker does not certify that no producer event
was lost or refused before enqueue.

For an outage, retain the source outbox and restore connectivity/credentials
through the DB owner. Normal pending or expired-lease events retry with the same
event ID/hash; a matching committed duplicate can be acknowledged without another
destination row. Check health until backlog catches up. A capture gap, expiry,
quarantine or hash conflict requires operator investigation and remains attention;
never edit the canonical payload/hash, acknowledge an unaccepted event, replay a
real uncertain business/Auth mutation or delete P1 evidence to clear the signal.
Schema/grant repair, restricted recovery and evidence retention belong to the DB
owner's reviewed recovery scope. Stop the worker before any exclusive rehearsal
or scoped recovery. Connected recovery evidence is recorded separately by DB.

Fresh safe checks passed after these changes:

- `node --import tsx scripts/test-audit-activation.mjs`: actual pool adapter
  capability/TLS acceptance/refusal, configuration flags, reserved Auth gate,
  connection-error redaction and real `server/db.ts` import refusing stale owner
  ambient configuration under a socket guard and absent dotenv fixture.
- `node --experimental-strip-types scripts/test-audit-worker-loop.mjs`: actual
  worker/loop with injected ports, bounded cadence/no final wait, transient
  failure/recovery, health outage, attention thresholds, cancellation and pool
  cleanup after reporting/wait/options failure.
- Existing event (eleven staged contracts, 105 rejected inputs), worker and Auth
  suites passed. Auth now also exercises staged remote producers during capture
  outage while security denial and the real mocked persona transaction remain
  enabled. No live Auth, SQL, private configuration or listener was used.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
- Under explicit DB-owner delegation, the local seventeen-table location
  postflight profile retains the no-restrictive-policy gate over **all seventeen**
  tables and exact inaccessible-provider 8+8 baseline. The offline location
  package runner passed **163 checks**, including false-gate refusal/rollback.
  This does not simulate PostgreSQL CHECK/ACL semantics; DB separately executed
  and verified the now-immutable location migration.

Remaining connected acceptance at this checkpoint: DB private handoff/provisioning,
actual application/capture/worker factory verification, the selected synthetic
cohort's atomic rollback/outage/lease/duplicate/conflict/expiry/catchup evidence,
test-access cleanup and final activation state. These are completion work owned
by the active DB executor, not fresh permission requests. Locale testing remains
en/lv/ru; other languages and RTL remain deferred.
