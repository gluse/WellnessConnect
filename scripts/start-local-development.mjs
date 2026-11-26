// Independent Docker development only; importing this module has no side effects.
import { readFileSync, writeFileSync, openSync, closeSync, lstatSync, realpathSync, existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readSettings } from '../migrations/audit/runtime-support.mjs';
import { assertAuditActivation, LOCAL_AUDIT_PORTS } from '../server/audit/config.ts';
import { resolveLocalGit, LocalGitUnavailableError } from './local-git.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const LOCAL_PROFILE_NAME = '.env.local-docker.local';
export function localDormantOperation(args) {
  return args.length === 1 && ['--billing', '--notifications-worker', '--activity-worker'].includes(args[0]);
}
const fields = new Set(['NODE_ENV', 'AUDIT_RUNTIME_PROFILE', 'AUDIT_ENVIRONMENT', 'DATABASE_URL',
  'AUDIT_CAPTURE_DATABASE_URL', 'AUDIT_SOURCE_DATABASE_URL', 'AUDIT_DATABASE_URL', 'AUDIT_READER_DATABASE_URL',
  'AUDIT_ENABLED', 'AUDIT_WORKER_ENABLED', 'AUDIT_SERVICE_VIEWS_ENABLED', 'AUDIT_AUTH_EVENTS_ENABLED',
  'AUDIT_PRODUCER_CONTRACT', 'AUDIT_READER_USER_IDS', 'AUDIT_EXPORT_USER_IDS', 'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET', 'APP_URL', 'PORT', 'SESSION_SECRET',
  'APP_ADMIN_USER_IDS', 'SUPABASE_GOOGLE_ENABLED', 'SUPABASE_FACEBOOK_ENABLED', 'SUPABASE_APPLE_ENABLED',
  'SUPABASE_MICROSOFT_ENABLED', 'NOTIFICATIONS_ENABLED', 'NOTIFICATIONS_AUTOMATION_ENABLED',
  'NOTIFICATIONS_VERIFICATION_ENABLED', 'PRODUCT_ACTIVITY_ENABLED', 'STRIPE_BILLING_ENABLED', 'STRIPE_NEW_CHECKOUTS_ENABLED']);
const operatingSystemFields = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP',
  'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'HOME', 'LANG', 'TERM', 'COLORTERM',
  'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS']);
const fail = () => { throw new Error('LOCAL_DEVELOPMENT_CONFIGURATION_REFUSED'); };

/** The child receives only local credentials plus OS process infrastructure. */
export function prepareLocalDevelopmentEnvironment(profile, inherited = {}, { worker = false } = {}) {
  if (!profile || Object.keys(profile).some(key => !fields.has(key))) fail();
  if (profile.NODE_ENV !== 'development' || profile.AUDIT_RUNTIME_PROFILE !== 'local-docker' ||
    profile.AUDIT_ENVIRONMENT !== 'development' || profile.AUDIT_ENABLED !== 'true' ||
    profile.AUDIT_AUTH_EVENTS_ENABLED !== 'false' || profile.AUDIT_PRODUCER_CONTRACT !== 'completion-0008' ||
    profile.PORT !== '5000' || !profile.APP_URL || !profile.SUPABASE_PUBLISHABLE_KEY || !profile.SUPABASE_SECRET_KEY ||
    !profile.SUPABASE_STORAGE_BUCKET || !profile.SESSION_SECRET || profile.SESSION_SECRET.length < 32) fail();
  for (const field of ['DATABASE_URL', 'AUDIT_CAPTURE_DATABASE_URL', 'AUDIT_SOURCE_DATABASE_URL', 'AUDIT_DATABASE_URL', 'AUDIT_READER_DATABASE_URL']) if (!profile[field]) fail();
  for (const value of Object.values(profile)) if (typeof value !== 'string' || /[\r\n\0]/.test(value)) fail();
  assertAuditActivation({ ...profile, AUDIT_WORKER_ENABLED: 'true' });
  const result = Object.fromEntries(Object.entries(inherited).filter(([key]) => operatingSystemFields.has(key.toUpperCase())));
  Object.assign(result, profile, { AUDIT_WORKER_ENABLED: worker ? 'true' : 'false',
    DOTENV_CONFIG_PATH: path.join(ROOT, LOCAL_PROFILE_NAME), DOTENV_CONFIG_QUIET: 'true',
    DOTENV_PATH: path.join(ROOT, LOCAL_PROFILE_NAME), DOTENV_QUIET: 'true' });
  return result;
}

