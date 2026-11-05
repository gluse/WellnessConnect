// Pure mocked orchestration. No private config, SQL engine, sockets or migrations.
import assert from 'node:assert/strict';
import { admission, activate, WAIVER, AMOUNT_FINGERPRINT_SQL, POSTFLIGHT_COUNTS_SQL } from './apply-approved.mjs';
import { APPROVED_SOURCE, SOURCE_METADATA_SQL } from './preflight-approved.mjs';
import { WISHLIST_APPLICATION_READINESS_SQL, WISHLIST_APPLICATION_READINESS_KEYS } from '../wishlist/application-readiness.mjs';
import { CURRENCY_READINESS_SQL } from './application-readiness.mjs';
const args = ['--apply-approved-source=' + APPROVED_SOURCE, '--backup-waived=' + WAIVER];
for (const input of [[], [args[0]], ['--apply-approved-source=wrong', args[1]], [args[0], '--backup-waived=TASK-042-2026-11-04']]) assert.throws(() => admission(input));
const baseline = Object.fromEntries(WISHLIST_APPLICATION_READINESS_KEYS.map(key => [key, true]));
const metadata = { expected_principal: true, expected_database: true, expected_version: true, read_only: true,
  expected_table_security: true, currency_columns_absent: true, prior_monetary_types: true, archive_command_configured: true,
  backup_function_present: true, public_table_count: 40, service_count: 27, booking_count: 32,
  invalid_service_amounts: 0, invalid_booking_amounts: 0, other_application_or_owner_connections: 0, archive_mode: 'on' };
let submissions = 0, prepares = 0, fingerprints = 0, output = [], saved = [], failMigration = false, wrongAmounts = false;
const overrides = { async script() { return 'PINNED_SCRIPT'; }, async prepare() { prepares++; return { appValue: 'app', ownerValue: 'owner', appCA: {}, ownerCA: {} }; },
  async create(value) { saved.push(structuredClone(value)); }, async save(value) { saved.push(structuredClone(value)); }, async connect() {},
  async client() { return { async query(text) {
    if (typeof text === 'object') { submissions++; assert.equal(text.text, 'PINNED_SCRIPT'); assert.equal(text.query_timeout, 125000);
      if (failMigration) throw Object.assign(new Error('private://credential@target'), { code: '57014' });
      return [{ command: 'UPDATE', rowCount: 27 }, { command: 'UPDATE', rowCount: 32 }, { command: 'SELECT', rows: [{ services_backfilled_eur: '27', bookings_backfilled_eur: '32' }] }, { command: 'COMMIT' }]; }
    if (text === WISHLIST_APPLICATION_READINESS_SQL) return { rows: [baseline] };
    if (text === SOURCE_METADATA_SQL) return { rows: [metadata] };
    if (text === AMOUNT_FINGERPRINT_SQL) { fingerprints++; return { rows: [{ services_signature: (wrongAmounts && fingerprints > 1 ? 'b' : 'a').repeat(32), bookings_signature: 'c'.repeat(32) }] }; }
    if (text === POSTFLIGHT_COUNTS_SQL) return { rows: [{ service_count: 27, booking_count: 32, services_all_eur: true, bookings_all_eur: true }] };
    if (text === CURRENCY_READINESS_SQL) return { rows: [{ currency_columns: true, currency_constraints: true }] };
    assert.ok(['BEGIN TRANSACTION READ ONLY','COMMIT'].includes(text)); return { rows: [] };
  }, async end() {} }; }, emit(value) { output.push(value); } };
let result = await activate(args, overrides);
assert.equal(result.passed, true); assert.equal(submissions, 1); assert.equal(prepares, 1);
assert.equal(result.receipt.script.committed, true); assert.equal(result.receipt.amountsPreserved, true);
assert.equal(result.receipt.backup.verified, false); assert.equal(result.receipt.backup.waived, true);
assert.equal(Object.keys(result.receipt.verification).length, 28);
assert.ok(!JSON.stringify(result.receipt).includes('a'.repeat(32)), 'Money fingerprints stay in memory');
submissions = 0; fingerprints = 0; failMigration = true;
result = await activate(args, overrides);
assert.equal(result.passed, false); assert.equal(submissions, 1, 'No second submission after timeout');
assert.equal(result.receipt.script.committed, false); assert.equal(result.receipt.commitOutcomeUnknown, true);
assert.ok(!JSON.stringify(result.receipt).includes('credential')); assert.ok(!JSON.stringify(output).includes('credential'));
failMigration = false; wrongAmounts = true; submissions = 0; fingerprints = 0;
result = await activate(args, overrides);
assert.equal(result.passed, false); assert.equal(submissions, 1); assert.equal(result.receipt.script.committed, true);
assert.equal(result.safeCode, 'TASK039_POSTFLIGHT_FAILED'); assert.equal(result.receipt.commitOutcomeUnknown, false);
prepares = 0; submissions = 0;
result = await activate([args[0]], overrides); assert.equal(result.passed, false); assert.equal(prepares, 0); assert.equal(submissions, 0);
console.log('PASS: exact TASK-039 waiver admission, one script submission, commit/amount/currency/readiness checks, no retry after timeout, committed postflight failure and sanitized receipts. Mocked adapters only.');
