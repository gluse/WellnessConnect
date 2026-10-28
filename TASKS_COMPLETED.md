# Completed tasks

Archive of completed FitsMyTime tasks. Active tasks, including those awaiting
testing or external setup, remain in [TASKS.md](TASKS.md). Preserve task IDs when
moving tasks between these files.

## Customer booking management

- [x] **TASK-030 — Let customers cancel and reschedule their own bookings.**
  **Completed locally, 27 October 2026:** Added customer controls/confirmation and
  booking-specific available-time access; API and locked storage checks permit
  only own future pending/confirmed reservations. Preserve provider/employee
  authority, saved duration/cleanup, schedule and overlap validation. Failed
  reschedules retain the original booking; canonical successful changes update
  caches even if refresh fails. Account changes hide prior private rows/dialogs.
  **Authority:** User bug-fix request plus AGENTS standing cooperation. Root
  assigned Front End Developer `/root/booking_frontend` and Back End Developer
  `/root/booking_backend`; both accepted and implemented within their local scope.
  Root reviewed integrated contracts, source, evidence and rendered phone/zoom
  screenshots. See [coordination](docs/agent-coordination.md#task-030--customer-booking-cancellation-and-rescheduling),
  [frontend handoff](docs/customer-booking-frontend-handoff.md) and
  [backend handoff](docs/customer-booking-backend-handoff.md).
  **Verification:** Offline route/access/storage regression, existing customer
  booking/provider completion regressions, and final `npm run check` passed.
  Synthetic browser checks passed Chrome 155, Firefox 157 and WebKit 27.2 at
  en desktop1280/lv tablet768/ru phone375, plus Chrome native400% at CSS315×201
  for all three. Includes ownership, invalid transitions, under-lock rechecks,
  conflict/retry, duplicate writes, focus, reflow, session expiry, account switch
  and failed follow-up refresh. No current local check failures remain.
  **Limits/recovery:** No live booking changed, private configuration read,
  connected DB/service access, schema/migration change or deployment. No fee/refund
  behavior added. Physical devices/screen readers/live acceptance are unverified.
  ar/RTL, zh, fr, de, hi, ja, pt and es testing is deferred; translations maintained.
  Revert only attributable hunks/new files, preserving pre-existing dirty work.

## Search resilience

- [x] **TASK-027 — Keep service browsing available when Google Maps is unavailable.**
  **Completed locally, 23 October 2026:** Explicit browse-without-location
  fallback uses the existing catalog API and preserves applied filters and
  remembered preferences. Radius/distance controls are disabled without location;
  GPS remains independent of Google. Bounded Maps loading and a direct list
  action recover from missing keys, failed imports and authentication failure.
  Initial location prompting remains, with immediate opt-out during restoration;
  late saved-address resolution cannot override the browsing choice.
  **Authority:** User request plus AGENTS standing cooperation; assigned Front
  End Developer `/root/maps_fallback_frontend` implemented local frontend code,
  translations and mocked tests. Root reviewed the API contract, failure paths,
  evidence and English desktop/Russian phone screenshots.
  **Verification:** Loader/map lifecycle/public-search UI/frontend-only guest
  regressions, final TypeScript and Vite build pass. Mocked Chrome fallback
  (6 groups/12 viewport-locale cases) and saved-location (7 groups) pass.
  Fresh language coverage en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es
  deferred. Full guest runner's backend section remains unverified because its
  existing audit guard rejects the synthetic target; frontend-only checks pass.
  **Limits/recovery:** No backend/schema changes, new provider/dependency/cache,
  connected execution or deployment. TASK-025/026 release gates remain separate.
  Revert only attributable hunks, preserving pre-existing work. See the
  [owner handoff, commands and evidence](docs/google-api-fallback-handoff.md).

## Audit

- [x] **TASK-014 — Build reliable audit storage and delivery.** Add the separate
  audit database, restricted credentials, event schema, and application outbox.
  Record business changes and their events in one transaction. Add a delivery
  worker with retries, duplicate protection, backlog monitoring, and recovery.
  Test audit-database outages without losing events or stopping normal reads.
  **Completed for prototype development, 23 October 2026.** All twelve fixed
  synthetic events passed connected delivery, rollback, retention, concurrency,
  real lease expiry, duplicate/conflict and outage/catch-up checks. Temporary test
  access is revoked; final active profiles and a bounded healthy worker run passed
  with zero backlog. Protected capture/worker configuration is enabled; remote
  Auth remains disabled for TASK-015. No daemon, HTTP server or production
  deployment was started. Use `npm run audit:worker` alongside the prototype.
  See [acceptance, recovery and limits](docs/audit-completion-execution.md).
  **Historical execution stages follow; earlier incomplete states are superseded
  by the completion evidence above.**
  **Completion authorized, 23 October 2026:** User approved all actions required
  to complete TASK-014. DB and Backend resume the remaining necessary development
  provisioning, connected rehearsal, integration and activation under the
  [completion scope and acceptance record](docs/audit-completion-execution.md).
  Reuse that approval for covered phases; protect secrets, preserve applied SQL,
  synthetic-cohort/recovery limits and the production deployment hold. Actual
  completion still requires passing evidence; initial disabled-runtime results
  and historical phase approvals below remain preserved.
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
  **Coordination update, 23 October 2026:** User authorized direct cross-role
  requests and owner-accepted local implementation without repeated permission
  requests. [The pending dependency request](docs/agent-coordination.md#task-014--unblock-dependent-frontendbackend-work)
  routes Frontend's TASK-014 dependency to the recorded Backend/DB owners and
  identifies existing approvals and the actual verification blocker. No request
  delivery to those independent sessions, new database execution or live result
  is established by this documentation update. Preserve the destination commit,
  failed-check evidence and stop on source writes/reapply/grant repair; owners
  should reuse the authorized read-only checks and request only genuinely missing
  execution scope after preparing any needed correction.
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

  **Resumed, 23 October 2026:** User requested continuation of TASK-014 after
  selecting audit foundations before paid billing activation. General Manager
  resumed the recorded Back End Developer `/root/audit_backend` and DB
  Analyst/Developer `/root/audit_database` assignments. Scope: local review,
  corrections and isolated verification of capture/delivery, and completion of
  the already selected Choice 1 runtime-account/rehearsal package. Backend owns
  `server/audit/*`, audit-only unit tests and its handoff; DB owns new 0003
  SQL/runtime helpers, the bounded DB rehearsal runner and execution handoff.
  No frontend, private configuration/credential access, connected database or
  provider operations, app startup, deployment or billing implementation.
  Preserve installed migrations and unrelated workspace changes. Final connected
  execution approval is still required by the runtime proposal; prepare exact
  commands, safeguards, validation and recovery before requesting it. Validate
  offline first and obtain Backend compatibility/security review. Recover by
  reverting only this continuation's attributable edits; retain earlier evidence.
  Current language verification remains en/lv/ru; the other eight languages,
  including Arabic/RTL, are deferred. TASK-014 remains open pending live evidence.
  **Local continuation result:** Backend tightened restricted-runtime checks to
  reject replication privilege and every unexpected role membership. The three
  isolated audit suites and no-cache TypeScript check pass; live catalog semantics
  remain unverified. DB preparation now provides an inert-import, fixed-target
  `offline`/read-only `preflight` helper and offline contract/metadata-driver
  checks. New 0003 SQL remains unapplied. No apply, credential provisioning,
  private multi-file cutover or connected rehearsal mode is implemented yet.
  The selected sixteen-table grant plan also omits the newly declared saved-
  location table. Keep app cutover blocked pending a reviewed scope choice.
  Next reviewable operation is bounded catalog-only preflight on the existing
  development source/audit pair, with privately read configured URLs and verified
  TLS; it needs final connected-access approval. No business/audit-row reads,
  grants, fixtures, private-file/ACL writes or activation are included.
  Fresh database-preparation checks pass (239 offline checks, script syntax and
  PowerShell parsing); they prove no live SQL/ACL/queue behavior. The
  [execution handoff](docs/audit-runtime-execution.md) gives the exact supported
  preflight command, read scope, safeguards and recovery; it also lists unfinished
  provisioning/connected rehearsal work and the draft rehearsal-owner review.
  [Backend evidence](docs/audit-backend-handoff.md) records tests and review limits.
  **Metadata-preflight approval, 23 October 2026:** User replied “I do approve”
  to the prepared read-only preflight. Executor: assigned DB Analyst/Developer
  `/root/audit_database`. Exact command:
  `node migrations/audit/execute-runtime-setup.mjs preflight`. Targets remain
  development source `hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`.
  Allowed: privately read selected existing setup connection settings/public CA
  files, verify file ACLs and ignored status, connect with verified TLS, run the
  fixed bounded catalog/settings queries, then ROLLBACK and close connections.
  No business/audit-row reads, grants/DDL, fixtures, credential/configuration/ACL
  changes, application startup, activation or deployment. Guard failures stop
  without repair. Reuse this approval within scope; record sanitized outcomes
  and any prerequisite in the execution handoff. Recovery: rollback/close only;
  no persisted changes are authorized by this step.
  **Preflight attempt, 23 October 2026:** The exact approved command stopped
  locally with `PRIVATE_ACL_OR_IGNORE_FAILED` before configuration-content/CA
  reads, database connections or SQL. Bounded metadata diagnosis confirmed the
  Windows identity and all five ignore checks pass; the selected existing `.env`
  has current-user ownership but inherited/unprotected ACLs (four rules), outside
  the selected current-user-only policy. No dedicated setup file exists. No
  sandbox/network rejection occurred and no guard was bypassed. DB Analyst is
  preparing a reversible ACL-only protection operation and recovery for review;
  the approved preflight excludes ACL changes. TASK-014 remains open and auditing
  remains inactive; record the concrete prerequisite and result in its handoff.
  The [preflight report](docs/audit-preflight-report.md) records the actual output
  and bounded local observations; there is no new live-database evidence.
  **ACL prerequisite prepared:** `migrations/audit/protect-existing-env.ps1`
  defaults to metadata-only `plan`; fixed-file `protect`/`restore` operations
  await separate user approval. Plan confirms inherited four-rule `.env` ACL
  and absent recovery/temp files. Parser and 23 pure in-memory tests pass;
  Backend reviewed the exact ACL-only action and recovery. Proposed change:
  current-user-only `.env` DACL, with original permission SDDL/non-content
  metadata in protected ignored `.env.audit-acl-before.local`; no `.env`
  content read/write, owner/group/SACL assignment or database operation.
  Other Windows accounts lose normal read access; documented local development
  runs as the current user. Restore only applies to matching expected ACL/file
  metadata; unexpected drift stops for review with backup retained. No ACL or
  recovery-file write occurred. After separately approved protection succeeds,
  reuse the existing preflight approval without asking for it again.
  **ACL-protection approval, 23 October 2026:** User replied “yes I do aprove”
  to the reviewed permission-only fix and protected recovery file. Executor:
  assigned DB Analyst/Developer `/root/audit_database`. Allowed exact operation:
  `protect-existing-env.ps1 -Mode protect` on this workspace's `.env`, creating
  only the fixed protected ignored `.env.audit-acl-before.local` permission-
  metadata recovery record through its fixed temporary path. Preserve `.env`
  contents, owner/group/SACL; guarded `-Mode restore` is covered as the documented
  recovery. Verify the resulting current-user-only ACL and recovery record;
  stop on unexpected drift. Then reuse the already-approved metadata preflight
  on the named development application/audit projects. No database writes,
  grants, fixtures, credential/content changes, application startup, activation
  or deployment are included. Record sanitized actual outcomes in the preflight
  report; keep recovery evidence protected and retained.
  **Approved prerequisite result:** Protection succeeded; `.env` has the
  verified protected single current-user DACL and the ignored protected recovery
  record is retained. Contents were not opened/rewritten; non-content metadata
  was verified unchanged. The subsequent preflight hit a Node-child Windows
  PowerShell module-resolution issue: `Get-Acl` was unavailable there, while the
  direct ACL verifier passed. DB corrected the verifier to import the installed
  security module from its exact `$PSHOME` location before the unchanged checks.
  Backend accepted the narrow fix; 243 affected offline checks and PowerShell
  parsing pass, including Node-child module resolution with no private-file or
  database access. Reuse the existing preflight approval; do not rerun protection
  or change permissions again merely to retry the diagnostic.
  **Metadata result, 23 October 2026:** The approved preflight now passed on
  both named development projects over verified TLS. A sandboxed attempt stopped
  with `ENOTFOUND`; automatic review accepted the exact network-enabled retry.
  Both report PostgreSQL 17/UTF8 and the intended setup identity. Source catalog
  checks match the selected sixteen tables/ten sequences and RLS/owner/policy
  expectations, with no additional live application tables; the repository's
  seventeenth saved-location table remains pending. Source outbox/enqueue/claim
  and destination events/accept objects are present. Runtime/rehearsal names are
  free; runtime accounts are not yet installed. Setup-owner membership is
  ADMIN-only (effective USAGE/SET false), compatible with controlled maintenance.
  PUBLIC permanent CREATE is absent on both. Statement logging is not disabled;
  this inspection does not establish safe password/provider logging. No database
  writes, business/audit-row reads, fixtures, activation or deployment occurred.
  **Next package prepared and reviewed:** Disabled-runtime-only installer,
  destination then source 0003 runtime SQL, all new accounts NOLOGIN,
  scoped permissions/policies and installation metadata only. No passwords,
  private runtime handoff, rehearsal objects/fixtures or application cutover.
  Backend review accepted; 238 focused installer checks and 243 existing offline
  checks pass. Exact command, pinned SQL, safeguards, verification and recovery
  are in the [runtime handoff](docs/audit-runtime-execution.md#next-concrete-execution-gate-disabled-runtime-installation).
  **Execution approved, 23 October 2026:** User replied “yes” to the exact linked
  disabled-install request. Executor: assigned DB Analyst/Developer. Targets:
  source `hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`. Allowed:
  the two pinned runtime migrations, destination first, fresh metadata gates and
  scoped catalog verification; all new roles remain NOLOGIN, no passwords.
  Preserve exact owner memberships and committed/uncertain evidence; no automatic
  retry or destructive compensation. Limits and recovery remain those in the
  runtime handoff. No rehearsal, location change, application cutover, activation
  or deployment.
  **Partial result:** Both fresh compatibility gates passed. Destination
  runtime-0003 committed with its version receipt and final COMMIT; its fixed
  post-install verifier then rejected the observed state. Source migration was
  not attempted. Preserve the committed disabled destination objects; no reapply,
  grant repair or source write. Bounded read-only catalog reconciliation
  completed. Confirmed: writer NOLOGIN/restricted,
  required memberships/caps, no ownership/permanent DDL, expected-only audit
  entrypoints and all six no-grant-option checks pass. Extra relation/column
  privilege checks fail. Exact cause: PUBLIC SELECT by owner `postgres` on
  `extensions.pg_stat_statements` and `extensions.pg_stat_statements_info`,
  both views; writer schema USAGE is false, no grant option. The 51 column
  SELECT observations derive solely from these relation grants; no explicit
  column ACLs or other relation privileges were found. Diagnostic-only empty-ACL
  handling was corrected/reviewed before the successful read-only retry.
  DB and Backend accepted the cross-role dependency under the new 23 October
  standing authorization. Their routine verifier correction pins only these two
  inaccessible PUBLIC SELECT views/provenance, rejects applicable column ACLs,
  schema USAGE, grant options and all other extra rights, and reports latent ACLs.
  No database grants or selected usable-access boundary changed. Continuation
  tests pass 186 checks; affected installer tests pass 242. SQL predicate clauses
  were reviewed statically; offline tests do not exercise mutated live objects.
  Root reviewed code/tests and released the first source attempt under the
  original exact source-operation approval, using
  `node migrations/audit/continue-runtime-source.mjs continue-source-disabled`.
  Destination is freshly verified read-only; source gets fresh compatibility and
  inherited-access gates before its unchanged pinned SQL. No destination reapply,
  new grants, passwords or activation. Preserve committed destination SQL bytes.
  **Source continuation result:** Fresh destination verification and source
  compatibility/inherited-access gates passed; unchanged source runtime-0003
  returned its version receipt and final COMMIT. Both runtime migrations are now
  committed. Source postflight rejected unreviewed relation/column privileges and
  extra sequence privileges; all restricted NOLOGIN-role flags, intended grants,
  required sequence USAGE, expected entrypoints, maintenance denial, six
  no-grant-option checks and sixteen RLS policies pass. No reapply, privilege
  repair, destination write during continuation or activation. Bounded read-only
  inventory identified PUBLIC grants by owner `supabase_admin` on `cron.job`
  (SELECT), `cron.job_run_details` (SELECT, DELETE), `cron.jobid_seq` and
  `cron.runid_seq` (SELECT). All four new roles have cron schema USAGE false;
  no grant options or applicable column ACLs. The 76 column SELECT observations
  are relation-derived. No other source ACL mismatches were found. DB/Backend
  accepted the same routine exact-object dormant-ACL classifier correction,
  without database grant changes, and are preparing read-only verification of
  both committed installations. Applied source and destination SQL are immutable.
  **Final result, 23 October 2026:** Reviewed read-only
  `node migrations/audit/verify-runtime-disabled.mjs` exited 0 on both targets.
  All fixed catalog checks pass: restricted NOLOGIN accounts/memberships/caps,
  intended table/column/sequence access, named inaccessible provider ACL baselines,
  required-only audit entrypoints, no grant options/ownership/permanent DDL,
  no restrictive application policies and exactly sixteen runtime RLS policies.
  Current inert setup-owner memberships stayed stable during verification;
  historical receipt+COMMIT and in-transaction restoration assertions remain the
  installation evidence, with no fresh protected ledger read. Final focused
  checks pass 264 continuation and 246 installer assertions. Raw SQL predicates
  were independently reviewed, not dynamically tested against mutated objects.
  No passwords, LOGIN, fixtures, app cutover, audit activation or deployment.
  Both migrations are applied/verified; TASK-014 remains open for secure private
  provisioning/logging safety, connected delivery rehearsals and activation gates.
  TASK-014 remains incomplete.


## Form design

- [x] **TASK-021 — Propose improvements to existing UI forms.** Assigned at the
  user's request on 19 October 2026 to Front End Developer `/root/forms_design`.
  Review representative forms and prepare
  [a design proposal](docs/forms-design-proposal.md) with layout examples,
  prioritized changes, mobile/accessibility requirements, and multilingual/RTL
  behavior. **Status, 20 October 2026:** User reviewed and approved the visual
  proposal and requested that the Front End Developer start implementation.
  Selected direction: A, consistent sectioned forms using the existing system.
  Proposal and isolated visual-preview checks are documented in the proposal;
  application implementation and its verification are tracked in TASK-022.
  **Completed at the user's request on 21 October 2026.**

- [x] **TASK-022 — Implement the approved forms design.**
  **Completed at the user's request on 23 October 2026.** Local implementation
  and available automated checks are complete. Outstanding manual release
  verification is recorded below; this status change adds no verification evidence.
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
  **Verification resumed, 21 October 2026:** User requested “resume to complete”;
  Front End Developer `/root` continued local frontend corrections and isolated
  mocked verification within the existing approval. Fixed enlarged-text overflow
  in service/booking forms and WebKit service-card booking-trigger focus.
  Fresh en/lv/ru checks pass: Firefox/WebKit service, auth, account/booking and
  operational forms; Chrome service/auth/account/booking regressions; **39 native
  400% Chrome zoom form views**; application/fixture TypeScript, production build
  and affected offline guest-search/provider-catalog/public-search UI checks.
  Historical 11-language evidence above is preserved. Current evidence, approval,
  recovery and exact coverage: [verification handoff](docs/forms-verification-handoff.md).
  **Remaining release verification:** Physical devices/virtual keyboards, screen
  readers and native-speaker review of en/lv/ru remain unverified. Task closure
  follows the user's request; full release verification remains incomplete.
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

## Service search

- [x] **TASK-023 — Design and implement service search.** User requested
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
  **Status: completed at the user's request on 21 October 2026.** Implemented
  locally; focused offline/Chrome checks pass. Application
  and fixture types, production build, public-search UI, sorting, guest-search and
  provider-catalog frontend regressions pass. Chrome: 5 groups/12 locale-viewport
  cases, English/Latvian/Russian only, zero unexpected requests/runtime exceptions.
  The other eight languages are deferred; broader browser/device/assistive-tech/
  zoom/integration release checks remain unverified, so full release verification
  stays open. Recovery and evidence: [implementation handoff](docs/search-implementation-handoff.md).

## Backend security

- [x] **TASK-020 — Address high-priority backend review findings.** Disable
  unverified payment-state changes; validate and bound public search; control
  paid semantic requests; handle rejected fallback queries safely.
  **Status:** Implemented and verified locally on 18 October 2026; not deployed.
  - Front End Developer delivered debounced search and localized validation/error
    handling. DB Analyst reviewed query changes; no database changes were needed.
  - Offline backend/storage/UI regressions, guest search, sorting, provider
    catalogs, storefronts, TypeScript, and production build passed.
  - See [implementation, verification, delegation, and remaining limits](docs/high-priority-backend-hardening.md).

## Authentication

- [x] **TASK-004 — Allow service searches without signing in.** Let visitors
  search for services and browse results without authentication.
  **Status:** Completed.
  - Browse services from the landing page/header or open `/search` without signing in.
  - Keep search filters, sorting, maps, details, reviews, and provider catalogs available.
  - Prompt for sign-in when booking; return to search after sign-in.
  - Serve published service images to visitors while protecting private images and writes.
  - Verified with `npm run test:guest-search`, existing search/auth/navigation/map
    regression tests, `npm run check`, and `npm run build`.

## Provider storefronts

- [x] **TASK-012 — Add Pro provider storefronts.** Give individual providers and
  companies a separate public page for their services, similar to a store page.
  **Status:** Completed.
  - Creating, editing, previewing, and publishing requires active workspace Pro access.
  - Visitors can browse and book; Pro is required for the provider, not the customer.
  - One company subscription covers its storefront and authorized managers.
  - Supports branding uploads, permanent shareable URLs, draft/publish controls,
    service search/filter/sort, and return to the selected service after sign-in.
  - Expiry/revocation hides the page while preserving content and existing bookings.
  - Administration manages Pro grants and expiry through searchable provider/company
    dropdowns. Payment checkout, pricing, and automatic recurring billing are not implemented.
  - See [setup, behavior, and manual testing](docs/pro-storefronts.md).
  - Database migration applied. Automated storefront, PostgreSQL, authentication,
    booking, catalog, navigation, administration, category, scheduling, review,
    and location regression checks passed, along with TypeScript and production build.
  - Manual desktop/mobile layout, real branding uploads, and a full booking flow
    were not verified during implementation; no browser session was available.

## App Administration

- [x] **TASK-010 — Create app administration page.** Create an Administration
  page for application support staff with a list of all registered app users.
  **Status:** Completed.
  - Page results with 25, 50, or 100 users per page and show the matching count.
  - Search/filter by name/email and an inclusive registration date range in the
    timezone shown on the page.
  - Display email verification status (verified / pending verification) and account
    status (active / blocked) as separate columns, with independent filters for each.
  - Sort by name or date registered, ascending or descending, before pagination.
  - Show all company / organization affiliations, roles, and closed-company status.
  - Search by company / organization name across the full user directory.
  - Show personal Pro subscription status and expiry, with separate company Pro
    badges on each affiliation. Expired or revoked Pro is not enabled.
  - Verified with administration and storefront UI/API regressions, PostgreSQL
    Pro status/expiry/revocation checks, `npm run check`, and `npm run build`.

## Scheduling

- [x] **TASK-006 — Add preparation and cleanup time.** Allow providers to add
  extra time after a service for cleaning the workspace and preparing for the
  next customer. Include this time when checking availability and preventing
  overlapping appointments.
  **Status:** Completed.
  - Add a translated preparation/cleanup field to the service editor, defaulting
    to zero, and preserve it when copying services.
  - Include the entire service plus cleanup interval in daily/monthly availability,
    working hours, breaks, employee conflicts, booking creation, and rescheduling.
  - Save trusted duration and cleanup snapshots on each booking so listing edits
    do not change existing reservations. Customer appointment duration excludes cleanup.
  - Apply the additive migration to the configured database, preserving existing
    reservations with zero extra minutes. Other databases need
    `npm run db:setup-cleanup-time`; see [setup and behavior](README.md#preparation-and-cleanup-time).
  - Verified with `npm run test:cleanup-time`, `npm run test:cleanup-time-db`,
    provider navigation, customer bookings, booking completion, guest search,
    provider catalog regression tests, `npm run check`, and `npm run build`.

## Categories

- [x] **TASK-011 — Move hardcoded categories to a separate database table.**
  Allow application administrators to manage categories from `/administration`.
  **Status:** Completed.
  - Add, edit, and delete categories under Administration → Categories, using the
    existing application administrator allowlist. Company roles do not grant access.
  - Read the shared catalog in provider forms, search filters and chips, service
    details, card placeholders, and landing previews.
  - Keep stable category keys, reject unknown service categories, and prevent
    deleting categories referenced by services, including inactive listings.
  - Apply the category migration to the configured database, preserving existing
    services and category keys. Other databases need `npm run db:setup-categories`.
    See [category setup and behavior](docs/categories.md).
  - Verified category UI/API tests, real PostgreSQL migration/constraint/security
    checks, administration, guest search, provider navigation/catalog and search
    sorting regressions, `npm run check`, and `npm run build`.

## Map view

- [x] **TASK-001 — Replace service markers with location pins.** Replace the
  current green circle markers with recognizable map location icons.
  **Status:** Completed

- [x] **TASK-002 — Show a service preview card on hover.** Show a compact card
  with the service name and a simplified description when hovering over a
  service marker, similar to Booking.com's map previews.
  **Status:** Completed.
  - Hover a service pin for a compact name and plain-text description excerpt.
  - Keep one preview open at a time, without panning the map or taking focus.
  - Move into the preview to read it or select View details; clicking a pin
    continues to open service details directly for touch and keyboard users.
  - Dismiss on Escape, the close button, map click/drag/zoom, filtering, or unmount.
  - Translate preview labels and map messages across all 11 supported languages.
  - Verified hover timing, safe text rendering, selection callbacks, translations,
    location retention, and timer/listener cleanup with `npm run test:maps`, guest
    search regressions, `npm run check`, and `npm run build`.
  - Manual desktop/touch layout was not verified during implementation; no browser session was available.

## Ratings
- [x] **TASK-007 — When service is completed.** Ask customer to review service quality based on 5 star principle. Allow option to add comment. If user rates less than 3 stars, make comment mandatory.
  **Status:** Completed.
  - Prompt customers on My Bookings for completed, unreviewed appointments.
  - Allow one 1–5 star review per booking; require a nonblank comment below 3 stars.
  - Preserve drafts on failed saves and display saved reviews in booking history.
  - Customers can edit or delete their own saved reviews from booking history.
    Edits use the same validation and preserve the original date. Deletion requires
    confirmation; ratings, counts, public review lists, and search results refresh.
  - Return real service rating averages and counts for display and TASK-009 sorting.
  - Click ratings on service cards or details to read customer reviews with stars,
    optional comments, reviewer names, and translated relative dates, newest first.
    Review lists have 20 items per page and exclude emails and booking details.
  - Existing databases need `npm run db:setup-reviews` before running the updated app.
    Applied to the currently configured database; existing customer data was preserved.
  - Verified with `npm run test:reviews`, `npm run test:public-reviews`,
    `npm run test:reviews-db`, booking and
    search regression tests, `npm run check`, and `npm run build`.

## Appointments

- [x] **TASK-008 - Create separate Appointments page.** Currently Customer can see own bookigs by clicking on Calendar icon. Create new button similar to "My Services" and label it "My Bookings"
  **Status:** Completed.

## Searching
- [x] **TASK-009 - Add option to Sort found search results**
  **Status:** Completed. Rating sorting now uses real review averages from TASK-007.
  Sort options ascending or descending: distance, price, and rating.
  - Sort ascending or descending using the translated "Sort results" control.
  - Distance sorting requires a search location; clearing it restores recommended order.
  - Missing values appear last in both directions; equal values keep their search order.
  - Display real ratings and review counts, or "Not rated yet" for unreviewed services.
  - Verified with `npm run test:search-sorting`, `npm run check`, and `npm run build`.
