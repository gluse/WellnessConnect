// TASK-039 authorized exact-source, once-only read-only preflight.
// No migration submission, backup export, private edits, startup or workflow writes.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'dotenv';
import { privatePreflight, privateRead, connection, trustedCA, client, connect, requireThat } from '../audit/runtime-support.mjs';
import { WISHLIST_APPLICATION_READINESS_SQL, WISHLIST_APPLICATION_READINESS_KEYS, wishlistApplicationReadinessArguments, assertWishlistApplicationReadiness } from '../wishlist/application-readiness.mjs';

export const APPROVED_SOURCE = 'hbkooiknruimukkhshrk';
export const EXECUTOR = '/root/currency_db';
export const MIGRATION_SHA256 = 'e145bc2d687e03b7785d3dc3ec6041c6176213388ccdebed1c16b5e576f56094';
const receiptURL = new URL('./source-preflight-receipt.json', import.meta.url);
export const SOURCE_METADATA_SQL = `SELECT
 current_user=session_user AND current_user='postgres' AS expected_principal,
 current_database()='postgres' AS expected_database,
 current_setting('server_version_num')::integer/10000=17 AS expected_version,
 current_setting('transaction_read_only')='on' AS read_only,
 (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')) AS public_table_count,
 (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace
  AND relname IN ('addresses','services','bookings') AND relkind='r'
  AND relowner='postgres'::regrole AND relrowsecurity)=3 AS expected_table_security,
 NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND ((table_name IN ('services','bookings') AND column_name='currency')
   OR (table_name='addresses' AND column_name='country_code'))) AS currency_columns_absent,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
  AND ((table_name='services' AND column_name='price')
   OR (table_name='bookings' AND column_name IN ('total_amount','advance_amount')))
  AND data_type='numeric' AND numeric_precision=10 AND numeric_scale=2 AND is_nullable='NO')=3 AS prior_monetary_types,
 (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 (SELECT count(*)::integer FROM public.services WHERE price<0 OR price>99999999.99 OR price<>trunc(price,2)
  OR advance_payment_percent<0 OR advance_payment_percent>100) AS invalid_service_amounts,
 (SELECT count(*)::integer FROM public.bookings WHERE total_amount<0 OR total_amount>99999999.99
  OR advance_amount<0 OR advance_amount>total_amount OR total_amount<>trunc(total_amount,2)
  OR advance_amount<>trunc(advance_amount,2)) AS invalid_booking_amounts,
 (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend'
  AND datname=current_database() AND usename IN ('fmt_app_dev','postgres') AND pid<>pg_backend_pid()) AS other_application_or_owner_connections,
 current_setting('archive_mode') AS archive_mode,
 coalesce(current_setting('archive_command',true),'')<>'' AS archive_command_configured,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='pg_catalog'::regnamespace AND proname='pg_backup_start') AS backup_function_present`;
