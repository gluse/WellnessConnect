# Join a company password confirmation

Date: 28 October 2026. Status: completed locally.

Authorization: the user assigned this session a Front End Task to add a repeat
password field on the Join a company screen. Requester/approver: user.
Owner/executor: this session, assigned Front End Developer. Accepted scope:
`client/src/pages/invite.tsx`, frontend regression fixtures/tests and this handoff;
local reversible edits and offline/mocked checks. No connected auth/database
operations, private configuration changes, or deployment were performed.

The password setup now includes a required confirmation field, using the existing
translated confirmation label and mismatch message. Both values must match exactly,
including whitespace, before acceptance is enabled or password setup can submit.
Mismatch feedback is linked to the input and announced as an alert. Editing either
field revalidates the pair. Both fields are disabled during submission, retained
on failure, and cleared after successful password setup. The confirmation value
stays in component state; the API still receives only the original password.
Accounts that already have a password can accept without these fields.

The narrow-screen text-resize check exposed existing overflow from the acceptance
button and long text. The card, text, and button now allow wrapping without
horizontal page overflow.

Validation passed:

- `npm run check` (TypeScript).
- `npm run test:invite-ui` (mocked session expiration, stale password flag,
  password endpoint 401 and invitation-preserving recovery).
- `node scripts/test-invite-password-browser.mjs` (isolated local Chrome;
  en/lv/ru confirmation labels and errors, empty and mismatched confirmation,
  whitespace sensitivity, original-password edits, keyboard tab order,
  320/768/1280 CSS pixel widths, 320px with 200% text, rejected password retention
  and retry, unchanged API payload and acceptance for existing accounts).
- Scoped `git diff --check` for the modified tracked source/test files.

The browser fixture replaces fetch, uses synthetic values and blocks outside
network requests. It reported zero unexpected requests, blocked external requests
or runtime exceptions. Chrome initially could not start inside the sandbox;
the approved isolated run outside the sandbox completed. Screenshots are in
`output/invite-password/`; the Russian 320px rendering was visually inspected.

Only the newly added messages use existing translations; the surrounding screen's
existing English content remains outside this task. No new translation keys were
needed. Arabic (including RTL), Chinese, French, German, Hindi, Japanese, Portuguese
and Spanish verification remains deferred under AGENTS.md. Firefox/WebKit,
physical devices, assistive technologies and live-service behavior were not
verified in this scoped change.

Recovery: revert only this task's edits and remove its new fixture/test/handoff
and generated screenshots; preserve all unrelated working-tree changes. No
database recovery is needed. No further owner action is required for this change.
