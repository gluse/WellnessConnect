# TASK-024 — selected billing decisions

25 October 2026, Europe/Riga. Source: user's answers to the four billing
questions in the TASK-024 thread. These decisions supersede the corresponding
unselected/hypothesis statements in the earlier designs and handoffs.

| Item | Selected behavior |
| --- | --- |
| Processor | Stripe for the monthly workspace Pro integration. No account access or processor operations authorized by this selection. |
| Company billing | Current company owner only. Company administrator/service-management privileges do not grant billing access. Personal billing remains bound to the verified personal workspace owner. |
| Existing manual Pro | Wait until a valid manual Pro grant expires before allowing paid checkout. Preserve existing grants and paid rights; do not charge retrospectively or automatically convert a grant into a paid contract. |
| Initial monthly price | EUR 19.00 per workspace per calendar month, including applicable tax: 1,900 euro cents. This selects gross price presentation, not a tax rate, exemption, legal entity or tax-calculation vendor. |
| Administration | Authorized application administrators can configure the monthly amount through Administration. Currency stays EUR, interval monthly and presentation tax-inclusive. Company billing ownership does not grant application-administration privileges. |

Persist/validate exact integer minor units; never accept the checkout price from
browser input.

## Price changes and contracts

Store immutable offer revisions and a versioned current-offer setting. Saving
an amount changes local configuration only; do not make Stripe calls from the
configuration save or claim a remote price/charge was created. Checkout resolves
the approved server offer, with explicit account/mode and durable idempotency.
Never overwrite financial evidence or past agreed offers.

**User selected 26 October 2026:** new subscriptions only; existing subscribers
keep their agreed price. An Administration amount change publishes a new offer
for subsequent subscriptions. Preserve each existing subscription's agreed offer
and renewal amount. Do not update its Stripe subscription item, reprice renewals,
prorate or migrate the contract merely because the current offer changes.

## Current assignments and limits

Root resumed the existing assigned owners under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Backend `/root/subscription_backend`, DB `/root/subscription_database` and
Frontend `/root/subscription_frontend` accepted through live agent tools.

- Backend: local Stripe adapter, billing authorization/routes/services,
  Administration pricing APIs, remaining lifecycle/persistence/audit integration
  and isolated tests. Public official Stripe documentation may be consulted.
- DB: local pricing/schema/migration/runtime-profile dependencies, reviewed
  source/destination audit compatibility and offline checks. Preserve applied SQL,
  active runtime profiles and published 0010/0011 preparation pins.
- Frontend: local Administration amount editor, billing/transport integration,
  selected owner/manual-wait behavior, translations and mocked checks. Frontend
  runs the one final integrated TypeScript check after Backend/DB stabilize.
- Root: task/brief/coordination and this decision record; check integrated
  contracts and returned evidence without repeating unchanged suites.

No private configuration/credentials, connected database or Stripe operations,
persisted API/session/browser writes, spending, charges, activation or deployment
are authorized here. Keep runtime billing unavailable until dependencies and
separate execution/launch gates pass. Current user decisions do not transfer
another task's connected-operation approval.

Remaining commercial/activation inputs include cancellation/refund/failure-grace
terms, operating entity/tax configuration, support owner, financial/inbox retention
and exact connected test/launch authority. Routine owner contract choices do not
require another approval for the decisions already selected above.

Validation: meaningful changed-scope offline/mocked tests and applicable build/
type/browser checks; en/lv/ru only. ar/RTL, zh, fr, de, hi, ja, pt and es remain
deferred. Recovery: revert only attributable local preparation changes, preserve
concurrent dirty work and paid/manual evidence. No connected data changed.

## Local delivery — 26 October 2026

Selected-policy code and offline verification are delivered in the
[Backend](monthly-subscription-backend-handoff.md),
[DB](monthly-subscription-database-handoff.md) and
[Frontend](monthly-subscription-frontend-handoff.md) handoffs. The Administration
editor/API, pinned offers and Stripe composition are prepared, with default
runtime disabled and migrations unapplied. Those handoffs list the remaining
operational recovery/source-cutover and connected/launch checks; this delivery
does not establish an operating paid-subscription service.

