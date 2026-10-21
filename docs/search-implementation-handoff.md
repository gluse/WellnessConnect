# Service search implementation handoff

The approved option A is implemented locally. Focused offline regressions and
Chrome checks pass. Nothing was deployed; the existing deployment hold remains.

## Approval and scope

The user selected option A, then instructed: “Go ahead and implement as planned.”
Approving party: user. Executor: Front End Developer `/root`. Environment: local
WellnessConnect repository. Scope: `/search` frontend layout/behavior, affected
shared presentation, locale resources, existing offline tests, isolated fixtures
and handoff/status records. This includes the proposal's explicit Search/Apply,
phone filter panel and details-first booking behavior.

No backend, ORM/database, live sessions, connected API verification, geolocation
permission, paid Maps/geocoding, infrastructure or deployment operations were
performed. No package/dependency changes. Concurrent forms/audit/server work is
preserved. Recovery: reverse only this search task's attributable edits below,
preserving earlier edits in shared files and locale resources. Never reset the
shared working tree.

## Implemented behavior

- Combined labeled query/location bar, native keyword/AI choice and Search action.
  Typing never launches a search or geocoder request. Current location is requested
  only on its explicit button, and remains a draft until Search is selected.
- Search-bar drafts and filter drafts are independent. Search commits query,
  mode and resolved location with the last applied filters. Apply commits filter
  drafts with the last applied query/location. Reset clears filter drafts only.
  Applied chips describe the applied search; removing one updates that search.
  Clear filters clears the query/location and all filters together.
- Location names are not treated as coordinates. Failed geocoding/denied location
  retain previous results and edits with focused, localized feedback. A synchronous
  guard prevents duplicate location operations; late callbacks cannot update an
  unmounted page. Current-location labels follow language changes.
- Compact sidebar and a Radix phone/tablet filter dialog. Closing retains drafts;
  Apply commits/closes it. Focus is contained, Escape restores the trigger, and
  switching to desktop closes the panel with a visible focus destination.
- Radius/date/time validation uses the existing search rules plus a whole-number
  1–500km radius check. Invalid drafts do not replace applied results or issue
  requests. Focused feedback links to controls and supplies invalid/described-by
  associations. Date ranges stay limited to 31 days.
- Single-column comparison rows with existing service photos or a decorative leaf
  fallback, provider routing, reviews, description, duration, format, price and
  booking method. View details opens localized service details, then Choose a time
  opens the existing booking flow. Guest sign-in/return paths are preserved.
  Search cards/details make no unconditional “Available today” or remaining-slot
  claim from service metadata.
- All seven existing sort choices, public exact/semantic endpoints, abort signals,
  rate limits, validation codes, truncated-result notice, provider catalogs and
  map selection remain. Missing location disables distance sorting. Search errors
  remain distinct from empty results; retries are explicit. Map failures have a
  list fallback. No automatic exact-search fallback after an AI error.
- Scoped responsive/light/dark styles, reduced motion, bidi-safe names and
  locale-aware prices/dates/distances. Existing mobile navigation labels now use
  their existing translation keys; routes are unchanged.

## Files

Application:

- `client/src/pages/home.tsx` — search state and page layout.
- `client/src/components/service-filters.tsx` — draft filters and linked validation.
- New `search-service-card.tsx`, `search-service-details.tsx`, `search-page.css`
  under `client/src/components/`.
- `service-card.tsx` / `service-detail-modal.tsx` — opt-in search presentation;
  other consumers retain their existing layouts and callbacks.
- `bottom-navigation.tsx` — labels from existing translations.
- `client/src/main.tsx` — scoped stylesheet import.
- `client/public/locales/*/translation.json` — new `searchPage` resources;
  earlier namespaces preserved. The eight deferred languages reuse appropriate
  existing translated messages plus new unreviewed translations in places;
  their copy may be shorter than the English/Latvian/Russian approved examples.

Checks/evidence:

