# Rebuild and redeploy the staging gateway — manual guide

Prepared6November2026 for the existing `fitsmytime-staging` micro/one-node service
in Stockholm (`eu-north-1`), profile `fitsmytime`. This guide updates the gateway
image while preserving the actual live app, worker, endpoint and credentials.
The local source already selects `strict-origin-when-cross-origin`.

Use one PowerShell terminal in VS Code for the whole sequence. Save your files.
Run one step at a time. On an unexpected error stop and share only the error,
not environment files, passwords, API keys or raw AWS deployment responses.
Do not start the local app/audit worker during the maintenance/release steps.

Steps1–6 do not interrupt the site. Step7 starts maintenance; allow a quiet window
to finish steps7–11. Maps still needs GOOGLE_MAPS_API_KEY in the AWS app environment
and appropriate Google Cloud APIs/billing/website restrictions. Rebuilding the
gateway alone does not copy your local `.env` or enable Google Maps.

## 1. Open Docker Desktop and the project terminal

Wait for Docker Desktop's engine to run. In PowerShell:

```powershell
Set-Location C:\Source\Private\WellnessConnect
$ErrorActionPreference = 'Stop'
$gatewayDocker = Join-Path $env:USERPROFILE 'AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'
& $gatewayDocker info --format '{{.OSType}}'
```

Expected: `linux`. Keep this terminal open so its variables/functions remain.

## 2. Verify AWS identity and local gateway tests

```powershell
$gatewayAws = Join-Path $env:USERPROFILE 'AppData/Local/Programs/Amazon/AWSCLIV2/aws.exe'
& $gatewayAws sts get-caller-identity --profile fitsmytime --region eu-north-1 --no-cli-pager
```

Expected project ID674200807170. If authentication expired, stop and ask Codex to
open the existing-profile AWS login flow. Do not create access keys/new profiles.

```powershell
node deploy/aws/test-staging-proxy.mjs
```

Expected `Staging proxy checks pass`. This uses local mock servers, no DB/AWS.

## 3. Create a fresh source snapshot

```powershell
$gatewayPrepared = node deploy/aws/prepare-gateway-patch.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Snapshot preparation failed' }
$gatewaySnapshot = $gatewayPrepared.output
$gatewaySnapshot
```

This copies three reviewed build inputs to a fresh `source-gateway-*` directory.
It excludes dotenv files and reuses the original approved app image. Do not use
an old snapshot after changing the gateway. Keep the printed path for recovery.

## 4. Build and test the Linux image

```powershell
./deploy/aws/build-local.ps1 -SnapshotDirectory $gatewaySnapshot
if ($LASTEXITCODE -ne 0) { throw 'Build failed; stop' }
```

The script validates input hashes and the exact base image, builds linux/amd64,
runs mock gateway tests with networking disabled, then checks required artifacts.
Expected `IsolatedProxyAndArtifactsPassed: true`, `ApplicationStarted: false`,
`Published: false`. It does not start the real app or load private configuration.
If the original base image is missing, stop; do not substitute another image.

## 5. Upload the image to the service's private registry

```powershell
node deploy/aws/publish-local.mjs $gatewaySnapshot
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stop' }
```

Expected `published:true`, `deployed:false` and a newly assigned image reference.
Temporary registry credentials stay in memory. Uploading alone does not change
the running site. Do not repeat a successful upload to deploy it.

## 6. Define the release shortcut and prepare the actual live baseline

Paste this function once into the same PowerShell terminal:

```powershell
function Invoke-GatewayRelease {
  param([string]$Mode)
  & uvx --python 3.13 --with 'boto3[crt]' --with python-dotenv python deploy/aws/release-gateway.py $gatewaySnapshot $Mode
  if ($LASTEXITCODE -ne 0) { throw "Gateway step '$Mode' failed; stop here" }
}
```

Then:

```powershell
Invoke-GatewayRelease prepare
```

Expected `prepared:true`. This reads the live version/configuration, checks its
approved DB/audit contract and activation holds, and records only its fingerprint
and public release metadata. It preserves the existing gateway signing key and
current app environment, including any Maps key configured in AWS. The helper
now supports an already patched gateway; it does not assume every image is app.1.

## 7. Enter database-free maintenance

```powershell
Invoke-GatewayRelease maintenance
```

This creates one maintenance deployment. App/worker run idle Node commands and
open no DB connections. The public endpoint serves503 while maintenance is live.

Check status with:

```powershell
uvx --python 3.13 --with 'boto3[crt]' --with python-dotenv python deploy/aws/status-staging.py
```

Repeat only that status command after30–60seconds until the maintenance version
printed above is `current.version`, `current.state` is `ACTIVE`, service `state`
is `RUNNING`, and `next` is null. Do not rerun `maintenance`. If a deployment
fails, stop and share the filtered status. Do not use disable/deploy/enable:
AWS rejected deployment creation on a disabled service during the earlier release.

## 8. Verify maintenance and allow connections to drain

```powershell
Invoke-GatewayRelease maintenance-ready
Start-Sleep -Seconds 30
```

Expected all previous deployments inactive and all commands database-free.
The helper records this state/time. Do not start local app/workers afterward.

## 9. Run the owner's one-time, read-only capacity check

User explicitly approved preparation of this manual command; the DB owner
prepared its exact manual token. Codex did not run it while preparing this guide.
This is for you to execute in this terminal after steps7–8:

