# TASK-044 workspace currency defaults — 6 November 2026

Status: completed; local implementation and development migration 0021 verified.
User approved the suggested
currency-default update. Root coordinates and owns frontend editor/resolver/cache
integration; assigned Backend `/root/currency_backend`, DB `/root/currency_db`
and frontend settings/address/translations `/root/currency_money` accepted through
live agent tools. Scope: necessary local code/schema/migration preparation and
offline/mocked tests. Initial acceptance inferred no connected/private execution
authority; the subsequent exact-target approval and result are recorded below.
TASK-039 migration0020 backup waiver remains task-specific. No startup/deployment.

Accepted priority: saved/manual service currency; explicit location pricing
override; workspace default; service country; confirmed workspace business country;
manual choice when unresolved. Existing workspaces get initial EUR defaults, based
on the user's confirmation of existing pricing. Newly unset preferences have no
automatic global EUR default. Defaults never rewrite saved services/bookings.
Company settings belong to the shared workspace; personal settings to the owner.
Customer display estimates, subscriptions and exchange rates remain outside scope.

DB owns shared/schema.ts, private workspace pricing settings, optional address
override, migration0021 and DB checks; delegates/reviews Backend queries. Backend
owns validated scoped GET/PATCH with expected workspace/revision comparison,
authorization and private DTOs. Root owns shared/currency-defaults.ts, scoped query
hook, service editor and workspace invalidation. Frontend settings owner owns the
account panel/address controls/all supported translations and own component tests.
Root owns task/queue records and integrated browser/type/build verification.

New-service currency is prefilled with an explanation of its source. Automatic
suggestions may follow address/default changes while untouched; manual choices,
saved prices and currency paired with an entered amount are protected against
silent relabelling. Settings errors have retry/manual-choice handling. Late responses
and cached values must not cross account/workspace/permission boundaries.

Test en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. Maintain
all translations and prior evidence. Preserve unrelated untracked build/prototype/
temporary directories. Recovery: revert only attributable local edits; retain the
completed TASK-039 schema/receipts and existing saved monetary values.

## Delivered behavior

Account pricing settings save a nullable default currency and confirmed business
country for the current personal/company workspace. Company owner/admin checks,
strict input/response schemas, private responses, expected-workspace comparison
and revision-based updates protect the settings. Reading missing settings does
not create a row or introduce an implicit EUR fallback. Location forms support a
separate optional pricing-currency override; changing country preserves it.

The new-service editor resolves the accepted priority before submission and
explains the source. Country suggestions can be selected explicitly. Entering a
price freezes its currency; clearing that amount restores automatic selection
unless the currency was explicitly chosen. Saved services retain their currency.
An explicit suggested-currency action participates in the unsaved-change guard.
Failed/default-loading states permit deliberate manual selection without silently
using a lower-priority suggestion. Existing price/currency confirmations remain.

Settings and address queries are scoped to both actor and workspace. Account,
workspace and permission changes remove the previous private draft; aborted/late
responses cannot populate the next scope. Settings save errors and revision
conflicts retain drafts for review/reload; 401/403 removes cached edit access.
Keyboard controls, linked errors and enlarged-text/mobile reflow were checked.

Private schema, runtime readiness and one-shot execution are complete.
Migration 0021 seeded existing personal/company workspaces EUR, left business
country and location overrides unset, and does not update saved services/bookings.
Updated application startup requires the new 41-table profile plus currency checks
(34 readiness gates). The development schema is now verified compatible; no
application startup or deployment was performed.

Owner implementation/review evidence:

- [Frontend settings, address fields and translations](currency-defaults-frontend-settings-handoff.md).
- [Backend API, authorization, revision checks and regression evidence](workspace-pricing-backend-handoff.md).
- [DB schema, compatibility, exact execution proposal and recovery](workspace-pricing-db-handoff.md).

All owners returned their local dependency complete. Root reviewed the integrated
contracts and closed the stale-permission, suggested-currency dirty-state,
same-company account-switch and Russian enlarged-text overflow findings.

## Verification

Completed on 6 November with synthetic data, injected persistence or isolated
loopback fixtures only; no connected database/services or credentials:

- `npm run check` and fixture `tsc -p scripts/fixtures/tsconfig.currency.json`
  pass. Isolated Vite frontend and esbuild server bundles pass. Existing stale
  Browserslist and bundle-size advisories remain; no dependency changes were made.
- `scripts/test-currency-defaults.mjs` and
  `scripts/test-workspace-pricing-frontend.mjs` pass source priority, explicit
  clearing, suggestion, validation, retry/conflict, permission and scope cases.
- `scripts/test-workspace-pricing-backend.mjs` passes 43 scenarios;
  `scripts/test-startup-diagnostics.mjs` passes 84 checks. Existing initial-message,
  booking currency, capacity and customer booking-action offline regressions pass.
- Workspace-pricing migration drift, readiness and one-shot execution tests pass:
  `check.mjs`, `test-readiness.mjs` and `test-execution.mjs` in
  `migrations/workspace-pricing/`. Historical currency checks pass and migration
  0020/its three receipts retain their original bytes.
