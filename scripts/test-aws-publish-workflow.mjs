import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseOptions, validateAuthorization, executeRelease } from '../deploy/aws/publish-workflow.mjs';
import { sha256, verifySnapshot } from '../deploy/aws/publish-image.mjs';
import { DATABASE_RELEASE_ROLES } from './aws-publish-db-contract.mjs';

const root = process.cwd();
const artifacts = path.join(root, 'outputs/aws-staging-build');
fs.mkdirSync(artifacts, { recursive: true });
let scenarios = 0;
function removeFixture(directory, parent, prefix) {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(parent));
  assert.ok(path.basename(directory).startsWith(prefix));
  fs.rmSync(directory, { recursive: true });
}
assert.equal(parseOptions([]).action, 'plan'); scenarios++;
for (const args of [['--deploy'], ['--publish'], ['--inspect'], ['--plan', '--prepare'], ['--unknown'], ['--python=a', '--python=b']]) {
  assert.throws(() => parseOptions(args)); scenarios++;
}
assert.equal(parseOptions(['--deploy', '--snapshot=a', '--release=b']).action, 'deploy'); scenarios++;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-publish-test-'));
const contextDirectory = path.join(temp, 'context');
fs.mkdirSync(contextDirectory);
fs.writeFileSync(path.join(contextDirectory, 'public.txt'), 'reviewed');
const files = [{ path: 'public.txt', bytes: 8, sha256: sha256('reviewed') }];
fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify({ files, sha256: sha256(JSON.stringify(files)) }));
assert.equal(verifySnapshot(temp).files.length, 1); scenarios++;
fs.writeFileSync(path.join(contextDirectory, 'public.txt'), 'tampered');
assert.throws(() => verifySnapshot(temp), /SOURCE_BYTES_CHANGED/); scenarios++;
fs.writeFileSync(path.join(contextDirectory, 'public.txt'), 'reviewed');
fs.writeFileSync(path.join(contextDirectory, '.env'), 'not a credential');
assert.throws(() => verifySnapshot(temp), /SOURCE_FILE_SET_CHANGED/); scenarios++;
fs.unlinkSync(path.join(contextDirectory, '.env'));
fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify({ files, sha256: 'f'.repeat(64) }));
assert.throws(() => verifySnapshot(temp), /MANIFEST_HASH_CHANGED/); scenarios++;
removeFixture(temp, os.tmpdir(), 'fmt-publish-test-');

const hookScript = 'scripts/aws-publish-capacity.mjs';
const privateSentinel = 'OFFLINE_PRIVATE_PAYLOAD_ONLY';
const now = Date.parse('2026-11-11T12:00:00.000Z');
const base = { project: '674200807170', region: 'eu-north-1', service: 'fitsmytime-staging-20261109', sourceManifestSha256: 'a'.repeat(64), baselineFingerprint: 'b'.repeat(64), runtimeDatabaseSha256: 'c'.repeat(64), auditSettingsSha256: 'd'.repeat(64), origin: 'https://fixture.eu-north-1.cs.amazonlightsail.com' };
function authorization(context) {
  return { version: 1, releaseId: context.releaseId, project: base.project, region: base.region, service: base.service, sourceManifestSha256: base.sourceManifestSha256,
    approver: 'offline-fixture-user', approvalReference: 'fixture-only-no-grant', expiresAt: new Date(now + 3600000).toISOString(), operations: ['upload', 'maintenance', 'capacity', 'deploy', 'verify'], recovery: 'stop-and-inspect',
    databaseApproval: { version: 1, ...context, databaseOwner: '/root/db-fixture', backendOwner: '/root/backend-fixture', approvalReference: 'fixture-only-no-grant', expiresAt: new Date(now + 3600000).toISOString(), compatibilityAccepted: true, transition: 'maintenance', recovery: 'stop-and-inspect', schema: { profile: 'customer-service-notifications-current42', tableCount: 42, applicationChecks: 44, verifiedApplied: true, sourceProject: 'hbkooiknruimukkhshrk', destinationProject: 'ynygqodmtgjrngiudalw' } },
    capacityHook: { executor: '/root/db-fixture', approvalReference: 'fixture-only-no-grant', executable: 'node', script: hookScript, sha256: sha256(fs.readFileSync(hookScript)) } };
}
const firstContext = { ...base, releaseId: randomUUID() };
const first = authorization(firstContext);
assert.equal(validateAuthorization({ authorization: first, context: firstContext, now }).script, hookScript); scenarios++;
for (const mutate of [value => { value.service = 'other'; }, value => { value.expiresAt = 'expired'; }, value => { value.operations.pop(); }, value => { value.capacityHook.executor = 'other'; }, value => { value.capacityHook.script = '../unsafe.mjs'; }, value => { value.capacityHook.script = 'scripts/aws-publish-db-contract.mjs'; }, value => { value.databaseApproval.schema.verifiedApplied = false; }]) {
  const changed = structuredClone(first); mutate(changed);
  assert.throws(() => validateAuthorization({ authorization: changed, context: firstContext, now })); scenarios++;
}

