// PREPARED ONLY. Requires a new explicit TASK-039 no-verified-backup selection.
// Exact-source once-only migration + read-only postflight; no app/workflow startup.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { client, connect, requireThat } from '../audit/runtime-support.mjs';
import { APPROVED_SOURCE, EXECUTOR, MIGRATION_SHA256, SOURCE_METADATA_SQL, cleanMetadata, prepareProtectedSource, failureCode } from './preflight-approved.mjs';
import { WISHLIST_APPLICATION_READINESS_SQL, WISHLIST_APPLICATION_READINESS_KEYS, wishlistApplicationReadinessArguments, assertWishlistApplicationReadiness } from '../wishlist/application-readiness.mjs';
import { CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS, currencyReadinessArguments, assertCurrencyReadiness } from './application-readiness.mjs';

export const WAIVER = 'TASK-039-2026-11-05';
export const RECEIPT_PINS = Object.freeze({
  'source-preflight-receipt.json': 'be49a9d521506978983786845cfd71ea6b725b1f345e072ca1cbc37c06af1977',
  'source-network-preflight-receipt.json': 'a261c97303af6839f1a924c8cf9e3c64918f647da5cda4d1ce3aee561aef9174',
});
const receiptURL = new URL('./source-activation-receipt.json', import.meta.url);
export const AMOUNT_FINGERPRINT_SQL = `SELECT
 (SELECT md5(coalesce(string_agg(id::text || ':' || trim_scale(price)::text, ',' ORDER BY id), '')) FROM public.services) AS services_signature,
 (SELECT md5(coalesce(string_agg(id::text || ':' || trim_scale(total_amount)::text || ':' || trim_scale(advance_amount)::text, ',' ORDER BY id), '')) FROM public.bookings) AS bookings_signature`;
export const POSTFLIGHT_COUNTS_SQL = `SELECT
 (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 NOT EXISTS(SELECT 1 FROM public.services WHERE currency IS DISTINCT FROM 'EUR') AS services_all_eur,
 NOT EXISTS(SELECT 1 FROM public.bookings WHERE currency IS DISTINCT FROM 'EUR') AS bookings_all_eur`;
