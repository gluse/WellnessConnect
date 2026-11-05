# TASK-042 backend — wishlist and header inbox

## Global header projection — 5 November 2026

Following the user's report that badges disappear outside provider routes, Backend
accepted and implemented read-only `scope=all` for summaries/message feeds/activity
plus versioned activity reads. It combines own customer bookings with authorized
provider bookings in the selected workspace, using one OR predicate rather than
summing two feeds. Messages/bookings are not duplicated for dual-role ownership.
Global unread uses any existing same-user/message receipt; explicit scoped read
projections stay unchanged. Feed rows include explicit viewer/company targets.
Single-booking fetch/message-ack routes reject all-scope with 400, and current
profile/workspace/membership/assignment checks remain in force. No schema or
connected operation was needed. Frontend uses this global projection on every path.

Owner-returned evidence: `test-wishlist-backend.mjs` passes 80 mocked real-route
scenarios; `test-global-inbox-backend.mjs` passes 16 production-SQL predicate cases
over synthetic records without a SQL engine. TypeScript passes. Root reports final
browser/build evidence in [the integrated handoff](wishlist-handoff.md).

## Acceptance and authority

Accepted 4 November 2026 by assigned Back End Developer
`/root/wishlist_backend_plan`, requested by `/root` following the user's explicit
implementation approval. Scope: reversible backend/shared-contract/runtime files,
backend scripts and synthetic offline checks for the approved wishlist, message
inbox and service-activity bell. Root received explicit delegation for local
backend review/integration fixes and tests, with coordination before overlapping
edits. DB owns schema/migrations/readiness contracts; Frontend owns all client UI.

No connected database/service, real session, private configuration, credential,
deployment, publishing or sending operation is included. The existing named-target
database permissions from other tasks are not reused. Preserve unrelated work,
including `.search-commit-check-K0YgF2/`. Recovery: revert this task's attributable
backend code, retaining existing conversations and the DB owner's additive-data
recovery guidance. No database operation was performed by Backend.

## Implemented contract

- One implicit private wishlist per authenticated account, independent of current
  role or workspace. Idempotent `PUT`/`DELETE /api/wishlist/services/:id` return204;
  ownership always comes from verified authentication. The pair is serialized by
  a transaction advisory lock and membership uniqueness, and source activity is
  committed atomically with a genuinely new save.
- `GET /api/wishlist/services` uses newest-first keyset pagination (default24,
  max50). Available entries reuse public service hydration. Unpublished entries
  contain only service ID/saved timestamp/availability and restore when republished;
  hard deletion cascades under the DB contract. A service needs no current slots
  to be saved. `GET /api/wishlist/membership` accepts up to100 unique visible IDs,
  returning only that user's memberships. Public catalog DTOs remain unchanged.
- `shared/wishlist.ts` publishes wishlist, message-inbox and activity DTOs, strict
  IDs/read inputs and the safe `/search?service=id` continuation helper. Auth return
  validation permits that exact canonical int32 form and exact `/wishlist`/`/inbox`
  routes; duplicate/arbitrary query forms remain rejected. Navigation never saves.
- Private `GET /api/inbox/{summary,messages,notifications}` accepts explicit
  customer/provider scope and the currently selected company only. Provider scope
  requires a confirmed existing profile and active matching workspace; both valid
  personal profile roles are accepted because provider navigation does not switch
  the default seeker role. Every SQL count/list/read query
  independently checks current ownership or company membership and employee
  assignment. Customer scope exposes that customer's bookings only.
- `GET /api/inbox/messages/:id` authorizes before returning the existing booking
  detail DTO for direct conversation navigation. Summary rows include read-only
  capability, counterpart/service context, message timestamp and unread count,
  without message-body previews or broadcast recipient information.
- `POST /api/inbox/messages/:id/read` acknowledges up to100 exact message UUIDs
  within the authorized booking. Per-user/message/context receipts exclude the
  reader's own messages. No timestamp watermark can swallow late-committing or
  unloaded messages; readers and workspace contexts remain independent. Existing
  conversation readers/senders and12-calendar-month retention are unchanged.
- Daily activity items use `wishlist_additions` or `service_views`, count/revision,
  UTC reporting date, availability and safe service context. Current permissions
  and the original seller scope are checked before exposing an item; moved services
  cannot transfer old activity to another workspace. Inactive titles are suppressed.
- `POST /api/inbox/notifications/read` acknowledges explicit `{id,revision}`
  snapshots, using a monotonic stored read revision. A stale read cannot clear
  later activity. This also implements mark-loaded-read without clearing arrivals.
