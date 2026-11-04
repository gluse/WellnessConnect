# Provider appointment calendar implementation — 3 November 2026

Completed / verified locally. User approved the [plan](appointment-calendar-plan.md)
and mockup and explicitly requested implementation. Approver: user; assigned
Frontend owner/executor: `/root`. Scope: local provider calendar UI, event/date
helpers, shared-agenda integration, translations, isolated fixtures/tests and
documentation. Existing customer agenda, summary/currency and authorization
contracts remain in scope for regression protection. Reversible local changes
and mocked verification only; no connected database/services, private configuration,
deployment, publishing, schema or backend changes. Preserve all prior dirty work,
including `output/location-modal-build/locales/lv/translation.json`.

Implemented using the project frontend-practices skill. Calendar is the fourth
provider view, with Day/Week navigation, Today/date selection, shared filters,
all-hour scrolling, today/weekend/current-time indicators and side-by-side overlap
lanes. Phones default to Day; explicitly selected Week remains horizontally
scrollable within the calendar. Group sessions retain all attendees and counts.
Details render the same agenda cards and existing controls rather than another
mutation implementation. Stable button refs now accompany action callbacks so
closing rescheduling/message/group dialogs can restore focus to their origin.
This fixed a WebKit failure found by the new nested-reschedule regression.

Changed application files: `appointment-agenda.tsx`, new provider
`appointment-calendar.tsx`, new frontend `lib/appointment-calendar.ts`, provider
`booking-controls.tsx` and `pages/provider/appointments.tsx`, plus calendar labels
in supported locale resources. No dependencies added. Existing customer view
choices and summary/currency behavior are preserved. Tests/fixtures/build script
are under `scripts/`; browser harness timezone selection is additive and defaults
to its previous UTC behavior.

Geometry uses real elapsed minutes from each local midnight, splitting cross-day
events and respecting saved booking durations. During 23/25-hour DST days, each
column supplies offset-qualified local labels and an explanatory note, preserving
real durations and distinguishing repeated hours. This is intentional; it does
not introduce a workspace timezone setting or change stored booking timestamps.

## Verification

All checks below pass on Node v24.22.2 with synthetic data and mocked boundaries:

- `node --import tsx scripts/test-appointment-calendar.mjs`: day/week/year/leap
  navigation; 15/30/60/180-minute durations; nested/multiple overlap lanes and
  endpoint adjacency; midnight splits; saved/legacy duration; invalid data;
  Europe/Riga spring gaps and repeated autumn hours.
- `node --import tsx scripts/test-appointment-calendar-browser.mjs`: **12
  en/lv/ru × 320/390/768/1440px cases per engine**, plus filters/full group context,
  200% text, date/year navigation, Today, keyboard activation/Escape/focus, escaped
  notes, nested messages/rescheduling, actual overlap geometry, pending duplicate
  prevention, successful/failed status updates, workspace cleanup, view-only
  permissions, loading/empty/error and unchanged customer views.
  Chrome 156, Firefox 157 and WebKit 27.2 pass against the final implementation.
- `node --import tsx scripts/test-appointment-calendar-zoom.mjs`: native Chrome
  400% at a 1280px window, all three test languages, scoped Week scrolling and
  rendered Europe/Riga spring/autumn offset labels. CSS viewport was 315px.
- Existing offline `test-provider-navigation.mjs`, `test-customer-bookings.mjs`
  and `test-booking-completion.mjs` pass. Completion fixture now supplies click
  event targets and checks the existing semantic summary values in `dd` elements;
  its revenue/permission/failure assertions remain intact.
- Existing `test-appointment-collaboration-browser.mjs` passes in Chrome for
  en/lv/ru, including group operations, private messages, reschedule consent,
  permissions and scope cleanup. Historical screenshots were not regenerated.
- `npx tsc --noEmit --incremental false` and fixture type checking via
  `npx tsc --noEmit --incremental false -p scripts/fixtures/tsconfig.appointment-calendar.json`
  pass. The latter includes the affected application imports.
