# Payment processing proposal

**26 October 2026 update:** Stripe and the tax-inclusive EUR 19/month initial
offer are selected; Administration amount changes apply to new subscriptions
only. Company billing is owner-only and paid checkout waits for manual Pro expiry.
See [selected decisions](monthly-subscription-decisions.md) and the current
implementation handoffs linked from TASK-024; earlier unselected statements
below are historical. Connected execution and activation remain separate gates.

Prepared 22 October 2026 following the user's request to involve the Product
Manager and compare business scenarios that can earn a fair profit.
**Decision update, 23 October 2026:** user selected Option A, subscription only,
with monthly billing at launch. Implementation, spending and release remain
subject to the recorded owner and execution boundaries.

Confirmed rollout: **Latvia first → Lithuania and Estonia → UK → further markets**.
The launch service categories, legal operating entity, expected volumes and ticket
sizes remain unconfirmed. Do not interpret the rollout as payment-provider
eligibility or approval for every category.

Read the [Product Manager's business plan](payment-business-plan.md) for the
model comparison, pricing hypotheses, costs, sensitivity and pilot decision rules.
This document describes how to deliver the selected model safely in the existing
application. The [monthly subscription brief](monthly-subscription-brief.md) is the
current delivery scope, tracked as [TASK-024](../TASKS.md#billing). Other payment
flows in this document are deferred reference designs, not launch dependencies.

## What exists today

| Evidence | Consequence for planning |
| --- | --- |
| [`server/payments.ts`](../server/payments.ts) returns `501 PAYMENTS_UNAVAILABLE`. | Payment collection has to be implemented; installed Stripe libraries are not an integration. Keep the unavailable path until its replacement is verified. |
| [`docs/pro-storefronts.md`](pro-storefronts.md) and [`server/storefronts.ts`](../server/storefronts.ts) describe manually administered workspace Pro access. | Subscription billing can reuse the entitlement concept, but needs billing identities, recurring-payment events and renewal/cancellation rules. |
| [`shared/schema.ts`](../shared/schema.ts) stores booking totals and advance amounts as decimals, with only `pending`, `advance_paid`, `fully_paid` payment states. | There is no authoritative processor transaction/refund/dispute model or explicit booking currency in these definitions. Do not treat the existing paid flags as a financial ledger. |
| [`server/routes.ts`](../server/routes.ts) calculates booking amounts server-side, and instant bookings become confirmed without payment. | Preserve current booking behaviour for Option A. An awaiting-payment reservation lifecycle belongs to a later booking-payment scope. |
| [`client/src/components/booking-modal.tsx`](../client/src/components/booking-modal.tsx) states advance collection is unavailable. Existing presentation uses dollar amounts. | Monthly Pro pricing/receipts need an explicit currency independent of locale. Booking-currency corrections and historical amount handling are a separate concern before collecting booking money. |

This is repository evidence, not a review of live processor accounts or production
data. Earlier architecture descriptions of payment processing are broader than
the implemented route.

## Recommended sequence

**Current selection:** stage 1 only, monthly subscriptions. Annual billing,
booking deposits, Connect onboarding, commissions, acquisition fees and service
payouts are excluded from TASK-024. Stages 2–4 need subsequent decisions; market
expansion still follows the user's Latvia → other Baltics → UK direction.

1. **Latvia: validate paid Pro, then automate it.** Start with one simple monthly
   workspace offer, free customer discovery/booking and an explicit value claim.
   A small, separately authorised invoice or hosted-payment-link pilot can test
   willingness to pay before engineering recurring billing. FitsMyTime sells its
   own software subscription to the workspace. Do not collect customer booking
   money in that account merely because subscription checkout works.
2. **Latvia: pilot provider-owned deposits only if no-shows justify them.** Use a
   platform-capable processor with hosted provider onboarding and checkout.
   Agree who sells the appointment, pays processing fees, supplies receipts,
   handles complaints and bears losses. Provider-as-seller is the initial
   hypothesis; verify the contracts and processor configuration match it.
3. **Add a marketplace acquisition fee only after attribution works.** Use the
   PM's capped first-completed-new-customer hypothesis, compared against a plain
   subscription. Provider links and repeat bookings should have explicit
   exemptions. Waivers/credits for Pro must prevent charging twice for the same
   acquisition value. Resolve cancellations/refunds before earning the fee.
4. **Expand by market after operational gates pass.** Reuse the integration and
   financial records, then configure each country's sellers, methods, tax,
   language and support arrangements. Add GBP prices/settlement deliberately
   for the UK; EUR launch prices are not automatically GBP prices.

Stripe is the initial integration candidate because this repository already has
its SDKs and its hosted billing/Connect products cover both tracks. This reduces
investigation effort; it does not select Stripe commercially. Compare a dated
written quote with the alternatives in the PM brief before committing.

## Money ownership and payment architecture

| Track | Proposed flow | Important distinction |
| --- | --- | --- |
| Pro subscription | Workspace → hosted Checkout → FitsMyTime; hosted customer portal for billing management. | FitsMyTime is selling its own subscription. Booking money is separate. |
| Provider-owned appointment | Customer → connected provider account via direct charge; platform may collect an agreed application fee. | Charge objects and balances belong to the connected account; reporting must retain that account scope. Loss/fee responsibility depends on account configuration and agreement. |
| Full marketplace alternative | Customer → platform charge → connected provider transfer. | More platform control, but the platform balance bears processor fees, refunds and disputes for destination charges. Requires a realistic loss reserve and recovery process. |

Stripe distinguishes [direct charges](https://docs.stripe.com/connect/direct-charges?platform=web&ui=stripe-hosted)
from [destination charges](https://docs.stripe.com/connect/destination-charges?platform=web&ui=stripe-hosted).
The direct flow is the technical candidate for the provider-owned scenario;
the destination flow is an alternative if a platform-centric business is selected.
Do not collect all sellers' money into a standard single-merchant account and
manually distribute it as a shortcut. Do not advertise escrow.

The seller/merchant of record must follow the real commercial relationship,
customer expectations and contractual responsibilities. A charge API option alone
does not establish that identity. Checkout, terms, receipts, statement descriptors
and dispute support must consistently identify the selected seller.
[Stripe merchant-of-record guidance](https://docs.stripe.com/connect/merchant-of-record).

## Deferred booking scenarios to agree before booking checkout

These scenarios do not apply to monthly subscription checkout and are not
acceptance blockers for Option A.

| Scenario | Proposed behaviour |
| --- | --- |
| Instant booking, payment required | Recheck price/capacity; create a temporary reservation and payment attempt; confirm only after verified successful payment. Initial payment-window hypothesis: 30 minutes, reviewed against conversion and inventory blocking. |
| Provider approval required | Provider accepts availability first; customer then receives a time-limited payment request. Show “awaiting payment” distinctly. Unpaid acceptance expires; define a provider-response deadline and notification channel before launch. |
| Deposit + remaining balance | Show total, deposit, due date and remaining balance before payment. Begin with one online deposit and balance paid directly to the provider; identify the balance method clearly. Do not mark the whole booking paid. |
| Full advance payment | One transaction avoids a second fixed processor fee, but increases refund exposure. Offer only when provider/customer research supports it. |
| No required prepayment | Preserve pay-at-provider booking. A booking confirmation is not proof of payment. Free/no-price services must not create zero-value card charges. |
| Provider cancellation or non-delivery | Request a full customer refund; proposed platform acquisition fee is reversed. Define who absorbs unrecovered processor costs and reserve funding before launch. |
| Customer cancellation/no-show | Display the agreed deadline, timezone and refund amount before checkout and retain the policy version accepted. Do not assume all deposits can be kept. No-show penalties/off-session charging are a later, separately reviewed feature. |
| Reschedule/group cancellation | Preserve currency and paid totals; adjust amount/capacity with an explicit refund or extra-payment flow. Define partial participant refunds. No silent repricing or automatic repeat charge. |
| Late success after reservation expires | Recheck inventory atomically. If unavailable, do not displace another customer; arrange refund and visible support follow-up. |

Avoid long card authorisation holds for appointments booked weeks ahead. Card
authorisations expire and vary by card/transaction type. A captured refundable
deposit is a different product from a hold; its policy and cash flow must be
explained. [Stripe authorisation windows](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).

## State and reliability requirements

Apply subscription identity, event, entitlement, money and reconciliation controls
to Option A. Booking reservations, provider settlements and service refunds below
apply only when their respective deferred flows are selected.

- Keep booking fulfilment, payment attempts, subscription entitlement and payouts
  separate. Partial/full refunds, disputes and payout failures are distinct
  events; a refund must not erase the original charge.
- Calculate immutable totals, currency, fee allocation and policy versions on
  the server. Represent money in the currency's minor units or exact arithmetic;
  define rounding once. Never accept browser prices or paid flags as authority.
- Use hosted payment fields/pages so card numbers and CVC do not enter our
  servers or logs. Hosted checkout reduces PCI scope, but does not remove the
  business's obligations. [Stripe integration security](https://docs.stripe.com/security/guide).
- Verify webhook signatures using the raw request body before JSON parsing;
  match processor account, mode, currency, amount, booking/workspace and payment
  identity. Deduplicate events, tolerate reordering, durably enqueue accepted
  work and reconcile against processor state. A browser success redirect is
  only a receipt screen. [Stripe webhook guidance](https://docs.stripe.com/webhooks).
- Use operation-scoped idempotency keys and database uniqueness/state guards
  for checkout, capture, refund and business effects. Retain local protection
  beyond a processor's idempotency retention window. Recover a request that
  succeeded remotely but timed out locally without making another charge.
  [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).
- For subscriptions, provision access from verified billing state; renewal,
  authentication-required, failed payment, cancellation-at-period-end and grace
  periods need explicit rules. Historical bookings and receipts remain readable
  when Pro expires. [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks).
- Reconcile charges, platform fees, refunds, disputes, transfers and payouts by
  currency, with a human-owned exception queue. Payment success is not bank
  settlement. Record audit references without card data, secrets or wellness notes.

## Latvia, Baltic and UK gates

For Option A, assess FitsMyTime's own subscription seller, billing, tax, refund
and support arrangements in each market. Connected-provider onboarding, payout
corridors and service-money allocation in the broader gates below apply only to
later booking-payment scenarios.

| Stage | Must establish before launch |
| --- | --- |
| Latvia / EUR | Eligible legal entity and service categories; bank/processor account; seller agreement; fee/tax-inclusive price presentation; accountant-reviewed VAT/invoices; cancellation/refund terms; operating privacy contact; support/refund owner; test-mode acceptance and funded refund handling. |
| Lithuania and Estonia / EUR | Country-specific seller onboarding/payout eligibility, invoice/tax arrangements, terms and support/localisation plan. Shared currency does not establish identical operating requirements. |
| UK / GBP | Processor-approved UK connected-account/cross-border flow, GBP price catalogue and bank settlement/FX costs; separate card mix and dispute economics; UK tax/consumer/privacy review and local support. Do not apply Latvian domestic-card rates to all UK sales. |
| Further markets | Approve a country/category capability matrix first. Exclude unapproved markets from paid onboarding rather than infer worldwide support from card acceptance. |

Stripe lists Latvia, Lithuania, Estonia and the UK in its
[supported countries](https://stripe.com/global). That is basic account
availability, not confirmation of a particular Connect corridor or business.
Keep presentment, card and settlement currencies separate; each can affect costs.
[Stripe currency guidance](https://docs.stripe.com/currencies).

Resolve applicable platform seller reporting, VAT and contractual responsibilities
with the accountant/legal owner for the selected entity and model. No tax rate,
licensing exemption or legal classification is selected by this proposal.

## Proposed work packages and ownership

| Package | Owner and acceptance |
| --- | --- |
| Commercial pilot | Product Manager: selected segment, prices, attribution, fee payer, contribution targets, terms inputs and stop/change rule; user selects scope. No billing outreach or charges authorised by planning. |
| Data design | DB Analyst proposes extending current flags versus authoritative payment/event/refund records with compatibility projections. Recommend the latter for reconciliation and duplicate protection. Present schema/migration options and tradeoffs for the user's selection before implementation or database execution. No SQL/migrations are part of this plan. |
| Pro billing | Back End Developer: hosted checkout/portal, workspace authorisation, verified events and entitlements; Front End Developer: understandable pricing, renewal, failure and cancellation states. Start here if the pilot supports the subscription model. |
| Booking payments | Back End Developer + DB Analyst + Front End Developer: provider onboarding, holds, totals, payment events, refunds, receipts and support workflow under the selected design. Split a limited deposit pilot from later full marketplace scope. |
| Operations/release | CI/CD: secrets, HTTPS webhook delivery, test/live separation, alerts, retry jobs and rollback. Finance/support own reconciliation, refund funding and dispute deadlines. |

Verification proposals: mocked unit/component tests for amount tampering,
cross-workspace access, SCA/failure, duplicate/out-of-order events, timeout retry,
last-slot races, expiry/late success, partial refunds, Pro expiry and UK currency.
For TASK-024, select the subscription subset in the linked brief; last-slot races,
reservation expiry, booking refunds and UK/GBP are deferred with those scopes.
Connected sandbox/database tests need their own scoped approvals. Current
language verification is **en/lv/ru only**; ar/RTL, zh, fr, de, hi, ja, pt and es
remain deferred. Expansion must explicitly address local-language coverage before
claiming it. No payment/application tests were run for this documentation plan.

Rollback design: stop new checkouts without disabling webhook/refund/reconciliation
handling for money already collected. Preserve financial and audit records;
coordinate repair/migration with the DB owner. No destructive rollback is assumed.

The first model decision is complete: Option A, monthly only. Next work is the
subscription design and owner handoff in the linked brief, alongside price/tax,
processor and operator confirmation. The model choice does not approve database
changes, real charges, paid vendors or deployment.
