// Local Docker lifecycle only; never links to or changes a hosted Supabase project.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(root, 'outputs/supabase-local-tools/supabase.exe');
const project = 'fitsmytime-local';
const network = 'fitsmytime-local';
const audit = 'fitsmytime-local-audit';
const ingress = 'fitsmytime-local-ingress';
const excluded = 'realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta';
export const GATEWAY_PORTS = Object.freeze({ '54321/tcp': '15421', '54322/tcp': '15422',
  '54324/tcp': '15424', '54332/tcp': '15432' });
function requireThat(ok, code) { if (!ok) throw new Error(code); }
export function commandFailure(program, args, result) {
  const detail = String(result.stderr || '');
  const operation = program === 'docker' ? `Docker ${args[0]} ${args[1] || ''}` : `Supabase ${args[0]}`;
  if (/ports are not available|forbidden by its access permissions|WSAEACCES/i.test(detail)) {
    return `${operation} failed: Windows refused a configured local port. Check TCP exclusions and port listeners; do not launch new containers from Images.`;
  }
  if (/cannot connect|is the docker daemon running|dockerDesktopLinuxEngine/i.test(detail)) {
    return `${operation} failed: Docker Desktop's Linux engine is unavailable. Start Docker Desktop and wait until it is ready.`;
  }
  return `${operation} failed (${result.error?.code || (result.status === null ? 'terminated' : `exit ${result.status}`)}). Raw output is hidden because it may contain local credentials.`;
}
function run(program, args) {
  const result = spawnSync(program, args, { cwd: root, shell: false, windowsHide: true,
    encoding: 'utf8', timeout: program === 'docker' ? 30000 : 180000,
    maxBuffer: 32 * 1024 * 1024, env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true' } });
  requireThat(!result.error && result.status === 0, commandFailure(program, args, result));
  return result.stdout;
}
function inspectNetwork() {
  const [item] = JSON.parse(run('docker', ['network', 'inspect', network]));
  requireThat(item.Name === network && item.Internal === true &&
    item.Options?.['com.docker.network.bridge.host_binding_ipv4'] === '127.0.0.1', 'LOCAL_NETWORK_ISOLATION_REJECTED');
  const [edge] = JSON.parse(run('docker', ['network', 'inspect', ingress]));
  requireThat(edge.Name === ingress && edge.Internal === false &&
    edge.Options?.['com.docker.network.bridge.host_binding_ipv4'] === '127.0.0.1', 'LOCAL_INGRESS_NETWORK_REJECTED');
}
function containers() {
  const names = run('docker', ['ps', '-a', '--format', '{{.Names}}']).trim().split(/\r?\n/)
    .filter(name => name === audit || name === ingress || /^supabase_[a-z0-9_-]+_fitsmytime-local$/.test(name));
  return names.length ? JSON.parse(run('docker', ['inspect', ...names])) : [];
}
export function verifyExposure(items, { requirePublished = true } = {}) {
  for (const item of items) {
    const networks = Object.keys(item.NetworkSettings?.Networks || {});
    if (item.Name === '/' + ingress) {
      requireThat(networks.length === 2 && networks.includes(network) && networks.includes(ingress), 'LOCAL_INGRESS_NETWORK_REJECTED');
      requireThat(item.HostConfig.ReadonlyRootfs && item.HostConfig.CapDrop?.includes('ALL'), 'LOCAL_INGRESS_PRIVILEGES_REJECTED');
      if (requirePublished) {
        for (const [containerPort, hostPort] of Object.entries(GATEWAY_PORTS)) {
          const bindings = item.NetworkSettings.Ports?.[containerPort];
          requireThat(bindings?.length === 1 && bindings[0].HostIp === '127.0.0.1' && bindings[0].HostPort === hostPort,
            `LOCAL_GATEWAY_PORT_UNAVAILABLE: expected 127.0.0.1:${hostPort}; inspect Windows port reservations and the configured gateway.`);
        }
      }
    } else requireThat(networks.length === 1 && networks[0] === network, 'LOCAL_CONTAINER_NETWORK_REJECTED');
    for (const bindings of Object.values(item.NetworkSettings?.Ports || {})) {
      for (const binding of bindings || []) requireThat(binding.HostIp === '127.0.0.1', 'LOCAL_PORT_EXPOSURE_REJECTED');
    }
  }
}
export function main() {
try {
  const [command, ...extra] = process.argv.slice(2);
  requireThat(extra.length === 0 && ['start', 'stop', 'status'].includes(command), 'Use start, stop or status.');
  requireThat(fs.existsSync(cli), 'CLI_MISSING: restore the verified Supabase v3.0.0 binary in outputs/supabase-local-tools.');
  inspectNetwork();
  const before = containers();
  verifyExposure(before.filter(item => item.State.Running), { requirePublished: command !== 'stop' });
  requireThat(before.some(item => item.Name === '/' + audit), 'LOCAL_COPY_NOT_PREPARED: audit container is missing.');
  if (command === 'start') {
    if (!before.some(item => item.Name === '/' + ingress && item.State.Running)) run('docker', ['start', ingress]);
    if (!before.some(item => item.Name === '/' + audit && item.State.Running)) run('docker', ['start', audit]);
    run(cli, ['start', '--workdir', 'deploy/local-supabase', '--network-id', network, '--exclude', excluded]);
  } else if (command === 'stop') {
    // No --no-backup or --all: retain this project's data and other projects.
    run(cli, ['stop', '--project-id', project, '--workdir', 'deploy/local-supabase']);
    run('docker', ['stop', audit]);
    run('docker', ['stop', ingress]);
  }
  const items = containers();
  verifyExposure(items.filter(item => item.State.Running));
  console.log(JSON.stringify({ operation: command, project, localOnly: true,
    persistentDataRetained: true, services: items.map(item => ({ name: item.Name.slice(1),
      running: item.State.Running, health: item.State.Health?.Status || null })) }));
} catch (error) {
  // Docker/CLI output can contain credentials. Never forward raw subprocess output.
  console.error(error.message);
  process.exitCode = 1;
}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
