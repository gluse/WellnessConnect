# Saved search location implementation

23 October 2026. **Local implementation and mocked verification complete;
migration execution and release gates remain open.** TASK-026 stays unchecked.

## Approval and scope

The user selected **A — private location record linked to the profile** after
reviewing [the proposal](search-location-proposal.md). Approver: user in this
conversation. Executor: Codex `/root`. Approved scope: local frontend/backend
changes for location-first nearby search and remembered preferences; additive
ORM/migration preparation; isolated offline/mocked tests. No live database/service
access, migration application, deployment, new infrastructure or paid API calls.
The prior deployment hold remains. Preserve unrelated working-tree edits.

TASK-025 was requested as a separate auditing task. Its permission/consent audit
implementation and qualified privacy/legal review are **not completed by this
change** and remain required before release. No new audit event is fabricated
from a location button click or preference save, and no claim of complete legal
compliance is made.

## Resulting behavior

- First visit waits for authentication/preference resolution, then offers current
  location or typed town/address. No initial unfiltered service request.
- Radius defaults/resets to 25 km. Ordinary public search returns at most 50
  results, ordered by unrounded straight-line distance, then creation time/ID.
  The existing optional price/rating/distance sorts remain available. AI search
  retains relevance ordering with a maximum of 50 results.
- The user explicitly chooses Remember. It starts unchecked for a new selection;
  without it the place is used for that visit. Reset filters keeps the selected
  place; Forget location clears it and cached search coordinates/results.
- Accounts use a private one-row-per-user table; guests use a host-only,
  SameSite=Lax, Secure-on-HTTPS cookie with 180-day expiry. Cookie values are
  versioned, size-bounded, expiry-checked and treated as untrusted preferences.
- Browser coordinates can be remembered; no reverse geocoding is needed. Saved
  device coordinates remain fixed until the user explicitly updates them.
- Typed places persist only original user input and optional place ID. Google
  coordinates/formatted addresses are not persisted. Return visits resolve the
  saved place automatically; this can make a Google geocoding call without a new
  location question. Filter/query changes reuse resolved coordinates.
- Existing profile preferences win over guest cookies. Guest adoption uses
  insert-on-conflict-do-nothing, avoiding overwriting a concurrent account
  selection. Successful adoption clears the guest copy. Logout never copies
  account preferences to cookies.
- Identity changes remount/reset the search page and remove old search caches;
  old requests are aborted and stale geocoder callbacks are ignored. A failed
  profile read is not treated as an empty profile. Save/delete failures provide
  localized retry feedback; failed deletion immediately stops using the place.

## Files and contracts

- [Shared validation and cookie format](../shared/search-location.ts).
- [Private table definition](../shared/schema.ts),
  [unapplied migration](../migrations/0009_user_search_locations.sql),
  [owner-scoped store](../server/searchLocations.ts).
- [Preference routes](../server/searchLocationRoutes.ts): authenticated GET/PUT/
  DELETE `/api/account/search-location`, POST `/api/account/search-location/adopt`.
  Identity comes from verified middleware; supplied user IDs/extra fields are
  rejected. Reads/writes are bounded by rate limits; responses use no-store.
  Registration follows the existing global origin/CSRF middleware in `routes.ts`.
- [Client restoration/persistence hook](../client/src/hooks/use-search-location.ts),
  [cookie/geocoder/API adapter](../client/src/lib/saved-search-location.ts), and
  [search page](../client/src/pages/home.tsx). Preference requests time out after
  10 seconds; typed-location resolution is bounded to 15 seconds. GPS retains
  its existing retry/35-second deadline behavior.
- Search input accepts an optional validated limit of 1–50. The page sends 50;
  the ordinary endpoint defaults to 50 for other callers. SQL caps ordinary
  searches before enrichment; provider/storefront catalogs keep their existing
  contracts unless explicitly given a limit.
- Availability is still evaluated against bounded candidate/schedule sets before
  the final result cap. More than 500 candidates or 5,000 schedules can still
  return the existing too-broad response; the implementation does not silently
  omit later available matches by taking the first 50 beforehand. AI candidate
  limits/rate budgets remain. Larger-scale availability optimization is separate.

## Security and evidence limits

