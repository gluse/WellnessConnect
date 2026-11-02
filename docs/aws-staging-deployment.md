# AWS restricted staging deployment — 31 October 2026

Status: selected Lightsail deployment in progress. Owner DB preflight passed;
protected runtime handoff and filtered source prepared. Supporting AWS build
resources created; AWS refused build start because the project has zero build
queue capacity. No build ran; Lightsail app/worker not started.
Requester: user. Coordinator/infrastructure executor: Codex `/root`.

## User choices and authority

- User requested publishing this project to AWS on 31 October 2026.
- User selected **High** guidance and **Restricted staging site** in this chat.
- Target AWS project: the existing Codex-only `fitsmytime` connection; selected
  Region **eu-north-1 (Stockholm)**. The toolkit service endpoint is not the
  application deployment Region.
- Public production is outside this staging selection. Existing public
  location/privacy release gates remain in effect.
- User selected **Lightsail with a staging password — USD 10/month base** and
  explicitly accepted deployment-spec credential storage. One micro node,
  scale one, in eu-north-1; runtime app port 5000 behind a password proxy.
- User explicitly selected **Use existing development projects after owner
  preflight**: source hbkooiknruimukkhshrk, audit ynygqodmtgjrngiudalw. The presented
  scope includes schema/TLS/principal checks, secure runtime credential
  provisioning and normal test-session/audit writes. Root coordinates; assigned
  DB owner executes database preflight; Backend owns application compatibility.
  Connected startup/test writes wait for successful owner preflight.
- No permission to migrate data, increase connection limits, activate
  billing/notifications, send messages or remove privacy/security controls.
  No owner credential use, migration/ACL repair or automatic retry on failure.

## Verified AWS observations

Read-only AWS MCP calls succeeded: STS identity, Free Tier plan state,
CloudFormation ListStacks, ECS ListClusters and Lightsail container inventory,
powers and Regions. The Free plan is ACTIVE, with USD 100 remaining credits and
an expiration timestamp corresponding to 30 April 2027. The user has not upgraded
to the Paid plan. No active completed CloudFormation stacks, ECS clusters or
Lightsail container services were returned in eu-north-1 by these scoped calls;
this is not a full AWS resource inventory.

The AWS experience supported-service list includes ECS, ECR, EC2 and Lightsail.
Regional resource discovery reports ECS ExpressGatewayService, ECS Service and
Lightsail Container available in eu-north-1. Lightsail also returned Stockholm
in its Regions and active powers: nano USD 7 (0.25 vCPU/0.5 GB), micro USD 10
(0.25 vCPU/1 GB), small USD 15 (0.5 vCPU/1 GB), medium USD 40 (1 vCPU/2 GB),
large USD 80 and xlarge USD 160 per node/month. Capacity has not been measured.

## Hosting choices presented for selection

| Choice | Proposed restriction and secret handling | Cost evidence / limitations |
| --- | --- | --- |
| ECS, recommended | Managed HTTPS; default-deny ingress allowing explicitly selected tester IPs; app credentials injected from Secrets Manager; one app task, no autoscaling | Planning budget USD 50–60/month for low traffic, subject to final generated plan and access design |
| Lightsail micro, one node | Managed HTTPS with an infrastructure staging-password proxy before every app route; app container is not the public endpoint | USD 10/month capacity, plus applicable transfer overage/build costs. Runtime credentials are stored in the deployment specification and can be read by authorized AWS operators; explicit acceptance needed |

The ECS planning budget uses live Stockholm Price List rates: Linux x86 Fargate
USD 0.0445/vCPU-hour and USD 0.0049/GB-hour. At 730 hours, 0.25 vCPU/1 GB is
USD 11.70. An ALB at USD 0.02394/hour is USD 17.48, plus USD 0.0076/LCU-hour.
Public IPv4 addresses are additional; three continuously allocated addresses
at USD 0.005/hour would cost USD 10.95. Ingress restriction, secret storage,
image storage, logs, builds and traffic are additional components. USD 50–60
is a budget estimate, not a fixed quote or a spending cap. Recompute against
the selected architecture before creation. Supabase, external APIs and taxes
are excluded. Credits do not establish that every charge will be covered.

