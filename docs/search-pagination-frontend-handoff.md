# TASK-043 Search pagination — Frontend

## Assignment and limits

Accepted 5 November 2026 by assigned Front End Developer
`/root/wishlist_frontend` for the user's Search infinite-scrolling request.
Authorized scope: reversible local frontend/query/component/style changes,
supported translations, synthetic browser fixtures and offline checks. Backend
`/root/wishlist_backend_plan` owns public API/cursor/global-sort implementation;
DB owns its local query review. No connected database/session writes, real
embeddings, Maps calls, credentials/private configuration, application startup,
deployment or publishing was used by Frontend.

Frontend specifically delegated the new `scripts/fixtures/search-pagination.tsx`
and `scripts/test-search-pagination-browser.mjs` fixture/test implementation and
isolated verification to `/root`, retaining owner review. Later scope delegation
also permits root to finish attributable client integration fixes, existing
frontend regressions, translations, this handoff and generated task artifacts if
the owner hits a usage limit. Root owns task/coordination/integrated records.

Status: frontend implementation and local verification complete. Root returned
passing final Chrome, Firefox and WebKit pagination checks after the scroll/focus
correction, plus final integrated type and isolated build checks. Connected/live
execution and publication are not established by these local results.

## Implemented contract and behavior

- Search uses `useInfiniteQuery` with 24 services per page. Keys include account,
  applied filters/search mode, location and effective sort. Replacing a search or
  leaving its account cancels obsolete requests and clears inactive search data.
  Editing drafts does not submit a request.
- The helper calls the compatible opt-in `/api/services/search/page` and
  `/api/services/semantic-search/page` endpoints. It sends the existing filters
  plus sort, limit 24 and opaque continuation cursor, and consumes the agreed
  `SearchPage` envelope. Existing non-paged endpoints are Backend's compatibility
  responsibility and are not called by Search.
- Cards retain server-global ordering across pages. Frontend no longer sorts a
  fetched subset; overlapping IDs are deduplicated without reordering preceding
  results. The heading reports how many services are loaded, without implying a
  total count. Rating-unavailable guidance is withheld while more pages may exist.
- Initial loading/error and append loading/error are separate. Append failures
  preserve existing cards and offer manual retry; no automatic mutation/request
  retry hides the failure. Focus/reconnect do not refetch the accumulated list.
- An IntersectionObserver sentinel prefetches on entering a 300px margin, guarded
  against concurrent requests, failed pages, hidden documents and active dialogs.
  Fetch completion alone does not recreate the observer or drain a constant-height
  map view. A keyboard/touch Load more button works without observer support and
  remains available under the map. List/grid/map share accumulated pages.
- Exhaustion replaces continuation with an explicit end status. Manual-load focus
  returns to the next Load more control or the end status without scrolling the
  reader down to newly inserted content. Pagination is excluded as a browser scroll
  anchor. Explicit refresh focuses the results heading.
- Continuation HTTP 400/410 offers Refresh results and resets the exact query to
  its first page, rather than retrying a rejected/expired cursor. Existing cards
  remain until that explicit action. Initial invalid filters still use the normal
  initial-search error state. Semantic text fallback is disclosed honestly.
- Booking/details/view recording, saved location, wishlist hearts, private message
  controls and header behavior retain their existing contracts. No new private
  browser persistence or database definitions were added by Frontend.

## Checks completed

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed during
  implementation and in root's final integrated check. Root's isolated Vite build
  also passed; existing Browserslist-age and large-chunk warnings remain.
- `node --import tsx scripts/test-public-search-ui.mjs`: passed paged request
  construction, drafts/apply, validation retention, safe errors/manual retry,
  semantic fallback and cancellation with synthetic data.
- `node --import tsx scripts/test-search-sorting.mjs`: passed the existing numeric
  price/rating/distance/tie/missing-value checks plus globally sorted first-page
  requests from the real Search component and semantic request integration.
