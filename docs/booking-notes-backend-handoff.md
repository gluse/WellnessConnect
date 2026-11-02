# Booking notes backend verification — 31 October 2026

Completed locally. Requester/integration owner: `/root`, assigned frontend
work for the user's report that provider bookings do not show customer notes.
Backend owner/executor: `/root/booking_notes_backend`, assigned through live
collaboration under AGENTS.md standing cooperation. Scope: trace and verify the
existing booking notes API/storage contract with synthetic, injected adapters;
necessary reversible local backend fixes only if loss is reproduced. No connected
database/services, private configuration, schema/ORM changes or deployment.
Frontend changes, shared coordination queue and existing mixed capacity runner
remain owned by other tasks and are not edited here.

Acceptance: nonempty Unicode/multiline notes and null notes survive real booking
creation and authorized provider-list logic; current identity/workspace visibility
remains enforced. Recovery: remove only this task's new test and handoff, plus
any specifically documented backend changes. No application behavior change is
currently proposed.

## Findings

No backend notes loss was reproduced in the current repository code. The form's
`notes` property is retained by `insertBookingSchema`, which is applied by
`POST /api/bookings`. `DatabaseStorage.createBooking` spreads that validated
booking into the insert values. `getBookingsByProvider` spreads each booking
record into the provider DTO; `GET /api/bookings/provider` retains notes while
filtering workspace/employee visibility and while adding notification summaries.
No backend application or schema files were changed. This result does not prove
the data/deployed version for the user's specific booking.

## Verification

Added `scripts/test-booking-notes-backend.mjs` using the established TypeScript
transpile/VM injection approach. Real schema, routes, storage, scheduling and
workspace-scope logic run with an in-memory relational adapter. The adapter
interprets parameterized filters and records inserts; it has no note-specific
retention logic. Unknown imports are rejected. Database clients, real Auth,
dotenv, notification transports and server startup are never imported. No
environment files, credentials or external services are used.

- `node --import tsx scripts/test-booking-notes-backend.mjs`: passed on Node
  v24.22.2. Nonempty multiline en/lv/ru text, including HTML-shaped plain text,
  and null retain exact values in POST output, insert input, storage provider
  mapping and provider API output, with notification summaries enabled/disabled.
  The actual route overrides spoofed actor/provider/status fields. Actual storage
  filters retain personal scope; actual route scope filters retain assigned
  employee visibility in a company. Invalid workspace returns 403. The endpoint
  still registers the authenticated guard; its injected boundary returns 401
  for a missing actor. Real Auth/session verification is outside this unit check.
- `node --check scripts/test-booking-notes-backend.mjs`: passed.
- Scoped Markdown whitespace check: passed.

The initial test adapter lacked Drizzle join/subquery-builder methods used during
module initialization. Those methods were added to the fake; production source
was unchanged, and the full focused regression then passed.

Security scope: the synthetic note is not executed or logged; notes remain in
the already authorized provider response. No auth, workspace permissions, SQL,
retention policy, credentials or connected environment was changed. No database
schema/RLS/concurrency or live/deployed persistence is claimed. The executable
check uses en/lv/ru text only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

Next owner/action: root integrates the labelled provider-notes presentation and
its frontend checks, and reports this distinction between verified local data
flow and unverified live booking data. No backend implementation dependency
remains. Recovery: remove these two new task files only; preserve other changes.
