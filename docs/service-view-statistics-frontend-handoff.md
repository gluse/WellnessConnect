# Service view statistics — frontend completion, 8 November 2026

Status: local implementation and offline frontend verification completed.

Root assigned the Front End Developer under the user's report request and
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
The original `/root/provider_duration_frontend` implemented the initial UI and
storefront capture integration. On resumption, that owner was unreachable;
`/root/service_views_frontend_finish` accepted completion, tests and review of
this same frontend scope. Approval covers reversible local frontend files,
supported translations and isolated mocked tests/build only. No private
configuration, connected service/database, live application, deployment or
publishing was accessed. Backend and DB retain their own scopes and handoffs.

## Behavior and security

- The shared Reports selector includes **Service view statistics** for existing
  Reports users on Free and Pro. A direct `?report=serviceViews` entry also works.
  Selecting this report mounts only its capability check, not financial reports'
  booking/catalog queries. Free users see the Pro requirement; no statistics
  request executes until a Pro user explicitly presses Show report.
- Entitlement is checked for the active workspace. The frontend rechecks fresh
  server capabilities before every run; the server remains the authorization
  boundary. Personal billing/owner links follow existing authority. Company
  employees see an ask-owner message without a billing link.
- User/workspace/membership/permissions form the component and query scope.
  Report counts live in component state, with abort/generation guards against
  stale results. Workspace changes, unmount, capability errors, Pro expiry and
  entitlement revocation suppress old counts. No report counts are saved to
  browser storage. Direct API gates are verified by the Backend owner.
- Expiry schedules only future deadlines and clears results/rechecks access
  once at expiry. The completion review found and fixed a zero-delay request
  loop that otherwise could repeat checks after an already expired lease.
- Dates use the shared complete UTC calendar-day retention window: today minus
  89 days through today. Week/month presets end today, with native min/max and
  linked invalid-period errors. Company employee selection is explicit/applied;
  its help explains that views follow current service assignment.
- The report shows exact retained-detail-open counts, total views, stable service
  IDs and zero-view services. List and responsive horizontal Graph preserve
  exact counts using BigInt; accessible native graph-data disclosure supplies
  the table. Names render as text with bidi isolation. No visitor identity is
  requested or displayed. CSV/XLSX numeric exports and Unicode PDF reuse the
  existing writers, with definition/coverage notes included.
- Capture disabled, access unavailable, failed counts and empty catalogues have
  distinct states. The definition says repeats count, not unique visitors, and
  history may be incomplete before tracking, during interruptions or after
  deletion. No capture activation or historical completeness is assumed.
- Public storefront explicit details opens reuse the existing approved view
  endpoint. Catalogue rendering, owner preview, direct booking and sign-in booking
  return do not record details views. Repeat explicit opens each record once.
  Home's existing capture was preserved without adding a duplicate path.

Main files: [report component](../client/src/components/provider/service-view-statistics.tsx),
[helpers](../client/src/lib/service-view-statistics.ts),
[Reports shell](../client/src/pages/provider/reports.tsx),
[report registry](../client/src/lib/service-report.ts),
[storefront](../client/src/pages/storefront.tsx), and scoped `reports` locale keys.

## Verification

All browser/API data were synthetic, with mocked fetch boundaries and blocked
external network. Only the static fixture server and local headless Chrome ran;
the application/session/database server did not start. Windows Chrome needed
the same scoped process escalation as earlier browser work because crashpad
could not launch in the sandbox. No approval rejection or connected fallback
occurred. Browser fixture files are outside the application tsconfig and were
compiled by the browser harness with esbuild.

- `node --import tsx scripts/test-service-view-statistics.mjs` passed UTC calendar
  bounds/presets, exclusive Pro expiry, response scope/total validation, stable
  ranking, exact counts above JS safe integers, numeric CSV/XLSX/formula safety
  and en/lv/ru resource/placeholder checks.
- `node --import tsx scripts/test-service-view-statistics-browser.mjs` passed
  en/lv/ru at 320/390/768/1280 CSS pixels: Free visibility/no count requests,
  explicit Pro execution, exact large counts, retained zero service, employee
  draft/applied behavior, UTC validation, Graph/List/exact-data keyboard access,
  actual CSV/XLSX/PDF downloads, locale switching, expiry, denied Retry,
  ignored stale workspace response, disabled capture and error/empty states.
- After the expiry timer fix,
  `node --import tsx scripts/test-service-view-statistics-visual.mjs` passed
  focused capability-failure suppression, in-flight entitlement revocation,
  restricted employee scope, expiry clearing and bounded post-expiry capability
  requests. This checks the final changed timer without repeating the full matrix.
- `node --import tsx scripts/test-storefronts.mjs --frontend-only` passed existing
  isolated storefront regressions and added explicit-open/repeat/preview/render/
  booking/auth-return capture checks. Backend branches were not run.
- `node --import tsx scripts/test-provider-duration-browser.mjs` passed 24
  card/detail duration cases and three booking summaries in en/lv/ru390/1280,
  now also verifying one mocked capture per explicit open and none for booking.
- `node --import tsx scripts/test-service-reports.mjs`,
  `node --import tsx scripts/test-service-report-groups.mjs`, and
  `node --import tsx scripts/test-report-graph.mjs` passed prior date/status,
  pending, employee, exact currency, grouping, Graph and export regressions.
- `$env:REPORTS_TEST_OUTPUT='output/service-view-statistics-report-regression';
  node --import tsx scripts/test-service-reports-browser.mjs` passed existing
  Reports browser en/lv/ru390/1280 interactions/navigation, pending/error/zero
  cases and numeric downloads, preserving historical artifacts in other folders.
- Final `npx tsc --noEmit --incremental false` and isolated Vite frontend build
  passed. The build uses `configFile:false`, `envFile:false`, existing React
  plugin/aliases and `output/service-view-statistics-build` (3656 modules).
  Private environment/configuration and deployment output were not loaded.
  Existing main-chunk size and outdated Browserslist warnings remain.
- Scoped tracked-file `git diff --check` passed, with only Git's existing LF/CRLF
  normalization notices. No unexpected API requests, external requests, live
  writes or runtime errors occurred in the successful browser checks.

Artifacts in `output/service-view-statistics-check`: `free-390.png`,
`all-services-390.png`, `all-services-1280.png`, `en-390.png`, `en-1280.png`.
Owner and root inspected mobile Free/long-name/all-service Graph and desktop
captures: controls, total and exact counts are readable without page overflow.
Tables use a bounded keyboard-scrollable region on narrow screens.

Supported translations were maintained, but fresh tests are limited to en/lv/ru.
ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred. No native-language
editorial certification, physical-device, screen-reader, Firefox or WebKit coverage
is claimed. Existing broader historical evidence remains unchanged.

Recovery: revert only this report's component/helper/registry/shell and scoped
translation/capture/test changes. Preserve prior financial reports and concurrent
audit work. No database rollback or configuration recovery is required. Root owns
integrated acceptance; live counts and runtime tracking activation remain outside
this offline task and are not claimed verified.
