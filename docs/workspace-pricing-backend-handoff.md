# TASK-044 backend handoff — 6 November 2026

Status: local backend implementation and affected offline checks complete. Root
owns final integrated frontend/browser/TypeScript/build acceptance. The new
database migration is prepared by DB; it was not executed by this owner.

## Assignment and scope

Requester/coordinator `/root`; assigned accepting Backend owner/executor
`/root/currency_backend`. User approved the suggested workspace currency-default
update. The [integrated task record](currency-defaults-handoff.md) records the
accepted priority and file ownership. AGENTS standing cooperation covers these
local backend/shared-contract changes and offline checks. Assigned DB owner
`/root/currency_db` accepted and reviewed the local query/CAS/address work;
schema, migration and metadata profiles remain DB-owned.

No private configuration/credential access, database/service connection,
application startup, SQL execution, deployment or external writes were performed.
TASK-039 execution approvals and backup waiver do not transfer to TASK-044.

## Delivered contract

- `GET /api/workspace/pricing-settings` reads the authenticated selected workspace.
  It accepts no target IDs/query parameters and returns only the validated
  `{workspace, defaultCurrency, businessCountryCode, revision, canEdit}` view.
  `workspace` is `{kind: "user", id: string}` or `{kind: "company", id: number}`.
  A newly missing row yields null preferences/revision zero without writing.
- `PATCH` accepts strict `{expectedWorkspace, expectedRevision, defaultCurrency?,
  businessCountryCode?}` with at least one changed setting. Nullable fields clear
  a preference; omitted fields preserve it. Currency/country are supported codes.
  Expected workspace is a comparison binding and never chooses the write target.
- A switched workspace returns 409 `WORKSPACE_CHANGED`. A stale revision, racing
  insert/update, or exhausted revision returns 409 `WORKSPACE_PRICING_CHANGED`.
  Revision increments are server-owned. The UI must refetch/review after conflict.
- Both routes require authentication and current selected-workspace service
  management permissions; company writes also require manageCompany. The store
  independently verifies the personal user exists, or that the company is active
  and the actor is its current owner/admin. Providers/viewers/nonmembers cannot
  read or change these private settings.
- Write transactions lock the personal owner/company and the current membership,
  then the settings row. Updates condition on both workspace identity and expected
  revision; inserts use application UUIDs and unique-conflict handling. No lazy
  EUR fallback or application-side seed is introduced.
- Responses, including unauthenticated/error responses, use `private, no-store`.
  Errors expose fixed application codes/messages, excluding driver/configuration
  detail. No preference columns are added to public users/provider payloads.
- `shared/workspace-pricing.ts` supplies runtime response/input schemas and typed
  DTOs for frontend integration. Runtime response validation prevents unexpected
  fields from entering the private view.
- Address saves persist optional `pricingCurrency`; omission preserves an existing
  override for older address clients, and explicit null clears it. Existing
  workspace ownership checks apply. The override remains absent from public
  `serviceLocation` DTOs and does not change an attached service's saved currency.
- Settings/address-default writes never update existing service/booking monetary
  values. Suggested-currency priority and draft preservation belong to Root's
  shared resolver/frontend implementation. FX and billing policies are unchanged.

## Readiness and activation

Startup now verifies DB's integrated 41-table workspace-pricing metadata profile
before routes/workers start, alongside the unchanged currency guard. The billing
metadata wrapper uses this new integrated profile too, so the historical exact
40-table manifest cannot incorrectly reject or accept the new schema.

Failures report only safe `workspace_pricing_database` /
`WORKSPACE_PRICING_DB_NOT_READY` diagnostics and allowlisted check names. This
preparation does not execute the guard or connect to a database by importing it.
Apply and verify DB's
[0021 migration](../migrations/workspace-pricing/0021_workspace_pricing.sql) under
separately scoped target authorization before starting the updated application.
Historical profiles, TASK-039 evidence and existing amount/currency snapshots are
preserved.

## Verification

Production logic ran only against injected in-memory persistence and HTTP streams;
no socket, DB client, environment file or provider request was used:

- `node --import tsx scripts/test-workspace-pricing-backend.mjs` — **43** scenarios
  pass. Covers read-only missing settings, personal/company separation, strict
  inputs, owner/admin versus provider/viewer/nonmember, revocation/inactive company,
  CAS and workspace binding, racing insert/update, INTMAX conflict, safe failures,
  private/no-store responses, and no service/booking writes. Real address save/DTO
  code verifies override persistence/omission/null-clear, foreign-owner denial,
  saved service currency preservation and exclusion from public service DTOs.
- `node --import tsx scripts/test-startup-diagnostics.mjs` — **84** checks pass
  with injected metadata, including the new readiness stage/code and redaction.
- Existing actual route/storage regressions pass:
  `scripts/test-booking-notes-backend.mjs` (**21** initial-message + **25** currency
  cases), `scripts/test-booking-capacity.mjs`, and
  `scripts/test-customer-booking-actions.mjs`. Fixtures explicitly stub only the
  new settings registration boundary; they retain their original tested behavior.
- Attributable backend/shared-contract/test `git diff --check` passes.
- DB owner reviewed query identity predicates, transaction authorization/locking,
  CAS, UUID insertion without a permanent EUR default, and private address DTOs;
  the requested INTMAX conflict guard is implemented and tested.

Read-only frontend integration review confirms matching endpoint/DTO/CAS shape,
actor/workspace query keys, response-workspace binding, and component abort/liveness
handling. The permissions finding routed to Root is closed by read-only source
review on 6 November: GET settings 401/403 makes the hook return allowed false and
no scope, the account wrapper hides cached settings, and PATCH 401/403 hides its
form (401 also clears auth cache). Root owns the corresponding component/browser
verification. No outstanding backend contract issue was found in the final review.

Application type/build/browser checks are Root's integrated evidence, not claimed
by these mocked backend checks. Live RLS/privileges/concurrency and migration
results remain unverified by this executor. Test language scope is en/lv/ru only;
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. Supported translations and
historical evidence are preserved.

## Recovery and next action

Before connected execution, use DB's concrete preflight, migration, readiness and
recovery instructions for the exact approved target. Do not reuse another task's
executor/backup/operation approval. Keep the application stopped if new metadata
checks fail rather than running against a partially prepared schema.

Recover local code by reverting only attributable TASK-044 changes; preserve the
TASK-039 currency schema and all saved price/currency values. Root completes
integrated acceptance and records any separately authorized DB execution. No
additional permission round is needed for the completed local backend scope.
