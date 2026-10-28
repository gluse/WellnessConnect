# Single service-view audit event

## Development result — 25 October 2026

The one-event implementation is complete and enabled in protected development
configuration. Explicit service-details opens in the shared search callback
send one body-free `POST /api/services/:id/view`; the UI opens immediately and
notification failures do not block it. Server-validated available-service
notifications produce `service.viewed.v1`, service target ID, verified user or
anonymous actor, unknown workspace scope, empty changes and R/90-day retention.
No search text, location or service content is recorded.

The DB owner confirmed destination then source 0005 COMMIT/receipts and extended
profiles on the approved development pair. Function identities, ownership,
privileges and setup-owner memberships were preserved. Actual rollback-only
R90, legacy 365-day, expiry and eight invalid-variant checks passed on both
projects; all temporary grants/rows rolled back, with zero new committed synthetic
events. The updated native worker's health was clear with no claims attempted;
its pools closed. Protected `AUDIT_SERVICE_VIEWS_ENABLED=true` readback passed.

Restart the development app to load the flag, and use the updated worker with
`npm run audit:worker`. No application HTTP server or daemon was started by this
work. New delivered events appear in `audit.events`, filtered by
`event_name = 'service.viewed.v1'`; `target_id` is the service ID. This implementation
does not complete the wider TASK-016/017 catalog or activate remote Auth producers.
Frontend checks were isolated/mocked in en/lv/ru; no real-user click/session flow
or fresh committed R90 delivery rehearsal is claimed.

An initial destination syntax error rolled back completely and source was not
attempted. The two unapplied ingestion-window CASE expressions were parenthesized,
the draft pins updated and 65 focused checks passed before fresh old-profile
gates and the successful controlled apply. Applied SQL is now immutable; see the
[DB package and actual results](service-view-database-package.md) for exact hashes,
commands and conservative partial-commit recovery. Earlier preparation states
below are historical. Final approved read-only verification exited 0 and passed
independently on source and destination. No required execution check remains.

User request, 23 October 2026: implement just one event when a user clicks a
found service to view it. This is a narrow exception to the catalog's exclusion
of routine public browsing. The broader TASK-016/017 work remains open.

## Contract and ownership

Accepted Backend contract: `POST /api/services/:id/view`, a positive int32 service
ID in the path, no query or supplied event/identity fields. The existing public
service availability rules are checked server-side. A successful notification
produces `service.viewed.v1`, outcome `succeeded`, target type `service` with its
ID, unknown workspace scope, component `service`, empty changes and selected P1
read retention R/90 days. The event means the server accepted an explicit-details
notification; it does not prove a human saw the screen. Verified identity may be
included; other visitors remain anonymous. No search text, location, descriptions,
tokens, guest tracking ID or claimed identity is captured.

Open the existing details UI immediately and send one best-effort notification
from its explicit click/keyboard activation, including the existing map path.
Rendering, fetching/searching, booking and provider-only clicks do not produce
this event. Capture failures report the existing safe gap signal and do not
prevent a public service view. Reuse same-origin protection and bounded rate
limiting; do not add a retry queue, new service or analytics rollout.

Root coordinates Markdown only. `/root/audit_backend` accepts backend context,
event and HTTP implementation with offline/mocked tests under the user's request
and standing owner authorization. DB and Frontend ownership follow sequentially;
only one implementation agent runs at a time to honor prototype resource limits.
No production deployment or real Auth/business/session test activity is included.

The existing database contract only accepts the eleven staged event names and
365-day B/S events. A new versioned extension on both development projects is
necessary for the service target and approved 90-day read class. Preserve all
applied SQL and existing event behavior. Prepare the concrete migration,
compatibility order, focused validation and recovery before requesting any
missing connected execution approval under
[the database workflow](../ROLE-DB-ANALYST-DEVELOPER.md#advise-offer-options-and-wait-for-the-users-choice).
The prior all-actions approval completed TASK-014 and is not silently expanded
to this new event's connected database changes.

Activation is deliberately separate: `AUDIT_SERVICE_VIEWS_ENABLED` defaults off.
With it unset/false, an available-service notification returns 204 without optional
Auth verification or capture. Only enable it after the database extension is
applied and the updated worker is verified. An older non-watching worker must be
stopped/restarted first, because its old registry would reject the new event.
No other producer is controlled by this flag.

Backend local implementation is complete. Focused service-view, Auth composition,
activation, event/worker regressions and TypeScript passed; see
[Backend's local evidence](service-view-audit-handoff.md).

DB owner `/root/audit_database` accepted local preparation of new 0005 source/
destination scripts and a shared parser extension, R90-aware enqueue/accept and
the two existing class/expiry checks per table. Reuse protected setup/TLS and
explicit old/new profiles; restore exact owner memberships. No new roles, tables,
indexes or rehearsal cohort are needed. Proposed connected checks are rollback-only
new/old event-contract and expiry validation, followed by bounded updated-worker
readiness. This does not claim a new committed R90 delivery rehearsal.

Database local preparation and 63 focused offline checks passed; see the
[concrete SQL, manifest, commands and recovery package](service-view-database-package.md).
Root's final readiness correction is complete: activation opens the updated
native worker runtime, checks health and closes without claiming queued events.
The focused test rejects any claim access. R90 SQL validation remains rollback-only;
the updated worker's R90 processing test uses injected ports and is separate
evidence. No new committed R90 transport rehearsal is claimed.

Frontend owner `/root/service_view_frontend` was assigned the explicit `home.tsx`
details callback, a minimal client helper if useful, and isolated mocked checks.
The approving user requested this event; Root routes the scoped Front End
Developer assignment under standing authorization. Environment: local repository
and isolated mocked frontend fixtures only. No backend/DB/private configuration,
real session/service, consent flow, translation/layout redesign or deployment is
included. Preserve all existing location/search changes; recover by reverting
only this event's callback/helper/test additions. Frontend evidence is returned
separately; only one implementation owner runs at a time. Frontend implementation
is complete: its actual Home/children/transport mocked component checks passed
for en/lv/ru, including exactly one body-free request, immediate modal opening,
network/HTTP failures, map/provider-service callbacks and unrelated-action
exclusions. TypeScript and scoped whitespace checks passed. No actual browser
layout/keyboard synthesis or connected activity was claimed; see
[Frontend's evidence](service-view-frontend-handoff.md).

## Connected execution approval

The user selected **Apply and activate (Recommended)** in the explicit approval
request on 23 October 2026. Executor: assigned DB Analyst `/root/audit_database`.
Targets: development source `hbkooiknruimukkhshrk` and audit destination
`ynygqodmtgjrngiudalw`. Approved operations: the pinned destination-first 0005
extension, source extension, bounded verification, existing protected setup/app/
worker configuration and public CA reads, rollback-only synthetic acceptance,
native worker health without claiming records, and guarded activation of
`AUDIT_SERVICE_VIEWS_ENABLED`. The detailed commands, locks, compatibility,
membership restoration and recovery are the
[prepared DB package](service-view-database-package.md).

Retain existing audit data and SQL. No new background process, production
deployment, real Auth/business/session test write, committed synthetic cohort,
new credentials or ACL change is included. Known development workers must be
absent for the activation window; the helper detects and stops without terminating
them if present. Preserve partial/uncertain commits and reconcile before any
continuation; no automatic retry or destructive recovery.

Current state: all local work/checks passed and connected execution is now
authorized and in progress. The producer stays off until final activation
verification succeeds. Required fresh language checks are en/lv/ru only; all
other locales/RTL remain deferred.
