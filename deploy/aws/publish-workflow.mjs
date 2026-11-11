import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { validateDatabaseApproval, validateDatabaseReceipt } from '../../scripts/aws-publish-db-contract.mjs';
import { buildImage, command, project, region, requireValue, service, sha256, uploadImage, verifySnapshot } from './publish-image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'outputs/aws-staging-build');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const save = (filename, value, exclusive = false) => fs.writeFileSync(filename, JSON.stringify(value, null, 2), { flag: exclusive ? 'wx' : 'w' });

export function parseOptions(args) {
  const options = { action: 'plan' };
  const actions = ['plan', 'prepare', 'inspect', 'publish', 'deploy'];
  let actionSet = false;
  for (const argument of args) {
    const action = argument.slice(2);
    if (actions.includes(action) && argument.startsWith('--')) {
      requireValue(!actionSet, 'ONE_ACTION_REQUIRED'); options.action = action; actionSet = true;
    } else {
      const match = argument.match(/^--(snapshot|release|stack|python|docker)=(.+)$/);
      requireValue(match && !options[match[1]], 'UNKNOWN_OR_DUPLICATE_OPTION'); options[match[1]] = match[2];
    }
  }
  requireValue(!['inspect', 'publish', 'deploy'].includes(options.action) || options.snapshot, 'PREPARED_SNAPSHOT_REQUIRED');
  requireValue(options.action !== 'deploy' || options.release, 'RELEASE_AUTHORIZATION_REQUIRED');
  return options;
}

function confinedSnapshot(value) {
  const snapshot = path.resolve(root, value);
  requireValue(path.dirname(snapshot) === artifacts && path.basename(snapshot).startsWith('source-') && !fs.lstatSync(snapshot).isSymbolicLink(), 'SNAPSHOT_SCOPE');
  return snapshot;
}

class AwsSession {
  constructor(python) {
    requireValue(python, 'PYTHON_WITH_BOTO3_REQUIRED');
    this.child = spawn(python, [path.join(root, 'deploy/aws/publish-aws-session.py')], { cwd: root, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    this.pending = null;
    this.child.stderr.resume();
    this.child.stdin.on('error', () => this.fail('AWS_SESSION_PIPE_FAILED'));
    this.child.on('error', () => this.fail('AWS_SESSION_UNAVAILABLE'));
    this.child.on('exit', () => { this.closed = true; this.fail('AWS_SESSION_STOPPED'); });
    createInterface({ input: this.child.stdout }).on('line', line => {
      const pending = this.pending; this.pending = null;
      if (!pending) return;
      clearTimeout(pending.timeout);
      try { const value = JSON.parse(line); requireValue(value.ok, /^[A-Za-z0-9_]+$/.test(value.error || '') ? value.error : 'AWS_OPERATION_FAILED'); pending.resolve(value.result); }
      catch (error) { pending.reject(error); }
    });
  }
  fail(code) { if (this.pending) { clearTimeout(this.pending.timeout); this.pending.reject(Error(code)); this.pending = null; } }
  call(operation, args = {}) {
    requireValue(!this.pending && !this.closed, 'AWS_SESSION_NOT_READY');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.fail('AWS_SESSION_TIMEOUT'); this.child.kill(); }, 180000);
      this.pending = { resolve, reject, timeout };
      this.child.stdin.write(JSON.stringify({ operation, ...args }) + '\n');
    });
  }
  close() { this.child.stdin.end(); }
}

