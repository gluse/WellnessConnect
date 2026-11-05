# TASK-039 backend handoff — 5 November 2026

Status: local backend implementation and affected offline checks complete;
integrated frontend/type/build checks belong to the root handoff. Database
migration is prepared by the DB owner and has not been applied by this executor.

## Scope and authority

Requester/coordinator `/root`; accepting Backend owner/executor
`/root/currency_backend`. User approved implementing TASK-039 and its
[currency plan](currency-management-plan.md). AGENTS standing cooperation covers
the accepted local dependency. DB owner `/root/currency_db` explicitly reviewed
and delegated the booking transaction/query and search currency-state SQL edits.
DB owns schema/migrations; root and its money owner supply shared money/currency
helpers and frontend behavior. No connected database/service, environment-file,
credential, deployment or live application-startup operations were performed.

## Delivered behavior

- `server/money.ts` validates amount/currency changes, canonicalizes database
  scale padding for API responses and calculates authoritative booking snapshots
  using the shared exact minor-unit helpers. Currency changes require a reviewed
  amount in the same update. No EUR/USD fallback is invented while reading.
- POST `/api/bookings` requires `expectedPrice` and `expectedCurrency`. They are
  comparison inputs; submitted totals, currency, identity and statuses confer no
  authority. Stale price/currency returns HTTP 409 `{code: "PRICE_CHANGED",
  currentPrice, currentCurrency, message}`. Missing/invalid quotes return 400.
- The booking transaction rereads the service under its existing `FOR SHARE`
  lock, checks provider/workspace/employee consistency, preserves availability and
  capacity locking, and recalculates total/advance from that same locked price
  and currency. Concurrent price/currency changes fail without booking/message
  persistence. Existing bookings retain their saved currency and numeric amounts.
- Service creation/update validate money in storage; update validation merges
  partial input with the locked current listing. Listing copies already copy the
  full source pair. Existing workspace authorization remains in the routes.
- `serviceLocation` normalizes the service price for every storage-backed search,
  hydration, provider catalog/storefront, listing and booking-detail path; it adds
  address `countryCode`. Address saves persist the validated optional country.
  Customer/provider booking reads and changed-booking response DTOs normalize
  saved total/advance scale without deriving currency from today's listing.
- Server-paginated search now returns `priceSortAvailable` and `effectiveSort`.
  SQL aggregates currency over the entire eligible set after filters/radius/
  semantic threshold and before continuation/limit. Mixed or unknown currencies
  make price keys NULL, so no unlike amounts are compared. The service reruns the
  initial requested price sort in the existing default order. Signed cursors
  retain the effective sort; a currency change invalidating an active price
  continuation returns 409 `SEARCH_CURRENCY_CHANGED` and requires restarting.
- Application startup checks the DB owner's injected currency metadata guard
  before routes or workers start. Missing/drifted schema fails closed with the
  safe `currency_database` / `CURRENCY_DB_NOT_READY` diagnostic. The new app
  requires the prepared currency migration before startup.

Workspace subscription billing/payment collection policy is unchanged. No FX
rate service or customer-currency payment support was added.

## Verification

All commands below use synthetic data, injected metadata/query adapters or pure
logic; they load no private configuration or live database/provider client:

- `node --import tsx scripts/test-currency-backend.mjs` — 24 cases pass: amount/
  currency precision/bounds, explicit currency edits, DTO scale, quotes, exact
  snapshots/half-up rounding and optional validated countries.
- `node --import tsx scripts/test-booking-notes-backend.mjs` — 21 existing initial
  message/identity/auth/capacity/atomicity cases and 17 currency booking cases pass.
  Includes EUR/USD/CAD/JPY/KWD, required quotes, tampering, stale price/currency,
  edits between route read and locked storage read, overflow and DB scale padding.
- `node --import tsx scripts/test-booking-capacity.mjs` — existing capacity,
  pending/confirmed, employee/workspace, cleanup, overlap, provider-lock and route
  ownership regressions pass. Fixture requests now include the required quote.
- `node --import tsx scripts/test-customer-booking-actions.mjs` — authorization,
  saved availability, boundaries, transaction rechecks and safe failures pass.
- `node --import tsx scripts/test-search-storage.mjs` — affected query/filter/
  hydration/bounds/workspace regressions pass with the additional pure import.
- `node --import tsx scripts/test-search-pagination-backend.mjs` — 54 scenarios
  pass, including 620-row traversal, mixed/unknown currencies beyond the visible
  page, filtered single-currency ordering, stable fallback cursors and currency
  changes during continuation. SQL review confirms guarded currency aggregate
  precedes keyset continuation and limit; no SQL was executed.
- `node --import tsx scripts/test-startup-diagnostics.mjs` — 75 checks pass,
  including safe currency diagnostics and driver-message redaction.
- `node --import tsx migrations/currencies/test-readiness.mjs` — injected metadata
  readiness accepts complete definitions and rejects missing/drifted/malformed
  results; errors are redacted. DB owner also reviewed the pagination SQL.
- `git diff --check` for attributable backend/shared search/test edits passes.

Initial integrated TypeScript check found a backend ExpectedPrice type narrowing
issue, corrected by using a validated string-pair contract, plus frontend/shared
target issues routed to their owner. Root owns final integrated TypeScript/build
evidence; this handoff does not claim a fresh complete application check.

Language checks remain en/lv/ru only. ar/RTL, zh, fr, de, hi, ja, pt and es are
deferred; no historical evidence was overwritten. Currency fixtures do not imply
tests in the languages associated with those currencies.

## Activation and recovery

Review the DB owner's [handoff](currency-db-handoff.md) for the exact migration,
verification, target/approval and lock/recovery sequence. Apply/verify that schema
before starting the new app. This executor has neither applied the migration nor
started the connected app, so live constraints/concurrency remain unverified.

Recovery preserves currency snapshots, precision and existing amounts; revert
only attributable code if needed, and do not restart an old dollar-only writer
against new mixed-currency records. Existing dirty work is preserved. Root's next
action is integrated acceptance and any exact-target DB execution approval still
missing under AGENTS; no new permission round is needed for these local changes.

## Final contract review follow-up — 5 November 2026

Root requested a read-only integrated review, then accepted the two resulting
money consistency fixes under this same Backend assignment:

- Quotes now also require integer `expectedAdvancePaymentPercent` (0..100), with
  a null listing percentage treated as zero. Both the initial route read and the
  locked transaction compare it. A percentage-only edit returns `PRICE_CHANGED`
  with `currentAdvancePaymentPercent` alongside the current unit price/currency,
  so the frontend must refresh and require review of advance and balance as well.
- Pagination SQL now projects the ranked currency through `eligible` into each
  result row. Hydration rejects a different current currency with the existing
  `SEARCH_CURRENCY_CHANGED` refresh flow. DB owner explicitly accepted/delegated
  this projection, preserving the full-set gate, filters and cursor semantics.

Latest affected offline results: currency contracts **26** pass; initial-message
scenarios **21** and currency booking scenarios **25** pass; capacity regression
passes; pagination **57** pass, including currency changes between ranking and
hydration for default/ascending/descending order. Booking cases cover missing or
invalid expected percentages, percentage-only edits before/after the route read,
zero/default handling, and successful retry after reviewing the returned 100%
advance. Final attributable diff check passes. Root updates/rechecks modal and
browser fixtures under its frontend ownership. No connected operation occurred.
