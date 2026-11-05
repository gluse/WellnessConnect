# TASK-039 implementation — 5 November 2026

Status: complete for implementation and approved development database migration.
Local checks and live read-only database postflight pass. Application startup,
live booking/session acceptance and deployment were not performed.
User approved implementation of the currency plan.
Approver/requester: user. Coordinator and frontend executor: `/root`.
Assigned Backend owner: `/root/currency_backend`; DB owner:
`/root/currency_db`; delegated frontend/shared-money owner:
`/root/currency_money`. All owners accepted through live agent tools.

Scope: local application code, shared contracts, currency metadata, migration
preparation, translations and offline/mocked verification described in
[the accepted plan](currency-management-plan.md). Existing amounts are EUR with
no numeric conversion; service currency is authoritative; customer FX estimates
are deferred. No connected database/private configuration/service operations or
deployment are authorized by this local implementation assignment. Prepare those
steps completely before requesting any missing exact-target execution scope.

Root owns forms, booking UI, search-sort controls, translations and integration.
Money owner owns shared money/metadata, formatter and display consumers. Backend
owns server implementation; DB owns `shared/schema.ts`, migrations and DB checks,
and delegates reviewed application query changes to Backend. Root owns task/queue
records. Preserve unrelated untracked `.search-commit-check-K0YgF2/` and
`output/directory-concept/` and historical evidence.

DB owner selected unconstrained exact numeric plus explicit amount and currency
precision constraints: fixed numeric(13,3) would round excess precision before a
CHECK could reject it. Preserve the existing maximum 99999999.99 explicitly.
Current server search pagination additionally requires a full-candidate-set
currency check before price sorting and pagination.

Verification covers en/lv/ru only. ar/RTL, zh, fr, de, hi, ja, pt and es remain
deferred while translations and historical evidence are preserved.
Recovery: revert only attributable local edits; after activation retain currency
snapshots and precision and avoid reverting to an incompatible dollar-only writer.

## Delivered behavior

- Services and independent booking snapshots carry explicit ISO currency codes.
  The migration backfills EUR without changing existing numerical amounts.
- Exact minor-unit arithmetic handles 0-/2-/3-decimal currencies, participants,
  half-up advances and remaining balances, preserving the existing price bound.
  ISO monetary precision is distinct from CLDR display-rounding defaults.
- Provider-confirmed address country suggests currency for new services. Untouched
  suggestions follow the final selected address; unknown country clears them.
  Saved/manual currency choices survive address changes. Changing currency on an
  existing service requires explicit amount review.
- Localized price input accepts canonical or locale decimal separators, rejects
  grouping/excess precision/bounds, and retains failed-save drafts. Country entry
  works with manual coordinates without requiring geocoding.
- Shared search/cards/maps/details/agendas and bookings display formatted amounts
  with ISO codes. Unknown currency has translated feedback and blocks booking.
  Summaries group exact totals by saved booking currency.
- Full-result-set validation disables mixed/unknown-currency price sorting before
  pagination. Frontend resets an active price sort, explains why and offers refresh
  for currency-invalidated continuations. Storefront price sorting is also guarded.
- Booking quotes compare expected price, currency **and advance percentage** to a
  coherent locked listing. Conflicts refresh amounts, retain messages/participants
  and require customer review/resubmission, without automatic booking retry.
- Final cross-owner review closed the advance-percentage-only quote change and
  rank/hydrate currency races. Currency changes between ranking and hydration now
  reject the response before unlike-currency prices can appear in the old order.
- EUR platform subscriptions retain their established contract. Supported locale
  sources were maintained; deferred locales have no fresh language-quality claim.
  Generated bundles were not edited as source. Customer FX estimates stay deferred.

Owner evidence: [money/display](currency-money-handoff.md),
[Backend](currency-backend-handoff.md), [DB](currency-db-handoff.md).
Root reviewed integrated contracts/source changes; Backend reviewed frontend quote
and search handling; DB reviewed/delegated query locking and projections.

## Verification

Passed with synthetic data, injected persistence/providers or mocked APIs:

- `npm run check` and fixture types via
  `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.currency.json`.
- Isolated Vite production build into `output/currency-build` and esbuild server
  bundle into `output/currency-server/index.js`. Existing stale Browserslist data
  and large-bundle advisories remain; no dependency upgrade was introduced.
- `scripts/test-currency-money.mjs`: metadata, precision/bounds, exact arithmetic,
  rounding, unknown codes, large decimal-string displays and separate summaries.
