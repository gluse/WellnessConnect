# Gift cards implementation plan

6 November 2026, Europe/Riga. Tracked as TASK-045 in [TASKS.md](../TASKS.md).
Status: planning only; implementation and connected activation are not authorized
by this plan. No implementing owners have been assigned for this task.

## Selected scope

The user selected these options in the gift-card planning conversation:

- Both provider/workspace-specific and FitsMyTime-wide gift cards.
- Online purchase only for both types. No manual paid activation flow.
- Money balances for both types, rather than specific-service certificates.

Provider cards apply only to eligible services in their issuing workspace.
FitsMyTime-wide cards apply across participating eligible workspaces; they must
not promise universal acceptance. Both support partial use across bookings.
Issuer, seller, financial liability and money routing remain subject to the
commercial/provider feasibility milestone below; card branding alone does not
settle those responsibilities.

## Repository baseline

- [Service payments](../server/payments.ts) still return
  `501 PAYMENTS_UNAVAILABLE`; a booking confirmation is not a payment receipt.
- [TASK-024 billing decisions](monthly-subscription-decisions.md) select Stripe
  for monthly workspace subscriptions. That selection does not establish gift-card
  eligibility, connected-provider onboarding or a working service-payment flow.
- [Bookings and services](../shared/schema.ts) already have explicit currencies,
  immutable booking amount snapshots and limited payment-status flags. There is
  no gift-card ledger or provider-settlement model in the inspected code.
- [Money helpers](../shared/money.ts) provide exact currency-aware arithmetic.
  [Booking transactions](../server/storage.ts) coordinate creation, status changes,
  capacity and reminders; redemption must integrate with those transactions.
- TASK-044 has concurrent local currency-default work and a prepared migration.
  Coordinate with its owners before selecting migration numbers/readiness profiles.
  Preserve all existing dirty work and historical execution receipts.

## Milestone 1: confirm the operating model

Before committing to a processor or enabling sales:

1. Obtain processor confirmation for each exact gift-card model, operating entity,
   initial market, eligible services, currencies and provider reimbursement flow.
   Stripe is a candidate, not selected/approved for this feature. Its restricted
   list includes gift cards and third-party stored value; approval is specific to
   the service offered. [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses).
