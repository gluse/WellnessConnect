# TASK-014 completion execution

**Completed for prototype development, 23 October 2026.** The connected rehearsal
passed for all twelve fixed synthetic events: matching delivery hashes and
occurrence-based retention, transactional rollback/enqueue failure, restricted
permissions, rollback-only maintenance boundaries, concurrent claims, real lease
expiry, lost-ack duplicate recovery, preserved conflict evidence and injected
destination outage/catch-up. A harmless restricted-app read passed during the
outage. Both projects retain the completed run, twelve outcomes and P1 evidence;
the single intentional conflict remains labeled synthetic.

Temporary test access is revoked: its login is NOLOGIN, schema USAGE and all six
helper EXECUTE grants removed, and exact setup-owner memberships restored. Final
destination and seventeen-table source active profiles passed. Protected capture
and worker configuration is enabled; remote Auth event capture stays disabled
for TASK-015. The final actual bounded worker loop was healthy with zero pending,
leased, quarantined or expired events and zero failure counters; all pools closed.

Start the worker alongside the prototype when needed with `npm run audit:worker`
from the repository root. No background worker, application HTTP server or
production deployment was started. This proves the selected development transport
and capture infrastructure, not all business/Auth producer coverage, external
alerting, provider backup restore or production operation. Earlier checkpoints
below preserve the execution history. Exact commands and DB evidence are in the
[runtime execution report](audit-runtime-execution.md).

23 October 2026. User authorization: **“I do Approve all action required to
complete this task.”** This supersedes earlier phase-specific missing-approval
statements for necessary TASK-014 development work. It does not mark the work
complete or weaken verification, secret protection or failure handling.

Resource scope update: the user clarified that this is a prototype and asked for
frugal execution, then explicitly requested continuation. Resume with the existing
DB owner as the sole implementation agent, reuse prepared artifacts and passing
evidence, and run only checks needed for the remaining connected acceptance.
The prior implementation agents stopped on a reported usage limit; reconcile any
interrupted operation before writes. No additional user approval is needed.

## Scope, executors and recovery

Root coordinates and maintains Markdown. Assigned DB Analyst/Developer
`/root/audit_database` owns database operations, private provisioning helpers,
rehearsal adapters and database evidence. Assigned Back End Developer
`/root/audit_backend` owns backend integration, worker/monitoring interfaces,
isolated application tests and peer review. Owners coordinate dependencies
directly under [standing authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization).

The connected environment remains development source `hbkooiknruimukkhshrk`
and independent audit destination `ynygqodmtgjrngiudalw`. Reuse selected
C/R1/P1/failure policy and Choice 1 restricted-runtime design, the fixed twelve
anonymous synthetic event IDs and run ID, exclusive rehearsal window and retained
synthetic provenance. Approval covers necessary bounded configuration/logging
discovery, safe private-file/credential provisioning and recovery, reviewed new
database versions/helpers, connected rollback/cohort rehearsals, restricted
development runtime verification and activation after its checks pass.

Review the separately prepared [location compatibility package](search-location-database-package.md)
as a dependency before application credential cutover. Consume only the necessary
reviewed source schema/privilege/profile changes; do not silently turn this into
completion of the broader location privacy/consent tasks.

Preserve all applied SQL and pinned bytes. Keep credential values and verifiers
out of commands, output, logs, reports and version control. Establish logging
safety before transmitting any new credential material. Protect and retain
recoverable private setup access. Failed provisioning leaves affected accounts
disabled; do not restore owner URLs into application runtime automatically.
Preserve committed/uncertain outcomes and evidence, reconcile them before any
further write, and never blindly reapply or erase audit history.

This completion scope does not include production deployment, spending, billing,
real customer/Auth/business activity or broad destructive cleanup. Existing
deployment holds remain. Use synthetic/rollback tests and the chosen cohort;
an external capability or unresolved safety prerequisite remains a real blocker,
not a reason to send secrets or claim unavailable checks passed.

## Remaining acceptance

1. Establish exact logging/session/provider guarantees and connection capacity.
2. Complete byte-preserving protected setup/app/worker file handoff, independent
   credentials, failure recovery and restricted login verification.
3. Finish versioned least-privilege rehearsal helpers and actual installed-API
   adapters; preserve exact setup-owner membership restoration.
4. Prove transactional rollback/enqueue failure, effective permissions, concurrent
   claims, real lease expiry, duplicate/ack-loss handling, conflict evidence,
   injected transport outage/catchup, retention boundaries and health counts.
