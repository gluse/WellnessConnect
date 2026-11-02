# TASK-032 — PRO notifications and appointment reminders

## PRO appointment presentation correction — 30 October 2026

User requested service-setting-based presentation for PRO appointments. Assigned
Frontend `/root/reminder_frontend` and Backend `/root/reminder_backend` accepted
the local correction under standing cooperation. Enabled service reminders show
**Automatic reminders** with actual delivery/schedule/error details beneath;
disabled service reminders offer **Send reminder** through the manual composer.
Backend now permits PRO reminder previews only when the service explicitly disables
automation; automatic status updates and enabled automated reminders retain their
manual-preview denial. Workspace/employee access, customer channel restrictions
and future-confirmed eligibility are preserved.

Root reviewed the actual frontend/backend contract, inspected both Chrome phone
screenshots, and passed `npm run check`, scoped script syntax/whitespace checks,
and in-memory esbuild bundles for `server/index.ts` and the worker. Backend passed
34 actual-bootstrap and 42 real-handler mocked scenarios. Frontend's scoped
browser/resource/type evidence is recorded in the
[follow-up handoff](pro-appointment-reminder-handoff.md); server authorization
evidence and recovery are in the [backend handoff](notifications-backend-handoff.md).
Historical evidence is preserved. Tests cover en/lv/ru; ar/RTL, zh, fr, de, hi, ja,
pt and es remain deferred. Supported translations are maintained.

No private `.env`, live database/app/provider operation, actual send, schema change
or deployment was required or performed. The full Vite build was not rerun because
its privacy-policy plugin loads private environment files; the isolated browser
fixture bundles the changed frontend and TypeScript checks the application.
Recovery: undo only this follow-up's component/translation/route/test hunks,
preserving other TASK-032 and unrelated work. User next step: restart the local
application if needed and refresh Appointments; live delivery remains unverified.

## Assignment and execution limits

On 29 October 2026 the user requested implementation of the approved PRO
notifications/reminders plan. Frontend `/root/notifications_frontend`, Backend
`/root/notifications_backend` and DB `/root/notifications_db` accepted their
respective local implementation and offline/mocked verification scopes. CI/CD
`/root/notifications_delivery` accepted worker/configuration preparation. Root
coordinates contracts, integration review and task documentation. Backend explicitly
delegated root the pure/worker/API tests, in-memory fixture and final local backend
integration fixes. Role owners retain authority for changes in their scope.

No connected database operation, private credential/configuration access,
provider provisioning, actual OTP/message sending, spending or deployment has
been authorized for this implementation. Existing deployment holds remain.

Customer phones/preferences are private; PRO belongs to the booking workspace;
customer preference wins over a service reminder default. Phone channels require
SMS verification and consent. Manual links only open a composer and do not prove
delivery. Reminder defaults: off, Email, 24 hours (range 1–168); confirmed future
appointments only; updated settings apply to existing future appointments;
elapsed schedules are skipped. Delivery metadata retention: 30 days.

## Implementation and checks

**Implemented and verified locally; live activation remains pending.**

- [Frontend handoff](notifications-frontend-handoff.md): Account preferences and
  SMS verification, service reminder controls, manual messaging modal, scoped PRO
  feedback and appointment badges. Maintains all supported translations. Account,
  workspace and permission changes discard private dialogs/drafts and late results.
- [Backend handoff](notifications-backend-handoff.md): authenticated private APIs,
  Vonage Verify/Messages and Resend adapters, transactional booking events, durable
  minute worker, lease/attempt identity, signed delivery/opt-out callbacks and
  30-day metadata retention. No automatic retry after ambiguous provider results.
- [DB handoff](notifications-db-handoff.md): additive expansion, separate runtime
  activation, catalog checks, private RLS/ACL contract and unique event/job/attempt
  identities. Quota index rationale is documented without a measured speed claim.
- [Setup guide](notifications-setup.md): default-off server configuration and an
  opt-in production worker overlay. Actual Docker/Compose execution is unverified
  because Docker is unavailable. No deployment was attempted.

Final root checks passed:

| Check | Evidence |
| --- | --- |
| `npm run check` | Baseline and integrated TypeScript pass. |
| `npm run build` | Vite frontend, Express bundle and standalone production notification worker pass. Existing stale Browserslist data and large-chunk warnings remain. |
| `npm run test:notifications` | 270 pure assertions; 26 worker, 24 scheduling and 31 actual API/preferences/callback scenarios; 13 retention records evaluated against generated deletion predicates. |
| `node --import tsx migrations/notifications/check.mjs` | Offline ORM/SQL parity, additive DDL, private RLS/ACL contract, uniqueness, defaults and reminder bounds pass. No SQL executed. |
| `npm run test:notifications-frontend` | Safe encoded links, service defaults/bounds and en/lv/ru resources pass. |
| Frontend browser and accessibility runners | Chrome 155.0.8059.85, Firefox 157.0 and WebKit 27.2 each pass nine behavior groups and 36 en/lv/ru viewport cases; native Chrome 400% zoom, reachable focus and light/dark computed contrast pass nine cases. Exact commands/reports in Frontend handoff. |
| `git diff --check` | No whitespace errors. CRLF normalization notices are informational. |

Backend HTTP tests use an ephemeral loopback Express server, mocked identity,
in-memory ORM and synthetic provider responses. The sandbox initially denied
loopback access; scoped automatic escalation allowed these isolated tests. No live
DB, application session store, carrier, WhatsApp, Resend or Supabase operation was
exercised. Offline SQL/model checks do not prove actual DB concurrency or grants.

