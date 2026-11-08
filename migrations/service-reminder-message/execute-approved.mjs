// TASK-049 one-shot approved source-only activation. Inert on import.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { client, connect, requireThat } from '../audit/runtime-support.mjs';
import { prepareProtectedSource } from '../currencies/preflight-approved.mjs';
import { verifyWorkspacePricingDatabaseReadiness } from '../workspace-pricing/application-readiness.mjs';
import { verifyCurrencyDatabaseReadiness } from '../currencies/application-readiness.mjs';
import { verifyServicePhotoDatabaseReadiness } from '../service-photos/application-readiness.mjs';
import { verifyServiceReminderMessageDatabaseReadiness } from './application-readiness.mjs';
export const TARGET='hbkooiknruimukkhshrk', EXECUTOR='/root/custom_reminder_db';
export const MIGRATION_SHA256='341f702ef28c59e3e5adf289eb0a520411f3b6e93fc476a0c737ada86ba9168d';
// Fresh user authorization, 8 November2026: "Approve. Proceed without DB backup".
// Applies only to TASK-049 development source; TASK-048 authorization is not reused.
export const REVIEWED_EXECUTION_APPROVAL=Object.freeze({task:'TASK-049',executor:EXECUTOR,source:TARGET,
 localRecord:'docs/custom-service-reminder-db-handoff.md#development-activation-authorization--8-november-2026',privateConfigRead:true,sourceMigration:true,sourceReadOnlyChecks:true});
export const REVIEWED_RECOVERY=Object.freeze({task:'TASK-049',project:TARGET,
 localRecord:'docs/custom-service-reminder-db-handoff.md#development-activation-authorization--8-november-2026',backupWaived:true,explicitUserWaiver:true});
