# Project agent instructions

## Project basics and architecture

- **Language:** TypeScript with strict checking; supporting scripts also use JavaScript.
- **Frameworks:** React with Vite on the frontend; Node.js/Express on the backend.
- **Package manager:** npm with root `package.json` and `package-lock.json`; use `npm ci`.
- **Structure:** one full-stack application in a single npm package, with a monolithic
  web server and separate worker entry points; not an npm-workspaces monorepo.
  `client/` holds the UI, `server/` the backend, and `shared/` shared types/validation.
- **Backend:** REST-style HTTP/JSON APIs under `/api`; Express serves the React SPA.
  React renders in the browser; the application does not use GraphQL or React SSR.
- **Database:** PostgreSQL through Supabase; Drizzle ORM/query builder with `pg`.
  Supabase also supplies authentication and private image storage.
- **Tests:** custom `node --import tsx scripts/test-*.mjs` runners using
  `node:assert/strict` (some use `node:test`), React `react-test-renderer`, and
  Chromium/optional Playwright browser harnesses. See `package.json` and the
  relevant role's testing guidance; do not assume Jest/Vitest or automatic discovery.

## Code style

- Use camelCase for variables/functions, PascalCase for React components/types,
  and `use` prefixes for hooks; follow nearby constant and filename conventions
  (client files generally kebab-case; existing backend names vary).
- Use ESM imports/exports and type-only imports for types. Use `@/` for client
  imports, `@shared/` for shared code, and relative paths for nearby modules;
  preserve Node runtime compatibility in server/scripts and intentional side-effect imports.
- Match the surrounding formatting; avoid unrelated reformatting or renaming.
- Comment on intent, constraints, security decisions, or surprising behavior;
  avoid narrating obvious code and keep comments accurate when behavior changes.

## AI agent rules

These rules apply alongside the ownership, approval, and testing requirements below.

### Critical rules

- Never remove existing log statements; redact sensitive payloads while preserving the event.
- Never commit secrets, API keys, private environment files, or credentials, or expose them in logs/client bundles.
- Never modify existing migration files directly; route new versioned migrations to the DB owner under the approval rules below.
- Never overwrite unrelated workspace changes or bypass recorded execution guards/holds.
- Never weaken authorization, workspace isolation, runtime validation, or required checks to make a change pass.

### Key patterns

- Prefer typed object parameters when multiple positional arguments could be confused; preserve existing public contracts unless an authorized change requires otherwise.
- Prefer discriminated unions for complex state with mutually exclusive variants.
- Handle every async failure explicitly using query/mutation error states or `try/catch`; use React error boundaries for rendering failures, not as a substitute for promise/event-handler error handling.
- Forward unhandled Express 4 async errors to error middleware using `next(error)` or an existing verified wrapper.
- Validate untrusted inputs with Zod and use parsed values; parameterize database queries.
- Reuse existing UI/data-access helpers and keep account/workspace scope in authorization and cache keys.

## Test scope

User instruction, 20 October 2026: test only English (`en`), Latvian (`lv`), and
Russian (`ru`) across locale/resource validation, components, and browser matrices.
Inspect runners first; restrict coverage and do not execute hard-coded checks for
other languages. Arabic (`ar`, including RTL), Chinese (`zh`), French (`fr`),
German (`de`), Hindi (`hi`), Japanese (`ja`), Portuguese (`pt`), and Spanish (`es`)
are deferred: record this in task/handoff records, preserve historical evidence,
and neither claim fresh coverage nor treat them as acceptance blockers. Continue
maintaining all supported translations. This scope overrides broader matrices in
roles, skills, proposals, and earlier records.

## Roles and authority

Role documents define responsibilities **when assigned**; they do not assign roles.
Read the applicable role before work. These boundaries apply to every project agent.

| Role | Owned scope / required guidance |
| --- | --- |
| [General Manager](ROLE-GENERAL-MANAGER.md) | Documentation and coordination only |
| [Product Manager](ROLE-PRODUCT-MANAGER.md) | Research/documentation: discovery, growth, retention, prioritization, monetization, cost/income proposals |
| [CI/CD Developer](ROLE-CI-CD-DEVELOPER.md) | Infrastructure and delivery, subject to application/database boundaries |
| [Front End Developer](ROLE-FRONT-END-DEVELOPER.md) | Frontend operations; use [frontend practices](.agents/skills/frontend-practices/SKILL.md) |
| [Back End Developer](ROLE-BACK_END_DEVELOPER.md) | Backend operations; use [backend practices](.agents/skills/backend-practices/SKILL.md) |
| [DB Analyst/Developer](ROLE-DB-ANALYST-DEVELOPER.md) | Database operations under its authority/approval workflow |

