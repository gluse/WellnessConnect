# Project agent instructions

## Test language scope

User instruction, 20 October 2026, effective for future testing: test only
English (`en`), Latvian (`lv`) and Russian (`ru`). Do not run all 11 languages.
This applies to locale/resource validation, component tests and browser matrices.
Check existing runners before invoking them and restrict their language coverage
to these three; do not execute hard-coded checks for the deferred languages.

Arabic (`ar`, including RTL verification), Chinese (`zh`), French (`fr`),
German (`de`), Hindi (`hi`), Japanese (`ja`), Portuguese (`pt`) and Spanish (`es`)
are deferred for later verification. Record them as deferred in task/handoff
records; do not treat them as current acceptance blockers or claim fresh coverage.
Preserve existing historical evidence. Continue maintaining supported translations;
this instruction changes testing scope, not supported application languages.
This user-selected scope takes precedence over broader language-test matrices
in role documents, skills, proposals and earlier task records.

## Cross-role cooperation and standing authorization

User instruction, 23 October 2026: all project roles may contact one another to
resolve dependencies. The receiving owner evaluates the request and, when valid,
implements it within the scope below without another user permission round.
This section supersedes older requirements to obtain a fresh approval for every
local dependency or local database-file change. Specific execution holds remain.

- Any assigned role may request work from another owner directly; General Manager
  mediation is optional. Link the originating task, problem/contract, acceptance
  criteria, affected files, environment, and known approvals/limits. Product and
  management roles may route dependencies of accepted work; an unapproved product
  proposal does not become an implementation assignment merely by routing it.
- The receiving assigned owner decides validity, compatibility, security and
  priority. Acceptance authorizes that owner to implement necessary, reversible
  local repository changes and offline/mocked tests for the accepted task. This
  includes frontend, backend, database migration/ORM files and infrastructure
  files in their respective roles. Record acceptance and proceed; do not ask the
  user to approve the same dependency, files or covered checks again. Routine
  local technical choices belong to the owner; explain the choice in the handoff.
- Ownership still applies: request backend work from Backend, database work from
  DB, and so on. An owner may explicitly delegate its own accepted scope and
  review the result; requesting work does not let the requester edit that scope.
  Coordinate mixed files and interface contracts before concurrent edits.
- Before declaring a permissions blocker, inspect TASKS.md, the relevant handoff
  and [the coordination queue](docs/agent-coordination.md). Reuse recorded user
  choices and operation/environment approvals. If approval names another
  executor, route to that executor or obtain a permitted delegation from its
  owning role; do not silently transfer executor-specific access. Role acceptance
  alone does not expand a recorded connected-operation approval.
- Connected database/service access and writes, private configuration/credentials,
  ACL changes, deployment, publishing, spending and destructive operations need
  existing authorization for the exact action and target. New material product,
  architecture, data/retention or security-policy decisions still go to the user.
  Complete authorized preparation first, then ask only for the missing decision
  or execution scope. Preserve explicit stop-on-failure/no-retry instructions and
  deployment holds; this standing authorization does not lift them.
- Use available agent tools to contact/reuse a reachable owner. If needed, an
  assigned role may spawn a clearly assigned owner agent for the scoped dependency
  and give it the task, limits and file ownership. Do not create a duplicate worker
  when an owner is already working on it. If another session cannot be contacted,
  persist a request in the coordination queue, report the control limitation, and
  continue independent work. Saved session IDs do not prove a live/delivered request.
- Track requested, accepted, in progress, blocked and completed states in the task
  or queue. Record requester/owner/executor, scope, approval source, checks,
  recovery and next action; use links instead of copying approval histories.
  The owner returns implementation and verification evidence to the requester,
  who checks the integrated contract. A blocker must name the actual missing
  decision/capability/check, its owner, and what can proceed meanwhile.

## Frontend authority

The [Front End Developer](ROLE-FRONT-END-DEVELOPER.md) owns frontend application
operations and changes for WellnessConnect / FitsMyTime. Read that role before
frontend work. Use the project-local
[frontend practices skill](.agents/skills/frontend-practices/SKILL.md) for UI work,
security, localization/RTL, device support, accessibility, and tests within scope.
This rule applies to every project agent, including backend, database, CI/CD,
review, and management sessions.

- Frontend changes must be performed by an assigned Front End Developer or an
  agent with specific approval from the user or that assigned role for the task,
  components, environment, and operations. General development assignments,
  credentials, and other roles do not grant frontend authority. Do not assume
  the role to bypass this boundary.
- This includes pages/components, browser logic, navigation, forms, state/data
  fetching, styles/design tokens, frontend assets, user-facing content/translations,
  accessibility/responsive behavior, frontend tests, and frontend-specific
  dependencies/configuration. Ownership follows behavior in shared files, scripts,
  copied components, and generated changes as well as files under `client/`.
- Read-only repository review and proposals may proceed within an assigned task.
  Route implementation to the role or obtain specific approval first.
- The Front End Developer owns meaningful tests for frontend changes and must
  make sure they pass. Follow the role's security, multilingual/device support,
  accessibility, test isolation, verification, and handoff requirements. Required
  failed/unavailable checks and unresolved security issues mean incomplete work.
- Frontend authority does not grant backend, database, infrastructure, or deployment
  authority. Cross-boundary work needs each applicable authorization; no role may
  delegate another role's scope. Browser/API tests that persist data, including
  session records, require the database approval below.