async function scenario({ failHook = false, tamperReceipt = false, failDeploy = false, failVerify = false, failMaintenance = false, failQuiescence = false, failExpiry = false, failPrivateInput = false, expireDuringFetch = false } = {}) {
  const context = { ...base, releaseId: randomUUID() };
  const approval = authorization(context);
  const snapshot = fs.mkdtempSync(path.join(artifacts, 'source-publish-fixture-'));
  const calls = [];
  const quiescent = { active: true, state: 'ACTIVE', quiescentVersion: 2, quiescentFingerprint: 'e'.repeat(64), quiescentVerifiedAt: new Date(now).toISOString(), allPreviousDeploymentsInactive: !failQuiescence, noPendingDeployment: true, maintenanceCommandsVerified: true };
  const session = { call: async (operation, input) => {
    calls.push(operation);
    if (operation === 'maintenance') { if (failMaintenance) throw Error('FIXTURE_MAINTENANCE_FAILED'); return { version: 2 }; }
    if (operation === 'status') return input.version === 2 ? quiescent : { active: true, state: 'ACTIVE' };
    if (operation === 'capacity-input') {
      if (failPrivateInput) throw Error('FIXTURE_PRIVATE_INPUT_FAILED');
      assert.equal(input.quiescentVersion, 2);
      assert.equal(input.quiescentFingerprint, quiescent.quiescentFingerprint);
      if (expireDuringFetch) approval.expiresAt = new Date(now).toISOString();
      return { connectionUrls: Object.fromEntries(['app', 'capture', 'worker', 'writer', 'reader'].map(key => [key, privateSentinel + key])), auditSettings: { AUDIT_EXPORT_USER_IDS: '', AUDIT_PRODUCER_CONTRACT: 'completion-0008', AUDIT_READER_DATABASE_URL: privateSentinel + 'reader', AUDIT_READER_USER_IDS: '' } };
    }
    if (operation === 'deploy') { if (failDeploy) throw Error('FIXTURE_DEPLOY_FAILED'); return { version: 3 }; }
    throw Error('UNEXPECTED_CONNECTED_OPERATION');
  } };
  let time = now;
  let receiptKey;
  const runHook = async (program, args, options) => {
    calls.push('hook');
    assert.equal(program, 'node');
    assert.ok(args.includes('--execute-authorized-capacity'));
    assert.ok(!JSON.stringify(args).includes(privateSentinel));
    const input = JSON.parse(options.input);
    assert.equal(input.connectionUrls.app, privateSentinel + 'app');
    assert.equal(input.auditSettings.AUDIT_READER_DATABASE_URL, privateSentinel + 'reader');
    assert.equal(input.context.maintenanceCommandsVerified, true);
    assert.deepEqual(input.approval, approval.databaseApproval);
    if (failHook) throw Error('FIXTURE_CAPACITY_FAILED');
    const capacity = JSON.parse(fs.readFileSync(args.find(value => value.startsWith('--context=')).slice(10), 'utf8'));
    const receiptId = randomUUID(); receiptKey = sha256(receiptId);
    const receipt = { version: 1, ...capacity, receiptId, executor: approval.databaseApproval.databaseOwner, approvalReference: approval.databaseApproval.approvalReference,
      allPreviousDeploymentsInactive: true, noPendingDeployment: true, maintenanceCommandsVerified: true, startedAt: new Date(time).toISOString(), completedAt: new Date(time).toISOString(), state: 'passed', passed: !tamperReceipt, allConnectionsClosed: true, writes: false, claims: false, retry: false,
      roles: DATABASE_RELEASE_ROLES.map(role => ({ ...role, otherConnections: 0, passed: true, tlsVerified: true, readOnly: true })) };
    fs.writeFileSync(args.find(value => value.startsWith('--receipt=')).slice(10), JSON.stringify(receipt));
  };
  const options = { authorization: approval, context, snapshot, session, publication: { image: ':fixture', digest: 'sha256:' + 'f'.repeat(64) }, runHook,
    now: () => time, sleep: async value => { time += failExpiry ? 7200000 : value; }, verify: async () => { calls.push('verify'); if (failVerify) throw Error('FIXTURE_HTTPS_FAILED'); return { passed: true }; } };
  try {
    if (failHook || tamperReceipt || failDeploy || failVerify || failMaintenance || failQuiescence || failExpiry || failPrivateInput || expireDuringFetch) await assert.rejects(() => executeRelease(options));
    else {
      assert.equal((await executeRelease(options)).deployed, true);
      assert.deepEqual(calls, ['maintenance', 'status', 'capacity-input', 'hook', 'deploy', 'status', 'verify']);
      const count = calls.length;
      await assert.rejects(() => executeRelease(options), /EEXIST/);
      assert.equal(calls.length, count, 'a consumed release must never repeat maintenance');
    }
    if (failMaintenance) assert.deepEqual(calls, ['maintenance']);
    if (failQuiescence || failExpiry) assert.deepEqual(calls, ['maintenance', 'status']);
    if (failPrivateInput || expireDuringFetch) assert.deepEqual(calls, ['maintenance', 'status', 'capacity-input']);
    if (failHook || tamperReceipt) assert.deepEqual(calls, ['maintenance', 'status', 'capacity-input', 'hook']);
    if (failDeploy) assert.deepEqual(calls, ['maintenance', 'status', 'capacity-input', 'hook', 'deploy']);
    if (failVerify) assert.deepEqual(calls, ['maintenance', 'status', 'capacity-input', 'hook', 'deploy', 'status', 'verify']);
    for (const filename of fs.readdirSync(snapshot)) assert.ok(!fs.readFileSync(path.join(snapshot, filename), 'utf8').includes(privateSentinel), 'private input must never enter release files');
    scenarios++;
  } finally {
    removeFixture(snapshot, artifacts, 'source-publish-fixture-');
    fs.unlinkSync(path.join(artifacts, `release-${context.releaseId}-attempt.json`));
    const consumed = receiptKey && path.join(artifacts, `capacity-${receiptKey}-consumed.json`);
    if (consumed && fs.existsSync(consumed)) fs.unlinkSync(consumed);
  }
}
await scenario();
await scenario({ failMaintenance: true });
await scenario({ failHook: true });
await scenario({ tamperReceipt: true });
await scenario({ failDeploy: true });
await scenario({ failVerify: true });
await scenario({ failQuiescence: true });
await scenario({ failExpiry: true });
await scenario({ failPrivateInput: true });
await scenario({ expireDuringFetch: true });

const template = JSON.parse(fs.readFileSync('deploy/aws/publish-builder.template.json', 'utf8'));
assert.equal(template.Resources.SourceBucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy, true);
assert.equal(template.Resources.BuildProject.Properties.ConcurrentBuildLimit, 1);
const policy = JSON.stringify(template.Resources.BuildRole);
for (const forbidden of ['CreateContainerServiceDeployment', 'GetContainerServices', 'secretsmanager:', 'rds:', 'DeleteContainerService']) assert.ok(!policy.includes(forbidden));
scenarios++;
console.log(JSON.stringify({ passed: true, scenarios, awsCalls: false, databaseCalls: false, localeMatrix: 'not applicable' }));