- `node scripts/build-appointment-calendar-check.mjs` passes. It sets
  `configFile:false`/`envFile:false`, uses React only, and writes to ignored
  `dist/appointment-calendar-check` without emptying shared outputs. Existing
  Browserslist-age and large-bundle warnings remain; no upgrades were attempted.
- Scoped `git diff --check` passes.

The first sandbox Chrome launch failed in Crashpad; approved isolated browser
execution outside the sandbox succeeded. Each browser test serves only a local
fixture, mocks fetch and blocks external traffic. Firefox/WebKit use existing
tooling under `C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools` with process-only
`FORMS_BROWSER`, `FORMS_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH` settings.

Evidence: [Chrome](appointment-calendar-chrome-evidence.json),
[Firefox](appointment-calendar-firefox-evidence.json),
[WebKit](appointment-calendar-webkit-evidence.json),
[native zoom/DST](appointment-calendar-zoom-evidence.json).
The [desktop](appointment-calendar-chrome-desktop.png) and
[Russian phone](appointment-calendar-chrome-ru-phone.png) screenshots were visually
inspected: styling follows the approved mockup, labels fit, long events anchor text
at the top, and narrow screens show a single day above the existing bottom bar.

## Security, limits and recovery

Existing workspace/permission scope keys remount details on changes; selected data
is derived from current event rows. Untrusted names/notes render as React text.
Existing confirmed mutation/authorization contracts remain in place. No connected
operations, real notifications or new security policy are involved. No unresolved
security issue was identified in this scoped review; this is not a general audit.

Only **en/lv/ru** were tested. Supported translations were maintained; **ar/RTL, zh,
fr, de, hi, ja, pt and es remain deferred**, with no fresh coverage or linguistic
review claimed. Emulated browsers/zoom do not establish physical-device or
screen-reader certification. No live application/database verification or deployment
occurred. Month mode, dragging/resizing and external calendar sync remain outside
the approved first version.

Recovery: remove only this task's new files and attributable agenda/control/page,
locale and harness additions. Preserve all pre-existing dirty work and historical
evidence; do not reset these shared files wholesale. No remaining local dependency.
Next: user functional review of Calendar on `/my-services/appointments`.

## Compact hour rows follow-up — 3 November 2026

User explicitly requested less height between hour labels. Frontend executor
`/root` accepted the local presentation follow-up under the same scope and limits.
Hour spacing is reduced from **96px to 64px**, one-third smaller. The same scale
drives grid lines, event geometry, scroll positioning and the current-time line.
Short cells prioritize the service name and, from 30 minutes, its time; one-hour
cells combine customer/employee on one line so status text fits. Full information
remains in accessible labels, hover titles and the existing detail dialog. A
15-minute block is now 16px high to retain true duration; the existing list views
remain available for larger controls. Short-event keyboard activation and return
focus are checked explicitly.

Verification is recorded separately under `appointment-calendar-compact-*` to
preserve original evidence. The browser runner measures compact hour spacing and
the proportional 15-minute height, and awaits closing nested overlays before the
next pointer action. Only en/lv/ru are checked; other locales/RTL remain deferred.
Chrome 156, Firefox 157 and WebKit 27.2 each pass 12 en/lv/ru viewport cases plus
the full calendar interactions, short-event keyboard/details, focus and privacy
regressions. `npx tsc --noEmit --incremental false` passes. The compact desktop
screenshot was visually inspected: more hours are visible and one-hour labels
fit without a partial status line. No new application build, live verification
or deployment is claimed for this styling follow-up. See
[compact Chrome evidence](appointment-calendar-compact-chrome-evidence.json),
[Firefox](appointment-calendar-compact-firefox-evidence.json),
[WebKit](appointment-calendar-compact-webkit-evidence.json) and
[desktop preview](appointment-calendar-compact-chrome-desktop.png).
Completed locally; recovery restores 96px and the previous event-label layout,
reverting only this follow-up's runner/document changes if needed.

## Mobile swipe navigation follow-up — 3 November 2026

