# Service reports — 7 November 2026

Current correction, 7 November 2026: the user requested Pending as a separate
summable value. [Pending correction handoff](report-pending-handoff.md) supersedes
the historical planned = pending + confirmed definition below: planned now counts
confirmed only, and pending has a separate card and numeric export summary column.
Historical implementation/verification evidence below is preserved.

Further addition, 7 November 2026: [employee and named-service report handoff](reports-employee-services-handoff.md)
documents the company employee filter, employee labels in booking rows/downloads,
and the second report grouping named services with zero-booking catalog entries.

Completed locally by `/root` under the user's specific Reports request and
“I give you all permissions” authorization in this session. Accepted scope:
frontend Reports page, provider navigation, translations, browser downloads,
and focused offline verification. No backend, database, infrastructure, private
configuration, or connected service changes. No deployment was performed.

## Behavior and implementation

- `/my-services/reports` appears in the shared provider section list: mobile
  burger menu and desktop My Services sidebar.
- Inclusive local appointment date range; Monday–Sunday This week and full
  calendar This month presets. Custom dates apply with Show report. Pending
  edits leave the displayed results and downloads on the displayed period.
- Responsive list/grid, completed/pending/confirmed/cancelled status labels,
  loading/error/retry/empty states, and summary cards.
- Earned = completed booking value; planned = pending + confirmed value;
  loss of profit = cancelled potential revenue. These are booking-value
  estimates, not receipts or accounting profit; the interface explains this.
  Amounts use existing exact minor-unit helpers and remain separate by currency.
- Reuses authenticated `/api/bookings/provider`; existing server workspace and
  employee visibility restrictions apply. Account, workspace and permissions
  identify the query scope. Workspace changes hide/remount the page; unmounted
  pages cannot finish an asynchronous download.
- Report type registry leaves an extension point for future report types.
  Filtering, rendering, and export formatting are separate modules.
- PDF, real XLSX, and UTF-8 CSV contain the same applied results and summaries.
  Export module loads on demand; no new dependencies. XLSX uses typed numeric
  amounts and explicit inline strings, XML escaping and a ZIP container. CSV
  prefixes formula-like user text. Exports omit customer names, notes and contact
  details. Downloads run entirely in the browser and revoke temporary URLs.
- PDF uses paginated raster pages with browser Unicode rendering and no remote
  font download. Its text is not selectable/searchable or tagged for screen
  readers; CSV/XLSX provide text alternatives. Native Excel desktop and an
  independent PDF viewer were not exercised.

## Verification

- `node --import tsx scripts/test-service-reports.mjs` passed: period bounds,
  inclusive last day, invalid dates, Monday week/leap-month presets, status
  buckets, exact decimal sums, EUR/JPY/KWD separation, empty results, CSV formula
  handling, XLSX generation and en/lv/ru resources.
- `npm run check` passed after fixing collection iteration for the existing
  TypeScript target.
- `npx vite build --outDir ../output/reports-build` passed. Existing large-bundle
  and outdated Browserslist warnings remain; export chunk is about 6.4 kB.
- `node --import tsx scripts/test-service-reports-browser.mjs` passed in Chrome
  at 390 and 1280 CSS pixels for en/lv/ru. Exercised actual burger/sidebar
  navigation, no page overflow, list/grid, totals, all three downloads, unapplied
  dates, invalid and empty periods, month preset, live language switch, and denied
  loading. APIs are synthetic and unexpected network/writes fail the fixture.
  Sandbox Chrome initially failed to launch; the same isolated check passed
  with scoped process access outside the sandbox.
- Visually inspected mobile/desktop screenshots and the PDF's embedded page.
  Independently opened both generated XLSX ZIP archives and parsed every XML
  part with .NET. Checked actual PDF object/xref offsets and JPEG stream.
- `git diff --check` passed. No connected application/database checks were run.

Evidence is in `output/reports-check/`; isolated build in `output/reports-build/`.
Translations were added for all supported languages. Only **en, lv, ru** were
tested. **ar (including RTL), zh, fr, de, hi, ja, pt, es** remain deferred.
No native-language editorial review, physical-device, Firefox/WebKit or
screen-reader validation is claimed.

Format references: [Microsoft SpreadsheetML](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document),
[PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT),
[PDF 32000-1](https://opensource.adobe.com/dc-acrobat-sdk-docs/standards/pdfstandards/pdf/PDF32000_2008.pdf).

## Recovery and next action

Review locally. Recovery is to remove the new report page/helpers/tests and
report resource blocks, then revert only the Reports route and section entry.
Preserve pre-existing untracked files and unrelated work. No database recovery or
deployment action is necessary.
