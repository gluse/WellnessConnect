# TASK-039 currency metadata, exact money and display handoff

Status: implemented locally; focused offline checks pass. Integrated type/build
and browser evidence is recorded by the coordinating frontend owner separately.

Requester/coordinator: `/root`. Assigned frontend/shared-money executor:
`/root/currency_money`, accepted 5 November 2026 under the user's instruction to
implement TASK-039 and project standing cooperation. Scope: local shared money
metadata/utilities, shared frontend formatter and assigned price displays. No
database, private configuration, connected application, deployment or spending
operations. Public Unicode/SIX metadata downloads were approved by the execution
reviewer; these are public reference data, without customer/location requests.

## Changes and integrated contract

- `shared/currencies.ts` packages 153 current ordinary currency codes and 249 ISO
  alpha-2 countries. Suggestions use current tender currencies only; ambiguous
  cases such as Panama and Zimbabwe return null for explicit provider selection.
  Bulgarian services suggest EUR, reflecting its current currency in 2026.
- Active codes and country suggestions derive from pinned Unicode CLDR release-49,
  evaluated on 5 November 2026. Exclude CLDR exceptional regions and historical,
  fund/test/unknown currencies. `shared/unicode-license.txt` preserves the source
  data license. Downloaded input snapshots remain in `output/currency-metadata/`
  as reference evidence; the app has no network dependency on them.
- Monetary fraction digits use the authoritative SIX ISO 4217 current currency
  list published 17 September 2026. DB review caught that CLDR display rounding
  differs from ISO minor units for 15 codes, including HUF/AFN/IDR (ISO 2) and
  IQD (ISO 3). The shared validation/DB constraints and formatter consistently use
  ISO digits; the formatter explicitly overrides runtime ICU defaults.
- `shared/money.ts` exports strict `parseMoneyAmount`, DB-padding-aware
  `normalizeMoneyAmount`, `amountToMinor`, `minorToAmount`, and
  `calculateBookingAmounts`. Internal arithmetic uses BigInt; booking totals,
  advance and remainder reconcile exactly, with half-up advance rounding once.
  Existing per-record maximum 99999999.99 is preserved across currencies.
  Aggregate display can exceed that per-record limit. No currency is inferred.
- `client/src/lib/money.ts` uses explicit ISO currency codes and locale formatting,
  retaining decimal-string precision. Invalid/missing amounts or codes return
  null so callers show the translated `currency.unavailable` message.
- Shared result cards, legacy service cards/details/map, agenda rows and group
  attendees use the formatter; provider/public wrappers inherit these shared
  paths. The obsolete dollar helper is removed. Map popup text remains escaped.
- Appointment summaries group exact totals by saved booking currency, preserving
  the existing confirmed/completed inclusion rule. They never add unlike currencies
  into one amount. Calendar detail views reuse the agenda paths.

Public metadata sources:
[Unicode CLDR release-49](https://github.com/unicode-org/cldr/tree/release-49/common),
[SIX ISO 4217 current list](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml).

## Verification

`node --import tsx scripts/test-currency-money.mjs` passes: supported/unsupported
metadata, unknown/ambiguous country suggestions, ISO versus CLDR precision cases,
strict input rejection, database zero-padding normalization, bounds and participant
overflow, zero prices, half-minor-unit rounding, advance/balance reconciliation,
and exact decimal-string display beyond Number precision. Formatting and rendered
mixed-currency summaries cover en/lv/ru only, including aggregate totals above the
per-price limit and cancelled/pending exclusion.

Scoped `git diff --check` passes. An extra blank EOF in `forms-locale.ts` was
corrected before the final successful check. ES5-target TypeScript compatibility
was retained using a fixed BigInt scale table and `Array.from(Map)` rather than
requiring a project-wide target change. Root owns the integrated type/build and
Chrome/Firefox/WebKit checks; this handoff does not claim those results.

Arabic/RTL, Chinese, French, German, Hindi, Japanese, Portuguese and Spanish tests
are deferred. Root maintains supported translations. No live application or
database state was verified by this executor.

Recovery: revert only the attributable display/shared utility files if still
unused. Once new currency records exist, retain currency metadata/snapshots and
coordinate compatible application recovery; a dollar-only client is unsuitable
for mixed-currency data. No database recovery action was performed.
