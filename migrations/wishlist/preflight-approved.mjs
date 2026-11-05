// TASK-042 single-attempt SOURCE-ONLY READ-ONLY preflight. No DDL or backup export.
// A missing independently verified recovery path deliberately stops this stage.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parse} from 'dotenv';
import {privatePreflight,privateRead,connection,trustedCA,client,connect,requireThat} from '../audit/runtime-support.mjs';
import {BILLING_APPLICATION_READINESS_SQL,BILLING_APPLICATION_READINESS_KEYS,billingApplicationReadinessArguments,assertBillingApplicationReadiness} from '../billing/application-readiness.mjs';
export const APPROVED_SOURCE='hbkooiknruimukkhshrk';
export const EXECUTOR='/root/wishlist_database_plan';
export const SCRIPT_PINS=Object.freeze([
 Object.freeze({name:'0018_wishlist.sql',sha256:'4abd4acdcce0d83016c5f7466708bc98a996aa34378c2cd24e20a452a6651beb'}),
 Object.freeze({name:'0019_wishlist_runtime.sql',sha256:'bb4c08065166c800f62cde02161428247cab28bd4dddcffce0eef99a005555c3'}),
]);
export const SOURCE_METADATA_SQL=`SELECT current_user=session_user AND current_user='postgres' AS expected_principal,
 current_database()='postgres' AS expected_database,current_setting('server_version_num')::integer/10000=17 AS expected_version,
 current_setting('transaction_read_only')='on' AS read_only,
 (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')) AS public_table_count,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relname IN
 ('wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads')) AS wishlist_tables_absent,
 current_setting('archive_mode') AS archive_mode,
 current_setting('archive_command',true) IS NOT NULL AND current_setting('archive_command',true)<>'' AS archive_command_configured,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='pg_catalog'::regnamespace AND proname='pg_backup_start') AS backup_function_present,
 (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend' AND datname=current_database()
 AND usename='fmt_app_dev' AND pid<>pg_backend_pid()) AS other_application_connections`;
