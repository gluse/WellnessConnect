// Offline runner orchestration only. No configuration, sockets or database engine.
import assert from 'node:assert/strict';
import { APPROVED_SOURCE, SOURCE_METADATA_SQL, admission, cleanMetadata, failureCode, preflight } from './preflight-approved.mjs';
import { WISHLIST_APPLICATION_READINESS_SQL, WISHLIST_APPLICATION_READINESS_KEYS } from '../wishlist/application-readiness.mjs';
const baseline = Object.fromEntries(WISHLIST_APPLICATION_READINESS_KEYS.map(key => [key, true]));
const metadata = { expected_principal: true, expected_database: true, expected_version: true, read_only: true,
  expected_table_security: true, currency_columns_absent: true, prior_monetary_types: true, archive_command_configured: true,
  backup_function_present: true, public_table_count: 40, service_count: 7, booking_count: 12,
  invalid_service_amounts: 0, invalid_booking_amounts: 0, other_application_or_owner_connections: 0, archive_mode: 'on' };
assert.deepEqual(cleanMetadata([metadata]), metadata);
assert.throws(() => cleanMetadata([{ ...metadata, service_count: '7' }]));
for (const args of [[], ['--preflight-approved-source=other'], ['--preflight-approved-source=' + APPROVED_SOURCE, '--retry']]) assert.throws(() => admission(args));
assert.equal(failureCode(new Error('private://credential@target')), 'TASK039_UNCLASSIFIED_FAILURE');
let queries = [], emitted = [], saved = [], prepares = 0;
const overrides = {
  async pin() {}, async create(value) { saved.push(structuredClone(value)); }, async save(value) { saved.push(structuredClone(value)); },
  async prepare() { prepares++; return { appValue: 'app', ownerValue: 'owner', appCA: {}, ownerCA: {} }; },
  async client(value) { return { async query(text) {
    queries.push(text);
    if (text === WISHLIST_APPLICATION_READINESS_SQL) return { rows: [baseline] };
    if (text === SOURCE_METADATA_SQL) return { rows: [metadata] };
    assert.ok(['BEGIN TRANSACTION READ ONLY', 'COMMIT'].includes(text), 'Only readonly transaction controls/metadata allowed'); return { rows: [] };
  }, async end() {} }; },
  async connect() {}, async recovery() { return { verifiedRecoverable: false, pgDumpOnPath: false, pgRestoreOnPath: false, backupDirectoryExists: false, priorTaskWaiverReusable: false }; },
  emit(value) { emitted.push(value); },
};
let result = await preflight(['--preflight-approved-source=' + APPROVED_SOURCE], overrides);
assert.equal(result.passed, false);
assert.equal(result.safeCode, 'TASK039_RECOVERABLE_BACKUP_NOT_VERIFIED');
assert.equal(result.receipt.script.attempted, false);
assert.equal(result.receipt.script.committed, false);
assert.equal(prepares, 1);
assert.equal(queries.length, 6);
assert.deepEqual(result.receipt.baselineVerification, baseline);
assert.equal(result.receipt.sourceMetadata.other_application_or_owner_connections, 0);
assert.equal(saved.at(-1).state, 'stopped');
assert.equal(emitted.at(-1).retry, false);
queries = []; prepares = 0;
result = await preflight(['--preflight-approved-source=' + APPROVED_SOURCE], { ...overrides, async connect() { throw Object.assign(new Error('private://credential@target'), { code: 'ECONNREFUSED' }); } });
assert.equal(result.safeCode, 'ECONNREFUSED');
assert.equal(prepares, 1); assert.equal(queries.length, 0, 'No retry or further query after first connection failure');
assert.ok(!JSON.stringify(result.receipt).includes('credential'));
assert.ok(!JSON.stringify(emitted).includes('credential'));
prepares = 0;
await preflight([], overrides); assert.equal(prepares, 0, 'Admission runs before private access');
console.log('PASS: source-only preflight admission, clean aggregates, readonly boundaries, backup stop, no migration/retry and redaction. Mocked adapters only.');