const activationCodes = new Set(['TASK039_APPLY_FLAG_REQUIRED','TASK039_EXACT_BACKUP_WAIVER_REQUIRED','TASK039_PRIOR_RECEIPT_CHANGED','TASK039_ACTIVATION_RECEIPT_EXISTS_OR_UNWRITABLE','TASK039_ACTIVATION_RECEIPT_SAVE_FAILED','TASK039_FRESH_BASELINE_REJECTED','TASK039_ACTIVE_WRITERS','TASK039_COMMIT_NOT_CONFIRMED','TASK039_POSTFLIGHT_FAILED','TASK039_AMOUNT_FINGERPRINT_SHAPE','TASK039_MIGRATION_DIGEST_CHANGED']);
const code = error => activationCodes.has(error?.safeCode) ? error.safeCode : failureCode(error);
export function admission(args) {
  requireThat(args.length === 2 && args.includes('--apply-approved-source=' + APPROVED_SOURCE), 'TASK039_APPLY_FLAG_REQUIRED');
  requireThat(args.includes('--backup-waived=' + WAIVER), 'TASK039_EXACT_BACKUP_WAIVER_REQUIRED');
}
function fingerprint(rows) {
  requireThat(Array.isArray(rows) && rows.length === 1 && rows[0] && Object.keys(rows[0]).length === 2
    && ['services_signature','bookings_signature'].every(key => typeof rows[0][key] === 'string' && /^[0-9a-f]{32}$/.test(rows[0][key])), 'TASK039_AMOUNT_FINGERPRINT_SHAPE');
  return rows[0];
}
async function pinnedScript() {
  for (const [name, pin] of Object.entries(RECEIPT_PINS)) {
    const text = await readFile(new URL('./' + name, import.meta.url));
    requireThat(createHash('sha256').update(text).digest('hex') === pin, 'TASK039_PRIOR_RECEIPT_CHANGED');
  }
  const text = await readFile(new URL('./0020_currencies.sql', import.meta.url), 'utf8');
  requireThat(createHash('sha256').update(text).digest('hex') === MIGRATION_SHA256, 'TASK039_MIGRATION_DIGEST_CHANGED');
  return text;
}
const defaults = { script: pinnedScript, prepare: prepareProtectedSource, client, connect,
  async create(value) { await writeFile(receiptURL, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); },
  async save(value) { await writeFile(receiptURL, JSON.stringify(value, null, 2) + '\n'); },
  emit(value) { process.stdout.write(JSON.stringify(value) + '\n'); },
};
export async function activate(args, overrides = {}) {
  const deps = { ...defaults, ...overrides }; let stage = 'local_admission', receipt, app, owner;
  const save = async () => { try { await deps.save(receipt); } catch { requireThat(false, 'TASK039_ACTIVATION_RECEIPT_SAVE_FAILED'); } };
  try {
    admission(args); const script = await deps.script();
    receipt = { task: 'TASK-039', project: APPROVED_SOURCE, executor: EXECUTOR, startedAt: new Date().toISOString(), state: 'started',
      backup: { verified: false, waived: true, selection: WAIVER }, priorReceiptSha256: RECEIPT_PINS,
      script: { name: '0020_currencies.sql', sha256: MIGRATION_SHA256, attempted: false, committed: false }, sourceOnly: true, retry: false };
    try { await deps.create(receipt); } catch { receipt = undefined; requireThat(false, 'TASK039_ACTIVATION_RECEIPT_EXISTS_OR_UNWRITABLE'); }
    stage = 'protected_source_configuration'; receipt.stage = stage; await save(); const prepared = await deps.prepare();
    stage = 'fresh_restricted40_readonly_guard'; receipt.stage = stage; await save();
    app = await deps.client(prepared.appValue, 'source', prepared.appCA, 'fmt_app_dev'); await deps.connect(app); await app.query('BEGIN TRANSACTION READ ONLY');
    const baseline = (await app.query(WISHLIST_APPLICATION_READINESS_SQL, wishlistApplicationReadinessArguments())).rows;
    try { assertWishlistApplicationReadiness(baseline); } catch { requireThat(false, 'TASK039_FRESH_BASELINE_REJECTED'); }
    receipt.baselineVerification = Object.fromEntries(WISHLIST_APPLICATION_READINESS_KEYS.map(key => [key, baseline[0][key] === true]));
    await app.query('COMMIT'); await app.end(); app = undefined; await save();
    stage = 'fresh_owner_readonly_guard'; receipt.stage = stage; await save();
    owner = await deps.client(prepared.ownerValue, 'source', prepared.ownerCA, 'postgres'); await deps.connect(owner); await owner.query('BEGIN TRANSACTION READ ONLY');
    const metadata = cleanMetadata((await owner.query(SOURCE_METADATA_SQL)).rows); receipt.sourceMetadata = metadata;
    requireThat(['expected_principal','expected_database','expected_version','read_only','expected_table_security','currency_columns_absent','prior_monetary_types'].every(key => metadata[key])
      && metadata.public_table_count === 40 && metadata.invalid_service_amounts === 0 && metadata.invalid_booking_amounts === 0, 'TASK039_FRESH_BASELINE_REJECTED');
    requireThat(metadata.other_application_or_owner_connections === 0, 'TASK039_ACTIVE_WRITERS');
    const beforeAmounts = fingerprint((await owner.query(AMOUNT_FINGERPRINT_SQL)).rows);
    await owner.query('COMMIT'); await save();
    deps.emit({ stage, passed: true, readOnly: true, tlsVerified: true, metadata });
    stage = '0020_currencies.sql'; receipt.stage = stage; receipt.script.attempted = true; await save();
    const response = await owner.query({ text: script, query_timeout: 125000 });
    const results = Array.isArray(response) ? response : [response];
    requireThat(results.at(-1)?.command === 'COMMIT' && results.some(result => result.rows?.[0]?.services_backfilled_eur === String(metadata.service_count)
      && result.rows?.[0]?.bookings_backfilled_eur === String(metadata.booking_count)), 'TASK039_COMMIT_NOT_CONFIRMED');
    receipt.script.committed = true; receipt.script.completedAt = new Date().toISOString(); await save();
    deps.emit({ stage, passed: true, committed: true, updatedRows: results.filter(result => result.command === 'UPDATE').reduce((sum, result) => sum + (result.rowCount || 0), 0) });
    stage = 'owner_readonly_amount_postflight'; receipt.stage = stage; await save(); await owner.query('BEGIN TRANSACTION READ ONLY');
    const afterAmounts = fingerprint((await owner.query(AMOUNT_FINGERPRINT_SQL)).rows);
    const counts = (await owner.query(POSTFLIGHT_COUNTS_SQL)).rows[0];
    receipt.amountsPreserved = beforeAmounts.services_signature === afterAmounts.services_signature && beforeAmounts.bookings_signature === afterAmounts.bookings_signature;
    requireThat(receipt.amountsPreserved && counts?.service_count === metadata.service_count && counts?.booking_count === metadata.booking_count
      && counts?.services_all_eur === true && counts?.bookings_all_eur === true, 'TASK039_POSTFLIGHT_FAILED');
    receipt.postflightCounts = { service_count: counts.service_count, booking_count: counts.booking_count, services_all_eur: true, bookings_all_eur: true };
    await owner.query('COMMIT'); await owner.end(); owner = undefined; await save();
    stage = 'restricted_readonly_currency_postflight'; receipt.stage = stage; await save();
    app = await deps.client(prepared.appValue, 'source', prepared.appCA, 'fmt_app_dev'); await deps.connect(app); await app.query('BEGIN TRANSACTION READ ONLY');
    const oldRows = (await app.query(WISHLIST_APPLICATION_READINESS_SQL, wishlistApplicationReadinessArguments())).rows;
    const currencyRows = (await app.query(CURRENCY_READINESS_SQL, currencyReadinessArguments())).rows;
    try { assertWishlistApplicationReadiness(oldRows); assertCurrencyReadiness(currencyRows); } catch { requireThat(false, 'TASK039_POSTFLIGHT_FAILED'); }
    receipt.verification = Object.fromEntries([...WISHLIST_APPLICATION_READINESS_KEYS.map(key => [key, oldRows[0][key] === true]), ...CURRENCY_READINESS_KEYS.map(key => [key, currencyRows[0][key] === true])]);
    await app.query('COMMIT'); await app.end(); app = undefined;
    receipt.state = 'verified'; receipt.completedAt = new Date().toISOString(); await save();
    deps.emit({ stage, passed: true, project: APPROVED_SOURCE, readOnly: true, tlsVerified: true, checks: receipt.verification, counts: receipt.postflightCounts, amountsPreserved: true, backupVerified: false, backupWaived: true, retry: false });
    return { passed: true, receipt };
  } catch (error) {
    const safeCode = code(error);
    if (receipt) { receipt.state = 'stopped'; receipt.stage = stage; receipt.safeCode = safeCode; receipt.commitOutcomeUnknown = receipt.script.attempted && !receipt.script.committed; receipt.stoppedAt = new Date().toISOString(); try { await deps.save(receipt); } catch { deps.emit({ stage: 'receipt_persistence', passed: false, safeCode: 'TASK039_ACTIVATION_RECEIPT_SAVE_FAILED', retry: false }); } }
    deps.emit({ stage, passed: false, safeCode, project: APPROVED_SOURCE, commitOutcomeUnknown: receipt?.commitOutcomeUnknown ?? false, retry: false });
    return { passed: false, stage, safeCode, receipt };
  } finally { await app?.end().catch(() => {}); await owner?.end().catch(() => {}); }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { const result = await activate(process.argv.slice(2)); if (!result.passed) process.exitCode = 1; }
