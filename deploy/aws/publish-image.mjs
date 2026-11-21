import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

export const project = '674200807170';
export const region = 'eu-north-1';
export const service = 'fitsmytime-staging-20261109';
export const requireValue = (ok, code) => { if (!ok) throw Error(code); };
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function command(program, args, { cwd, input, visible = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', visible ? 'inherit' : 'pipe', visible ? 'inherit' : 'pipe'] });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; if (output.length > 16 * 1024 * 1024) child.kill(); });
    child.stderr?.resume();
    child.on('error', () => reject(Error('COMMAND_UNAVAILABLE')));
    child.stdin.on('error', () => {});
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(Error('COMMAND_FAILED')));
    child.stdin.end(input);
  });
}

export function verifySnapshot(snapshot) {
  const context = path.join(snapshot, 'context');
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'));
  return verifyContext({ context, manifest });
}

export function verifyContext({ context, manifest }) {
  requireValue(!fs.lstatSync(context).isSymbolicLink() && fs.lstatSync(context).isDirectory(), 'SOURCE_CONTEXT_LINK_REFUSED');
  requireValue(/^[a-f0-9]{64}$/.test(manifest.sha256) && sha256(JSON.stringify(manifest.files)) === manifest.sha256, 'MANIFEST_HASH_CHANGED');
  const found = [];
  function visit(directory) {
    for (const name of fs.readdirSync(directory)) {
      const target = path.join(directory, name);
      const item = fs.lstatSync(target);
      requireValue(!item.isSymbolicLink(), 'SOURCE_LINK_REFUSED');
      if (item.isDirectory()) visit(target);
      else { requireValue(item.isFile(), 'SOURCE_TYPE_REFUSED'); found.push(path.relative(context, target).split(path.sep).join('/')); }
    }
  }
  visit(context);
  requireValue(found.length === manifest.files.length && new Set(manifest.files.map(item => item.path)).size === found.length, 'SOURCE_FILE_SET_CHANGED');
  for (const item of manifest.files) {
    requireValue(found.includes(item.path) && !item.path.split('/').some(value => value === '..' || value.startsWith('.env')), 'SOURCE_PATH_REJECTED');
    const bytes = fs.readFileSync(path.join(context, item.path));
    requireValue(bytes.length === item.bytes && sha256(bytes) === item.sha256, 'SOURCE_BYTES_CHANGED');
  }
  return manifest;
}