function verifyProtectedPath(filename, { directory = false, allowInherited = false } = {}) {
  const metadata = lstatSync(filename);
  if ((directory ? !metadata.isDirectory() : !metadata.isFile()) || metadata.isSymbolicLink() || (!directory && metadata.size > 65536) ||
    realpathSync(filename).toLowerCase() !== filename.toLowerCase()) fail();
  const relative = path.relative(ROOT, filename).replaceAll('\\', '/');
  if (relative.startsWith('../') || path.isAbsolute(relative)) fail();
  const ignored = spawnSync(resolveLocalGit(), ['check-ignore', '--', relative], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  if (ignored.status !== 0) fail();
  if (process.platform === 'win32') {
    const script = `$ErrorActionPreference='Stop';try {
      Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop;
      $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;
      $acl=Get-Acl -LiteralPath $env:FMT_LOCAL_PROFILE_PATH;
      $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));
      if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or
        (-not $acl.AreAccessRulesProtected -and $env:FMT_LOCAL_INHERITED_ALLOWED -ne 'true') -or $rules.Count -ne 1 -or
        $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].AccessControlType -ne 'Allow' -or
        ($rules[0].IsInherited -and $env:FMT_LOCAL_INHERITED_ALLOWED -ne 'true') -or $rules[0].FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) {exit 1};exit 0
      } catch {exit 1}`;
    const check = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, FMT_LOCAL_PROFILE_PATH: filename, FMT_LOCAL_INHERITED_ALLOWED: String(allowInherited) }, windowsHide: true, encoding: 'utf8',
    });
    if (check.status !== 0) fail();
  } else if ((metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.()) fail();
}

function readProtectedProfile() {
  const filename = path.join(ROOT, LOCAL_PROFILE_NAME);
  verifyProtectedPath(filename);
  return readSettings(readFileSync(filename, 'utf8'));
}

export function loadLocalDevelopmentEnvironment({ worker = false } = {}) {
  return prepareLocalDevelopmentEnvironment(readProtectedProfile(), process.env, { worker });
}

export function readLocalSmokeFixture() {
  const parent = path.join(ROOT, 'outputs/supabase-local-private');
  verifyProtectedPath(parent, { directory: true });
  const filename = path.join(parent, 'smoke-fixture.json');
  verifyProtectedPath(filename, { allowInherited: true });
  return JSON.parse(readFileSync(filename, 'utf8'));
}