## Account configuration preparation — 26 October 2026

User reports creating a Stripe account and asked where to put details. Backend
delivered an empty section in [.env.example](../.env.example) and
[sandbox setup note](stripe-sandbox-setup.md). The intended local private
destination is project-root `.env.stripe.local`, already ignored by `.gitignore`;
no private file was read or populated. Business verification and bank details
remain in Stripe's Dashboard. Account/sandbox identity, key permissions and actual
connectivity are unverified. These preparation values are not automatically
consumed by the current dependency-injected application, and do not enable billing.

User subsequently reports filling the two named API/account fields and asks for
the next step. Backend accepted bounded redacted local validation of only
`.env.stripe.local`, plus a pure parser and synthetic checks. This is the narrow
exception to the earlier no-private-configuration scope; no values are printed,
no other private files are inspected and the credential file is not edited.
An own-account read-only Stripe verification is being prepared for separate
specific approval; no connected request or runtime activation was authorized by
that preparation alone.

The local check passed once and the prepared reader passed nine synthetic checks,
one failure-output regression and a targeted TypeScript check. User subsequently
said **"please proceed"** on 26 October: Backend `/root/subscription_backend` may
execute the prepared command once for exactly one sandbox own-account
`GET https://api.stripe.com/v1/account`, checking the configured account identity.
Only safe booleans may be reported; 10-second timeout, zero retries, no redirects
or Connect header, stop on failure. No other private files, API operations/writes,
database/app startup, charges, activation or deployment are included. Backend
records the result in the [setup note](stripe-sandbox-setup.md); runtime stays
disabled. Recovery requires no data rollback because this operation is read-only.

The one approved command exited 1: valid local configuration, connected attempt
made, account check unsuccessful. Its boolean-only output does not establish
whether network, permission or account mismatch caused the failure. Backend
stopped with no retry; the one-attempt approval is consumed. Local preparation
of allowlisted failure categories and mocked checks may proceed; a further
connected attempt needs explicit scope under the recorded stop-on-failure limit.
Safe diagnostic categories are now prepared (network/timeout, authentication/
permission, account mismatch or other), with two mocked checks and targeted
TypeScript passing. No messages, bodies, identifiers or credential values are
exposed. No further private-file read or connected attempt occurred.

User then explicitly approved **one additional read-only diagnostic check** with
"yes, go ahead" on 26 October. The same Backend executor may run the unchanged
`--account` command once, under the same named-file, exact GET, test-only,
10-second/zero-retry/no-redirect/no-Connect restrictions. Output may include only
the tested allowlisted failure category and safe booleans. Stop on failure; no
key/permission changes, further retries, other requests, writes or activation.
Result is recorded in the setup note and coordination queue.

The additional command exited 1 with `stripe_authentication_or_permission`.
This does not distinguish failed authentication from insufficient read permission;
account identity remains unverified. Backend stopped with no retry or settings
changes. Both single-attempt approvals are consumed; the Stripe account owner
must review key status/own-account read access before further connected scope.
Billing remains disabled. No secrets, account identities or raw response data
were printed or retained.

User subsequently reports **"Access policy added. please retry"** and authorizes
one further execution by the same Backend owner of the unchanged diagnostic
command. The exact policy/permissions are not independently verified. Existing
named-file, sandbox-only, exact own-account GET, 10-second/zero-retry/no-redirect/
no-Connect and safe-output limits apply; stop on failure. This does not authorize
agents to edit permissions or perform other operations. Result follows in the
[setup note](stripe-sandbox-setup.md) and coordination queue.

The third separately approved attempt exited 1 with
`stripe_authentication_or_permission` again. Local configuration is valid;
authentication/account equality remain unverified. Backend stopped without any
further retry, policy inspection/change or activation. The Stripe account owner
must inspect the failed request log for its error code/missing permission before
another connected scope is considered. All three one-attempt approvals have
been consumed; no precise cause or policy effectiveness is inferred.

