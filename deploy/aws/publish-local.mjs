// TASK-036: publish the reviewed local image. Never starts the app or loads dotenv.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = process.cwd();
const snapshot = path.resolve(root, process.argv[2] || '');
const artifacts = path.join(root, 'outputs/aws-staging-build');
const serviceName = 'fitsmytime-staging';
const docker = 'C:/Users/LuseG/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const helper = path.join(artifacts, 'aws-mcp-session.py');
let stage = 'validate';
const check = (ok, code) => { if (!ok) throw Error(code); };
async function command(program, args) {
  try { return (await run(program, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 })).stdout.trim(); }
  catch { throw Error('LOCAL_COMMAND_FAILED'); }
}
async function aws(code, name) {
  // Requests contain only code/public identifiers, never returned registry secrets.
  const file = path.join(artifacts, `publish-${name}-request.json`);
  fs.writeFileSync(file, JSON.stringify({ name: 'aws___run_script', arguments: { code } }));
  const outer = JSON.parse(await command('uvx.exe', ['--python', '3.13', '--from', 'mcp', 'python', helper, file]));
  let result = outer.structured_content;
  if (!result) result = JSON.parse(outer.content.filter(c => c.type === 'text').map(c => c.text).join('\n'));
  check(!outer.is_error && result.status === 'success', 'AWS_OPERATION_FAILED');
  return result.return_value;
}
function engine(socketPath, method, endpoint, headers = {}, progress = false) {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath, method, path: endpoint, headers }, response => {
      let pending = ''; let body = ''; let digest; let failed = false; let lastUpdate = 0;
      response.setEncoding('utf8');
      response.on('data', chunk => {
        if (!progress) { body += chunk; return; }
        pending += chunk;
        const lines = pending.split('\n'); pending = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            if (item.error || item.errorDetail) failed = true;
            if (item.aux?.Digest) digest = item.aux.Digest;
            const matched = item.status?.match(/digest: (sha256:[a-f0-9]{64})/);
            if (matched) digest = matched[1];
            if (Date.now() - lastUpdate > 20000) { console.log('Private registry upload in progress'); lastUpdate = Date.now(); }
          } catch { failed = true; }
        }
      });
      response.on('end', () => {
        if (response.statusCode >= 300 || failed) reject(Error('DOCKER_ENGINE_OPERATION_FAILED'));
        else resolve(progress ? digest : JSON.parse(body));
      });
      response.on('error', () => reject(Error('DOCKER_ENGINE_RESPONSE_FAILED')));
    });
    request.on('error', () => reject(Error('DOCKER_ENGINE_UNAVAILABLE')));
    request.end();
  });
}
try {
  check(snapshot.startsWith(artifacts + path.sep) && path.basename(snapshot).startsWith('source-'), 'SNAPSHOT_SCOPE');
  const build = JSON.parse(fs.readFileSync(path.join(snapshot, 'local-build-result.json')));
  check(build.IsolatedProxyAndArtifactsPassed && !build.ApplicationStarted && !build.Published, 'BUILD_NOT_READY');
  check(build.ImageTag === `fitsmytime-staging:pc-${build.SourceManifestSha256.slice(0, 16)}`, 'IMAGE_TAG_MISMATCH');
  check(!process.env.DOCKER_HOST, 'REMOTE_DOCKER_REFUSED');
  const endpoint = await command(docker, ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  check(endpoint.startsWith('npipe:////./pipe/'), 'LOCAL_DOCKER_REQUIRED');
  const socketPath = endpoint.replace('npipe:////./pipe/', '\\\\.\\pipe\\');
  const version = await engine(socketPath, 'GET', '/version');
  check(version.Os === 'linux', 'LINUX_ENGINE_REQUIRED');
  const image = JSON.parse(await command(docker, ['image', 'inspect', build.ImageTag]))[0];
  check(image.RepoDigests?.some(d => d.endsWith(build.ImageId)) || image.Id === build.ImageId ||
    (await command(docker, ['image', 'inspect', build.ImageTag, '--format', '{{.Id}}'])) === build.ImageId, 'IMAGE_ID_CHANGED');
  if (process.argv[3] === '--check') {
    console.log(JSON.stringify({ localImageVerified: true, linuxEngine: true, registryCredentialsPersisted: false, awsCalls: false }));
    process.exit(0);
  }
  stage = 'identity';
  const identity = await aws("r=await call_boto3(service_name='sts',operation_name='GetCallerIdentity',region_name='eu-north-1',params={})\n{'account':r['Account']}", 'identity');
  check(identity.account === '674200807170', 'WRONG_AWS_PROJECT');
  stage = 'registry-login';
  const login = await aws("r=await call_boto3(service_name='lightsail',operation_name='CreateContainerServiceRegistryLogin',region_name='eu-north-1',params={})\nr['registryLogin']", 'registry');
  const registry = new URL(login.registry.startsWith('https://') ? login.registry : `https://${login.registry}`);
  check(registry.protocol === 'https:' && registry.hostname.endsWith('.amazonaws.com') && !registry.username && !registry.password, 'REGISTRY_TARGET_REJECTED');
  const repository = `${registry.host}/sr`;
  const tag = `pc-${build.SourceManifestSha256.slice(0, 16)}`;
  const remote = `${repository}:${tag}`;
  await command(docker, ['tag', build.ImageTag, remote]);
  const auth = Buffer.from(JSON.stringify({ username: login.username, password: login.password, serveraddress: registry.host })).toString('base64url');
  stage = 'push';
  const digest = await engine(socketPath, 'POST', `/v${version.ApiVersion}/images/${encodeURIComponent(repository)}/push?tag=${encodeURIComponent(tag)}`, { 'X-Registry-Auth': auth }, true);
  check(/^sha256:[a-f0-9]{64}$/.test(digest || ''), 'PUSH_DIGEST_MISSING');
  stage = 'register';
  const registered = await aws(`r=await call_boto3(service_name='lightsail',operation_name='RegisterContainerImage',region_name='eu-north-1',params={'serviceName':'${serviceName}','label':'app','digest':'${digest}'})\nr['containerImage']`, 'register');
  check(registered.image?.startsWith(`:${serviceName}.app.`) && registered.digest === digest, 'REGISTERED_IMAGE_MISMATCH');
  const result = { serviceName, region: 'eu-north-1', sourceManifest: build.SourceManifestSha256, localImageId: build.ImageId, digest, image: registered.image, published: true, deployed: false };
  fs.writeFileSync(path.join(snapshot, 'published-image-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ stage, error: /^[A-Z_]+$/.test(error.message) ? error.message : 'PUBLICATION_FAILED', deployed: false }));
  process.exitCode = 1;
}
