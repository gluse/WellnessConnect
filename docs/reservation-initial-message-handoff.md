# Reservation initial message — 4 November 2026

Implemented and verified locally for TASK-040. User approved
[the plan](reservation-initial-message-plan.md) with “Start implementation”, then
selected **“you can delete / ignore current notes.”** Root selected ignore:
historical rows remain intact and their separate UI is removed. No historical
conversion, retention change, schema change or connected operation was needed.

## Authority and execution

The live-assigned Front End Developer `/root/initial_message_frontend`, Back End
Developer `/root/initial_message_backend` and DB Analyst/Developer
`/root/initial_message_database` accepted their scoped dependencies under AGENTS.md.
Frontend and Backend subsequently explicitly delegated their local implementation
and tests to `/root` after their initial turns hit a usage limit. Backend had
already edited routes/storage; Frontend had not changed files. Root completed the
work and integrated verification. Both owners returned final review with no
functional blockers; a frontend wording finding was corrected.

Frontend additionally accepted/delegated read-only conversation support in
`provider/appointments.tsx` and `booking-collaboration.tsx`: authorized viewers
previously able to read notes can read the initial message without a composer.
Existing server GET authorization and write permissions are unchanged.

Allowed scope was reversible repository files, synthetic persistence/auth/API
boundaries, local type/build checks and isolated loopback browsers. No connected
database, sessions, external service, credential/private configuration, deployment
or publishing was accessed. Preserve unrelated dirty work and prior evidence.

## Result and contract

- Booking creation has one optional **Message to the provider** field, explanatory
  help and a 4,000-character limit. The form sends `initialMessage`; drafts survive
  failures, and creation has no automatic mutation retry. Existing duplicate-submit
  and duplicate-group-booking confirmation guards remain.
- `POST /api/bookings` validates/normalizes the message. Legacy `notes` input is a
  temporary compatibility alias. Identical nonblank values create one message;
  conflicting values return 400. Blank/null/omitted text creates no message.
- Explicit server-owned booking values replace spreading untrusted request fields.
  `DatabaseStorage.createBooking` inserts booking and initial customer message in
  its existing transaction, before reminder reconciliation. They share one explicit
  server timestamp. The customer author is the authenticated booking creator,
  UUIDs are server-generated, `broadcastId` is null, and stored booking notes are
  null. Failures roll back booking/message/reminder changes together.
- Provider list/calendar details expose Messages and omit all legacy note
  controls/sections and the notes-only group indicator. Both parties use the same
  retained private conversation. Read-only providers see history and Close only;
  they cannot compose. Scope changes still clear private dialogs.
- Message text remains plain React text with multiline whitespace and wrapping;
  it is not interpreted as HTML. Booking-creation errors log a controlled error
  name, not raw driver errors or private message parameters.
- Supported translations include the new label/help and use “message” in the slot
  conflict copy. Obsolete unused translation keys remain for compatibility.

DB owner reviewed the existing `booking_messages` FK/body/role/UUID constraints,
indexes and server-only runtime grants: no ORM, schema or privilege change is
required. The owner confirmed explicit shared timestamps and the no-backfill path.
Uniqueness and atomic insertion cover one initial message per created booking;
this task does not introduce booking-level retry idempotency. Message history
keeps its existing 12-calendar-month policy; ignored historical notes remain
outside message cleanup.

## Verification

All commands below passed. Scripts/imports/hooks were inspected before execution.
Browser/API checks used loopback fixtures with mocked fetch/persistence/auth and
blocked external traffic. Initial sandbox attempts could not launch Chrome or
connect to loopback; the same isolated checks passed with reviewed escalation.

- `node --import tsx scripts/test-booking-notes-backend.mjs`: 21 scenarios through
  real route/storage and conversation logic, with in-memory persistence. Pending
  and instant bookings, aliases/conflicts, blank/length/Unicode input, spoofed
  identity/timestamps, message/reminder rollback, private reads, capacity/auth and
  log redaction pass. Historical DTO/workspace-filter coverage is retained.