- New actual-browser defaults/settings suite passes 10 interaction groups per
  engine in Chrome, Firefox and WebKit for en/lv/ru: source priority, entered-price
  protection, late responses, actor/workspace isolation, settings failures/CAS,
  explicit reload, read-only behavior, mobile/desktop and 200% text reflow.
  [Chrome evidence](currency-defaults-chrome-evidence.json),
  [Firefox evidence](currency-defaults-firefox-evidence.json),
  [WebKit evidence](currency-defaults-webkit-evidence.json).
- Existing Chrome currency regression passes 13 groups using a separate evidence
  prefix, preserving TASK-039 artifacts:
  [currency regression](currency-defaults-regression-chrome-evidence.json).
- Existing Chrome account/address/booking regression passes 14 interaction
  groups, 63 locale/width cases and 112 translated-key checks:
  [account regression](currency-defaults-account-regression-evidence.json).
- Account-details and addresses renderer tests pass in `--frontend-only` mode.
  An initial invocation of the legacy full account-details runner passed its
  frontend checks but its backend fixture stopped at `AuditConfigurationError`
  during `server/db.ts` setup, before any connection. That legacy full mode is
  not fresh backend coverage; the changed backend's dedicated 43-case suite passes.
- Attributable `git diff --check` passes. Chrome Latvian service/settings captures
  were visually reviewed. Browser runs use mocked APIs, not connected write paths.
  Firefox/WebKit used the existing installed browser bundle with the optional
  host PrintDeps scanner skipped; actual browser assertions ran and passed.

Only en/lv/ru received fresh language tests. Arabic/RTL, Chinese, French, German,
Hindi, Japanese, Portuguese and Spanish verification remains deferred. All eleven
supported translation resources were maintained; no fresh native-language review
is claimed for the deferred resources. Physical devices, backup restoration and
connected application workflows are not established by these local checks;
the separate connected schema/ACL/readiness verification is recorded below.
TASK-039 commit `bf96c23` and unrelated artifacts are preserved;
TASK-044 changes are not committed.

## Activation approval and execution

On 6 November the user replied **"approve"** directly to the concrete question
authorizing DB owner `/root/currency_db` to apply 0021 once to development
`hbkooiknruimukkhshrk` **without a verified backup**, stopping on first failure.
The DB owner accepted this fresh TASK-044-2026-11-06 exception through live tools.
This covers only the described protected target configuration read, fresh
network-enabled preflight, one application and bounded postflight; earlier
TASK-039 approval is not being reused. Execution and root receipt review passed.

Prepared target: development Supabase project `hbkooiknruimukkhshrk`; executor:
assigned DB owner `/root/currency_db`. The reviewed
[one-shot runner](../migrations/workspace-pricing/execute-approved.mjs) was inert
and unexecuted before this approval. Under
[AGENTS.md database authority](../AGENTS.md#database-authority), the earlier
TASK-039/0020 backup waiver does not authorize this new operation.

The approved scope was one combined fresh preflight, 0021 application and
postflight for that target, including only the protected target configuration
read needed for execution and network-enabled access. The user selected the
TASK-044 development-only exception **without a verified backup**. No backup or
restore capability is claimed. The DB owner executed this command once:

```
node --import tsx migrations/workspace-pricing/execute-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --backup-waived=TASK-044-2026-11-06
```

Execution receipt:
[source-execution-receipt.json](../migrations/workspace-pricing/source-execution-receipt.json),
SHA-256 `ec37699e0aa6612eda6057222d81e1fba6a6f9fdad5b986b566be797110e1e34`.
It records verified TLS/target/PG17, all 28 baseline gates, 40 starting tables and
zero observed other app/owner connections. One migration submission confirmed
COMMIT at 07:44:50 UTC on 6 November; postflight completed at 07:44:51 UTC:

- 14 personal and 4 company workspace defaults seeded EUR, revision 1; confirmed
  business countries and location overrides remain unset.
- Counts unchanged: 14 users, 4 companies, 12 addresses, 28 services, 32 bookings.
- Existing service/booking prices and currencies and existing address data
  fingerprints preserved. These counts describe the current execution baseline;
  TASK-039's earlier 27-service receipt is historical and unchanged.
- All 34 restricted-runtime readiness gates pass, including the new table,
  constraints/indexes and exact private runtime permissions/policy.

Root independently read the sanitized receipt, checked its verified/committed
states, all reported preservation/counts/gates, pinned migration hash and unchanged
three TASK-039 receipt hashes. No retry, alternate host, relaxed timeout, backup
export/install, other target, app startup, workflow write or deployment occurred.
Writer observations were point-in-time; no continuing quiescence is claimed.
Coordinate a compatible application cutover separately.

Before COMMIT, transaction rollback is the recovery path. After COMMIT, retain
new settings/columns and investigate; reverting code to the old 40-table-only
startup contract would be incompatible. No destructive down migration is
prepared. Any restore needs its own reviewed authorization. All accepted
TASK-044 implementation and development DB work is complete, with no outstanding
owner dependency. Updated code remains uncommitted; no deployment was requested.
