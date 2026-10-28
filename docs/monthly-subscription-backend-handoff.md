# TASK-024 — backend implementation handoff

## Current phase — 27 October 2026: approved local producer stop

Latest local-only launcher diagnosis: user reported the generic refusal. Backend
accepted bounded reads of **only** `.env.stripe-app.local` and `.env.stripe.local`
for redacted metadata; no private configuration edits or connected operations.
Confirmed causes: profile file **missing (ENOENT)**; credentials preparation check
rejects `STRIPE_BILLING_ENABLED`; `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` missing.
Base `.env` was not needed or read. The already successful DB package/probes were
not repeated. Remediation is user configuration: create the separate profile from
the tracked example, retain false/test preparation flags, and supply the existing
sandbox portal configuration ID. This does not authorize app/worker startup.

Prepared local-only command:
`node --import tsx scripts/check-stripe-local-config.mjs`. Its injected pure
diagnostics read only those two fixed names and emit safe stage/category plus
allowlisted known field names; unknown names, values, paths, errors and stacks are
excluded. The launcher reuses these diagnostics, skips base/runtime on local
failure and otherwise reports only safe base/import stage on refusal. Four new
synthetic diagnostic tests passed after correcting an invalid synthetic account
fixture; changed-module narrow TypeScript and both script syntax checks passed.
No unchanged test suites, app/process control, DB/Stripe requests or private writes
were performed. Root owns troubleshooting/setup guidance and the next execution
scope. The standalone checker was prepared, not rerun on the private files after
the initial metadata diagnosis; only profile filesystem error code was checked to
distinguish missing from unreadable.

User explicitly answered **“yes, stop it.”** to the coordinator's exact combined
proposal. Backend executor `/root/subscription_backend` accepted **stop only**:
watch-parent17744 created `2026-10-20T10:34:25.0836300Z`, then application child50916
created `2026-10-26T15:25:46.6737900Z` if still present. No other process, ancestor
(including50852), arbitrary descendant or restart was authorized to Backend.
The coordinator separately owns routing the single DB retry; this stop did not
execute or trigger setup, private-file access, app startup or Stripe operations.

Read-only identity review used the **same escalated Windows PowerShell/CIM view**
as DB's guard. Both creation/node/executable identities and the parent relationship
matched; the child had an exact project-owned `node_modules/tsx` public preload
path. The earlier restricted `Get-Process` absence was a conflicting capability
view and is superseded, not evidence that these processes had previously exited.
Raw command lines remained transient and were never printed or persisted.

Immediately before action, the guarded command revalidated the same CIM identities,
command/executable pins and project relationship, opened exact .NET Process handles
and checked their creation identities. **Exit0:** watch-parent17744 was stopped
first and its exit confirmed; child50916 exited with it, so **no separate child
termination** was needed. Post-action CIM found **both PIDs absent**. No other
process control, private configuration, database/session/SQL, Stripe/CLI, spending
or deployment occurred. No tests were repeated. Root and DB owner received safe
before/after evidence; DB still requires its fresh guard and separately routed
single execution scope. These two absences alone do not certify all producers.

Recovery: **no automatic restart**. Future app/worker startup remains held for its
own reviewed scope after DB readiness; no application or data restore was attempted.

## Previous preparation phase — 26 October 2026

Local application integration accepted from General Manager's TASK-024 assignment,
following the user's explicit local-app-testing request. Backend executor remains
`/root/subscription_backend`; FE owns client integration and the final integrated
typecheck, DB owns readiness/SQL. This approval covers reversible repository code
and isolated tests, **not** private-file access, app/worker startup, database/session
writes, Stripe API/CLI operations, permissions or deployment. The five earlier
account-check approvals below are exhausted.

Prepared `npm run billing:dev` through [explicit launcher](../scripts/start-stripe-local.mjs).
Its separate ignored `.env.stripe-app.local` uses the [empty profile](../config/stripe-local-app.env.example):
explicit sandbox acknowledgement, exact restricted development database target,
worker/checkout switches and `http://localhost:5000`. Credentials remain in the
existing `.env.stripe.local` with preparation flags false/test mode. Launcher does
not inherit the base `.env` database URL; ordinary `npm run dev` remains dormant.
The local launcher is deliberately bound to loopback; HTTP redirects are allowed
only with development + test + explicit sandbox context. Hosted destinations stay
HTTPS. No private files were read or edited in this integration phase.

