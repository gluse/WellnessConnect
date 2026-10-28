# TASK-024 — backend subscription design

Prepared 25 October 2026 (Europe/Riga). **Design completed; live implementation pending.**
After the user's choice-2 selection, a scoped dormant local foundation was prepared;
see its [implementation/evidence handoff](monthly-subscription-backend-handoff.md).
Requester/coordinator: `/root`; assigned Back End Developer/executor:
`/root/subscription_backend`. Accepted the scoped dependency under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization):
source reads and this local Markdown file only. No application/configuration/schema
changes, credentials, processor/database access, charges, or tests are authorized
by this design. Product scope and unresolved commercial terms remain in the
[brief](monthly-subscription-brief.md); vendor is unselected and EUR 19 is hypothetical.

## Existing behavior and concrete gaps

| Source at review | Reuse / required change before billing |
| --- | --- |
| [shared/schema.ts:80](../shared/schema.ts#L80) | One nullable user/company target, unique workspace row, `plan`, `proUntil`, `updatedBy`. No billing customer, paid-period evidence, event deduplication or independent manual-grant source. Keep the row ID stable because storefronts reference it. |
| [shared/storefront.ts:35](../shared/storefront.ts#L35), [server/storefronts.ts:9](../server/storefronts.ts#L9) | Pro requires expiry strictly after now; public storefronts additionally require publication and active company. Preserve content and publication flag on expiry. |
| [server/storefronts.ts:37](../server/storefronts.ts#L37), [server/storefronts.ts:85](../server/storefronts.ts#L85) | Storefront writes lock entitlement, but current admin update directly overwrites it. Both paid projection and manual-grant updates must serialize on the same stable workspace row. |
| [server/companyAccess.ts:11](../server/companyAccess.ts#L11), [server/companyRoutes.ts:40](../server/companyRoutes.ts#L40) | Manager permissions include company owners and admins; workspace middleware runs before route authentication. Billing must resolve fresh authority after verified identity and use its own permission. |
| [server/auth.ts:344](../server/auth.ts#L344), [server/auth.ts:100](../server/auth.ts#L100) | Reuse verified `getUser` identity. Retain browser origin protection; explicitly test missing-origin/Fetch Metadata cases for new sensitive mutations. |
| [server/index.ts:23](../server/index.ts#L23), [server/routes.ts:83](../server/routes.ts#L83) | Global JSON parsing precedes authentication/origin/session setup. Dedicated signed-event raw-body handler must be registered earlier. |
| [server/payments.ts:3](../server/payments.ts#L3) | Appointment payment route deliberately returns 501. Subscription routes are separate and must leave it unavailable. |

## Proposed API and authorization contract

Use a new `/api/billing` browser namespace. Explicit `target` uses the existing
strict `{kind:"user",id}` / `{kind:"company",id}` shape. Treat target as a selector,
never authority; require it to match the freshly resolved selected workspace.
This makes a delayed request fail after workspace switching instead of buying
for an unintended workspace. Return resolved target on every success.

**Recommended policy, awaiting user selection:** personal billing only for the
verified user in their personal provider workspace; company financial details,
checkout and management only for the current owner. Require active company,
current `owner` membership and matching `companies.ownerId`; fail closed on an
inconsistent transfer. Company admins/providers/viewers and app support receive
no implicit billing-management permission. Extending this to company admins is
a product/security choice, not reuse of `manageServices`. An inactive company's
owner needs a narrowly scoped cancellation/support path so deactivation cannot
trap a paying subscriber; exact access must be agreed before activation.

| Proposed operation | Behavior |
| --- | --- |
| `GET /api/billing/subscription?kind=…&id=…` | Authorized status only: workspace, approved monthly offer, currency/tax presentation, billing state, confirmed paid-through, effective Pro expiry, cancel-at-period-end, pending operation and recovery availability. Never return secret or hosted-session tokens. |
| `POST /api/billing/checkout` | Strict `{target,termsVersion}` plus bounded `Idempotency-Key`. Server selects approved monthly EUR price and quantity 1; validate terms version against current published terms. Reject amount, price/customer/subscription IDs, annual interval, arbitrary return URLs and unknown fields. Return short-lived hosted URL or an existing-operation/status response. |
| `POST /api/billing/portal` | Strict `{target}`; server retrieves workspace-bound customer/account/mode, issues hosted management session with fixed return origin. Restrict portal catalog to the approved monthly offer and approved cancellation/payment-recovery features. No plan switches into deferred offers. |
| `POST /api/billing/events/:provider` | Dedicated bounded raw-body signature verification, independent of browser sessions/origin/workspace. Provider adapter validates account, mode, event type and schema; route selector never chooses credentials arbitrarily. Durably accept before 2xx; invalid signatures 400, persistence unavailable 503. |

Browser routes require verified authentication, current membership checks,
`Cache-Control: no-store`, bounded rate limits and controlled async errors.
Return 401 for absent/expired identity, 403 for unauthorized workspace, 400 for
invalid input, 409 for conflicting checkout/state and 503 for unavailable billing.
Checkout/portal URLs are capabilities: no logs, analytics capture or persistence
in general audit payloads. Recheck authority before each new external operation.
After transfer, the company retains customer/subscription identity; a previous
owner gets no new portal session. Vendor evaluation must establish session
expiry/revocation behavior and transfer procedures; local access checks alone
cannot revoke an already issued hosted session.

## Durable checkout and event processing

Agree the [database options](monthly-subscription-data-options.md) before definitions
or migrations. DB owner confirmed this proposed contract on 25 October:
separate billing history, operations/events/invoice evidence and manual grants;
retain `provider_subscriptions` as compatibility projection, with one nonterminal
paid subscription and one unresolved checkout operation per workspace/environment.

1. Under a short workspace lock, reauthorize and reserve one checkout operation.
   Bind its server operation ID, actor, workspace, mode, offer and terms version
   to request fingerprint/idempotency key. Same key/different payload is 409;
   another key cannot bypass the workspace reservation. Reauthorize before
   returning hosted URLs; a different actor receives safe operation status,
   never the previous actor's stored hosted session. Do not hold DB locks during
   network calls.
2. Use the durable operation ID for provider idempotency. Persist returned remote
   identifiers. A timeout after remote creation is `unknown`, not failed: retain
   reservation and reconcile by operation reference before retrying or creating
   another checkout. An expired local request does not prove remote checkout
   expired. Only confirmed remote terminal state releases its reservation.
3. Signature-verified delivery inserts a unique inbox key
   `(provider,account,mode,eventId)`. Validate that subscription/customer and
   server operation binding match the intended workspace; metadata alone grants
   nothing. Only the deployment's configured authoritative billing account/mode
   may change its entitlement projection; test events never grant live rights.
   Quarantine unknown/mismatched references. Duplicate deliveries have
   no extra business effect. Deduplicate invoice/period credit separately because
   distinct events can describe the same invoice.
4. Mark the subscription dirty/increment its reconciliation generation. A bounded
   worker retrieves current provider subscription **and paid invoice evidence**
   through a fixed provider adapter. Do not order state by arrival time or event
   creation timestamp. Capture generation and projection revision before fetching;
   compare both under the workspace lock and increment revision on every commit.
   If either changed, discard the snapshot and fetch again. This also prevents two
   workers on the same generation applying their snapshots in reverse order.
   Serialize invoice evidence, source changes, projection, event processing status
   and audit enqueue in one transaction. Scheduled reconciliation covers missed
   deliveries and provider changes during a fetch.
5. Inbox acknowledgement proves durable acceptance, not granted entitlement.
   Retry transient failures with bounded backoff; retain exhausted work and alert
   the assigned support/operations owner. A crash after commit must replay safely.
   Processor retry windows do not replace permanent local business deduplication.

## Entitlement state and manual grants

Use authoritative calendar-month period instants, never `now + 30 days`.
`active` or a checkout completion alone does not prove an invoice paid. No trial,
coupon, annual, usage or appointment-payment behavior belongs in this adapter.

| Situation | Proposed local result |
| --- | --- |
| Initial payment/renewal confirmed | Record unique invoice evidence and eligible paid interval; project confirmed paid-through. Return redirect only polls server state and never writes Pro. |
| Authentication required / payment failed | Preserve already paid access to its end; expose recovery state and hosted action. Do not extend on an unpaid renewal. Grace/retry terms remain a commercial decision. |
| Cancellation at period end | Mark confirmed cancellation and display end date; keep access through confirmed paid-through. Resume only after verified provider state; no local flag alone restarts charging. |
| Expired/cancelled | Effective expiry gates storefront visibility/writes without deleting content, bookings or history. No background job is needed merely to make `hasPro` false. |
| Refund/dispute/immediate termination | Retain financial history, reconcile and route exception to support; entitlement reduction requires the selected policy. Do not automatically keep a historical maximum after evidence is reversed. |

**Manual-source proposal, not selected policy:** represent legacy manual grants
separately and compute effective expiry from non-revoked manual coverage and
eligible paid coverage containing now. Track interval starts as well as ends:
future payment cannot grant early or bridge an unpaid gap; only overlapping or
contiguous eligible periods can extend current coverage. The maximum end applies
only within that current coverage, not across every historical/future period.
Recompute from sources (including revocations), rather than monotonically
increasing the old projection. Future coverage needs a due recomputation at its
start, with delayed processing visible as a recoverable pending state.
Preserve existing storefront subscription IDs. Existing admin `free` should
revoke the manual source only; it must neither cancel a processor subscription
nor erase paid rights. Admin grants remain app-support-only via
[requireAppAdmin](../server/appAdmin.ts#L10), with actor/reason audit.

Prepare a reviewed, reversible legacy backfill treating current Pro as manual;
do not infer historical payment or bill retrospectively. Until overlap behavior
is selected, recommend disabling new paid checkout during a valid manual grant
and showing the grant end date. Charging immediately, delaying paid start, or
carrying manual credit has different customer/financial consequences and needs
an explicit choice before activation.

## Audit, reconciliation and delivery gates

Current audit [event allowlist](../server/audit/events.ts#L8) and
[context](../server/audit/context.ts#L6) have no billing event, billing target,
component or verified service actor; [requestAuditContext](../server/audit/http.ts#L63)
constructs personal auth/account/authorization context. Do not cast billing into
an unrelated event or pretend a webhook was a user action. Backend and DB/audit
owners must agree versioned checkout, subscription/entitlement change, manual
grant and reconciliation events; service identity, fields, retention, DB enqueue
validation and worker/destination compatibility are prerequisites. Preserve any
existing audit activation/execution holds.

For local business mutations use the transaction-owned
[enqueueDrizzleAudit](../server/audit/capture.ts#L32); audit failure rolls back
projection/processed marker and leaves durable work retryable. Remote effects
cannot be rolled back: checkout intent must be durable first, and unknown outcomes
must reconcile. Store only bounded workspace/actor/operation/event/invoice
references and approved state fields; no card data, raw provider payloads, hosted
URLs, tax identities or secrets in audit. Financial and audit retention/deletion
policy needs its own owner decision.

Scheduled reconciliation compares local subscriptions, outstanding checkout
operations, paid invoices, cancellations, refunds and disputes against provider
state; repairs use the same deduplicated projector and audit transaction.
Unmapped customer, duplicate remote subscription, wrong offer/mode/currency or
unexplained paid-through changes become exceptions, not silent grants/cancellations.
Human finance/support owner, alert destination, cadence and runbook must be named.

**Before material local implementation:** select the database option and billing
permission/manual-source policy; agree billing audit actor/event/retention contract
with its owners. Provider-neutral pure logic and mocked-contract preparation can
be scoped separately; vendor-specific adapters wait for vendor selection.

**Before chargeable configuration or activation:** select vendor/operator, actual
price/VAT and terms, overlap/grace/refund/dispute rules, support owner, launch cohort
and budget. An owner-only recommendation or manual-overlap recommendation here
does not authorize adoption. CI/CD prepares test/live separation, raw-body ingress,
worker scheduling/monitoring and recovery; connected checks, secrets and activation
require later scoped execution authority. Final price/operating terms do not block
all local implementation once the relevant contracts and scope are accepted.

## Verification, limits and recovery

This handoff used targeted repository reads and documentation review only.
No application tests, network calls or connected operations ran. Future isolated
tests inject clock, repository and provider adapters: personal/company cross-scope
denials, transfer/revocation races, stale workspace, owner/admin policy, price and
return-URL tampering, same/different-key concurrency, unknown checkout result,
signature/account/mode rejection, duplicate invoice credit, reversed event order,
stale fetch generation, renewal/failure/cancel/expiry boundaries, manual overlap,
refund corrections, and crash/audit rollback replay. Inspect runners/imports first.
Mocked tests cannot prove database locks/uniqueness, live signatures or hosted
session controls; those checks await separate DB/processor scope.

Frontend owner receives the API/state contract for accessible desktop/mobile
flows and **en/lv/ru** verification only. ar/RTL, zh, fr, de, hi, ja, pt and es are
deferred; preserve historical evidence and supported translations.

Recover this preparation by reverting only this new document. Later operational
rollback disables new checkout while preserving existing-subscriber events,
cancellation/recovery, reconciliation, paid rights and audit/financial records.
Next: coordinator presents the concrete choices; owners implement and verify
within the selected scope. TASK-024 remains open.
