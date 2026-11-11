// Explicitly authorized isolated-copy integration. No hosted endpoints or values.
import net from 'node:net';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, openSync, closeSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLocalDevelopmentEnvironment, readLocalSmokeFixture } from './start-local-development.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const receiptPath = path.join(ROOT, 'outputs/supabase-local-private/local-backend-smoke.json');
const fixturePath = path.join(ROOT, 'outputs/supabase-local-private/smoke-fixture.json');
const allowed = process.argv.slice(2);
const full = allowed.length === 1 && allowed[0] === '--execute-local=TASK-064-LOCAL-SMOKE-2026-11-09';
const persistence = allowed.length === 1 && allowed[0] === '--verify-persistence=TASK-064-LOCAL-SMOKE-2026-11-09';
const cleanup = allowed.length === 1 && allowed[0] === '--cleanup-auth-local=TASK-064-LOCAL-SMOKE-2026-11-09';
let stage = 'arguments', child, fixtureId, cookie, environment, childExited = false;
const receipt = { task: 'TASK-064', startedAt: new Date().toISOString(), mode: cleanup ? 'cleanup' : full ? 'full' : 'persistence',
  state: 'incomplete', localOnly: true, sourceConnections: false, fixtureCreated: false, authFixtureRemoved: false,
  localPorts: { api: 15421, sourceDatabase: 15422, auditDatabase: 15432 } };
