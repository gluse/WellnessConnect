# Search duration backend fix — 3 November 2026

Completed / verified locally by assigned Back End Developer
`/root/search_duration_backend`, requested by `/root` for the user's bug report:
13 November 2026, 08:00–09:00 must exclude services longer than 60 minutes.
Authority: user bug request and [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible local backend search filtering and offline mocked regressions.
No frontend, schema/migrations, private configuration, connected database/service
operations, application startup, paid calls or deployment. Preserve unrelated work.

The existing search contract uses one daily time window across the selected date
range; this fix preserves that contract and existing time validation. Duration
must be bounded even when `availableOnly` is absent or false. Schedule selection,
breaks, booking availability and cleanup policy remain separate existing behavior.

Recovery: revert only this task's attributable changes. Owner will return exact
checks and limitations to `/root` for integrated review. Locale testing, if needed,
covers en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

`server/storage.ts` now applies a parameterized inclusive duration bound in shared
public search conditions, before SQL limits for ordinary search and semantic
candidates. Hydrated services retain the same constraint, including semantic
hydration and text fallback, independently of `availableOnly`. Partial time
filters retain the existing 00:00/23:59 defaults. No time filter preserves longer
services. No frontend contract change is required.

Verification on Node v24.22.2:

- `node --import tsx scripts/test-search-storage.mjs` passes. New regression first
  failed against unchanged storage: 30/60/61/180-minute services were all returned
  for 08:00–09:00; expected only 30/60. It now passes with inclusive 60, excluded
  61/180, absent/false/true availability toggle, partial bounds, multiple dates,
  no-time compatibility, semantic hydration and shared candidate SQL. Existing
  query bounds, visibility conditions and company/personal isolation pass.
  Repaired its stale import whitelist using rejecting booking/notification stubs;
  no database/client module or SQL execution is allowed by the harness.
- `node --import tsx scripts/test-public-search.mjs` passes, including date/time
  preservation through ordinary search, semantic text/candidate/hydration paths
  and embedding-failure text fallback. The first sandbox attempt failed with
  loopback `EACCES`; the exact inspected test passed with approved escalation for
  local HTTP. All data access, embeddings and payment boundaries were synthetic;
  no connected application/database/service was used.
- `npx tsc --noEmit --incremental false` passes.

Security review: validated HH:mm values feed numeric parameters, existing public
visibility/workspace conditions remain in place, and filtering applies before
result caps without adding unbounded scans or exposing new data. No dependencies
or private configuration changed. Offline tests do not establish live database
query results or deployed behavior. Root owns integrated review/queue closure;
user may review the local fix. No activation or deployment performed.
