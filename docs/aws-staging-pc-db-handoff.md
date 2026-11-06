# TASK-036 current staging database release — 6 November 2026

Status: **bounded owner preflight passed** for the current 41-table application
profile and all 34 readiness flags. This is database compatibility evidence;
it does not establish image publication, application startup or deployment health.

## Authority and execution

Requester/coordinator: `/root`. Assigned DB Analyst/Developer and executor:
`/root/aws_pc_db_release`. Accepted the current PC-build release dependency through
live agent tools under AGENTS standing cooperation. Existing user authorization
selects restricted Lightsail staging and the development source
`hbkooiknruimukkhshrk` and audit destination `ynygqodmtgjrngiudalw` after owner
preflight. See [deployment choices and limits](aws-staging-deployment.md) and the
[integrated PC-build handoff](aws-staging-pc-build-handoff.md).

Read the DB role, PostgreSQL skill/operations guidance, current preflight runner,
its connection support and application validators before execution. Imports do
not start the application or open runtime pools. SQL is bounded catalog metadata
and capability inspection; the runner never calls enqueue, claim, accept, session
operations or migration executors. Startup options enforce read-only transactions
and bounded statement, lock, idle-transaction and connection waits. Each role is
connected sequentially and closed before the next role.

Executed once on 6 November 2026, completed before 10:26 UTC (12:26 Riga):

```text
node --import tsx scripts/aws-staging-pc-db-preflight.mjs --execute-readonly=TASK-036-PC-2026-11-06
```

Exit 0. No retry. No owner/setup credentials, writes, claims, migrations,
grants/ACL changes, connection-limit changes or credential changes. No real app,
worker, browser flow, retention job or message sender started. All probe
connections closed. Private configuration contents and connection URLs were not
output.

## Verified results

