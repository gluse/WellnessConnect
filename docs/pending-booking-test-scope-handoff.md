# Pending booking availability: frontend test scope

## Acceptance and authority

- Accepted 29 October 2026 by assigned Front End Developer agent
  `/root/pending_booking_frontend_tests`, requested by `/root` for the pending
  booking availability bug under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
- Local repository scope: frontend locale resource loop and coverage output in
  `scripts/test-cleanup-time.mjs`; this handoff. Backend owner separately changed
  scheduling assertions in the shared runner and completed those edits before
  frontend edits began.
- Allowed operations: reversible local edits, read-only dependency inspection,
  offline mocked frontend tests. No connected database/service access, private
  configuration, deployment or application writes.
- Recovery: reverse only these scoped locale/output changes; preserve concurrent
  backend assertions and unrelated workspace changes.
- Parent expanded and Front End Developer accepted scope for the related group
  capacity bug: `client/src/components/booking-modal.tsx`,
  `client/src/components/booking-time-picker.tsx`,
  `scripts/fixtures/booking-capacity.tsx`,
  `scripts/fixtures/tsconfig.booking-capacity.json`, and
  `scripts/test-booking-capacity-browser.mjs`. Same local/offline environment and
  operation limits apply. Backend owns shared types/scheduling/storage/routes and
  whole-project type checking. Recovery also covers reversing only these scoped
  UI/test changes. This expanded accepted scope supersedes the initial
  runner-only assignment.

## Changes and verification

- Cleanup resource validation now reads only `en`, `lv`, `ru`; frontend-only
  completion output names those resources instead of claiming all locales.
- Passed: `node --import tsx scripts/test-cleanup-time.mjs --frontend-only`
  (exit 0). Checked runner/imports and manifest first: this branch exits before
  server routes/storage/database imports; frontend `fetch` is mocked and rejects
  unexpected requests, query cache is cleared, and component is unmounted.
- Includes offline scheduling/cleanup regressions, cleanup key existence in
  English/Latvian/Russian, Latvian editor interaction, failed-save preservation,
  inactive-save validation and zero cleanup save. This does not establish browser
  layout, native language review or physical device coverage.
- Deferred per user scope: Arabic (`ar`, including RTL), Chinese (`zh`), French
  (`fr`), German (`de`), Hindi (`hi`), Japanese (`ja`), Portuguese (`pt`), Spanish
  (`es`). Historical evidence remains intact; translations are unchanged.

## Group capacity implementation and verification

- Booking modal now uses the optional `BookableSlot.availableCapacity` backend
  contract: selected group review maximum is the lesser of service maximum and
  remaining capacity. Existing localized participant help/error text uses this
  maximum. The user's participant count is preserved when capacity drops, with
  normal validation instead of silently reducing it. Server remains authoritative
  for concurrent availability changes.
- Time picker refreshes a retained selected slot when returned capacity changes
  and clears selection when the slot disappears. Comparing capacity before
  updating selection avoids an effect/render loop.
- Customer/provider reschedule reuse the time picker without participant input;
  server previews must account for the existing booking's participant count.
- Passed: `node --import tsx scripts/test-booking-capacity-browser.mjs` in isolated
  installed headless Chrome with mocked `fetch`, fixed synthetic date and no app
  startup/backend/database. Initial sandbox browser launch failed before tests
  because Chrome crashpad could not launch (named pipe error `0x6D`); the same
  scoped command passed after sandbox escalation was accepted.
- Browser coverage: English at 1280x900, Latvian at 768x900, Russian at 375x900.
  Six service places with two occupied means input maximum four; five rejects
  without POST; four sends canonical date/participant payload. Localized existing
  help/error, accessible label/invalid state, focus on invalid participants,
  keyboard focus containment and horizontal reflow passed. Further English
  checks cover refreshed capacity two while retaining chosen count four,
  validation/no POST after refresh, sold-out selection clearing/disabled continue,
  omitted-capacity legacy fallback and service maximum cap. Runtime errors,
  unexpected mocked requests, external network requests and fixture server writes
  were empty.
- Passed: `node node_modules/typescript/bin/tsc --project
  scripts/fixtures/tsconfig.booking-capacity.json` (exit 0), covering the new fixture
  and imported application components independently of the normal source includes.
- No changed user-facing strings, translation files, authentication, rendering
  sinks or API permissions. Browser test validates the interaction and selected
  viewport reflow; it does not establish physical device, screen-reader,
  cross-browser or full accessibility conformance. Deferred locale/RTL coverage
  remains as recorded above. Parent owns integrated backend verification/handoff.
