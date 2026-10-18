# High-priority backend hardening

Implemented locally on 18 October 2026 following the user's request to start the
high-priority backend improvements and delegate work in other areas. This covers
the four high findings from the backend review; it is not a full security audit
or a deployment record.

## Changes and behavior

1. **Unverified payment state changes:** authenticated
   `POST /api/payments/process` now returns `501 PAYMENTS_UNAVAILABLE` with
   `Cache-Control: no-store`. The demo route cannot mark a booking paid in any
   environment. Real payment processing still requires a separate integration
   with verified provider events and payment-state rules.
2. **Unbounded public search:** both public search endpoints validate query
   shapes, dates, times, service types, age groups, and coordinates before querying.
   Search text is limited to 200 characters; date ranges are inclusive and at
   most 31 days. Availability-only search requires a date. Location searches
   require latitude, longitude, and radius together. Invalid requests return
   `400 INVALID_SEARCH`.
3. **Unbounded semantic work:** public searches materialize at most 500 candidate
   services/embeddings and 5,000 relevant availability schedules. Queries fetch
   one extra row to detect overflow and return `422 SEARCH_TOO_BROAD`, rather than
   silently presenting an incomplete candidate set. Candidate filters and active
   service/company checks run in SQL before the limit. Availability rows are
   scoped to candidate workspaces/services and requested dates. Semantic results
   hydrate in one batch, preserve similarity order, and contain at most 100
   results. `X-Search-Truncated: true` identifies a truncated semantic result list.
4. **Unhandled semantic fallback failure:** all asynchronous route and fallback
   failures are caught under Express 4. An unavailable provider may fall back to
   bounded text search with the same filters; a failed fallback returns a safe
   `503 SEARCH_UNAVAILABLE`. Raw search text and provider errors are not logged by
   these handlers.

Public responses retain the existing JSON array contract. Structured error
responses contain a code and a safe message. Public query schemas reject internal
provider/company/service-ID filters, so callers cannot bypass limits using the
scoped catalog path. Company and personal schedules use separate workspace keys.
Location predicates exclude expired Google coordinates.

## Request and provider budgets

Each server process applies a 60-second window:

| Budget | Limit |
| --- | ---: |
| Combined public exact/semantic requests per IP | 60 |
| Combined public exact/semantic requests per process | 300 |
| Semantic endpoint requests per IP | 10 |
| Semantic endpoint requests per process | 30 |
| Concurrent embedding calls per process | 2 |
| Embedding request timeout | 8 seconds |
| SDK retries for public embedding requests | 0 |

Rate limits return `429 SEARCH_RATE_LIMITED` and retry/rate-limit headers.
Concurrency exhaustion returns 429 with `Retry-After: 1`. Disconnects abort an
active embedding request. Exact text matches and empty embedding candidates do
not make a paid provider call. Public search responses use `Cache-Control: no-store`.

These are in-memory, per-process controls: restarts reset counters and additional
replicas multiply the aggregate budget. A deployment-wide budget requires a
coordinated shared store or gateway control. Proxy trust was not changed; confirm
the production proxy/IP configuration before choosing operational limits.

## Frontend coordination

The Front End Developer implemented a 400 ms debounce, AbortSignal forwarding,
disabled automatic retries, and removed the duplicate browser-side semantic
fallback. Invalid filters suppress requests. Validation, server errors, retry,
loading, empty-result, and truncation messages use translation resources in all
11 supported languages. Error/pending/invalid states hide stale result cards.

The 100-result semantic cap is visible to users. Broad searches need narrower
filters; there is no pagination added in this change. Existing provider and
storefront catalog contracts remain unchanged.

## Authority, delegation, and recovery

The user's 18 October request authorized these application improvements and
cross-role delegation. Executors and limits were:

| Executor | Scope and environment |
| --- | --- |
| Back End Developer (primary agent) | Local backend routes, search validation/query code, provider request options, offline regression scripts, and package test entries |
| Front End Developer (`/root/frontend`) | Local search UI/client helper, translations, and related offline UI regression harnesses |
| DB Analyst/Developer (`/root/db_review`) | Read-only repository and generated-SQL review; no database access or mutations |
| CI/CD Developer (`/root/delivery_check`) | Specifically delegated by the Back End Developer to fix only the existing readiness query's TypeScript configuration typing in `server/index.ts`; same query, timeout, and runtime behavior |

The DB Analyst found no schema, migration, index, ORM-definition, or database
configuration changes necessary. Generated SQL was reviewed with Drizzle's
offline builders. No database commands, application startup, external-service
requests, credential changes, or deployment were performed. Tests used synthetic
fixtures, injected adapters, or an isolated loopback HTTP server; DB-backed tests
were excluded.

Recovery is a selective rollback of this task's code and test hunks, followed by
the checks below. Preserve the existing role, audit, container, health/shutdown,
and other unrelated working-tree changes. There are no data changes to recover.
Do not restore the unsafe mock payment write path as an operational workaround.

## Verification

Passed locally:

- `node --import tsx scripts/test-public-search.mjs`: real isolated Express HTTP;
  validation before storage, candidate/result bounds, provider timeout/retry/signal
  options, rate/concurrency limits, batch hydration, fallback failures, and disabled
  payment behavior. Loopback binding required execution outside the sandbox.
- `node --import tsx scripts/test-search-storage.mjs`: actual storage methods
  against fake query adapters and offline Drizzle SQL generation; parameter binding,
  global caps, scoped catalog compatibility, schedule bounds, and personal/company
  isolation. The database client is not loaded and no SQL is executed.
- `node --import tsx scripts/test-public-search-ui.mjs`: offline React rendering;
  validation, debounce, cancellation signal, no duplicate fallback/retries, safe
  error states, truncation, all locale resources, and language switching.
- `node --import tsx scripts/test-guest-search.mjs` and
  `node --import tsx scripts/test-search-sorting.mjs`: existing search, guest
  access, protected writes/images, sorting, and navigation regressions.
- `node --import tsx scripts/test-provider-catalog.mjs` and
  `node --import tsx scripts/test-storefronts.mjs`: existing scoped catalog and
  storefront regressions with database-access failure guards.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- `npm run build` (Vite frontend and esbuild backend).

The build reports existing stale Browserslist data and a frontend chunk larger
than 500 kB; it completes successfully. No dependencies or lockfile were changed.

## Remaining limits and follow-up

- Offline SQL generation does not prove execution plans, live PostgreSQL behavior,
  RLS, or production query latency. Limits bound materialized public candidates,
  not every database scan; review aggregation and geographic/text predicates can
  still scan substantial data. Any measured index/vector/schema proposal belongs
  to the DB Analyst and requires the user's selection before implementation.
- Scoped provider/storefront catalogs retain their existing uncapped contract;
  pagination needs coordinated backend/frontend work. They cannot be selected
  through the global public search query parameters.
- The existing availability search checks schedules rather than remaining slots
  after bookings. Correct booked-slot availability remains a separate medium
  finding; this change does not claim to solve it.
- Real browser/device layout, native-language translation review, live external
  integrations, production proxy behavior, and load testing were not performed.
- No release or deployment has been performed.
