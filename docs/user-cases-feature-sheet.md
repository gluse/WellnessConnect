# FitsMyTime user cases and feature sheet

Prepared **25 October 2026**, Europe/Riga. Owner: **Product Manager**.
Status: **product proposals for review**, not implementation assignments.

Purpose: help providers offer services in the way they actually work, while
giving customers a clear, dependable path from discovery to attendance.
The first six proposals develop the user's examples; the remaining proposals
address related booking and repeat-use needs.

## Product recommendation

Start with **service audience controls and private-calendar requests**, including
approval and alternative-time proposals. These let an existing provider serve
selected customers without publishing their schedule. Then add **shared group
sessions and session announcements**, and **online service delivery**. Improve
booking notifications alongside the first workflow so requests do not sit unseen.

These priorities are hypotheses based on the user's request and repository
inspection. No customer interviews, usage analysis, live service access, or market
study was performed. The target provider segment still needs discovery. The
[monthly subscription brief](monthly-subscription-brief.md) records Latvia as the
initial launch market; that choice comes from the brief, not the user's timezone.

## What the app already provides

This is source evidence inspected on 25 October, not a fresh deployment or runtime
verification. Existing fields alone do not prove a complete customer workflow.

| Source evidence | Implication for this sheet |
| --- | --- |
| [Service and booking definitions](../shared/schema.ts) and [service booking controls](../client/src/components/provider/service-booking-fields.tsx) | One-to-one/group types, capacity, participant counts, instant booking and pending booking status exist. Build on these rather than proposing them as entirely new. No service audience or delivery-mode field was established in these definitions. |
| [Booking form](../client/src/components/booking-modal.tsx) and [time picker](../client/src/components/booking-time-picker.tsx) | Customers currently choose an offered slot. A preferred-time request without seeing availability is a different workflow. |
| [Booking routes](../server/routes.ts), [storage](../server/storage.ts), and [scheduling](../shared/scheduling.ts) | Providers can change booking status and reschedule. A proposal requiring customer acceptance was not established. Overlapping non-cancelled bookings for the same provider/employee resource are rejected, so independent customers joining one group occurrence need explicit shared-session handling. |
| [Public search](../server/publicSearch.ts) | Keyword and semantic discovery exist. Private audience rules must cover both paths, plus direct details, catalogs and availability. |
| [Service location controls](../client/src/components/provider/service-location-fields.tsx) | The editor asks for a saved address. First-class online services need a delivery choice rather than a placeholder physical address. |
| [Payment route](../server/payments.ts) and [monthly subscription brief](monthly-subscription-brief.md) | Appointment payment collection is unavailable. The selected model is monthly workspace subscriptions, with customer browsing and ordinary booking free of platform booking fees. These proposals do not introduce checkout, deposits or commissions. |

## Four independent provider choices

Avoid one ambiguous "private service" switch. Audience, calendar visibility,
confirmation and delivery answer different questions.

| Choice | Proposed options | Meaning |
| --- | --- | --- |
| Who can discover/access the service? | Public; selected customers; later, unlisted | Public appears in discovery. Selected customers requires an explicit account grant. Unlisted would mean anyone with the link can view it and is a separate, less restrictive option, deferred from the first version. |
| What can customers see of the schedule? | Available times; private calendar | Available-times mode shows bookable starts, never other customers' appointment details. Private-calendar mode exposes no availability/busy-time pattern and asks for preferred times instead. |
| How is a booking agreed? | Instant confirmation; provider approval | Instant confirmation requires an offered available slot. Private-calendar mode requires approval. A provider's alternative time requires customer acceptance. |
| How is the service delivered? | In person; online | Independent of audience, confirmation, and group size. A later hybrid occurrence could offer both delivery modes. |

Examples of valid combinations:

| Example | Audience | Calendar | Confirmation | Delivery |
| --- | --- | --- | --- | --- |
| Existing-client coaching | Selected customers | Private | Provider approval | Online |
| Public consultation | Public | Private | Provider approval | In person |
| Open exercise class | Public | Available times | Instant or approval | In person |
| Invitation-only workshop | Selected customers | Available session times | Instant or approval | Online |