- `SEARCH_REDESIGN_ARTIFACT_PREFIX=pagination-search` with
  `node --import tsx scripts/test-search-redesign-browser.mjs`: Chrome passes ten
  behavior groups and 54 en/lv/ru viewport/view cases, including filters, location,
  date ranges, server sort, cards/grid, map heart/dialog focus, keyboard, contrast,
  200% text and short-screen behavior. Synthetic Maps/location APIs only.
  [Evidence](pagination-search-chrome-evidence.json).
- `node --import tsx scripts/test-search-when-default-browser.mjs`: Chrome passes
  six en/lv/ru phone/desktop cases for availability defaults, required dates,
  opt-out/apply/cancel and focus. Fresh results are preserved under TASK-043 names;
  root restored the original historical artifact bytes exactly from HEAD and added
  a validated artifact-prefix option to the runner.
  [Evidence](search-pagination-when-chrome-evidence.json).
- `WISHLIST_EVIDENCE=docs/search-pagination-wishlist-chrome-evidence.json` with
  `node --import tsx scripts/test-wishlist-browser.mjs`: Chrome passes eleven
  groups and 27 en/lv/ru viewport cases. Actual guest Search resume/manual save,
  no automatic save/view, hearts/cache/errors, global header counts, messages,
  inner/outer read exposure and existing responsive behavior remain covered.
  [Evidence](search-pagination-wishlist-chrome-evidence.json).
- Actual i18next resolution for all pagination labels and loaded-count values
  0/1/2/5/21/24 passes in en/lv/ru. Translations are maintained for all supported
  languages; native-speaker review is not claimed.

## Delegated pagination verification and limits

Root's new fixture uses 157 synthetic services and real Search/query/observer/card
components. Owner reviewed the fixture and eight-group runner: page 24/manual
keyboard loading, duplicate request guard, overlapping-ID deduplication, append
failure/retry, access beyond 50, server-global ordering, filter/account stale
request cancellation, semantic fallback/expiry, HTTP 400 restart, genuine scroll
observer, map continuation, final focus and scroll retention are meaningful
behavior checks. Final root-delegated Chrome 156.0.8078.80, Firefox 157.0 and WebKit
27.2 runs each pass **eight groups and three locale cases**, including actual
manual/automatic append scroll-position equality, retaining 48 cards after an
append failure and 72 after retry, all 157 services, invalid/expired refresh,
server ordering, stale-result isolation, end focus and map/list continuation.
See [Chrome](search-pagination-chrome-evidence.json),
[Firefox](search-pagination-firefox-evidence.json) and
[WebKit](search-pagination-webkit-evidence.json). Advanced edge cases run in the
fixture's default English; each browser's initial append/error/keyboard matrix
runs en/lv/ru. Backend/API behavior is separately tested by its owner.

An early scroll assertion caught focus restoration moving the viewport to the
newly displaced Load more button. The product correction uses
`focus({ preventScroll: true })` and excludes pagination as a scroll anchor. The
final three-browser runs verify that exact corrected behavior. Firefox's first
parallel attempt timed out during initial navigation; an isolated rerun passed
all groups without product or assertion changes.

Owner visually reviewed the [Chrome phone list](search-pagination-chrome-phone.png)
and [Load more surface](search-pagination-chrome-more.png). Appended cards remain
readable, controls fit the viewport and the continuation action is reachable.

Some browser processes require scoped escalation because sandboxed Chrome cannot
start its crash handler. An attempted historical-artifact preservation call was
not executed when automatic approval review hit the usage limit; this was a review
availability failure, not an unsafe-action finding. Root received the exact local
restoration/delegation scope and resumed normal reviewed execution.

Fresh language verification is **en/lv/ru only**. **ar/RTL, zh, fr, de, hi, ja, pt
and es verification is deferred**. Physical devices, assistive technology,
live-network performance and connected database execution are unverified.

Recovery: revert only this task's client/fixture/resource changes, preserving
unrelated TASK-042 headers/hearts/messages and historical evidence. Backend's
compatible legacy endpoints remain available; no frontend migration or data
deletion is needed. Publishing and connected execution retain their holds.
