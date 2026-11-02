# TASK-032 notification backend handoff

Status: implemented locally; mocked verification complete; connected rollout and
provider validation remain unexecuted. No database connection, credential/private
configuration inspection, provider account setup, real verification/message,
deployment or publishing was performed by the Backend owner.

## Acceptance and ownership

On 29 October 2026, `/root` assigned `/root/notifications_backend` as Back End
Developer for the user's explicit implementation request. Accepted scope covers
backend routes/storage/notification modules, non-database shared contracts,
offline tests, server configuration examples and this handoff under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Applied [backend practices](../.agents/skills/backend-practices/SKILL.md).
DB owner accepted schema/migration dependencies; Frontend accepted API/UI work;
CI/CD accepted optional worker packaging/deployment preparation. No owner delegated
connected access. Root was explicitly delegated backend test scripts and their
mocked fixture, plus final integration review. Root/coordination retain approvals.

Concurrent unrelated booking-capacity changes in `server/storage.ts` and booking
routes were preserved through narrow edits. They belong to the other user session;
this handoff does not claim that implementation or its evidence.

## Interfaces and behavior

- `shared/notifications.ts` defines strict communication PATCH, channels, supported
  notification languages, timezone validation and client response types.
- `GET/PATCH /api/account/communication` reads/writes only the authenticated user's
  private settings. Number changes atomically clear verification/phone opt-ins,
  reset preference to email and invalidate pending challenges. Opt-out without an
  explicit incompatible preference resets the old method to email. Phone-based
  preferences require the exact verified number and channel permission. Server-only
  email suppression is absent from writable/public contracts.
- `POST /api/account/communication/verify/start` accepts `{}`; `/check` accepts
  `{code}` (six digits). Vonage Verify v2 is SMS-only, without voice/channel fallback.
  Challenges bind user, exact number and provider request ID. Code checks allow
  three reserved attempts, expire after five minutes, throttle sends for one minute,
  at most ten/account/day and five/number/hour. Preference-row and number advisory
  locks serialize local reservations; no remote call occurs inside a transaction.
  HTTP rate limiting additionally bounds verification traffic per process/IP.
- `GET /api/notifications/capabilities` uses the selected workspace and effective
  `provider_subscriptions` PRO projection, including manual grants and expiry.
  It does not require billing-owner permissions. Inactive companies fail closed.
- Provider status/reschedule mutations accept optional `timeZone` (IANA, default
  UTC), preserve existing fields and add `notification`. Only pending→confirmed,
  pending→cancelled and provider-initiated actual reschedules capture events.
  Customer changes, accepted-booking cancellation, completion and no-op changes do
  not notify. All meaningful booking changes increment a server-owned revision.
  The event and automatic job commit in the booking transaction.
- PRO notifications use automatic mode without modal even when a recipient/channel
  is unavailable; such events expose `skipped` plus a safe reason. Free workspaces
  use manual mode. Delivery failures cannot reverse an already committed booking.
- `POST /api/bookings/:id/notification-preview` accepts `{kind:'status'|'reminder',
  eventId?,timeZone?}`. Current booking-management authority/employee assignment and
  workspace scope are checked before private recipient access. PRO previews are
  rejected. Status events must match the current revision and retention window;
  manual reminders require a future confirmed appointment. Server-derived messages
  and encoded `sms:`, `mailto:` and `https://wa.me/` links never claim delivery.
- `GET /api/bookings/:id/notifications` returns notification and reminder state;
  provider booking lists add actual reminder summaries in bounded 200-booking
  batches, with one entitlement lookup per already-authorized workspace rather
  than individual database round trips per appointment. Historical sent/failed
  outcomes remain visible after PRO expiry or disabling reminder settings. Phone/consent/configuration
  failures appear as unavailable, without automatic channel fallback.

## Scheduling, delivery and security

Service fields are `reminderEnabled=false`, `reminderMethod=email`,
`reminderHours=24` (integer 1–168). Server transactions reject changed automation
settings without workspace PRO. Copies begin with reminders disabled. Service edits,
confirmed booking creation and booking changes reconcile reminders; a minute worker
also revisits future confirmed bookings after subscription reactivation. Past
recalculated targets are skipped, so reactivation never sends missed reminders.

