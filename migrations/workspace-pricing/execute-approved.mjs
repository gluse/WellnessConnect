// TASK-044 preparation only. Run after a NEW exact-target/recovery approval.
// Reuses existing verified-TLS/protected settings helpers; no I/O on import.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { client, connect, requireThat } from '../audit/runtime-support.mjs';
import { prepareProtectedSource } from '../currencies/preflight-approved.mjs';
import { WISHLIST_APPLICATION_READINESS_SQL as OLD_SQL, WISHLIST_APPLICATION_READINESS_KEYS as OLD_KEYS, wishlistApplicationReadinessArguments as oldArgs, assertWishlistApplicationReadiness as assertOld } from '../wishlist/application-readiness.mjs';
import { CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS, currencyReadinessArguments, assertCurrencyReadiness } from '../currencies/application-readiness.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL as NEW_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS as NEW_KEYS, workspacePricingApplicationReadinessArguments as newArgs, assertWorkspacePricingApplicationReadiness as assertNew } from './application-readiness.mjs';

export const TARGET = 'hbkooiknruimukkhshrk';
export const EXECUTOR = '/root/currency_db';
export const WAIVER = 'TASK-044-2026-11-06';
export const MIGRATION_SHA256 = '91971cfbf5c2a462acde1df3329a783a445c80974564df45d832a597b88ecfd7';
// A verified-recovery route cannot be unlocked by an ad hoc JSON assertion.
// DB owner must independently review real evidence and pin its digest locally.
export const VERIFIED_RECOVERY_EVIDENCE_SHA256 = null;
export const PRIOR_CURRENCY_RECEIPT_SHA256 = '29ee9ea1628406bde338d552a5e59b65459d5bc89923e4d0408bf70a81915dd9';
const receiptURL = new URL('./source-execution-receipt.json', import.meta.url);
export const SOURCE_METADATA_SQL = `SELECT current_user=session_user AND current_user='postgres' AS identity,
 current_database()='postgres' AS database,current_setting('server_version_num')::integer/10000=17 AS version,
 current_setting('transaction_read_only')='on' AS read_only,
 (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')) AS table_count,
 to_regclass('public.workspace_pricing_settings') IS NULL AS settings_absent,
 NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='addresses' AND column_name='pricing_currency') AS address_override_absent,
 (SELECT count(*)::integer FROM public.users) AS user_count,
 (SELECT count(*)::integer FROM public.companies) AS company_count,
 (SELECT count(*)::integer FROM public.addresses) AS address_count,
 (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend' AND datname=current_database()
  AND usename IN('fmt_app_dev','postgres') AND pid<>pg_backend_pid()) AS other_writers`;
export const FINGERPRINT_SQL = `SELECT
 (SELECT md5(coalesce(string_agg(id::text||':'||trim_scale(price)::text||':'||currency,',' ORDER BY id),'')) FROM public.services) AS services,
 (SELECT md5(coalesce(string_agg(id::text||':'||trim_scale(total_amount)::text||':'||trim_scale(advance_amount)::text||':'||currency,',' ORDER BY id),'')) FROM public.bookings) AS bookings,
 (SELECT md5(coalesce(string_agg(id::text||':'||(to_jsonb(a)-'pricing_currency')::text,',' ORDER BY id),'')) FROM public.addresses a) AS addresses`;
export const POSTFLIGHT_SQL = `SELECT
 (SELECT count(*)::integer FROM public.users) AS user_count,
 (SELECT count(*)::integer FROM public.companies) AS company_count,
 (SELECT count(*)::integer FROM public.addresses) AS address_count,
 (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 (SELECT count(*)::integer FROM public.workspace_pricing_settings WHERE user_id IS NOT NULL) AS personal_defaults,
 (SELECT count(*)::integer FROM public.workspace_pricing_settings WHERE company_id IS NOT NULL) AS company_defaults,
 NOT EXISTS(SELECT 1 FROM public.workspace_pricing_settings WHERE default_currency IS DISTINCT FROM 'EUR' OR business_country_code IS NOT NULL OR revision<>1) AS seed_values_correct,
 NOT EXISTS(SELECT 1 FROM public.addresses WHERE pricing_currency IS NOT NULL) AS overrides_unset`;
