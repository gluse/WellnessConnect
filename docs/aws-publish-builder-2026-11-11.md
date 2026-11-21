# Reusable CodeBuild publishing builder — 11 November 2026

Status,13November2026: **builder provisioned and configuration verified;
CREATE_COMPLETE; no build started or application deployed**.

Current guided setup and exact pending creation scope are recorded in
[the13November proposal](#guided-builder-creation-proposal--13november2026).
Root delegated only
the new builder template to CI/CD executor `/root/publish_cloud_builder` under the
user's request for separate local-PC and AWS-build publishing commands. This
acceptance authorizes reversible template/documentation edits and offline checks.
It does not authorize new AWS resources, IAM grants, spending or publication.
Root owns integration and the shared guarded Lightsail release workflow.

## Contract and security

[The template](../deploy/aws/publish-builder.template.json) creates an S3 source
bucket, symmetric rotating KMS key, encrypted seven-day log group, CodeBuild role
and one Linux/Small CodeBuild project. Source bucket policy requires HTTPS; all
public-access blocks and bucket-owner-enforced ownership remain enabled. Versioned
sources under `source/` expire after seven days, including old versions after
seven days. Incomplete multipart uploads abort after one day. Bucket keys are
disabled so the S3 KMS encryption context can be limited to source-object ARNs.

Every resource/output uses `AllowedTarget`: project `674200807170`, selected
Region `eu-north-1`, partition `aws`. In any other target the stack creates no
resources and returns none of the required outputs; the publishing command must
reject missing outputs. `TargetService` accepts only
`fitsmytime-staging-20261109`. Required `TargetServiceArn` must be read from that
exact service, independently checked by the setup executor, and passed as a
parameter. Lightsail ARNs use resource IDs rather than service names, so the
name alone cannot construct a correct least-privilege registration ARN.

The role trusts only CodeBuild with the exact derived project ARN and project
identity. It reads only source objects/versions under the new bucket's `source/`
prefix, decrypts only those objects via S3, and writes only its encrypted build
logs. CodeBuild uses Ubuntu `standard:7.0`, Node22, Linux/Small, privileged Docker,
concurrency **one**, build timeout30 minutes, queue timeout5 minutes, no artifacts
and **zero automatic retries**. No VPC/NAT resources are created.

The builder can obtain temporary native Lightsail registry credentials, inspect
registered images, and register an image to **only the exact supplied service
ARN**. AWS does not offer resource-level scope for registry-login or image-list
operations, so those two actions require `Resource: "*"`, restricted by
`aws:RequestedRegion`. Registry login itself covers the project's native registry;
this is the unavoidable documented access boundary, not per-service credentials.
The role does not have `GetContainerServices`, which would expose live deployment
environment values, or deployment/update/delete, IAM, Secrets Manager, SSM,
database, or application credentials. Root explicitly accepted omission of
`GetContainerServices` during integration. KMS key-policy `Resource: "*"` means
this one attached key, not access to other keys.

The builder runs `node deploy/aws/publish-cloud-build.mjs`. The caller must upload
only the reviewed allowlisted archive, pin the S3 `sourceVersion`, and supply
`SOURCE_MANIFEST_SHA256` and `IMAGE_LABEL` StartBuild overrides. Project defaults
set `TARGET_SERVICE` and `REGION`. Image build, isolated verification, native push
and registration belong to that helper; it must never start the application or
receive runtime dotenv files. Local deployment control and DB-owner acceptance
remain outside CodeBuild. Template default source `source/placeholder.zip` is
intentionally absent; no build should run until the source override is supplied.

Required stack outputs for the caller are `BuildProject`, `SourceBucket`, and
`EncryptionKeyArn`. `TargetServiceArn` is also returned for binding verification.
There are no exports or cross-stack imports.

## Setup after exact authorization

No command in this section was executed. First obtain authorization for the new
CloudFormation stack `fitsmytime-publish-builder`, its build-only IAM role,
encrypted S3/log/KMS resources and build usage in the existing project/Region.
Check current plan, credits/spend limit, service availability and actual pricing
before execution. The approved CodeBuild quota is capacity, not spending approval.

Resolve and verify the exact existing service first, using only the returned ARN
and name, without printing its environment:

```powershell
$publisherTargetArn = aws lightsail get-container-services --service-name fitsmytime-staging-20261109 --profile fitsmytime --region eu-north-1 --query 'containerServices[0].arn' --output text --no-cli-pager
```

Then, after local template/security validation and approved setup scope, create
the build stack (or review a change set before any later update):

```powershell
aws cloudformation create-stack --stack-name fitsmytime-publish-builder --template-body file://deploy/aws/publish-builder.template.json --parameters ParameterKey=TargetService,ParameterValue=fitsmytime-staging-20261109 ParameterKey=TargetServiceArn,ParameterValue=$publisherTargetArn --capabilities CAPABILITY_IAM --profile fitsmytime --region eu-north-1 --no-cli-pager
aws cloudformation wait stack-create-complete --stack-name fitsmytime-publish-builder --profile fitsmytime --region eu-north-1
```

Stop on any failed API call/stack result. Do not replay a failed create, switch
Region, upgrade the project plan, change IAM scope or start a build automatically.
CloudFormation service pre-deployment validation, current CloudTrail controls and
stack events remain connected setup checks. Retrieve only public stack outputs.
All source uploads must explicitly use the returned KMS key and use `source/` keys;
caller permissions for upload/start/read-status are separate from the builder role.

## Validation and remaining checks

Offline checks passed on11November: JSON parsing; all six resources and all four
outputs use the target condition; explicit retained bucket/key/log policies;
concurrency1/auto-retry0; registration scoped to required ARN; no deployment,
service-environment-read or secret-store actions; `git diff --check`. Template is
13,100 bytes at that check, below the inline51,200-byte limit. KMS tag property
names were checked against the current CloudFormation resource reference.

At initial preparation, installed `cfn-lint`, `cfn-validate` and `cfn-guard` executables were not found.
No matching cached executables were found. No tools were installed or downloaded.
At that stage **CloudFormation schema validation and cfn-guard security/compliance
checks were unavailable**. Those initial structural checks
do not substitute for them or establish live build success. If installing a
validator is selected, use one exact-version local validator, then cfn-guard with
applicable rules under the CloudFormation skill's dependency workflow.

No AWS MCP documentation/skill tools were exposed in this session. The local
AWS deployment, SDK/IAM and CloudFormation skill guidance and current primary AWS
documentation were used. No connected AWS/DB calls, credential/private-config
reads, resource creation, build, publication or deployment occurred in this scope.
No browser/locale matrix was run; acceptance remains **en/lv/ru** and other
languages/RTL remain deferred.

## Costs and recovery

### Approved validator installation and actual results

User replied **"install"** to the exact request for cfn-lint1.60.0 and
cfn-guard3.2.1 in the ignored project tools folder. Root/CI/CD executed only that
local installation and validation scope. No AWS or database call, provisioning,
build or deployment occurred. No global PATH or application dependency changed.

Installation: `outputs/aws-staging-build/validation-tools/python` is an isolated
Python3.13 venv containing PyPI `cfn-lint==1.60.0` and its required dependencies;
no optional extras or alternate validator were installed. Guard uses the official
3.2.1 Windows x86_64 release, verified against published archive SHA256
`52af28c02081f1067c6710c08619d359899734ec59d51f17f68e1b4b396a1203`.
The official AWS Guard rules registry is pinned to commit
`7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`; 16 selected S3/KMS/logging/CodeBuild/IAM
rules and their hashes are recorded. No rule was modified or suppressed.

Initial cfn-lint: zero findings. Initial Guard: one violation,
`S3_BUCKET_SSL_REQUESTS_ONLY`, because the HTTPS-deny policy represented
`aws:SecureTransport` as string `"false"` instead of Boolean `false`.
Root made only that equivalent policy-value representation correction, retaining
the explicit deny, all principals/actions and exact bucket/object scope.
Original failing Guard evidence is retained. The actual corrected template was
then rechecked: **cfn-lint0 errors/0 warnings/0 information**, exit0;
**Guard0 violations,15 passed,1 not applicable**, exit0. The non-applicable rule
is `IAM_POLICY_NO_STATEMENTS_WITH_ADMIN_ACCESS`; other selected IAM-role rules
passed. This is selected-rule validation, not a claim of exhaustive compliance.

Corrected template SHA256:
`2e4dafd1fa2168066999255a208360969df5c47df94cb22aaa326210c6ddff6d`.
Evidence and dependency versions:
`outputs/aws-staging-build/validation-tools/installation-and-validation.json`,
`aws-rules-manifest.json`, `cfn-lint-result.json`, `cfn-guard-result.json`, and
`cfn-guard-before-policy-type-fix.json` in that same directory.
This supersedes the initial unavailable-local-validation gate above. AWS service
pre-deployment/target checks, actual setup/spending approval and live build
verification remain separate. Existing application source snapshot binding is
unchanged: this CloudFormation template is outside its image-source allowlist.

Reusable local checks from the project root:

```powershell
& 'outputs/aws-staging-build/validation-tools/python/Scripts/cfn-lint.exe' --template deploy/aws/publish-builder.template.json --regions eu-north-1 --format json
& 'outputs/aws-staging-build/validation-tools/guard-3.2.1/cfn-guard-v3-x86_64-windows-latest/cfn-guard.exe' validate --rules outputs/aws-staging-build/validation-tools/aws-rules --data deploy/aws/publish-builder.template.json --type CFNTemplate --output-format json --structured --show-summary none
```

The new stack adds CodeBuild usage, S3 storage/requests, CloudWatch Logs and a
customer-managed KMS key/requests. Current prices must be checked at setup; this
record makes no new price/Free-plan claim. The KMS key incurs ongoing cost even
when no builds run. Existing Lightsail power/scale and application services are
unmodified by this template.

Bucket, its HTTPS-deny policy, key and log group have
`DeletionPolicy`/`UpdateReplacePolicy: Retain`.
Deleting the stack does not remove those resources or their costs. Coordinate
explicit cleanup/retention approval after source/log expiry; never delete the
key while encrypted evidence is needed. Retained resources require an ownership
handoff if orphaned. No automatic cleanup or data deletion is included. Recovery
for this preparation is removal of only these attributable new local files.

## Read-only integration review

Root requested a scoped review of `publish-image.mjs`,
`publish-cloud-build.mjs`, `publish-workflow.mjs`, and `publish-aws-session.py`.
Template/helper environment names, Node22 execution, source archive metadata
removal before exact-file validation, S3 VersionId pin, Lightsail label format,
registration response shape and Unix/npipe Docker push are compatible on source
inspection. Registry credentials remain in memory/pipe headers; the cloud helper
does not receive deployment environment values. This is not live build evidence.

Reported to Root for integration: compare the template's `TargetServiceArn`
output against the actual existing service before cloud build; reject project
auto-retry/configuration drift before paid build execution; and review the
maintenance-history requirement with DB because strict `INACTIVE` rejects any
historical `FAILED` deployment. No implementation edits or connected operations
were performed in this review. The external owner capacity-hook implementation
remains absent; this review neither implements nor routes a credential-transfer
alternative to the action rejected by automatic approval review.

## Primary references

- [Lightsail action/resource scope](https://docs.aws.amazon.com/service-authorization/latest/reference/list_lightsail.html).
- [CodeBuild confused-deputy protection](https://docs.aws.amazon.com/codebuild/latest/userguide/cross-service-confused-deputy-prevention.html).
- [CloudWatch Logs KMS encryption and context](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html).
- [CodeBuild CloudFormation properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-codebuild-project.html).
- [Available CodeBuild runtimes](https://docs.aws.amazon.com/codebuild/latest/userguide/available-runtimes.html).

## Guided builder creation proposal —13November2026

**Creation approved and completed; build/release pending.** User replied **`approve`** to
Root creating only this builder after target/audit checks and a clean change-set
review, including the listed IAM/resources and associated credit use. Root/CI is
the executor; the exact conditional scope and exclusions below are unchanged.
This does not authorize builds, database work or website deployment. User reports the existing
project is on the Free plan with credits available (amount/expiry not supplied),
Linux/Small concurrency quota15, and service deployment1 ACTIVE/no pending version.
Root's exact authorized stack-status read established that
`fitsmytime-publish-builder` does not exist. User's `ValidateTemplate` result
reports the intended description and `CAPABILITY_IAM`; this is basic template
validation, not account-aware pre-deployment acceptance or provisioning evidence.

The user retrieved the service ARN with the exact named-service query:
`arn:aws:lightsail:eu-north-1:674200807170:ContainerService/cea8f52b-ac9e-45b9-8510-e8bb5ea585c5`.
The [prepared public parameters](../deploy/aws/publish-builder.parameters.json)
bind that ARN and the existing service name. No private access dotenv file was
read; their presence in IDE tabs does not grant access.

Current template SHA256 still equals the already lint/Guard-validated
`2e4dafd1fa2168066999255a208360969df5c47df94cb22aaa326210c6ddff6d`.
Reuse those unchanged-template results: cfn-lint zero findings, selected16 Guard
rules15passed/1not-applicable/0violations. No dependency reinstall or redundant
application/browser/DB testing is needed for public parameter preparation.

Proposed executor is Root/CI/CD using profile `fitsmytime`, project674200807170,
selected Region `eu-north-1`. Requested future scope is bounded read-only identity,
exact service name/ARN/status and CloudTrail management-event configuration/status
checks; creation/review of one CREATE change set for this template/parameter
pair; and execution of that exact change set only if all required validation and
scope checks pass. Read only sanitized validation/resource status and the four
public outputs. No source upload, build start, image registration, existing
service mutation, runtime/private-config extraction, DB access/migration or
application deployment is included. No plan upgrade, quota increase, ACL
adjustment, audit-log creation/configuration or cleanup is included.

The stack creates one build-only CodeBuild project, one limited service role,
one private/versioned encrypted source bucket plus HTTPS policy, one rotating
symmetric KMS key and one encrypted seven-day build log group. Concurrency1,
timeout30minutes and automatic retries0 remain. The role cannot deploy or read
runtime service settings/secret stores/databases. Its unavoidable registry-login
and image-list operations are project-wide within eu-north-1; image registration
is limited to the exact ARN above. Creating the project starts no build.

Current published KMS base storage price is **USD1/month for a new customer key,
prorated hourly**. Annual key rotation can add further key-material charges;
storage/log/request/build usage has its separate service charges. CodeBuild
publishes100 eligible Small build minutes/month, but availability/remaining
allowance and actual credit applicability have not been measured. Do not promise
zero credit consumption or zero charges. No build usage is requested in this
creation scope. The fixed KMS price is quoted directly; no cost arithmetic or
unverified regional compute-rate estimate is used.

Primary prices checked13November:
[KMS](https://aws.amazon.com/kms/pricing/),
[CodeBuild and additional service costs](https://aws.amazon.com/codebuild/pricing/).

After exact authorization and successful read-only prerequisites, prepare a
unique change set. These commands are a reviewable proposal and were not run:

```powershell
$publisherChangeSetName = 'builder-preflight-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
aws cloudformation create-change-set --stack-name fitsmytime-publish-builder --change-set-name $publisherChangeSetName --change-set-type CREATE --template-body file://deploy/aws/publish-builder.template.json --parameters file://deploy/aws/publish-builder.parameters.json --capabilities CAPABILITY_IAM --profile fitsmytime --region eu-north-1 --no-cli-pager
```

Capture the returned ARN, observe that same change set to completion, and retrieve
its validation results through `describe-events` scoped to that ARN. Require only
the six reviewed resource additions and the exact parameters/IAM scope. No
automatic execution from a failed check, unresolved warning, changed target or
unavailable required audit logging. A CREATE change set creates a
`REVIEW_IN_PROGRESS` stack record without provisioning its declared resources;
do not clear that record or retry failed create operations automatically.

Only after the approved conditional checks pass, execute that returned exact ARN:

```powershell
aws cloudformation execute-change-set --change-set-name RETURNED_CHANGE_SET_ARN --profile fitsmytime --region eu-north-1 --no-cli-pager
```

Observe the same operation and validate actual stack outputs/resource bindings;
do not start a build. On any failure, stop and report actual state. CloudFormation
can leave partial retained resources, and the retained KMS key/bucket/log group
can continue consuming credits after stack deletion. Separate cleanup/retention
approval is required; no automatic stack/key/bucket deletion, failed-operation
replay or application rollback is authorized. Ask the keep/cleanup choice after
creation with its ongoing-cost implications. Existing website/password and all
database/release activation holds remain.

## Approved builder execution —13November2026

User explicitly approved the exact conditional build-only setup. Root/CI verified
STS project674200807170, exact service name/ARN, RUNNING/micro/scale1,
version1 ACTIVE/no pending/disabled=false. Template and parameter hashes stayed
unchanged. CloudTrail `describe-trails` returned no configured trails, while
`lookup-events` confirmed current13November `ValidateTemplate`/`DescribeStacks`
management records. This satisfies management-event recording for the restricted
build-only setup through default90-day Event history, **not durable trail
retention**. No audit configuration was changed; a durable encrypted/integrity-
validated trail remains an operational recommendation, outside this scope.

Root created one change set, with retry attempts disabled:
`builder-preflight-20261113T100516Z-93b417d8`, operation
`33f8c3db-fd6b-419e-adc9-63b2f016f4d3`.
It reached CREATE_COMPLETE/AVAILABLE with exactly the six reviewed Add actions,
the two exact parameters and CAPABILITY_IAM. `describe-events` reported the
CREATE_CHANGESET operation SUCCEEDED and no VALIDATION_ERROR events. The actual
server-side original template compared semantically equal to the reviewed file.

That same change set was executed once under the existing conditional user
approval; no repeat permission or broader scope was inferred. The create request
was accepted and the first status observation is CREATE_IN_PROGRESS. Stack ID:
`arn:aws:cloudformation:eu-north-1:674200807170:stack/fitsmytime-publish-builder/bcdaf970-df49-11f1-8977-06fff4cda91b`.
Immutable local public request/execute receipts are
`outputs/aws-staging-build/builder-setup-20261113-attempt.json`,
`builder-setup-20261113-change-set.json` and
`builder-setup-20261113-execute-attempt.json`. Never replay these attempts or
clear their guards. Final stack/resource/output verification is still in progress.
No build, source upload, private-file read, database operation, app deployment,
plan/quota/logging change or cleanup occurred.

**Final verification passed:** stack and all six resources reached
CREATE_COMPLETE. The four public outputs are:

| Output | Verified value |
| --- | --- |
| BuildProject | `fitsmytime-publish-builder-build` |
| SourceBucket | `fitsmytime-publish-builder-sourcebucket-ui39d8cthdaf` |
| EncryptionKeyArn | `arn:aws:kms:eu-north-1:674200807170:key/958fe6b3-bf95-4117-9aba-cb8fdff98c89` |
| TargetServiceArn | `arn:aws:lightsail:eu-north-1:674200807170:ContainerService/cea8f52b-ac9e-45b9-8510-e8bb5ea585c5` |

Live public CodeBuild configuration matches Linux/Small, standard7.0, privileged
Docker, concurrency1, automatic retries0,30-minute build/5-minute queue limits,
the exact S3 source/key/log group and new limited service role. Its build list is
empty. The Lightsail post-check still shows RUNNING/micro/scale1, version1 ACTIVE,
no pending deployment and disabled=false. Configuration/creation success is not
image-build, database compatibility or application-release acceptance.

Sanitized final evidence is
`outputs/aws-staging-build/builder-setup-20261113-result.json`; original request,
change-set and execute guards remain immutable. No installation, template/SQL
change, private access dotenv read, source upload, build, DB access, application
deployment, quota/plan upgrade, audit configuration change, retry or cleanup
occurred. The user subsequently selected **keep it** for active development and
future changing-code releases; retain this builder/key/bucket/logs and their
associated ongoing credit use. No cleanup is requested. Setup authority is consumed; do not re-execute
the change set or infer build/deployment permission from it.

**Subsequent image-publication acceptance,13November:** separately approved SDK
setup and first build completed with a registry-push failure; original attempt
retained. After local compatibility correction and a new exact user approval,
one new build `91cd82e2-b074-4617-80f6-8c0dd5204f86` SUCCEEDED and its image
was independently verified in Lightsail. The website remains version1 ACTIVE,
with no pending deployment; no DB operation or website release was performed.
No builder/IAM changes or cleanup were needed. See the
[full approval/source/image verification](aws-one-command-publishing.md#verified-image-publication--13november2026).