/** Source secrets never enter the resulting local profile. */
export function assembleLocalProfile(bootstrap, status, original, sessionSecret) {
  const names = ['APP_ADMIN_USER_IDS', 'AUDIT_READER_USER_IDS', 'AUDIT_EXPORT_USER_IDS', 'AUDIT_SERVICE_VIEWS_ENABLED'];
  if (!bootstrap?.roles || typeof status?.API_URL !== 'string' || status.API_URL !== `http://127.0.0.1:${LOCAL_AUDIT_PORTS.api}` ||
    !status.ANON_KEY || !status.SERVICE_ROLE_KEY || Object.keys(original).some(key => !names.includes(key))) fail();
  const localUrl = (role, port) => {
    const password = bootstrap.roles[role];
    if (typeof password !== 'string' || password.length < 24 || /[\x00-\x20\x7f]/.test(password)) fail();
    return `postgresql://${role}:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres?sslmode=disable`;
  };
  const profile = {
    NODE_ENV: 'development', AUDIT_RUNTIME_PROFILE: 'local-docker', AUDIT_ENVIRONMENT: 'development',
    DATABASE_URL: localUrl('fmt_app_dev', LOCAL_AUDIT_PORTS.source), AUDIT_CAPTURE_DATABASE_URL: localUrl('fmt_audit_capture_dev', LOCAL_AUDIT_PORTS.source),
    AUDIT_SOURCE_DATABASE_URL: localUrl('fmt_audit_worker_dev', LOCAL_AUDIT_PORTS.source), AUDIT_DATABASE_URL: localUrl('fmt_audit_writer_dev', LOCAL_AUDIT_PORTS.destination),
    AUDIT_READER_DATABASE_URL: localUrl('fmt_audit_reader_dev', LOCAL_AUDIT_PORTS.destination),
    AUDIT_ENABLED: 'true', AUDIT_WORKER_ENABLED: 'true', AUDIT_AUTH_EVENTS_ENABLED: 'false',
    AUDIT_SERVICE_VIEWS_ENABLED: original.AUDIT_SERVICE_VIEWS_ENABLED ?? 'false', AUDIT_PRODUCER_CONTRACT: 'completion-0008',
    AUDIT_READER_USER_IDS: original.AUDIT_READER_USER_IDS ?? '', AUDIT_EXPORT_USER_IDS: original.AUDIT_EXPORT_USER_IDS ?? '',
    APP_ADMIN_USER_IDS: original.APP_ADMIN_USER_IDS ?? '', SUPABASE_URL: status.API_URL,
    SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: 'service-images', APP_URL: 'http://localhost:5000', PORT: '5000', SESSION_SECRET: sessionSecret,
    SUPABASE_GOOGLE_ENABLED: 'false', SUPABASE_FACEBOOK_ENABLED: 'false', SUPABASE_APPLE_ENABLED: 'false', SUPABASE_MICROSOFT_ENABLED: 'false',
    NOTIFICATIONS_ENABLED: 'false', NOTIFICATIONS_AUTOMATION_ENABLED: 'false', NOTIFICATIONS_VERIFICATION_ENABLED: 'false',
    PRODUCT_ACTIVITY_ENABLED: 'false', STRIPE_BILLING_ENABLED: 'false', STRIPE_NEW_CHECKOUTS_ENABLED: 'false',
  };
  prepareLocalDevelopmentEnvironment(profile);
  return profile;
}

function writeNewProtectedFile(filename, value) {
  // Exclusive creation plus ACL protection precede the first secret byte written.
  const fd = openSync(filename, 'wx', 0o600); closeSync(fd);
  if (process.platform === 'win32') {
    const script = `$ErrorActionPreference='Stop';try {
      Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop;
      $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;
      $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow'));
      Set-Acl -LiteralPath $env:FMT_LOCAL_PROFILE_PATH -AclObject $acl;exit 0
    }catch{exit 1}`;
    const secured = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, FMT_LOCAL_PROFILE_PATH: filename }, windowsHide: true, encoding: 'utf8',
    });
    if (secured.status !== 0) fail();
  }
  verifyProtectedPath(filename);
  writeFileSync(filename, value);
}

/** Rewrite only the six known local endpoint values; credentials and other fields stay exact. */
export function planLocalPortMigration(text) {
  const original = readSettings(text), updates = {};
  if (original.SUPABASE_URL !== 'http://127.0.0.1:54321') fail();
  const urls = { DATABASE_URL: [54322, LOCAL_AUDIT_PORTS.source], AUDIT_CAPTURE_DATABASE_URL: [54322, LOCAL_AUDIT_PORTS.source],
    AUDIT_SOURCE_DATABASE_URL: [54322, LOCAL_AUDIT_PORTS.source], AUDIT_DATABASE_URL: [54332, LOCAL_AUDIT_PORTS.destination],
    AUDIT_READER_DATABASE_URL: [54332, LOCAL_AUDIT_PORTS.destination] };
  for (const [key, [beforePort, afterPort]] of Object.entries(urls)) {
    const value = original[key];
    if (typeof value !== 'string') fail();
    const uri = new URL(value);
    if (uri.hostname !== '127.0.0.1' || uri.port !== String(beforePort)) fail();
    updates[key] = value.replace(`@127.0.0.1:${beforePort}/`, `@127.0.0.1:${afterPort}/`);
    if (updates[key] === value) fail();
  }
  updates.SUPABASE_URL = `http://127.0.0.1:${LOCAL_AUDIT_PORTS.api}`;
  const expected = { ...original, ...updates };
  prepareLocalDevelopmentEnvironment(expected);
  const nextText = text.replace(/^([^\S\r\n]*(?:export[ \t]+)?)([A-Z][A-Z0-9_]*)[^\S\r\n]*=[^\r\n]*$/gm,
    (line, prefix, key) => Object.hasOwn(updates, key) ? `${prefix}${key}=${JSON.stringify(updates[key])}` : line);
  const actual = readSettings(nextText);
  if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => actual[key] !== value)) fail();
  return { text: nextText, changedKeys: Object.keys(updates) };
}

