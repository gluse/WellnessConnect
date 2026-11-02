# Group appointments and rescheduling — revised design

**User approved local implementation on 2 November 2026.** The
[implementation record](group-appointments-implementation-handoff.md) records
current scope, the selected retention policy and verification/execution status.

**Layout/messaging revised in the [notes and private messages proposal](group-appointments-design-v3.md).**
Its user-requested changes supersede conflicting sections below; the rescheduling
proposal and prior confirmed decisions are preserved.

2 November 2026. Status: revised proposal, awaiting design approval.
Requester: user. Design/repository review executor: `/root`.
Scope: planning, read-only review and illustrative mockups only. No application
implementation, migration, connected operation, real message or deployment.

This revision supersedes the interaction proposals in the
[31 October design](group-appointments-design-proposal.md). Preserve that picture
as historical evidence; its per-customer completion and lack of group actions
are superseded.

## Confirmed user choices

- One provider appointment record per group event, expandable into customer bookings.
- Display customer notes when present.
- Offer individual general/custom messages, and private group messages for PRO.
- Move Reschedule, Cancel booking and Send message into More actions. Keep
  frequent Approve, Send reminder and event-level Mark complete visible when eligible.
- Mark complete belongs to the group event, not each customer row.
- Reschedule and cancellation are available for one booking and the whole event.
- Both providers and customers may initiate either kind of reschedule request.
- **User selected on 2 November:** each booking responds independently to a
  group reschedule. No unanimous/all-or-nothing group decision.
- **User selected on 2 November:** silence keeps the original reservation and
  displays Awaiting response. Silence is not rejection and does not auto-cancel.

## Approval pictures

- [Group appointments, action menus and private messaging](group-appointments-design-v2.png).
- [Reschedule request, recipient decisions and group outcomes](rescheduling-design-v2.png).

Generated with the built-in image tool using synthetic data. Pictures are
illustrative concepts, not screenshots or proof of implemented behavior.
Exact generation prompts are in [the prompt record](group-appointments-design-v2-prompts.md).

## Event layout and action scope

Retain the existing page navigation, view/date/employee filters, timezone display
and top-level statistics. A mocked layout control does not authorize unrelated
navigation or timezone-selection changes.

An event summary contains service, date/time, assigned employee, booking count,
confirmed places/capacity, pending places separately, and an expansion toggle.
A booking for multiple places counts as one booking. Distinct reservations by
the same customer remain distinct child bookings.

| Location | Visible primary actions | Menu |
| --- | --- | --- |
| Group event header | Mark complete, when eligible | Event actions: Reschedule event; Cancel event; Message group (PRO) |
| Confirmed customer booking | Send reminder, when eligible | More actions: Reschedule this booking; Cancel this booking; Send message |
| Pending customer booking | Approve | More actions: Reschedule this booking; Decline request; Send message |
| Customer's own booking | Existing permitted booking actions | Reschedule request and cancellation affect only that customer's reservation |

Show group booking notes as a labelled Customer notes section directly beneath
the relevant booking, preserving line breaks and wrapping long text. Do not put
notes in a menu or show empty note boxes. Notes remain associated with one booking;
they must never be copied into a group message automatically. A small summary
indicator can flag that notes exist when the event is collapsed.

Event completion confirms its scope: mark eligible confirmed bookings complete
together. Completed/cancelled bookings are not updated again; pending approval
requests are not silently completed. Preserve booking-level resulting statuses,
including mixed states, rather than inventing one misleading group status.
Existing one-to-one completion stays at that appointment's level.

Whole-event reschedule/cancel opens a review showing affected active booking and
participant counts before submission. Pending and confirmed bookings must be
identified explicitly; completed/cancelled records are excluded. Cancellation
requires a scoped confirmation. Existing payment/cancellation policy applies;
a new refund/fee policy is outside this proposal.

On phones, stack customer details, notes and compact actions within the event.
Keep menus keyboard accessible and restore focus after dialogs. Customer
permissions never include the provider's roster or whole-group controls.

## Individual and private group messaging

Composer: General message (editable template) or Custom message (blank text),
booking/event context, message preview and available delivery channel.
Individual messaging is available without PRO. Reuse existing supported
email/SMS/WhatsApp contact and preference checks; do not promise a channel that
is not configured or reachable.

Recommended delivery design for approval:
- Non-PRO individual messaging opens the existing external composer with editable
  text; label it Open email/SMS/WhatsApp rather than claiming the app sent it.
- PRO group messaging sends a separate private message to each selected eligible
  customer through the configured service, never a shared conversation,
  group-addressed email or client-side multi-recipient link.
- Review recipients and exclusions before sending. The provider may see names;
  recipients see only their own message, booking context and response link.
- Default group audience: customers with active confirmed/pending bookings, with
  explicit exclusions for cancelled/completed records. Deduplicate repeated
  bookings by customer for a general broadcast. Reservation-specific notices
  and rescheduling decisions remain tied to individual bookings.
- Show queued/sent/delivered/failed/unknown accurately where supported, including
  partial success. Retry only failed recipients without duplicating successful
  sends. Do not claim that opening an external composer establishes delivery.
- A free provider can see a PRO explanation for Message group. Server permissions
  and subscription checks enforce the same limit. Booking permissions govern
  messages and group actions; private recipient details never enter another
  customer's API response or message.
- Communication preferences and existing delivery safeguards still apply.
  Do not introduce a shared chat, marketing campaign or automatic subscription.