Showing only free starts can still reveal schedule patterns. It does not meet the
stronger private-calendar promise. Searching for "available at 15:00" must not
silently reveal that a private-calendar provider is free at that time.

## Feature overview and proposed priority

P1 = first candidate bundle; P2 = next, after validating the relevant need;
P3 = later. Effort is a rough combined engineering/QA planning range in person-days,
not an owner estimate or delivery commitment. Ranges exclude major prerequisite
repairs, legal review, vendor selection and connected rollout; overlapping work
means they must not be summed as a project quote.

| ID | Feature | Main user benefit | Priority / sequence | Effort hypothesis |
| --- | --- | --- | --- | --- |
| UC-01 | Services for selected customers | Offer private services to an approved audience | P1 / first bundle | 8–14 days |
| UC-02 | Public service, private calendar | Request a convenient time without exposing the provider's schedule | P1 / first bundle | 8–14 days |
| UC-03 | Approve or suggest another time | Agree an appointment without calls or silent changes | P1 / first bundle | 6–10 days |
| UC-04 | Shared group sessions | Separate customers reserve places in the same class | P2 / group foundation | 10–18 days |
| UC-05 | Group session announcements | Send one operational update to the relevant attendees | P2 / after UC-04 | 5–9 days |
| UC-06 | Online services | Discover and attend remote sessions | P2 / parallel candidate after first bundle | 7–12 days |
| UC-07 | Booking updates and reminders | Know what is agreed and what action is needed | P1 / first-bundle reliability | 5–9 days |
| UC-08 | Customer cancellation and change requests | Manage an appointment without a phone call | P2 / reuse UC-03 | 5–8 days |
| UC-09 | Cancellation waitlist | Get a suitable place when a session fills up | P3 / after UC-04 and UC-07 | 6–10 days |
| UC-10 | Recurring series | Book a regular activity with less repetition | P3 / after reliable individual sessions | 8–14 days |
| UC-11 | Favorites and rebooking | Return to a trusted provider quickly | P2 / independent small candidate | 3–6 days |
| UC-12 | "Fits my free time" discovery | Find activities that fit a real time window | P2 / after reliable availability | 5–9 days |
| UC-13 | Follow-up after positive feedback | Remember to book the same or a similar service again | P2 / after UC-07 and UC-11 | 4–7 days |

## Detailed use cases

### UC-01 — Services visible only to selected customers

**Story:** As a service provider, I want to make a service available only to
selected customers, so I can offer existing-client, private-group or invitation-only
services without listing them in regular search.

**Example:** A coach offers a follow-up session to five existing customers. A
publicly forwarded link does not let a sixth person view or book it.

**Smallest useful scope:** Per-service public/selected-customer setting, an explicit
list of allowed customer accounts, and grant/revoke controls. Start with individual
accounts; reusable audience groups and bulk imports can follow. Do not expose a
global customer directory to providers. Invitation delivery is separate from the
access grant and must use an approved account/invitation flow.

**Acceptance criteria:**

- An unauthorized customer or guest cannot discover the service through regular
  search, semantic results, maps, provider catalogs, storefronts, recommendations,
  reviews or shared-link previews, or retrieve it through a direct service ID.
- Authorization also covers booking, availability, service media and other
  derived content; hiding a card alone is insufficient. Private service content
  must not be submitted to external embedding/indexing services in this MVP.
- A selected customer can view and request/book the service after signing in.
  A forwarded URL grants no additional access. Denials do not disclose the audience.
- Revoking access prevents new reads/requests/bookings. Proposed policy: keep the
  customer's existing booking confirmation/history accessible, with no automatic
  cancellation; a provider handles cancellation explicitly. This policy needs selection.
- Changing public to selected explains that previously public information may
  already have been copied. Future app responses and controlled caches enforce
  the new setting; the app makes no retroactive secrecy promise.
- Public reviews and provider summaries must not reveal restricted service names
  or participation. The exact historical-review policy needs selection.

