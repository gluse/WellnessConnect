# Provider group appointments — design proposal

**Superseded by the [2 November revised proposal](group-appointments-design-v2.md).**
The original picture below is preserved as historical design evidence.

31 October 2026. Status: proposed; awaiting user design approval.

User request: display one record per group event in provider Appointments, with
expansion for customer details. Draw the proposal for approval before development.
Executor: `/root`; scope is read-only review and a design artifact. Application
implementation, connected operations and deployment are not authorized by this
design phase.

Approval picture: [desktop and mobile mockup](group-appointments-design-proposal.png),
created with the built-in image generation tool and visually reviewed. The
illustrated time-zone field remains informational in scope; adding a time-zone
selector or moving the existing navigation is not part of this change.

Image prompt direction: high-fidelity FitsMyTime provider Appointments design
board in the existing white/gray/indigo style; explicitly labelled collapsed and
expanded states of one Group Pilates session, plus mobile expansion. Show three
synthetic customer bookings, four confirmed places out of eight, one pending
place, individual booking actions and notes, with no event-wide actions.

## Proposed interaction

- Each booked group session appears once, collapsed by default. Its summary shows
  service, date/time, assigned employee, customer booking count, confirmed places
  against capacity, and pending places separately.
- “View bookings (3)” expands customer bookings within that event; “Hide bookings”
  collapses them. Show a visible chevron and use a keyboard-operable disclosure
  with an accessible name and expanded state when implemented.
- Customer rows retain their own status, participant count, amount, notes and
  applicable existing approval, completion, reschedule, cancellation and reminder
  controls. Permissions and reminder eligibility still govern those controls.
  The picture illustrates available controls, not a change to their eligibility.
- A booking for two places remains one customer booking. Separate bookings by the
  same customer remain separate child records. Pending requests do not consume
  confirmed capacity. No bulk event actions are proposed.
- Retain Upcoming / By date / Past & cancelled, status and employee filters.
  When a status filter matches an event, keep its full relevant booking context
  available on expansion and identify matching rows; capacity totals must not be
  recomputed from only filtered rows. Cancelled bookings remain accessible in
  applicable views without contributing to occupied places.
- On a phone, stack event metadata and customer rows, wrapping booking actions.
  Single-customer group sessions still use the event disclosure. Individual
  one-to-one appointments retain their current presentation.

## Identity and preparation for implementation

Group by a real session identity, never just the service name or customer.
Review provider/workspace, service ID, employee/resource assignment, exact start
instant, and saved duration/cleanup compatibility against the existing scheduling
contract. Different dates, employees, services or incompatible intervals must
remain separate. The current records are bookings rather than a dedicated event
entity; whether existing response data is sufficient needs verification during
implementation. This proposal does not approve a new database event model.

Reference files reviewed: `client/src/components/appointment-agenda.tsx`,
`client/src/pages/provider/appointments.tsx`,
`client/src/components/provider/appointment-stats.tsx`, `shared/scheduling.ts`.
Current agenda groups bookings by day and renders an article for each booking.
Existing top-level statistics are outside this proposed layout change.

The illustration shows the same synthetic session in two explicitly labelled
states, plus a mobile example: three bookings, four confirmed places out of eight,
and one pending place. They are not multiple occurrences of the same event.

## Approval and verification

Next action: user reviews the picture and approves or requests design revisions.
After design approval, assign implementation to the Front End Developer and route
any backend/database dependency to its owner under AGENTS.md. No application
files were edited and no application, browser or database tests were run for
this proposal. The image is a concept, not rendered application evidence.

Future testing scope is en/lv/ru only. ar (including RTL verification), zh, fr,
de, hi, ja, pt and es remain deferred; this design claims no fresh locale coverage.
Recovery: remove only this proposal and its associated design image.