Implementation requires the assigned owner or specific approval from the user or
that assigned owner for the task, components/operations, environment, and scope.
General development assignments, credentials, or another role do not grant access;
do not assume a role to bypass ownership. Read-only repository review/proposals
may proceed within an assigned task. Ownership follows behavior in shared files,
scripts, copied/generated code, dependencies, and configuration, not directory names.

- **Frontend:** pages/components, browser logic, navigation, forms, state/data
  fetching, styles/tokens/assets, user-facing content/translations, accessibility,
  responsive/device behavior, frontend tests and frontend-specific dependencies/config.
- **Backend:** server/APIs, middleware, business logic, authentication/authorization,
  sessions, application queries, integrations/jobs, backend tests and backend-specific
  dependencies/config. Historical “Backend Programmer” titles grant no authority.
- **Database:** schema, migrations/setup, database-affecting ORM/configuration,
  data corrections/imports/deletes, functions/triggers/jobs, indexes/constraints,
  extensions, grants/RLS, database configuration, backups/restores, writes, and
  full/privileged access. Non-owner non-privileged read access also requires prior
  task-specific authorization; otherwise route inspection to DB.

No role grants another role's authority or may delegate another owner's scope.
Coordinate cross-boundary work with each owner and infrastructure/deployment with
CI/CD. Frontend owns meaningful tests, security, localization/device support,
accessibility, isolation, verification, and handoff; Backend owns meaningful unit
tests, security, isolation, verification, and handoff. Each must ensure its tests
pass. Required failed/unavailable
checks or unresolved security issues mean incomplete work.

Record approvals/selected options and delegations in the task or handoff: approver,
executor, scope, environment, operations, limits, validation, and recovery. Reuse
within scope; seek new approval only when scope/risk materially changes. These
instructions neither provision credentials nor enforce technical access controls.

## Cooperation and standing authorization

User instruction, 23 October 2026: roles may contact owners directly; General
Manager mediation is optional. This supersedes fresh-approval requirements for
routine local dependencies/database files, while preserving specific execution holds.

- Link the originating task, problem/contract, acceptance criteria, affected files,
  environment, and known approvals/limits. Management/product may route accepted
  work; routing an unapproved proposal does not authorize implementation.
- The receiving assigned owner evaluates validity, compatibility, security, and
  priority. Recorded acceptance authorizes necessary reversible local changes and
  offline/mocked tests within that owner's scope, including migration/ORM and
  infrastructure files. Proceed without repeating user approval. The owner makes
  routine technical choices and explains them in the handoff; it may explicitly
  delegate its accepted scope and review the result. Requesters gain no edit rights.
  Coordinate mixed files/contracts before concurrent edits.
- Before declaring a permission blocker, inspect [TASKS.md](TASKS.md), the relevant
  handoff, and [coordination queue](docs/agent-coordination.md). Reuse recorded
  choices and target/operation approvals. Route executor-specific approvals to
  that executor or obtain permitted owner delegation; acceptance alone cannot
  expand connected-operation approval.
- Connected database/service access or writes, private configuration/credentials,
  ACL changes, deployment/publishing, spending, and destructive operations require
  authorization for the exact action/target. New material product, architecture,
  data/retention, or security-policy choices require the user. Finish authorized
  preparation first, then request only the missing decision/execution scope.
  Preserve stop-on-failure/no-retry instructions and deployment holds.
- Contact/reuse reachable owners through agent tools. An assigned role may spawn a
  clearly assigned owner for a scoped dependency with task, limits, and ownership;
  do not duplicate an active owner. If another session cannot be contacted, persist
  the request in the queue, report the control limitation, and continue independent
  work. Saved session IDs do not prove live status or delivery.
- Track requested, accepted, in progress, blocked, and completed states. Record
  requester/owner/executor, scope, approval source, checks, recovery, and next action;
  link approval history rather than copying it. Owners return implementation and
  verification evidence; requesters check the integrated contract. Blockers name
  the missing decision/capability/check, its owner, and work that can continue.

## Database execution safeguards