Protected `.env.aws-staging.local` and `.env.aws-staging-worker.local` passed
ignored-file, current-user owner-only protected ACL, duplicate-key, approved
target/principal, required-input, audit-flag and credential-boundary checks.
Notification automation/verification and PRODUCT_ACTIVITY remain unapproved and
disabled. The public CA fingerprint remains
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`;
PEM SHA256 is
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
All saved URLs retain `sslmode=verify-full` and Linux CA path
`/app/certs/supabase-ca.crt`; host-side preflight substitutes the same pinned
public CA path only in memory.

| Principal | Target | TLS / PostgreSQL / transaction | LOGIN connection cap | Other same-role connections at snapshot |
| --- | --- | --- | --- | --- |
| fmt_app_dev | source | verified / 17 / read-only | 5 | 0 |
| fmt_audit_capture_dev | source | verified / 17 / read-only | 2 | 0 |
| fmt_audit_worker_dev | source | verified / 17 / read-only | 2 | 0 |
| fmt_audit_writer_dev | destination | verified / 17 / read-only | 2 | 0 |

The app role passes the actual runtime validator, including restricted membership,
no ownership/permanent DDL/elevated capabilities and no direct audit base access.
Capture, worker and writer pass their actual runtime capability validators and
expected entrypoint permissions without executing the entrypoints.

All 32 current workspace-pricing/application readiness flags are true, covering
the exact 41-table profile, principal/version, required and exact public DML,
billing destructive-access exclusion, audit parsers/immutable guards and
notification, appointment, wishlist and workspace-pricing metadata/ACL contracts.
Both additional currency flags (`currency_columns`, `currency_constraints`) are
true. Historical October 33-table/14-flag evidence is retained separately and is
not relabeled as this current result.

## Release limits and recovery

Database compatibility and observed capacity are accepted for the selected
single staging app and scoped capture/delivery workloads. Counts are snapshots,
not reserved capacity. The app pool can consume all five connections allowed to
its principal. Avoid simultaneous local application activity and rolling app
overlap; no process was stopped and no limit was increased. A changed schema,
principal, target or runtime contract needs owner review before release.

Root owns the actual image, HTTPS origin, password gateway, secure deployment-spec
injection and startup. This preflight does not activate the later approved normal
session/audit-write scope. Normal audit delivery can process any eligible shared
development backlog, and the current app's existing hourly booking-message
retention remains as recorded in the integrated handoff. No new lifecycle policy
or explicit cleanup execution is authorized by this check. Preserve payment,
notification-provider, activity-worker and public-production holds.

Recovery from this read-only check requires no database restoration. Preserve
applied SQL, private inputs and unrelated work. After any later deployment issue,
stop only the newly deployed staging workloads and reconcile uncertain runtime
writes under their applicable authority. No backup or restore guarantee is made.

No UI/language matrix ran. Future acceptance is en/lv/ru; ar/RTL, zh, fr, de, hi,
ja, pt and es remain deferred.

## Protected deployment injection handoff

After the successful image tests and DB preflight, Root requested confirmation
for secure runtime provisioning. DB owner `/root/aws_pc_db_release` explicitly
delegates Root to read the two protected staging handoff files and inject their
values into the previously selected Lightsail deployment specification for
TASK-036. This reuses the user's existing secure-provisioning authorization for
these exact targets; it grants no additional database access or other private-file
access. Root must retain application/worker separation and suppress values/raw
deployment responses from reports and logs.

Key-name-only follow-up inspection confirmed the app handoff contains its required
app/capture, Supabase, OpenAI and session inputs. `APP_URL` is intentionally absent:
add the actual AWS-returned HTTPS origin before startup. The worker handoff contains
only its runtime/audit flags and source-worker/destination-writer credentials.
Neither handoff contains Stripe key/profile names. Do not import any Stripe or
other local dotenv file. Ordinary `node dist/index.js` leaves the explicit local
billing selector unset; production cannot select the local billing launcher.

Preserve app `AUDIT_WORKER_ENABLED=false`, worker `AUDIT_WORKER_ENABLED=true`,
literal `AUDIT_ENVIRONMENT=development`, auth-event capture disabled and the
existing service-view flag. Notification flags remain false.
`PRODUCT_ACTIVITY_ENABLED` is absent and therefore disabled by the current
code; Root may explicitly set it false to record the infrastructure intent.
No additional missing mandatory app/worker input was identified in this scoped
read-only review. No database connection was repeated for this follow-up.

## Gateway cookie release: controlled restart and capacity delegation

Root reported the user's explicit request to publish the staging gateway
credential/cookie fix. DB owner accepts this infrastructure-only release review:
the gateway uses an overlay of the exact deployed base; app and audit images stay
`:fitsmytime-staging.app.1`, all application/audit environment values remain
unchanged and Google remains disabled. Root owns verifying AWS-supported
disable/deployment/enable semantics and the actual cloud operations.

A stop-before-start sequence is accepted to avoid rolling overlap under the
existing app/capture/worker/writer connection limits of 5/2/2/2. Root must first
verify the old service is disabled and its containers stopped. A zero-connection
snapshot alone does not prove stopped containers: idle pools can reconnect.
Preserve graceful shutdown where supported; the app closes its app/capture pools,
and the audit daemon closes its source/writer pools on termination. Do not
terminate database sessions or increase limits to force acceptance.

DB owner specifically delegates **one** bounded metadata-only capacity execution
to Root after that verified stop, using only the two already authorized protected
staging handoffs and the four unchanged restricted principals/targets:

```text
node --import tsx scripts/aws-staging-pc-db-preflight.mjs --execute-capacity=TASK-036-GATEWAY-2026-11-06
```

The new explicit capacity mode retains private ACL, CA, strict TLS, fixed
target/principal and read-only checks. It inspects only principal/version/LOGIN,
expected cap and same-role connection counts; it skips the full readiness and
capability SQL. It requires zero connections other than each sequential probe,
prints counts only and closes its probes. No row payloads, claims or mutations.
Any nonzero count or other failure stops this release check without an automatic
retry; return to the DB owner for interpretation. A successful result allows Root
to continue the verified single-node restart with unchanged runtime scope. Avoid
local application/worker activity between the snapshot and re-enable. Prior full
41-table/34-flag compatibility evidence remains the applicable current result.

Preparation validation passed `node --check`, inert `--plan` and whitespace diff
checks. No connected execution has occurred for this gateway capacity mode at
the time of this delegation. Recovery/normal runtime limits above remain intact;
no new database policy, migration, cleanup or private Stripe/general-env access
is included.

### Revised maintenance transition and second capacity authorization

Root reported the original delegated capacity check executed once after AWS
`DISABLED` and exited 0: all four roles had zero other connections, probes closed,
no mutations. That first execution authorization is consumed. AWS subsequently
rejected deployment creation while disabled (`InvalidInputException`); Root
reported no API retry and re-enabled the exact prior deployment version 2 for
recovery. This was an AWS control-plane limitation, not a failed database check.

DB owner accepts a zero-DB maintenance deployment as the revised way to avoid
runtime overlap, under the same user-requested gateway fix/staging interruption:

1. Root completes recovery to version 2 ACTIVE before proceeding.
2. Root uses verified supported AWS operations to deploy maintenance using the
   same images/environment. App and audit commands are Node built-in idle loops,
   with no application imports or database access; the gateway is a minimal
   built-in HTTP server exposing sanitized readiness 200 and public 503 only.
3. Before the check, Root verifies maintenance ACTIVE, **every prior deployment
   containing app/audit consumers INACTIVE**, no pending deployment, and all
   effective maintenance commands are the reviewed zero-DB commands. Wait at
   least 30 seconds after that state for graceful drain. A zero count does not
   replace these workload-state proofs.
4. Run the new one-time delegated capacity command below. Keep local app/workers
   inactive. All four roles must again show zero connections apart from probes.
5. On success Root may create the gateway-fix deployment using the preserved
   original app/audit commands/images/environment. The only predecessor is now
   zero-DB maintenance, so rolling overlap with it consumes no DB connections.

```text
node --import tsx scripts/aws-staging-pc-db-preflight.mjs --execute-capacity=TASK-036-GATEWAY-MAINTENANCE-2026-11-06
```

DB owner specifically delegates this **one new** metadata-only execution to Root
after the listed lifecycle proofs. It is a fresh authorization following changed
workload lifecycle, not a retry of a failed check. The same strict targets,
principals, TLS, read-only checks, timeout bounds, zero-other-connection condition
and stop-on-failure/no-automatic-retry rules apply. No full schema preflight,
connection termination, limit change, database mutation or broader secret read.
An additional disable/enable cycle is unnecessary for database acceptance once
the verified maintenance deployment is active and dormant. Root remains owner of
AWS lifecycle semantics and public maintenance response verification.

New mode syntax, inert `--plan` and diff checks pass. No connected execution was
performed by this DB owner while preparing the revised authorization.

### Maintenance execution result; consumed grants

Root subsequently reported maintenance version 3 ACTIVE/RUNNING, no next
deployment, every prior deployment INACTIVE, and all effective maintenance
commands verified as exact zero-DB commands. After a 30-second drain, Root ran
the delegated maintenance-token check **once**, exit 0. All four roles had zero
other connections, strict TLS/unchanged caps passed, and all probe connections
closed with no writes or claims. The second grant is consumed. Root then reported
gateway-fix version 4 ACTIVATING with app/audit configuration cloned from the
preserved version 2; DB owner did not perform additional connected inspection.

Both old gateway capacity tokens are now rejected by the runner before private
inventory or network access. Their commands above remain historical evidence,
not reusable execution instructions.

## Referrer-policy change: manual guide preparation only

Root requested an owner-reviewed capacity step for the user's step-by-step guide
to rebuild/redeploy the gateway referrer-policy change. DB owner accepts this
local dependency and prepares one explicit **manual user-run** capacity mode:

```text
node --import tsx scripts/aws-staging-pc-db-preflight.mjs --execute-capacity=TASK-036-REFERRER-MANUAL-2026-11-06
```

This section prepares the guide; **no build, publication, deployment, credential
inventory or connected DB check is performed or released for an agent here**.
The manual executor is the user operating their own PC and service settings.
It is not a transfer of the prior Root executor's consumed connected grants.
If an agent is later asked to perform this step, the assigned DB owner must
accept that concrete execution scope first. No new permission request is needed
to finish the current guide-only preparation.

Before the user chooses to execute this connected step, the guide/helper must
verify the same controlled lifecycle: maintenance ACTIVE, no pending deployment,
every prior DB-consuming deployment INACTIVE, and all effective maintenance
commands exactly the reviewed zero-DB commands. Wait at least 30 seconds after
that verified state; keep local application/audit processes inactive. Preserve
the exact current app/audit images, commands, credentials, targets, flags and
5/2/2/2 caps. A gateway-only policy edit does not authorize app/schema/config
changes. Do not run a full schema preflight or read general/Stripe dotenv files.

The helper must invoke this actual DB-owner script, inspect its process exit and
parse its emitted JSON rather than generate a substitute success receipt. Require
exit 0, four passed role records with TLS/read-only true, expected caps and zero
other connections, plus completion `passed=true`, `capacityOnly=true`,
`capacityAuthorization=TASK-036-REFERRER-MANUAL-2026-11-06`, `writes=false`,
`claims=false` and `allConnectionsClosed=true`. Treat malformed/missing output,
any nonzero count or any failure as a stop. Do not kill sessions, change caps,
retry automatically or reuse a prior receipt. Leave the known maintenance state
and ask the DB owner to interpret a failure before further connected attempts.
After a successful manual check, retain the dormant predecessor until the
reviewed actual gateway deployment is created; the snapshot reserves no capacity.

Local validation only: Node syntax and inert `--plan` pass. Both consumed gateway
modes were invoked solely to verify early rejection: each exits 1 with
`stage=plan`, `safeCode=MODE_REJECTED`, `retry=false`, before private reads/sockets.
The new manual mode has **not** been executed. No new connected evidence or
referrer-policy deployment is claimed.

### Explicit manual-command preparation approval

Root subsequently reported the user explicitly approved preparing the manual
deployment command that runs the existing bounded read-only connection check
**when the user executes it**. Guide preparation includes no agent execution,
service interruption or connected DB access. Root reported automatic approval
review had initially rejected adding an agent-executable mode under the narrower
guide-only scope; the user's later explicit preparation approval resolves that
preparation gap. It does not transfer connected execution to an agent. The
manual helper must retain the reviewed lifecycle proofs, actual child invocation,
output validation and once-per-release guard described above.

### Manual Step 9 prelaunch failure and scoped guard recovery

The user reported `UnboundLocalError` in manual guide Step 9 for snapshot
`outputs/aws-staging-build/source-gateway-7HaTMV`. DB owner reviewed the actual
infrastructure helper and only its public local receipts, with no DB or private
configuration access. Confirmed evidence:

- `release-gateway.py` imports `subprocess` globally, but a second
  `import subprocess` in the `prepare` branch binds that name locally throughout
  `main`. In the separate `manual-capacity` branch the name is uninitialized.
  Evaluating `subprocess.run(...)` therefore raises `UnboundLocalError` before
  invoking or launching the Node capacity-check child.
- `manual-capacity-attempt.json` contains only the prelaunch fields
  `attemptedAt=2026-11-06T14:33:18.879247+00:00` and `maintenanceVersion=6`.
  It has no child exit code or output summary; `capacity-release.json` is absent.
- The public maintenance-ready receipt describes version 6 active, all previous
  inactive and all commands database-free, checked at
  `2026-11-06T14:32:34.364514+00:00`. This is historical local evidence, not a fresh
  AWS state verification by the DB owner.

DB owner accepts Root's reversible infrastructure scoping fix and **offline guard
recovery for this exact prelaunch failure**. Preserve the stale marker's original
bytes in an archive and record its original hash/path and the reviewed
`PRELAUNCH_UNBOUNDLOCALERROR` reason. Before moving the guard, verify the exact
prelaunch-only shape/version and absence of a child-result/success receipt again.
Do not delete evidence, manufacture a success receipt, generalize this recovery
to launched/uncertain child checks or clear a guard after a database failure.
Root owns the helper fix and meaningful offline full-mode fake-SDK/subprocess
regression; no live command is required to validate the Python scope correction.

The manual token remains **unconsumed** because this failure occurred before child
launch. No new token is necessary. The user may make their first actual bounded
manual connection check with the existing referrer token after the repaired
helper freshly verifies active exact zero-DB maintenance, no pending deployment,
all prior DB consumers inactive and a new 30-second drain. Historical receipts
alone cannot release this step. This is the first actual check, not a retry of a
failed database check. Any launched check with nonzero/malformed/uncertain output
retains the guard and stops without automatic retry. No session termination,
cap/schema changes, agent DB execution or broader credential access is delegated.

### Manual inventory stop: notification flag and fresh user-run grant

The next user-run Step 9 launched the Node child, which exited 1 in
`private_inventory` with `UNAPPROVED_WORKER_OR_PROVIDER_FLAG`. DB owner inspected
the current public receipt for `source-gateway-7HaTMV` and the runner source:
the receipt contains maintenance version 6, exit code 1 and only a plan record
followed by that inventory failure. `capacity-release.json` is absent. Original
receipt SHA256 is
`25ce17e8d535f75fdcb4ff5baf5bbf71419b9ae23eb69b49ad7650deecd229b4`.
The guard condition is before the URL/CA role loop and before every `client` or
`connect` call; this known inventory stop made no DB connections. This is a
different failure from the earlier Python prelaunch error, so that earlier
guard-recovery grant does not apply.

Root reported a key-name/presence-only review confirms both
`AUDIT_SOURCE_DATABASE_URL` and `AUDIT_DATABASE_URL` exist in the worker handoff.
`AUDIT_DATABASE_URL` belongs there and must not be duplicated into the app file.
Root separately inspected only the four nonsecret app feature flags and found
`NOTIFICATIONS_ENABLED=true`, automation/verification false, and product activity
unset. The true notification flag explains this inventory rejection under the
selected disabled-notification release scope. This does not establish a new DB
connection/credential failure. No agent changed that user-edited flag or read
its private credential values during this review.

The original referrer manual token is consumed by this launched inventory
attempt and is now rejected before private inventory/network. DB owner accepts
a **fresh, conditional, one-time manual user-run** capacity attempt after the
user restores the approved `NOTIFICATIONS_ENABLED=false` in the protected app
handoff. Do not automatically overwrite their edit or activate notification
providers to bypass this gate. New token:

```text
node --import tsx scripts/aws-staging-pc-db-preflight.mjs --execute-capacity=TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06
```

This is owner-reviewed continuation after a diagnosed offline inventory stop,
not an automatic retry. Before that user-run attempt, Root may perform the
specific **offline** guard recovery for this exact failed inventory receipt:
verify its recorded hash, exact version/exit/summary and absence of a success
receipt; archive the original bytes with an annotation
`OFFLINE_INVENTORY_UNAPPROVED_WORKER_OR_PROVIDER_FLAG`; preserve all prior
failure evidence. Do not erase evidence or generate a passing receipt. Any
different, launched-network, malformed or uncertain failure requires owner
interpretation and cannot use this recovery grant.

The helper and manual guide must use the fresh token, and completion validation
must require
`capacityAuthorization=TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06`. All existing
four-role/TLS/read-only/cap/zero-other-connection and no-write/no-claim/closed
completion requirements remain. Immediately before the fresh manual execution,
revalidate exact zero-DB maintenance ACTIVE, every prior DB consumer INACTIVE,
no pending deployment and wait a fresh 30 seconds. Keep local app/workers
inactive. Any child failure/nonzero count/malformed result consumes this manual
attempt and stops with the guard retained; do not automatically rerun.

This prepares the manual user's action only. No agent DB execution or additional
private-file access is delegated; no DB/schema/role/cap/credential changes.
Validation: syntax and inert plan pass; invoking the now-retired referrer token
returns `MODE_REJECTED` at plan stage before private reads/sockets. The fresh
FLAGS mode has not been executed or inventoried by this DB owner.
