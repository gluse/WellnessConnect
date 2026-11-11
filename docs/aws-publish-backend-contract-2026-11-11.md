# Reusable AWS publishing — Backend contract, 11 November 2026

Status: **current-source Backend review and focused offline checks passed;
hosted release is not accepted by this record**. The user selected two publishing
options, one building on this PC and one in CodeBuild. Root assigned Back End
Developer `/root/publish_backend_contract`, who accepted a repository-only
application/startup/environment review under AGENTS.md standing cooperation.
The backend-practices skill was applied. Root owns infrastructure implementation;
DB owns current-target schema/compatibility/capacity acceptance. This review wrote
only this handoff and performed no private configuration read, application or
worker startup, connected service/database request, migration or deployment.

## Shared release contract

Both builders must produce the same reviewed Linux image contract. Production
commands remain `node dist/index.js`, `node dist/audit-worker.js`, and
`node staging-proxy.mjs` for the app, audit worker, and gateway respectively.
Update app and audit worker together to keep their compiled event registries
aligned. The image also retains notification/activity entrypoints as artifacts,
but those workers must not be started under the existing activation holds.

The root Dockerfile explicitly builds the audit bundle in addition to `npm run
build`. Required artifacts are `dist/index.js`, `dist/audit-worker.js`,
`dist/notification-worker.js`, `dist/activity-worker.js`,
`dist/public/index.html`, `staging-proxy.mjs`, and
`certs/supabase-ca.crt`. Do not run the real entrypoints as a build smoke test.
The existing proxy regression uses a synthetic upstream and can run with
`--network none`; artifact presence/import compilation does not establish DB
readiness or deployment success.

Clone and validate the actual current hosted deployment environment in memory.
Never copy the current local `.env`, Docker database handoffs, local billing
profile, or ambient shell environment into the AWS runtime or Docker build.
The local-development changes add an explicit `AUDIT_RUNTIME_PROFILE=local-docker`
exception for loopback/no-TLS/no-provider behavior. The source **rejects that
profile with `NODE_ENV=production`**; hosted containers must omit that variable.
The profile must not be used to make cloud startup pass. There is no new hosted
environment key needed merely to retain the hosted behavior.

Preserve production mode, app port5000, HTTPS `APP_URL` matching the unchanged
gateway `STAGING_ORIGIN`, the app session secret, all original source/audit URLs,
restricted database principals, and strict TLS/container CA paths. Preserve
Supabase URL/publishable/server keys, storage bucket, explicit admin selection,
all four explicit social-provider choices, Maps/geocoding settings, and the
separate gateway username/password verifier/session signer. Never inject the
raw staging password into containers or expose configuration in arguments,
logs, manifests, Docker layers, public receipts or source archives.

Preserve `AUDIT_ENABLED=true`, app `AUDIT_WORKER_ENABLED=false`, worker
`AUDIT_WORKER_ENABLED=true`, development audit environment, the selected
service-view flags, completion marker, independently restricted reader URL and
reader/export ID selections. Keep worker credentials separate from app/capture/
reader credentials. Preserve `AUDIT_AUTH_EVENTS_ENABLED=false` and the existing
false notification/automation/verification/product-activity holds. Do not copy
`PGBINARY`, local `STRIPE_*`/`BILLING_*` inputs, setup credentials or privilege
changes. No new feature/provider/worker activation is accepted here.

## Current schema and startup dependency

`server/index.ts` performs audit-principal verification and currency,
**current42 customer-service-notification application**, service-photo, and
reminder metadata checks before registering sessions or listening. The
current42 profile composes prior pricing/application requirements and checks the
new customer notice table plus durable `services.deleted_at` invariant. The
unconditional new guard also feeds billing readiness.

The [11 November DB handoff](frontend-followup-database-2026-11-11.md) records new
0024/0025 files as **unapplied to any database**. The
[local execution preparation](frontend-followup-local-migration-2026-11-11.md)
targets only the local application database and explicitly excludes hosted
Supabase/AWS. Local application approval, completion or future evidence cannot
establish hosted target readiness. Fresh exact hosted-target DB-owner schema/
compatibility acceptance is therefore required before deploying this current
source. Do not install migrations, omit the guard, substitute credentials, or
restart stale writers automatically in the publishing scripts.