The new preference table is separate from `users`, public provider responses and
provider workspace addresses. The migration enables RLS and revokes browser-role
access. All backend queries include the verified account ID. Address persistence
clears any old coordinates; device persistence clears old typed-place fields.
Input schemas reject mixed provenance, nonfinite/out-of-range coordinates,
oversized text/IDs and extra fields. No preference payload/error body is logged
by the new handlers; the existing application access logger uses the route path.
Production grants/RLS, proxy logging and deletion behavior remain unverified.

## Passing verification

All tests used synthetic data, mocked data access/Auth/geolocation/Google services
and isolated query caches. No connected application server, real database,
session writes, geocoding request or payment was exercised. Loopback HTTP/Chrome
fixtures required execution outside the sandbox because local connections were
blocked there; no automatic-approval rejection occurred.

| Command | Result |
| --- | --- |
| `node --import tsx scripts/test-search-location.mjs` | Validation/cookie expiry, actual store adapter owner predicates/provenance, atomic adoption, owner-only API, account isolation, sanitized failures pass. |
| `node --import tsx scripts/test-search-storage.mjs` | Actual storage adapter caps/filters, over-500 ordinary search with limit 50, availability matches after first 50, existing scoped catalogs pass. |
| `node --import tsx scripts/test-public-search.mjs` | Default/max result cap, invalid limits, semantic bounds/budgets, fallback and existing public endpoint cases pass. |
| `node --import tsx scripts/test-public-search-ui.mjs` | Draft/application separation, validation, cancellation, errors/retry, truncation and en/lv/ru pass. |
| `node --import tsx scripts/test-guest-search.mjs` | Public routing, identity wait, details/catalogs, guest booking and authenticated booking regressions pass. |
| `node --import tsx scripts/test-saved-search-location-browser.mjs` | 7 groups: first/return visits, cookie/profile restore/adoption, account isolation, save/delete retry, late callbacks and localized reflow pass. |
| `node --import tsx scripts/test-search-page-browser.mjs` | 5 groups, 12 en/lv/ru viewport cases at 320/390/768/1280, keyboard/dialog behavior, enlarged text and existing search flows pass. |
| `node --import tsx scripts/test-search-location-browser.mjs` | 7 GPS/location groups including denial, timeout/retry, pending duplicate control, language changes and real deadline behavior pass. |
| `node node_modules/typescript/bin/tsc --noEmit` | Pass. |
| `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.search-page.json --noEmit` | Pass. |
| `npm run build` | Pass. Existing Browserslist age and >500 kB chunk warnings remain. |

Chrome evidence: [saved locations](search-saved-location-evidence.json),
[search regression](search-remembered-implementation-evidence.json),
[GPS regression](search-location-preferences-evidence.json).
Visually inspected the new Russian phone location-choice view and English
desktop result view. Historical search artifacts were preserved; fresh regression
outputs use distinct filenames.

Fresh locale validation/browser coverage is **en/lv/ru only**. All supported
translations were maintained. **ar/RTL, zh, fr, de, hi, ja, pt and es are deferred**.
Physical devices, screen readers, other browser engines and native-speaker review
were not covered by this pass. Offline adapters do not prove live SQL execution,
RLS, actual browser permission dialogs or external geocoding behavior.

## Activation and recovery

The [release checklist](search-location-release-checklist.md) records the resumed
review and separates read-only preflight, migration approval, TASK-025/privacy,
live acceptance and release. The user subsequently confirmed the application
development/testing target and approved the read-only preflight recorded below.
Unrelated audit execution approval does not authorize this feature's migration
or writes.

1. Complete TASK-025's reviewed permission/consent evidence, withdrawal behavior
   and privacy decisions before release. This change does not activate auditing.
2. Obtain approval for the named database/environment and migration operations.
   DB Analyst verifies schema/version, table absence or migration status, runtime
   role/owner/RLS/grant compatibility and recovery before applying
   `migrations/0009_user_search_locations.sql`. No existing user backfill is needed.
   If runtime privileges/policies need changes, prepare targeted ones for review;
   do not grant browser access or broad privileges to make the API work.
3. Apply the additive migration before activating code that queries the table;
   verify owner isolation, constraints, actual query performance and persistence
   using approved synthetic records in the approved environment. The account
   location API will report unavailable until its table/permissions exist.
