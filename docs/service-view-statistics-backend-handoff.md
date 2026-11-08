# Service view statistics — backend completion, 8 November 2026

Status: local backend implementation and offline verification complete; not deployed.

## Assignment and limits

Root assigned `/root/service_views_backend`, then the replacement Back End
Developer `/root/service_views_backend_finish` after the earlier worker was no
longer reachable. The replacement accepted on 8 November under the user's report
request and [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
This covers the report's server/shared contract, its exact protected-read audit
mapping, offline tests and this handoff. The backend practices skill and backend
role were applied. Root owns integration; Frontend owns presentation/capture;
[DB review](service-view-statistics-db-review.md) approved the existing query
source and privileges offline.

Only reversible local repository work and synthetic checks were performed. No
private environment/configuration read or change, connected database/service
access, application startup, migration, permission change, deployment or spending.
Existing activation/deployment holds remain unchanged. Preserve all unrelated
audit changes and prior report work.

## Implemented contract

- Authenticated `GET /api/reports/service-views/capabilities` exposes availability,
  UTC retention bounds and current active workspace Pro entitlement, without
  running the statistics query. It remains available to Free users.
- Authenticated `GET /api/reports/service-views` rereads entitlement on every
  execution and rejects Free/expired access before any aggregate query. Personal
  and company subscriptions remain separate. Missing membership/inactive company
  fails closed; input cannot override the server-derived actor or workspace.
- Strict dates/employee input permits UTC calendar days from today minus 89 days
  through today. Future/reversed/invalid/out-of-window dates are rejected. The
  query excludes future and expired events even if cleanup has stopped.
- The source is retained `service_views` product events, independent of worker
  processing. Current permitted services include zero-view services. Company
  owner/admin access is scoped to the company; other members see only currently
  assigned services. Employee filters only narrow access. Source workspace and
  employee-name joins prevent cross-workspace data leaks.
- Counts use PostgreSQL text and application BigInt; visitor identities are never
  projected. The 10,001-row sentinel rejects oversized catalogues rather than
  returning partial totals. Known controlled errors and generic unavailable
  failures avoid exposing adapter details. Responses are private/no-store and
  the two endpoints share an authenticated 30-request/minute limiter.
- Disabled product tracking returns unavailable instead of successful zero counts.
  Coverage is explicitly unknown: repeat details opens count, historical gaps and
  deletion/retention losses cannot be inferred from current source rows. Employee
  attribution uses current service assignment, not a historical employee snapshot.

Implementation: [shared DTO/window](../shared/service-view-report.ts),
[service](../server/service-view-report/service.ts),
[store/query](../server/service-view-report/store.ts),
[routes](../server/service-view-report/routes.ts), with scoped registration in
[server routes](../server/routes.ts).

## Security correction and verification

The new statistics read uses the existing `services.provider` workspace audit
category accepted by Root and the DB owner. Its matcher now includes Express's
case variants and optional trailing slash. The initial exact-case/exact-path
matcher would have let those successful aliases bypass durable audit capture.
Only this report's mapping in [protected reads](../server/audit/reads.ts) changed;
no applied audit contract, category or migration changed.

- `node --import tsx scripts/test-service-view-report-backend.mjs` passed after
  the correction. It exercises Free/Pro/expired/null/inactive/missing access,
  disabled capture, strict UTC range/input bounds, exact counts above Number's
  safe integer range, invalid store data, catalogue overflow, subscription expiry
  during execution, SQL compilation and the injected store adapter.
- The same runner exercises actual Express 4.21.2 request/response handling in
  process, with synthetic auth, persistence and audit. Canonical, trailing-slash,
  uppercase and mixed-case/slash paths each return counts only after exactly one
  audit capture; sink failure returns 503 without counts or service names. It also
  covers 401/403/200, capability access, strict query errors and disabled capture.
  No socket listener, real Auth/session store, database or external service runs.
- `npx tsc --noEmit --incremental false` passed on 8 November after the Frontend
  component existed. Backend runtime code and shared contracts are type checked;
  `.mjs` test execution is behavioral evidence, not TypeScript test coverage.
- Scoped `git diff --check` passed; Git reported only its existing LF/CRLF notice
  for `server/routes.ts`.
- The DB owner's separate production-SQL compilation review passed; its historical
  grant/RLS and live execution limitations remain as documented there. No SQL or
  schema change followed that approval.

The initial worker's loopback test encountered sandbox EACCES; its runner was
changed to in-process HTTP before this completion, without network escalation.
Current passing evidence uses that in-process runner. No new dependency was added.
Tests here are language-neutral synthetic backend checks. Shared UI acceptance
is limited to en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

Offline results do not verify live row counts, query plans, RLS/grants, runtime
capture activation or deployed audit storage. The existing in-memory rate-limit
store is per process, not a distributed quota. The service rejects lease expiry
during a request; it does not promise instantaneous mid-query revocation of a
changed subscription. Current membership/assignment is rechecked by the query.

## Recovery and next owner

Revert only the report's new shared/server modules, scoped registration and audit
mapping, plus its tests/UI through the relevant owners. No database rollback is
needed because no database objects were changed. Root completes integrated
Frontend acceptance and the final user handoff. Connected verification or release
requires the existing or newly obtained exact-target execution authorization.
