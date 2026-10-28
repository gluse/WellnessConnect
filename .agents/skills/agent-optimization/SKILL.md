---
name: agent-optimization
description: Maintain WellnessConnect agent inventories, improve skill instructions, and prepare context compaction or session handoffs. Use for General Manager agent maintenance and optimization routines.
---

# Agent optimization

Use this instruction-only routine for WellnessConnect / FitsMyTime management.
Read `ROLE-GENERAL-MANAGER.md` at the repository root when acting as General Manager.
That role may edit Markdown only; leave executable hooks and implementation to
developer sessions. This skill does not grant control of unrelated conversations.

## Inventory and ownership

- Apply `AGENTS.md` cross-role cooperation: roles contact owners directly, owners
  accept valid local dependencies and implement without repeated user approval.
  Check TASKS.md, the task handoff and `docs/agent-coordination.md` for existing
  choices, executor/target-specific approvals and explicit holds before escalating.
  Route to the approved executor where reachable; persist undeliverable requests
  in the queue without claiming delivery or treating saved sessions as live.
- Refresh `docs/agent-inventory.md` from the available live roster, project role
  documents, local session metadata, and the current exposed skill catalog.
- For local history, prefer session IDs, titles, workspace paths, source type,
  and timestamps. Read only relevant project transcripts when a handoff needs
  more evidence. Do not copy unrelated conversation history or credentials.
- Distinguish live agents from saved sessions and skill files from runtime-exposed
  skills. Historical timestamps, open files, and file locks do not prove live status.
- Record the source, snapshot date, unknown status, and control limitations.
- For coordinated work, identify owner, task, file scope, dependencies, validation,
  blockers, and next action. Resolve shared-file ownership before concurrent edits.

## Reduce unnecessary context

Inspect the instructions actually used by the target task. Remove duplication,
stale decisions, and broad triggers that select unrelated workflows. Keep important
constraints and decisions in their owning document, with links from other files.
Load detailed references only for the active task. Preserve other roles' authority
and the user's existing preferences; do not replace developer roles with the manager.

Review a skill against realistic requests: a request that should select it, a
nearby request that should not, and a handoff or missing-capability case. Report
instruction improvements separately from any unmeasured token or speed benefits.

## Prepare compaction or a handoff

At a task boundary, before requested compaction, or when repeated context loss
appears, save a concise handoff in the relevant role or task Markdown document:

- Objective, assigned role, user constraints, and accepted decisions.
- Current owner/session ID and files in scope, including other sessions' changes.
- Completed work with verification evidence; pending work and blockers.
- The next concrete action and the few references needed to resume it.

Do not compact on a timer alone or invent a context-usage measurement. Use host
telemetry when available. Never treat a saved handoff as proof compaction ran.

Use a supported host compaction control if one is actually exposed for the target
session. Otherwise report that the handoff is ready and that `/compact` must be
issued in the target client where supported. Printing `/compact` in a tool result,
sending it as ordinary agent prose, or running it as a shell command does not
establish that the client performed compaction.

After compaction, restore the role, handoff, and immediate task references, verify
the objective and constraints survived, and resume the next action.

## Hook integration boundary

This skill contains no executable hook. When designing the integration, verify
current [OpenAI hook documentation](https://learn.chatgpt.com/docs/hooks).
`PreCompact` runs before compaction; `SessionStart` with source `compact` can add
context before continuation. These event handlers are distinct from initiating
compaction. Keep handlers short, scoped to the intended repository and session,
and free of recursive compaction. New or changed non-managed hook definitions
require platform trust review before running. Installation and runtime verification
must be reported separately from this Markdown workflow being created.

Report what was inspected, Markdown changed, validation performed, and anything
the available controls could not execute. Do not mark inaccessible sessions as
optimized or claim automatic maintenance is active.
