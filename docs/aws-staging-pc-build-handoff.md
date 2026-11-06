# TASK-036 local PC build handoff — 6 November 2026

Status: **local Linux image built and isolated tests passed** after the user
restarted Windows and confirmed ready. Current connected DB owner preflight also
passed. AWS sign-in renewed after explicit confirmation. Selected one-node micro
Lightsail service created; image published and deployment1 ACTIVE/RUNNING.
Live HTTPS/gateway/readiness checks, audit worker health and frontend guest
acceptance pass. Selected restricted publication is complete. No successful
application-account sign-in is claimed.

Latest gateway follow-up: user-selected one-hour secure staging session fix is
now published as deployment4 ACTIVE, gateway app.2 while app/audit remain app.1.
Live cookie/tamper/app401 checks and frontend EXACTLY1challenge guest smoke pass.
See [current session release](aws-staging-session-release.md); version1/2 and
original Basic-only acceptance below are historical checkpoints.
Coordinator/infrastructure executor: `/root` under the user's explicit request
to build and publish using this PC, retaining the previously selected restricted
Lightsail staging plan. See [approvals and deployment record](aws-staging-deployment.md).

## Ready continuation — 6 November 2026

Root verified a new Windows boot and Docker Linux engine29.9.2 outside the
sandbox. All472 current allowlisted source files still matched the reviewed
snapshot before building. Executed the exact build command below successfully.
Runtime image tag `fitsmytime-staging:pc-2ea7c952e9935e96`; image index ID
`sha256:283569798ce4701a333c4d05992b94618c5e5a6016b644346d4d0e559fec1a02`.
Node22 Debian base resolved to
`sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d`.
Linux frontend and all four server entry bundles compiled. Proxy mock tests
passed inside the production image with `--network none`, including access
restriction, health isolation, forwarding, cookies, body streaming and fail-closed
errors. All required production artifacts were present. Result is saved in
`outputs/aws-staging-build/source-numRWC/local-build-result.json`, with
ApplicationStarted=false and Published=false. No dotenv inputs entered the build.
Browserslist age and large frontend chunk warnings are recorded; no dependency
or frontend changes were made to resolve them in this delivery task.

Assigned DB owner `/root/aws_pc_db_release` accepted and executed the bounded
current preflight once, exit0:41 tables, all34 gates, strict TLS, four expected
principals/caps, zero competing same-role connections observed, all probe
connections closed. No writes/claims/mutations/retry. See the
[DB release handoff](aws-staging-pc-db-handoff.md). Capacity is accepted for one
staging app without local-app/rolling overlap; observations do not reserve it.

CLI2.39.2 and the configured MCP initially reported expired AWS authentication.
User explicitly approved same-profile login; it completed and STS verified
project674200807170 / AccountFullAccessRole. Fresh AWS checks show Free plan ACTIVE,
USD99.82 remaining credits, micro priceUSD10/month, Stockholm available and no
pre-existing container services. Required Lightsail local-image/deployment and
quota references were retrieved through the existing Codex MCP connection.

Root created only `fitsmytime-staging`, micro/scale1, in eu-north-1. ARN:
`arn:aws:lightsail:eu-north-1:674200807170:ContainerService/f490e631-ab48-4881-802c-ab03e242abc7`.
AWS returned HTTPS origin
`https://fitsmytime-staging.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com`.
Creation state PENDING; this is not a live-site claim. Capacity billing begins
at creation. The native private registry route avoids ECR pull-role work.

New infrastructure `publish-local.mjs` validates the exact local image/engine and
will push via Docker's local named-pipe Engine API using registry credentials
only in memory, then register the digest through MCP. Its local-only --check
passed; no image upload performed yet. `deploy-staging.py` uses the existing
profile through the local SDK for secret-bearing deployment payloads: private
inputs stay in process memory and only filtered public metadata is persisted.
DB owner explicitly delegated Root to read/inject the two protected handoffs.
The script's non-deploy validation passed current ACLs, exact key sets, holds,
project identity, origin and empty-service state. Initial ACL module autoload
failure was fixed with explicit security-module import; no app/DB mutation or
deployment retry occurred. Public endpoint will be gateway8080 only; app5000 is
private, audit worker has no opened port. Payments, external notifications and
activity worker remain disabled.

