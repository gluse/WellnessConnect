# Search When availability default — 4 November 2026

Completed locally. The user specifically requested that opening When from Search
defaults Available providers only to true. Approver: user; frontend executor:
`/root`. Authorized scope: reversible local Search modal initialization and mocked
verification. No backend/database changes, connected operations or deployment.

`client/src/pages/home.tsx` now initializes the When draft with `availableOnly:
true` on each opening, preserving applied dates/times. The user can uncheck the
option before Apply. Initial catalog results stay unfiltered, and opening or
cancelling does not apply a search. Existing date-required validation remains.
Reset retains its existing clear-filters behavior. No security or persistence
contract changes; unrelated working-tree changes are preserved.

Verification passes:

- `node scripts/test-search-when-default-browser.mjs`: six Chrome cases across
  en/lv/ru and 390/1280px, checking default/reopen, no search on opening/cancelling,
  Escape focus restoration, required date feedback, explicit opt-out, date
  preservation, enabled availability request on Apply and modal reflow.
  [Evidence](search-when-default-chrome-evidence.json).
- `npm run check` and `node scripts/build-appointment-calendar-check.mjs`:
  TypeScript and isolated frontend build pass. Existing Browserslist-age and
  bundle-size warnings remain. The build loads no private environment files.
- Scoped whitespace checks pass. English phone screenshot visually inspected.

All API responses are synthetic; external network traffic is blocked. No live
services/database/session writes. Other browser engines, physical devices and
screen readers were not newly verified. ar/RTL, zh, fr, de, hi, ja, pt and es
remain deferred. Recovery: reverse only the `openWhen` initialization and this
task's runner/evidence/docs. Next: user review of the local Search page.
