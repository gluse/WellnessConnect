# Payment business scenarios and fair profit

**26 October 2026 update:** user selected Stripe, owner-only company billing,
manual-grant expiry before checkout and EUR 19/month tax-inclusive, editable in
Administration. Price changes affect new subscriptions only. See the
[selected decisions](monthly-subscription-decisions.md). Earlier price/vendor
assumptions and financial examples below are dated research, not current net
revenue or tax conclusions.

Prepared 22 October 2026, Europe/Riga. Owner: assigned Product Manager.
Decision update, 23 October 2026, Europe/Riga: the user selected **Option A,
subscription only, with monthly billing at launch**. Other scenarios below remain
deferred comparisons. The EUR 19 research price, processor, commercial execution,
application/database changes and deployment are not approved by this model choice.
Technical dependencies and owner handoffs: [payment processing plan](payment-processing-plan.md).
Related direction: [product opportunities](product-opportunities.md).
Selected scope and delivery acceptance: [monthly subscription brief](monthly-subscription-brief.md)
and [TASK-024](../TASKS.md#billing).

## Recommended business sequence

**Selected first stage:** one monthly Pro subscription per workspace. Customer
browsing and ordinary bookings stay free; providers collect service payments
separately. No annual plan, deposit, booking commission or acquisition fee is part
of the initial release. Later scenarios require a separate decision rather than
automatic progression through this sequence.

The user selected **Latvia first, then Estonia/Lithuania rapidly, then the UK,
then further markets**, and requested comparison of all commercial directions.
Start by selling a useful provider subscription. Test **EUR 19 per workspace per
month** for the existing Pro storefront and booking value, with customer browsing
and ordinary bookings free. This price is a willingness-to-pay hypothesis, not
validated demand or an approved tariff. Make cancellation and renewal clear;
prefer monthly terms before asking for an annual commitment.

If providers show material no-show losses, add **provider-owned deposits** for one
segment. Treat deposits as a reliability tool, not platform income. The provider
receives the service payment and pays its processing costs. Pro pays for software;
do not promise payment-processing revenue share or use it in the forecast.

Only after FitsMyTime demonstrates incremental demand, test an optional
**10% fee on the first completed marketplace-sourced booking, capped at EUR 5**.
No repeat-customer or provider-sourced fee; waive this acquisition fee for Pro in
the initial pilot. This is a value hypothesis requiring provider-margin evidence.
For a thin-margin segment even EUR 4 can be excessive: offer subscription-only,
reduce the fee or abandon it when provider contribution does not support it.

Defer full marketplace collection and commission on every booking until
subscription/deposit evidence justifies the added operations, risk and investment.
Payments are necessary infrastructure when customers need them; routing the whole
service price through FitsMyTime does not by itself produce a better business.

## Evidence and unanswered questions

Read-only repository inspection on 22 October 2026 found:

- [Payment route](../server/payments.ts) returns `501 PAYMENTS_UNAVAILABLE`.
  Installed Stripe packages do not establish an operating integration.
- [Pro documentation](pro-storefronts.md) describes manually granted, expiring
  workspace entitlements; it explicitly excludes checkout, prices and renewals.
- [Booking routes](../server/routes.ts) calculate amounts and create a pending or
  instant-confirmed booking without collecting payment. [Schema](../shared/schema.ts)
  has amounts and advance percentage but no explicit booking currency, refund,
  dispute or settlement ledger. Group bookings multiply the participant count.
  These are planning dependencies, not permission to change the schema.
- The booking UI currently displays dollar amounts. A booking-payment EUR pilot needs an
  explicit currency design, historical-amount handling and consistent display;
  changing only a symbol would misstate existing amounts. This is a separate
  booking-currency concern: monthly Pro billing needs its own explicit EUR price
  and invoice contract without reinterpreting historical booking amounts.

No live usage, customer records, accounts, bills or financial data were accessed.
The launch sequence is user-selected; operator entity, service segment, typical
ticket, provider margin, traction and willingness to pay remain unknown. EUR and
Latvia pricing anchor the first-market model. Assume ordinary appointment/local
services for comparison; specialist medical/regulated treatment, insurance,
membership resale and other restricted models require separate confirmation.
The user's choice, not timezone or supported languages, establishes the market.

## Options and responsibility

| Scenario | Value and platform income | Seller, fee payer and loss allocation | Product decision |
| --- | --- | --- | --- |
| A. Subscription only | Predictable software revenue; existing provider customer relationships remain useful. EUR 19/month research price. | FitsMyTime sells its subscription and bears its subscription refunds, disputes and billing costs. The provider sells the wellness/service appointment and collects separately. | Selected 23 October 2026: monthly only at launch; price still a hypothesis. Weakest when the current Pro offer does not save time or bring bookings. |
| B. Provider-owned checkout/deposit plus optional Pro | Protects scarce slots. Deposit is part-payment of provider service, never extra platform revenue. Subscription remains the primary platform income. | Provider is the intended service seller. Independent provider payment links, or a specifically configured connected-account direct charge, charge the customer for that provider. Provider pays processing/refund/dispute costs; ultimate connected-account loss allocation must be confirmed separately. | Add only after measured no-show pain. Payment links can test willingness with less integration, but require explicit reconciliation and support ownership. |
| C. Full marketplace checkout, commission on every completed booking | Illustratively 10% on all bookings; stronger recurring transaction income but also recurring provider cost. | Provider may remain contractual service seller, subject to reviewed terms and charge configuration; do not assume this from API choice. With platform destination charges, PSP fees/refunds/disputes hit the platform balance. Provider reimbursement agreements do not remove platform liquidity risk. FitsMyTime separately sells platform services. | Defer; consider only where managed demand, reliability and service support justify every-booking commission. |
| D. Fair hybrid / new-customer fee | Pro subscription OR capped acquisition fee for genuinely new marketplace customers in the pilot; no duplicate fee for the same Pro value. | FitsMyTime sells software/acquisition; provider sells the service. Initially bill eligible acquisition fees to the provider through an authorized recurring invoice workflow; service funds remain provider-owned. FitsMyTime bears disputes/credits on its own fee invoices. | Recommended later experiment once attribution and provider margin are credible. More attribution/support work than A. |

Stripe distinguishes direct and indirect charges: refunds/chargebacks debit the
connected account for direct charges and the platform for destination charges.
Fee payer is configurable for direct charges. [Stripe charge types](https://docs.stripe.com/connect/charges).
Ultimate loss liability depends on account/risk configuration; the platform is
always responsible for its own negative balance. [Stripe risk and liability](https://docs.stripe.com/connect/risk-management).
Confirm these choices with the processor and competent business/legal advisers
before launch. An account type label alone does not establish the contract.
Determine the merchant of record from the commercial/customer relationship first,
then make checkout, receipts, statement descriptor, terms and payment configuration
match it. [Stripe merchant of record guidance](https://docs.stripe.com/connect/merchant-of-record).

## Fair fee rules to test

For D, define a new client as a genuinely new customer of the **provider business**,
not merely a new app account, service or employee booking. One workspace should not
repeatedly pay for a customer moving between its employees. Agree how related
workspaces/locations are treated before charging.

Provider links, provider website/social traffic and known existing customers incur
no acquisition fee in the proposed pilot. Use a clear, time-limited attribution
rule (hypothesis: marketplace discovery within seven days before booking), label
the source before confirmation, and let the provider contest it. Ambiguous source
defaults to no fee. Do not import customer lists or sensitive wellness details to
prove attribution without the appropriate privacy and data-access approvals.

Charge only after verified completion, with the first eligible invoice following
completion. No fee for cancellations, no-shows or provider rejection. Fully
refunded appointments receive a fee credit; partial refunds reduce the fee
proportionately. Exclude tips, tax, add-ons not originally booked, vouchers and
unfulfilled services from the fee base. Check applicable invoice/tax treatment.
Define discounted prices and group bookings explicitly; initially exclude group
bookings from acquisition-fee experiments to avoid charging several new-client
fees for one payer without validated identity and consent.

For deposits, display service total, amount charged now, amount due to provider,
seller identity and cancellation terms before payment. Treat deposit as a credit
against the total. Start with one provider-selected policy and refund exceptions;
do not impose an automatic 50% deposit because a schema default exists. Pay the
remaining balance directly to the provider during the pilot. No customer booking
surcharge, mandatory tip or hidden payout markup is proposed.
Do not promise escrow, guaranteed payout timing or a platform refund guarantee
without the corresponding contractual arrangement and funded operating model.

## Current vendor and competitor reference points

Public primary pages reviewed **22 October 2026**; country, product, card type,
contract and tax can change rates. Obtain a complete quote after market selection.

| Reference | Observed public terms | Planning use |
| --- | --- | --- |
| [Stripe Latvia Payments](https://stripe.com/en-lv/pricing) | Standard EEA cards 1.5% + EUR 0.25; UK 2.5% + EUR 0.25; international 3.15% + EUR 0.25; FX adds 2%. Dispute received EUR 20; manual counter EUR 20, returned if won. | Standard EEA is a deliberately narrow base case; rerun for actual card mix. |
| [Stripe Billing](https://stripe.com/en-lv/billing/pricing) | Pay-as-you-go 0.7% of Billing volume; one-off invoices excluded from that volume definition. | Add to payment processing for proposed recurring Pro and recurring usage billing. |
| [Stripe Latvia Connect](https://stripe.com/en-lv/connect/pricing) | Stripe-handled pricing advertises no additional platform account/payout fees. Platform-handled pricing lists EUR 2/month active payout account and 0.25% + EUR 0.10/payout; the comparison also lists 0.25% payout volume for funds routing/platform management. | Conservative marketplace model provisions both percentage items pending confirmation whether the account quote charges both. No guaranteed revenue share assumed. |
| [Mollie public pricing](https://www.mollie.com/pricing) | EEA consumer Visa/Mastercard 1.80% + EUR 0.25; commercial EEA 2.90% + EUR 0.25; non-EEA 3.25% + EUR 0.25. | Alternative quote benchmark, not proof its platform terms fit. |
| [Booksy UK pricing](https://biz.booksy.com/en-gb/pricing) | GBP 40/month plus VAT; GBP 5/additional user. Optional Boost charges 30% of the first visit with a GBP 5 minimum. | Precedent for software plus optional customer acquisition. FitsMyTime feature value and provider demand are unproven. |
| [Fresha fee explanation](https://www.fresha.com/help-center/knowledge-base/billing-and-fees/188-marketplace-new-client-fees), [rendered pricing](https://www.fresha.com/pricing) | Documentation describes a first marketplace-client fee with returning-client exemptions. Rendered prices vary by region; the generic page returned KRW and free marketplace fees during this review. | Supports researching the model, not quoting one universal tariff or reusing the older EUR example as a current promise. |

Original Stripe processing fees are not returned on refunds, and refund funding
requires available balance. [Stripe refunds](https://docs.stripe.com/refunds).
Budget remaining processor, Connect, recurring-billing, refund/dispute, FX,
invoicing, tax-software and chargeback-response costs separately. Hosted checkout
does not determine tax obligations or make Stripe the seller of FitsMyTime Pro.

## Unit economics: assumptions and sensitivities

All following volumes, operating costs and rates of credits/loss are hypotheses,
not forecasts or measured performance. Model amounts are EUR before platform
sales taxes; customer service totals in examples are simplified fee bases.
Provider service sales, money routed and platform revenue must be reported
separately. No payment processor or account configuration has been selected.

**Subscription:** EUR 19 revenue minus EUR 0.535 processing (1.5% + 0.25),
EUR 0.133 Billing (0.7%), EUR 3 routine support/messaging and EUR 0.50 expected
credits/loss allowance = **EUR 14.832 contribution per paid workspace/month**.
The EUR 3 allowance excludes founder/engineering time in fixed costs below.
At EUR 19, Mollie's illustrative consumer rate would cost EUR 0.592 processing;
that difference alone does not justify choosing an unsuitable integration.

**Hybrid acquisition billing:** EUR 40 eligible completed service gives EUR 4
platform fee. Assume separate monthly recurring usage invoices to free providers,
1.5% processing plus 0.7% Billing on fee revenue, EUR 0.25 per invoice,
EUR 1.50 operations per qualifying booking and EUR 0.50 credits/loss allowance.
Thus contribution before per-invoice fixed charge is EUR 1.912/eligible booking.
No service-price processor or Connect costs hit FitsMyTime in this design; the
provider pays for its independent service collection. Do not also count those
costs as a platform expense. A fee deducted from connected-account service funds
is a different design and needs a new calculation.

| Monthly case | Paid Pro workspaces | Eligible completed first bookings outside Pro | Free providers invoiced | Platform revenue | Variable costs | Contribution | After EUR 300 cash overhead | After EUR 5,175 loaded fixed budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 10 | 20 | 10 | 270.00 | 85.94 | 184.06 | -115.94 | -4,990.94 |
| Base | 30 | 100 | 25 | 970.00 | 340.09 | 629.91 | 329.91 | -4,545.09 |
| High | 100 | 400 | 60 | 3,500.00 | 1,267.00 | 2,233.00 | 1,933.00 | -2,942.00 |

Formula: revenue = 19P + 4B; variable cost = 4.168P + 2.088B + 0.25I,
where P is paid workspaces, B eligible bookings, I monthly free-provider invoices.
Recurring Pro billing fixed charge is already included in its EUR 0.535 processing.
Providers are not counted in both acquisition-fee and Pro cohorts.

The illustrative loaded monthly fixed budget is EUR 300 infrastructure/admin,
EUR 1,500 founder/operations time, EUR 3,000 maintenance/development and EUR 375
to recover a hypothetical EUR 4,500 initial billing investment over 12 months.
These are adjustable planning allowances, not quotes; avoid counting the same
labor in both variable support and fixed roles. Paid acquisition, employer taxes,
professional advice, additional team salaries, VAT/sales/income tax and major
fraud incidents remain excluded. The final column is therefore a conditional
operating result before those costs, not net business profit.

Subscription-only needs **21 paid workspaces** to cover EUR 300 overhead, or
**349** to cover EUR 5,175 at this contribution. Positive cash after a cheap hosting
bill does not establish sustainable profit. At 100 Pro customers subscription-only
contribution is EUR 1,483.20/month, leaving a EUR 3,691.80 loaded-budget gap.
At the base hybrid volume the gap is EUR 4,545.09/month. Charge a higher price only
when demonstrated value and willingness to pay support it; otherwise reduce
operating scope or improve retained distribution rather than hide the shortfall.

For provider acquisition, EUR 45 cost per acquired Pro workspace takes about
3.03 retained paid months to recover at EUR 14.832 contribution, before fixed
costs/churn. For a free provider with four qualifying EUR 4 bookings in a month,
EUR 1.912 minus EUR 0.0625 invoice share gives EUR 1.8495 contribution/booking.
That cannot fund a EUR 5 customer acquisition reward from one booking. No forecast
of repeat acquisition fees is allowed because returning customers are exempt.

### Why full marketplace payments need more scale

The following alternative C uses 10% commission on every completed booking,
platform-absorbed processing, one monthly payout/provider, EUR 1 variable support
per payment, a 5% commission-credit allowance and a separate 1% GMV loss provision
for unrecovered dispute principal/fees. Connect provision is EUR 2/account/month,
EUR 0.10/payout and conservatively 0.5% of provider payout volume. For simple
comparison the payout base is 90% of pre-credit service price; real refunds and
payouts require reconciliation. This is a standalone model, not an extra cost to
add to the hybrid table.

| Per-payment case | Service value | Paid bookings/provider/month | Commission | Processing | Connect allocation | Support | Fee credit + loss provisions | Contribution |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low ticket / sparse | 20.00 | 2 | 2.00 | 0.55 | 1.14 | 1.00 | 0.30 | -0.99 |
| Base | 40.00 | 20 | 4.00 | 0.85 | 0.285 | 1.00 | 0.60 | 1.265 |
| Higher ticket / dense | 80.00 | 50 | 8.00 | 1.45 | 0.402 | 1.00 | 1.20 | 3.948 |

Formula: 0.10A - (0.015A + 0.25) - (2.10/n + 0.005 x 0.90A)
- 1 - 0.05 x 0.10A - 0.01A. A is service value, n provider monthly payments.
Removing an uncharged routing item would improve the base by EUR 0.09, not make
the support/liquidity obligations disappear. Weekly rather than monthly payouts
increase payout count; low volume makes per-account fees particularly damaging.
If providers pay processing separately, recalculate their total effective fee
and retention as well as platform margin; that shifts cost, it does not remove it.

At the base margin, approximately **4,091 payments/month** cover EUR 5,175 before
the excluded costs. An international EUR 40 card costs EUR 1.51 before FX, reducing
base contribution by EUR 0.66. A lost EUR 40 chargeback contested manually could
consume EUR 80 principal and dispute fees, plus original processing and operations.
The 1% reserve is an assumption that may be inadequate, not a guarantee or capital
requirement. Payout delays/reserves and refund cash must be agreed before launch.

For provider-owned deposits, a EUR 10 deposit has EUR 0.40 illustrative processing
cost; a EUR 20 deposit costs EUR 0.55. Two online charges introduce a second fixed
charge. If an average missed EUR 40 appointment loses EUR 20 of provider contribution,
a EUR 0.55 deposit processing cost alone needs a 2.75 percentage-point no-show
reduction to break even, before administration and any conversion loss. Measure
actual avoided loss and take-home income; retained customer deposit is neither
platform profit nor proof the slot loss was recovered.

## Smallest useful experiments and change rules

Targets below are proposed learning thresholds, not industry benchmarks. Begin
the six-week observation window only after required approvals and owners exist;
allow mature cohorts for renewals and natural repeat intervals.

1. **Baseline and price discovery:** one chosen market/segment, 10 activated
   providers. Measure completed bookings, provider time saved and current no-show
   loss. Offer the EUR 19 proposition; at least three concrete commitments justifies
   a small authorized paid pilot. Below three, change value/segment/price before
   automating billing. Outreach and invoices require separate authorization.
2. **Subscription pilot:** target 10 genuinely paying workspaces and at least
   eight of the ten renewing at the second due date. Track failed payments,
   cancellation reasons, support minutes and contribution per workspace. Pause
   expansion if contribution is non-positive or support exceeds 20 minutes per
   workspace/month at an assumed EUR 15/hour until pricing/operations are revised.
   Small counts give directional evidence, not a retention forecast.
3. **Deposit pilot if needed:** 5-10 willing providers and at least 100 eligible
   booking attempts, compared with a defined pre-pilot baseline/cohort. Track
   paid conversion, confirmed and completed bookings, no-show loss, refunds and
   support. Continue only if provider contribution after costs improves and
   booking completion per eligible attempt does not fall by more than 10% relative.
   Investigate any duplicate charge, unaccounted payment or refund failure
   immediately and pause the affected path. Low sample sizes need qualitative
   follow-up; do not claim causality from a seasonal before/after comparison.
4. **Acquisition fee pilot later:** 10 opted-in free providers, 50 eligible
   completed first bookings with auditable source and margin consent. Require at
   least EUR 1.50 measured contribution/charged booking, fewer than 5% disputed
   attribution cases, and no repeat/provider-sourced fees. Any systematic wrong
   fee stops charging until corrected; credit impacted invoices. Below margin
   threshold revise costs/fee/segment or retain subscription-only.
5. **Full marketplace gate:** separate business decision only after deposits or
   demand justify platform funds flow, actual quote and seller/liability choices,
   refund/dispute ownership, reserve funding and a downside model. Positive
   contribution across the actual ticket/volume mix and an affordable route to
   loaded break-even are required. Set processor-specific risk thresholds from
   the signed terms; do not invent a universal permitted chargeback rate.

PM owns denominators, cohort/source definitions and the weekly decision review.
Authorized owners collect approved aggregated evidence: payments/settlement,
completed bookings, subscription retention, provider net earnings, customer
repeat use, refunds/disputes, complaints, support cost and acquisition payback.
Do not use sensitive wellness/search text or assume provider-entered completion
alone is sufficient. No new analytics database access or instrumentation is
authorized by this proposal.

## Expansion without multiplying operating cost

Latvia is the initial EUR pilot. Extend the accepted model to Estonia and Lithuania
using the same currency and workspace product only after checking local provider
eligibility, tax/invoice handling, seller identity, supported payout accounts,
refund obligations and support capacity for each country. Shared EUR does not
make those reviews optional. Avoid a separate billing product per country;
store immutable price/currency snapshots and explicit country configuration in
the eventual owner-approved design.

The user wants rapid expansion; prepare country checklists and provider discovery
in parallel once authorized, but launch collections market by market after owner
acceptance. Require at least one renewal cohort, positive measured contribution,
reconciled collections/refunds and capacity to support the next market before
commercial rollout. This guards speed against multiplying an unprofitable model.

For UK entry, decide a local GBP offer using willingness to pay and net economics;
do not display EUR 19 as GBP 19 or convert daily without an agreed pricing rule.
An LV account processing UK cards uses its Latvia international/cross-border
schedule, not a UK account's domestic tariff. Stripe's UK page currently lists
standard UK cards at 1.5% + GBP 0.20 and EU cards at 2.5% + GBP 0.20 for its UK
schedule; those rates are not a promise for the Latvia operator.
[Stripe UK pricing](https://stripe.com/gb/pricing).

Check GBP settlement/FX, provider-country onboarding and legal/tax treatment before
the UK pilot. Stripe's current cross-border payout guide lists EEA/UK availability
but limits the described flows to destination or separate-charge transfers without
`on_behalf_of` (plus top-up transfers). Do not assume the provider-as-merchant
configuration can simply be reused across EEA/UK; obtain a flow-specific answer
and rerun seller/liability economics. [Stripe cross-border payouts](https://docs.stripe.com/connect/cross-border-payouts-to-recipients).
Further markets each need the same eligibility, currency, cost and support gate.

## Decisions before implementation or commercial execution

- User already selected Latvia, then the other Baltic states, then the UK, then
  further markets, and requested comparison of every commercial direction.
  Confirm operator entity, provider countries and initial service segment, with
  actual average ticket, provider margin and expected scale.
- User selected Option A with monthly billing on 23 October 2026. Confirm the
  monthly price/tax presentation, spending/time budget, minimum sustainable return
  and tolerated loss exposure before commercial execution.
- For the deferred booking-payment scenarios, confirm whether service seller is individual/company workspace, who receives
  deposits and pays processing, refund and dispute responsibility, and whether
  platform negative-balance exposure is acceptable. Avoid one PSP account per
  employee unless they are genuinely separate sellers.
- Confirm tax-inclusive/exclusive customer presentation and B2B subscription
  pricing with qualified advice; address invoicing, consumer cancellation rules,
  processor category eligibility and any sector-specific restrictions.
- Select PSP only after regional eligibility, payment methods, recurring billing,
  complete fee quote and support obligations are checked. Connected-account
  configuration is required only for a later provider-payment scope.
  Prefer hosted subscription checkout/portal for A if Stripe fits;
  compare total operating effort, not just card rate.
- Assign Front End and Back End Developers for application changes; DB
  Analyst/Developer presents database options and obtains the user's selection
  before database-affecting implementation/execution; CI/CD owns infrastructure
  and deployment. PM research does not delegate or approve their operations.
- Future validation covers **en, lv, ru only**. Arabic/RTL, Chinese, French,
  German, Hindi, Japanese, Portuguese and Spanish checks remain deferred; supported
  translations continue to be maintained. No application tests were run here.

The [monthly subscription brief](monthly-subscription-brief.md) now records the
selected launch scope and owner acceptance criteria. Next: resolve its remaining
commercial inputs and obtain owner assignments for subscription design, including
the DB Analyst's concrete options before database-affecting implementation.
