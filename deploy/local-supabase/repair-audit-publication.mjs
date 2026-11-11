// TASK-064 DB-owner delegation: replace only the stopped audit container; retain PGDATA.
import fs from 'node:fs';
import { safeDocker, privateArtifact, POSTGRES_IMAGE, verifyPrivateDirectoryAgain } from '../../scripts/local-supabase-copy.mjs';

const name = 'fitsmytime-local-audit', volumeName = 'fitsmytime-local-audit-data';
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
try {
  requireThat(process.argv[2] === '--execute-local-port-repair=TASK-064' && process.argv.length === 3, 'EXPLICIT_LOCAL_REPAIR_REQUIRED');
  const [before] = JSON.parse(safeDocker(['inspect', name]).toString());
  const [image] = JSON.parse(safeDocker(['image', 'inspect', POSTGRES_IMAGE]).toString());
  const [volume] = JSON.parse(safeDocker(['volume', 'inspect', volumeName]).toString());
  const bootstrap = JSON.parse(fs.readFileSync(privateArtifact('local-bootstrap.json'), 'utf8'));
  const env = Object.fromEntries(before.Config.Env.map(line => { const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1)]; }));
  requireThat(before.Name === '/' + name && !before.State.Running && before.Image === image.Id, 'AUDIT_REPAIR_TARGET_OR_IMAGE_REJECTED');
  requireThat(before.Mounts.length === 1 && before.Mounts[0].Type === 'volume' && before.Mounts[0].Name === volumeName &&
    before.Mounts[0].Destination === '/var/lib/postgresql/data' && volume.Name === volumeName, 'AUDIT_REPAIR_VOLUME_REJECTED');
  requireThat(JSON.stringify(Object.keys(before.NetworkSettings.Networks)) === JSON.stringify(['fitsmytime-local']), 'AUDIT_REPAIR_NETWORK_REJECTED');
  requireThat(env.POSTGRES_PASSWORD === bootstrap.auditAdminPassword && env.POSTGRES_DB === 'postgres' &&
    before.HostConfig.RestartPolicy.Name === 'unless-stopped', 'AUDIT_REPAIR_SETTINGS_REJECTED');
  fs.writeFileSync(privateArtifact('audit-before-no-publish-20261110.json'), JSON.stringify({
    name, image: POSTGRES_IMAGE, env: { POSTGRES_PASSWORD: env.POSTGRES_PASSWORD, POSTGRES_DB: env.POSTGRES_DB },
    volume: { name: volume.Name, createdAt: volume.CreatedAt, mountpoint: volume.Mountpoint },
    oldPortBindings: before.HostConfig.PortBindings, healthcheck: before.Config.Healthcheck,
    restart: before.HostConfig.RestartPolicy, labels: before.Config.Labels,
  }), { flag: 'wx' });
  safeDocker(['rm', name]); // Never -v: the exact named database volume is retained.
  safeDocker(['run', '-d', '--name', name, '--label', 'com.fitsmytime.local-copy=TASK-064', '--restart', 'unless-stopped',
    '--network', 'fitsmytime-local', '--mount', `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
    '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_DB=postgres', '--health-cmd', 'pg_isready -U postgres -d postgres',
    '--health-interval', '5s', '--health-timeout', '3s', '--health-retries', '15', POSTGRES_IMAGE],
    { env: { ...process.env, POSTGRES_PASSWORD: bootstrap.auditAdminPassword } });
  let after;
  for (let attempt = 0; attempt < 60; attempt++) {
    [after] = JSON.parse(safeDocker(['inspect', name]).toString());
    if (after.State.Running && after.State.Health?.Status === 'healthy') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const [retainedVolume] = JSON.parse(safeDocker(['volume', 'inspect', volumeName]).toString());
  requireThat(after.State.Running && after.State.Health?.Status === 'healthy' && after.Mounts.length === 1 &&
    after.Mounts[0].Name === volumeName && retainedVolume.CreatedAt === volume.CreatedAt &&
    retainedVolume.Mountpoint === volume.Mountpoint && Object.keys(after.HostConfig.PortBindings || {}).length === 0 &&
    JSON.stringify(Object.keys(after.NetworkSettings.Networks)) === JSON.stringify(['fitsmytime-local']), 'AUDIT_REPAIR_ACCEPTANCE_FAILED');
  verifyPrivateDirectoryAgain();
  const result = { status: 'passed', container: name, sameNamedVolume: true, publishedPorts: 0,
    healthy: true, hostedAccess: false, sqlChanges: false, volumeDeleted: false, verifiedAt: new Date().toISOString() };
  fs.writeFileSync('output/supabase-local-copy-2026-11-09/audit-no-publish-repair-20261110.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
} catch (error) {
  // No Docker inspection/env values or raw subprocess output enter diagnostics.
  console.error(JSON.stringify({ status: 'stopped', code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_AUDIT_REPAIR_FAILED', hostedAccess: false }));
  process.exitCode = 1;
}
