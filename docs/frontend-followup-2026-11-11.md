# Frontend, availability and booking follow-up — 11 November 2026

Status: local implementation completed; focused offline verification passes.
Database execution/physical SQL verification and activation await exact-target
user authorization. Current app startup requires the new migration; do not bypass
readiness. No database/service operations, live sign-in or deployment occurred.

## Authority and ownership

User assigned `/root` the frontend changes; Root accepts reversible local
components/resources/tests and integration records under the Frontend role and
frontend-practices skill. Under AGENTS.md standing cooperation, Backend
`/root/availability_booking_backend` and DB `/root/availability_booking_database`
accepted scoped local implementation/offline verification. Their approval,
design, validation and recovery evidence:

- [Backend handoff](frontend-followup-backend-2026-11-11.md).
- [Database handoff](frontend-followup-database-2026-11-11.md).

Unrelated dirty work and logs were preserved. Existing copy/port/publication
approvals do not authorize these migrations. DB retains execution ownership.
Tests use synthetic in-memory API/image responses and block unexpected network.
No secrets were printed; see the build isolation caveat below.

## Resulting behavior

Items 1–4 already had local implementation from the
[9 November follow-up](frontend-provider-navigation-2026-11-09.md); this task
verified that behavior. Pro means the **provider's** active subscription, as
previously clarified by the user. Public metadata controls the published storefront
link; Free/expired providers have no catalog-window fallback. Provider pages reuse
Search cards/details. Desktop navigation translates live, and My Services orders
Services → Availability → Reports → Settings while preserving permissions.

Search starts in Grid view. Gallery Previous/Next buttons are circular 44px
controls over the image with keyboard focus, disabled boundaries and translated
accessible names. Existing swipe, keyboard, position announcement and failed-image
fallback remain; the position count stays below the image.

The account menu displays authenticated `profileImageUrl` through the existing
Avatar primitive. Only credential-free HTTPS URLs load, with no-referrer policy
and circular cropping; missing/failed photos fall back to the account icon.
Backend also accepts OAuth `picture` metadata when a stored photo is absent.
Availability depends on what the sign-in provider supplies; no external profile
API or extra scope was added. An account without a stored photo receives available
metadata at its next verified sign-in. Live Google/Apple sign-in was not tested.

Availability exposes recurring weekly hours or Specific dates only for a selected
service/general scope. Save the mode before dated hours; specific-only records
the existing empty-week sentinel. Each date can have multiple time ranges or be
unavailable all day. Returning to general hours restores inheritance. Recurring
hours can have an optional **inclusive end date** in the schedule timezone; blank
means no end. Rejected/pending saves, scope switches and independent date drafts
retain protections. Backend and Search/booking selection enforce these contracts,
including suppression of inherited dated openings for date-only services.

Customer bookings preserve existing details/actions and add
`/search?service=<original serviceId>` links. Completed badges are blue; cancelled
badges are red. An original service deleted/unpublished later may be unavailable
when followed; historical booking records survive.

Server deletion rejects every unfinished booking, including overdue/null statuses.
After all bookings close, a durable deletion marker hides the listing from
management/public catalogs and prevents restoration/copy/new booking while keeping
historical references. Listing edits atomically create private notices for
pending/confirmed reservations without rewriting saved money/time/duration.
Notices appear at `/inbox?scope=all&tab=notifications`, link to the service and My
Bookings, and explain that the reservation is unchanged: keep it, or use existing
cancellation controls. Mark-read does not accept terms or cancel. No email/SMS or
forced reconfirmation deadline was introduced. DB reuses 90-day inbox retention.

New messages were maintained in all 11 supported resources; native linguistic
review is unperformed. Test scope is en/lv/ru only. ar/RTL, zh, fr, de, hi, ja, pt
and es remain deferred, preserving historical evidence.

## Verification

- `node --import tsx scripts/test-frontend-followup-browser.mjs`: passes five
  behavior groups/12 en/lv/ru availability cases at 320/390/768/1280, plus
  320px/200% text. Covers recurrence limits/clear/reload, failed/pending saves,
  duplicate suppression, mode persistence, dated hours/inheritance; gallery
  pointer/keyboard/boundaries/fallback; booking colors/links; notice links and
  unavailable service; translated account control; unsafe/missing/failed avatars
  and actual synthetic HTTPS avatar rendering with no referrer. Exact image
  responses terminate in memory. No overflow/unexpected requests/browser errors.
  [Machine evidence/screenshots](../output/frontend-followup-2026-11-11/chrome/evidence.json).
