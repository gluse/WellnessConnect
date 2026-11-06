import http from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
const sessionCookie = '__Host-fmt-staging';
const sessionSeconds = 3600;

export function readProxyConfig(env) {
  const origin = new URL(env.STAGING_ORIGIN || '');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      !/^[a-f0-9]{64}$/.test(env.STAGING_PASSWORD_SHA256 || '') || !/^[a-f0-9]{64}$/.test(env.STAGING_SESSION_SECRET || '') ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(env.STAGING_USERNAME || '')) {
    throw Error('Invalid staging proxy configuration');
  }
  return { origin: origin.origin, host: origin.host, username: env.STAGING_USERNAME,
    digest: Buffer.from(env.STAGING_PASSWORD_SHA256, 'hex'), sessionKey: Buffer.from(env.STAGING_SESSION_SECRET, 'hex') };
}

function sessionMac(body, config) {
  return createHmac('sha256', config.sessionKey)
    .update(`${config.origin}\n${config.username}\n${config.digest.toString('hex')}\n${body}`).digest();
}

function sessionAllowed(header, config, now) {
  if (typeof header !== 'string' || header.length > 8192) return false;
  const values = header.split(';').filter(part => part.slice(0, part.indexOf('=')).trim() === sessionCookie);
  if (values.length !== 1) return false;
  const value = values[0].slice(values[0].indexOf('=') + 1).trim();
  const match = /^(v1\.(\d{1,12}))\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return false;
  const issued = Number(match[2]), current = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issued) || issued > current || current - issued >= sessionSeconds) return false;
  const signature = Buffer.from(match[3], 'base64url');
  return signature.length === 32 && signature.toString('base64url') === match[3] && timingSafeEqual(signature, sessionMac(match[1], config));
}

function issueSession(config, now) {
  const issued = Math.floor(now / 1000), body = `v1.${issued}`;
  const token = `${body}.${sessionMac(body, config).toString('base64url')}`;
  return `${sessionCookie}=${token}; Path=/; Max-Age=${sessionSeconds}; Expires=${new Date((issued + sessionSeconds) * 1000).toUTCString()}; Secure; HttpOnly; SameSite=Lax`;
}

function appCookieHeader(header) {
  if (typeof header !== 'string') return undefined;
  return header.split(';').filter(part => part.slice(0, part.indexOf('=')).trim() !== sessionCookie).map(part => part.trim()).filter(Boolean).join('; ') || undefined;
}

function allowed(header, config) {
  if (typeof header !== 'string' || header.length > 2048 || !/^Basic [A-Za-z0-9+/]+=*$/.test(header)) return false;
  const credentials = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = credentials.indexOf(':');
  if (colon < 0 || credentials.slice(0, colon) !== config.username) return false;
  const password = credentials.slice(colon + 1);
  // Provisioning generates a random 256-bit password; this gate rejects short replacements.
  return password.length >= 32 && timingSafeEqual(createHash('sha256').update(password).digest(), config.digest);
}

export function createStagingProxy(config, { appPort = 5000, request = http.request, now = Date.now } = {}) {
  let readiness = { status: 503, expires: 0 };
  let inFlight;
  const checkReady = () => {
    if (readiness.expires > now()) return Promise.resolve(readiness.status);
    if (inFlight) return inFlight;
    inFlight = new Promise(resolve => {
      const finish = status => resolve(status);
      const probe = request({ hostname: '127.0.0.1', port: appPort, path: '/health/ready', method: 'GET', timeout: 4000 }, upstream => {
        upstream.resume();
        upstream.on('end', () => finish(upstream.statusCode === 200 ? 200 : 503));
        upstream.on('error', () => finish(503));
      });
      probe.on('timeout', () => probe.destroy());
      probe.on('error', () => finish(503));
      probe.end();
    }).then(status => { readiness = { status, expires: now() + 2000 }; return status; }).finally(() => { inFlight = undefined; });
    return inFlight;
  };
  const server = http.createServer({ maxHeaderSize: 16384 }, (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');

    // Only this exact read-only probe bypasses authentication. Never forward cookies.
    if (req.url === '/health/ready' && ['GET', 'HEAD'].includes(req.method)) {
      void checkReady().then(status => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: status === 200 ? 'ready' : 'unavailable' }));
      });
      return;
    }
    const hasSession = sessionAllowed(req.headers.cookie, config, now());
    const hasPassword = allowed(req.headers.authorization, config);
    if (!hasSession && !hasPassword) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FitsMyTime staging", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Staging access requires a username and password.');
      return;
    }
    // The staging session survives application401 responses that clear browser Basic auth.
    // It has a fixed lifetime and is renewed only by presenting the correct password.
    const newSession = !hasSession && hasPassword ? issueSession(config, now()) : undefined;
    // Forward origin-form URLs only; the target is fixed and can never be selected by a client.
    if (!req.url?.startsWith('/') || req.url.startsWith('//') || /[\r\n]/.test(req.url)) {
      res.writeHead(400); res.end('Invalid request'); return;
    }
    const headers = { ...req.headers };
    const appCookies = appCookieHeader(headers.cookie);
    if (appCookies) headers.cookie = appCookies;
    else delete headers.cookie;
    const connectionTokens = String(headers.connection || '').toLowerCase().split(',').map(value => value.trim());
    for (const name of Object.keys(headers)) {
      if (hopHeaders.includes(name) || connectionTokens.includes(name) || name === 'authorization' || name === 'forwarded' ||
          name === 'x-real-ip' || name.startsWith('x-forwarded-')) delete headers[name];
    }
    headers.host = config.host;
    headers['x-forwarded-host'] = config.host;
    headers['x-forwarded-proto'] = 'https';
    // A shared, conservative proxy address avoids trusting caller-supplied client identities.
    headers['x-forwarded-for'] = req.socket.remoteAddress || '127.0.0.1';
    const upstream = request({ hostname: '127.0.0.1', port: appPort, method: req.method, path: req.url, headers, timeout: 30000 }, incoming => {
      const responseHeaders = { ...incoming.headers };
      const responseConnection = String(responseHeaders.connection || '').toLowerCase().split(',').map(value => value.trim());
      for (const name of [...hopHeaders, ...responseConnection, 'server', 'x-powered-by', 'cache-control', 'x-robots-tag', 'strict-transport-security', 'referrer-policy']) delete responseHeaders[name];
      // The app cannot overwrite the gateway's reserved cookie. Preserve its own cookies.
      const cookies = (Array.isArray(responseHeaders['set-cookie']) ? responseHeaders['set-cookie'] : [])
        .filter(value => value.split('=', 1)[0].trim() !== sessionCookie);
      if (newSession) cookies.push(newSession);
      if (cookies.length) responseHeaders['set-cookie'] = cookies;
      else delete responseHeaders['set-cookie'];
      res.writeHead(incoming.statusCode || 502, responseHeaders);
      incoming.on('error', () => res.destroy());
      incoming.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end('Staging service unavailable'); } else res.destroy(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxConnections = 128;
  server.on('upgrade', (_req, socket) => socket.destroy());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = createStagingProxy(readProxyConfig(process.env));
    server.listen(8080, '0.0.0.0', () => console.log('Restricted staging proxy listening'));
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
  } catch { console.error('Staging proxy configuration refused'); process.exitCode = 1; }
}