- Updated `scripts/test-public-search-ui.mjs`, `test-search-sorting.mjs`,
  `test-guest-search.mjs` and `test-provider-catalog.mjs` for explicit interactions
  and the user's en/lv/ru testing scope. Existing provider/guest backend sections
  remain available; `--frontend-only` stops before importing them.
- Reused `scripts/fixtures/browser-harness.mjs`; added scoped CSS to its existing
  asset list. New fixture `scripts/fixtures/search-page.tsx`, its small TypeScript
  config and `scripts/test-search-page-browser.mjs`. No separate browser harness.

## Verification

Passed local checks:

| Check | Result |
| --- | --- |
| `npm run check` and final direct TypeScript check | Application types pass. |
| `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.search-page.json` | Fixture/import types pass. |
| `npm run build` | Production compilation passes; no server started. Existing stale Browserslist/bundle-size warnings remain. |
| `node --import tsx scripts/test-public-search-ui.mjs` | Independent drafts/apply, no automatic paid requests, validation retention, cancellations, errors/retry, truncation and en/lv/ru pass. |
| `node --import tsx scripts/test-search-sorting.mjs` | Existing sorting, numeric/missing values, stable ties, cache reuse, resolved/semantic distances and ratings pass. |
| `node --import tsx scripts/test-guest-search.mjs --frontend-only` | Public entry, details/provider/booking flow, guest sign-in/return and authenticated form pass with mocked APIs. |
| `node --import tsx scripts/test-provider-catalog.mjs --frontend-only` | Identity, independent loading, callbacks, preserved drafts, error/retry/empty states pass. |
| `node --import tsx scripts/test-search-page-browser.mjs` | Installed headless Chrome: 5 behavior groups, 12 locale/viewport cases; zero unexpected requests/runtime exceptions. |
| Scoped diff/syntax checks | Pass. |

Browser matrix: **English, Latvian and Russian only**, at 320/390/768/1280 CSS
pixels. Checked draft independence and no automatic requests, Apply/Reset,
radius/date errors, location resolution/denial/failure retention, explicit retry,
map fallback, details-first guest flow, reflow/control bounds, phone draft
retention, focus containment across Tab cycles, Escape/restoration, dark theme,
320px with 200% text and reduced-motion preference. The browser runner exposed a
test predicate returning a DOM node and an exit-animation wait; both were fixed
without retries or assertion weakening. Visual inspection corrected a wrapped
distance unit and the close button being covered by the dialog header.

Evidence: [JSON](search-implementation-evidence.json),
[desktop](search-implementation-desktop.png), [phone](search-implementation-phone.png),
[phone filters](search-implementation-phone-filters.png),
[Russian dark phone](search-implementation-russian-dark.png). Screenshots show the
real Home page with synthetic records and a fixture toolbar, without the unchanged
application header. All four screenshots were visually reviewed.

All API, map-library/geocoder and geolocation boundaries in the fixture are
synthetic. Non-GET requests are rejected. CSP denies connections and external
destinations are blocked. The existing disposable-profile cleanup validates its
resolved temporary path. Automatic approval review allowed the isolated Chrome
command outside the process sandbox because its crash handler cannot start inside.

## Security review and limits

Scoped source/diff review identified no introduced unresolved security issue.
User/provider text is rendered through React text APIs; errors use fixed locale
messages, never raw server payloads. Drafts stay in memory; no session/storage,
authorization, payment or API payload contracts were changed. Browser controls
and validation do not replace backend enforcement. No credentials or connected
user data were accessed or included in screenshots.

Arabic/RTL, Chinese, French, German, Hindi, Japanese, Portuguese and Spanish
verification is deferred under the user's instruction, including language quality.
The three checked languages also have no independent native-speaker certification.
Other browser engines, physical devices/keyboards, screen readers, actual 400%
browser zoom, a comprehensive contrast/accessibility audit and connected-service
integration remain release verification limits. Emulation and these samples do
not establish WCAG conformance or real-device support. No real booking, email,
session persistence or paid map operation was exercised.

Next owner: Front End Developer for broader release checks; CI/CD only after the
user separately lifts the deployment hold.
