# FitsMyTime product opportunities

Prepared 19 October 2026, Europe/Riga. Owner: Product Manager. Status: proposals
for prioritization; no product changes or commercial experiments executed.

## Recommended direction

Make FitsMyTime the easiest way to answer: **"What can I book nearby in the time
I have?"** Start with one local market and one frequently used service segment,
help providers publish real availability, and make successful bookings repeatable.
Keep customer browsing and ordinary booking free during the pilot. Test provider
payment for demonstrated value before investing in complex monetization.

This is a hypothesis based on the existing product, not validated market demand.
The launch city, target segment, traction, budget, actual costs, provider margins,
and willingness to pay are unknown. EUR is a planning currency; it does not imply
that Latvia or any other country has been selected as the launch market.

## Evidence from this repository

| Evidence inspected | Product implication |
| --- | --- |
| [README](../README.md), [guest search completion](../TASKS_COMPLETED.md), and [search page](../client/src/pages/home.tsx) | Guest browsing, location/date/time filters, maps, availability filters, reviews, and provider catalogs already exist. Improve their effectiveness rather than proposing them as new features. |
| [Pro storefronts](pro-storefronts.md) | Branded pages and manual Pro entitlements exist. Prices, payment collection, and recurring billing do not. Monetization can begin with a willingness-to-pay study using the existing value proposition. |
| [Booking form](../client/src/components/booking-modal.tsx) and [payment route](../server/payments.ts) | Booking requests/instant confirmation exist, but online payment collection is unavailable. Payment-related fields or installed Stripe packages do not establish a working integration. |
| [Landing page](../client/src/pages/landing.tsx) | It currently advertises "Secure Payments" and "Verified Providers." The first conflicts with the payment route; a provider credential-verification workflow was not established by the inspected code. Both need accurate, evidenced wording. |
| [TASKS.md](../TASKS.md) | Landing changes, translation coverage, notifications, time-based activity discovery, discounts, and billing are already areas of interest. These proposals give them an outcome and economic rationale. TASK-018 remains the audit viewer. |
| [Architecture](architecture.md) | Some payment/notification descriptions are broader than the inspected behavior. Validate current implementation and deployment before making customer promises. |

This was a read-only repository review, not a production audit or customer study.
No usage analytics, live bookings, provider interviews, or financial records were
accessed. Completion records are historical delivery evidence, not proof of
current deployment or market traction.

## Prioritized ideas and costs

Estimates below are planning assumptions, not quotes. One person-day is eight
hours of combined product/engineering/QA or operations effort. At an illustrative
EUR 300/day, 2-4 days costs EUR 600-1,200 in labor or opportunity cost. Estimates
include focused verification but exclude major prerequisite repairs, taxes,
ongoing acquisition, and vendor charges. Owners must refine them before delivery.
Benefits overlap; do not add their projected uplift together.

