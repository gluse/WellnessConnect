# Completed tasks

Archive of completed FitsMyTime tasks. Active tasks, including those awaiting
testing or external setup, remain in [TASKS.md](TASKS.md). Preserve task IDs when
moving tasks between these files.

## Search resilience

- [x] **TASK-027 — Keep service browsing available when Google Maps is unavailable.**
  **Committed scope, 25 October 2026:** Browse services and apply non-location
  filters when Google lookup or map display fails. Provide a browse-without-location
  action, disable radius without coordinates, preserve valid results on failed
  address changes, and bound Maps/geocoding loading. GPS uses browser coordinates.
  The commit uses the current committed inline location flow; remembered-location
  and modal work remain separate uncommitted changes.
  **Authority:** User fallback request, assigned Front End Developer implementation,
  and user request to commit. Local repository and isolated mocked checks only;
  no backend/schema/service/database/configuration changes or deployment.
  See [scope, verification and recovery](docs/google-api-fallback-handoff.md).
  Language tests cover en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es deferred.

## Backend security

- [x] **TASK-020 — Address high-priority backend review findings.** Disable
  unverified payment-state changes; validate and bound public search; control
  paid semantic requests; handle rejected fallback queries safely.
  **Status:** Implemented and verified locally on 18 October 2026; not deployed.
  - Front End Developer delivered debounced search and localized validation/error
    handling. DB Analyst reviewed query changes; no database changes were needed.
  - Offline backend/storage/UI regressions, guest search, sorting, provider
    catalogs, storefronts, TypeScript, and production build passed.
  - See [implementation, verification, delegation, and remaining limits](docs/high-priority-backend-hardening.md).

## Authentication

- [x] **TASK-004 — Allow service searches without signing in.** Let visitors
  search for services and browse results without authentication.
  **Status:** Completed.
  - Browse services from the landing page/header or open `/search` without signing in.
  - Keep search filters, sorting, maps, details, reviews, and provider catalogs available.
  - Prompt for sign-in when booking; return to search after sign-in.
  - Serve published service images to visitors while protecting private images and writes.
  - Verified with `npm run test:guest-search`, existing search/auth/navigation/map
    regression tests, `npm run check`, and `npm run build`.

## Provider storefronts

- [x] **TASK-012 — Add Pro provider storefronts.** Give individual providers and
  companies a separate public page for their services, similar to a store page.
  **Status:** Completed.
  - Creating, editing, previewing, and publishing requires active workspace Pro access.
  - Visitors can browse and book; Pro is required for the provider, not the customer.
  - One company subscription covers its storefront and authorized managers.
  - Supports branding uploads, permanent shareable URLs, draft/publish controls,
    service search/filter/sort, and return to the selected service after sign-in.
  - Expiry/revocation hides the page while preserving content and existing bookings.
  - Administration manages Pro grants and expiry through searchable provider/company
    dropdowns. Payment checkout, pricing, and automatic recurring billing are not implemented.
  - See [setup, behavior, and manual testing](docs/pro-storefronts.md).
  - Database migration applied. Automated storefront, PostgreSQL, authentication,
    booking, catalog, navigation, administration, category, scheduling, review,
    and location regression checks passed, along with TypeScript and production build.
  - Manual desktop/mobile layout, real branding uploads, and a full booking flow
    were not verified during implementation; no browser session was available.

## App Administration

- [x] **TASK-010 — Create app administration page.** Create an Administration
  page for application support staff with a list of all registered app users.
  **Status:** Completed.
  - Page results with 25, 50, or 100 users per page and show the matching count.
  - Search/filter by name/email and an inclusive registration date range in the
    timezone shown on the page.
  - Display email verification status (verified / pending verification) and account
    status (active / blocked) as separate columns, with independent filters for each.
  - Sort by name or date registered, ascending or descending, before pagination.
  - Show all company / organization affiliations, roles, and closed-company status.
  - Search by company / organization name across the full user directory.
  - Show personal Pro subscription status and expiry, with separate company Pro
    badges on each affiliation. Expired or revoked Pro is not enabled.
  - Verified with administration and storefront UI/API regressions, PostgreSQL
    Pro status/expiry/revocation checks, `npm run check`, and `npm run build`.

## Scheduling