**Value hypothesis:** Providers can move existing-client bookings into the app,
increasing repeat use. **Owners/dependencies:** Frontend controls, Backend access
checks and all read paths, DB audience relationships, review/media policy, and
CI/CD review of any search/cache integration. This is an access-control feature,
not just a filter.

### UC-02 — Public service with a private calendar

**Story:** As a provider, I want everyone to find my service while keeping my
calendar private, so customers can request a time without seeing when I am busy.

**Customer story:** As a customer, I want to suggest convenient times and know
when to expect a reply, so I can arrange a service even without a published schedule.

**Example:** A consultant is publicly listed. A customer requests Tuesday afternoon
or Thursday morning; the consultant approves a time or offers another.

**Smallest useful scope:** A private-calendar option replaces the slot picker with
up to three preferred starts or time windows, an explicit timezone and an optional
short note. It displays "Request a time" and an expected response period.

**Acceptance criteria:**

- The service remains discoverable by non-availability criteria, subject to UC-01.
  It appears in a clearly marked request-only section when a user wants to include
  such results; it is excluded from a strict "confirmed available now" filter.
- No month/slot/busy-time responses, live remaining-capacity clues or error messages
  reveal the private calendar. Providers may state general request preferences,
  but only as an explicit separate choice, not a leaked schedule.
- A valid future preference becomes a request without testing it against public
  free/busy data. The response does not say whether another booking caused a clash.
- A request is clearly pending, reserves no capacity by itself, and has a visible
  reply-by/expiry time. Customers can withdraw it. Duplicate submissions and
  repeated requests are controlled without blocking genuine retries.
- Private-calendar mode requires approval; incompatible instant booking cannot
  remain enabled. Internal conflict checks still apply when a time is agreed.

**Value hypothesis:** Providers reluctant to publish schedules can still accept
marketplace demand. **Owners/dependencies:** Frontend request flow, Backend request
and discovery rules, DB request lifecycle, UC-03 and UC-07. The proposed first pilot
reply period is 24 hours; owners must select an expiry policy before delivery.

### UC-03 — Approval and alternative-time proposals

**Story:** As a provider, I want to approve a request or propose another time,
so I can turn an unsuitable request into an agreed appointment.

**Customer story:** As a customer, I want to accept or decline an alternative,
so my appointment is changed only when I agree.

**Smallest useful scope:** Accept an exact requested start, decline with an optional
short reason, or propose one alternative. Customer accepts, declines or withdraws;
unbounded chat negotiation is outside this version.

**Acceptance criteria:**

- Proposed lifecycle: requested → confirmed, declined, withdrawn, expired, or
  alternative proposed. An alternative returns to confirmed only after customer
  acceptance; its own expiry is visible. These are proposed product states, not
  a claim that the current booking enum supports them.
- Before provider approval or customer acceptance, the app checks current access,
  service status, schedule conflicts and seats together. Retrying cannot create
  multiple bookings or overbook an employee/session.
- Recommended first-version policy: an unaccepted alternative holds no capacity.
  Customers see that it is subject to availability; an unavailable offer returns
  a neutral recovery message and lets the provider suggest a replacement.
- For an existing confirmed appointment, the original booking remains reserved
  until a replacement is accepted and secured together. Declining or expiry keeps
  the original appointment. No silent move, cancellation or duplicate reservation.
- Both sides see the exact date, timezone, duration, participant count, current
  price and any changed terms before agreement. A material change requires acceptance.

**Value hypothesis:** More requests become completed bookings with less manual
coordination. **Owners/dependencies:** Frontend customer/provider actions, Backend
state transitions, DB integrity and snapshots, UC-07. Reuse existing rescheduling
checks; the existing direct provider reschedule is not an acceptance workflow.

### UC-04 — Shared group sessions and places

**Story:** As a group-service provider, I want separate customers to book places
in one scheduled session, so I can fill a class without creating conflicting appointments.

**Example:** A ten-person class accepts three separate bookings for 2, 1 and 3
places, leaving four places. It is one occurrence, not three employee appointments.

**Smallest useful scope:** A dated occurrence with a start, duration, assigned
resource, delivery mode, capacity and attendee bookings. Start with one-off sessions
and a lead booker per reservation; no separate account is required for every companion.

