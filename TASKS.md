# Tasks

Backlog for building FitsMyTime one task at a time. Add new tasks below with a
unique ID and an unchecked checkbox. Refer to an ID when asking for work
(for example, "Build TASK-001"). Mark a task complete only after implementation
and verification.

Completed tasks are archived in [TASKS_COMPLETED.md](TASKS_COMPLETED.md).
Keep tasks awaiting testing or external setup here, and preserve task IDs when archiving.

## Authentication

- [ ] **TASK-003 — Support social sign-in.** Add or complete authentication
  through Google, Facebook, Apple, and Microsoft.
  **Status:** App integration implemented; provider setup and live sign-in testing pending.
  Follow [the setup guide](docs/social-sign-in.md) to configure each provider in
  Supabase and its developer console before enabling it.

## Landing page

- [ ] **TASK-005 — Refactor the landing page.** Agree on the desired layout,
  content, and behavior when starting this task, then implement the refactor.

## Form design

- [ ] **TASK-023 — Design and implement service search.** User requested
  design files for `/search` on 20 October 2026. Front End Developer `/root`
  prepared [the proposal](docs/search-design-proposal.md),
  [interactive preview](docs/search-design-preview.html) and desktop/phone/map/error
  screenshots. **User selected option A on 20 October 2026** in the proposal's
  Recommended direction section: combined search bar, compact filter sidebar,
  phone filter panel and readable service rows. User subsequently instructed
  “Go ahead and implement as planned,” approving the explicit Search/Apply,
  phone dialog and details-first flow. Executor: Front End Developer `/root`;
  environment: local repository. Allowed: scoped frontend/resources/tests and
  isolated mocked verification. No backend/database/ORM, connected service/session
  writes, paid APIs, infrastructure or deployment. Existing deployment hold remains.
  **Status: implemented locally; focused offline/Chrome checks pass.** Application
  and fixture types, production build, public-search UI, sorting, guest-search and
  provider-catalog frontend regressions pass. Chrome: 5 groups/12 locale-viewport
  cases, English/Latvian/Russian only, zero unexpected requests/runtime exceptions.
  The other eight languages are deferred; broader browser/device/assistive-tech/
  zoom/integration release checks remain unverified, so full release verification
  stays open. Recovery and evidence: [implementation handoff](docs/search-implementation-handoff.md).

- [ ] **TASK-021 — Propose improvements to existing UI forms.** Assigned at the
  user's request on 19 October 2026 to Front End Developer `/root/forms_design`.
  Review representative forms and prepare
  [a design proposal](docs/forms-design-proposal.md) with layout examples,
  prioritized changes, mobile/accessibility requirements, and multilingual/RTL
  behavior. **Status, 20 October 2026:** User reviewed and approved the visual
  proposal and requested that the Front End Developer start implementation.
  Selected direction: A, consistent sectioned forms using the existing system.
  Proposal and isolated visual-preview checks are documented in the proposal;
  application implementation and its verification are tracked in TASK-022.

