# Group appointments — frontend implementation handoff

2 November 2026. User approved implementation after reviewing
[v2](group-appointments-design-v2.md) and [v3](group-appointments-design-v3.md).
Assigned owner/executor: `/root/appointments_frontend`, Front End Developer.
Requester/integrator: `/root`. Accepted local frontend scope: application UI,
translations, isolated fixtures, browser/component checks and frontend builds.
No connected application, session/database writes, real messages or deployment.

## Implementation

- Provider agenda groups by the shared backend session identity: workspace,
  provider, service, employee, exact instant and saved duration/cleanup. Individual
  appointments retain their own rows. Group events start collapsed; the tinted
  header remains distinct from customer rows. Booking count, occupied/confirmed
  places and pending places are separate. Filtering matches events while keeping
  their full booking context and totals on expansion.
- Notes have independent Show notes / Hide notes disclosures and safe multiline
  text. No-note bookings have no empty note section. Message history is opened on
  demand; it never expands every conversation at once.
- Event-level Mark complete has a scope review and includes confirmed bookings
  only. Event actions offer reschedule, cancellation and private PRO messaging.
  Customer More actions contains individual reschedule/cancel/message, with
  Approve and eligible Send reminder remaining visible. Provider individual
  cancellation is confirmed before its mutation.
- Both customer and provider pages open retained private booking conversations,
  with explicit counterpart name/role and booking reference in the header,
  sender/timestamp/save state, older-page loading, a single multiline textbox,
  empty/loading/error states and explicit retry. There is no Message type selector.
  PRO broadcasts review the recipient list before saving separate private messages.
  The UI does not claim external delivery or read receipts.
- Rescheduling now creates consent requests in both directions. The requester sees
  current/proposed times and selects keep-original or cancel-on-decline. The
  recipient sees both consequences, with a second confirmation before a decline
  cancels a booking. Silence keeps the original. Proposed-time availability errors
  leave the booking unchanged, clear the selected slot and refresh availability.
  Individual outcomes and provider-only batch outcomes remain available after
  responses; group customers decide independently.
- The selected 12-month retained-history policy is explained in the conversation.
  Backend/DB own persistence, authorization and deletion; see their handoffs.

Primary files: `appointment-agenda.tsx`, `provider/booking-controls.tsx`,
`booking-collaboration.tsx`, provider `appointments.tsx` / `reschedule-dialog.tsx`,
`my-bookings.tsx`, `customer-booking-change.tsx` and `use-provider-workspace.ts`.
Provider bookings and collaboration query keys include the current user/workspace/
permissions/membership scope. On account/workspace/permission changes dialogs and
private data scopes unmount, old requests cancel through consumed AbortSignals,
and prior scoped booking data is not shown in the next role.

## Cooperation and delegated files

Backend `/root/appointments_backend` supplied the canonical shared contract and
secure routes; DB `/root/appointments_db` owns ORM/migrations. Frontend uses
`shared/appointment-collaboration.ts` DTOs and `appointmentEventKey` directly.

Frontend explicitly delegated these accepted frontend dependencies to `/root`:
non-English `appointmentCollaboration` translations; existing notification/
reminder fixtures and browser regressions; and the existing customer-bookings
component/browser fixtures and regressions. Root accepted these in live messages.
The frontend owner retains all other application/new fixture/test scope.

## Verification

The new `scripts/test-appointment-collaboration-browser.mjs` exercises the real
provider and customer UI with in-memory fetch boundaries, rejects unexpected
requests and uses a deterministic clock. It covers en/lv/ru at 1280/768/375/320px,
separate resources/events, disclosure/full-context filtering, independent notes,
Unicode/HTML-shaped plain text, localized participant labels, bidirectional
messages, older-page ordering, save failures/exact retry versus edited intent,
PRO recipient review/free-plan restriction, denied-history and denied-roster
suppression, focus restoration, consent request creation in both directions,
both decline outcomes/second confirmation/approval/no-response, whole-event
requests, confirmed-only completion, cancellation scope and permission changes.