**Acceptance criteria:**

- Bookings for the same occurrence share its capacity; different overlapping
  occurrences or one-to-one services still respect employee/resource conflicts.
- Confirmed seats and any explicitly defined holds never exceed capacity,
  including simultaneous final-place bookings, approvals and retries. Recommended
  pilot rule: pending approval requests do not reserve seats and clearly say so.
- Customers select a positive number of places within current limits. Price per
  participant and total are explicit and checked again before confirmation.
- Cancellation returns seats once; full sessions cannot accept a further confirmed
  booking. Lowering capacity below reserved places is blocked until resolved.
- Public attendance does not expose attendee identities. A lead booker receives
  communications for companions in the first version.

**Value hypothesis:** Providers fill classes through independent bookings.
**Owners/dependencies:** DB session/capacity design, Backend reservation rules,
Frontend session/seat controls. This is a prerequisite for accurate UC-05 and UC-09,
not a claim that the existing group flag supplies shared capacity.

### UC-05 — Group announcements tied to a session

**Story:** As a provider, I want to send one message to everyone booked into a
session, so they receive the same preparation instructions or change notice.

**Example:** A class instructor tells attendees to bring a mat, or explains a
venue change. Each attendee receives the update without seeing other recipients.

**Smallest useful scope:** Provider-to-attendee announcements for one occurrence,
stored in booking/session updates, with notification delivery through UC-07.
Start with operational broadcasts rather than an open group chat.

**Acceptance criteria:**

- The provider previews the occurrence, recipient count and message. Default
  recipients are current confirmed lead bookers, deduplicated by account.
  Cancelled customers and pending requests are excluded from ordinary announcements.
- Recipients cannot see another attendee's identity, email, phone number or reply.
  Any enabled reply goes privately to the provider. Joining a class is not consent
  to marketing or an attendee-visible conversation.
- New confirmed attendees can see relevant retained preparation updates. Removed
  attendees lose future session access but retain their own booking/cancellation
  receipts. Exact message retention remains a policy decision.
- Delivery distinguishes queued, delivered, failed and read only where supported;
  unsupported channels must not imply a read receipt. Retry does not duplicate messages.
- A message saying "time changed" does not itself change an appointment. Schedule
  changes use the agreed UC-03 process or explicit cancellation handling.
- Abuse reporting, sender authorization and reasonable sending limits are required.

**Value hypothesis:** Less repetitive administration and fewer unprepared arrivals.
**Owners/dependencies:** UC-04 membership and UC-07 delivery, Frontend composer,
Backend audience/send controls, DB messages/retention. SMS, attachments, marketing
campaigns and attendee group chat are deferred.

### UC-06 — Online services

**Story:** As a provider, I want to offer online appointments and classes, so I
can serve customers who cannot travel to my location.

**Customer story:** As a customer, I want to find online services and receive clear
joining instructions, so I can attend from a suitable place.

**Smallest useful scope:** Per-service in-person/online delivery choice, an online
search filter, timezone-aware booking and provider-supplied meeting details protected
at booking/session level. Reuse an external meeting tool; do not build video calling.

**Acceptance criteria:**

- An online service requires no public street address or map marker. Nearby/radius
  filtering does not silently remove it; online results are clearly separated from
  physical nearby results when both are requested.
- Customers see duration, price, session timezone and their local start time,
  supported spoken language, required equipment and joining instructions.
- Meeting URLs/codes are visible only to the provider's authorized staff and
  confirmed bookers for the relevant session, never public service text, search
  embeddings, previews, analytics or ordinary notification subjects.
- Links are released at confirmation in the MVP. Cancellation or revocation
  removes future app access. Forwarded external links may still work, so providers
  need clear external host access controls; the app does not promise link revocation
  unless a later integration supports it.
- Confirmations and calendar exports identify online attendance and exact timezone.
  A failed or missing meeting link provides a private contact/recovery action.

