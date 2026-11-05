# TASK-043 — Scroll-loaded service search

## Assignment and scope

On 5 November 2026 the user requested paging that loads more Search results on
scroll and a review of the fixed 50-item limit. Root coordinates this accepted
local implementation. Assigned Frontend `/root/wishlist_frontend` owns client
behavior, translations and isolated UI checks; Backend
`/root/wishlist_backend_plan` owns API/application queries and offline tests; DB
`/root/wishlist_database_plan` reviews query ordering and boundedness locally.
Each owner accepted under the standing cooperation rules. Frontend specifically
delegated the new pagination browser fixture/runner and necessary fixture-build
entry to root, then extended delegation on resume to final client/test corrections
and preservation of historical artifacts. Frontend reviewed and accepted the
integrated result. Backend and DB ownership stayed with their assigned owners.

Allowed operations are reversible local repository changes and offline/mocked
checks. No connected databases, session writes, paid embeddings, private
configuration, application startup, deployment or publishing. Preserve activated
TASK-042 migrations/receipts and pre-existing `.search-commit-check-K0YgF2/`.

## Behavior and page size

Start with 24 services per page, retaining an API maximum of 50. This is a design
choice to reduce the initial mobile payload and fit common grid column counts;
it is not a measured performance optimum. Append additional pages near the end
of the results, with an accessible manual Load more/retry control. Keep existing
cards and scroll position while appending; an append failure must not erase them.
Reset continuation when applied filters, location, sorting or account changes.

Sorting must apply to the full matching search before pagination, with stable
tie-breaks. Preserve public visibility, availability, booking, service-view and
wishlist boundaries. Both exact and semantic search need explicit continuation
and honest exhaustion/guard behavior rather than silently returning a top-50
subset.

## Verification and delivery

All three owners accepted local implementation and verification. Frontend details are
in [its handoff](search-pagination-frontend-handoff.md), with local query findings
in [DB review](search-pagination-db-review.md). Backend records its result below.

Root ran `node scripts/test-search-pagination-browser.mjs` using installed Chrome,
then Firefox and WebKit via the existing harness settings. All three passed eight
behavior groups with explicit en/lv/ru phone cases. The 157-service fixture proves
continuation beyond 50, duplicate suppression, global price order, applied-query
and account resets, stale-request cancellation, retained cards on append failure,
manual retry, semantic fallback/expired cursors, invalid-cursor refresh, genuine
scroll observation, manual map continuation, final keyboard focus and unchanged
scroll position during both manual and automatic append. Advanced edge cases run
in English; the explicit first-page/keyboard/failure/retry matrix covers all three
languages. See [Chrome](search-pagination-chrome-evidence.json),
[Firefox](search-pagination-firefox-evidence.json) and
[WebKit](search-pagination-webkit-evidence.json) evidence.

The scroll assertion initially exposed a real jump to the moved Load more button;
`preventScroll` focus restoration and exclusion of pagination controls from scroll
anchoring corrected it. Final assertions passed in every engine. The first resumed
parallel Firefox launch timed out during local-page navigation; the unchanged
suite passed when rerun alone. Earlier escalation attempts stopped before
execution when automatic review hit a usage limit; user resume allowed the final
reviewed runs. No checks were weakened to pass.

Root's `node node_modules/typescript/bin/tsc --noEmit --incremental false` and
`node scripts/build-appointment-calendar-check.mjs` passed. The isolated Vite build
loads neither environment files nor server startup; existing stale Browserslist
and large-bundle warnings remain. Scoped whitespace checks passed. Frontend also
returned passing existing Search layout/When, sorting, i18next and wishlist/inbox
regressions. Fresh When artifacts use the task prefix; historical When files were
restored byte-for-byte from HEAD after preserving the new results separately.

No schema migration, connected database execution or deployment is required or
claimed by these local changes. Live SQL execution plans and large-catalog latency
remain unverified; ranking queries enforce an eight-second local statement budget
and return an unavailable error on exhaustion. Paging is a live view of public
services rather than a frozen snapshot, so concurrent edits may change membership
or ordering between pages; client deduplication suppresses repeated IDs.
Fresh locale/browser acceptance is restricted to en/lv/ru; ar/RTL, zh, fr, de,
hi, ja, pt and es remain deferred, while supported translations are maintained.
Mocks do not establish live database plans, concurrency or production latency.

Recovery: revert only this task's attributable application/test/documentation
changes, preserving saved data, conversations and historical activation evidence.

