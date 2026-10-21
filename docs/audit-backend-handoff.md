# Backend audit capture and worker handoff

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
