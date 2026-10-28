# Frontend regression execution approval for audit work

Date: 19 October 2026.

**Decision:** The assigned Front End Developer `/root/forms_design` specifically
authorizes Back End Developer `/root/audit_backend` to execute the unchanged
frontend portions of the four mixed regression scripts below, within the local
isolation and limits in this record. This supports the current authorized audit
backend regression work. It grants no frontend implementation authority.

## Approved scope and commands

Run each in its own fresh Node process from
`C:\Source\Private\WellnessConnect`, using existing local dependencies:

```powershell
node --import tsx scripts/test-social-auth.mjs
node --import tsx scripts/test-password-update.mjs
node --import tsx scripts/test-account-details.mjs
node --import tsx scripts/test-administration.mjs
```

The commands execute whole mixed scripts; this approval covers their existing
React renderer assertions, mocked browser globals, in-memory navigation/query
state, synthetic user input, and mocked frontend requests. Their backend portions
remain subject to the executor's existing backend assignment. This Front End
Developer does not delegate backend, database, infrastructure or deployment scope.

| Reviewed script | SHA-256 of approved unchanged script |
| --- | --- |
| [test-social-auth.mjs](../scripts/test-social-auth.mjs) | `11B4DB55B66EE62743BDCB790931E07FF8738200755B8E12119F1AC22EDFDE6C` |
| [test-password-update.mjs](../scripts/test-password-update.mjs) | `E2D035A3DC04AC01551672B1EC146A100E65A0FC1BC57FB0E8A2B1145638169D` |
| [test-account-details.mjs](../scripts/test-account-details.mjs) | `C0A4C40099EE6700A720D67BB64B4FD8D6B13BAAE4CA16920FE6C5B86921426B` |
| [test-administration.mjs](../scripts/test-administration.mjs) | `0C8FF32F1ACEA3C8BD085DE4ED512FF2B3DA834BD01CBCB9D61FEBD820164073` |

Reuse this execution approval for necessary reruns of the same unchanged frontend
assertions during the current audit task. If the scripts, frontend imports,
dependency/bootstrap behavior, isolation, or external side effects change, obtain
a focused review of that change before relying on this approval.

## Required isolation

- For every child process, set both `DOTENV_PATH` and `DOTENV_CONFIG_PATH` to the
  absolute workspace path `C:\Source\Private\WellnessConnect\.audit-unit-no-env`.
  Verify this path does not exist immediately before use; do not create it or
  fall back to the project's `.env`. Set `DOTENV_DEBUG=false` and
  `DOTENV_QUIET=true`. No credential file inspection is authorized.
- Set `AUDIT_ENABLED=false` and `AUDIT_WORKER_ENABLED=false` in those child
  processes. Use a fresh process with no injected audit sink or additional
  application/worker preload. The reviewed `server/audit/http.ts` enables capture
  for an injected sink or the exact value `AUDIT_ENABLED=true`; these baseline
  scripts do not install a sink.
- Preserve each script's fixture environment before its backend imports:
  `NODE_ENV=test`, database URL `postgresql://fixture:fixture@127.0.0.1:1/fixture`,
  Supabase URL `http://127.0.0.1:1`, and synthetic keys/session data as supplied by
  the script. Never substitute live credentials or URLs, read secret values into
  output, or relax a fixture to make a failing test pass.
- Keep the existing `globalThis.fetch` mocks active; unexpected frontend requests
  must stay within their assertion/throw branches. Do not restore native fetch
  inside a running test, execute actual browser navigation, invoke Maps/upload/
  embedding services, or use a connected application/API.
- Environment overrides must remain local to the test child process or be
  restored after execution; they must not alter another session's configuration.

## Review findings

Read [AGENTS.md](../AGENTS.md), the
[Front End Developer role](../ROLE-FRONT-END-DEVELOPER.md), the
[frontend practices skill](../.agents/skills/frontend-practices/SKILL.md) and its
[testing reference](../.agents/skills/frontend-practices/references/testing.md).
Reviewed the four scripts and relevant frontend/backend imports and startup paths.

- Frontend execution uses `react-test-renderer`, synthetic `window`/`document`,
  wouter `memoryLocation`, and seeded/cleared TanStack Query state. Login/account
  mutations and directory reads use in-memory `fetch` responses; redirects are
  captured in an array or memory router. No real browser is launched.
- [queryClient.ts](../client/src/lib/queryClient.ts) delegates requests to mocked
  fetch. Its [location-expiry timer](../client/src/lib/location-expiry.ts) only
  transforms local cached values and is unreferenced in Node. Account/address
  hooks and auth/admin hooks use the same request boundary. Administration loads
  its English resources from a local JSON file, without the HTTP locale backend.
- Backend fixtures are installed before importing `server/auth.ts`,
  `server/routes.ts`, `server/adminRoutes.ts`, `server/db.ts` and
  `server/supabase.ts`. SDK HTTP is mocked, profile methods/company provisioning
  are stubbed where exercised, and administration injects company/subscription
  loaders. Session save/regenerate/destroy operations use synthetic objects.
- `server/db.ts` imports `dotenv/config`; suppressing actual env-file loading is
  therefore required even though scripts later use fixture URLs. The installed
  dotenv 18.0.7 exports `./config` through `dist/config.cjs`; its
  `dist/index.cjs` environment-option parser honors `DOTENV_PATH` with
  `DOTENV_CONFIG_PATH` fallback, and uses only the supplied path. The installed
  `pg-pool` constructor creates no connection by itself. The reviewed
  `connect-pg-simple` constructor does not start a pruning timer or access the
  store until store operations are exercised. These scripts collect middleware
  on fake apps instead of running live session middleware.
- Account regression registers routes and creates an unbound HTTP server; it
  never calls `listen`, closes the server at teardown, and ends the fixture pool.
  The other backend scripts also end their pool. They do not import
  `server/index.ts` or start the audit worker. Audit runtime access is lazy and
  disabled under the required flags.

No actual external write path was found in the reviewed execution under these
conditions. Fixture URLs alone are not the justification: mocks, injected/stubbed
dependencies, lazy initialization and disabled audit capture establish the
expected offline behavior. This is a source review, not a network trace or test
execution result.

## Limits, verification and recovery

No frontend source/test edits, dependency installations, new loaders/shims, app
startup, browser execution, external service access, or database/session
persistence is granted here. Do not invoke `npm` lifecycle hooks or other tests
through this approval. Database setup, temporary/rolled-back writes and audit
outbox delivery remain outside it.

At review time the four script files had no working-tree changes. Dotenv's
current installed export paths and environment controls were checked directly;
no alternate environment, install or shim is needed by this approval. Report
any dependency/import failure as unavailable validation; this record does not
approve an install or shim to bypass it. A changed dependency environment needs
a focused check of its bootstrap/path controls before reusing this approval.

The executor must record exact commands, isolation, exit status and results in
the audit handoff. Stop on unexpected native network/database/session activity;
do not retry against a connected service. Preserve failed assertions and report
unavailable checks honestly. These renderer checks do not establish browser
layout, keyboard focus, accessibility, RTL, physical-device or live-auth coverage.
New audit behavior needs its separately authorized backend tests; disabling audit
capture in these baselines does not validate the new capture path.

Recovery is to terminate the isolated Node process, restore any parent-process
environment overrides, and discard only its in-memory fixtures. No connected
state is intended to change. If unexpected external activity is observed, report
it to General Manager and the applicable owner before any cleanup operation;
database recovery cannot be authorized by this frontend approval.

The review itself ran no test, started no app and changed only this Markdown
record. [The forms design proposal](forms-design-proposal.md) is preserved.
