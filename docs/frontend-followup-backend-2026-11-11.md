# Availability and booked-service backend follow-up — 11 November 2026

Status: implemented and verified offline; database migrations are prepared and
unapplied. Connected verification and deployment are not covered by this result.

Requester/approver: the user's 11 November frontend follow-up, routed by assigned
Frontend `/root` under AGENTS.md standing owner cooperation. Assigned executor
`/root/availability_booking_backend` accepted reversible local backend/shared
contract changes and isolated tests. DB owner
`/root/availability_booking_database` accepted and reviewed the database contract,
implemented its schema/migration/readiness dependency and the paginated Search SQL.
No private configuration, credentials, connected service/database operation,
deployment, spending or destructive connected execution was performed. Existing
unrelated dirty changes and log statements were preserved.

## Availability contracts

`PUT /api/availability/weekly` adds optional `recurrenceEndType: never | on_date`
(default `never`) and `recurrenceEndValue: YYYY-MM-DD | null`. An `on_date` schedule
requires a real calendar date. The final date is inclusive in the schedule's
timezone. Existing recurrence columns are reused. Ownership, management permissions,
unique weekdays, maximum intervals and non-overlap validation remain enforced.

Inheritance may submit only `{serviceId, inherit: true}`; irrelevant unsaved fields
cannot prevent returning to inherited general hours. General schedules cannot
inherit. An explicitly empty service week records the existing closed sentinel.
With service-specific date overrides this supports rare-event schedules: neither
general weekly hours nor general dated openings silently open another date.
Existing `PUT /api/availability/override` remains the date/range editing contract.

Shared `schedulesForDay` applies the same selection in booking and legacy catalog
filtering. DB reviewed and updated `server/search-pagination/query.ts` for actual
Search eligibility: deleted listings, service/general dated overrides, explicit
closed weeks, inclusive recurring end dates and legacy event-count ends. The DB
handoff records its SQL-review and unexecuted-SQL limits.

## Deletion, listing edits and customer notifications

Deletion takes `services FOR UPDATE`, rejects **every** booking status other than
completed/cancelled (including overdue unfinished or null/unknown status), then
sets `isActive=false` and the new durable `deletedAt` marker. Booking creation's
existing service `FOR SHARE` lock serializes against this operation. Deleted rows
leave provider/public/search catalogs; public ID lookup, copying and PATCH restore
cannot revive them. Historical booking joins survive without deleting reservations.
The earlier suggested inactive-only implementation was superseded by root's final
durable-deletion instruction; no inactive-only behavior is reported as completion.

Within the service-edit transaction, `notifyBookedServiceChanges` compares 18
allowlisted customer-visible fields, ignores no-op saves and canonical decimal
formatting, and inserts one private notice for each pending/confirmed reservation.
Insert failure rolls back the edit; external delivery is not attempted. Existing
money, duration, cleanup, employee and appointment snapshots are not rewritten.
Notice payload stores only changed field names, source service/booking/recipient
IDs and timestamps. No former descriptions, messages or personal contact values
are copied into the notification. Expiry is 90 days, matching the existing inbox;
the activity worker removes expired notices in bounded batches.

Inbox DTO extends `kind` with `service_changes` and optional `bookingId` and
`changedFields`. Existing notifications endpoints return the union under the same
stable timestamp/UUID cursor and monotonic read flow. Customer notices are visible
only under `all`/`customer` to their recipient, including across selected provider
workspaces; provider scope never grants access. Queries join the booking and
recheck recipient/service consistency. A customer notice has revision/count 1.
Read acknowledgments are idempotent and enforce revision/expiry/recipient. Existing
provider aggregate notifications and message permissions remain intact. Frontend
owns review text and links to `/search?service=:id` and `/my-bookings` within
`/inbox?scope=all&tab=notifications`. Reading does not automatically cancel, modify,
or accept new reservation terms.

## Profile picture

Authenticated profile setup preserves an existing chosen image, then considers
`avatar_url`/`picture` from verified Auth user/identity metadata. New external
URLs must be HTTPS without embedded credentials and within a bounded length.
There is no external profile request. Apple commonly provides no profile photo;
the account-icon fallback remains necessary. Live Google/Apple integration
was not tested.

## Verification

Passed with synthetic in-memory adapters; no DB/client/environment loading:

- `node --import tsx scripts/test-service-booking-followup.mjs`: actual storage
  transactions/locking sequence, unfinished-state deletion guards, durable
  deletion/provider/public/copy behavior, blocked restoration, original booking
  snapshot retention, eligible notices/no-op diff/insert-failure rollback,
  inbox count/list/read recipient/provider/workspace/revision/expiry boundaries,
  actual scheduling route ownership/input/inheritance checks, inclusive last day,
  specific-only isolation and safe OAuth image metadata.
- `node --import tsx scripts/test-startup-diagnostics.mjs`: 98 injected readiness
  and redacted diagnostic checks. Runtime and billing/activity-worker readiness
  now use DB's current 42-table profile, including the deletion marker contract.
- `node --import tsx scripts/test-global-inbox-backend.mjs`: 16 production-SQL
  message scope/read regressions using its predicate interpreter.
- `node --import tsx scripts/test-booking-capacity.mjs` and
  `scripts/test-customer-booking-actions.mjs`: pending/group capacity, snapshots,
  cancellation, authorization, availability and transaction rechecks.
- `node --import tsx scripts/test-search-storage.mjs`: bounded catalogs, duration,
  scoped schedule/materialization and workspace isolation.
- `node --import tsx scripts/test-booking-notes-backend.mjs`: 21 initial-message
  and 25 currency-booking scenarios.
- `node --import tsx scripts/test-service-photos-backend.mjs`,
  `scripts/test-custom-service-reminder-backend.mjs` (14 cases), and
  `scripts/test-notification-scheduling.mjs` (31 cases).
- `node --import tsx scripts/test-wishlist-backend.mjs`: 80 private wishlist,
  inbox route, worker and read regressions; synthetic persistence/Auth plus local
  loopback HTTP only. Initial sandbox run failed with localhost `EACCES`; the
  identical inspected fixture passed with approved escalation. No connected
  application/database request was made.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- Scoped `git diff --check`: passed. Existing Windows newline warnings remain.

Existing strict VM fixture import allowlists were extended for the new pure
protection module. Gallery/reminder tests now expose a narrow synthetic insert
adapter for their no-booking scenario; the new regression separately verifies
actual notice selection and rollback. No assertions were weakened.

DB's migration/SQL checks and contract review are in
[the database handoff](frontend-followup-database-2026-11-11.md). The tests above
do not prove actual PostgreSQL execution plans, migrations, RLS, lock races,
connected notification delivery, production OAuth or deployment. Frontend browser
verification belongs to root. Locale test scope remains en/lv/ru; ar including
RTL, zh, fr, de, hi, ja, pt and es remain deferred.

## Next action and recovery

Root integrates frontend review and reports exact-target migration execution as
the remaining runtime dependency. The new application/readiness contract refuses
startup against a database without the prepared 0024/0025 changes; do not bypass
those guards or run migrations/start writers without applicable target approval.

Recovery before execution is to reverse attributable backend/shared/test hunks
and the new helper, coordinating removal of DB-owned additions and frontend DTO
dependencies. Preserve all pre-existing unrelated changes. After migration,
coordinate recovery with DB; never drop notice history or the deletion marker as
an incidental frontend rollback.