The actual server now uses [shared middleware assembly](../server/billing/middleware.ts):
public `GET /api/billing/runtime` and raw `POST /api/billing/webhook` precede JSON,
same-origin, authentication and sessions. Browser/admin routers mount after actual
session authentication/workspace resolution. Server-side owner/support checks
remain authoritative. Startup first verifies the existing restricted audit app
principal, then DB-owner's exact 27-table/immutable-guard/portal0007 parser metadata
guard, one own-account GET and one existing portal-configuration GET. These are
**future connected operations needing their own execution scope**, not operations
performed by this preparation. Failure refuses startup; no owner fallback.

[Runtime](../server/billing/runtime.ts) advertises only verified readiness; disabled
defaults expose false/false/empty origins without database/vendor probes. New
checkout additionally requires an enabled healthy worker. Stopping new checkouts
keeps existing-subscription webhook/reconciliation/portal/manual-source behavior
available. The worker runs non-overlapping five-second polls, at most eight inbox
events and four due contracts per batch, 60-second leases, eight event attempts and
bounded backoff; uncertain creation is never retried as a new remote operation.
Signature envelopes remain durable before processing. SDK retrieval stays pinned
to `2025-06-30.basil`; normalizer supports snapshot invoice parent references and
authoritative invoice-line subscription parent references. No Stripe CLI `--latest`
or account-version change is required. Financial reads have a total 25-second
budget; incomplete history, refunds/disputes/credits/trials remain fail-closed review.

The Administration legacy writer now delegates to source-aware manual updates:
lock the stable workspace, import legacy manual provenance once, replace/revoke
manual grants only, recompute eligible paid/manual intervals and audit atomically.
Paid contracts/invoice evidence are preserved. After a source marker exists,
rollback to ordinary startup refuses legacy overwrites with503 if the source-aware
writer is unavailable. Do not remove that guard or restore old projection semantics.

Portal reservations/session IDs (never hosted URLs) are persisted and audited;
disclosure reauthorizes current ownership. Three new portal events preserve B/365
and the scoped worker unknown contract, with DB's additive portal0007 wrapper.
Referenced portal configuration must be active test mode, payment-method updates
enabled, subscription changes disabled, cancellation at period end/no proration.
These cancellation/tax/terms are acknowledged **sandbox fixtures only**. Returned
retention offers are refused; pinned SDK18 does not declare the dashboard retention
field, so dashboard retention OFF is still an explicit setup prerequisite rather
than inferred from an omitted field. No real commercial/tax policy is selected.

Verification: **15 distinct new [runtime cases](../scripts/test-billing-local-runtime.mjs)**
verified: initial13 passed, then six affected/additional cases passed, including
two new worker-health/portal-rollback regressions. **19** affected selected-policy
cases and existing audit regression (**105** invalid inputs rejected) passed.
Commands: `node --import tsx --test scripts/test-billing-local-runtime.mjs`,
`node --import tsx --test scripts/test-billing-selected.mjs`,
`node --import tsx scripts/test-audit-events.mjs`; the affected final selection used
`--test-name-pattern="named portal|manual removal|ordinary/manual|portal stores|checkout becomes|portal audit rollback"`.
The first raw-stream fixture needed a synthetic stream completion fix; its focused
rerun and complete initial suite then passed. FE's final integrated **`npm run check`
passed exit0**, including DB metadata guard and final worker-stop/listen cleanup.
Changed tracked files and explicitly named new backend files passed whitespace
checks. No port, real session/database, private config or vendor request was used.
Earlier foundation and preflight suites were not repeated; locale/UI testing stays
FE-owned en/lv/ru. No further source changes or runtime operations are planned.