Completed / verified locally. User explicitly requested mobile swiping to the next day
or week. Assigned frontend executor `/root` implements local gesture handling and
mocked checks under the existing approval/limits. Left/right swipes advance/return
one active period. Week headings/date heading support period swipes; the weekly
grid retains native horizontal panning, with boundary overswipes changing weeks.
Vertical scrolling, pinch/multitouch, cancelled gestures, normal taps and the
existing navigation buttons are protected. No backend, connected operation or
deployment is included. Checks remain en/lv/ru; other locales/RTL deferred.

Implementation: new `hooks/use-calendar-swipe.ts` attaches scoped native touch
listeners to the provider calendar. It locks horizontal direction after movement
is clear, requires a 64px swipe completed within 1.2 seconds and changes at most
one period. Form controls, browser screen edges and vertical/multitouch/cancelled
gestures are excluded. Compatibility clicks after a drag are suppressed; a fresh
touch or keyboard/mouse action remains available. Listeners are cleaned up and
disabled during loading, pending updates and open calendar details. Semantic data
attributes identify gesture surfaces; behavior does not depend on test selectors.
No new dependencies, translations, persistence or API contracts were introduced.

Checks:

- `node --import tsx scripts/test-appointment-calendar-swipe-browser.mjs` passes
  **six en/lv/ru × 360/768px phone/tablet cases per engine**, in Chrome 156,
  Firefox 157 and WebKit 27.2. Covers next/previous day/week, filter retention,
  year boundaries, short/vertical/diagonal/cancelled/multitouch exclusions, form
  controls, weekly grid panning/edge navigation, compatibility-click suppression,
  event-origin swipes and subsequent appointment taps.
- Chrome uses native CDP touch input, including actual vertical and horizontal
  scrolling. Firefox/WebKit use DOM touch-event injection for gesture decisions
  plus normal browser input for details/layout. This does not certify physical
  iOS/Android gestures, native pinch zoom or OS/browser edge behavior.
- The existing calendar browser regression passes in Chrome: 12 en/lv/ru viewport
  cases plus actions, focus, privacy and group/details checks. Evidence is under
  `appointment-calendar-swipe-regression-*`, preserving prior screenshots/results.
- `npx tsc --noEmit --incremental false` and the inspected frontend-only
  `node scripts/build-appointment-calendar-check.mjs` pass. Existing Browserslist
  age and large-bundle warnings remain. No private environment files loaded.

Evidence: [Chrome native touch](appointment-calendar-swipe-chrome-evidence.json),
[Firefox](appointment-calendar-swipe-firefox-evidence.json),
[WebKit](appointment-calendar-swipe-webkit-evidence.json).
Scoped review found no new data exposure or security issue; date navigation uses
existing local state and account/workspace reset behavior. No live verification
or deployment occurred. Recovery: remove the swipe hook, its calendar integration,
new swipe test/evidence and this follow-up only. Other locales/RTL remain deferred.
Next: user functional review on mobile.

## Commit isolation verification — 3 November 2026

User requested commits. Shared-file staging includes only calendar behavior and
calendar translation keys; unrelated pre-existing filter styling, navigation,
time-formatting, translation edits and generated output remain outside the calendar
commit. The calendar fixture uses the existing pages directly so it does not
depend on the separately uncommitted mobile navigation wrapper.

An isolated snapshot of committed baseline plus the selected search/calendar
changes passes application TypeScript, calendar helper regressions, the full
Chrome calendar suite (12 en/lv/ru viewport cases), native Chrome swipe suite
(six en/lv/ru phone/tablet cases), and the frontend-only build. The search storage
and mocked public-search route tests also pass there. Previous screenshots remain
historical evidence from the working-tree integration; this additional check
establishes that the focused commits build and function independently. No connected
application/database access, private environment loading, publishing or deployment.

## Toolbar alignment follow-up — 3 November 2026

Completed / verified locally. User specifically requested the full date beside
Today and the status/employee dropdowns on the same row on all device sizes.
Approver: user; frontend executor: `/root`; scope: local calendar toolbar, shared
filter rendering and isolated mocked checks under the existing frontend approval.
No backend, database/service operations, private configuration or deployment.

