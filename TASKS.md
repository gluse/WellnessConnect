# Tasks

Backlog for building FitsMyTime one task at a time. Add new tasks below with a
unique ID and an unchecked checkbox. Refer to an ID when asking for work
(for example, "Build TASK-001"). Mark a task complete only after implementation
and verification.

Completed tasks are archived in [TASKS_COMPLETED.md](TASKS_COMPLETED.md).
Keep tasks awaiting testing or external setup here, and preserve task IDs when archiving.

## Map view

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
  **Status:** Ready for testing.
  - Browse services from the landing page/header or open `/search` without signing in.
  - Keep search filters, sorting, maps, details, reviews, and provider catalogs available.
  - Prompt for sign-in when booking; return to search after sign-in.
  - Serve published service images to visitors while protecting private images and writes.
  - Verified with `npm run test:guest-search`, existing search/auth/navigation/map
    regression tests, `npm run check`, and `npm run build`.

## Landing page

- [ ] **TASK-005 — Refactor the landing page.** Agree on the desired layout,
  content, and behavior when starting this task, then implement the refactor.


## Claim my service page
- [ ] **TASK-012 - Turn Service providers page**
I want to increase profit by allowing service providers to display their servises as a separate page. Similar Like when you are in amazon and you click to specific Store.
Work on this item in planning mode firts to agree with me what would be best approach
  **Agreed requirement:** Storefront availability is restricted to users with a Pro subscription plan.
  **Status:** Planning; subscription scope and billing approach still to be agreed before implementation.

## Translations
- [ ] **Make sure interface is translated in multiple languages ** All labels , button names, tooltip texts should be translated when user switch language.

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
## discounts

## compaigns

## billing

## Reports

## SMS
## Terms of Use
<!-- Add the next task here using TASK-011, or place it in the relevant section. -->
