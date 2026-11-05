# Public-search pagination — DB review

## Scope and acceptance — 5 November 2026

Assigned DB Analyst/Developer `/root/wishlist_database_plan` accepted root's
dependency for the user's request for genuine public-search pagination/infinite
scroll: 24 items by default, at most 50 per page, continued results beyond the old
50-result endpoint limit and 500-candidate guard. Backend
`/root/wishlist_backend_plan` owns application/query implementation; Frontend owns
the infinite-results interface; root owns integrated task/handoff records.

DB scope is read-only local query/ordering review, offline SQL compilation/adapters
if needed, and this review. No storage edits without Backend coordination, schema
changes, migration, connected access, credential/private configuration, session
writes, deployment or activated TASK-042 artifact changes are included.

Status: **local DB review accepted for TASK-043**. The final builder, service,
read-only query adapter and API budgets were reviewed. DB independently passed
31 query-compilation checks and the 45-scenario Backend suite after inspecting its
imports/adapters. No local SQL/ordering/storage-contract blocker remains.
Connected PostgreSQL execution/performance is outside this review's scope.

## Repository evidence and agreed approach

- The original public endpoint defaults to 50 and slices that first response.
  Legacy storage limits broad materialized candidates to 501 and availability
  schedules to 5001, rejecting overflow; this is not continuation pagination.
- Age groups, public service/company visibility, duration and radius/coordinate
  expiry already have SQL predicates. `availableOnly` is currently applied after
  service/schedule hydration, so applying a page limit before it loses matches.
- The existing availability contract checks workspace/service schedules and a
  date/time overlap with conservative break exclusion. It does not establish
  bookable capacity or booked-slot availability; pagination must preserve that
  distinction and must not introduce a new scheduling product contract.
- Backend proposes a new injected SQL paging path rather than changing the
  existing scoped provider/catalog storage contract. All membership filters,
  including a correlated availability `EXISTS` over at most 31 requested days,
  precede ordering and `LIMIT`. This avoids materializing an entire candidate or
  schedule population in the application.
- Global ordering belongs to SQL before page selection, with a unique service-ID
  tie and explicit missing-value handling. Page/cursor selection must use the same
  exact key; displayed rounded distance cannot be a continuation key.
- A page selects at most `limit + 1` rows for lookahead. Hydration is bounded to
  those selected public service IDs and must not invoke legacy availability
  materialization again. No 500-candidate truncation may masquerade as exhaustion.

DB raised the nullable/microsecond `services.created_at` cursor risk. The implemented
query emits comparison keys through `jsonb_build_array`, preserving its timestamp
as a full-precision string; the service retains that string unchanged through the
signed continuation and binds it back as `timestamp`. Null cursor branches match
the query's explicit `NULLS LAST` order in both directions. Price/rating/distance
orders have a unique ID tie, with the same keyset rule before the page limit.

## Semantic ranking and bounded work

Backend's proposed semantic fallback computes cosine scores over existing JSONB
embeddings in SQL, preserving global ranking beyond the former 500-candidate limit.
No vector extension, index, schema or service is proposed. Query embeddings are
bounded, validated and reused only through bounded short-lived process context.

DB review requirements sent directly to Backend:

- Match vector positions with `WITH ORDINALITY`; do not form a Cartesian dot
  product. Require equal dimensions and nonzero norms, and reject invalid scores.
- Guard JSON array expansion/length and element casts inside safe expressions;
  separate `WHERE` terms alone do not make invalid JSON structures/casts safe.
- Preserve all ordinary public/filter/availability eligibility before semantic
  ranking, threshold and page selection. Hydration remains public and bounded.
- Use a request-local statement timeout and controlled unavailable response on
  budget exhaustion, never a fabricated final page or silently truncated corpus.

Global JSONB cosine ranking can examine all eligible embeddings and costs work
proportional to their count and dimensionality. A 51-row result cap bounds transfer
and hydration, not database scan/sort work. No measured query-plan, latency,
memory, lock or large-catalog scalability claim is made without separately approved
connected evidence. No speculative index/migration is justified by this review.