const own = (row,key) => { try { const descriptor=Object.getOwnPropertyDescriptor(row,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined; } catch { return undefined; } };
export function admission(args) {
  requireThat(args.length===2&&args.includes('--apply-approved-source='+TARGET),'TASK044_EXACT_TARGET_REQUIRED');
  const selected=args.find(value=>value.startsWith('--backup-waived=')||value.startsWith('--verified-recovery='));
  requireThat(selected==='--backup-waived='+WAIVER||selected==='--verified-recovery=REVIEWED-TASK-044','TASK044_EXACT_RECOVERY_CHOICE_REQUIRED');
  return selected.startsWith('--backup-waived=')?'waived':'verified';
}
function cleanRow(rows,booleans,counts,code) {
  requireThat(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===booleans.length+counts.length,code);
  const clean={};
  for(const key of booleans){const value=own(rows[0],key);requireThat(typeof value==='boolean',code);clean[key]=value;}
  for(const key of counts){const value=own(rows[0],key);requireThat(Number.isSafeInteger(value)&&value>=0,code);clean[key]=value;}
  return clean;
}
const countNames=['user_count','company_count','address_count','service_count','booking_count'];
function fingerprint(rows){requireThat(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===3&&['services','bookings','addresses'].every(key=>typeof own(rows[0],key)==='string'&&/^[0-9a-f]{32}$/.test(own(rows[0],key))),'TASK044_FINGERPRINT_SHAPE');return rows[0];}
async function reviewedRecovery(choice){
  if(choice==='waived')return {verified:false,waived:true,selection:WAIVER};
  requireThat(typeof VERIFIED_RECOVERY_EVIDENCE_SHA256==='string','TASK044_VERIFIED_RECOVERY_REVIEW_REQUIRED');
  const bytes=await readFile(new URL('./verified-recovery-evidence.json',import.meta.url));
  requireThat(createHash('sha256').update(bytes).digest('hex')===VERIFIED_RECOVERY_EVIDENCE_SHA256,'TASK044_VERIFIED_RECOVERY_CHANGED');
  const evidence=JSON.parse(bytes),age=Date.now()-Date.parse(evidence.verifiedAt);
  requireThat(evidence.project===TARGET&&evidence.verifiedRecoverable===true&&Number.isFinite(age)&&age>=0&&age<86400000&&['managed_backup','verified_logical_restore'].includes(evidence.method),'TASK044_VERIFIED_RECOVERY_NOT_CURRENT');
  return {verified:true,waived:false,evidenceSha256:VERIFIED_RECOVERY_EVIDENCE_SHA256,verifiedAt:evidence.verifiedAt,method:evidence.method};
}
const defaults={
 async script(){
  const prior=await readFile(new URL('../currencies/source-activation-receipt.json',import.meta.url));
  requireThat(createHash('sha256').update(prior).digest('hex')===PRIOR_CURRENCY_RECEIPT_SHA256,'TASK044_PRIOR_RECEIPT_CHANGED');
  const text=await readFile(new URL('./0021_workspace_pricing.sql',import.meta.url),'utf8');
  requireThat(createHash('sha256').update(text).digest('hex')===MIGRATION_SHA256,'TASK044_MIGRATION_CHANGED');return text;
 },recovery:reviewedRecovery,prepare:prepareProtectedSource,client,connect,
 async create(value){await writeFile(receiptURL,JSON.stringify(value,null,2)+'\n',{flag:'wx'});},
 async save(value){await writeFile(receiptURL,JSON.stringify(value,null,2)+'\n');},
 emit(value){process.stdout.write(JSON.stringify(value)+'\n');},
};
const safeInternal=new Set(['TASK044_EXACT_TARGET_REQUIRED','TASK044_EXACT_RECOVERY_CHOICE_REQUIRED','TASK044_FINGERPRINT_SHAPE','TASK044_VERIFIED_RECOVERY_REVIEW_REQUIRED','TASK044_VERIFIED_RECOVERY_CHANGED','TASK044_VERIFIED_RECOVERY_NOT_CURRENT','TASK044_PRIOR_RECEIPT_CHANGED','TASK044_MIGRATION_CHANGED','TASK044_RECEIPT_EXISTS_OR_UNWRITABLE','TASK044_RECEIPT_SAVE_FAILED','TASK044_BASELINE_NOT_READY','TASK044_SOURCE_METADATA_SHAPE','TASK044_SOURCE_BASELINE_CHANGED','TASK044_ACTIVE_WRITERS','TASK044_COMMIT_NOT_CONFIRMED','TASK044_POSTFLIGHT_SHAPE','TASK044_POSTFLIGHT_FAILED','PRIVATE_ACL_OR_IGNORE_FAILED','WINDOWS_PRIVATE_HANDOFF_ONLY','CURRENT_USER_SID_UNAVAILABLE','PRIVATE_FILE_NOT_IGNORED','PRIVATE_PATH_REJECTED','PRIVATE_SYMLINK_REJECTED','PRIVATE_FILE_MISSING','BAD_CONNECTION','WRONG_TARGET','WRONG_PRINCIPAL','URI_OVERRIDE_REJECTED','TLS_MODE_REJECTED','EXPLICIT_CA_REQUIRED','CA_REJECTED','BINARY_STARTUP_OVERRIDE_REJECTED','TLS_NOT_VERIFIED','28P01','3D000','42501','57014','ENOTFOUND','ECONNREFUSED','ETIMEDOUT','ECONNRESET','ENETUNREACH','EHOSTUNREACH','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID']);
function safeCode(error){const selected=own(error,'safeCode')??own(error,'code');return safeInternal.has(selected)?selected:'TASK044_UNCLASSIFIED_FAILURE';}
export async function execute(args,overrides={}){
 const deps={...defaults,...overrides};let stage='local_admission',receipt,app,owner;
 const save=async()=>{try{await deps.save(receipt);}catch{requireThat(false,'TASK044_RECEIPT_SAVE_FAILED');}};
 try{
  const choice=admission(args),script=await deps.script(),recovery=await deps.recovery(choice);
  receipt={task:'TASK-044',project:TARGET,executor:EXECUTOR,startedAt:new Date().toISOString(),state:'started',recovery,
   priorCurrencyReceiptSha256:PRIOR_CURRENCY_RECEIPT_SHA256,script:{name:'0021_workspace_pricing.sql',sha256:MIGRATION_SHA256,attempted:false,committed:false},retry:false,sourceOnly:true};
  try{await deps.create(receipt);}catch{receipt=undefined;requireThat(false,'TASK044_RECEIPT_EXISTS_OR_UNWRITABLE');}
  stage='protected_source_configuration';receipt.stage=stage;await save();const prepared=await deps.prepare();
  stage='restricted28_readonly_baseline';receipt.stage=stage;await save();
  app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');
  const oldRows=(await app.query(OLD_SQL,oldArgs())).rows,currencyRows=(await app.query(CURRENCY_READINESS_SQL,currencyReadinessArguments())).rows;
  try{assertOld(oldRows);assertCurrencyReadiness(currencyRows);}catch{requireThat(false,'TASK044_BASELINE_NOT_READY');}
  receipt.baseline=Object.fromEntries([...OLD_KEYS.map(key=>[key,oldRows[0][key]===true]),...CURRENCY_READINESS_KEYS.map(key=>[key,currencyRows[0][key]===true])]);
  await app.query('COMMIT');await app.end();app=undefined;await save();
  stage='owner_readonly_target_guard';receipt.stage=stage;await save();
  owner=await deps.client(prepared.ownerValue,'source',prepared.ownerCA,'postgres');await deps.connect(owner);await owner.query('BEGIN TRANSACTION READ ONLY');
  const metadata=cleanRow((await owner.query(SOURCE_METADATA_SQL)).rows,['identity','database','version','read_only','settings_absent','address_override_absent'],['table_count',...countNames,'other_writers'],'TASK044_SOURCE_METADATA_SHAPE');receipt.sourceMetadata=metadata;
  requireThat(['identity','database','version','read_only','settings_absent','address_override_absent'].every(key=>metadata[key])&&metadata.table_count===40,'TASK044_SOURCE_BASELINE_CHANGED');
  requireThat(metadata.other_writers===0,'TASK044_ACTIVE_WRITERS');
  const before=fingerprint((await owner.query(FINGERPRINT_SQL)).rows);await owner.query('COMMIT');await save();
  deps.emit({stage,passed:true,tlsVerified:true,readOnly:true,metadata});
  stage='0021_workspace_pricing.sql';receipt.stage=stage;receipt.script.attempted=true;await save();
  const response=await owner.query({text:script,query_timeout:125000}),results=Array.isArray(response)?response:[response];
  requireThat(results.at(-1)?.command==='COMMIT'&&results.some(result=>result.rows?.[0]?.personal_defaults_initialized===String(metadata.user_count)&&result.rows?.[0]?.company_defaults_initialized===String(metadata.company_count)),'TASK044_COMMIT_NOT_CONFIRMED');
  receipt.script.committed=true;receipt.script.completedAt=new Date().toISOString();await save();deps.emit({stage,passed:true,committed:true});
  stage='owner_readonly_preservation_postflight';receipt.stage=stage;await save();await owner.query('BEGIN TRANSACTION READ ONLY');
  const after=fingerprint((await owner.query(FINGERPRINT_SQL)).rows),counts=cleanRow((await owner.query(POSTFLIGHT_SQL)).rows,['seed_values_correct','overrides_unset'],[...countNames,'personal_defaults','company_defaults'],'TASK044_POSTFLIGHT_SHAPE');
  receipt.existingPricesCurrenciesAndAddressesPreserved=['services','bookings','addresses'].every(key=>before[key]===after[key]);receipt.postflightCounts=counts;
  requireThat(receipt.existingPricesCurrenciesAndAddressesPreserved&&countNames.every(key=>counts[key]===metadata[key])&&counts.personal_defaults===metadata.user_count&&counts.company_defaults===metadata.company_count&&counts.seed_values_correct&&counts.overrides_unset,'TASK044_POSTFLIGHT_FAILED');
  await owner.query('COMMIT');await owner.end();owner=undefined;await save();
  stage='restricted34_readonly_postflight';receipt.stage=stage;await save();app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');
  const newRows=(await app.query(NEW_SQL,newArgs())).rows,newCurrency=(await app.query(CURRENCY_READINESS_SQL,currencyReadinessArguments())).rows;
  try{assertNew(newRows);assertCurrencyReadiness(newCurrency);}catch{requireThat(false,'TASK044_POSTFLIGHT_FAILED');}
  receipt.verification=Object.fromEntries([...NEW_KEYS.map(key=>[key,newRows[0][key]===true]),...CURRENCY_READINESS_KEYS.map(key=>[key,newCurrency[0][key]===true])]);
  await app.query('COMMIT');await app.end();app=undefined;receipt.state='verified';receipt.completedAt=new Date().toISOString();await save();
  deps.emit({stage,passed:true,project:TARGET,readOnly:true,tlsVerified:true,checks:receipt.verification,counts,preserved:true,recovery, retry:false});return {passed:true,receipt};
 }catch(error){const code=safeCode(error);if(receipt){receipt.state='stopped';receipt.stage=stage;receipt.safeCode=code;receipt.commitOutcomeUnknown=receipt.script.attempted&&!receipt.script.committed;receipt.stoppedAt=new Date().toISOString();try{await deps.save(receipt);}catch{deps.emit({stage:'receipt_persistence',passed:false,safeCode:'TASK044_RECEIPT_SAVE_FAILED',retry:false});}}
  deps.emit({stage,passed:false,safeCode:code,project:TARGET,commitOutcomeUnknown:receipt?.commitOutcomeUnknown??false,retry:false});return {passed:false,safeCode:code,stage,receipt};
 }finally{await app?.end().catch(()=>{});await owner?.end().catch(()=>{});}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const result=await execute(process.argv.slice(2));if(!result.passed)process.exitCode=1;}