- `scripts/test-currency-backend.mjs`: 26 scenarios; booking route/storage
  `scripts/test-booking-notes-backend.mjs`: 21 existing + 25 currency scenarios;
  `scripts/test-search-pagination-backend.mjs`: 57 scenarios, including full-set
  currency checks, signed continuations and rank/hydrate races.
- Backend owner passed capacity, customer-action, search-storage and startup
  regressions; detailed commands/results appear in its handoff.
- `scripts/test-search-sorting.mjs` and `scripts/test-public-search-ui.mjs` pass;
  the mounted search page verifies mixed-sort reset and disabled options.
  `scripts/test-monthly-billing-ui.mjs`: 22 tests, preserving existing EUR billing.
- DB `migrations/currencies/check.mjs` and `test-readiness.mjs` pass offline schema,
  precision, required snapshots, EUR-backfill and injected metadata-guard checks.
- `scripts/test-currency-browser.mjs`: Chrome, Firefox and WebKit each pass 13
  behavior/viewport groups in en/lv/ru. Includes country/manual/unknown suggestions,
  saved currency, localized input, validation/failed-save retention, currency-change
  confirmation/focus, 200% provider-form reflow, changed price/advance review without
  retry, retained booking drafts, updated payload, unknown-currency block, 0-/3-
  decimal displays, separate summaries and 360/1280px previews. Evidence:
  [Chrome](currency-chrome-evidence.json), [Firefox](currency-firefox-evidence.json),
  [WebKit](currency-webkit-evidence.json). Root visually reviewed Latvian form,
  booking and compact summary; smaller monetary text fixed a split currency code.
- Existing `scripts/test-forms-phase2-browser.mjs` in Chrome, new evidence prefix:
  14 interaction groups, 63 en/lv/ru width cases and 112 translated keys;
  [evidence](currency-phase2-chrome-evidence.json). Covers booking/address validation,
  permissions/errors, pending/duplicate guards, payload/focus/keyboard behavior,
  light/dark contrast and enlarged text, with no unexpected network/runtime errors.
- Attributable whitespace and local Markdown link checks pass.

Browser tests use temporary profiles, loopback static fixtures and mocked APIs.
Sandbox Chrome crashpad initially failed; the isolated command passed automatic
execution review. The first alternate Playwright location lacked browser binaries;
existing temporary test tooling was located. Its optional host dependency scanner
executable was absent, so process-only `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`
allowed actual Firefox/WebKit startup; no application security control changed.
A concurrent final Firefox run hit an action timeout; the unchanged suite passed
alone. No dependencies were installed. Historical evidence is preserved.
Physical devices, real virtual keyboards/screen readers and fresh Arabic RTL
verification remain outside this evidence; deferred locales are listed above.

## Remaining activation and recovery

The approved preflight made one connection attempt under the default sandbox and
stopped with `ENOTFOUND` before TLS or any SQL. No migration, database write,
application startup, live booking/session flow or deployment occurred. The app
fails safely with `CURRENCY_DB_NOT_READY` until the schema is present. TASK-039
stays unchecked for required connected activation.

