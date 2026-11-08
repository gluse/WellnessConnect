# Provider page duration display — 6 November 2026

Status: implemented locally; focused browser regression and type checks passed.

Request: the user reported `/providers/teskaistumam` showing durations only in
minutes, including 240 minutes. Root routed this accepted fix to the assigned
Front End Developer `/root/provider_duration_frontend` under the standing
[cooperation authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible local frontend component edits and synthetic/offline checks;
no connected services, private configuration, database operations or deployment.

The provider route uses the legacy `ServiceCard` and `ServiceDetailModal`, which
formatted minutes directly. Both now call the existing `formatServiceDuration`
helper, as does the booking dialog summary reached from these details. Thus 240
minutes displays as `4 hours` in English, `4 stundas` in Latvian and `4 часа` in
Russian; mixed durations retain their hours/minutes or days/hours/minutes.
Canonical API values remain minutes. Existing group price labels remain unchanged.

Validation:

- `node --import tsx scripts/test-service-duration.mjs`: passed existing duration
  conversion and exact en/lv/ru formatting/plural checks.
- `npm run check`: passed repository TypeScript check. The new fixture is outside
  the application tsconfig and is compiled by esbuild during the browser check.
- Isolated Vite production frontend build: passed (2846 modules), output in
  `output/provider-duration-build`. Used `configFile: false`, `envFile: false`,
  existing React plugin/aliases and a separate output directory to avoid loading
  private environment files or changing deployment artifacts. Existing chunk-size
  and stale Browserslist-data warnings remain; no dependency changes were made.
  This verifies frontend bundling, not server packaging or deployment.
- `node --import tsx scripts/test-provider-duration-browser.mjs`: passed 24 card
  and detail cases (45, 90, 240 and 1501 minutes; en/lv/ru; 390 and 1280 CSS pixel
  widths), three desktop booking summaries, live language switching, and horizontal
  wrapping/clipping assertions. Real local headless Chrome, synthetic provider,
  category, authentication and availability responses; no writes, unexpected API
  calls, external network or runtime errors. The initial sandbox launch failed at
  Chrome crashpad startup; the scoped escalated run passed, including the rerun
  with clipping assertions.

Security review: the change renders formatter output through React text, reuses
the existing resolved locale and adds no HTML/URL sinks, credentials, dependencies
or API behavior. This focused change does not audit pre-existing component issues.

Deferred: ar (including RTL), zh, fr, de, hi, ja, pt, es; physical devices, screen
readers and other browser engines were not tested. No live provider-page or
deployed verification is claimed.

Recovery: revert the import/expression changes in the three scoped components;
remove only the new provider-duration fixture/test/handoff when no longer needed.
Preserve unrelated existing work. Root owns integrated review/coordination and
the final user handoff; deployment remains outside this task.
