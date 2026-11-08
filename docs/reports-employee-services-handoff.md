# Reports by employee and named service — 7 November 2026

Status: completed locally; focused checks passed. Not deployed.

Requester `/root` assigned Front End Developer `/root/provider_duration_frontend`
under the user's report request and [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Accepted scope: reversible local report helpers/page/component, browser exports,
translations and isolated offline/mocked checks. The user selected grouping each
named service (not group versus one-to-one). No backend/database changes, connected
services, private environment/configuration, infrastructure or deployment.

Company reports offer All employees, each server-visible employee, and explicit
Shared / unassigned. Employee and date drafts apply together via Show report;
presets apply the current employee selection. The displayed scope also appears
in downloads. Booking list/grid and exports identify the booked employee; missing
names use a localized Employee #ID fallback. Personal reports hide company employee
controls. Historical filtering uses booking.employeeId, never a service's mutable
current assignment.

The second report groups each stable service ID and booking currency separately,
with booking counts/status counts and earned/planned/pending/lost sums. Identical
names are not merged. Services missing from the current catalog remain represented
by their booked data. The server-allowed current catalog, including inactive
services, contributes zero-booking services, restricted by the selected employee's
current assignment. Zero bookings means “No bookings in selected period”, not
measured interest, views, profitability or a forecast. Revenue ranking compares
within each currency; booking-count ranking can identify services with fewer
bookings. All status sums preserve the [separate pending correction](report-pending-handoff.md).

Data/security: report-local catalog and employee query keys include user,
workspace, membership and permissions, with no previous-data placeholder or
unscoped global-cache reuse. Existing server endpoints restrict employees,
catalog and bookings to the caller's permitted workspace/employee. Loading or
lookup errors hide results/exports until resolved; an unavailable catalog is
never presented as zero demand. Workspace/permission changes remount/reset report
state and suppress completion of asynchronous old-workspace downloads.

CSV/XLSX include employee labels or grouped service IDs, per-status counts and
numeric per-currency amounts. PDF retains five summary columns and fits each
detail/group table into the printable width, with wrapped titles/subtitles,
headings and paginated rows. XLSX widths cover every exported column. Existing
formula-injection protection, text escaping, raster PDF limitations and download
URL cleanup remain. No new dependencies.

Verification scope: en/lv/ru only; all supported translations maintained.
ar (including RTL), zh, fr, de, hi, ja, pt, es remain deferred. Physical devices,
other browser engines and screen readers are not part of these focused checks.

Checks/evidence:

- `node --import tsx scripts/test-service-report-groups.mjs` passed exact decimal
  revenue/status counts, stable IDs with duplicate names, same-service historical
  currencies, missing catalog history, inactive zero-booking services, current
  versus historical employee assignment, shared filters and currency-safe sorting.
- `node --import tsx scripts/test-service-reports.mjs` passed existing period,
  currency, pending-split, resource and CSV/XLSX regressions.
- `npm run check` passed application TypeScript. Browser fixture files are outside
  its include list and were compiled by the harness's esbuild.
- `node --import tsx scripts/test-service-report-employees-browser.mjs` passed
  real local headless Chrome at 390/1280 CSS pixels for en/lv/ru. Exercised all,
  individual and shared employee filters; draft/apply behavior; original employee
  list/grid/export labels; both report modes; zero catalog rows; duplicate names;
  historical currencies and assignments; count sorting; numeric CSV/XLSX group
  counts and revenue. Eighteen actual downloads (two report modes, three formats,
  three tested languages) include the applied employee scope. Every PDF drawn
  text item was checked against horizontal and page-bottom bounds; the final
  grouped revenue column was present. XLSX column widths cover all twelve columns.
- The same suite passed poisoned unscoped-cache, restricted employee permission,
  company-to-company/personal reset, and late old-workspace employee-response
  assertions. Employee/catalog loading/error/retry states hide partial results;
  no unavailable catalog is treated as zero demand. Synthetic APIs only; no writes,
  unexpected requests, external network or runtime errors.
- Original browser regression also passed en/lv/ru at both widths:
  `REPORTS_TEST_OUTPUT=output/reports-employees-regression node --import tsx scripts/test-service-reports-browser.mjs`
  (the environment variable was assigned with PowerShell syntax). Original pending,
  empty/error/invalid/unapplied dates, navigation, views and downloads remain covered.
  The output override preserves prior task evidence.
- Final isolated Vite production frontend build passed (2853 modules), with
  existing React plugin/aliases, `configFile: false`, `envFile: false` and output
  `output/reports-employees-build`. No private env/config loaded or deployment
  artifacts changed. Existing large-bundle/outdated Browserslist warnings remain.
  Server packaging/deployment was not exercised.
- Visually inspected phone grid/desktop list screenshots and actual extracted
  English/Russian grouped PDF pages. Root independently inspected screenshots and
  grouped/employee PDF pages. Four money metrics, zero labels and final export
  columns remain readable; new select labels use clear label-above-control spacing.
  PDF wraps very narrow headers within words; CSV/XLSX remain text alternatives.
- Scoped `git diff --check` passed. Build and synthetic-browser operations are
  local only. Chrome required the existing scoped outside-sandbox process access.

Artifacts: `output/reports-employees-check/` contains final screenshots, actual
locale-specific CSV/XLSX/PDF downloads and extracted PDF page JPEGs. Earlier report
and pending-correction evidence is preserved. Supported translations have no fresh
native-language editorial certification.

Recovery: revert only this employee/grouping addition in report files/resources
and focused tests; preserve the existing reports implementation, pending split,
navigation, historical verification artifacts and unrelated changes. Root owns
integrated review and coordination. No database/deployment recovery is needed.
