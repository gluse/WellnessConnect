# Agents, sessions, and skills

Snapshot: 18 October 2026, Europe/Riga. Scope: the current agent tree, this
repository, and local Codex session records whose initial working directory is
`C:\Source\Private\WellnessConnect`. This is not an account-wide inventory.

## Cross-role cooperation update — 23 October 2026

Source: user's request that roles contact one another, accept valid dependencies
and implement without repeated permissions, reusing other agents' existing
approvals. `/root` updates Markdown instructions only: AGENTS.md, six role files,
five project skill entrypoints, TASKS.md and
[the shared dependency queue](agent-coordination.md). The queue records the
TASK-014 request and approval lookup without claiming delivery or completion.

Approval record: user approves; `/root` executes documentation/instruction changes
in this local repository. Allowed operations are Markdown edits and offline
instruction/link/skill checks; no application changes, private-file/service/DB
access, ACL operation, activation or deployment. Recovery is reverting only this
request's attributable edits while preserving the existing dirty workspace.
Standing local-dependency authorization is recorded in
[AGENTS.md](../AGENTS.md#cross-role-cooperation-and-standing-authorization);
explicit connected-operation limits and execution holds remain.

Live roster observed before independent review: only `/root`. A scoped child
`/root/coordination_review` subsequently reviews these instructions read-only;
it is not the Backend/DB executor for TASK-014. Historical audit agent IDs below
are saved assignment evidence, not proof that they are live or reachable in this
thread. No account-wide/session inventory was refreshed and no request was sent
to those independent sessions. Owners must check the queue on resume.

Validation: independent read-only scenario review passed after correcting stale
GM database-choice wording and adding the queue. All 170 local links/anchors in
15 Markdown files resolve; all five skill entrypoints pass YAML, naming,
description and placeholder checks using Node and the installed YAML parser.
The standard Python skill validator could not launch: Windows Python aliases
were inaccessible and registered Python 3.11/3.14 executable paths were missing;
the Node checks supplied equivalent checks for these entrypoints. Scoped
`git diff --check` passed. No application/database/browser tests are needed or
run. Language scope remains en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es
remain deferred.

## TASK-014 continuation — 23 October 2026

Completion update: after the user requested prototype-level resource frugality,
only the existing DB owner resumed implementation; Backend and the DB child were
not restarted. TASK-014 connected acceptance, test-access revocation, final active
profiles and bounded worker readiness passed. No background worker or HTTP server
was left running. Root maintains the
[completion record](audit-completion-execution.md); older roster/work checkpoints
below are historical and do not imply currently running agents or services.

Completion-run roster update: the audit user approved all actions required to
finish TASK-014; see the [completion execution scope](audit-completion-execution.md).
The current thread exposes `/root`, `/root/audit_backend`, `/root/audit_database`
and DB's narrowly delegated child `/root/audit_database/audit_rehearsal_prep`.
The child prepares only new 0004 rehearsal SQL/setup and offline tests, without
private/configuration/ACL or connected DB access. Parent DB retains credential
handling and live execution; Backend owns app-principal/Auth gates, worker loop,
monitoring, tests and peer review. Root coordinates Markdown and evidence.
This is the current thread's roster, not independent session/account status.

Source: current thread's collaboration roster and the user's request to continue
TASK-014. Live roster at this snapshot: `/root` (coordination/documentation),
`/root/audit_backend` (Back End Developer) and `/root/audit_database` (DB
Analyst/Developer). These are scoped agents in this thread; this does not establish
control or status of independent IDE sessions. No account-wide or local saved-
session inventory was refreshed.

The existing local backend and selected Choice 1 preparation assignments resume:
Backend owns audit runtime/capture/worker code, isolated audit tests and its
handoff; DB owns unapplied 0003 SQL, runtime helpers, bounded rehearsal runner and
the new execution handoff. Parent owns task/status documentation. No frontend,
private configuration/credentials, connected database/service operations, app
startup or deployment. Preserve existing installed audit objects and unrelated
workspace changes. Offline validation and Backend compatibility/security review
precede any request for final connected execution approval. Current application
table drift and remote Auth reconciliation remain activation gates; see
[TASK-014](../TASKS.md#audit) for the durable scope, evidence and recovery record.
Language scope stays en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred.

Outcome update: separate user approvals authorized DB's exact `.env` ACL
protection and metadata-only preflight on the two named development projects.
Both completed; protected recovery metadata is retained. Backend completed its
disabled-installer review (238 focused checks); DB prepared the next execution
handoff (243 existing offline checks also pass). No database writes or runtime
activation occurred in preparation. The user subsequently approved installing
the NOLOGIN runtime roles/policies/grants on the named development pair; DB is
executing that exact command with fresh gates and guarded recovery. Earlier
offline-only limits above describe the initial preparation assignment. See the
runtime handoff for actual execution results; no credential or activation scope
was added.

Final audit-thread outcome: both runtime-0003 migrations committed and reviewed
read-only catalog verification passed. DB executed under the recorded named-target
approval; Backend independently reviewed routine dormant-provider-ACL and
installed-policy verifier corrections and passed 264 continuation/246 installer
checks. Source/destination SQL stays immutable, all new roles remain NOLOGIN and
credential provisioning/connected rehearsals/activation remain incomplete.
The [coordination queue](agent-coordination.md) records accepted delivery and the
returned frontend/backend contract without claiming contact with independent
frontend sessions. No account-wide roster was refreshed.

## Product, General Manager and CI/CD role maintenance — 21 October 2026

At the user's request, `/root` optimized and renamed the
[Product Manager](../ROLE-PRODUCT-MANAGER.md),
[General Manager](../ROLE-GENERAL-MANAGER.md) and
[CI/CD Developer](../ROLE-CI-CD-DEVELOPER.md) definitions. Consolidated repeated
instructions, linked task-specific context, updated project/skill references,
and retained planning-only management authority, product metrics/financial
discipline, technical ownership and deployment/DB approval limits. No runtime
or token-performance improvement measured.

Historical manager handoff: the initial 18 October inventory contained 18 local
project session records (two Guardian records), 17 exposed skills and a disk-only
review skill; automatic discovery of the new optimization skill was unverified.
Docker/audit workspace work then awaited owner verification, and executable hook
integration remained developer work. These are historical observations, not a
fresh roster, implementation check or automation status. Preserve the later audit
and forms evidence below; load current task handoffs for present status.

Scope: local Markdown only; preserve existing changes and the temporary checkout.
Validation: renamed-role links/anchors, stale-reference search and whitespace
checks. No application/container/cloud/database tests or service access. Testing
remains en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred. Recovery:
reverse only these renames and attributable documentation edits. No new agent,
compaction hook, resource provisioning or deployment.

## DB role context maintenance — 21 October 2026

At the user's request, `/root` streamlined the
[DB Analyst/Developer role](../ROLE-DB-ANALYST-DEVELOPER.md), added the `ROLE-`
filename prefix and updated repository links and skill references. Consolidated
scope, approval, verification and handoff instructions; retained user selection
before database changes, cross-role authority and scoped execution. Detailed
PostgreSQL references load only when needed. No runtime/token savings measured.

Scope: local Markdown only; preserve existing workspace and temporary-checkout
changes. Verification: role links and workflow anchor resolve, no stale old-filename
references remain outside the temporary checkout, and whitespace checks pass.
No application/database tests or database access; en/lv/ru remains the testing
scope, with ar/RTL, zh, fr, de, hi, ja, pt and es deferred. Recovery: reverse only
this rename and attributable documentation edits. No new agent or deployment.

## Forms implementation assignment — 20 October 2026

User reviewed and approved the forms visual proposal and asked the Front End
Designer to start implementation. This thread started Front End Developer
`/root/forms_implementation` for TASK-022, applying the approved sectioned-form
direction first to the service editor, with booking/account/address and the
remaining forms tracked as subsequent phases. The agent is a child in this
conversation; this does not create or control an independent IDE session.

Approval and limits: user approves; the named Front End Developer executes local
frontend source/locale/test changes and isolated offline/mocked verification.
The developer owns scoped frontend files and `docs/forms-implementation-handoff.md`;
the parent owns TASKS.md, this inventory and proposal approval/status notes.
Minimal frontend test tooling is allowed if required, with shared-manifest edits
coordinated first. No backend, database/ORM, connected session/application writes,
live services, infrastructure or deployment. Preserve existing audit work.
Validation is the frontend role/proposal's interaction, browser, localization/RTL,
accessibility, security and applicable type/build checks; record limitations and
leave incomplete checks open. Recovery is revision/reversion of only attributable
task changes. Full approval record and phased scope: [TASK-022](../TASKS.md).

Live roster at assignment: `/root` and `/root/forms_implementation`. Earlier audit
and design agents below are historical records; they are not present in this
thread's current live roster. Assignment/start does not establish implementation
completion or successful verification.

Progress verified on 20 October 2026 after the user's status request:
the agent completed Phase 1 and wrote [its handoff](forms-implementation-handoff.md)
with screenshots and machine-readable browser evidence. Application/fixture type
checks, build, three affected offline regressions and 13 Chrome behavior groups
plus 77 locale/width combinations passed. Broader release verification remains
incomplete: Firefox/WebKit, physical devices, screen readers, actual 400% zoom and
native-language review. The parent delivered a follow-up assignment through the
same agent controls to continue the approved Phase 2 booking/account/address
implementation. The developer also owns new `docs/forms-phase2-handoff.md` and
scoped Phase 2 frontend/test/locale files under the same approval and limits.
Phase 2 subsequently completed: [handoff](forms-phase2-handoff.md) records passing
application/fixture type checks, build, affected regressions and Chrome's 14 groups,
231 locale/width cases and 105 messages in all 11 locales, plus the Phase 1 browser
regression. No unexpected requests/runtime exceptions; release limits remain open.
On the user's next status request the parent delivered the already approved
Phase 3 availability/company/admin/storefront assignment to the same developer.
The developer owns scoped Phase 3 source/locales/tests and
`docs/forms-phase3-handoff.md`/evidence under the existing approval, boundaries,
validation and recovery. TASK-022 remains open; nothing was deployed.

Phase 3 completed: [handoff](forms-phase3-handoff.md) records passing type/build
checks, affected frontend regressions, 11 Chrome groups/462 locale-viewport cases,
137 messages across all 11 locales and Phase 2's 14-group/231-case regression.
No unexpected requests/runtime exceptions. The original proposal's login/signup
items were outside the three delivery-phase assignments at that milestone.
Parent sent a follow-up to the same Front End Developer to complete those items
under the existing user's frontend approval and limits: localization, narrow-name
layout, labeled authentication/profile grouping and accessible language choice.
The developer owns scoped auth frontend/resources/tests and
`docs/forms-auth-handoff.md`/evidence; parent retains status files. No new auth
features or contract changes. Broader release checks remain open; no deployment.

Latest update, 20 October 2026: the user directly assigned Front End Developer
`/root` to finish TASK-022 with reduced repeated testing and existing browser
tooling. The interrupted auth implementation was already present. Its final
verification now passes: application/fixture TypeScript, production build,
mocked social-auth frontend regression and Chrome's 8 groups/77 locale-viewport
cases, with 48 messages in all 11 locales and zero unexpected requests/runtime
exceptions. Three screenshots were inspected. No application source changes,
new test infrastructure, connected services/database writes or deployment in this
pass. See [final auth handoff](forms-auth-handoff.md) for approval, recovery,
evidence and limits. Local implementation is complete; TASK-022 remains open for
broader browser/device/screen-reader/zoom/native-language verification required by
the existing role/proposal. The deployment hold remains in force.

## Audit assignment update — 19 October 2026

Next-work assignment: user requested progression toward activation. Backend
`/root/audit_backend` owns local TASK-014 capture/worker/config and initial
TASK-015 supported security/auth instrumentation, offline regressions and type
checks. DB Analyst `/root/audit_database` owns the new runtime privilege/rehearsal
proposal and scoped SQL/test package. Neither edits the other's application/SQL
files; General Manager owns existing task/coordination docs. New DB bindings and
fixture writes await user choice of the concrete proposal; no deployment or
frontend work. Scope, checks, recovery and existing approvals are in TASK-014.
DB Analyst completed [the runtime proposal](audit-runtime-proposal.md), including
exact account/table/RLS scope, private credential separation, bounded synthetic
test provenance and recovery limits. User selected Choice 1 plus the bounded
synthetic rehearsal on 19 October 2026. DB Analyst now prepares concrete runtime
migrations/helpers and offline verification for Backend review. New connected
execution/private configuration/fixtures await final review and execution approval;
none was applied during proposal preparation.

Execution update: user approved DB Analyst preflight then additive audit
schemas/NOLOGIN roles and read-only metadata verification on source
`hbkooiknruimukkhshrk` and destination `ynygqodmtgjrngiudalw` (development/test).
Executor `/root/audit_database`; `/root/audit_backend` reviews the fixed-manifest
Node/pg helper read-only. No business DML, fixtures, runtime bindings, cron or
deployment. Preserve committed state on later failure; scope/validation/recovery
record is in TASK-014. This supersedes earlier preparation-only scope below.

Execution outcome: DB Analyst confirmed destination/source commits on both
PG17.11 test projects, 16:09:50/16:09:51 Europe/Riga on 19 October 2026. Read-only
metadata verification passed (60 destination / 80 source checks). The helper
reused the existing fingerprint-pinned public Supabase CA for destination only,
with verified TLS and no config/system-trust changes. No business DML, fixtures,
runtime bindings, cron or deployment. Capture/worker integration and behavioral
tests remain pending. Full evidence is in `docs/audit-execution-report.md`.

Decision update, 19 October 2026: the user selected audit storage **Option C**.
The DB Analyst acknowledged independent PostgreSQL plus transactional outbox;
the General Manager recorded the choice in the storage proposal, audit plan,
catalog and TASKS.md. The user subsequently approved **R1 + P1 and recommended
failure behavior**, confirmed existing application DB is development/testing,
and later supplied audit endpoint `https://ynygqodmtgjrngiudalw.supabase.co`,
reference `ynygqodmtgjrngiudalw`. Reuse these choices and target identification.
The user now reports PostgreSQL connection in `.env` `AUDIT_DATABASE_URL`.
DB Analyst is preparing local `migrations/audit/*` and
`docs/audit-migration-package.md`, with private configuration inspection for
target metadata only. Back End Developer reviews compatibility read-only.
Readers/operators and hosting validation remain pending. No credentials are
copied to documentation; no database/service connection or SQL execution is authorized.

Private configuration check by DB Analyst identified distinct source
`hbkooiknruimukkhshrk` and audit destination `ynygqodmtgjrngiudalw`; the respective
PostgreSQL and Supabase URL settings agree. Credential values were not reported,
and no connection, live privileges or PostgreSQL version has been verified.
`/root/audit_database` owns new `docs/audit-test-setup.md` (setup handoff only).
`/root/audit_backend` is assigned local BE-14A pure modules in `server/audit/*.ts`
and isolated `scripts/test-audit-events.mjs`, with no DB/provider imports or
service execution. Validation/recovery and scoped authority are in TASKS.md.
No database access, provisioning or deployment is included.

Additional assignment, 19 October 2026: the user requested a new Front End
Developer session to propose improvements to existing UI forms. Started child
agent `/root/forms_design` with a separate task context, owning only
`docs/forms-design-proposal.md`. Scope: repository review and a design proposal,
including representative before/after layouts, accessibility, responsive forms,
and localization/RTL. No application changes, live services, database/session
writes, or deployment. Validation is source review; rendered browser validation
is not included. Recovery is revision/removal of this new proposal only.
The available controls create a child agent in this conversation, not a new
independent IDE session. Audit assignments continue in parallel.
The agent completed the proposal and source review on 19 October 2026, including
three before/after flows and wireframes; local links and whitespace checked.
Its recommendation is consistent sectioned forms with a service-editor pilot.
The proposal awaits the user's design choice; no rendered/browser verification
or application implementation was performed.

The user asked the General Manager to assign the audit tasks to the Back End
Developer and DB Analyst. The current thread's collaboration controls started
the following agents; this update supersedes the historical "only `/root`"
statements below for this assignment, without refreshing saved IDE sessions.

| Agent | Assignment and exclusive file | Status |
| --- | --- | --- |
| `/root` — General Manager | Coordination, `TASKS.md`, audit-plan links, inventory | Running at assignment |
| `/root/audit_backend` — Back End Developer | TASK-014 transaction adapters/worker; initial TASK-015 instrumentation | Local implementation, isolated audit tests, four approved mixed regressions and no-emit type check passed; writing handoff and reviewing runtime DB package; no connected execution |
| `/root/audit_database` — DB Analyst/Developer | Runtime permissions/credentials and synthetic rehearsal proposal/package | Choice 1 selected; implementing local SQL/helpers for review; connected execution pending; installed scaffolding preserved |

Approval source: the user's 19 October request in this conversation. No database
access, database changes, frontend changes, infrastructure work, or deployment
is included in this initial preparation. Database implementation awaits the
user's option selection. Each agent preserves existing workspace edits and
reports source evidence, decisions, validation limits, and its next action.
The manager uses the project-local `agent-optimization` skill for this handoff.
The current runtime exposes that skill plus `backend-practices`,
`frontend-practices`, `postgresql-practices`, and `joint-be-db-optimization`;
the catalog and discovery caveats farther below describe the earlier snapshot.

Role registration update, 18 October 2026: the DB Analyst/Developer definition
and repository-wide database authority rules were added from the user's request.
This update records documentation, not a newly running agent or a refresh of
the historical session roster below.

Role registration update, 18 October 2026: the Back End Developer definition and
repository-wide backend authority rules were added at the user's request, with
unit-test ownership and security requirements. This is a documentation update;
the historical live/session/skill snapshots below were not refreshed.

Skill update, 18 October 2026: added and read the project-local
[`backend-practices`](../.agents/skills/backend-practices/SKILL.md) skill, with
development, security, and testing references based on official stack documentation
and OWASP guidance. Linked it from the backend role and `AGENTS.md`. This records
files and routing instructions; automatic discovery in another session has not
been verified. The initial session and exposed-skill snapshots below are historical.

## Agents and role definitions

Role registration update, 19 October 2026: created the
[Product Manager](../ROLE-PRODUCT-MANAGER.md) at the user's request, with adoption,
retention, prioritization, and cost/income analysis responsibilities. Initial
recommendations are in [Product opportunities](product-opportunities.md).
This records a role definition and product-planning work; no separate agent was
started, and the historical session/live/skill snapshots were not refreshed.

Role/skill update, 18 October 2026: created the
[Front End Developer](../ROLE-FRONT-END-DEVELOPER.md) and repository-wide frontend
authority rules, plus the project-local
[`frontend-practices`](../.agents/skills/frontend-practices/SKILL.md) skill with
development/security, multilingual/RTL, device/accessibility, and testing references.
Guidance was researched from official documentation and loaded directly. Role and
skill creation do not start a live agent or install technical permissions.
The runtime catalog now exposes `backend-practices`; automatic discovery of the
new frontend skill in another session is unverified. Historical rosters below
were not refreshed by this documentation update.

Role context maintenance, 21 October 2026: at the user's request, `/root` shortened
the Front End Developer definition and renamed it to
[`ROLE-FRONT-END-DEVELOPER.md`](../ROLE-FRONT-END-DEVELOPER.md). Scope: local Markdown
role/routing/reference updates only; no application, service, database or deployment
operations. Authority, security and verification requirements remain; detailed
guidance is linked for task-specific loading. Validation: 25 local role/reference
links pass, current repository Markdown has no stale filename references, and
`git diff --check` passes. Application tests were not needed for documentation.
Future tests remain limited to en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are
deferred. Existing changes and the temporary search checkout were preserved.
Recovery: reverse this rename and its scoped Markdown edits while retaining other
sessions' work. Next owner: the assigned Front End Developer for application tasks;
this maintenance does not assign that role or refresh the historical roster below.

| Agent or role | Evidence | Status and control |
| --- | --- | --- |
| General Manager (`/root`) | Current conversation and live collaboration roster | Running at inspection; documentation and management only |
| Product Manager | [Role definition](../ROLE-PRODUCT-MANAGER.md); user's 19 October 2026 request | Defined for product research and Markdown planning; initial proposals prepared; no separate agent started or implementation authority granted |
| CI/CD Developer | [Role definition](../ROLE-CI-CD-DEVELOPER.md); Docker session title below | Role exists; other session's live state is unknown |
| DB Analyst/Developer | [Role definition](../ROLE-DB-ANALYST-DEVELOPER.md); [project-wide authority](../AGENTS.md) | Defined for database operations only; user selection before changes; no separate session started or database access granted |
| Back End Developer | [Role definition](../ROLE-BACK_END_DEVELOPER.md); [project-wide authority](../AGENTS.md) | Defined for backend operations only, including unit tests and security; other agents require specific approval; no separate session started or technical permissions granted |
| Front End Developer | [Role definition](../ROLE-FRONT-END-DEVELOPER.md); [project-wide authority](../AGENTS.md) | Defined for frontend operations only, including tests, security, localization, accessibility, and device support; other agents require specific approval; no separate session started |
| Guardian review subagents | Two local session headers explicitly identify `subagent.other = guardian` | Historical records; not present in this thread's live roster |
| Other development sessions | IDE session metadata below | Saved sessions; no persistent named role established by metadata |

The live roster returned only `/root`. No child agents were created during this
inventory. Historical Guardian records do not show two currently active agents.
No repository `AGENTS.md`, `.agents`, `.codex`, or project skills were found before
the initial inventory work. The user-level Codex `AGENTS.md` was empty when read.
The repository now has `AGENTS.md` for shared frontend/backend/database authority
and role routing; role documents alone do not start agents or enforce technical permissions.

## Local project sessions

Found 18 matching records out of 35 local session files inspected across `sessions`
and `archived_sessions`. All 18 matching files were in `sessions`; their live state
and task completion are unknown except for the current conversation. The remaining
17 files were outside this initial-workspace match and their contents were not
inventoried here. Sessions that later switched into this workspace may be missed.

Dates below are session creation dates in Europe/Riga, not proof of latest activity.
Titles come from the local session index. They are labels, not instructions or
evidence that their work succeeded. All matching sessions report `codex_vscode`.

| Created | Session title | Kind | Session ID |
| --- | --- | --- | --- |
| 2026-10-18 | List agents, sessions, and skills | Current manager / IDE | `01a14fd3-00cc-7550-8d50-7a545220ec50` |
| 2026-10-18 | Define Docker Compose and Dockerfile | IDE | `01a14fc7-067c-7d61-beb7-de748fb65460` |
| 2026-10-17 | Guardian review | Guardian subagent | `01a14b69-97d3-7ea1-820a-a61e8e270349` |
| 2026-10-17 | Store account addresses for services | IDE | `01a14b69-96d7-7602-9c06-cb3fee2a06da` |
| 2026-10-16 | Guardian review | Guardian subagent | `01a1459e-ead3-7cd0-af39-133e00495698` |
| 2026-10-16 | Commit changes | IDE | `01a14513-5253-7b92-b1e8-e250cf14a08e` |
| 2026-10-16 | Work on TASL-006 | IDE; title spelling preserved | `01a14503-4f42-7740-9fdc-7ebc98a0d666` |
| 2026-10-16 | Find TASK-012 | IDE | `01a14502-78a1-7881-bcc4-8fc5f591c4b2` |
| 2026-10-16 | Work on TASK-006 | IDE | `01a144fd-f605-79a0-87ce-b373bcdacb1c` |
| 2026-10-16 | Locate TASK-011 | IDE | `01a144e5-ff1c-7810-9da4-f90e78205f34` |
| 2026-10-16 | Allow git commits without prompts | IDE | `01a144e3-b13b-74e1-90ec-5bfa67a9f3fb` |
| 2026-10-16 | Commit changes | IDE | `01a144e1-df25-7671-ad01-a30634953ea9` |
| 2026-10-16 | Remove Replit references | IDE | `01a144d9-25f1-7692-aa83-455ffd09e3d3` |
| 2026-10-15 | Work on TASK-001 | IDE | `01a13fae-d160-7191-a9e3-959a18d38690` |
| 2026-10-15 | Create task list for WellnessConnect | IDE | `01a13e7f-45a2-7062-8135-f456b0783dc2` |
| 2026-10-14 | Commit latest changes | IDE | `01a1393b-a25a-7d41-bfa4-a419d51f2ce2` |
| 2026-10-13 | Move account details to a page | IDE | `01a136be-a76c-79b1-a62b-306eaa48e3da` |
| 2026-10-11 | Start project preview | IDE | `01a12c94-754e-7b53-b025-507e13d37f1c` |

Sources: read-only first-line session metadata in
`C:\Users\LuseG\.codex\sessions` and `archived_sessions`, and titles from
`C:\Users\LuseG\.codex\session_index.jsonl`. Full transcripts were not needed.
Independent IDE sessions cannot be addressed with this thread's collaboration
controls. No all-account session-management tool is exposed in this environment.

## Skills exposed to this session

The runtime supplied these 17 skills before this inventory. Availability in other
clients or sessions can differ. These are skills, not running agents.

| Skill | Purpose |
| --- | --- |
| `imagegen` | Generate or edit bitmap images |
| `openai-docs` | OpenAI and Codex documentation and product guidance |
| `skill-creator` | Create and improve skills |
| `skill-installer` | Install skills from a catalog or repository |
| `computer-use:computer-use` | Control supported computer surfaces |
| `documents:documents` | Create, edit, render, and verify Word documents |
| `pdf:pdf` | Read, create, and verify PDF files |
| `plugin-management:plugin-management` | Discover and manage plugins and connections |
| `presentations:Presentations` | Create and edit presentations |
| `sites:sites` | Build, update, publish, and manage Sites websites |
| `spreadsheets:Spreadsheets` | Work with spreadsheet files and Google Sheets |
| `spreadsheets:excel-live-control` | Control connected live Excel sessions |
| `template-creator:template-creator` | Create reusable artifact templates |
| `visualize:visualize` | Create in-conversation visualizations and interactive tools |
| `work-pets:create-pet` | Create ChatGPT Work pets |
| `work-pets:pets` | Inspect and manage ChatGPT Work pets |
| `work-pets:update-pet` | Update ChatGPT Work pets |

The rows above are the initial exposed catalog. With the then-present disk-only
skill and repository skill, that initial inventory identified **19 distinct skill
entries**, before the subsequent role/skill updates recorded above and below.

## Additional skill files

| Skill | Evidence | Availability |
| --- | --- | --- |
| `review-agent` | `C:\Users\LuseG\.codex\skills\.system\review-agent\SKILL.md` | Present on disk; absent from this session's supplied skill catalog; read-only defect review workflow |
| `agent-optimization` | [Repository SKILL.md](../.agents/skills/agent-optimization/SKILL.md) | Created by this task; runtime discovery has not yet been observed |
| `backend-practices` | [Repository SKILL.md](../.agents/skills/backend-practices/SKILL.md) | Added during the backend practices update and read directly; linked from project instructions; automatic discovery in another session unverified |
| `frontend-practices` | [Repository SKILL.md](../.agents/skills/frontend-practices/SKILL.md) | Added/read directly during frontend role creation; linked from project instructions; automatic discovery in another session unverified |

No custom user skill folders were found alongside `.system` in the user's Codex
skills directory. Cached plugin versions are not evidence they are currently enabled.
This inventory does not label every cached skill as available.

Repository `.agents/skills` is a documented local discovery location. See
[OpenAI skill documentation](https://learn.chatgpt.com/docs/build-skills).

## Automation status

No project hook configuration was found. No user `hooks.json` was found, and the
user configuration search found a turn-ended `notify` entry, not a compaction hook.
This is not an exhaustive inspection of managed or plugin hook sources.

The manager role and optimization skill are Markdown only. Executable maintenance
hooks have not been installed or tested. `PreCompact` and `SessionStart` with source
`compact` are documented lifecycle events; `/compact` is a host command. The tools
exposed here provide no supported way to invoke it in another IDE session. See
[OpenAI hooks](https://learn.chatgpt.com/docs/hooks) and
[developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli).
