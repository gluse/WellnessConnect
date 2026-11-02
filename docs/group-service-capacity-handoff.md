# Group service maximum capacity — 31 October 2026

Completed locally. User's “Front End Change” request assigns `/root` the scoped
frontend change: show the maximum group capacity when opening a service from
search. Approver/requester: user; executor: `/root`, Front End Developer for this
task. Authorized operations: reversible local frontend implementation,
translations, isolated tests, type/build checks and documentation. No connected
service/database access, backend/database changes or deployment is included.

The search-specific details dialog omitted capacity even though the service
already provides `maxCapacity`. `search-service-details.tsx` now displays a
localized “Maximum group capacity” definition/value for group services only.
It displays the total maximum, independent of remaining session places, and uses
the same null-to-one fallback as the booking modal. The number uses the selected
locale. All supported translation resources have the new label; translations
have not received native-speaker review. Existing unrelated changes are preserved.

Verification passed:

- `node scripts/test-search-group-capacity-browser.mjs` in local Chrome, Firefox
  157.0 and WebKit 27.2 using the existing fixture harness. Each engine tests
  en/lv/ru at 1280, 768, 375 and 320 CSS px (900px high). Checks open the actual
  search card/details wrapper, confirm total six versus remaining two, hide the
  field for individual services, cover maximum one/null fallback, and exercise
  choose-time, Escape, keyboard containment and horizontal reflow.
- `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.search-group-capacity.json`
  and `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- `node node_modules/vite/bin/vite.js build`. Existing outdated Browserslist-data
  and large-bundle warnings remain; compilation succeeded.
- Scoped `git diff --check` and runner syntax check.

All application requests are mocked/rejected; the static harness blocks external
requests. No Express server, sessions, booking persistence or database is used.
Chrome initially failed inside the sandbox because Crashpad could not start;
scoped escalation allowed the same isolated browser check to pass. Firefox and
WebKit used already installed temporary tooling, with no dependency download.
The [375px Chrome screenshot](group-service-capacity-chrome.png) was visually
inspected: capacity is visible and readable without clipping.

Security review: ordinary React text rendering and existing service data only;
no new URL, HTML, credential, storage, permission or mutation boundary introduced.
Physical devices, screen readers and native-language review remain unverified.
Testing for ar (including RTL), zh, fr, de, hi, ja, pt and es is deferred under the
user's language scope; translation maintenance does not claim fresh test coverage.

Recovery: remove only the capacity field, new `searchPage.maxGroupCapacity` keys,
and this task's fixture/runner/evidence/docs. Preserve unrelated resource edits.
No remaining local owner dependency. User can review the local UI; deployment
remains outside this task.
