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

- [ ] **TASK-005 — Refactor the landing page.** Agree on the desired layout,
  content, and behavior when starting this task, then implement the refactor.

## Translations
- [ ] **Make sure interface is translated in multiple languages ** All labels , button names, tooltip texts should be translated when user switch language.

## Audit

Plan an activity audit trail covering successful changes, failed/denied actions,
sensitive reads, and system operations. See [the audit plan](docs/audit-plan.md)
for the coverage matrix, proposed storage, privacy rules, and acceptance checks.
Recommended direction: a separate audit PostgreSQL database, fed reliably through
a transactional outbox in the application database. This is planned work, not
an implemented audit system.

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

- [ ] **TASK-013 — Define the audit event catalog and policies.** Inventory API
  routes, Auth/Storage operations, scheduled jobs, scripts, and direct database
  changes. Map each to events, actors, outcomes, safe fields, and retention.
  Record coverage gaps and settle hosting, reader permissions, and retention
  periods before provisioning storage. Include future features when implemented.
  **Status, 19 October 2026:** Backend source inventory/event catalog prepared;
  28 referenced paths checked and whitespace checks passed. Joint event/outbox
  contract cross-reviewed with DB Analyst; storage/policy proposal prepared. All local
  Markdown file links in both proposals resolve. **User selected Option C on
  19 October 2026:** separate PostgreSQL on independent infrastructure with an
  application transactional outbox. Intended hosting direction is a separate
  Supabase project. User confirmed existing application DB is development/testing
  and subsequently supplied audit project reference `ynygqodmtgjrngiudalw`
  (`https://ynygqodmtgjrngiudalw.supabase.co`). API variables reported configured;
  values not printed or tested. User now reports `.env` `AUDIT_DATABASE_URL`
  configured; DB Analyst may privately derive target metadata while preparing
  migrations. Private configuration check identifies source `hbkooiknruimukkhshrk`
  and destination `ynygqodmtgjrngiudalw` as distinct. Privileges/connectivity remain
  unverified; no database access or SQL applied.
  **User also approved R1 + P1 and recommended failure behavior:** named
  security/support readers only with separate export permission,
  365-day business/security and 90-day read/operational retention, no optional
  request context initially, and 7-day delivered-outbox retention. Audited
  mutations roll back on local capture failure; protected reads/exports fail
  closed; denials still deny with reported capture gaps; destination outages
  queue locally within capacity. Named targets/readers/operators, hosting setup
  and provider/direct-SQL gaps remain pending. No runtime coverage verified.

Completed: [TASK-014 — audit storage and delivery](TASKS_COMPLETED.md#audit).
See the [development acceptance record](docs/audit-completion-execution.md).

- [ ] **TASK-015 — Audit authentication, accounts, and access changes.** Capture
  sign-in/out, signup, social-auth outcomes, recovery/password changes, account
  edits, workspace switches, invitations, memberships, ownership transfers,
  account restrictions, and authorization denials. Correlate application events
  with available Supabase Auth events; never log passwords or session tokens.

- [ ] **TASK-016 — Audit business data changes.** Cover services, shared addresses,
  employees, schedules, bookings, reviews, categories, storefronts, subscriptions,
  and administrative actions. Record safe field changes and server-confirmed
  outcomes, including multi-record updates, copies, deletion, and bulk operations.
  **One-event follow-up implemented, 25 October 2026:** `service.viewed.v1` for
  explicit found-service details opens, using selected R/90-day read retention.
  Backend/Frontend focused checks and TypeScript passed; both development DB
  extensions committed and rollback-only R90/legacy checks passed. Protected
  producer flag is enabled. Restart app and use the updated audit worker;
  no daemon was left running. Broader mutation coverage remains open.
  [Scope, owners, evidence and recovery](docs/audit-service-view-execution.md).

- [ ] **TASK-017 — Audit sensitive reads, integrations, and background work.**
  Cover private/admin data access, exports, protected file access, geocoding,
  embedding generation, cleanup jobs, migrations, and operational scripts.
  Add direct-database coverage where required. Keep general browsing analytics
  separate; add payments, webhooks, and notifications as those features go live.

- [ ] **TASK-018 — Add an audit viewer in Administration.** Provide server-side
  filters, pagination, event details, safe change comparisons, and request/object
  history. Restrict global access, scope any company view explicitly, and audit
  viewing/exporting audit records. Support controlled exports without exposing
  secrets or other workspaces' data.

- [ ] **TASK-019 — Verify, operate, and roll out auditing.** Test coverage,
  transaction rollback, duplicate delivery, outages, permissions, redaction,
  retention, deletion, and backup restoration. Add delivery/integrity alerts,
  review procedures, an incident runbook, and deployment/rollback instructions.
  Start with security-critical events, then complete the coverage matrix.

- [ ] **TASK-025 — Audit current-location permission and location consent.**
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

## notifications

## quick find: I have x time available X date. What could I do? Propose activities near my current location.

## Subscribe for news. Receive invitations.

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

## Reports

## SMS
## Terms of Use
<!-- Add the next task here using TASK-031, or place it in the relevant section. -->