| Priority / idea | Why users or providers would choose it | Smallest useful scope and estimated effort | Cost versus possible income |
| --- | --- | --- | --- |
| P0 / PM-01: Accurate promises and a measurable booking funnel | Clear payment, confirmation, and provider-trust information reduces uncertainty at the point of booking. Measurement identifies the actual loss point. | Correct unsupported claims through the frontend owner; explain request versus confirmation, payment method, total price/currency, and cancellation expectations. Define funnel events before adding instrumentation. 3-5 days; EUR 900-1,500. | Indirect conversion/retention benefit. Reuse existing reviews; defer costly identity/credential verification until the segment needs it. Allow EUR 0-50/month incremental analytics cost as a pilot assumption. |
| P1 / PM-02: Concentrate supply in one market and segment | A small catalog with useful nearby slots can solve a real need. A broad catalog with no suitable availability gives people little reason to return. | Research 10 providers and 15 potential customers; shortlist a repeat-use segment, then help 10 willing providers publish complete listings and upcoming schedules. 3-5 operations days; EUR 900-1,500. Research/outreach execution needs authorization. | Existing capabilities minimize development expense. Providers receiving bookings become candidates for Pro. At EUR 19/month, five paying providers yield EUR 95 monthly gross revenue, before costs; this pilot alone will not fund a team. |
| P1 / PM-03: "I have 90 minutes" discovery | People can choose an activity around their real schedule, rather than examining listings that will not fit. This uses the product's name and existing scheduling advantage. | Add a simple duration/free-window workflow over existing date, time, distance, and availability filters. Include service duration and a user-selected travel allowance; show actual bookable slots. 5-8 days; EUR 1,500-2,400. | Incremental completed bookings can improve provider retention and later fee revenue. Use deterministic filtering first; avoid an extra AI or routing call per search unless it demonstrably improves conversion. |
| P1 / PM-04: Faster provider activation and shareable booking links | Providers gain a usable booking destination even before the marketplace has substantial traffic; their customers bring initial demand. | A short publish checklist, availability preview, and guidance for sharing existing catalog/storefront links. Reuse listing copies and saved addresses. Existing Pro gating remains a product decision. 2-4 days; EUR 600-1,200. | Lower onboarding/support cost and a path to Pro. A provider's own customers should not incur a proposed new-customer acquisition fee. Record provider-sourced demand separately from marketplace demand. |
| P2 / PM-05: Booking reliability, reminders, and easy changes | Customers need confidence that a requested slot will be honored; providers need fewer missed appointments and less administration. | Reliable email confirmation/status changes and reminders, calendar export, clear pending states, and defined cancellation/rescheduling rules. 6-10 days; EUR 1,800-3,000. Use email before SMS. | Retained bookings protect provider income and support Pro value. Illustratively, 10 avoided missed EUR 40 appointments preserve EUR 400 of provider booking value, not EUR 400 of platform revenue. Budget EUR 10-50/month incremental messaging cost for a small pilot, then measure actual volume. |
| P2 / PM-06: Rebook a successful experience | Repeat customers can find the same provider's next available slot with less effort. This can be useful without a discount. | A rebook action from booking history; preserve relevant service context, but recheck current price and availability. Optional reminders require an appropriate preference control. 3-5 days; EUR 900-1,500. | Repeat volume supports subscription retention. Under a first-new-customer fee, repeat bookings produce no additional acquisition commission; do not count them as new fee revenue. Avoid blanket platform-funded coupons. |
| P2 / PM-07: Test a paid Pro offer | Providers will pay if the storefront and booking workflow save enough time or bring enough business. Existing Pro features make this cheaper to test than building a new premium suite. | Present EUR 19/month as a research offer to 10 activated workspaces, including storefront and booking workflow. Record objections and concrete commitments. 2-3 discovery days; EUR 600-900. Only after evidence, estimate billing delivery at a further 8-15 days; EUR 2,400-4,500. | 30 paying workspaces yield EUR 570 monthly gross recurring revenue. Actual paid activation/renewal is stronger evidence than survey interest. Manual invoicing is only an option through an authorized business/billing workflow; current admin grants do not collect money. |
| P3 / PM-08: Fill canceled slots with an opt-in waitlist | Customers gain access to desirable times and providers recover otherwise empty capacity. | One segment, one notification channel, live availability recheck, expiring offers, and duplicate-booking protection. Let providers choose any discount. 5-8 days; EUR 1,500-2,400. | Forty recovered EUR 40 bookings mean EUR 1,600 provider booking value. If only ten qualify for a future EUR 4 acquisition fee, platform gross fee revenue is EUR 40. Messaging, concurrency handling, and support must cost less than the resulting contribution. |
| P3 / PM-09: Local discovery and provider-led referrals | People can reach a relevant bookable service through a provider, community, or specific local search. | Improve existing public pages' discoverability and sharing; create only pages with real local inventory. Pilot one partner channel. 3-6 days; EUR 900-1,800. Check indexing rather than assuming a public route is search-engine ready. | Potentially lowers acquisition cost. Start with unrewarded sharing; if testing referral rewards, cap them against observed contribution and pay only for qualifying completed activity. Delay broad paid ads until conversion and retention work. |

