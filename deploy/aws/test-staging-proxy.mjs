import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { createStagingProxy, readProxyConfig } from './staging-proxy.mjs';

const password = randomBytes(32).toString('base64url');
const env = { STAGING_ORIGIN: 'https://staging.example.test', STAGING_USERNAME: 'tester', STAGING_PASSWORD_SHA256: createHash('sha256').update(password).digest('hex') };
assert.throws(() => readProxyConfig({ ...env, STAGING_ORIGIN: 'http://example.test' }));
assert.throws(() => readProxyConfig({ ...env, STAGING_PASSWORD_SHA256: '' }));
assert.throws(() => readProxyConfig({ ...env, STAGING_ORIGIN: 'https://user:pass@example.test' }));
const calls = [];
let ready = true;
const app = http.createServer((req, res) => {
  calls.push({ url: req.url, headers: req.headers });
  if (req.url === '/health/ready') { res.writeHead(ready ? 200 : 503); res.end('private probe contents'); return; }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'session=test; Secure; HttpOnly', 'Cache-Control': 'public, max-age=3600' });
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
  const forwarded = calls.at(-1).headers;
  assert.equal(forwarded.authorization, undefined); assert.equal(forwarded.forwarded, undefined);
  assert.equal(forwarded['x-real-ip'], undefined); assert.equal(forwarded['x-forwarded-proto'], 'https');
  assert.equal(forwarded.host, 'staging.example.test'); assert.equal(forwarded['x-forwarded-host'], 'staging.example.test');
  assert.notEqual(forwarded['x-forwarded-for'], 'attacker'); assert.equal(forwarded.origin, env.STAGING_ORIGIN);
  assert.equal(forwarded.cookie, 'session=signed-test');
  await new Promise(resolve => app.close(resolve));
  assert.equal((await fetch(origin, { headers: { authorization } })).status, 502);
  clock += 3000;
  assert.equal((await fetch(origin + '/health/ready')).status, 503);
  console.log('Staging proxy checks pass: access restriction, health isolation, forwarding, cookies, body streaming and fail-closed errors.');
} finally {
  proxy.closeAllConnections(); app.closeAllConnections();
  await Promise.all([new Promise(resolve => proxy.close(resolve)), new Promise(resolve => app.close(resolve))]);
}