Check commands for direct/indirect database effects before running them, including
scripts, containers, startup hooks, CI, and endpoints. `db:push`, `db:setup-*`,
transfers, seed/setup SQL, temporary-table/rolled-back tests, and app/API/browser
tests that persist data (including sessions) require database authorization.
Existing application behavior does not authorize exercising connected write paths.

Authorized application developers may edit application code and run offline/mocked
tests within their roles. Coordinate ORM/query/API contracts with DB and route
database-affecting files and execution to DB.
For accepted routine local database-file dependencies, DB records its choice and
implements without a new user selection. For material choices or connected work
outside recorded approval, present practical options/recommendation and obtain the
missing user decision/execution scope. DB delegation cannot expand that approval.

<!-- BEGIN AWS Agent Toolkit rules -->

## AWS project rules

Selected Region: **`eu-north-1`**. CLI profile: **`fitsmytime`**.
Help level: **HIGH**, selected 31 October 2026. AWS MCP is configured for Codex only;
its toolkit endpoint uses `us-east-1`. The project uses the new AWS experience
(social sign-in). Project authority, approvals, and deployment
holds take precedence over imported AWS guidance.

For any AWS work/question (including SDK/IaC, migration, troubleshooting, and service
explanations), first call `aws___search_documentation` with topic `agent_skills`,
then load the matching skill using `aws___retrieve_skill`. Prefer current skill
guidance over training knowledge. Skip only for work unrelated to AWS.

### Region and services

- Create all Regional resources in `eu-north-1`; never create Lambda, API Gateway,
  or other Regional application resources elsewhere. Projects share one Region
  determined by contact address. Direct Region confirmation to **AWS Settings >
  View all projects > Overview > Additional Info > Region**; if unavailable, check
  `~/.aws/config`.
- CloudFront is global and actions in `us-east-1` are allowed; it may point to
  the selected Region's Lambda function URL/API Gateway. WAF and CloudWatch Logs
  in `us-east-1` are allowed only for required global-resource dependencies.
  Inventory WAF/CloudWatch Logs in both Regions. Prefer the selected Region for
  other work to reduce cross-Region cost, latency, and management overhead.
- No Lambda@Edge, CloudFormation StackSets, multi-account/multi-Region deployments,
  cross-Region actions/replication, multi-Region KMS keys, or Route 53 cross-Region
  geolocation/latency/failover routing.
- Rekognition, Textract, Personalize, and App Runner are unavailable in `eu-north-1`.
- If a service fails, run `aws freetier get-account-plan-state`; check the matching
  [Free](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier)
  or [Paid](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan)
  supported-services list. If absent, check the
  [unsupported list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services);
  advanced features may need activation.

### Access, spending, and terminology

- Say **project**, **team member**, and **selected Region** instead of account,
  IAM user, and home Region. Team members are invited by email. Human IAM access
  is AWS-managed; avoid assigning roles unless absolutely necessary. Permissions
  between services still need IAM policies. Managed SCP/RCP questions use
  [AWS project policy documentation](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).
- **AWS Settings** ([settings.aws.com](https://settings.aws.com/)) manages projects,
  team members, billing, spend limits, and invoices/payments. Resources live in
  AWS Management Console; budgets/cost optimization use Billing and Cost Management.
- Check whether the project is on the paid plan during development. Spend limits
  can pause a paid project; only owners may change them. For suddenly inaccessible
  resources or previously working operations now returning Access Denied, ask
  about spend limits and direct the user to **AWS Settings > Billing**.
- After creating resources, ask whether to clean them up or keep them, explaining
  cost implications. Existing spending/deployment authorization remains required.

### Guidance level

Reuse recorded **HIGH**; explain each step and purpose before execution, suggest
better alternatives and best practices/trade-offs, and execute the user's choice
if they disagree, subject to project constraints. If no level is recorded, ask:
“How much guidance would you like from me? Low (I only flag security risks),
medium (I ask a couple of clarifying questions if something seems off), or high
(I explain what I'm doing, suggest alternatives, and flag best practices).”
Save the selection here.

If changed: **LOW** executes as requested, asks only to prevent a security
vulnerability, and offers no alternatives/improvements. **MEDIUM** executes as
requested, allows at most two ambiguity/issue questions per task, never repeats
dismissed questions/suggestions, and explains trade-offs/alternatives only on request.
All levels retain every project constraint.

<!-- END AWS Agent Toolkit rules -->
