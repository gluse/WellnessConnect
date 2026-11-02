# TASK-032 PRO appointment reminder correction

## Frontend acceptance and scope

Accepted 30 October 2026 by assigned Front End Developer `/root/reminder_frontend`,
requested by `/root` for the user's PRO appointment reminder correction under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible local frontend reminder presentation, supported translations,
synthetic browser fixtures and offline checks. No credentials, database access,
real message sends, deployment or publishing. Backend owns preview authorization;
root owns coordination and final integrated checks. Preserve pre-existing dirty work.

Configured PRO services show **Automatic reminders**, with actual schedule/delivery
state, failure reason and time retained separately. PRO services with reminders
disabled show **Send reminder** using the existing preview dialog. Free accounts
retain manual reminders; unresolved capabilities do not grant a manual control.
Reminder controls remain limited to manageable confirmed future appointments.

Recovery: undo only this follow-up's component, new translation key and fixture/test
changes; preserve original TASK-032 implementation and other concurrent changes.
Historical evidence remains in [the original frontend handoff](notifications-frontend-handoff.md).

## Frontend validation

Completed local frontend checks:

- `node --import tsx scripts/test-notifications-frontend.mjs`: passed notification
  links, service reminder validation and **en/lv/ru** resource checks.
- `npx tsc --project scripts/fixtures/tsconfig.notifications.json`: passed.
- `node --check scripts/test-pro-appointment-reminders-browser.mjs`: passed.
- `node --import tsx scripts/test-pro-appointment-reminders-browser.mjs`: passed in
  **Chrome 156.0.8078.74**, **Firefox 157.0** and **WebKit 27.2**. Each completed
  7 behavior groups and 9 en/lv/ru automatic reminder viewport cases at 320×700,
  768×900 and 1280×900. PRO manual preview and keyboard/focus cases run at 320×700.
  [Chrome evidence](pro-reminders-chrome-evidence.json),
  [Firefox evidence](pro-reminders-firefox-evidence.json),
  [WebKit evidence](pro-reminders-webkit-evidence.json).
- Visually inspected the Chrome [automatic reminder](pro-reminders-chrome-automatic.png)
  and [manual composer](pro-reminders-chrome-manual.png) captures; translated
  controls wrap without horizontal overflow. The generated fixture bundles the
  actual changed UI. No private configuration is loaded.

Cases cover PRO enabled/disabled service settings, stale unavailable state with
automation off, actual scheduled/sent/paused/unavailable/failed states and specific
failure reasons, status-query failure, service-setting refresh, manual modal
preview with no sending, keyboard containment/Escape/focus restoration, unknown
and failed entitlement, absent service flag, and booking-permission denial.
Missing settings fail closed to match the backend's explicit-false requirement.
The previous broad browser test's PRO case now explicitly enables its service
reminder setting; that historical suite and evidence were not rerun/overwritten.

Every fixture API is synthetic and in memory; unexpected requests fail, and
the static harness blocks external network. Sandbox Chrome initially failed to
start Crashpad; scoped escalated execution succeeded. Early focus/query assertions
were corrected to await visible UI rendering; final identical regression passes
in all three engines. No unresolved frontend failures remain in the scoped checks.

Fresh locale/browser scope: **en, lv, ru** only.
**ar including RTL, zh, fr, de, hi, ja, pt, es are deferred**; their supported
translations are maintained. Physical devices, screen readers, native-language
review and live provider delivery remain unverified.

Backend confirmed the unchanged preview request `{ kind: "reminder" }` is permitted
for PRO only when the service reminder setting is explicitly false; PRO status
previews and enabled/missing service automation remain protected. Root owns the
integrated application checks, task completion record and rollout status.

## Integrated review

Root completed the component/API contract review, inspected both Chrome phone
screenshots, and passed application `npm run check`, scoped syntax/whitespace
checks and in-memory esbuild bundles of the server and notification worker.
Backend passed 34 actual-bootstrap and 42 real-handler mocked scenarios; details
and authorization safeguards are in the
[backend handoff](notifications-backend-handoff.md).
Frontend's final identical regression passed all three browsers listed above.
This follow-up is complete locally; [TASKS.md](../TASKS.md) and the
[coordination queue](agent-coordination.md) record that state. No database
migration is needed. Refresh Appointments after loading the updated app; restart
the local app if its running process has not picked up the route change.

The full Vite build was not rerun because its privacy-policy plugin loads private
environment files; frontend fixture bundling, application/fixture TypeScript and
offline server bundles passed. Actual provider sending remains unverified and
deployment/connected-operation holds remain in force.
