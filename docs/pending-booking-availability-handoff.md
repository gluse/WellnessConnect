# Booking request availability and group capacity

## Assignment and acceptance — 29 October 2026

Requester: user, through coordinating `/root`. Owner/executor:
`/root/pending_booking_backend`, explicitly assigned Back End Developer for the
two reported booking bugs. Accepted under [AGENTS.md standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
See the [coordination record](agent-coordination.md) for integrated status.

Scope: reversible local backend application/scheduling changes, meaningful
isolated regression tests, and this handoff. The user's follow-up added group
capacity: a session with maximum six and two booked participants must leave four
places. No private configuration, database connection, schema/migration/ORM
change, connected service access, deployment, or publishing was authorized or
performed by this executor. Root separately assigned frontend ownership for
participant input/picker updates and language-scope correction; see the
[frontend evidence](pending-booking-test-scope-handoff.md).

## Implemented contract

- Pending requests and cancelled reservations do not occupy time or participant
  capacity. Confirmed and completed reservations retain occupancy. Customer and
  provider booking lists continue to include pending requests.
- Group reservations share capacity only for the same service, exact start
  instant, and identical saved duration/cleanup interval. Confirmed/completed
  `participantCount` values are summed; legacy null counts mean one participant.
  A confirmed two-place reservation in a six-place session leaves four.
- Different services, shifted starts, incompatible saved intervals, and individual
  appointments remain exclusive on the same employee/resource. Different employees
  and providers remain independent. Cleanup and exact interval boundaries are
  preserved.
- The existing provider-row lock serializes capacity checks with create,
  reschedule, and status changes. Creation and rescheduling check current remaining
  places. Approval rechecks capacity before writing; insufficient capacity returns
  HTTP 409 and leaves the request pending. Pending-to-completed also checks
  capacity, preventing an alternate status transition from bypassing the rule.
- Slot APIs add optional `BookableSlot.availableCapacity` (populated for returned
  slots). `bookableSlots` accepts an optional required `participantCount`, default
  one. Daily/monthly reschedule previews pass the existing reservation's count,
  exclude itself, and use saved duration/cleanup.

Implementation: [shared scheduling](../shared/scheduling.ts),
[storage mutations/resource reads](../server/storage.ts), and
[reschedule scheduling routes](../server/schedulingRoutes.ts).
`searchServices(availableOnly)` currently checks schedule windows and does not
read booking occupancy, so it needed no change for these bugs. Legacy service/day
and provider/day occupancy reads were aligned with the same status rule; provider
and seeker history/list reads were preserved.

No backend route contract removal was needed. The booking POST still derives
status from `service.instantBooking`, and derives identity/resource fields and
prices on the server. Client-provided status/identity cannot approve a request.

## Verification

Latest checks on the combined local source, including concurrent TASK-032
notification imports and mutation integration, passed on Node v24.21.0:

| Command | Result |
| --- | --- |
| `node --import tsx scripts/test-booking-capacity.mjs` | Passed isolated scheduling, production storage decisions, and registered route handlers against injected in-memory adapters |
| `node --import tsx scripts/test-customer-booking-actions.mjs` | Passed existing customer/provider authorization, future/state/input boundaries, saved availability, self-exclusion, failure mapping and transaction rechecks |
| `npm run check` | Passed full repository TypeScript check, exit 0 |
| `node --import tsx scripts/test-booking-capacity.mjs --original` | Expected failure against tracked pre-fix scheduling: `pending must leave a slot available`; no repository source is replaced |

The new regression runs actual scheduling, storage, authorization, and route
decisions. Its import allowlist blocks database/client/startup/config modules.
The relational fake evaluates the actual parameterized query filters; it does
not supply the capacity/status decision. Notification capture/reminder/transports
are separate injected no-op adapters. Covered outcomes include pending/free for
individual and group services, 2+3 leaving one place, cancellation releasing only
its count, full capacity, request approval ordering, rejected approval remaining
pending, reschedule conflicts, old duration/cleanup snapshots after listing edits,
resource separation, server-owned status/identity, and HTTP 403/409 responses.

The existing customer-action test's joined overlap fixture was updated to the
new `{ booking, duration }` projection. Its route expectations now include the
concurrent notification feature's default `UTC` fourth argument. The backend-only
cleanup assertions were corrected to expect pending slots to remain free; the
frontend owner handled that mixed runner's locale coverage separately. The
default cleanup runner was not invoked by this executor because it imports live
database/config modules.

An earlier full TypeScript check found five unrelated TASK-032 notification-worker
top-level-await errors, plus this change's initial overly broad `Service` helper
type. The helper was narrowed to its required fields. The other owner fixed the
worker; the latest full check passes. An intermediate compiler API check of 241
source files excluding that worker also passed, but the later full check is the
current acceptance evidence.

No new language resources were needed for backend logic. Current language
verification is limited to en/lv/ru through the frontend owner's checks. ar/RTL,
zh, fr, de, hi, ja, pt and es remain deferred; supported translations and
historical evidence are preserved.

## Security, concurrency limits, and recovery

Identity/workspace/customer authorization, provider-only approval, customer-only
cancellation rules, closed-state restrictions, and controlled 409/403 errors were
preserved and exercised. Queries remain parameterized. Capacity is enforced on
the server, before mutation/notification effects, under the existing provider
lock. No new credential handling or external boundary was introduced.

These are offline tests, not live database/RLS/transaction-isolation or
multi-connection race verification. The fake checks provider-lock ordering and
repeated acceptance/rejection, not actual PostgreSQL locking. No application was
started or deployed, and no real notification was sent. Existing provider-lock
transactions supply the application concurrency mechanism; connected verification
would require the DB owner's exact target/operation authorization.

Concurrent notification changes in `server/storage.ts`, `server/routes.ts`,
`shared/schema.ts`, and their new files were preserved. They are not this task's
implementation or verification claim. Root owns the integrated queue/task status;
frontend owns its separate required checks. Recovery is to revert only this
task's attributable scheduling/capacity changes and tests, preserving notification
work and all unrelated pre-existing edits. There is no database rollback step.
