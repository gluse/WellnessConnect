# TASK-036 staging gateway session release — 6 November 2026

Status: **gateway fix published and version4 ACTIVE/RUNNING**. Live session HTTP,
frontend challenge-count and phone/desktop visual checks pass. Release complete.
User explicitly requested publishing the staging credentials fix. Root owns
infrastructure; assigned frontend owner owns browser verification; DB owner
accepted stop-before-start capacity review. Existing restricted micro/one-node
Stockholm target, approved databases and activation holds remain in force.

Gateway now mints `__Host-fmt-staging` after valid Basic authentication, including
when the app returns401. Dedicated256-bit signing key, HMAC-SHA256, origin/user/
password-verifier binding, fixed1hour absolute expiry (no cookie-only sliding).
Secure/HttpOnly/SameSite=Lax/Path=/, no Domain; canonical tokens, future/expired/
duplicate/tampered tokens reject. Owned cookie and Basic credentials are stripped
before upstream; app cookies/status401 preserved; app cannot overwrite reserved
gateway cookie. Exact sanitized readiness remains the only public exception.

Root's mock regression passed in the production Linux image: tamper/duplicate/
future/expiry, signer/origin/user/password rotation rejection, app401 cookie mint,
cookie isolation and original forwarding/probe/security checks. Frontend owner's
actual pinned-local-HTTPS Chrome proof passed: exactly one initial challenge,
eleven GET/POST200/401 steps without extra prompts, absolute lifetime, one new
challenge after expiry. No live app login/DB write in these regressions. See
[frontend session acceptance](aws-staging-session-frontend-handoff.md).

Three-file overlay snapshot `outputs/aws-staging-build/source-gateway-9QN3vf`,
manifest87c7754c5e861d7a8b0325504818d60ca1a2857c6f936cf1a8bffed48ad25fea.
Uses exact local deployed base image283569798ce4701a333c4d05992b94618c5e5a6016b644346d4d0e559fec1a02,
copies only gateway source; no app rebuild or current unrelated source inclusion.
Published native image `:fitsmytime-staging.app.2`, digest
sha256:7019f3d5f3f858fbbcbee7d8fa819c83225e29f963c42b279cb699f1e7432256.
Only the gateway container will change image. App/worker stay app.1.

Live baseline is now version2 (external change since initial version1). Root
reads actual configuration in memory, preserving all app/worker/env/endpoint
settings; checks DB/audit targets/flags and worker config match original approved
version1, activation holds preserved. Full-spec fingerprint
259407ccb5a76631dcefbb5a1f8d8b5f390182e977eb3cf4478210d456a1ac50.
No raw deployment or environment responses are persisted. Release script refuses
if configuration changes before stop/deploy. Dedicated signing secret is only in
new ignored owner-only protected `.env.aws-staging-gateway.local` and gateway
environment; existing staging username/password remain unchanged.

Controlled plan: disable existing service, verify DISABLED (AWS documents all
containers shut down), run DB-owner-delegated capacity-only check once for zero
other connections in all4 roles, then create replacement deployment from actual
old spec with gateway image/signing-key only changed and enable as required by
API state. Any capacity failure stops without retry/killing sessions/raising caps.
If API rejects deployment while disabled, restore original as needed and review
safe maintenance strategy; never blindly retry or overlap DB runtimes.
Preparation/local regressions and image publication complete before downtime.
The release helper includes guarded original-service resume for recovery.

Live acceptance after ACTIVE: same app/worker configuration, gateway cookie/
no-Basic reads, rejected tampering and unauthenticated access, readiness privacy,
app401 preserved, healthy audit worker; frontend en/lv/ru guest smoke with EXACTLY
one browser challenge. No live failed POST/login/email/OAuth/content writes.
All other languages/RTL remain deferred. Google configuration is preserved;
this release does not claim successful Google or app-account sign-in.

## Controlled transition evidence