Today and the complete localized date share a nonwrapping flex row. The date may
wrap within its own remaining space at narrow widths or enlarged text; it is not
truncated or moved below Today. Navigation arrows, Day/Week and the date input
occupy the following row, wrapping as needed. Filters stay paired horizontally,
with visible labels above on phones and inline at larger widths. Their native
selects size from the selected text using an inaccessible sizing span, avoiding
excess width from longer unselected options. Calendar filters use compact text
and padding; list/customer filters retain their existing styling. At enlarged
text or with unusually long selected values, the filter row scrolls locally to
preserve full labels without page overflow. Normal default filters fit at every
tested width. Existing accessible labels, keyboard behavior and routes remain.

Validation:

- `scripts/test-appointment-calendar-toolbar-browser.mjs` passes **96 cases per
  engine** in Chrome 156, Firefox 157 and WebKit 27.2: en/lv/ru, 320/360/390/545/
  640/768/1024/1440px, Day/Week and normal/200% root font size. Checks date/Today
  alignment, readable full date and selected filter text, same-row dropdowns,
  labeled controls, targets and page reflow. Uses September 30 for long dates.
- The existing calendar regression passes in Chrome: 12 en/lv/ru viewport cases,
  calendar navigation, keyboard/details/focus, combined filters, actions and
  privacy checks. Existing provider/customer filter styling/keyboard regression
  passes 24 en/lv/ru cases in Chrome.
- `npm run check` and `node scripts/build-appointment-calendar-check.mjs` pass.
  Existing Browserslist-age and bundle-size warnings remain. The build loads no
  private environment files. Whitespace checks pass.
- English 545px and Latvian 360px Chrome screenshots were visually inspected.
  Evidence: [Chrome](appointment-calendar-toolbar-chrome-evidence.json),
  [Firefox](appointment-calendar-toolbar-firefox-evidence.json),
  [WebKit](appointment-calendar-toolbar-webkit-evidence.json),
  [calendar regression](appointment-calendar-toolbar-regression-chrome-evidence.json),
  [shared filter regression](appointment-calendar-toolbar-filter-regression-chrome-evidence.json).

Browser checks use the existing synthetic fixtures and block external requests.
CSS viewports and root-font enlargement do not certify physical devices, native
browser zoom or screen readers. Only en/lv/ru tested; **ar/RTL, zh, fr, de, hi,
ja, pt, es** remain deferred. No fresh coverage is claimed for those languages.
No new security boundary or persistence is introduced. No deployment occurred.
Recovery: reverse only this follow-up's toolbar grouping, calendar filter sizing,
new toolbar runner and evidence/docs, preserving unrelated dirty work and prior
calendar/navigation changes. Next: user review of the local calendar.

## Simplified toolbar reference follow-up — 3 November 2026

User supplied a revised screenshot, superseding the visible long-date layout
above. Specific frontend executor `/root` implements the local calendar toolbar
and filter presentation, with isolated mocked verification. Existing local-only
authority and recovery limits apply; no connected operations or deployment.

The first row contains Today, Day/Week and a flexible date picker. The second
contains the status and employee dropdowns, followed by the status legend.
The long date announcement and filter labels remain screen-reader-only. Previous/
next arrows and the calendar timezone line are removed. Date selection, Today,
calendar heading selection and touch swipe navigation remain available. Native
controls and focus restoration are retained. At normal text size the first row
fits at 320–1440px in en/lv/ru; enlarged controls can wrap to preserve readability.
Compact spacing below 360px accommodates longer Russian control labels.

Verification:

- Chrome 156, Firefox 157 and WebKit 27.2 each pass the revised toolbar runner's
  96 en/lv/ru cases: eight widths, Day/Week and normal/200% root font size.
  It checks three top controls in one row at normal size, removal of visible
  labels/arrows/long date/timezone, accessible labels, paired readable filters,
  touch targets and page reflow. Evidence preserves the earlier layout under
  its original filenames:
  [Chrome](appointment-calendar-toolbar-v2-chrome-evidence.json),
  [Firefox](appointment-calendar-toolbar-v2-firefox-evidence.json),
  [WebKit](appointment-calendar-toolbar-v2-webkit-evidence.json).
