# TASK-037 — backend implementation handoff

2 November 2026. Implemented and verified locally; migration execution and
deployment remain pending. Requester/integrator: `/root`. Assigned Back End
Developer/executor: `/root/appointments_backend`.

## Authority and ownership

User approved implementation of the v2/v3 designs: “go ahead. implement changes”.
Backend accepted the scoped assignment under AGENTS.md standing cooperation and
used the backend practices skill. Scope covers reversible backend/shared-contract
files, injected tests and this handoff; no connected database/services, credentials,
real messages or deployment. Frontend remains with its assigned owner.

[DB owner](group-appointments-db-handoff.md) owns ORM and migrations, accepted the
schema dependency, and specifically delegated local integration of its readiness
fragments into `migrations/billing/application-readiness.mjs`/`.d.mts`, plus the
bounded retention query and offline checks in `server/appointments/retention.ts`.
User subsequently selected twelve calendar months after the later terminal
transition or last message, with unresolved bookings retained until resolved.

## Implemented behavior

`shared/appointment-collaboration.ts` supplies strict, bounded input schemas, API
types and a common event key built from provider/workspace, service, employee,
exact start instant and saved duration/cleanup. One-to-one bookings stay distinct.

`server/appointments/repository.ts` and `routes.ts` provide:

- Private, two-way booking conversation history with deterministic cursor pages
  of 50 messages; sender role/name/time and message body. Customer responses do
  not include broadcast or batch linkage. Untrusted text remains plain data.
- Individual messages for authorized customers/providers without PRO, with a
  caller-generated idempotency UUID and a bounded 4,000-character body.
- Provider-only event recipient previews and private PRO broadcasts saved in each
  affected booking conversation. No shared customer thread or external sending
  is introduced. Replies remain private; in-app save does not imply delivery/read.
- Exact-session group completion/cancellation, with server-derived eligible IDs
  compared against the reviewed set. Completion affects confirmed bookings only;
  pending requests are never silently completed. The operation is transactional.
- Provider/customer reschedule requests, one pending request per booking,
  requester withdrawal, explicit recipient acceptance/decline, and retained
  outcomes. Both fallback scenarios are implemented. Sending does not mutate the
  old reservation; silence does not expire, move, complete or cancel it.
- Independently answered whole-event requests, plus a provider-only batch-outcome
  endpoint that remains linked after individual bookings move to a new session.
- New-time schedule/capacity validation at proposal and acceptance. Group proposals
  must fit all confirmed places initially; each acceptance rechecks current
  capacity. Failed acceptance preserves both the original booking and request.
  Pending booking acceptance changes its time without approving the booking.
- Stale/version-mismatched requests are not actionable; duplicate messages,
  proposals and repeated decisions do not duplicate effects. Opposing requests
  require the outstanding request to be reviewed/withdrawn first.

All writes take the same provider-row lock as existing booking creation/approval,
then lock/reload the booking and recheck current company membership/assignment.
Customer ownership is independent of the selected provider workspace. Group
operations cannot substitute an arbitrary client roster. Names/authors are fetched
in batches; exact-session authorization and availability are shared where valid.
Resource overlap predicates use each historical booking's saved duration/cleanup,
with its own service-duration fallback for legacy null snapshots. Thousands of
nonoverlapping historical bookings do not block a future reschedule.

The legacy `PATCH /api/bookings/:id/reschedule` is still authenticated/authorized
and input-validated, but returns `409 consent_required` without changing anything.
The internal storage method remains for its isolated occupancy regression; there
is no longer an HTTP path that calls it to bypass recipient agreement.

`server/storage.ts` invalidates pending agreement requests on booking status
changes. Closing mutations set the DB-owned `bookings.closedAt` snapshot once;
payment updates and same-state retries do not extend the retention anchor.
Actual moves/cancellations reconcile existing notification/reminder records within
the transaction. Request creation itself produces no external messages.

## Retention and runtime preparation

The server lifecycle starts an hourly, unref'd, nonoverlapping cleanup and stops
it on shutdown. It is independent of PRO and notification configuration. No purge
is attempted immediately at startup. One batch locks at most 100 eligible terminal
bookings and deletes at most 1,000 expired message rows; later hourly batches drain
larger histories. Physical deletion can therefore lag the anniversary by a bounded
maintenance cadence/backlog rather than occurring at the exact anniversary.

