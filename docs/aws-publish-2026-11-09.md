# AWS staging update — 9 November 2026

Status: **published and verified within restricted staging scope**. Replacement
deployment1 is ACTIVE/RUNNING with exact imageapp.4; the old service is deleted.
Environment, gateway/session and live en/lv/ru guest checks pass. User reports
resolving the sign-in redirect issue by adding the new staging Redirect URLs in
Supabase. Existing234 quarantined audit records remain a separate unresolved
operational warning; current worker delivery succeeds without new failures.

## Request and scope

User requested “please publish my app in AWS”. Root accepts the CI/CD publishing
assignment and reuses the selected restricted `fitsmytime-staging` Lightsail
micro/one-node service, profile `fitsmytime`, project `674200807170`, selected
Region `eu-north-1`. Preserve password restriction, existing source/audit targets,
activation holds and existing USD 10/month capacity selection. Public production,
new capacity, migrations, ACL changes and feature/provider activation are not
inferred. See [existing choices](aws-staging-deployment.md).

Root checked TASKS.md, coordination, release/runbook and public local receipts.
The last documented manual release has a version 7/app.3 receipt; that is local
evidence, not fresh AWS status. Consumed preflight/capacity authorizations must not
be reused. Existing manual-only executor restrictions remain in force.

## Owners and preparation

No reachable prior agents were present. Under AGENTS.md standing cooperation,
root assigned current-source review to Backend `/root/aws_publish_backend`,
Frontend `/root/aws_publish_frontend`, and DB `/root/aws_publish_database`.
Owners record acceptance, checks and any exact missing execution authority in:

- [Backend review](aws-publish-backend-2026-11-09.md).
- [Frontend review](aws-publish-frontend-2026-11-09.md).
- [Database review](aws-publish-database-2026-11-09.md).

AWS MCP guidance search and read-only SDK status stopped with expired login;
neither changed resources or connected to application databases. Existing-profile
`aws login --profile fitsmytime --region eu-north-1` is awaiting browser sign-in,
reusing the recorded same-profile renewal authorization. CLI 2.39.2 verified.

Local Docker Linux engine verified. `prepare-source.mjs` first created isolated snapshot
`outputs/aws-staging-build/source-qoj6QJ`, 537 files, manifest
`29cd2939c55408e7fa184e562ef5cc3adc8b857d5669a36953b859848e7b4288`.
The reviewed allowlist excludes dotenv, credentials, Git history and local output.
No application was started. Final owner acceptance and evidence follow below.

## Final prepared release and acceptance

Same-profile sign-in succeeded; AWS identity is the expected project. Current
AWS observation is service **DISABLED**, deployment8 with actual old application
and audit-worker runtime commands (image app.1), gateway app.3, no pending
deployment. Baseline fingerprint:
`8a3596cc579dda6acdf1c4e540e5c865a710a0642a525f574e49026e9cae16c0`.
The project remains Free/ACTIVE with USD99 credits; no Paid upgrade was performed.
Current micro power price was read from Lightsail: USD10/node/month.

Frontend and Backend owners made only the five necessary native-proof type
corrections: iterator inputs use Array.from and the existing selected synthetic
display name is explicitly narrowed to string. Full-project TypeScript passes.
Frontend isolated production build and settings/report/view-statistics Chrome
checks pass in en/lv/ru at320/390/768/1280. Backend production import/bundle,
startup, audit, gallery, reminder, statistics and14 native-auth groups pass.
Focused client type-compatibility checks pass. The full synthetic native-client
replay test retains a proved baseline adapter/error-mapping failure; that optional
native proof is not freshly accepted and its assertion was not weakened.

Final source snapshot: `outputs/aws-staging-build/source-c68nNM`,537 files,
manifest `7f365cace1371b482502cb7082a7516bbaaa437e828c2fd7cf76e94b10684dd7`.
Its Linux/amd64 image is `fitsmytime-staging:pc-7f365cace1371b48`, image ID
`sha256:586a4260b97e954a2f7a61f4ff3d98c3f58b998462a25b77643c387e3ac1bd64`.
Reviewed Docker build, actual isolated Linux gateway security regression and
production artifact checks pass. ApplicationStarted=false, Published=false.
Existing Vite chunk-size/Browserslist warnings remain.