**Value hypothesis:** More suitable supply and fewer location barriers.
**Owners/dependencies:** Frontend editor/search/join flow, Backend protected meeting
details, DB delivery fields and access, UC-07; UC-04 for shared online classes.
Automated meeting creation, recording, video hosting and mixed online/in-person
capacity in one occurrence are deferred.

### UC-07 — Clear status, notifications and reminders

**Story:** As a customer or provider, I want updates when a request needs action
and before an agreed session, so I do not miss a response or appointment.

**Smallest useful scope:** In-app booking status plus one selected email channel
for requests, approvals, alternatives, expiry, cancellations and a pre-session reminder.

**Acceptance:** Show pending versus confirmed consistently; notify the party who
must act; suppress obsolete reminders after a change/cancellation; deduplicate
retries; show delivery failure without losing the booking; let users manage optional
reminders separately from essential booking notices. Notifications link to protected
details and omit sensitive service/attendance content from previews by default.
Calendar export reflects the agreed instant/timezone and explains that an exported
file may need replacing after changes; two-way calendar sync is outside scope.

**Value hypothesis:** Faster replies and fewer missed appointments. **Dependencies:**
Email channel selection, delivery operations, content/preferences and retention;
Frontend, Backend, DB and CI/CD owners. Overlaps [PM-05](product-opportunities.md).

### UC-08 — Customer cancellation and rescheduling requests

**Story:** As a customer, I want to cancel or request a new time from my booking,
so I can manage a change without calling the provider.

**Acceptance:** Display the policy agreed at booking; check customer ownership;
show the outcome before submission; process cancellation and seat release once;
retain the original appointment until a replacement is agreed; notify both parties.
Any financial consequence must be explicit and separately supported. This feature
must not claim to take a cancellation payment or issue an automated refund.

**Value hypothesis:** Fewer no-shows and support calls. **Dependencies:** UC-03/07,
provider cancellation-policy selection and, for groups, UC-04; Frontend, Backend
and DB owners. The observed provider reschedule route does not establish customer
self-service. Overlaps PM-05.

### UC-09 — Opt-in waitlist for full sessions

**Story:** As a customer, I want to join a waitlist for a full session, so I can
take a place if someone cancels.

**Acceptance:** Record occurrence and required places; show that joining guarantees
nothing; offer a bounded claim period; never confirm more seats than remain; handle
expiry, duplicate notifications and simultaneous claims; allow withdrawal. Recommend
oldest eligible request first, with a place held for that offer; do not let general
booking consume the same held place. Allocation/hold duration needs selection.
Do not publish queue identities or private-calendar capacity patterns.

**Value hypothesis:** Recover empty places without broad discounts. **Dependencies:**
UC-04/07, Backend holds, DB consistency, Frontend opt-in/claim UI. Overlaps PM-08;
the MVP applies to published group occurrences, not private-calendar availability.

### UC-10 — Recurring sessions and series booking

**Story:** As a customer, I want to reserve a regular class for several weeks,
so I do not repeat the same booking each time.

**Acceptance:** Preview every occurrence, exception, timezone, place count and total;
show conflicts before agreement; confirm which dates actually succeeded; distinguish
"this session" from "remaining sessions" when changing/cancelling; preserve already
agreed terms and capacity per occurrence. No silent automatic renewal or recurring
appointment charge. Start with a finite series; subscriptions/passes are separate.

**Value hypothesis:** Repeat attendance with less administration. **Dependencies:**
UC-04, UC-07/08 and a selected all-or-partial booking policy; Frontend, Backend
and DB owners. Existing recurring working hours are not a customer series booking.

### UC-11 — Favorites and one-action rebooking

**Story:** As a customer, I want to save providers and rebook a past service,
so I can return to a good experience quickly.

**Acceptance:** Keep favorites private; recheck audience permission, service status,
current terms, price and availability; prefill only appropriate service context;
never reuse old private notes or meeting links automatically. Rebooking starts a
new agreement and never silently confirms or charges it. Removed or restricted
services have a clear unavailable state without leaking new private information.

**Value hypothesis:** More repeat completed bookings. **Dependencies:** Frontend,
Backend and DB owners; UC-01 authorization. Rebooking extends PM-06; it is not a
new parallel delivery task.

