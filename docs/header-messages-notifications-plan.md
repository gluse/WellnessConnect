# Header messages and notifications plan — TASK-042

Prepared 4 November 2026 from the user's `/plan` request and subsequent
“proceed”. User approved the expanded wishlist implementation on 4 November 2026.
Status: implemented and verified locally; migrations 0018/0019 applied once on
development project `hbkooiknruimukkhshrk`, with all 26 restricted runtime checks
passing. App/worker startup and live workflow acceptance remain unperformed.
The selected wishlist behavior and
90-day/UTC activity policy are recorded below. No connected operation is included.

## Approved wishlist expansion — 4 November 2026

One private, implicit wishlist belongs to every authenticated account across roles,
workspaces and devices. Small outlined/filled-red hearts overlay public service
images/placeholders with a 44px accessible target. Controls are siblings of image
buttons and do not open details/book or emit a view event. Include search, catalog,
storefront, details and wishlist; exclude provider editing/unpublished previews.
Serialize mutations, synchronize instances and restore/retry after failures.

Guests sign in, return to `/search?service=<id>` via a strict allowlist and click
again. The read-only loader uses public service GET without recording a view.
No automatic save or guest/device wishlist. `/wishlist` appears in account/mobile
menus, newest saves first, with pagination, details/booking/removal and honest
loading/empty/error states. Unpublished entries remain safely removable unavailable
placeholders; republishing restores them. Hard service/account deletion removes them.

Private APIs: GET `/api/wishlist/services` (default 24/max 50, newest-first cursor),
GET `/api/wishlist/membership?serviceIds=...` (max 100 distinct IDs), PUT/DELETE
`/api/wishlist/services/:id` (idempotent 204). Derive identity server-side, use private
no-store responses, same-origin protection, validation and bounded limits. Public
DTOs stay unpersonalized; membership is batched. Membership key `(user_id,service_id)`
has a saved timestamp and listing/service indexes. Atomic addition events deduplicate
per user/service/UTC day. Own/team saves are allowed but excluded from counts;
unsave does not decrement history. Snapshot seller scope and expose counts only.

A bounded 15-minute worker processes completed UTC days and updates daily totals,
recipient read versions and source processing state transactionally. Retries and
late commits cannot double-count. User selected UTC reporting and 90-day activity,
notification and private dedup history, including after unsave. Membership lasts
until removal/account/service deletion. Existing message retention stays unchanged.

Local owners accepted: Frontend `/root/wishlist_frontend`, Backend
`/root/wishlist_backend_plan`, DB `/root/wishlist_database_plan`. Additive SQL and
compatible versioned runtime readiness are prepared locally; no connected execution
or deployment followed from local preparation. Later exact-target database
authorization, the explicit TASK-042 no-backup exception and actual successful
activation are recorded in [integrated status and recovery](wishlist-handoff.md).

## Requested result

Add two buttons immediately before the language picker in the shared header:

`[ Messages ③ ] [ Notifications ② ] [ Language ] [ Account ]`

Use the existing icon library: a message icon and a bell with a red count badge
in the upper corner, following the supplied bell example and the header's colors.
Show both to authenticated users on desktop and mobile. Hide the badge at zero;
show `99+` visually above 99 while announcing the exact count accessibly.

- Messages counts unread incoming **messages**, not conversations. Its panel groups
  them by booking conversation, showing the counterpart, service/booking context,
  timestamp, unread count and an actual link to that conversation. A small private
  preview is optional; recommended default is no message-body preview in the header.
- Notifications counts unread **notification items**, not the number of people or
  events summarized inside each item. A daily item saying “Your Yoga class received
  9 views yesterday” adds one to this badge. Items link to their relevant service
  or booking, show when the activity happened and identify unread state without
  relying only on color.
- Desktop uses bounded popovers; narrow screens use an accessible sheet/dialog
  with a scrollable list. Only one panel opens at a time. Include loading, empty,
  failed/retry and unavailable-target states, plus paginated “View all” destinations.
  Opening a panel alone does not mark everything read.

## Repository findings

| Existing area | Finding and implication |
| --- | --- |
| `client/src/components/app-header.tsx` | Shared authenticated/public header already contains `LanguagePicker`, role switcher and account menu; insert controls here. Preserve its search and short-screen behavior. |
| `client/src/components/booking-collaboration.tsx` | Retained booking conversations and a 30-second conversation refresh exist. Reuse `BookingConversationDialog`, privacy disclosure, plain-text rendering and reply behavior. |
| `shared/schema.ts`, `shared/appointment-collaboration.ts` | Messages contain authors, booking IDs and timestamps, but no per-reader state or unread DTO. Durable unread counts require a backend/DB dependency. |
| `server/appointments/repository.ts` | Conversation access is checked per booking, customer, workspace, membership and assigned employee. Inbox enumeration must preserve these rules. Authorized read-only providers must remain read-only. |
| `client/src/App.tsx`, provider/customer booking pages | Current booking routes exist, but there is no inbox route. Add explicit conversation navigation; do not depend on finding a booking in the currently visible calendar page. |
| [Service-view handoff](service-view-audit-handoff.md) | Explicit service-detail events exist, may be anonymous/repeated, are feature gated and are not a guarantee that a human viewed the service. The audit contract uses R90 retention. Do not expose raw audit events to providers or assume live capture is available. |
| Wishlist | No wishlist/favorites implementation was found in the inspected client/server/shared sources. “5 users added your Massage to their wishlist” needs a real save/unsave feature and data contract first. |
| [Notifications handoff](notifications-handoff.md) | Existing booking delivery/reminders are a separate capability. In-app read state must not mean that an email/SMS was delivered or alter existing communication preferences. |

