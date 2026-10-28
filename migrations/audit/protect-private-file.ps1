param([Parameter(Mandatory=$true)][string]$TargetPath,[Parameter(Mandatory=$true)][string]$UserSid,[switch]$VerifyOnly)
$ErrorActionPreference='Stop'
try {
  # A Node child may inherit PowerShell 7's PSModulePath while running Windows
  # PowerShell 5. Load the installed security module from this engine's own
  # trusted home rather than relying on ambient module discovery for Get-Acl.
  Import-Module -Name (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
  $taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
  $resolved=[IO.Path]::GetFullPath($TargetPath)
  $allowed=@('.env.audit-tmp','.env.audit-setup.local.audit-tmp','.env.audit-worker.local.audit-tmp',
    '.env.audit-test.local.audit-tmp','.env.audit-before-runtime.local.audit-tmp')
  if ($VerifyOnly) { $allowed+=@('.env','.env.audit-setup.local','.env.audit-worker.local','.env.audit-test.local','.env.audit-before-runtime.local') }
  if ([IO.Path]::GetDirectoryName($resolved) -ne $taskRoot -or
      [IO.Path]::GetFileName($resolved) -notin $allowed -or
      (Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid target' }
  $identity=[Security.Principal.SecurityIdentifier]::new($UserSid)
  if ($identity.Value -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) { throw 'Wrong identity' }
  if (-not $VerifyOnly) {
    $acl=[Security.AccessControl.FileSecurity]::new()
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))
    Set-Acl -LiteralPath $resolved -AclObject $acl
  }
  $check=Get-Acl -LiteralPath $resolved
  $rules=@($check.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if ($check.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $identity.Value -or
      -not $check.AreAccessRulesProtected -or $rules.Count -ne 1 -or
      $rules[0].IdentityReference.Value -ne $identity.Value -or
      $rules[0].AccessControlType -ne 'Allow' -or $rules[0].IsInherited -or
      $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'ACL verification failed' }
  exit 0
} catch { exit 1 }