- `node --import tsx scripts/test-provider-public-navigation-browser.mjs`: passes
  six behavior groups/12 en/lv/ru viewport cases, now asserting Grid is the initial
  view. Covers Pro/free/expired access, matching computed styles, translations,
  order, details, preview isolation and denied/error/reflow states. Current evidence
  uses `output/frontend-provider-navigation-2026-11-11/`. The first rerun reused
  the runner's hard-coded9November path/date and regenerated its raw en/lv/ru
  files; a provenance correction there marks those as11November reruns. Original
  prose evidence is retained. Deferred-language evidence elsewhere is unchanged.
- `node --import tsx scripts/test-service-pictures-browser.mjs`: passes en/lv/ru
  at390/1280, both details, swipe/keyboard/fallback, upload/gallery limits,
  rejected-save retention and late workspace-upload isolation.
- `node --import tsx scripts/test-customer-bookings.mjs`: passes auth/isolation,
  source-service links, date/status/history filters, errors/retry and expiry.
  Stale test navigation expectations now match existing translated/customer-only
  behavior; fixtures include realistic source service IDs.
- `node --import tsx scripts/test-service-pictures-frontend.mjs`: passes.
- Full `npx tsc --noEmit --incremental false` and scoped
  `npx tsc --project scripts/fixtures/tsconfig.frontend-followup.json`: pass.
- Final Vite application bundle build passes with `configFile:false`, installed
  React plugin/aliases, empty envDir and task output. Stale Browserslist/chunk-size
  warnings remain. This checks the application bundle, not configured privacy
  content. An earlier build used repository config and an envDir override, but its
  privacy plugin independently calls root `loadEnv`, so that attempt was not fully
  environment-isolated. No values were printed. Final build omitted that plugin
  and replaced earlier generated output.
- Root reran `scripts/test-service-booking-followup.mjs` and
  `migrations/customer-service-notifications/check.mjs`; both pass. Owner handoffs
  list additional passing backend/SQL-contract/readiness regressions.

Chrome157 on Windows. Root visually reviewed Russian phone availability, Latvian
booking badges/links, gallery arrows and synthetic avatar. No Firefox/WebKit,
physical-device, screen-reader, native linguistic or connected OAuth coverage.
Actual PostgreSQL locks, SQL plans, migrations and runtime grants remain unverified.

## Existing regression discovered

`scripts/test-provider-navigation.mjs` had stale fixtures: existing services lacked
currency and creation lacked the current workspace-pricing endpoint. Fixtures now
supply EUR and a scope-bound pricing response, preserving assertions. The runner
then fails at its existing failed-workspace-switch test (line162): an unsaved
service name is lost after a rejected switch, before availability assertions.

An esbuild baseline bundle substitutes HEAD versions of all changed frontend
components loaded by that runner (availability, agenda, gallery, account menu and
inbox), retaining modern fixtures. Running
`node output/frontend-followup-2026-11-11/baseline-provider-navigation.mjs` reproduces
the identical draft-loss failure. Thus it predates this task. The failing assertion
remains; workspace/editor repair is a separate frontend follow-up. Broad provider
regression coverage is not claimed as passing. Focused requested-flow checks pass.

## Activation and recovery

New prepared0024→0025 add private notices, the service deletion marker and
restricted server access. Recommended target: existing independent local Docker
application PostgreSQL `127.0.0.1:15422`, database `postgres`; audit PostgreSQL,
hosted Supabase and AWS are excluded. DB must verify protected local binding and
stopped writers, execute once, inspect actual SQL/constraints/ACL, pass current42
readiness and bounded read-only query checks, then coordinate local restart with
Backend. Exact action/target approval remains required by AGENTS.md. Follow the DB
execution runbook; do not reuse consumed earlier tokens.

[Concrete local-only command, protected-read scope, pinned SQL and recovery](frontend-followup-local-migration-2026-11-11.md)
is prepared. Root ran only `execute-local.mjs --plan`: pinned hashes pass, with
connected/privateRead/writes all false. Root also reran `test-execute-local.mjs`:
the actual duplicate-attempt branch preserves the prior receipt byte-for-byte
and rejects alternate endpoints/principals without private reads or connections.
The migration executor stops before application restart. Both execution and any
subsequent local app restart still need the applicable scope recorded.

Before execution, recover by reversing only attributable frontend/backend/DB/test
hunks/new files, preserving unrelated changes and the earlier four-item follow-up.
After approved execution, follow DB's transactional stop-on-failure procedure;
do not drop notification/history data or bypass guards as a frontend rollback.
No commit/deployment was performed.
