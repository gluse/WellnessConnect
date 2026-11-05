# Service and booking currencies — 3 November 2026

Status: implemented and verified locally; approved development migration applied
and read-only postflight verified on 5 November 2026. See
[implementation scope and evidence](currency-management-handoff.md).
Original planning record: user requested `/plan`.
Executor `/root` reviewed repository files only. No application, database,
credential, connected-service or deployment operations were performed.

## User decisions

- Show and book in the service currency. Optional customer-currency estimates
  are deferred to a later release; no exchange-rate integration in this release.
- Existing service and booking amounts are **EUR**. The dollar sign is incorrect.
  Backfill currency as EUR without converting or changing existing amounts.

The remaining behavior below is the recommended implementation plan, not an
implementation assignment or authorization for connected execution.

## Repository findings

| Evidence | Current behavior / implication |
| --- | --- |
| `shared/schema.ts`: services and bookings | `price`, `totalAmount` and `advanceAmount` use decimal(10,2), without a currency field. Bookings need an independent currency snapshot. |
| `client/src/components/forms-locale.ts` | `serviceAmount` deliberately prefixes `$`, with fixed two-decimal formatting. |
| `service-card.tsx`, `service-detail-modal.tsx`, `service-map.tsx`, `appointment-agenda.tsx` | Additional hard-coded dollar displays bypass the helper. |
| `provider/service-booking-fields.tsx`, locale `serviceForm.price` | Price input uses step 0.01 and a dollar-labelled translation. |
| `server/routes.ts`: POST `/api/bookings` | Server calculates totals with JavaScript Number and `toFixed(2)`; needs exact, currency-aware arithmetic. |
| `client/src/lib/service-sort.ts` | Price ordering compares bare numbers, which cannot correctly compare different currencies. |
| `provider/appointment-stats.tsx` | Summary adds bare booking amounts and prefixes `$`; must group by currency. Audit actual mounted uses rather than assuming this component is visible everywhere. |
| `shared/schema.ts`: addresses; `server/geocoding.ts` | Saved locations have text/coordinates/provenance but no structured country. Registered geocoding returns coordinates and Place ID, not a country code. |
| `server/billing/*`, billing tables and `provider/monthly-billing-panel.tsx` | Workspace subscription billing already has explicit EUR contracts/constraints and a currency formatter. Preserve its agreed EUR billing policy. |

The calendar proposal intentionally preserved previous currency behavior; this
plan supersedes that limitation for the currency task. Repository inspection does
not establish deployed schema, data quality or actual country distribution.

## Currency and location rules

Keep three concepts separate: service price currency, customer display currency,
and interface language. A Russian-language customer in Latvia can view a service
in EUR; an English-language customer viewing a UK service can see GBP. Language,
browser timezone and the customer's travel must never rewrite the service price.

1. **Persisted service currency wins.** Price is always an amount plus an uppercase
   ISO 4217 currency code. All customer views use that saved pair in this release.
2. **For a new service**, suggest the current local currency for its selected
   service-address country. Provider confirms or overrides the suggestion from
   the supported currency list. For example, LV → EUR, GB → GBP, US → USD, CA → CAD.
3. **Unknown country, multiple local currencies, or no address:** require an
   explicit currency choice; never silently fall back to USD. Permit a manual
   choice without granting location permission or calling a paid location service.
4. **Existing services:** retain their saved currency when an address changes or
   the customer moves. Changing currency is an explicit provider action, with
   the amount reviewed/confirmed; no automatic exchange or numeric relabelling.
5. **Copied services:** copy the amount and currency together, including when
   the address changes later. Never recalculate historical bookings from a listing.
6. **Customer location:** does not affect payable prices in this release. Later
   estimates can use explicit customer currency preference, then a deliberately
   selected customer country, then no estimate. Do not add IP tracking, GPS prompts
   or persistent customer preferences merely to format current prices.

Add an optional provider-confirmed ISO 3166-1 alpha-2 `countryCode` to workspace
addresses, with country selection in the shared address form. Do not infer it
from address substrings or treat coordinates alone as a country. Existing
addresses may remain unknown while their services keep confirmed EUR currency.
Country changes affect suggestions for new drafts, not saved prices. Reuse this
field for suggestions only; it is not verified tax residency or payment eligibility.
Automatic country extraction from geocoding is a later enhancement requiring
review of its API contract and the existing location-storage/expiry policy.

