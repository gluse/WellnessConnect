# TASK-024 — Monthly subscription data options

**27 October execution update:** the approved development-only schema/runtime and
billing/portal audit migrations were committed and verified on the exact selected
source/destination. See [safe execution evidence](monthly-subscription-database-execution-evidence.json)
and [DB handoff](monthly-subscription-database-handoff.md). App/processor activation
and end-to-end acceptance remain separate. The dated design analysis below is
historical; it does not assert the current code or live schema are still missing
the prepared billing/audit additions.

Prepared 25 October 2026 (Europe/Riga). **User selected choice 2; dormant local
expansion prepared.** Implementation evidence and remaining gates are in the
[DB handoff](monthly-subscription-database-handoff.md).
Requester/coordinator: `/root`; assigned DB Analyst/Developer/executor:
`/root/subscription_database`. Accepted the scoped read-only repository analysis and
this Markdown deliverable under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Used [PostgreSQL practices](../.agents/skills/postgresql-practices/SKILL.md).
The user selected “Recommend choice 2 for paid recurring access” on 25 October.
That fulfills the architecture selection hold and authorizes the assigned DB
owner's reversible local dormant expansion preparation and offline checks.
Later selected policies are recorded in the
[25–26 October decisions](monthly-subscription-decisions.md): Stripe, owner-only
company billing, waiting for manual expiry, initial EUR19 including tax, and
Administration amount changes for new subscriptions only. Existing contracts
retain their agreed immutable revision. Connected execution, private configuration,
processor access and deployment approvals remain separate.

## Repository evidence and problem

- [Current definitions](../shared/schema.ts) and [0007](../migrations/0007_pro_storefronts.sql)
  give `provider_subscriptions` one row per individual/company workspace, with an
  exclusive user/company identity, `plan`, `pro_until` and latest administrator
  attribution. `storefronts.subscription_id` references that stable row ID.
- [Administrator writes](../server/storefronts.ts) currently overwrite the entire
  entitlement. [hasPro](../shared/storefront.ts) requires `plan=pro` and a future
  expiry; public storefront reads and other queries rely on this projection.
  Existing expiry preserves storefront content/publication and booking access.
- There is no declared processor customer, subscription, invoice, durable checkout
  operation or event inbox in these definitions. Current rows do not distinguish
  manual grants from paid access. This is source evidence, not live-data inventory.
- [Audit capture](../server/audit/capture.ts) can enqueue using the same domain
  transaction. Its [event registry](../server/audit/events.ts) and
  [context](../server/audit/context.ts) currently reject billing event/component/
  target types and have no system actor. Existing restricted-runtime grants and
  table filters explicitly enumerate objects; new billing tables are not covered.

Reuse the [monthly brief](monthly-subscription-brief.md), not the full marketplace
ledger from the earlier [payment plan](payment-processing-plan.md). Names below
are proposed contracts, not migration-ready definitions or verified live objects.

## Two practical designs

| Choice | Data shape | Benefit / cost |
| --- | --- | --- |
| **1 — Compact workspace billing state** | Extend the existing entitlement row with separate manual expiry/revocation metadata. Add `workspace_billing` with current customer/subscription/period snapshot; `billing_operations`, `billing_events` and `billing_invoices` for durable requests, inbox and paid evidence. Retain superseded subscription references in those history records. | Fewer tables and joins; sufficient for one monthly offer. Current and historical subscription state are less distinct, so replacements, reconciliation and source-specific corrections need more custom logic. Never reduce this to processor IDs plus one mutable Pro date. |
| **2 — Separate billing records and grant sources (recommended)** | Keep the entitlement row as compatibility projection. Add `billing_accounts`, `billing_subscriptions`, `billing_invoices`, `billing_operations`, `billing_events` and `manual_pro_grants`. | Clear source ownership and historical subscriptions; grant edits cannot overwrite paid evidence. More local mappings/constraints and migration work, but bounded to subscription billing; no balances, booking payments, connected accounts or payout ledger. |

Both choices need the same event/retry/concurrency controls and runtime/audit
extension. Choice 1 saves initial schema surface; choice 2 reduces ambiguity when
an old canceled contract emits late events or support adjusts a manual grant.
Recommend **choice 2** for paid recurring access.

## Recommended records and invariants

Use `provider_subscriptions.id` as the workspace anchor; retain its user/company
constraints and storefront references. A company account follows company identity,
never its current owner's personal identity. Do not merge customers by email.

