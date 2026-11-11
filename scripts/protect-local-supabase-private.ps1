param([switch]$VerifyOnly)
$ErrorActionPreference='Stop'
try {
  Import-Module -Name (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
  $workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $target=[IO.Path]::GetFullPath((Join-Path $workspace 'outputs/supabase-local-private'))
  if (-not $target.StartsWith($workspace+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Target rejected' }
  if (-not (Test-Path -LiteralPath $target)) {
    if ($VerifyOnly) { throw 'Missing target' }
    [void][IO.Directory]::CreateDirectory($target)
  }
  if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse target rejected' }
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
  if (-not $VerifyOnly) {
    if (@(Get-ChildItem -Force -LiteralPath $target).Count -gt 0) { throw 'Refuse ACL change on populated target' }
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    Set-Acl -LiteralPath $target -AclObject $acl
  }
  $check=Get-Acl -LiteralPath $target
  $rules=@($check.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  if ($check.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $identity.Value -or
      -not $check.AreAccessRulesProtected -or $rules.Count -ne 1 -or
      $rules[0].IdentityReference.Value -ne $identity.Value -or $rules[0].AccessControlType -ne 'Allow' -or
      $rules[0].IsInherited -or $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or
      $rules[0].InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit') { throw 'ACL verification failed' }
  exit 0
} catch { exit 1 }
