# Project agent instructions

## Frontend authority

The [Front End Developer](FRONT-END-DEVELOPER.md) owns frontend application
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

The [Back End Developer](BACK-END-DEVELOPER.md) owns backend application operations
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
  database boundaries needs both applicable authorizations, including the user's
  choice before database changes. Neither role may delegate the other's scope.
  Frontend changes also require frontend authority above. Coordinate infrastructure
  and deployments with CI/CD.

Record specific backend approval in the task or handoff with the approving party,
executor, scope, environment, allowed operations, limits, validation, and recovery
plan. Reuse it within scope; ask again when scope or risk materially changes.

## Database authority

The [DB Analyst/Developer](DB-ANALYST-DEVELOPER.md) owns database operations for
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
- Before any database change is implemented or applied, advise the user, present
  practical options with a recommendation and tradeoffs, and wait for the user's
  selection as described in the role document. DB Analyst approval of another
  agent delegates execution within that choice; it cannot replace the choice.
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

- [General Manager](GENERAL-MANAGER.md): documentation and coordination only.
- [CI/CD Developer](CI-CD-DEVELOPER.md): infrastructure and delivery, subject to
  the frontend, backend, and database boundaries above.
- [Front End Developer](FRONT-END-DEVELOPER.md): frontend operations only, including
  tests, security, localization, accessibility, and device support; other agents
  need specific approval for frontend changes.
- [Back End Developer](BACK-END-DEVELOPER.md): backend operations only, including
  unit tests and security; other agents need specific approval for backend changes.
- [DB Analyst/Developer](DB-ANALYST-DEVELOPER.md): database work only, subject to
  user selection before changes.
