# Publishing from this PC or CodeBuild

Status, 11 November 2026: both entry points and the common release workflow are
prepared and pass offline tests. Neither path has made a connected call, built a
new image, published or deployed during this task. Live acceptance is incomplete.
The user subsequently approved the exact in-memory handoff to the local DB-owner
capacity checker. That integration and its mocked verification are implemented;
current hosted-schema acceptance and live setup/release checks remain separate
prerequisites.

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
Its output names are `BuildProject`, `SourceBucket`, `EncryptionKeyArn` and
`TargetServiceArn`. The client reads those outputs, uploads the allowlisted source
ZIP with the exact KMS key, pins its S3 version in StartBuild, then waits for its
unique native Lightsail image. This mode does not need Docker on the local PC.

The stack adds CodeBuild usage, encrypted S3/log storage/requests and an ongoing
KMS key charge. Setup requires exact resource/IAM/spending approval, current
pricing/plan checks and CloudFormation validation. Installed CloudFormation schema
and cfn-guard validators were unavailable; offline structural checks passed, but
they do not substitute for those required provisioning checks. No template or
build execution occurred. Retained resources can continue to incur cost after
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
