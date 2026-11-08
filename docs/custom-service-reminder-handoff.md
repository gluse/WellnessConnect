# TASK-049 custom service reminder message

8 November 2026. Local implementation and integrated review completed.
The user subsequently approved reviewed development activation without DB backup.
Migration 0023 committed once and development readiness checks passed.

## Scope and behavior

The user's request is to allow a customizable message with preview when
`service-reminder-enabled` is checked. Root assigned the Frontend, Backend and DB
owners through live collaboration under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
All accepted reversible local work and offline/mocked checks. Their separate
acceptance, file ownership and evidence are recorded in the
[coordination queue](agent-coordination.md#task-049-custom-service-reminder-message--8-november-2026),
[frontend handoff](custom-service-reminder-frontend-handoff.md),
[backend handoff](custom-service-reminder-backend-handoff.md) and
[database handoff](custom-service-reminder-db-handoff.md).

When automatic reminders are enabled, the service editor shows an optional plain
text message, a character count and a live preview. The message is limited to
1,000 characters and saved with the service. It follows the required appointment
details and precedes the FitsMyTime signature. Empty/whitespace text retains the
existing default. Custom text is sent as written without automatic translation.
The preview uses the same shared formatter as delivery, the current service name,
interface language and a clearly disclosed sample UTC appointment. Previewing
does not send a message or contact a recipient.

Drafts survive toggling reminders and failed saves; account/workspace changes use
the existing editor isolation. React renders notes as literal text. Backend
validation/PRO authorization covers the new field; current service text is read
at dispatch. Status notifications exclude the custom reminder message. Existing
confirmation, consent, customer language/channel preference, quota and duplicate
send safeguards remain in effect. The note is intended to be customer-visible;
existing service transport objects include it, so it must not contain secrets or
private per-customer instructions.

Email/SMS use the complete text. WhatsApp requires a separately approved
`<language>:reminder_custom` template with service/date/message variables; missing
configuration reports `not_configured` and sends nothing. Existing blank-message
WhatsApp templates remain compatible. Provider template setup and delivery are
unverified and have not been changed against any live service.

## Integrated verification

Root reviewed editor/draft/API/shared-renderer/worker/template integration, the
long-content phone capture and the readable 390×900 editor/preview screenshot.
Independent checks passed:

- `node --import tsx scripts/test-notification-time-format.mjs`: 60 en/lv/ru
  notification kind/clock cases, encoded manual links, locale dates and DST.
- `node --import tsx migrations/service-reminder-message/check.mjs`: ORM/SQL
  parity, bounded input, strict readiness/drift handling and audit compatibility.
- In-memory esbuild bundles of `server/index.ts` and
  `server/notifications/run-worker.ts`, without executing the application.
- `node --import tsx migrations/service-reminder-message/test-execution.mjs`:
  held approval/recovery, no private reads on admission failure, preservation,
  one submission/no retries, uncertain COMMIT and postflight failure handling.
  Root also independently verified the prepared SQL SHA-256 against its runner.
- `git diff --check`.

Frontend returned passing scoped notification fixture TypeScript, resource/input
checks and Chrome five behavior groups plus twelve en/lv/ru viewport cases.
[Readable preview](custom-service-reminder-chrome-preview.png) and
[browser evidence](custom-service-reminder-chrome-evidence.json) are available.
Firefox/WebKit engine binaries were unavailable; no fresh coverage is claimed.
Backend returned fourteen actual storage/input scenarios, 312 policy/transport
assertions, 29 worker, 31 scheduling/summary, 35 bootstrap, 42 API and 90 sanitized
startup checks. DB returned passing new migration/executor checks and existing
gallery/notification parity checks without rewriting applied artifacts.

Baseline `npm run check` failed before implementation on five existing errors in
`client/src/native/client.ts` and `server/native-proof/service.ts`. Final clean
`npm run check -- --incremental false` reproduces those same five errors, with no
new feature errors. A diagnostic ES2022 override still leaves the existing
native client unknown-to-string error; it does not establish a passing full check.
An extra existing notification runtime-contract runner stopped on its unrelated
stale rights-count assertion (`35 !== 33`); it does not validate the new field and
was not weakened or rewritten. Scoped owner checks and browser evidence are linked
above. The normal Vite build
was not run because its privacy policy plugin loads private environment files.

Fresh test scope is **en/lv/ru** only. **ar including RTL, zh, fr, de, hi, ja, pt
and es are deferred**; supported translations are maintained. Mocked tests do not
verify physical devices, screen readers, native-language quality, connected
database semantics or actual provider delivery.

## Activation and recovery

Updated service queries require `reminder_message`. Both main app and notification
worker check database readiness before operation. Migration 0023 is now applied
to the approved development source. Other environments must apply the reviewed
expansion under their own execution authorization before starting this app version.
Initial preparation had no database/private configuration access; the approved
activation below subsequently accessed only the named source and required protected
connection configuration. TASK-048's operation approval and waiver were not reused.

The DB handoff contains the concrete source-only activation command, target,
executor, validation and recovery choices. The user replied **"Approve. Proceed
without DB backup"** to the specific migration request. This authorizes assigned
DB executor `/root/custom_reminder_db` for the single reviewed development source
`hbkooiknruimukkhshrk` migration, necessary protected connection reads and bounded
source pre/post checks, with an explicit TASK-049 no-backup waiver. Root routed it
through live tools; owner accepted. Backend verifies local writer quiescence and
may stop only positively identified project writer/watch process trees. No app or
worker startup, destination access, messages, audit delivery or deployment is in
scope. Earlier offline-only statements above describe preparation.
Keep app/notification writers stopped through migration and verification. Stop on
failure; do not retry an uncertain migration outcome. No audit destination
connection or message sending is needed for this additive no-DML expansion.

The Backend owner freshly identified and stopped the exact project npm/dev/watch
tree, preserving its terminal and unrelated processes. DB owner then submitted
the pinned transaction once: **COMMIT confirmed at 18:22 Riga, 8 November 2026**.
Source preflight verified PG17/postgres identity, 41 public tables and zero other
writer clients. Postflight preserved all original fields and counts of 28 services
and 36 bookings, empty new messages and the enabled service audit trigger. Restricted
baseline/new-message readiness passed. No backup, retry, destination connection,
ACL/configuration edit, real message, audit delivery, startup or deployment occurred.

Root independently reviewed the sanitized
[execution receipt](../migrations/service-reminder-message/source-execution-receipt.json),
verified `state:verified`, `committed:true`, preservation and no-retry flags, and
matched receipt SHA-256
`c1a4c84e91ff7ae3181fe187fdb457042ad896963d0bf4d970a212ac68ce36b8`
and unchanged SQL digest
`341f702ef28c59e3e5adf289eb0a520411f3b6e93fc476a0c737ada86ba9168d`.
Do not rerun the executor or remove/overwrite its receipt. The app remains stopped;
normal startup of the updated app is the next action. This does not claim live UI
save or provider delivery coverage. Custom WhatsApp templates remain a separately
configured provider dependency.

Now that the expansion is applied, prefer rolling back the app while retaining the
compatible empty-default column; dropping it requires separate DB review and would
discard saved custom messages. Preserve applied SQL and the execution receipt.
Root owns the final integrated record; DB owns any later authorized repair and
other-environment activation.