- Routes use private/no-store responses, bounded inputs/pagination and a request
  limiter. Existing global same-origin and verified authentication boundaries
  remain. Controlled errors do not serialize raw driver/private data.

## Activity pipeline and operation

Wishlist addition identities are unique per account/service/UTC day, survive
unsave, and expire after90 days. Save/remove/save and retries cannot inflate a
day's count. Own/team saves remain allowed but are excluded from activity.
Provider/team service views are excluded when identity can be verified; anonymous
visits cannot reliably be attributed to a team member. Views count accepted explicit
detail events rather than distinct people, with no backfill or raw audit reads.

The existing explicit `/api/services/:id/view` handler has an independent optional
product capture callback. It verifies optional identity when either audit or
product capture needs it. Capture failure emits a fixed diagnostic and does not
block viewing or induce browser retries. Existing audit contracts remain separate.

`PRODUCT_ACTIVITY_ENABLED=true` opts into public product-view capture and the
standalone worker. Wishlist saves always queue their deduplicated addition source
events while those APIs are active; this preserves save idempotency if the worker
is temporarily stopped. No email/SMS/push or booking-status notification families
were added.

`npm run activity:worker` / `activity:worker:production` runs a bounded batch of200
completed-UTC-day events once per15 minutes. It locks pending source rows, groups
in a stable lock order, increments the durable group, advances its revision and
marks source rows processed in the same transaction. Failed batches roll back;
replay cannot double count or reset read state. Late commits join the next batch.
Expired source and group cleanup is bounded; read rows cascade with groups.
Notifications expire with their source activity window, without extending message
retention. Both source and notification history use the user's selected90 days.

The worker refuses disabled starts before loading the DB module, checks the new
integrated40-table runtime profile before processing, and closes its pool on exit.
The application startup guard and safe diagnostics now use that profile; historical
35-table profile files remain unchanged. Package build adds `dist/activity-worker.js`.
See [DB preparation/evidence](wishlist-db-handoff.md) for unapplied SQL0018/0019 and
runtime grants. No worker was started against a real database.

## Verification

- `node --import tsx scripts/test-wishlist-backend.mjs`: **74 scenarios passed**
  through real service/worker/routes with synthetic transactional persistence/Auth
  and loopback HTTP. Includes concurrent duplicate saves, unsave/re-save/day
  boundary, transaction failure rollback, own/team exclusion, inactive/republished
  entries, cursor pagination, view capture with audit disabled, safe capture
  failure, aggregation replay/late commits/rollback/expiry, strict inputs,
  account/scope isolation, allowed redirects, parameterized scope queries and
  exact-ID/revision read acknowledgments.
  Final independent integration review found and corrected a compatibility gate:
  an existing personal service owner can retain the default seeker profile role.
  Regression coverage now permits that owner's provider inbox with a verified
  identity-bound personal-scope predicate, while rejecting missing/malformed
  profiles and arbitrary selected-company mismatches. Route navigation itself
  does not change profile roles.
- `node --import tsx scripts/test-startup-diagnostics.mjs`: **72 checks passed**,
  including each new readiness key, controlled failure and driver-data redaction.
- `node --import tsx scripts/test-service-view-audit.mjs`: passed existing narrow
  producer identity/input/limiter/outage and R90 audit regressions.
- `node --import tsx scripts/test-booking-notes-backend.mjs`: **21 existing cases
  passed**. `test-booking-capacity.mjs` passed existing creation/scheduling/access/
  capacity/snapshot regressions. Their strict VM fixtures explicitly stub the new
  unrelated route factories and use synthetic environment; assertions are retained.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed after
  owner corrections. In-memory esbuild bundles for `server/routes.ts` and
  `server/wishlist/run-worker.ts` passed with no env loading or module execution.
  Scoped diff/new-file whitespace checks passed.

The initial loopback test attempt was blocked by sandbox `EACCES`; the same isolated
command passed with scoped process/network escalation. No automatic approval
rejection occurred. TypeScript checks found two introduced backend type issues,
which were fixed; intermediate output then identified concurrently unfinished
frontend code, and the final check passed. Root owns integrated application build
and browser evidence.

These tests do not establish live PostgreSQL locking, RLS/grants, migrations,
physical devices or deployment. DB returned offline constraint/readiness evidence
separately. Fresh language coverage is restricted to en/lv/ru; ar/RTL, zh, fr, de,
hi, ja, pt and es remain supported with testing deferred. Required live migration,
runtime activation and any live workflow acceptance remain unperformed.
