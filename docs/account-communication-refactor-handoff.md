# AccountCommunication complexity refactor — 2 November 2026

Approval: user specifically requested Codex `/root` refactor
`client/src/components/account-communication.tsx` at line 12 to address Cognitive
Complexity 27 (limit 15). Scope: that local frontend component, offline/mocked
verification and this evidence; no live services, database operations or deployment.

Extracted `CommunicationFields` and `PhoneVerification` into module-level
components with typed props. AccountCommunication retains query/mutation state,
the action lock, mount guard, verification timing, and feedback. Phone changes
still clear verification, consent, challenge and code; existing DOM markup,
translations and submit behavior are retained. No new security boundary or
dependency was introduced. The IDE Sonar analyzer was not available for an exact
post-refactor complexity measurement.

Verification passed:

- `npm run check`.
- `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.notifications.json`.
- `npm run test:notifications-frontend` (en/lv/ru only).
- Existing notifications browser runner, with output paths redirected to new
  task-specific evidence: 9 behavior groups and 36 en/lv/ru viewport cases in
  Chrome. Includes invalid phone, failed-save retention, failed-code recovery,
  verified opt-in, number-change resets, duplicate submissions and late responses
  after account switching. [Browser evidence](account-communication-refactor-chrome-evidence.json).
  Reviewed the [320px account screenshot](account-communication-refactor-chrome-account.png).
- `git diff --check`.

Initial sandbox Chrome startup failed in Crashpad; the same isolated fixture
passed using approved process escalation. All application requests are synthetic
fetch mocks; zero unexpected, blocked external or real API requests. Historical
notification evidence was preserved. No fresh Firefox/WebKit, physical device,
screen reader or native language review. ar/RTL, zh, fr, de, hi, ja, pt and es
remain deferred.

Recovery: revert only this component refactor and its new handoff/evidence,
preserving the earlier header fix and unrelated working-tree files. Next action:
refresh the IDE analyzer to obtain its exact updated score.