| Record | Required contract |
| --- | --- |
| `billing_accounts` | Workspace FK; processor, merchant-account reference and test/live mode; processor customer ID; created/updated instants. Unique workspace + processor + merchant + mode, and unique customer within that processor/account/mode. A customer cannot be attached to another workspace. |
| `billing_subscriptions` | Billing-account FK; unique processor subscription identity within account/mode; approved price/currency/interval snapshot; normalized lifecycle, processor status, current period bounds, confirmed paid-through, cancellation flag, reconciliation generation/time. Retain ended contracts. Enforce at most one nonterminal paid-contract slot per workspace/environment, including incomplete/past-due/cancel-at-period-end contracts. A new processor/account cannot bypass that slot. |
| `billing_invoices` | Subscription FK; unique processor invoice identity within account/mode; currency, integer minor-unit amounts, invoice/payment status, covered period, payment/refund/dispute references and reconciliation time. Record corrections without deleting the original payment evidence. Not a general accounting ledger. |
| `billing_operations` | Workspace, operation UUID/idempotency key, kind, request fingerprint, requested approved offer, initiator, state, processor object references, timestamps and safe error code. One unresolved checkout reservation per workspace/environment. Reusing a key with another workspace/offer/payload fails. Store uncertain outcomes for reconciliation. |
| `billing_events` | Unique processor + merchant + mode + event ID; bounded verified event type/object references, received/occurred times, payload fingerprint, processing state, attempt/lease/generation metadata, safe failure code and operation linkage. A mismatching payload for the same event identity is quarantined. |
| `manual_pro_grants` | Workspace, source (`legacy_manual` or authorized administrator grant), effective start/expiry, issuer, issued/revoked instants and reason/reference. Preserve provenance; revocation affects that source only. No processor customer or payment is invented for old grants. |

Child FKs must preserve account/workspace/mode agreement, rather than merely
proving that an ID exists. Enforce positive/ordered period bounds, approved state
values and explicit currency/amount rules. Use instants with time zone for periods,
leases and timestamps. No cascading deletion of billing/grant history on workspace
closure or owner change; account-erasure/retention treatment needs a separate policy.

Only the deployment's explicitly configured authoritative processor/account/mode
may update its entitlement projection. Sandbox events never grant live application
rights. Prefer isolated test/live targets; storing both modes in one database does
not make a shared unscoped projection safe. Enforce this in worker selection and
the projection write boundary, not merely webhook intake.

Store allowlisted event fields required for processing and safe reconciliation,
not raw unbounded webhook bodies, card data, hosted-session secrets or invoices'
personal billing/address fields. Keep provider references private to authorized
billing responses/support. Durable operation/event/invoice identities must survive
payload expiry so an old event cannot renew access twice. Exact retention and
redaction periods remain a policy decision before activation.

## Processing and recovery contract

1. **Checkout:** Backend authorizes the current actor for the resolved workspace,
   ensures/locks its stable entitlement anchor and checks the contract slot.
   Reserve a durable operation in a short transaction before contacting the
   processor. Release the lock before network I/O. Use that operation's stable
   remote idempotency key; save returned identities in a second transaction.
   Concurrent requests return the existing operation/status. A timeout or expired
   local lease does not prove that remote checkout failed: mark unknown and
   reconcile before permitting replacement. Recheck rights before returning a
   hosted URL; never return another actor's stale session merely because the
   workspace reservation exists.
2. **Intake:** Verify authenticity and account/mode server-side before insertion.
   Acknowledge only after the verified event is durably recorded (or recognized
   as an identical duplicate). DB failure is retryable, never an acknowledged
   lost event. Event dedupe alone is insufficient: different event IDs may refer
   to the same invoice/business effect, protected by invoice/operation identity.
3. **Reordering:** Mark the subscription dirty/increment its reconciliation
   generation. Claim a contract reconciliation lease and capture its projection
   revision before fetching current processor subscription plus relevant
   paid-invoice evidence outside the transaction; event creation time alone is
   not ordering authority. Lock the workspace/contract, compare generation,
   projection revision and lease token, and apply only if all are still current;
   increment projection revision on every successful reconciliation. Otherwise
   fetch again. This also prevents two workers for the same generation applying
   their snapshots in reverse order. Serialize all
   webhook, scheduled reconciliation and manual-grant projection writers by the
   same workspace lock. Persist completion and projection in that transaction.
   The selected provider adapter must define snapshot freshness; where it cannot
   prove order, keep the record pending and reconcile rather than overwrite a
   newer state with an old payload. Scheduled reconciliation repairs missed
   notifications and remote-success/local-timeout gaps.
4. **Entitlement:** Proposed policy is `pro_until = max(valid manual expiry,
   confirmed paid-through)` over eligible source intervals containing now and
   their contiguous confirmed coverage; set `plan=pro` when that coverage exists,
   otherwise `free`. Retain source starts/ends: a paid future interval cannot
   grant early or bridge an unpaid gap. Recompute when future coverage becomes
   due. Apply processor calendar-month period instants,
   never add 30 days or add one month per event. Checkout redirect, active status
   alone, unpaid invoices and failed renewals grant nothing. Period-end
   cancellation keeps confirmed access. Refund/dispute/revocation corrections
   recompute the paid source from retained evidence under approved policy; do
   not make paid-through an irreversible maximum. A manual grant still stands
   unless separately revoked. Preserve both sources' valid rights; no blanket
   paid revocation or refund policy is inferred. The selected policy blocks new
   paid checkout while a valid manual grant exists; do not consume it as credit.
