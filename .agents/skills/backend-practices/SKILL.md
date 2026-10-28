---
name: backend-practices
description: Implement, test, and review WellnessConnect / FitsMyTime backend changes using its Express, TypeScript, Zod, Drizzle/pg, and Supabase stack. Use for backend APIs, application logic, authentication, integrations, and unit tests; not frontend-only work, infrastructure deployment, or independent database operations.
---

# Backend practices

Official vendor documentation and OWASP guidance reviewed on 18 October 2026.
Apply these practices to the versions actually in use. This is a project-local
development skill, not an audit result or authority to change live services.

## Authority and version checks

- Read root `AGENTS.md` and `ROLE-BACK_END_DEVELOPER.md`. Preserve the assigned role,
  task, and scoped approvals. Other agents need specific user or assigned Back
  End Developer approval to implement backend changes; loading this skill does
  not assign the role. Read-only repository analysis may proceed within the task.
- Database-affecting files and database execution also follow
  `ROLE-DB-ANALYST-DEVELOPER.md`, including standing local-dependency authorization
  and material-choice/connected-execution requirements.
  Coordinate infrastructure with CI/CD. Neither role can approve the other's scope.
- Use `AGENTS.md` cross-role cooperation and `docs/agent-coordination.md`: accept
  valid local backend dependencies and implement/test without another user approval;
  route other scopes to their owners and reuse recorded choices/operation approvals.
  Preserve explicit execution holds and return contract/verification evidence.
- Inspect `package.json`, the lockfile, imports, and runtime configuration.
  Distinguish declared ranges, locked packages, local Node, container Node, and
  verified deployed versions. Do not infer runtime support from `@types/node`.
- Preserve the existing architecture. This skill does not authorize upgrades,
  schema changes, new services, deployments, or live database access.

## Read the references relevant to the task

- APIs, validation, queries, transactions, runtime behavior:
  [development](references/development.md).
- Identity, permissions, sessions, uploads, outbound requests, security review:
  [security](references/security.md).
- Unit/regression tests and verification commands:
  [testing](references/testing.md).

## Working approach

1. Trace the affected request or job through validation, identity, authorization,
   business rules, data access, integrations, and response. Identify intended
   public behavior and private data before deciding where a change belongs.
2. Keep changes cohesive and small. Reuse existing helpers; introduce a service or
   adapter when it provides a useful testing or responsibility boundary. Avoid
   blanket rewrites, speculative caching, or layers without a concrete need.
3. Review affected trust boundaries and failure paths. In this stack, explicitly
   handle Express 4 async failures and authorize before privileged Supabase calls;
   use the linked references for the details and sources.
4. Add meaningful unit tests for changed behavior and regression/security cases.
   Mock external boundaries, not the decision under test. Inspect test scripts and
   imports for side effects before execution.
5. Run relevant safe tests and type/build checks, fix introduced failures, and
   review the final diff for authorization, compatibility, secrets, and scope.
   Report required checks that fail or cannot run as incomplete work.
6. Record commands/results, approval/delegation, security findings, evidence limits,
   recovery, and prepared versus applied/deployed status. Passing offline tests
   does not prove live RLS, concurrency guarantees, or production configuration.

Revisit official sources when version-sensitive guidance matters and compare with
installed APIs. Keep review dates/source links with updates. Skill files on disk
do not prove automatic discovery by every client/session or remediation of code.
