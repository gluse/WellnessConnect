# One explicit service-details event

Backend owner `/root/audit_backend` accepted the user's 23 October 2026 request
through `/root`, under standing cross-role authorization. This local change adds
one producer/event family. TASK-016/017 and broader read/activity collection stay
open. No frontend, database, private configuration, live Auth, listener or
deployment operation was performed by Backend for this request. DB and Frontend
implementation follows sequentially through Root; this is not live activation.
The authoritative cross-role status and execution boundary is
[Root's service-view execution record](audit-service-view-execution.md).

## Contract for Frontend

Call `POST /api/services/:id/view` once from the explicit service-details callback.
Send only the canonical positive int32 service ID in the URL; send no body (or
`{}`) and no query. Existing same-origin protection and a 60/minute per-IP limiter
apply. Do not attach actor, account/session/token data, query/search/filter text,
coordinates, address, result position, provider fields or service content.

The existing `home.details()` callback is the intended integration point for
result cards, map service selection and an explicit details click in the provider
services dialog. Opening the provider dialog itself, page loads, rendering,
prefetch, ordinary service GETs and Book actions do not produce this event.
Frontend owns that callback change and its behavior tests. Open the existing
details UI immediately; send the notification independently, ignore notification
failure for viewing, and do not automatically retry it.

Responses: 204 for an available service, including disabled capture or failed
capture/optional identity verification; 400 for invalid ID/body/query; 404 for a
missing/inactive service or inactive company; 429 for throttling; safe 503 if the
service availability lookup fails. No audit success is asserted by a 204 alone.

## Server event and trust boundary

The server resolves current availability with existing `getServiceById` and
requires matching ID, active service and active company. Only an existing session
offering identity triggers Auth `getUser`; its user must match the session's
expected ID and have a confirmed current seeker/provider profile. A mismatch,
verification failure or unavailable profile yields an anonymous event, with no
claimed identity retained. Anonymous requests make no Auth call. This optional
verification never refreshes, writes or destroys a session.

| Field | Value |
| --- | --- |
| Event | `service.viewed.v1` |
| Outcome | `succeeded`, meaning an accepted explicit-details notification for an available service |
| Target | `{ "type": "service", "id": "<canonical int32>" }` |
| Scope | `{ "kind": "unknown" }`; no inferred owner/company workspace |
| Actor | Verified current user ID and personal role, or `{ "kind": "anonymous" }` |
| Source | Server application/environment, component `service` |
| Changes | `[]`; no reason code or service/search/location payload |
| Retention | Selected P1 class `R`: 90 days from occurrence, never extended by delivery/retry |
| Correlation | Server-generated request/operation/event UUIDs and occurrence timestamp |

The API can receive forged or repeated notifications. It cannot attest that a
human clicked or actually saw/rendered the modal. Each accepted request attempts
one new event, with no generic browser-audit endpoint or new deduplication system.
`AUDIT_SERVICE_VIEWS_ENABLED` defaults off (unset or `false`). The endpoint still
returns 204 for an available service but performs no optional Auth verification
or capture until this new flag and general capture are enabled. Invalid flag
values fail runtime configuration validation. Existing event producers are
unaffected. Capture failure emits only the existing fixed gap signal and does not reject
public viewing. Other audit contracts retain their existing stricter target,
scope, outcome and retention rules.

## Database compatibility and validation

The currently applied original storage contract supports eleven B/S events with
365-day expiry. It cannot accept the new event/class/target/component or R90
expiry yet. DB must prepare a forward migration and matching source/destination
contract verification; never rewrite applied SQL or relabel the event B/S365.
Root owns any missing execution choice/approval for the fixed development pair.
Required order: keep the new producer flag off; apply/verify the DB forward
extension; stop any earlier worker process and restart the **updated** worker;
verify its bounded R90 delivery/readiness with no old worker remaining; then
enable the protected app flag and frontend callback. The worker command does not
watch source changes: a process started before this update still accepts only
eleven names and could quarantine new service events even after DB upgrade.
Changing the app flag requires restarting/reloading its process configuration.
Do not enable this producer merely because the DB migration succeeded. A disabled
app simply acknowledges the notification. No private file change was made by Backend.

Backend files: `server/serviceViewRoutes.ts`, its composition in `server/routes.ts`,
and `server/audit/{context,events,http}.ts`. Local tests use the actual handler,
event validation and capture sink with synthetic storage/Auth/session boundaries:

- `node --import tsx scripts/test-service-view-audit.mjs`: anonymous/verified
  actor behavior, narrow R90 contract, input and unavailable-service refusal,
  disabled/outage behavior, safe payloads and actual request limiter.
- `node --import tsx scripts/test-audit-auth.mjs`: actual route composition and
  Auth SDK over mocked HTTP, confirmed-profile attribution, mismatching user and
  profile-outage fallback, plus existing Auth/persona/denial regressions.
- `node --experimental-strip-types scripts/test-audit-events.mjs`: existing
  contract regressions, including 105 rejected inputs, and twelve-name registry.
- `node --experimental-strip-types scripts/test-audit-worker.mjs`: existing
  worker regressions plus actual worker parsing/delivery of the new canonical
  R90 service event with injected committed-operation ports.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.

All checks listed above passed after the local implementation.

No SQL, live Auth, private configuration or listener is exercised by these tests.
Locale scope remains en/lv/ru; other locales and RTL remain deferred. Connected
storage/delivery and the explicit callback behavior need DB/Frontend evidence.