const receiptURL=new URL('./source-execution-receipt.json',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const code=(ok,name)=>requireThat(ok,'TASK049_'+name);
export function admission(args){code(args.length===2&&args.includes('--apply-approved-source='+TARGET)&&args.includes('--approval=TASK-049'),'EXACT_APPROVAL_FLAGS_REQUIRED');}
export function authorize(approval=REVIEWED_EXECUTION_APPROVAL,recovery=REVIEWED_RECOVERY){
 code(approval?.task==='TASK-049'&&approval.executor===EXECUTOR&&approval.source===TARGET&&approval.localRecord&&approval.privateConfigRead===true&&approval.sourceMigration===true&&approval.sourceReadOnlyChecks===true,'NEW_EXECUTION_APPROVAL_REQUIRED');
 code(recovery?.task==='TASK-049'&&recovery.project===TARGET&&recovery.localRecord,'NEW_RECOVERY_CHOICE_REQUIRED');
 if(recovery.backupWaived===true)code(recovery.explicitUserWaiver===true,'EXPLICIT_BACKUP_WAIVER_REQUIRED');
 else code(recovery.verifiedRecoverable===true&&/^[0-9a-f]{64}$/.test(recovery.evidenceSha256??'')&&Date.now()-Date.parse(recovery.verifiedAt)>=0&&Date.now()-Date.parse(recovery.verifiedAt)<86400000,'CURRENT_VERIFIED_RECOVERY_REQUIRED');
 return {approvalRecord:approval.localRecord,recoveryRecord:recovery.localRecord,backupWaived:recovery.backupWaived===true};
}
export const SOURCE_METADATA_SQL=`SELECT current_user=session_user AND current_user='postgres' AS identity,
 current_database()='postgres' AS database,current_setting('server_version_num')::integer/10000=17 AS version,
 current_setting('transaction_read_only')='on' AS read_only,
 (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')) AS table_count,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='reminder_message' AND NOT attisdropped) AS message_absent,
 EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.services'::regclass AND t.tgname='fmt_audit_record_changed' AND t.tgenabled='O' AND n.nspname='audit_capture' AND p.proname='business_record_changed' AND p.pronargs=0 AND p.prorettype='pg_catalog.trigger'::regtype) AS trigger_enabled,
 (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend' AND datname=current_database() AND usename IN('fmt_app_dev','postgres','fmt_audit_worker_dev','fmt_audit_capture_dev') AND pid<>pg_backend_pid()) AS other_writers`;
export const FINGERPRINT_SQL=`SELECT
 (SELECT md5(coalesce(string_agg(md5((to_jsonb(s)-'reminder_message')::text),'' ORDER BY id),'')) FROM public.services s) AS services,
 (SELECT md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' ORDER BY id),'')) FROM public.bookings b) AS bookings`;
export const POSTFLIGHT_SQL=`SELECT (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 NOT EXISTS(SELECT 1 FROM public.services WHERE reminder_message IS DISTINCT FROM '') AS messages_empty,
 EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.services'::regclass AND t.tgname='fmt_audit_record_changed' AND t.tgenabled='O' AND n.nspname='audit_capture' AND p.proname='business_record_changed' AND p.pronargs=0 AND p.prorettype='pg_catalog.trigger'::regtype) AS trigger_enabled`;
function row(rows,booleans,counts){
 code(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===booleans.length+counts.length,'METADATA_SHAPE');
 for(const key of booleans)code(typeof rows[0][key]==='boolean','METADATA_SHAPE');
 for(const key of counts)code(Number.isSafeInteger(rows[0][key])&&rows[0][key]>=0,'METADATA_SHAPE');return rows[0];
}
function fingerprints(rows){code(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===2&&['services','bookings'].every(key=>/^[0-9a-f]{32}$/.test(rows[0][key]??'')),'FINGERPRINT_SHAPE');return rows[0];}
const safeCodes=new Set(['EXACT_APPROVAL_FLAGS_REQUIRED','NEW_EXECUTION_APPROVAL_REQUIRED','NEW_RECOVERY_CHOICE_REQUIRED','EXPLICIT_BACKUP_WAIVER_REQUIRED','CURRENT_VERIFIED_RECOVERY_REQUIRED','MIGRATION_CHANGED','RECEIPT_EXISTS_OR_UNWRITABLE','RECEIPT_SAVE_FAILED','BASELINE_NOT_READY','METADATA_SHAPE','SOURCE_BASELINE_CHANGED','ACTIVE_WRITERS','FINGERPRINT_SHAPE','COMMIT_NOT_CONFIRMED','POSTFLIGHT_FAILED','MESSAGE_NOT_READY'].map(value=>'TASK049_'+value));
export function failureCode(error){const selected=error?.safeCode??error?.code;return safeCodes.has(selected)||['57014','23514','40P01','42501','ECONNRESET','ETIMEDOUT','ENOTFOUND','TLS_NOT_VERIFIED','WRONG_TARGET','WRONG_PRINCIPAL'].includes(selected)?selected:'TASK049_UNCLASSIFIED_FAILURE';}
const defaults={authorize,
 async script(){const sql=await readFile(new URL('./0023_service_reminder_message.sql',import.meta.url),'utf8');code(hash(sql)===MIGRATION_SHA256,'MIGRATION_CHANGED');return sql;},
 async create(receipt){await writeFile(receiptURL,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});},
 async save(receipt){await writeFile(receiptURL,JSON.stringify(receipt,null,2)+'\n');},
 prepare:prepareProtectedSource,client,connect,emit(value){process.stdout.write(JSON.stringify(value)+'\n');}};