Remaining execution gates: DB owner selects target and reviews/applies/rehearses
the exact source/audit profiles; then separately authorize named configuration,
local app/session/worker writes, account+portal reads, Stripe CLI login/listener
and sandbox hosted customer/subscription/payment/price effects. No connected
end-to-end result is claimed. Production remains held for real terms/tax/exception
handling/financial retention and deployment review. Unknown price creation without
an authoritative mapping and checkout creation without a known session/event stay
reserved for explicit support reconciliation; no automatic fresh-key retry exists.
Large histories or exceptional payments require review, not fabricated evidence.
Guide/next execution scope: [local testing guide](stripe-local-app-testing.md).
Recovery before execution is local code revert only. After source cutover, stop
new checkout while retaining source-aware writer/worker; preserve financial and
audit records. Never roll an imported projection back to the legacy writer.

### Earlier own-account verification history (preserved)

Quiescence identity review after DB owner's stopped preflight: under a separate
read-only Backend assignment, candidate app/node PIDs17744 and50916 were absent
from this executor's process view. Their parent/start identity and exact project
association could therefore not be established. A separate port5000 listener
metadata query was unavailable; this is **not proof of producer absence**. Neither
stale PID is a valid stop target. Obtain fresh PID/creation/parent/exact-project
metadata from the same execution host before requesting a bounded stop action;
revalidate immediately before any separately authorized stop and never restart
automatically. No process, private configuration, database, SQL or Stripe operation
was started, stopped or accessed by this review. DB executor remains stopped.

Fifth, separately approved check **passed**: the user explained Apply Changes had
not been clicked earlier and requested “Please retry again.” Existing Backend
`/root/subscription_backend` ran the unchanged guarded `--account` command exactly
once. **Exit 0**, `accountReadSucceeded:true`, `configuredAccountMatched:true`;
configuration valid, mode test, billing/new checkout disabled. This establishes
only sandbox own-account read and configured merchant equality, not broader
permissions/policy, checkout, webhook/portal/tax or operational readiness. No
identity/secret values were output, no policy was inspected, and no other API,
private file, edit, test, database/app startup or activation followed. All five
separate one-check approvals are spent. Earlier failed records remain intact.

Fourth, separately approved account check: the user supplied an error identifying
Accounts Read (`connected_account_read`) and then said “retry”. Backend
`/root/subscription_backend` ran the unchanged `--account` command **exactly once**
under the same named-file/test-key/exact-GET/10-second/no-retry/no-redirect/no-Connect
limits. Result **exit 1**, category `stripe_authentication_or_permission`; local
configuration valid, test mode, billing/new checkout disabled, no verified account
authentication/equality. Applied policy was neither inspected nor inferred from
the user report. Stopped; no other API/private-file access, config/permission edits,
database/app/activation or tests. All four one-shot approvals are spent. Earlier
outcomes are retained below without retrospective reclassification.

Third, separate retry approval: user reported “Access policy added. please retry”.
Backend `/root/subscription_backend` executed the existing guarded `--account`
command **exactly once** with the same file/test key, fixed own-account GET,
10-second bound, zero retries, no redirects/Connect and safe output. Result
**exit 1**, category `stripe_authentication_or_permission`; local configuration
valid, test mode, billing/new checkout disabled, no verified authentication/account
match. The user's policy was not inspected or edited and no exact policy scope
is inferred. Stopped with no further reads/actions, tests, writes or activation.
All three independent one-shot approvals are spent. Prior first-unknown and
second-authentication/permission results remain preserved below.

Second, separate connected diagnostic approval: the user said “yes, go ahead” to
one additional exact sandbox own-account GET under the same guards. Backend
`/root/subscription_backend` ran `node --import tsx scripts/preflight-stripe-sandbox.mjs --account`
**exactly once**. Result **exit 1**, safe category
`stripe_authentication_or_permission`; configuration valid, test mode and both
disabled flags preserved. This does not distinguish authentication from denied
permission, and account identity is not verified. No raw errors/IDs or secrets
were emitted; no retry, key/permission change, other API operation, database,
app startup or activation followed. Both distinct one-shot approvals are spent.
The first redacted attempt remains unknown. No existing tests were repeated.

