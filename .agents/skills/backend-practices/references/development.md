# Backend development

Reviewed: 18 October 2026. These are decision aids, not an upgrade plan.

## Repository baseline

Read-only evidence from `package.json`, `package-lock.json`, `tsconfig.json`,
`Dockerfile`, and backend source at review time:

| Component | Locked version or repository configuration |
| --- | --- |
| Express / express-session | 4.21.2 / 1.18.1 |
| express-rate-limit | 8.7.1 |
| TypeScript | 5.6.3; strict mode; ESM; bundler module resolution |
| Zod / drizzle-zod | 3.25.76 / 0.7.0 |
| Drizzle ORM / node-postgres | 0.39.1 / 8.23.1 |
| Supabase JavaScript SDK | 2.117.3 |
| tsx | 4.19.2 |
| Node | Dockerfile default: `node:22-bookworm-slim`; local inspection: v24.21.0 |

This does not establish installed/deployed versions, an advisory audit, or the
image resolved from a mutable tag. Recheck the current lockfile. Use a supported
LTS runtime for production and coordinate image/runtime updates with CI/CD.
Source: [Node release policy](https://nodejs.org/en/about/previous-releases).

## Express request and failure paths

Express 4 does not forward rejected async handler promises automatically. Await
work inside `try/catch` and call `next(error)`, or use a verified existing wrapper.
Do not copy Express 5 promise examples unchanged. Install four-argument error
middleware after the affected routes. If headers were already sent, delegate to
the next error handler rather than sending twice. Map known failures to controlled
status/messages; return generic server failures without stack/provider details.
Source: [Express 4 error handling](https://expressjs.com/en/4x/guide/error-handling/).

Project convention: keep `/api` not-found/error responses JSON and register the
API fallback before the SPA fallback. Return after sending an early rejection.
Separate request/response mapping from business rules when useful; keep shared
pure logic free of database/client initialization on import.

## Types and validation

Keep strict checks enabled; use `unknown` and narrowing at untrusted boundaries
instead of unchecked casts or `any`. Static types do not validate HTTP bodies or
external responses. Preserve runtime ESM loader/import compatibility as well as
compile-time resolution; bundler resolution alone does not prove Node execution.
Sources: [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html),
[narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html).

Use installed Zod 3 APIs such as `safeParse` and deliberate object schemas.
Validate query/path/body types, lengths, ranges, and field combinations. Choose
stripping or `.strict()` for unknown fields deliberately; avoid passthrough for
writable entity fields. Use parsed output, not the original payload. Consider
coercion surprises, such as empty strings becoming numbers, and async parsing
for async refinements/transforms. Do not assume Zod 4 or current Drizzle validation
examples are compatible with these versions.
Source: [Zod 3 documentation](https://v3.zod.dev/).

## Queries and consistency

Use Drizzle builders/tagged `sql` or pg parameterized values. Never interpolate
untrusted values into `sql.raw()` or SQL strings. Parameters do not stand for SQL
identifiers: map permitted sort columns/directions to known expressions. Drizzle
`sql<T>` annotates types; it does not perform runtime conversion or validation.
Sources: [Drizzle SQL](https://orm.drizzle.team/docs/sql),
[pg queries](https://node-postgres.com/features/queries).

Use the transaction-bound `tx` throughout approved Drizzle transactions. Raw pg
transactions require one checked-out client for every statement, rollback on
failure, and release in `finally`; do not mix with `pool.query`. Keep transactions
short and avoid remote calls while holding locks. Database execution still needs
the DB workflow.
Sources: [Drizzle transactions](https://orm.drizzle.team/docs/transactions),
[pg transactions](https://node-postgres.com/features/transactions).

Reuse bounded pools, release checked-out clients on every path, budget connections
across replicas, and close pools during orderly shutdown.
Source: [pg pooling](https://node-postgres.com/features/pooling).

Project rules: retain workspace filters on reads/mutations and nested resources.
Bound pages with deterministic ordering. Preserve money precision and historical
booking duration/cleanup snapshots. Test DST gaps, repeated local times, and exact
interval boundaries. Read-then-write alone does not prove race safety; coordinate
atomic enforcement with the DB role. Use evidence for query/index optimization.

## Runtime and integrations

Bound payloads, CPU-heavy validation, JSON, regex work, and parallel fan-out. Prefer
asynchronous I/O; move demonstrated CPU-heavy work off the event loop when needed.
Set external-call timeouts, response-size bounds, and concurrency limits. Retry
only suitable transient/idempotent operations with a small budget; avoid blindly
retrying state changes after ambiguous failures.
Sources: [Node event loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop),
[Node security](https://nodejs.org/en/learn/getting-started/security-best-practices).

Distinguish liveness/readiness. On shutdown stop accepting traffic, drain with a
deadline, and release resources. Keep probes free of private details and unapproved
DB writes. Coordinate timing with CI/CD.
Source: [Express health and shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown/).
