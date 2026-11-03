# Mobile navigation redesign — 3 November 2026

Status: completed and verified locally. No deployment performed.

## Authorization and scope

User approved the reviewed plan and instructed `/root` to implement on
3 November 2026. Specific frontend executor: `/root`. Scope is reversible local
frontend navigation/layout, translations and offline/mocked verification.
The user selected four bottom items, the below-1024px breakpoint, a workspace
selector above provider content and navigation throughout signed-in pages.
No backend/database/infrastructure change, private configuration, connected
service testing, deployment or publishing is included.

## Result

- Signed-in mobile pages share Explore (`/`, also active on `/search`), Bookings
  (`/my-bookings`), Appointments (`/my-services/appointments`) and a burger Menu.
- Top Find Services/My Bookings/My Services buttons are desktop-only. Account
  remains in the header; there is no account item in the signed-in bottom bar.
- Menu opens upward and contains Services, Availability and Settings, retaining
  the existing workspace permission rules. Restricted links remain hidden while
  permissions load or fail; localized status explains that state.
- The single workspace selector sits above provider content on mobile and stays
  in the sidebar on desktop. It appears only with company workspaces. Switching,
  role notices, failed/pending operation protections and dirty-editor guards remain.
- The shell reserves the bar's measured height, including safe-area padding and
  wrapped labels. ResizeObserver writes are scheduled outside its delivery cycle.
  Header spacing changes and unrelated account communication work are preserved.
- Guest navigation and desktop navigation layout are retained. New labels have
  resources for all supported languages, without claiming native-language review.

## Verification

All browser checks use the real frontend App or isolated workspace fixture,
synthetic identities and local fetch mocks. Unexpected API calls and external
network traffic fail the checks. Browser startup required scoped sandbox
escalation; these commands do not contact Express, a database or paid services.

- `npm run check`: passed.
- `node --import tsx scripts/test-provider-navigation.mjs`: passed. Updated stale
  page-title/service-heading assertions to match the existing catalog markup,
  preserving meaningful workspace data-isolation assertions.
- `node --import tsx scripts/test-customer-bookings.mjs`: passed; page-level
  navigation assertion now checks removal of the duplicate customer bar.
- `node --import tsx scripts/test-public-search-ui.mjs`: passed, en/lv/ru.
- `node --import tsx scripts/test-workspace-navigation-browser.mjs`: Chrome passed,
  five behavior groups and twelve en/lv/ru viewport cases with 0/1/2 companies.
  [Evidence](workspace-navigation-mobile-redesign-chrome-evidence.json).
- `node --import tsx scripts/test-mobile-navigation-browser.mjs`: Chrome, Firefox
  and WebKit passed, with zero browser errors. Each engine exercises six behavior groups and eighteen
  en/lv/ru cases at CSS widths 320, 545, 768, 1023, 1024 and 1280. Coverage includes
  tab/menu destinations, nested active routes, Account, keyboard/pointer dismissal,
  focus, permission loading/failure, pending/failed workspace switching, viewer
  restrictions, dirty-editor menu/tab/workspace exits, 200% text, resize and logout.
  Evidence: [Chrome](mobile-navigation-chrome-evidence.json),
  [Firefox](mobile-navigation-firefox-evidence.json),
  [WebKit](mobile-navigation-webkit-evidence.json).
- Initial CSS fallback clearance passed in a fresh isolated Chrome fixture:
  112px reserved for a 69px bar before its measured height is applied.
- Chrome [search](mobile-navigation-chrome-search.png) and
  [Russian 320px menu](mobile-navigation-chrome-phone.png) screenshots were
  visually inspected. Selected destinations are tinted, the header has one row,
  and the menu fits above the bottom controls. Long Russian booking text wraps.
- Isolated production Vite build passed with `configFile:false`, `envFile:false`
  and output in ignored `dist/mobile-navigation-check`; no private environment
  files or service startup used. Existing Browserslist-age and bundle-size warnings
  remain. Browser fixtures also compile the actual App and Tailwind styles.
- `git diff --check`: passed.

