# AWS restricted staging — Backend handoff

31 October 2026. Requester/coordinator: `/root`; assigned Backend owner/executor:
`/root/aws_staging_backend`. Scope accepted under AGENTS standing cooperation for
the user's AWS publishing request, restricted staging selection and subsequent
Lightsail password-protected USD 10/month choice. Existing Supabase development
source/audit targets are retained subject to DB-owner preflight and the recorded
execution scope in [the deployment record](aws-staging-deployment.md).

## Result and ownership

Backend source changes are unnecessary for the reviewed staging contract.
Root owns infrastructure, Docker/build command integration and deployment.
This review did not read private configuration, connect to services/databases,
start the application or a connected worker, claim records, send messages or
publish/deploy anything. Existing dirty files were preserved.

Build the separate audit worker alongside existing application outputs:

```text
esbuild server/audit/run-worker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/audit-worker.js
```

Root may append that command to the existing production build. Runtime command
for its separate container is `node dist/audit-worker.js`; no tsx or dotenv file
is required. The ordinary image's copied dist and production node_modules are
sufficient. The worker's non-core external imports are zod, drizzle-orm and pg;
all are production dependencies. Do not inherit the app's HTTP healthcheck or
expose a worker port. Share the immutable image while keeping process environments
separate.

## Process contract

| Process | Required configuration and limits |
| --- | --- |
| App | NODE_ENV=production, PORT=5000, HTTPS APP_URL, SESSION_SECRET >=32 characters, DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, OPENAI_API_KEY; optional storage/provider/Maps settings deliberately selected |
| App audit capture | Preserve AUDIT_ENABLED and AUDIT_SERVICE_VIEWS_ENABLED as accepted by the deployment/DB owners; AUDIT_ENVIRONMENT=development; AUDIT_CAPTURE_DATABASE_URL uses the restricted capture login; AUDIT_AUTH_EVENTS_ENABLED=false; AUDIT_WORKER_ENABLED=false; no worker/writer URLs |
| Audit worker | NODE_ENV=production, AUDIT_WORKER_ENABLED=true, AUDIT_ENVIRONMENT=development, AUDIT_SOURCE_DATABASE_URL and AUDIT_DATABASE_URL; restricted source-worker and destination-writer logins only; no app/Auth/Maps/OpenAI/staging-password credentials |
| Notifications/billing | NOTIFICATIONS_ENABLED=false, NOTIFICATIONS_AUTOMATION_ENABLED=false, NOTIFICATIONS_VERIFICATION_ENABLED=false; no notification worker or provider secrets. Ordinary app entrypoint leaves local sandbox billing unselected; never use billing:dev for this deployment |

Audit target parsers remain fixed to source hbkooiknruimukkhshrk and destination
ynygqodmtgjrngiudalw, development principals, strict TLS and validated privilege
snapshots. Do not change the audit environment label to staging or substitute
owner logins. A custom sslrootcert URL parameter names a file that must exist
inside the relevant container; the executor/DB owner must reconcile any local
certificate paths before provisioning. Do not weaken TLS to work around a path.

App pool max5 shares the fmt_app_dev role's five-connection ceiling with any
concurrent local/deployment processes. Worker source/destination pools each use
max1 and different principals; capture uses max2 and its own principal. DB owner
accepts the actual global connection budget and whether existing workers/apps
must stop. A single desired node does not prevent deployment overlap.

Worker defaults are batch10, poll1000ms and operation timeout5000ms, with bounded
per-operation deadlines and sanitized health/metrics. Its first loop step claims
records before the first health report. Running it is a connected write/claim
operation, not a read-only readiness probe. Stop/restart and uncertain outcomes
must follow the audit execution/recovery instructions, not blind replay.

## Proxy and smoke contract

Only the infrastructure password proxy is a public Lightsail endpoint. Keep app
port5000 private to the sibling containers; expose only proxy port8080. Protect
all application/static/API routes before forwarding. A provider health route may
return only the proxy's own minimal liveness without forwarding unauthenticated
traffic to an app route. Never put a staging password into URLs or logs.

