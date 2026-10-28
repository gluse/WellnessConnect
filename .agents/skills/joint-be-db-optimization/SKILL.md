---
name: joint-be-db-optimization
description: Coordinate DB Analyst and Backend Programmer work on WellnessConnect database/query optimization within the existing structure, using owner acceptance for routine local dependencies and existing or newly obtained authorization for material choices and connected execution.
---

# Joint be-db-optimization

Use a joint DB Analyst/Developer and Backend Programmer session to optimize the
existing WellnessConnect / FitsMyTime database and backend together. Read the
repository's `AGENTS.md` and `ROLE-DB-ANALYST-DEVELOPER.md` before analysis. This workflow
does not assign the General Manager or CI/CD roles.

## Joint ownership

When collaboration tools are available, create or reuse two working agents:

- **DB Analyst/Developer:** Own database analysis, SQL/migrations, database access
  and execution, and review of database-affecting ORM changes, within the role's
  authority and the user's selected scope.
- **Backend Programmer:** Own existing Express/TypeScript/Drizzle queries, API
  behavior, ORM mappings, and backend tests. Database-affecting edits and database
  execution need the specific approval required by the DB role.

The coordinating agent presents one aligned plan, records owner acceptance or the user's choice,
assigns non-overlapping files, and reconciles both reviews. Give each agent the
same approved contract and environment. Do not have two agents edit the same file
concurrently. If collaboration is unavailable, state that limitation and perform
both reviews explicitly; do not claim to have created separate live agents.

## Inspect the existing system

Start with repository-only analysis: inspect the relevant `server/` implementation,
`shared/schema.ts`, `migrations/`, scripts, and task/handoff documents. Preserve
unrelated workspace changes. Locate existing proposals rather than assuming they
exist. Distinguish code findings from measured database behavior.

Keep the existing architecture, tables, relationships, API contracts, and business
behavior. Optimize existing queries and access paths; propose targeted indexes
only when justified. Do not introduce new tables, columns, services, caches,
database engines, or audit infrastructure under this scope. If the existing
structure cannot meet the need, explain why and ask about that scope separately.

Do not infer database access or a target environment from credentials. Route
database inspection to the DB Analyst and confirm its permitted target and scope.
Inspect commands and imports for indirect writes before running them; application
startup, migration helpers, integration tests, fixtures, and rolled-back writes
can mutate a database. Use offline or mocked checks before authorized DB work.

## Reuse authorization and accept routine local pairs

Follow `AGENTS.md` cross-role cooperation and check `docs/agent-coordination.md`,
TASKS.md and the relevant handoff for existing approvals first. Both owners may
accept a routine, reversible local optimization dependency within an accepted
task, record their technical choice, and implement/offline-test without another
user approval. This includes local database-affecting files, not connected writes.
For material choices or missing connected-operation scope, prepare one concrete
proposal and request only the missing decision/authority.

Each proposal must identify:

- The problem, code/query evidence, affected existing objects and files, intended
  environment, and any missing baseline or live-schema evidence.
- Practical options, normally two or three when meaningful, with a recommendation
  for the simplest sufficient solution. Include defer/keep-current where useful;
  explain likely benefit, effort, index write/storage cost, locks/downtime, risk,
  and limits without claiming unmeasured performance gains.
- The matching backend query/ORM/API work and DB migration or access-path work;
  show proposed SQL or a migration outline and compatibility/deployment order.
  If one side needs no edit, explain why the current contract stays aligned rather
  than making a cosmetic change just to touch both sides.
- Validation and recovery for both sides, and whether the choice authorizes
  preparation only or execution against a named environment too.

Wait only for a missing material user choice or execution approval; owner
acceptance covers routine local pairs under standing authorization. A recorded
choice can cover the described DB/backend pair and its checks; do not ask again
for each covered file, step or subsequent in-scope dependency. Escalate material
changes to design, environment, scope or risk. Continue independent authorized
work while a genuinely missing decision is pending.

## Implement and validate the selected pair

Record owner acceptance or the existing/new user choice before edits. Delegate SQL/migrations to the DB Analyst
and backend/query/ORM/test files to the Backend Programmer with DB review and
specific delegation where required. Keep database and backend contracts aligned
through a compatible deployment sequence and reversible, reviewable changes.

Finish all authorized preparation before seeking any remaining execution approval:
exact commands/SQL, target, current-schema checks, locking/transaction behavior,
validation, and rollback/recovery. Migration-file approval alone does not permit
running it. Do not substitute schema push, setup scripts, startup hooks, or tests
for an approved migration execution.

Run suitable offline checks and tests of meaningful behavior (authorization,
workspace isolation, booking overlap/cleanup semantics, ordering/pagination, or
query-count reduction as applicable). Rehearse migrations and compare representative
plans/timings only on specifically authorized targets. Preserve existing RLS and
integrity rules. Stop when the agreed need is met.

Have both agents review the final pair. Report separately what was prepared,
applied, and verified; never call an unapplied migration deployed or a code-only
finding a measured speedup.

## Persist the handoff

Use the current task or a focused document under `docs/` to record the proposal ID,
owner-accepted or user-selected option, approving party, executor per side, target environment,
allowed operations and limits, DB-to-backend contract, application/deployment
order, validation, recovery, actual results, and next action. Record delegated
approval explicitly. Keep pending choices and unknown environment/access visible;
do not store credentials or private rows. Reuse recorded approval within its scope.