The working tree contains concurrent message/privacy/navigation and translation
changes. Preserve those edits and historical verification artifacts.

## Message behavior and read state

Updated by the user's 5 November badge bug report: the header combines the user's
own customer conversations with authorized provider conversations/activity in the
selected personal/company workspace, independently of the current route. Label
the scope in the panel. Navigation does not change the count; changing the selected
workspace changes only its provider portion. Do not include other provider workspaces
or change workspace from a link. Feed rows link to explicit authorized conversation
scopes. Global unread counts deduplicate messages and honor the same user's read
receipt from either role; explicit customer/provider projections remain scoped.

Track read progress per authenticated user, booking and viewing context. One team
member reading a conversation must not clear another member's unread messages.
Exclude the reader's own messages. Customer messages count for authorized provider
readers; provider/team replies count for the customer and other authorized readers.
The initial reservation message is included. Group broadcasts remain private
per-booking messages and never expose other recipients or shared broadcast IDs.

Mark incoming messages read only after the authorized conversation content has
loaded and the relevant messages have been displayed in the active conversation.
Use a server-validated, monotonic progress marker bounded to delivered message IDs;
the DB/Backend owners must design it to handle concurrent inserts and transaction
ordering. Never let a stale tab move it backward or clear a newly arrived message
that was not displayed. Unloaded older pages remain unread unless the user explicitly
chooses “Mark conversation read”. Persist state across devices. This is internal
unread tracking; do not add sender-facing “seen” receipts.

Read acknowledgments must be permitted for otherwise authorized read-only viewers
without granting message-send or booking-edit rights. Failed acknowledgments retain
unread state and offer retry. Existing message retention remains unchanged: 12 calendar
months after the later closure/last-message time, with unresolved bookings retained.
Associated read metadata must be cleaned up with its conversation, without copying
message bodies or extending history retention.

## Notification types and counting

| Type | Proposed text | Link and counting rule |
| --- | --- | --- |
| Incoming message | Message panel only | Avoid duplicating each message in the bell. |
| Booking activity | Booking request, accepted/cancelled booking, reschedule request/response | Authorized booking detail; one item per committed event and recipient. Preserve existing booking permissions and independent group responses. |
| Service views | “Your Yoga class received 9 views yesterday” | User-selected view count, grouped per service/day, excluding provider/team views. Provider service context with the reporting period visible; counts view events rather than distinct users. |
| Wishlist additions | “5 users added your Massage to their wishlist yesterday” | Provider service context; distinct eligible customer additions per service/day. A save/unsave toggle must not inflate the count. Identify no individual savers. |

User selection, 4 November 2026: **“Your Yoga class received 9 views”**, excluding
provider/team views and grouping daily. This settles the metric and wording; unique
signed-in visitor tracking is not required. Preserve the narrow explicit-details
trigger, rate-limit abuse and suppress duplicate retries. Anonymous traffic remains
approximate; do not imply it is verified people or perfectly unique visitors.
Exclude identifiable provider/team self-views; anonymous activity cannot reliably
be attributed to a team member, so owners must document that measurement limit.

Recommend a separate minimal product-activity pipeline/aggregate instead of treating
the security audit store as a provider analytics API. Backend/DB owners must review
the source contract, idempotency, self-view filtering, bounded processing and day
boundary before implementation. Use the selected UTC reporting day and
show the period; do not infer event semantics from language selection. Only use
historical data if provenance, permissions and selected counting rules support it;
otherwise start collecting on activation and show no fabricated historical totals.

Wishlist scope includes save/unsave controls, the account-owned Wishlist destination,
idempotent membership keyed by user/service and server authorization. Approved
v1: every signed-in user across roles; one qualifying addition per user/service/day;
no anonymous wishlist, saver identities, ranking or recommendation algorithm.
The notification describes additions during the period, not current wishlist size.

Notifications have per-recipient read state. Opening an item marks that item read;
offer “Mark all read” bounded to the current fetched/snapshot set, so a concurrent
new item stays unread. Deduplicate event delivery. A deleted/inaccessible target
shows a safe unavailable state and no leaked private title/preview. Recheck current
permissions for lists, counts, read mutations and link destinations.

## Contracts and implementation sequence

Proposed contract families, with final naming agreed by Frontend/Backend/DB:

