// TASK-036 live frontend smoke. Requires Root's ACTIVE/gateway acceptance first.
// Only guest reads; mutations and external traffic are blocked before dispatch.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { parse } from 'dotenv';

assert.equal(process.argv[2], '--active-gateway-verified', 'Run only after Root verifies the active restricted deployment');
const root = process.cwd();
const access = parse(await fs.readFile(path.join(root, '.env.aws-staging-access.local')));
const origin = new URL(access.STAGING_ORIGIN).origin;
assert.match(origin, /^https:\/\/fitsmytime-staging\.[a-z0-9]+\.eu-north-1\.cs\.amazonlightsail\.com$/);
assert.equal(access.STAGING_USERNAME, 'staging');
assert.ok(access.STAGING_PASSWORD.length >= 43);
// Preserve the original gateway release's historical captures in live-frontend/.
const output = path.join(root, 'outputs/aws-staging-build/live-frontend-session');
await fs.mkdir(output, { recursive: true });
const resources = {};
for (const language of ['en', 'lv', 'ru']) resources[language] = JSON.parse(await fs.readFile(path.join(root, 'client/public/locales', language, 'translation.json')));
const temporaryRoot = path.resolve(tmpdir());
const profile = await fs.mkdtemp(path.join(temporaryRoot, 'fmt-aws-guest-'));
const executable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(existsSync(executable), 'Installed Chrome required');
const chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--disable-features=Translate,MediaRouter,OptimizationHints', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket; let api;
const errors = [], blocked = [], responses = [], matrix = [], checks = [], screenshots = [];
const authChallenges = [];
const allowedApi = new Set(['/api/auth/user', '/api/auth/providers', '/api/categories', '/api/billing/runtime']);
try {
  const endpoint = await new Promise((resolve, reject) => {
    let diagnostic = '';
    const timeout = setTimeout(() => reject(Error('CHROME_START_TIMEOUT')), 20000);
    chrome.on('error', () => { clearTimeout(timeout); reject(Error('CHROME_START_FAILED')); });
    chrome.stderr.on('data', data => {
      diagnostic += data;
      const match = diagnostic.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const address = new URL(endpoint);
  const targets = await (await fetch(`http://${address.host}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  api = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP_TIMEOUT_${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', event => {
    void (async () => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (item) { clearTimeout(item.timer); message.error ? item.reject(Error(`CDP_FAILED_${message.error.code}`)) : item.resolve(message.result); }
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push({ type: 'runtime-exception', text: message.params.exceptionDetails.text });
      if (message.method === 'Network.responseReceived') {
        const response = message.params.response, url = new URL(response.url);
        if (url.origin === origin) responses.push({ path: url.pathname, status: response.status });
      }
      if (message.method === 'Fetch.authRequired') {
        const { requestId, authChallenge, request } = message.params;
        authChallenges.push({ method: request.method, path: new URL(request.url).pathname });
        const allowed = authChallenge.origin === origin && authChallenge.scheme.toLowerCase() === 'basic';
        await api('Fetch.continueWithAuth', { requestId, authChallengeResponse: allowed ? { response: 'ProvideCredentials', username: access.STAGING_USERNAME, password: access.STAGING_PASSWORD } : { response: 'CancelAuth' } });
      }
      if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const url = new URL(request.url);
        const read = ['GET', 'HEAD'].includes(request.method);
        const approved = url.origin === origin && read && (!url.pathname.startsWith('/api/') || allowedApi.has(url.pathname));
        if (approved || request.url === 'about:blank') await api('Fetch.continueRequest', { requestId });
        else { blocked.push({ method: request.method, origin: url.origin, path: url.pathname }); await api('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); }
      }
    })().catch(() => { errors.push({ type: 'network-control-failure' }); });
  });
  await api('Page.enable'); await api('Runtime.enable'); await api('Network.enable');
  await api('Fetch.enable', { handleAuthRequests: true, patterns: [{ urlPattern: '*' }] });
  await api('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Riga' });
  await api('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const evaluate = async (fn, arg) => {
    const result = await api('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true, userGesture: true, timeout: 10000 });
    assert.ok(!result.exceptionDetails, 'Browser evaluation failed'); return result.result.value;
  };
  const until = async (fn, arg, label) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) { if (await evaluate(fn, arg)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw Error(label);
  };
  const viewport = async width => api('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await api('Page.navigate', { url: origin + '/login' });
  await until(() => !!document.querySelector('#auth-language') && !!document.querySelector('#email'), undefined, 'LOGIN_NOT_RENDERED');
  for (const language of ['en', 'lv', 'ru']) {
    await evaluate(language => {
      const element = document.getElementById('auth-language'); element.value = language; element.dispatchEvent(new Event('change', { bubbles: true }));
    }, language);
    await until(({ language, heading }) => document.documentElement.lang === language && document.querySelector('main h1')?.textContent === heading, { language, heading: resources[language].authForm.welcome }, 'LOCALE_NOT_RENDERED');
    assert.equal(await evaluate(() => document.documentElement.dir), 'ltr');
    assert.ok(!await evaluate(() => /authForm\./.test(document.body.innerText)));
    for (const width of [320, 390, 1280]) {
      await viewport(width);
      const info = await evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, emailLabel: !!document.querySelector('label[for="email"]')?.textContent, passwordLabel: !!document.querySelector('label[for="password"]')?.textContent, signIn: !!document.querySelector('button[type="submit"]')?.textContent, fieldWidths: ['email', 'password'].map(id => document.getElementById(id).getBoundingClientRect().width) }));
      assert.equal(info.overflow, false, `LOGIN_REFLOW_${language}_${width}`);
      assert.ok(info.emailLabel && info.passwordLabel && info.signIn && info.fieldWidths.every(w => w >= 160));
      matrix.push({ language, ...info });
      if (width === 390) {
        const screenshot = `login-${language}-phone.png`;
        const image = await api('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await fs.writeFile(path.join(output, screenshot), Buffer.from(image.data, 'base64')); screenshots.push(screenshot);
      }
    }
    const screenshot = `login-${language}-desktop.png`;
    const image = await api('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await fs.writeFile(path.join(output, screenshot), Buffer.from(image.data, 'base64')); screenshots.push(screenshot);
  }
  checks.push('Login rendered with translated heading, native language change, lang/dir, labels and no horizontal overflow in nine en/lv/ru viewport cases');
  await viewport(320);
  await evaluate(() => { document.getElementById('auth-language').focus(); });
  await api('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await api('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.ok(await evaluate(() => document.activeElement.matches('button,input,a,select')));
  const before = responses.length;
  const valid = await evaluate(() => document.querySelector('form').reportValidity());
  assert.equal(valid, false); assert.equal(await evaluate(() => document.activeElement.id), 'email');
  assert.ok(responses.slice(before).every(item => !item.path.startsWith('/api/auth/')));
  checks.push('Keyboard focus proceeds to an operable control; empty login fails native email validation without auth submission');
  await api('Page.navigate', { url: origin + '/' });
  await until(() => !!document.querySelector('[data-testid="button-browse-services"]') && !!document.querySelector('[data-testid="button-get-started"]'), undefined, 'LANDING_NOT_RENDERED');
  await until(() => !document.body.innerText.includes('Loading categories…'), undefined, 'CATEGORIES_NOT_SETTLED');
  assert.ok(!await evaluate(() => document.body.innerText.includes('Unable to load categories.')), 'CATEGORIES_ERROR');
  for (const width of [320, 390, 1280]) { await viewport(width); assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `LANDING_REFLOW_${width}`); }
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-browse-services"]').getAttribute('href')), '/search');
  checks.push('Guest landing and service/login entry controls rendered at 320/390/1280; search link remains local');
  assert.deepEqual(errors, []);
  assert.ok(blocked.every(item => item.method === 'GET' && item.origin !== origin), 'Unexpected same-origin request or mutation blocked');
  const finalStaticStatus = new Map(responses.filter(item => !item.path.startsWith('/api/')).map(item => [item.path, item.status]));
  assert.ok([...finalStaticStatus.values()].every(status => status < 400), 'Static document/resource failed');
  assert.ok(responses.some(item => item.path === '/api/auth/providers' && item.status === 200));
  assert.ok(responses.some(item => item.path === '/api/auth/user' && item.status === 401));
  assert.ok(responses.some(item => item.path === '/api/categories' && item.status === 200));
  assert.equal(authChallenges.length, 1, 'REPEATED_STAGING_AUTH_CHALLENGE');
  const stagingCookie = (await api('Network.getCookies', { urls: [origin] })).cookies.find(cookie => cookie.name === '__Host-fmt-staging');
  assert.ok(stagingCookie?.secure && stagingCookie.httpOnly && stagingCookie.sameSite === 'Lax' && stagingCookie.path === '/', 'STAGING_SESSION_COOKIE_INVALID');
  assert.equal(await evaluate(() => document.cookie.includes('__Host-fmt-staging=')), false, 'STAGING_SESSION_COOKIE_SCRIPT_VISIBLE');
  checks.push('Exactly one initial staging challenge; secure HttpOnly staging session survives guest application401 and later page/resource reads');
  const evidence = { date: '2026-11-06', origin, browser: await api('Browser.getVersion'), checks, matrix, screenshots, responses, blocked, errors, authChallenges, stagingCookie: { secure: stagingCookie.secure, httpOnly: stagingCookie.httpOnly, sameSite: stagingCookie.sameSite, path: stagingCookie.path }, languages: ['en', 'lv', 'ru'], deferredLanguages: ['ar', 'zh', 'fr', 'de', 'hi', 'ja', 'pt', 'es'], limits: 'Guest reads only; no auth submission, OAuth/email, signup, persisted user workflow, physical mobile device, Firefox/WebKit, screen reader or WCAG certification. Supabase redirect allowlist is separate.' };
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, localeViewportCases: matrix.length, runtimeErrors: errors.length, blockedRequests: blocked.length, stagingPromptCount: authChallenges.length, evidence: path.relative(root, path.join(output, 'evidence.json')) }));
} catch (error) {
  console.error(JSON.stringify({ passed: false, error: /^[A-Z_0-9]+$/.test(error.message) ? error.message : error.name, runtimeErrors: errors.length, blockedRequests: blocked.length }));
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await api('Browser.close'); } catch {} socket.close(); }
  if (chrome.exitCode === null) chrome.kill();
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 3000); } });
  const target = path.resolve(profile), relative = path.relative(temporaryRoot, target);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(target).startsWith('fmt-aws-guest-'));
  await fs.rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
