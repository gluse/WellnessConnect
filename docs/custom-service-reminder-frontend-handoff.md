# TASK-049 custom service reminder frontend

Accepted 8 November 2026 by assigned Front End Developer
`/root/custom_reminder_frontend`, requested by `/root` for the user's custom
service reminder message and preview under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible local frontend components, supported translations and synthetic
offline/browser checks. No private configuration, connected database/application
writes, provider sends or deployment. Backend and DB own their corresponding
contracts; root owns task/coordination records and integrated review.

Contract agreed with Backend and DB: `reminderMessage`, default empty, optional
plain text with a trimmed limit of 1,000 characters. A nonempty note follows the
mandatory appointment sentence and precedes the FitsMyTime signature. Blank uses
the existing reminder. Shared `renderMessage` produces both delivery and preview.
The preview uses the current service name, a sample appointment in UTC, and the
interface language. Help explains the sample, customer language/channel choices,
unchanged custom text and WhatsApp's compatible approved-template requirement.

The message is retained when reminders are toggled off/on and when saving fails.
Preview text is ordinary React text with wrapping and `dir="auto"`; no HTML parsing
or sending occurs. The service draft participates in existing dirty-state and
account/workspace isolation behavior.

Fresh test scope: **en, lv, ru**. **ar including RTL, zh, fr, de, hi, ja, pt and es
are deferred**; their supported translations are maintained, without claiming
fresh coverage or native-language review.

## Verification

- `node --import tsx scripts/test-notifications-frontend.mjs`: passed link guards,
  reminder draft defaults, saved value, 1,000-character boundary/over-limit
  validation, reminder-hour bounds and **en/lv/ru** notification resources.
- `npx tsc --project scripts/fixtures/tsconfig.notifications.json`: passed. The
  typed notification fixture was updated for the current required `currency`,
  `countryCode` and `reminderMessage` contract. Synthetic save pending behavior
  and a fixture-only language switch support the new regression cases.
- `node --import tsx scripts/test-custom-service-reminder-browser.mjs`: passed
  five behavior groups and 12 **en/lv/ru** viewport cases in
  **Chrome 156.0.8078.80**. Viewports: 320×700, 390×300, 768×900 and 1280×900.
  [Evidence](custom-service-reminder-chrome-evidence.json) records all groups.
  Cases exercise visible conditions, shared-renderer full-message parity, name
  and note edits, whitespace/default fallback, HTML-looking text rendered safely,
  enable/disable retention, zero preview sends, 1,000/1,001-character validation,
  linked error, saved payload, failed/pending save retention, duplicate-submit
  disabling, saved values, keyboard order, language changes, account draft
  isolation, unknown/error/free entitlements and long text reflow/labels/help.
- `git diff --check`: passed (line-ending normalization notices only).

Visually inspected the [long-content phone capture](custom-service-reminder-chrome-phone.png)
and the [readable reminder editor/preview](custom-service-reminder-chrome-preview.png).
The new field, help, count and sample preview wrap without horizontal overflow.
The second capture uses synthetic ordinary text at 390×900. Chrome Crashpad could
not start inside the sandbox; the scoped isolated test then passed outside it.
All fetch boundaries are synthetic and unexpected/external requests fail; no
database access or messages occurred. Firefox/WebKit binaries were unavailable
in this session (the installed Playwright package points to absent engines);
this task makes no fresh cross-engine claim. Physical devices, screen readers,
native-language review and real provider delivery remain unverified.

No introduced frontend failures or unresolved security findings remain in these
checks. Root's broader application type check reports existing unrelated native
bridge/TypeScript target errors; those are outside this frontend scope. No full
production build was run because the existing Vite configuration loads private
environment files; the isolated harness bundled the actual editor and styles.

Recovery: reverse only this task's frontend and test changes, preserving unrelated
work. Root owns the integrated rollout decision; DB migration and provider setup
require their existing execution permissions. Local frontend work is complete;
root owns the final integrated contract review and delivery status.
