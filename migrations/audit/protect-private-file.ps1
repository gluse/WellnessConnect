param([Parameter(Mandatory=$true)][string]$TargetPath,[Parameter(Mandatory=$true)][string]$UserSid)
$ErrorActionPreference='Stop'
try {
  $taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
  $resolved=[IO.Path]::GetFullPath($TargetPath)
  $allowed=@('.env.audit-tmp','.env.audit-setup.local.audit-tmp','.env.audit-worker.local.audit-tmp',
    '.env.audit-test.local.audit-tmp','.env.audit-before-runtime.local.audit-tmp')
  if ([IO.Path]::GetDirectoryName($resolved) -ne $taskRoot -or
      [IO.Path]::GetFileName($resolved) -notin $allowed -or
      (Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid target' }
  $identity=[Security.Principal.SecurityIdentifier]::new($UserSid)
  if ($identity.Value -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) { throw 'Wrong identity' }
  $acl=[Security.AccessControl.FileSecurity]::new()
  $acl.SetOwner($identity)
  $acl.SetAccessRuleProtection($true,$false)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))
  Set-Acl -LiteralPath $resolved -AclObject $acl
  $check=Get-Acl -LiteralPath $resolved
  $rules=@($check.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if (-not $check.AreAccessRulesProtected -or $rules.Count -ne 1 -or
      $rules[0].IdentityReference.Value -ne $identity.Value -or
      $rules[0].AccessControlType -ne 'Allow' -or $rules[0].IsInherited) { throw 'ACL verification failed' }
  exit 0
} catch { exit 1 }