Delivery channels and template copy are proposal details, not newly approved
provider configuration, message-body retention policy or live sending.

## Reschedule request and decision

The requester chooses a new available date/time and one explicit fallback:

| Scenario shown to requester | Recipient approves | Recipient explicitly declines | No response |
| --- | --- | --- | --- |
| Keep original if declined — I would like to change the time | Move that booking to the agreed new time | Keep original booking/time | Keep original; Awaiting response |
| Cancel booking if declined — I cannot keep the original time | Move that booking to the agreed new time | Cancel that booking | Keep original; Awaiting response |

For provider requests, the customer responds. For customer requests, the provider
responds. A customer can request changes only to their own reservation, never
the event or other members. The customer's group booking retains its participant
count unless a separately approved workflow changes it.

The sender reviews original/new time, timezone, affected booking(s), optional
reason and both response consequences before sending. Sending creates a request;
it must not mutate the original reservation time or release its capacity.

The recipient sees original time -> proposed time, timezone, sender, reason,
participant count and plain-language consequences. Use outcome-specific buttons:
- Approve new time.
- Decline & keep original (scenario 1).
- Decline & cancel booking (scenario 2), with a second cancellation confirmation.

Consequences are visible before any decision; in scenario 2, the confirmation
repeats that the original reservation will be cancelled. Neither request delivery
nor an email/message open counts as agreement.

Recommended availability rule for approval: keep the original reservation while
waiting, without indefinitely blocking a second slot. Clearly disclose that the
proposed time is subject to availability. Revalidate capacity, permissions and
request version atomically on acceptance. If it is unavailable, apply neither a
move nor a cancellation: retain the original and offer a fresh proposal. This
technical failure must not be treated as a rejection in scenario 2.

Only one current reschedule request per booking. Repeated responses are
idempotent; stale/superseded requests explain that they are no longer actionable.
For opposing simultaneous requests, prompt the requester to review/replace the
current one rather than silently overwriting it. Withdrawal preserves the
original. Cancellation/completion invalidates outstanding requests. No timeout
or expiry outcome is authorized; once an original time has passed, show it
honestly and route to explicit resolution rather than auto-cancelling or
auto-completing because nobody replied.

Whole-event requests create a linked request per affected booking, with each
customer seeing only their own. The provider sees accepted/declined/awaiting
counts and outcomes. Accepted bookings appear under the new session; pending
responses remain at the original, and declined bookings follow the selected
fallback. A split into old/new event rows is expected because they are now
different sessions. Preserve a provider-only link between the request batch and
its results.

## Implementation plan after design approval

1. Front End Developer finalizes event grouping, notes, compact actions,
   confirmation/review and customer/provider request states. Reuse existing UI
   primitives and maintain translations.
2. Back End Developer and DB owner agree the persisted request/batch contract,
   session identity, revisions, authorization and atomic decisions. Current
   immediate rescheduling must be replaced in both provider/customer flows;
   hiding the immediate-save button alone is insufficient.
3. Backend/DB owners prepare reversible local changes and meaningful mocked/
   offline checks. Event identity must account for workspace/provider, service,
   assigned resource/employee, exact start and saved duration/cleanup compatibility,
   and preserve group linkage through rescheduling.
4. Backend coordinates event completion/cancellation and reschedule batches,
   recipient-private PRO delivery, entitlement checks and accurate partial
   delivery results with the existing notification pipeline. DB owner reviews
   request/message metadata and any retention choice; no message-body retention
   duration is selected here.
5. Frontend integrates all states, then verifies isolated end-to-end scenarios.
   Connected execution and deployment remain separate, target-specific operations.

Read-only evidence: the existing agenda renders one article per booking;
provider RescheduleDialog calls PATCH /api/bookings/:id/reschedule and current
route/storage changes the booking directly. The existing notification preview
supports status/reminder text rather than this general/custom group composer.
The [notes handoff](provider-booking-notes-handoff.md) records the separately
implemented labelled notes behavior; retain it in the new event layout.

## Acceptance and recovery

- Correct session grouping, multiple places/bookings and filtered full-event
  context; no merging different services, dates, employees or incompatible slots.
- Nonblank multiline notes visible on the right booking; no cross-customer leak.
- Frequent actions remain visible; group vs individual scopes and eligible counts
  are explicit; no customer-level Mark complete for group sessions.
- Group completion/cancellation does not silently leave an ambiguous partial
  operation; concurrency and unavailable bookings produce explicit outcomes.
- Both reschedule scenarios in both directions, with exact approve/decline/no-reply
  effects; independently mixed group responses; stale/double/crossed responses,
  capacity conflicts, withdrawal, cancellation/completion and past-time handling.
- PRO enforced on server; separate private deliveries; recipient deduplication,
  missing contacts/preferences, rejected/partial sends and duplicate-safe recovery.
- Provider-only roster, secure response authorization, workspace isolation,
  safe text rendering, pending/error/empty/denied states and keyboard/focus/reflow.
- Test only en/lv/ru using safe mocked/offline runners. ar (including RTL), zh, fr,
  de, hi, ja, pt and es remain deferred.

No application tests were run: no application code changed. Both final mockups
were visually reviewed and the local document-link check passed.
Generation introduced an incorrect current-time range in the rescheduling
draft; the saved final image corrects it to 09:00–10:00 throughout. Recovery for this
phase is removal of only the v2 proposal/pictures/prompt record and the v2 link
added to the original proposal. No existing changes or historical evidence is
to be reverted. Next: user design review; recommended availability/messaging
details above remain proposed until approved.

