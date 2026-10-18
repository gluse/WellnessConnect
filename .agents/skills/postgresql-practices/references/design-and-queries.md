# Design and queries

Reviewed: 18 October 2026. Use documentation for the actual server version.
These decision aids do not approve schema changes.

## Integrity and workspace relationships

Prefer named `CHECK`, `NOT NULL`, `UNIQUE`, foreign-key, and exclusion constraints
for the rules they express. `CHECK` accepts null results; use `NOT NULL` separately
when absence is invalid. Defaults do not prevent explicit nulls. Unique constraints
normally allow multiple nulls. Nullable composite foreign keys need deliberate null
handling because default matching can skip checks. Do not use a `CHECK` calling a
function to enforce changing data in other rows. Foreign keys do not automatically
index referencing columns; add those indexes when queries/deletion checks justify it.
Source: [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).

For this project, verify related services, employees, addresses, schedules, bookings,
memberships, and invitations belong to the intended workspace. An ID-only foreign
key proves existence, not tenant consistency. Prefer composite keys where practical;
nullable personal/company scope needs explicit design. A partial unique owner index
enforces at most one owner, not owner existence or agreement with `companies.owner_id`.
Preserve compatibility with the ownership-transfer transaction.

Drizzle `varchar({ enum: [...] })` constrains inferred types, not SQL values.
JSONB `$type` also does not validate stored JSON. Reconcile SQL migrations, Drizzle
constraints, table filters, and setup scripts before claiming parity.
Source: [Drizzle column types](https://orm.drizzle.team/docs/column-types).

## Types and history

Use `timestamptz` for instants, `date` for calendar dates, and local `time` plus an
IANA timezone for recurring working hours when appropriate. `timestamptz` preserves
an instant, not the original timezone name. Establish the meaning of legacy values
before conversions and use explicit timezone interpretation. Test daylight-saving
gaps/repeated times instead of silently relying on server timezone settings.
Source: [Date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html).

Use exact `numeric` or a defined integer-minor-unit model for authoritative amounts,
with an explicit currency contract and consistent application rounding. Avoid binary
floating point for authoritative totals. Retain existing IDs unless migration has
a demonstrated benefit.
Source: [Numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html).

Preserve booking duration, cleanup, resource, and charged-amount snapshots where
listing edits must not change reservations. Investigate legacy values instead of
fabricating them from current listings. Choose deletion behavior explicitly;
cascading away transaction history is not a convenience default. Extra personal
or location snapshots require an agreed purpose and retention policy.

## Query and index evidence

Start with query frequency, total cost, latency, table size, and existing indexes.
Use plain `EXPLAIN` initially; costs are not milliseconds. When execution is
authorized and load acceptable, compare representative `EXPLAIN (ANALYZE, BUFFERS)`
plans, estimates/actual rows, loops, sorts, and I/O. Write statements and side-effecting
functions need write authorization even under `ANALYZE`; rollback cannot undo
every possible side effect.
Source: [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html).

Shape B-tree indexes around actual equality/range filters, joins, and ordering.
Leading equality columns often matter; skip-scan support is version-dependent and
does not make ordering irrelevant. Consider partial/covering indexes only for concrete
queries. Account for write/storage cost and existing unique/primary-key indexes
before adding overlapping indexes.
Source: [Multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html).

Flag unbounded catalog, schedule, booking, and embedding loads. Prefer bounded SQL
filtering and deterministic pagination when needed; coordinate application changes
with their owner. Do not prescribe PostGIS, vector indexes, full-text search, or
partitioning without scale, query, and extension-support evidence.

## Concurrency

A check followed by an insert is not safe just because both are in a transaction.
Use appropriate locking, atomic statements, constraints, or isolation. Acquire
locks consistently, keep transactions short, and avoid remote calls while holding
locks. Preserve provider-lock coverage across booking/scheduling paths before
narrowing lock scope.
Source: [Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).

Repeatable Read and Serializable may produce serialization failures. Where safe,
retry the whole transaction with bounded attempts and controlled external effects;
do not simply rerun the failed statement.
Source: [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Exclusion constraints can protect exclusive resource intervals; a blanket overlap
ban is unsuitable for group/shared capacity. Define resource, statuses, half-open
intervals, duration, cleanup, and nullable employee behavior first. Test competing
requests, not only sequential cases, in an approved isolated database.