```powershell
uvx --python 3.13 --with 'boto3[crt]' --with python-dotenv python deploy/aws/release-gateway.py $gatewaySnapshot manual-capacity --manual-user-run
if ($LASTEXITCODE -ne 0) { throw 'Capacity check failed; stop and contact the DB owner' }
```

The helper rechecks maintenance, requires30s drain, then invokes the DB owner's
metadata-only command for the four approved restricted principals. It accepts
only the exact current manual authorization, four passed strict-TLS/read-only
role checks with caps5/2/2/2, zero other connections, a successful process and
closed-connection completion. Expected `passed:true`, `writes:false`, `claims:false`.
It records one attempt per snapshot. On failure do not retry, increase limits,
kill sessions or manually create/edit `capacity-release.json`; ask for diagnosis.

## 10. Activate the rebuilt gateway

```powershell
Invoke-GatewayRelease deploy-maintenance
```

This clones the live baseline from step6, changing only the gateway image and
retaining the signing key. App/worker settings, credentials, endpoint and capacity
are preserved. Only database-free maintenance overlaps the new app startup.

Repeat the status command from step7 after30–60seconds until the NEW version
printed by this command is ACTIVE/RUNNING and `next` is null. A healthy old or
maintenance version is not proof that the replacement succeeded. Do not rerun
`deploy-maintenance` after success or blindly after a failure.

## 11. Verify deployment, access protection and referrer policy

```powershell
Invoke-GatewayRelease verify
uvx --python 3.13 --with 'boto3[crt]' --with python-dotenv python deploy/aws/status-staging.py --logs --verify
if ($LASTEXITCODE -ne 0) { throw 'Live gateway verification failed; stop' }
curl.exe --head --silent --show-error 'https://fitsmytime-staging.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com/' | Select-String 'Referrer-Policy'
```

Expected exact new gateway image, preserved app/worker/endpoint, `verified:true`,
fresh healthy audit worker and:

```text
Referrer-Policy: strict-origin-when-cross-origin
```

Open the staging URL and refresh. Existing staging credentials remain valid;
the secure one-hour cookie/password protection should remain. Maps is a separate
check after its AWS runtime key and Google Cloud restrictions are configured.
Do not test failed logins or write workflows merely to verify this header.

## Preparation evidence and limits

Root prepared this guide and supporting repeat-release guards only. Local proxy
mock tests cover the selected referrer policy on challenged and forwarded
responses (including attempted upstream override), plus cookie/expiry/tamper and
original gateway protections. Offline release receipt rejection tests and script
syntax checks pass. No image was built/uploaded, no connected DB mode executed
and no service interrupted as part of guide preparation. The initial automatic
review rejection of a connected-check-capable helper was resolved by the user's
explicit approval to prepare a manual command; it did not grant agent execution.

Sources: [Lightsail deployment workflow](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-container-services-deployments.html).

## Step9 prelaunch error recovery — 6 November 2026

User reported manual-capacity UnboundLocalError in source-gateway-7HaTMV.
A function-local `import subprocess` in main's prepare branch shadowed the module
import in every main branch. Manual mode failed evaluating subprocess.run BEFORE
child launch. Root removed that import; a full-main fakeSDK/fakechild regression
reproduced the exact error before fix and passed afterward, including rejecting
second launch. All six offline tests pass; no connected execution used.

DB owner reviewed source/public receipts and accepted scoped offline guard
recovery: baseline5, maintenance6, stale marker only prelaunch timestamp/version,
no exit/summary or success receipt. Root preserved original marker bytes in
`manual-capacity-attempt.prelaunch-unboundlocalerror.json`, SHA256
54c939a56ee11e66a4e556f58fb50f7b1b4a84242ea6ddaff7edc4e519ee268c,
with `manual-capacity-prelaunch-recovery.json` annotation. Exact original JSON
was pinned and archive hash verified. No actual DB check was retried or success
receipt fabricated; manual token remains unused.

User may continue in this SAME snapshot after fresh maintenance-ready verification
(current zero-DB maintenance, all prior INACTIVE, no pending), a NEW30s drain,
then manual-capacity with explicit user flag. No rebuild/upload is needed for
this local helper fix. Stop on any new failure; never reset an actual or uncertain
launched-check marker. No agent connected execution grant was transferred.

## Subsequent flag-validation failure

The next manual attempt launched the Node child, which exited1 during local
private_inventory with UNAPPROVED_WORKER_OR_PROVIDER_FLAG, before DB connections.
Both audit URL keys are present in the worker handoff. The actual blocker was
NOTIFICATIONS_ENABLED=true in `.env.aws-staging.local`; user must save false to
preserve the selected dormant-notification staging scope. Root did not edit it.

DB owner retired the old token and prepared fresh manual authorization
TASK-036-REFERRER-MANUAL-FLAGS-2026-11-06. Helper now uses that token and checks
local feature flags before clients/attempt/child. Six offline tests pass.
Owner-approved archive preserves the exact failed inventory receipt, SHA256
25ce17e8d535f75fdcb4ff5baf5bbf71419b9ae23eb69b49ad7650deecd229b4,
in manual-capacity-attempt.offline-flag-rejection.json with a recovery annotation.
No capacity success was fabricated or new connected check executed. After saving
the false flag, user must refresh maintenance-ready, wait30s and use the same
manual-capacity helper command; no agent execution grant transferred.