ECS Express defaults can expose public HTTPS and create overlapping tasks.
Passing a task security group does not itself restrict the managed ALB. The
final plan must enforce ingress restrictions before serving the app and prove
they cannot be bypassed. Do not provision an open service and restrict it later.
An IP allowlist requires the user's tester IP/CIDR choice; do not infer it from
this execution host. A password proxy alternative requires explicit selection
and review of trusted forwarding headers.

The existing Dockerfile is the proposed portable packaging unit. Source upload
to Launch with AWS, automatic database/auth migration and local overlay of a
generated snapshot have not been performed or selected. The existing Docker
path preserves the Supabase architecture and dirty working tree.

## Owner review and dependencies

Root assigned Backend `/root/aws_staging_backend` and DB
`/root/aws_staging_database` through live agent tools. Both accepted their
repository-only review under AGENTS standing cooperation and returned findings.
Neither changed files, read private configuration, ran tests or made connected
service/database requests.

Backend contract: normal `node dist/index.js`, NODE_ENV=production, PORT=5000,
HTTPS APP_URL and SESSION_SECRET of at least 32 characters. Required runtime
inputs include DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
SUPABASE_SECRET_KEY and OPENAI_API_KEY. Optional provider/Maps/admin settings
must be deliberately scoped. Ordinary startup leaves the local sandbox billing
runtime dormant; do not invoke billing:dev. Notification flags initially remain
false, without a notification worker/provider credentials. Register the eventual
HTTPS APP_URL/api/callback in Supabase only under the selected connected scope.

Audit currently pins application source hbkooiknruimukkhshrk, audit destination
ynygqodmtgjrngiudalw and development principals. AUDIT_ENVIRONMENT must literally
be development when enabled, even with NODE_ENV=production. Preserve activated
capture; do not silently disable it or retarget audit. The HTTP image does not
currently bundle the separate audit worker: owner-accepted delivery is a release
dependency, not something proven by healthy HTTP. A separate staging database
requires a reviewed application/DB contract change.

The application pool allows five connections; fmt_app_dev has a total limit of
five. Account for the local app and rolling overlap before launch. Do not raise
limits or change principals automatically. A single task alone does not prove
that concurrent sessions/processes leave sufficient capacity.

DB review confirms the audit foundation, location integration, service-view
extension and eight billing/audit migration stages already have committed,
verified evidence. Do not reapply them or revive their historical blockers.
Notification 0014/0015 execution is user-reported on localdev PostgreSQL 17.11,
not agent-verified on the proposed AWS app's Supabase target. Current code needs
the exact 33-table schema even with notification provider flags false. A bounded
owner preflight must reconcile actual catalog state and current readiness gates.
See [notification DB handoff](notifications-db-handoff.md),
[audit completion](audit-completion-execution.md),
[service-view evidence](audit-service-view-execution.md) and
[billing DB handoff](monthly-subscription-database-handoff.md).

Health paths precede session middleware. /health/live makes no DB query;
/health/ready performs SELECT 1 and returns no private details. Startup does not
run migrations. Session-store construction does not create tables or immediately
start pruning; the first session store operation starts the timer. Normal use
can persist/touch/delete sessions, prune expired sessions and capture audit/domain
events. Health-only permission is distinct from permission for test login, service
details, booking or preference operations.

## Execution sequence after selections

1. Record hosting/cost, exact DB/credential scope and access restriction. Confirm
   the Region in AWS Settings > View all projects > Overview > Additional Info >
   Region if needed; local setup already records eu-north-1.
2. DB owner performs only the named, authorized bounded principal/TLS/schema and
   connection-budget preflight. Preserve stop-on-failure/no-retry instructions.
   No db:push, migration retry, owner-credential use or ACL repair follows a
   failed preflight. Return any actual missing schema/decision to its owner.
3. Prepare and review infrastructure files for the selected architecture and
   current app snapshot; isolate dirty work and exclude private files. Restrict
   secret permissions and transfer only required runtime values securely.