const requireThat = (value, code) => { if (!value) throw new Error(code); };
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function request(origin, pathname, options = {}) {
  requireThat(['http://127.0.0.1:5000', 'http://127.0.0.1:15421'].includes(origin), 'NONLOCAL_HTTP_REFUSED');
  requireThat(pathname.startsWith('/') && !pathname.startsWith('//'), 'BAD_LOCAL_PATH');
  return fetch(origin + pathname, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
}
async function app(pathname, options = {}) { return request('http://127.0.0.1:5000', pathname, options); }
async function admin(pathname, options = {}) {
  return request('http://127.0.0.1:15421', '/auth/v1/admin' + pathname, { ...options, headers: {
    apikey: environment.SUPABASE_SECRET_KEY, Authorization: `Bearer ${environment.SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json', ...options.headers,
  } });
}
try {
  requireThat(full || persistence || cleanup, 'EXPLICIT_LOCAL_EXECUTION_REQUIRED');
  if (full) requireThat(!existsSync(fixturePath), 'PRIOR_LOCAL_FIXTURE_REQUIRES_CLEANUP');
  stage = 'local_configuration';
  environment = loadLocalDevelopmentEnvironment();
  if (cleanup) {
    stage = 'local_auth_fixture_cleanup';
    const fixture = readLocalSmokeFixture();
    requireThat(fixture.email === 'local-copy-smoke-20261109@fixture.invalid' && /^[a-f0-9-]{36}$/.test(fixture.userId), 'BAD_LOCAL_FIXTURE_ID');
    const removed = await admin(`/users/${fixture.userId}`, { method: 'DELETE' });
    requireThat(removed.status === 200 || removed.status === 204, 'LOCAL_AUTH_CLEANUP_FAILED');
    receipt.authFixtureRemoved = true; receipt.state = 'passed';
    stage = 'bounded_cleanup_audit_delivery';
    const { runAuditWorkerRuntime } = await import('../server/audit/worker-loop.ts');
    const delivered = await runAuditWorkerRuntime(loadLocalDevelopmentEnvironment({ worker: true }), AbortSignal.timeout(30000),
      () => {}, { healthEverySteps: 1, maxSteps: 1 });
    requireThat(delivered?.steps === 1 && ['retried', 'quarantined', 'stale', 'sourceFailures', 'destinationFailures', 'captureGaps'].every(key => delivered.metrics[key] === 0), 'LOCAL_CLEANUP_AUDIT_FAILED');
    receipt.auditDelivery = { steps: delivered.steps, metrics: delivered.metrics };
  } else {
  // Refuse an existing listener rather than testing or stopping a user's process.
  stage = 'exclusive_local_port';
  const probe = net.createServer();
  probe.listen({ host: '0.0.0.0', port: 5000, exclusive: true });
  await once(probe, 'listening'); await new Promise(resolve => probe.close(resolve));
  stage = 'application_startup';
  child = spawn(process.execPath, ['--import', 'tsx', '--import', './scripts/local-smoke-network-guard.mjs', 'server/index.ts'],
    { cwd: ROOT, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  // Keep only the application's fixed, allowlisted startup diagnostic; discard raw logs.
  child.stdout.on('data', chunk => { if (String(chunk).includes('serving on port 5000')) receipt.applicationListening = true; }); child.stderr.on('data', chunk => {
    const symbols = String(chunk).match(/\b(?:ERR_[A-Z_]+|EACCES|ECONNREFUSED|SyntaxError|TypeError|ReferenceError|OpenAIError|LOCAL_SMOKE_NONLOCAL_CONNECTION_REFUSED)\b/g);
    if (symbols) receipt.startupFailureClasses = [...new Set([...(receipt.startupFailureClasses ?? []), ...symbols])];
    if (String(chunk).includes('Invalid audit runtime configuration')) receipt.startupFailureClasses = ['AUDIT_CONFIGURATION_INVALID'];
    for (const line of String(chunk).split(/\r?\n/)) if (line.startsWith('Application startup refused: ')) {
      try {
        const diagnostic = JSON.parse(line.slice('Application startup refused: '.length));
        if (diagnostic.event === 'application_startup_refused' && /^[a-z_]+$/.test(diagnostic.stage) && /^[A-Z_]+$/.test(diagnostic.code)) {
          receipt.startupDiagnostic = { stage: diagnostic.stage, code: diagnostic.code,
            checks: Array.isArray(diagnostic.checks) ? diagnostic.checks.filter(value => typeof value === 'string' && /^[a-z_0-9]+$/.test(value)) : undefined };
        }
      } catch { /* No raw diagnostic material is retained. */ }
    }
  });
  child.once('exit', (code, signal) => { childExited = true; receipt.childExit = { code, signal }; });
  child.once('error', () => { childExited = true; });
  let ready = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    requireThat(!childExited, 'LOCAL_APPLICATION_EXITED');
    try { const response = await app('/health/ready'); ready = response.status === 200 && (await response.json()).status === 'ready'; }
    catch { /* Only local startup polling, no source or copy retries. */ }
    if (ready) break; await delay(500);
  }
  requireThat(ready, 'LOCAL_APPLICATION_NOT_READY'); receipt.applicationReady = true;
  stage = 'local_listener_binding';
  requireThat(process.platform === 'win32', 'LOCAL_BIND_PROOF_REQUIRES_WINDOWS');
  const binding = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop';try {$rows=@(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction Stop | Where-Object {$_.OwningProcess -eq [int]$env:FMT_SMOKE_APP_PID});if($rows.Count -ne 1 -or $rows[0].LocalAddress -ne '127.0.0.1'){exit 1};[Console]::Out.Write('loopback-only');exit 0}catch{exit 1}"],
    { env: { ...environment, FMT_SMOKE_APP_PID: String(child.pid) }, encoding: 'utf8', windowsHide: true });
  requireThat(binding.status === 0 && binding.stdout === 'loopback-only', 'LOCAL_APPLICATION_BIND_NOT_LOOPBACK');
  receipt.loopbackListener = true;
  stage = 'guest_endpoints';
  const authHealth = await request('http://127.0.0.1:15421', '/auth/v1/health');
  requireThat(authHealth.status === 200, 'LOCAL_AUTH_HEALTH_FAILED'); receipt.authHealthy = true;
  if (persistence) {
    const passwordCheck = await request('http://127.0.0.1:15421', '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: environment.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unknown-${randomBytes(16).toString('hex')}@fixture.invalid`, password: randomBytes(32).toString('base64url') + 'aA1!' }),
    });
    const rejection = await passwordCheck.json();
    requireThat(passwordCheck.status === 400 && (rejection.error_code ?? rejection.code) === 'invalid_credentials' &&
      !rejection.access_token && !rejection.refresh_token && !rejection.user, 'LOCAL_PASSWORD_ENDPOINT_REJECTION_FAILED');
    receipt.unknownPasswordRejected = true;
  }
  requireThat((await app('/health/live')).status === 200, 'LOCAL_LIVENESS_FAILED');
  const providers = await app('/api/auth/providers');
  requireThat(providers.status === 200 && Object.values(await providers.json()).every(value => value === false), 'LOCAL_OAUTH_NOT_DORMANT');
  const maps = await app('/api/config/maps');
  requireThat(maps.status === 200 && (await maps.json()).apiKey === '', 'LOCAL_PROVIDER_KEY_EXPOSED');
  const search = await app('/api/services/search/page?limit=2');
  requireThat(search.status === 200 && Array.isArray((await search.json()).services), 'LOCAL_SEARCH_FAILED'); receipt.guestSearch = true;
  if (full) {
    stage = 'create_local_auth_fixture';
    const password = randomBytes(32).toString('base64url') + 'aA1!';
    const response = await admin('/users', { method: 'POST', body: JSON.stringify({
      email: 'local-copy-smoke-20261109@fixture.invalid', password, email_confirm: true,
      user_metadata: { first_name: 'Local', last_name: 'Copy smoke' },
    }) });
    requireThat(response.status === 200 || response.status === 201, 'LOCAL_AUTH_CREATE_FAILED');
    const user = await response.json(); fixtureId = user.id;
    requireThat(typeof fixtureId === 'string' && /^[a-f0-9-]{36}$/.test(fixtureId), 'LOCAL_AUTH_ID_FAILED');
    receipt.fixtureId = fixtureId; receipt.fixtureCreated = true;
    // Fresh password remains solely in memory; retain only the exact ID for DB-owned cleanup.
    const fixtureFD = openSync(fixturePath, 'wx', 0o600); closeSync(fixtureFD);
    writeFileSync(fixturePath, JSON.stringify({ userId: fixtureId, email: 'local-copy-smoke-20261109@fixture.invalid' }) + '\n');
    stage = 'local_login_session';
    const login = await app('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: environment.APP_URL },
      body: JSON.stringify({ email: 'local-copy-smoke-20261109@fixture.invalid', password }) });
    requireThat(login.status === 200 && (await login.json()).success === true, 'LOCAL_LOGIN_FAILED');
    cookie = login.headers.getSetCookie().map(value => value.split(';', 1)[0]).find(value => value.startsWith('wellness.sid='));
    requireThat(cookie, 'LOCAL_SESSION_COOKIE_MISSING');
    const current = await app('/api/auth/user', { headers: { Cookie: cookie } });
    requireThat(current.status === 200 && (await current.json()).id === fixtureId, 'LOCAL_SESSION_ROUNDTRIP_FAILED');
    receipt.loginSession = true;
    stage = 'local_logout';
    const logout = await app('/api/logout', { method: 'POST', headers: { Cookie: cookie, Origin: environment.APP_URL } });
    requireThat(logout.status === 200 && (await logout.json()).success === true, 'LOCAL_LOGOUT_FAILED');
    const unauthenticated = await app('/api/auth/user', { headers: { Cookie: cookie } });
    requireThat(unauthenticated.status === 401, 'LOCAL_SESSION_NOT_INVALIDATED');
    receipt.logout = true; cookie = undefined;
    stage = 'bounded_local_audit_delivery';
    const { runAuditWorkerRuntime } = await import('../server/audit/worker-loop.ts');
    let lastReport;
    const result = await runAuditWorkerRuntime(loadLocalDevelopmentEnvironment({ worker: true }), AbortSignal.timeout(30000),
      report => { lastReport = report; }, { healthEverySteps: 1, maxSteps: 1 });
    requireThat(result?.steps === 1 && result.metrics.delivered > 0 &&
      ['retried', 'quarantined', 'stale', 'sourceFailures', 'destinationFailures', 'captureGaps'].every(key => result.metrics[key] === 0), 'LOCAL_AUDIT_DELIVERY_FAILED');
    receipt.auditDelivery = { steps: result.steps, metrics: result.metrics, inheritedQuarantine: lastReport?.health?.quarantined ?? null };
  }
  receipt.state = 'passed';
  }
} catch {
  receipt.failedStage = stage;
  process.exitCode = 1;
} finally {
  if (cookie && environment) {
    try { await app('/api/logout', { method: 'POST', headers: { Cookie: cookie, Origin: environment.APP_URL } }); }
    catch { receipt.sessionCleanupPending = true; }
  }
  if (fixtureId && environment) {
    receipt.authFixtureRemovalPending = true;
    receipt.profileCleanupOwner = 'DB Analyst/Developer';
  }
  if (child && !childExited) {
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    await Promise.race([exited, delay(30000)]);
    if (!childExited) { receipt.applicationStopPending = true; receipt.state = 'incomplete'; process.exitCode = 1; }
  }
  receipt.finishedAt = new Date().toISOString();
  if ((full || persistence || cleanup) && environment) {
    const base = cleanup ? receiptPath.replace('.json', '-cleanup.json') : persistence ? receiptPath.replace('.json', '-persistence.json') : receiptPath;
    const output = existsSync(base) ? base.replace('.json', `-${Date.now()}.json`) : base;
    const fd = openSync(output, 'wx', 0o600); closeSync(fd); writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
  }
  console.log(JSON.stringify({ state: receipt.state, mode: receipt.mode, failedStage: receipt.failedStage,
    localOnly: true, applicationReady: receipt.applicationReady === true, guestSearch: receipt.guestSearch === true,
    loginSession: receipt.loginSession === true, logout: receipt.logout === true, authFixtureRemoved: receipt.authFixtureRemoved,
    profileCleanupRequired: Boolean(fixtureId), applicationStopped: !receipt.applicationStopPending }));
}
