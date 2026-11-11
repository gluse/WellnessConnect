# Database acceptance contract for reusable AWS publishing

Status: **pure validation contract and reusable capacity hook implemented;
97 contract and 109 capacity-hook offline scenarios pass**. No database, AWS or
private configuration access occurred. Current hosted-schema compatibility and
the exact live release/connected owner grant remain prerequisites for execution.

Requester/user selected both local-PC and CodeBuild publishing commands on
11 November 2026. Infrastructure owner `/root` assigned this dependency to
DB Analyst/Developer `/root/publish_db_contract`, who accepted necessary reversible
local validation files under [standing owner cooperation](../AGENTS.md). Applied
the PostgreSQL practices skill and operations guidance. Scope excludes connected
operations, private reads, migrations, consumed grants, deployment and spending.

The shared validator is [aws-publish-db-contract.mjs](../scripts/aws-publish-db-contract.mjs).
It exports `validateDatabaseApproval({approval,context,now})` before publication
mutations or maintenance, and
`validateDatabaseReceipt({approval,receipt,context,now})` immediately before runtime
startup. Both are pure, accept explicit public values, return sanitized acceptance
metadata, and throw fixed error codes. They do not issue owner approval, establish
the authenticity of an approval file, connect to databases or consume a receipt.
Infrastructure must match the actual recorded owner/user grant, the designated
executor and exact executable/hash of the external hook, and atomically create
an immutable per-release attempt/consumption record before mutations. Copying an
old receipt or filling in approval booleans is not authorization.

## Current source compatibility

The [11 November database dependency](frontend-followup-database-2026-11-11.md)
introduces `customer_service_notifications`, `services.deleted_at` and the
current42 application readiness profile. Its 0024 expansion and 0025 restricted
runtime activation are prepared, with no applied-hosted evidence in that record.
The [local-only migration proposal](frontend-followup-local-migration-2026-11-11.md)
does not authorize migration of hosted Supabase. Old current41/38-gate AWS
receipts cannot establish current-source compatibility.

The current42 profile has 42 tables and 38 metadata gates; the separate currency,
photo and reminder guards add two each, giving **44 application checks**. Current
schema acceptance must establish the exact metadata, restricted rights, expected
audit parser chains, source/worker contract and recoverability for the selected
source snapshot. Backend must accept the app/current-worker pairing and maintenance
transition. No migration is run implicitly by either publication route.

## Public context and owner approval

Context fields are `releaseId` (1–128 ASCII letters/digits/underscore/dot/hyphen,
starting with a letter/digit), `project`, `region`, `service`, and four lowercase
SHA256 fields: `sourceManifestSha256`, `baselineFingerprint`,
`runtimeDatabaseSha256`, `auditSettingsSha256`. Exact target is project
`674200807170`, selected Region `eu-north-1`, service
`fitsmytime-staging-20261109`.

Approval fields are `version:1`, all eight context fields above,
`databaseOwner`, `backendOwner`, `approvalReference` (recorded acceptance link),
`expiresAt` (explicit UTC instant), `compatibilityAccepted:true`,
`transition:"maintenance"`, `recovery:"stop-and-inspect"`, and:

```json
{
  "schema": {
    "profile": "customer-service-notifications-current42",
    "tableCount": 42,
    "applicationChecks": 44,
    "verifiedApplied": true,
    "sourceProject": "hbkooiknruimukkhshrk",
    "destinationProject": "ynygqodmtgjrngiudalw"
  }
}
```

This describes the required successful owner evidence; it is **not an approval
template to mark complete before those checks occur**. It must bind the actual
reviewed snapshot and current baseline/runtime inputs. Old grants/receipts remain
consumed or retired and are never transferred into this contract.

Fingerprint algorithms retain exact container-form credential strings. Compute
SHA256 over UTF-8 `JSON.stringify` of these objects **in this insertion order**:

```js
const runtimeDatabase = {
  AUDIT_CAPTURE_DATABASE_URL: app.AUDIT_CAPTURE_DATABASE_URL,
  AUDIT_DATABASE_URL: worker.AUDIT_DATABASE_URL,
  AUDIT_SOURCE_DATABASE_URL: worker.AUDIT_SOURCE_DATABASE_URL,
  DATABASE_URL: app.DATABASE_URL,
};
const auditSettings = {
  AUDIT_EXPORT_USER_IDS: app.AUDIT_EXPORT_USER_IDS,
  AUDIT_PRODUCER_CONTRACT: app.AUDIT_PRODUCER_CONTRACT,
  AUDIT_READER_DATABASE_URL: app.AUDIT_READER_DATABASE_URL,
  AUDIT_READER_USER_IDS: app.AUDIT_READER_USER_IDS,
};
```