New-suite browser versions: Chrome 156.0.8078.79, Firefox 157.0, WebKit 27.2.
All three passed the final full scenario suite, including the permission-scoped
provider-booking cache, denied recipient/history suppression, pagination,
customer/provider initiation and explicit counterpart/booking-reference header.
Final full application typecheck and Vite build also passed. The existing notes
Chrome regression was rerun and passed after the scoped-cache change; root owns
the matching final Firefox/WebKit recheck in the integrated record.

Passed local commands:

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.appointment-collaboration.json`.
- `node node_modules/vite/bin/vite.js build` (existing stale Browserslist-data and
  large-chunk warnings; no new dependency or tooling download).
- `node --import tsx scripts/test-booking-completion.mjs`: provider completion,
  save failure/retry, disabled menu controls, permissions, cache and revenue.
- `node scripts/test-provider-booking-notes-browser.mjs` in Chrome; root also
  reports Firefox/WebKit passes. The prior meaningful assertions now first open
  the relevant event and notes disclosure instead of assuming always-visible notes.
- Root reports existing notification/reminder pure/browser regressions passing
  across Chrome/Firefox/WebKit and the delegated customer regressions; see root's
  integrated record for final commands and any remaining check.

Browser processes could not start inside the Windows sandbox (Chrome crashpad,
Firefox registry/process startup). Reviewed exact isolated test commands ran via
`require_escalated`; no test connected to the app or a database. Installed Firefox/
WebKit tooling used `FORMS_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH` from the
existing test tooling directory; it was not installed/downloaded for this task.

Synthetic visual artifacts:
[phone](group-appointments-implemented-chrome.png) and
[desktop](group-appointments-implemented-desktop-chrome.png).
The phone view was visually inspected; a wrong participants translation namespace
was found and corrected, and a localized-label regression added. WebKit exposed
pointer-button focus behavior; passing an explicit trigger and focusing it fixed
message-dialog focus restoration.

Maintain all supported translations; only en/lv/ru were tested. ar (including RTL),
zh, fr, de, hi, ja, pt and es remain deferred. Emulation does not prove physical
mobile hardware, native screen-reader support, or WCAG conformance.

## Security and limits

Messages/notes/names render as ordinary React text; markup-shaped input cannot
execute. Recipients never appear in the customer conversation. Denied private
reads/sends suppress retained cached history/recipient lists and disable sending.
Server-side enforcement remains authoritative. Message/request retry IDs are
stable for exact retries and rotate when the failed intent is edited. No content
is copied to browser storage, logs, or a shared customer thread.

An optional dead-branch cleanup in the pre-existing customer cancellation
component was rejected by automatic approval review, which warned it could turn
rescheduling into cancellation. The cleanup was not applied or bypassed. The
existing top-level wrapper explicitly routes `action === "reschedule"` to
`RescheduleRequestDialog`; only cancellation reaches the older component body.
The new browser suite verifies reschedule creates requests, leaves originals
unchanged and never calls the immediate reschedule route. Backend also rejects
that old HTTP mutation with `consent_required`. No requested feature is blocked
by leaving the guarded dead branch in place.

Recovery: remove only this task's UI/hook/namespace/test additions and restore its
specific hunks, preserving pre-existing notification/notes/booking changes and
other dirty work. Do not revert whole files. Backend/database rollback and
connected execution belong to their owners. Next owner: `/root` for integrated
review and the authorized local delivery; migration execution/deployment are
separate from these frontend checks.

At handoff the frontend owner explicitly delegates further necessary local
integration fixes/verification to `/root` within this task's listed client
components/hooks, appointmentCollaboration namespace, related fixtures/runners
and handoff. This delegation does not extend to unrelated frontend work, backend,
database operations, connected execution or deployment. No further frontend
code change is pending from this owner.
