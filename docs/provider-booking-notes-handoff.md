# Provider booking notes — 31 October 2026

Completed locally. User reports notes entered in the booking form are not visible
to the service provider. Approver/requester: user. Front End Developer/executor
and integrated reviewer: `/root`, continuing the scoped frontend assignment.
Allowed operations: reversible provider appointment presentation, translations,
synthetic browser fixtures and local type/build/regression checks. Backend owner
`/root/booking_notes_backend` accepted the API/storage verification dependency
through live collaboration under standing cooperation; see its
[scope and evidence](booking-notes-backend-handoff.md). No connected database or
services, private configuration, schema/ORM changes or deployment occurred.

The current repository already sends `notes` from the booking form and renders
provider notes as an unlabelled small grey paragraph. Backend loss was not
reproduced: isolated real schema/route/storage logic preserves nonempty and null
notes through creation and the authorized provider response. This does not verify
the data or deployed version for the user's specific booking.

`client/src/components/appointment-agenda.tsx` now renders nonblank provider notes
in a distinct bordered “Customer notes” section with an associated heading and
darker text. Multiline whitespace is preserved and long words wrap. Content is
ordinary React text, with automatic content direction; markup is not interpreted.
Null/empty/whitespace-only notes do not create a blank section. Existing provider
controls, notification rendering and customer layout are preserved. The heading
is maintained in all supported resources; native-speaker review is unverified.

Validation passed:

- `node scripts/test-provider-booking-notes-browser.mjs` in Chrome
  156.0.8078.74, Firefox 157.0 and WebKit 27.2. Each runs the real booking form
  and provider appointments page against in-memory API boundaries. en/lv/ru
  cases enter a note, submit and open the provider view, then check the label,
  exact Unicode/multiline content, plain-text rendering of HTML-shaped input,
  and wrapping at 1280/768/375/320px, all 900px high. Null/empty/whitespace notes,
  refreshed notes, customer layout, instant group booking, authorized read-only
  provider and ordinary pending requests are covered. Every unexpected API or
  external browser request is rejected. No app server/database/session is used.
- `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.provider-booking-notes.json`
  and `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- `node node_modules/vite/bin/vite.js build`: succeeds with the existing
  outdated Browserslist-data and large-bundle warnings.
- `node --import tsx scripts/test-booking-completion.mjs`: provider status,
  permissions, save/retry, cache and revenue regressions pass; this renderer
  runner emits its existing uninitialized-i18next warning.
- Scoped whitespace and browser-runner syntax checks pass.
- Backend owner reports the focused API/storage regression passing for exact
  multiline en/lv/ru/null notes, notification mapping, server-owned identity/
  status and workspace/employee filtering. Root reviewed the new injected test
  and handoff. No backend application changes were needed.

The [320px Chrome capture](provider-booking-notes-chrome.png) was inspected:
the labelled notes and actions remain readable and long content wraps without
horizontal overflow. Browser emulation does not verify physical devices or
screen readers. No native-language review, live booking persistence or deployed
UI was verified. ar (including RTL), zh, fr, de, hi, ja, pt and es testing remains
deferred; translation maintenance does not imply fresh coverage.

Security review: notes stay within the existing provider-only display boundary
and authorized response; no auth policy, retention, URL/HTML interpretation,
logging, credential or storage changes. Recovery: remove only this task's notes
section/message keys, new fixtures/tests/evidence/docs, preserving prior notes
handling and unrelated changes. No local owner dependency remains. Next: local
user review; a missing note in the user's specific running environment would
need separately scoped read-only inspection of that environment/data.