export function validateAuthorization({ authorization, context, now = Date.now() }) {
  requireValue(authorization?.version === 1 && typeof authorization.approver === 'string' && authorization.approver.trim() && typeof authorization.approvalReference === 'string' && authorization.approvalReference.trim(), 'RECORDED_RELEASE_APPROVAL_REQUIRED');
  requireValue(authorization.releaseId === context.releaseId && authorization.sourceManifestSha256 === context.sourceManifestSha256 && authorization.service === service && authorization.region === region && authorization.project === project, 'RELEASE_APPROVAL_TARGET_CHANGED');
  requireValue(authorization.operations?.join(',') === 'upload,maintenance,capacity,deploy,verify' && authorization.recovery === 'stop-and-inspect', 'RELEASE_OPERATION_SCOPE_CHANGED');
  requireValue(Number.isFinite(Date.parse(authorization.expiresAt)) && Date.parse(authorization.expiresAt) > now, 'RELEASE_APPROVAL_EXPIRED');
  validateDatabaseApproval({ approval: authorization.databaseApproval, context, now });
  const hook = authorization.capacityHook;
  requireValue(hook?.executor === authorization.databaseApproval.databaseOwner && typeof hook.approvalReference === 'string' && hook.approvalReference.trim(), 'OWNER_HOOK_AUTHORIZATION_REQUIRED');
  requireValue(hook.executable === 'node' && hook.script === 'scripts/aws-publish-capacity.mjs' && /^[a-f0-9]{64}$/.test(hook.sha256 || ''), 'OWNER_HOOK_REJECTED');
  return hook;
}

function checkHook(hook) {
  const target = path.resolve(root, hook.script);
  requireValue(!fs.lstatSync(target).isSymbolicLink() && sha256(fs.readFileSync(target)) === hook.sha256, 'OWNER_HOOK_CHANGED');
}

async function waitFor(session, version) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const status = await session.call('status', { version });
    requireValue(!['FAILED', 'INACTIVE'].includes(status.state), 'DEPLOYMENT_FAILED');
    if (status.active) return status;
    if (attempt % 3 === 0) console.log(`Waiting for deployment ${version}: ${status.state}`);
    await wait(10000);
  }
  throw Error('DEPLOYMENT_WAIT_TIMEOUT');
}