To stop the selected service's hosting charge, delete only this service:
`aws lightsail delete-container-service --service-name fitsmytime-staging --region eu-north-1 --profile fitsmytime`.
This deletes the service's registry/deployments too; do not run without the
applicable user cleanup selection. Earlier builder resources are separate.

## Image publication and activation checkpoint

Native private-registry push completed and registered exact reference
`:fitsmytime-staging.app.1`, digest
`sha256:283569798ce4701a333c4d05992b94618c5e5a6016b644346d4d0e559fec1a02`,
matching the reviewed local image ID. No registry password was written to disk,
Docker configuration or output; the temporary auth travelled only through
in-memory MCP result capture and Docker Engine request headers. Public release
metadata is in the snapshot's `published-image-result.json`.

Before activation, local port5000 had no listener. Root's secure deploy script
validated exact approved key sets/ACLs and service identity/capacity, then created
version1 once. State ACTIVATING; gateway8080 is the sole public endpoint, readiness
path `/health/ready`. App and worker use the same exact registered image; only
their scoped credentials are injected. App APP_URL uses the actual AWS origin.
No Stripe configuration is included. PRODUCT_ACTIVITY_ENABLED explicitly false;
existing false notification flags preserved. Audit flags preserve development
contract/capture/service views and the separate worker.

Generated256-bit gateway password is in ignored `.env.aws-staging-access.local`.
The empty file was created first, then the existing validated owner-only protected
ACL copied/verified, before any password was written. The cloud gateway receives
only SHA256 verifier and username, never the plaintext password. Do not copy the
secret into docs, logs or source. `deployment-result.json` contains only filtered
origin/image/version/state/public-container metadata.

Activation triggers normal app/audit behavior under prior authorization; no
manual database operation, migration or explicit retention pass ran. Live HTTPS,
gateway and audit worker checks are pending. Frontend owner
`/root/aws_pc_live_frontend` accepted guest/login UI read-only en/lv/ru acceptance,
will wait for ACTIVE/gateway-pass, and has only gateway credential handoff access.
Supabase Auth's exact staging `/api/callback` allowlist is not yet verified;
email/social/successful user-login flows are not acceptance claims.

## Live gateway acceptance

Deployment1 reached ACTIVE; service RUNNING with no next deployment. All three
containers use exact `:fitsmytime-staging.app.1`. App is listening on5000. Latest
audit worker report is healthy with sourceFailures=0, destinationFailures=0 and
captureGaps=0. This verifies worker runtime health, not a new synthetic business
event or every historical audit record.

Executed `status-staging.py --logs --verify` successfully. Public HTTPS certificate
validated. Unauthenticated `/`, `/login`, `/api/auth/user`, an asset path,
`/privacy-policy.html`, `/health/live` and readiness with a query all return401
Basic challenge. Only exact `/health/ready` returns200 with `{status:ready}` and
no cookie. Authenticated `/` and `/login` return200 HTML with noindex/noarchive
and HSTS. Evidence is filtered `outputs/aws-staging-build/live-gateway-result.json`.
No raw deployment/environment/log payloads are stored in evidence.