One-time connected approval/result: the user said “please proceed” after the
prepared own-account check. Existing Backend executor `/root/subscription_backend`
was authorized only for one execution of
`node --import tsx scripts/preflight-stripe-sandbox.mjs --account`, using the named
file/test key, fixed `GET https://api.stripe.com/v1/account`, configured merchant
equality, 10-second bound/zero retries/no redirects/Connect and boolean-only output.
Executed exactly once: **exit 1**, local configuration valid, mode test, billing and
new checkout disabled, `connectedCheckAttempted:true`, `accountCheckSucceeded:false`.
No authentication/account match was established. Approved redaction intentionally
does not distinguish permission/network/identity causes; no diagnosis is claimed.
Stopped without retry. No other private config, request/resource, write, database,
app startup, enabled flag or deployment was used. The one-shot approval is spent;
further connected diagnostics need separate exact scope. [Current setup record](stripe-sandbox-setup.md).

Post-failure local preparation only: added enum-only failure categories for
network/timeout, Stripe authentication/permission, configured-account mismatch and
other. SDK status/type/code are inspected without messages/bodies/IDs; local
configuration success remains separate from account-check failure. Original
attempt remains unknown. Two focused mocked diagnostics checks and the two-file
TypeScript check passed. The diagnostic CLI is prepared but **not rerun**; its next
single own-account GET still requires new scope under the stop-on-failure hold.

Latest setup continuation: added pure [sandbox config parser](../server/billing/sandbox-config.ts),
one-shot read-only [own-account helper](../server/billing/sandbox-preflight.ts) and
[explicit CLI](../scripts/preflight-stripe-sandbox.mjs). Under the user's named-file
setup scope, `--local` read **only** `.env.stripe.local` once and emitted metadata:
known fields/format valid, restricted sandbox key+account present, mode test,
billing/new checkout disabled; webhook/portal/origin absent. No values were echoed
or stored. This supersedes only the earlier statement that no local reader exists;
there is still no application bootstrap or activation.

`node --import tsx --test scripts/test-stripe-sandbox-preflight.mjs`: **9 passed**
using synthetic text/maps, fake fetch and the real SDK. Cases cover disabled/test
defaults, live/public keys, activation flags, parser duplicates/expansion, redaction,
own-account mismatch, exact GET/host/path/Connect allowlist and single-attempt
failure. A targeted TypeScript check for the two new files passed after explicit
fetch parameter types. One additional targeted regression passed after preserving
valid local metadata separately from a failed connected check; no private values
or raw errors enter failure output. No previous suites were repeated.

Prepared **unexecuted** connected command and exact approval target are in
[setup note](stripe-sandbox-setup.md): one sandbox `GET /v1/account`, configured
merchant-ID equality check, 10-second bound, zero retries, no listing/writes,
redacted metadata only. Restricted permissions were neither guessed nor changed.
No other private file, database, app/session runtime or Stripe API was accessed.

Earlier empty-template preparation: an **empty** Stripe sandbox section was appended to
[.env.example](../.env.example); [setup note](stripe-sandbox-setup.md) explains the
ignored root `.env.stripe.local` destination. At that earlier stage, no private file or credential was
read/created. Fields were future-bootstrap preparation only: no environment reader,
runtime integration, endpoint, remote price creation or activation was added.

**Local implementation verified; billing remains disabled and unmounted.** This
section supersedes the earlier foundation's pending-code statements below.
Assigned Backend/executor `/root/subscription_backend` accepted the user's
[selected decisions](monthly-subscription-decisions.md). Coordinator `/root` owns
task/decision records; DB owns schema/migration/runtime SQL; Frontend owns UI and
ran the final integrated TypeScript check. Contracts were coordinated before
shared edits; no additional agents were spawned.

Delivered selected behavior:

- [authorization.ts](../server/billing/authorization.ts) and
  [service.ts](../server/billing/service.ts): verified personal owner or current
  company owner **and** owner membership; company admin is denied. Transactional
  manual-grant wait respects legacy access until explicit source import. Status
  separates paid lifecycle from effective access: manual-only Pro is billing
  `none`, with confirmed manual/effective coverage. Fixed same-target selection,
  fresh authorization and safe portal URL disclosure preserve workspace boundaries.