2. Define who issues each card, owes the remaining value, receives purchase money,
   supplies receipts, handles customer support and bears fees, refunds and disputes.
   Choose the payment configuration afterwards. Stripe's guidance likewise starts
   with the commercial relationship. [Merchant of record](https://docs.stripe.com/connect/merchant-of-record).
3. Have qualified advisers review the proposed voucher, consumer, tax, accounting
   and funds-handling model for the initial launch market. Record conclusions and
   applicable requirements; this document makes no legal classification.
4. Agree provider participation, eligibility, reimbursement timing, loss recovery,
   withdrawal/closure handling and treatment of existing outstanding balances.
   A platform-wide card may remain unspent for a long time and fund several
   providers; ordinary marketplace transfers are not assumed to permit that model.
5. Select the commercial rules listed below. Public research and local mock design
   may continue while these inputs are pending; do not sell or activate cards.

For comparison only: provider-owned online sales could use an approved connected
provider flow; a platform-wide issuer could require an approved stored-value or
specialist voucher arrangement. Stripe separate charges/transfers supports
decoupling a charge from transfers to multiple connected accounts, with fees,
refunds and chargebacks debited from the platform balance. This is a technical
candidate, not evidence of suitability for long-lived gift-card balances.
[Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers).

## Milestone 2: shared purchase and balance foundation

DB owner proposes additive card, purchase, ledger, booking-allocation and settlement
records with constraints, indexes, access controls and retention. Backend owns
application operations and APIs; coordinate shared contracts before edits.

- Each card has an immutable issuer scope, currency, original value and terms
  version. Never infer currency from UI language or change existing value when
  workspace defaults change. No foreign exchange in the proposed first version.
- Represent amounts exactly in currency minor units using existing money helpers.
  Separate available credit, reserved credit, redeemed credit and refunded value;
  ledger entries retain links to the purchase, booking and reversal they explain.
- Create the order and server-priced checkout request with durable idempotency.
  Show pending, paid, failed and uncertain outcomes without fabricating success.
- Issue/activate exactly once from verified successful payment, matched to amount,
  currency, order, processor identity and mode. Validate signatures and deduplicate
  events; tolerate reordering, delayed methods and request timeouts. Browser return
  alone is insufficient. [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).
- Deliver the purchased card through a durable, retryable delivery flow separate
  from payment activation. A failed email must not charge again or issue another
  balance. Confirm recipient/account-claim and resend rules before implementation.
- Store redemption secrets safely; protect any recoverable delivery copy, limit
  access, redact logs, rate-limit attempts and define replacement/revocation.
  Use authenticated claim/redemption and explicit workspace authorization.

Proposed first-version simplifications, not additional user selections: one
currency per card, no top-ups, no balance transfers between cards, no use to buy
another card or a Pro subscription, and one card per booking. Denominations,
amount limits and initial sale currencies still need selection.

## Milestone 3: booking redemption

Proposed lifecycle, pending cancellation/expiry rules:

1. Customer enters or selects a card during booking review. Server validates
   issuer/workspace acceptance, currency, card state and available value.
2. Show booking total, credit applied, amount due directly to the provider and
   remaining card balance. Existing service-price snapshots remain authoritative.
3. Atomically reserve the selected credit with booking creation, including pending
   provider-approval bookings. Define reservation expiry and abandonment handling
   so a pending request cannot lock funds indefinitely.
4. On completion, atomically convert reserved credit to redeemed value. For a
   platform card, create the corresponding provider payable exactly once.
5. On cancellation, proposed default is full release to the same card. Rescheduling
   preserves the allocation when price/currency stay unchanged; any changed price,
   scope or allocation requires an explicit review and atomic adjustment.

Existing bookings need an explicit decision on adding a card after creation.
Full card coverage and partial card coverage must be shown correctly without
claiming an unpaid remainder has been collected. Do not use the current limited
payment-status flags as the authoritative ledger or confuse credit reservation
with redeemed payment. Define group-booking and advance-amount presentation.

Locking/order rules and uniqueness constraints must prevent simultaneous spending,
duplicate completion, cancellation/completion races and double settlement. Every
business mutation and its required audit capture must share the intended atomic
boundary; recovery must reconcile uncertain processor results.

## Milestone 4: user and operator interfaces

Frontend owner implements accessible mobile/desktop flows and supported translations:

- Gift-card purchase entry with a clear choice of provider or FitsMyTime scope,
  amount/currency, recipient, acceptance rules, terms and hosted online checkout.
- Payment-status and delivery pages; printable card, safe account claim, balance
  and transaction history; booking review/application and clear failure recovery.
- Workspace participation/card activity and masked support views with limited
  permissions; platform Administration for reconciliation and exceptions.
- Show seller, expiry policy, refund contact and participating-provider restrictions
  before purchase. Stop new sales for an ineligible provider without silently
  erasing or stranding existing card rights.

No UI may offer manual issuance/activation as a substitute for the selected online
purchase flow. Refunds and support corrections are controlled financial operations,
not unrestricted balance editing. Existing card obligations must remain serviceable
if a workspace loses Pro; entitlement policy needs explicit selection.

## Milestone 5: refunds, settlement and operations

- Reconcile purchase cash, outstanding card liability, reservations, redemptions,
  provider payables, transfers, refunds, disputes and fees separately by currency.
  Gift-card sales are not automatically platform subscription revenue or profit.
- Settle only eligible platform-card redemptions through the approved arrangement.
  Distinguish payable, transfer submitted, confirmed, failed and uncertain states.
- Refunds require durable operations and confirmed processor outcomes. Reserve
  affected refundable value while processing so it cannot also be spent; record
  compensation/recovery on failure. Never silently delete spent value or history.
- Define behavior for disputes after partial spending or provider reimbursement,
  reversals, insufficient recovery funds and closed/ineligible providers. Surface
  exceptions to an accountable operator rather than automatically charging again.
- Define privacy/minimization, financial retention, audit events, monitoring,
  reconciliation ownership and a runbook. Avoid raw gift codes, recipient messages,
  payment secrets and wellness details in audit/operational logs.

## Decisions still required

These are material policy inputs, not routine owner implementation choices:

- Issuer/seller and approved processor/funds arrangement for each card model.
- Initial countries, currencies, denominations, min/max value and fees.
- Expiry and unused-value/refund rules, cancellation/no-show treatment, reservation
  timeout, transferability/account claim and lost-card replacement.
- Recipient email/gifting delivery, receipt responsibility and retention periods.
- Provider participation, Pro restrictions, reimbursement schedule, fee allocation,
  dispute-loss recovery and handling of provider withdrawal or closure.

Do not repeatedly ask the already selected card scope, online-only purchase or
money-balance questions. Present remaining choices together after feasibility
evidence supports practical recommendations.

## Verification and delivery gates

Frontend, Backend and DB owners must be assigned and accept their scopes before
implementation. CI/CD owns any infrastructure and rollout dependencies. This plan
does not assign agents, initiate provider contact or transfer another task's
connected-operation/backup-waiver authority.

Local acceptance covers exact money/rounding, card eligibility, partial/multiple
redemptions, negative-balance prevention, concurrency, atomic rollback, duplicate
and reordered payment events, delayed success, delivery retry, hold expiry,
cancellation/reschedule, refund/dispute races, settlement/reconciliation, access
isolation, secret redaction and failure recovery. Frontend validates purchase,
claim, redemption and operator flows with mocked APIs across supported devices,
keyboard/screen-reader behavior and browser checks appropriate to the changes.

Test only en/lv/ru. ar/RTL, zh, fr, de, hi, ja, pt and es are deferred; maintain
supported translations and preserve historical evidence without claiming coverage.
Inspect existing runners before invoking them. Run meaningful owner offline/mocked
tests and applicable types/build checks; this documentation-only preparation does
not execute application tests or connected services.

Release requires provider/model confirmation, selected terms, owner verification,
separately authorized exact-target migrations/configuration, sandbox purchase/
redemption/refund/settlement acceptance, reconciliation and operations readiness,
and explicit launch authority. No charges, live messages, credentials access,
connected database operations, spending or deployment are authorized by planning.

Recovery: additive migrations and independent sale/redemption controls designed
by the owners. Stop new sales safely while preserving existing balances, evidence
and support access; never erase issued liabilities through rollback. Revert only
attributable unactivated local work and preserve unrelated changes.

Next action: review this plan, settle the feasible operating model and commercial
rules, then authorize scoped local implementation with the responsible owners.
