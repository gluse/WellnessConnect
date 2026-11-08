# Compact mobile report summaries — 7 November 2026

Status: completed locally; focused verification passed. Not deployed.

The user requested a smaller mobile presentation of summed report metrics and
permitted hiding their descriptions. Requester `/root` assigned Front End
Developer `/root/provider_duration_frontend` under the user request and
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Accepted scope: report metric presentation only, synthetic browser-fixture/test
coverage and this handoff. No aggregation, employee filters, exports, global CSS,
translation, backend/database, connected-service, private configuration or
deployment changes. Concurrent audit work is preserved.

Earned/Planned/Pending/Lost now form a two-by-two grid on phones, with smaller
gaps, card padding, labels and amounts. Descriptions and decorative icons hide
below 640 CSS pixels. Names, currency amounts and accessible card headings remain.
Larger screens retain descriptions/icons and spacious padding; at 1280 pixels the
four cards remain in one row. Long amounts wrap rather than clip, and multiple
currencies remain separate. Both report modes use the same summary presentation.

Focused acceptance: Chrome at 320/390/768/1280 CSS pixels, en/lv/ru, booking and
named-service reports; single/multiple currencies, long amounts, zero/empty
states; two mobile columns, hidden mobile descriptions/icons, full visible
labels/amounts, no page overflow and preserved desktop descriptions.

Verification/evidence:

- `node --import tsx scripts/test-reports-mobile-summary-browser.mjs` passed all
  120 presentation cases: 3 tested languages, 4 viewport widths, 5 amount states
  and 2 report modes. Real local headless Chrome with synthetic APIs and blocked
  external network. Verified actual two-column positions, mobile help/icon hiding,
  larger-screen help/icon visibility, accessible headings, complete text ranges
  inside cards, no horizontal page overflow, multi-currency/zero/empty content.
  No writes, unexpected requests, external network or runtime errors.
- At 390 CSS pixels the full summary measures 154px for single-currency and
  207px for multiple currencies in en/lv/ru. At 320px it measures 154–187px single,
  207–240px normal multiple, and 274.5–307.5px for long maximum-value totals. Long
  figures wrap fully. At 1280px four spacious columns and helper text remain.
- The first synthetic large-value case exceeded the existing per-booking money
  cap and correctly failed loading. The fixture was corrected to valid
  `99999999.99` bookings, producing an aggregate earned total `199999999.98`.
  The complete corrected matrix passed; production validation was unchanged.
- `npm run check` passed. Isolated frontend production Vite build passed, 2853
  modules, existing React plugin/aliases with `configFile: false`, `envFile: false`,
  output `output/reports-mobile-summary-build`. No private configuration loaded
  or deployment artifacts changed. Existing bundle-size/outdated Browserslist
  warnings remain; server packaging/deployment was not exercised.
- Owner/root visually inspected final 390 mobile, 1280 desktop and Russian 320
  large-value screenshots. Full totals remain readable; very long amounts may
  wrap over lines at narrow widths. No screen-reader or physical-device claim.
- Scoped whitespace checks passed. Aggregation/filter/export suites were not
  rerun for these CSS/presentation-only changes; their earlier evidence remains.

Artifacts: `output/reports-mobile-summary-check/summary-390.png`,
`summary-1280.png`, `summary-large-ru-320.png`; `evidence.json` records browser
version and all measured viewport/locale/scenario heights. Prior report evidence
was preserved. The existing fixture gained only synthetic large/zero sum options;
the focused runner is `scripts/test-reports-mobile-summary-browser.mjs`.

Deferred: ar (including RTL), zh, fr, de, hi, ja, pt, es; physical devices,
other browser engines and screen readers. All supported translations remain.

Recovery: reverse only metric classes/test selectors in the report page and the
new focused fixture parameter/test/handoff. Preserve all report data behavior,
earlier evidence and unrelated work. Root owns integrated review/coordination.