- [x] **TASK-006 — Add preparation and cleanup time.** Allow providers to add
  extra time after a service for cleaning the workspace and preparing for the
  next customer. Include this time when checking availability and preventing
  overlapping appointments.
  **Status:** Completed.
  - Add a translated preparation/cleanup field to the service editor, defaulting
    to zero, and preserve it when copying services.
  - Include the entire service plus cleanup interval in daily/monthly availability,
    working hours, breaks, employee conflicts, booking creation, and rescheduling.
  - Save trusted duration and cleanup snapshots on each booking so listing edits
    do not change existing reservations. Customer appointment duration excludes cleanup.
  - Apply the additive migration to the configured database, preserving existing
    reservations with zero extra minutes. Other databases need
    `npm run db:setup-cleanup-time`; see [setup and behavior](README.md#preparation-and-cleanup-time).
  - Verified with `npm run test:cleanup-time`, `npm run test:cleanup-time-db`,
    provider navigation, customer bookings, booking completion, guest search,
    provider catalog regression tests, `npm run check`, and `npm run build`.

## Categories

- [x] **TASK-011 — Move hardcoded categories to a separate database table.**
  Allow application administrators to manage categories from `/administration`.
  **Status:** Completed.
  - Add, edit, and delete categories under Administration → Categories, using the
    existing application administrator allowlist. Company roles do not grant access.
  - Read the shared catalog in provider forms, search filters and chips, service
    details, card placeholders, and landing previews.
  - Keep stable category keys, reject unknown service categories, and prevent
    deleting categories referenced by services, including inactive listings.
  - Apply the category migration to the configured database, preserving existing
    services and category keys. Other databases need `npm run db:setup-categories`.
    See [category setup and behavior](docs/categories.md).
  - Verified category UI/API tests, real PostgreSQL migration/constraint/security
    checks, administration, guest search, provider navigation/catalog and search
    sorting regressions, `npm run check`, and `npm run build`.

## Map view

- [x] **TASK-001 — Replace service markers with location pins.** Replace the
  current green circle markers with recognizable map location icons.
  **Status:** Completed

- [x] **TASK-002 — Show a service preview card on hover.** Show a compact card
  with the service name and a simplified description when hovering over a
  service marker, similar to Booking.com's map previews.
  **Status:** Completed.
  - Hover a service pin for a compact name and plain-text description excerpt.
  - Keep one preview open at a time, without panning the map or taking focus.
  - Move into the preview to read it or select View details; clicking a pin
    continues to open service details directly for touch and keyboard users.
  - Dismiss on Escape, the close button, map click/drag/zoom, filtering, or unmount.
  - Translate preview labels and map messages across all 11 supported languages.
  - Verified hover timing, safe text rendering, selection callbacks, translations,
    location retention, and timer/listener cleanup with `npm run test:maps`, guest
    search regressions, `npm run check`, and `npm run build`.
  - Manual desktop/touch layout was not verified during implementation; no browser session was available.

## Ratings
- [x] **TASK-007 — When service is completed.** Ask customer to review service quality based on 5 star principle. Allow option to add comment. If user rates less than 3 stars, make comment mandatory.
  **Status:** Completed.
  - Prompt customers on My Bookings for completed, unreviewed appointments.
  - Allow one 1–5 star review per booking; require a nonblank comment below 3 stars.
  - Preserve drafts on failed saves and display saved reviews in booking history.
  - Customers can edit or delete their own saved reviews from booking history.
    Edits use the same validation and preserve the original date. Deletion requires
    confirmation; ratings, counts, public review lists, and search results refresh.
  - Return real service rating averages and counts for display and TASK-009 sorting.
  - Click ratings on service cards or details to read customer reviews with stars,
    optional comments, reviewer names, and translated relative dates, newest first.
    Review lists have 20 items per page and exclude emails and booking details.
  - Existing databases need `npm run db:setup-reviews` before running the updated app.
    Applied to the currently configured database; existing customer data was preserved.
  - Verified with `npm run test:reviews`, `npm run test:public-reviews`,
    `npm run test:reviews-db`, booking and
    search regression tests, `npm run check`, and `npm run build`.

## Appointments

- [x] **TASK-008 - Create separate Appointments page.** Currently Customer can see own bookigs by clicking on Calendar icon. Create new button similar to "My Services" and label it "My Bookings"
  **Status:** Completed.

## Searching
- [x] **TASK-009 - Add option to Sort found search results**
  **Status:** Completed. Rating sorting now uses real review averages from TASK-007.
  Sort options ascending or descending: distance, price, and rating.
  - Sort ascending or descending using the translated "Sort results" control.
  - Distance sorting requires a search location; clearing it restores recommended order.
  - Missing values appear last in both directions; equal values keep their search order.
  - Display real ratings and review counts, or "Not rated yet" for unreviewed services.
  - Verified with `npm run test:search-sorting`, `npm run check`, and `npm run build`.
