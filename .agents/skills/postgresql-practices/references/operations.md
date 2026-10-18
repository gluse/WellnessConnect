# Operations and recovery

Reviewed: 18 October 2026. Follow root database authority and actual server/host support.

## Migrations

Prefer versioned, ordered migrations with tracked applied state over unrelated setup
commands and production schema pushes. Reconcile ORM definitions, custom SQL,
grants, functions, and jobs. `IF NOT EXISTS` does not verify an existing definition.
Cover fresh installation and upgrades; do not casually rewrite applied history.

Assess scans, rewrites, lock level/duration, disk/WAL growth, backfill size, and
old/new application compatibility. For supported constraints, consider `NOT VALID`
then separately scheduled `VALIDATE CONSTRAINT` to reduce blocking; locks and
legacy violations still need handling. Choose operation-specific lock/statement
limits and failure behavior. Use expansion/backfill/cutover/removal when needed;
small tables may warrant a simpler approved migration.
Source: [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html).

Choose ordinary versus concurrent index builds from workload and availability.
`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, requires extra
work, and may leave an invalid index after failure. Verify catalog validity and
plan recovery; an existing name does not prove success.
Source: [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html).

## Privileges and functions

Separate application DML from schema ownership, migrations, and maintenance where
practical. Review schema/table/sequence/function and future-object privileges.
RLS does not grant ordinary privileges; enabled RLS without applicable policies
normally denies access. Owners normally bypass it; superusers and `BYPASSRLS`
roles bypass it. Test the actual runtime principal and cross-workspace cases.
Owner-connected Express authorization is not database-enforced tenant isolation.
Source: [Row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Prefer invoker functions unless elevated rights have a concrete purpose. For
`SECURITY DEFINER`, use restricted ownership, a trusted explicit `search_path`
with `pg_temp` last, qualified objects, and deliberate `EXECUTE` grants. Revoke
default `PUBLIC` execution in the creation transaction when access must be restricted.
Source: [Function security](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).

## Connections

Match direct/session/transaction pooling to actual driver behavior. Use suitable
direct/session connections for administrative tools and check host restrictions.
Transaction pooling does not preserve arbitrary session state across transactions.
Verify prepared-statement support for the actual pooler/driver; do not copy a
Postgres.js setting into this project's `pg` driver. Budget connections across all
replicas/workers/tools instead of raising every pool. Release checked-out clients
on errors and scope request identity/context to its transaction.
Source: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Use encrypted connections with certificate/hostname verification appropriate to
the driver. `sslmode=require` alone is not equivalent to `verify-full`. Preserve
the project's verified-TLS requirement; do not bypass certificate failures by
disabling verification. Keep credentials out of commands and reports.
Source: [PostgreSQL SSL](https://www.postgresql.org/docs/current/libpq-ssl.html).

## Maintenance and monitoring

Keep autovacuum effective. Investigate dead tuples, long/idle transactions,
transaction-ID age, statistics freshness, and table/index growth before tuning.
Routine vacuum generally reuses space without shrinking files. `VACUUM FULL`
rewrites tables, requires extra disk, and blocks access; it is not routine cleanup.
Manual `VACUUM` or `ANALYZE` is maintenance execution, not read-only inspection.
Source: [Routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html).

Use available `pg_stat_statements` aggregates to prioritize query work. Enabling
the extension/preload configuration may require privileged changes or restart;
propose it separately. Limit query-text and parameter exposure in reports.
Source: [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html).

## Backup and recovery

Agree recovery-point/time objectives. Choose managed backups, physical/WAL-based
recovery, and logical exports accordingly; a single dump is not a complete disaster
recovery plan. Verify retention, protection, external Auth/Storage coverage, and
isolated restore drills. Restores and drill fixtures are authorized writes.
Source: [Backup and restore](https://www.postgresql.org/docs/current/backup.html).

Check compatible `pg_dump` versions and the complete dependency set. Table-filtered
exports do not automatically include all dependencies; one-database dumps omit
global roles/tablespaces. Recheck this project's old explicit table/sequence lists
against the current schema. Validate counts/invariants, sequences, grants/RLS,
functions/jobs, and application compatibility. Plan cutover and reconciliation of
new writes: retaining the source alone does not make rollback lossless.
Source: [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).
