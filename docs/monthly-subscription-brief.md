# Monthly Pro subscription launch — TASK-024

Prepared 23 October 2026, Europe/Riga, from the user's instruction: “Lets start
with proposed option A, where at the beginning there is only monthly subscription”.
The user selected the business model and monthly-only launch scope. This brief
prepares delivery; application implementation and commercial launch are pending.
References: [business comparison](payment-business-plan.md),
[technical plan](payment-processing-plan.md), [existing Pro rules](pro-storefronts.md),
and [task record](../TASKS.md#billing).

## Selected scope

- Sell FitsMyTime Pro software access to an individual or company workspace,
  with one monthly offer and one active paid subscription per workspace.
- Preserve the existing workspace entitlement boundary: company Pro belongs to
  the company, not each employee or the owner's personal workspace.
- Begin in Latvia with explicit EUR subscription pricing. Expansion direction
  remains the other Baltics, then the UK, then further markets after launch gates.
- Customer browsing and ordinary bookings remain free of platform booking fees.
  Providers collect appointment payments separately.
- Defer annual plans, deposits, appointment checkout, booking commissions,
  acquisition fees, provider connected accounts and payouts. Trial, coupon,
  usage-based and multi-tier billing are outside the initial brief.
- Reuse existing Pro storefront value and expiry behaviour; do not introduce
  additional premium features as a prerequisite to billing.

## Proposed delivery behaviour

These are implementation recommendations for owner review, rather than additional
commercial terms already approved by the user.

| Situation | Acceptance direction |
| --- | --- |
| Starting a subscription | Authorize the current owner for the selected workspace server-side; company administrators cannot manage billing. Show the monthly price, currency, inclusive tax presentation, recurring renewal and approved cancellation terms before hosted checkout. |
| Monthly renewal | Use a calendar-month billing interval, with processor-defined period boundaries stored as authoritative instants; do not implement a fixed 30-day interval. |
| Price selection | Server chooses the approved monthly price identifier. Reject browser amounts, arbitrary price IDs, annual intervals, wrong currency and test/live identity mismatches. |
| Successful payment | Update paid Pro entitlement from verified, reconciled billing state. A success redirect alone never grants or extends access. |
| Duplicate checkout/events | Prevent duplicate active subscriptions and duplicate entitlement changes across retries/concurrent requests. Handle duplicate, delayed and out-of-order events durably. |
| Payment failure or required authentication | Display the actual billing state and a hosted recovery action. Do not silently extend paid access on failed renewal. Agree retry/grace policy before activation. |
| Cancellation | Recommend cancellation at period end, with paid access until the confirmed paid-through instant and a visible end date. Subscription refund and immediate-revocation exceptions need an approved policy. |
| Expiry | Preserve existing storefront content/publication setting; apply existing expiry visibility rules. Existing marketplace services, bookings and history remain available. |
| Existing manual Pro | Preserve valid manual grants and wait for their expiry before allowing paid checkout. Do not replace them with paid access, charge during active granted access or bill retrospectively. |
| Ownership/access changes | Company subscription stays with the company. Recheck billing-management rights after ownership or membership changes; customer/portal identities cannot grant cross-workspace access. |
| Support and reconciliation | Link workspace, processor customer/subscription, invoice and event references without card data or secrets. Reconcile subscription payments/refunds/disputes; assign a human exception owner. |

Use hosted checkout and billing management with the selected Stripe integration.
Processor access, configuration and runtime activation remain separately gated.
Subscription billing must not activate the unavailable appointment-payment route.
Subscription currency and invoices must be explicit; converting historical booking
amounts or relabelling their currency is outside this task.

## Remaining commercial inputs

**25 October update:** user selected Stripe, owner-only company billing, waiting
for manual grants to expire and EUR 19/month including tax, with the amount
configurable through Administration. See the authoritative
[decision record](monthly-subscription-decisions.md) for scope, price-versioning
question and remaining execution/launch gates. The earlier price hypothesis
below is historical and is superseded by this selection.

The selected initial tariff is **EUR 19/workspace/month including tax**, editable
through Administration. New revisions affect only new subscriptions; existing
subscribers keep their agreed price. This does not establish a VAT rate or tax
registration. Confirm the operating entity, initial provider segment, processor/account
eligibility and full quote, invoice/tax treatment, refund policy, failure grace,
support owner and budget. This brief does not select a tax rate or legal status.

Do not wait for appointment ticket sizes, provider deposit economics, marketplace
attribution or Connect payout design to scope this subscription release. Those
questions belong to the deferred models.

## Owner handoff and next work

**25 October 2026 start:** the user's TASK-024 request has been routed to assigned
Backend and DB owners for source-grounded design and data options. See the
[coordination record](agent-coordination.md#task-024--monthly-pro-subscriptions)
for executors, acceptance and limits. The initial design phase was local
review/Markdown only and involved no implementation.
Delivered: [backend contract](monthly-subscription-backend-design.md) and
[data options](monthly-subscription-data-options.md). **User selected choice 2
on 25 October 2026.** The same Backend/DB owners now prepare reversible local
schema/migration and provider-neutral backend work with offline checks. This
selection does not select processor, tariff, billing permission, commercial or
retention policy, authorize connected execution or enable billing/cutover.
Local foundation and verification are delivered in the
[DB handoff](monthly-subscription-database-handoff.md) and
[Backend handoff](monthly-subscription-backend-handoff.md). These distinguish
prepared migrations/offline behavior from remaining runtime integration and
connected acceptance. TASK-024 remains open.

| Owner | Concrete next deliverable |
| --- | --- |
| Product/commercial owner | Confirm price/tax display, eligible launch cohort, monthly renewal/cancellation/refund/grace terms and support responsibility. Keep subscription revenue separate from provider service sales. |
| Back End Developer | Implement selected provider-neutral billing contracts/processing and meaningful offline tests; prepare audit and policy contracts before runtime integration. Hosted processor integration awaits vendor selection. |
| DB Analyst/Developer | Prepare choice-2 additive migrations/ORM and opt-in runtime permissions, with offline checks and recovery. Preserve current Pro IDs/manual grants and existing active runtime profiles. Connected execution requires scoped approval. |
| Front End Developer | Assigned/accepted local monthly billing components, truthful unavailable settings integration, translations and mocked UI/browser checks; coordinate the proposed view contract with Backend. Live billing remains gated. |
| CI/CD Developer | Prepare test/live isolation, secret/webhook configuration, delivery monitoring and release/recovery plan; activation and deployment need their applicable authorization. |

The original brief involved only Markdown preparation. Current local owner scope
and recovery are recorded in the coordination entry and implementation handoffs;
data choice 2 lifts its design-selection hold for local preparation. No connected
execution or activation is authorized. Preserve concurrent work and record later
execution authority with party, executor, target, limits, validation and recovery.

**Frontend start, 25 October 2026:** User requested frontend work; root assigned
`/root/subscription_frontend` the local interface and mocked verification under
the [coordination scope](agent-coordination.md#frontend-start--25-october-2026).
Backend endpoints, processor, price/tax and billing permissions remain gated;
current application billing actions stay unavailable during this preparation.
The owner delivered the local panel/settings tab and isolated en/lv/ru checks;
see [frontend handoff](monthly-subscription-frontend-handoff.md). Runtime transport,
approved offer/permissions and connected acceptance remain pending.
The owners have subsequently resumed the selected pricing/Stripe/permission
work under the decision record; runtime activation remains outside this scope.

## Validation and completion

Responsible developers must verify workspace authorization, price tampering,
duplicate subscription prevention, signed events, retry/reordering/timeout recovery,
renewal, failure/authentication, cancellation, expiry, manual grants and ownership
changes with meaningful isolated tests. Frontend verification includes accessible
desktop/mobile flows and **en/lv/ru only**. ar/RTL, zh, fr, de, hi, ja, pt and es
are deferred; preserve supported translations and historical evidence.

Inspect runners before use. Existing Pro documentation describes broader language
and database tests; it is not approval to execute those commands. Connected
processor/database/API/browser tests, including session writes, require their
specific scope and database authorization. No application tests ran for this brief.

TASK-024 stays open until the assigned owners deliver and verify the subscription
flow and record required sandbox/operational acceptance. Commercial activation
also needs confirmed terms, price, operator and launch authority. Model selection
and documentation completion do not establish a working billing integration.

Recovery design for later delivery: stop new subscription checkouts while keeping
event processing, cancellation/support and reconciliation for existing subscribers
operational. Preserve paid-through entitlements, billing records and audit history;
coordinate any data repair with the DB owner.