The fifth credential, destination reader, is covered by `auditSettingsSha256`.
No URL normalization, newline or pretty-printing is introduced. The baseline
fingerprint hashes compact UTF-8 JSON of `{containers,publicEndpoint}` with every
object's keys recursively sorted and array order preserved. Do not print or
persist raw credentials/specifications to compute these hashes. Hook and
infrastructure must use identical canonical serialization.

## Maintenance and fresh capacity receipt

Infrastructure first submits the reviewed no-database maintenance deployment:
same images/environment, app and audit-worker only idle Node commands, gateway
only standalone public503/exact sanitized readiness200. No application modules,
database libraries or upstream requests may run in maintenance. Confirm exact
commands, maintenance ACTIVE/RUNNING, all previous deployments INACTIVE and no
pending deployment. Do not deploy into a disabled service or resume stale writers.

Context then adds `quiescentVersion` (positive integer),
`quiescentFingerprint` (canonical maintenance-spec SHA256), and
`quiescentVerifiedAt` (explicit UTC instant of confirmed maintenance), plus
`allPreviousDeploymentsInactive:true`, `noPendingDeployment:true` and
`maintenanceCommandsVerified:true` from the actual fresh AWS observation. Keep other
AWS/local consumers stopped. The external owner hook receives that exact public
context JSON path and an output receipt JSON path via explicit executable/argument
array, without a shell. The implemented receiver is
[aws-publish-capacity.mjs](../scripts/aws-publish-capacity.mjs), requiring
`--context=PUBLIC --receipt=PUBLIC --execute-authorized-capacity`; no arguments
or `--plan` is inert. Fresh exact connected target/operation/executor authorization
and release acceptance remain prerequisites; this offline assignment does not
execute a connected check. Historical one-shot runners must not be replayed.

### Private payload and resolved implementation hold

Root subsequently requested preparation of a reusable hook, but automatic
approval review rejected the parent integration patch that would retrieve live
database URLs from AWS and transfer them to that process: exact payload/recipient
authorization was absent. The DB owner stopped before creating any hook or
credential-transfer implementation; no alternate route was attempted.

The exact scope presented for user approval was: read only the selected existing Lightsail
staging runtime settings in memory; pass a one-shot JSON stdin message from the
publishing orchestrator to the local Node capacity-hook process; and
connect sequentially only to the existing source/destination restricted PG17
principals in the five-role table below. Public fields would be `context` and
`approval`. Private fields would be `connectionUrls` with exactly
`app`, `capture`, `worker`, `writer`, `reader` URL strings, plus `auditSettings`
with exactly `AUDIT_EXPORT_USER_IDS`, `AUDIT_PRODUCER_CONTRACT`,
`AUDIT_READER_DATABASE_URL`, `AUDIT_READER_USER_IDS`. The hook would independently
match both credential/settings fingerprints, read only the public pinned CA,
verify TLS/identity/caps/read-only state/zero competing connections, close every
probe, and write only the public receipt. No raw credential/settings payload
would enter command arguments, files, logs, images or AWS build resources. No
schema/data/ACL writes, retries, claims or old-grant replay would be allowed.

The user subsequently replied **"ok"** to Root's final exact request described in
[the publishing handoff](aws-one-command-publishing.md), authorizing implementation
of this in-memory payload/recipient integration. Root routed that explicit
authorization to DB owner `/root/publish_db_contract`; the hook and offline tests
were then implemented. This resolves the prior implementation hold and preserves
its history. No connected execution, private read, new schema approval or live
publication is claimed. Current-source hosted-schema/Backend acceptance and the
exact connected release/executor grant still gate an actual execution.

The receiver uses strict Zod outer/URL/audit payload schemas and parsed values;
benign additional public context fields are retained and must exactly match the
public context file. It independently recomputes both private fingerprints and
validates all target/principal/SSL options before opening a socket. Only the
allowlisted container CA path is accepted; the actual client uses the repository's
public pinned self-signed CA, certificate/hostname validation and TLS1.2 minimum.
Forced native/binary driver overrides are rejected. Each probe starts with
read-only startup settings and an explicit read-only transaction, performs one
bounded metadata SELECT and rolls back/closes on every path. There are no retry
loops, business queries or schema checks masquerading as migrations.