- [pricing.ts](../server/billing/pricing.ts): immutable EUR/month tax-inclusive
  revisions, initial1900 cents, settings CAS and exact decimal conversion.
  Administration save makes no Stripe calls or existing-contract changes.
  Checkout consent/version must match the current server offer under lock;
  existing subscribers retain their pinned offer and renewal amount.
- [stripe.ts](../server/billing/stripe.ts): installed Stripe18.3.0/API
  `2025-06-30.basil` adapter, inclusive monthly prices via durable lazy mappings,
  hosted checkout/portal, exact raw-body SDK signature verification, mode/Connect
  rejection, existing-customer reuse and fixed
  `/my-services/settings/billing?billing_return=1` return path. Unknown price/session
  creation retains its identity and cannot be retried with a fresh key.
- [lifecycle.ts](../server/billing/lifecycle.ts): real verified checkout-to-customer/
  contract conversion, atomic reservation resolution, actual invoice upserts,
  bounded contract lease, generation/revision/token/expiry CAS, source initialization
  and paid/manual projection. Current eligible periods cannot bridge unpaid gaps;
  support manual revocation preserves paid coverage. Source operations require
  explicit `sourcesReady`; the old administrator overwrite route is unchanged.
- [dispatcher.ts](../server/billing/dispatcher.ts): concrete trusted bridge from
  SDK `Stripe.Event` to durable normalized inbox, then on-demand current checkout
  retrieval/conversion and contract-pinned reconciliation. Signature acceptance
  persists before external retrieval. Customerless disputes map through the scoped
  stored charge/invoice binding. Unsupported/mismatched evidence quarantines.
  Checkout processed markers share conversion/audit transaction; invoice/projection/
  processed markers share reconciliation/audit transaction.
- [routes.ts](../server/billing/routes.ts) and
  [application.ts](../server/billing/application.ts): complete injected composition
  and readiness-gated factories for status/checkout/portal and admin offer read/save.
  No bootstrap mounts or clients are enabled. Readiness fails before auth/DB work;
  browser mutations require configured same Origin. Responses are `no-store`.
  `newCheckoutsReady` is separate from existing-subscriber processing/recovery.
- [audit.ts](../server/billing/audit.ts), [context](../server/audit/context.ts) and
  [events](../server/audit/events.ts): eleven reviewed strict billing contracts,
  named `billing-worker` actor, transaction enqueue and existing B/S365 policy reuse.
  Original event path retained; DB reviewed source/destination parity. Raw PSP/card/
  hosted URL/tax/secret data is excluded. Runtime activation remains held.

API contract matches Frontend: `GET /api/billing/subscription`,
`POST /api/billing/checkout` strict `{target,termsVersion,offerRevision,idempotencyKey}`,
`POST /api/billing/portal` strict `{target}`, and `GET/PUT /api/admin/billing/offer`.
Admin PUT is `{amount:"19.00",expectedRevision:"1"}`; stale CAS is409, currency/month/
tax-inclusive presentation fixed. Webhook factory needs raw bytes and must mount
before global JSON/session/origin middleware if later authorized. Booking payment
collection is untouched and unavailable.

Current verification:

- Combined billing run verified the existing **23 foundation cases** and15 new
  cases; HTTP fixture alone hit sandbox loopback `EACCES`. Replaced its listener
  with in-process Node HTTP streams, without escalation or socket connections.
- Final `node --import tsx --test scripts/test-billing-selected.mjs`: **19 passed**,
  including the fixed HTTP fixture and three new customerless-dispute/source-CAS/
  manual-revocation regressions. **42 distinct billing cases verified this phase.**
- `node --import tsx scripts/test-audit-events.mjs`: **passed**, preserving old
  auth/account/company/service-view behavior; **105 invalid inputs rejected**.
  New billing tests reject wrong actor/scope/target/outcome and verify365-day expiry.
  Registry count updated12->23 for the deliberate extension.
