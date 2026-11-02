# Search redesign — 2 November 2026

## Authorization and scope

User approved the reviewed Where / When / What design and explicitly requested
implementation in this conversation on 2 November 2026. Approver: user;
executor: `/root`, specifically authorized for this frontend task. Accepted scope:
local search page, result cards, map preview presentation, supported translations,
frontend fixtures/tests and this handoff. Preserve the existing language/account
controls, one-to-one/group and booking-mode labels. All result images/placeholders
must be square across grid, compact list and map previews.

Use existing search APIs and data contracts. No backend/database/schema changes,
connected database operations, deployment or paid service execution are included.
Offline browser checks mock API, authentication, geocoding, geolocation and Maps.
Preserve unrelated working-tree changes, including existing header/locale work.
Recovery: revert only this task's edits and new fixture/evidence files; never reset
the shared working tree.

## Status

Completed locally and verified. Default empty search immediately shows the
unfiltered catalog in list mode, using the existing endpoint, limit and ordering.
An explicitly remembered location still restores. Opening the location picker is
optional; location restoration/save failures remain visible and recoverable.

The compact search bar contains Where, When and What. When opens a date/time
range dialog, using the existing validation and request contract; it synchronizes
the advanced Filters date fields without applying unfinished category/query
drafts. Keyword/AI modes remain in a collapsed disclosure. Category, radius,
audience and session-type controls remain available in Filters at every width.

Grid uses two phone columns, three tablet columns and four desktop columns.
Compact list prioritizes descriptions and uses smaller thumbnails. Both retain
duration, One-to-one/Group, Instant booking/provider approval, prices, provider
links and review access. Compact ratings preserve the review dialog behavior.
Changing views preserves applied results, filters and sorting without refetching.

All grid/list images and missing/broken-image placeholders use a fixed 1:1 box
with cover cropping. Map markers, selection and hover/dismissal behavior remain;
map previews now include a square thumbnail plus duration/session/booking labels.
Provider text is still rendered with React text nodes or DOM `textContent`.

The existing shared header's language/account controls and navigation were
preserved. The only header edit extends its existing short-viewport static
positioning rule to Search (including authenticated `/`): at native 400% zoom,
the sticky header otherwise covered the results controls. Other sessions' header
changes were preserved; recovery must remove only this task's `searchArea` flag
and condition addition, not replace the whole file.

## Verification

All checks below passed against local code with synthetic data. No connected
application server, database, auth session, paid Maps request or deployment was
used. HTTP fixtures reject unexpected requests and block external network access.

- `node --import tsx scripts/test-search-redesign-browser.mjs`: 9 behavior groups
  and 36 en/lv/ru × 320/390/768/1280px × grid/list/map cases per engine. Passed in
  Chrome 156, Firefox 157 and WebKit 27.2. Covers shared header/account controls,
  optional empty search, view/sort preservation, image geometry/fallbacks, required
  labels, independent drafts, date validation/focus, location denial, map preview
  and failure recovery, rate-limit retry, light/dark text contrast, 200% text
  reflow and dialog keyboard containment/restoration.
- `node --import tsx scripts/test-search-redesign-accessibility.mjs`: 6 native
  Chrome 400% zoom en/lv/ru grid/list cases, including square images, page reflow
  and scrollable When/Filters dialogs. Verified DPR 4, CSS zoom 1 and visual scale 1.
- `node --import tsx scripts/test-search-page-browser.mjs`: existing search-page
  regression, 5 behavior groups and 12 locale/viewport cases.
- `node --import tsx scripts/test-search-location-modal-browser.mjs`: 4 location
  dialog groups and 12 locale/viewport cases, including consent defaults, focus,
  restore failure/retry and short-viewport/200% text layouts.
- `node --import tsx scripts/test-saved-search-location-browser.mjs`: 7 groups for
  explicit remember/forget, guest return, account adoption/isolation, failed
  restore/save/delete recovery and stale geocoder completion after account change.
- `node --import tsx scripts/test-search-location-browser.mjs`: 7 groups including
  denied permission without retry, bounded unavailable/timeout retry, unsupported
  and insecure contexts, exceptions, invalid coordinates, the actual 35-second
  deadline, duplicate prevention and late callbacks. Only en/lv/ru exercised.
- Offline component/unit regressions passed:
  `node --import tsx scripts/test-public-search-ui.mjs`,
  `node --import tsx scripts/test-search-sorting.mjs`, and
  `node --import tsx scripts/test-map-lifecycle.mjs`. Map checks include literal
  hostile markup rendering and broken-image fallback.
- Fixture typing: `npx tsc --project scripts/fixtures/tsconfig.search-redesign.json`.
  Application typing: `npm run check`. Frontend build: `npx vite build`.
  Build warnings: existing large-bundle warning and outdated Browserslist data;
  no dependency updates or backend builds were required.

Browser regressions were updated for the intentional optional-location behavior
and moved controls, preserving their meaningful assertions. New evidence uses
`search-redesign-*` names; previous historical screenshots/reports remain.
Chrome initially failed to launch inside the sandbox; the same isolated fixture
was allowed through scoped process escalation and passed. WebKit checks await
dialog animations and asynchronous focus restoration rather than assuming these
finish immediately after DOM removal.

Evidence: [Chrome](search-redesign-chrome-evidence.json),
[Firefox](search-redesign-firefox-evidence.json),
[WebKit](search-redesign-webkit-evidence.json),
[400% zoom](search-redesign-zoom400-evidence.json),
[location dialog](search-redesign-location-evidence.json),
[saved locations](search-redesign-saved-evidence.json),
[GPS](search-redesign-gps-evidence.json),
[existing search regression](search-redesign-regression-evidence.json).
Rendered desktop grid, phone grid/list/dark, map and account-header screenshots
were inspected; fixture images are synthetic samples/placeholders, not real
provider photographs or live geographic data.

Scope is English (`en`), Latvian (`lv`) and Russian (`ru`). Arabic
(including RTL verification), Chinese, French, German, Hindi, Japanese,
Portuguese and Spanish are deferred. Supported translations remain maintained;
new messages were added without rewriting existing translations. Native-language
review, screen readers, physical devices, real Maps/geocoding and live booking
remain unverified. These checks are not a WCAG conformance or full security audit.

No backend/database dependency or schema change is needed. No deployment was
performed. Next action is user review in the normal local application; deployment
remains subject to the project's existing environment approvals and holds.
