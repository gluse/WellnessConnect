# Consistent compact appointment dropdowns — 3 November 2026

Completed locally. User specifically requested that the marked status dropdown
match the lower “More actions” control and that spacing stay small. Frontend
owner/executor `/root` accepted the scoped local UI correction, synthetic browser
checks and documentation. No connected services, database operations, private
configuration or deployment are included.

The shared appointment agenda now reuses the outline/small button styles for
both status and employee selects: 36px height, matching light border, radius,
font, background, left padding and a single decorative ChevronDown. Native
selection behavior, associated labels and focus styling remain available.
Filter groups use 8px horizontal and 4px vertical gaps, with 4px between labels
and fields. Mobile spacing around the filter row is 8px instead of 12px.
No filtering rules, options, translations or appointment actions change.

Verification:

- `npm run check` and
  `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.appointment-layout.json`: passed.
- `node --import tsx scripts/test-customer-bookings.mjs`: passed.
- `node --import tsx scripts/test-appointment-filter-style-browser.mjs`: Chrome,
  Firefox and WebKit each pass 24 cases: en/lv/ru × provider/customer ×
  320/360/768/1280px. Checks compare rendered filter styles with “More actions”,
  verify labels/chevrons/compact gaps, native keyboard status selection, combined
  employee filtering, resets and 200% text reflow at 360px. Actual AppHeader,
  provider/customer pages and mobile navigation shell are rendered. All fetches
  use synthetic mocks; unexpected requests and external traffic fail the checks.
  Evidence: [Chrome](appointment-filter-style-chrome-evidence.json),
  [Firefox](appointment-filter-style-firefox-evidence.json),
  [WebKit](appointment-filter-style-webkit-evidence.json).
- The browser fixture compiles the affected frontend and Tailwind styles;
  `git diff --check` passes. No application server or database is started.
- English/Russian 360×800 screenshots were visually inspected. An additional
  [unfocused 360×800 preview](appointment-filter-style-preview-360x800.png) shows
  the status field and More actions together, without a keyboard focus ring.

The existing appointment fixture gained optional synthetic employees and the
current mobile shell. Historical layout evidence is preserved; this check uses
new artifact names. Browser launch used scoped sandbox escalation and existing
Firefox/WebKit tooling, without downloads or service access.

Only en/lv/ru were tested. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
Physical devices, native-language review and screen readers are unverified.
No new security boundary or API behavior is introduced.

Recovery: reverse only the agenda filter wrapper/styles/spacing, the fixture's
optional employee/mobile-shell additions and this task's test/artifact/documentation
changes. Preserve the mobile navigation redesign and unrelated work. No data
recovery is needed. No remaining local dependency; next action is user review.

## Follow-up: orange hover and option backgrounds

The user reported orange status/option backgrounds after the styling change.
Reproduced with an actual pointer: hover changed the status background from
white to `rgb(245, 159, 10)`. The outline button's `hover:bg-accent` caused the
regression; the native options inherited the select background. The earlier
checks compared resting styles and did not exercise hover colors.

The filter wrapper now overrides hover background/text with the normal neutral
theme colors and explicitly styles option backgrounds/text. Compact dimensions,
native option selection and focus feedback remain. No global theme or API changes.
User request specifically authorizes `/root` for this same local frontend fix.

The browser fixture gained real pointer hover in Chrome and Playwright engines.
The regression now covers hover colors, every option's background, real native
popup open/Escape dismissal, preserved selection, keyboard filtering and previous
layout checks. Chrome, Firefox and WebKit each pass all 24 en/lv/ru cases;
`npm run check` passes. New artifact prefix `APPOINTMENT_FILTER_ARTIFACT_PREFIX=
appointment-filter-neutral` preserves the prior evidence:
[Chrome](appointment-filter-neutral-chrome-evidence.json),
[Firefox](appointment-filter-neutral-firefox-evidence.json),
[WebKit](appointment-filter-neutral-webkit-evidence.json).
An additional [360×800 open-state capture](appointment-filter-neutral-chrome-open-360x800.png)
records the corrected Chrome control.

Other locales/RTL remain deferred. Native selected-option highlighting is
browser/OS controlled; physical devices remain unverified. All operations were
synthetic/offline with scoped browser-launch escalation, no connected writes.
Recovery: remove only the local neutral hover/option overrides and this follow-up's
test/harness/documentation additions; preserve the earlier compact layout and
navigation work. Follow-up completed locally; next action is user review.
