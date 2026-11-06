import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { createStagingProxy, readProxyConfig } from './staging-proxy.mjs';

const password = randomBytes(32).toString('base64url');
const env = { STAGING_ORIGIN: 'https://staging.example.test', STAGING_USERNAME: 'tester', STAGING_PASSWORD_SHA256: createHash('sha256').update(password).digest('hex'), STAGING_SESSION_SECRET: randomBytes(32).toString('hex') };
assert.throws(() => readProxyConfig({ ...env, STAGING_ORIGIN: 'http://example.test' }));
assert.throws(() => readProxyConfig({ ...env, STAGING_PASSWORD_SHA256: '' }));
assert.throws(() => readProxyConfig({ ...env, STAGING_ORIGIN: 'https://user:pass@example.test' }));
assert.throws(() => readProxyConfig({ ...env, STAGING_SESSION_SECRET: '' }));
const calls = [];
let ready = true;
const app = http.createServer((req, res) => {
  calls.push({ url: req.url, headers: req.headers });
  if (req.url === '/health/ready') { res.writeHead(ready ? 200 : 503); res.end('private probe contents'); return; }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    res.writeHead(req.url === '/denied' ? 401 : 200, { 'Content-Type': 'application/json', 'Set-Cookie': ['session=test; Secure; HttpOnly', '__Host-fmt-staging=app-cannot-set-this; Secure; Path=/'], 'Cache-Control': 'public, max-age=3600', 'Referrer-Policy': 'no-referrer' });
    res.end(JSON.stringify({ body, url: req.url }));
  });
});
await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
let clock = 1000;
const proxy = createStagingProxy(readProxyConfig(env), { appPort: app.address().port, now: () => clock });
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${proxy.address().port}`;
const authorization = `Basic ${Buffer.from(`tester:${password}`).toString('base64')}`;
try {
  for (const path of ['/', '/api/auth/providers', '/locales/en/translation.json', '/health/live', '/health/ready?extra=1']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /^Basic /);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  }
  assert.equal(calls.length, 0, 'unauthenticated app/static/API requests never reach the app');
  assert.equal((await fetch(origin, { headers: { authorization: 'Basic dGVzdGVyOndyb25n' } })).status, 401);
  const probe = await fetch(origin + '/health/ready', { headers: { cookie: 'private-cookie', authorization } });
  assert.equal(probe.status, 200); assert.deepEqual(await probe.json(), { status: 'ready' });
  assert.equal(calls.at(-1).headers.cookie, undefined); assert.equal(calls.at(-1).headers.authorization, undefined);
  clock += 3000;
  const probeCount = calls.filter(call => call.url === '/health/ready').length;
  const concurrent = await Promise.all(Array.from({ length: 16 }, () => fetch(origin + '/health/ready')));
  assert.ok(concurrent.every(response => response.status === 200));
  assert.equal(calls.filter(call => call.url === '/health/ready').length, probeCount + 1, 'concurrent public probes share one DB request');
  assert.equal((await fetch(origin + '/health/ready')).status, 200);
  assert.equal(calls.filter(call => call.url === '/health/ready').length, probeCount + 1, 'brief sanitized cache bounds probe frequency');
  clock += 3000;
  ready = false; assert.equal((await fetch(origin + '/health/ready')).status, 503); ready = true;
  const result = await fetch(origin + '/api/example?test=1', { method: 'POST', body: 'payload', headers: {
    authorization, cookie: 'session=signed-test', origin: env.STAGING_ORIGIN, forwarded: 'for=attacker;proto=http',
    'x-forwarded-for': 'attacker', 'x-forwarded-proto': 'http', 'x-forwarded-host': 'attacker', 'x-real-ip': 'attacker',
  } });
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { body: 'payload', url: '/api/example?test=1' });
  assert.equal(result.headers.get('cache-control'), 'no-store'); assert.match(result.headers.get('set-cookie'), /Secure/);
  assert.equal(result.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const forwarded = calls.at(-1).headers;
  assert.equal(forwarded.authorization, undefined); assert.equal(forwarded.forwarded, undefined);
  assert.equal(forwarded['x-real-ip'], undefined); assert.equal(forwarded['x-forwarded-proto'], 'https');
  assert.equal(forwarded.host, 'staging.example.test'); assert.equal(forwarded['x-forwarded-host'], 'staging.example.test');
  assert.notEqual(forwarded['x-forwarded-for'], 'attacker'); assert.equal(forwarded.origin, env.STAGING_ORIGIN);
  assert.equal(forwarded.cookie, 'session=signed-test');
  const issued = result.headers.getSetCookie().find(value => value.startsWith('__Host-fmt-staging='));
  assert.ok(issued); assert.match(issued, /; Secure; HttpOnly; SameSite=Lax$/);
  assert.match(issued, /; Path=\/; Max-Age=3600;/); assert.ok(!issued.includes('Domain='));
  const cookie = issued.split(';', 1)[0];
  const token = cookie.slice(cookie.indexOf('=') + 1);
  assert.ok(!issued.includes(password) && !issued.includes(env.STAGING_SESSION_SECRET));
  const cookieResponse = await fetch(origin + '/cookie-only', { headers: { cookie: `${cookie}; session=app-session` } });
  assert.equal(cookieResponse.status, 200); assert.equal(calls.at(-1).headers.cookie, 'session=app-session');
  assert.equal(calls.at(-1).headers.authorization, undefined);
  assert.ok(!cookieResponse.headers.getSetCookie().some(value => value.startsWith('__Host-fmt-staging=')), 'cookie-only access neither refreshes nor accepts an app overwrite');
  const rejected = await fetch(origin + '/denied', { headers: { authorization } });
  assert.equal(rejected.status, 401); assert.equal(rejected.headers.get('www-authenticate'), null);
  assert.ok(rejected.headers.getSetCookie().some(value => value.startsWith('__Host-fmt-staging=')), 'valid staging password mints cookie even on app401');
  const countBeforeInvalid = calls.length;
  for (const invalid of [cookie.replace(/.$/, token.endsWith('A') ? 'B' : 'A'), `${cookie}; ${cookie}`, '__Host-fmt-staging=v1.999999999999.' + token.split('.').at(-1), '__Host-fmt-staging=invalid']) {
    assert.equal((await fetch(origin + '/private', { headers: { cookie: invalid } })).status, 401);
  }
  assert.equal(calls.length, countBeforeInvalid, 'invalid/tampered/duplicate/future cookies never reach app');
  for (const change of [{ STAGING_SESSION_SECRET: randomBytes(32).toString('hex') }, { STAGING_ORIGIN: 'https://another.example.test' }, { STAGING_PASSWORD_SHA256: randomBytes(32).toString('hex') }, { STAGING_USERNAME: 'other' }]) {
    const otherProxy = createStagingProxy(readProxyConfig({ ...env, ...change }), { appPort: app.address().port, now: () => clock });
    await new Promise(resolve => otherProxy.listen(0, '127.0.0.1', resolve));
    try { assert.equal((await fetch(`http://127.0.0.1:${otherProxy.address().port}/`, { headers: { cookie } })).status, 401); }
    finally { otherProxy.closeAllConnections(); await new Promise(resolve => otherProxy.close(resolve)); }
  }
  clock += 3599_000;
  assert.equal((await fetch(origin + '/still-valid', { headers: { cookie } })).status, 200);
  clock += 1000;
  assert.equal((await fetch(origin + '/expired', { headers: { cookie } })).status, 401);
  assert.equal((await fetch(origin + '/renew', { headers: { cookie, authorization } })).status, 200);
  await new Promise(resolve => app.close(resolve));
  assert.equal((await fetch(origin, { headers: { authorization } })).status, 502);
  clock += 3000;
  assert.equal((await fetch(origin + '/health/ready')).status, 503);
  console.log('Staging proxy checks pass: access restriction, health isolation, forwarding, signed one-hour gateway cookies, app401 preservation, tampering/expiry, body streaming and fail-closed errors.');
} finally {
  proxy.closeAllConnections(); app.closeAllConnections();
  await Promise.all([new Promise(resolve => proxy.close(resolve)), new Promise(resolve => app.close(resolve))]);
}