User supplied the Stripe request-log error naming missing Accounts Read
(`connected_account_read`). Root advised granting only that read permission for
the current check. User then said **"retry"**, authorizing one fourth execution
by the same Backend owner under the unchanged named-file, test-only, exact GET,
10-second/zero-retry/no-redirect/no-Connect and redacted-output limits. Applied
permissions are not inspected or changed by agents. No other operations or
activation are authorized; stop on failure and record the safe result.

The fourth separately approved command exited 1 with
`stripe_authentication_or_permission` again. Authentication/account equality
remain unverified. Backend stopped; all four single-check approvals are consumed.
No further request or settings change occurred. The account owner must confirm
the saved policy applies to the configured key or inspect the latest Stripe
request-log error before another diagnostic scope is considered. Billing stays
disabled; this result does not prove which exact permission is currently applied.

User explains the earlier permission change had not been applied and explicitly
asks **"Please retry again"**. This authorizes one fifth execution by the same
Backend owner under the unchanged exact sandbox own-account GET and named-file/
10-second/zero-retry/no-redirect/no-Connect/redacted-output limits. Agents do not
inspect or edit the policy; no other operations or activation are authorized.
Stop on failure and preserve prior attempt evidence.

The fifth separately approved command **passed (exit 0)**:
`accountReadSucceeded:true`, `configuredAccountMatched:true`, mode test, billing
and new checkouts disabled. Own-account authentication and configured merchant
identity are now verified. This establishes neither broader permissions nor
payment-flow readiness. Webhook/portal/origin remain absent. No other connected
operations, tests or settings changes occurred. All five distinct single-check
approvals are consumed; prior failures are preserved in the setup note/handoff.
Remaining TASK-024 runtime, configuration, rehearsal and launch gates persist.

## Local app integration assignment — 26 October 2026