The app uses trust proxy=1. The immediate proxy must overwrite forwarding headers
using trusted platform facts and remove caller-supplied Forwarded/X-Forwarded-*
values, rather than appending spoofable values. Preserve the managed HTTPS origin
as APP_URL and forward a trusted HTTPS scheme. Strip staging Basic Authorization
before forwarding. Additional proxy paths and any public direct app route need
fresh topology review. Source-IP/rate-limit accuracy depends on the platform's
documented trusted client-address headers; a shared proxy IP is not proof of
correct per-client limiting.

App /health/live performs no DB query; /health/ready performs SELECT 1. Both precede
session middleware and return no private details. Normal session use can
persist/touch/delete rows; connect-pg-simple begins its prune timer on the first
store get/set/destroy/touch and later deletes expired sessions. Static/health
smoke does not authorize logins, booking/preference changes or details clicks
that generate service-view audit events. Schema compatibility remains necessary
even when optional feature flags are false.

## Verification and recovery

Passed offline, 31 October 2026:

- `node --import tsx scripts/test-audit-worker.mjs`: transaction/capture adapters,
  restricted config, leased delivery, duplicate/ack recovery, outages/timeouts,
  quarantine, cancellation and R90 service-view parsing; injected ports only.
  Its two synthetic capture-gap log lines are expected failure-case evidence.
- `node --import tsx scripts/test-audit-worker-loop.mjs`: real daemon cadence,
  attention/recovery, unavailable health, abort and finally-close with fake ports.
- In-memory esbuild using the production flags above: 37,032-byte worker output,
  only expected production external dependencies.
- The resulting JavaScript executed in a child process with an explicit minimal
  environment, worker disabled and credentials absent: exit1, empty stdout and
  only `Audit worker stopped RUNTIME_UNAVAILABLE` on stderr. Refusal occurs before
  opening pg; no application startup, dotenv/private environment or DB operation.

No container/runtime integration, live DB/worker claim, proxy browser test or
cloud deployment is established by these checks. Root owns those scoped gates;
DB owns target/principal/schema/concurrency acceptance. No fresh locale checks
were necessary for this source-unchanged Backend review; en/lv/ru remain the test
scope, with ar/RTL, zh, fr, de, hi, ja, pt and es deferred.

Recovery for this review is removing this handoff only. Revert attributable
future build additions independently from other dirty work. After connected
activation, stopping compute does not undo session/domain/audit writes; preserve
records and reconcile uncertain claims through the existing audit workflow.

## Infrastructure review returned to Root

Reviewed `deploy/aws/staging-proxy.mjs`, its loopback tests, Dockerfile audit-worker
bundle addition and the precise .dockerignore proxy inclusion. The current
proxy's exact GET/HEAD /health/ready exception forwards a fresh cookie-free probe
and emits only sanitized readiness, while other app/static/API routes require
Basic authentication. Its target is fixed localhost, upgrade requests close,
and Basic credentials and caller forwarding headers do not reach the app.
Root's successful loopback test is owner evidence; Backend did not repeat it.

The public-readiness load finding is resolved locally. Backend reviewed Root's
fix: readiness shares one in-flight check, caches only its sanitized HTTP status
for two seconds, and bounds the proxy to 128 connections. The updated loopback
test issues sixteen concurrent requests, asserts a single upstream health call,
then verifies the next request uses the brief cache. Failure after cache expiry
and upstream-error behavior remain covered. Root reports this runner passes;
Backend reviewed source/test changes without repeating the test. This prevents
public probe concurrency from creating an unbounded number of app/DB checks;
it does not establish live platform capacity or eliminate all denial-of-service
risk.

The compiled audit-worker dependency graph has no runtime JSON/SQL manifest
reads. All local imports are bundled; only the optional configured CA file is
read from the filesystem. The Dockerfile's copied dist and installed production
dependencies therefore satisfy packaging once the public CA path is handled.
The DB owner's subsequent successful schema/principal preflight and connection
snapshot are separate execution evidence, not fresh checks by this Backend agent.
Root subsequently reported the image-build path blocked before execution because
the AWS project's CodeBuild compute quotas are zero. No image build or Lightsail
service creation follows from the local Backend acceptance. The quota/possible
Support-case choice belongs to the user and Root's deployment record.
