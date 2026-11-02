# Duplicate group booking warning — 31 October 2026

Completed locally. User request: retain repeat group bookings for the same service/time, but warn
that a booking already exists and require confirmation before continuing.
Approver/requester: user. `/root` accepted the scoped Front End Developer work
in this conversation. Environment: local repository and isolated mocked frontend
tests. Allowed operations: reversible booking UI, translations, frontend fixture/
runner changes and local type/build checks. No backend/database changes, connected
service/database execution or deployment is included.

Implementation in `client/src/components/booking-modal.tsx`:

- Before group submission, fetch the current customer's bookings from the
  existing authenticated `/api/bookings/seeker` endpoint, without using cached
  results. Match customer ID, service ID and the exact start instant. Pending,
  confirmed and completed bookings trigger the warning; cancelled bookings do
  not. Equivalent timestamps with different offsets match.
- An accessible alert dialog displays the service/date/time and offers Cancel
  or Book again. Cancel/Escape preserves the draft and restores submit focus.
  Book again submits the existing booking payload once through the existing
  mutation. Instant and provider-approval behavior and capacity rules remain.
- Controls are disabled while checking/submitting. A failed or malformed lookup
  displays a localized retry message and sends no booking request. A failed save
  requires a fresh check/confirmation on retry. Switching account/service resets
  the form; an aborted old lookup cannot submit or open a stale warning.
- Five new booking-form messages are maintained in every supported resource.
  Only en/lv/ru are tested; native-speaker review is unverified.

The existing synthetic `scripts/fixtures/booking-capacity.tsx` gained a mocked
bookings read and configurable duplicate/error/account/time cases; prior capacity
fixtures and acceptance behavior are preserved. The new runner is
`scripts/test-duplicate-group-booking-browser.mjs`. All application requests are
mocked/rejected and external browser requests are blocked. No app server,
sessions or database writes are used. Browser checks use existing tooling and
scoped escalation because Chrome's sandboxed Crashpad launch is unavailable.

Validation:

- New Chrome 156.0.8078.74, Firefox 157.0 and WebKit 27.2 browser checks passed in en/lv/ru at
  1280/768/375/320 CSS px, all 900px high: approval, cancellation, Escape, retained
  draft, initial/returned focus, keyboard containment, reflow, ordinary/individual
  exclusion, instant/request flows, statuses, customer/service/time matching,
  failed/malformed lookup and retry, late account change, selected-time change,
  and failed-save reconfirmation.
- `node scripts/test-booking-capacity-browser.mjs`: existing group participant
  limits, refreshed availability, payload, sold-out/legacy behavior and focus/
  reflow passed in isolated Chrome for en/lv/ru.
- `node --import tsx scripts/test-guest-search.mjs --frontend-only`: passed;
  existing Maps-loader mock warning remains. Backend section not loaded.
- `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.booking-capacity.json`
  and `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- `node node_modules/vite/bin/vite.js build`: passed; existing outdated
  Browserslist-data and large-bundle warnings remain. Later edits only add
  warning-action test selectors and improve test synchronization.
- Scoped diff whitespace and runner syntax checks passed.

The [320px Chrome warning](duplicate-group-booking-chrome.png) was inspected:
message, appointment summary and both actions fit and remain readable. Initial
runner failures were corrected by targeting nested warning actions and awaiting
dialog dismissal/focus restoration before subsequent interactions; assertions
were retained.

Security review: no new authorization policy, URL/HTML rendering, credentials,
browser storage or server mutation contract. Existing bookings remain local to
the check and matching is restricted to the current customer. This frontend
warning is advisory, not a server uniqueness constraint or concurrency guarantee.
Physical devices, screen readers and native-language review remain unverified.
ar (including RTL), zh, fr, de, hi, ja, pt and es tests are deferred under the
user-selected scope; maintained translations do not imply fresh test coverage.

Recovery: remove only this task's duplicate-check/warning UI, five translation
keys and fixture/runner/evidence/docs additions. Preserve the earlier capacity
fix, prior untracked fixture content and unrelated work. Next: local user review;
deployment remains outside this task.
