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


<!-- BEGIN AWS Agent Toolkit rules -->

## AWS Agent Toolkit project configuration

Selected project Region: `eu-north-1`. AWS CLI profile: `fitsmytime`.
User-selected AWS help_level: `HIGH` (31 October 2026).
AWS MCP access is configured for Codex only. The toolkit service endpoint uses
`us-east-1` as required by AWS setup; Regional application resources must use
`eu-north-1`. Existing project authority, approval and deployment holds remain
in effect and take precedence over the imported AWS guidance.

# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- For any AWS task or question — building, configuring, migrating, debugging, or operating a service, writing SDK code, authoring CDK/CloudFormation, or answering how a service works — first call `aws___search_documentation` with topic `agent_skills` and load the matching skill with `aws___retrieve_skill`. Do this even when you believe you know the answer: skills carry current service behavior that your training may not. Prefer the skill's guidance over general knowledge. Skip it only for work that does not involve AWS.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user’s request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion

<!-- END AWS Agent Toolkit rules -->
