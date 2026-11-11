# AWS current-app publication — database review, 9 November 2026

Status: **offline checks and the one assigned-owner connected read-only preflight
passed. AWS deployment remains separate and has not occurred.** Requester user, coordinator/infrastructure executor `/root`,
assigned DB Analyst/Developer `/root/aws_publish_database`. Owner accepted the
current-source compatibility review and necessary reversible preflight files
under AGENTS.md standing cooperation. The PostgreSQL practices skill and its
operations guidance were applied.

## Authority and scope

The current request is “please publish my app in AWS”. The existing selected
[TASK-036 publication](aws-staging-deployment.md#user-choices-and-authority)
uses restricted Lightsail staging and the existing development source
`hbkooiknruimukkhshrk` and independent destination `ynygqodmtgjrngiudalw`, with
**assigned DB owner execution of database preflight** and secure runtime
credential provisioning. This current assignment supplies that owner for a
fresh bounded read-only preflight; it does not assume an old named executor's
access or transfer a consumed gateway/manual operation. All earlier
stop-on-failure/no-retry rules and public-release/feature activation holds remain.

The old `TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06` grant is user-only and the
`source-gateway-7HaTMV` receipt shows its actual consumption and release version7.
It will not be rerun. This review creates a distinct 9 November owner preflight,
not a retry or recovery of that check. No schema/migration/ACL/role/data changes,
owner credentials, new backup waiver, worker claims or audit delivery are allowed.
The new command waits for Root's concrete-command review and fresh quiescence
proof before this owner executes it.

Root reports the existing service is currently **DISABLED**, deployment8, no
pending deployment, actual app/worker commands pointing at old image app.1,
gateway app.3. AWS disabled state shuts down containers. Root must not enable
those stale application commands after the photo expansion. Root is separately
preparing a safe AWS service transition; no fresh cloud transition is authorized
or claimed by this DB record.

## Current database and runtime contract

Current startup checks **38 metadata gates**: workspace-pricing profile32,
currency2, service-photo2, and custom-reminder-message2. The inherited profile
covers41 application tables and now pins completion-0008's active audit parser
and preserved predecessor chain. Historical 34-gate release evidence is not
current acceptance.

Reviewed existing applied evidence:

- [Photo0022](service-photos-db-handoff.md) committed once on8November with
  preserved original service/booking fields and36 passing gates. Old cover-edit
  writers are incompatible with backfilled gallery constraints.
- [Reminder0023](custom-service-reminder-db-handoff.md) committed once on8November,
  preserving original fields/counts and verifying the added empty message field.
- [Audit completion](audit-review-completion-2026-11-07.md) installed source and
  destination parser chains,26 business triggers and the independent restricted
  destination reader. These are historical execution records; the new preflight
  verifies current metadata without replaying any migration or fixture.

Five exact restricted principals are required: source `fmt_app_dev` cap5,
`fmt_audit_capture_dev` cap2, `fmt_audit_worker_dev` cap2; destination
`fmt_audit_writer_dev` cap2 and `fmt_audit_reader_dev` cap2. Application pool max5,
capture max2, worker/writer max1 each, viewer max2. Preflight connects sequentially
and closes each connection. It requires PG17, verified TLS with the existing
pinned Supabase CA, explicit read-only transactions, exact roles/caps/rights,
zero other connections for each principal and exact audit parser chains on both
targets. It invokes no enqueue/claim/accept or business query.

The new viewer needs four existing fields from protected `.env`:
`AUDIT_READER_DATABASE_URL`, `AUDIT_READER_USER_IDS`, `AUDIT_EXPORT_USER_IDS`,
`AUDIT_PRODUCER_CONTRACT`. Explicit selected IDs are copied, never inferred from
the administrator list. Reader URL remains the SELECT-only destination login;
only its CA path becomes `/app/certs/supabase-ca.crt`. Marker is
`completion-0008`; it activates current protected-read/denial/integration capture
independently of Auth producers. `AUDIT_AUTH_EVENTS_ENABLED=false` remains in
app/worker, all existing notification/product-activity activation flags remain
unchanged and dormant. Backend confirms this current-app/current-worker pairing.

The original selected secure-provisioning/deployment-spec-storage scope covers
Root's narrowly delegated preparation/injection of those four existing fields
for this release. No new reader membership, access selection, credential, ACL
or flag edit is delegated. Read existing values only after owner-only protected
ACL/ignore/symlink checks; keep them in memory and out of output/source/images.
Runtime settings fingerprint is SHA256 of compact JSON with keys in this order:
`AUDIT_EXPORT_USER_IDS`, `AUDIT_PRODUCER_CONTRACT`, `AUDIT_READER_DATABASE_URL`,
`AUDIT_READER_USER_IDS`, after the CA-path conversion. The pure exported
`prepareAuditRuntimeSettings` and `auditSettingsFingerprint` define this contract.

`runtimeDatabaseSha256` independently fingerprints the four exact container-form
URLs from the staging handoffs. Compact JSON keys are ordered
`AUDIT_CAPTURE_DATABASE_URL`, `AUDIT_DATABASE_URL`,
`AUDIT_SOURCE_DATABASE_URL`, `DATABASE_URL`, with original string values preserved
without URL normalization. Pure exports `runtimeDatabaseSettings(app,worker)` and
`runtimeDatabaseFingerprint(app,worker)` define the contract. Root must compare
this digest with the actual disabled live baseline credential strings in memory
before cloning its runtime. A mismatch stops release; a local preflight does not
prove an unrelated live credential.

## Concrete preflight

New runner:
`scripts/aws-publish-db-preflight-2026-11-09.mjs`.

For the currently disabled version8, reviewed command:

```powershell
node --import tsx scripts/aws-publish-db-preflight-2026-11-09.mjs outputs/aws-staging-build/source-c68nNM --execute-release=TASK-036-PUBLISH-2026-11-09 --disabled-version=8
```

Root first writes `disabled-ready.json` inside that reviewed snapshot after a
fresh AWS check: `service:fitsmytime-staging`, `region:eu-north-1`,
`isDisabled:true`, `serviceState:DISABLED`, `currentVersion:8`, `noPending:true`,
`fingerprint` of the actual current spec and `verifiedAt` UTC. Wait at least30s;
proof must remain under15minutes old. Current reported fingerprint:
`8a3596cc579dda6acdf1c4e540e5c865a710a0642a525f574e49026e9cae16c0`.
Root must keep AWS/local DB consumers stopped during the owner check.

The runner also accepts a separately reviewed exact database-free ACTIVE
maintenance proof via `--maintenance-version=N`; it requires all previous
deployments inactive, no pending version (Root verified), exact no-DB commands
and fresh30s drain. It cannot treat an old ACTIVE application as maintenance.

Before private reads or sockets, the runner validates current readiness-source
hashes against the snapshot manifest and exclusively creates a global
`outputs/aws-staging-build/db-release-preflight-2026-11-09-attempt.json` guard and
a per-snapshot `db-release-preflight-2026-11-09.json` receipt. Any attempt/failure
consumes this grant; no new snapshot bypasses the global guard. It then validates
the two protected staging handoffs and the four selected `.env` fields, checks
all five roles/readiness and saves sanitized completion/field fingerprint only.
No private file edit or raw credential response occurs.

Success is scoped to the observed disabled/maintenance state. A later restart,
changed runtime/target or transition invalidates that capacity observation;
Root must coordinate a distinct fresh capacity-only check if needed, rather than
rerunning this grant. Any failure stops, keeps the service quiesced and retains
the receipt; no cap increase, session termination, retry or evidence clearing.

## Offline verification and recovery

Passed:

```powershell
node --import tsx scripts/test-aws-publish-db-preflight-2026-11-09.mjs
node --import tsx scripts/aws-publish-db-preflight-2026-11-09.mjs --plan
git diff --check -- scripts/aws-publish-db-preflight-2026-11-09.mjs scripts/test-aws-publish-db-preflight-2026-11-09.mjs
```

The mocked regression covers64 role/readiness scenarios, every mandatory gate's
failure, cap/version/concurrent-client/parser mismatch, reader base-access
rejection, close-on-failure/no-COMMIT behavior, dormant flags, explicit reader
selection and CA translation, stale/unsafe quiescence proofs and retired-token
rejection before private reads/sockets. All imports/plan/tests are inert with
respect to private configuration and connected databases. Connected results are
recorded separately below.

DB-only checks have no locale matrix. Shared task verification covers en/lv/ru
only; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred with supported
translations and historical evidence preserved.

Recovery for local preparation is reversal of only these two new scripts and
this handoff while preserving concurrent changes. No schema rollback is needed.
After a connected attempt, preserve its immutable guard/receipt and diagnose
before any distinct newly approved check. Do not restart the old application or
worker against current schema merely to restore service.

## Assigned-owner connected result

Root reviewed the exact runner, current snapshot, fingerprints and guarded
scope, then explicitly released the assigned owner's single command under the
existing selected publishing/preflight authority. Fresh disabled proof timestamp
06:33:18.080372Z was under3minutes old at execution. The service and local app/
worker were not started. Network execution was permitted by automatic review;
no execution grant was expanded to an owner account or old manual token.

The exact command above ran once from **06:36:28.071Z to06:36:35.401Z on9November**
(08:36 Europe/Riga), exit0. Results:

- Correct source/destination and five exact restricted principals verified;
  strict pinned-CA TLS and PG17/read-only transactions passed.
- All **38 current application metadata gates** passed, including current
  completion parser chain, gallery and custom reminder message readiness.
- App/capture/worker/writer/reader connection caps were **5/2/2/2/2** and every
  principal had **zero other client connections** at its sequential observation.
- Runtime rights and exact source/destination parser chains passed, including
  reader view access and denied base/write/permanent-DDL capabilities.
- All probe connections closed; **writes=false, claims=false, retry=false**.
  No business rows or raw credentials entered output, and no private config,
  ACL, schema, migration, fixture, event or worker delivery was changed.

Sanitized receipt:
`outputs/aws-staging-build/source-c68nNM/db-release-preflight-2026-11-09.json`.
Source manifest:
`7f365cace1371b482502cb7082a7516bbaaa437e828c2fd7cf76e94b10684dd7`.

Validated runtime-input digests for Root's in-memory comparison:

- `runtimeDatabaseSha256`:
  `cbc5399f479931130c3ef5f5c1c7be3f8c5f8aef6382cc739bee227cd805cbb7`.
- `auditSettingsSha256`:
  `569a0ada30062fe861bf305341bcb20d1c7547030af527ec3ace60efad255b2c`.

The global one-attempt guard remains consumed and must not be removed or reused.
This verifies the observed disabled state and selected credential settings, not
future capacity after another runtime starts. Root owns the final safe AWS
transition/new-target choice, input-digest comparison, integrated deployment and
runtime acceptance. Do not enable the stale image or claim publication complete
from this database result.

## Replacement capacity preparation and quota hold

Root reported the user's explicit YES to the proposed replacement
`fitsmytime-staging-20261109`, micro/scale1 in eu-north-1 at USD10/month base,
with temporary combined USD20/month-equivalent capacity and deletion of the old
disabled service **after successful new-service acceptance**. That supplies the
new target/spending choice; it does not authorize deleting the predecessor first.
The same source/destination and dormant-feature holds remain.

This owner prepared the distinct capacity-only command:

```powershell
node --import tsx scripts/aws-replacement-capacity-2026-11-09.mjs outputs/aws-staging-build/source-c68nNM --execute-capacity=TASK-036-REPLACEMENT-CAPACITY-2026-11-09
```

It accepts only a fresh30s–15min `replacement-capacity-ready.json` public proof
of project674200807170/eu-north-1, exact old service DISABLED8/no pending/unchanged
fingerprint and new service READY/micro1/enabled/no current or next deployment.
It checks the prior passed38-gate schema receipt and unchanged source manifest,
then exclusively consumes a **distinct** global/per-snapshot guard before private
inventory/sockets. It compares both runtime input fingerprints with the successful
schema receipt, then sequentially verifies all five exact principals/caps,
strictTLS/PG17/read-only and zero other clients using only pg_catalog metadata.
It does not repeat schema readiness, query business rows, claim/deliver events,
change files containing secrets or run app/worker code. Failed/uncertain results
retain the guard and stop without retry.

Pure mocks passed45 capacity scenarios including wrong identity/version/cap,
concurrent clients, TLS-establishment failure and close/no-COMMIT behavior, plus
unsafe/stale proof, incomplete schema receipt and old-authorization rejection.
The original64-scenario schema-runner regression and both inert plans still pass.
The only change to the earlier schema runner is an exported shared inventory
function; its consumed authorization/guard behavior is preserved.

**Execution remains held and the capacity grant is unconsumed.** Root then
reported the single AWS CreateContainerService call failed with
InvalidInputException because the project has reached its container-service
limit. No new service was created and Root made no retry. Old service remains
DISABLED8. Therefore the required old-present/new-READY proof does not exist and
this capacity command must not run. Quota diagnosis is Root's read-only AWS work,
not a DB failure or a reason to retry a consumed DB authorization.

An alternative deleting old service **before** new acceptance needs a fresh user
choice. No such permission is inferred from the earlier after-acceptance cleanup
approval. If selected later, Root and DB owner must first revise/review the fresh
proof contract to require exact old-service absence, new READY/empty state and
validated protected runtime checkpoint, while retaining one-shot/fingerprint/
no-writer safeguards. The currently prepared mode deliberately cannot accept
old absence or substitute it silently for a disabled predecessor.

Before any future authorized old-service deletion, Root should preserve a narrow
recoverable runtime checkpoint: only the reviewed active8 containers/publicEndpoint,
selected four Audit fields and release image/manifest/input fingerprints. Preserve
the exact gateway signer/password verifier and application/worker URLs/settings;
do not copy full history or arbitrary raw service responses. Use a new git-ignored
file with the existing validated owner-only protected ACL applied **before** any
content, optionally Windows DPAPI CurrentUser encryption so only ciphertext is
persisted. Immediately decrypt/roundtrip in memory and match the spec/credential
digests before claiming recovery evidence. Do not put plaintext in temp files,
argv, logs or source. This is within existing selected secure-provisioning
preparation and does not grant role/ACL changes, alter reader selections or
authorize service deletion. Root owns the exact checkpoint implementation and
the user's missing execution-order choice.

## Delete-first choice and revised capacity preparation

Root subsequently delivered the user's explicit **YES to deleting the old
disabled service first**, conditional on **checking ENV VARIABLES before doing
so**, then creating/publishing the same replacement. Root owns that in-memory
local/live/checkpoint environment audit and recovery-helper tests before deletion.
This is the newly selected destructive execution order; it does not lift any
database target, feature-activation, credentials, schema or no-retry limit.

Root prepared and roundtrip-verified Windows DPAPI CurrentUser checkpoint
`.env.aws-staging-release-checkpoint-20261109.local`, ciphertext SHA256
`ef020e3668689fa5388992a5944cc667d00ec3297207880cd42ece0a330bf5c6`.
Public preparation evidence is the final snapshot's
`encrypted-checkpoint-result.json`. Its historical
`deletionAuthorizedBeforeReplacement:false` records preparation before the new
user choice; it is not the later authorization record. The checkpoint's fixed
ciphertext, reviewed baseline and selected input fingerprints remain pinned.

The prior old-present replacement-capacity authorization was **unconsumed and is
retired**; its command now rejects before private reads. The sole current mode
is distinct:

```powershell
node --import tsx scripts/aws-replacement-capacity-2026-11-09.mjs outputs/aws-staging-build/source-c68nNM --execute-capacity=TASK-036-DELETEFIRST-CAPACITY-2026-11-09
```

Revised `replacement-capacity-ready.json` must attest project674200807170 and
eu-north-1, `deleteFirstAuthorized:true`, `environmentAuditPassed:true`, the exact
`checkpointSha256` above, fresh actual inventory
`oldService:{name:"fitsmytime-staging",absent:true}` and
`newService:{name:"fitsmytime-staging-20261109",state:"READY",isDisabled:false,power:"micro",scale:1,current:null,next:null}`.
`verifiedAt` is UTC; wait30seconds and execute while under15minutes old. A still
disabled old service is no substitute for confirmed absence under this choice.

Before consuming the new mode, the runner validates that proof, the original
passed38-gate receipt/current source manifest and public checkpoint metadata.
It hashes the actual ciphertext file and requires the fixed checkpoint hash;
it never decrypts it or prints payloads. After creating the exclusive global/
per-snapshot guard, private inventory must match both previously verified
credential fingerprints, and all five principals must pass the capacity-only
metadata checks. The global one-attempt file remains shared with the retired
preparation, so changing an argument/snapshot cannot create a second attempt.

Revised45-scenario capacity mocks, checkpoint/proof rejection checks, both retired
authorization rejections, the64-scenario original schema regression and inert
plan pass. No private file was read by those tests; ciphertext corruption is
tested using an in-memory untrusted byte buffer. No connected capacity execution
has run. Root must finish environment/recovery validation, perform its separately
authorized AWS transition, supply the fresh actual oldABSENT/newREADY proof, and
explicitly release this owner before the sole connected capacity command.

## Replacement capacity execution result

Root completed the user-requested environment audit and recovery-helper tests,
then deleted only the old disabled service and created the selected replacement
under the explicit delete-first choice. Root supplied fresh actual inventory at
**07:14:05.990102Z**: old service absent, new micro/scale1 service READY with no
current/pending deployment, conditional approval/environment audit attested and
the exact pinned encrypted checkpoint retained. No app/worker consumer had
started. Root reviewed the final capacity runner/mocks and explicitly released
this assigned owner to run the exact current command once.

After waiting for at least30seconds of fresh drain, owner execution ran once from
**07:14:53.433Z to07:14:58.715Z on9November2026** (09:14 Europe/Riga), exit0:

- Five exact restricted principals passed pinned-CA TLS, PG17, explicit read-only
  transactions and expected connection caps **5/2/2/2/2**.
- Every principal had **zero other client connections** at its observation;
  all probe connections closed before acceptance.
- Both runtime-input digests exactly matched the earlier successful38-gate
  receipt. The actual encrypted checkpoint matched its fixed ciphertext digest.
- **capacityOnly=true; writes=false; claims=false; retry=false**. No schema
  preflight was repeated, business rows read, private settings edited, privileges
  changed or worker/app started by this DB command.

Sanitized result:
`outputs/aws-staging-build/source-c68nNM/db-replacement-capacity-2026-11-09.json`.
Receipt SHA256:
`30bbb3610573e0cb2e807f5e2a3ac285644eadaa39e6118c7267d1020720bd24`.
The global `db-replacement-capacity-2026-11-09-attempt.json` is now consumed and
must remain. Do not rerun either today's schema grant or this capacity grant.

Root has the current DB-owner capacity acceptance for the first startup of the
reviewed current app/worker on `fitsmytime-staging-20261109`, using the exact
tested input fingerprints and unchanged activation flags. Root must reconfirm
actual empty-service/no-new-consumer state immediately before deployment and
perform the separately authorized AWS startup/integrated acceptance. This DB
result does not claim application health, worker delivery or publication success.

## Post-release audit warning classification

Root subsequently reported the exact replacement deployment ACTIVE/RUNNING with
current image app.4 and app listening. Its fresh worker log initially showed
all instance counters zero but existing aggregate backlog **234 quarantined,
0pending,0leased,0expired**. That is an inherited delivery warning, not a healthy
audit backlog. No current-worker claim or quarantine had produced those234.
After approved guest HTTP checks, Root's actual worker logs showed
**claimed2/delivered2, newquarantine0/retried0, sourceFailures0,
destinationFailures0/captureGaps0**, with the234 quarantines unchanged and no
pending/leased entries. This verifies current event flow separately from the
unresolved inherited quarantine. These are Root's runtime observations, not an
additional database test or replay by this owner.

Owner repository review found no documented prior234 cohort or reason. The
worker health code correctly returns attention for any quarantine/expiry or
old backlog even with no fresh failures. The existing restricted worker can
read only aggregate `audit_capture.delivery_health`: status/count, oldest
created/occurred times, max attempts, earliest next attempt and expired count.
That view exposes neither quarantine reason nor newest time bound; direct outbox
reads are denied by the accepted role contract. Therefore the exact cause and
affected event coverage remain unknown. No stale-parser explanation is claimed.

An optional bounded health-only diagnostic was prepared offline in
`scripts/aws-audit-backlog-diagnostic-2026-11-09.mjs` with injected regression
`scripts/test-aws-audit-backlog-diagnostic-2026-11-09.mjs`. It selects only those
existing aggregate columns, sanitizes at most4status rows and omits payloads,
event/user IDs and driver errors; no claim/function mutation is prepared.
Mock validation covers safe output/invalid status/count/time rejection,
restricted identity and close/no-COMMIT failure behavior. The inert plan and
original64-scenario schema regression passed.

Root explicitly determined the new worker logs were sufficient for this release
and instructed **no additional DB query**. Accordingly
`CONNECTED_EXECUTION_RELEASED=false` now rejects even the diagnostic's correctly
named CLI mode before any receipt/private read/socket. Its connected mode has
never run and no diagnostic guard/receipt was consumed. Consumed schema/capacity
grants remain untouched. Publication may report working current runtime with an
**unresolved inherited audit warning**; overall audit health must not be claimed.
Any cause investigation needing additional privileges or replay/requeue/delete
requires a separate concrete owner-reviewed scope and authorization, retaining
quarantined evidence and existing no-retry rules. No privileged inspection,
recovery, ACL change or deletion is authorized by this classification.
