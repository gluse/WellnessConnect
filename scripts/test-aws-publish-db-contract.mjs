import assert from 'node:assert/strict';
import { DATABASE_RELEASE_ROLES, validateDatabaseApproval, validateDatabaseReceipt } from './aws-publish-db-contract.mjs';

const now = Date.parse('2026-11-11T12:00:00.000Z');
const context = { releaseId: 'release-fixture-001', project: '674200807170', region: 'eu-north-1',
  service: 'fitsmytime-staging-20261109', sourceManifestSha256: 'a'.repeat(64), baselineFingerprint: 'b'.repeat(64),
  runtimeDatabaseSha256: 'c'.repeat(64), auditSettingsSha256: 'd'.repeat(64), quiescentVersion: 2,
  quiescentFingerprint: 'e'.repeat(64), quiescentVerifiedAt: '2026-11-11T11:58:00.000Z' };
const bound = Object.fromEntries(Object.entries(context).filter(([key]) => !key.startsWith('quiescent')));
const approval = { version: 1, ...bound, databaseOwner: '/root/db-fixture', backendOwner: '/root/backend-fixture',
  approvalReference: 'docs/fixture#owner-acceptance', expiresAt: '2026-11-11T13:00:00.000Z', compatibilityAccepted: true,
  transition: 'maintenance', recovery: 'stop-and-inspect', schema: { profile: 'customer-service-notifications-current42',
    tableCount: 42, applicationChecks: 44, verifiedApplied: true, sourceProject: 'hbkooiknruimukkhshrk', destinationProject: 'ynygqodmtgjrngiudalw' } };
const receipt = { version: 1, ...bound, receiptId: 'receipt-fixture-001', executor: approval.databaseOwner,
  approvalReference: approval.approvalReference, quiescentVersion: context.quiescentVersion,
  quiescentFingerprint: context.quiescentFingerprint, quiescentVerifiedAt: context.quiescentVerifiedAt,
  allPreviousDeploymentsInactive: true, noPendingDeployment: true, maintenanceCommandsVerified: true,
  startedAt: '2026-11-11T11:58:30.000Z', completedAt: '2026-11-11T11:59:00.000Z', state: 'passed', passed: true,
  allConnectionsClosed: true, writes: false, claims: false, retry: false,
  roles: DATABASE_RELEASE_ROLES.map(role => ({ ...role, otherConnections: 0, passed: true, tlsVerified: true, readOnly: true })) };
let scenarios = 0;
function checkApproval(change, code) {
  const changed = structuredClone(approval); change(changed);
  assert.throws(() => validateDatabaseApproval({ approval: changed, context, now }), { message: code }); scenarios++;
}
function checkReceipt(change, code) {
  const changed = structuredClone(receipt); change(changed);
  assert.throws(() => validateDatabaseReceipt({ approval, receipt: changed, context, now }), { message: code }); scenarios++;
}
assert.equal(validateDatabaseApproval({ approval, context, now }).accepted, true); scenarios++;
assert.deepEqual(validateDatabaseReceipt({ approval, receipt, context, now }),
  { accepted: true, releaseId: context.releaseId, receiptId: receipt.receiptId, singleUse: true }); scenarios++;
for (const key of Object.keys(bound)) {
  checkApproval(value => { value[key] = 'changed'; }, 'DB_RELEASE_BINDING_CHANGED');
  checkReceipt(value => { value[key] = 'changed'; }, 'DB_RELEASE_BINDING_CHANGED');
}
for (const key of ['databaseOwner', 'backendOwner', 'approvalReference']) checkApproval(value => { value[key] = ''; }, 'DB_RELEASE_OWNER_ACCEPTANCE_REQUIRED');
checkApproval(value => { value.expiresAt = new Date(now).toISOString(); }, 'DB_RELEASE_APPROVAL_EXPIRED');
for (const key of ['compatibilityAccepted', 'transition', 'recovery']) checkApproval(value => { value[key] = false; }, 'DB_RELEASE_COMPATIBILITY_REQUIRED');
checkApproval(value => { value.recovery = 'remain-maintenance'; }, 'DB_RELEASE_COMPATIBILITY_REQUIRED');
for (const key of Object.keys(approval.schema)) checkApproval(value => { value.schema[key] = null; }, 'DB_RELEASE_CURRENT_SCHEMA_REQUIRED');
checkReceipt(value => { value.executor = '/root/other'; }, 'DB_RELEASE_RECEIPT_OWNER_CHANGED');
checkReceipt(value => { value.receiptId = '../old-receipt'; }, 'DB_RELEASE_RECEIPT_OWNER_CHANGED');
checkReceipt(value => { value.approvalReference = 'other'; }, 'DB_RELEASE_RECEIPT_OWNER_CHANGED');
for (const key of ['quiescentVersion', 'quiescentFingerprint', 'quiescentVerifiedAt']) checkReceipt(value => { value[key] = null; }, 'DB_RELEASE_QUIESCENCE_CHANGED');
for (const key of ['allPreviousDeploymentsInactive', 'noPendingDeployment', 'maintenanceCommandsVerified']) checkReceipt(value => { value[key] = false; }, 'DB_RELEASE_MAINTENANCE_REQUIRED');
checkReceipt(value => { value.startedAt = '2026-11-11T11:58:29.999Z'; }, 'DB_RELEASE_FRESH_DRAIN_REQUIRED');
checkReceipt(value => { value.completedAt = '2026-11-11T11:58:00.000Z'; }, 'DB_RELEASE_FRESH_DRAIN_REQUIRED');
checkReceipt(value => { value.completedAt = '2026-11-11T12:00:00.001Z'; }, 'DB_RELEASE_FRESH_DRAIN_REQUIRED');
checkReceipt(value => { value.completedAt = '2026-11-11'; }, 'DB_RELEASE_TIMESTAMP_REJECTED');
assert.throws(() => validateDatabaseReceipt({ approval, receipt, context, now: now + 14 * 60_000 }), { message: 'DB_RELEASE_FRESH_DRAIN_REQUIRED' }); scenarios++;
for (const key of ['state', 'passed', 'allConnectionsClosed', 'writes', 'claims', 'retry']) checkReceipt(value => { value[key] = null; }, 'DB_RELEASE_PREFLIGHT_FAILED');
for (let index = 0; index < DATABASE_RELEASE_ROLES.length; index++) {
  for (const key of ['kind', 'target', 'principal', 'connectionLimit', 'otherConnections', 'passed', 'tlsVerified', 'readOnly']) {
    checkReceipt(value => { value.roles[index][key] = null; }, 'DB_RELEASE_FIVE_ROLE_CAPACITY_REQUIRED');
  }
}
checkReceipt(value => { value.roles[4] = { ...value.roles[0] }; }, 'DB_RELEASE_FIVE_ROLE_CAPACITY_REQUIRED');
checkReceipt(value => { value.roles.push({ ...value.roles[0] }); }, 'DB_RELEASE_FIVE_ROLE_CAPACITY_REQUIRED');
for (const target of [{ region: 'us-east-1' }, { service: 'fitsmytime-staging' }, { project: 'other' }]) {
  assert.throws(() => validateDatabaseApproval({ approval, context: { ...context, ...target }, now }), { message: 'DB_RELEASE_TARGET_REJECTED' }); scenarios++;
}
console.log(JSON.stringify({ passed: true, scenarios, connected: false, privateConfigurationRead: false, writes: false }));