Firefox/WebKit use existing tooling at
`C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools`, with process-only
`FORMS_BROWSER`, `FORMS_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH`.
Windows WebKit subtracts the app's 4px scrollbar from its media-query viewport;
the runner compensates when setting CSS widths and records actual window widths.
Historical workspace screenshots/evidence are preserved under their original names.

## Limits and recovery

Only **en, lv, ru** are tested. **ar/RTL, zh, fr, de, hi, ja, pt, es** remain
deferred. Physical devices, native mobile safe areas, screen readers and native
browser zoom are unverified; 200% text uses root-font enlargement. No new
server-side security boundary is introduced; menu visibility is not authorization.

Recovery: reverse only this task's shell/header/navigation/layout changes, new
translation namespace and test/documentation additions. Preserve the unrelated
`.search-commit-check-K0YgF2/` directory and any subsequent work. No data recovery
is needed. No owner dependency or deployment step is required for local completion.
Next action: user review of the local UI; deployment remains outside this task.

## Follow-up: Galaxy A55 label wrapping — 3 November 2026

User reported “Appointments” splitting before its final letter at 360×800.
The same specific frontend executor `/root` owns the requested local correction
and mocked verification; all original environment/operation limits remain.

Reproduced the wrapping with a failing rendered-label regression. Equal grid
columns were too narrow for the longer label. Bottom controls now distribute
space from their content widths with equal extra space, retaining the existing
font size, full text and icons. Minimum widths accommodate icons and padding;
all labels, including Menu, can wrap safely when text is enlarged.

The original checks detected clipping but permitted split words. The new
`scripts/test-mobile-navigation-labels-browser.mjs` asserts a single text line
for every bottom label at normal text size, 44px touch targets, no overflow and
measured bar clearance with 200% text. Each browser passes twelve en/lv/ru cases
at 320×700, **360×800**, 390×844 and 545×900:
[Chrome evidence](mobile-navigation-labels-chrome-evidence.json),
[Firefox evidence](mobile-navigation-labels-firefox-evidence.json),
[WebKit evidence](mobile-navigation-labels-webkit-evidence.json).
Browser fixtures compile the actual App and Tailwind styles; `npm run check`
passes. The existing full Chrome navigation regression also passes all six behavior
groups and eighteen viewport/locale cases. `git diff --check` passes.

The [English 360×800](mobile-navigation-labels-chrome-en-360x800.png) and
[Russian 360×800](mobile-navigation-labels-chrome-ru-360x800.png) screenshots
were visually inspected. These are emulated CSS viewports, not physical Galaxy
A55 verification. Only en/lv/ru were tested; other locales/RTL remain deferred.

Recovery for this correction: restore the prior grid/control classes in
`mobile-navigation.tsx` and remove only the focused label-test additions and
follow-up records, preserving the broader navigation redesign and unrelated work.

## Follow-up: Calendar navigation label — 3 November 2026

User specifically requested renaming Appointments to Calendar in the bottom bar.
Approver: user; frontend executor: `/root`; scope: reversible local navigation
label changes and offline/mocked checks, under the existing frontend approval.
The mobile tab and corresponding desktop provider link now reuse
`appointmentAgenda.calendar`, preserving existing supported translations and routes.
The navigation regression expects that localized label. No connected operations,
private configuration access or deployment; unrelated work is preserved.

Validation: `npm run check` and
`node --import tsx scripts/test-provider-navigation.mjs` pass.
Chrome passes six behavior groups and eighteen en/lv/ru viewport cases using
`MOBILE_NAV_ARTIFACT_PREFIX=calendar-label-navigation` with the existing
`scripts/test-mobile-navigation-browser.mjs` runner. Its first sandboxed attempt
could not launch Chrome's crash handler; the approved isolated run outside the
sandbox passed with synthetic fetch mocks and external requests blocked.
[Evidence](calendar-label-navigation-chrome-evidence.json) preserves historical
results. Only en/lv/ru are in test scope;
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
Recovery: restore the two navigation label keys and corresponding test expectation
from this follow-up; no data recovery is needed.