Frontend owner was released only after these checks and passed the restricted
guest matrix in live Chrome156: en/lv/ru login x320/390/1280, native locale/labels,
reflow/keyboard/native empty validation, landing/category reads, zero runtime
errors or blocked/unexpected traffic. Six phone390/desktop1280 screenshots were
visually reviewed. All docs/assets/locales/providers/category reads200; guest
auth-user401 expected. No mutation/email/OAuth/auth submission occurred. See
[owner acceptance](aws-staging-pc-live-frontend-handoff.md); filtered browser
evidence SHA256 `6AEC4011CE57138C5EFB02B962F989C0F8F67F4FB55B9F2040B5E79B7FEBC015`.
All other supported languages/RTL remain deferred.
No real application account/test fixture was assigned; do not claim
successful signed-in/account/booking/payment behavior. The gateway credential is
separate from normal application login.

User was asked whether to remove the unused cloud-build setup after bounded
unrelated-data checks or keep it; selected removal. The running Lightsail service
is explicitly excluded from this cleanup.

**Cleanup selection,6November:** User explicitly chose “Remove unused build
resources (Recommended)”. Executor Root through the existing fitsmytime MCP;
exact October build project/role/source bucket/unused ECR/log group/key only.
Read-only prechecks verify identity674200807170, exact source/role/log references,
no build IDs, ECR images, bucket versions/delete markers/multipart uploads or log
streams; logs storedBytes0. Role has only the scoped inline policy, no attached
policies or instance profiles, and trust bound to this exact CodeBuild project.
Key is single-Region customer symmetric AWS_KMS, TASK-036 tagged/described,
no aliases or grants, and service policy only permits this exact log context.
Removal is now authorized; key deletion will be scheduled with a7-day wait.
No Lightsail/native-registry, application, database or protected local inputs
are part of this cleanup. Preserve local build/image/source evidence.

**Cleanup completed and verified,6November:** deleted CodeBuild
`fitsmytime-staging-20261031`, empty S3
`fitsmytime-staging-build-674200807170-eun1-20261031`, empty ECR
`fitsmytime-staging` (force=false), empty CloudWatch log group
`/aws/codebuild/fitsmytime-staging-20261031`, role inline policy
`StagingSourceImageAndLogsOnly`, and role `FitsMyTimeStagingBuild`.
KMS `a523b5bf-a47b-4161-9936-1fa1bf561c5f` is PendingDeletion, seven-day window;
AWS DescribeKey deletion date **13November2026 at13:07:27 Riga**
(11:07:27UTC). Final deletion is asynchronous; it is not already deleted.
Fresh API verification confirms project absent, bucket NoSuchBucket, repository
RepositoryNotFoundException, role NoSuchEntity and no exact log group. Filtered
receipt: `outputs/aws-staging-build/cleanup-result.json`. All deletions succeeded
without force-emptying data or retry. The prior quota request/Support case was
not changed or freshly checked by this resource cleanup.

Post-cleanup `status-staging.py --logs --verify` passes: same ACTIVE version1,
all three exact native-registry image refs preserved, no next deployment,
gateway restrictions/readiness/authenticated HTML pass, worker healthy with
source/destination/capture-gap failure counts0. Local Docker/image/source and
protected credential handoffs were preserved; no DB operation was performed.
The cancelled cloud build route's deleted empty resources would need recreation
for future use. Before the scheduled key deletion, authorized recovery could
cancel it; there are no build ciphertext/log records to restore from this task.

## Opening staging and remaining sign-in setup

Open `https://fitsmytime-staging.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com`.
Browser Basic prompt username is `staging`; use STAGING_PASSWORD from the protected
`.env.aws-staging-access.local`. Then use the application's own existing login.
Do not paste the staging password or application passwords into task records.
Avoid running the local app simultaneously against the same five-connection role.