5. Complete runnable worker/configuration/monitoring/recovery integration and
   necessary application compatibility. Separate TASK-014 infrastructure
   acceptance from broader TASK-015 producer coverage and its remote Auth gates.
6. Disable/revoke temporary test access, retain P1 evidence and recovery records,
   verify final runtime state, then update the task with actual acceptance.

No new locale/browser matrix is implied. Any required language checks are limited
to en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

Initial state: both runtime-0003 migrations are committed and catalog-verified,
all new accounts NOLOGIN, no new credentials and no audit collection active.
Detailed prior evidence remains in the [runtime record](audit-runtime-execution.md)
and [Backend handoff](audit-backend-handoff.md). The owners are resuming work;
completion is pending the evidence above.

Current acceptance split: Backend will keep remote Auth producers explicitly
staged behind `AUDIT_AUTH_EVENTS_ENABLED=false`; enabling those producers belongs
to TASK-015's durable-intent/reconciliation work. TASK-014 can complete transport,
local transactional capture, denials and monitoring without claiming that broader
producer coverage. The app runtime must verify its actual restricted principal
before serving, including when an ambient environment overrides dotenv.

Logging discovery found DDL logging, error-statement logging and utility-statement
tracking enabled on both targets; the initial `set_config` capability attempt was
denied for privileged settings. Owners are checking literal session controls
before concluding whether a safe provisioning channel exists. No new credential
has been sent at this checkpoint. Supabase documents connection-level logging
controls via its managed extension; actual target behavior still must pass.
[Supabase logging configuration](https://supabase.com/docs/guides/database/postgres/postgres-log-config)
and [configuration privileges](https://supabase.com/docs/guides/database/custom-postgres-config).

Subsequent target evidence resolved that initial gap: literal `SET LOCAL` worked
for the required logging/statistics controls on both connections, whereas
`set_config` did not exercise the managed utility hook. Defaults for unavailable
sampling/parameter controls must remain safe and are checked fail-closed. The
provisioning design binds temporary custom-GUC values under those verified
session guards, keeping credentials out of literal activity/query text and
sanitized output. No global logging change or restart is needed.

DB delegated new 0004 rehearsal SQL/setup/offline preparation to its child
`/root/audit_database/audit_rehearsal_prep`, with no private or connected access.
DB retains private provisioning and all live execution. Backend and DB review
the joined package before consuming the fixed synthetic cohort.

The required location dependency was reviewed and applied once to the source:
0009 committed and its seventeen-table profile passed, with all runtime accounts
still NOLOGIN. DB reviewed the actual deparsed shape constraint against the
pinned SQL; no user/location rows were inserted. The now-applied location hash
is `fcd68625be336928dc992354d2b0ef8e96bce416022c7eb34e673fcc98302838`.
The original source/destination audit 0003 bytes remain unchanged. Future source
checks must deliberately use the reviewed seventeen-table profile; the legacy
sixteen-table installer remains strict and must not be reapplied.

Private handoff then completed successfully: protected original backup, separate
setup and worker files, and restricted application configuration passed readback
and concurrent-edit checks. Destination writer and source app/capture/worker
password transactions committed under the same verified session controls. No
credential values were output. All runtime roles remain NOLOGIN, with app/worker
and remote Auth audit flags false until connected acceptance.

Retain the protected original and setup access; never copy owner URLs back into
application runtime automatically. The older ACL-only recovery record is retained
as historical permission evidence. Its guarded restore must not be used to undo
protection after this intentional configuration-content change.

The new 0004 rehearsal setup then committed and passed its installed metadata
checks on both projects. The separate inert rehearsal owner, restricted temporary
test account, six bounded helper APIs, retained run/cohort provenance and exact
setup-owner membership restoration were verified. No audit event fixtures were
enqueued by this setup. Runtime/test LOGIN, actual restricted factories and the
twelve-event connected rehearsal remain the next acceptance steps.

Subsequent enablement passed: destination writer/test and source app/capture/
worker/test LOGIN transactions committed; both explicit active-role profiles
verified. App/worker/Auth flags remain false. The first enablement preflight
stopped before any password/LOGIN write because its owner-scope check counted
internal TOAST storage; the corrected verifier allows only TOAST objects linked
to the two owned rehearsal tables. The protected staged test credentials were
reused. No synthetic audit events were seeded at this checkpoint; connected
factory/rollback/delivery acceptance is next.
