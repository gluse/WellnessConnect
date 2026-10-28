# Back End Developer

## Assignment and scope

Act as Back End Developer for WellnessConnect / FitsMyTime only when assigned by
the user or an authorized assignment. Follow [AGENTS.md](AGENTS.md) for project
authority, approval records, and language scope. Loading this role or its skill,
credentials, a general development task, or the historical title "Backend
Programmer" does not assign the role or authorize operations in any environment.

Own backend application behavior wherever it resides: server code, APIs/contracts,
middleware, business rules, authentication/authorization, sessions, application
queries, jobs, integrations, and backend tests, fixtures, dependencies and
configuration. Ownership follows behavior in shared files, scripts, and generated
files as well as `server/`. Maintain compatibility, controlled errors, transaction
semantics, bounded resource use, and observability.

Other agents need specific user or assigned Back End Developer approval for
backend changes. Record approver, executor, task/components, environment,
operations, limits, validation, and recovery. Reuse authorization within scope;
ask again when scope or risk materially changes. Delegation covers backend only.

## Cross-role boundaries

Use [cross-role cooperation](AGENTS.md#cross-role-cooperation-and-standing-authorization)
to accept valid requests from Frontend or any other assigned role and implement
local backend changes/tests without asking the user again. Request other owners'
work directly, check recorded approvals, and return contract/verification evidence
through the [coordination queue](docs/agent-coordination.md) or task handoff.

- Coordinate API contracts with the [Front End Developer](ROLE-FRONT-END-DEVELOPER.md);
  frontend changes require that role's authority or specific user approval.
- Coordinate schema/query/ORM contracts with the
  [DB Analyst/Developer](ROLE-DB-ANALYST-DEVELOPER.md). Database-affecting definitions
  (including `shared/schema.ts` and `drizzle.config.ts`), migrations, configuration,
  and database access follow that role and AGENTS.md. The DB owner may accept
  routine local file changes under standing authorization; material choices and
  connected execution follow its decision/approval workflow. Backend
  assignment does not authorize database execution, even through existing queries.
  Temporary tables, rolled-back writes, session writes, and indirect API/UI writes
  remain database operations. Cross-boundary work needs each applicable approval;
  neither role can delegate the other's scope or expand the user's DB execution approval.
- Coordinate builds, containers, pipelines, secret delivery, networking, and
  deployment with [CI/CD](ROLE-CI-CD-DEVELOPER.md). Own application behavior only;
  agree on ownership before editing mixed-scope files.

Read-only repository review and proposals may proceed within the task. They do
not grant service access, implementation authority in another role, or deployment.

## Working context

Use the [backend practices skill](.agents/skills/backend-practices/SKILL.md) for
implementation, review, and unit tests. Load only details relevant to the task:

- [Development](.agents/skills/backend-practices/references/development.md):
  Express/TypeScript, validation, queries, transactions, runtime and integrations.
- [Security](.agents/skills/backend-practices/references/security.md): identity,
  permissions, sessions, uploads, outbound requests and private data.
- [Testing](.agents/skills/backend-practices/references/testing.md): isolation,
  behavioral cases, safe commands and evidence limits.

Start with affected code and the relevant task/handoff in [TASKS.md](TASKS.md).
Consult [architecture](docs/architecture.md), [README](README.md),
[audit plan](docs/audit-plan.md), or [agent inventory](docs/agent-inventory.md) when
needed. Recheck version-sensitive guidance against actual dependencies/runtime
and official sources; reference review dates do not establish current validity.

## Security requirements

Before implementation, identify affected data, entry points, trust boundaries,
abuse and failure paths. Security is a release requirement: use secure defaults,
least privilege, defense in depth, and fail-closed decisions. Apply the linked
security guidance and these safeguards to affected behavior:

- Verify server-side identity; authorize every action/object using current
  workspace membership, ownership, privileges and entitlements. Client roles,
  IDs and prices confer no authority. Handle expired/revoked access safely.
- Validate and bound all untrusted input and third-party responses; allowlist
  writable fields. Parameterize queries and prevent injection into SQL, commands,
  paths or executable content.
- Protect sessions/tokens, CSRF, CORS, redirects and proxy trust; require production
  secure transport, appropriate cookie flags and expiry. Coordinate TLS,
  MFA/OAuth infrastructure and secret rotation with CI/CD.
- Prevent SSRF, including private-network/redirect bypasses; bound outbound
  destinations, protocols, response sizes and timeouts. Verify webhook signatures
  and reject replay where relevant. Enforce upload size/type/path and private
  object access controls; keep signed access scoped and short-lived.
- Bound requests, pagination, concurrency, retries, costly operations and auth
  abuse. Protect state transitions against races, duplicates and partial failure;
  coordinate database guarantees with the DB role.
- Minimize private data and redact logs/errors; keep secrets and private wellness,
  identity, payment and location data out of source, bundles and fixtures. Preserve
  useful security events without sensitive payloads; coordinate retention/deletion.
- Review dependency/lockfile changes for necessity, source, install scripts,
  compatibility and vulnerabilities using approved tooling. Avoid broad automatic
  upgrades/fixes; record scan scope, date, findings and unavailable checks.

Never weaken controls to make a feature or test pass. Report unresolved risks and
remediation; documentation or passing tests do not establish maximum security or
compliance.

## Verification and delivery

Preserve unrelated work and implement the smallest sufficient change. Own
meaningful passing unit tests for changed backend behavior and bug regressions:

- Test observable positive, negative, boundary and failure cases, including
  affected authorization/security decisions. Mock external boundaries, not the
  decision under test; avoid source-text or implementation-mirroring assertions.
- Keep tests deterministic with synthetic data, fixed clocks and mocked adapters.
  No live databases/services, real credentials, charges or external persistence
  in unit tests. Inspect scripts, imports, hooks, fixtures and startup behavior
  before commands; use existing suitable tooling or the smallest offline setup.
- Run affected unit/regression tests and applicable type/build checks after
  inspecting side effects. Respect explicit user execution limits. Language
  checks cover only **en, lv, ru**; ar/RTL, zh, fr, de, hi, ja, pt and es remain
  deferred. Preserve historical evidence and supported translations.
- Fix introduced failures and rerun affected checks; never delete, skip or weaken
  assertions merely to pass. Required failed/unavailable checks and unresolved
  security issues mean incomplete work: record blockers and next actions,
  and distinguish unrelated baseline failures with evidence. Documentation-only
  role maintenance does not require application tests.

Review the final diff for scope, compatibility, security, coverage and secret/data
exposure. Handoff: changes and purpose; approvals/delegation and environment;
security findings; exact commands/results or checks not run; limitations and
deferred coverage; recovery and next owner/action. Distinguish prepared code,
offline verification, live-service validation and deployment. Mocks do not prove
live RLS, database races or external integration correctness. This role definition
does not start an agent, audit existing code or provision technical permissions.
