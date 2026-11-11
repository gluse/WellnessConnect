import assert from 'node:assert/strict';
import { GATEWAY_PORTS, verifyExposure, commandFailure } from './manage.mjs';

const gateway = () => ({ Name: '/fitsmytime-local-ingress',
  NetworkSettings: { Networks: { 'fitsmytime-local': {}, 'fitsmytime-local-ingress': {} },
    Ports: Object.fromEntries(Object.entries(GATEWAY_PORTS).map(([key, port]) => [key, [{ HostIp: '127.0.0.1', HostPort: port }]])) },
  HostConfig: { ReadonlyRootfs: true, CapDrop: ['ALL'] } });
verifyExposure([gateway()]);
const missing = gateway(); missing.NetworkSettings.Ports['54322/tcp'] = [];
assert.throws(() => verifyExposure([missing]), /LOCAL_GATEWAY_PORT_UNAVAILABLE/);
verifyExposure([missing], { requirePublished: false }); // Stopping a broken gateway must remain possible.
const publicBind = gateway(); publicBind.NetworkSettings.Ports['54321/tcp'][0].HostIp = '0.0.0.0';
assert.throws(() => verifyExposure([publicBind]), /LOCAL_GATEWAY_PORT_UNAVAILABLE/);
const oldPort = gateway(); oldPort.NetworkSettings.Ports['54322/tcp'][0].HostPort = '54322';
assert.throws(() => verifyExposure([oldPort]), /LOCAL_GATEWAY_PORT_UNAVAILABLE/);
const privileged = gateway(); privileged.HostConfig.CapDrop = [];
assert.throws(() => verifyExposure([privileged]), /LOCAL_INGRESS_PRIVILEGES_REJECTED/);
const secret = 'private-sentinel-DO-NOT-LOG';
const bindError = commandFailure('docker', ['start', 'fitsmytime-local-ingress'], { status: 1,
  stderr: `ports are not available: forbidden by its access permissions ${secret}` });
assert.match(bindError, /Windows refused/); assert(!bindError.includes(secret));
const arbitrary = commandFailure('docker', ['inspect', 'x'], { status: 1, stderr: secret });
assert.match(arbitrary, /Docker inspect/); assert(!arbitrary.includes(secret));
assert.match(commandFailure('docker', ['ps'], { status: 1, stderr: 'cannot connect to Docker' }), /Linux engine is unavailable/);
console.log('Local lifecycle port, isolation and diagnostic checks passed (offline).');
