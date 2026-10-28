# Backend unit tests and verification

Reviewed: 18 October 2026. Test ownership/completion requirements remain in
`ROLE-BACK_END_DEVELOPER.md`; database authorization remains in `AGENTS.md`.

## Select safe checks

The repository uses `node --import tsx scripts/test-*.mjs` and `node:assert/strict`.
Some scripts mix frontend/backend checks, some mock local HTTP, and others connect
to databases. Inspect scripts, transitive imports, environment loading, lifecycle
hooks, and setup/teardown before execution. Fake connection URLs do not prevent
imported modules from attempting connections.

Do not start `server/index.ts` for unit tests. DB/client imports may initialize
configuration/resources; prefer pure functions and injected adapters. Exclude
real credentials/live endpoints, reject unexpected external calls, and clean up
on failure. In-process/loopback HTTP with mocked providers is a transport check,
not live integration proof. State which category actually ran.

Temporary fixtures, rollback-only transactions, session-store writes, setup
scripts, and indirect API writes still need scoped DB authorization. Replace
those boundaries with fakes for the ordinary unit workflow.

## Test observable behavior

Keep suitable existing tooling; a framework migration is unnecessary. When a
runner helps, Node's `node:test` supports hooks/mocks; verify feature stability on
the supported Node version. Specify test paths instead of assuming discovery
includes scripts. Await async assertions, reset mocks/timers/globals, close local
servers/pools, and avoid concurrent tests that mutate shared globals.
Source: [Node 22 tests](https://nodejs.org/download/release/latest-v22.x/docs/api/test.html).

Choose affected cases rather than mechanically adding every row:

| Changed behavior | Useful checks |
| --- | --- |
| Protected access | Unauthenticated, forbidden, other workspace/object, revoked membership, allowed access; denied paths invoke no privileged effect |
| Inputs/write fields | Types, null/missing/unknown fields, bounds/coercion, prohibited role/owner/price overrides |
| Async failures | Rejected adapter promise reaches middleware, one response, controlled status, no private provider details |
| Sessions/OAuth/passwords | Rotation, expiry/failed refresh, retained permitted workspace, allowed redirects, CSRF header/token cases |
| Booking/state transitions | Interval edges, cleanup snapshots, cancelled status, DST gaps/repetitions, duplicate/out-of-order requests |
| External services/storage | Timeout, malformed response, retry budget, denied signing, unsafe URLs, oversized content, log redaction |
| Transaction logic | Correct transaction adapter, propagated failures, rollback/release paths; separately note unproven DB guarantees |

Use fixed clocks and synthetic data. For bugs, show the regression distinguishes
old/intended behavior when feasible. Assert outcomes/security effects, not source
substrings, incidental internal order, or mocks supplying the very decision under
test. Coverage can expose missed branches but does not establish correctness.
Authorization cases follow [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Type/build checks and evidence

Repository `tsconfig.json` excludes `**/*.test.ts`; `tsx` execution does not prove
successful type checking. Verify tests run and are type-checked where appropriate
before claiming coverage. Inspect include/exclude rules; do not silently change
shared compiler configuration. Check runtime imports/output when affected.

Choose inspected safe commands from `package.json`. `npm run check` runs `tsc`
and can update incremental caches; `npm run build` runs Vite/esbuild and writes
output. Their shown commands do not start the server, but inspect current plugins
and hooks too. Run relevant checks, not every `test:*` script; rerun after fixes.

Record commands, runtime, results, mocks, and limitations. Required failures or
unavailable tests mean incomplete verification; identify unrelated baseline
failures with evidence. Offline tests do not prove live RLS, DB locks/races, real
OAuth, production cookies/proxies, or deployment correctness.
