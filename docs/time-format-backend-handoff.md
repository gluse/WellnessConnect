# Backend 24-hour time dependency

Accepted, 3 November 2026. Requester: Front End Developer `/root`; assigned
Back End Developer/executor: `/root/time_format_backend`. Approval source:
the user's app-wide 24-hour time request and AGENTS.md standing cooperation.
Origin: [coordination entry](agent-coordination.md#app-wide-24-hour-time--3-november-2026).

Scope: reversible local backend notification formatting and offline regression
tests. No frontend/shared ORM/database/infrastructure changes, connected access,
private configuration, messaging sends, deployment or spending. Preserve unrelated
dirty work. Acceptance: generated appointment messages, manual previews and
transport date parameters use 00:00–23:59, keeping locale dates and timezone labels.

Completed and verified locally. `server/notifications/policy.ts` now explicitly
uses `hourCycle: "h23"` in `renderMessage`. This single policy feeds generated
accepted/rejected/rescheduled/reminder messages, manual previews and automatic
email/SMS/WhatsApp date parameters. Existing language selection, calendar dates,
timezone conversion/labels, text escaping and API shape are preserved. Already
delivered historical messages are not rewritten.

`scripts/test-notification-time-format.mjs` adds observable regression coverage:
all four message kinds at midnight, morning, noon, afternoon and 23:59, previous
reschedule timestamps, all manual channel links, locale date order/names, Riga
timezone conversion and the spring DST jump. Only synthetic values are used.

Validation on Node v24.22.2:

- `node --import tsx scripts/test-notification-time-format.mjs`: passed 60
  en/lv/ru kind/clock cases plus conversion, DST and manual-link checks.
- `node --import tsx scripts/test-notifications.mjs`: passed 270 existing offline
  policy/transport assertions; HTTP provider boundaries are injected fakes.
- `npm run check`: passed, exit 0.
- `.\node_modules\.bin\esbuild.cmd server/notifications/policy.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/time-format-backend-check/policy.js`:
  passed. Output is ignored local build evidence; no startup or environment load.
- Scoped `git diff --check`: passed (Git reports the existing LF/CRLF convention).

Read-only backend scan found no other user-facing locale-default date/time
formatter. `server/vite.ts` formats developer console log timestamps and was left
outside this presentation change. No new security issue was identified in this
formatting-only diff; this is not a wider security audit.

Tests cover en/lv/ru only; ar (including RTL), zh, fr, de, hi, ja, pt and es remain
deferred. No connected messaging, database or service verification occurred.
No deployment was performed. Next owner/action: Front End Developer `/root` checks
the integrated contract and closes the coordination entry.

Recovery: revert only the backend policy clock option and attributable test and
handoff changes; no persisted data or service configuration changes to recover.