### UC-12 — Discovery that fits an available time window

**Story:** As a customer, I want to enter when I am free and how much time I have,
so I only compare activities I could reasonably attend.

**Example:** "Thursday, 17:00–19:00, including 20 minutes each way" finds sessions
whose attendance and chosen travel allowance fit the window.

**Acceptance:** Distinguish an exact free window from a maximum service duration;
fit the full appointment inside it; respect requested places, delivery type and
customer-selected travel allowance; show the actual offered start and timezone.
For online services, no travel allowance is required. Private-calendar listings
may appear separately as "time requires approval" and never as a guaranteed match.
Start with deterministic filtering and explicit travel estimates; routing and
recommendation automation need independent evidence and cost review.

**Value hypothesis:** Faster selection and better search-to-booking conversion.
**Dependencies:** Trusted availability, UC-01/02 privacy rules and UC-04 capacity
where relevant; Frontend and Backend owners, DB owner for any query/storage work.
Extends PM-03 and the existing quick-find idea in [TASKS](../TASKS.md).

### UC-13 — Rebooking invitation after positive feedback

**Story:** As a customer who enjoyed a service, I want the app to ask about a
month after my positive feedback whether I would like to book the same or a
similar service, so I can repeat a good experience without remembering to search.

**Example:** A customer rates a completed massage five stars. About a month later,
the app asks whether they would like another session, with options to rebook the
same service, browse similar services, be reminded later or dismiss the suggestion.
This is a behavioral timing suggestion, not advice about how often to use a service.

**Smallest useful scope:** One optional follow-up, initially 30 days after positive
feedback on a completed booking. Proposed positive threshold: four or five stars
on the existing five-star review scale. Start with the same service and a small
set of accessible services in the same category, using explicit service attributes
and customer-selected filters. Do not infer health needs from review text.

**Acceptance criteria:**

- Only the booking customer's own positive review qualifies; a provider's rating,
  another customer's feedback or a high service average does not trigger it.
  Rating a service positively does not itself opt the customer into reminders.
- Offer a separate follow-up preference and a visible proposed date. Default
  timing is 30 days after feedback; the customer can change it, snooze, dismiss
  or disable these suggestions without changing their review or booking notices.
- At delivery, recheck the review and completion status, preferences and service
  access. Cancel the follow-up if feedback was removed or lowered below the
  threshold, or the customer already has a later pending/confirmed booking or
  has completed another booking for that service since the reviewed appointment.
- Send at most one automatic follow-up per qualifying experience, deduplicate
  retries, and cap unsolicited repeats across experiences at one per customer
  per 30 days. An explicit snooze schedules only the date the customer requested.
  Editing a review must not generate additional invitations.
- Lead with the same service when it remains accessible and active. Similar
  suggestions respect audience permissions, delivery/location preferences and
  current terms. If no suitable service remains, suppress the follow-up rather
  than expose a restricted listing or send an empty recommendation.
- Show current price and availability when the customer opens a suggestion;
  private-calendar services offer a time request. Selecting an option starts the
  normal booking flow and never automatically books or charges anything.
- Keep service names, ratings and wellness details out of external notification
  previews by default. Explain the suggestion privately in the app. Optional
  repeat-booking suggestions remain separate from essential booking notifications.

**Value hypothesis:** More satisfied customers return and providers retain repeat
business. **Owners/dependencies:** UC-07 delivery/preferences, UC-11 rebooking and
UC-01 access rules; Frontend reminder controls, Backend eligibility/scheduling and
recommendations, DB reminder lifecycle/deduplication and CI/CD job operations.
Extends PM-06. The threshold, timing and frequency cap are proposed defaults for
selection; new retention rules and notification channels need owner review.

## Proposed validation before committing the roadmap

First use a clickable or paper concept with five providers and eight customers
from the chosen segment. Ask them to configure one public, one selected-customer,
and one private-calendar service, then request and agree a time. Proceed to a
scoped build only if at least four providers correctly distinguish the controls
and at least six customers identify whether they have a confirmed booking.
Treat results as directional; recruit a different segment or revise terminology
if confusion persists. No outreach has been sent or authorized by this sheet.