- [ ] **TASK-022 — Implement the approved forms design.**
  **Testing scope update, 20 October 2026:** From now onward, the user requires
  testing only English (`en`), Latvian (`lv`) and Russian (`ru`). Arabic/RTL,
  Chinese, French, German, Hindi, Japanese, Portuguese and Spanish checks are
  deferred until later and are not current acceptance blockers. Existing
  11-language evidence below is historical and need not be repeated. Native-language
  review of the other eight languages is likewise deferred. See the project-wide
  [test language scope](AGENTS.md#test-language-scope).
  **Deployment hold, 20 October 2026:** User explicitly requested "hold on deploy."
  Do not publish, deploy or trigger a release until the user explicitly resumes
  deployment. Local implementation and offline/mocked verification may continue.
  **Local preview restored, 20 October 2026:** At the user's request, started the
  existing development server at `http://localhost:50000` with process-only
  `PORT=50000`/`APP_URL=http://localhost:50000`; `.env` remains configured for 5000.
  Cookie-free homepage and `/health/live` returned HTTP 200. No authenticated,
  database-readiness or write flows were exercised. This is not a deployment.
  **Implementation approval:** 20 October 2026, "I have reviewed Proposed forms design and I like it . Ask
  Front End Designer to start implement them." Assigned executor:
  Front End Developer `/root/forms_implementation`, started through this thread's
  collaboration controls. General Manager owns task/status coordination.
  **Status, 20 October 2026: Local implementation complete; broader release
  verification remains open.** The user directly assigned Front End Developer
  `/root` to finish the task with reduced repeated testing and existing browser
  tooling. The remaining login/signup implementation was already present. This
  pass completed its browser verification, security review and final handoff;
  no application source change or new browser infrastructure was needed.
  Final auth: visible language choice, separate authentication/profile/email
  groups, stacked phone names, linked errors and safe localized feedback;
  **48 messages in all 11 locales**. Mocked social-auth frontend regression,
  application/fixture TypeScript and production build pass. Existing Chrome
  harness: **8 behavior groups and 77 locale/viewport cases**, with no unexpected
  requests or runtime exceptions. Three rendered screenshots reviewed.
  Evidence and approval/recovery record: [auth handoff](docs/forms-auth-handoff.md).
  Existing build warnings concern Browserslist age and bundle size.
  Earlier passing phase evidence is retained without repeating the full matrices:
  Phase 1 service editor, 13 groups/77 cases and 67 messages;
  Phase 2 booking/account/address, 14 groups/231 cases and 105 messages;
  Phase 3 availability/team/admin/storefront, 11 groups/462 cases and 137 messages.
  See [Phase 1](docs/forms-implementation-handoff.md),
  [Phase 2](docs/forms-phase2-handoff.md) and
  [Phase 3](docs/forms-phase3-handoff.md) for detailed results.
  **Open verification:** Firefox/WebKit, physical devices/virtual keyboards,
  screen readers, actual 400% browser zoom and native-language review. The local
  implementation and available focused checks are complete, but these existing
  role/proposal acceptance requirements keep TASK-022 open for full verification.
  No connected services/database operations or deployment; deployment hold remains.
  **Scope and environment:** Local frontend implementation of
  [the approved proposal](docs/forms-design-proposal.md) and visual concept.
  Start with service-editor sections, responsive actions, linked field errors,
  accessible choices, dirty exits and inactive/publish behavior. Include affected
  translations in all 11 locales, scoped tests and isolated browser fixtures.
  Phase 2 covers booking/account/address; Phase 3 covers availability, company,
  admin/storefront forms, following the proposal's staged sequence.
  **Allowed operations and limits:** Frontend source/locale/test edits and safe
  offline or mocked checks; minimal frontend test tooling if needed. Preserve
  existing API contracts and other sessions' changes. No backend, database/ORM,
  live-service access, connected tests/session writes, deployment, infrastructure,
  browser draft storage or broad global styling rewrite. Coordinate shared
  manifest edits before making them.
  **Validation:** Front End Developer owns interaction/regression tests,
  applicable type/build checks, synthetic browser checks, security review,
  responsive/accessibility and multilingual/RTL checks per the role/proposal.
  Record actual coverage and unavailable checks; required failures/unavailable
  checks mean incomplete work. Evidence and next steps belong in
  [the implementation handoff](docs/forms-implementation-handoff.md).
  **Recovery:** Revert only attributable implementation edits, preserving prior
  and concurrent changes. No rollout is included. Reuse this approval within
  scope; obtain additional authority for material boundary or risk changes.


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
[the DB role workflow](DB-ANALYST-DEVELOPER.md#advise-offer-options-and-wait-for-the-users-choice).
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

- [ ] **TASK-014 — Build reliable audit storage and delivery.** Add the separate
  audit database, restricted credentials, event schema, and application outbox.
  Record business changes and their events in one transaction. Add a delivery
  worker with retries, duplicate protection, backlog monitoring, and recovery.
  Test audit-database outages without losing events or stopping normal reads.
  **Current package BE-14A:** assigned `/root/audit_backend` (Back End Developer)
  to implement pure event registry/validation, safe-field redaction, trusted
  context, bounds and canonical hashing in new `server/audit/*.ts`, with isolated
  synthetic tests in `scripts/test-audit-events.mjs`. Approval source: user's
  audit work request and C/R1/P1/failure-policy choices; General Manager routes
  the scoped assignment. Environment: local repository only. No DB/provider
  imports, connected tests, startup, provisioning, schema/config changes or
  deployment. Validation: deterministic offline behavior/security tests and
  inspected type checks. Recovery: revert only this package's new files.
  DB Analyst prepares [test setup handoff](docs/audit-test-setup.md); database
  integration and rehearsals await named targets and scoped execution approval.
  **BE-14A result, 19 October 2026:** completed local
  [event contracts](server/audit/events.ts),
  [context snapshots](server/audit/context.ts),
  [canonical JSON/hashing](server/audit/canonical.ts), and
  [offline tests](scripts/test-audit-events.mjs). Initial registry supports 11
  security/account/access event names; other events, system actors, producers,
  database outbox/worker and viewer remain pending. Context snapshots validate
  caller assertions; future adapters must verify identity/membership themselves.
  On Node v24.21.0, `node --experimental-strip-types scripts/test-audit-events.mjs`
  passed (11 event names; 105 rejected-input cases), and
  `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
  Backend reviewed import isolation, security and four new files' whitespace.
  No database/service/config/credential access, startup or connected tests.
  DB setup handoff is prepared; TASK-014 remains incomplete pending integration.
  **DB-14 preparation:** assigned `/root/audit_database` to new
  `migrations/audit/*` and `docs/audit-migration-package.md`, under the user's
  selected C/R1/P1/failure policy and supplied audit target/connection. Allowed:
  local SQL preparation, offline checks, and bounded private inspection of
  relevant `.env` configuration for non-secret target metadata. No credential
  output/copies, database/service connections, SQL execution, app startup,
  connected tests, infrastructure/config edits or deployment. Back End Developer
  reviews envelope/hash/transaction/delivery contract read-only. Validation:
  offline SQL/package checks plus joint review; live rehearsal still pending.
  Recovery for this preparation: revise/remove only these new package files.
  **DB-14 result, 19 October 2026:** six SQL files and
  [migration/recovery package](docs/audit-migration-package.md) prepared, unapplied.
  Includes read-only metadata preflight/verification, shared staged contract,
  separate source outbox and destination migrations, NOLOGIN groups and explicit
  execution scope. Backend static review found no remaining compatibility blocker
  after validator permissions and replay-target evidence were corrected. Local
  document links and whitespace checked. SQL compilation/live privileges,
  rollback/concurrency/retention/restore behavior remain unverified; `psql` is not
  on PATH and no inspected offline PostgreSQL parser is available. No tooling
  installed, database connected, runtime login bound, cron scheduled or business
  table rewritten. Execution remains a separate named-target step; TASK-014 is
  incomplete until integration and required live checks pass.
  **Execution approval, 19 October 2026:** user replied "yes" to DB Analyst
  preflight followed, if checks pass, by additive audit schemas/NOLOGIN roles
  and metadata verification on development/testing source
  `hbkooiknruimukkhshrk` and audit destination `ynygqodmtgjrngiudalw`.
  Executor: assigned DB Analyst `/root/audit_database`; backend reviews the
  fixed-manifest Node/pg helper read-only (existing tools; no installation).
  Label: `development`. Recheck endpoint mappings privately, verified TLS,
  PostgreSQL/encoding/powers/schema/role preconditions on both before writes.
  Apply destination then source, preserving each script's transaction and
  collecting sanitized versions/digests/metadata verification. Excludes business
  DML, fixtures, runtime logins/bindings, cron/extensions, backups/restores,
  deployment and production. On failure roll back the current transaction;
  preserve committed audit objects/evidence and review corrective changes.
  Do not re-request covered execution approval; stop for material scope/risk changes.
  **Execution result, 19 October 2026:** DB Analyst applied `destination-0001`
  to audit `ynygqodmtgjrngiudalw` at 16:09:50 Europe/Riga, then `source-0001`
  to application `hbkooiknruimukkhshrk` at 16:09:51. Both PG17.11 preflights
  passed over verified TLS. Destination reused the already configured public
  Supabase Root 2021 CA through a fingerprint-pinned, destination-only helper
  option; no `.env` or machine trust changes. Both commits are confirmed,
  with no SQL retries/corrections or uncertain outcomes. Read-only metadata
  verification passed: destination 60 boolean checks; source 80. No business
  DML, event fixtures, runtime login bindings, cron or deployment occurred.
  See [execution evidence and applied digests](docs/audit-execution-report.md).
  **Next:** backend transaction adapters/worker and capture instrumentation;
  scoped runtime accounts and behavioral/permission/outage/recovery rehearsals.
  The scaffolding is installed, but event collection/delivery is not active and
  TASK-014 remains incomplete.
  **Next work authorized, 19 October 2026:** user requested "Proceed with next
  work" after the activation path. General Manager assigned Back End Developer
  `/root/audit_backend` to transaction-aware capture adapters, bounded reliable
  delivery worker/configuration and initial supported authentication/access
  instrumentation, with meaningful isolated tests. Backend owns `server/audit/*`,
  affected backend auth/account/access/storage/startup hooks, backend-specific
  audit test scripts/commands and audit-only `.env.example` settings. Environment:
  local development; no frontend/schema edits, live providers, real app startup,
  connected tests, credential reads/`.env` edits or deployment in this assignment.
  Verification: behavior/security tests with mocked external boundaries, relevant
  affected backend regressions and type checks. Recovery: revert only this
  package's changes while preserving installed DB objects and earlier work.
  DB Analyst `/root/audit_database` prepares concrete restricted-runtime-account
  options and a bounded synthetic rehearsal package in new runtime SQL/helpers,
  `scripts/test-audit-db.mjs` and `docs/audit-runtime-proposal.md`. Bounded catalog
  metadata review may support that proposal; no new grants/role bindings,
  credentials/config changes, fixtures or DB writes until the user selects the
  new scope under the DB workflow. Prior C/R1/P1/setup approval stays in force;
  its exclusions are not silently broadened. Backend and DB Analyst coordinate
  interfaces, privilege boundaries, TLS/CA and test provenance before execution.
  **Runtime proposal prepared:** [account and rehearsal package](docs/audit-runtime-proposal.md)
  compares restricted application/capture/worker accounts (recommended) with a
  development-only owner-connected application alternative. Both include bounded
  rollback tests and up to twelve marked, retained synthetic audit events. User
  selected **Choice 1: restricted application, capture, and worker accounts;
  include the synthetic rehearsal**, on 19 October 2026. DB Analyst now implements
  the concrete additive runtime/rehearsal SQL and helpers locally; the question
  requested package preparation, so new connected writes, private configuration,
  credentials and fixtures await final review/execution approval. Validation:
  static/offline checks plus Backend compatibility/security review. Executor and
  target scope remain the DB Analyst and the two named development/test projects;
  no live Auth/business DML or deployment. Preserve existing objects and evidence
  on failure; do not rerun initial setup. No new privileges, private configuration
  or fixtures have been applied. Remote Auth intent/reconciliation remains an additional activation
  gate; local outbox atomicity cannot roll back a completed provider operation.
  **Regression ownership coordination:** General Manager asked assigned Front End
  Developer `/root/forms_design` to review the unchanged mixed social-auth,
  password-update, account-details and administration scripts and specifically
  authorize Backend execution of their synthetic frontend assertions if isolated.
  No frontend implementation, browser/app startup or connected writes are included.
  The Front End Developer approved execution of those four unchanged scripts
  under the [documented isolation and limits](docs/audit-frontend-regression-approval.md):
  fresh child processes, redirected dotenv path that must not exist, synthetic
  mocked services/database/session state and disabled audit flags for baselines.
  Executor: `/root/audit_backend`; no frontend edits, installs, real browser,
  connected writes or app startup. Recover by stopping the isolated processes
  and restoring parent environment overrides. Execution results remain pending;
  separate enabled backend audit tests verify the new capture behavior.
  **Backend verification result:** Back End Developer reports passing contract
  tests (11 event names / 105 invalid cases), capture/worker/config/runtime-role
  policy tests, enabled Auth/access handler tests and the actual account-role
  route/storage branch using mocked external boundaries. Account-role tests cover
  lock/update/enqueue order, true before/after, no-op, mismatched actor rejection,
  and enqueue failure returning 503 with transaction rollback and sanitized logs.
  The four approved unchanged mixed regressions and root no-emit TypeScript check
  passed. No real database, Auth service, credentials or application startup was
  exercised. This is local evidence; runtime privilege/delivery rehearsals and
  remote intent/reconciliation remain incomplete activation gates.

- [ ] **TASK-015 — Audit authentication, accounts, and access changes.** Capture
  sign-in/out, signup, social-auth outcomes, recovery/password changes, account
  edits, workspace switches, invitations, memberships, ownership transfers,
  account restrictions, and authorization denials. Correlate application events
  with available Supabase Auth events; never log passwords or session tokens.

- [ ] **TASK-016 — Audit business data changes.** Cover services, shared addresses,
  employees, schedules, bookings, reviews, categories, storefronts, subscriptions,
  and administrative actions. Record safe field changes and server-confirmed
  outcomes, including multi-record updates, copies, deletion, and bulk operations.

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

## Test scripts

## notifications

## quick find: I have x time available X date. What could I do? Propose activities near my current location.

## Subscribe for news. Receive invitations.

## New tasks

Product proposals are maintained by the [Product Manager](PRODUCT-MANAGER.md) in
[Product opportunities](docs/product-opportunities.md), including priorities,
cost/income scenarios, and pilot decision criteria. PM proposal IDs are separate
from delivery task IDs. These proposals are not approved implementation tasks;
create a TASK entry when work is selected. TASK-018 remains the audit viewer.

## Security
Encrypt network traffic. Passwords and other sensitive information
## discounts

## compaigns

## billing

## Reports

## SMS
## Terms of Use
<!-- Add the next task here using TASK-024, or place it in the relevant section. -->