The [DB execution proposal](currency-db-handoff.md#connected-execution-proposal--pending-authorization)
prepares `migrations/currencies/0020_currencies.sql`, bounded read-only postflight
and recovery. Proposed target from existing records: development project
`hbkooiknruimukkhshrk`; assigned executor `/root/currency_db`. User approved this
exact-target TASK-039 preflight and migration on 5 November 2026 ("I do aprove"),
in reply to the concrete execution question. DB owner accepted through live agent
tools. Scope includes private target/TLS/preflight and migration/postflight access,
conditional on verified recovery and stop-on-first-failure. Confirm backup and writer cutover before
execution; stop on first failure, target mismatch or uncertain outcome. Prior
task-specific backup waivers do not apply. Migration uses bounded exclusive locks
and changes no ACLs.

The [single-attempt receipt](../migrations/currencies/source-preflight-receipt.json)
records the stop; root independently reviewed the sanitized receipt and preflight
runner. Exact target/principal and trusted-CA configuration guards passed locally;
live identity/TLS, schema/counts and writer state were not reached. Default sandbox
DNS/network restriction is a possible cause, not a verified diagnosis of a bad
hostname. No retry, alternative host or escalation attempt was made after failure.

Recovery inventory found no pg_dump/pg_restore on PATH, no local backup archive
directory and no accessible independently verified provider recovery point. This
does not establish that the provider has no backup; evidence is unavailable to the
executor. No backup export/installation/restore or prior waiver was inferred.

User subsequently replied "approve" to one fresh read-only preflight with network
access for the same named project. DB owner accepted through live agent tools.
The original receipt stays untouched; a small wrapper around the tested runner
writes a separate exclusive network-attempt receipt. The attempt uses automatic
execution review, stop-on-first-failure and no alternate host. This fresh scope
does not authorize migration, backup exports/installations, app startup or workflow
writes. Migration still requires independently verified recovery; network access
does not waive that condition.

The [network-attempt receipt](../migrations/currencies/source-network-preflight-receipt.json)
confirms verified TLS and the expected source/principals/PG17, all 26 existing
restricted-runtime readiness gates, 40 public tables, 27 services and 32 bookings.
The migration's prior schema matches; zero invalid monetary records and zero
other app/owner connections were observed. Root reviewed the sanitized receipt
and wrapper; the original receipt hash is unchanged. No SQL writes, migration,
backup operation or automatic retry occurred. Read-only connections were closed.

The attempt stopped at `verified_recovery_gate` with
`TASK039_RECOVERABLE_BACKUP_NOT_VERIFIED`. Archive mode/command/function presence
is not proof of a usable recovery point. Local tools/archive and independently
verifiable provider restore evidence are unavailable to the executor. This does
not prove that no provider backup exists. The user's original verified-recovery
condition remains unfulfilled.

The recovery alternatives presented were: provide independently verifiable current managed backup
and restore evidence, authorize protected logical-backup/tooling/export plus an
explicit restore-verification target, or explicitly approve a TASK-039-only
no-verified-backup exception for this development project and one migration attempt.
The last option accepts post-commit recovery risk. The DB owner prepared and
offline-tested the [inert apply-once runner](../migrations/currencies/apply-approved.mjs)
with pinned migration/receipts, fresh target/schema/writer guards, exact amount
fingerprints and bounded postflight. `test-activation.mjs` and `test-preflight.mjs`
pass; both preflight hashes are unchanged and no activation receipt exists.
Root reviewed the runner's integrated guards and verification contract. No
exception or migration was inferred or executed during preparation. See the final DB handoff section
for the concrete development-only waiver command and backup alternative.

User subsequently selected "yes proceed without backup" for exactly migration
0020 on development `hbkooiknruimukkhshrk`, accepting the stated recovery risk.
This explicitly waives the original verified-backup condition only for TASK-039
selection `TASK-039-2026-11-05`. Assigned DB executor `/root/currency_db` accepted
through live agent tools and executed the reviewed command once with network
access, fresh guards and bounded read-only postflight. Stop-on-first-failure,
no alternate target/host, no automatic retry or timeout increase, preserved prior
receipts and no app/worker/workflow/deployment operations remain in force.

## Completed development migration

The [activation receipt](../migrations/currencies/source-activation-receipt.json)
records one committed migration 0020 on `hbkooiknruimukkhshrk`, executed by
`/root/currency_db` under the exact user-selected backup exception. Fresh verified
TLS/target/principal/PG17 and existing schema/runtime guards passed. No other
app/owner connections were observed before execution; migration locks protected
the transaction. This is not a continuing writer lock.

- 59 currency-only updates: 27 services and 32 bookings, all EUR after migration.
- Counts unchanged; exact before/after monetary fingerprints match. No numerical
  conversion or repricing occurred.
- All 28 restricted-runtime readiness gates pass: 26 existing gates plus currency
  column and validated-constraint checks. New fields/defaults/exact numeric types
  match the shared schema contract.
- `attempted=true`, `committed=true`, `state=verified`, `retry=false`. Prior receipt
  hashes remain unchanged. Root independently reviewed the sanitized receipt,
  counts, amount-preservation result, all readiness flags and preserved hashes.
- Backup is explicitly waived and unverified, never represented as created.
  No other target, backup/export/install, unrelated ACL/configuration change,
  app/worker startup, workflow/session write or deployment occurred.

TASK-039 is complete for its approved code/migration scope. Use the compatible
updated app for subsequent startup; do not restore dollar-only clients/writers.
After commit retain snapshots and precision, without truncating 3-decimal amounts.
Physical-device/live workflow acceptance and deployment remain outside this run.
No outstanding authorized implementation or database-migration work remains.
