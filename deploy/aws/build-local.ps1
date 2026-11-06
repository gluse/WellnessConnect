[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SnapshotDirectory
)

# TASK-036: build/test only. No dotenv files, application startup, database or AWS calls.
$ErrorActionPreference = 'Stop'
$localBuildWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$localBuildArtifacts = [IO.Path]::GetFullPath((Join-Path $localBuildWorkspace 'outputs/aws-staging-build'))
$localBuildSnapshot = (Resolve-Path -LiteralPath $SnapshotDirectory).Path
if (-not $localBuildSnapshot.StartsWith($localBuildArtifacts + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path -Leaf $localBuildSnapshot) -notlike 'source-*') {
  throw 'Use a reviewed source-* snapshot under outputs/aws-staging-build.'
}
$localBuildContext = Join-Path $localBuildSnapshot 'context'
$localBuildManifest = Get-Content -LiteralPath (Join-Path $localBuildSnapshot 'manifest.json') -Raw | ConvertFrom-Json
if ($localBuildManifest.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid source manifest.' }
$localBuildEntries = @(Get-ChildItem -LiteralPath $localBuildContext -Force -Recurse)
if (@($localBuildEntries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Source links are refused.' }
if (@($localBuildEntries | Where-Object { -not $_.PSIsContainer }).Count -ne @($localBuildManifest.files).Count) { throw 'Unexpected source snapshot files.' }
foreach ($localBuildFile in $localBuildManifest.files) {
  $localBuildSource = [IO.Path]::GetFullPath((Join-Path $localBuildContext $localBuildFile.path))
  if (-not $localBuildSource.StartsWith($localBuildContext + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source path outside snapshot.' }
  if ((Get-FileHash -LiteralPath $localBuildSource -Algorithm SHA256).Hash.ToLowerInvariant() -ne $localBuildFile.sha256) { throw "Changed snapshot input: $($localBuildFile.path)" }
}

$localBuildDocker = Join-Path $env:USERPROFILE 'AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'
if (-not (Test-Path -LiteralPath $localBuildDocker)) { throw 'Per-user Docker Desktop is not installed.' }
if ($env:DOCKER_HOST) { throw 'Remove the remote DOCKER_HOST override before this local build.' }
$localBuildEndpoint = & $localBuildDocker context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or $localBuildEndpoint -notlike 'npipe:*') { throw 'A local Windows Docker context is required.' }
$localBuildOs = & $localBuildDocker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $localBuildOs -ne 'linux') { throw 'Start the Docker Desktop Linux engine after the required Windows restart.' }

$localGatewayBasePath = Join-Path $localBuildSnapshot 'gateway-base.json'
if (Test-Path -LiteralPath $localGatewayBasePath) {
  $localGatewayBase = Get-Content -LiteralPath $localGatewayBasePath -Raw | ConvertFrom-Json
  if ($localGatewayBase.image -ne 'fitsmytime-staging:pc-2ea7c952e9935e96' -or
      $localGatewayBase.imageId -ne 'sha256:283569798ce4701a333c4d05992b94618c5e5a6016b644346d4d0e559fec1a02') { throw 'Unexpected gateway base image.' }
  $localGatewayActual = & $localBuildDocker image inspect $localGatewayBase.image --format '{{.Id}}'
  if ($LASTEXITCODE -ne 0 -or $localGatewayActual -ne $localGatewayBase.imageId) { throw 'Reviewed local gateway base image is missing or changed.' }
}

$localBuildTag = 'fitsmytime-staging:pc-' + $localBuildManifest.sha256.Substring(0, 16)
& $localBuildDocker build --platform linux/amd64 --target runtime --tag $localBuildTag $localBuildContext
if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed; inspect the result before any retry.' }
$localBuildProxyTest = Join-Path $localBuildContext 'deploy/aws/test-staging-proxy.mjs'
& $localBuildDocker run --rm --network none --mount "type=bind,source=$localBuildProxyTest,target=/app/test-staging-proxy.mjs,readonly" $localBuildTag node test-staging-proxy.mjs
if ($LASTEXITCODE -ne 0) { throw 'Linux staging proxy verification failed.' }
& $localBuildDocker run --rm --network none $localBuildTag node -e 'const fs=require("node:fs");for(const f of ["dist/index.js","dist/audit-worker.js","dist/notification-worker.js","dist/activity-worker.js","dist/public/index.html","certs/supabase-ca.crt"])if(!fs.existsSync(f))process.exit(1);console.log("Production artifacts present")'
if ($LASTEXITCODE -ne 0) { throw 'Production image is missing required artifacts.' }
$localBuildImage = & $localBuildDocker image inspect $localBuildTag --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Built image inspection failed.' }
$localBuildResult = [ordered]@{
  CompletedUtc = [DateTime]::UtcNow.ToString('o')
  SourceManifestSha256 = $localBuildManifest.sha256
  ImageTag = $localBuildTag
  ImageId = $localBuildImage
  Platform = 'linux/amd64'
  IsolatedProxyAndArtifactsPassed = $true
  ApplicationStarted = $false
  Published = $false
}
$localBuildResult | ConvertTo-Json | Tee-Object -FilePath (Join-Path $localBuildSnapshot 'local-build-result.json')
