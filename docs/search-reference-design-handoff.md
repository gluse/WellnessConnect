# Search reference design — 4 November 2026

Status: completed / verified locally; not deployed.

User requested a local commit when complete. Commit scope includes this design's
application changes, four locale labels, runner, handoff/queue entry and synthetic
browser evidence. Existing booking/privacy edits in shared locale files are excluded.

User supplied a service-search mockup and assigned this frontend design change.
User clarified **"For mobile app"** in the follow-up. Final scope applies the
reference presentation below the app's existing 1024px desktop breakpoint;
desktop retains the earlier presentation.
Approver: user; Front End Developer/executor: `/root`. Scope: local search-page
presentation, shared header on search routes, compact sorting, locale labels and
isolated frontend checks. No connected service/database execution or deployment.
Preserve existing workspace edits, API contracts and search behavior.

Acceptance: dark branded header with globe/account controls; stacked mobile
Where/When/What fields and full-width Search; Sort/Filter and accessible icon view
controls in one toolbar; result count below; square thumbnails, readable service
information and a bottom price/details row. At 1024px and above, restore rounded
horizontal search fields, icon submit, original placeholders, visible sort select,
count/actions row, labeled full-width view selector, and the desktop list action
column. Desktop language name, Browse services and Log in text remain visible.
Keyboard/AI mode, errors, loading, empty results and filters remain.

Implementation: mobile fields stack with visually hidden accessible labels,
short Anywhere/Anything placeholders, leading icons and a visible Search action.
Sort retains its native select/keyboard behavior behind the compact label; the
selected option remains available in the native menu and a dot marks active sorting.
The view icons retain accessible names, pressed states and 44px targets. The toolbar
can wrap for longer translations/text sizes. The count follows the toolbar. List
prices/details follow service metadata; provider-preview layout remains scoped out
of this list-action change. Search-header globe and account controls use 44px targets;
guest account icon links to the existing login return URL. Existing authenticated
account menu and role switcher behavior remain. Keyword/AI options remain available
below the query fields. Four new labels are maintained in every supported locale.
Mobile presentation extends through tablet widths below 1024px. CSS controls the
layout/header presentation; the existing mobile hook now accepts an optional
breakpoint (default remains 768px), synchronizing placeholders/button labels at
1024px without duplicating inputs or resetting search/filter/sort/view state.

Files: `client/src/pages/home.tsx`, `client/src/components/app-header.tsx`,
`client/src/components/search-results-sort.tsx`, `client/src/components/search-page.css`,
`client/src/index.css`, `client/src/hooks/use-mobile.tsx`, locale resources and
`scripts/test-search-redesign-browser.mjs`.
The browser runner now defaults to `search-mobile-reference` artifacts and accepts
`SEARCH_REDESIGN_ARTIFACT_PREFIX`; prior `search-redesign` and first-iteration
`search-reference` evidence is preserved.

Validation, 4 November 2026:

- `npm run check` and `npx tsc --project scripts/fixtures/tsconfig.search-redesign.json` passed.
- `node --import tsx scripts/test-public-search-ui.mjs` passed offline: independent
  query/filter drafts, validation retention, cancellation, errors/retry, truncation
  and en/lv/ru rendering.
- `npx vite build` passed. Existing Browserslist-age and bundle-size warnings remain.
- `node --import tsx scripts/test-search-redesign-browser.mjs` passed in Chrome,
  Firefox and WebKit: ten behavior groups and 54 en/lv/ru width/view cases per engine.
  Widths: 320, 390, 768, 1023, 1024, 1280; views: grid/list/map. Also checked 700×390 landscape,
  200% text reflow, light/dark text contrast, native keyboard sorting, header/toolbar
  touch targets, independent drafts, errors/retry, date validation, map fallback,
  image fallback, focus containment/restoration, and no unexpected requests.
  New checks cover mobile-only placeholders/labels/toolbar/cards, restored desktop
  presentation, exact CSS breakpoint widths (including WebKit scrollbar gutter),
  selected-sort retention and no search requests caused by locale/view/viewport changes.
  WebKit's keyboard test waits for the preceding account menu to finish closing
  before focusing sort, then explicitly confirms the native selection with Enter.
- Firefox's first run passed assertions but returned an internal context-close
  error; a repeat of the same runner passed with exit 0. Chrome required running
  outside the process sandbox after sandboxed crashpad startup failed.
- Firefox/WebKit used existing `fits-task022-tools` Playwright installation with
  process-only `FORMS_BROWSER`, `FORMS_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH`;
  no packages or browsers were downloaded. All APIs/auth/geolocation/Maps/images
  were synthetic/mocked. No connected server, database writes, paid services or deployment.
- Visually inspected the initial mobile screen/list rows and restored
  [desktop presentation](search-mobile-reference-chrome-desktop-grid.png).
  Current [mobile preview](search-mobile-reference-chrome-phone-initial.png).
  Evidence: [Chrome](search-mobile-reference-chrome-evidence.json),
  [Firefox](search-mobile-reference-firefox-evidence.json), [WebKit](search-mobile-reference-webkit-evidence.json).

No new security boundary or endpoint was introduced; existing React text rendering,
drafts, query handling and error paths remain. Browser emulation does not establish
physical-device or screen-reader coverage. Only en/lv/ru were tested. Deferred:
ar (including RTL verification), zh, fr, de, hi, ja, pt, es; their labels were maintained.
Recovery: reverse only this task's hunks, retaining unrelated in-progress changes.
Next action: user can review the local search page/reference screenshot. Publication
remains outside this local frontend assignment.