5. **Manual administration:** Change the existing overwrite path to grant/revoke
   manual sources and recompute the projection atomically. Choosing Free cannot
   silently cancel a processor contract or remove paid access. Any immediate
   all-source suspension needs a distinct approved policy and UI contract.

Keep lease expiry/retry counts bounded and stale workers unable to commit.
Quarantine identity, currency, price or period conflicts for a named support
owner; do not repair by fabricating a new payment. Processor reconciliation and
retries require their own later target/access authorization.

## Runtime permissions and audit compatibility

Enable RLS and deny browser `PUBLIC`/`anon`/`authenticated` access to all new
tables/sequences. Extend only the named restricted application runtime's required
SELECT/INSERT/UPDATE and sequence privileges, with role-specific policies;
no DDL, broad DELETE, TRUNCATE or BYPASSRLS. Express still owns per-workspace
authorization: an all-row server-role policy is not tenant isolation. Billing
workers, if separate, receive only their required processing scope. Never switch
to owner credentials to bypass the existing allowlist. DB owns explicit schema,
runtime-grant, setup/filter/transfer-list parity and permission rehearsal.

Billing intake is a durable domain inbox, **not the audit delivery outbox**.
Define billing event names, system/processor actor semantics, workspace/target,
allowlisted changes and retention with Backend and DB before instrumentation.
Extend both source/destination validators and runtime contracts deliberately;
do not label a processor event as a human/anonymous event to fit today's schema.
For local billing/grant/projection changes, enqueue the approved audit event on
the same transaction and roll back on audit enqueue failure. Mark the inbox
processed only with that commit. Remote checkout/cancellation cannot be rolled
back by an audit failure; retain the durable operation, report unknown/pending,
reconcile and record the true eventual outcome. Existing audit deployment and
failure/stop policies remain in force.

## Selection, implementation order and checks

**Architecture and launch policy selections fulfilled:** choice 2 and the
25–26 October decisions are reflected in the prepared expansion and local
contracts. Forward audit billing-worker validation is also prepared using existing
B/S365 retention. Financial/inbox retention and refund/grace/immediate-revocation
terms remain open. Connected verification and activation remain separate from
local source-aware repository preparation.

**Needed before activation/connected verification:** processor/account and approved
EUR monthly offer, price/tax/renewal/refund/dispute/grace terms, billing actor
permissions, retention policy, support/reconciliation owner, exact targets and
execution approval. Prototype policy defaults must not become chargeable terms.

After selection, DB prepares versioned expansion migrations, matching Drizzle
definitions and explicit runtime policies; Backend prepares consumers and source
writes. Inventory legacy rows only in an approved environment. Backfill existing
Pro expiries as `legacy_manual`, retain original attribution (unknown remains
unknown), preserve stable IDs/content/publication and validate row counts and
projection equality. Pause/restrict legacy administrator writes during the
backfill/cutover, or atomically dual-write; avoid an untracked race. Deploy
compatible reads first, then source-aware manual/paid writers; enable checkout
only after integrity, authorization and event/audit checks pass.

Required future isolated checks: legacy migration/expiry equality, cross-workspace
FKs and RLS using actual runtime roles, concurrent checkout/timeout recovery,
same/different-event invoice duplicates, reordered renewals/cancellation/refunds,
stale worker CAS, transaction/audit rollback, manual-grant overlap/revocation,
future-start/unpaid-gap boundaries, test/live projection isolation, company transfer
and non-destructive closure. Offline mocks do not establish SQL
atomicity or live grants; connected rehearsal and fixtures require later approval.
No application/database tests ran for this design. Any locale checks are **en/lv/ru
only**; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred, with existing
translations and historical evidence preserved.

Recovery: revert only this documentation before selection. Later deployment
recovery disables new checkout while preserving inbox processing, cancellations,
reconciliation and paid/manual access; retain expanded tables and evidence.
Do not roll back to the old administrator overwrite writer after paid sources
exist. DB-owned repair requires a reviewed snapshot/reconciliation plan; dropping
tables or restoring an old projection would lose billing truth.

Backend contract coordinated directly with `/root/subscription_backend` on
25 October 2026; choice 2 preserves its workspace projection, durable operation,
invoice/event dedupe and reconciliation requirements. Local package and offline
evidence are in the DB handoff. Next: resolve only missing source/audit/commercial
decisions and target-specific verification scope. TASK-024 remains open.