User selected **local** app testing and explicitly asked the agents to complete
the work and provide setup instructions. Root resumed the same Backend,
Frontend and DB owners; all accepted. Necessary reversible local implementation
and offline/mocked checks are authorized in their existing role scopes, with
owner coordination for shared contracts. The [coordination entry](agent-coordination.md#local-app-runtime-integration--26-october-2026)
records ownership/acceptance and the [local guide](stripe-local-app-testing.md)
contains setup steps. Existing Stripe/owner/manual-wait/EUR19/new-only decisions
remain unchanged. Development test fixtures must not select real commercial,
tax, retention or refund policies.

No private configuration, app/worker/CLI startup, real DB/session/Stripe writes,
privilege changes, spending, live activation or deployment is authorized by this
local preparation. Local app selection does not identify a database or waive
target-specific execution approval. The five prior own-account read approvals
are consumed. Owners prepare concrete commands/validation/recovery before the
missing exact connected scope is requested. en/lv/ru testing only; other locale
verification remains deferred. No unchanged suites need repeating.

Local preparation is now complete: Backend delivered the explicit loopback-only
sandbox launcher/runtime/raw webhook/worker/source-aware manual path and durable
portal audit; Frontend delivered server-driven availability and workspace-switch
guards; DB delivered portal0007 and own-role metadata readiness. Backend 15 new
runtime cases plus 19 affected cases/audit regression (105 invalid inputs
rejected), DB 109 new offline checks, Frontend four provider/11 mocked browser
checks and the single final integrated TypeScript check passed. Root reviewed
contracts; raw-parser order and worker shutdown cleanup findings were corrected.
Earlier unchanged evidence was reused. No private config, connected app/DB/
Stripe/CLI operation, privilege change or deployment occurred in this phase.

The next proposed approval is narrower than the broader rehearsal in the
[execution plan](monthly-subscription-database-execution-plan.md): existing hosted
development source `hbkooiknruimukkhshrk` and audit destination
`ynygqodmtgjrngiudalw`, named private setup/runtime fields, prepared migration
transactions/required permissions and staged metadata/restricted role checks only.
Restorable managed recovery points for both must be confirmed before DDL;
PostgreSQL backup clients are not on PATH and the export fallback is not ready.
No target selection/connected approval exists yet. Fixtures/session writes,
worker claims, app startup, Stripe calls and deployment remain excluded from this
next DB-only scope. The [local guide](stripe-local-app-testing.md) records exact
user setup and the later connected acceptance boundary.

## Conditional development DB execution approval

User explicitly replied **"Approve the DB plan"**. Root routed this approval to
the existing DB executor `/root/subscription_database`, who accepted the narrow
DB-only scope: named development source/audit projects, plan-listed private
setup/runtime inputs, bounded identity/TLS/schema/role preflight, pinned migration
transactions/required permissions and staged metadata/restricted-role checks.
The broader plan's fixtures/cohort/session writes, worker claims, app startup,
Stripe operations, production and deployment remain excluded. Stop on first
failure/uncertain commit; no automatic retry, repair or destructive rollback.

The user did **not** confirm restorable managed recovery points for both projects.
That factual prerequisite remains mandatory before migration/ACL writes. DB
reports its current inputs cannot establish managed backup availability; provider
API/UI inspection and the unready logical-export/tool/temporary-delegation fallback
are not included in this approval. Root requested backup date/time/method for both
projects and linked [confirmation steps](stripe-local-app-testing.md#confirm-recovery-availability).
DB records acceptance/conditional hold in its execution plan/handoff and avoids
unnecessary private reads or connected preflight while waiting. No migration,
configuration/ACL write, connected startup, backup or Stripe operation has run.

## Explicit test-data backup exception

User then instructs **"Can you Proceed without backup? I have only test data
here"**. This explicitly waives the managed-recovery-point/backup prerequisite
for the already approved exact development DB-only migration/readiness package.
Root routed the exception to `/root/subscription_database`; that owner accepted
and proceeds under the recorded package without repeating approval. The exception
supersedes the earlier confirmation hold; it does not prove a backup exists.
No backup export, client installation, restore or extra delegation is authorized.

Without a confirmed recovery point, snapshot restoration is not an available
recovery assumption. Preserve confirmed objects/history and last committed stage;
atomic failed transactions roll back but uncertain commits require inspection,
not automatic retry. Stop on first failed precondition, statement or verification.
Do not perform destructive rollback, data repair or silently expand privileges.
Named target/principal/TLS, pin/predecessor, staged verification and actual
service-quiescence requirements remain. App/worker/session/fixture/Stripe actions,
production and deployment remain outside this DB-only scope. No further backup
confirmation is required within this explicitly waived scope.

The DB owner prepared a pinned forward-only executor and passed 34 new offline
checks. Its one setup attempt stopped at `LOCAL_PRODUCER_OR_WORKER_NOT_ABSENT`
before private reads, sockets, SQL or commits. One safe diagnostic distinguished
an available inventory from actual matching app/billing processes: `node.exe`
PIDs 17744 and 50916. No audit-worker category was reported. No retry or service
termination occurred. Root routed read-only identity/project/parent review to
the Backend owner before any proposed stop action. Existing DB approval does
not authorize terminating those processes; the backup waiver remains effective.

## Renewed request — 27 October 2026

User confirms Supabase Free has no managed backups and again asks to proceed
without one. This reaffirms the existing explicit test-data backup waiver and
authorizes one fresh guarded attempt of the same approved development DB-only
package; the same DB executor accepted via live agent tools. No backup approval
is requested again and no wider operation is inferred.

Between requests, Backend's read-only identity review found the old PIDs absent
in its executor view; port5000 inventory was unavailable. Thus the earlier PIDs
cannot be treated as current or used for termination. DB refreshes actual safe
quiescence metadata and checks scanner precision before proceeding. No service
termination, app startup, fixture/session/worker claims, Stripe operations or
production/deployment is authorized. Stop at first actual failed precondition,
statement, verification or uncertain commit; no automatic setup retry.

DB corrected the overly broad substring scanner to inspect Windows argv/entry
identity and passed 23 new synthetic checks (previous 34 reused). Its fresh
attempt again stopped before private/DB access: application PID50916 (creation
`2026-10-26T15:25:46.6737900Z`), parent17744 (creation
`2026-10-20T10:34:25.0836300Z`), relative entry/project unresolved. No SQL or commits,
no retry or termination. The previous Backend absent-PID report is insufficient
to override current same-executor evidence. Root resumed Backend for read-only
identity review using the same metadata provider, and asked the user to stop
their own project server and confirm a setup retry. No backup confirmation is
requested or required; this is the separate quiescence dependency.

Backend's matching elevated CIM diagnostic now verifies both expected PID+
creation identities. The application's own public tsx preload path proves
`C:/Source/Private/WellnessConnect`; parent17744 supervises app50916 as node watch.
The earlier absent-PID report came from a restricted process view, not proof of
quiescence. No stop/start/private/DB action occurred. Root prepares an exact
Backend stop-parent/app proposal with fresh identity/project revalidation and
one DB setup retry; neither process control nor another setup attempt is
authorized yet. The backup waiver remains accepted.

User then explicitly answered **"Stopped — retry DB setup"** to the pending
quiescence question. Root routed one new guarded attempt to the same DB owner
under the unchanged exact DB-only package and no-backup exception. The executor
must freshly verify absence rather than infer it from the report. This confirms
user-owned stopping and authorizes the setup retry; no agent termination, app
startup, fixture/session/worker claims or Stripe operation is included. Stop at
first failure/uncertain commit; no automatic retry or repair.

That user-authorized retry stopped at fresh local quiescence: the same app50916
and watch-parent17744 remain, with unchanged creation identities. No private
inputs, database socket, SQL or commit occurred. No retry or process termination.
The user-owned stop report did not remove the observed pair. Backend's exact
revalidated stop-parent/app proposal remains available, but process-control
authorization has not been provided; backup remains waived.

User subsequently replies **"yes, stop it"** to the exact Backend stop + single DB
retry proposal. Backend `/root/subscription_backend` may revalidate and stop only
watch-parent17744 (creation `2026-10-20T10:34:25.0836300Z`), then matching app50916
(creation `2026-10-26T15:25:46.6737900Z`) if still present. Verify same CIM view,
node executable, creation identities, child's exact project loader path and
parent relationship. Abort on mismatch/unavailable identity; already-exited
means no termination needed. Exclude ancestor50852 and other descendants; no
restart is authorized. DB may make one fresh guarded attempt only after the
Backend outcome, under unchanged DB-only/no-backup scope and stop-on-failure
limits. Root coordinates the dependency; no private/app/Stripe/fixture authority
is transferred to the Backend stop operation.

Backend executed the authorized stop with exit0. Same-view CIM plus pinned .NET
process handles verified expected creation/node/project/parent identities.
Watch-parent17744 was stopped; app50916 exited with it, so no child kill was needed.
Post-check both absent; no unrelated process, restart, private config, DB or Stripe
action. Root released the single separately authorized DB setup attempt, which
must still run its own fresh guard. No further service-control scope is inferred.

The released DB attempt **succeeded (exit0)**. It committed and verified source
0010/0011/0012/0013, audit destination0006/0007, then audit source0006/0007, under
the accepted no-backup exception. TLS/source/destination baselines and each staged
catalog/profile check passed; exact setup memberships were restored/compared.
Restricted app/capture/worker/writer read-only probes passed, including the app's
own-role billing DB-readiness check. The DB owner records detailed receipts in
its execution plan/handoff. No fixture/session writes, worker claims, app/CLI
startup, Stripe operation, backup/export/restore or deployment occurred. The local
server remains stopped. This completes approved DB setup, not connected checkout
or end-to-end subscription acceptance; wider execution scopes remain held.