Implementation guidance reviewed: [TanStack Query v5 infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
and [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).
The scroll observer should avoid concurrent page fetches and use a manual control
when observation is unavailable.

## Backend

Completed locally on 5 November 2026 by assigned Backend
`/root/wishlist_backend_plan`. Root explicitly assigned application/shared-contract
implementation and offline tests under the standing cooperation rules. Frontend
and Backend agreed the following interface before edits; DB independently reviewed
the query implementation and accepted it without a schema change. No connected
operation or private configuration access occurred.

### Contract and behavior

- New opt-in GET endpoints `/api/services/search/page` and
  `/api/services/semantic-search/page` preserve the existing array endpoints for
  other consumers. They accept the existing public filters, the seven existing
  sort names, scalar `limit` (default24/max50) and an opaque `cursor`. They return
  `{services,nextCursor,mode}`, where mode is `text`, `semantic` or `text-fallback`.
  An actual terminal page returns `nextCursor:null`.
- SQL applies public service/company visibility, category, service type, age,
  duration, location/radius/coordinate expiry and requested working-hours filters
  before globally ordering and limiting. Availability uses a correlated EXISTS
  over relevant active schedules and at most31 requested dates, preserving the
  existing conservative time/break semantics; it does not claim a reservable slot.
  It avoids materializing the legacy501-service/5001-schedule candidate sets.
- Price, rating and distance sorting use server values, explicit NULLS LAST and
  service-ID ties. Default text ordering preserves nearest-first when located,
  then newest creation timestamp/ID; default semantic ordering is relevance/ID.
  Timestamp keys remain full-precision SQL JSON strings, including microseconds,
  rather than passing through JavaScript Date. Keyset predicates match every
  ordering direction and missing-value branch.
- Each ranking request runs in a read-only transaction with an8-second statement
  timeout and transfers at most `limit+1` metadata rows (maximum51). Only the
  selected IDs (maximum50) pass through the existing current-public DTO hydration;
  hydration does not re-enable legacy availability/candidate materialization.
  Returned distance presentation is rounded while continuation keeps the exact
  SQL key. The bounded hydration/slug queries use their existing runtime behavior,
  rather than being included in the ranking transaction's8-second timeout.
- Semantic search remains text-first, avoiding paid work for text matches or no
  eligible embedded candidate. Otherwise existing JSONB embeddings are scored in
  SQL across all eligible services, without transferring all vectors or imposing
  a hidden50/100/500 result cap. Guarded type/dimension/numeric casts, matched
  ordinality, finite positive norms and finite scores protect malformed vectors.
  Query-vector dimensions are bounded to8192 and components to magnitude1e100.
- The query embedding is reused in a bounded process-memory context (maximum100,
  ten-minute lifetime), not regenerated for each continuation. First pages share
  the existing semantic per-IP/process budgets; valid continuations spend no new
  embedding quota. Legacy and paged paths also share the concurrent-provider
  budget,8-second provider timeout and zero provider retries. A provider failure
  may return honest `text-fallback`; SQL ranking failures return controlled503
  rather than a false empty/exhausted result.
- HMAC cursors bind normalized filters/query, sort, chosen text/semantic mode and
  position. Changed/tampered cursors reject400; expired/evicted contexts reject410.
  All cursor signing and semantic contexts are process-local: restart or another
  API process can invalidate continuation. Frontend resets to a first-page search
  for continuation400/410. This version assumes one serving process or affinity;
  it does not introduce persistent/shared cursor state or configuration secrets.
  Concurrent listing edits may move sort keys; these are live keyset results,
  not a frozen database snapshot. Refresh starts a new traversal.
- Public inputs remain strict, parameterized and bounded; private provider/company
  selectors are rejected. Responses use no-store and fixed public errors. Page
  requests generate no service-view, wishlist, booking or session write themselves.

### Evidence and limits

- `node --import tsx scripts/test-search-pagination-backend.mjs`: **48 scenario
  groups passed**, using620 synthetic services, injected embeddings, generated SQL
  and in-process HTTP streams. Covers traversal beyond500; every sort direction,
  missing values and ties; exact microsecond/null timestamp cursors; changed filter/
  sort/tampered/expired/evicted continuations; semantic results beyond100 with one
  embedding per context; norm-underflow fallback; SQL-failure redaction; strict
  scalar controls; read-only timeout/result bounds; compatibility; first-page
  semantic limits and shared legacy/page concurrency. No sockets or SQL engine.
- Existing `test-public-search.mjs` passed its validation, legacy arrays, semantic
  budgets/fallback/concurrency and payment-disabled regressions, with injected
  storage/provider and isolated loopback only. Scoped escalation was used for
  this existing loopback test; no database/provider connection was made.
- `test-search-storage.mjs` passed existing duration, visibility/expiry, availability,
  candidate-limit and scoped-catalog compatibility checks. Its stale strict import
  fixture needed the existing `node:crypto` dependency: a throwing UUID trap was
  added so any unexpected booking identity creation still fails; assertions remain.
- `test-booking-notes-backend.mjs` passed21 existing cases and
  `test-booking-capacity.mjs` passed its existing scheduling/access/capacity cases.
  Their isolated route fixtures explicitly stub only the new unused page-store
  factory, retaining the behavior under test and blocked live imports.
- Full TypeScript passed. In-memory esbuild bundles for `server/routes.ts` and
  `server/index.ts` passed with no module execution, configuration loading or
  startup. Scoped diff/whitespace checks passed. Package script
  `npm run test:search-pagination` runs the new backend suite.
- DB independently accepted the final query/store/service review, with31 compiled
  SQL checks and an independent run of the then45-group owner suite; later owner
  additions brought the final suite to48 without changing production SQL. See
  [the DB review](search-pagination-db-review.md).

No live PostgreSQL execution, planner/timing, index effectiveness, production
load, cross-process cache or paid-provider verification is claimed. JSONB cosine
ranking remains potentially O(eligible services × vector dimensions) inside the
database; the timeout produces an honest error rather than proving scalability.
No migration or index change was made. Root owns final integrated UI/build evidence.
Fresh locale acceptance remains en/lv/ru; other supported locales/RTL are deferred.
Recovery reverts only TASK-043 application/test changes and preserves activated
wishlist tables, SQL, receipts and unrelated work.
