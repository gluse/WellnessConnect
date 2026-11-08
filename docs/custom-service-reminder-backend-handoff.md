# TASK-049 custom service reminder messages — backend

Accepted and completed locally on 8 November 2026 by assigned Back End Developer
`/root/custom_reminder_backend`, requested by `/root` for the user's custom message
and preview request under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible backend application changes, a shared pure message renderer,
offline/mocked validation and this handoff. DB owner owns ORM/schema, migration,
readiness contract and its checks; Frontend owns UI/translations/browser checks.
No private configuration, connected database/service execution, real sending,
spending, deployment or publishing occurred. Root owns integrated review and records.

## Contract and behavior

`service.reminderMessage` is optional in create/update input, trimmed plain text
limited to 1000 JavaScript string units by input validation; DB storage defaults
to the empty string and enforces a maximum of 1000 PostgreSQL characters. Empty
input retains the standard generated message. Frontend and backend use the same
`renderMessage` exported by `shared/notification-message.ts`; the server policy
module re-exports it for existing consumers. Supported appointment copy was moved
unchanged, and only reminders append the note between the required appointment
sentence and FitsMyTime signature. Internal line breaks and literal markup/token
characters remain plain text. The note is not translated or evaluated as a template.

The worker reads the current service note when dispatching; manual reminder
previews and their encoded composer links include it. Accepted/rejected/rescheduled
updates and previews exclude it. Existing PRO automatic/manual restrictions,
booking/workspace authorization, recipient preferences, consent, quotas, current
booking eligibility, attempt reservations and no-retry behavior remain in place.
The service storage transaction checks PRO before custom-note changes, preserves
unchanged notes during unrelated edits after downgrade, and requests future-reminder
reconciliation when the note changes. Copies retain the draft note with reminders
disabled. Existing public service payloads include the customer-visible note;
this field is not a place for private provider instructions.

## WhatsApp template compatibility

Email uses the complete plain-text body; SMS uses the same body. Automatic WhatsApp
requires an approved template. A nonempty note selects the separate
`<customer-language>:reminder_custom` entry from the existing
`VONAGE_WHATSAPP_TEMPLATES_JSON` configuration; its shape is unchanged:

```json
{
  "en:reminder_custom": {
    "name": "appointment_reminder_custom",
    "namespace": "your_approved_namespace",
    "language": "en"
  }
}
```

The approved custom template must contain the appointment information and accept
three ordered variables: **service name, formatted appointment date/time with
timezone, custom note**. Configure corresponding entries for actual recipient
languages as needed. Blank notes continue selecting `<language>:reminder` with
the original two parameters. Custom-template absence fails closed with the
existing `not_configured` state before a provider attempt; it never silently
uses a default template that omits the note. Customer preference can select
WhatsApp even when the service default is email. Template availability is checked
for the actual selected channel and customer language in status summaries and at
dispatch. No provider template or private configuration was created or changed;
real provider formatting, approval constraints and delivery remain unverified.

## Startup and rollout

Both the application startup and standalone notification worker now call the
DB-owned read-only `verifyServiceReminderMessageDatabaseReadiness` contract before
registering application routes/dispatching work, with a five-second query timeout.
The application reports only allowlisted stage/code/check identifiers, including
`SERVICE_REMINDER_MESSAGE_DB_NOT_READY`; arbitrary error data is never echoed.
The worker refuses initialization before its loop on readiness failure.

The additive `0023` migration is prepared by the DB owner and **has not been
applied**. Apply it under separate target/executor authorization before running
this application version. Existing connected-operation and deployment holds remain.
See [DB handoff](custom-service-reminder-db-handoff.md) for the reviewed execution
package and recovery guidance.

## Verification

Inspected runners/imports before execution. Fresh language checks cover **en, lv,
ru** only; **ar including RTL, zh, fr, de, hi, ja, pt, es remain deferred**, while
their supported message copy is preserved. Completed checks:

- `node --import tsx scripts/test-custom-service-reminder-backend.mjs`: **14**
  actual storage/input scenarios; create/update/copy, omitted/invalid/bounded input,
  literal multiline data, PRO denial before writes, unchanged note after downgrade,
  clearing, transaction-scoped reconciliation and cross-workspace copy denial.