function migrateProfilePorts() {
  const filename = path.join(ROOT, LOCAL_PROFILE_NAME);
  verifyProtectedPath(filename);
  const before = readFileSync(filename);
  const migration = planLocalPortMigration(before.toString('utf8'));
  const backup = path.join(ROOT, `${LOCAL_PROFILE_NAME}.before-154xx-20261110`);
  const temporary = path.join(ROOT, `${LOCAL_PROFILE_NAME}.port154xx-tmp`);
  writeNewProtectedFile(backup, before);
  if (!readFileSync(backup).equals(before)) fail();
  writeNewProtectedFile(temporary, migration.text);
  verifyProtectedPath(filename);
  if (!readFileSync(filename).equals(before)) fail();
  renameSync(temporary, filename);
  prepareLocalDevelopmentEnvironment(readProtectedProfile());
  console.log('Updated exactly six local endpoint URLs to 154xx ports; protected rollback copy retained, credentials and other settings preserved.');
}

function prepareProfile() {
  const filename = path.join(ROOT, LOCAL_PROFILE_NAME);
  if (existsSync(filename)) fail();
  const parent = path.join(ROOT, 'outputs/supabase-local-private');
  verifyProtectedPath(parent, { directory: true });
  const bootstrapPath = path.join(parent, 'local-bootstrap.json'), statusPath = path.join(parent, 'supabase-status.json');
  for (const input of [bootstrapPath, statusPath]) verifyProtectedPath(input, { allowInherited: true });
  verifyProtectedPath(path.join(ROOT, '.env'));
  const bootstrap = JSON.parse(readFileSync(bootstrapPath, 'utf8'));
  const status = JSON.parse(readFileSync(statusPath, 'utf8'));
  const selectedText = readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(line =>
    /^\s*(?:export\s+)?(?:APP_ADMIN_USER_IDS|AUDIT_READER_USER_IDS|AUDIT_EXPORT_USER_IDS|AUDIT_SERVICE_VIEWS_ENABLED)\s*=/.test(line)).join('\n');
  const profile = assembleLocalProfile(bootstrap, status, readSettings(selectedText), randomBytes(48).toString('base64url'));
  writeNewProtectedFile(filename, Object.entries(profile).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n');
  prepareLocalDevelopmentEnvironment(readProtectedProfile());
  console.log('Created and verified protected local Docker profile; original hosted .env preserved.');
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--prepare') { prepareProfile(); return; }
    if (args.length === 1 && args[0] === '--migrate-ports') { migrateProfilePorts(); return; }
    if (localDormantOperation(args)) {
      console.error('This integration is disabled for the isolated local database copy. No hosted configuration or worker was started.');
      process.exitCode = 1;
      return;
    }
    if (args.some(arg => !['--worker', '--check'].includes(arg)) || new Set(args).size !== args.length) fail();
    const worker = args.includes('--worker');
    const environment = prepareLocalDevelopmentEnvironment(readProtectedProfile(), process.env, { worker });
    if (args.includes('--check')) {
      console.log(`Local Docker ${worker ? 'audit worker' : 'application'} profile verified; hosted configuration excluded.`);
      return;
    }
    const child = spawn(process.execPath, worker ? ['--import', 'tsx', 'server/audit/run-worker.ts'] : ['--import', 'tsx', '--watch', 'server/index.ts'],
      { cwd: ROOT, env: environment, stdio: 'inherit', windowsHide: true });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
    child.once('error', () => { console.error('Local Docker process could not start.'); process.exitCode = 1; });
    child.once('exit', code => { process.exitCode = code ?? 1; });
  } catch (error) {
    if (error instanceof LocalGitUnavailableError) console.error('Local Docker prerequisite missing: Git. Install Git or make an installed Git available on PATH.');
    console.error(`Local Docker operation refused. Complete the isolated copy setup and check protected ${LOCAL_PROFILE_NAME}; hosted runtime was not started.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
