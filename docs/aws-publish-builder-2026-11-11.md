# Reusable CodeBuild publishing builder — 11 November 2026

Status: **prepared locally; not provisioned or live-tested**. Root delegated only
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

Installed `cfn-lint`, `cfn-validate` and `cfn-guard` executables were not found.
No matching cached executables were found. No tools were installed or downloaded.
Thus **CloudFormation schema validation and cfn-guard security/compliance checks
remain unavailable and required before provisioning**. These structural checks
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
