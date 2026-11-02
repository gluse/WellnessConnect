# Appointment layout redesign — 2 November 2026

User approved applying the reviewed side-by-side design, with one exception:
omit the extra My Services/My Bookings labels above Appointments. Executor
`/root` has specific frontend approval for this local task: provider/customer
page layout, shared agenda, compact summary, related locale resources and mocked
frontend verification. No backend/database/infrastructure changes, private
configuration, connected services or deployment are included.

Accepted layout: one Appointments heading; compact provider summary; lavender
My Services area and mint My Bookings area; white cards with their own local
date/time; 12px gaps; compact view/status/employee filters. Personal and group
appointments retain their current sorting, filters, disclosure, permissions,
status/reminder controls, private messages and reschedule/cancellation flows.
The original top application navigation remains the area identifier, without a
second label/button above the page heading. The active Workspace navigation
change is preserved.

The actual application header keeps its existing appearance. In My Services and
My Bookings only, it scrolls normally below 480 CSS pixels of viewport height,
instead of obscuring controls between two sticky/fixed layers at 400% zoom.
Existing page-heading refs remain the dialog fallback focus targets. Provider
action/reminder controls and customer actions remain available; the image's
simplified action examples do not remove existing application capabilities.

Validation:

- `npm run check` and
  `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.appointment-layout.json`:
  passed. Isolated esbuild/Tailwind browser bundles compile successfully. No
  production build, connected application startup or private configuration read.
- `node --import tsx scripts/test-provider-navigation.mjs` and
  `node --import tsx scripts/test-customer-bookings.mjs`: passed. Provider routing,
  workspace switching/drafts/pending saves, customer auth/data isolation, cache
  updates, calendar/status/history, loading/error/retry/session expiry preserved.
- `node --import tsx scripts/test-appointment-layout-browser.mjs`: Chrome
  156.0.8078.79, Firefox 157.0 and WebKit 27.2 each pass six behavior groups and
  24 cases: en/lv/ru × provider/customer × 320×800, 390×844, 768×900, 1280×900.
  Actual AppHeader/MyServices/MyBookings components are rendered. Checks cover
  one heading, no extra area buttons, white cards with local date/time inside,
  12px gaps, distinct backgrounds, summary calculations, filters/calendar,
  group expansion/full status context and localized loading/empty/error states.
- `APPOINTMENT_LAYOUT_ZOOM=4` with the same browser script passes six native
  Chrome 400% cases (en/lv/ru × both areas). Header obstruction found during
  testing was fixed with the scoped short-viewport rule above. Filters/calendar
  remain reachable; no horizontal page overflow. Physical devices unverified.
- `node --import tsx scripts/test-appointment-collaboration-browser.mjs`: Chrome
  passed provider/customer messages, safe notes/text, independent group identity,
  private PRO broadcasts, status/full-context filtering, focus recovery,
  consent-based rescheduling, event cancellation/completion and permission-scope
  cleanup. All reads/writes are synthetic in-memory mocks.
- `node --import tsx scripts/test-notifications-frontend.mjs`: notification URL
  guards, reminder defaults/bounds and en/lv/ru notification resources pass.
- `BOOKING_EVIDENCE_PREFIX=appointment-layout-customer-actions` with
  `node --import tsx scripts/test-customer-booking-changes-browser.mjs`: Chrome
  passed six behavior groups (en 1280×900, lv 768×900, ru 375×900), including
  cancellation/reschedule requests, denied/pending/error paths, focus containment,
  stale-account handling and expired-session redirect. Updated filter labels use
  the selected locale. The optional validated evidence prefix preserves historical
  screenshots/records. [Evidence](appointment-layout-customer-actions-chrome-evidence.json).
- Attributable tracked whitespace checks and browser-script syntax checks pass.

Evidence: [Chrome](appointment-layout-chrome-evidence.json),
[Firefox](appointment-layout-firefox-evidence.json),
[WebKit](appointment-layout-webkit-evidence.json),
[400% zoom](appointment-layout-chrome-zoom400-evidence.json).
Visually reviewed actual-header Chrome phone layouts:
[My Services](appointment-layout-chrome-provider.png) and
[My Bookings](appointment-layout-chrome-customer.png).

Check only en/lv/ru. Arabic (including RTL), zh, fr, de, hi, ja, pt and es remain
deferred; translations are maintained but have no new verification or
native-language review. Browser execution uses isolated synthetic fixtures and
blocks external traffic. No real session/database writes, live messaging,
reminders or deployment. Sandbox browser startup/loopback restrictions were
handled through scoped escalation; no approval rejection remains. Physical
devices, screen readers and native-language review remain unverified.

Status: completed and verified locally. No remaining owner dependency or
connected operation is needed for this frontend change.

Recovery: reverse only this task's agenda/stats/layout changes, the new
appointmentAgenda locale namespace, related test adjustments and new fixture/
evidence files. Preserve the extensive pre-existing dirty application,
translations, workspace-navigation changes and historical evidence. Include this
task's scoped AppHeader short-height rule when reversing its changes. No data or
schema rollback is needed.