- `node --import tsx scripts/test-notifications.mjs`: **312** policy/transport
  assertions; shared rendering, blank fallback, reminder-only note inclusion,
  safely encoded manual links, complete email/SMS bodies, dedicated WhatsApp
  selection/parameters, missing custom-template refusal before HTTP, existing
  signature/error/no-retry behavior.
- `node --import tsx scripts/test-notification-worker.mjs`: **29** real worker
  scenarios; latest note at dispatch, required service/date preservation, status
  exclusion, preference-selected WhatsApp refusal, existing eligibility/consent/
  quota/attempt protections. ORM/provider boundaries are synthetic.
- `node --import tsx scripts/test-notification-scheduling.mjs`: **31** real service
  scenarios; new custom-note PRO checks and actual reminder summary reporting
  scheduled default WhatsApp versus unavailable custom WhatsApp without a compatible
  template. Scripted ORM; database concurrency is not established.
- `node --import tsx scripts/test-notification-bootstrap.mjs`: **35** actual
  bootstrap scenarios, including reminder-note inclusion/status-note exclusion
  through real routes/workspace middleware. Repaired stale synthetic audit
  middleware factory boundaries so this existing runner matches current bootstrap.
  HTTP is in-process; DB/auth/unrelated route owners are mocked.
- `node --import tsx scripts/test-notification-routes.mjs`: **42** actual handler
  scenarios, including en/lv/ru custom-note previews with no writes/sends. Initial
  sandbox run hit localhost `connect EACCES`; exact scoped elevated rerun passed.
  HTTP is loopback-only; auth/ORM/providers are mocked.
- `node --import tsx scripts/test-startup-diagnostics.mjs`: **90** checks, including
  new readiness identifiers, deduplication/allowlisting and private-data rejection.
  Queries are injected; no app/client/configuration initialization.

Root independently owns application type/build and integrated review; its reported
full typecheck matches the five pre-existing native-source errors with no new
errors, and its in-memory server/worker bundles pass. No full Vite build, connected
app startup, database migration, real sends, live template verification or deployment
is claimed. UI/browser results belong to the
[Frontend handoff](custom-service-reminder-frontend-handoff.md).

Recovery: reverse only TASK-049's backend/shared-renderer/test/startup edits with
the coordinated frontend and DB version; preserve unrelated work and historical
evidence. If the additive migration is applied later, keep its column when rolling
back application code unless the DB owner separately approves data/schema removal.
Next owner: root for final integrated contract review, then the authorized DB
executor for separately approved migration/runtime activation.

## Development migration cutover process check

On 8 November 2026 the user approved TASK-049 development activation of migration
`0023`, explicitly waiving a database backup. Root assigned this Backend owner the
necessary fresh local writer inspection/stop dependency before the DB owner's
single approved connected attempt. This extends only the local process operation
recorded here; Backend did not read private configuration, access the database or
network, start the app, or execute the migration.

Fresh Win32 process metadata revealed an active project `npm run dev` tree started
at 18:19:10–18:19:11 Riga time, despite TASK-048's historical stopped record:
terminal `35588` → npm/node `46556` → cmd `45916` → cross-env/node `45616` → cmd
`36412` → tsx-watch/node `50948`. Exact workspace paths in the child command lines
identified `C:\Source\Private\WellnessConnect` and `server/index.ts`; only sanitized
identity tokens, PIDs and creation times were returned, with no configuration
contents or arbitrary process arguments. No separate identifiable project
notification or audit worker was found.

Sandbox CIM inspection was unavailable; the scoped elevated metadata inspection
and subsequent exact-tree stop were approved automatically. Immediately before
termination, all five process IDs, expected parents, executable names and creation
times were revalidated, together with the child workspace/script identity. Backend
stopped only npm/node `46556`, cross-env/node `45616` and tsx-watch/node `50948`;
their cmd wrappers exited with them. A fresh post-stop snapshot confirmed all
five project PIDs absent, terminal `35588` still present, and no remaining
command-identifiable exact-project app/watch/notification/audit writers. Unrelated
processes and processes without sufficient identity metadata were left untouched.

Backend delivered that result to root and the DB owner **before** its sole
migration attempt. The DB owner's mandatory zero-other-source-client inspection
remains authoritative for connected clients, including any writer not identifiable
from command metadata. No broader process action or application restart was made.
The DB handoff/root activation record owns the later migration outcome; the
unapplied status above describes this backend's original local implementation.
