# App-wide 24-hour time

Completed locally, 3 November 2026. The user's specific request authorizes frontend
executor `/root` to change the app's time displays and entry controls and run
isolated checks. Backend dependency owner `/root/time_format_backend` accepted
generated-notification formatting under AGENTS.md standing cooperation. See the
[coordination entry](agent-coordination.md#app-wide-24-hour-time--3-november-2026)
and [backend acceptance/results](time-format-backend-handoff.md).

Frontend scope covers booking/review dates, conversations and reschedule labels,
DST duplicate-slot timezone labels, reminders, billing dates, storefront expiry,
administration timestamps, weekly hours, date exceptions, legacy schedule/break
entry and subscription expiry. Existing agenda/calendar and canonical slot/range
labels already used 24-hour time. A read-only scan found no remaining browser
default-clock date/time display in client source. The remaining chart
`toLocaleString` formats numbers.

`client/src/lib/date-time.ts` explicitly uses the 00–23 hour cycle. Existing
numeric date formats and seconds remain on displays previously using
`Date.toLocaleString`; existing medium-date/minute displays retain that precision.
Locale date order, selected appointment timezone and timezone labels are preserved.
Generated notification text uses the same clock policy, including old reschedule
times; already delivered history is unchanged.

`TimeInput` visibly uses HH:mm with strict 00:00–23:59 validation. Native time
widgets choose their presentation from browser/OS settings, so these fields use
ordinary labeled text inputs with a format placeholder, bounded length and pattern.
See [native time input behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/time)
and [Intl hour cycles](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat).
Subscription expiry retains a native date field alongside the explicit HH:mm
field; local-date-to-instant conversion and API payloads are unchanged. Invalid
times cannot save, expiry errors focus the affected field, and weekly range error
links still focus the time field. Existing responsive styles and the older form
runner now target the shared time-field marker. An unchanged Russian availability
heading overflow discovered at 200% text in WebKit was fixed with word wrapping.

Validation:

- `node --import tsx scripts/test-time-format.mjs`: 15 en/lv/ru clock cases plus
  numeric-date/seconds preservation, 12-hour locale override, timezone conversion,
  repeated DST times and valid/invalid time bounds passed.
- `node --import tsx scripts/test-time-format-browser.mjs`: Chrome 156,
  Firefox 157 and WebKit 27.2 each passed 18 en/lv/ru form/viewport cases at
  320/768/1280 CSS pixels, plus invalid-save prevention, canonical mock payloads,
  error focus, actual keyboard entry, language changes, midnight/noon/afternoon,
  and availability/expiry reflow at 320px with 200% text.
  Evidence: [Chrome](time-format-chrome-evidence.json),
  [Firefox](time-format-firefox-evidence.json),
  [WebKit](time-format-webkit-evidence.json).
- Phone screenshots of [availability](time-format-chrome-availability-phone.png),
  [subscription expiry](time-format-webkit-expiry-phone.png), and the
  [legacy schedule dialog](time-format-chrome-phone.png) were visually inspected.
- `node --import tsx scripts/test-customer-bookings.mjs`: passed route,
  auth/data isolation, calendar/status/history, cache/error and session regressions.
- `node --import tsx scripts/test-monthly-billing-ui.mjs`: all 22 tests passed.
- `node --import tsx scripts/test-notification-time-format.mjs`: 60 focused
  notification cases passed. Backend owner also passed all 270 existing offline
  notification assertions; see its handoff for exact commands and boundaries.
- `npm run check` and `npx tsc -p scripts/fixtures/tsconfig.time-format.json`:
  passed after final changes.
- Isolated production Vite build passed with `configFile:false`, `envFile:false`,
  the React plugin and existing aliases; output is ignored
  `dist/time-format-check`. No environment files or service startup were used.
  Existing Browserslist-age and large-bundle warnings remain.
- `git -c core.safecrlf=false diff --check`: passed.

Browser launch initially failed inside the Windows sandbox; the same synthetic
fixtures passed outside it after tool approval. The Chrome test helper required
explicit printable-key events; its initial typing failure was corrected in this
task's runner without changing the shared harness. The new fixture's incomplete
typed schedule was completed, and fixture type checking then passed. Historical
evidence is preserved; new evidence uses `time-format-*` names.

Only en/lv/ru were tested. ar (including RTL), zh, fr, de, hi, ja, pt and es remain
supported and deferred for verification. No physical device, virtual keyboard,
screen reader, connected app/database/service or deployment verification occurred.
External API boundaries are mocked, unexpected requests fail, browser requests are
restricted to the isolated fixture, and no credentials/private configuration were
read. No new security issue was identified in this scoped diff; this is not a wider
application audit. No dependency installation or database/API contract change.

All pre-existing dirty work was preserved. Recovery: revert only this task's
formatter, time fields, wrapping/style/selectors, backend clock option, tests and
handoffs; no persisted data or service configuration needs recovery. Next action:
user review; deployment remains under the project's separate delivery authority.