Assigned DB owner executed the distinct9Nov preflight exactly once:
06:36:28–06:36:35UTC, all38 current gates, five restricted principals, verified
TLS/read-only/caps5/2/2/2/2, exact parser chains and zero competing clients passed;
all probes closed, writes=false/claims=false/retry=false. Root reviewed the
receipt, SHA256
`D9869A0F80F6E39F95CF86509EF94233583AF546FC59CE2A3FBB0C284C97AA10`.
The token is consumed; never rerun it. Later activation requires fresh applicable
capacity evidence coordinated with the DB owner, without reviving a failed or
consumed attempt. Historical migration0022/0023 receipts are preserved.

Root then used the reviewed read-only `deploy/aws/inspect-current.py` to compare
the actual disabled AWS baseline's four database inputs with the tested handoffs
and the four DB-owner-delegated selected Audit fields with their preflight
fingerprint, in memory. Both comparisons passed; activation holds remain intact.
Evidence: final snapshot `release-input-validation.json`; no secret values,
database connection or AWS mutation. Existing selected reader/exporter IDs remain
unchanged; only the reader CA path is translated for the container. Current app
and audit worker must use the same new image; old worker/image must not start.

## Concrete safe hosting choice awaiting the user

The former gateway release proved that AWS rejected creating a deployment while
the service was disabled. AWS documents that enabling restores its last active
deployment. That would start the old app/worker, which the photo DB handoff and
current owners explicitly prohibit. Root did not try this unsafe transition or
repeat the old failed disabled-deployment operation.

Recommended selection: create `fitsmytime-staging-20261109` in eu-north-1,
micro/scale1, retain password restriction and existing selected development
databases, then delete only the old disabled `fitsmytime-staging` after the new
site passes acceptance. New default HTTPS URL is expected. Temporary combined
base capacity is USD20/month-equivalent, prorated for overlap; after old-service
deletion USD10/month base remains. Applicable transfer overage/external services
and taxes remain additional. Disabled services are still billed. Credits are
not a spending guarantee. This target/additional spend/old-service deletion is a
new material choice, so it needs explicit user authorization under AGENTS.md.

Prepared sequence after that choice:

1. Reconfirm old service disabled/baseline unchanged and prepare selected runtime
   inputs matching the recorded fingerprints. Preserve existing gateway password,
   signing key, Google Maps/provider settings, endpoint health policy and holds.
2. Create the empty replacement, with no app/worker or database consumer:

   ```powershell
   aws lightsail create-container-service --service-name fitsmytime-staging-20261109 --power micro --scale 1 --profile fitsmytime --region eu-north-1 --query 'containerService.{name:containerServiceName,state:state,url:url}' --no-cli-pager
   ```

3. Wait for READY and publish the exact reviewed image into its own registry:

   ```powershell
   node deploy/aws/publish-local.mjs outputs/aws-staging-build/source-c68nNM --service=fitsmytime-staging-20261109
   ```

   Target option preparation is implemented and syntax checked. Its actual local
   `--check` passed with awsCalls=false. Default old-target behavior is preserved;
   unrelated target names reject. The runtime source snapshot is unaffected.
4. Obtain fresh DB-owner capacity acceptance while all consumers remain stopped;
   do not replay today's consumed schema preflight. Submit a complete SDK
   deployment in memory, using the returned native image reference for app,
   audit-worker and gateway. Clone the verified old specification, update APP_URL
   and gateway origin to the actual returned URL, and inject only the four
   selected/fingerprinted Audit fields. No raw environment response or secret
   command-line arguments/files. Store any new access handoff only with the
   existing ignored, owner-only protected-file procedure.
5. Wait for the exact new deployment ACTIVE/RUNNING/no pending, then verify fresh
   startup/worker health, public challenge/sanitized readiness, authenticated guest
   pages and signed gateway sessions. Assigned Frontend owns live en/lv/ru guest
   browser/visual acceptance; no live login, OAuth, email or business mutation.
6. Only after successful acceptance and explicit cleanup authorization, delete
   the old disabled service. This removes its old URL, images, deployment history
   and logs, not Supabase data. On new-release failure stop/diagnose, leave old
   disabled, and disable the new service if needed; never restore stale writers.

