# TASK-032 notification operations setup

Status: **local preparation only; not activated or deployed**.

## Acceptance and operating boundaries

Requester `/root` assigned `/root/notifications_delivery` as CI/CD Developer on
29 October 2026. Accepted scope: reversible local notification runtime configuration,
setup/recovery documentation and offline configuration inspection, under the user's
approved implementation plan and [standing cooperation authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Backend owns application/worker behavior, DB owns schema and runtime grants, and
root owns [TASK-032 integration evidence](notifications-handoff.md). This document
does not authorize reading private configuration, provisioning providers, issuing
credentials, applying SQL/ACLs, sending verification/messages, spending or deployment.

## Prerequisites and rollout order

1. DB owner rehearses and applies the explicit expansion and runtime activation
   migrations to the separately authorized target, then verifies actual privileges
   and behavior. Follow the [DB handoff](notifications-db-handoff.md), including
   PostgreSQL 17/principal preconditions and stop-on-failure instructions. Do not
   use `db:push`. The expanded schema must precede the new app image even when
   notification flags are false: existing service/booking selects include new columns.
2. Build/review the normal application image, which includes
   `dist/notification-worker.js` from `npm run build`. Use the same immutable image
   digest for app and worker. Neither package script runs migrations on startup.
3. Supply server-only settings from [the notification example](../config/notifications.env.example)
   through the approved secret store/process environment. Do not put secrets in
   `VITE_*`, source, build arguments, browser payloads or image layers. The existing
   Docker build allowlist excludes `.env*`, PEM/key files and deployment config.
4. Configure sender/domain identities, HTTPS callbacks, opt-out handling and
   approved WhatsApp templates in the separately authorized provider environment.
   Verify callbacks before enabling a channel. Do not use real customer recipients
   for an isolated rehearsal. Provider configuration/sending requires approval for
   the exact account, target and permitted test recipients.
5. After all release gates pass, the authorized executor may enable the flags and
   start the separate worker. This task has not performed these steps.

The worker needs an approved application-runtime login with `fm_app_runtime`
membership and the reviewed private-table DML/RLS policy, plus existing booking,
service, preference and entitlement access. `fm_app_runtime` is a NOLOGIN group;
it is not a connection username to issue casually. DB owner must approve the login
and actual rights. Never use a database owner, browser/service-role key, audit
capture/worker login, or migration credentials. Require verified TLS in the
connection URI and supply any approved custom CA as a separate read-only mount.
No new principal is created by this Compose file.

## Configuration and worker runtime

All feature flags default to false:

| Variable | Meaning |
| --- | --- |
| `NOTIFICATIONS_ENABLED` | Account/notification API and event feature gate; a disabled worker exits before opening a DB pool. |
| `NOTIFICATIONS_AUTOMATION_ENABLED` | Allow automatic channel dispatch. With the feature enabled and automation false, the worker only performs metadata cleanup. |
| `NOTIFICATIONS_VERIFICATION_ENABLED` | Allow phone verification when Vonage credentials are ready. |
| `NOTIFICATIONS_DATABASE_URL` | Optional Compose input mapped to the worker's `DATABASE_URL`; no fallback to the app's connection. |

Vonage requires application ID/private key; SMS/WhatsApp readiness also requires
API key, signed-callback secret and the applicable sender. Verification uses the
application credentials. Keep the private key in the secret store; the backend
supports literal escaped `\n` in a PEM environment value. Do not mount a full app
environment file into the worker.

WhatsApp templates are explicitly mapped by `language:kind` in
`VONAGE_WHATSAPP_TEMPLATES_JSON`, using `{ namespace, name, language }` metadata.
Kinds are `accepted`, `rejected`, `rescheduled` and `reminder`. Parameters are service
name, formatted new date/time with timezone, and original date/time only for
rescheduling. Missing templates make that channel unavailable; there is no silent
channel/language fallback. Keep all supported translations maintained. Current
verification covers **en/lv/ru** only; **ar/RTL, zh, fr, de, hi, ja, pt, es** are deferred.

Automatic email requires `RESEND_API_KEY`, verified `NOTIFICATIONS_EMAIL_FROM` and
`NOTIFICATIONS_RESEND_WEBHOOK_SECRET`. Existing authentication/invitation mail
configuration is independent. Set only credentials necessary for approved channels;
missing channel configuration produces an unavailable status rather than a fallback.

`compose.notifications.yaml` is an additive, optional overlay for `compose.yaml`.
The base production configuration remains unchanged and does not launch a worker.
The overlay passes explicit notification variables to the app and defines a worker
behind the `notifications` profile; adding the overlay without the profile still
does not start that worker. Both image references follow `APP_IMAGE`.

The worker has no published ports, application/session/Supabase API credentials or
mount of private app configuration. It uses the image's non-root user, a read-only
filesystem, temporary `/tmp`, dropped capabilities, `no-new-privileges`, an init
process and bounded log rotation. Its inherited HTTP healthcheck is disabled because
it runs no HTTP listener. Restart is bounded to three process failures, preventing
an endlessly restarting disabled/misconfigured worker.

For an **authorized future release**, Compose invocation has this shape:

```text
docker compose --env-file <approved-deployment-environment> -f compose.yaml -f compose.notifications.yaml --profile notifications up -d
```

This is an activation command, not a local validation step. Do not run it during
preparation. The approved deployment input supplies the base app variables, scoped
notification secrets, flags and worker URL; only explicitly declared variables reach
each container. Avoid `docker compose config` without `--quiet` against real inputs,
because rendered configuration may expose secrets.

Native equivalents are `npm run notifications:worker` (development, tsx required)
and `npm run notifications:worker:production` (built JavaScript, production packages
only). They are live entrypoints, not tests. Use only approved process configuration;
both worker and DB modules import dotenv. To avoid inheriting an unrelated root
`.env`, provide `DOTENV_CONFIG_PATH` pointing to the approved worker-only environment
file, or run the built entrypoint from a clean isolated working directory with
explicit environment injection. Never launch the worker to check whether credentials
work: a ready automation configuration can immediately send due jobs.

## Callbacks, monitoring and recovery

Configure raw JSON HTTPS POST callbacks on the app, not the worker:

| Provider | Callback path | Required evidence |
| --- | --- | --- |
| Vonage Messages status and inbound opt-outs | `/api/notifications/webhooks/vonage` | Signed JWT `Authorization`, correct application/API identity and raw-payload hash. |
| Resend delivery/failure/bounce/complaint | `/api/notifications/webhooks/resend` | Valid `svix-id`, `svix-timestamp`, `svix-signature` and endpoint secret. |

Keep the raw body intact through the proxy; do not rewrite JSON or strip signature
headers. The backend registers these routes before its normal JSON parser. Keep
proxy/application clocks synchronized for the signature freshness window. Do not
log raw callbacks, phone numbers, recipients, private keys or rendered bodies.
Unsigned callbacks must fail; duplicates must be harmless. A successful send API
response means accepted, not confirmed delivered. Authenticated SMS/WhatsApp opt-out
messages and email suppression callbacks must be exercised in the authorized rehearsal.

The worker performs non-overlapping ticks on a one-minute cadence, DB-leases jobs,
rechecks entitlement/consent/state and removes old terminal metadata. Reminders more
than five minutes late are skipped. Start with one worker; concurrency is protected
by claims, but scale-out needs measured load and authorized DB/provider validation.
Monitor process restarts/exits, freshness of `Notification worker completed` logs,
tick failures, due-queue age and counts of failed/unknown/unavailable jobs without
recipient labels. A live process alone does not prove progress; its tick exceptions
are logged and do not terminate the loop. Alert when completed ticks stop and when
queue age approaches the reminder grace period. Monitoring wiring and alert delivery
in a live environment remain release work; no destination has been provisioned.

SIGTERM/SIGINT request graceful shutdown and pool closure. The worker checks the
stop flag between reconciliation transactions and dispatches, so shutdown finishes
the current operation without intentionally draining the remaining queue. Remote
requests are bounded to ten seconds; database lock waits still need observation.
Compose allows two minutes before forced termination. If an operation exceeds that
budget, a process may die after provider acceptance; the persisted attempt and expired lease must become
`unknown`, never an automatic retry. Verify actual shutdown in the isolated rollout
rehearsal. Do not infer exactly-once external delivery from a container restart.

To stop new sends, the authorized operator disables automation on app and worker
and stops the worker; disable verification separately to stop new OTPs. Preserve
booking changes, attempts and deduplication records. Stopping cannot retract an
in-flight provider request. Inspect/reconcile unknown outcomes before reactivation;
do not reset attempted jobs, replay missed reminders, or clear deduplication rows.
Retain additive tables/columns when rolling application code back. SQL reversal,
ACL revocation, data deletion or backup restore remains DB-owner work with exact
target authorization. For failure before migration COMMIT, stop and inspect rather
than rerun automatically.

## Local evidence and remaining gates

CI/CD changes are limited to the opt-in Compose overlay, additive public example
flags and this runbook. No private file was read/written and no database/provider
connection, real send, image publication, container startup or deployment was made.
Passed an offline Node `yaml.parseDocument`/assertion check for YAML syntax, complete
parity with notification transport variable names, explicit app/worker environment
allowlists, default-off flags, optional worker profile, same image, no worker ports
or secret mounts, grace period and hardened/non-HTTP runtime settings.
Docker/Compose executable is unavailable in this session, so actual Compose merge
validation, image execution and signal handling are **not verified** here.

Release still needs DB-owner migration/role rehearsal; Backend provider/callback
contract verification; authorized sender/template/domain setup; a production image
build and Compose validation; isolated worker/PRO-expiry/opt-out/send/shutdown checks;
and measured monitoring/recovery evidence. Root integrates application tests and
links this runbook from the task handoff. These are explicit activation gates, not
claims that prepared infrastructure is live.