4. Build and verify the image. Docker was not found on PATH or at the checked
   standard installation paths, so no container build/runtime check has passed.
   Choose an authorized local Docker installation or AWS build service before
   image publication; a cloud builder needs reviewed source filtering, spend
   scope, temporary artifact retention and cleanup. Do not upload the whole tree.
5. Provision the selected resources in eu-north-1 with restriction in place
   before app exposure. Start only after DB/runtime/audit delivery acceptance.
6. Verify no unauthorized access reaches app/static/API routes, HTTPS and proxy
   trust, health probes, sanitized logs and owner-approved synthetic session
   behavior. Broader browser/domain tests need their exact scoped authorization.
7. Report the observed ACTIVE/healthy URL only after deployment verification.
   Ask whether to keep successful resources or clean them up to stop charges.

## Current verification and recovery

### Selected-path progress

DB owner completed the first connected read-only preflight successfully:
all four exact principals/TLS/caps and all 14 current 33-table readiness flags
pass. Zero other same-role connections at individual snapshots; not reserved
capacity. See [fresh evidence and protected handoff](aws-staging-db-preflight.md).
Public CA is explicitly allowlisted; no private key or runtime credentials enter
the image. Existing private inputs remain unchanged.

Frontend owner passed isolated production Vite and client/shared TypeScript;
see [frontend evidence](aws-staging-frontend-handoff.md). Backend passed pure
worker tests, production bundling/refusal and reviewed proxy topology;
see [Backend handoff](aws-staging-backend-handoff.md).

Root's `node deploy/aws/test-staging-proxy.mjs` passes with loopback-only mock
servers. Sandbox networking initially refused the mock connection; the approved
network-capable execution path passed. Tests cover unauthenticated page/static/API
rejection, invalid credentials, exact cookie-free health probes, concurrent probe
coalescing/two-second sanitized caching, forwarded-header/auth stripping, origin,
cookies/body preservation and upstream-unavailable refusal. No real app/DB used.

Source manifest ace53f76dbcfd4139632000454c750072ee98f502b013405be798c0aa1589fd3
contains 360 allowlisted files / 2,864,259 bytes. Archive 850,436 bytes, SHA256
dc705173f81e57ce4b9270b6e5865c75e89abfc6f3e4789e112f14540e56f32e.
Git history, private dotenv files, dependencies, output/backups and unattached
assets are excluded. High-confidence credential patterns are rejected. Archive
uploaded successfully via a short-lived presigned URL; S3 size/AES256 verification
passed. Source is under a one-day expiry rule and will be deleted after build.

Supporting resources created in eu-north-1 for this deployment:

- S3 `fitsmytime-staging-build-674200807170-eun1-20261031`, blocked public access,
  SSE-S3, one-day source expiry.
- ECR `fitsmytime-staging`, immutable tags, AES256, scan on push.
- CodeBuild `fitsmytime-staging-20261031`, x86 Linux small/curated standard7,
  20-minute timeout, five-minute queue timeout, concurrency one. Live rate
  USD 0.005/minute gives USD 0.10 compute for a full 20-minute build, excluding
  storage/logging/key/transfer. No app/runtime credentials supplied.
- IAM `FitsMyTimeStagingBuild`, trust restricted to that exact project/source
  project identity; permissions limited to the exact source object, staging
  ECR repository and staging build log group. Registry auth needs resource `*`.
- CloudWatch `/aws/codebuild/fitsmytime-staging-20261031`, seven-day retention,
  encrypted with task-owned KMS key
  `a523b5bf-a47b-4161-9936-1fa1bf561c5f`. Key policy confines log service access
  to that group's encryption context. Remove temporary builder/role/source and
  schedule key deletion after logs are no longer needed; do not leave them as
  unreported recurring resources. ECR image storage is additional to Lightsail.