Sources: [AWS disabled-service behavior and billing](https://aws.amazon.com/lightsail/faq/),
[deployment lifecycle](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-container-services-deployments.html).
Current AWS MCP Lightsail skill and required local-image/deployment references
were retrieved before image publication preparation. Launch-with-AWS source
upload/migration was not used; the existing container path preserves Supabase.

## Validation and recovery

Test only en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
Record exact built/published/deployed image and candidate status separately.
Do not claim existing healthy deployments as acceptance for a new release.
Database startup/capacity checks must use current owner-reviewed commands and
proper executor scope, with no automatic retry or connection-limit changes.
Complete preparation before asking for any genuinely missing execution decision.

Preparation recovery is removal/reversal of attributable local files only.
Service rollback must consider current schema compatibility: the old app must not
be resumed blindly after service-photo/backfill changes. Do not interrupt the
current service until an accepted compatibility and recovery plan is recorded.

## Approved execution — 9 November 2026

User replied **yes** to Root's explicit proposal to create the replacement
password-protected Stockholm staging service, USD10/month base (temporary combined
USD20/month-equivalent during overlap), new URL, and delete the old disabled
service only after the new site passes checks. This is the missing target/spend/
cleanup authorization. Root executes infrastructure; existing DB/Frontend owners
resume scoped capacity/live-guest acceptance. No public production, plan upgrade,
DB schema/ACL change, credential rotation or activation-hold lift is inferred.
Keep the prepared source-c68nNM image and consumed preflight evidence unchanged.

## AWS service-limit refusal and prepared delete-first alternative

Root reconfirmed the exact disabled8 baseline and both input fingerprints, then
verified only the old service existed. The approved CreateContainerService call
for `fitsmytime-staging-20261109` micro/scale1 in eu-north-1 was submitted **once**.
AWS returned InvalidInputException: maximum limit of Lightsail Container Services.
No retry was performed. Read-only inventory afterward still showed only old
`fitsmytime-staging` DISABLED; project Free/ACTIVE with USD99 credits. No new
resource or application/database consumer started.

Service Quotas lists only adjustable Lightsail static-IP and instance limits
for this project; no adjustable container-service quota is exposed. AWS's
[quota reference](https://docs.aws.amazon.com/general/latest/gr/lightsail.html)
marks container-service count non-adjustable and warns newer projects can have
lower actual quotas. Root did not request Support, upgrade the plan, change
Region/provider or attempt another creation operation.

The approved cleanup order retained the old service until replacement acceptance.
Deleting it **before** replacement creation is a changed material choice and is
not inferred from the earlier yes. The old app must remain disabled; starting
it is still outside the selected safe transition.

Root prepared the independent local infrastructure recovery prerequisite:
`deploy/aws/prepare-replacement-checkpoint.py` verified the actual disabled8
spec/fingerprint, no custom domains, passed38-gate receipt, four exact database
inputs, selected four Audit fields and final local image identity. It persisted
only Windows DPAPI CurrentUser ciphertext in ignored, owner-only protected
`.env.aws-staging-release-checkpoint-20261109.local`. Before and after saving,
decryption in memory reproduced the exact payload. No plaintext temporary file,
credential argument/log, database connection or AWS mutation occurred. This is
an infrastructure settings checkpoint, not a database backup or proof that an
old AWS URL/history can be recovered.

Public evidence: final snapshot `encrypted-checkpoint-result.json`, ciphertext
SHA256 `ef020e3668689fa5388992a5944cc667d00ec3297207880cd42ece0a330bf5c6`.
The payload contains only the reviewed active containers/publicEndpoint, selected
Audit inputs and release identifiers; no raw service response/history or business
data. Root reused the DB owner's secure-provisioning/checkpoint delegation.

The exact local image remains verified. Backend/frontend preparation remains
accepted. Frontend prepared the pinned replacement live-guest preset without
private reads/requests. DB prepared and mocked45 scenarios for a distinct
capacity-only check; it remains unconsumed and must currently refuse because
the required new READY/empty service does not exist. If delete-first is selected,
DB must review an exact oldABSENT/newREADYempty proof bound to this verified
checkpoint and selected execution order before any connected check. Original
schema preflight and old manual tokens remain consumed and must not be replayed.

Proposed changed choice: delete only disabled `fitsmytime-staging` first, wait
for confirmed absence, create the same approved replacement once, publish the
exact local image, recover only reviewed settings from the encrypted checkpoint,
obtain owner capacity acceptance, deploy/verify current app+worker+gateway and
perform live guest acceptance. Old default URL, registry images, logs and history
are permanently lost; selected Supabase databases/Auth/Storage are not deleted.
Base capacity remains USD10/month rather than the previously proposed overlap.
On failure stop and diagnose without automatic retry or stale-runtime startup.
Root has **not** executed this changed destructive order.

## Delete-first approval and environment check — 9 November 2026

User explicitly replied “yes, but before you do, can you check env variables?”
to deleting the disabled old service FIRST then creating/publishing replacement.
This authorizes the changed order after environment checks pass; no further
confirmation is needed within that scope. Root checked before any deletion.

`release-replacement.py envcheck` passed against actual disabled8 settings,
protected staging app/worker/access/signer inputs and decrypted checkpoint.
All required inputs are present; staging credentials, signer/password verifier,
selected four Audit inputs, baseline fingerprint and independent app/worker
credential boundaries match. The existing APP_ADMIN_USER_IDS is intentionally
empty, which Backend confirmed is valid and independent of named Audit access;
Root corrected its overly strict initial nonempty guard, without changing settings.
App26/worker7/gateway5 keys are preserved; four selected Audit fields are added
at deployment. APP_URL and STAGING_ORIGIN will use the returned new HTTPS URL.
Maps key is configured; no separate server-geocoding key is in live settings.
Google/Facebook/Apple enabled and Microsoft disabled are preserved exactly.
Notifications, product activity, Auth capture and billing remain held. Product
activity being held intentionally leaves view-count reports unavailable; Audit
service-view capture is a separate feature. No external provider validity is
claimed from value presence. Local-template differences are recorded by name,
not silently substituted for the live selections. No secret values were printed.

Public evidence: final snapshot environment-audit-result.json,07:08:13UTC.
Local exact-image inspection passed again with awsCalls=false. Offline replacement
safety tests passed: complete spec preserves secrets/holds/commands/endpoint,
rejects another target, and rejects stale/unsafe/incomplete capacity receipts.
DB prepared a new unconsumed DELETEFIRST capacity authorization requiring actual
oldABSENT/newREADYempty proof. Schema/manual tokens remain consumed/unrepeated.
Root now executes the user's approved deletion/recreation once, stopping on any
unexpected failure and preserving the encrypted checkpoint/source image.

## Approved transition checkpoint

After the requested successful environment audit and offline release safety tests,
Root submitted deletion of only old disabled fitsmytime-staging once. AWS then
confirmed both service names absent. Root created the same approved replacement
once under the newly selected delete-first state; AWS accepted it at micro/scale1
and it progressed PENDING → READY with no current/pending deployment. No stale
application or worker was started. The old service is gone; no overlap charge
remains. Supabase resources are unchanged. Source image upload is in progress;
capacity acceptance and deployment/live checks remain pending. New endpoint is
read from AWS, not constructed; publication will be claimed only after ACTIVE
and actual guest/runtime acceptance.

## Replacement image and deployment submitted

Exact local image digest586a4260b97e954a2f7a61f4ff3d98c3f58b998462a25b77643c387e3ac1bd64
was uploaded and registered as :fitsmytime-staging-20261109.app.4. Root checked the
publication receipt against the prepared source manifest and local image ID.

DB owner executed the distinct DELETEFIRST capacity command once at
07:14:53–07:14:58UTC; all5restricted principals had zero other connections,
verified TLS/read-only/PG17 and caps5/2/2/2/2. Inputs/checkpoint match the previous
passed schema preflight. Root independently reviewed receipt/hash30BBB3610573E0CB2E807F5E2A3AC285644EADAA39E6118C7267D1020720BD24.
No schema rerun/writes/claims/retry occurred; both current grants are consumed.

Root rechecked oldABSENT/newREADYempty, compared all inputs and the registered
digest, then submitted deployment1 once at07:16:06UTC. App, audit-worker and
gateway all use exact imageapp.4. Only image references, new origin APP_URL/
STAGING_ORIGIN and four selected Audit fields differ from the verified old spec.
Candidate spec fingerprint2a1d2cc7cf514021490ccc690b29e65d74c1f16e5eef3b690034c6fdbc67270b.
New ignored owner-only protected access handoff .env.aws-staging-access-20261109.local
preserves the prior staging username/password with new origin; credentials were
not printed or passed in command arguments. Initial state ACTIVATING/DEPLOYING.
Root is waiting for exact candidate acceptance; no success/live claim yet.

## Final acceptance and user redirect correction

The exact replacement deployment1 reached **ACTIVE/RUNNING**, no pending version.
Root verified full spec fingerprint against the submitted candidate, all three
containers using :fitsmytime-staging-20261109.app.4, and old-service absence.
Endpoint:
https://fitsmytime-staging-20261109.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com/
Base capacity remains USD10/month, micro/scale1; no old-service overlap remains.
External service/transfer/tax costs remain separate. The selected project stays
on its existing plan; no plan upgrade or quota change was performed.

Agent live HTTPS checks passed: unauthenticated page/API/assets challenge,
exact sanitized cookie-free readiness200, authenticated guest HTML200/noindex/
HSTS, Secure/HttpOnly/SameSite=Lax/host-only session cookie, preserved app401
without another Basic challenge, following cookie-only page200 and tamper401.
Evidence: outputs/aws-staging-build/live-gateway-session-20261109-result.json.
Existing staging credentials apply at the new URL; values are not reproduced.

Frontend owner completed live Chrome en/lv/ru320/390/1280 guest acceptance,
exactly one Basic prompt, secure script-inaccessible session, current public
search200, labels/navigation/reflow, zero runtime errors/unexpected requests.
All six final phone390/desktop1280 login screenshots were reviewed by the owner;
Root additionally inspected Latvian phone and Russian desktop screenshots.
Evidence SHA256515A761F3B0C089CEC2F69809E5A4F573461B818CAD925649E819E935E1A0B28.
An initial historical runner expected the unused Landing component and omitted
current paginated public search from its allowlist. The failed evidence is
preserved; source-backed replacement-only test correction passed without changing
application source or the deployed image. No live login submission/OAuth/email/
booking/business mutation was performed by these checks.

Current worker delivery was independently observed after the guest traffic:
claimed13/delivered13, matching0/retried0/newQuarantined0/stale0,
sourceFailures0/destinationFailures0/captureGaps0, pending0/leased0/expired0.
Final filtered health observation was09:32:08Europe/Riga (07:32:08UTC).
Overall worker status remains **attention** because **234 inherited quarantined
records** remain. Before guest traffic, this new worker already observed234 while
its claimed/quarantined counters were0; later successful delivery did not add any
quarantines. The cause and historical coverage of those records are unverified.
No replay, reset, deletion, privileged query or extra DB diagnostic ran. The DB
owner preserved an explicitly held offline aggregate diagnostic; recovery needs
separate accepted investigation/operation scope. Do not describe global Audit
health or historical completeness as passing from this release.

The user subsequently reported: **“Sorted myself. Had to add new staging Redirect
URLs in Supabase.”** Record this as a user-performed redirect configuration fix
and user-reported resolution for the new origin. Root did not perform or verify
that management change or a fresh account/OAuth login, and does not infer that
all providers were tested. No further redirect edit or login retry is needed in
this publishing task.

Restricted staging publication and its scoped acceptance are complete. Public
production, notification/billing/product-activity/Auth-capture activation,
quarantine repair, physical-device/other-browser/assistive-technology testing and
the deferred ar/RTL,zh,fr,de,hi,ja,pt,es matrix are not newly accepted. Existing
native-client synthetic replay failure remains documented separately; the five
type corrections, full TypeScript and affected focused checks pass.

Recovery: retain the reviewed local source/image, consumed receipts and ignored
owner-only DPAPI checkpoint. Do not restore the old app against current schema,
reuse consumed preflight/capacity tokens or replay historical quarantines. If a
future release needs stopping, coordinate disabling only the new service; that
does not stop capacity charges. The user requested keeping this service running.
For a separately approved future teardown, the exact command is:

```powershell
aws lightsail delete-container-service --service-name fitsmytime-staging-20261109 --profile fitsmytime --region eu-north-1
```

No new-service teardown was requested or executed.