For email-link and social callbacks, the exact additional Supabase Auth redirect
allowlist entry is:
`https://fitsmytime-staging.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com/api/callback`.
This entry's live presence is unverified. Preserve the shared dev Site URL and
existing local entries; APP_URL alone does not configure Supabase. No emails or
OAuth callbacks were submitted. See Supabase's
[redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

Hosting remains micro/one node, verifiedUSD10/month base until deleted, plus
applicable variable/external costs. Free-plan credits do not establish that every
charge is covered. No plan upgrade or production/public release occurred.

## Known gateway login UX issue — 6 November 2026

User reported the browser asking for staging Basic credentials again during app
authentication. Frontend owner `/root/aws_pc_live_frontend` reproduced with the
actual gateway and an isolated dummy local app in Chrome156, no liveAWS/DB/private
inputs. GET/POST200 with credentials:include send cached Basic first try with no
new prompt. An app GET/POST401 without WWW-Authenticate is forwarded correctly,
but Chromium invalidates its Basic cache. The next request omits Basic, causing
the gateway to challenge and Chrome to prompt again. Repeated login POST401
therefore repeats this pattern. This does not demonstrate invalid staging
credentials or reveal the actual user's app-login result.

Evidence `outputs/aws-staging-build/basic-auth-diagnosis-evidence.json` records
only sanitized status/authorization booleans and challenge counts. Earlier CDP
guest smoke answered every authRequired automatically; it verified page delivery
and restriction but did not assert prompt count, masking this usability problem.
No production/frontend/backend source or cloud runtime was changed in response
to the user's diagnostic question. Candidate infrastructure fix is a separate
secure, bounded staging-access session; it must preserve app401 behavior and all
route restrictions, with real browser challenge-count regression coverage before
any new deployment. Do not fix by blindly rewriting401 to403: frontend handlers
depend on actual401 for guest/login state.

The sections below preserve the preparation evidence; their pre-restart and
unexecuted-preflight statements describe that earlier checkpoint only.

## Local setup evidence

- Official Docker Desktop4.98.0.245422 installer signature valid, signer Docker
  Inc. Installer SHA256 CD6273D9EAA4F07FA7593FC6813D37E1004381CEBC3F26047A2554FA5DB24388.
- User-approved Windows elevation launched the reviewed
  [WSL helper](../deploy/aws/install-local-wsl.ps1). Exit0; WSL3.0.3 installed;
  VirtualMachinePlatform changed Disabled -> EnablePending. No Linux distribution
  or user account created. No restart invoked. Result/log are in ignored
  `outputs/aws-staging-build/local-setup/`.
- Docker installed per-user at `%USERPROFILE%/AppData/Local/Programs/DockerDesktop`,
  WSL2 backend, Windows containers disabled, installer exit0. Docker CLI29.9.2
  verified. No paid subscription or application license auto-accepted.
- Fresh PC boot observation is14October2026, preceding WSL installation. No Docker
  process was running. Therefore the required restart has not yet occurred.
  Free C drive space was14.7GB after installation; preserve room for image/cache.

## Current source preparation and ownership

Backend owner `/root/aws_pc_backend` accepted the current packaging dependency,
fixed `server/vite.ts` to keep dynamic development configuration out of the
production import graph, and added `scripts/test-production-server-imports.mjs`.
The owner's pre-fix proof failed with missing production Vite dependencies;
post-fix Express-only import and production dependency graph pass. Owner also
reported full TypeScript,84 startup diagnostics and four entry bundles passing.
See [Backend handoff](aws-staging-pc-backend-handoff.md).

DB owner `/root/aws_pc_database` accepted the transitive import dependency and
extracted unchanged location constants into `migrations/audit/search-location-contract.mjs`.
Historical runtime module re-exports the same values; billing contract imports
the pure module. No applied SQL, pins, CLI behavior or privilege policy changed.
This prevents esbuild from including installer CLI entry guards in app/activity
runtime readiness. Owner's actual ESM entry proof changed exit1/two MODE_REJECTED
records to exit0/no output. Root reviewed the three-file diff and reran the
durable regression successfully (86,481-byte inert bundle, no installer inputs).

Root also reran the integrated production-import regression successfully after
the DB fix. Its initial sandbox run could not create a temporary junction;
the approved outside-sandbox isolated run passed. This uses no real app startup,
private env, database or external service.

Current mocked workspace-pricing readiness passes exact41 tables/32 flags;
mocked currency readiness passes its additional2 flags. New DB-owned
`scripts/aws-staging-pc-db-preflight.mjs --plan` passes and states41/34 with zero
writes/claims. Owner reported protected inventory passing without network.
**No fresh connected DB preflight has run for this current source.** Historical
October33-table evidence is preserved, not reused as current acceptance.

DB owner also reported the historical installer offline246 checks passing.
Historical search-location/monthly-local runners hardcode old17/33-table
repository assumptions and refuse the expanded current schema; these checks
were not weakened or relabeled as passed. The current runtime-contract proofs
above are distinct from those legacy runner limitations.

Frontend owner `/root/aws_pc_frontend` reported isolated production Vite and
client/shared TypeScript passing on current client/shared source:223 files,
1,888,566bytes, frontend manifest SHA256
78b96e3b5af0d467191603b511dcba04e5a13e918f43b790a022066f8c29c430.
No private config, connected services or frontend edits. Owner specifically
approved Root to reproduce this frontend build within the credential-free Linux
Docker image for TASK-036. This does not delegate frontend source changes or
live browser/API/database tests. The agent service hit its usage limit before
writing its promised durable frontend handoff; these are delivered owner-message
results, preserved by Root. DB/Backend follow-up finalization also hit that limit;
Root records their delivered evidence rather than claiming unseen owner checks.

## Prepared snapshot and build command

Current reviewed build snapshot:
`outputs/aws-staging-build/source-numRWC/context`,472 files/3,709,918bytes;
manifest SHA256
`2ea7c952e9935e964c86516a12d498822bd0e1b029428e02a4d5f097301b0349`.
No Git history, dotenv/Stripe credentials, dependencies, backups or unattached
assets. Source packer rejects links and high-confidence credential patterns.
Snapshot preparation is complete; no upload is implied.

After Windows restart, open Docker Desktop, complete its first-run terms if
prompted and wait for the Linux engine. Root can then run:

```powershell
./deploy/aws/build-local.ps1 -SnapshotDirectory ./outputs/aws-staging-build/source-numRWC
```

The [build script](../deploy/aws/build-local.ps1) parses successfully and verifies
the full snapshot manifest/file count, requires a local named-pipe Linux Docker
engine, builds linux/amd64, runs proxy tests against mock servers inside the image
with network disabled, and checks app/audit/notification/activity/public/CA files.
It does not load private dotenv files, start the real app/workers, access DB/AWS
or publish. Actual execution awaits the required restart; parse verification is
not an image build. Expected local tag:
`fitsmytime-staging:pc-2ea7c952e9935e96`.

Then re-establish the same Codex-only AWS profile if needed, release the DB
owner's bounded read-only current41-table/34-flag preflight, and proceed with
the selected restricted Lightsail deployment only after all gates pass.

## Current lifecycle scope and recovery

The current app registers hourly booking-message retention. The user already
selected12 calendar months after later closure/last-message time, retaining
unresolved bookings. Root treats the6November request to publish the **current**
application as including this existing bounded lifecycle on the selected dev
source: up to100 expired completed/cancelled bookings and1000 message rows per
hourly pass. This is no new retention policy, migration, grant or cleanup run.
No retention job has run in this preparation. Normal audit delivery can process
eligible shared-development backlog; it is not limited to new staging events.
Payments, external notifications and PRODUCT_ACTIVITY worker stay dormant.

Recovery: preserve private settings/applied SQL and unrelated work. Revert only
this task's source fixes/prepared files if needed. Installed Docker/WSL can be
removed through normal Windows mechanisms if the user selects that later; do
not automatically disable virtualization features or reboot. Do not delete
container data or unrelated images/volumes when cleaning build cache. Cloud
builder resources from October remain a separate tracked cleanup decision.

No live browser/locale matrix was run. Future language acceptance is en/lv/ru;
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
