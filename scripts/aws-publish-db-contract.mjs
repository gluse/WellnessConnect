// Pure DB-owner release contract. Importing this module never reads files or opens sockets.
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1024;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireThat(ok, code) { if (!ok) throw Error(code); }
const boundKeys = Object.freeze(['releaseId', 'project', 'region', 'service', 'sourceManifestSha256',
  'baselineFingerprint', 'runtimeDatabaseSha256', 'auditSettingsSha256']);
export const DATABASE_RELEASE_ROLES = Object.freeze([
  Object.freeze({ kind: 'app', target: 'source', principal: 'fmt_app_dev', connectionLimit: 5 }),
  Object.freeze({ kind: 'capture', target: 'source', principal: 'fmt_audit_capture_dev', connectionLimit: 2 }),
  Object.freeze({ kind: 'worker', target: 'source', principal: 'fmt_audit_worker_dev', connectionLimit: 2 }),
  Object.freeze({ kind: 'writer', target: 'destination', principal: 'fmt_audit_writer_dev', connectionLimit: 2 }),
  Object.freeze({ kind: 'reader', target: 'destination', principal: 'fmt_audit_reader_dev', connectionLimit: 2 }),
]);

function validateContext(context) {
  requireThat(object(context) && identifier(context.releaseId), 'DB_RELEASE_CONTEXT_REQUIRED');
  requireThat(context.project === '674200807170' && context.region === 'eu-north-1'
    && context.service === 'fitsmytime-staging-20261109', 'DB_RELEASE_TARGET_REJECTED');
  requireThat(['sourceManifestSha256', 'baselineFingerprint', 'runtimeDatabaseSha256', 'auditSettingsSha256']
    .every(key => hash(context[key])), 'DB_RELEASE_FINGERPRINT_REQUIRED');
}

function validateBinding(value, context) {
  requireThat(object(value) && value.version === 1 && boundKeys.every(key => value[key] === context[key]), 'DB_RELEASE_BINDING_CHANGED');
}

function timestamp(value) {
  // Require an explicit UTC instant; local dates are not suitable release evidence.
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)), 'DB_RELEASE_TIMESTAMP_REJECTED');
  return Date.parse(value);
}

export function validateDatabaseApproval({ approval, context, now = Date.now() }) {
  validateContext(context);
  validateBinding(approval, context);
  requireThat(Number.isFinite(now) && timestamp(approval.expiresAt) > now, 'DB_RELEASE_APPROVAL_EXPIRED');
  requireThat(text(approval.databaseOwner) && text(approval.backendOwner) && text(approval.approvalReference), 'DB_RELEASE_OWNER_ACCEPTANCE_REQUIRED');
  requireThat(approval.compatibilityAccepted === true && approval.transition === 'maintenance'
    && approval.recovery === 'stop-and-inspect', 'DB_RELEASE_COMPATIBILITY_REQUIRED');
  const schema = approval.schema;
  requireThat(object(schema) && schema.profile === 'customer-service-notifications-current42'
    && schema.tableCount === 42 && schema.applicationChecks === 44 && schema.verifiedApplied === true
    && schema.sourceProject === 'hbkooiknruimukkhshrk' && schema.destinationProject === 'ynygqodmtgjrngiudalw',
  'DB_RELEASE_CURRENT_SCHEMA_REQUIRED');
  return { accepted: true, releaseId: context.releaseId, transition: 'maintenance', recovery: 'stop-and-inspect' };
}

export function validateDatabaseReceipt({ approval, receipt, context, now = Date.now() }) {
  validateDatabaseApproval({ approval, context, now });
  validateBinding(receipt, context);
  requireThat(identifier(receipt.receiptId) && receipt.executor === approval.databaseOwner
    && receipt.approvalReference === approval.approvalReference, 'DB_RELEASE_RECEIPT_OWNER_CHANGED');
  requireThat(Number.isSafeInteger(context.quiescentVersion) && context.quiescentVersion > 0
    && hash(context.quiescentFingerprint) && receipt.quiescentVersion === context.quiescentVersion
    && receipt.quiescentFingerprint === context.quiescentFingerprint
    && receipt.quiescentVerifiedAt === context.quiescentVerifiedAt, 'DB_RELEASE_QUIESCENCE_CHANGED');
  requireThat(receipt.allPreviousDeploymentsInactive === true && receipt.noPendingDeployment === true
    && receipt.maintenanceCommandsVerified === true, 'DB_RELEASE_MAINTENANCE_REQUIRED');
  const quiescedAt = timestamp(context.quiescentVerifiedAt);
  const startedAt = timestamp(receipt.startedAt);
  const completedAt = timestamp(receipt.completedAt);
  requireThat(startedAt - quiescedAt >= 30_000 && completedAt >= startedAt && now >= completedAt
    && now - quiescedAt <= 15 * 60_000, 'DB_RELEASE_FRESH_DRAIN_REQUIRED');
  requireThat(receipt.state === 'passed' && receipt.passed === true && receipt.allConnectionsClosed === true
    && receipt.writes === false && receipt.claims === false && receipt.retry === false, 'DB_RELEASE_PREFLIGHT_FAILED');
  requireThat(Array.isArray(receipt.roles) && receipt.roles.length === DATABASE_RELEASE_ROLES.length
    && DATABASE_RELEASE_ROLES.every(expected => receipt.roles.some(role => object(role)
      && Object.entries(expected).every(([key, value]) => role[key] === value)
      && role.otherConnections === 0 && role.passed === true && role.tlsVerified === true && role.readOnly === true)),
  'DB_RELEASE_FIVE_ROLE_CAPACITY_REQUIRED');
  // Caller must atomically consume receiptId in its immutable attempt record before startup.
  return { accepted: true, releaseId: context.releaseId, receiptId: receipt.receiptId, singleUse: true };
}
