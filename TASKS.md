# Tasks

Backlog for building WellnessFind one task at a time. Add new tasks below with a
unique ID and an unchecked checkbox. Refer to an ID when asking for work
(for example, "Build TASK-001"). Mark a task complete only after implementation
and verification.

## Map view

- [ ] **TASK-001 — Replace service markers with location pins.** Replace the
  current green circle markers with recognizable map location icons.
  **Status:** Completed
- [ ] **TASK-002 — Show a service preview card on hover.** Show a compact card
  with the service name and a simplified description when hovering over a
  service marker, similar to Booking.com's map previews.

## Authentication

- [ ] **TASK-003 — Support social sign-in.** Add or complete authentication
  through Google, Facebook, Apple, and Microsoft.
  **Status:** App integration implemented; provider setup and live sign-in testing pending.
  Follow [the setup guide](docs/social-sign-in.md) to configure each provider in
  Supabase and its developer console before enabling it.
- [ ] **TASK-004 — Allow service searches without signing in.** Let visitors
  search for services and browse results without authentication.

## Landing page

- [ ] **TASK-005 — Refactor the landing page.** Agree on the desired layout,
  content, and behavior when starting this task, then implement the refactor.

## Scheduling

- [ ] **TASK-006 — Add preparation and cleanup time.** Allow providers to add
  extra time after a service for cleaning the workspace and preparing for the
  next customer. Include this time when checking availability and preventing
  overlapping appointments.

## Ratings
- [ ] **TASK-007 — When service is completed.** Ask customer to review service quality based on 5 star principle. Allow option to add comment. If user rates less than 3 stars, make comment mandatory.
  **Status:** Ready for testing.
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
- [ ] **TASK-008 - Create separate Appointments page.** Currently Customer can see own bookigs by clicking on Calendar icon. Create new button similar to "My Services" and label it "My Bookings"

## Translations
- [ ] **Make sure interface is translated in multiple languages ** All labels , button names, tooltip texts should be translated when user switch language.

## Searching
- [ ] **TASK-009 - Add option to Sort found search results**
  **Status:** Ready for testing. Rating sorting now uses real review averages from TASK-007.
  Sort options ascending or descending: distance, price, and rating.
  - Sort ascending or descending using the translated "Sort results" control.
  - Distance sorting requires a search location; clearing it restores recommended order.
  - Missing values appear last in both directions; equal values keep their search order.
  - Display real ratings and review counts, or "Not rated yet" for unreviewed services.
  - Verified with `npm run test:search-sorting`, `npm run check`, and `npm run build`.

## discounts

## compaigns

## billing

## Reports

## SMS

## App Administration
- [ ] **TASK-010 — Create app administration page.** Create an Administration
  page for application support staff with a list of all registered app users.
  - Page results with 25, 50, or 100 users per page and show the matching count.
  - Search/filter by name/email and an inclusive registration date range in the
    timezone shown on the page.
  - Display email verification status (verified / pending verification) and account
    status (active / blocked) as separate columns, with independent filters for each.
  - Sort by name or date registered, ascending or descending, before pagination.
  - Show all company / organization affiliations, roles, and closed-company status.
  - Search by company / organization name across the full user directory.
  **Status:** Ready for testing

## Audit

## Test scripts

## notifications

## quick find: I have x time available X date. What could I do? Propose activities near my current location.

## Subscribe for news. Receive invitations.

## New tasks

## Security
Encrypt network traffic. Passwords and other sensitive information

## Terms of Use
<!-- Add the next task here using TASK-008, or place it in the relevant section. -->
