# Separate pending report totals — 7 November 2026

Status: completed locally; focused verification passed. Not deployed.

Requester: `/root`, originating user request: “Pending is not included in report.
Please add as separate summable value.” Assigned Front End Developer/executor:
`/root/provider_duration_frontend`. Acceptance under the user request and
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization)
covers reversible local report aggregation, presentation, export summaries,
translations and offline/mocked tests. No backend/database changes, connected
services, private configuration or deployment. Root owns coordination records.

Current contract: earned = completed; planned = confirmed only; pending = awaiting
confirmation (including legacy null statuses); lost = cancelled potential revenue.
Each booking contributes once, with exact minor-unit sums per currency. A fourth
summary card and numeric Pending column in CSV/XLSX/PDF summaries use the same
report totals. Explanatory text is updated in every supported locale. Existing
report navigation, periods, views, row statuses and export writers are preserved.

The original [report handoff](service-reports-handoff.md) records historical
implementation and verification. Its earlier pending-plus-confirmed definition
is superseded by this correction; historical evidence is preserved.

Validation scope: en/lv/ru only. ar (including RTL), zh, fr, de, hi, ja, pt and es
remain deferred. Physical devices, other browser engines and screen readers are
outside this focused check. Local mock fixtures reject writes/unexpected requests.

Checks and evidence:

- `node --import tsx scripts/test-service-reports.mjs` passed. Exact EUR/JPY/KWD
  sums, separate confirmed/pending buckets, pending-only/zero states, legacy null
  status, first/last inclusive period boundaries and excluded adjacent dates.
  CSV contains the separate pending summary; XLSX summary Pending cells are numeric.
- `node --import tsx scripts/test-service-reports-browser.mjs` passed in local
  headless Chrome at 390/1280 CSS pixels for en/lv/ru. Four accessible summary
  cards show earned 10, planned 20, pending 30 and lost 40 without double counting.
  Localized actual CSV/XLSX/PDF downloads include the Pending summary; observed
  PDF canvas text confirms header/value in the fourth summary column. Pending-only
  reports in each tested language show all other metrics zero; confirmed-only
  report shows pending zero. Existing navigation, list/grid, language switching,
  invalid/unapplied dates, empty/error states remain covered. No fixture writes,
  unexpected API requests, external network or runtime errors. Chrome process
  used scoped sandbox escalation already required by this local harness.
- `npm run check` passed for application TypeScript; fixtures are outside the
  application tsconfig and compiled by the browser harness's esbuild.
- Isolated Vite frontend production build passed, 2849 modules. Used existing
  React plugin/aliases with `configFile: false` and `envFile: false`, separate
  `output/reports-pending-build`, avoiding private environment/config files and
  existing deployment artifacts. Existing large-bundle/outdated Browserslist
  warnings remain. This was frontend bundling only, not server packaging.
- Visually reviewed `output/reports-pending-check/reports-390.png` and
  `reports-1280.png`: four readable summary cards, stacking on phone/four across
  desktop, help text and corrected definitions visible. Actual downloads are in
  the same directory with locale-specific filenames; prior report evidence remains.

Security: existing report workspace/authentication/data boundaries, text rendering,
CSV formula protection, numeric XLSX cells and dependency-free export writers are
unchanged. This introduces no requests or writes. It does not audit pre-existing
behavior, verify live balances, or establish accounting correctness beyond the
documented booking-value definitions. Existing PDF raster/text-accessibility limits
remain as documented in the original handoff.

Recovery: reverse only this pending-column/card/aggregation correction and its
focused test updates, preserving the pre-existing uncommitted report implementation
and unrelated work. No database or deployment recovery is needed.
