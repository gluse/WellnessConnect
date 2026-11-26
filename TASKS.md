# Tasks

Backlog for building FitsMyTime one task at a time. Add new tasks below with a
unique ID and an unchecked checkbox. Refer to an ID when asking for work
(for example, "Build TASK-001"). Mark a task complete only after implementation
and verification.

Completed tasks are archived in [TASKS_COMPLETED.md](TASKS_COMPLETED.md).
Keep tasks awaiting testing or external setup here, and preserve task IDs when archiving.

Cross-role dependencies follow [standing cooperation authorization](AGENTS.md#cross-role-cooperation-and-standing-authorization)
and [the shared request queue](docs/agent-coordination.md). Owners may accept and
implement valid local dependencies without another user permission round; check
recorded operation/target approvals and explicit holds before escalating.

## Authentication

- [ ] **TASK-003 — Support social sign-in.** Add or complete authentication
  through Google, Facebook, Apple, and Microsoft.
  **Status:** App integration implemented; provider setup and live sign-in testing pending.
  Follow [the setup guide](docs/social-sign-in.md) to configure each provider in
  Supabase and its developer console before enabling it.

## Landing page

Completed locally: [TASK-005 — Open Search directly](TASKS_COMPLETED.md#landing-page).

## Translations
- [ ] **Make sure interface is translated in multiple languages ** All labels , button names, tooltip texts should be translated when user switch language.

  **Settings follow-up, 8 November 2026 — completed locally:** user reports that
  `/my-services/settings` remains English after changing language. Assigned
  Front End Developer `/root/settings_translation_frontend` accepted reversible
  local settings/components/resource changes and isolated mocked verification
  under standing cooperation. Root owns integration review. Preserve existing
  uncommitted settings/locale work; no backend/database, private configuration,
  connected operations or deployment. Test en/lv/ru only; ar/RTL, zh, fr, de, hi,
  ja, pt and es remain deferred. Hard-coded settings/profile/employee text now
  subscribes to language changes, including reactive save receipts; drafts and
  API contracts are preserved. Chrome passes four behavior groups and 12 en/lv/ru
  viewport cases; scoped TypeScript, account regression and env-isolated Vite
  build pass. Root reviewed code, evidence and lv-phone/ru-desktop screenshots.
  Full-project TypeScript still reports five existing native-proof errors in
  unchanged files. [Scope, evidence and recovery](docs/settings-translations-handoff.md).

## Audit

Help authorized support users answer **what happened, when, to which record, and
what evidence identifies the actor**. The separate audit database and reliable
delivery foundation are implemented; the remaining tasks below concern actual
activity coverage, a usable history screen and operational verification.
See [the audit plan](docs/audit-plan.md) for the full acceptance matrix.

**Current assignment, 7 November 2026:** The user granted full permissions to
complete pending audit work and add an understandable Audit section, explicitly
without a database backup. Root and assigned Frontend/Backend/DB owners accepted;
viewer, producer extensions and development database verification are implemented
in the existing development projects. Remaining acceptance is stated per task.
[Current authorization, scope, evidence and recovery](docs/audit-review-completion-2026-11-07.md).
Earlier dated preparation/approval statements below are historical and do not
override this new scoped authorization or prove current coverage.

**Assignment, 19 October 2026:** At the user's request, General Manager assigned
`/root/audit_backend` as Back End Developer and `/root/audit_database` as
DB Analyst/Developer for TASK-013–019. Initial work is TASK-013 repository
analysis and concrete proposals, in parallel with separate file ownership:
[event catalog](docs/audit-event-catalog.md) (backend) and
[storage proposal](docs/audit-storage-proposal.md) (database). These deliverables
are proposals; their creation does not establish implemented coverage.
The General Manager owns status and coordination documentation.

Scope is local repository review and Markdown proposals. No database access,
database-affecting implementation, service calls, deployment, or frontend changes
are authorized by the initial preparation assignment. The user selected storage
Option C, R1, P1 and recommended failure behavior on 19 October 2026. Subsequent
local backend BE-14A implementation/offline testing is assigned below; named
database targets and scoped execution remain required under
[the DB role workflow](ROLE-DB-ANALYST-DEVELOPER.md#advise-offer-options-and-wait-for-the-users-choice).
Validation is source-to-catalog review and joint contract review; implementation
will require offline backend tests and separately authorized database checks.
Recovery for this preparation is to revise/remove only the new proposal files,
preserving other sessions' changes. TASK-018 frontend implementation belongs to
the Front End Developer; hosting and rollout need CI/CD coordination.

Completed: [TASK-013 — catalog/policies, TASK-014 — storage/delivery, and TASK-018 — searchable Audit viewer](TASKS_COMPLETED.md#audit).
See the [development acceptance record](docs/audit-completion-execution.md).

- [ ] **TASK-015 — See sign-in, account and access-change history.** Capture
  sign-in/out, signup, social-auth outcomes, recovery/password changes, account
  edits, workspace switches, invitations, memberships, ownership transfers,
  account restrictions, and authorization denials. Correlate application events
  with available Supabase Auth events; never log passwords or session tokens.
  **7 November:** Durable app Auth request/observed-response producers and
  authentication/domain authorization denials are implemented and enabled in
  development; focused offline regressions pass. Native Auth log correlation
  and fully attributed account/company-access changes remain open. A missing
  provider response is unresolved, not success. [Actual coverage](docs/audit-producers-completion.md).

- [ ] **TASK-016 — See when services, bookings and business records change.** Cover services, shared addresses,
  employees, schedules, bookings, reviews, categories, storefronts, subscriptions,
  and administrative actions. Record safe field changes and server-confirmed
  outcomes, including multi-record updates, copies, deletion, and bulk operations.
  **7 November:** Actual transactional CRUD capture is applied on 26 business
  tables; synthetic live rollback/redaction/delivery/read checks pass. Generic
  trigger events show **database process; initiating person not recorded**, with
  unknown workspace and redacted changed-field indicators. Trusted human/workspace
  attribution and reviewed safe value comparisons remain open; this task is not
  fully complete. [Database evidence](docs/audit-database-completion.md).
  **One-event follow-up implemented, 25 October 2026:** `service.viewed.v1` for
  explicit found-service details opens, using selected R/90-day read retention.
  Backend/Frontend focused checks and TypeScript passed; both development DB
  extensions committed and rollback-only R90/legacy checks passed. Protected
  producer flag is enabled. Restart app and use the updated audit worker;
  no daemon was left running. Broader mutation coverage remains open.
  [Scope, owners, evidence and recovery](docs/audit-service-view-execution.md).

- [ ] **TASK-017 — See sensitive-data access and system activity.**
  Cover private/admin data access, exports, protected file access, geocoding,
  embedding generation, cleanup jobs, migrations, and operational scripts.
  Add direct-database coverage where required. Keep general browsing analytics
  separate; add payments, webhooks, and notifications as those features go live.
  **7 November:** Protected account/admin/company/booking/inbox reads wait for
  durable capture. Embedding/geocoding operations and notification/activity worker
  batches have safe request/response evidence. Protected Storage, remaining
  cleanup/maintenance/migration paths and native provider/DB source coverage remain
  open. [Producer map and limitations](docs/audit-producers-completion.md).

- [ ] **TASK-019 — Keep activity history reliable and detect delivery problems.** Test coverage,
  transaction rollback, duplicate delivery, outages, permissions, redaction,
  retention, deletion, and backup restoration. Add delivery/integrity alerts,
  review procedures, an incident runbook, and deployment/rollback instructions.
  Start with security-critical events, then complete the coverage matrix.
  **7 November:** Development migration rehearsal, capture-failure rollback,
  reader permissions, native transport/idempotence/hash checks and empty-queue
  health passed. Updated app/worker require restart. No DB backup was taken per
  the user's instruction; backup restoration was not exercised. External alert
  delivery, full source coverage, production rollout/restore acceptance remain
  open. [Execution and startup fix](docs/audit-review-completion-2026-11-07.md).

- [ ] **TASK-025 — Record location choices accurately without storing the location.**
  **7 November:** Validated privacy-safe observation endpoint and synthetic
  en/lv/ru policy/HTTP tests are prepared. Existing browser controls are not wired
  to it. Browser/guest replay and transition evidence, consent-dependent failure
  behavior, and qualified legal acceptance remain required; no consent-compliance
  or released location-audit coverage is claimed.
  **Requested, 23 October 2026:** Record when a registered user or guest permits
  current-location use in the [remembered-location flow](docs/search-location-proposal.md#location-permission-and-consent-audit).
  **Scope:** Audit the app's location-use request, observed browser permission
  result, separate choice to remember the location in a profile/cookie, and
  withdrawal/forget actions. A button click is not a permission grant; an already
  granted browser permission or restored saved location is not fresh consent.
  Mark browser observations as client-reported, not server-verified OS decisions;
  do not misclassify timeout, unavailable location or policy blocking as a user denial.
  **Evidence:** Server receipt timestamp, event/operation IDs, verified account
  actor or privacy-reviewed guest correlation, purpose, notice/consent-text
  version and language, requested storage scope, observed outcome and evidence
  source. Exclude coordinates, addresses, Google Place IDs, cookies/tokens and
  raw browser/IP data. Use reliable TASK-014 capture/delivery; define and test
  failure behavior before consent-dependent use/storage. No duplicate consent
  grants on repeat visits or cached location restoration.
  **Legal acceptance:** Obtain qualified review of the applicable lawful basis,
  browser-permission versus processing/storage consent, guest-cookie rules,
  notice, withdrawal, minimization and evidence retention/access/deletion.
  Audit logging alone does not establish compliance with all legal requirements.
  **Owners/dependencies:** Front End Developer owns notice/choice/permission UI
  and browser tests; Back End Developer owns validated capture and unit tests;
  DB Analyst owns approved storage/retention work. Extend TASK-013's catalog and
  TASK-019's verification before releasing the location feature. Current scope
  is task/design documentation only, with no new role assignment, database
  execution or deployment authorization. Location storage A was subsequently
  selected for TASK-026; permission-audit implementation/legal review remain open.
  **Validation:** Mock fresh grant, existing grant, denial, unavailable/timeout,
  unobservable revocation, explicit withdrawal, guest/account transitions,
  failed delivery/retries, spoofed reports, replay/deduplication and redaction.
  Test only en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

## Test scripts

## Notifications

- [ ] **TASK-032 — PRO notifications and appointment reminders.**
  **Implemented and verified locally, 29 October 2026; activation pending.** User approved the full
  notification/reminder plan: private customer phone/preferences, Vonage SMS-code
  verification, customer-language messages, automatic PRO booking updates and
  service reminders, and manual SMS/email/WhatsApp links without PRO. Reminder
  defaults: off, Email, 24 hours; 1–168 hours; confirmed appointments only; apply
  settings to existing future bookings; skip elapsed schedules. Customer preference
  takes priority. Delivery metadata retention is 30 days.
  Owners: Frontend `/root/notifications_frontend`, Backend
  `/root/notifications_backend`, DB `/root/notifications_db`, CI/CD
  `/root/notifications_delivery`; root coordinates integration and documentation.
  Each owner accepted local implementation and
  offline/mocked validation under the user's request and standing cooperation.
  No connected database migration, private configuration access, provider account
  setup, real verification/message send, spending or deployment is authorized.
  Preserve deployment holds. Tests cover en/lv/ru only; ar/RTL, zh, fr, de, hi,
  ja, pt and es remain deferred while translations are maintained.
  TypeScript, production build, all five mocked backend runners, offline ORM/SQL
  parity and frontend checks passed. Chrome/Firefox/WebKit passed nine interaction
  groups and 36 en/lv/ru viewport cases each; native Chrome 400% zoom and contrast
  checks passed. **Apply the reviewed schema expansion before running this app
  version, even with feature flags off.** Task remains open for separately
  authorized migration/runtime/provider activation and live verification.
  Evidence, rollout and recovery: [implementation handoff](docs/notifications-handoff.md)
  and [setup guide](docs/notifications-setup.md).
  **30 October follow-up implemented and verified locally:** PRO appointment presentation
  based on the service reminder flag: `Automatic reminders` when enabled,
  otherwise a usable `Send reminder` composer. Assigned Frontend
  `/root/reminder_frontend` and Backend `/root/reminder_backend` accepted local
  UI/preview-route changes and mocked regressions. TypeScript, server bundles,
  34 bootstrap and 42 route scenarios pass; scoped browser evidence is linked below.
  Connected-operation holds remain.
  See [coordination](docs/agent-coordination.md) and
  [follow-up evidence](docs/pro-appointment-reminder-handoff.md).

## quick find: I have x time available X date. What could I do? Propose activities near my current location.

## Subscribe for news. Receive invitations.

## Multiple time slot calendars, whn more than one employee.

## New tasks

Completed locally: [TASK-027 — Google unavailable browsing fallback](TASKS_COMPLETED.md#search-resilience).

Product proposals are maintained by the [Product Manager](ROLE-PRODUCT-MANAGER.md) in
[Product opportunities](docs/product-opportunities.md), including priorities,
cost/income scenarios, and pilot decision criteria. PM proposal IDs are separate
from delivery task IDs. These proposals are not approved implementation tasks;
create a TASK entry when work is selected. TASK-018 remains the audit viewer.

- [ ] **TASK-026 — Remember search location and show nearby services.**
  **Resilience follow-up, 23 October 2026:** TASK-027 adds an explicit
  browse-without-location choice, including during failed/pending restoration.
  Initial location prompting remains; opting out searches the existing catalog
  without a radius. [Implementation and verification](docs/google-api-fallback-handoff.md).
  **Modal follow-up, 23 October 2026:** User specifically authorized Codex `/root`
  to replace the inline location-choice block with a modal in the local frontend.
  Implemented choice/remember/privacy/retry/forget dialog and compact reopen control;
  mocked Chrome modal, saved-location and search regressions, TypeScript and frontend
  build pass. [Scope, evidence and recovery](docs/search-location-modal-handoff.md).
  No connected execution/deployment; existing release gates remain. Fresh coverage
  en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es deferred.
  **User selection, 23 October 2026:** Option A, a private location record linked
  to the registered user's profile; a 180-day cookie for guests. Default 25 km;
  request location before initial search; return up to 50 nearest services.
  **Local scope:** User authorized Codex `/root` to implement this frontend/API
  flow, prepare the additive schema/migration, and run offline/mocked tests.
  That initial approval excludes live database access/execution, real service
  calls and deployment; subsequent metadata-only approval is recorded below.
  The deployment hold remains. TASK-025 is a separate release requirement.
  **Prepared:** Owner-scoped location API/table, explicit remember choice,
  restore/change/update/forget controls, guest adoption without overwriting an
  existing account preference, account/cache isolation, safe persistence failures,
  and nearest-50 search limit. Supported translations maintained; fresh tests
  cover only en/lv/ru. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
  **Verification:** API/storage/public-search/guest regressions pass; mocked
  Chrome saved-location (7 groups), GPS (7 groups), search page (5 groups/12
  locale/viewport cases), application/fixture TypeScript and build pass. See the
  handoff for exact commands, evidence limits and existing build warnings.
  **Pending before release:** Named-target migration/grant/RLS verification and
  authorized execution; TASK-025 permission/consent audit and qualified privacy
  review; live acceptance within scoped approval. Do not mark fully complete
  from mocked evidence. See [proposal](docs/search-location-proposal.md) and
  [handoff, verification and recovery](docs/search-remembered-location-handoff.md).
  **Resumed review, 23 October 2026:** Recorded approvals reused; no additional
  application/schema changes needed by the review. Current-tree mocked storage,
  search UI (en/lv/ru) and non-incremental TypeScript checks passed. Prepared the
  [remaining-gate checklist](docs/search-location-release-checklist.md), including
  a concrete read-only preflight scope and subsequent migration/live acceptance
  plan. This local review made no live connection or deployment.
  **Approved metadata preflight, 23 October 2026:** User replied "yes" to Codex
  `/root` inspecting catalogs only on development/testing `hbkooiknruimukkhshrk`.
  Verified-TLS/read-only preflight completed: PostgreSQL 17.11, compatible users
  key, location table absent, locally configured `postgres` runtime principal,
  planned restricted roles absent. Default `service_role` privileges and the
  pending audit runtime's sixteen-table manifest need a coordinated decision.
  See [findings, evidence and next options](docs/search-location-preflight-report.md).
  No user-row reads, writes, migration, grant changes, application startup or
  deployment occurred. TASK-026 remains unchecked pending the release gates.
  **Next-step A selected and locally prepared, 23 October 2026:** User approved
  Codex `/root` to prepare coordinated location grants/runtime compatibility.
  [Package and exact hashes](docs/search-location-database-package.md) prepared:
  revoke service_role defaults, server-group-only DML/policy and an opt-in
  seventeen-table verifier after the unchanged sixteen-table audit runtime.
  New offline checks pass (155); existing audit installer (242), audit contracts
  (243) and mocked owner-scoped location API/store regression pass. Audit pins
  and applied history preserved; [owner integration queued](docs/agent-coordination.md#task-026-local-locationruntime-extension).
  No connected execution or deployment. Live SQL/constraints/grants, audit-owner
  integration, TASK-025/privacy and live acceptance remain open; task unchecked.

## Bookings

- [ ] **TASK-028 — Warn customers before booking overlapping services.**
  **User story:** As a customer, when I am about to book another service whose
  time overlaps one of my existing bookings, I want a warning so I can choose
  whether to book anyway or cancel.
  **Acceptance:** Before creating the new booking, check the customer's existing
  active bookings across services/providers for partial or full time overlap.
  Show the conflicting service name(s), date(s) and time(s), with explicit
  **Book anyway** and **Cancel** actions. Book anyway continues the booking;
  Cancel or dismissing the warning creates no booking and preserves the selected
  service/time. Do not create a booking while awaiting confirmation.
  Cancelled bookings do not trigger the warning; appointments that only touch
  at an end/start boundary do not overlap. Compare actual appointment intervals
  consistently across time zones. Show only the customer's own booking details.
  Confirmation applies to the selected service/time and must be requested again
  if that selection changes. Confirming must still respect provider availability,
  capacity and other booking rules, and retries must not create duplicates.
  **Owners/validation:** Front End Developer owns the accessible confirmation
  dialog/translations and mocked browser checks; Back End Developer owns overlap
  detection, booking confirmation handling and offline unit tests. Involve the DB
  Analyst if database changes are needed. Cover no overlap, partial/full overlap,
  multiple conflicts, boundary times, cancelled bookings, confirm/cancel/dismiss
  and retries. Language checks cover en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es
  remain deferred.
  **Status, 25 October 2026:** Added to backlog at the user's request;
  implementation and verification have not started.

## Security
Encrypt network traffic. Passwords and other sensitive information

- [ ] **TASK-029 — Separate platform administration into a protected staff app.**
  **Status, 27 October 2026:** Deferred future work at the user's request;
  implementation, assignment and verification have not started. Record the
  security/architecture recommendation now and resume when the user returns to it.
  **Direction:** Separate staff administration frontend, admin sessions and backend
  runtime; retain company/workspace management in the customer application.
  Preserve server-side authorization, introduce stronger staff authentication and
  scoped permissions, and reduce public-runtime privileges. A separate URL alone
  does not provide the intended isolation. One repository and database may remain.
  **Owners when resumed:** Front End Developer, Back End Developer, CI/CD Developer
  and DB Analyst/Developer for their respective scopes; no owners assigned now.
  **Acceptance and next action:** Follow the [future-task brief](docs/administration-separation-future-task.md)
  for rationale, proposed stages, decisions, security checks and recovery. Confirm
  the concrete design and rollout scope when resuming. This backlog entry
  authorizes recording only; existing implementation/execution holds remain.

## discounts

## compaigns

## billing

Payment decision, 23 October 2026: user selected **Option A — subscription only,
monthly billing at launch**, following the 22 October Product Manager comparison.
Market order remains Latvia → other Baltic states → UK → further markets.
See [business scenarios](docs/payment-business-plan.md),
[payment processing plan](docs/payment-processing-plan.md) and the
[monthly subscription brief](docs/monthly-subscription-brief.md).

- [ ] **TASK-033 — Let local development start when Stripe is unavailable.**
  **Status, 30 October 2026:** Backlog at the user's request; not started.
  A missing VPN connection caused the local Stripe account check to fail and
  stopped unrelated appointment/notification development. Limit graceful startup
  to the explicit development launcher, `npm run billing:dev`; preserve production
  startup behavior and security checks. Start the local app with billing marked
  unavailable when Stripe verification fails. Block checkout, portal actions and
  billing workers until verification succeeds; retain mandatory configuration,
  database, audit and authentication readiness checks. Show a clear, redacted
  diagnostic and support an explicit retry without automatic retry loops or
  fabricated billing/PRO state. Backend owns startup/runtime implementation;
  coordinate any UI or delivery changes with their owners when selected.
  **Acceptance:** Mock Stripe connectivity/access failures and recovery; confirm
  unrelated local features remain usable, billing stays blocked until verified,
  mandatory readiness failures still stop startup, and production behavior is
  unchanged. Use isolated tests; language checks only en/lv/ru if UI is affected.

- [ ] **TASK-024 — Deliver monthly workspace Pro subscriptions (Option A).**
  **Latest, 27 October:** Stripe sandbox own-account authentication and configured
  merchant match passed on the fifth separately authorized read. User selected
  local app testing and requested the existing Backend/Frontend/DB owners complete
  runtime integration; all accepted local/offline work and completed preparation. See
  [local app setup](docs/stripe-local-app-testing.md). Runtime integration is
  prepared; DB migration/readiness is verified, connected checkout acceptance remains pending. Account verification alone
  does not activate billing. Earlier connected-operation holds remain except for
  those five consumed read scopes; no migration/checkout/launch approval inferred.
  User subsequently approved the development DB migration/readiness plan for
  source `hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`; DB owner accepted.
  User then explicitly waived backup for these test-data targets; DB owner
  accepted. After user-approved identity-checked local server stop, one released
  attempt committed and verified all eight source/billing/audit migrations.
  Restricted app/capture/worker/writer read-only probes and billing DB readiness
  passed; setup memberships restored. Earlier stopped attempts are preserved in
  the DB execution plan. Backup waiver remains effective; no backup created.
  Backend did not restart the server. A later public local runtime check returned
  billing/Administration readiness false; explicit sandbox startup remains pending.
  App/Stripe/fixture/session/worker execution remains separately held.
  **Selected scope:** one monthly Pro offer per individual/company workspace;
  free customer browsing/ordinary booking, provider service payments collected
  separately. Annual billing, deposits, booking commissions, acquisition fees,
  connected-provider accounts and payouts are deferred. **User confirmed EUR 19
  per workspace/month including tax**, configurable through Administration;
  Stripe, company-owner-only billing and waiting for manual grants to expire
  are selected. See [selected decisions](docs/monthly-subscription-decisions.md).
  **Status, 26 October 2026:** Started at the user's request. Assigned Backend
  `/root/subscription_backend` and DB Analyst `/root/subscription_database`
  delivered [backend contract](docs/monthly-subscription-backend-design.md) and
  [data options](docs/monthly-subscription-data-options.md). **User selected
  choice 2 on 25 October:** separate billing/grant sources; preserve existing Pro projection.
  Local selected-policy implementation prepared: Stripe checkout/portal/signature
  adapter, protected route factories, owner/manual-wait checks, immutable
  Administration pricing, checkout conversion, reconciliation and audit modules.
  DB expansion now includes ten billing/source tables in an explicit 27-table
  profile, with forward source/destination audit validators; all eight prepared
  migration stages applied and verified on the approved development pair on 27 October.
  See [DB handoff](docs/monthly-subscription-database-handoff.md),
  [Backend handoff](docs/monthly-subscription-backend-handoff.md) and
  [coordination](docs/agent-coordination.md#task-024--monthly-pro-subscriptions).
  Explicit local runtime/bootstrap, source-aware manual writer and bounded worker
  are now prepared and verified offline. Connected DB/checkout verification,
  broader recovery and launch gates remain incomplete. Billing stays inactive.
  **Frontend delivery, 26 October 2026:** Front End Developer
  `/root/subscription_frontend` delivered the Administration amount editor,
  guarded HTTP adapters, selected manual-wait/offer-revision behavior and status
  freshness. Default runtime remains disabled; current views show unavailable.
  Backend accepted the contract. See [frontend handoff](docs/monthly-subscription-frontend-handoff.md).
  **Authority/environment:** User selected the model on 23 October and requested
  work start and choice 2 on 25 October 2026. Under standing cooperation, owners
  may implement reversible local schema/migration/backend preparation, opt-in
  ORM/runtime/transfer compatibility guards and
  offline checks for choice 2. No private configuration, connected database or
  processor access, real charges, vendor spending, runtime activation or deployment.
  The three existing owners resumed local implementation for the selected Stripe,
  owner/manual-wait and Administration pricing scope. Price changes apply to new
  subscriptions only; existing subscribers keep their agreed price (user confirmed
  26 October). Other commercial/retention gates remain.
  The user's frontend-start request authorizes the assigned Front End Developer's
  reversible local UI/translations/tests and mocked browser checks only; no
  backend/database operations, processor access, deployment or live activation.
  Root coordinates task/handoff documentation. Reuse completed work.
  **Acceptance:** Follow the brief for workspace authorization, server-selected
  monthly prices, hosted checkout/management, verified and deduplicated billing
  events, renewal/failure/cancellation/expiry, manual-grant compatibility,
  reconciliation and owner verification. Front End Developer owns frontend
  implementation/tests; Back End Developer owns backend implementation/unit
  tests; DB Analyst owns user-selected database work; CI/CD owns release work.
  Connected tests and activation require scoped authority. Language checks are
  en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
  **Validation/recovery, 26 October:** DB: 236 preserved-foundation and 190
  new offline structural/profile checks pass. Backend: 42 distinct billing cases
  pass; existing audit regression passes, rejecting 105 invalid inputs. Frontend:
  22 component/transport cases, 3 affected minimum-price checks and 33 new
  browser/zoom checks pass (en/lv/ru). Final integrated TypeScript passes after
  correction of one new invoice-ID type error. Historical evidence remains in
  the handoffs; no unchanged suite needs repeating. Production
  Vite build was not run because its plugin loads private configuration; isolated
  esbuild/Tailwind checks cover the changed interface. No connected SQL/processor/
  API/session verification; actual locks/RLS/webhooks/checkout remain unverified. Revert only
  attributable dormant preparation edits. Delivery rollback must preserve paid-through access, financial/audit
  records and handling for existing subscriptions as described in the brief.

## Mobile apps

- [ ] **TASK-034 — Build the FitsMyTime Android app.**
  **18 November 2026 — requested current-code Android rebuild v1.0.3 completed.**
  Root rebuilt the complete bundled UI and Android APK with the existing
  staging connection/package/key, version code 4, preserving prior APKs and app
  behavior. Fresh 31 routing/16 gateway Java cases and full UI, release/lint,
  signature/alignment/version/payload checks pass. Versioned APK delivered;
  no live service/DB, private credentials, hosting or deployment work.
  Phone/emulator and deferred-language limitations remain in the
  [build handoff](docs/android-capacitor-staging-2026-11-18.md).
  **18 November 2026 — service-photo routing fix v1.0.2 built; phone check pending.**
  User confirms phone login/avatar now work but service photos are missing. A
  synthetic regression reproduced the cause: `/objects/...` service-image URLs
  were treated as packaged assets. Root routed canonical supported image requests
  to existing HTTPS/server authorization; traversal and document navigation remain
  blocked. 31 Java routing and 16 gateway cases pass. No backend/storage/DB change
  or live access; previous en/lv/ru UI evidence preserved, not rerun for this
  native-only change. Android release/lint, signature/alignment, launcher/version
  and packaged UI integrity pass; user phone photo verification remains.
  See [latest image-fix handoff](docs/android-capacitor-staging-2026-11-18.md).
  **18 November 2026 — staging-access fix v1.0.1 built; phone retry required.**
  User installed the bundled app but saw no staging prompt and a generic login
  failure. Root added an explicit native staging-access launcher using fixed HTTPS
  metadata and the existing protected gateway cookie; no credential embedding,
  private-file access, backend/gateway changes or connected tests. Account-login
  errors now distinguish staging, network, blocked and unavailable responses.
  Same app ID/key, version code 2; local update APK verified. Fresh full types,
  Android release/lint, signature/payload, 38 Java policy/gateway and 21 mocked
  en/lv/ru login cases pass. Original cause remains unconfirmed; user must retry
  on phone. See [current update/evidence](docs/android-capacitor-staging-2026-11-18.md).
  **18 November 2026 — bundled Capacitor staging APK built; device acceptance open.**
  User requested the bundled option and explicitly accepted email/password for the
  first build. Root implemented a separate app packaging the existing React UI,
  same-origin HTTPS API networking and existing HttpOnly sessions, with native-only
  social controls hidden. No backend/origin/CORS/DB changes. Full UI/Android release
  build/lint, signed payload verification, full TypeScript and 22 Java routing plus
  six mocked en/lv/ru native/web login cases pass. Emulator verification stopped
  before APK installation (guest mobile-data/phone-service broken pipe after a prior boot
  timeout); live staging/physical-phone acceptance is unverified. See
  [bundled APK, scope, evidence and recovery](docs/android-capacitor-staging-2026-11-18.md).
  **17 November 2026 — personal staging APK built; runtime acceptance incomplete.**
  User specifically selected a browser-powered APK for the supplied staging HTTPS
  URL, reusing browser sign-in and allowing a browser toolbar. Root implemented a
  separate local Android shell and offline SDK build/signing pipeline; existing
  Capacitor proof remains unchanged. Signature, packaging, alignment, launcher,
  SDK and en/lv/ru resource checks pass. Emulator boot is blocked by free disk space
  (about 7.4 GB required, about 3 GB available); physical-phone/live-flow checks
  remain unverified. See [APK, installation and approval handoff](docs/android-browser-staging-2026-11-17.md).
  No cloud publication, connected database/service tests or private credential
  access. Earlier bundled-native acceptance remains open; this selected personal
  staging delivery does not establish completion of all acceptance criteria below.
  **Status, 30 October 2026:** Added to backlog at the user's request;
  implementation, owner assignment and verification have not started.
  **Scope:** Evaluate Capacitor to reuse the existing React/Vite interface,
  then record the selected approach and build an installable Android app.
  Reuse the existing hosted Express API and database; a separate mobile backend
  is not required by this task. Coordinate shared mobile API/authentication work
  with TASK-035 so both apps use a consistent contract.
  **Acceptance:** Configure the API endpoint and secure session/origin handling;
  verify login/logout, supported social sign-in and return links, service search,
  maps/location permissions, booking and relevant provider flows. Handle Android
  back navigation, keyboards, safe areas, denied permissions, session expiry and
  network failure. Verify accessibility and existing web behavior. Produce a
  reproducible installable test build, emulator and physical-device evidence,
  and documented signing/release steps; prepare Google Play artifacts if selected.
  **Owners/dependencies when started:** Front End Developer owns app/client work;
  Back End Developer owns API/auth changes; CI/CD owns build/signing/release
  tooling; DB Analyst owns any database dependencies. Confirm app identity,
  release scope and target environment; review current store requirements,
  privacy declarations and TASK-024 subscription/payment compatibility before
  distribution. Keep server secrets out of the app.
  **Verification/limits:** Test en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es
  remain deferred while supported translations are maintained. Begin with isolated
  mocked tests; connected tests that persist sessions/data need scoped authority.
  This entry records future work only; account spending, credential operations,
  connected execution, deployment and store publishing need scoped authorization.

- [ ] **TASK-035 — Build the FitsMyTime iOS app for the Apple App Store.**
  **18 November 2026 — requested; local readiness reviewed, Mac executor needed.**
  User requested an iOS build. Root confirmed the Windows environment lacks
  Xcode/xcrun/Swift and the existing iOS tree is the synthetic proof. Shared React
  UI assets are prepared for transfer; no installable IPA has been built. An iOS
  native session/API/gateway/image port is required; Android's HTTPS WebView
  routing cannot be assumed to work in WKWebView. User was asked about Mac/Xcode
  or remote Mac access; user confirmed no current Mac access. Native build awaits
  a Mac executor or selected/authorized cloud build route. Safari's Home Screen
  web app is the immediate website option. No credentials, signing/provisioning,
  cloud/spending, connected tests or deployment. See
  [readiness, remaining work and recovery](docs/ios-staging-build-readiness-2026-11-18.md).
  **Status, 30 October 2026:** Added to backlog at the user's request;
  implementation, owner assignment and verification have not started.
  **Scope:** Evaluate sharing the React/Vite interface and Capacitor foundation
  with TASK-034, record the selected approach, and build an iOS app prepared for
  App Store submission. Reuse the existing hosted Express API and database and
  coordinate shared API/authentication changes with TASK-034.
  **Acceptance:** Verify login/logout, supported social sign-in and return links,
  service search, maps/location permissions, booking and relevant provider flows.
  Handle iOS navigation, keyboards, safe areas, denied permissions, session expiry
  and network failure. Verify accessibility and existing web behavior. Produce
  a reproducible iOS build, simulator and physical-iPhone evidence, and documented
  signing/release steps. Prepare App Store metadata, screenshots and privacy
  declarations; use TestFlight and submit only under scoped release authorization.
  **Owners/dependencies when started:** Front End Developer owns app/client work;
  Back End Developer owns API/auth changes; CI/CD owns macOS/Xcode build access,
  signing and delivery; DB Analyst owns any database dependencies. Confirm app
  identity, supported devices and target environment. Review current Apple
  requirements for app functionality, sign-in, account deletion, privacy and
  TASK-024 subscription/payment compatibility; resolve applicable product choices
  before release. Keep server secrets out of the app.
  **Verification/limits:** Test en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es
  remain deferred while supported translations are maintained. Begin with isolated
  mocked tests; connected tests that persist sessions/data need scoped authority.
  This entry records future work only; account spending, credential operations,
  connected execution, deployment and store publishing need scoped authorization.

## Reports

- [ ] **TASK-038 — Add workspace appointment reports.**
  **Status, 8 November 2026:** Revenue reports are implemented and verified
  locally, with separate Pending totals, company employee filters, named-service
  grouping, compact mobile summaries and List/Graph views. See the
  [report handoff](docs/service-reports-handoff.md),
  [employee/service grouping](docs/reports-employee-services-handoff.md),
  [mobile summaries](docs/reports-mobile-summary-handoff.md) and
  [graphs](docs/reports-graph-view-handoff.md).
  The user also requested Service view statistics, listed for all Reports users
  and executable only with active workspace Pro. Local frontend/backend work and
  offline verification are complete under the
  [current integration handoff](docs/service-view-statistics-handoff.md).
  Existing 90-day retained service-detail observations are reused; no database,
  runtime activation or deployment changes are authorized by this report task.
  **Scope:** Provide a Reports destination for the information removed from
  `/my-services/appointments`: Total bookings, Awaiting approval and Revenue.
  Define reporting periods, revenue/status calculation rules and role visibility
  when this task starts. Keep results scoped to the selected workspace and use
  localized labels, numbers and currency. Coordinate backend/database work with
  the respective owners if needed. Validate en/lv/ru with isolated mocks first;
  ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. This placeholder does not
  authorize connected execution, deployment or reporting-policy changes.

## SMS
## Terms of Use
## AWS hosting

**9 November update — published:** user approved delete-first replacement after
the environment check. Root verified credentials/settings and encrypted recovery,
deleted old disabled staging, then created `fitsmytime-staging-20261109` in
eu-north-1 micro/one-node (USD10/month base). Exact imageapp.4/deployment1 reached
ACTIVE/RUNNING; old service absence and full expected specification verified.
Current38-gate preflight and separate fresh five-principal capacity check passed
once each. Full TypeScript, isolated Linux build/artifacts/gateway security,
HTTPS/signed-session and live en/lv/ru Chrome guest checks passed. User reports
fixing redirects by adding the new staging Redirect URLs in Supabase; no fresh
agent account/OAuth login claimed. Current audit worker delivered13 events with
no new failures/quarantine at final observation;234 inherited quarantines remain
a separate unresolved warning. Existing activation/public-release holds remain.
See [release evidence, URL, limits and recovery](docs/aws-publish-2026-11-09.md).
Current tests en/lv/ru only; remaining languages/RTL deferred.

- [x] **TASK-036 — Deploy a restricted AWS staging site.** User requested AWS
  publishing on 31 October 2026 and selected restricted staging with High guidance.
  Root owns infrastructure preparation; Backend and DB owners accepted and
  completed repository-only compatibility review through live agent tools.
  AWS MCP read-only connectivity, Free-plan state and Stockholm service/pricing
  checks pass. User selected Lightsail micro/one node at USD 10/month base,
  accepted deployment-spec credential storage and approved existing development
  source/audit projects after owner preflight. Owner preflight passed all four
  principals/TLS and all 14 current 33-table gates; isolated frontend build and
  TypeScript, audit tests/bundle and proxy security/concurrent-health tests pass.
  Supporting private S3/ECR, scoped builder role, encrypted logs/KMS and CodeBuild
  project exist. Build start failed once because all CodeBuild compute quotas
  are zero; no build ran and no Lightsail service exists. User approved the
  one-small-build quota request including a possible Support case. Submitted
  once for Linux/Small in Stockholm; AWS status CASE_OPENED, Support case
  179346682900519. Await effective capacity
  before any build retry; no plan upgrade or additional quota requested.
  **6November local-PC route selected:** Docker Desktop4.98/CLI29.9 and WSL3.0.3
  installed successfully; user restarted and Linux engine verified.
  Production Vite/DB-contract bundling fixes and integrated regressions pass.
  Reviewed snapshot built locally; isolated Linux proxy/artifact checks pass.
  Assigned DB owner `/root/aws_pc_db_release` passed current41-table/all34-gate
  connected preflight once, with zero competing connections observed; no writes.
  Earlier33-table evidence is historical. User approved same-profile renewal;
  identity verified. Local image was pushed to native Lightsail registry as
  `:fitsmytime-staging.app.1`; exact deployment1 ACTIVE/RUNNING on micro/scale1.
  Live HTTPS/password-gateway/sanitized-readiness checks pass, audit worker
  healthy with no source/destination failures. Assigned frontend owner passed
  live en/lv/ru guest/login smoke at320/390/1280 and visual phone/desktop review.
  Staging is published; no successful application-account login/email/OAuth
  claim. Supabase's exact staging callback allowlist remains unverified. User
  selected unused builder cleanup; CodeBuild/S3/ECR/logs/dedicated role deleted
  and absence verified. Build-log KMS key PendingDeletion for13November2026;
  running staging and native registry preserved, post-cleanup checks pass. See
  [PC build handoff](docs/aws-staging-pc-build-handoff.md) and
  [DB release evidence](docs/aws-staging-pc-db-handoff.md) and
  [live frontend acceptance](docs/aws-staging-pc-live-frontend-handoff.md).
  **Gateway follow-up:** user authorized publishing the staging credential fix;
  signed secure1hour gateway session now deployed as version4 ACTIVE. Live
  cookie-after-app401/tamper checks and exactly1prompt Chrome en/lv/ru guest
  smoke pass; app/audit config preserved from version2. Local browser expiry/
  repeatedPOST401 proof passes. See
  [session release](docs/aws-staging-session-release.md).
  See [deployment preparation and scope](docs/aws-staging-deployment.md).
  Public release/privacy holds remain; tests cover en/lv/ru when performed,
  with other supported languages/RTL deferred.

- [ ] **TASK-037 — Group appointments, private messages and reschedule agreements.**
  User approved the [v2 design](docs/group-appointments-design-v2.md) and
  [v3 notes/messaging revision](docs/group-appointments-design-v3.md) for local
  implementation on 2 November 2026. Frontend, Backend and DB owners assigned;
  [approval/scope and integrated handoff](docs/group-appointments-implementation-handoff.md).
  One expandable group event; individual/event actions; retained customer/provider
  messages with private PRO broadcasts; reschedule requests with explicit
  keep-original/cancel-on-decline outcomes. Independent responses and no automatic
  cancellation on silence are user-selected. User selected 12-month message history
  after the later closure/last-message time, with unresolved bookings retained.
  **Implemented and verified locally:** final Chrome/Firefox/WebKit en/lv/ru UI
  suites, native 400% customer-flow zoom, type/build and offline backend/schema/
  retention checks pass. Prepared database migrations/runtime activation are
  reviewed. User approved execution against development project
  `hbkooiknruimukkhshrk` and read-only verification; assigned DB owner is executing
  bounded preflight/activation with stop-on-first-failure. Named-target read-only
  preflight passed; no DDL/grants ran at that stage. A recoverable backup could
  not be verified; user explicitly selected
  applying 0016/0017 without a verified backup for this exact project. DB owner
  applied both scripts once successfully: six timestamp backfills and private
  runtime grants/policies. All 20 restricted-role live read-only readiness checks
  pass on the 35-table schema; root verified the execution receipt. No app startup,
  live workflow writes, purge or deployment. Remains unchecked for user/live
  workflow acceptance.

## Service currencies

- [x] **TASK-039 — Store and display service and booking currencies.**
  **Completed, 5 November 2026:** Explicit service/booking currencies, country
  suggestions, exact money, price/advance quote review, shared formatting and safe
  mixed-currency summaries/sorting implemented. Root and assigned Frontend-money,
  Backend and DB owners reviewed integrated contracts. TypeScript/fixture types,
  isolated builds, affected offline regressions and Chrome/Firefox/WebKit en/lv/ru
  currency checks pass; existing Chrome booking/address regression passes.
  User explicitly approved proceeding without a verified backup for one migration
  0020 application to development `hbkooiknruimukkhshrk`; assigned DB executor
  `/root/currency_db` applied it once and verified postflight. All 27 services and
  32 bookings now have EUR; counts and exact monetary fingerprints unchanged.
  All 28 runtime readiness gates pass; root verified the receipt. Prior failed/
  stopped preflight receipts and approvals are preserved in the
  [scope, evidence and recovery handoff](docs/currency-management-handoff.md).
  No app/worker startup, live workflow/session tests or deployment occurred.
  Customer FX estimates and ar/RTL, zh, fr, de, hi, ja, pt and es verification remain
  deferred. Existing EUR subscription policy is preserved. No remaining approved
  code/migration work; use the updated compatible app on subsequent startup.

## Reservation messages

- [x] **TASK-040 — Save reservation notes as the initial conversation message.**
  **Status, 4 November 2026:** User approved implementation of
  [the plan](docs/reservation-initial-message-plan.md). Frontend, Backend and DB
  contract-review owners accepted the scoped local work; root completed delegated
  implementation and integrated verification. Both application owners returned
  final review without blockers.
  User selected ignoring existing notes ("you can delete / ignore current notes").
  One optional message field creates a customer message atomically with its
  reservation; new bookings do not store notes. Messages replaces separate notes
  controls and historical notes are ignored without migration or deletion.
  Authorized read-only providers can read messages without a composer. Existing
  backend permissions, capacity/reminder semantics and message retention remain.
  Three-browser en/lv/ru flow checks, backend/capacity/collaboration/API/retention
  checks, affected Chrome regressions, TypeScript and isolated build pass; see
  [implementation, evidence, limits and recovery](docs/reservation-initial-message-handoff.md).
  Local files and offline/mocked tests only; no connected
  writes, private config or deployment. Test en/lv/ru; other locales/RTL deferred.
  See [owner scope and progress](docs/agent-coordination.md#reservation-initial-message--4-november-2026).

- [x] **TASK-041 — Collapse booking-message privacy details and link the policy.**
  **Status, 4 November 2026:** User approved the presentation plan with “go ahead
  implement”, specifically authorizing root's local frontend work. Conversation
  and initial-message forms now share a collapsed privacy/retention disclosure;
  the generated English policy has a dedicated booking-message section, with
  permanent links in mobile and account menus. Exact access/retention meaning and
  drafts are preserved. Three-browser en/lv/ru form checks, Chrome navigation and
  policy checks, TypeScript and isolated build passed. Supported translations
  maintained; ar/RTL, zh, fr, de, hi, ja, pt and es testing deferred. No connected
  operations, private configuration, database changes or deployment. See
  [scope, verification, screenshots and recovery](docs/booking-message-privacy-handoff.md).

## Header messages and notifications

- [ ] **TASK-042 — Add wishlists and message/notification header controls.**
  **Status, 4 November 2026:** User approved the expanded wishlist plan;
  local implementation and offline/mocked verification completed. Two authenticated header
  buttons with red unread badges, linked conversation lists and grouped activity
  notifications. Durable message receipts, private wishlist APIs/hearts/page and
  grouped view/wishlist activity are implemented. See
  [behavior, contracts, phases, decisions and acceptance](docs/header-messages-notifications-plan.md).
  Frontend `/root/wishlist_frontend`, Backend `/root/wishlist_backend_plan` and DB
  `/root/wishlist_database_plan` accepted local scopes. One private wishlist per
  account, image-overlay hearts, guest sign-in/manual save and retained unavailable
  entries. Selected daily UTC view counts exclude provider/team views; activity,
  notifications and dedup retain 90 days. See [implementation status](docs/wishlist-handoff.md);
  existing message privacy/retention and connected-operation/deployment holds stay.
  Initial implementation used local changes and offline/mocked checks; connected
  activation is recorded below. Test en/lv/ru;
  ar/RTL, zh, fr, de, hi, ja, pt and es deferred.
  Chrome/Firefox/WebKit wishlist flows, native Chrome 400% zoom, affected Chrome
  regressions, TypeScript, isolated build and backend/DB offline checks pass.
  Five-table expansion/runtime SQL 0018/0019 is now **applied and verified** on the
  named development project; the compatible runtime expects 40 tables. Task remains
  unchecked for user/live workflow acceptance; no deployment occurred.
  **Connected approval:** user subsequently authorized DB executor
  `/root/wishlist_database_plan` to activate TASK-042 on development project
  `hbkooiknruimukkhshrk`, checking backup/recovery first and stopping on any failure.
  Owner accepted target/schema/recovery preflight, conditional once-only 0018/0019
  application and restricted read-only postflight. Earlier no-backup exceptions
  do not transfer. No app/worker startup, flag/configuration edits, live workflow
  writes or deployment included. See [authorization and actual status](docs/wishlist-handoff.md#connected-authorization--4-november-2026).
  **Preflight result:** exact-target TLS/read-only PostgreSQL 17 and all 20 current
  35-table runtime checks passed; no new tables and zero other app connections at
  inspection. Stopped at unverified current backup/recovery, with 0018/0019 both
  unattempted. No DDL/grants or retry. Await verified recovery evidence or explicit
  TASK-042 no-backup selection; earlier waivers remain out of scope.
  **Recovery decision resolved:** user explicitly selected proceeding with
  0018/0019 without a verified backup on this development project, retaining
  stop-on-failure. Routed to the same DB executor for fresh guards, once-only
  application and restricted postflight. No verified backup is claimed; actual
  migration results pending. Historical preflight receipt remains unchanged.
  **Applied and verified:** DB executor ran the reviewed single attempt: fresh
  35-table/identity/zero-app-connection guards passed, pinned 0018 then 0019 each
  committed once, all 26 restricted 40-table postflight checks passed. Exit 0,
  no retry or uncertain COMMIT. Root independently verified receipt/hash/waiver
  evidence without connecting. No backup claimed, app/worker/configuration change,
  workflow writes or deployment. Do not reapply or remove activation receipts.
  **5 November badge fix:** header feeds now use global own-customer plus selected
  provider-workspace counts on every route, with deduplication and explicit
  conversation targets. Three-browser en/lv/ru regression, Backend 80+16 scenarios,
  TypeScript and isolated build pass. No schema or connected changes required.

- [x] **TASK-043 — Load additional service search results on scroll.**
  **Assignment, 5 November 2026:** user requested infinite scrolling and review of
  the fixed 50-result limit. Frontend `/root/wishlist_frontend` and Backend
  `/root/wishlist_backend_plan` accepted local implementation; DB
  `/root/wishlist_database_plan` accepted local query review. Root coordinates
  integration and specifically delegated isolated pagination browser checks.
  Start with 24 services/page (maximum 50/request), server-global ordering,
  opaque continuation, automatic scroll loading and accessible manual retry.
  **Status:** local implementation and verification complete; all owners accepted.
  New Backend 48 scenario groups, DB 31 SQL compilation checks, three-browser
  pagination eight-group checks (en/lv/ru), affected Search/wishlist/booking
  regressions, TypeScript and isolated frontend/backend builds passed. No schema
  changes or connected operations occurred; startup/deployment remain separate.
  See [scope, contract and verification](docs/search-pagination-handoff.md).
  Fresh testing en/lv/ru only; other languages and RTL remain deferred.

- [x] **TASK-044 — Prefill service currency from workspace and location settings.**
  **Accepted, 5 November 2026:** User approved suggested workspace pricing defaults.
  Saved/manual service choice wins, then configured location override, workspace
  currency, service country and confirmed business country; unresolved cases ask.
  Existing workspaces initially EUR; existing service/booking amounts and currencies
  preserved. Root and assigned Frontend/Backend/DB owners accepted local code,
  schema/migration preparation and mocked checks. See
  [scope, contracts, evidence and recovery](docs/currency-defaults-handoff.md).
  **6 November: implemented and verified locally.** Types/build, owner offline
  tests and Chrome/Firefox/WebKit en/lv/ru defaults/settings checks pass, plus
  existing Chrome currency/account/address/booking regressions. User subsequently
  approved migration0021 once on development `hbkooiknruimukkhshrk` without a
  verified backup, stop on first failure. DB owner committed and verified once:
  14 personal/4 company EUR defaults, existing counts and money/currency/address
  fingerprints preserved, all 34 readiness gates pass. Root reviewed the execution
  receipt and preserved TASK-039 receipt hashes. No retry/startup/workflow writes/
  deployment; no outstanding owner dependency.
  Tests en/lv/ru only; other locales/RTL deferred.

## Gift cards

- [ ] **TASK-045 — Add provider-specific and FitsMyTime-wide gift cards.**
  **Planning, 6 November 2026:** User selected both card scopes, online purchases
  only and money balances for both. See [the implementation plan](docs/gift-cards-plan.md).
  Proposed delivery: confirm issuer/processor eligibility and commercial rules;
  build exact balance/purchase/redemption records; integrate booking reservations
  and reversals; add delivery/customer/provider/operator UI; implement approved
  provider settlement, refunds, reconciliation and verification. Platform-wide
  acceptance is limited to participating eligible providers. Stripe subscription
  selection does not establish gift-card approval. Issuer/seller, funds arrangement,
  currencies/limits, expiry/refunds, participation/fees and retention remain open.
  No implementing role assignment or code, connected-operation, spending or launch
  authority is granted by this planning request. Test en/lv/ru only; other supported
  languages/RTL remain deferred. Next: feasibility and policy decisions, then scoped
  owner assignment/local implementation approval.

## Account deletion and history retention

- [ ] **TASK-046 — Add self-service account deletion with a history-retention policy.**
  **Backlog, 6 November 2026:** User requested account deletion for customers and
  providers, including consideration of previous bookings/appointments needed for
  reporting or legal obligations. Define and approve the retention policy before
  implementing deletion; the discussed durations are candidates, not selected policy.
  - Inventory personal data and dependencies across Auth, profiles, customer and
    provider bookings, messages/notes, reviews, payments/refunds, subscriptions,
    company ownership/memberships, files, notifications, audit records, external
    processors, exports and backups. Identify FitsMyTime's and providers' respective
    responsibilities, applicable countries and any health-data requirements.
  - Specify each record category's purpose/legal basis, minimum necessary fields,
    retention duration and start event, access permissions, deletion/anonymization
    method and reviewed legal-hold exceptions. Confirm accounting classifications
    and claims periods with an accountant/legal adviser. For Latvian operations,
    assess [Accounting Law §28](https://likumi.lv/ta/id/324249-gramatvedibas-likums)
    (other supporting documents: at least five years; accounting registers: ten
    years) and [Commercial Law §406](https://likumi.lv/ta/id/5490-komerclikums)
    (ordinary commercial claims: three years unless another period applies).
    These do not establish blanket retention for all booking details; confirm
    applicability, clock calculation and exceptions. Account deletion must not
    automatically restart retention clocks.
  - Preserve reporting through genuinely anonymous aggregates where feasible;
    replacing names with linkable IDs is not anonymization. Reconcile deletion
    with TASK-037's selected 12-month message history and the existing
    [90/365-day audit classes](docs/audit-event-catalog.md#proposed-retention-and-safe-field-profiles)
    without silently extending or overriding those policies. Decide whether earlier
    erasure is required and what evidence may remain under a documented basis.
  - Add Account settings deletion with recent identity verification, clear
    consequences/retention disclosure and explicit confirmation. Define handling
    of future bookings, open disputes/refunds, subscriptions and company ownership;
    retain only justified evidence with restricted access. Remove sign-in access,
    revoke sessions and clear client caches. Handle duplicate requests and partial
    failures truthfully, with recoverable progress across local/external operations.
  - Define automatic expiry, processor deletion propagation, backup expiry and
    restore safeguards so erased/expired data does not reappear. Update privacy
    disclosures and deletion completion/status messages to explain what remains,
    why and until when, consistent with
    [GDPR Articles 5 and 17](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679).
  **Owners when assigned:** Frontend (account flow), Backend (identity/deletion
  orchestration), DB (retention/integrity/migrations), CI/CD (backup/processor
  operations). Acceptance includes mocked authorization, reauthentication,
  expiry/holds, retained-history/report integrity, session/cache revocation,
  duplicate/partial-failure recovery and responsive/accessibility checks.
  Test en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
  This entry records backlog scope only; no policy selection, implementation
  assignment, real account/data deletion, connected operation or deployment is
  authorized. Next: map records and propose the concrete retention/deletion policy
  for user selection before scoped implementation.

## Worldwide web and mobile release

- [ ] **TASK-047 — Deliver a publishable worldwide app with a defined 24/7 SLA.**
  **8 November 2026:** User established the active goal: scalable worldwide
  operation, continuous availability and one shared codebase for website,
  Apple App Store and Google Play. Repository readiness review and
  [release plan](docs/worldwide-release-plan.md) prepared. User selected **99.9%
  monthly availability**, **EUR 100–300/month operating budget** (excluding
  development/store fees), and **worldwide-ready architecture with initial
  Latvia/EU launch**. These are planning requirements, not provisioning/spending
  approval or an established SLA. Frontend/Backend/DB/CI reviews completed;
  stale booking-capacity fixture and missing-worker artifact gate repaired and
  verified. User selected **React/Vite + Capacitor local proof**, with explicit
  API endpoint, secure native sessions and browser sign-in returns against
  mocked services. Frontend/Backend/CI owners accepted separate local proof
  implementation/build scopes; no connected operations/deployment/store release.
  Reuse TASK-034/035 for mobile and existing authentication, privacy, deletion,
  billing and operational work; do not duplicate their implementation records.
  Acceptance requires selected measurable service objectives/terms, costed
  production design, scale/failure/recovery evidence, secure shared mobile/API
  integration, signed device-verified apps, applicable store/privacy gates and
  authorized release/post-release verification. Current staging evidence does
  not establish production readiness. Role assignments and connected operations
  follow AGENTS.md; existing holds remain. Test only en/lv/ru; other supported
  languages/RTL remain deferred. Next: implement/verify selected local proof;
  costed production/recovery and full-app integration acceptance remain open.

## Service photo galleries

- [x] **TASK-048 — Add Pro service photo galleries.**
  **Implemented and development DB verified, 8 November 2026.** User requested multiple service pictures for
  Pro users, meaningful file-size limits and left/right swiping in service views.
  Assigned Frontend, Backend and DB owners accepted local implementation and
  offline/mocked validation under standing cooperation. Existing 10 MiB/image
  limit is retained; Pro galleries allow ten pictures, other plans one.
  Gallery/editor/API/schema checks, Chrome en/lv/ru phone/desktop checks, isolated
  builds and targeted app/server types pass. Full-project types still fail on five
  unrelated native-proof errors; Firefox/WebKit tooling is unavailable. User
  explicitly approved TASK-048 development execution without a DB backup. Backend
  stopped verified project app/audit trees; assigned DB owner committed 0022 once:
  all original fields/counts of 28 services/36 bookings preserved, 22 existing
  covers backfilled, all 36 readiness gates passed. Root independently reviewed
  the sanitized receipt/digest. App and audit worker remain stopped; restart is
  next. No audit delivery, backup, ACL change, deployment or live upload/UI flow.
  [Scope, contracts, evidence and recovery](docs/service-photos-handoff.md).
  Testing covers en/lv/ru; other supported languages/RTL remain deferred.

## Custom service reminder message

- [x] **TASK-049 — Customize service reminders with a live preview.**
  **Implemented and development DB verified, 8 November 2026.** When automatic service reminders are enabled,
  allow an optional plain text message and representative live preview. Preserve
  the required appointment details; blank text retains the existing default.
  Assigned Frontend `/root/custom_reminder_frontend`, Backend
  `/root/custom_reminder_backend` and DB `/root/custom_reminder_db` accepted
  reversible local implementation and offline/mocked checks under standing
  cooperation. Root coordinates the contract and integrated review. Initial work
  was offline only. Scoped types, Chrome 5 behavior groups/12 en/lv/ru
  viewport cases, backend storage/rendering/worker/API/startup checks and offline
  SQL/executor checks pass. Full-project types retain five baseline native errors;
  Firefox/WebKit unavailable.
  User subsequently approved the reviewed development migration and explicitly
  waived TASK-049 DB backup. Named DB executor `/root/custom_reminder_db` accepted
  the source-only one-shot migration/configuration-read/pre/post-check scope.
  Backend stopped the verified local app/watch tree, preserving its terminal;
  DB owner committed 0023 once and passed baseline/new-message readiness. All
  original fields/counts of 28 services/36 bookings were preserved; new messages
  are empty and the audit trigger remains enabled. Root independently reviewed
  the sanitized receipt and SQL digest. No backup, retry, startup, real sends,
  audit delivery or deployment. Restart the updated app to use the new editor.
  Test en/lv/ru only; other supported languages and RTL remain deferred.
  [Integrated evidence and activation handoff](docs/custom-service-reminder-handoff.md).

- [x] **TASK-050 — Redesign account tabs and relocate provider settings.**
  **Implemented locally, 8 November 2026:** User assigned Frontend `/root` to
  make account sections real tabs, enable phone verification beside the input
  without a separate save, add a read-only Role tab with provider activation,
  and move pricing defaults/saved addresses to My Services settings. Existing
  APIs, permissions, draft isolation and legacy destinations are retained.
  Backend accepted/completed the two exact authentication return destinations.
  Chrome: 11 behavior groups/66 en/lv/ru viewport cases plus enlarged text and
  light/dark contrast checks pass; affected TypeScript, complete frontend bundle,
  account/password/address/pricing/notification regressions and 45 auth-return
  cases pass. Full-project TypeScript and the broad provider regression have
  independently reproduced baseline failures. No connected account/SMS/database
  execution or deployment. Other supported language/RTL verification is deferred.
  **Follow-up:** Tab labels are General, Contact, Role and Password. Calendar and
  My Services navigation appears only for `currentRole === "provider"` on desktop
  and mobile, including provider menu/workspace entries. Role changes dismiss
  stale provider navigation; activation reveals it immediately. Chrome passes
  4 focused behavior groups/24 en/lv/ru viewport cases; affected TypeScript passes.
  **Provider route guard:** `/my-services` and every descendant now require an
  authenticated exact `provider` role before mounting provider content. Buyers
  go to `/account#role`; signed-out/auth-failed users go to login. Cached auth
  errors cannot cause a login redirect loop. Chrome passes 6 behavior groups/
  42 en/lv/ru denied-route cases; scoped TypeScript and login regressions pass.
  [Implementation, approvals, evidence and limits](docs/account-tabs-redesign-handoff.md).

- [x] **TASK-051 — Show service-provider status in App users.**
  **Implemented and verified locally, 8 November 2026.** Added a Service provider
  column in `/administration` → App users, showing localized Yes/No/Unknown.
  Frontend executor `/root` accepts the specific local page/translation/test scope;
  assigned Backend `/root/admin_provider_backend` owns the protected API/DTO/query
  dependency under standing cooperation. Use the authoritative account role,
  independently of Pro, company membership or existing service count; missing roles
  show Unknown. Scope: reversible local files and offline/mocked checks only.
  No connected database/service/configuration access, startup or deployment.
  Chrome passes three behavior groups/nine en/lv/ru viewport cases; affected
  frontend/backend types, bundles and mocked regressions pass. Full-project types
  reproduce five existing native-proof errors; no administration diagnostics.
  Tests: en/lv/ru; ar/RTL, zh/fr/de/hi/ja/pt/es remain deferred.
  [Scope and evidence](docs/admin-provider-status-handoff.md).

## Supabase to AWS migration

**Planning only, 9 November 2026.** User requested a smooth future migration and
validation of Gemini's suggestions. Keep existing Drizzle/`pg` access; prepare
private S3 media and managed authentication, with Cognito recommended for
evaluation. FitsMyTime retains application authorization. Preserve Microsoft and
email/password alongside Google, Apple and Facebook. Existing restricted AWS
staging is already recorded under TASK-036; it still depends on Supabase.

All tasks below are unstarted future backlog. Owners are proposed role owners,
not new agent assignments or implementation acceptances. No connected access,
credential reads, resource creation, spending, migration, deployment or destructive
retirement is authorized by this plan. Existing holds remain. See the
[migration plan](docs/supabase-to-aws-migration-plan.md) for evidence, dependencies,
acceptance, approvals, recovery and sources. Test en/lv/ru only; ar/RTL,
zh/fr/de/hi/ja/pt/es remain deferred while translations are maintained.

- [ ] **TASK-052 — Inventory Supabase dependencies and migration objectives.**
  Backend/DB/CI/CD, with Frontend contract review. Catalogue all application,
  audit, identity, media, job and script dependencies; prepare a complete object
  manifest and agree budget, downtime, RPO/RTO and user impact.
- [ ] **TASK-053 — Isolate Auth and Storage provider integrations.**
  Backend, Frontend and DB within their scopes; depends on TASK-052.
  Preserve working Supabase adapters, stable application identity and API behavior;
  define portable identity and browser upload contracts with mocked verification.
- [ ] **TASK-054 — Make PostgreSQL schema, security and jobs reproducible.**
  DB + Backend; depends on TASK-052. Reconcile Drizzle filters, migrations and
  readiness; prepare restricted roles, extensions/jobs and audit target profiles.
  Prove compatibility without weakening TLS, tenant isolation or audit controls.
- [ ] **TASK-055 — Prepare and verify private S3 media storage.**
  Backend/CI/CD + Frontend; depends on TASK-053, and TASK-059 for resources.
  Preserve object references, authorized reads, gallery rules, bounded validated
  uploads and overwrite protection; prepare monitoring and recovery policies.
- [ ] **TASK-056 — Copy, reconcile and switch existing media to S3.**
  CI/CD/Backend, DB for reference changes, Frontend for acceptance; depends on
  TASK-055 and approved transfer scope. Verify object manifests/checksums and
  final upload deltas; retain recoverable source media through the rollback window.
- [ ] **TASK-057 — Select managed authentication and design identity migration.**
  Backend/DB/CI/CD + Frontend; depends on TASK-052/053. Evaluate Cognito; preserve
  existing user IDs through verified provider-subject mapping, including social,
  password and invited users. Choose compatible hash import, first-login
  migration or reset, with safe linking, session and rollback rules.
- [ ] **TASK-058 — Implement managed sign-in and migrate identities in stages.**
  Backend/Frontend/CI/CD, DB for mappings; depends on TASK-057/059.
  Preserve all sign-in, recovery, invitation, directory and audit flows; verify
  stable identity and application permissions before switching off legacy Auth.
- [ ] **TASK-059 — Select, cost and prepare the AWS data platform.**
  CI/CD + DB/Backend; depends on TASK-052. Confirm eu-north-1, current plan,
  eligibility and quotas; compare RDS PostgreSQL/Aurora, preserve audit isolation,
  cost overlap/networking and prepare secure connectivity, backups and alerts.
- [ ] **TASK-060 — Rehearse application and audit database migration.**
  DB/CI/CD + Backend; depends on TASK-054/059, and TASK-056/058 for final rehearsal.
  Verify full-object export/restore, data/sequence/permission parity, jobs,
  outbox continuity and measured downtime; demonstrate restore and reconciliation.
- [ ] **TASK-061 — Rehearse the complete application and recovery procedure.**
  Backend/Frontend/DB/CI/CD; depends on TASK-056/058/060. Verify features, security,
  workers, performance and rollback before/after new target writes. Keep payment,
  messaging and privacy activation within their separately accepted scope.
- [ ] **TASK-062 — Execute an approved, observable migration cutover.**
  CI/CD coordinates; DB executes data operations; application owners validate.
  Depends on TASK-061 and named-target approval. Freeze/reconcile/switch one writer
  set, verify service/audit health and retain the source for agreed recovery.
- [ ] **TASK-063 — Retire Supabase after the agreed recovery window.**
  CI/CD/DB/Backend + Frontend; depends on TASK-062. Prove no remaining dependency,
  reconcile late data, obtain the keep/delete choice, then perform only approved
  cleanup, credential revocation and billing cancellation. Update runbooks.

## Independent local development database

- [x] **TASK-064 — Copy hosted Supabase into an independent local Docker environment.**
  User selected the local Docker option on 9 November 2026 and requested resume.
  Root coordinates local infrastructure; assigned DB owner `local_copy_database`
  handles read-only hosted exports/local restore and Backend `local_copy_backend`
  handles explicit isolated local runtime support. Keep hosted application and
  audit databases for the published AWS app; no AWS changes, hosted writes or new
  paid resources. Completed10November: independent local application/audit DBs,
  16Authusers/18identities and32images copied;38readiness gates/five restricted
  roles, local login/session/search/audit delivery and exact database/image
  persistence after stop/start passed. Normal development commands select the
  protected local profile; original hosted configuration is preserved. External
  provider integrations remain dormant locally; no automatic synchronization.
  **Startup follow-up10November:** repaired Windows-reserved original host ports
  with verified154xx loopback mappings and removed redundant audit publication.
  Normal npm start/stop, unchanged data fingerprint, app/Auth and all image checks
  pass. [Current run instructions](docs/supabase-local-ports-2026-11-10.md).
  [Scope, progress and recovery](docs/supabase-local-copy-2026-11-09.md).

## Frontend and booked-service follow-up

- [ ] **TASK-065 — Finish Search, provider, availability and customer-booking refinements.**
  User requested11November2026. Root owns Frontend; Backend/DB accepted local
  dependencies. Implementation and focused en/lv/ru mocked checks pass: provider
  Pro/style/navigation reverified, Grid default/gallery, avatars, specific dates/
  recurring end, booking status colors/source links, guarded durable deletion and
  automatic private service-change notices. Local0024/0025 are now applied and
  verified under the user's explicit startup-repair approval; hosted execution
  and deployment remain separate. Broad provider regression reproduces an
  existing failed-workspace-switch draft-loss bug with baseline components;
  focused requested-flow checks pass. Other languages/RTL deferred.
  [Evidence, activation prerequisite and recovery](docs/frontend-followup-2026-11-11.md).
  **Local startup report:** user sees `CUSTOMER_SERVICE_NOTIFICATION_DB_NOT_READY`
  at `customer_service_notification_database`, with table/DML/customer_notice
  columns/constraints/indexes/policies failing. Repo diagnosis matches the held
  0024/0025 dependency. Root verified dev loads `.env.local-docker.local`, not
  `.env`; inert migration plan and duplicate-attempt/endpoint guard tests pass,
  with no existing migration-attempt receipt. Current DB owner
  `/root/publish_db_contract` accepted local repair preparation. Exact migration/
  protected local reads and managed consumer stop/restart still await the user's
  target-specific execution approval; no database or hosted service was accessed.
  **Approved repair completed:** user replied yes to the exact local stop/migrate/
  verify/restart request. No project consumers/listener existed, so none needed
  stopping. DB owner ran the guarded command once: both migrations committed,
  current42 readiness/3Search EXPLAIN/calendar checks passed, existing29services/
  36bookings fingerprints unchanged, all probes closed. Root restarted `npm run dev`
  hidden with protected local logs; appPID20620/npmPID31692,127.0.0.1-only5000.
  Fresh localhost+127.0.0.1 health/live, health/ready and root GETs returned200
  with no cookies; startup refusal absent. Running dev instance retained. No
  audit15432, hostedSupabase or AWS operation. Migration receipt consumed;
  never replay. [Execution/restart evidence](docs/frontend-followup-local-migration-2026-11-11.md).

- [ ] **TASK-066 — Reusable AWS publishing from PC and CodeBuild.** User selected
  one script for each build option on11November. Root accepts CI/CD preparation;
  scoped DB/Backend/template owners accepted and returned offline evidence.
  Both npm entry points, shared image/release helpers, public source snapshots,
  pure DB contracts and build-only CloudFormation template are prepared.
  Offline workflow26/DB97/Python6 checks and both plan/source preparation modes pass.
  No live build/upload/deploy/resource creation or connected DB operation occurred.
  Execution remains incomplete. The initial credential-to-owner-hook patch was
  rejected by automatic approval review; user then explicitly approved the exact
  in-memory transfer and local checker, resolving that implementation hold. Current
  hosted-schema/Backend acceptance, CodeBuild schema/guard validation and approved
  setup/spend plus actual build/release/browser/worker acceptance remain required.
  See [commands, approvals, rejection and recovery](docs/aws-one-command-publishing.md).
  Tests en/lv/ru; remaining languages/RTL deferred. Existing holds/consumed guards
  and unrelated workspace changes are preserved.
  **Approved handoff implemented:** exact local checker, pipe-only private payload,
  source/credential hashes, strict TLS and sequential one-shot read-only probes
  are prepared. Fresh workflow31/DB97/Python9 plus capacity-checker109 mock scenarios
  pass; both publishing/checker plan modes pass. No real credentials transferred,
  database probe, migration, cloud build, provisioning or deployment occurred.
  **Validator setup:** user approved installing cfn-lint1.60.0/cfn-guard3.2.1
  locally; both installed in ignored project tools. Corrected HTTPS-deny policy
  Boolean representation only. Actual template lint0findings; selected AWS
  Guard16rules:15pass/1not-applicable/0violations. Cloud service validation,
  setup/spend approval, hosted migration sequence and live release remain pending.
  **Resumed hosted transition preparation:** Root/CI prepared a retained-session
  coordinator with immutable release/phase guards and offline failure checks.
  Replacement DB owner `/root/publish_transition_db_review` accepted pure-contract
  hardening/review under standing cooperation. Fresh coordinator31/transition163,
  workflow31/DB97/checker109/Python9 checks pass. Hosted runner/credential path and
  live CLI wiring remain pending; no `.env`, private configuration, database or
  cloud resource was accessed. The ordinary final current42 gate is unchanged.
  [Implementation, validation and next exact authorization](docs/aws-hosted-release-sequence-2026-11-11.md#resumed-ci-coordinator-and-next-authorization).
  **Approved runner preparation complete,12November:** user replied `approve` to
  the exact setup-source field/app-URL stdin preparation, then `resume`. Root/CI
  and replacement DB `/root/hosted_runner_finish_db` implemented/reviewed the
  source-only reader, retained-session pipe and one-shot hosted preflight/migration
  runner. Offline runner84/input41/adapter38/Python13 and existing regressions
  pass. No actual private/configuration read, credential transfer, DB/AWS call,
  migration, build or deployment occurred. Live CLI integration, exact connected
  grants, recoverability and live acceptance remain pending; task stays open.
  [Approval/evidence/recovery](docs/aws-hosted-release-sequence-2026-11-11.md#approved-runner-preparation--resumed12november2026).
  **Builder setup completed,13November:** user explicitly approved this build-only
  CloudFormation/IAM/S3/KMS/log setup and credit use after target/audit/change-set
  checks. Root verified project/service, CloudTrail90-day management history,
  exact server template, six Add actions and zero validation errors; executed the
  same change set once. Stack/six resources CREATE_COMPLETE, public bindings and
  build limits verified, build history empty. Website remains version1 ACTIVE.
  No build/source upload, database access, private dotenv/runtime extraction or
  app release. Creation guard is consumed; keep/cleanup choice requested due to
  retained resource costs. [Evidence and outputs](docs/aws-publish-builder-2026-11-11.md#approved-builder-execution--13november2026).
  **Retention selected:** user replied `pk keep it` for reusable changing-code
  development releases. Builder/key/bucket/logs retained; no cleanup requested.
  Source550 current files match the prepared snapshot; build-only inspection now
  uses public metadata without retaining runtime credentials (workflow34/Python15
  offline checks pass). Local boto3/CRT tooling is missing; separate isolated
  installation and one30-minute image build/upload are concretely proposed, not
  executed or inferred from retention approval. [Next scoped proposal](docs/aws-one-command-publishing.md#builder-retained-and-next-image-build-proposal--13november).
  **Approved first build attempted13November:** isolated boto3/CRT installation
  passed; one CodeBuild source upload/build ran under the user's exact approval.
  Compilation/full TypeScript, isolated proxy and production artifact checks
  passed, then native registry push failed with only a generic captured reason.
  No retry/registered candidate/deployment; website remains version1 ACTIVE.
  Root prepared a padded Docker-auth compatibility correction and safe diagnostic
  fields;24 synthetic push tests/workflow34 pass. Fresh550-file source differs
  only in two CI helpers. Original guards/failure evidence retained; a new exact
  build/credit-use grant is required, with no DB/maintenance/deployment authority.
  [Failure, correction, new source and bounded next command](docs/aws-one-command-publishing.md#prepared-registry-compatibility-correction-and-new-build-scope).
  **New approved image publication completed13November:** user approved one
  corrected-source build/upload with the same30-minute/no-retry bounds and
  credit use. Root/CI ran it once; build
  `91cd82e2-b074-4617-80f6-8c0dd5204f86` SUCCEEDED. Lightsail independently
  confirms `:fitsmytime-staging-20261109.srcb9de33fbc298c44ea40489d9.5` and the
  exact recorded digest. Website remains RUNNING/version1 ACTIVE/no pending;
  no DB/private runtime/maintenance/deployment operation. Builder retained by
  existing user choice; both consumed attempts preserved. Hosted migration/live
  release integration and PC path acceptance remain incomplete; TASK-066 stays
  open. [Verification, receipt and remaining limits](docs/aws-one-command-publishing.md#verified-image-publication--13november2026).
  User subsequently requested hosted-schema verification before migration. DB
  `/root/hosted_schema_status_db` accepted and prepared a neutral catalog-only
  SQL check; no live check/private input yet. Browser control could not initialize
  (kernel asset path missing), so awaiting the user's source SQL Editor result.
  [Concrete check and interpretation](docs/aws-hosted-schema-status-2026-11-13.md).
  User returned PG17/identity/read-only match,41 tables and absent new notification/
  deletion/constraint/policy/ACL markers, existing app inheritance true. Hosted
  migration effects are absent; neutral status verification is complete, with
  the public row retained. Full preflight/recoverability and retained-session
  release CLI wiring still precede any migration/cutover authorization.
  **No-backup choice recorded / CLI preparation completed:** user selected
  proceeding without backup for the exact hosted source. Root completed external
  first-upgrade CLI; DB/Backend conditionally reviewed actual-receipt acceptance
  and unchanged built source. CLI27/coordinator31/adapter38/workflow34/helper61/
  contract163/Python16 pass, DB runner84/input41 rerun. All550 source bytes match;
  no new image needed. Proposed exact private-input/preflight/maintenance/source
  migration/capacity/deployment scope and command are reviewable, not approved or
  executed. Live private/DB/service writes and full acceptance remain pending;
  stop-inspect/no retry/old41 restart holds remain. [Prepared command and exact
  next grant](docs/aws-one-command-publishing.md#hosted-release-without-backup--13november2026).
  **Approved live cutover stopped safely:** user approved exact scope; Root ran
  once. Live old41/38 preflight passed, maintenance version2 ACTIVE/drain verified.
  Migration setup guard failed before either SQL script: sql[], no uncertain
  commit, all probes closed. No candidate/capacity/retry/rollback. AWS confirms
  version2 ACTIVE/no pending; root503/readiness200 maintenance. Private retained
  session closed; all consumed attempts/lock preserved. DB preparing source-only
  diagnostic SQL; exact failed component unknown. Task remains open for diagnosis
  and new scoped recovery. [Actual result/evidence/holds](docs/aws-one-command-publishing.md#hosted-release-without-backup--13november2026).
  User diagnostic shows stopped is sole failed gate: two idle supabase_admin
  clients; identity/role caps/old41 pass, no matching project writer clients.
  DB owner reviewing managed-admin policy/optional transaction+lock metadata;
  idle alone is not an exemption. No original guard change or migration retry.
  Managed-admin follow-up shows full visibility, two idle source admin peers,
  zero transactions/snapshots/locks/prepared transactions. Observation meets
  narrow proposed policy; awaiting explicit material-policy selection before
  implementation and maintenance2 recovery preparation. No further manual SQL
  needed for that choice; original command remains consumed/unreplayable.
  **14November recovery preparation complete:** user selected bounded policy and
  offline recovery implementation/testing, live held. Optional default-strict
  DB marker, exact historical1/maintenance2 reconstruction, fresh linked UUID,
  shared recovery mutex and success-only hold archive reviewed by DB/Backend/CI.
  Policy63/runner91/contract163/input41/acceptance61/evidence19/CLI34/transition62/
  adapter38/workflow34/Python19 pass; all550 source bytes unchanged. New working
  recoverye7769268-dcca-44c2-806b-f942211b3e37 and proposed13-pin scope ready,
  not approved/executed. [Exact next scope/command](docs/aws-one-command-publishing.md#reviewed-maintenance2-recovery-execution--14november2026).
  **15November exact live recovery approved:** local CLI34/evidence19 pass;
  pre-guard read-only SDK identity check failed LoginRefreshRequired. Recovery
  command not invoked, new guards/private setup/DB/deployment untouched. Named
  AWS login refresh needs the sign-in skill's explicit confirmation; scope and
  expiry are recorded in new auth-precheck receipt. Resume authorized recovery
  after login/identity/pins revalidate within the approval window.
  **15November approved recovery executing:** user confirmed named aws login;
  fresh identity/pins passed within original approval expiry. Historical1/exact
  maintenance2 and new full old41 preflight verified; admin policy passed and
  hosted0024/0025 committed once. Actual current42/all44/data preservation/closed
  probes and five restricted-role TLS/capacity checks passed. Exact candidate3
  ACTIVATING, HTTP/final acceptance pending; both active holds still preserved.
  Never resume old41 after these commits. No migration retry/rollback/new build.
  **15November live recovery succeeded:** candidate3 ACTIVE/RUNNING/no pending,
  exact image on app/audit-worker/gateway; previous1/2 INACTIVE. Gateway challenge
  and sanitized readiness pass. Independent service/history/registry read verifies
  bindings/digest; archived original hold hash matches, both active holds absent.
  Hosted0024/0025/all44/data/capacity evidence retained; no retry/rollback/backup.
  Migration/deployment scope is complete. TASK-066 remains open only for separate
  worker/browser/PC-path acceptance and follow-up owner work, not hosted migration.
  [Final evidence and actual URL](docs/aws-one-command-publishing.md#reviewed-maintenance2-recovery-execution--14november2026).

## Service pages and booking options

- [x] **TASK-067 — Deliver public service pages and configurable booking options.**
  User-approved phased implementation, 21 November 2026. Root owns Frontend;
  assigned Backend/DB owners and delegated provider Frontend accepted scoped
  dependencies. Public URLs, fixed/From options, company specialist dropdown,
  resource-safe calendar, exact sign-in return, sharing and inherited online-payment
  preferences. Online collection remains disabled; onsite booking stays available.
  Local application PostgreSQL `127.0.0.1:15422/postgres` migration is approved
  **without backup**, after verified writer stop and reviewed preparation.
  Fresh tests **English only**; Latvian/Russian and other-language/RTL checks
  deferred, translations maintained. No hosted/AWS/deployment/real payment scope.
  [Approval, owners, limits and evidence](docs/service-page-implementation-handoff.md).
  **22 November:** implementation, English customer/provider browser checks,
  affected Backend/DB offline checks, global TypeScript and build pass. Local
  migration preflight stopped before private read/connection/SQL because the
  restricted OS token denied TCP/Docker inspection. No retry or restart under
  the approved stop rule. Await one newly authorized guarded attempt in the
  permitted OS context, then preservation/readiness verification and restart.
  User approved one new attempt. Root stopped the verified local npm/watch tree;
  OS/current42 checks passed, but SQL trigger installation failed because the
  migration omitted the established temporary audit-function setup privilege.
  Bounded read-only diagnosis proves complete transaction rollback, current42
  readiness and unchanged original fingerprints (29services/36bookings). The
  consumed receipt and0026 remain frozen. DB is preparing new0027 with exact
  temporary-privilege restoration; no automatic retry/repair/restart.
  New0027 recovery is prepared and reviewed: 43 offline recovery checks plus
  original49-gate regression pass. It uses temporary audit-trigger setup
  authority with exact ACL/member restoration. Awaiting one explicitly approved
  recovery execution, then successful verification and local restart.
  User approved0027; it committed with original data and setup privileges exactly
  preserved. Postflight stopped on two catalog-format comparison defects and
  real Supabase-default EXECUTE grants on the three new trigger functions.
  DB is preparing narrow verifier fixes and new0028 explicit revokes; no further
  database write/restart occurred, and frozen0026/0027 evidence is retained.
  Narrow comparison corrections now pass48/49 real gates; all3 plain EXPLAINs
  pass after fixing the option Search EXISTS delimiter. New0028 ACL-only forward
  repair is reviewed and ready:53 offline checks, final global TypeScript/build
  pass. Awaiting one explicit0028 execution approval, then49 gates/data/ACL
  verification and success-dependent local restart. App remains stopped.
  **Completed locally22November:** user approved0028; it committed once and all49
  readiness gates/threeplainEXPLAINs/full data preservation/setup restoration/
  private function ACL checks pass. Root reviewed the receipt, restarted via
  `npm run dev` and verified liveness/readiness/home/service SPA HTTP200 without
  cookies or connected booking/auth/payment tests. English browser suites,
  TypeScript/build and affected offline owner checks pass; deferred language
  scope and disclosed money-runner exception are in the handoff. Earlier stop
  evidence stays preserved. Online collection/country rates/DAC7/private calendar
  remain separately tracked follow-ups. No hosted deployment occurred.

- [ ] **TASK-068 — Configure platform service fees by provider business country.**
  Requested by user: authorized Administration manages versioned rates, initially
  EEA 6% and USA 8%, based on provider business country rather than customer locale
  or currency. Calculate exact amounts server-side; apply changes to new quotes
  and preserve historical transaction rate/amount. Acceptance includes admin
  authorization, country selection, rounding, changed quotes and historic values.
  Current TASK-067 prepares a central 6% quote policy; country configuration is
  follow-up work and does not authorize real payment collection or deployment.

- [ ] **TASK-069 — Prepare service-payment collection and provider tax review.**
  Follow-up prerequisite to enabling TASK-067 online checkout: provider onboarding,
  private DAC7 profile/review, verified payment collection, payouts, refunds,
  reconciliation/recovery and reporting. Preserve selected full/minimum amount
  plus platform fee and payment after acceptance for approval-based appointments.
  Exact commercial/legal policies and connected execution remain separate work.

- [ ] **TASK-070 — Add a private personal-calendar usage mode.**
  Requested design: manual private appointments and optional indicative amounts,
  without public listings, customer booking links or platform payments. Keep usage
  mode distinct from legal seller type. Confirm classification before treating
  it as outside seller-reporting scope; preserve earlier records on mode changes.

## Appearance

- [x] **TASK-071 — Add dark mode support.** Completed locally, 24 November 2026,
  under the user's specific frontend request. Shared header now offers persistent
  Light/Dark/System choices; system updates, first paint, denied storage, forms,
  calendars and navigation are covered. TypeScript, isolated frontend production
  build, dark-mode browser checks and Search entry regressions pass. Existing
  Search Grid/List test mismatch and direct Node Vite-env limitation are recorded
  separately. Tests en/lv/ru only; other languages/RTL remain deferred. No connected
  services/database, deployment or native rebuild. [Scope, evidence and recovery](docs/dark-mode-handoff.md).

## Provider verification

- [ ] **TASK-072 — Implement provider verification and a provider verification page.**
  Requested 24 November 2026. Add a page where providers can apply for verification;
  verification methods and required evidence must vary by provider type and the
  type/category of service they provide. Define and approve that requirements
  matrix before implementing the workflow. Include submission, review, status
  feedback, renewal/revocation rules where needed, and accurate customer-facing
  badge behavior. Decide evidence privacy, access and retention before collecting
  documents; coordinate Backend/DB owners for APIs, storage and schema work.
  **Placeholder delivered:** a neutral certificate icon now appears beside provider
  names on service cards, details and storefronts, labeled “Provider verification
  coming soon”. It does not assert verified status or collect evidence. The real
  verification logic/page remains future work. [Scope and local checks](docs/provider-verification-placeholder-handoff.md).

## Language URLs

- [x] **TASK-073 — Add language prefixes to frontend URLs.** Requested and accepted
  24 November 2026. User approved the proposed language-prefix change; `/root`
  owns reversible local frontend routing, navigation, sharing, language detection,
  affected translations/tests and documentation. Implemented locally with passing
  mocked Chromium verification in en/lv/ru, TypeScript and isolated frontend build.
  Legacy links, query/hash/state, authentication allowlists and language-switch
  drafts are preserved. A separately reproduced existing provider workspace-switch
  test failure is recorded in the handoff. Other locales/RTL remain deferred.
  No country-prefix, backend/DB,
  private configuration, connected service, deployment or native build operation.
  [Scope, verification and recovery](docs/language-routing-handoff.md).

## Calendar phone bookings

- [x] **TASK-074 — Book unregistered customers directly from provider Calendar.**
  Accepted 24 November 2026. Select a range in 30-minute blocks, then open an
  editable Add booking page. Service selection or free-text notes; customer
  name/phone/email and price are optional. Salon staff selection respects workspace
  permissions. Preserve the selected duration; permit outside-hours bookings with
  a warning, and prevent conflicts with registered and manual appointments.
  User authorized implementation and local database jobs, reporting `main.dump`
  (2,019,735 bytes) and `audit.dump` (530,370 bytes), both 24 November at 17:28.
  Completed locally: calendar/form, private APIs, shared conflict checks and additive
  migration 0029. All 57 readiness gates and 19 rolled-back runtime DB checks pass;
  existing table fingerprints are preserved. Focused en/lv/ru browser, backend,
  TypeScript and production build checks pass. Four older VM runners retain an
  independently evidenced baseline service-options fixture mismatch. Local app
  is running at localhost:5000 with passing health and calendar/Add booking shells.
  Root owns Frontend/integration; assigned Backend/DB and delegated calendar owners
  returned implementation evidence. No hosted/AWS/deployment/spending.
  [Current authorization, progress and recovery](docs/manual-booking-handoff.md).

- [x] **TASK-075 — Repair local startup when Git is missing from PATH.**
  Completed 25 November 2026 under the user's local launcher error report. Resolve
  existing Windows Git/Visual Studio installations automatically; preserve the
  mandatory Git-ignore, private-file ACL and isolated-profile safeguards. Seven
  offline discovery scenarios and exact `npm run dev -- --check` pass without a
  PATH workaround. Existing local app retained; no private config/data changes,
  installation, migration, cloud or deployment. [Evidence and recovery](docs/local-start-git-discovery-2026-11-25.md).

- [x] **TASK-076 — Delete provider-created manual bookings instead of cancelling.**
  Accepted 25 November 2026 under the user's explicit deletion-feature request.
  Root owns Frontend/integration; assigned Backend and DB owners accepted the
  revision-checked manual-only DELETE dependency and existing schema review.
  Replace manual Cancel with confirmed permanent deletion, including previously
  cancelled/completed entries. Preserve registered-customer booking cancellation,
  workspace/staff permissions and redacted audit capture. No migration or actual
  stored booking deletion during implementation/testing. Backend 98 cases,
  en/lv/ru deletion and complete manual-booking browser flows, locale/form checks,
  TypeScript and production build pass. Confirmation includes dates/times and
  verified text/action contrast. [Scope and evidence](docs/manual-booking-delete-handoff.md).

<!-- Add the next task here using TASK-077, or place it in the relevant section. -->