Integration review caught and owners corrected service-name substitution, encoded
email-link validation, StrictMode/late-response handling, WebKit focus and duplicate
submits, lock-order inversions, stale dispatch clocks, delivery-state error ordering
and future status-event retention. Automatic sends are bounded to ten attempts per
customer/workspace/hour and 1,000 per workspace/hour; OTP limits are separately
documented. User preference is rechecked before actual dispatch. Unknown sends
remain unknown until a trusted receipt/reconciliation resolves them.

User's pre-existing `TASKS.md` heading edit and `.search-commit-check-K0YgF2/`
directory are preserved. Concurrent pending/group-booking availability changes
in scheduling/storage, booking controls and their test records belong to another
session and were preserved through narrow shared-file edits. Their owner reports
passing regressions against the integrated source; this task does not claim that
separate implementation. No commit was requested or created.

Testing is limited to en/lv/ru. Arabic/RTL, Chinese, French, German, Hindi,
Japanese, Portuguese and Spanish verification is deferred; supported translations
continue to be maintained. Screen-reader/physical-device checks and native-language
review remain unverified; computed contrast is not full WCAG certification.

## Rollout and recovery

Guided local setup progress (user-executed, reported in this conversation): the
user selected local development with their existing Supabase project. Prerequisite
output reports PostgreSQL 17.11, `postgres`, no missing expected roles and no
notification event table before expansion. The user reports
`notifications_expansion_created=true` and `notifications_runtime_created=true`
after running migrations 0014 and 0015 in SQL Editor. Their catalog output lists
all 23 expected notification indexes as valid and ready. Subsequent user-reported
catalog results show all six tables ordinary/RLS-enabled, runtime policies present,
private roles denied and application DML granted; all four new columns have the
expected types, NOT NULL and defaults; 13 checks, five foreign keys and six primary
keys are validated. This completes the guided catalog checks, not an application
runtime or concurrency rehearsal. No agent connected to the database or executed
SQL. These user reports supplement the earlier local-only evidence. Local runtime
configuration, provider setup, feature activation and live delivery remain pending.

Guided setup subsequently reached a user-run `npm run billing:dev` startup refusal.
Local source review identifies an omitted integration: the billing application
readiness guard still expects 27 public tables and rejects access to the six new
notification tables. DB and Backend owners accepted a local exact-schema readiness
extension and redacted stage diagnostics, respectively. Both fixes are complete:
the current application requires exactly 33 tables and checks notification columns,
constraints, indexes, private permissions and policies. Historical pinned profiles
remain unchanged. Offline checks passed: 129 runtime-contract assertions,
ORM/SQL/manifest parity, 133 monthly-database checks, 60 safe diagnostic checks,
16 mocked billing-runtime tests, TypeScript and production build (existing bundle
size/Browserslist advisories remain). No agent started the app, read private
configuration or retried a connected operation. Next is one user-run startup retry;
if refused, inspect its safe stage/code/checks. Do not rerun either applied migration
or bypass the guard.

The user's next startup attempt reports only `notification_constraints` false.
DB owner reproduced a source mismatch: PostgreSQL 17 renders default `trim`
using `TRIM(BOTH FROM ...)`, absent from the original normalizer/fixtures. A narrow
local matcher correction preserves explicit trim-character/direction distinctions.
Passed 141 runtime-contract checks, ORM/SQL/manifest parity and 133 monthly-database
fixtures. No migration, manifest, permissions or private configuration changed.
One further user startup retry remains pending; catalog-only fallback evidence is
prepared in `migrations/notifications/diagnose-check-constraints.sql` if needed.

With the notification feature enabled during guided setup, user reports reminder
status cannot load: `/api/bookings/36/notifications` returns `Choose a workspace
you belong to.` Root found notification registration precedes the company route
bootstrap that installs `/api` workspace loading. Backend accepted the narrow
registration-order fix and an actual-bootstrap regression, since the prior route
test's authentication stub populated workspace and masked the omission. No agent
exercises live requests, reads private configuration or changes database state.
Local correction is complete: notifications now register after company workspace
middleware. The new actual-bootstrap test reproduced the original 403 and passes
29 scenarios covering personal/company workspaces, employee assignments, denied
access and the earlier raw webhook boundary. The full notification suite passed
(270 pure assertions, 26 worker, 24 scheduler, 13 retention records, 29 bootstrap
and 31 API/preferences/webhook scenarios), along with TypeScript, scoped diff
checks and the server build. Next: user restarts the app and refreshes appointments;
actual local API success remains user-verified. Recovery is reverting only that
registration change while retaining access checks. No database changes are needed.

**Schema first is mandatory:** apply the reviewed expansion and runtime activation
to an approved target before running this new application version, even with
notification flags off. Existing Drizzle service/booking selects reference the
new columns. Generic `db:push` is not the rollout procedure.

Database migration, credentials/senders, WhatsApp template approval, callback
configuration and live verification require their own scoped execution approvals.
Reviewable migrations/setup instructions and local verification are complete.
Keep feature activation off until prerequisites are verified. Recovery begins by
disabling notification dispatch; preserve booking state, ambiguous delivery
records and deduplication data. Reverse only TASK-032 local changes when needed,
preserving other work; never replay unknown sends automatically.