- A lightweight scoped header summary returning unread message and notification
  counts, with independent availability/error status for each capability.
- Paginated conversation summaries and notification items; cursor ordering must
  remain stable when new activity arrives. Query the server for totals rather than
  summing a loaded page or downloading all messages into the header.
- Authorized conversation read acknowledgments and notification read mutations,
  plus a snapshot-bounded mark-all action. Keep GET requests free of read writes.
- Typed internal targets containing booking/service IDs and scope; generate
  allowlisted app links locally. No arbitrary external URLs, message bodies or
  sensitive details in URL parameters. Support refresh/direct navigation to a
  specific authorized conversation, including past bookings.

1. **Contract and product choices:** settle metrics and new-data lifetimes below;
   assign Frontend, Backend and DB owners and record scoped acceptance. They agree
   shared DTOs, read semantics, target navigation and capability behavior before edits.
2. **Unread messages:** DB adds durable reader progress/indexes with reviewed
   migration/runtime readiness; Backend adds scoped enumeration/count/read APIs;
   Frontend adds both header controls, the message list and conversation navigation.
   The bell must show an honest empty/unavailable state until real items exist.
3. **Booking notifications:** add transaction-safe event production and per-user
   inbox state, without making existing email/SMS claims. Include read controls and
   notification history navigation. Existing delivery flags cannot silently disable
   a working message inbox.
4. **Views and wishlist:** implement approved product aggregates and the wishlist
   dependency; add daily grouped items and provider destination details. These are
   required for the full requested result, even if messages ship first.
5. **Integration and verification:** check the full contracts, migration ordering,
   permissions, empty/error cases and responsive header against preserved message,
   privacy, account-menu, search and mobile-navigation behavior. Document evidence.

Use existing React/TanStack Query/UI/i18next patterns. Start with a lightweight
30-second summary refresh while visible, refresh on focus and after message/read
actions, and pause in background/offline. No WebSocket or push service is needed
for the first version. Scope caches by user, role and workspace; clear/abort private
requests on logout/scope changes. Never display a previous user's count or list.

## Decisions and execution limits

Recorded selection and remaining recommendations before collecting new data:

- **View metric — selected:** view events, excluding provider/team views and grouped
  daily. User confirmed the recommended “Your Yoga class received 9 views” option
  on 4 November 2026. This selection does not authorize connected collection.
- **New-data lifecycle — selected:** 90 days for in-app notification history and
  service/day aggregates; keep minimal deduplication data only as long as needed
  for that reporting window. Wishlist membership lasts until unsaved/account or
  service deletion. Reader state follows existing conversation deletion. These
  are user-selected lifetimes, not an extension of audit or message retention policy.
- **Feature scope — approved:** one wishlist for every signed-in account, guest
  sign-in/manual save, retained unpublished entries, daily view/wishlist bell items
  and real message unread state. New booking-status bell producers remain future work.

The user's explicit implementation instruction authorizes owner-accepted reversible
local work and offline/mocked checks. Exact-target DB/service execution, private
configuration changes, deployment and publishing retain their separate holds.
Do not reuse another task's executor-specific database approvals for this feature.

## Acceptance and verification

- Two labeled, keyboard/touch-accessible icons beside the language picker; red
  badges at positive counts only; zero/1/plurals/99+ and narrow header layouts work.
  Focus enters/closes/restores correctly, Escape works and list links are operable.
- Counts and links work for customer, personal provider and company contexts,
  including past bookings, read-only members, revoked access and deleted targets.
  Concurrent read/new-message activity and multiple readers/devices do not lose
  unread messages. Broadcast privacy and initial-message behavior remain intact.
- Notifications aggregate the selected metric correctly, exclude self-activity as
  specified, deduplicate retries/toggles and show the reporting period. No item is
  manufactured when tracking is disabled or data is unavailable.
- Preserve drafts and dirty-editor navigation guards when opening panels/following
  links. Render user text safely and test logout/scope cache isolation and stale
  responses. Do not log message text or expose saver/visitor identities.
- Owners run meaningful offline API/read-state/aggregation/schema tests plus
  mocked Chrome/Firefox/WebKit checks, keyboard, contrast, narrow/short viewports
  and zoom. Restrict **all fresh locale validation and browser matrices to en/lv/ru**.
  Maintain supported translations; **ar/RTL, zh, fr, de, hi, ja, pt, es testing is
  deferred**. Inspect runners/imports before invoking them.
- Run appropriate type/build checks without app startup or private env loading.
  Separate offline proof, connected migration/readiness, live workflow evidence
  and deployment. Required unavailable/failed checks keep implementation incomplete.

Initial planning validation used repository inspection and documentation checks
only. Subsequent approved implementation and passing offline/mocked verification
are recorded in [the integrated handoff](wishlist-handoff.md); connected activation
remains unperformed.
Recovery for future implementation: disable new producers/UI capabilities first,
preserve conversations and additive stored data, revert only attributable local
changes, and use the DB owner's reviewed recovery plan for any later migration.
