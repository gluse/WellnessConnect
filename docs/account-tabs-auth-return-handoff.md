# Account tabs: sign-in return destinations — 8 November 2026

Status: accepted / completed locally with passing offline verification.

Requester and originating task: Frontend `/root`,
[account tabs redesign](account-tabs-redesign-handoff.md). Assigned Backend owner
and executor: `/root/account_return_paths_backend`. Accepted under the standing
cross-role authorization in AGENTS.md: routine, reversible local backend
dependencies and offline tests. Scope is the two exact return paths in
`shared/navigation.ts`, the dedicated offline test and this record. No database,
session-store writes, private configuration, connected services or deployment.

The new provider settings pages would otherwise be dropped as invalid sign-in
return destinations. Add `/my-services/settings/pricing` and
`/my-services/settings/addresses` to the existing exact-match allowlist used by
authentication entry/callback flows. Retain exact matching and existing route
authorization; this grants no provider/workspace access itself.

Validation passed:

- `node --import tsx scripts/test-account-settings-auth-return.mjs`: 45 cases;
  both new destinations, encoded login-query round trips, external/near-miss/
  traversal/query/fragment/control-character/non-string rejection, and existing
  destination compatibility. The test imports only the pure navigation helper.
- `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 shared/navigation.ts`.
- Scoped `git diff --check`.

Language-independent routing checks only; no language resources are tested.
en/lv/ru remain the project test scope; ar/RTL, zh, fr, de, hi, ja, pt and es
are deferred. These checks do not exercise real authentication, callbacks,
database sessions or deployment.

Recovery: remove only the two new allowlist entries and this dependency's new
test/record. Preserve other account redesign and pre-existing reminder work.
Next: return offline validation evidence to Frontend for integrated sign-in
navigation verification.