async function verifyHttps(origin) {
  const blocked = await fetch(origin + '/', { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  requireValue(blocked.status === 401 && blocked.headers.get('www-authenticate')?.startsWith('Basic '), 'GATEWAY_RESTRICTION_FAILED');
  await blocked.body?.cancel();
  const ready = await fetch(origin + '/health/ready', { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  requireValue(ready.status === 200 && JSON.stringify(await ready.json()) === '{"status":"ready"}' && !ready.headers.has('set-cookie'), 'READINESS_PRIVACY_FAILED');
  return { restrictedRoot: true, sanitizedReadiness: true };
}

export async function executeRelease({ authorization, context, snapshot, session, publication, runHook = command, now = () => Date.now(), sleep = wait, verify = verifyHttps }) {
  const hook = validateAuthorization({ authorization, context, now: now() });
  checkHook(hook);
  const attemptFile = path.join(artifacts, `release-${context.releaseId}-attempt.json`);
  // Immutable receipt across BOTH builders prevents replay even with another snapshot.
  save(attemptFile, { releaseId: context.releaseId, attemptedAt: new Date(now()).toISOString(), sourceManifestSha256: context.sourceManifestSha256, recovery: 'stop-and-inspect' }, true);
  const maintenance = await session.call('maintenance', { baselineFingerprint: context.baselineFingerprint });
  save(path.join(snapshot, 'maintenance-result.json'), maintenance, true);
  const quiescent = await waitFor(session, maintenance.version);
  requireValue(quiescent.allPreviousDeploymentsInactive === true && quiescent.noPendingDeployment === true && quiescent.maintenanceCommandsVerified === true, 'VERIFIED_MAINTENANCE_REQUIRED');
  const capacityContext = { ...context, quiescentVersion: quiescent.quiescentVersion, quiescentFingerprint: quiescent.quiescentFingerprint, quiescentVerifiedAt: quiescent.quiescentVerifiedAt,
    allPreviousDeploymentsInactive: true, noPendingDeployment: true, maintenanceCommandsVerified: true };
  const contextFile = path.join(snapshot, 'capacity-context.json');
  const receiptFile = path.join(snapshot, 'capacity-receipt.json');
  requireValue(!fs.existsSync(receiptFile), 'CAPACITY_RECEIPT_ALREADY_EXISTS');
  save(contextFile, capacityContext, true);
  console.log('Maintenance is active; waiting 30 seconds for old database consumers to drain.');
  await sleep(30000);
  checkHook(hook);
  validateAuthorization({ authorization, context, now: now() });
  const privateInput = await session.call('capacity-input', { quiescentVersion: capacityContext.quiescentVersion, quiescentFingerprint: capacityContext.quiescentFingerprint });
  validateAuthorization({ authorization, context, now: now() });
  checkHook(hook);
  // Approved exact recipient; private settings travel only through process pipes.
  await runHook(hook.executable, ['--import', 'tsx', hook.script, '--execute-authorized-capacity', `--context=${contextFile}`, `--receipt=${receiptFile}`], {
    cwd: root, input: JSON.stringify({ context: capacityContext, approval: authorization.databaseApproval, connectionUrls: privateInput.connectionUrls, auditSettings: privateInput.auditSettings }),
  });
  const receipt = readJson(receiptFile);
  validateDatabaseReceipt({ approval: authorization.databaseApproval, receipt, context: capacityContext, now: now() });
  const receiptKey = sha256(receipt.receiptId);
  save(path.join(artifacts, `capacity-${receiptKey}-consumed.json`), { releaseId: context.releaseId, receiptId: receipt.receiptId, consumedAt: new Date(now()).toISOString() }, true);
  validateAuthorization({ authorization, context, now: now() });
  const deployed = await session.call('deploy', publication);
  save(path.join(snapshot, 'candidate-result.json'), deployed, true);
  await waitFor(session, deployed.version);
  const http = await verify(context.origin);
  const result = { ...publication, version: deployed.version, origin: context.origin, sourceManifestSha256: context.sourceManifestSha256, active: true, http, browserAcceptancePending: true, deployed: true };
  save(path.join(snapshot, 'release-result.json'), result, true);
  return result;
}

export async function runPublish(mode, args = process.argv.slice(2)) {
  let session; let releaseStarted = false; let lockFile; let completed = false;
  try {
    const options = parseOptions(args);
    if (options.action === 'plan') {
      console.log(JSON.stringify({ mode, project, region, service, profile: 'fitsmytime', actions: ['--prepare', '--inspect --snapshot=PATH --python=PYTHON', '--publish --snapshot=PATH --python=PYTHON', '--deploy --snapshot=PATH --release=FILE --python=PYTHON'], cloudStackOption: mode === 'codebuild' ? '--stack=STACK' : undefined, awsCalls: false, databaseCalls: false, deployed: false }, null, 2));
      return;
    }
    fs.mkdirSync(artifacts, { recursive: true });
    let snapshot;
    if (options.action === 'prepare' && !options.snapshot) {
      const prepared = JSON.parse(await command(process.execPath, ['deploy/aws/prepare-source.mjs'], { cwd: root }));
      snapshot = confinedSnapshot(prepared.output);
    } else snapshot = confinedSnapshot(options.snapshot);
    const manifest = verifySnapshot(snapshot);
    const preparationFile = path.join(snapshot, 'publish-preparation.json');
    if (options.action === 'prepare') {
      requireValue(!fs.existsSync(preparationFile), 'SNAPSHOT_ALREADY_PREPARED');
      const releaseId = randomUUID();
      const label = `src${sha256(manifest.sha256 + releaseId).slice(0, 24)}`;
      const result = { version: 1, mode, releaseId, label, sourceManifestSha256: manifest.sha256, snapshot: path.relative(root, snapshot), awsCalls: false, databaseCalls: false, deployed: false };
      save(preparationFile, result, true); console.log(JSON.stringify(result, null, 2)); return;
    }
    const preparation = readJson(preparationFile);
    requireValue(preparation.mode === mode && preparation.sourceManifestSha256 === manifest.sha256 && /^[a-f0-9-]{36}$/.test(preparation.releaseId) && /^src[a-f0-9]{24}$/.test(preparation.label), 'PREPARATION_CHANGED');
    session = new AwsSession(options.python || process.env.FMT_PUBLISH_PYTHON);
    const baseline = await session.call('inspect');
    const context = { releaseId: preparation.releaseId, project, region, service, sourceManifestSha256: manifest.sha256, ...baseline };
    if (options.action === 'inspect') { save(path.join(snapshot, 'release-context.json'), context); console.log(JSON.stringify(context, null, 2)); return; }
    let authorization;
    if (options.action === 'deploy') {
      authorization = readJson(path.resolve(root, options.release));
      checkHook(validateAuthorization({ authorization, context }));
      requireValue(!fs.existsSync(path.join(artifacts, `release-${context.releaseId}-attempt.json`)), 'RELEASE_ALREADY_ATTEMPTED');
      const targetLock = path.join(artifacts, 'publish-service.lock');
      save(targetLock, { releaseId: context.releaseId, snapshot: preparation.snapshot, createdAt: new Date().toISOString() }, true);
      lockFile = targetLock;
    }
    const publicationFile = path.join(snapshot, 'image-publication.json');
    let publication;
    if (fs.existsSync(publicationFile)) {
      publication = readJson(publicationFile);
      requireValue(publication.sourceManifestSha256 === manifest.sha256 && publication.image.startsWith(`:${service}.${preparation.label}.`) && /^sha256:[a-f0-9]{64}$/.test(publication.digest), 'PUBLICATION_CHANGED');
    } else {
      save(path.join(snapshot, 'publication-attempt.json'), { mode, releaseId: context.releaseId, attemptedAt: new Date().toISOString() }, true);
      if (mode === 'local') {
        const build = await buildImage({ context: path.join(snapshot, 'context'), label: preparation.label, docker: options.docker });
        save(path.join(snapshot, 'image-build.json'), build, true);
        verifySnapshot(snapshot);
        if (authorization) validateAuthorization({ authorization, context });
        const login = await session.call('registry-login');
        console.log('Uploading the verified Linux image to Lightsail.');
        const digest = await uploadImage({ ...build, label: preparation.label, login, docker: options.docker });
        const image = await session.call('register', { label: preparation.label, digest });
        requireValue(image.digest === digest && image.image.startsWith(`:${service}.${preparation.label}.`), 'REGISTERED_IMAGE_CHANGED');
        publication = { image: image.image, digest };
      } else {
        requireValue(options.stack, 'CODEBUILD_STACK_REQUIRED');
        await session.call('cloud-config', { stack: options.stack });
        const build = await session.call('cloud-start', { snapshot, sourceManifestSha256: manifest.sha256, releaseId: preparation.releaseId, label: preparation.label });
        save(path.join(snapshot, 'cloud-build-result.json'), build, true);
        for (let attempt = 0; attempt < 180; attempt++) {
          const status = await session.call('cloud-status', { id: build.id });
          requireValue(!['FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'].includes(status.state), 'CODEBUILD_FAILED');
          if (status.state === 'SUCCEEDED') { publication = { image: status.image, digest: status.digest, buildId: build.id }; break; }
          if (attempt % 2 === 0) console.log(`CodeBuild ${build.id}: ${status.state}`);
          await wait(15000);
        }
        requireValue(publication, 'CODEBUILD_WAIT_TIMEOUT');
      }
      publication = { ...publication, sourceManifestSha256: manifest.sha256 };
      save(publicationFile, publication, true);
    }
    if (options.action === 'publish') { console.log(JSON.stringify({ ...publication, deployed: false }, null, 2)); return; }
    releaseStarted = true;
    const result = await executeRelease({ authorization, context, snapshot, session, publication });
    completed = true;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: /^[A-Za-z0-9_]+$/.test(error.message) ? error.message : 'PUBLISH_FAILED', retryPerformed: false, releaseStarted, recovery: releaseStarted ? 'Stop and inspect the exact deployment. Do not resume an old image or replay this release.' : 'Running service was not changed by the release phase.' }));
    process.exitCode = 1;
  } finally { session?.close(); if (completed && lockFile) fs.unlinkSync(lockFile); }
}
