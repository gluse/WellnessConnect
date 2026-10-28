# Fixed-file ACL preparation/recovery for TASK-014. No .env content reads/writes.
# Default plan reads file/ACL metadata only. protect/restore require separate
# user authorization; metadata-preflight approval does not authorize either.
param([ValidateSet('plan','protect','restore','self-test')][string]$Mode='plan')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$taskWorkspace='C:\Source\Private\WellnessConnect'
$taskSections=[Security.AccessControl.AccessControlSections]::Access -bor
  [Security.AccessControl.AccessControlSections]::Owner -bor
  [Security.AccessControl.AccessControlSections]::Group

function Stop-Safely([string]$Code) {
  $errorObject=[InvalidOperationException]::new($Code)
  $errorObject.Data['SafeCode']=$Code
  throw $errorObject
}
function Assert-Safely([bool]$Condition,[string]$Code) {
  if (-not $Condition) { Stop-Safely $Code }
}
function Get-FixedPaths([string]$Root) {
  $full=[IO.Path]::GetFullPath($Root).TrimEnd('\')
  Assert-Safely ($full -eq $taskWorkspace) 'WORKSPACE_REJECTED'
  $answer=@{Root=$full;Target=(Join-Path $full '.env');
    Backup=(Join-Path $full '.env.audit-acl-before.local');
    Temporary=(Join-Path $full '.env.audit-acl-before.local.tmp')}
  foreach ($name in @('Target','Backup','Temporary')) {
    Assert-Safely ([IO.Path]::GetDirectoryName($answer[$name]) -eq $full) 'PATH_OUTSIDE_WORKSPACE'
  }
  return $answer
}
function Get-Sddl([Security.AccessControl.FileSecurity]$Acl) {
  return $Acl.GetSecurityDescriptorSddlForm($taskSections)
}
function Get-AclFacts([Security.AccessControl.FileSecurity]$Acl,[Security.Principal.SecurityIdentifier]$Identity) {
  $rules=@($Acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  $ownerMatches=$Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq $Identity.Value
  $single=$rules.Count -eq 1
  $private=$false
  if ($single) {
    $private=$ownerMatches -and $Acl.AreAccessRulesProtected -and
      $rules[0].IdentityReference.Value -eq $Identity.Value -and
      $rules[0].AccessControlType -eq 'Allow' -and -not $rules[0].IsInherited -and
      $rules[0].FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl
  }
  return [pscustomobject]@{OwnerMatchesCurrent=$ownerMatches;Protected=$Acl.AreAccessRulesProtected;
    RuleCount=$rules.Count;CurrentUserOnly=$private}
}
function New-ProtectedAcl([Security.AccessControl.FileSecurity]$Original,[Security.Principal.SecurityIdentifier]$Identity) {
  Assert-Safely ((Get-AclFacts $Original $Identity).OwnerMatchesCurrent) 'TARGET_OWNER_MISMATCH'
  $copy=[Security.AccessControl.FileSecurity]::new()
  $copy.SetSecurityDescriptorSddlForm((Get-Sddl $Original),$taskSections)
  $copy.SetAccessRuleProtection($true,$false)
  foreach ($rule in @($copy.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))) {
    $copy.RemoveAccessRuleSpecific($rule)
  }
  $copy.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($Identity,'FullControl','Allow'))
  Assert-Safely ((Get-AclFacts $copy $Identity).CurrentUserOnly) 'PRIVATE_ACL_BUILD_FAILED'
  return $copy
}
function Assert-PlainFile([string]$Path) {
  $item=Get-Item -LiteralPath $Path -Force
  Assert-Safely (-not $item.PSIsContainer -and
    -not [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) 'FILE_REPARSE_OR_DIRECTORY'
  if ($item.PSObject.Properties['LinkType']) {
    Assert-Safely ([string]::IsNullOrEmpty([string]$item.LinkType)) 'LINKED_FILE_REJECTED'
  }
  return $item
}
function Assert-PrivateFile([string]$Path,[Security.Principal.SecurityIdentifier]$Identity) {
  $null=Assert-PlainFile $Path
  Assert-Safely ((Get-AclFacts (Get-Acl -LiteralPath $Path) $Identity).CurrentUserOnly) 'BACKUP_ACL_REJECTED'
}
function Get-FileMetadata($Item) {
  return [pscustomobject]@{Length=[string]$Item.Length;
    LastWriteTicks=[string]$Item.LastWriteTimeUtc.Ticks;
    CreationTicks=[string]$Item.CreationTimeUtc.Ticks}
}
function Assert-SameFileMetadata($Before,$After) {
  Assert-Safely ($Before.Length -eq $After.Length -and
    $Before.LastWriteTicks -eq $After.LastWriteTicks -and
    $Before.CreationTicks -eq $After.CreationTicks) 'TARGET_METADATA_DRIFT'
}
function Get-RestoreDecision([string]$CurrentSddl,[Security.AccessControl.FileSecurity]$Original,[Security.Principal.SecurityIdentifier]$Identity) {
  if ($CurrentSddl -eq (Get-Sddl $Original)) { return 'already-restored' }
  $expectedPrivate=New-ProtectedAcl $Original $Identity
  Assert-Safely ($CurrentSddl -eq (Get-Sddl $expectedPrivate)) 'TARGET_ACL_DRIFT_REVIEW_REQUIRED'
  return 'restore-original'
}
function Get-Context {
  $derivedRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
  $paths=Get-FixedPaths $derivedRoot
  $ancestor=$paths.Root
  while ($ancestor) {
    $folder=Get-Item -LiteralPath $ancestor -Force
    Assert-Safely ($folder.PSIsContainer -and
      -not [bool]($folder.Attributes -band [IO.FileAttributes]::ReparsePoint)) 'WORKSPACE_REPARSE_REJECTED'
    $ancestor=[IO.Path]::GetDirectoryName($ancestor)
  }
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
  $item=Assert-PlainFile $paths.Target
  $acl=Get-Acl -LiteralPath $paths.Target
  $facts=Get-AclFacts $acl $identity
  Assert-Safely $facts.OwnerMatchesCurrent 'TARGET_OWNER_MISMATCH'
  foreach ($name in @('.env','.env.audit-acl-before.local','.env.audit-acl-before.local.tmp')) {
    $ignored=& git.exe -C $paths.Root check-ignore -- $name 2>$null
    Assert-Safely ($LASTEXITCODE -eq 0 -and $ignored -eq $name) 'PRIVATE_PATH_NOT_IGNORED'
  }
  foreach ($name in @('Backup','Temporary')) {
    if (Test-Path -LiteralPath $paths[$name]) { $null=Assert-PlainFile $paths[$name] }
  }
  return [pscustomobject]@{Paths=$paths;Identity=$identity;OriginalAcl=$acl;
    Metadata=(Get-FileMetadata $item);Facts=$facts}
}
function New-RecoveryRecord($Context) {
  return [pscustomobject]@{SchemaVersion=1;Task='TASK-014';Workspace=$taskWorkspace;Target='.env';
    CreatedAt=[DateTime]::UtcNow.ToString('o');CreatedBySid=$Context.Identity.Value;
    OriginalSddl=(Get-Sddl $Context.OriginalAcl);Metadata=$Context.Metadata}
}
function Read-RecoveryRecord($Context) {
  Assert-PrivateFile $Context.Paths.Backup $Context.Identity
  $backupItem=Get-Item -LiteralPath $Context.Paths.Backup -Force
  Assert-Safely ($backupItem.Length -gt 0 -and $backupItem.Length -le 65536) 'RECOVERY_SIZE_REJECTED'
  # Only this fixed protected metadata backup is read. .env is never opened.
  $record=[IO.File]::ReadAllText($Context.Paths.Backup) | ConvertFrom-Json
  Assert-RecoveryRecord $record $Context.Identity
  return $record
}
function Assert-RecoveryRecord($Record,[Security.Principal.SecurityIdentifier]$Identity) {
  $keys=@($Record.PSObject.Properties.Name | Sort-Object)
  $expected=@('SchemaVersion','Task','Workspace','Target','CreatedAt','CreatedBySid','OriginalSddl','Metadata' | Sort-Object)
  Assert-Safely (($keys -join '|') -eq ($expected -join '|')) 'RECOVERY_FIELDS_REJECTED'
  Assert-Safely ($Record.SchemaVersion -eq 1 -and $Record.Task -eq 'TASK-014' -and
    $Record.Workspace -eq $taskWorkspace -and $Record.Target -eq '.env' -and
    $Record.CreatedBySid -eq $Identity.Value) 'RECOVERY_SCOPE_REJECTED'
  Assert-Safely ($Record.OriginalSddl -is [string] -and $Record.OriginalSddl.Length -le 49152) 'RECOVERY_SDDL_REJECTED'
  $metadataKeys=@($Record.Metadata.PSObject.Properties.Name | Sort-Object)
  Assert-Safely (($metadataKeys -join '|') -eq 'CreationTicks|LastWriteTicks|Length') 'RECOVERY_METADATA_REJECTED'
  foreach ($name in @('Length','LastWriteTicks','CreationTicks')) {
    $number=0L
    Assert-Safely ([long]::TryParse([string]$Record.Metadata.$name,[ref]$number) -and $number -ge 0) 'RECOVERY_METADATA_REJECTED'
  }
  $original=[Security.AccessControl.FileSecurity]::new()
  $original.SetSecurityDescriptorSddlForm($Record.OriginalSddl,$taskSections)
  Assert-Safely ((Get-AclFacts $original $Identity).OwnerMatchesCurrent) 'RECOVERY_OWNER_REJECTED'
}
function Write-RecoveryRecord($Context) {
  Assert-Safely (-not (Test-Path -LiteralPath $Context.Paths.Backup)) 'BACKUP_ALREADY_EXISTS'
  Assert-Safely (-not (Test-Path -LiteralPath $Context.Paths.Temporary)) 'BACKUP_TEMP_EXISTS'
  $createdTemporary=$false
  try {
    $stream=[IO.File]::Open($Context.Paths.Temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $createdTemporary=$true
    $stream.Dispose()
    # Protect the empty file before writing any recovery security descriptor.
    $private=[Security.AccessControl.FileSecurity]::new()
    $private.SetOwner($Context.Identity)
    $private.SetAccessRuleProtection($true,$false)
    $private.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($Context.Identity,'FullControl','Allow'))
    Set-Acl -LiteralPath $Context.Paths.Temporary -AclObject $private
    Assert-PrivateFile $Context.Paths.Temporary $Context.Identity
    $json=New-RecoveryRecord $Context | ConvertTo-Json -Compress -Depth 4
    [IO.File]::WriteAllText($Context.Paths.Temporary,$json,[Text.UTF8Encoding]::new($false))
    Assert-PrivateFile $Context.Paths.Temporary $Context.Identity
    [IO.File]::Move($Context.Paths.Temporary,$Context.Paths.Backup)
    $createdTemporary=$false
    Assert-PrivateFile $Context.Paths.Backup $Context.Identity
    $record=Read-RecoveryRecord $Context
    Assert-Safely ($record.OriginalSddl -eq (Get-Sddl $Context.OriginalAcl)) 'RECOVERY_VERIFICATION_FAILED'
  } finally {
    if ($createdTemporary -and (Test-Path -LiteralPath $Context.Paths.Temporary)) {
      # Fixed workspace path only; no recursive removal or target/backup deletion.
      $null=Assert-PlainFile $Context.Paths.Temporary
      [IO.File]::Delete($Context.Paths.Temporary)
    }
  }
}
function Set-VerifiedAcl($Context,[Security.AccessControl.FileSecurity]$Next,[string]$ExpectedSddl) {
  $beforeSddl=Get-Sddl (Get-Acl -LiteralPath $Context.Paths.Target)
  $attempted=$false
  try {
    $item=Assert-PlainFile $Context.Paths.Target
    Assert-SameFileMetadata $Context.Metadata (Get-FileMetadata $item)
    Assert-Safely ($beforeSddl -eq (Get-Sddl $Context.OriginalAcl)) 'TARGET_ACL_DRIFT_REVIEW_REQUIRED'
    # One Set-Acl applies one Windows security descriptor. There is no content
    # stream, credential read or multi-file transaction masquerading as atomic.
    $attempted=$true
    $daclOnly=[Security.AccessControl.FileSecurity]::new()
    $daclOnly.SetSecurityDescriptorSddlForm((Get-Sddl $Next),[Security.AccessControl.AccessControlSections]::Access)
    Set-Acl -LiteralPath $Context.Paths.Target -AclObject $daclOnly
    $after=Get-Acl -LiteralPath $Context.Paths.Target
    Assert-Safely ((Get-Sddl $after) -eq $ExpectedSddl) 'APPLIED_ACL_VERIFICATION_FAILED'
    Assert-SameFileMetadata $Context.Metadata (Get-FileMetadata (Assert-PlainFile $Context.Paths.Target))
  } catch {
    $originalError=$_
    if ($attempted) {
      try {
        # Recovery restores exactly the descriptor observed immediately before
        # this single operation, never another file or an assumed broad ACL.
        $null=Assert-PlainFile $Context.Paths.Target
        Assert-SameFileMetadata $Context.Metadata (Get-FileMetadata (Assert-PlainFile $Context.Paths.Target))
        $rollbackObserved=Get-Sddl (Get-Acl -LiteralPath $Context.Paths.Target)
        Assert-Safely ($rollbackObserved -eq $beforeSddl -or $rollbackObserved -eq $ExpectedSddl) 'ROLLBACK_ACL_DRIFT_REVIEW_REQUIRED'
        if ($rollbackObserved -ne $beforeSddl) {
          $rollbackDacl=[Security.AccessControl.FileSecurity]::new()
          $rollbackDacl.SetSecurityDescriptorSddlForm($beforeSddl,[Security.AccessControl.AccessControlSections]::Access)
          Set-Acl -LiteralPath $Context.Paths.Target -AclObject $rollbackDacl
        }
        Assert-Safely ((Get-Sddl (Get-Acl -LiteralPath $Context.Paths.Target)) -eq $beforeSddl) 'ROLLBACK_VERIFICATION_FAILED'
        $originalError.Exception.Data['Recovery']='restored-prior-acl'
      } catch { $originalError.Exception.Data['Recovery']='rollback-failed-review-required' }
    }
    throw $originalError
  }
}
function Invoke-SelfTest {
  $count=0
  function Assert-Test([bool]$Condition) { Assert-Safely $Condition 'SELF_TEST_FAILED' }
  $sid=[Security.Principal.SecurityIdentifier]::new('S-1-5-21-1-2-3-1001')
  $sample=[Security.AccessControl.FileSecurity]::new()
  $sample.SetSecurityDescriptorSddlForm('O:S-1-5-21-1-2-3-1001G:SYD:AI(A;;FW;;;S-1-5-21-1-2-3-1001)(A;ID;FA;;;SY)(A;ID;FR;;;BU)',$taskSections)
  $original=Get-Sddl $sample
  Assert-Test (-not (Get-AclFacts $sample $sid).CurrentUserOnly);$count++
  $private=New-ProtectedAcl $sample $sid
  Assert-Test ((Get-AclFacts $private $sid).CurrentUserOnly);$count++
  Assert-Test ((Get-Sddl $sample) -eq $original);$count++
  Assert-Test ($private.GetGroup([Security.Principal.SecurityIdentifier]).Value -eq $sample.GetGroup([Security.Principal.SecurityIdentifier]).Value);$count++
  $roundtrip=[Security.AccessControl.FileSecurity]::new()
  $roundtrip.SetSecurityDescriptorSddlForm($original,$taskSections)
  Assert-Test ((Get-Sddl $roundtrip) -eq $original);$count++
  $accessOnly=[Security.AccessControl.FileSecurity]::new()
  $accessOnly.SetSecurityDescriptorSddlForm((Get-Sddl $private),[Security.AccessControl.AccessControlSections]::Access)
  Assert-Test ($null -eq $accessOnly.GetOwner([Security.Principal.SecurityIdentifier]));$count++
  Assert-Test ($null -eq $accessOnly.GetGroup([Security.Principal.SecurityIdentifier]));$count++
  Assert-Test ((Get-RestoreDecision $original $sample $sid) -eq 'already-restored');$count++
  Assert-Test ((Get-RestoreDecision (Get-Sddl $private) $sample $sid) -eq 'restore-original');$count++
  $drift=[Security.AccessControl.FileSecurity]::new()
  $drift.SetSecurityDescriptorSddlForm((Get-Sddl $private),$taskSections)
  $drift.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'),'Read','Allow'))
  $rejected=$false
  try { $null=Get-RestoreDecision (Get-Sddl $drift) $sample $sid } catch { $rejected=$true }
  Assert-Test $rejected;$count++
  $context=[pscustomobject]@{Identity=$sid;OriginalAcl=$sample;Metadata=[pscustomobject]@{Length='17';LastWriteTicks='23';CreationTicks='11'}}
  $record=New-RecoveryRecord $context
  Assert-RecoveryRecord $record $sid;$count++
  $fromJson=($record | ConvertTo-Json -Compress -Depth 4) | ConvertFrom-Json
  Assert-RecoveryRecord $fromJson $sid;$count++
  foreach ($field in @('Workspace','Target','CreatedBySid','OriginalSddl')) {
    $invalid=($record | ConvertTo-Json -Compress -Depth 4) | ConvertFrom-Json
    $invalid.$field='invalid'
    $rejected=$false
    try { Assert-RecoveryRecord $invalid $sid } catch { $rejected=$true }
    Assert-Test $rejected;$count++
  }
  $invalidMetadata=($record | ConvertTo-Json -Compress -Depth 4) | ConvertFrom-Json
  $invalidMetadata.Metadata.Length='-1'
  $rejected=$false
  try { Assert-RecoveryRecord $invalidMetadata $sid } catch { $rejected=$true }
  Assert-Test $rejected;$count++
  Assert-Test ((Get-FixedPaths $taskWorkspace).Target -eq (Join-Path $taskWorkspace '.env'));$count++
  $rejected=$false
  try { $null=Get-FixedPaths 'C:\outside-workspace' } catch { $rejected=$true }
  Assert-Test $rejected;$count++
  Assert-SameFileMetadata $context.Metadata ([pscustomobject]@{Length='17';LastWriteTicks='23';CreationTicks='11'});$count++
  foreach ($field in @('Length','LastWriteTicks','CreationTicks')) {
    $changed=[pscustomobject]@{Length='17';LastWriteTicks='23';CreationTicks='11'}
    $changed.$field='42'
    $rejected=$false
    try { Assert-SameFileMetadata $context.Metadata $changed } catch { $rejected=$true }
    Assert-Test $rejected;$count++
  }
  return [pscustomobject]@{stage='acl-self-test';status='passed';checks=$count;
    targetContentAccess=$false;fileWrites=$false;aclWrites=$false;databaseAccess=$false}
}

try {
  if ($Mode -eq 'self-test') { Invoke-SelfTest | ConvertTo-Json -Compress; exit 0 }
  $context=Get-Context
  if ($Mode -eq 'plan') {
    [pscustomobject]@{stage='acl-plan';status='prepared';target='.env';
      ownerMatchesCurrent=$context.Facts.OwnerMatchesCurrent;protected=$context.Facts.Protected;
      ruleCount=$context.Facts.RuleCount;currentUserOnly=$context.Facts.CurrentUserOnly;
      backupExists=(Test-Path -LiteralPath $context.Paths.Backup);
      temporaryExists=(Test-Path -LiteralPath $context.Paths.Temporary);
      targetContentAccess=$false;fileWrites=$false;aclWrites=$false;databaseAccess=$false} | ConvertTo-Json -Compress
    exit 0
  }
  if ($Mode -eq 'protect') {
    if ($context.Facts.CurrentUserOnly) {
      [pscustomobject]@{stage='acl-protect';status='already-protected';targetContentAccess=$false;targetAclChanged=$false} | ConvertTo-Json -Compress
      exit 0
    }
    Write-RecoveryRecord $context
    $private=New-ProtectedAcl $context.OriginalAcl $context.Identity
    Set-VerifiedAcl $context $private (Get-Sddl $private)
    [pscustomobject]@{stage='acl-protect';status='passed';target='.env';
      backup='.env.audit-acl-before.local';targetContentAccess=$false;targetAclChanged=$true;
      backupPreserved=$true;databaseAccess=$false} | ConvertTo-Json -Compress
    exit 0
  }
  $record=Read-RecoveryRecord $context
  $original=[Security.AccessControl.FileSecurity]::new()
  $original.SetSecurityDescriptorSddlForm($record.OriginalSddl,$taskSections)
  $decision=Get-RestoreDecision (Get-Sddl $context.OriginalAcl) $original $context.Identity
  if ($decision -eq 'already-restored') {
    [pscustomobject]@{stage='acl-restore';status='already-restored';targetContentAccess=$false;targetAclChanged=$false} | ConvertTo-Json -Compress
    exit 0
  }
  Assert-SameFileMetadata $record.Metadata $context.Metadata
  Set-VerifiedAcl $context $original (Get-Sddl $original)
  [pscustomobject]@{stage='acl-restore';status='passed';target='.env';
    targetContentAccess=$false;targetAclChanged=$true;backupPreserved=$true;databaseAccess=$false} | ConvertTo-Json -Compress
  exit 0
} catch {
  $code=[string]$_.Exception.Data['SafeCode']
  if ($code -notmatch '^[A-Z_]{3,60}$') { $code='ACL_OPERATION_FAILED' }
  $recovery=[string]$_.Exception.Data['Recovery']
  if ($recovery -notin @('restored-prior-acl','rollback-failed-review-required')) { $recovery='not-needed-or-not-attempted' }
  [pscustomobject]@{stage='acl-stopped';mode=$Mode;code=$code;recovery=$recovery} | ConvertTo-Json -Compress
  exit 1
}