PM-01 and PM-02 precede a large acquisition push. PM-03 and PM-04 can be ordered
after observing whether customer discovery or provider setup is the bigger
bottleneck. PM-05 precedes PM-08. PM-07 discovery can run early; automated billing
waits for evidence. This is a sequence of decisions, not a committed feature list.

## Monetization recommendation

Start with free customer access and a useful free provider listing/booking tier.
Test one simple Pro price, initially EUR 19/workspace/month, for the existing
branded storefront and provider value. Do not put basic discovery, trustworthy
information, or essential booking status behind customer payment.

If the marketplace later delivers demonstrably new customers, compare a
performance fee with subscription-only pricing. One hypothesis is 10% of the
first completed marketplace-sourced booking, capped at EUR 5, with no fee for
repeat or provider-sourced customers. Define attribution, disputes, cancellations,
and eligibility before implementation. During a test, waive this fee for Pro
workspaces so the same value is not charged twice. Subscription and acquisition
fees in the scenario below therefore come from distinct eligible workspaces.

Fresha demonstrates a subscription plus new-customer marketplace fee model; its
current rendered pricing page shows an Independent subscription of EUR 19.95/month,
and its help page explains first-customer attribution and returning-customer
exemptions. This shows a market precedent, not FitsMyTime willingness to pay or
feature parity. Source pages can vary by region. [Fresha pricing](https://www.fresha.com/pricing),
[marketplace fee explanation](https://www.fresha.com/help-center/knowledge-base/billing-and-fees/188-marketplace-new-client-fees).

Defer full marketplace payments until a proven demand for deposits, fewer
no-shows, or fee collection justifies the work. A Pro subscription charges for
FitsMyTime itself; collecting customer funds and paying service providers adds
onboarding, refunds, dispute handling, reconciliation, and payout complexity.
Stripe lists standard EEA card processing in Latvia at 1.5% + EUR 0.25: a EUR 40
charge would cost EUR 0.85 at that rate, before additional applicable costs.
Connect pricing depends on integration and region and must be checked separately.
This is an illustration, not selection of a provider, country, or payment design.
[Stripe Latvia pricing](https://stripe.com/en-lv/pricing),
[Connect pricing](https://stripe.com/connect/pricing).

## Illustrative monthly economics

These are conditional scenarios, not forecasts, current revenue, or an approved
budget. Assumptions: EUR 19/month Pro; average eligible first booking EUR 40;
10% fee produces EUR 4; EUR 3 variable cost per paying workspace/month; EUR 1.50
variable cost per eligible acquisition booking; EUR 300 fixed monthly operating
cost. Variable allowances provision for billing, notifications, and routine
support; they are unmeasured assumptions and may be insufficient.

| Monthly scenario | Paying Pro workspaces | Eligible completed new-customer bookings, outside Pro | Gross platform revenue | Variable costs | Contribution before fixed costs | After EUR 300 fixed costs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small pilot | 10 | 50 | EUR 390 | EUR 105 | EUR 285 | -EUR 15 |
| Early traction | 30 | 200 | EUR 1,370 | EUR 390 | EUR 980 | EUR 680 |
| Larger local base | 75 | 600 | EUR 3,825 | EUR 1,125 | EUR 2,700 | EUR 2,400 |

Revenue = Pro count x 19 + eligible bookings x 4.
Contribution = Pro count x 16 + eligible bookings x 2.50.
The final column excludes development/team salaries,
paid acquisition, founder labor beyond the allowances, tax, refunds, unusual
disputes, and capital recovery; it is not business profit or net revenue after
all deductions. Model subscription churn and realistic provider capacity before
using the larger case for planning.

For subscription-only operation, 19 Pro workspaces cover EUR 300 fixed cost at
EUR 16 contribution each, before excluded costs. Thirty provide EUR 180/month
after that fixed cost. A EUR 4,500 billing investment would then take 25 months
to recover if all that surplus were attributable to it and nothing else changed.
That weak early payback favors a small authorized payment pilot before automation.

For acquisition, use observed retained contribution. At EUR 16 monthly Pro
contribution, EUR 48 provider acquisition cost takes three retained paid months
to recover, before fixed costs. A customer generating only one eligible EUR 4 fee
contributes EUR 2.50 under this model: a EUR 5 referral reward loses money unless
additional attributable contribution is demonstrated. Do not count providers'
service revenue as money available to fund platform acquisition.

## Expense controls

Reuse working guest search, availability, reviews, saved addresses, and storefronts.
Prefer list results with an optional map and deterministic time filtering; measure
cost and conversion before changing map loading or semantic search behavior.
Avoid building native apps, an AI concierge, unlimited SMS, broad verification
operations, and blanket discounts before their benefit is demonstrated.

Existing providers already create a cost surface: database/auth/storage, server
hosting, Maps/geocoding, embeddings, messaging, logs, monitoring, and support.
Supabase currently lists Pro from USD 25/month; extra projects and usage can add
cost. Google lists separate usage caps and charges for Dynamic Maps and Geocoding.
These facts inform the cost checklist; they do not establish this deployment's
bill or prove that EUR 300/month is adequate. Record actual bills and vendor
budgets before funding growth. [Supabase pricing](https://supabase.com/pricing),
[Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

## First experiment and decision gates

Proposed six-week pilot; timing starts after owners and required authorizations
are available. Targets below are hypotheses chosen for learning, not market
benchmarks or promises of statistically significant results.

1. **Week 1: establish the problem and baseline.** Review current deployment,
   define funnel denominators, prepare accurate product messaging, and research
   10 providers plus 15 potential customers. Choose a city/segment using reported
   repeat need, current booking friction, and willingness to publish availability.
   If no repeated problem or willing supply emerges, change the segment before
   building more features. Research messages are drafted until outreach is authorized.
2. **Weeks 2-3: prove supply and first-booking value.** Target 10 participating
   providers, at least 7 publishing a complete listing and upcoming availability
   within seven days. Observe at least 30 genuine in-scope searches; target at
   least 70% yielding three relevant available services. Below that, improve
   supply/filter matching before buying traffic. Measure confirmation, completion,
   and reasons for abandonment separately.
3. **Weeks 3-6: test the biggest bottleneck and pricing.** Choose one improvement
   from discovery, activation, or reliability using baseline evidence. Compare
   eligible cohorts and record denominators; use user sessions/interviews when
   traffic is too small for a reliable controlled test. Offer the Pro research
   proposition to 10 activated workspaces: at least 3 concrete commitments at
   EUR 19/month justifies an authorized paid pilot, not an assumption of revenue.
   Fewer than 3 means revise the value/segment/price before automated billing.
4. **Retention follow-up:** once 20 first-time completers have a full 30-day
   observation period, seek at least 5 repeat bookers for a frequent-use segment.
   If the natural service cycle is longer, use its predeclared interval instead.
   Do not conclude retention at week six if cohorts are not yet mature. Review
   provider continuation, payment renewal, cancellations, complaints, and support
   cost alongside customer retention.

First recommended implementation candidate: PM-01, followed by the narrow supply
pilot and whichever of PM-03/PM-04 the evidence supports. PM defines the brief;
frontend/backend owners implement their scopes; DB review and the user's option
selection are required for database changes; CI/CD owns release operations.
Preserve accessibility, supported languages/RTL, accurate prices/currency,
privacy, and security throughout. Do not substitute product analytics for TASK-018
or treat this document as approval to run persisted tests or commercial actions.

Sources were reviewed on 19 October 2026. Recheck prices, regional availability,
and provider terms before making a purchasing or launch decision.