const receiptURL=new URL('./source-preflight-receipt.json',import.meta.url);
export function admission(args){requireThat(args.length===1&&args[0]==='--preflight-approved-source='+APPROVED_SOURCE,'EXACT_TASK042_PREFLIGHT_FLAG_REQUIRED');}
const safeCodes=new Set(['EXACT_TASK042_PREFLIGHT_FLAG_REQUIRED','TASK042_MIGRATION_DIGEST_CHANGED','TASK042_PREFLIGHT_RECEIPT_EXISTS_OR_UNWRITABLE','TASK042_METADATA_SHAPE_REJECTED','TASK042_SOURCE_BASELINE_REJECTED','TASK042_RECOVERABLE_BACKUP_NOT_VERIFIED','TASK042_RESTRICTED35_NOT_READY','DUPLICATE_ENV_KEY','PRIVATE_ACL_OR_IGNORE_FAILED','WINDOWS_PRIVATE_HANDOFF_ONLY','CURRENT_USER_SID_UNAVAILABLE','PRIVATE_FILE_NOT_IGNORED','PRIVATE_PATH_REJECTED','PRIVATE_SYMLINK_REJECTED','PRIVATE_FILE_MISSING','BAD_CONNECTION','WRONG_TARGET','WRONG_PRINCIPAL','URI_OVERRIDE_REJECTED','TLS_MODE_REJECTED','EXPLICIT_CA_REQUIRED','CA_REJECTED','BINARY_STARTUP_OVERRIDE_REJECTED','TLS_NOT_VERIFIED','28P01','3D000','42501','53300','53400','57P01','57P02','57P03','57014','08000','08001','08003','08004','08006','08P01','ECONNREFUSED','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','ECONNRESET','ENOTFOUND','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','ERR_TLS_CERT_ALTNAME_INVALID']);
function data(value,key){try{const item=Object.getOwnPropertyDescriptor(value,key);return item&&Object.hasOwn(item,'value')?item.value:undefined;}catch{return undefined;}}
export function failureCode(error){const safe=data(error,'safeCode'),driver=data(error,'code');if(driver==='BILLING_DB_NOT_READY')return 'TASK042_RESTRICTED35_NOT_READY';return safeCodes.has(safe)?safe:safeCodes.has(driver)?driver:'TASK042_UNCLASSIFIED_FAILURE';}
function readiness(rows){
 requireThat(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===BILLING_APPLICATION_READINESS_KEYS.length,'TASK042_RESTRICTED35_NOT_READY');
 const clean=Object.fromEntries(BILLING_APPLICATION_READINESS_KEYS.map(key=>[key,data(rows[0],key)===true]));
 return clean;
}
function sourceMetadata(rows){
 const flags=['expected_principal','expected_database','expected_version','read_only','wishlist_tables_absent','archive_command_configured','backup_function_present'];
 requireThat(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===10,'TASK042_METADATA_SHAPE_REJECTED');
 const row=rows[0],clean={};
 for(const key of flags){const value=data(row,key);requireThat(typeof value==='boolean','TASK042_METADATA_SHAPE_REJECTED');clean[key]=value;}
 for(const key of ['public_table_count','other_application_connections']){const value=data(row,key);requireThat(Number.isSafeInteger(value)&&value>=0,'TASK042_METADATA_SHAPE_REJECTED');clean[key]=value;}
 const archive=data(row,'archive_mode');requireThat(['on','off','always'].includes(archive),'TASK042_METADATA_SHAPE_REJECTED');clean.archive_mode=archive;return clean;
}
function settings(file,sid){
 const text=privateRead(file,sid),names=[...text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(match=>match[1]);
 requireThat(new Set(names).size===names.length,'DUPLICATE_ENV_KEY');return parse(text);
}
const defaults={
 async pins(){for(const pin of SCRIPT_PINS){const text=await readFile(new URL('./'+pin.name,import.meta.url),'utf8');requireThat(createHash('sha256').update(text).digest('hex')===pin.sha256,'TASK042_MIGRATION_DIGEST_CHANGED');}},
 async create(receipt){await writeFile(receiptURL,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});},
 async save(receipt){await writeFile(receiptURL,JSON.stringify(receipt,null,2)+'\n');},
 async prepare(){
  const sid=privatePreflight();
  const appValue=settings('.env',sid).DATABASE_URL;
  const ownerValue=settings('.env.audit-setup.local',sid).AUDIT_SETUP_SOURCE_DATABASE_URL;
  const appConfig=connection(appValue,'source','fmt_app_dev'),ownerConfig=connection(ownerValue,'source','postgres');
  return {appValue,ownerValue,appCA:trustedCA(appConfig),ownerCA:trustedCA(ownerConfig)};
 },
 client,connect,
 emit(value){process.stdout.write(JSON.stringify(value)+'\n');},
};
export async function preflight(args,overrides={}){
 const deps={...defaults,...overrides};let stage='local_admission',receipt,app,owner;
 try{
  admission(args);await deps.pins();
  const initial={task:'TASK-042',project:APPROVED_SOURCE,executor:EXECUTOR,startedAt:new Date().toISOString(),
   state:'started',scripts:SCRIPT_PINS.map(pin=>({...pin,attempted:false,committed:false})),
   sourceOnly:true,readOnly:true,retry:false,backupCreated:false,backupVerified:false,ddlAttempted:false};
  try{await deps.create(initial);}catch{requireThat(false,'TASK042_PREFLIGHT_RECEIPT_EXISTS_OR_UNWRITABLE');}
  receipt=initial;
  stage='protected_source_configuration';receipt.stage=stage;await deps.save(receipt);
  const prepared=await deps.prepare();
  stage='restricted35_readonly_preflight';receipt.stage=stage;await deps.save(receipt);
  app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);
  await app.query('BEGIN TRANSACTION READ ONLY');
  const result=await app.query(BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments());
  receipt.baselineVerification=readiness(result.rows);
  assertBillingApplicationReadiness([receipt.baselineVerification]);
  await app.query('COMMIT');
  await app.end();app=undefined;await deps.save(receipt);
  deps.emit({stage,passed:true,project:APPROVED_SOURCE,tlsVerified:true,readOnly:true,checks:receipt.baselineVerification});
  stage='source_owner_readonly_metadata';receipt.stage=stage;await deps.save(receipt);
  owner=await deps.client(prepared.ownerValue,'source',prepared.ownerCA,'postgres');await deps.connect(owner);
  await owner.query('BEGIN TRANSACTION READ ONLY');
  const rows=(await owner.query(SOURCE_METADATA_SQL)).rows;
  const metadata=sourceMetadata(rows);receipt.sourceMetadata=metadata;
  requireThat(metadata.expected_principal&&metadata.expected_database&&metadata.expected_version&&metadata.read_only
   &&metadata.public_table_count===35&&metadata.wishlist_tables_absent,'TASK042_SOURCE_BASELINE_REJECTED');
  await owner.query('COMMIT');await owner.end();owner=undefined;await deps.save(receipt);
  deps.emit({stage,passed:true,project:APPROVED_SOURCE,tlsVerified:true,readOnly:true,checks:metadata,backupMetadataIsNotRestoreProof:true});
  stage='verified_recovery_gate';receipt.stage=stage;await deps.save(receipt);
  // No backup export/restore or provider-console operation is authorized by this
  // runner. No unverified JSON assertion, archive setting or old waiver can pass.
  receipt.recovery={verifiedRecoverable:false,localArchiveVerified:false,pgDumpRecoveryCapabilityVerified:false,
   managedBackupRestoreVerified:false,priorTaskWaiverReusable:false,
   reason:'No independently verified current source backup and restore path available to this executor'};
  requireThat(false,'TASK042_RECOVERABLE_BACKUP_NOT_VERIFIED');
 }catch(error){
  const code=failureCode(error);
  if(receipt){receipt.state='stopped';receipt.stage=stage;receipt.safeCode=code;receipt.stoppedAt=new Date().toISOString();
   if(code==='TASK042_RESTRICTED35_NOT_READY'&&receipt.baselineVerification)receipt.failedChecks=BILLING_APPLICATION_READINESS_KEYS.filter(key=>receipt.baselineVerification[key]!==true);
   try{await deps.save(receipt);}catch{deps.emit({stage:'receipt_persistence',passed:false,safeCode:'TASK042_RECEIPT_SAVE_FAILED',retry:false});}
  }
  deps.emit({stage,passed:false,safeCode:code,checks:receipt?.failedChecks,project:APPROVED_SOURCE,retry:false,ddlAttempted:false,backupVerified:false});
  return {passed:false,stage,safeCode:code,receipt};
 }finally{
  await app?.end().catch(()=>{});await owner?.end().catch(()=>{});
 }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const result=await preflight(process.argv.slice(2));if(!result.passed)process.exitCode=1;}