Eligibility uses the **forward twelve-calendar-month UTC anniversary** of both
the terminal snapshot and last message. PostgreSQL predicates and fresh post-lock
JavaScript checks clamp leap-day anniversaries correctly: 29 February 2032 expires
on 28 February 2033 at the same UTC time. An inverse cutoff plus one day is only a
broad index bound, never the final deletion decision. The fresh aggregate statement
after booking locks protects a message committed while locks were being acquired.
Empty histories cannot starve later candidates. Unresolved bookings, notes and
reschedule decision records are never deleted by this message-content policy.

The DB migration conservatively backfills existing terminal bookings with the
migration-time anchor; it does not guess their original close time. Application
readiness now composes the two private tables, `closed_at` metadata and the DB
owner's exact constraint/index/ACL/policy checks: 35 current tables, four parameter
contracts and six additional `appointment_*` checks. Historical migration profiles
were not expanded. New DDL/runtime grants are prepared, **not applied**.

## Verification

All tests use synthetic data and injected boundaries. No live DB, credentials,
session persistence, provider requests or production configuration were used.

| Command | Result |
| --- | --- |
| `node --import tsx scripts/test-appointment-collaboration.mjs` | 43 repository/policy scenarios pass. Private paging/replies, strict schema, scope/PRO, idempotency, completion, both reschedule directions/fallbacks, independent group responses, batch privacy, capacity/legacy duration, >5,000 historical bookings, revoked access and rollback. |
| `node --import tsx scripts/test-appointment-collaboration-api.mjs` | 22 real Express API scenarios pass, over loopback with mocked Auth/DB. Initial sandbox loopback access failed with EACCES; the permitted local regression passed with sandbox escalation. No external endpoint was contacted. Cleanup verifies its absolute test directory before recursive removal. |
| `node --import tsx scripts/test-booking-message-retention.mjs` | 16 scenarios pass: calendar/leap anniversary, no early expiry, closure/last-message anchors, unresolved preservation, exact boundary, batching, empty-history exclusion, fresh-snapshot race, and lifecycle stop/concurrency. |
| `node --import tsx scripts/test-customer-booking-actions.mjs` | Pass; legacy consent/no-write assertions updated while retaining customer/provider permissions, malformed/future/state boundaries, saved scheduling and internal transactional conflict checks. |
| `node --import tsx scripts/test-booking-capacity.mjs` | Pass; shared capacity/approval/cleanup regression retained, plus provider/customer legacy HTTP bypass denial. |
| `node --import tsx scripts/test-booking-notes-backend.mjs` | Pass; multiline en/lv/ru/null notes, identity/status and provider visibility retained. |
| `node --import tsx scripts/test-notification-worker.mjs` | 26 scenarios pass after extending the in-memory adapter for new appointment tables. |
| `node --import tsx scripts/test-notification-bootstrap.mjs` | 34 real-bootstrap/in-process scenarios pass. |
| `node --import tsx scripts/test-startup-diagnostics.mjs` | 66 metadata-only checks pass with the expanded readiness contract. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Pass for the integrated application after the retention changes; root also performs final integrated verification. |
| Scoped `git diff --check` | Pass; existing LF/CRLF notices are informational. |

Only en/lv/ru locale checks were run. ar (including RTL), zh, fr, de, hi, ja, pt
and es remain deferred. These mocks do not prove connected PostgreSQL constraints,
locking/RLS or production operation; DB owner has separate offline manifest/DDL
checks. Root owns browser/build integration and the final task status.

## Recovery and next action

Preserve all unrelated dirty changes. Recover only the task's new appointment
modules/contracts/tests, their route and lifecycle wiring, pending-request/closure
hooks, current readiness composition and the small fixture expectation updates.
Do not revert whole shared files. DB recovery/migration execution follows its
owner's handoff; do not drop retained private records casually. An applied message
purge cannot recover deleted content without an authorized backup/recovery path.

Next: root integrates the frontend evidence and DB review, completes required
checks, and presents the prepared migration/execution status accurately. No new
backend implementation dependency is known; connected execution/deployment remain
outside this assignment.