const boolKeys = ['expected_principal','expected_database','expected_version','read_only','expected_table_security','currency_columns_absent','prior_monetary_types','archive_command_configured','backup_function_present'];
const countKeys = ['public_table_count','service_count','booking_count','invalid_service_amounts','invalid_booking_amounts','other_application_or_owner_connections'];
const own = (value, key) => { try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined; } catch { return undefined; } };
const safeCodes = new Set(['TASK039_EXACT_PREFLIGHT_FLAG_REQUIRED','TASK039_MIGRATION_DIGEST_CHANGED','TASK039_RECEIPT_EXISTS_OR_UNWRITABLE','TASK039_RECEIPT_SAVE_FAILED','TASK039_METADATA_SHAPE_REJECTED','TASK039_BASELINE_NOT_READY','TASK039_SOURCE_BASELINE_REJECTED','TASK039_ACTIVE_WRITERS','TASK039_RECOVERABLE_BACKUP_NOT_VERIFIED','DUPLICATE_ENV_KEY','PRIVATE_ACL_OR_IGNORE_FAILED','WINDOWS_PRIVATE_HANDOFF_ONLY','CURRENT_USER_SID_UNAVAILABLE','PRIVATE_FILE_NOT_IGNORED','PRIVATE_PATH_REJECTED','PRIVATE_SYMLINK_REJECTED','PRIVATE_FILE_MISSING','BAD_CONNECTION','WRONG_TARGET','WRONG_PRINCIPAL','URI_OVERRIDE_REJECTED','TLS_MODE_REJECTED','EXPLICIT_CA_REQUIRED','CA_REJECTED','BINARY_STARTUP_OVERRIDE_REJECTED','TLS_NOT_VERIFIED','28P01','3D000','42501','53300','53400','57P01','57P02','57P03','57014','08000','08001','08003','08004','08006','08P01','ECONNREFUSED','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','ECONNRESET','ENOTFOUND','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','ERR_TLS_CERT_ALTNAME_INVALID']);
export function failureCode(error) { const code = own(error, 'safeCode') ?? own(error, 'code'); return safeCodes.has(code) ? code : 'TASK039_UNCLASSIFIED_FAILURE'; }
export function admission(args) { requireThat(args.length === 1 && args[0] === '--preflight-approved-source=' + APPROVED_SOURCE, 'TASK039_EXACT_PREFLIGHT_FLAG_REQUIRED'); }
export function cleanMetadata(rows) {
  requireThat(Array.isArray(rows) && rows.length === 1 && rows[0] && Object.keys(rows[0]).length === boolKeys.length + countKeys.length + 1, 'TASK039_METADATA_SHAPE_REJECTED');
  const clean = {};
  for (const key of boolKeys) { const value = own(rows[0], key); requireThat(typeof value === 'boolean', 'TASK039_METADATA_SHAPE_REJECTED'); clean[key] = value; }
  for (const key of countKeys) { const value = own(rows[0], key); requireThat(Number.isSafeInteger(value) && value >= 0, 'TASK039_METADATA_SHAPE_REJECTED'); clean[key] = value; }
  const archive = own(rows[0], 'archive_mode'); requireThat(['on','off','always'].includes(archive), 'TASK039_METADATA_SHAPE_REJECTED'); clean.archive_mode = archive;
  return clean;
}
function settings(file, sid) {
  const text = privateRead(file, sid), keys = [...text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(match => match[1]);
  requireThat(new Set(keys).size === keys.length, 'DUPLICATE_ENV_KEY'); return parse(text);
}
async function localRecoveryInventory() {
  const tool = name => { const result = spawnSync(name, ['--version'], { encoding: 'utf8', windowsHide: true, shell: false }); return result.status === 0 && !result.error; };
  let directoryExists = false, archiveCount = 0;
  try { const entries = await readdir(new URL('../../database-backups/', import.meta.url), { withFileTypes: true }); directoryExists = true; archiveCount = entries.filter(entry => entry.isFile() && /\.(dump|backup|tar)$/i.test(entry.name)).length; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { pgDumpOnPath: tool('pg_dump.exe'), pgRestoreOnPath: tool('pg_restore.exe'), backupDirectoryExists: directoryExists, topLevelArchiveCount: archiveCount,
    verifiedRecoverable: false, managedRecoveryEvidenceAvailable: false, priorTaskWaiverReusable: false,
    reason: 'No independently verified current source archive/restore evidence or managed recovery point is available to this executor' };
}
export async function prepareProtectedSource() {
  const sid = privatePreflight(), appValue = settings('.env', sid).DATABASE_URL, ownerValue = settings('.env.audit-setup.local', sid).AUDIT_SETUP_SOURCE_DATABASE_URL;
  const appConfig = connection(appValue, 'source', 'fmt_app_dev'), ownerConfig = connection(ownerValue, 'source', 'postgres');
  return { appValue, ownerValue, appCA: trustedCA(appConfig), ownerCA: trustedCA(ownerConfig) };
}
const defaults = {
  async pin() { const text = await readFile(new URL('./0020_currencies.sql', import.meta.url), 'utf8'); requireThat(createHash('sha256').update(text).digest('hex') === MIGRATION_SHA256, 'TASK039_MIGRATION_DIGEST_CHANGED'); },
  async create(value) { await writeFile(receiptURL, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); },
  async save(value) { await writeFile(receiptURL, JSON.stringify(value, null, 2) + '\n'); },
  prepare: prepareProtectedSource,
  recovery: localRecoveryInventory, client, connect, emit(value) { process.stdout.write(JSON.stringify(value) + '\n'); },
};
export async function preflight(args, overrides = {}) {
  const deps = { ...defaults, ...overrides }; let stage = 'local_admission', receipt, app, owner;
  const save = async () => { try { await deps.save(receipt); } catch { requireThat(false, 'TASK039_RECEIPT_SAVE_FAILED'); } };
  try {
    admission(args); await deps.pin();
    receipt = { task: 'TASK-039', project: APPROVED_SOURCE, executor: EXECUTOR, startedAt: new Date().toISOString(), state: 'started',
      authorization: 'User approved DB owner preflight/apply 0020 with verified recovery and stop-on-first-failure, 5 November 2026',
      script: { name: '0020_currencies.sql', sha256: MIGRATION_SHA256, attempted: false, committed: false }, retry: false, readOnly: true, sourceOnly: true, backupCreated: false };
    try { await deps.create(receipt); } catch { receipt = undefined; requireThat(false, 'TASK039_RECEIPT_EXISTS_OR_UNWRITABLE'); }
    stage = 'protected_source_configuration'; receipt.stage = stage; await save(); const prepared = await deps.prepare();
    stage = 'restricted40_readonly_preflight'; receipt.stage = stage; await save();
    app = await deps.client(prepared.appValue, 'source', prepared.appCA, 'fmt_app_dev'); await deps.connect(app); await app.query('BEGIN TRANSACTION READ ONLY');
    const rows = (await app.query(WISHLIST_APPLICATION_READINESS_SQL, wishlistApplicationReadinessArguments())).rows;
    try { assertWishlistApplicationReadiness(rows); } catch { requireThat(false, 'TASK039_BASELINE_NOT_READY'); }
    receipt.baselineVerification = Object.fromEntries(WISHLIST_APPLICATION_READINESS_KEYS.map(key => [key, own(rows[0], key) === true]));
    await app.query('COMMIT'); await app.end(); app = undefined; await save();
    deps.emit({ stage, passed: true, project: APPROVED_SOURCE, readOnly: true, tlsVerified: true, checks: receipt.baselineVerification });
    stage = 'owner_readonly_source_metadata'; receipt.stage = stage; await save();
    owner = await deps.client(prepared.ownerValue, 'source', prepared.ownerCA, 'postgres'); await deps.connect(owner); await owner.query('BEGIN TRANSACTION READ ONLY');
    const metadata = cleanMetadata((await owner.query(SOURCE_METADATA_SQL)).rows); receipt.sourceMetadata = metadata; await save();
    requireThat(['expected_principal','expected_database','expected_version','read_only','expected_table_security','currency_columns_absent','prior_monetary_types'].every(key => metadata[key])
      && metadata.public_table_count === 40 && metadata.invalid_service_amounts === 0 && metadata.invalid_booking_amounts === 0, 'TASK039_SOURCE_BASELINE_REJECTED');
    requireThat(metadata.other_application_or_owner_connections === 0, 'TASK039_ACTIVE_WRITERS');
    await owner.query('COMMIT'); await owner.end(); owner = undefined; await save();
    deps.emit({ stage, passed: true, project: APPROVED_SOURCE, readOnly: true, tlsVerified: true, metadata, archiveSettingsAreNotRestoreProof: true });
    stage = 'verified_recovery_gate'; receipt.stage = stage; receipt.recovery = await deps.recovery(); await save();
    // This preflight never accepts an old waiver, an archive setting or an ad hoc
    // JSON assertion as restore proof. Recovery creation/restore is separate work.
    requireThat(receipt.recovery.verifiedRecoverable === true, 'TASK039_RECOVERABLE_BACKUP_NOT_VERIFIED');
    receipt.state = 'preflight_passed'; receipt.completedAt = new Date().toISOString(); await save();
    deps.emit({ stage, passed: true, ddlAttempted: false, project: APPROVED_SOURCE }); return { passed: true, receipt };
  } catch (error) {
    const code = failureCode(error);
    if (receipt) { receipt.state = 'stopped'; receipt.stage = stage; receipt.safeCode = code; receipt.stoppedAt = new Date().toISOString(); try { await deps.save(receipt); } catch { deps.emit({ stage: 'receipt_persistence', passed: false, safeCode: 'TASK039_RECEIPT_SAVE_FAILED', retry: false }); } }
    deps.emit({ stage, passed: false, safeCode: code, project: APPROVED_SOURCE, ddlAttempted: false, retry: false, backupVerified: false });
    return { passed: false, stage, safeCode: code, receipt };
  } finally { await app?.end().catch(() => {}); await owner?.end().catch(() => {}); }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { const result = await preflight(process.argv.slice(2)); if (!result.passed) process.exitCode = 1; }
