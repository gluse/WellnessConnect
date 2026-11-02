# Provider service previews — 2 November 2026

User specifically authorized `/root` to redesign `/my-services/services` with
List and Grid matching Search, including previewing services before publication.
Accepted scope: local frontend page/cards/styles/translations and offline mocked
tests. Reuse the Search result presentation and 1:1 images, retain publication
status, employee assignment, edit/copy, permission checks and AI-search actions.
No backend/schema/API changes, connected writes, publishing or deployment are
authorized or required. Preserve existing working-tree changes, especially the
previous Search redesign and unrelated provider navigation/editor work.

Status: completed locally and verified. Recovery: reverse only the edits
and new files belonging to this task, retaining all earlier work. Shared Search
card extraction must preserve public Search behavior and receive regression checks.

## Result

The provider Services page now defaults to List and offers List/Grid controls
styled like Search. All/Published/Inactive status filtering remains independent
of the selected view and requires no new API calls. Saved inactive services can
be inspected before publishing. Switching views never changes publication state.

`ServiceResultCard` now owns the shared Search/preview presentation: square
cover-cropped images, fixed square missing/broken-image placeholders, title,
provider, list description/employee information, duration, One-to-one/Group,
Instant booking/provider approval and existing dollar/locale-aware prices.
Public Search retains its provider/review/details callbacks and location metadata;
the provider preview is read-only and has no public review, booking or listing
analytics actions. Public ratings and distance are not invented when absent from
the provider endpoint; the page explains this difference.

Provider publication status, employee assignment and Edit/Copy controls are
separate from the shared preview. Add Service, status filtering, permission gates,
copy pending/error/success behavior, existing editor routes and Update AI Search
remain. The page also has localized loading/empty/error/retry states. Personal
previews display the provider's name; company previews display the business name.
The grid uses available result-container width to accommodate the provider sidebar.

Changed local code: `pages/provider/services.tsx`, provider `services-list.tsx` and
`provider-service-card.tsx`, new `components/service-result-card.tsx`, the public
`search-service-card.tsx` wrapper, provider-scoped rules in `search-page.css`, and
new `providerServices` messages in supported locale resources. Existing header,
navigation, editors, hooks, backend and database code were not changed by this task.

## Verification

- `node --import tsx scripts/test-provider-service-views-browser.mjs`: passed in
  Chrome 156, Firefox 157 and WebKit 27.2. Each ran 5 behavior groups and 24
  en/lv/ru × 320/390/768/1280px × List/Grid cases, with synthetic services/images.
  Checks cover square media/fallbacks, inactive visibility, preserved filters,
  no requests/writes on view changes, all labels/actions, long/literal hostile
  text, company identity, read-only permissions, keyboard activation, copy
  duplicate prevention/pending/failure/retry and editor navigation, plus loading,
  error/retry and empty states. Phone List is measurably denser than photo Grid.
  Light/dark text contrast and 200% text reflow passed.
- The same runner with `PROVIDER_VIEWS_ZOOM=1`: 6 en/lv/ru native Chrome 400%
  zoom layout cases plus the behavior checks passed. The test dismisses the
  existing copy-error toast through its actual close button before retry, because
  it can cover the next action at high zoom. No toast behavior was altered.
- `node --import tsx scripts/test-search-redesign-browser.mjs`: public Search
  regression passed, 9 behavior groups and 36 en/lv/ru viewport/view cases in
  Chrome after extracting the shared card.
- `node --import tsx scripts/test-public-search-ui.mjs` and
  `node --import tsx scripts/test-search-sorting.mjs`: passed offline.
- `npm run check`, `npx tsc --project scripts/fixtures/tsconfig.provider-service-views.json`,
  `npx vite build` and scoped `git diff --check`: passed. Vite reports the existing
  large-bundle and outdated Browserslist warnings; no dependency changes were made.

Evidence: [Chrome](provider-service-views-chrome-evidence.json),
[Firefox](provider-service-views-firefox-evidence.json),
[WebKit](provider-service-views-webkit-evidence.json),
[native 400% zoom](provider-service-views-chrome-zoom400-evidence.json).
Inspected rendered [desktop grid](provider-service-views-chrome-desktop-grid.png),
[phone grid](provider-service-views-chrome-phone-grid.png),
[phone list](provider-service-views-chrome-phone-list.png) and
[dark phone list](provider-service-views-chrome-phone-dark.png). Images in these
screenshots are synthetic test samples/placeholders, not live provider photographs.
Chrome requires the previously established scoped process escalation to launch
the isolated browser on this workstation. All APIs and writes in tests are mocked.

Test scope: English, Latvian and Russian only. Arabic
(including RTL), Chinese, French, German, Hindi, Japanese, Portuguese and Spanish
remain deferred; their translations continue to be maintained. Physical devices,
screen readers, native-language review, live publishing and connected services
were not verified. These checks are not a full security audit or WCAG certification.

No backend/database changes, new dependencies, live writes, publishing or
deployment were performed. Next action: review the local provider Services page.