Buildspec verifies the actual Linux runtime image with isolated mock proxy tests
and required artifact presence before publishing. Failure aborts publication;
post-build publication explicitly checks CODEBUILD_BUILD_SUCCEEDING.
The first StartBuild call failed with AccountLimitExceededException:
`Cannot have more than 0 builds in queue for the account`. No automatic retry.
Inspect actual service quotas and obtain a supported build path before continuing.
ListServiceQuotas confirms every CodeBuild compute concurrency quota is zero,
including Linux/Small L-9D07B6EF (adjustable); ListBuildsForProject returns no builds.
The user explicitly approved **Submit the one-build capacity request** in this
chat, including AWS opening a Support case if needed. Executor: Codex `/root` via
the existing Codex-only fitsmytime AWS MCP connection. Exact scope: CodeBuild
Linux/Small L-9D07B6EF in eu-north-1, desired concurrent capacity one. No plan
upgrade, other quota increase or new hosting service. Inspect current quota and
request history first, submit once if needed, then record the actual result.

**Submitted, 31 October 2026 at 17:10:46 UTC (19:10 Riga):** fresh STS matched
the selected AWS project; GetServiceQuota still returned zero and request history
was empty. RequestServiceQuotaIncrease succeeded once, desired value one,
SupportCaseAllowed=true. Request ID
`2b7514310fe64c10957526723276c08aqmDZpxlm`; initial status **PENDING**.
No CaseId was returned at submission, so no Support case is yet confirmed.
No build retry, plan upgrade or Lightsail creation follows until the effective
quota is verified as at least one. AWS review is the current external dependency.
Follow-up GetRequestedServiceQuotaChange still returned PENDING and
GetServiceQuota still returned zero. No build retry was attempted. Request
submission is complete; image/deployment work awaits AWS's capacity decision.
Later status check returned **CASE_OPENED**: AWS Support case
`179346682900519`, last updated 31 October 2026 at 17:13:53 UTC (19:13 Riga).
This confirms case creation, not quota approval. Track in the Stockholm Service
Quotas console's Quota request history, CodeBuild Linux/Small request.

**Recheck attempted, 2 November 2026:** this chat's direct AWS MCP tools are
unavailable. An ephemeral read-only client used the existing Codex-only MCP
configuration without changing it; connection failed because the saved AWS
authentication expired, before quota APIs could run. Local CLI 2.39.2 verified;
same-profile `aws login --profile fitsmytime --region eu-north-1` opened the
browser and is awaiting the user's sign-in. No fresh quota status is established;
CASE_OPENED above remains the last verified observation. No build retry,
deployment, new quota request or plan change was performed during this recheck.
After the user's sign-in follow-up, the MCP connection still reported expired
credentials, so Root used the already signed-in AWS Console as a read-only
fallback. Refreshed the exact eu-north-1 CodeBuild Linux/Small quota details on
2 November: **Case Opened**, requested value one, **applied value zero** (AWS
default one is a separate field). Support case remains 179346682900519. This is
a fresh console observation, not renewed CLI/MCP authentication or quota approval.
No increase request, support reply, build retry or deployment was submitted.
The unfinished CLI sign-in process was cancelled after the console status check;
no pending local authentication helper is intentionally left running.

Prepared: scoped source/build files, protected runtime inputs, public CA,
owner evidence, connected DB preflight and supporting build resources. Not
completed: Linux image verification/publication, Lightsail creation, cloud
app/worker activation or live URL. No fresh browser/locale matrix was run. Language
acceptance is en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

Preserve existing dirty source and applied SQL. The supporting cloud resources
above need explicit cleanup tracking even though no service is deployed. Delete
temporary source/builder/role/logs and schedule KMS deletion when abandoned;
confirm the staging ECR repository is empty before removing it. After a future
deployment, stop the new staging workload first, reconcile uncertain
audit/DB outcomes, then delete only this deployment's authorized cloud resources
to stop charges. Keep database data, migration history and existing audit records;
do not claim that stopping compute undoes session/domain writes.

Sources: [AWS supported services](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html),
[ECS Express defaults](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html),
[Fargate pricing](https://aws.amazon.com/fargate/pricing/),
[Lightsail container pricing](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-containers.html),
[IPv4 pricing](https://repost.aws/knowledge-center/vpc-optimize-ipv4-usage).
