# Reports List / Graph views — 7 November 2026

Status: completed locally; focused verification passed. Not deployed.

The user requested replacing Reports thumbnails with Graph. Requester `/root`
assigned Front End Developer `/root/provider_duration_frontend` under this request
and [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible local report graph helpers/components/page, necessary aggregate
precision correction, scoped report translations, focused offline/mocked tests.
No connected services, backend/database, private config, deployment, shared hooks,
global CSS or new dependencies. Concurrent audit work is preserved.

Both report modes now offer List (default) and Graph; thumbnail branches are
removed. Appointment graphs use actual appointment-day buckets from the applied
rows. Named-service graphs use the same sorted stable service-ID groups, with
visible booking counts, historical currencies and zero-booking services retained.
Each currency has its own chart panel; earned/planned/pending/lost are four
separate patterned status series. Compact mobile summary cards remain unchanged.
Native keyboard/click exact-value disclosures and List remain available; values
are not hover-only. Service plots resize their axis labels and fit the panel on
phones, with full names/IDs in exact data. Few-day plots also fit; longer series
(over seven appointment days) can scroll horizontally. Many services scroll
vertically inside a bounded panel. No zero dates are synthesized across huge ranges.

Daily aggregation uses bigint minor units until canonical output strings. Root
authorized a necessary report-only correction: grouped aggregation/sorting no
longer revalidates running aggregate totals against the single-booking price cap.
Individual booking validation/shared money rules remain. Number conversion is
only for chart geometry; exact formatted graph/tooltip values come from strings.
CSV/XLSX/PDF continue exporting the same numeric report data, not graph images.

Recharts remains installed 2.15.2; existing `ui/chart` and its ResponsiveContainer
are reused. Local installed component/type declarations were checked, together
with official [BarChart API](https://recharts.github.io/en-US/api/BarChart/),
[ResponsiveContainer API](https://recharts.github.io/en-US/api/ResponsiveContainer/)
and [versioned accessibility guidance](https://github.com/recharts/recharts/blob/v2.15.2/storybook/stories/API/Accessibility.mdx).
Current API docs include newer-version features; only installed 2.15.2 APIs are used.
No animations or remote chart/fonts/network are introduced. Chart configuration
keys/colors are controlled constants and text remains React-escaped.

Test language scope: en/lv/ru. All supported report translations maintained with
scoped patches; ar (including RTL), zh, fr, de, hi, ja, pt, es remain deferred.
Physical devices, other browser engines and screen readers are not certified.

Verification:

- `node --import tsx scripts/test-report-graph.mjs` passed exact local-date/status
  buckets, EUR/JPY/KWD separation and precision, stable named-service IDs/zero
  services, employee filtering, and en/lv/ru messages. Three same-day completed
  maximum-value bookings produce exact `299999999.97`, including grouped earned
  sorting, without applying a single-booking cap to the total.
- `node --import tsx scripts/test-service-report-groups.mjs` and
  `node --import tsx scripts/test-service-reports.mjs` passed prior status,
  currency, named-service, pending, period and export-writer regressions.
- `node --import tsx scripts/test-reports-graph-browser.mjs` passed real local
  headless Chrome in en/lv/ru at 320/390/768/1280 CSS pixels. Verified default List
  and Graph replacement in both report modes, exact daily values/status series,
  separate currency panels, native keyboard/click data disclosure, employee
  draft/applied filters, named-service IDs/visible zero counts, live locale
  switching, List return, unchanged compact summary height, and numeric CSV
  export from Graph mode. Normal service/few-day graphs fit horizontally with
  full scales; all SVG text remains inside bounds and no page overflow occurs.
  A 24-day case verifies keyboard horizontal scrolling; 24 long-name zero-booking
  services verify retained rows and bounded vertical scrolling. Empty and zero
  values remain covered. Patterns are mapped in both bars and legend swatches.
- `node --import tsx scripts/test-report-graph-precision-browser.mjs` passed
  daily/service KWD charts in en/lv/ru at 320px. Axis labels preserve nonzero
  `0.001`/`0.002` values, and exact cells retain `0.001`, `0.002`, `0.003`.
  Formatter unit assertions also cover `0.00025`. Axis formatting uses significant
  digits for small values and compact notation only from 1000 upwards.
- Affected previous browser regressions were updated to Graph and passed:
  `REPORTS_TEST_OUTPUT=output/reports-graph-regression node --import tsx scripts/test-service-reports-browser.mjs`
  and `REPORTS_EMPLOYEE_TEST_OUTPUT=output/reports-graph-employee-regression node --import tsx scripts/test-service-report-employees-browser.mjs`
  (variables assigned with PowerShell syntax). They cover en/lv/ru390/1280,
  original navigation/period/error states, employee/workspace/permission isolation,
  Graph/List transitions and actual numeric CSV/XLSX/PDF exports. Separate output
  folders preserve historical thumbnail and earlier report evidence.
- All browser checks used synthetic APIs and blocked external network: no
  connected writes, unexpected API requests, external network or runtime errors.
  Existing scoped Chrome process access outside the sandbox was required.
- Final `npm run check` passed. Fixtures are outside the application tsconfig;
  the browser harness compiled them with esbuild.
- Final isolated Vite production frontend build passed (3653 modules), reusing
  existing React plugin/aliases with `configFile: false`, `envFile: false`, and
  output `output/reports-graph-build`. Private env/config and deployment artifacts
  were not loaded/changed. Graph code is lazy-loaded in a separate approximately
  383kB chunk (107kB gzip). Existing main-bundle size/outdated Browserslist warnings
  remain. Server packaging/deployment was not exercised. Focused file whitespace
  checks and scoped `git diff --check` passed.
- Owner/root visually inspected final 390 mobile daily/service graphs, 1280
  desktop, Russian long-name 320 service graph and tiny KWD 320 graph. Mobile
  service scales/bar endpoints now fit rather than appearing offscreen.

Artifacts: `output/reports-graph-check/` contains `daily-390.png`, `daily-1280.png`,
`services-390.png`, `services-1280.png`, `many-services-ru-320.png`,
`tiny-kwd-ru-320.png` and the filtered Graph-mode CSV. Existing compact-summary
classes, aggregation definitions, numeric exports and prior artifacts are retained.
Supported translations have no fresh native-language editorial certification.

Recovery: revert the List/Graph replacement, graph helper/component and scoped
messages/test updates while preserving prior report/filter/summary/exports and
unrelated changes. Root owns integrated review and coordination. No database or
deployment recovery is needed.