One reminder event per booking/appointment instant and one job/attempt per event/job
are enforced by DB-owner constraints. Existing attempted jobs are never requeued.
Settings edits can invalidate only unattempted leases. Cancellation/completion and
rescheduling cancel obsolete unsent reminders. Periodic reconciliation preserves
already-due jobs during the five-minute delivery grace; jobs beyond that window
expire. Status jobs have a thirty-minute freshness window. Workspace PRO, current
booking/date/revision, preferences, consent, suppression and transport readiness are
rechecked immediately before recording an attempt. The real clock refreshes after
locks; fixed clocks are injected only by offline tests. Hidden service listings
retain notifications for existing booked commitments.

Leased jobs use `FOR UPDATE SKIP LOCKED`, paired tokens/expiry and one reserved
attempt before dispatch. Unattempted expired leases can requeue; attempted ones
become unknown. Remote timeout, malformed/oversized response and 5xx are unknown
without retry; explicit provider rejection is failed. Resend receives job-ID
idempotency keys; Vonage receives a job-ID client reference. Neither can establish
exactly-once external delivery. Signed callbacks distinguish accepted/delivered,
deduplicate persistent callback IDs and preserve delivered state against late
accepted/failed updates. Early Resend callbacks without correlation return 503 for
provider retry rather than losing their status; callback-ID insertion rolls back.
The resulting delivery state controls reason codes, so a delivered callback cannot
later display a stale failure/timeout reason. A workspace advisory lock serializes
hourly attempt counting/reservation across worker replicas. Automatic sends stop at
ten attempts per customer/workspace/hour or one thousand per workspace/hour, with
safe `rate_limited` feedback; the worker also processes at most one hundred jobs
per tick. Quotas count durable attempts, including failed/unknown outcomes, without
storing extra recipient contacts. The fresh clock is acquired after all these locks.

Raw callbacks mount before JSON/session middleware:
`POST /api/notifications/webhooks/vonage` and `/resend`. Vonage requires HS256 JWT,
issuer/API key/application binding, bounded timestamp, token ID and SHA256 raw-body
hash; Resend uses raw Svix HMAC headers and a five-minute timestamp window.
Authenticated inbound STOP/UNSUBSCRIBE/CANCEL/END/QUIT clears relevant phone opt-in
and resets preference. Resend bounce/complaint/suppression events suppress future
email through a server-owned field. Invalid/unsigned callbacks cause no DB mutation.
Body size is 32 KiB; outbound responses are capped at 16 KiB, fixed HTTPS endpoints
disallow redirects, and provider requests time out after ten seconds. Phone numbers,
message bodies, raw callback payloads, credentials and provider error bodies are not
logged or retained in notification event/delivery records.

Cleanup removes terminal metadata older than thirty days while preserving active
jobs, recently updated results and future appointment identities. Phone challenges
and callback dedupe records expire on the same horizon.
The future-instant exception applies only to reminder identity: terminal status
events can expire after thirty days even when the appointment itself is next year.
Cleanup runs on each minute tick (stricter than daily). Leaving `NOTIFICATIONS_ENABLED=true` and
turning automation off preserves retention cleanup without sending. SIGTERM stops
between reconciliation transactions and dispatches, finishes the current operation,
then closes the pool. Forced termination relies on durable leases/attempt identity.

## Configuration, validation and remaining release gates

Use [the server-only example](../config/notifications.env.example). All three feature
flags default off. Configure approved Vonage application/sender/signature secrets,
Resend sending-domain/from/signing secret, and explicit approved WhatsApp templates
per language/action. WhatsApp has no language fallback. Template parameters are
service name, new formatted appointment date/time/timezone, then old date/time for
reschedules only. Basic SMS does not establish WhatsApp reachability. Production
adapters use Vonage Messages v1 for SMS/WhatsApp and Verify v2 for codes; email uses
Resend `/emails`. Existing authentication/invitation email paths remain untouched.

