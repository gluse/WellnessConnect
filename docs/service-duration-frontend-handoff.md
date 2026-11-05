# Service duration units — 5 November 2026

## Assignment and authorization

User requested “Front End Change” for `/my-services/services/{n}/edit`: enter
duration in minutes, hours or days and show the appropriate duration in Search,
keeping backend/database behavior unchanged. User is the approving party;
executor `/root` accepts this specific frontend assignment under
[the frontend role](../ROLE-FRONT-END-DEVELOPER.md).

Scope: reversible local frontend components/helpers, supported translations,
synthetic fixtures and offline/mocked validation. No backend/schema/ORM changes,
database access/writes, connected application sessions, deployment, or service calls.
Recovery: revert only the changes listed below; there is no data migration.

## Implementation

- `service-duration-field.tsx` adds labelled numeric input and native unit select
  to the shared create/edit service form. Exact whole days/hours are selected on
  load; other existing durations retain minutes. Switching units preserves the
  canonical minute value without making an unchanged service dirty.
- Fractional hours/days are accepted when they convert to whole minutes. Blank,
  nonpositive and fractional-minute durations show linked validation errors.
  Decimal dot and comma are supported. A text input with decimal keyboard mode
  prevents Firefox from clearing fractional drafts when document language changes;
  explicit frontend validation rejects nondecimal text.
  Failed saves retain the entered value/unit; pending saves disable both controls.
  The draft/request still has only numeric `duration` in minutes; no unit field is sent.
- `lib/service-duration.ts` formats exact day/hour/minute components with localized
  Intl unit plurals and list formatting. Search result cards (also provider
  previews), service details and map previews use it. Examples: `120 → 2 hours`,
  `2880 → 2 days`, `90 → 1 hour, 30 minutes`, `1501 → 1 day, 1 hour, 1 minute`.
  A day means 24 hours.
- Added unit labels/help/errors for all supported translations. Locale verification
  is limited to English, Latvian and Russian. Native-speaker review is unverified.
- Extended the isolated service-form fixture with optional duration/search previews.
  Updated the existing map test's DOM fake to represent current preview wrappers,
  class queries and portal mounts, and added duration assertions.

## Validation and status

Completed locally: implementation, cross-browser verification and diff review.
No deployment was performed. Next action: normal frontend review/release workflow.

Passed locally:

- `node --import tsx scripts/test-service-duration.mjs`
- `node --import tsx scripts/test-service-duration-browser.mjs` (Chrome 156,
  Firefox 157 and WebKit 27.2; synthetic mocked APIs; 12 en/lv/ru viewport
  cases per engine, 36 total, at 320×900, 390×300, 768×900 and 1280×900)
- `node --import tsx scripts/test-public-search-ui.mjs`
- `node --import tsx scripts/test-map-lifecycle.mjs`
- `npm run check`
- `npx tsc -p scripts/fixtures/tsconfig.service-form.json`
- `npx vite build` (existing Browserslist age and chunk-size notices)
- `git diff --check`

Browser evidence: [Chrome JSON](service-duration-chrome-evidence.json),
[Firefox JSON](service-duration-firefox-evidence.json),
[WebKit JSON](service-duration-webkit-evidence.json), and phone screenshots
for [Chrome](service-duration-chrome.png), [Firefox](service-duration-firefox.png)
and [WebKit](service-duration-webkit.png). All screenshots were visually reviewed.
Tests use in-memory API responses
and reject unexpected requests. Chrome required execution outside the sandbox to
start; the first browser attempt hit an automation timeout, and the subsequent
complete run passed. No live application backend was started.

The first Firefox run exposed native number-input draft loss on language change.
The input fix and decimal-comma coverage passed in all three engines. Validation
also rejects arbitrary text, hexadecimal numbers and mixed decimal separators.

Firefox/WebKit require matching temporary tooling: process-only `FORMS_BROWSER`,
`FORMS_PLAYWRIGHT_MODULE=C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools/node_modules/playwright/index.mjs`
and `PLAYWRIGHT_BROWSERS_PATH=C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools/browsers`.
The runtime-bundled Playwright points at absent browser versions; the project's
existing matching tools were reused without installing dependencies.

Deferred by user instruction: ar (including RTL), zh, fr, de, hi, ja, pt, es.
Physical devices, virtual keyboards and screen readers were not verified. No
new security finding in the changed path: client validation remains presentation
only, server authorization/validation are unchanged, text uses React/DOM text
rendering, and no browser persistence or new dependency was introduced.

Existing historical artifacts and unrelated untracked `.search-commit-check-K0YgF2/`
and `output/directory-concept/` were preserved.