export async function execute(args,overrides={}){
 const deps={...defaults,...overrides};let stage='local_admission',receipt,app,owner;
 const save=async()=>{try{await deps.save(receipt);}catch{code(false,'RECEIPT_SAVE_FAILED');}};
 const baseline=async()=>{const query=(text,values)=>app.query(text,values);try{await verifyWorkspacePricingDatabaseReadiness(query);await verifyCurrencyDatabaseReadiness(query);await verifyServicePhotoDatabaseReadiness(query);}catch{code(false,'BASELINE_NOT_READY');}};
 try{
  admission(args);const authorization=await deps.authorize(),sql=await deps.script();
  receipt={task:'TASK-049',project:TARGET,executor:EXECUTOR,startedAt:new Date().toISOString(),state:'started',authorization,script:{name:'0023_service_reminder_message.sql',sha256:MIGRATION_SHA256,attempted:false,committed:false},retry:false,sourceOnly:true,privateConfigEdited:false,auditDeliveryAttempted:false};
  try{await deps.create(receipt);}catch{receipt=undefined;code(false,'RECEIPT_EXISTS_OR_UNWRITABLE');}
  stage='protected_source_configuration';receipt.stage=stage;await save();const prepared=await deps.prepare();
  stage='restricted_baseline';receipt.stage=stage;await save();app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');await baseline();await app.query('COMMIT');await app.end();app=undefined;
  stage='owner_readonly_preflight';receipt.stage=stage;await save();owner=await deps.client(prepared.ownerValue,'source',prepared.ownerCA,'postgres');await deps.connect(owner);await owner.query('BEGIN TRANSACTION READ ONLY');
  const meta=row((await owner.query(SOURCE_METADATA_SQL)).rows,['identity','database','version','read_only','message_absent','trigger_enabled'],['table_count','service_count','booking_count','other_writers']);
  receipt.sourceMetadata=meta;code(['identity','database','version','read_only','message_absent','trigger_enabled'].every(key=>meta[key])&&meta.table_count===41&&meta.service_count<=10000&&meta.booking_count<=100000,'SOURCE_BASELINE_CHANGED');code(meta.other_writers===0,'ACTIVE_WRITERS');
  const before=fingerprints((await owner.query(FINGERPRINT_SQL)).rows);await owner.query('COMMIT');await save();
  stage='0023_service_reminder_message.sql';receipt.stage=stage;receipt.script.attempted=true;await save();
  const response=await owner.query({text:sql,query_timeout:125000}),results=Array.isArray(response)?response:[response];code(results.at(-1)?.command==='COMMIT','COMMIT_NOT_CONFIRMED');receipt.script.committed=true;await save();
  stage='owner_readonly_postflight';receipt.stage=stage;await save();await owner.query('BEGIN TRANSACTION READ ONLY');
  const after=fingerprints((await owner.query(FINGERPRINT_SQL)).rows),post=row((await owner.query(POSTFLIGHT_SQL)).rows,['messages_empty','trigger_enabled'],['service_count','booking_count']);
  receipt.existingServiceAndBookingFieldsPreserved=before.services===after.services&&before.bookings===after.bookings;receipt.postflightCounts=post;
  code(receipt.existingServiceAndBookingFieldsPreserved&&post.service_count===meta.service_count&&post.booking_count===meta.booking_count&&post.messages_empty&&post.trigger_enabled,'POSTFLIGHT_FAILED');await owner.query('COMMIT');await owner.end();owner=undefined;
  stage='restricted_message_postflight';receipt.stage=stage;await save();app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');await baseline();
  try{await verifyServiceReminderMessageDatabaseReadiness((text,values)=>app.query(text,values));}catch{code(false,'MESSAGE_NOT_READY');}await app.query('COMMIT');
  receipt.state='verified';receipt.completedAt=new Date().toISOString();await save();deps.emit({stage,passed:true,project:TARGET,preserved:true,automaticRetry:false});return{passed:true,receipt};
 }catch(error){const selected=failureCode(error);if(receipt){receipt.state='stopped';receipt.stage=stage;receipt.safeCode=selected;receipt.commitOutcomeUnknown=receipt.script.attempted&&!receipt.script.committed;try{await deps.save(receipt);}catch{deps.emit({stage:'receipt_persistence',passed:false,safeCode:'TASK049_RECEIPT_SAVE_FAILED'});}}deps.emit({stage,passed:false,safeCode:selected,commitOutcomeUnknown:receipt?.commitOutcomeUnknown??false,automaticRetry:false});return{passed:false,stage,safeCode:selected,receipt};
 }finally{for(const value of [app,owner])if(value)await value.end().catch(()=>{});}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){if(!(await execute(process.argv.slice(2))).passed)process.exitCode=1;}
