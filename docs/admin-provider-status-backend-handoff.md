# TASK-051 backend provider status

Implemented and verified locally, 8 November 2026.

Requester/coordinator and Frontend owner: `/root`. Assigned Back End Developer
and executor: `/root/admin_provider_backend`. Root assigned this dependency for
the user's request to identify service providers in Administration → App users.
Owner accepted via live collaboration tools under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope is reversible local backend/API-contract changes and offline mocked checks.
No connected database/service access, private configuration reads, schema changes,
database writes, app/worker startup, deployment, publishing or spending is included.

## Contract and implementation

`AdminUser.isServiceProvider` is `boolean | null`:

- `true`: the application profile's `public.users.current_role` is `provider`.
- `false`: the application profile's role is `seeker`.
- `null`: no application profile or no recognized application role is available.

The source is the same stored account role used for provider activation/navigation.
Editable Supabase Auth metadata, Pro subscriptions, company roles and service
counts do not determine this flag. Newly registered Auth accounts without an app
profile stay unknown. A role-query failure rejects the directory request with the
existing sanitized HTTP 503 response; it must not silently return false.

`server/admin-directory.ts` performs one parameterized query for only the visible
page's IDs, selecting only profile ID and role. It runs alongside the existing
page-bounded subscription lookup; an empty page executes no role query. Existing
server authentication, support authorization, filters, sorting, pagination,
response allowlisting and no-store headers remain in place. `shared/admin.ts`
defines the contract; `server/adminRoutes.ts` threads its mockable loader through
the existing route setup. These are application queries, with no schema/migration
or connected execution.

## Verification

- `node --import tsx scripts/test-admin-provider-status-backend.mjs` — passed.
  Actual directory/query/route modules loaded in a VM with an allowlisted import
  map; DB/Auth boundaries mocked. Checks provider/seeker/null/unrecognized/missing
  profiles, contradictory editable Auth metadata, provider without Pro/company,
  only ID/role projection, bound visible-page IDs, one query per page, no empty
  query, pagination and sanitized HTTP 503 on role-query failure. No database or
  environment/client modules are loaded by this focused runner.
- `node --import tsx scripts/test-administration.mjs` — passed, including real
  middleware/Supabase SDK against synthetic Auth HTTP and injected directory
  dependencies. Existing frontend regressions also pass in this run. Backend
  checks now assert role lookup is not called for denied/invalid requests, its
  requested IDs exactly match the visible page, missing profiles remain unknown
  despite company Pro/roles, and lookup failure returns sanitized 503. Runner uses
  deliberately absent dotenv path, synthetic endpoints and disabled audit flags.
- Scoped TypeScript program rooted at `server/admin-directory.ts`,
  `server/adminRoutes.ts`, `shared/admin.ts`, using repository compiler options
  with incremental disabled — zero diagnostics, including transitive imports.
- In-memory esbuild bundle of `server/adminRoutes.ts` with Node/external packages
  and ESM output — passed (217,202 bytes); no server was started.

Tests use synthetic data and do not prove live database/RLS behavior or deployed
runtime behavior. No new dependencies or unresolved security findings were
introduced within this scope. Frontend/browser evidence and language handling
belong to root's integrated handoff. Language testing remains en/lv/ru; ar/RTL,
zh, fr, de, hi, ja, pt and es are deferred.

## Recovery and next action

Revert only TASK-051 additions in the three implementation files, the backend
section of `scripts/test-administration.mjs`, the focused runner and this handoff;
preserve unrelated changes. There are no database effects to reverse. Root owns
integrated UI review and the main task/coordination records. Deployment and live
service validation require their separately authorized scope.
