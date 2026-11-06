import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { randomBytes, createHash, X509Certificate } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createStagingProxy, readProxyConfig } from '../deploy/aws/staging-proxy.mjs';

const password = randomBytes(32).toString('base64url');
const username = 'staging';
const expected = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
const sessionSecret = randomBytes(32).toString('hex');
const sessionName = '__Host-fmt-staging';
const gatewayRequests = [], upstreamRequests = [], challenges = [], steps = [], controlErrors = [];
let stage = 'initial';
let clock = Date.now();
const app = http.createServer((req, res) => {
  upstreamRequests.push({ stage, method: req.method, path: req.url, authorizationPresent: Boolean(req.headers.authorization), gatewayCookiePresent: String(req.headers.cookie || '').includes(sessionName + '='), appCookiePresent: String(req.headers.cookie || '').includes('mock.app=ok') });
  req.resume();
  res.setHeader('Set-Cookie', 'mock.app=ok; Secure; HttpOnly; SameSite=Lax; Path=/');
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'mock.app=ok; Secure; HttpOnly; SameSite=Lax; Path=/' });
    res.end('<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Local mock app</h1></body></html>');
  } else if (req.url.startsWith('/denied')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Mock application authentication denied' }));
  } else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }
});
await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
const temporaryRoot = path.resolve(tmpdir());
const profile = await fs.mkdtemp(path.join(temporaryRoot, 'fmt-staging-session-'));
const keyFile = path.join(profile, 'loopback.key'), certFile = path.join(profile, 'loopback.crt');
await promisify(execFile)('C:/Program Files/Git/usr/bin/openssl.exe', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-subj', '/CN=localhost', '-days', '1', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide: true });
const certificate = await fs.readFile(certFile);
const pin = createHash('sha256').update(new X509Certificate(certificate).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
const secureProxy = https.createServer({ key: await fs.readFile(keyFile), cert: certificate });
await new Promise(resolve => secureProxy.listen(0, '127.0.0.1', resolve));
const origin = `https://127.0.0.1:${secureProxy.address().port}`;
const proxy = createStagingProxy(readProxyConfig({ STAGING_ORIGIN: origin, STAGING_USERNAME: username, STAGING_PASSWORD_SHA256: createHash('sha256').update(password).digest('hex'), STAGING_SESSION_SECRET: sessionSecret }), { appPort: app.address().port, now: () => clock });
secureProxy.on('request', (req, res) => {
  gatewayRequests.push({ stage, method: req.method, path: req.url, authorizationPresent: Boolean(req.headers.authorization), authorized: req.headers.authorization === expected, gatewayCookiePresent: String(req.headers.cookie || '').includes(sessionName + '=') });
  proxy.emit('request', req, res);
});
secureProxy.on('upgrade', (req, socket, head) => proxy.emit('upgrade', req, socket, head));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--ignore-certificate-errors-spki-list=${pin}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--disable-features=Translate,MediaRouter,OptimizationHints', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket, api;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('CHROME_START_TIMEOUT')), 20000);
    chrome.on('error', () => { clearTimeout(timer); reject(Error('CHROME_START_FAILED')); });
    chrome.stderr.on('data', data => { output += data; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  const browserAddress = new URL(endpoint);
  const targets = await (await fetch(`http://${browserAddress.host}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 0; const pending = new Map();
  api = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP_TIMEOUT')); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', event => {
    void (async () => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (item) { clearTimeout(item.timer); message.error ? item.reject(Error('CDP_FAILURE')) : item.resolve(message.result); } }
      if (message.method === 'Fetch.authRequired') {
        const { requestId, request, authChallenge } = message.params;
        challenges.push({ stage, method: request.method, path: new URL(request.url).pathname, scheme: authChallenge.scheme });
        const allowed = authChallenge.origin === origin && authChallenge.scheme.toLowerCase() === 'basic';
        await api('Fetch.continueWithAuth', { requestId, authChallengeResponse: allowed ? { response: 'ProvideCredentials', username, password } : { response: 'CancelAuth' } });
      }
      if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const url = new URL(request.url);
        if (url.origin === origin || request.url === 'about:blank' || request.url.startsWith('data:')) await api('Fetch.continueRequest', { requestId });
        else { controlErrors.push('NONLOCAL_REQUEST_BLOCKED'); await api('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); }
      }
    })().catch(() => controlErrors.push('CONTROL_FAILURE'));
  });
  await api('Page.enable'); await api('Runtime.enable');
  await api('Fetch.enable', { handleAuthRequests: true, patterns: [{ urlPattern: '*' }] });
  const evaluate = async (fn, value) => {
    const response = await api('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(value)})`, awaitPromise: true, returnByValue: true });
    assert.ok(!response.exceptionDetails, 'EVALUATION_FAILED'); return response.result.value;
  };
  await api('Page.navigate', { url: origin + '/denied-first' });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && !await evaluate(() => document.body?.innerText.includes('Mock application authentication denied'))) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(await evaluate(() => document.body?.innerText.includes('Mock application authentication denied')), 'INITIAL_APP_401_NOT_RENDERED');
  assert.equal(challenges.length, 1, 'INITIAL_CHALLENGE_COUNT');
  const originalCookie = (await api('Network.getCookies', { urls: [origin] })).cookies.find(cookie => cookie.name === sessionName);
  assert.ok(originalCookie, 'SESSION_COOKIE_MISSING_ON_INITIAL_APP_401');
  assert.ok(originalCookie.secure && originalCookie.httpOnly, 'SESSION_COOKIE_SECURITY_FLAGS');
  assert.equal(originalCookie.path, '/');
  assert.equal(originalCookie.sameSite, 'Lax');
  assert.ok(!originalCookie.domain.startsWith('.'), 'SESSION_COOKIE_DOMAIN_SCOPE');
  assert.ok(Math.abs(originalCookie.expires - (Math.floor(clock / 1000) + 3600)) <= 5, 'SESSION_COOKIE_LIFETIME');
  assert.equal(await evaluate(name => document.cookie.includes(name + '='), sessionName), false, 'SESSION_COOKIE_SCRIPT_VISIBLE');
  assert.ok((await api('Network.getCookies', { urls: [origin] })).cookies.some(cookie => cookie.name === 'mock.app'), 'APPLICATION_SET_COOKIE_LOST');
  async function step(label, method, url) {
    stage = label; const challengeCount = challenges.length, requestCount = gatewayRequests.length;
    const result = await evaluate(async ({ method, url }) => {
      const response = await fetch(url, { method, credentials: 'include', ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mock: true }) } : {}) });
      await response.text();
      return { status: response.status, wwwAuthenticatePresent: response.headers.has('www-authenticate') };
    }, { method, url });
    steps.push({ label, method, ...result, newChallenges: challenges.length - challengeCount, gatewayRequests: gatewayRequests.slice(requestCount) });
  }
  await step('baseline-get200', 'GET', '/ok-get');
  await step('baseline-post200', 'POST', '/ok-post');
  await step('get401', 'GET', '/denied-get');
  await step('get-after-get401', 'GET', '/ok-after-get-denial');
  await step('post401-first', 'POST', '/denied-post');
  await step('get-after-post401', 'GET', '/ok-after-post-denial');
  await step('post401-second', 'POST', '/denied-post');
  await step('post401-third', 'POST', '/denied-post');
  await step('final-get200', 'GET', '/ok-final');
  assert.equal(challenges.length, 1, 'REPEATED_APP_401_PROMPTED');
  assert.ok(steps.every(item => item.newChallenges === 0), 'VALID_COOKIE_CHALLENGED');
  clock += 15 * 60 * 1000;
  await step('fifteen-minute-get200', 'GET', '/ok-later');
  assert.equal((await api('Network.getCookies', { urls: [origin] })).cookies.find(cookie => cookie.name === sessionName).expires, originalCookie.expires, 'SESSION_LIFETIME_SLID');
  clock += 46 * 60 * 1000;
  await step('expired-cookie-get200', 'GET', '/ok-expired');
  assert.equal(challenges.length, 2, 'EXPIRED_COOKIE_DID_NOT_CHALLENGE');
  assert.equal(steps.at(-1).newChallenges, 1);
  assert.deepEqual(controlErrors, []);
  assert.ok(upstreamRequests.every(item => !item.authorizationPresent), 'GATEWAY_AUTH_FORWARDED');
  assert.ok(upstreamRequests.every(item => !item.gatewayCookiePresent), 'GATEWAY_COOKIE_FORWARDED');
  assert.ok(upstreamRequests.slice(1).every(item => item.appCookiePresent), 'APPLICATION_COOKIE_LOST');
  assert.ok(steps.filter(item => item.status === 401).every(item => !item.wwwAuthenticatePresent), 'MOCK_CHALLENGE_UNEXPECTED');
  const evidence = { date: '2026-11-06', browser: await api('Browser.getVersion'), localOnly: true, tls: 'Local generated certificate pinned only in isolated Chrome', cookie: { name: originalCookie.name, secure: originalCookie.secure, httpOnly: originalCookie.httpOnly, path: originalCookie.path, sameSite: originalCookie.sameSite, lifetimeSeconds: 3600, absoluteExpiryVerified: true }, appResponse401HasChallenge: false, credentialsMode: 'include', challenges, steps, gatewayRequests, upstreamRequests, controlErrors, limits: 'Isolated HTTPS loopback with actual staging proxy and generated dummy Basic/session credentials; expiry uses injected proxy clock. Not a live AWS or real application login test. No private handoff or application credentials read.' };
  await fs.writeFile('outputs/aws-staging-build/staging-session-browser-evidence.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ passed: true, browser: evidence.browser.product, validCookiePromptCount: 1, expiredCookieAdditionalPromptCount: 1, steps: steps.length, cookieFlags: { secure: true, httpOnly: true, sameSite: 'Lax', path: '/' }, upstreamCredentialsAbsent: true, appCookiePreserved: true, localOnly: true }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await api('Browser.close'); } catch {} socket.close(); }
  if (chrome.exitCode === null) chrome.kill();
  await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else { chrome.once('exit', resolve); setTimeout(resolve, 3000); } });
  secureProxy.closeAllConnections(); app.closeAllConnections();
  await new Promise(resolve => secureProxy.close(resolve)); await new Promise(resolve => app.close(resolve));
  const resolved = path.resolve(profile), relative = path.relative(temporaryRoot, resolved);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(resolved).startsWith('fmt-staging-session-'));
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