- Frontend-owned final `npm run check`: **passed, exit0**. The first run found an
  optional Stripe invoice ID; adapter now validates/narrows it with `requiredId`.
  Only the necessary failed check reran. Earlier foundation evidence is retained
  below as historical evidence.

Tests used fixed clocks, synthetic HMAC secrets/SDK responses, fake providers,
scripted PG with real Drizzle, and in-process HTTP streams. They do not prove live
PostgreSQL locks/RLS/grants, processor account settings, actual webhook delivery or
hosted acceptance. No private config, DB/session writes, Stripe API calls, charges,
spending, app/server startup or deployment occurred. Backend did not repeat UI
suites. Locale scope remains en/lv/ru; ar/RTL,zh,fr,de,hi,ja,pt,es deferred.

Exact remaining operational gates:

1. Actual bootstrap/SDK construction, authorized targets/credentials, DB/processor
   rehearsal and launch remain disabled. Portal configuration must disallow plan/
   quantity changes. Operator/tax calculation, cancellation/refund/grace terms,
   support ownership and financial/inbox retention remain unresolved. No tax rate
   or legal status was inferred.
2. DB preparations remain unapplied. Source order `0010 ->0011 ->0012 ->0013`,
   with audit0006 destination/source compatibility, follows DB's recorded workflow;
   older published pins and explicit execution holds are preserved.
3. An approved scheduler must select work, enforce attempt/backoff/dead-letter
   limits and run periodic reconciliation. Dispatcher methods are real callable
   compositions, not a running scheduler. Contract lease/CAS exists; a complete
   operational inbox retry/backoff runner is still required.
4. Unknown remote price/session creation needs reviewed discovery/recovery beyond
   processor idempotency expiry; quarantined unmatched events need reprocessing/
   support. Normal known-operation conversion exists; unknown-history recovery is
   not operationally proven.
5. Provider fetch refuses incomplete (>100invoice) histories, unsupported line
   layouts/credits/proration and uncertain/found refund/dispute evidence. Confirmed
   ordinary charge/PI no-exception cases have a tested path; exception policy and
   reviewed pagination remain gates. No fabricated refund evidence.
6. Paid source activation must coordinate the old manual overwrite writer so it
   cannot erase paid rights. Durable portal phase audit/recovery coverage also
   remains an acceptance gap; local portal owner/customer/URL behavior is present.