AWS confirmed version2 service DISABLED. Root executed the DB owner's first
delegated capacity-only token once, exit0, all4other-connection counts0; no writes,
claims, readiness reruns or retry. CreateContainerServiceDeployment while disabled
returned InvalidInputException once. No replacement version was created. Root
resumed unchanged version2 and confirmed ACTIVE/RUNNING before revised release.
The disabled-create failure is recorded, not counted as deployment success.

DB owner accepted a supported zero-DB maintenance transition and delegated one
distinct new capacity check after maintenance ACTIVE, all previous versions
INACTIVE, no pending version, exact zero-DB commands verified and30s grace.
Root created maintenance version3 once: original images/env/endpoint preserved,
app/audit worker run only idle Node commands, gateway uses built-in Node HTTP
readiness200/public503 with no upstream or database imports. It cannot serve
application/private routes. This transition creates no additional AWS service
or capacity, and cannot overlap a new database consumer with the old runtime.
Maintenance3 reached ACTIVE/RUNNING with no next deployment. The guarded release
helper verified exact no-DB commands/env and all previous versions INACTIVE.
After30s grace, Root ran the distinct maintenance capacity token once: exit0,
all4other-connections0, TLS/caps unchanged, all probes closed, no writes/claims.
DB owner recorded both successful checks as consumed; neither was a retry of a
failed database check. Root then created actual fix deployment4 once from
version2 app/worker/endpoint configuration. Gateway imageapp.2 plus separate key
are the only intended changes. Version4 is ACTIVATING; maintenance3 remains the
active no-DB deployment until health acceptance. No re-enable/overlapping DB
runtimes are needed in this revised flow.

New live status checks filter container logs from the current candidate's
creation time, avoiding stale healthy reports from earlier versions. Session
HTTP verification will be saved separately as
`outputs/aws-staging-build/live-gateway-session-result.json`, preserving earlier
gateway evidence. Frontend smoke writes separate `live-frontend-session/` data
and asserts exactly one Basic challenge plus secure HttpOnly session storage.

## Live replacement acceptance

Actual deployment4 reached ACTIVE/RUNNING, no pending deployment. Guarded
configuration verification passed: app and audit-worker entries and endpoint
exactly equal version2; gateway differs only by exact app.2 image and new signing
key. No current app/frontend source rebuild or Google/provider flag change.

Live HTTPS checks passed with fresh candidate-only runtime logs: application
listening, worker healthy with sourceFailures0/destinationFailures0/captureGaps0.
Unauthenticated pages/API/assets remain401 challenges; exact sanitized readiness
200/cookie-free; authenticated HTML200/noindex/HSTS. Issued gate cookie has
Secure/HttpOnly/SameSiteLax/host-only/Path=/ and MaxAge3600. Cookie-only auth-user
GET401 has no WWW-Authenticate; following cookie-only home GET200 succeeds.
Tampered cookie is rejected401. No live login POST, email, OAuth or content write
was used. Evidence `outputs/aws-staging-build/live-gateway-session-result.json`.

Frontend owner reports live Chrome guest smoke exit0 with EXACTLY1 Basic prompt
across en/lv/ru x320/390/1280 plus landing/category reads; no runtime errors or
unexpected traffic. Secure cookie exists and is not visible to document.cookie.
Evidence `outputs/aws-staging-build/live-frontend-session/evidence.json`, separate
from historical smoke, SHA256
9ED608DC87AEB21BEE4576799D1684C6A16AF02FC175F01E58D5F6D3601635EF.
Frontend owner completed all six phone390/desktop1280 visual reviews and durable
[local/live acceptance handoff](aws-staging-session-frontend-handoff.md).
Google button remains visible from preserved version2 configuration; it was not
clicked and no successful account/OAuth sign-in is claimed.
Expiry/repeated POST401 proof is the local actual-proxy HTTPS regression, not a
live failed-login attempt. Existing username/password remain valid; refresh the
site to use the new gate session. Cookie-only requests do not extend its lifetime.