`npm run build` also emits `dist/notification-worker.js`. Native development uses
`npm run notifications:worker`; production uses
`npm run notifications:worker:production` without `tsx`. This is a separate process,
never an extra timer in the HTTP application. See CI/CD's optional deployment
preparation and [DB migration handoff](notifications-db-handoff.md). **Schema first**
is mandatory even while flags are off: existing Drizzle blanket service/booking
queries include added columns. Never use generic `db:push` for this feature.

Offline evidence as of this handoff:

- `npm run check`: passed after backend integrations.
- Pure policy/transport runner: 270 assertions, including encoded links, current
  verification protocol, synthetic RSA JWTs, signatures/forgery/replay, opt-ins,
  response bounds, timeout/no-retry outcomes and safe template substitution.
- Real worker dispatch function: 26 scenarios using the SQL-predicate-evaluating
  in-memory fixture, including personal/company isolation, expiry, stale events,
  consent, duplicate attempts, quota isolation/limits, fresh clock after locks,
  flag revocation and delivery failure/early-callback ordering.
- Real scheduler service: 24 scenarios using a scripted ORM boundary, including
  24-hour default, grace/past-target handling, pending/free exclusion, settings
  recalculation, attempt uniqueness decisions, reactivation and manual/automatic mode.
- Retention evaluates actual generated Drizzle deletion predicates against thirteen
  synthetic records, preserving future reminder identity and active/recent jobs
  while deleting old terminal status events for future appointments.
- Root owns the Express/preferences/raw-webhook runner and final integrated checks;
  its latest report is 31 passing scenarios. `npm run test:notifications` includes
  all five backend runners. The Express runner binds loopback only and mocks DB,
  Supabase auth/storage and all provider calls. Sandbox loopback permission may be
  required; it is not a live integration run.

Supported translations remain maintained; fresh tests cover **en/lv/ru only**.
**ar/RTL, zh, fr, de, hi, ja, pt, es are deferred**. No real database transaction,
constraint, query plan, RLS/ACL, concurrent lock, production credential, carrier,
WhatsApp template, email-domain, callback delivery or deployment evidence is
claimed. Target-specific DB rehearsal/activation, provider setup/live test scope
and deployment remain the respective owners' separately authorized release gates.
Recovery is disabling automation/new verification, keeping retention worker active,
and reverting code through the normal review flow; do not delete delivery attempts
or retry unknown sends. Additive database rollback is DB-owner-controlled.