The [9 November Backend review](aws-publish-backend-2026-11-09.md) remains useful
historical context, but its 38-gate/current41 acceptance cannot accept the new
guard. Its photo/backfill and old-writer recovery cautions remain applicable.
Any rollback image must receive current DB-owner compatibility acceptance;
automatic rollback to an arbitrary previous image is unsafe.

The existing maintenance transition is the appropriate infrastructure pattern
for preventing overlapping old/new database consumers. It must preserve private
configuration and the public restriction contract while running only explicit
DB-free commands. DB-owner current principal/capacity/quiescence acceptance and
the relevant connected execution grant are required before new consumers start.
Consumed dated preflight tokens and their attempt receipts must not be replayed,
renamed or removed. A user-authored authorization receipt/flag is a deliberate
execution guard, not proof that schema/capacity checks occurred.

## Runtime effects and acceptance limits

The application pool has max5 connections. Audit capture and independent reader
pools have max2 each; worker source/destination runtime pools currently have
max1 each, under the established principal caps. The audit daemon immediately
claims/delivers/acknowledges eligible shared-development outbox records: starting
it is a database write path, not a health probe.

Session storage disables table creation and `saveUninitialized`, but installs
normal expired-session pruning. Booking-message retention schedules its first
bounded deletion batch after one hour, independently of held notification and
activity flags (100 candidate closed bookings, up to1000 messages under the
existing 12-calendar-month rule). Ordinary application requests can create
business/session/audit writes. Startup/live verification needs the relevant
current operation authorization; the scripts must not label it read-only.

`/health/live` has no DB query. `/health/ready` precedes sessions, performs
`SELECT 1`, and emits only the sanitized ready/unavailable response with no
session cookie/row. A gateway-authorized unauthenticated `/api/auth/user` request
can record the ordinary security-denial audit event despite held Auth producer
flags; it is not an offline or read-only check. Do not send login/OAuth/email/
business requests merely to validate publication. Preserved social-provider
settings do not establish actual OAuth success.

After a separately authorized deployment, require the **exact candidate** image,
deployment version, ACTIVE/RUNNING/no-pending state and expected runtime
specification. Check sanitized readiness and password/session restrictions;
inspect candidate-timestamp worker evidence for new source/destination failures,
capture gaps and quarantines. Existing234 quarantines are a historical unresolved
warning, not fresh failures or a reason to claim the whole backlog healthy.
Do not replay/reset them. Root owns infrastructure verification and coordinates
Frontend en/lv/ru browser acceptance separately.

## Offline verification and recovery

Current checks passed:

- `node --import tsx scripts/test-startup-diagnostics.mjs`: 98 injected metadata/
  safe-diagnostic checks, with no configuration, DB or provider access.
- `node --import tsx scripts/test-production-server-imports.mjs`: actual inert
  server helper imports with production-only packages; actual app graph compiles
  without executing startup. First sandbox attempt failed creating its temporary
  Express junction with EPERM; the identical inspected offline command passed
  with approved escalation. No application changes worked around the failure.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit0.

These checks ran on local Node24.22.2; Dockerfile Node22 remains a distinct runtime
requiring Linux build verification. No fresh frontend/browser or language matrix
was run by Backend. Acceptance language scope remains en/lv/ru; ar/RTL, zh, fr,
de, hi, ja, pt and es are deferred, with supported translations preserved.

Recovery for this review is removal of this new handoff only. No runtime, source,
schema, private input or historical receipt was changed. Remaining owners/actions:
Root completes/reviews both local scripts and mocks; DB provides current hosted
schema/compatibility/capacity acceptance and target-specific execution preparation;
user supplies only any genuinely missing connected/spending/deployment choice
after that concrete preparation. No live publication is authorized by this review.

## Common publishing implementation review

Root subsequently requested read-only Backend review of the new
`deploy/aws/publish-aws-session.py`, `publish-workflow.mjs`, `publish-image.mjs`
and `publish-cloud-build.mjs`. The reviewed implementation preserves the live
deployment specification in a pipe-only Python process, uses explicit DB-free
maintenance commands, changes only the three container images for the candidate,
and keeps DB execution in a source/baseline-bound DB-owner hook. No private
dotenv file is read by these helpers. The builders compile/type-check and run
the isolated proxy/artifact checks; they do not execute application startup.

Backend reported these concrete findings to Root before integration acceptance:

