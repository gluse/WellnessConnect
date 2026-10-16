# Completed tasks

Archive of completed FitsMyTime tasks. Active tasks, including those awaiting
testing or external setup, remain in [TASKS.md](TASKS.md). Preserve task IDs when
moving tasks between these files.

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
