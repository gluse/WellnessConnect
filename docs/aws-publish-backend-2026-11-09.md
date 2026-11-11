# AWS staging publication — Backend review, 9 November 2026

Status: **local Backend compatibility review and focused offline checks passed**.
The review required no runtime fix. A subsequent required full-project TypeScript
gate uncovered two existing native-proof iterator diagnostics; the approved
minimal source compatibility correction and its regression are recorded below.
Connected database acceptance,
runtime configuration delivery, Linux image verification and deployment belong
to the assigned DB owner and Root/CI-CD; they are not claimed by this record.

## Acceptance and authority

Requester: user, “please publish my app in AWS”, 9 November 2026. Root assigned
Back End Developer `/root/aws_publish_backend`, who accepted current-source
production compatibility review and relevant offline/mocked checks under
[AGENTS.md standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope is the current committed source `81b68e5`, ordinary production startup,
current audit/report/gallery/reminder application behavior and worker packaging.
No private dotenv/credentials were read, no real application/worker was started,
and no database, Auth, Storage, provider or AWS request was performed by Backend.
Root owns release integration and the DB owner owns current-target preflight.

The existing password-restricted Lightsail micro/one-node Stockholm target and
named development source/audit pair remain the direction in
[the deployment record](aws-staging-deployment.md). Public-release/privacy,
notification/provider, activity-worker, billing and Auth-capture activation holds
are preserved. This local review does not expand a connected-operation approval.

## Current startup and packaging contract

`node dist/index.js` with production environment serves the compiled React assets
and Express API together. The production import regression imports the real
inert server/Vite helper with Express available and development packages absent;
the actual application graph compiles without static development dependencies.
No application entrypoint is executed by that regression.

The current application performs restricted audit-principal verification and
unconditional currency, workspace-pricing, service-photo and service-reminder
metadata readiness checks before session registration and public listening.
The total metadata contract is now **38 gates**: workspace pricing 32, currency 2,
photos 2 and reminder message 2. The workspace-pricing profile now expects the
completion parser and preserved legacy chain. Earlier 34/36-gate evidence cannot
by itself establish readiness for this full current app.

The DB owner must review the exact current contracts and applied development
receipts, including photo migration 0022 and reminder-message migration 0023.
The [photo DB handoff](service-photos-db-handoff.md) explicitly warns against
starting old application code against the backfilled gallery constraint.
No schema installation, migration or readiness bypass is proposed by Backend.

The Dockerfile must retain its explicit build of `dist/audit-worker.js`; package
`build` emits the app, notification worker and activity worker, but not that audit
worker. Audit needs no additional filesystem manifest; the compiled event registry
is included in its bundle. Production artifact checks must include all four
entrypoints, the frontend index and configured public CA file.

Update the app and audit worker to the reviewed current image together. An old
worker registry may reject a newly introduced event as an invalid contract and
quarantine it. Zero-database maintenance must separate old and new database
consumers; image publication alone does not establish a safe transition.

## Runtime configuration delta

Preserve live application secrets, source/audit targets, strict TLS/CA paths,
HTTPS `APP_URL`, `SESSION_SECRET`, port, provider selection and gateway session
configuration. Never copy unrelated local Stripe/billing dotenv inputs into the
image or staging process. Ordinary production startup does not select the local
billing runtime, instantiate its Stripe client or start its billing jobs.

New keys relevant to deploying the recently implemented Audit feature are:

- `AUDIT_PRODUCER_CONTRACT`
- `AUDIT_READER_DATABASE_URL`
- `AUDIT_READER_USER_IDS`
- `AUDIT_EXPORT_USER_IDS`

The completion marker `completion-0008` enables completion-specific successful
protected-read, response-denial and integration capture when `AUDIT_ENABLED` is
true. It is independent of the remote Auth-events switch. Backend recommends
deploying the approved current completion contract while retaining
`AUDIT_AUTH_EVENTS_ENABLED=false` unless activation is separately authorized.
Leaving the marker absent permits startup but leaves this new coverage dormant;
such a release must not claim those producers are active.

The viewer uses an independently restricted SELECT-only destination principal,
verified TLS and pool maximum 2. It never falls back to an owner/writer credential.
Read and export membership are explicit separate lists; do not infer either from
`APP_ADMIN_USER_IDS` or bootstrap permissions during deployment. Root/DB may reuse
an already authorized explicit configuration selection within its recorded scope.
Without the reader URL/list configuration, the app still starts but the new viewer
is unavailable/denied. The fresh capacity review must include this fifth principal
if the viewer is configured, alongside app/capture/worker/writer.

The service-view report reuses existing explicit **product activity** service-detail
capture and is available only with `PRODUCT_ACTIVITY_ENABLED=true`. This is distinct
from audit capture controlled by `AUDIT_SERVICE_VIEWS_ENABLED`. Its exact unexpired
`product_activity_events` source counts and active workspace Pro authorization are
checked on the server. Retaining the selected activity hold means the report
truthfully remains unavailable. No feature flag should be enabled merely to make
the report appear populated.

## Startup side effects and release limits

App pool maximum remains 5; capture maximum 2; worker source and destination pools
maximum 1 each. The audit worker immediately claims/delivers/acknowledges eligible
shared-development outbox records when started; it is not a read-only probe.

Health routes precede sessions: liveness has no database query and readiness does
`SELECT 1`, without creating a session cookie/row. Ordinary session handling still
has expired-session pruning. The application also schedules bounded booking-message
retention hourly, independently of notification/activity flags: up to 100 eligible
completed/cancelled bookings and 1,000 expired messages per batch under the existing
12-calendar-month rule. It does not run immediately at startup. These existing
writes require the appropriate current release approval; health-only checking does
not make an indefinitely running app read-only.

## Verification

All checks below passed on local Node v24.22.2 with inspected inert/injected
boundaries. Root must verify the actual Linux Node 22 image separately.

- `node scripts/test-production-server-imports.mjs`: real production helper import
  without Vite/plugins; actual application graph uses production static packages.
- `node --import tsx scripts/test-startup-diagnostics.mjs`: 90 safe diagnostics and
  injected metadata cases, including gallery/reminder failure stages.
- `node --import tsx scripts/test-audit-events.mjs`: current registry/canonical
  contract checks, including 105 invalid inputs rejected.
- `node --import tsx scripts/test-audit-worker-loop.mjs`: actual loop with injected
  ports, bounded cadence, failure/recovery, cancellation and finally-close.
- `node --import tsx scripts/test-audit-viewer.mjs`: independent permissions,
  parameterized/bounded queries, cursors, CSV escaping, TLS/role parsing,
  fail-closed synthetic HTTP and recorded exports.
- `node --import tsx scripts/test-audit-reads.mjs`: durable-capture gating,
  JSON/text response isolation, no duplicate capture, role/workspace scope and
  private-body/public-route exclusion.
- `node --experimental-vm-modules --import tsx scripts/test-service-photos-backend.mjs`:
  actual service handlers, gallery normalization, Pro/expiry and transaction locks,
  downgrade/copy and image authorization; strict offline adapters.
- `node --import tsx scripts/test-custom-service-reminder-backend.mjs`: 14 actual
  storage/input/entitlement scenarios with strict in-memory adapters.
- `node --import tsx scripts/test-service-view-report-backend.mjs`: Pro/expiry,
  availability/period/bounds, exact counts, offline SQL/store compilation, actual
  in-process Express routes and audit fail-closed case/trailing-slash aliases.
- In-memory esbuild of app/audit/notification/activity entrypoints: all four
  compile and have only production static packages. Outputs were not executed.

The first sandbox production-import attempt was refused at temporary Express
junction creation (EPERM); the approved outside-sandbox offline run passed.
The first viewer/read attempts could not connect to their synthetic loopback
servers (EACCES); approved outside-sandbox synthetic reruns passed. No database
or external service attempt was involved. No application change was made to
work around either sandbox restriction.

No fresh frontend/browser/locale matrix is claimed here. Applicable testing stays
en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred. No real account
sign-in, OAuth callback, email, payment, live audit query or end-user mutation was
performed by Backend.

## Recovery and next owner

This review added this handoff and the two native-proof loop-input corrections
below. Revert only these attributable changes to undo Backend's local work;
preserve unrelated changes and historical evidence. Root integrates owner
evidence, current image/artifact checks, explicit runtime configuration and DB
preflight before deployment. Do not roll back to the old application image without
DB-owner compatibility review of the applied gallery/reminder/completion contracts.
Stopping workloads does not undo session, audit or retention writes; preserve and
reconcile uncertain outcomes, with no automatic retry or migration/ACL repair.

## Required full-project TypeScript gate follow-up

Root explicitly assigned and Backend accepted the minimal backend correction for
the two existing TypeScript diagnostics in `server/native-proof/service.ts`,
separate from Frontend's three diagnostics in `client/src/native/client.ts`.
The project's compiler target does not allow direct Map iterator loops. Both
native-proof cleanup loops now consume `Array.from` of the existing maps,
retaining the same records, expiration decisions and map deletions. This isolated
synthetic protocol performs no asynchronous work during cleanup; snapshotting
its entries does not change accepted behavior. No native feature, API contract,
security policy, runtime configuration or database code was added or enabled.

`node --import tsx scripts/test-native-auth-proof.mjs` passed all **14 scenario
groups**, including exact expiry boundaries, bounded-memory expired-attempt
cleanup, session expiry/logout, single-use concurrent handoff, verifier/account
binding and actual in-process HTTP rejection boundaries. It uses injected
memory/clock and in-process streams, blocks external fetch, and loads no private
configuration, database, provider or device. Frontend owns the companion client
regression and final full-project TypeScript result; Root integrates that evidence.

Frontend subsequently reports `tsc --incremental false` passes after both owner
fixes; its isolated Vite build also passes with identical frontend output hashes.
The separate full native-client proof retains a reproduced baseline replay-error
expectation mismatch; focused query/user/login behavior passes. This is not
reported as a passing full native-client proof or as real native-device coverage.

Root reported the current AWS service is **DISABLED** with version 8 runtime
commands still referencing the old app/worker image `.1` and gateway `.3`.
Backend does not approve starting those stale database consumers to solve the
disabled-service deployment limitation. A supported database-free transition
requires Root/DB review before any enable/start action. No connected backend
execution occurred in this follow-up.

## Before-delete environment review

Root reported the user's later explicit approval to delete the old disabled
service first and publish a replacement, conditional on checking environment
variables before deletion. Backend accepted an offline source contract review;
Root owns secret-safe local/AWS/checkpoint comparisons. No private configuration,
AWS, database or live endpoint was accessed by Backend in this review.

Required app checks: `NODE_ENV=production`, `PORT=5000`, HTTPS `APP_URL` matching
the actual replacement origin; nonempty restricted `DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`
and `SESSION_SECRET` of at least 32 characters. Preserve exact source target,
restricted role and Linux CA/strict TLS. The OpenAI client is constructed at
import, so its key is required even if no model request is made during acceptance.
Preserve `SUPABASE_STORAGE_BUCKET`, `APP_ADMIN_USER_IDS` and all four explicit
`SUPABASE_GOOGLE_ENABLED`, `SUPABASE_FACEBOOK_ENABLED`, `SUPABASE_APPLE_ENABLED`,
`SUPABASE_MICROSOFT_ENABLED` choices. Bucket omission defaults to `service-images`;
admin-list omission removes support access; provider omission disables that button.
Those defaults must not silently replace a configured capability.

Root's secret-safe comparison reports `APP_ADMIN_USER_IDS` was present but empty
in the old AWS checkpoint. Backend confirms this is a valid optional selection:
`isAppAdmin` defaults absence to the same empty list, grants no global support
access and imposes no startup requirement. Preserve the exact empty value; do not
bootstrap a global administrator. Audit permissions and the Audit navigation/UI
are independent: an explicitly listed reader can open
`/administration?section=audit` even when global-admin access is false; export also
requires its separate explicit list. The original staging deployment validator
accepted an empty admin string, consistent with the checkpoint. This confirmation
uses source/records only; Backend did not inspect that private checkpoint.

App Audit requires `AUDIT_ENABLED=true`, `AUDIT_WORKER_ENABLED=false`,
`AUDIT_ENVIRONMENT=development`, `AUDIT_SERVICE_VIEWS_ENABLED=true` and restricted
`AUDIT_CAPTURE_DATABASE_URL`; retain `AUDIT_AUTH_EVENTS_ENABLED=false` and the
four reviewed new Audit keys/selection above. Worker requires production mode,
`AUDIT_WORKER_ENABLED=true`, development environment and worker-only restricted
`AUDIT_SOURCE_DATABASE_URL`/`AUDIT_DATABASE_URL` with container CA/strict TLS.
Preserve its explicit service-view/Auth flags. The worker does not require the
completion marker, reader/app/Supabase/OpenAI/session secrets or any manifest.
`PGBINARY` must be absent from both audit-enabled environments.

Gateway checks: production mode, HTTPS `STAGING_ORIGIN` equal to app origin,
preserved `STAGING_USERNAME`, 64-hex `STAGING_PASSWORD_SHA256` matching the approved
password and 64-hex `STAGING_SESSION_SECRET` matching the protected existing key.
Never inject raw password. If service replacement changes the host, update both
origins and access handoff before activation, and review the exact Supabase OAuth
callback allowlist; a preserved provider button does not establish successful OAuth.

Preserve `GOOGLE_MAPS_API_KEY` and separate `GOOGLE_GEOCODING_API_KEY` when present.
The former is intentionally returned by `/api/config/maps` for browser loading;
the latter is server-only and preferred by geocoding, which otherwise falls back
to the Maps key. Empty Maps key disables browser Maps, and no available key disables
address lookup. Presence does not verify API enablement, billing or Google key
restrictions. Current browser configuration uses same-origin runtime APIs; no
`VITE_*` build environment is required/referenced. Keep notification and product
activity holds false and their workers absent. Notification transport secrets and
all local `STRIPE_*` credentials/profiles can remain omitted while those features
are held. This review changes no environment setting and claims no live provider
validation.

## Current worker attention classification

Root subsequently reports the replacement image `.4`, deployment 1 is ACTIVE /
RUNNING and the application is listening. Before Root's first application HTTP
request, current-instance worker metrics were all zero (including claimed,
delivered, quarantined, source/destination failures and capture gaps), while source
health reported 234 quarantined, no pending/leased/expired rows and oldest age
about 57,463 seconds. These are Root-reported live observations, not Backend
database inspection.

Offline source review confirms `auditWorkerReport` deliberately marks attention
for any quarantined backlog or oldest age of at least 300 seconds. An instance
with zero claimed and zero quarantined counters cannot have created those 234
quarantines. Runtime deployment activation and current-instance failure counters
must be distinguished from unresolved historical delivery health. Do not report
the overall audit queue as healthy or infer the historical cause from these
counters. DB owns bounded metadata diagnosis; no quarantine replay/reset,
retention change or permission/feature activation is proposed.

For meaningful current-path acceptance without business fixtures, Backend proposes
one ordinary gateway-authorized `GET /api/auth/user` with no application session
cookie or bearer token. The existing no-session path returns application 401 and
captures the actual anonymous `security.action_denied.v1` / `UNAUTHENTICATED`
request. This security event is independent of the held remote Auth producer flag;
the response-denial middleware deduplicates it. `saveUninitialized=false` avoids
creating an application session, and no account/service/booking fixture is needed.
It is still a normal audit write and worker delivery, not a read-only database
probe. Root must use applicable existing staging audit-write scope.

Observe fresh-instance claimed/delivered counters increasing with no new failures,
capture gaps or quarantines; delivered increments only after committed destination
acceptance and successful source acknowledgement. Existing 234-row attention can
remain unchanged. Concurrent traffic limits exact single-request attribution;
bounded timestamp/category metadata correlation belongs to the authorized DB
owner if needed. A failed request/delivery must be preserved and diagnosed, with
no blind retry, real login/POST fixture or automatic quarantine replay. Backend
has not executed this proposed live acceptance request.
