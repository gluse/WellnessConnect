# Reservation note as the first message

Date: 3 November 2026. Status: implemented and verified locally, 4 November 2026.
See [the implementation handoff](reservation-initial-message-handoff.md).

## Implementation decision — 4 November 2026

The user requested implementation and subsequently answered the historical-note
question: **"you can delete / ignore current notes."** Selected implementation:
ignore existing notes. Remove separate notes controls and the notes-only group
indicator for all reservations; retain Messages as the sole conversation entry.
Do not migrate, synthesize, delete or change retention of historical notes. The
existing database column can remain unused. New reservations store their optional
text in `booking_messages` with `bookings.notes` null. This decision supersedes
the historical backfill, temporary legacy display and column-retirement sequence
proposed below; those sections remain design history, not current requirements.

Implementation owners are `/root/initial_message_frontend` (frontend),
`/root/initial_message_backend` (backend) and `/root/initial_message_database`
(database contract review), assigned through live collaboration under AGENTS.md.
Root owns integration and records; Frontend/Backend explicitly delegated their
local implementation to root and returned final review. Scope: reversible local
files and offline/mocked checks only; no connected writes, private configuration
or deployment. Track
[TASK-040](../TASKS.md#reservation-messages) and the
[coordination record](agent-coordination.md#reservation-initial-message--4-november-2026).

## Original proposal — 3 November 2026

User request: when creating a reservation, save the optional note as its initial
message instead of maintaining separate notes and messages. This planning task
authorizes repository review and this document only. No application or schema
changes, connected operations, private configuration access or deployment occurred.
Existing uncommitted work must be preserved.

## Intended behavior

- Keep one optional text area in reservation creation, labelled **Message to the
  provider (optional)**. Explain that it starts the reservation's conversation.
- A nonblank value becomes one customer-authored message on that reservation,
  timestamped at creation. It is visible to the customer and authorized provider
  through the existing Messages conversation. Further replies use that thread.
- Empty or whitespace-only input creates the reservation without a message.
- Store new text only in `booking_messages`; leave `bookings.notes` empty for new
  reservations. Do not create a reservation and then send its message through a
  second browser request.
- Use the existing message limit of 4,000 characters, with matching client/server
  validation. Trim surrounding whitespace and preserve internal line breaks and
  Unicode. Render the text through the existing safe plain-text message UI.
- Group reservations retain private conversations per booking. An initial message
  never becomes a broadcast or becomes visible to other customers.

## Repository findings

- `client/src/components/booking-modal.tsx` currently sends `notes` to
  `POST /api/bookings`, with a 2,000-character text area.
- `server/routes.ts` validates booking creation through `insertBookingSchema`.
  `server/storage.ts`, `DatabaseStorage.createBooking`, already uses a transaction
  for availability/capacity checks, booking insertion and reminder reconciliation.
  This transaction is the appropriate place for the initial message insertion.
- `shared/schema.ts` defines both `bookings.notes` and the existing
  `booking_messages` table, including author, body, timestamp, request UUID and
  booking linkage. New reservations do not require another table or column.
- `server/appointments/repository.ts` already reads paginated message histories;
  `client/src/components/booking-collaboration.tsx` displays them for both parties.
  Individual conversations are separate from the PRO-only group broadcast feature.
- `client/src/components/provider/booking-controls.tsx` currently provides separate
  Messages and Show notes actions. `appointment-agenda.tsx` also checks notes for
  its collapsed group indicator. Both need to follow the unified conversation.
- Message cleanup in `server/appointments/retention.ts` expires terminal-booking
  histories once both closure and the latest message are at least 12 calendar
  months old. Existing reservation notes are outside that cleanup path.

These are repository findings, not verification of a deployed database or service.
Prior note-preservation evidence remains in
[the backend handoff](booking-notes-backend-handoff.md) and
[the provider handoff](provider-booking-notes-handoff.md).

## Implementation sequence and ownership

1. **Backend owner: define and implement the creation contract.** Accept an
   optional `initialMessage` separately from persisted booking fields. Temporarily
   accept legacy `notes` as an alias for older clients, converting it to the same
   message path. If both contain different nonblank text, return a validation error;
   identical values produce one message. Validate before writing and never spread
   these input fields into the booking insert. Derive author ID and customer role
   from the authenticated booking creator, never supplied author fields.
2. **Backend owner: save atomically.** Inside `createBooking`'s existing transaction,
   insert the optional message linked to the created booking, using server-generated
   UUIDs, `broadcastId: null` and the booking creation timestamp. A message insertion
   failure rolls back the booking and reminder changes. A rejected/conflicting
   reservation creates no message. Reuse or extract transaction-aware message
   insertion code where useful; do not call the public send endpoint after commit.
   Preserve duplicate-submit guards and disable automatic creation retries. This
   change does not by itself add booking-level network-retry idempotency.
3. **Frontend owner: update creation and conversation presentation.** Replace the
   form's notes state/payload with `initialMessage`, add the label/help text, and
   preserve drafts through validation and save failures. Refresh relevant cached
   booking/conversation data after success. Remove separate note controls once
   historical-note handling is in place; retain one Messages entry point in provider
   list/calendar details and customer bookings. Replace or remove the notes-only
   group indicator; do not fetch every conversation just to render the agenda.
   Maintain supported translations and accessible labels, focus and error feedback.
4. **DB owner with Backend: prepare the historical transition.** Recommend converting
   nonblank historical notes into customer messages at each booking's original
   creation timestamp. Prepare a repeatable migration with a stable per-booking
   import identity, duplicate protection, counts and a recovery manifest. Do not
   deduplicate by message body alone, truncate notes to fit 4,000 characters, or
   invent missing timestamps. Report exceptions for a deliberate resolution.
   Backfill and verification must precede removing historical notes from the UI.
5. **DB owner: retire the old field in a later release.** Keep the physical column
   during compatibility rollout. After all writers/readers have moved, historical
   content is verified and recovery is agreed, prepare removal of the alias,
   obsolete ORM/API fields and `bookings.notes`. Apply schema changes only under
   authorization for the named database and operation. No dual writing is needed.

Frontend, Backend and DB implementation must be accepted by their respective
assigned owners under [AGENTS.md](../AGENTS.md). No implementation owner is assigned
by this planning document. CI/CD owns coordinated rollout; backend compatibility
support precedes switching the form payload.

## Historical-data decision and release limits

Recommend applying the existing conversation retention policy to new initial
messages. Historical notes require an explicit data-handling decision before a
backfill: converting them also places them under message cleanup and may make old
closed reservations immediately eligible for deletion. Do not change timestamps
to extend retention silently or apply that change to historical notes implicitly.
Confirm this policy and a named target/operation authorization before migration.

The new-reservation path can be implemented and checked offline independently.
Keep legacy note display for unmigrated historical bookings until the approved
transition completes; it is temporary compatibility, not a second field for new
reservations. Never synthesize fallback messages that resurrect expired history.
Rescheduling-request notes are a separate agreement record and remain unchanged.

## Acceptance and verification

- Pending and instant-confirmed reservations with text create exactly one linked
  customer message and no stored booking note. Blank input creates none.
- Actual route/storage behavior with injected database boundaries covers message
  insertion failure and rollback, capacity conflicts, spoofed author fields,
  4,000/4,001-character limits, alias conflicts and multiline Unicode content.
- Both authorized parties see the same initial message through the existing history
  endpoint, in chronological order and through pagination. Other customers and
  unauthorized workspace/employee roles cannot read it. Group messages stay private.
- Browser checks cover creation, subsequent replies, failure/draft recovery,
  duplicate activation, safe rendering of HTML-shaped text, keyboard flow and
  phone/desktop layouts. Existing booking, collaboration, capacity and provider
  notes regressions must be updated to the new contract, preserving their coverage.
- Inspect test runners/imports/hooks first. Use synthetic data and offline/mocked
  adapters; do not start connected sessions or exercise persisted API/UI write paths.
  Run affected checks, TypeScript and an isolated frontend build during implementation.
- Test only **en, lv, ru**. **ar/RTL, zh, fr, de, hi, ja, pt, es** remain deferred;
  maintain supported translations and preserve historical evidence.
- Migration execution, verification and recovery need a separately authorized
  target and DB owner. Preserve source notes until backfill verification; recovery
  identifies imported rows by the migration manifest, not by message text. After
  cutover, application rollback must retain conversation reads so new messages
  remain accessible. Do not copy all messages back into a single notes field.

No tests were run during the original planning step. Local implementation and
verification are now complete under the 4 November decision above; see the
[handoff](reservation-initial-message-handoff.md). Historical conversion and
column removal are outside the selected implementation.
