# Appointment navigation redesign — 3 November 2026

## Approval and scope

Requested and specifically approved by the user in the 3 November IDE request;
executor `/root` handles this scoped frontend redesign locally. Acceptance:
calendar at `/my-services/appointments` without view tabs, summary or Appointments
h1; separate Upcoming Appointments and Past & Cancelled Appointments pages in
Menu and desktop navigation; Workspace inside mobile Menu, desktop control kept.
Reports is backlog placeholder [TASK-038](../TASKS.md#reports), not implemented UI.
Allowed operations are reversible local frontend, translations, documentation and
isolated mocked tests/builds. No connected database/session/service writes,
credentials, infrastructure, deployment or publishing. Existing dirty work is
preserved. Recovery: revert only attributable changes listed in the final diff.

## Implementation

**Completed / verified locally.** Root owns frontend files and tests.

- `/my-services/appointments` opens directly as the calendar. The provider view
  switcher, summary cards and Appointments h1 are removed. The focus fallback now
  targets the labelled appointment-content container when a booking trigger has
  disappeared. Calendar controls, filters, detail dialogs and booking actions stay.
- `/my-services/upcoming-appointments` and `/my-services/past-appointments` expose
  the existing grouped lists, filters and actions on separate titled pages. They
  appear in mobile Menu and the desktop sidebar; list pages highlight Menu on mobile.
  Customer booking views keep their existing controls.
- The desktop workspace picker stays in place. Mobile hides the sidebar and opens
  a labelled workspace selector from Menu, restoring focus to Menu on dismissal.
  Both controls share `useWorkspaceChange`, preserving cache invalidation, role
  redirects, pending/duplicate protection, failed-switch retention and dirty-draft
  confirmation. The provider shell observes either control's workspace mutation.
- New page labels are supplied for supported translations. Reports remains only
  the requested backlog task for Total bookings, Awaiting approval and Revenue.

The scoped Backend owner accepted and completed exact authentication-return route
additions in `shared/navigation.ts` with isolated redirect-security tests; see
[backend handoff](appointment-return-routes-handoff.md). Root verified integration:
both page routes and unauthenticated return links pass the provider-route tests.
No wildcard redirect rule, new service permission or client credential was added.

## Verification

Passing local checks:

- `npm run check` and `node scripts/build-appointment-calendar-check.mjs`.
  Frontend-only build has no environment loading or server startup. Existing
  Browserslist-age and large-bundle notices remain nonfatal.
- `node --import tsx scripts/test-provider-navigation.mjs` and
  `node --import tsx scripts/test-auth-return-routes.mjs`: page routes, feature-data
  isolation, role access, workspace changes, dirty/failed saves and sign-in returns.
- `node --import tsx scripts/test-appointment-navigation-browser.mjs` in Chrome,
  Firefox and WebKit: nine en/lv/ru cases per browser at 320/768/1280 × 800;
  calendar default, removed elements, separate list links, status filtering,
  calendar details/focus, browser Back and localized loading/empty/error states.
  Evidence: [Chrome](appointment-navigation-chrome-evidence.json),
  [Firefox](appointment-navigation-firefox-evidence.json),
  [WebKit](appointment-navigation-webkit-evidence.json).
- `MOBILE_NAV_ARTIFACT_PREFIX=appointment-navigation-shell` with
  `scripts/test-mobile-navigation-browser.mjs` in all three browsers: eighteen
  en/lv/ru cases per browser at 320/545/768/1023/1024/1280 × 900 CSS pixels;
  localized menu and workspace dialog, bounds/options/focus, role visibility,
  company/personal switching, pending/failed requests, draft confirmation/cancel/
  discard, tab/menu navigation, 200% text and logout. Evidence:
  [Chrome](appointment-navigation-shell-chrome-evidence.json),
  [Firefox](appointment-navigation-shell-firefox-evidence.json),
  [WebKit](appointment-navigation-shell-webkit-evidence.json).
- Chrome `scripts/test-appointment-layout-browser.mjs` with
  `APPOINTMENT_LAYOUT_ARTIFACT_PREFIX=appointment-navigation-layout`: twenty-four
  en/lv/ru provider-list/customer cases at 320/390/768/1280, including group
  disclosure, status/history/date filters, cards, reflow and loading/empty/error.
  [Evidence](appointment-navigation-layout-chrome-evidence.json).
- Chrome `scripts/test-workspace-navigation-browser.mjs`: six en/lv/ru desktop
  cases at 1024/1280 with zero/one/two companies, keyboard/popup focus, permissions,
  pending/failed switching and dirty drafts. Mobile cases moved to the Menu suite.
  [Evidence](appointment-navigation-workspace-chrome-evidence.json).
- Chrome `scripts/test-appointment-calendar-browser.mjs` with
  `APPOINTMENT_CALENDAR_ARTIFACT_PREFIX=appointment-navigation-calendar`: twelve
  en/lv/ru viewport cases and retained calendar action/overlap/permission/privacy
  regressions. [Evidence](appointment-navigation-calendar-chrome-evidence.json).
- Normal `git diff --check` passes. Browser fixtures use synthetic data/mocked
  fetch, reject unexpected requests and block external traffic. No real sessions,
  connected writes or paid services were exercised.

Visually inspected the phone calendar, English and Russian list menus, mobile
workspace dialog and desktop workspace/calendar layout. Screenshots and evidence
use new appointment-navigation prefixes to retain earlier evidence. Updated
existing regression runners to use the new page routes/direct calendar entry.

No unresolved security finding was introduced in the changed navigation/redirect
boundary. This is scoped verification, not an audit of the whole application.
Next action: user review of the local redesign; TASK-038 remains unstarted.

Supported translations are maintained. Test scope: en/lv/ru only. ar (including
RTL), zh, fr, de, hi, ja, pt and es remain deferred, with historical evidence kept.
Native-language review, physical devices and assistive technologies are unverified.

## Follow-up: roles only in Workspace selection — 3 November 2026

**Completed / verified locally.** User specifically requested removal of Owner
and other role text from the top of both desktop and mobile pages. Executor
`/root` applied this scoped frontend follow-up under the same local-only limits.
`WorkspaceNotice` now renders only the closed-company warning when applicable;
membership labels and provider/viewer role notices are removed. Role labels remain
in both desktop and mobile Workspace options. Permissions are unchanged.

Updated existing workspace/mobile browser regressions to assert role absence in
main content and continued role availability in selection. Passing checks:
`npm run check`, `git diff --check`, Chrome desktop workspace suite (six en/lv/ru
viewport cases) and Chrome mobile navigation suite (eighteen en/lv/ru cases).
Both use synthetic fetch mocks with external traffic blocked; no connected data
or session writes. Evidence: [desktop](workspace-role-hidden-desktop-chrome-evidence.json)
and [mobile](workspace-role-hidden-mobile-chrome-evidence.json). Desktop and mobile
screenshots were visually inspected. Other languages/RTL remain deferred; no fresh
Firefox/WebKit, physical-device or assistive-technology coverage is claimed for
this small follow-up. Earlier evidence is preserved.

Recovery: reverse only this follow-up's `WorkspaceNotice` removal and associated
test/documentation changes, preserving the preceding redesign and unrelated work.
No backend/database/security-policy changes or deployment occurred.
