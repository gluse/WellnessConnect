# Customer booking management frontend — TASK-030

Accepted 27 October 2026 by `/root/booking_frontend`, assigned Front End Developer
by the coordinating agent under the user's bug report and AGENTS.md standing
cooperation. Scope: customer booking controls, dialogs, supported translations,
and isolated frontend verification. Environment: local repository and synthetic
mocked browser fixtures only. No private environment files, connected sessions,
database operations, deployment or provider permission changes are authorized.

Backend owner `/root/booking_backend` confirmed PATCH booking status with
`{status: "cancelled"}`, PATCH reschedule with `{scheduledDate: ISO UTC}`, and
authenticated GET `/api/bookings/:id/available-times` with month/date + timezone.
Only the customer's own future pending/confirmed bookings are eligible. Backend
enforces ownership, scheduling and availability. Errors: 400 invalid, 403 denied,
409 conflict; 401 means expired authentication.

Status: implementation and isolated verification complete. Root owns TASKS.md and
[the coordination queue](agent-coordination.md#task-030--customer-booking-cancellation-and-rescheduling).
Recovery: revert only this task's diff; preserve all pre-existing dirty changes.
Tests are limited to en/lv/ru. Arabic (including RTL), Chinese, French, German,
Hindi, Japanese, Portuguese and Spanish verification is deferred; supported
translations will be maintained. Verification evidence will be appended here.

## Changes and integrated contract

- `client/src/pages/my-bookings.tsx` exposes cancellation/rescheduling only for the
  signed-in customer's own future pending/confirmed bookings. Both agenda and
  pending reviews filter by customer identity. Identity-keyed state closes an old
  dialog on account change; stale mutation callbacks cannot modify the new auth
  state or display old success feedback. Confirmed cached results remain visible
  with a retry warning when a subsequent list refresh fails.
- `client/src/components/customer-booking-change.tsx` supplies a titled Radix
  confirmation/dialog, safe initial cancellation focus, keyboard containment,
  trigger/heading focus restoration, translated status/error feedback, guarded
  non-retrying writes and bounded scrolling. Rescheduling reuses the established
  timezone-aware BookingTimePicker and booking-specific available-times endpoint.
  A 409 clears the selected slot and refreshes availability. Success merges the
  canonical response into existing seeker/provider cache rows before invalidating
  those lists and availability. A 401 clears customer auth/private booking cache.
- `client/src/components/appointment-agenda.tsx` adds an optional customer-actions
  rendering hook. Provider action logic and provider reschedule dialog are unchanged.
- Added 16 `bookingChanges` messages to all 11 supported translation resources,
  preserving existing resource content and dirty work. Only en/lv/ru were validated;
  translations have no independent native-speaker review.
- Added isolated fixture/runner `scripts/fixtures/customer-booking-changes.tsx` and
  `scripts/test-customer-booking-changes-browser.mjs`; existing customer booking
  fixture now carries customer ownership IDs matching the actual response contract.

## Verification

All commands below passed against final application source. Browser fixture APIs
are intercepted in memory with synthetic data and a fixed clock. The fixture's
HTTP server serves static assets only; unexpected fetches and non-static network
traffic are rejected. No Express app, connected database, sessions, Stripe or other
external services were started or exercised.

- `node --import tsx scripts/test-customer-booking-changes-browser.mjs`:
  Chrome 155.0.8059.85, Firefox 157.0 and WebKit 27.2; each ran en at 1280×900,
  lv at 768×900 and ru at 375×900. Existing temporary Playwright installation was
  used through process-only FORMS_BROWSER/FORMS_PLAYWRIGHT_MODULE/
  PLAYWRIGHT_BROWSERS_PATH settings; no dependencies were installed.
- Same runner with process-only `BOOKING_NATIVE_ZOOM=1`: Chrome native 400%
  browser zoom, actual 315×201 CSS viewport, all three locales. It checks horizontal
  reflow, dialog focus containment and visible/reachable footer focus. Dialog top
  and footer captures use viewport screenshots: full-page CDP capture was found to
  crop native-zoom output incorrectly and was replaced.
- Each browser run covers own-customer visibility, hidden other-customer data,
  terminal/past action suppression, no provider controls, cancellation dismiss and
  keep without writes, 403 denial, pending/duplicate protection, canonical cancel
  payload/success/cache removal and focus fallback; reschedule 409 slot refresh,
  cleared stale selection, 503 retained draft, retry/success/canonical UTC payload;
  cache invalidation; account-switch stale 401 suppression; actual 401 sign-in
  redirect/private-data removal; and retained successful cancellation when list
  refresh fails. en/lv/ru namespace keys/placeholders are checked.
- `node --import tsx scripts/test-customer-bookings.mjs`: passed original customer
  routes, auth, filters, calendar, cache updates, loading/error/retry/session expiry.
  Its minimal non-DOM setup emits a harmless existing i18next initialization warning.
- `node --import tsx scripts/test-booking-completion.mjs`: passed provider completion,
  permissions, past appointments, pending controls, save failure/retry, cache and
  revenue preservation. Root ran final integrated `npm run check`; exit 0.
- Scoped `git diff --check`: passed (Git emitted only line-ending notices).

Evidence: [Chrome](customer-booking-chrome-evidence.json),
[Firefox](customer-booking-firefox-evidence.json),
[WebKit](customer-booking-webkit-evidence.json),
[native 400%](customer-booking-chrome-zoom400-evidence.json).
Sampled rendered images inspected: [Russian phone](customer-booking-chrome-ru.png),
[Latvian tablet](customer-booking-firefox-lv.png),
[WebKit phone](customer-booking-webkit-ru.png),
[zoomed dialog top](customer-booking-chrome-en-zoom400.png) and
[zoomed footer](customer-booking-chrome-en-zoom400-actions.png).

## Security, limits and recovery

Server permissions remain authoritative; frontend visibility grants no backend
access. Untrusted service names use React text rendering and raw server errors
are replaced by controlled localized messages. No credentials/private configuration
were read or edited. Mutation retries are disabled and duplicate writes are guarded.

No live user booking was changed. Physical devices, mobile virtual keyboards,
screen readers, native-speaker review and connected-service/deployment verification
were not performed. Browser emulation does not establish physical-device coverage
or full WCAG conformance. The eight deferred locales, including Arabic RTL, remain
deferred as specified above. No unresolved findings from this task's source review
or required local checks remain. Next owner: root integrates backend evidence and
closes TASK-030; any live verification/deployment uses its separate authorization.