For an authorized four-week pilot after delivery, collect a two-week comparable
baseline first where possible. Counts and thresholds below are proposed decision
rules, not benchmarks. If minimum samples are not reached, extend observation or
use qualitative follow-up; do not report an uplift from an immature cohort.

| Bundle / proposed accountable owner | Cohort and measure | Directional success / stop rule |
| --- | --- | --- |
| UC-01 / PM with access-control owners | Five opted-in providers; granted accounts reaching a completed booking / accounts granted access, within four weeks | At least three providers use it weekly and report a repeated real need. Any unauthorized read is a stop-and-fix condition, regardless of adoption. Do not log audience identities into product analytics. |
| UC-02/03/07 / PM with booking owners | At least 20 genuine requests to private-calendar services; confirmed requests / submitted requests; median reply time; weekly completed customers | Target at least 50% confirmation and median provider response within 24 hours. Compare completion and support effort with the baseline; below target, fix response/request friction before expanding. |
| UC-04/05 / PM with group-session owners | At least ten occurrences across three providers; confirmed places / offered places, completion, provider minutes spent on repeated messages | Target a 25% reduction in reported repetitive messaging time with at least three providers finding broadcasts useful. No overbooking or attendee identity disclosure is acceptable. Seat fill alone is not completion. |
| UC-06 / PM with online-service owners | At least ten confirmed remote appointments; successful joins / confirmed sessions, completed sessions and join-related support | At least nine successful joins and no exposed meeting secrets; investigate every failed join before more automation. A tiny sample cannot establish reliability statistically. |
| UC-08–12 / PM | Select the largest observed loss: changes/no-shows, full classes, repeat booking friction or unsuitable search results | Define one baseline, denominator and target before selecting the next feature; do not launch all five to explain an unknown bottleneck. |
| UC-13 / PM with retention owners | At least 30 opted-in customers with qualifying feedback; track delivered invitations / eligible invitations, subsequent completed bookings / eligible customers, dismissals and opt-outs. Observe through day 60 after feedback: 30 days to the invitation plus a 30-day outcome window. Compare with a declared comparable baseline or a consented delayed-invitation cohort. | Directional target: at least three customers complete a subsequent booking within 30 days of the invitation and the observed repeat rate exceeds the comparison. Report counts and timing; do not claim causal uplift from a small or unmatched sample. Revise targeting if most dismiss the invitation; pause on unwanted-message complaints or preference failures. |

Primary outcome remains weekly unique customers with a completed booking. Confirm
completion quality through permitted aggregated evidence and optional feedback;
provider-entered status alone can be inaccurate. Track cancellations, unresolved
requests, conflicts, complaints, notification failures and provider administration
time alongside conversion. Separate online/in-person, public/selected audience,
and provider-sourced/marketplace demand without collecting sensitive free text.
New analytics instrumentation needs its own approved owner work; security audit
capture is not automatically product analytics.

## Cost and commercial assumptions

- Use effort ranges for comparison until owners estimate the chosen bundle. At
  the existing planning assumption of EUR 300/person-day, eight person-days is
  EUR 2,400 of labor/opportunity cost, not a supplier quote. Discovery, release,
  maintenance, support, tax and vendor bills must also be budgeted.
- Likely recurring costs are notification delivery, storage, operational retries,
  abuse handling and support. For online services, external meeting tools may add
  provider or platform cost depending on later selection. No vendor, tariff or
  paid account is selected here; obtain current primary-source quotes if selected.
- Retain the selected monthly subscription model. Audience convenience, group
  tools or online delivery could strengthen Pro willingness to pay, but their tier
  placement and price need research. Authorization and privacy protections must
  hold for every tier; a downgrade must never publish a private service/calendar.
- Example only: five additional retained paying workspaces at the existing
  EUR 19 research price would add EUR 95 gross monthly platform revenue before
  deductions. At zero incremental paying workspaces, revenue uplift is EUR 0 and
  support/storage costs still rise. Neither outcome is forecast or measured.