Record specific frontend approval in the task or handoff with approving party,
executor, scope, environment, allowed operations, limits, validation, and recovery.
Reuse it within scope; ask again when scope or risk materially changes.

## Backend authority

The [Back End Developer](ROLE-BACK_END_DEVELOPER.md) owns backend application operations
and changes for WellnessConnect / FitsMyTime. Read that role before backend work.
Use the project-local [backend practices skill](.agents/skills/backend-practices/SKILL.md)
for backend implementation, review, and unit tests within authorized scope.
This rule applies to every project agent, including frontend, database, CI/CD,
review, and management sessions.

- Backend changes must be performed by an assigned Back End Developer or an agent
  with specific approval from the user or that assigned role for the task,
  components, environment, and operations. General development assignments,
  credentials, and other role titles do not grant backend authority. Do not
  assume the role to bypass this boundary.
- This includes server code, APIs, middleware, business logic, authentication and
  authorization, sessions, application queries, integrations, background jobs,
  backend tests, and backend-specific dependencies/configuration. Apply ownership
  by behavior, including shared files, scripts, and generated changes.
- Read-only repository review and proposals may proceed within an assigned task.
  Route implementation to this role or obtain specific approval first. Existing
  workflows using the title "Backend Programmer" must follow this role's authority;
  the historical title does not itself assign the role or approve changes.
- The Back End Developer owns meaningful unit tests for backend changes and must
  make sure they pass. Follow the role's security requirements, test isolation,
  verification, and handoff rules. Report failed or unavailable required checks
  and unresolved security issues as incomplete work.
- Backend ownership does not grant database authority. Work crossing backend and
  database boundaries needs both applicable authorizations under the standing
  cooperation and database rules. Neither role may delegate the other's scope.
  Frontend changes also require frontend authority above. Coordinate infrastructure
  and deployments with CI/CD.

Record specific backend approval in the task or handoff with the approving party,
executor, scope, environment, allowed operations, limits, validation, and recovery
plan. Reuse it within scope; ask again when scope or risk materially changes.

## Database authority

The [DB Analyst/Developer](ROLE-DB-ANALYST-DEVELOPER.md) owns database operations for
WellnessConnect / FitsMyTime. Read that role's authority and approval workflow
before undertaking database work. This rule applies to every project agent,
including application, CI/CD, review, and management sessions.

- Database changes, writes, and full or privileged database access belong to the
  DB Analyst/Developer. Other agents need specific approval from the user or an
  assigned DB Analyst/Developer for the operation, target environment, and scope.
  Possession of credentials or a general development assignment is not approval;
  do not assume the DB role to bypass this boundary.
- This includes schema, migration and database setup changes, data corrections,
  imports, deletes, SQL functions/triggers/jobs, indexes, constraints, extensions,
  grants/RLS, database configuration, and backup/restore operations. It also covers
  database-affecting ORM definitions and migration configuration.
- For accepted routine local database-file dependencies, use the standing
  authorization above: the DB owner records its technical choice and implements
  without a new user selection. For material decisions or connected changes
  outside existing approval, present practical options/recommendation and obtain
  the missing user choice/execution scope under the role workflow. DB delegation
  cannot expand an existing selection or connected-operation authorization.
- Inspect repository code and prepare proposals without database access. Other
  agents may use non-privileged read-only database access only when already
  authorized for that task; otherwise route the inspection to the DB role.
- Check commands for database side effects before running them. `db:push`,
  `db:setup-*`, transfers, seed/setup SQL, database tests (including temporary
  tables and rolled-back writes), and app/API/UI tests that persist data fall
  under this rule. Indirect writes through scripts, containers, startup hooks,
  CI, or application endpoints are still database operations.
- Authorized application developers may work on application code and offline or
  mocked tests within their role; frontend/backend changes follow the respective
  authority above. Coordinate ORM/query/API changes needed by a database proposal
  with the DB role, and obtain specific approval for database-affecting changes
  and any execution against a database. Existing application behavior does not
  grant an agent permission to exercise write paths against a connected database.

Record the user's selected option and any delegated approval in the task or
handoff, with the approving party, executor, environment, operations, limits,
validation, and recovery plan. Reuse an existing approval within its recorded
scope; ask again when scope or risk materially changes.

These are agent operating instructions. They do not provision credentials or
enforce technical access controls.

## Role selection

Role files define responsibilities when that role is assigned; they do not assign
every session the same role. Existing roles:

- [General Manager](ROLE-GENERAL-MANAGER.md): documentation and coordination only.
- [Product Manager](ROLE-PRODUCT-MANAGER.md): product discovery, growth and retention
  proposals, prioritization, monetization, and cost/income analysis; documentation
  and research only, subject to the implementation and database boundaries above.
- [CI/CD Developer](ROLE-CI-CD-DEVELOPER.md): infrastructure and delivery, subject to
  the frontend, backend, and database boundaries above.
- [Front End Developer](ROLE-FRONT-END-DEVELOPER.md): frontend operations only, including
  tests, security, localization, accessibility, and device support; other agents
  need specific approval for frontend changes.
- [Back End Developer](ROLE-BACK_END_DEVELOPER.md): backend operations only, including
  unit tests and security; other agents need specific approval for backend changes.
- [DB Analyst/Developer](ROLE-DB-ANALYST-DEVELOPER.md): database work only, under the
  standing cooperation and database decision/execution rules above.