Use a versioned, locally packaged country/currency mapping based on Unicode CLDR,
with explicit handling of unknown/ambiguous entries. No runtime exchange-rate or
geocoding dependency. Support the active ISO currency codes with ordinary 0-, 2-
and 3-decimal minor units; exclude historical, fund/test and unsupported precision
codes from the selectable list. The list controls price metadata, not processor
payment eligibility. Keep currency selection independent of supported UI languages.

## Money and API contract

- Keep canonical API amounts as decimal strings paired with `currency`, e.g.
  `{ price: "50.00", currency: "EUR" }`. Never parse a formatted price as storage.
  Normalize database decimal strings to the currency's minor-unit scale in API
  responses; a wider database scale must not leak extra fractional digits.
- Recommended DB representation: exact numeric(13,3) for service price and booking
  total/advance, plus currency columns. This accommodates 3-decimal currencies;
  preserve current product amount limits explicitly rather than accidentally
  increasing them with the wider column. DB owner finalizes constraints and the
  migration after reviewing this contract.
- Validate supported codes, nonnegative finite amounts, allowed decimal places,
  upper bounds and total overflow on the server and in database constraints.
  Reject excess precision rather than silently rounding a provider's entered price.
- Convert decimal strings to integer minor units for arithmetic; use BigInt or
  equivalent exact arithmetic internally, serializing strings rather than BigInt
  values. No float multiplication or fixed two-decimal assumptions.
- Booking creation reads the current service price/currency on the server and
  saves `bookings.currency` alongside the existing total/advance snapshots.
  Client totals and currency cannot override them. Read/snapshot the price pair
  consistently so a concurrent listing edit cannot mix an old amount and new code.
- Calculate participant totals exactly; round advance percentages once to the
  currency minor unit, half up for these nonnegative amounts. Derive the balance
  as total minus advance so all displayed parts reconcile.
- Include the expected service price/currency in the booking request for change
  detection, not as authority. If they changed since the confirmation screen,
  return a controlled conflict requiring the customer to review the refreshed pair.
- Existing booking currency/amounts survive listing edits, reschedules, status and
  payment-status changes. Updating a listing affects only subsequent bookings.
- Extend public search, semantic/fallback/hydrated results, provider storefronts,
  details, copies and customer/provider booking DTOs so currency is never dropped.
  Preserve workspace ownership checks for price, currency and address edits.

## Display and interaction

