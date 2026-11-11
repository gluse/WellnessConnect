# TASK-064 local Supabase copy — backend, 9 November 2026

Current endpoint follow-up: the original 543xx host ports below are historical.
The [10 November port correction](supabase-local-port-fix-2026-11-10-backend.md)
moves local API/database endpoints to 15421/15422/15432 while preserving the copy,
credentials and hosted configuration.

Status: **complete on 10 November 2026: local runtime support, offline checks,
full local integration, exact fixture cleanup and postrestart persistence smoke
passed.** Nothing was deployed
to AWS or changed in either hosted database by this owner.

The user requested independent databases for local development and the published
AWS app, selected **Copy on my PC using Docker**, and asked to resume. Root assigned
`/root/local_copy_backend` as Back End Developer for the necessary local application
dependencies. This owner accepts that scope under the standing cross-role rule.
The backend practices skill, security and testing references were applied.
Root owns infrastructure; `/root/local_copy_database` owns database export/restore
and local database validation. Frontend changes are outside this assignment.

## Runtime contract

`AUDIT_RUNTIME_PROFILE=local-docker` requires `NODE_ENV=development` and preserves
the existing audit environment label `development`. The new profile permits only
literal `127.0.0.1` connections, database `postgres`, the existing restricted role
names and fixed ports:

| Component | Principal | Port |
| --- | --- | --- |
| Application | `fmt_app_dev` | 54322 |
| Capture | `fmt_audit_capture_dev` | 54322 |
| Source worker | `fmt_audit_worker_dev` | 54322 |
| Destination writer | `fmt_audit_writer_dev` | 54332 |
| Destination reader | `fmt_audit_reader_dev` | 54332 |

The local profile accepts plaintext only for these local connections and verifies
the actual socket peer is loopback. The hosted default still requires verified
TLS and the existing exact Supabase targets. The role/capability checks remain
active, including the application role's connection cap of five, required group
memberships, denied object ownership/DDL and denied direct audit-table access.
Mixed local/hosted database URLs are rejected before a pool opens. The local
Supabase API must be exactly `http://127.0.0.1:54321`; the application origin is
`http://localhost:5000` or `http://127.0.0.1:5000`. The local profile binds the app
only to `127.0.0.1`; hosted/default binding remains unchanged.

Local OAuth, notification, product activity and payment flags remain dormant.
Embedding and geocoding calls fail as unavailable before invoking their providers
in this profile, and local startup needs no hosted provider keys. Existing normal
hosted provider behavior is preserved. Text search can use its existing fallback;
AI and external address lookup are unavailable in the isolated copy.

Service images already use `/objects/...` references and are served through the
configured Supabase Storage client, so copying the same object keys supports local
images without frontend URL changes. Stored third-party profile avatars may still
be external image URLs; those are separate from application database routing.

## Configuration and launch

The owner added `scripts/start-local-development.mjs`. Importing it is inert.
The explicit preparation command is:

```powershell
node --import tsx scripts/start-local-development.mjs --prepare
```

Preparation requires git-ignored, owner-only protected
`outputs/supabase-local-private/`, a non-symlink `local-bootstrap.json` with the
five new local role passwords, and `supabase-status.json` with `API_URL`,
`ANON_KEY` and `SERVICE_ROLE_KEY`. Child artifacts may inherit their sole owner
FullControl rule from the verified protected parent. Original `.env` requires
its existing protected explicit owner ACL; only the four selected membership/
flag lines are parsed: `APP_ADMIN_USER_IDS`, `AUDIT_READER_USER_IDS`,
`AUDIT_EXPORT_USER_IDS`, `AUDIT_SERVICE_VIEWS_ENABLED`.

Preparation creates `.env.local-docker.local` exclusively, applies its owner-only
ACL before writing any content, generates a fresh session secret, and validates
the complete profile. It refuses to overwrite an existing file. Original `.env`
is not modified. It never copies original hosted provider keys or DB credentials.
No source service is accessed by this command.

```powershell
node --import tsx scripts/start-local-development.mjs --check
node --import tsx scripts/start-local-development.mjs --worker --check
npm run db:local:start
npm run dev
npm run audit:worker
npm run db:local:status
npm run db:local:stop
```

The lifecycle commands use Root's `deploy/local-supabase/manage.mjs`. `npm run dev`
and `dev:local` require the local profile and have no hosted fallback. The app
launcher sets `AUDIT_WORKER_ENABLED=false`; audit delivery runs only through the
separate worker command after DB verification. Both launchers strip inherited
credentials, `NODE_OPTIONS` and database overrides; children receive allowlisted
OS environment plus selected local settings, with dotenv pinned to the local
file. Original explicit commands are preserved as `dev:hosted` and
`audit:worker:hosted` for intentional access to the historical hosted profiles.
Those commands are not needed for ordinary local development.

Root additionally assigned protection of historical development commands that
would otherwise load the original hosted `.env`. The DB owner accepted and
delegated the inert npm-routing guard. All ordinary `db:push`, `db:setup-*`,
`db:mark-locations-verified`, `db:transfer`, `storage:setup` and `test:integration`
commands now refuse while the local-copy profile exists. The wrapper reads no
private contents, imports no DB client and starts no original executor when
refusing. It has no environment-variable bypass. Original reviewed scripts remain
unchanged; a future explicitly approved operation must first review its exact
target with the DB owner. Other historical connected integration tests likewise
require target review; they do not automatically inherit local launcher settings.

