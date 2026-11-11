# Provider browsing and navigation follow-up — 9 November 2026

Status: implemented and verified locally.

User request authorizes frontend executor `/root` for reversible local frontend
changes to the provider catalog window, `/providers/:slug` presentation, desktop
navigation translations, and My Services section order. Approver/requester: user
in this conversation. Scope: frontend components, existing translation resources,
isolated mocked tests and this handoff. No backend/database/infrastructure edits,
connected operations, private configuration access or deployment.

Validation uses synthetic browser fixtures with mocked API boundaries, scoped
TypeScript and an environment-isolated frontend build. Test only en/lv/ru.
ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred. Preserve
unrelated dirty work, including publication and native-client changes.

Recovery: reverse only this follow-up's attributable frontend/test/documentation
hunks; no database or service recovery is required.

The user clarified that Pro means the **service provider's subscription**, not
the visitor's subscription. The existing public service DTO supplies
`storefrontSlug` only when the provider/company has active Pro and a published
storefront (`server/storefronts.ts`, read-only contract inspection). Search now
uses that existing public-page link exclusively; providers without it appear as
plain names in cards/details. The old generic catalog-window entry was removed
from Home. The retained standalone dialog also fails closed without the public
slug. No new entitlement field or backend/API policy was introduced. Pro
providers must still publish their page to expose its link, as before. The public
page endpoint continues to enforce its existing subscription/publication rules.

`StorefrontView` uses Search's shared grid/card and detail presentation, including
images/fallbacks, ratings, durations, prices, booking badges and wishlist hearts.
Filtering, sorting, view analytics and booking return URLs remain wired. The
shared Search components now honor `wishlistEnabled`, so editor previews retain
their existing no-wishlist/no-view-analytics behavior.

Desktop `RoleSwitcher` uses existing translated keys and subscribes to language
changes, including its accessible navigation name. Supported locale resources
remain intact; no new translations were needed. `providerSections` now orders
Services, Availability, Reports, Settings, preserving its permission filtering
for both the desktop sidebar and mobile menu.

Changed frontend files: `client/src/pages/{home,storefront}.tsx`,
`client/src/components/{provider-services-dialog,role-switcher,service-card,
service-result-card,service-detail-modal,search-service-card,
search-service-details}.tsx`, and
`client/src/components/provider/navigation-sections.ts`. Test files and evidence
are listed below. Unrelated publication/native work was preserved.

Validation:

- `node --import tsx scripts/test-provider-public-navigation-browser.mjs` passed:
  six behavior groups, 12 en/lv/ru cases at 320/390/768/1280 CSS pixels; local
  headless Chrome 156. Covers free/expired/Pro individual/company provider links,
  absence of catalog/private subscription requests, matching computed card
  presentation, search/category/sort/empty results, image fallback, keyboard
  details, guest booking return URL, pending/error/retry/missing/revoked pages,
  preview isolation, live translated desktop navigation and desktop/mobile order.
  Includes 320px at 200% text; no unexpected requests or browser exceptions.
  [Machine evidence](../output/frontend-provider-navigation-2026-11-09/chrome/evidence.json).
- `node --import tsx scripts/test-provider-duration-browser.mjs` passed: 24
  provider card/detail cases and three booking summaries in en/lv/ru at
  390/1280. Updated the selectors for the shared Search markup, retaining the
  duration, clipping, callback and mocked analytics assertions.
- `node --import tsx scripts/test-provider-catalog.mjs --frontend-only` passed:
  isolated loading/identity/callbacks/error/retry/empty behavior, denied window
  without an eligible public slug, eligible provider link and en/lv/ru resources.
  Updated the obsolete Home catalog-window expectations to match the requested
  behavior. Its backend section was not loaded.
- `node --import tsx scripts/test-guest-search.mjs --entry-only` passed root/Search
  guest entry, identity loading, login and brand-navigation checks in en/lv/ru.
- `node --import tsx scripts/test-service-duration.mjs` and
  `node --import tsx scripts/test-service-pictures-frontend.mjs` passed.
- Full `tsc --noEmit --incremental false`, the new fixture's scoped TypeScript,
  and the frontend Vite production build passed. The build used an empty
  `envDir` and isolated task output directory; no private environment file was
  loaded. Vite reports existing stale Browserslist data and large-chunk warnings.
- Visually inspected Russian desktop navigation, Latvian phone provider cards
  and English desktop provider cards. Screenshots for all three tested locales
  are in `output/frontend-provider-navigation-2026-11-09/chrome/`.

Execution notes: Chrome could not launch within the restricted sandbox
(Crashpad pipe failure); the same isolated fixture ran successfully through
approved escalation. An initial guest-test invocation used the unrecognized
`--search-entry-only` flag and entered its legacy full branch. That branch failed
before the changed catalog assertions because it expects `ServiceFilters`
mounted outside the now-closed filter drawer; those preceding lines are unchanged
by this task. The correctly scoped `--entry-only` run passes, and the new actual
browser suite verifies the changed provider/detail flow. Full legacy guest-suite
coverage is not claimed.

Security/limits: all synthetic API reads and writes terminate in fixture memory;
external browser requests are blocked. Frontend visibility uses existing public
metadata and does not replace server authorization. No backend, database,
credentials, deployment, spending or connected-service operations were performed.
Firefox/WebKit, physical devices, screen readers and native linguistic review
were not performed. Deferred languages/RTL remain as listed above. No remaining
local implementation dependency; deployment is a separate operation.