- More filled places increase provider service sales; those sales are not platform
  revenue. Avoid new video infrastructure, SMS-first messaging, marketplace payments
  and complex automation until the simpler workflows show a benefit.

## Decisions and owner handoff

Recommended next selection: **UC-01 + UC-02 + UC-03, supported by UC-07**. If
discovery identifies class administration as the stronger need, select UC-04/05
first instead. Do not make these features prerequisites for the existing monthly
billing task unless the user explicitly changes that scope.

| Decision to select before implementation | Recommendation / tradeoff |
| --- | --- |
| Initial segment and first bundle | Start with providers already coordinating repeat-client appointments; validate the need before building the full sheet. Group providers are an alternative segment with different capacity needs. |
| Meaning of selected audience | Explicit signed-in customer grants, not possession of a link. Choose a controlled invitation/account-matching flow; defer reusable lists and bulk uploads. |
| Revocation and historical content | Preserve existing booking receipts; block new service access; do not cancel silently. Select how past public reviews are handled. |
| Request/proposal expiry and capacity | Pilot 24-hour response/expiry periods with clear deadlines; no hold for unaccepted requests/proposals. Waitlist offers, if selected later, need separate bounded holds. |
| Notifications and retention | In-app truth plus one email channel. Select operational notice content, optional reminder controls, retention and support responsibility before activation. |
| Positive-feedback follow-up | Proposed UC-13 defaults: four/five-star feedback, one invitation 30 days later, separate opt-in and cross-experience frequency cap. Let customers change timing; keep these suggestions separate from booking notices. |
| Online/group expansion | Start with protected external links and one-off group occurrences. Defer video hosting, hybrid capacity, recordings and attendee chat. |
| Plan packaging | No new fee or premium gate selected. Preserve free ordinary customer booking and privacy on every plan/downgrade. |

Product Manager owns problem validation, proposal maintenance and outcome review.
Frontend owns interfaces, content/translations, accessibility and device checks;
Backend owns authorization and booking/message logic; DB owns schema, integrity
and database operations; CI/CD owns delivery infrastructure and release preparation.
Owner review must cover the integrated contract, especially audience enforcement,
private-calendar inference, group concurrency and confidential notification content.

This document authorizes no application implementation, database/service access,
customer contact, spending or deployment. Once a bundle is selected, create linked
TASK entries and route concrete criteria to the responsible owners under standing
cooperation. Owner acceptance can cover routine reversible local dependencies;
material policy selections and uncovered connected operations still need their
specific scope. Existing release holds remain.

Future validation covers **en, lv and ru only**. Arabic/RTL, Chinese, French,
German, Hindi, Japanese, Portuguese and Spanish testing is **deferred**; supported
translations remain maintained. No language/browser/application tests were run for
this documentation-only task. Future checks should include guests, authorized and
revoked customers, cross-workspace access, direct links, search/embedding/media
leaks, concurrent booking, timezone transitions, mobile usability and accessibility.

## Task record

- **Requested:** User assigned Product Manager to prepare useful use cases and a
  feature sheet, including selected-audience services, private calendars with
  approval/alternatives, group messages and online services.
- **Follow-up requested / completed:** Added UC-13 at the user's request: ask
  around one month after positive feedback whether the customer wants to book
  the same or a similar service, with optional timing, suppression and outcome
  criteria. This extends the feature proposal; implementation remains pending.
- **Accepted / completed:** Product Manager `/root` completed repository review
  and this documentation on 25 October 2026. Application proposals remain pending;
  no engineering assignment or delivery completion is implied.
- **Affected files:** This sheet and its index entry in
  [product opportunities](product-opportunities.md). Other worktree changes belong
  to existing work and are preserved.
- **Validation:** Read-only source comparison; documentation/link and whitespace
  checks. No connected execution or fresh runtime feature coverage claimed.
- **Recovery:** Remove only this sheet and its attributable index entry; no data
  or application rollback is required.
- **Next action:** Select the first bundle and resolve its policy choices, then
  obtain owner estimates and create delivery tasks. The proposal is ready for review.
