# TASK-036: one-time local Docker prerequisite. Run elevated after user authorization.
# Does not create Linux user accounts, install a distribution, or restart Windows.
$ErrorActionPreference = 'Stop'
$localSetupOutput = Join-Path $PSScriptRoot '../../outputs/aws-staging-build/local-setup'
New-Item -ItemType Directory -Path $localSetupOutput -Force | Out-Null
$localSetupRecord = [ordered]@{
  StartedUtc = [DateTime]::UtcNow.ToString('o')
  Operation = 'wsl --install --no-distribution --web-download'
  Before = @()
  ExitCode = $null
  After = @()
  RestartInvoked = $false
  Error = $null
}
try {
  $localSetupIdentity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $localSetupIdentity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator approval is required to install the WSL prerequisite.'
  }
  foreach ($localSetupFeature in @('VirtualMachinePlatform', 'Microsoft-Windows-Subsystem-Linux')) {
    $localSetupState = Get-WindowsOptionalFeature -Online -FeatureName $localSetupFeature
    $localSetupRecord.Before += @{ Name = $localSetupFeature; State = [string]$localSetupState.State }
  }
  $localSetupTranscript = & "$env:WINDIR/System32/wsl.exe" --install --no-distribution --web-download 2>&1 | Out-String
  $localSetupRecord.ExitCode = $LASTEXITCODE
  $localSetupTranscript.Replace([string][char]0, '') | Set-Content -LiteralPath (Join-Path $localSetupOutput 'wsl-install.log') -Encoding utf8
  foreach ($localSetupFeature in @('VirtualMachinePlatform', 'Microsoft-Windows-Subsystem-Linux')) {
    $localSetupState = Get-WindowsOptionalFeature -Online -FeatureName $localSetupFeature
    $localSetupRecord.After += @{ Name = $localSetupFeature; State = [string]$localSetupState.State }
  }
} catch {
  $localSetupRecord.Error = $_.Exception.Message
} finally {
  $localSetupRecord.CompletedUtc = [DateTime]::UtcNow.ToString('o')
  $localSetupRecord | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $localSetupOutput 'wsl-result.json') -Encoding utf8
}
if ($localSetupRecord.Error) { exit 1 }
exit $localSetupRecord.ExitCode
