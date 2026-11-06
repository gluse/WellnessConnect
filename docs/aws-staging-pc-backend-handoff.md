# TASK-036 PC-built staging image — Backend handoff

6 November 2026. Assigned Backend executor `/root/aws_pc_backend`; requester and
infrastructure coordinator `/root`. Accepted under AGENTS standing cooperation
for the user's request to build and publish using their PC. Reuse the selected
password-protected Lightsail micro staging scope and named development source/
audit pair in [the deployment record](aws-staging-deployment.md). Root explicitly
accepted the necessary reversible Backend packaging fix after its finding.

## Result

Fixed one production import defect in `server/vite.ts` and added
`scripts/test-production-server-imports.mjs`. No package, Dockerfile, frontend
configuration, SQL, ORM, credential or database changes were made by Backend.
No private settings were read; no app/connected worker/server was started.

The previous bundled development-config import hoisted static `vite` and
`@vitejs/plugin-react` imports into `dist/index.js`. Those packages are absent
after `npm ci --omit=dev`, so a production image could fail before application
startup. The helper now resolves the development config through a runtime URL.
The direct Vite import and config import remain inside the development-only
`setupVite` function; normal production startup has no static development-package
dependency. The source config and frontend behavior were not changed.

The regression executes the actual inert server helper in a temporary directory
with the real production Express package available and Vite/plugins absent. It
never loads `server/index` or `server/db`; its child receives only required system
environment values and NODE_ENV=production. It also compiles the actual application
graph without executing it and rejects static packages absent from dependencies.
Temporary cleanup verifies the absolute target remains under its created temp root.

## Verification

- Before the fix, the isolated runtime proof failed with ERR_MODULE_NOT_FOUND
  for package `vite`.
- After the fix, `node scripts/test-production-server-imports.mjs` passes.
  Windows sandbox refused the temporary Express junction; the approved
  network-capable execution path passed. The test itself uses no network.
- `npm run check` passes.
- `node --import tsx scripts/test-startup-diagnostics.mjs` passes 84 injected
  checks, including current currency/workspace-pricing stages and safe diagnostics.
- In-memory production esbuild outputs succeed for app, audit worker,
  notification worker and product-activity worker. Their static external packages
  are all production dependencies or Node built-ins. No generated application
  output or private environment is loaded by these checks.

Actual Linux Docker build/runtime and live proxy/DB behavior remain Root's
verification. Local Node was v24.22.2; the intended image uses Node22. No fresh
browser/locale matrix was run; future locale checks remain en/lv/ru, with
ar/RTL, zh, fr, de, hi, ja, pt and es deferred.

## Current runtime contract and changed side effects

Use ordinary `node dist/index.js` with NODE_ENV=production, PORT=5000, HTTPS
APP_URL, SESSION_SECRET at least32 characters and the existing restricted
DATABASE_URL/SUPABASE/OPENAI inputs. Keep the public CA at the configured Linux
sslrootcert path with strict certificate/hostname verification.

Ordinary startup leaves local Stripe billing unselected. Do not invoke
`billing:dev` or copy the IDE's Stripe development dotenv files into this image
or staging runtime. The selected deployment keeps notification provider/automation/
verification flags false and does not start a notification worker. Deliberately
scope PRODUCT_ACTIVITY_ENABLED; its standalone worker requires true, and no
product-activity worker is required merely to serve HTTP. Wishlist saves can still
enqueue internal addition events even while the activity worker is off.

The audit target/principal/strict-TLS contract is unchanged. Separate audit worker
command remains `node dist/audit-worker.js`, with worker-only source/destination
credentials and no public port. Existing Dockerfile's extra esbuild audit command
is still needed; package build now additionally emits `dist/activity-worker.js`.
No manifest files are needed by the unchanged audit-worker runtime beyond the
configured CA. Audit worker startup claims any eligible shared-development queue
record immediately; it is not a read-only health probe.

The 31 October 33-table/14-gate preflight is historical. Current startup verifies
currency and workspace-pricing metadata unconditionally before registering routes.
Current contracts require41 tables and32 integrated workspace-pricing gates plus
two currency gates. The DB owner must accept a fresh matching target/current
contract rather than treating disabled feature flags as schema compatibility.
The 6 November TASK-044 handoff records applied development migration0021 and
34 passing restricted metadata gates; fresh deployment checks belong to DB.

Health routes themselves still precede sessions: live has no query, ready does
SELECT1. A long-lived app process now schedules booking-message retention every
hour independently of notification/activity flags. Its bounded transaction can
delete up to1000 expired message rows for up to100 completed/cancelled bookings
under the existing12-calendar-month rule. It does not run immediately at startup,
but old claims that a health-only app lifetime cannot write are no longer valid.
Normal session operations also initialize expired-session pruning. DB must
evaluate the retained policy/execution scope before connected staging startup.

## DB-owned runtime import dependency

Backend found and reproduced a second issue in the current readiness graph:
workspace-pricing readiness imports billing contract, which imports
audit/search-location-runtime, which brings in two installer executors. Their
source CLI main guards compare process.argv[1] with import.meta.url. Bundling maps
all import.meta.url values to the bundle URL, causing both main guards to run when
the readiness bundle is executed as a Node entrypoint.

Safe pre-fix proof: bundle only workspace-pricing/application-readiness.mjs to
144,926-byte ESM, execute as a file in an empty temporary directory with minimal
system env and no command mode. It exits1 and prints two fixed MODE_REJECTED
records before private access or SQL. No server/db/application is imported.

Root routed this to assigned DB owner `/root/aws_pc_database`. Backend accepts
the proposed pure search-location-contract extraction, runtime re-export and
billing-contract import change, preserving installer behavior and applied SQL/
pins. DB owns implementation and durable regression evidence; no DB files were
edited by Backend. This remains a deployment integration dependency until DB
returns its passing result. Full app startup stays prohibited before integration
and current DB acceptance.

## Recovery and next owner

Revert only the changed development-config import and new packaging regression
if undoing Backend's fix; preserve other source, existing handoffs, applied SQL
and private inputs. Root integrates DB's pure-contract fix, packages the reviewed
source, verifies the actual Node22 image and performs only accepted connected
staging operations. Stopping a workload does not undo session/audit/retention
writes; preserve and reconcile uncertain outcomes under the existing workflow.