export async function buildImage({ context, label, docker = 'docker' }) {
  requireValue(!process.env.DOCKER_HOST, 'REMOTE_DOCKER_REFUSED');
  const host = await command(docker, ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  requireValue(host.startsWith('npipe:////./pipe/') || host === 'unix:///var/run/docker.sock' || /^unix:\/\/\//.test(host), 'LOCAL_DOCKER_REQUIRED');
  const info = JSON.parse(await command(docker, ['info', '--format', '{{json .}}']));
  requireValue(info.OSType === 'linux', 'LINUX_ENGINE_REQUIRED');
  const image = `fitsmytime-release:${label}`;
  await command(docker, ['build', '--platform', 'linux/amd64', '--target', 'build', '-t', `${image}-check`, '.'], { cwd: context, visible: true });
  await command(docker, ['run', '--rm', '--network', 'none', `${image}-check`, 'npm', 'run', 'check'], { visible: true });
  await command(docker, ['build', '--platform', 'linux/amd64', '--target', 'runtime', '-t', image, '.'], { cwd: context, visible: true });
  await command(docker, ['run', '--rm', '--network', 'none', '--mount', `type=bind,source=${path.join(context, 'deploy/aws/test-staging-proxy.mjs')},target=/app/test-staging-proxy.mjs,readonly`, image, 'node', 'test-staging-proxy.mjs'], { visible: true });
  const artifacts = 'const fs=require("node:fs");for(const f of ["dist/index.js","dist/audit-worker.js","dist/notification-worker.js","dist/activity-worker.js","dist/public/index.html","certs/supabase-ca.crt"])if(!fs.existsSync(f))process.exit(1);console.log("Production artifacts present")';
  await command(docker, ['run', '--rm', '--network', 'none', image, 'node', '-e', artifacts], { visible: true });
  return { image, imageId: await command(docker, ['image', 'inspect', image, '--format', '{{.Id}}']), isolatedChecksPassed: true };
}

export function registryAuthHeader({ username, password, registryHost }) {
  requireValue([username, password, registryHost].every(value => typeof value === 'string' && value.length > 0), 'REGISTRY_CREDENTIALS_MISSING');
  // Docker's reference encoder uses padded RFC4648 URL encoding. Node's
  // base64url output strips padding, which can make Docker reject this header.
  return Buffer.from(JSON.stringify({ username, password, serveraddress: registryHost })).toString('base64').replaceAll('+', '-').replaceAll('/', '_');
}

function registryReason(status, message = '') {
  if (/x-registry-auth|base64/i.test(message)) return 'AUTH_HEADER_REJECTED';
  if (status === 401 || /unauthorized|authentication required|no basic auth credentials/i.test(message)) return 'AUTHENTICATION_REJECTED';
  if (status === 403 || /denied|forbidden|not authorized/i.test(message)) return 'PERMISSION_DENIED';
  if (/no such image|not found|does not exist/i.test(message)) return 'IMAGE_OR_REPOSITORY_NOT_FOUND';
  return 'UNCLASSIFIED';
}

export function pushRegistryImage({ socketPath, endpoint, auth, request: makeRequest = http.request }) {
  return new Promise((resolve, reject) => {
    const request = makeRequest({ socketPath, method: 'POST', path: endpoint, headers: { 'X-Registry-Auth': auth } }, response => {
      let pending = ''; let digest; let failed = false; let reason = registryReason(response.statusCode);
      function consume(line) {
        if (!line.trim()) return;
        try {
          const item = JSON.parse(line);
          if (item.error || item.errorDetail || response.statusCode >= 300 && item.message) {
            failed = true;
            reason = registryReason(response.statusCode, String(item.errorDetail?.message || item.error || item.message || ''));
          }
          digest = item.aux?.Digest || item.status?.match(/digest: (sha256:[a-f0-9]{64})/)?.[1] || digest;
        } catch { failed = true; reason = 'INVALID_RESPONSE'; }
      }
      response.setEncoding('utf8');
      response.on('data', chunk => { pending += chunk; const lines = pending.split('\n'); pending = lines.pop(); lines.forEach(consume); });
      response.on('error', () => reject(Error('REGISTRY_RESPONSE_FAILED')));
      response.on('end', () => {
        consume(pending);
        if (response.statusCode >= 300 || failed || !/^sha256:[a-f0-9]{64}$/.test(digest || '')) {
          const error = Error('REGISTRY_PUSH_FAILED');
          error.registryReason = reason === 'UNCLASSIFIED' && !failed && response.statusCode < 300 ? 'DIGEST_MISSING' : reason;
          error.registryHttpStatus = response.statusCode;
          reject(error);
        } else resolve(digest);
      });
    });
    request.setTimeout(30 * 60 * 1000, () => request.destroy());
    request.on('error', () => reject(Error('REGISTRY_CONNECTION_FAILED')));
    request.end();
  });
}

export async function uploadImage({ image, imageId, label, login, docker = 'docker' }) {
  requireValue(await command(docker, ['image', 'inspect', image, '--format', '{{.Id}}']) === imageId, 'LOCAL_IMAGE_CHANGED');
  const registry = new URL(login.registry.startsWith('https://') ? login.registry : `https://${login.registry}`);
  requireValue(registry.protocol === 'https:' && registry.hostname.endsWith('.amazonaws.com') && !registry.username && !registry.password && registry.pathname === '/', 'REGISTRY_TARGET_REJECTED');
  const host = await command(docker, ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  requireValue(!process.env.DOCKER_HOST && (host.startsWith('npipe:////./pipe/') || host.startsWith('unix:///')), 'LOCAL_DOCKER_REQUIRED');
  const socketPath = host.startsWith('npipe:') ? host.replace('npipe:////./pipe/', '\\\\.\\pipe\\') : host.slice('unix://'.length);
  const repository = `${registry.host}/sr`;
  await command(docker, ['tag', image, `${repository}:${label}`]);
  const auth = registryAuthHeader({ username: login.username, password: login.password, registryHost: registry.host });
  return pushRegistryImage({ socketPath, endpoint: `/images/${encodeURIComponent(repository)}/push?tag=${label}`, auth });
}
