# Agents, sessions, and skills

Snapshot: 18 October 2026, Europe/Riga. Scope: the current agent tree, this
repository, and local Codex session records whose initial working directory is
`C:\Source\Private\WellnessConnect`. This is not an account-wide inventory.

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

Role/skill update, 18 October 2026: created the
[Front End Developer](../FRONT-END-DEVELOPER.md) and repository-wide frontend
authority rules, plus the project-local
[`frontend-practices`](../.agents/skills/frontend-practices/SKILL.md) skill with
development/security, multilingual/RTL, device/accessibility, and testing references.
Guidance was researched from official documentation and loaded directly. Role and
skill creation do not start a live agent or install technical permissions.
The runtime catalog now exposes `backend-practices`; automatic discovery of the
new frontend skill in another session is unverified. Historical rosters below
were not refreshed by this documentation update.

| Agent or role | Evidence | Status and control |
| --- | --- | --- |
| General Manager (`/root`) | Current conversation and live collaboration roster | Running at inspection; documentation and management only |
| CI/CD Developer | [Role definition](../CI-CD-DEVELOPER.md); Docker session title below | Role exists; other session's live state is unknown |
| DB Analyst/Developer | [Role definition](../DB-ANALYST-DEVELOPER.md); [project-wide authority](../AGENTS.md) | Defined for database operations only; user selection before changes; no separate session started or database access granted |
| Back End Developer | [Role definition](../BACK-END-DEVELOPER.md); [project-wide authority](../AGENTS.md) | Defined for backend operations only, including unit tests and security; other agents require specific approval; no separate session started or technical permissions granted |
| Front End Developer | [Role definition](../FRONT-END-DEVELOPER.md); [project-wide authority](../AGENTS.md) | Defined for frontend operations only, including tests, security, localization, accessibility, and device support; other agents require specific approval; no separate session started |
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
