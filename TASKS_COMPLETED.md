# Completed tasks

Archive of completed FitsMyTime tasks. Active tasks, including those awaiting
testing or external setup, remain in [TASKS.md](TASKS.md). Preserve task IDs when
moving tasks between these files.

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