Use one frontend money formatter accepting a canonical decimal amount, explicit
currency, and UI locale. `Intl.NumberFormat` provides locale-specific separators,
placement and currency fraction defaults. Currency selection is explicit in
[ECMA-402](https://tc39.es/ecma402/#sec-intl.numberformat);
[Unicode CLDR](https://www.unicode.org/reports/tr35/tr35-numbers.html#Supplemental_Currency_Data)
defines currency precision and territory currency data. Sources reviewed
3 November 2026. Pin the data version used during implementation.

- Show the ISO code with the formatted amount consistently, especially for dollar
  currencies: use currencyDisplay `code` initially, e.g. `EUR 50.00` in English.
  Accessible names identify currency; do not rely on a symbol alone.
- Replace hard-coded currency in search list/grid/map popups, service details,
  storefront/provider cards, booking confirmation/advance/balance, agendas,
  calendar details and any mounted summaries. Inventory translations and any
  generated messages/exports that actually contain money. Never edit generated
  `output/*` bundles as source.
- Provider form: amount plus currency selector; local-currency suggestion is
  clear, editable and retained across validation failures. Input parsing and
  precision feedback follow the selected currency and UI locale. Accept only
  deliberate supported input forms; reject ambiguous grouping/decimal input.
- Missing/unresolved currency displays “Currency unavailable” and blocks new
  booking confirmation; it must not fall back to dollars. Migration should resolve
  existing records before release, but the failure state remains explicit.
- **Mixed currencies:** group monetary summary totals by saved booking currency,
  preserving existing booking-status inclusion rules. Never present their sum as
  one revenue value. Defer reporting-policy changes to TASK-038.
- Disable price ascending/descending when the loaded result set contains mixed
  or unknown currencies; explain why and return an active price sort to default.
  Other sorts stay available. Any future price range must carry an explicit
  currency. FX-normalized cross-currency sorting is deferred with FX estimates.
- Keep workspace subscription amounts tied to their existing EUR contract;
  service/customer country must not change subscriptions, invoices or checkout.

## Delivery sequence and ownership

1. **DB + Backend contract review:** finalize supported codes/data version,
   precision constraints, address-country semantics, booking price-change conflict
   and response shapes. User's legacy selection is EUR, with no conversion.
2. **DB owner prepares an additive migration locally:** add nullable currency
   columns/address country, widen monetary precision, and prepare bounded EUR
   backfills plus constraint validation. Cover existing services and every booking
   independently, including inactive listings and bookings whose listing moved.
   Do not derive legacy booking currency from today's location. Review migration
   locking, preflight counts, recovery and target before connected execution.
3. **Backend owner:** exact money utilities, validation, full DTO propagation,
   server-owned booking snapshots, stale-price handling and offline unit tests.
   Coordinate mixed `shared/schema.ts` edits with DB; do not edit it concurrently.
4. **Frontend owner:** address-country input, service currency controls, shared
   formatter, all display paths, mixed-currency sort/summary behavior, supported
   translations and mocked tests. Check integrated API/type contracts with Backend.
5. **Migration/activation:** after exact-target authorization, apply reviewed
   additive changes and EUR backfills; verify, activate compatible backend/frontend,
   then enforce required currency for new writes and final constraints. Stop or
   gate booking/service writes during any transition where an old writer could
   omit currency. Never deploy a frontend that assumes EUR for all new records.
6. **Verification/handoff:** owners return actual results, prepared/applied status,
   remaining limitations and recovery. Deployment remains separate and held until
   authorized. No role assignment or connected execution is created by this plan.

Recovery favors additive compatibility: retain currency snapshots and precision,
disable the new write paths if required, and do not roll back to a dollar-only
client for mixed-currency data. Never truncate 3-decimal amounts or remove saved
currency information during rollback. Use attributable changes only and preserve
the repository's pre-existing dirty work and historical evidence.

## Acceptance and verification

- EUR backfill preserves every existing numeric amount; no default converts
  `50` to another number. Verify service and historical booking coverage separately.
- Country suggestions, explicit override, no-country/manual entry, address edits,
  copied services and customer travel/language changes follow the rules above.
- EUR/USD/GBP/CAD and 0-/3-decimal currency fixtures format and validate correctly;
  testing a currency does not add its associated UI language to the test matrix.
- Participant multiplication, zero/free prices, advances at 0/50/100%, half-minor
  rounding, upper bounds and invalid/excess-precision inputs are exact.
- Tampered amounts/codes and cross-workspace edits are rejected; stale booking
  prices require review; concurrent edits preserve a coherent saved price pair.
- Booking currency remains unchanged after listing currency/price/location edits
  and reschedules. Mixed-currency summaries and sorting cannot imply parity.
- No service dollar literals remain in active price rendering; subscriptions still
  show their existing EUR amount and pass their affected offline regressions.
- Test only **en, lv, ru**. Maintain all supported translations; **ar/RTL, zh, fr,
  de, hi, ja, pt and es are deferred**, preserving historical coverage records.
- Inspect runner imports/hooks before running checks; use synthetic fixtures and
  mocked APIs. Run affected backend/frontend regressions, TypeScript, isolated build
  and Chrome/Firefox/WebKit checks for narrow/desktop layouts, keyboard, focus,
  accessible currency names and enlarged text. No all-language runners.
- Connected DB checks, temporary/rolled-back writes, live booking flows and paid
  services require scoped authorization; offline tests do not prove live constraints.

Planning validation: source-to-plan review and local Markdown link/diff checks.
No application tests were run for this documentation-only task.

## Deferred customer-currency estimates

A separate proposal should select the rate source, licensing/cost, refresh/staleness
policy, caching and customer-preference storage. Always show the original service
amount beside an explicitly approximate conversion and rate timestamp. Missing or
stale rates must retain original prices. Estimates must never rewrite booking
currency or imply customer-currency payment support. Payment settlement, processor
currency expansion, FX fees, tax and cross-currency refunds need their own scope.
