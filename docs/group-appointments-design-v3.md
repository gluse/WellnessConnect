# Group appointments — notes and private messaging revision

**User approved local implementation on 2 November 2026.** See the
[implementation record](group-appointments-implementation-handoff.md) for current
status and the subsequently selected 12-month message-history policy. The design
discussion below is preserved as the proposal reviewed before approval.

2 November 2026. Status: proposed; awaiting design approval.
Requester: user. Design executor: `/root`.
Scope remains design artifacts and repository review only. No application code,
database operation, message sending or deployment.

This revision supersedes the conflicting layout/messaging sections of the
[v2 plan](group-appointments-design-v2.md). Retain v2 and its images as historical
proposals. Its rescheduling scenarios, independent group responses, no-response
choice, group completion and individual/event action scope remain in force.
The previously recommended availability rule is still a proposal, not a recorded
user approval.

## Current approval picture

[Updated group appointments and private booking conversation](group-appointments-design-v3.png).

Edited with the built-in image tool from the v2 approval board. All people,
notes and conversation examples are synthetic. The image is a concept, not
rendered application evidence. See the [exact prompt](group-appointments-design-v3-prompt.md).
The [rescheduling picture](rescheduling-design-v2.png) remains the reference for
that unchanged part of the proposal.

## User-requested changes

- Remove the Message type block entirely. Keep one editable multiline message
  textbox, without General / Custom radio choices or an equivalent mode selector.
- Give the event header a distinct background so the event summary and event-level
  actions stand apart from the customer booking list.
- Add a comments icon/button to show or hide existing customer notes.
- Keep messaging history and open it on request.
- Allow customers to message their service provider, as well as providers messaging
  customers. Preserve the earlier requirement for private PRO group messaging.

## Proposed presentation

Use a pale indigo event header with a fine bottom border; customer booking rows
remain white. Keep the same service, schedule, employee, capacity and pending-place
information and the existing proposed event controls. The background emphasizes
scope, rather than representing another booking status.

Notes are separate from messages. Each booking with nonblank notes has a speech
bubble icon and visible Show notes / Hide notes label. Toggle that booking's note
without collapsing the event or affecting another booking. Preserve multiline
text and wrapping. Bookings without notes have no empty note section or inactive
notes button. The picture shows Ana's note open, Lina's collapsed and Mark without
a note, to illustrate all three cases.

Show a Messages control per booking/request. It opens that private conversation
on demand; the full history does not occupy every expanded event row. If a count
is shown, it denotes message count; any future unread count must be labelled
separately. Send message in More actions opens the same conversation with the
textbox ready. A customer gets Message provider from their own booking and can
open the same history and reply without PRO.

Conversation header: service, booking reference/date/time and counterpart.
Messages show sender identity/role, timestamp, text and an accurate save/send
state. Keep the multiline reply textbox visible while reading history, paginate
long histories, and show loading/error/empty states. The customer view contains
no group roster, other customer names, recipient count or other customers'
messages.

In this proposal, “per request” means the individual customer's booking/request.
Keep a stable conversation across rescheduling; a new time must not create a
disconnected history. Rescheduling requests and decisions may appear as clearly
labelled system entries linked to their explicit response controls. Free text
such as “yes” never substitutes for the explicit reschedule decision.

## Recommended messaging model for approval

Use in-app conversations as the retained two-way record. This supersedes v2's
external-composer-only recommendation for non-PRO individual messages: a composer
opened in an external app cannot by itself capture a complete sent/reply history.

Individual in-app messages and replies are available to both sides without PRO.
Only the provider's send-to-group operation requires PRO. Do not gate a customer's
reply to a received broadcast behind a subscription.

Group composer: event context, private recipient summary, one message textbox,
Cancel and Review recipients. The next step previews the eligible recipients and
message before sending. Save a private copy/reference in each affected customer's
booking conversation. Each recipient's reply is private to the authorized
provider team and that customer; there is no shared group conversation.
General group messages do not include customer notes, personal details, another
customer's booking context or the provider's recipient list automatically.

Maintain the earlier audience review, server-side permissions/entitlement checks
and explicit exclusions. For multiple bookings by the same customer, identify the
affected booking context, avoid duplicate external notifications to that recipient,
and keep separate reservations' history linkage clear. Do not merge unrelated
customer threads merely because the service or event matches.

Email/SMS/WhatsApp can provide optional notifications or supported delivery copies,
subject to existing preferences and availability. The in-app message and external
notification have separate states: message saved does not prove notification
delivery or that the recipient read it. External replies appear in app only if an
explicit, verified inbound integration exists; this proposal does not assume one.

Show a failed send honestly, preserve unsent draft text, and make retries duplicate
safe. A delivered group message remains in each private history even if another
recipient's delivery fails. Provider-only batch status must not expose recipients
in customer APIs, URLs, message content or history.

## Retained history and access

Retaining message history is now an explicit product requirement. Store message
content, authorship, timestamps and booking linkage under backend/DB ownership;
UI-only storage or external-composer links cannot satisfy it. Keep the history
available on demand for the relevant booking, including after a time change and,
within the eventual retention policy, after completion/cancellation.

Access follows the owning customer and currently authorized provider/workspace
permissions. A customer cannot fetch another thread by changing an ID. Provider
team membership/assignment changes must be evaluated server-side; retaining a
history does not grant permanent access to a former team member.

The user has not selected a retention duration or deletion policy. Do not assume
indefinite storage or choose a purge period in this design. Backend/DB owners must
present a concrete retention/deletion choice before implementing that policy.
No new message editing, attachments, shared customer chat, external inbox sync or
read-receipt feature is implied.

## Implementation and acceptance after design approval

Frontend owns tinted event layout, independent note disclosures, message-history
entry points, customer/provider conversation views and one-textbox composers.
Backend/DB owners agree persisted conversations/message/broadcast linkage, access
checks, pagination, idempotent sends and the unresolved retention/deletion policy.
Keep reschedule-request records and explicit decisions separate from ordinary
message text, even when displayed within one history.

Add isolated checks for note disclosure independence/no-note cases, labels and
keyboard/focus flow; messages in both directions; correct per-booking history
across rescheduling; private broadcast/replies; free individual messaging versus
PRO group sending; cross-customer/workspace denial; save/notification distinction;
duplicate sends, partial failures, pagination and responsive layouts. Maintain
all supported translations but test only en/lv/ru. ar (including RTL), zh, fr, de,
hi, ja, pt and es remain deferred.

No application tests were run for this design-only revision. The final image was
visually reviewed: header tint, retained textbox, removed message-type block,
independent notes controls and private customer/provider history are present.
The local document-link check passed. Recovery removes
only v3 artifacts and their links from prior proposals, preserving all earlier
images and unrelated repository changes. Next: user reviews the revised design;
implementation remains pending approval.