Official public review: Stripe's EUR-settled nonzero charge minimum is0.50 EUR and
general eight-digit ceiling999999.99 EUR; admin and UI now enforce that range.
Account settlement configuration still requires verification. Below-min invoices
can carry balances forward. [Currency limits](https://docs.stripe.com/currencies),
[Invoices](https://docs.stripe.com/api/invoices). Inclusive prices are immutable;
local durable identities outlive processor idempotency pruning.
[Prices](https://docs.stripe.com/api/prices/create),
[Idempotency](https://docs.stripe.com/api/idempotent_requests),
[Raw event verification](https://docs.stripe.com/events/manage-webhook-endpoints).
Invoice line service periods drive coverage, consistent with installed SDK18.
[Invoice object](https://docs.stripe.com/api/invoices/object),
[Hosted checkout](https://docs.stripe.com/api/checkout/sessions/create).

Recovery: revert only attributable backend/tests/scoped audit preparation, preserve
unrelated dirty work and historical evidence. No data restore is needed. Later
rollback stops new checkout while retaining existing-subscriber events, rights,
cancellation/recovery, reconciliation and financial/audit history. TASK-024 stays
open; local verification is not commercial/operational activation.

## Historical foundation — 25 October 2026

25 October 2026 (Europe/Riga). **Local foundation prepared; billing remains inactive.**
User selected [data choice 2](monthly-subscription-data-options.md). Coordinator
`/root` assigned Backend/executor `/root/subscription_backend` to implement local
provider-neutral modules and isolated tests. Accepted under AGENTS standing
cooperation; exact binding/operation/schema contract agreed with assigned DB owner
`/root/subscription_database` before edits. This extends the earlier
[design](monthly-subscription-backend-design.md), without selecting its proposed
owner-only, manual-overlap, refund or grace policies.

## Delivered behavior

| Files | Concrete behavior |
| --- | --- |
| [contracts.ts](../server/billing/contracts.ts) | Strict workspace/account/test-live bindings, price-free checkout request, server-selected monthly EUR offer, durable operation, verified-event and complete normalized snapshot shapes. No tariff/provider configured. |
| [checkout.ts](../server/billing/checkout.ts) | Fresh injected authority checks, durable reservation before external effect, stable remote idempotency key, status-only replays, unknown timeout/local-commit recovery and allowlisted HTTPS hosted URLs. Rechecks actor before external call and before returning a hosted capability. |
| [repository.ts](../server/billing/repository.ts) | Real injected Drizzle persistence for checkout reservation/completion/unknown state and verified event inbox. Locks stable workspace; blocks active contracts and unresolved checkout across keys/providers within the same workspace/mode. Transactional authorization/audit hooks are mandatory. No `server/db`, environment loading or implicit connection. |
| [events.ts](../server/billing/events.ts) | Bounded raw-byte verifier boundary; configured account/mode and event-type checks; stable allowlisted verified-field fingerprint. JSON reserialization alone does not create an identity conflict. Provider signature implementation is deliberately absent. |
| [coverage.ts](../server/billing/coverage.ts) | Strict interval math and deduplicated invoice coverage under a required explicit policy. Future starts never grant early; adjacent intervals join, unpaid gaps remain gaps, expiry is exclusive. Unpaid/reversed evidence cannot manufacture paid access. No default manual-combination/refund/grace policy. |
| [reconcile.ts](../server/billing/reconcile.ts) | Provider-neutral reconciliation workflow with required complete snapshot, exact subscription/offer/binding checks, expiry-aware lease and generation/revision commit contract. Actual claim/commit persistence remains unimplemented, tested using injected fake repository. |

**Reservation invariant:** `completed` means hosted checkout was created, not
paid/expired/converted. `resolvedAt` stays null and keeps the database slot held.
Retries, another key, or a completed hosted URL cannot create a second checkout.
Only a later verified terminal/contract-conversion transaction may resolve it;
that transaction is not implemented in this foundation. Hosted URLs are never
persisted or included in hook data.

**Event invariant:** actual persistence maps a verified customer and subscription
to an existing account/contract before incrementing its reconciliation generation.
Unknown first-event/customer/contract bindings are quarantined. Dedupe identity is
provider + merchant account + mode + event ID; identical normalized references
have no second dirty/audit effect, conflicting references quarantine. Intake never
grants Pro and cannot establish an initial paid contract on its own.

No bootstrap imports, HTTP routes, current administrator/manual writer changes,
entitlement cutover, schema edits, credentials, processor adapters, database access,
session writes, external calls or deployment occurred. DB owns its separately
reported additive schema/migrations/runtime parity. Package scripts were unchanged;
run the focused commands directly.

## Verification and evidence limits

- `node --import tsx --test scripts/test-billing-domain.mjs scripts/test-billing-repository.mjs`
  — **23 passed**. Covers price/redirect tampering, workspace/account/mode denial,
  authorization changes, same/different-key concurrency and post-URL retries,
  ambiguous remote/local failures, safe hosted URLs, event verification boundary,
  duplicate/conflicting/unmapped events, period gaps/expiry, stale generation/
  revision/lease, explicit policy review, and transaction/audit failure paths.
- The integrated `npm run check` initially found one new implicit-target issue
  iterating a Map. Replaced that loop with `Array.from`; affected coverage tests
  reran with `--test-name-pattern="current interval|duplicate invoices"`: **2 passed**.
  Final integrated `npm run check` — **passed, exit 0** after DB's stable schema.
- Repositories were tested through a scripted in-memory PG transport plus actual
  Drizzle builders; reconciliation uses a fake repository. These are offline unit
  checks, **not** PostgreSQL execution, uniqueness/locking/RLS proof, a real
  signature check, hosted-session acceptance or operational audit evidence.
- No locale/browser checks were relevant. Future language verification remains
  **en/lv/ru**; ar/RTL, zh, fr, de, hi, ja, pt and es stay deferred. Historical
  evidence and translations remain unchanged.

## Concrete next implementation gates

1. **Initial conversion/recovery:** implement verified checkout/customer/contract
   binding and `resolvedAt` release atomically with protecting the subscription
   slot. Reconcile unknown creation, first-event quarantine and expired sessions
   before allowing replacement. Current adapter deliberately does not solve these
   remote lifecycle transitions or issue portal sessions.
2. **Persistent reconciliation:** implement real bounded lease claim, full
   generation/revision/token/expiry CAS, invoice upserts and processed markers.
   Current normalized snapshots describe interval/status evidence only; persistence
   additionally needs actual currency/decimal-string invoice amounts and payment/
   refund/dispute references. Do not fabricate zeros or drop historical evidence
   to satisfy schema requirements. Preserve future-start scheduling and periodic
   reconciliation even when a webhook is missed.
3. **Runtime authorization and sources:** supply reviewed transaction-bound
   authorization/overlap policy and source-aware manual/paid projection. No
   application support role or company manager permission automatically authorizes
   financial access. Existing admin `free` semantics are untouched until a safe
   approved cutover/backfill exists. Source updates, invoice changes, audit enqueue
   and processed markers must commit together; never activate the old overwrite
   writer alongside paid entitlement updates.
4. **Audit contract:** implement the reviewed billing events/service identity and
   actual transaction enqueue behind the mandatory `recordChange` hook. A no-op
   production hook would violate this contract. Existing validators currently
   reject these billing event/component/target/actor shapes; do not cast or bypass
   them. Hook failure rolls back local persistence; remote success remains an
   uncertain durable operation requiring reconciliation.

These are concrete implementation gaps, not renewed requests to select data
choice 2. Vendor-specific adapter, secrets, test/live targets, connected
verification, price/VAT/terms, financial retention, support and activation still
require their applicable decisions/authority. No commercial defaults are encoded.

## Coordinated audit recommendation

Backend and DB agreed this **proposal** is compatible with the existing direction:

- Versioned `billing.checkout_reserved.v1`, `billing.checkout_created.v1`,
  `billing.checkout_unknown.v1`, `billing.event_accepted.v1`,
  `billing.event_quarantined.v1`, `billing.subscription_reconciled.v1` and
  `subscription.manual_grant_changed.v1` producers. Keep a phase outcome truthful:
  hosted-session creation is not paid entitlement or complete subscription launch.
- Human checkout/manual actions retain the verified user and actual workspace;
  reconciled processor evidence uses a named system/job principal `billing-worker`
  established by server configuration and verified adapter execution, never a
  request-body role or invented anonymous/user identity. Add an explicit `billing`
  component and workspace-bound operation/subscription/grant targets to both
  source/destination contracts; correlate remote event IDs as bounded references.
- Reuse selected [P1](audit-event-catalog.md#proposed-retention-and-safe-field-profiles)
  **B/365 days** where its catalog already includes subscription/admin business
  changes, and **S/365 days** for security/signature/identity-integrity incidents.
  This does not extend financial/inbox retention or select a new audit policy.
  Preserve original trusted occurrence/expiry on replay. Routine job counts may
  wait; do not add an unsupported retention class to the current runtime.
- Allowlist internal references, safe state changes and stable reason codes only;
  exclude raw provider bodies, cards, URLs, tax/billing identity and secrets.
  Register actor/event/target/field validation, source/destination SQL compatibility
  and producer tests before enabling instrumentation. Domain inbox stays separate
  from the audit outbox. Existing audit execution/stop/deployment holds persist.

Recovery: remove only the new dormant backend files/tests and this handoff to undo
this preparation, preserving unrelated dirty work. No data restore is needed.
After any future activation, disable new checkout while keeping current-subscriber
events, cancellation/support, reconciliation and financial/audit records available.
TASK-024 remains open; coordinator owns decisions/next assignment, DB owns its
schema/deployment evidence and Backend owns the implementation gaps above.