4. CI/CD handles release only when the user lifts the deployment hold.

Current coordinated command, **not executed**:
`node migrations/execute-search-location.mjs apply-location`. It supersedes the
earlier standalone psql command and requires the verified sixteen-table source
runtime first. See [the package](search-location-database-package.md) for the
selected grant model, fixed hashes, execution scope, acceptance and recovery.

Recovery: revert only this feature's attributable application edits before any
table removal. Keep the unused preference table while diagnosing; dropping it
destroys remembered account locations and needs explicit approval. Clear/version
invalidate the guest preference cookie if needed. Preserve unrelated workspace
edits, existing historical test evidence and audit records.

## Resumed review, 23 October 2026

Reviewed AGENTS.md, TASKS.md, the proposal, this handoff, applicable role/skill
instructions, preference validation/API/store, restoration/account boundaries,
route registration/logging and the prepared migration/ORM contract. Reused the
recorded local approval; no new application/schema changes were needed by this
review. Existing working-tree changes and browser artifacts were preserved.

Targeted checks of the current working tree passed:

- `node --import tsx scripts/test-search-storage.mjs`: actual storage adapter
  limits/filter/schedule and scoped-catalog regressions; mocked database only.
- `node --import tsx scripts/test-public-search-ui.mjs`: draft/application,
  cancellation, error/retry, truncation and en/lv/ru checks; mocked fetch/storage.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.

These checks add no fresh live/browser-engine/permission-dialog evidence. The
earlier browser/build results above remain historical evidence from the local
implementation pass. No database/client connection, application startup, Google
request, migration, deployment or privacy approval occurred. Runtime role access,
deployed constraints/RLS/grants, TASK-025/privacy and live acceptance remain open.

## Approved metadata preflight, 23 October 2026

After the resumed local review, the user replied "yes" to Codex `/root` running
metadata-only database preflight on development/testing `hbkooiknruimukkhshrk`.
The bounded catalog inspection completed over verified TLS with READ ONLY and
ROLLBACK; no user/business/session/audit rows were read, and no data/schema/grant
changes occurred. See [the preflight report](search-location-preflight-report.md)
for commands, approval, offline helper checks, sanitized results and limits.

Observed PostgreSQL 17.11; compatible `users.id` primary key; location table absent;
locally configured application principal `postgres` with BYPASSRLS; planned
restricted runtime roles absent. Default grants would also give `service_role`
access to the new table, beyond the browser roles revoked in the draft migration.
The pending audit runtime's sixteen-table manifest also needs coordination before
adding the table. No migration, grant amendment, audit-package change or live
acceptance was performed. The report presents a coordinated local preparation
choice versus deferral. The user subsequently selected A as recorded below;
later execution approval remains open.

## Coordinated local package, 23 October 2026

The user selected next-step A: prepare location privileges and audit-runtime
compatibility locally. Executor: Codex `/root`; scope includes reversible local
SQL/helper/profile/test edits and offline/mocked verification, with no new live
access, private reads, database writes or activation. The package revokes the
inherited service_role grant, grants four DML privileges to fm_app_runtime and
adds the server-only policy. It deliberately preserves the active audit
foundation/pins and adds an opt-in seventeen-table verification profile after
the separately verified sixteen-table runtime. Location-first is rejected.

[The database package](search-location-database-package.md) records exact files,
hashes, order, future execution scope and recovery. Passing evidence: 155 new
offline contract/driver checks, 242 existing audit-installer checks, 243 existing
audit checks and the actual mocked owner-scoped location API/store regression.
The loopback regression required a narrow escalation after sandbox EACCES and
then passed; no automatic-approval rejection occurred. Existing browser evidence
is preserved. No fresh language/browser matrix ran; scope remains en/lv/ru, with
ar/RTL, zh, fr, de, hi, ja, pt and es deferred.

Audit owners were not reachable from this thread. The
[coordination queue](agent-coordination.md#task-026-local-locationruntime-extension)
returns the package for their integration; delivery/owner acceptance is not
claimed. SQL compilation, live constraint/ACL semantics (including explicit CHECK
expression review), runtime credential/API acceptance, TASK-025/privacy and
release remain open. TASK-026 stays unchecked; no migration or deployment occurred.