- `node --import tsx scripts/test-booking-capacity.mjs`: existing creation,
  approval/reschedule, snapshots/cleanup, pending/shared/exclusive occupancy and
  API-validation regressions pass with injected adapters.
- `node --import tsx scripts/test-appointment-collaboration.mjs`: 43 scenarios.
  `node --import tsx scripts/test-appointment-collaboration-api.mjs`: 22 actual
  loopback Express/API scenarios with mocked Auth and database.
- DB owner ran `node --import tsx scripts/test-booking-message-retention.mjs`:
  16 existing in-memory scenarios pass; this is owner-returned evidence.
- `node scripts/test-reservation-initial-message-browser.mjs` passes in
  Chrome 156.0.8078.79, Firefox 157.0 and WebKit 27.2 for **en/lv/ru**. Real creation,
  provider and customer components cover one creation request, first message,
  replies from both parties, 4,000-character control, localized label/help,
  multiline/long-word/HTML-shaped plain text, 1280/768/375/320px reflow, focus,
  failed-save draft/manual retry, blank/instant group/read-only and ignored notes.
  The historical `test-provider-booking-notes-browser.mjs` entry now imports this
  successor regression; its old handoff/evidence remains historical.
- Chrome `test-appointment-collaboration-browser.mjs`,
  `test-duplicate-group-booking-browser.mjs` and
  `test-booking-capacity-browser.mjs` pass. The duplicate test now waits for
  alternative times to reload after leaving review; its existing assertions remain.
  Collaboration fixtures explicitly choose Upcoming instead of inheriting the
  newly changed provider Calendar default.
- Chrome `test-appointment-calendar-browser.mjs` passes 12 en/lv/ru viewport cases
  plus interactions, nested dialogs, read-only history, privacy and focus checks.
  `test-forms-phase2-browser.mjs` passes 14 interaction groups, 63 en/lv/ru
  locale/width cases and 112 translated keys, including rejected/pending booking,
  draft recovery, keyboard/reflow, dark mode and reduced motion.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` and
  `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.provider-booking-notes.json`
  pass. `node scripts/build-appointment-calendar-check.mjs` passes with
  `configFile:false`/`envFile:false`, no server plugins or shared-output clearing.
  Existing Browserslist-age and large-bundle warnings remain.
- Scoped `git diff --check` passes. Final Backend/Frontend owner review returned
  no blocking findings. The last wording-only correction changes “notes” to
  “message” in supported conflict translations; no application behavior changed.

Firefox/WebKit used existing tooling at
`C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools`, with process-only
`FORMS_BROWSER`, `FORMS_PLAYWRIGHT_MODULE` pointing to
`node_modules/playwright/index.mjs`, and `PLAYWRIGHT_BROWSERS_PATH` to its `browsers`
directory. No installation/download occurred. Calendar checks use
`APPOINTMENT_CALENDAR_ARTIFACT_PREFIX=reservation-message-calendar`; form checks use
`FORMS_EVIDENCE_PREFIX=reservation-message-forms-chrome` to preserve prior evidence.

Visually inspected the [320px creation form](reservation-initial-message-chrome-320-form.png)
and [initial conversation](reservation-initial-message-chrome-320.png): labels,
help, actions and safe long-text wrapping fit the viewport. Additional evidence:
[calendar](reservation-message-calendar-chrome-evidence.json) and
[forms](reservation-message-forms-chrome-evidence.json). Evidence run dates are
4 November 2026; their synthetic appointment clocks remain fixed independently.

Deferred: **ar/RTL, zh, fr, de, hi, ja, pt and es** testing. Their supported
translations are maintained without claiming fresh coverage. Native-speaker,
physical-device and screen-reader validation, live database/RLS/race verification
and deployment are outside these local checks.

## Recovery and next action

Revert only TASK-040's targeted code/test/resource/document changes; preserve
unrelated work. There is no migration to undo and no database data was removed.
After any future rollout, keep conversation readers when rolling back creation
code so saved initial messages remain accessible. Backend compatibility should
ship before clients switch payloads. Next: user functional review of the local
flow; deployment requires its existing separate scope. Local implementation has
no outstanding blocker.