- The existing full calendar regression passes 12 en/lv/ru cases and interactions
  in Chrome. Its date/year navigation assertions now use the date picker in
  place of the removed arrow controls; Today, filters, keyboard/details/focus,
  mutations and privacy regressions remain. Evidence:
  [calendar regression](appointment-calendar-toolbar-v2-regression-chrome-evidence.json).
- `npm run check` and `node scripts/build-appointment-calendar-check.mjs` pass.
  Existing Browserslist-age and chunk-size warnings remain. The build loads no
  private environment files. Chrome English and WebKit Russian 360px previews
  were visually inspected against the supplied layout. Whitespace checks pass.

Native Chrome swipe verification passes six en/lv/ru phone/tablet cases, covering
day/week/year navigation, weekly panning/edge navigation, gesture exclusions and
tap preservation. [Swipe evidence](appointment-calendar-toolbar-v2-swipe-chrome-evidence.json).
The runner now accepts an evidence prefix to preserve prior results.
Only en/lv/ru are tested;
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. Browser fixtures use
synthetic fetch mocks and block external traffic. Physical devices, screen
readers and native zoom are not newly verified. No security/persistence contract
changed. Recovery: reverse this follow-up's calendar toolbar and calendar-only
filter-label/timezone changes and runner updates, preserving prior work and
historical evidence. Next: user review of the local calendar.

## Compact date picker follow-up — 4 November 2026

User specifically authorized frontend executor `/root` to fix the stretching date
picker on `/my-services/appointments`. Scope: the local calendar input's width,
isolated toolbar checks and this record. The picker now caps at 9rem (144px at the
default font size), while retaining the existing 7rem minimum and small-screen
flexibility. Date selection, native control semantics and labels are preserved.
No new security boundary, data access or persistence is introduced.

The toolbar runner checks the width cap and desktop width in addition to its
existing Day/Week, reflow, labels and touch-target assertions. Evidence uses the
`appointment-calendar-fixed-date` prefix, preserving earlier evidence. Checks
cover en/lv/ru, eight widths from 320–1440px and normal/200% root text size.
Chrome, Firefox and WebKit each pass all 96 layout cases.
Chrome desktop English and 360px Russian screenshots were visually inspected.
TypeScript (`npm run check`) and the isolated frontend build pass; existing
Browserslist-age and bundle-size warnings remain. Browser evidence:
[Chrome](appointment-calendar-fixed-date-chrome-evidence.json),
[Firefox](appointment-calendar-fixed-date-firefox-evidence.json),
[WebKit](appointment-calendar-fixed-date-webkit-evidence.json).

Only mocked local fixtures are exercised; no connected services, database writes
or deployment. Physical devices, screen readers and native zoom are not newly
verified. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. Recovery: revert
only the date-input width cap and attributable runner/docs/evidence additions,
preserving unrelated dirty work. Next: user review of the local calendar.

## Navigation/toolbar commit isolation — 3 November 2026

At the user's request to commit, the navigation prerequisites, Calendar labels,
final compact toolbar, associated routes/locales, regressions and historical
evidence were selected together. Unrelated time-formatting, rating, account/form,
notification-policy, generated output, Latvian wording and proposal edits remain
outside this commit. Existing owner acceptance covers the exact return-route
allowlist dependency; no connected operation or deployment is included.

A snapshot exported from the Git index, without copying other working-tree
changes, passes TypeScript with incremental caching disabled, the isolated
frontend build, 96 Chrome toolbar cases, the full Chrome navigation regression
(six behavior groups, eighteen en/lv/ru viewport cases), and offline provider,
customer and exact authentication-return route regressions. Existing build
warnings remain. Verification uses ancestor-installed dependencies and synthetic
mocks; no private environment files or connected services are loaded. The earlier
Firefox/WebKit layout and native Chrome swipe evidence remains applicable to
the selected frontend source. Other languages/RTL remain deferred.
