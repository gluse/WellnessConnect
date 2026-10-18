---
name: postgresql-practices
description: Review PostgreSQL schemas, queries, migrations, security, and reliability for WellnessConnect / FitsMyTime. Use for database analysis, design proposals, approved database work, and Supabase/Drizzle compatibility reviews; not unrelated application implementation.
---

# PostgreSQL practices

Use evidence and the simplest sufficient design. Official documentation reviewed
on 18 October 2026 supports this project-local skill; the deployed server version
and database state remain unverified.

## Authority and context

- Read root `AGENTS.md` and `DB-ANALYST-DEVELOPER.md`. Preserve the assigned role,
  user selection before changes, target-specific execution scope, and delegation
  boundaries. This skill does not grant database access or write authorization.
- Start with schema, migrations, table filters, setup/transfer scripts, connection
  code, and actual queries. Distinguish declared, migrated, and verified live state.
- When inspection is authorized, establish server/driver versions, connection mode,
  and managed-host restrictions. Use matching version documentation before proposing
  version-specific SQL; `/current/` documentation links change over time.
- For schema/query/concurrency work, read [design and queries](references/design-and-queries.md).
  For migrations/security/maintenance/recovery, read [operations](references/operations.md).

## Workflow

1. Establish requirements and affected environments. Trace reads and writes,
   including scripts/jobs. Gather bounded metadata and plans within authorization;
   keep private rows and credentials out of reports. Check indirect writes.
2. Review integrity, workspace boundaries, concurrency, compatibility, and recovery
   before performance. Missing indexes alone do not prove a slow query. A sequential
   scan may be correct. Use representative evidence and compare before/after.
3. Report prioritized findings with evidence, consequence, and a practical
   recommendation. Separate repository findings from assumptions about live data.
4. For changes, offer meaningful alternatives with a recommendation, application
   impact, locking/cost, validation, and recovery. Follow the role's user-choice
   workflow before implementation. Proposal approval is distinct from execution.
5. Within selected scope, use reviewable migrations and coordinate ORM/application
   changes. Record target, executor, approval, validation, and prepared/applied status.

## Decision rules

- Enforce stable invariants in PostgreSQL. TypeScript types, ORM relations, and
  defaults do not substitute for database constraints.
- Preserve workspace identity and historical booking snapshots, including when
  company ownership changes. Do not silently derive history from current listings.
- Prefer targeted constraints/indexes/query changes over speculative partitioning,
  denormalization, sharding, caching, or additional infrastructure.
- `EXPLAIN ANALYZE` executes its statement. Rolled-back writes, temporary fixtures,
  `ANALYZE`, extensions, and maintenance still need appropriate authorization.
  Inspect functions before treating a `SELECT` as read-only.
- Bound retries to operation semantics and authorized scope. Unexpected integrity
  failures, changed targets, or material scope changes require revising the proposal.

For reviews, return a concise prioritized list with object/file references and
evidence limits. For approved implementation, report compatibility order,
verification, recovery, and truthful deployment status. Skill files on disk do
not prove runtime discovery.