## Verification and limits

Initial inspection covered the actual storage, public-route/input schemas,
distance/location handling, availability filtering, vector helper and existing
offline storage/sorting adapters. Existing test entrypoints were read before any
execution decision. No application, database, private settings or service started.

PostgreSQL 17 documentation consulted on 5 November 2026 supports the reviewed
query constraints: [LIMIT requires a predictable unique order and large OFFSET can
cost skipped-row work](https://www.postgresql.org/docs/17/queries-limit.html),
[descending order defaults to NULLS FIRST unless explicitly changed](https://www.postgresql.org/docs/17/queries-order.html),
and [JSON processing functions operate on specific JSON structures](https://www.postgresql.org/docs/17/functions-json.html).
These sources do not prove that a new SQL string has executed successfully.

DB independently ran an inline `node --import tsx --input-type=module` compilation
check using `PgDialect` and the actual `searchPageSQL` builder: **31 checks passed**.
It covered all seven sort choices with 24/50 limits and lookahead, bound text with
SQL-like punctuation, duration/radius/age/date/workspace predicates, conservative
break handling, null-key continuation, unchanged six-digit timestamp strings and
vector ordinality/dimension guards. No database client/private configuration was
loaded and no SQL was executed. This is query compilation/parameter evidence,
not a PostgreSQL parser or execution-plan validation.

Implementation findings sent directly to Backend: require strict finite score
exclusion (`< Infinity`, not `<=`), validate a finite nonzero squared query-vector
norm (tiny nonzero values can underflow when squared), precheck stored dimensions
before expanding arrays, and preserve semantic-specific rate budgets on the new
semantic page route. **All four findings are resolved in the reviewed code**:
the score uses strict `< Infinity` plus NaN exclusion; query-vector squared norm
must be finite and positive; nested type/length CASE guards bound stored-array
expansion to the validated query dimension (at most 8192); first semantic pages
consume existing paid-work budgets while signed continuations reuse their cached
embedding under the ordinary read limits. Invalid/expired continuations cannot
create paid embedding work through that continuation path.

Final adapter review confirmed `SET TRANSACTION READ ONLY` followed by a local
**8000ms statement timeout** before each ranking query. The database returns at
most `limit + 1` IDs/keys; DTO hydration is bounded to selected page IDs through
`searchServices({serviceIds})`, with no legacy availability materialization.
The service checks current public visibility and coordinate expiry again when
hydrating. No cursor has a 500-result terminal boundary, and no unbounded rows or
embedding corpus are transferred into application memory.

DB independently inspected and ran
`node --import tsx scripts/test-search-pagination-backend.mjs`: **45 scenarios
passed**. These exercise 620 synthetic rows through real page/service/API code,
global sorts/nulls/ties, exact timestamp continuation, filter-bound/tampered/
expired cursors, semantic continuation beyond 100 with one reused embedding,
invalid-vector/fallback/error handling, SQL compilation/binding, read-only timeout
adapter calls, legacy API compatibility and paid-work budgets. Persistence and
embedding results are injected; HTTP uses in-process streams, with no sockets,
database engine, credentials/private configuration or external provider.

This suite demonstrates application/adapter behavior over synthetic ranked rows;
it does not execute the generated SQL or establish a live PostgreSQL query plan.

Acceptance checks reviewed in the final owner implementation: complete paging
beyond 50 and 500, all sort directions/missing values/stable ties, date/time/age/
radius/expiry filters before limiting, availability across the former candidate
boundary, malformed/changed cursor handling, semantic rank/dimension/norm safety,
bounded parameters/result hydration and controlled timeout/error behavior.

Fresh locale matrices remain **en/lv/ru only**; ar/RTL, zh, fr, de, hi, ja, pt and
es are deferred. No locale matrix is run by this initial DB review.

Recovery: revert only this search task's attributable local changes; no database
migration or activated wishlist SQL/receipt recovery is needed. Next owner action:
root integrates Backend/Frontend evidence and reports local completion separately
from any future authorized live-query/performance verification or deployment.
DB review introduced only this document; application changes remain Backend-owned.