Version-sensitive official references reviewed 29 October 2026:
[Vonage Verify v2](https://developer.vonage.com/en/api/verify.v2),
[Vonage signed webhooks](https://developer.vonage.com/en/getting-started/concepts/webhooks),
[Messages SMS v1](https://developer.vonage.com/en/messages/guides/sms-migration-to-messages),
[WhatsApp requirements](https://developer.vonage.com/en/messages/concepts/whatsapp),
[Resend raw webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[Resend API contract](https://github.com/resend/resend-openapi/blob/main/resend.yaml).

## Local billing startup follow-up

The user subsequently reported that their own `npm run billing:dev` launch stopped
with the generic readiness refusal after manually applying notification migrations.
Root assigned Backend a reversible local diagnostic fix and DB the current runtime
readiness contract update. No permission for agent startup/retry, private `.env`
inspection, database/provider access or new SQL/ACL execution was added or used.

The HTTP bootstrap now reports fixed startup stage and allowlisted error code,
with allowlisted failed metadata-check names for `BILLING_DB_NOT_READY`. It never
prints raw errors, driver messages, query text, stack, configuration, credentials,
catalog values or provider payloads. Billing verification reports its database,
own-account and portal stages independently and stops at the first failure.
The DB owner expands the current runtime guard to the exact 33 required tables and
explicit notification metadata/rights checks; historical pinned migration profiles
remain unchanged. Readiness checks remain mandatory and are not bypassed.

Offline diagnostics and runtime regression checks use injected metadata, synthetic
credentials and mocked provider/DB boundaries through `npm run test:startup-diagnostics`;
passed: sixty diagnostic/readiness checks and sixteen real mocked billing-runtime
tests, including first-failure staging and no provider reads after database failure.
`npm run check` and scoped `git diff --check` also passed. The DB owner records its
expanded contract tests separately. These checks do not
claim that a new connected startup passed. After root's integrated checks finish,
the next user step is **one** `npm run billing:dev` attempt; if it refuses, stop and
share only the printed safe diagnostic line. Agents must not retry that connected
operation or infer new service access from this local fix.

## Notification workspace bootstrap correction

The user later reported `Choose a workspace you belong to.` from the booking
notification-status endpoint. Backend accepted the narrowly scoped local fix from
root: notification handlers had been registered before `setupCompanyRoutes`, whose
`/api` middleware populates `req.workspace`. The registration now follows that
middleware. Session/authentication, current workspace/employee access guards and
the early raw signed webhook boundary are preserved.

`scripts/test-notification-bootstrap.mjs` executes actual `registerRoutes`, company
workspace middleware, authorization and notification handlers with only DB,
session/auth transport, storage and unrelated routes stubbed. The session fixture
deliberately never injects a workspace. Before the fix it reproduced the missing
workspace 403; after the fix twenty-nine table-driven scenarios pass across
capabilities/status/preview for personal and company workspaces, PRO behavior,
assigned/unassigned employees, viewers, cross-company/revoked/invalid access and
anonymous requests. Raw callbacks still bypass session/workspace work. Requests
use in-process streams without a listener, live database, provider calls or private
configuration. The bootstrap regression is included in `npm run test:notifications`.
No frontend, database, environment or connected-runtime change belongs to this fix.

## PRO service-reminder presentation follow-up — 30 October 2026

Backend owner `/root/reminder_backend` accepted root's TASK-032 dependency under
the user's reminder correction and AGENTS.md standing cooperation. Scope is
reversible local notification-preview authorization and its mocked regressions;
Frontend `/root/reminder_frontend` owns the appointment presentation. Environment
is the local repository with synthetic DB/auth/storage/provider boundaries only.
No private configuration, connected app/database/provider operation, real send,
schema change or deployment is authorized or performed.

`POST /api/bookings/:id/notification-preview` retains its existing request/response
contract. A PRO workspace may now request `{kind: 'reminder'}` when the booking's
service explicitly has `reminderEnabled: false`. This supports the requested
**Send reminder** action when service automation is off. PRO status previews and
reminder previews with automation enabled still return `409 automatic_mode`;
unknown automation settings fail closed. Free-workspace behavior is unchanged.
Existing authentication, workspace/employee authorization, future-confirmed
appointment eligibility, server-selected recipient and verified-phone/consent
channel restrictions remain enforced. Manual previews create links only; they
neither schedule jobs nor send messages.

The updated actual-bootstrap regression reproduced the original blanket PRO
`409` before the route fix. Passing verification on Node v24.21.0:

- `node --import tsx scripts/test-notification-bootstrap.mjs`: 34 scenarios,
  including company-PRO manual fallback, automatic/status denial and denied-user
  privacy, using real registration/workspace/access logic and in-process HTTP.
- `node --import tsx scripts/test-notification-routes.mjs`: 42 scenarios using
  real route/preferences/webhook handlers with mocked boundaries. New cases
  verify PRO manual output in en/lv/ru, no provider calls or persisted mutation,
  automatic/unknown-setting denial, non-confirmed/past appointment denial and
  preserved free behavior. The sandbox first refused loopback with `EACCES`;
  narrowly scoped loopback execution approval then allowed the passing run.
- `npm run check`: passed.

Fresh language checks cover en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es
remain deferred. No unresolved backend security finding was identified within
this narrow change. Live account, provider delivery, RLS/concurrency and deployed
behavior are not established by these mocks. Root owns integrated frontend review
and final verification. Recovery: revert only this follow-up route guard and
matching test hunks, preserving the existing notification implementation and
unrelated dirty workspace changes; no database recovery is required.