`billing:dev`, `notifications:worker` and `activity:worker` now refuse as dormant
local features before private reads or worker startup. Their historical original
commands are explicitly named `billing:dev:hosted`, `notifications:worker:hosted`
and `activity:worker:hosted`. Existing production worker commands are preserved.
Offline tests exercise every guarded operation through an injected executor and
verify no original command runs in local-copy mode. A real `npm run db:push`
invocation returned the expected refusal without invoking Drizzle or a database.

The DB owner approved one synthetic local-only Auth user, login/profile/session,
logout and audit-capture/delivery verification. The prepared explicit smoke
`scripts/test-local-supabase-live.mjs` starts and stops only its own direct local
application child, refuses an existing port 5000 listener, and preloads a test-only
network guard that denies every non-loopback TCP host. It uses only local API
URLs and discards raw application/provider logs. The one fixture password exists
only in memory. Its exact ID is retained in protected `smoke-fixture.json` for
DB-owned profile/session cleanup; subsequent explicit local Auth cleanup removes
the Auth account. Generated audit evidence is retained. Execution waited for
the DB owner's passed 38-gate/five-principal checks and Root's local Auth restart.

## Verification and recovery

Passed:

```powershell
node --import tsx scripts/test-local-supabase-backend.mjs
node --import tsx scripts/test-audit-activation.mjs
node --import tsx scripts/test-audit-worker.mjs
node --import tsx scripts/test-audit-viewer.mjs
node --import tsx scripts/test-geocoding.ts
npm run check
git diff --check -- server/audit server/db.ts server/supabase.ts server/embeddings.ts server/geocoding.ts scripts/start-local-development.mjs scripts/test-local-supabase-backend.mjs package.json
```

The new suite exercises local app/capture/worker/reader target validation, mixed
route rejection before sockets, real-peer decisions through injected clients,
unchanged hosted TLS and role decisions, credential stripping, local profile
assembly and disabled provider effects. Everything is synthetic/offline. The
viewer suite uses only a synthetic loopback HTTP listener and mocked DB/service
adapters. Its first sandbox run was denied with `EACCES` on a local socket;
the scoped outside-sandbox rerun passed. Full TypeScript checking passed.

After Root confirmed local stack health and protected bootstrap/status artifacts,
this owner executed `--prepare` once successfully, then `--check` and
`--worker --check`, both successfully. The new protected runtime file exists;
the original hosted `.env` was preserved. The selected local keys are the
supported `ANON_KEY` and `SERVICE_ROLE_KEY` from local CLI status. No application
or worker connection was opened by those configuration checks.

## Connected local result

On 9 November at 17:18–17:19 Europe/Riga, the full isolated smoke passed: local
application liveness/readiness, guest service search, dormant social providers,
empty Maps provider key, one synthetic local Admin-created confirmed Auth account,
email/password login, a persisted Express session, matching current-user profile,
logout and 401 using the destroyed session cookie. No signup/invitation email was
sent. Copied users' existing password hashes/identities were preserved and verified
by the DB owner; this smoke did not recover or exercise any existing user's password.

One bounded audit-worker step claimed and delivered 3 events with zero new retries,
quarantines, stale leases, source/destination failures or capture gaps. Local
health reported 236 inherited quarantines; those remain separate historical data.
The worker pools closed and the task's direct application child was stopped.
No user's existing app process was stopped. The preload prevented nonlocal TCP
destinations throughout the application test; the test used only literal-loopback
HTTP URLs and the validated local database profile.

Protected receipt: `outputs/supabase-local-private/local-backend-smoke-1794237588743.json`.
The first two attempts used an insufficient 20-second startup polling deadline;
they created no fixture and stopped their own still-running child with SIGTERM.
Those incomplete receipts remain preserved. The successful attempt used a bounded
120-second deadline, with no application security gate relaxed.

The synthetic fixture ID/email are retained only in protected
`outputs/supabase-local-private/smoke-fixture.json`. The DB owner removed its exact
local profile and confirmed that logout already cleared its session; no dependent
business rows existed. Backend then deleted the exact local Auth account and
delivered the one normal audit event created by profile cleanup in another bounded
worker step, with zero failures/retries/new quarantines. All generated audit
evidence is retained. The task app and worker pools are closed. Cleanup receipt:
`outputs/supabase-local-private/local-backend-smoke-cleanup.json`.

## Final persistence acceptance — 10 November 2026

Root stopped and restarted the local infrastructure. After the DB owner passed
the exact baseline fingerprint comparison and fresh 38-gate/five-principal,
sequence, Auth, RLS and image-reference checks with all probes closed, Root
released this owner's fixture-free postrestart smoke:

```powershell
node --import tsx scripts/test-local-supabase-live.mjs --verify-persistence=TASK-064-LOCAL-SMOKE-2026-11-09
```

It passed. The actual listener for the task-owned app PID was exactly
`127.0.0.1:5000`; liveness/readiness, dormant social providers, an empty Maps key
and guest service search passed. The nonlocal TCP guard remained active. This
mode created no Auth fixture and ran no audit worker. It stopped its own app
child, and the test process exited 0. No source or hosted-service connection was
opened. The local listener change passed TypeScript before this live check.

Protected receipt:
`outputs/supabase-local-private/local-backend-smoke-persistence.json`.
Public safe aggregate:
`output/supabase-local-copy-2026-11-09/backend-result.json`.
All own consumers are closed. No backend acceptance work remains. Root owns
final integrated documentation and user delivery; Storage's independent byte
persistence verification and infrastructure evidence are recorded by their owners.

No locale matrix was needed for these backend changes. Any integrated language
checks cover en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

Recovery: stop the local app/worker, preserve the protected copy and its evidence,
and reverse only this task's local backend/launcher changes if needed. AWS and
the hosted `.env` remain intact. Switching back after local edits does not merge
local data into the hosted source; that requires a separate deliberate operation.