After valid public owner approval and payload parsing, the receiver exclusively
creates global `capacity-owner-RELEASEID-attempt.json` before its probes and
reserves `capacity-receipt.json` in the same direct `source-*` snapshot as
`capacity-context.json`. A failed private fingerprint, maintenance/drain check or
probe after that point consumes the attempt and writes only a sanitized stopped
receipt. Malformed outer/nested shape or invalid public owner approval rejects
before probe/claim; the parent's earlier immutable release ledger still blocks
replaying that release. Do not clear either ledger to retry. Receipt IDs are
`capacity-` plus SHA256 of the raw UTF-8 release ID. Only public whitelisted fields
are serialized; credential-bearing exception messages are replaced by fixed codes.

A receipt has `version:1`, `receiptId` (same identifier grammar as releaseId),
the eight initial context fields, the three exact quiescence fields,
`executor` equal to `approval.databaseOwner`, matching `approvalReference`,
`allPreviousDeploymentsInactive:true`, `noPendingDeployment:true`,
`maintenanceCommandsVerified:true`, UTC `startedAt`/`completedAt`,
`state:"passed"`, `passed:true`, `allConnectionsClosed:true`, `writes:false`,
`claims:false`, `retry:false`, and exactly these five role results:

| kind | target | principal | connectionLimit |
| --- | --- | --- | --- |
| app | source | fmt_app_dev | 5 |
| capture | source | fmt_audit_capture_dev | 2 |
| worker | source | fmt_audit_worker_dev | 2 |
| writer | destination | fmt_audit_writer_dev | 2 |
| reader | destination | fmt_audit_reader_dev | 2 |

Each role additionally requires `otherConnections:0`, `passed:true`,
`tlsVerified:true`, `readOnly:true`. Hook checks must use restricted principals,
PG17, hostname/certificate-verified TLS, bounded read-only metadata transactions,
no role/limit/schema changes, and close every probe on every path. Receipt start
must follow at least30seconds drain; completion must follow start and not be in
the future. The entire quiescent observation must be at most15minutes old at
startup. The approval must remain unexpired. Changed target/runtime/baseline,
restarted consumers, failed/uncertain probe, expired observation or missing
receipt stops release. Do not retry, clear guards, kill sessions, raise caps or
resume an old runtime. Before candidate submission, preserve maintenance and
diagnose with the owner. After candidate submission/startup, a failed activation
or HTTP verification may leave maintenance, a pending candidate, or the new
candidate active. Observe and report the actual state; do not claim maintenance
is preserved after startup. Stop without blind retry, rollback, disable or resume
mutations. Any recovery mutation requires its exact separately recorded scope.

## Verification and recovery

`node scripts/test-aws-publish-db-contract.mjs` passed **97 scenarios**, covering
cross-target/source/release mismatches, current-schema/owner/compatibility absence,
expired approval, unsafe or stale maintenance, future/out-of-order receipt times,
nonzero connections, role omissions/duplication, wrong caps/principals, unverified
TLS, failed/unfinished probes and write/claim/retry evidence. `git diff --check`
passed for both new scripts. Tests import no runtime/client/private helpers and
make no network or database calls.

`node scripts/test-aws-publish-capacity.mjs` passed **109 scenarios**: sequential
five-role success; every identity/version/cap/read-only/other-session field;
open/connect/query/rollback/close/TLS/asynchronous failure for each role; no later
probe after failure; closure and no COMMIT/writes; malformed or broadened private
payloads; independent fingerprint and target/SSL rejection; false/stale/too-early
maintenance evidence; missing schema/Backend approval; explicit execution flags;
inert plan; forced driver override rejection; and fixture-secret absence from
receipts/output. `--plan`, syntax and attributable diff checks pass. All clients
in these tests are injected mocks; no live hook was executed.

No locale matrix is needed for these pure database-contract tests. Shared task
acceptance remains en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred,
with translations/history preserved.

Offline recovery removes only these new attributable files. No schema rollback is
needed because none changed. Integrated execution remains incomplete until the
assigned owners supply exact current hosted-schema/compatibility acceptance and
the exact connected release/executor grant. DB-owner acceptance of local files alone cannot
expand connected authorization. Infrastructure must retain immutable attempt
records and stop/inspect on failure. Maintenance preservation applies before
candidate submission; post-submission recovery follows the actual observed
deployment state and separately authorized recovery operations.
