# My bookings compact actions — 4 November 2026

Completed by `/root` as Front End Developer, assigned and approved by the user's
4 November request for this small local `/my-bookings` design change. Scope:
`client/src/pages/my-bookings.tsx`, reversible frontend edits and focused offline
verification. No connected services, database operations or deployment.

- Hide the visible Appointments heading, retaining its screen-reader semantics
  and existing dialog focus fallback.
- Replace Message provider text with Lucide MessageSquare, first in the action row,
  with the existing translated accessible name and native title.
- Compact Reschedule/Cancel controls into the same row; use pale indigo and red
  styling respectively. Preserve permissions, handlers and request details.
  Text can wrap inside controls on narrow screens without moving the action row.

Verification: `npm run check` passed. A temporary isolated smoke script using the
existing customer-booking fixture/browser harness passed Chrome checks at en
360/1280px and lv/ru 320px (all 900px tall): heading hidden, message first/labeled,
single row, controls inside card, text/page reflow and minimum 24px targets.
English checks opened/dismissed each of the three dialogs and verified focus
restoration. All API responses were synthetic and intercepted in memory; no
mutation requests, unexpected fetches, external traffic or browser errors occurred.
Chrome initially failed to launch under the sandbox; the same check passed with
approved execution outside the sandbox.

Visually inspected [English phone capture](my-bookings-compact-actions-chrome.png).
No new security findings in this presentation-only change. Broader regression,
physical-device and screen-reader tests were omitted per the requested small
scope. ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred.

Recovery: revert only this task's page edits and new handoff/capture, preserving
all unrelated existing work. No further local work remains for this request.