- Python's initial quiescence timestamp used `datetime.isoformat()` with six
  fractional digits and `+00:00`; the DB receipt parser accepts only explicit
  `Z` UTC instants with at most three fractional digits. This would reject every
  actual capacity receipt after entering maintenance. Emit milliseconds with
  `Z` and test the actual cross-language shape.
- The baseline guard initially omitted several required hosted app/audit keys
  and values. Backend accepted and delegated to Root the local fail-closed
  validation additions for required nonempty hosted app keys, port5000, session
  secret length32+, app audit enabled/development/service views/completion marker,
  worker audit development/service views, and absent `PGBINARY`. This delegation
  permits validation and offline tests only; it does not authorize changing live
  configuration, accessing private inputs or executing a release.
- A recovery selection named `remain-maintenance` does not guarantee that state
  after the candidate becomes ACTIVE and subsequent HTTPS verification fails.
  The candidate may still be active. Root must report the exact failed stage and
  instruct bounded inspection; any DB-free maintenance recovery needs its own
  explicit supported/authorized path. Never resume an old image automatically.
- The built-in HTTPS check proves root password restriction and sanitized
  readiness only. The explicit `browserAcceptancePending` result correctly limits
  the claim, but signed gateway-session behavior and current-candidate worker
  health remain separate live acceptance requirements. Do not call the two HTTP
  checks full application/browser/worker verification.

No connected check or additional Backend source modification occurred during
this review. Root owns corrections and integrated workflow tests. Hosted schema
and owner-hook preparation remain the release dependency described above.

Backend inspected Root's subsequent corrections: the Python quiescence value is
now UTC milliseconds with `Z`; delegated required-runtime/audit checks are
present; both outer and pure DB authorization contracts now select
`stop-and-inspect`; and the local deploy branch builds/type-checks/verifies before
upload. A service-wide exclusive local lock is preserved after failure, alongside
single-use release/capacity receipts. The failure message explicitly prohibits
automatic old-image resume/replay. These changes address the reported Backend
implementation findings. They do not add hosted schema evidence or claim the
separate signed-session/browser/current-worker acceptance checks passed.

The maintenance status guard deliberately requires every older deployment record
to be INACTIVE. A historical FAILED record will therefore cause a conservative
stop rather than a release; do not bypass that contract automatically. Any future
relaxation needs DB/CI agreement on actual no-consumer evidence. No additional
Backend implementation blocker was found in this bounded review; Root still
owns integrated workflow mocks, Python/Node boundary tests and live-operation
preparation. Backend does not claim those tests were run in this review.

## Approved local pipe handoff review

Root later reported the user's explicit approval to hand only the five selected
database URLs and four selected Audit settings to the exact local
`scripts/aws-publish-capacity.mjs` receiver for read-only capacity validation.
Root requested a read-only Backend review of the implemented pipe boundary.
This review itself performs no private read or connected execution; the earlier
review's narrower execution limit still applies to Backend's own actions.

The workflow now restricts the hook to that exact filename, recorded DB owner,
and approved SHA256; it carries the private values only in the Python-to-Node
and Node-to-receiver process pipes. Public context/attempt/result files and
command arguments contain no URL values or Audit membership settings. Python
rechecks the current maintenance service/version/specification fingerprint,
previous-deployment inactivity, no pending deployment and absence of a candidate
before the one-shot private return. Node revalidates authorization after the
drain wait and before fetching that payload, then validates and exclusively
consumes the DB receipt before requesting candidate deployment.

Backend found one concrete asynchronous boundary gap: the hook hash was checked
before the awaited AWS `capacity-input` roundtrip. Root was asked to check the
hook hash and authorization again immediately after the private payload returns
and immediately before passing it to the recipient, so a changed hook during
that roundtrip is rejected without receiving private settings.

The new DB-owned receiver was also read for integration review. Its parser
requires the exact five URL keys/four Audit keys, matches its public context to
stdin, verifies approval/expiry/quiescence and private fingerprints, and accepts
only named source/destination principals with the expected verify-full container
CA URL contract. It replaces the container CA path with a pinned local public CA
and performs only bounded read-only metadata/capacity probes. Its immutable claim
precedes sockets; clients close on errors and safe public receipts contain only
role/capacity/verification metadata. There is no private dotenv load or setup/
migration fallback. DB owns its tests and authorization interpretation; this
read-only review does not claim its tests or connected probes were run by Backend.
