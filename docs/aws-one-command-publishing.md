# Publishing from this PC or CodeBuild

**Latest verified outcome,15November2026: hosted migration and deployment
succeeded.** Source0024/0025 committed once; current42/all44 checks and five-role
capacity passed with closed probes and unchanged existing service/booking data.
Staging deployment3 is ACTIVE/RUNNING/no pending; all three containers use the
exact registered image/digest. Root gateway restriction and sanitized readiness
passed. Original hold bytes were archived and both active holds released only
after verified success; all consumed attempts remain. Worker/browser acceptance
and the separate PC build-path acceptance remain pending; TASK-066 stays open.
See [actual recovery execution](#reviewed-maintenance2-recovery-execution--14november2026).

**Current status,13November2026:** the corrected-source CodeBuild run succeeded
and its exact image/digest is registered in Lightsail. The subsequent approved
cutover stopped before migration SQL; maintenance version2 is ACTIVE/no pending.
The new application image is not deployed. See
[verified publication](#verified-image-publication--13november2026).
The builder is retained under the user's existing keep choice.
The first hosted upgrade CLI is now integrated/offline-tested and owner-reviewed;
the user approved its exact no-backup cutover. That one run passed old41 preflight,
activated maintenance version2, then stopped at the migration setup safety guard
before any migration SQL was dispatched. Website is currently maintenance503;
no candidate was submitted or retry/rollback performed. See
[approved execution and stopped result](#hosted-release-without-backup--13november2026).

**Recovery update,15November:** the separately approved recovery has now committed
hosted0024/0025 once and verified current42/all44 checks/unchanged existing data/
closed probes. All five restricted-role capacity checks passed. Exact candidate
deployment3 is submitted/ACTIVATING; activation/HTTP acceptance is still pending.
Both active holds and all original/new attempts remain preserved until success.
The old41 application must no longer be resumed after these commits.
Subsequent activation and final verification succeeded as recorded in the latest
outcome above and final execution evidence below; these progress observations
remain historical.

Initial status, 11 November 2026: both entry points and the common release workflow are
prepared and pass offline tests. Neither path has made a connected call, built a
new image, published or deployed during this task. Live acceptance is incomplete.
The user subsequently approved the exact in-memory handoff to the local DB-owner
capacity checker. That integration and its mocked verification are implemented;
current hosted-schema acceptance and live setup/release checks remain separate
prerequisites.

**Resumed preparation:** the first hosted41→42 transition now has an injectable
CI coordinator with immutable attempt/phase records and DB pre-action checks.
The exact source-only credential/migration runner is now implemented and
mock-tested under the user's subsequent `approve`; live CLI wiring remains. The ordinary
commands still require actual current42 acceptance and do not apply migrations.
See the [hosted transition implementation and remaining credential decision](aws-hosted-release-sequence-2026-11-11.md#resumed-ci-coordinator-and-next-authorization).

**12November runner preparation complete:** source reader, retained-session app-URL
pipe and one-shot hosted DB runner pass84 runner/41 input/38 adapter scenarios,
plus13 Python boundary tests and existing regressions. No real private read,
credential transfer, database/AWS operation, migration, build or release occurred.
See [approval, exact grants, evidence and remaining release work](aws-hosted-release-sequence-2026-11-11.md#approved-runner-preparation--resumed12november2026).

**Guided setup status,13November:** the user prepared CodeBuild snapshot
`outputs/aws-staging-build/source-dIMNFz`, release
`966d174c-9ab5-4c3b-bf1c-8a8eb8c04276`, with the same source hash as the earlier
reviewed snapshot. The user reported project674200807170 and service deployment1
ACTIVE/no pending version; complete service/configuration validation is not claimed.
The user then supplied the exact `DescribeStacks` command for
`fitsmytime-publish-builder`, profile`fitsmytime`, eu-north-1, limited to status/ID.
Root/CI executed that read-only scope. The restricted environment could not reach
the endpoint; the network-enabled check returned `ValidationError`: stack does
not exist, with AWS retry attempts disabled. No stack/resource/service mutation,
environment output, private-file read, database operation, build or deployment.
Builder creation/IAM/cost and migration/release execution remain unapproved.
Next guided step is a bounded read-only project-plan check before presenting
concrete setup/pricing choices; no plan/billing API has been called by Root here.

**Builder created,13November:** user reported Free plan/available credits and
quota15, supplied the exact service ARN/basic template result, and explicitly
approved creation of the build-only stack after target/audit/change-set checks.
Root verified the live identity/service, current CloudFormation management-event
history (default90days; no configured durable trail), exact server template and
six Add actions/no service validation errors, then executed that change set once.
`fitsmytime-publish-builder` and all six resources are CREATE_COMPLETE. Public
project/key/source/log bindings and concurrency1/retries0/timeouts match; build
history is empty. Existing website remains version1 ACTIVE/no pending. No source
upload, build, DB operation, runtime/private dotenv access or application release.
Creation approval does not authorize any of those later operations. Public receipt:
`outputs/aws-staging-build/builder-setup-20261113-result.json`.
See [creation evidence, outputs, retention/cost and recovery](aws-publish-builder-2026-11-11.md#approved-builder-execution--13november2026).

| Command | Build location | Requirements |
| --- | --- | --- |
| `npm run publish:aws:local` | This PC, Linux Docker engine | Node, Docker Desktop, Python with boto3, current AWS sign-in |
| `npm run publish:aws:codebuild` | AWS CodeBuild Linux/Small | Node, Python with boto3, current AWS sign-in, approved/provisioned builder stack |

Running either command without flags prints the plan and makes no AWS/database
calls. Both use profile `fitsmytime`, project `674200807170`, selected Region
`eu-north-1`, and the existing restricted service `fitsmytime-staging-20261109`.
No service replacement, scaling, public-access change, feature activation or
database migration is automated. Both deploy app, audit-worker and gateway from
the same exact registered image, preserving the existing complete hosted
configuration in memory. Local development dotenv files are never loaded.

For `--publish` only, target inspection now reads public service identity,
commands/endpoint and status. It does not inspect or retain the private runtime
environment. `--inspect` and `--deploy` keep their full original runtime/hold
validation, and build-only inspection creates no baseline that could authorize
maintenance or deployment. Offline workflow34 and Python15 tests pass.

## Builder retained and next image-build proposal —13November

The user selected **keep it** for the reusable builder and associated ongoing
costs. Retention alone is not a source-upload/build or application-release grant.
The user subsequently replied **`approve`** to both the isolated exact SDK
installation and one existing-builder image build/upload, limited to30minutes,
with no database migration or website deployment. Root/CI is executing only that
two-part scope; prerequisites/failures stop, with no automatic retry. The source
at `outputs/aws-staging-build/source-dIMNFz` still matches all550 current
allowlisted files, hash
`a358b84e2e1560253b6691b2785446c4381fc0f6bb9c181f7dd39a755698f2cb`,
release `966d174c-9ab5-4c3b-bf1c-8a8eb8c04276`, image label
`src37cd3f8dfe0eebd7d4e0aba8`. No publication attempt/receipt exists for it.

The usable existing project validator interpreter is Python3.13.18 but has no
boto3. Registered system Python3.14/3.11 paths were checked offline and their
executables are absent. No software was installed. Proposed local dependency
preparation uses a separate ignored virtual environment
`outputs/aws-staging-build/publish-tools/python`, with
[boto3[crt]==1.44.2](../deploy/aws/publish-tools.requirements.txt) and required
dependencies from official PyPI, wheels only. CRT is required for the existing
`aws login` profile by the [AWS SDK credential guide](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html).
The validator environment, global Python/PATH, npm dependencies and application
files remain unchanged. After approval, the exact proposed local commands are:

```powershell
& .\outputs\aws-staging-build\validation-tools\python\Scripts\python.exe -m venv .\outputs\aws-staging-build\publish-tools\python
& .\outputs\aws-staging-build\publish-tools\python\Scripts\python.exe -m pip --isolated install --index-url https://pypi.org/simple --only-binary=:all: --disable-pip-version-check --no-input -r deploy/aws/publish-tools.requirements.txt
```

Validate installed imports/versions, `pip check` and required SDK models/CRT
offline before any AWS use. No alternate interpreter installation, global
package change, source build or automatic retry is implied if this fails.

Proposed next connected scope: Root/CI, profile `fitsmytime`, project674200807170,
eu-north-1, one source upload to the existing exact builder source bucket/key,
one Linux/Small build on `fitsmytime-publish-builder-build` (concurrency1,
timeout30minutes, retries0), isolated TypeScript/gateway/artifact checks and
native Lightsail image upload/registration only for
`fitsmytime-staging-20261109`. Use current native AWS sign-in, reviewed source
manifest and exact version-pinned encrypted S3 upload. Permit bounded public
identity/target/builder status/configuration and that build's diagnostics/status
checks. Successful registration yields a source/image/digest receipt with
`deployed:false`; no maintenance, DB/private-runtime extraction, schema probe,
migration, user/business action or application deployment is included.
Build minutes and source/log/key/image usage may consume allowance/credits;
no zero-cost promise or unverified regional dollar estimate is made.

After explicit local-install and one-build/credit-use authorization, and only
if dependency/source/builder/target checks pass, the proposed command is:

```powershell
npm run publish:aws:codebuild -- --publish --snapshot=outputs/aws-staging-build/source-dIMNFz --stack=fitsmytime-publish-builder --python=C:/Source/Private/WellnessConnect/outputs/aws-staging-build/publish-tools/python/Scripts/python.exe
```

At proposal time this command was not run. Stop on failed checks/build/upload/registration; retain
attempt guards and actual build state, with no retry/cleanup/deploy. Installation
and one image publication are now approved within the exact scope above; actual
execution evidence is recorded below. Existing database/cutover and
first-release CLI integration requirements remain separate; a built image does
not satisfy them.

### Approved SDK installation and one image publication

User replied **`approve`** to the exact isolated SDK install plus one30-minute
existing-builder build/upload proposal. Root created a separate ignored tools
venv with the existing Python3.13.18 and installed official PyPI binary packages:
boto3/botocore1.44.2, awscrt0.38.0, jmespath1.1.0, s3transfer0.19.3,
python-dateutil2.9.0.post0, urllib3 2.8.0 and six1.17.0. `pip check`, CRT imports
and required SDK models pass offline. No global PATH/Python/npm dependency or
validator environment changed. Public package versions/hashes and validation are
in `outputs/aws-staging-build/publish-tools/installation-result.json` and its
pip report; the immutable installation attempt remains.

All550 reviewed snapshot files still matched current source immediately before
execution. Root recorded the exact user scope in
`outputs/aws-staging-build/publication-966d174c-approved-scope.json` and invoked
the proposed `--publish` command once. Source upload/start succeeded; actual build
ID is `fitsmytime-publish-builder-build:a34660f4-72df-4e06-91bf-aedcba57faef`.
CodeBuild reports timeout30minutes and pinned S3 source version
`el_r6NIPzrGlUpwhmtqJWNHLr3nHK_1l`. DOWNLOAD_SOURCE/INSTALL/PRE_BUILD passed;
BUILD is in progress. No publication success or deployment is yet claimed.

A Windows CLI console-encoding failure affected one optional log display only;
reading that same diagnostic stream with UTF-8 succeeded. The actual build was
neither failed/restarted nor resubmitted by that display correction. No database,
private dotenv/runtime extraction, maintenance or application deployment was run.
Preserve `publication-attempt.json`, `cloud-build-result.json` and original source
snapshot; do not retry this consumed build authorization.

**Final build result: FAILED at native registry push.** Build
`a34660f4-72df-4e06-91bf-aedcba57faef` completed13November12:40:45 Europe/Riga.
Image compilation, full source TypeScript, isolated staging proxy checks and
production artifact checks passed. The image-upload helper emitted
`REGISTRY_PUSH_FAILED`; the old generic error did not capture Docker's exact
HTTP/error reason. Do not claim a fully proven remote failure cause. The local
publishing client stopped with no retry or release phase. Scoped image inspection
finds no registered image for its exact unique label. The website remains
RUNNING, version1 ACTIVE/no pending. No DB/private runtime or maintenance/deploy
operation occurred. Source ZIP/logs remain under existing retention; original
guards/receipts must not be cleared. Public final failure evidence is
`outputs/aws-staging-build/source-dIMNFz/publication-failure.json`.

### Prepared registry compatibility correction and new build scope

Root/CI inspected the upload helper locally. It used Node's unpadded base64url
for `X-Registry-Auth`, while the
[Docker reference implementation](https://github.com/moby/moby/blob/v28.1.1/api/types/registry/authconfig.go)
uses padded RFC4648 URL encoding and a padded decoder. The shared helper now
preserves that padding. This is a verified protocol-compatibility correction,
not proof of the precise lost remote error from the failed build. No historical
publication script, auth payload/recipient, IAM permission or existing log event
was changed or bypassed.

Registry push errors retain the original `REGISTRY_PUSH_FAILED` event and now
add only bounded safe reason categories and HTTP status. Raw daemon messages,
headers/tokens/passwords are not logged. The network request still runs once;
request/response/timeout failures do not retry. The cloud helper retains its
existing error/retry/deployed log and adds these safe diagnostic fields.

`node scripts/test-aws-registry-upload.mjs`:24 synthetic protocol/stream/error
scenarios pass, including all padding lengths, fragmented/final JSON, denied/
unauthorized/invalid-header responses, missing digest, invalid JSON, transport
failure/timeout and credential redaction. Existing workflow34 passes; affected
syntax checks pass. No Docker daemon or AWS call is used by those tests.

A fresh inert `--prepare` produced:

- Snapshot: `outputs/aws-staging-build/source-GxAVJf`.
- Release: `9c2d14c8-c8e6-48f4-8924-d1fdcd1d07a8`.
- Image label: `srcb9de33fbc298c44ea40489d9`.
- Source SHA256: `d8430fe753001cbbfdecd718df0426a39aab0ab3152a7e5250536a13489a9a69`.

All550 source files are present; only `deploy/aws/publish-image.mjs` and
`deploy/aws/publish-cloud-build.mjs` differ from the failed source. App/worker/
schema contents are unchanged. No new ZIP upload, build or image registration
was attempted for this snapshot. The SDK installation is already complete and
must not be repeated.

The next authorization to request is **one new image build/upload** on the same
existing project/Region/CodeBuild stack/service, with this exact new source and
label, the same30-minute/retries0 limit, bounded status/diagnostics/native
registration and allowance/credit use. No provisioning/IAM change, reinstall,
database access/migration, private runtime extraction, maintenance or app
deployment. The proposed command, not executed, is:

```powershell
npm run publish:aws:codebuild -- --publish --snapshot=outputs/aws-staging-build/source-GxAVJf --stack=fitsmytime-publish-builder --python=C:/Source/Private/WellnessConnect/outputs/aws-staging-build/publish-tools/python/Scripts/python.exe
```

The failed build grant does not authorize this new source/run. Keep the original
one-shot attempt and failure evidence intact; stop again on any failed check or
operation and report actual state. Live publication acceptance for the correction
is still pending.

**New source/run approved:** user subsequently replied **`approve`** to one new
build/upload with these corrected helpers, same30-minute/retries0 bound and
allowance/credit use, with no database migration or website deployment. Root
rechecked the24 offline upload scenarios, installed SDK dependency health and all
550 source bytes/no prior attempt for `source-GxAVJf`; those checks pass. Execute
only this new source/run. The earlier failed source/attempt remains consumed and
unchanged; no SDK reinstall or IAM/provisioning change is included.

### Verified image publication —13November2026

Root/CI executed the newly approved command exactly once for release
`9c2d14c8-c8e6-48f4-8924-d1fdcd1d07a8`, snapshot `source-GxAVJf` and manifest
`d8430fe753001cbbfdecd718df0426a39aab0ab3152a7e5250536a13489a9a69`.
The encrypted source upload was pinned to S3 version
`SNceaL.DJ_r4v0tY16Xm7g9qisypbZ2V`. CodeBuild
`fitsmytime-publish-builder-build:91cd82e2-b074-4617-80f6-8c0dd5204f86`
reached SUCCEEDED/COMPLETED,13:00:06–13:03:14 Europe/Riga. All recorded phases
succeeded, including image compilation, TypeScript, isolated proxy/artifact
checks and native registry upload/registration. No retry was performed.

Read-only Lightsail verification independently confirms:

- Image: `:fitsmytime-staging-20261109.srcb9de33fbc298c44ea40489d9.5`.
- Digest: `sha256:028f227729c1a93f8962bf5eeec74c7e9ef3b72dfaa733abb1e5df430a9c1fb7`.
- Registration:13November13:03:13 Europe/Riga.
- Existing service: RUNNING/micro/scale1, disabled=false, version1 ACTIVE,
  pending version null.

The approved build/upload is complete. No database connection/migration,
private dotenv/runtime extraction, maintenance, IAM/resource change or website
deployment was performed. Publication does not establish hosted-schema42 or
release acceptance. The hosted migration/first-release integration and exact
connected execution scope remain separate prerequisites; do not invoke ordinary
deployment against the old schema or replay either consumed publication attempt.

Keep the existing builder under the user's recorded choice; source/log retention
and ongoing key/storage costs remain as documented. Immutable public approval and
attempt records, source ZIP and `image-publication.json` are retained. The final
public verification receipt is
`outputs/aws-staging-build/source-GxAVJf/publication-verification.json`.
The prior failed build and its failure receipt remain unchanged.

### Hosted schema verification requested —13November2026

After Root clarified that the11November migration applied to the independent
local source only, the user replied **"yes you are right. please proceed"** to
checking the hosted database's current state before applying anything. Root/CI
routes this bounded dependency to assigned DB owner
`/root/hosted_schema_status_db` under standing cooperation. Target is only source
`hbkooiknruimukkhshrk/postgres`; scope is read-only schema metadata, no business
rows, migrations, maintenance or website deployment. Current state remains
unverified until actual successful results are returned.

Earlier runner/input approval expressly covered local preparation only; its
live protected setup-field read was never authorized. Finish the concrete
source-only metadata command and review its exact input/recipient before asking
only for any missing private-input access scope. No private file, connection or
AWS runtime environment has been read for this verification preparation.

DB owner completed the neutral catalog-only
[status SQL](../scripts/hosted-customer-notification-status.sql) and
[interpretation/access handoff](aws-hosted-schema-status-2026-11-13.md).
It handles absent/present/mixed migration markers without the old-only
preflight's assumptions, and makes no application-readiness claim. Both browser
control entry points failed before initialization with `failed to write kernel
assets` / system path not found, so Root could not inspect a signed-in SQL Editor
or run the check there. No UI interaction or connected operation occurred.
Next: user runs the complete SQL in source project's SQL Editor as `postgres`
and returns its single metadata row. This route avoids new credential-file
access; actual hosted state remains pending that result. No migration is to be
replayed based solely on presence markers.

**User-run status result received:** database/setup identity match, PG17 and
read-only=true;41 public tables; notification table, service `deleted_at`, named
constraint and runtime policy/direct ACL markers absent; policy count0; existing
app-to-runtime inheritance true. This confirms those new schema/runtime effects
are absent and is consistent with pre-0024 state. It does not establish the full
old41 preflight, recovery evidence, current42 readiness or any migration history.
Exact public result is retained in
`outputs/aws-staging-build/source-GxAVJf/hosted-schema-status-user-result.json`.
No agent DB/private access or migration/deployment was performed. The neutral
status-check step is complete; next preparation remains the integrated retained-
session maintenance/migration/release CLI and recoverability decision, before
any exact live cutover authorization is requested. Do not run ordinary `--deploy`
or apply hosted SQL manually out of that sequence.

### Hosted release without backup —13November2026

**Selected recovery choice:** after the backup-availability step, the user said
**"proceed without backup"**. Root records this as acceptance of no verified
backup for source `hbkooiknruimukkhshrk/postgres` during the proposed0024/0025
upgrade. It does not authorize a backup/export, restore, audit-destination schema
change, old migration replay or unrelated release. After a committed or uncertain
migration, stop and inspect; keep maintenance, retain the new schema/history and
never restart the old41 image automatically. SQL rollback cannot undo a completed
0024 commit. Loss of the retained session also loses its private baseline; public
receipts cannot reconstruct it. No encrypted checkpoint/automatic recovery is
implemented or claimed.

**Preparation completed:** Root/CI connected the existing retained Python session,
DB runner, pure phase coordinator and five-role capacity checker through
[`publish-hosted-cli.mjs`](../deploy/aws/publish-hosted-cli.mjs). The ordinary
publishing entry points retain their original gates. This first-upgrade command
uses the already registered exact image; it never builds/uploads again. All550
current source bytes still match the published manifest
`d8430fe753001cbbfdecd718df0426a39aab0ab3152a7e5250536a13489a9a69`.
New orchestration code is external to the built image; app, worker, readiness,
package and migration bytes are unchanged.

DB `/root/hosted_schema_status_db` accepted the dependency, implemented a pure
[final acceptance builder](../scripts/aws-hosted-final-acceptance.mjs) and issued
[conditional DB/caller review](aws-hosted-schema-status-2026-11-13.md#conditional-ci-caller-review).
Backend `/root/hosted_release_backend_review` issued
[conditional source/caller acceptance](aws-hosted-backend-review-2026-11-13.md#final-cli-caller-review).
The builder validates the actual committed SQL/current42/44-check/unchanged-data/
closed-client receipt before constructing final `verifiedApplied:true`; no
prepared true flag is accepted. Both reviews require actual live evidence before
runtime startup. Root is the proposed executor of these reviewed owner scripts;
neither code acceptance nor the no-backup choice grants live execution.

Offline verification passed: CLI27 scenarios plus option/inert-preview/private-
error-redaction checks; coordinator31; runner adapter38; workflow34; DB final
acceptance61; migration contract163; Python session16 tests. DB also reran runner84
and protected-input41 cases. Tests use mock sessions/processes/credentials only;
the mock workflow's maintenance messages are simulated. No real AWS/DB/private
configuration/maintenance/deployment call occurred. No UI locale matrix was
needed; future browser coverage remains en/lv/ru, all others/RTL deferred.

The proposed scope is reviewable at
`outputs/aws-staging-build/source-GxAVJf/hosted-release-approval.proposed.json`.
It is explicitly **proposed**, rejected by the CLI, and is not a user grant. It
pins12 orchestration/DB/capacity files plus both final owner-review documents,
the source/release/image/digest and expected existing baseline version1. After an
exact user grant, Root may write a separate `hosted-release-approval.json` with
that approval reference/state and a two-hour UTC expiry beginning at approval;
preserve the proposed artifact. A changed target/source/image/review/code or
failed/consumed attempt stops; no retry or guard reset.

**Exact next approval to request:** Root/CI, profile`fitsmytime`, project674200807170,
eu-north-1, existing `fitsmytime-staging-20261109`, release
`9c2d14c8-c8e6-48f4-8924-d1fdcd1d07a8`, image
`:fitsmytime-staging-20261109.srcb9de33fbc298c44ea40489d9.5`, digest
`sha256:028f227729c1a93f8962bf5eeec74c7e9ef3b72dfaa733abb1e5df430a9c1fb7`:

1. Inspect the original live runtime spec inside the retained local Python session
   only, verify version1/holds/identity and exact registered image, returning only
   public baseline/runtime/audit hashes and app-URL SHA256. Keep the complete
   private original spec in memory for the whole transition.
2. Permit the fixed DB runner `scripts/aws-hosted-migrate.mjs` to select only
   `.env.audit-setup.local` field `AUDIT_SETUP_SOURCE_DATABASE_URL` after existing
   ignore/owner-only ACL/no-link/stable-handle checks. Permit the Python session
   to send only the original app `DATABASE_URL` in memory via stdin to that exact
   local Node runner, once for preflight and once for migration. Verify pinned
   CA/TLS/exact source PG17/setup `postgres` and app `fmt_app_dev`; no other dotenv
   input, ACL change or alternate credential source. Full old41/38-check read-only
   preflight must pass before maintenance. No credential is logged/persisted or
   sent to the builder.
3. Enter the reviewed no-DB app/worker maintenance deployment once, preserving
   the original environment, gateway/access restrictions, capacity and URL.
   Verify exact maintenance ACTIVE/all previous versions INACTIVE/no pending,
   drain30seconds, and require no competing hosted database consumers.
4. Apply pinned0024 then0025 once to the source as `postgres` (SQL hashes above),
   including their table/column/index/constraint and existing runtime grants/RLS
   policy only. Verify44 actual restricted-app metadata checks, generated plain
   Search plans/calendar cases, unchanged existing service/booking counts+row
   fingerprints, empty new notification table and closed probes. No arbitrary
   business/session/fixture writes or audit-destination schema changes.
5. Perform the already reviewed exact five-role capacity handoff: app
   `DATABASE_URL`, app `AUDIT_CAPTURE_DATABASE_URL`, worker
   `AUDIT_SOURCE_DATABASE_URL`, worker `AUDIT_DATABASE_URL`, app
   `AUDIT_READER_DATABASE_URL`, plus app `AUDIT_EXPORT_USER_IDS`,
   `AUDIT_PRODUCER_CONTRACT`, `AUDIT_READER_DATABASE_URL`, `AUDIT_READER_USER_IDS`,
   only via stdin to local `scripts/aws-publish-capacity.mjs`. Targets source
   `hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`, five restricted roles,
   read-only metadata/capacity, no session kills/cap changes or writes.
6. Only after genuine source-bound DB/Backend acceptance and fresh capacity,
   deploy that exact image to app/audit-worker/gateway in the same session.
   Verify the exact candidate ACTIVE/spec, root gateway challenge and sanitized
   readiness. Bounded status/diagnostics for this operation are included. Actual
   worker and browser acceptance remain explicitly pending; no signed-in business
   workflows or user mutations are included.

No new build, resource/IAM/plan change, backup, restore, automatic retry, rollback,
cleanup, public-access expansion or unrelated database action is proposed. The
command is prepared but **has not run**:

```powershell
node deploy/aws/publish-hosted-cli.mjs --execute-approved-release --snapshot=outputs/aws-staging-build/source-GxAVJf --approval=outputs/aws-staging-build/source-GxAVJf/hosted-release-approval.json --python=C:/Source/Private/WellnessConnect/outputs/aws-staging-build/publish-tools/python/Scripts/python.exe
```

Project [AGENTS.md](../AGENTS.md#cooperation-and-standing-authorization) requires
authorization for the exact private configuration/connected DB/maintenance/
deployment scope. This missing grant is separate from the user's already recorded
no-backup choice; do not ask for that recovery decision again.

**Live cutover approved:** user replied **`approve`** to the exact four-step live
cutover request linked to this full scope, after selecting proceeding without
backup. Root/CI is the approved executor of the reviewed owner scripts and
retained SDK session: exact protected source input/app-URL handoff, full preflight,
one maintenance deployment, pinned0024/0025 once, verification/capacity, exact
existing-image deployment and bounded operation diagnostics. Original no-backup,
stop-inspect/no retry/old41 restart limits apply. No broader database, backup,
resource/IAM/build or public-access changes are authorized.

Immediately before execution, CLI27 offline scenarios and SDK `pip check` pass;
all code/review/source/publication pins match and no prior CLI/release/service
lock exists for this release. Root wrote a separate exclusive approved scope,
`outputs/aws-staging-build/source-GxAVJf/hosted-release-approval.json`, expiring
`2026-11-13T17:15:44.762Z`. Proposed scope is preserved. The now-available official
AWS MCP documentation skill/reference was loaded; AWS resource operations use
the exact approved local SDK command because its retained private baseline and
local DB stdin pipes cannot be moved into the remote MCP sandbox. No AWS CLI
substitution or private spec output is used. Execution result remains pending.

**Actual final run: stopped before migration SQL.** Root invoked the approved
command exactly once (local process session90908, exit1). Live source preflight
passed PG17/old41/all38 checks and closed its clients at
`2026-11-13T15:16:28.111Z`. Original baseline version1/fingerprint and the exact
registered new image were verified. Maintenance version2 reached ACTIVE with
all previous deployments INACTIVE/no pending and exact no-DB commands, followed
by the30-second drain. The migration runner then stopped at `setup_preflight`:
`HOSTED_MIGRATION_SETUP_PRECONDITIONS_FAILED`. Its immutable receipt states
`sql:[]`, `uncertainCommit:false`, `allConnectionsClosed:true`, completed
`2026-11-13T15:20:29.668Z`. Neither0024 nor0025 was dispatched, no candidate
deployment was submitted and no capacity/startup phase ran.

The generic combined guard does not identify which individual condition failed.
Preflight had passed the same identity/capacity/old-schema checks; migration also
requires no competing `postgres`/`supabase_admin`/app/capture/worker client backend.
Another connection is a plausible cause, not established fact. DB owner is
preparing a bounded read-only component/session-count diagnostic for the user to
run in the source SQL Editor. No guard is weakened or session killed.
That diagnostic is now ready and DB-reviewed:
[`hosted-migration-stop-diagnostic.sql`](../scripts/hosted-migration-stop-diagnostic.sql).
Run the complete transaction in source `hbkooiknruimukkhshrk/postgres` as
`postgres` and return its single metadata row. It mirrors identity/stopped/
capacity/old-schema flags and reports aggregate matching role/state counts,
excluding its own backend; no SQL text, PIDs, addresses or business rows. It ends
with ROLLBACK and cannot authorize a migration/retry. A later observation may
differ from the state at failure, and the editor can leave a pooled connection
after its query. Keep maintenance pending diagnosis/recovery.

**User diagnostic returned:** identity/capacity/old_schema=true, stopped=false;
all component schema/identity flags match,41 tables and exact role limits.
The only matching other clients shown are two `supabase_admin` sessions in idle
state, with no named project app/capture/worker/other-postgres peers. This
establishes the sole failing predicate at this observation, consistent with the
earlier stopped run; it does not identify sessions at the earlier failure or
establish their transaction/lock state. Preserve the exact supplied row in
`source-GxAVJf/hosted-stop-diagnostic-user-result.json`.

DB owner is reviewing a narrow managed-admin compatibility proposal and optional
transaction/lock diagnostic. Idle/role name is not proof of future quiescence.
No exemption, forced disconnect, guard change, migration retry or old-runtime
restoration is implemented/authorized by supplying this result. The accepted
original zero-matching-client contract and consumed guards remain in force;
any concurrency-policy change needs an explicit user selection and reviewed new
recovery scope. Do not replay the original cutover command.

DB review now provides a [bounded managed-admin proposal](aws-hosted-schema-status-2026-11-13.md#narrow-managed-admin-compatibility-proposal-not-implemented)
and [transaction/lock metadata query](../scripts/hosted-managed-admin-diagnostic.sql).
Next guided observation: run the complete query in the same source SQL Editor and
return its single aggregate row. It checks whether activity is fully visible,
admin transaction/snapshot state, locks and source prepared transactions. No
query text/PIDs/addresses/business rows or session actions. The proposal would
allow at most two fully visible idle supabase_admin peers with no transaction/
snapshot/lock activity, retain zero other setup/project-writer clients and every
existing migration/data/maintenance/capacity gate. This is not implemented and
requires explicit selection of the residual managed-platform concurrency risk;
samples cannot fence future admin automation. A separately reviewed one-shot
recovery from actual maintenance2/historical original baseline is also needed;
the consumed original command and lost private session cannot be replayed.

### Approved managed-admin recovery preparation —14November2026

User explicitly approved the bounded managed-admin policy and local recovery
implementation/testing, with live execution held; a repeated `approve` arrived
during that work and acknowledged the same scope. No broader live grant was
inferred. The existing source-only no-backup choice remains recorded.

DB implemented an optional strict `supabase-admin-idle-v1` grant marker. Default
callers retain the original zero-peer rule. The selected branch requires full
stats visibility, at most two idle admin peers with no xact/xid/xmin, no granted
or waiting locks of any kind, zero source prepared transactions and zero other
named setup/app/capture/worker peers. Every existing no-consumer check rechecks
it. All schema/identity/cap/SQL/commit/data/current42/capacity gates remain.
Immutable0024/0025 and all550 built source bytes are unchanged.

Root prepared historical-baseline recovery, a new linked working snapshot and
attempt namespace, explicit resumption of maintenance2 and one service-wide
recovery mutex. The original hold remains throughout; exact-byte exclusive/
fsynced archive and hold release occur only after verified candidate/HTTP success
and still-valid authorization. Failed/expired recovery keeps holds and actual
state. No old41 startup, replay, forced disconnect or private checkpoint.

DB owner delivered conditional integrated review in a live agent message;
Backend reviewed final caller/Python bytes; CI returned62 transition scenarios.
Root preserved that received DB review and owner/source conditions in the frozen
[recovery review record](aws-hosted-recovery-2026-11-14.md). Passed offline checks:
policy63, runner91, contract163, input41, final acceptance61, evidence19, CLI34,
transition62, adapter38, workflow34 and Python19. These are mocked checks, not
live TLS/provider/schema/migration/worker/browser acceptance. Locale scope remains
en/lv/ru, others/RTL deferred. No private/live/API/HTTP/service-hold change occurred.

### Reviewed maintenance2 recovery execution —14November2026

**Execution proposed, not approved or started.** New recovery release
`e7769268-dcca-44c2-806b-f942211b3e37` uses working snapshot
`outputs/aws-staging-build/source-recovery-e7769268-dcca-44c2-806b-f942211b3e37`.
Its preparation explicitly links consumed original release
`9c2d14c8-c8e6-48f4-8924-d1fdcd1d07a8`, same550-file manifest, original label,
registered image and digest. No build/upload or original artifact rewrite.

The exclusive public proposal in that folder is
`hosted-release-approval.proposed.json`, explicitly proposed/rejected by live
validation. It pins13 local tool files, both review records, original stopped-run
evidence, baseline1/maintenance2 fingerprints, new UUID and selected policy.
A hypothetical approved copy was used only for offline source/evidence/shape
validation; no approved artifact, attempt claim or connection was created.
After an exact live grant, create a separate exclusive approved scope with a
fresh two-hour UTC expiry; preserve the proposal and original consumed scopes.

**Exact next requested grant:** Root/CI executing reviewed owner scripts, same
profile/project/selected Region/service/source/image/digest and exact protected
field/URL/settings recipients as the full original cutover scope above, under
only this new recovery UUID, with these recovery-specific actions and limits:

1. Read historical deployment1 inside the local SDK process memory. Verify its
   original INACTIVE spec and recorded baseline/runtime/audit/origin hashes;
   verify actual maintenance2 is exactly derived from that full spec,
   RUNNING/ACTIVE/no pending/all other deployments INACTIVE. Raw specs remain in
   memory only. Original baseline hash is
   `2a1d2cc7cf514021490ccc690b29e65d74c1f16e5eef3b690034c6fdbc67270b`;
   maintenance2 hash is
   `714d08e635d42679c19532d9533a11531a3bec25c329c6cf8038b2269873baa5`.
2. Fresh fixed-source setup-field read (`.env.audit-setup.local`, only
   `AUDIT_SETUP_SOURCE_DATABASE_URL`) and original app DATABASE_URL stdin pipe
   to local `scripts/aws-hosted-migrate.mjs`, once each for new full old41
   preflight and migration; unchanged protection/ignore/link/TLS/target checks.
   Grant binds the new UUID/ref/expiry and selected managed-admin policy.
3. Verify/resume existing maintenance2 without a new maintenance deployment,
   drain30seconds, recheck quiet-window/admin criteria, apply pinned0024/0025
   once, and require actual current42/44, unchanged-data/Search/calendar/closed-
   probe evidence. No retry, forced disconnect or role/cap/audit-schema change.
4. Same exact five restricted-role URL/audit-setting stdin handoff to local
   `scripts/aws-publish-capacity.mjs` described above, read-only on the same
   source/audit targets. Only after genuine DB/Backend acceptance and fresh
   capacity, deploy the existing image to all three containers, preserving
   original environment/holds/access/endpoint/capacity. Verify exact candidate
   ACTIVE and root challenge/readiness; bounded diagnostics included. Worker/
   browser acceptance remains pending; no signed-in business/session writes.
5. Only after verified candidate/HTTP success and unexpired authorization,
   exclusively archive/fsync the original hold bytes as
   `publish-service-stopped-9c2d14c8-c8e6-48f4-8924-d1fdcd1d07a8.json`, then remove
   the superseded active hold and successful recovery hold. All consumed attempts
   remain immutable. Failure retains holds/actual state; no old41 startup,
   rollback, automatic retry, backup/restore or unrelated action.

Prepared command, **not executed**:

```powershell
node deploy/aws/publish-hosted-cli.mjs --execute-approved-release --snapshot=outputs/aws-staging-build/source-recovery-e7769268-dcca-44c2-806b-f942211b3e37 --approval=outputs/aws-staging-build/source-recovery-e7769268-dcca-44c2-806b-f942211b3e37/hosted-release-approval.json --python=C:/Source/Private/WellnessConnect/outputs/aws-staging-build/publish-tools/python/Scripts/python.exe
```

No fresh live status was fetched during preparation. Last verified state was
maintenance2/root503/readiness200, no new app image deployed. Recovery will
freshly check actual state after its grant. [Project execution rules](../AGENTS.md#cooperation-and-standing-authorization)
require exact new private/DB/deployment authorization; policy/preparation
approval does not permit a second live attempt or original-command replay.

**15November live recovery approved / AWS authentication prerequisite:** user
replied **`approve`** to the exact new recovery execution request linked here.
Root rechecked CLI34/recovery-evidence19 offline scenarios and confirmed no
approved recovery artifact/attempt/shared recovery lock existed. A single
read-only SDK STS identity precheck, before the execution guard/private DB input,
failed with `LoginRefreshRequired`. No recovery command was invoked, no new
guard consumed, no setup field read, no DB/migration/deployment/hold change.
Public authorization/precheck timing and the two-hour execution approval expiry
are in the new snapshot's exclusive `hosted-recovery-auth-precheck.json`.
The proposed scope remains unchanged; an approved scope will be written only
after credentials and pinned evidence revalidate within that approval window.

Refresh only the existing named `fitsmytime` native AWS login; never overwrite
the default profile or read a different private credential source. The local
signing-in skill explicitly requires confirmation before Root runs `aws login`.
Authentication confirmation is the only missing next action; do not ask for the
no-backup/policy choices again. No automatic migration retry or original scope
replay is authorized by the authentication step.

**Named authentication refreshed / approved recovery starting:** user replied
`ok` to Root running only `aws login --profile fitsmytime --region eu-north-1`.
The local CLI login completed and a read-only SDK identity check confirms
project674200807170. No other profile was overwritten. Root revalidated all
code/review/source/original stopped-run/hold evidence and confirmed no new
recovery guards/lock existed. A separate exclusive approved recovery scope was
written with the original live-grant expiry from the auth-precheck receipt
(`2026-11-15T00:02:15.098Z`), not a silently extended grant. Root now invokes the
exact new recovery command once under that existing live approval. Source-only
no-backup, bounded admin policy, retained private memory/pipes, no retry/rollback
and original-guard preservation remain unchanged. Actual result pending.

**Live recovery progress:** historical baseline1 and exact current maintenance2
were verified in memory. New old41/38 preflight passed and closed clients at
`2026-11-14T22:05:03.735Z` (15November Riga). Existing maintenance2 was verified
without another maintenance deployment, then freshly drained30seconds. The
selected bounded admin checks passed; both pinned SQL scripts returned actual
COMMIT acknowledgments and exclusive intent/confirmation records. Source
current42/44, generated Search/calendar checks, unchanged original service/booking
fingerprints and empty new notification table passed; clients closed at
`2026-11-14T22:05:48.45Z`. Five restricted-role read-only/TLS/capacity checks passed
and closed at`2026-11-14T22:05:58.468Z`. Candidate version3 was submitted using the
exact existing image/original full spec; it is ACTIVATING. No new maintenance
submission, build, guard clearing, migration retry or rollback occurred. Both
active holds remain during candidate activation. Do not resume old41 after these
commits; actual activation/result remains pending.

**Final actual recovery result: SUCCEEDED.** The new command was invoked once
(local process55929, exit0). Deployment3 reached ACTIVE and exact candidate spec
validation passed, followed by HTTP root401 with the expected gateway challenge
and sanitized readiness200/body. Authorization remained valid. The original
service hold's exact bytes were exclusively archived/fsynced as
`outputs/aws-staging-build/publish-service-stopped-9c2d14c8-c8e6-48f4-8924-d1fdcd1d07a8.json`
with unchanged SHA256
`6321942698ba30f4c2777849042332fb1ac7530a996239e5023f0f67c8ea4a21`.
Both active service/recovery holds are absent after success. All original and
recovery CLI/release/handoff/DB/capacity attempts, phase/SQL journals and approval
records remain immutable. The original failed command was never replayed.

An independent read-only SDK post-check confirms RUNNING/micro/scale1,
disabled=false, current deployment3 ACTIVE/no pending, app/audit-worker/gateway
all bound to `:fitsmytime-staging-20261109.srcb9de33fbc298c44ea40489d9.5`, with
registry digest `sha256:028f227729c1a93f8962bf5eeec74c7e9ef3b72dfaa733abb1e5df430a9c1fb7`.
Previous maintenance2 and original1 are both INACTIVE. The original protected
URL remains
`https://fitsmytime-staging-20261109.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com/`.
Maintenance has ended; actual new application image is now deployed.

Authoritative DB evidence is the new snapshot's `hosted-migrate-receipt.json`
and per-script intent/committed records: both exact pinned scripts committed,
42 tables/all44 restricted-app checks, generated Search/calendar verification,
unchanged original service/booking fingerprints, empty new table and closed
clients. `capacity-receipt.json` confirms all five expected restricted roles,
zero other connections, TLS/read-only probes and closed clients. Do not rerun
0024/0025 or resume old41; future releases require current42 acceptance.

Sanitized aggregate final evidence:
`outputs/aws-staging-build/source-recovery-e7769268-dcca-44c2-806b-f942211b3e37/hosted-recovery-verification.json`.
No new build, maintenance submission, backup, restore, forced session kill,
role/cap change, automatic retry/rollback or public-access expansion occurred.
Existing builder retention/no-backup choice and all activation holds are kept.
Live worker-health and browser acceptance remain explicitly pending, as does the
PC builder's separate live acceptance; neither deployment success nor gateway
HTTP establishes those checks. Future browser scope remains en/lv/ru only.

**Managed-admin metadata result received:** user reports identity and sufficient
activity visibility=true; only two idle `supabase_admin` peers, both on the source,
zero open transactions/assigned transaction IDs/retained snapshots, no reported
peer locks and zero source prepared transactions. This observation satisfies
the proposed narrow managed-admin criteria. Exact row is preserved in
`source-GxAVJf/hosted-managed-admin-user-result.json`. No further manual metadata
query is required for selecting the policy. This is not a future concurrency
fence or permission to retry.

**Next material selection:** approve preparing a source-only recovery using an
explicit bounded exception for at most two fully visible `supabase_admin` client
backends, each idle with xact_start/backend_xid/backend_xmin null and no granted
or waiting locks, with zero source prepared transactions. Keep zero other
postgres/app/capture/worker clients; exact schema/identity/role limits, SQL pins,
maintenance/source/image bindings, commit evidence, unchanged-data/current42
verification and final capacity checks remain mandatory. Recheck the exception
at each existing pre-SQL/postflight guard; unknown, active, hidden, extra or
locking admin peers stop. User would accept residual managed-platform activity
between observations; no forced disconnect or general admin exemption.

That selection authorizes owner implementation and offline testing of the
policy plus a new explicit recovery path from maintenance2 and the historical
original baseline. It does not authorize a second live run, deletion/reuse of
attempts, old41 startup, new migration SQL or private/DB/service access. Complete
and review the recovery command first, then request only its exact execution
scope. Existing no-backup choice remains recorded and need not be selected again.

Independent official AWS MCP public status confirms RUNNING/micro/scale1,
version2 ACTIVE, disabled=false/no pending. Cookie-free HTTP checks confirm
root503 and readiness200: maintenance is serving. New app image remains registered,
not deployed. Private Python baseline session is closed; public hashes cannot
reconstruct that session. Preserve all CLI/release/handoff/DB attempts, service
lock, phase journal, approved/proposed scopes and per-operation receipts. Do not
retry this consumed release, resume old41 or clear guards. The user approved
stop-and-inspect; any migration recovery or safe return to old runtime requires
a separately scoped concrete recovery decision after diagnosis.

Sanitized final evidence:
`outputs/aws-staging-build/source-GxAVJf/hosted-cutover-stopped-result.json`.
No backup/export/restore, migration SQL, business/session write, candidate app
deployment, automatic retry/rollback or unrelated resource change occurred.

## Prepare an exact release

Prepare the selected builder's source snapshot (no Docker/AWS/database calls):

```powershell
npm run publish:aws:local -- --prepare
# Or:
npm run publish:aws:codebuild -- --prepare
```

The result prints a `snapshot`, `releaseId` and source hash. The snapshot is an
allowlisted copy; secrets, dotenv, Git history and local output are excluded.
File hashes/counts are checked again before building. Symlinks and unexpected
source files reject. Changes made in the working tree afterward do not enter
that reviewed release. Prepare a new snapshot for new source.

Set `FMT_PUBLISH_PYTHON` to a Python executable with boto3 already available,
or pass `--python=ABSOLUTE_EXECUTABLE_PATH`. Scripts do not install dependencies
or change credentials. If sign-in expires, renew the existing profile through
`aws login --profile fitsmytime --region eu-north-1` and complete its browser
flow yourself. A failed publishing operation is not automatically retried.

After authorization for the target's read-only status/environment inspection,
use the returned snapshot path:

```powershell
npm run publish:aws:local -- --inspect --snapshot=outputs/aws-staging-build/source-EXAMPLE
# Use publish:aws:codebuild instead for its prepared snapshot.
```

This checks the exact existing service, configured scope/holds and current
deployment, then writes **public hashes only** to `release-context.json`.
The SDK process keeps runtime credentials in memory and emits sanitized errors.
No `.env` or raw AWS service/deployment responses are written. Baseline drift
requires renewed owner review; the script never changes live settings to pass.

The assigned Backend and DB owners must accept this exact source and hosted
schema/transition. Current source needs current42 readiness, including
migrations0024/0025. Earlier local-only migration preparation and historical38-gate
release receipts do not establish that acceptance. See the
[Backend contract](aws-publish-backend-contract-2026-11-11.md) and
[DB contract](aws-publish-db-contract-2026-11-11.md).

## One command for an accepted release

After the release has its recorded authorization and reviewed DB-owner hook:

```powershell
npm run publish:aws:local -- --deploy --snapshot=outputs/aws-staging-build/source-EXAMPLE --release=outputs/aws-staging-build/release-EXAMPLE.json
```

For AWS builds, use its snapshot and the approved existing builder stack:

```powershell
npm run publish:aws:codebuild -- --deploy --snapshot=outputs/aws-staging-build/source-EXAMPLE --release=outputs/aws-staging-build/release-EXAMPLE.json --stack=fitsmytime-publish-builder
```

Both commands build, run full source TypeScript plus isolated Linux gateway and
required-artifact checks, upload/register the exact image, enter database-free
maintenance, check fresh capacity through the reviewed owner hook, deploy and
wait for the exact new ACTIVE/RUNNING version, then check HTTPS root restriction
and sanitized readiness. The default service URL and password restriction stay
the same. A brief maintenance interval is intentional to prevent overlapping
database consumers.

`--publish` performs the build/image upload only, leaving the running deployment
unchanged. It requires authorization for that exact upload/build target; it does
not authorize startup. Its exact publication receipt can be reused by the same
prepared release's later `--deploy`, without rebuilding/uploading.

The final result explicitly says `browserAcceptancePending:true`: root401 and
sanitized readiness200 are limited HTTP checks. Full owner acceptance also needs
fresh signed-gateway session, current-candidate audit-worker health and en/lv/ru
browser/visual evidence. No successful application login/OAuth/email/business
write is implied. Other languages/RTL remain deferred; all translations remain.

## Release authorization file

This is a recorded approval artifact, not a generated bypass. The executor must
verify the linked real user/owner approvals before supplying it. Do not fabricate
acceptance, recycle consumed grants or copy the examples into an approval.

The JSON object contains:

- `version:1`, the prepared `releaseId` and `sourceManifestSha256`, exact
  `project`, `region`, `service`, real `approver` and `approvalReference`, and an
  unexpired UTC `expiresAt`.
- `operations:["upload","maintenance","capacity","deploy","verify"]` and
  `recovery:"stop-and-inspect"`.
- `databaseApproval` with the exact fields and bindings defined by the
  [pure DB validator](../scripts/aws-publish-db-contract.mjs), including current
  hosted-schema/Backend acceptance and the three live credential/spec hashes.
- `capacityHook:{executor,approvalReference,executable:"node",script,sha256}`.
  The executor equals `databaseApproval.databaseOwner`; `script` must be exactly
  `scripts/aws-publish-capacity.mjs`, and `sha256` hashes its reviewed file bytes.

The hook interface is
`node --import tsx scripts/aws-publish-capacity.mjs --execute-authorized-capacity --context=PUBLIC_JSON --receipt=PUBLIC_JSON`.
The orchestrator passes the approved five connection URLs and four selected audit
settings only through the checker's stdin, after revalidating maintenance and
approval expiry. Public context/approval accompany that private message. The hook
independently checks both private-input hashes before attempting any connection.
It must produce the exact bound receipt after at least30seconds drain, close all
five probes, prove verified TLS/expected restricted identities/caps and zero
other connections, and never retry. Running it without the explicit execution
flag is an inert plan. Historical one-shot preflight scripts are not compatible substitutes.

The approved recovery policy is stop and inspect actual state. Before candidate
submission, maintenance remains. After submission, a failed activation/HTTP check
can leave maintenance, a pending candidate or the new candidate active. The script
never blindly resumes an old writer, disables the service or rolls back.

## CodeBuild setup

The former builder was deleted. The approved Linux/Small quota is now15, but the
new template caps concurrent builds at1 and never creates a deployment. The
builder role cannot read runtime configuration, secret stores or databases.

Review [the template](../deploy/aws/publish-builder.template.json) and
[setup/permissions/cost/recovery instructions](aws-publish-builder-2026-11-11.md).
The new stack was created under separate13November approval. Its output names are `BuildProject`, `SourceBucket`, `EncryptionKeyArn` and
`TargetServiceArn`. The client reads those outputs, uploads the allowlisted source
ZIP with the exact KMS key, pins its S3 version in StartBuild, then waits for its
unique native Lightsail image. This mode does not need Docker on the local PC.

The stack adds CodeBuild usage, encrypted S3/log storage/requests and an ongoing
KMS key charge. Setup requires exact resource/IAM/spending approval, current
pricing/plan checks and CloudFormation validation. After explicit installation
approval, cfn-lint1.60.0 and cfn-guard3.2.1 are installed in the ignored tools
folder; actual local schema/security checks pass (zero lint findings and zero
Guard violations across16 selected rules). AWS service pre-deployment checks
and provisioning were subsequently completed as recorded above; the corrected
source's approved build/upload subsequently succeeded as recorded above.
Retained resources can continue to incur cost after
stack deletion; no cleanup is automatic.

## Attempts, verification and handoff

Release-wide immutable attempt receipts prevent replay across either builder.
A service lock prevents concurrent local releases and remains after any failed
release invocation, including pre-start failures. Successful releases remove
only their lock. Publication attempts and capacity receipts are single use.
Never clear a lock/attempt to bypass a failure; inspect with the owning executor
and record the exact recovery scope first. SDK retry count is one attempt;
repeated read-only status polls are only observation of the same operation.

Initial offline evidence on11November: **26 workflow scenarios**, **97 DB contract
scenarios**, **6 Python boundary tests** passed; both command plan modes and both
source-snapshot preparation modes passed without AWS/DB calls. Backend owner
passed startup diagnostics98, production packaging/import and TypeScript checks.
Current source snapshots were prepared for testing only; no live approval issued.
CloudFormation schema/guard, real Docker build/upload, CodeBuild and deployment
acceptance remain unverified for this workflow. Test scope is en/lv/ru;
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

After the handoff approval, fresh integrated checks passed **31 workflow
scenarios**, **97 DB contract scenarios**, **109 DB-owner checker scenarios**
recorded in its [handoff](aws-publish-db-contract-2026-11-11.md), and **9 Python
boundary tests**. Both publishing previews and the checker's default plan passed
with no connected calls. Tests cover exact recipient/argument boundaries,
private-input absence from public files, expired approval before and during the
AWS fetch, changed maintenance, unavailable private input and one-shot receipt
handling. No live database, Docker build, AWS upload or deployment was exercised.

Root accepts the CI/CD assignment from the user's request for one script per
builder. Owner dependencies were assigned under AGENTS.md standing cooperation:
DB `/root/publish_db_contract`, Backend `/root/publish_backend_contract`, and
delegated build-template CI/CD `/root/publish_cloud_builder`. Scope was reversible
repository preparation and offline/mocked checks only. No live startup, schema
change, private configuration read, provisioning or spending approval was inferred.
Recovery of local preparation reverts only attributable files and npm script
entries; leave unrelated workspace changes and historical execution guards intact.

## Approved in-memory handoff and remaining execution prerequisites

Automatic approval review rejected the proposed patch that would retrieve the
five database connection URLs from the running AWS deployment and pass them,
plus four selected audit settings, through stdin to a new local DB-owner capacity
process. The review stated that authorization for the **exact payload and
recipient** was absent. It exposes database credentials to another process,
even though it would keep them off disk, logs, shell arguments and the builder.
No such credential-transfer code landed during that rejected attempt, and no
alternate route was attempted. The user then replied **"ok"** to the exact request
to finish this in-memory handoff, solely for read-only capacity checks. That
approval authorizes implementing the described path and local checker; it does
not authorize a new live deployment, database migration or CodeBuild provisioning.

The concrete approved recipient is `scripts/aws-publish-capacity.mjs`, owned and
reviewed by the assigned DB owner, running locally under Node. The five values
would be app `DATABASE_URL`, app `AUDIT_CAPTURE_DATABASE_URL`, worker
`AUDIT_SOURCE_DATABASE_URL`, worker `AUDIT_DATABASE_URL`, app
`AUDIT_READER_DATABASE_URL`. The audit settings are `AUDIT_EXPORT_USER_IDS`,
`AUDIT_PRODUCER_CONTRACT`, `AUDIT_READER_DATABASE_URL`, `AUDIT_READER_USER_IDS`.
The exact targets remain source `hbkooiknruimukkhshrk` and destination
`ynygqodmtgjrngiudalw`; only bounded read-only TLS/capacity metadata checks with
the five restricted principals are proposed. No schema changes, writes, grants,
session kills, limit changes, retry or broader configuration transfer.

Root/CI/CD implements the pipe handoff and DB owner `/root/publish_db_contract`
implements/reviews its receiving hook with mocked probes. No real credentials
were retrieved or transferred during preparation. Live use still requires the
exact current hosted-schema/Backend acceptance and recorded release/connected
execution scope, with fresh maintenance and no competing consumers. CodeBuild
also needs its separately validated/approved setup. The transfer approval alone
does not authorize migrations or provisioning, replay old grants, or permit a
different recipient, payload or target.
