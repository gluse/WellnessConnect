// TASK-048 one-shot approved development activation. No reads/connections on import.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { client, connect, requireThat, privatePreflight, privateRead, readSettings, connection, trustedCA } from '../audit/runtime-support.mjs';
import { prepareProtectedSource } from '../currencies/preflight-approved.mjs';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL as BASE_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS as BASE_KEYS, workspacePricingApplicationReadinessArguments as baseArgs, assertWorkspacePricingApplicationReadiness as assertBase } from '../workspace-pricing/application-readiness.mjs';
import { CURRENCY_READINESS_SQL, CURRENCY_READINESS_KEYS, currencyReadinessArguments, assertCurrencyReadiness } from '../currencies/application-readiness.mjs';
import { EXPECTED_COMPLETION_AUDIT_PARSERS } from '../audit/application-readiness.mjs';
import { SERVICE_PHOTO_READINESS_SQL, SERVICE_PHOTO_READINESS_KEYS, servicePhotoReadinessArguments, assertServicePhotoReadiness } from './application-readiness.mjs';
export const TARGET='hbkooiknruimukkhshrk', DESTINATION='ynygqodmtgjrngiudalw', EXECUTOR='/root/service_photos_database';
export const MIGRATION_SHA256='ceae2a5dd684aea626e9cc63a09b71cd360eda91dc5dc895d7ed6bf8a90e0775';
// Fresh user choice, 8 November2026: "Permission granted. Go without DB backup".
// Historical TASK-039/044/audit exceptions are not reused. See the linked exact scope.
export const REVIEWED_EXECUTION_APPROVAL=Object.freeze({task:'TASK-048',executor:EXECUTOR,source:TARGET,destination:DESTINATION,
 localRecord:'docs/service-photos-db-handoff.md#development-activation-authorization--8-november-2026',privateConfigRead:true,sourceMigration:true,auditReadOnly:true});
export const REVIEWED_RECOVERY=Object.freeze({task:'TASK-048',project:TARGET,
 localRecord:'docs/service-photos-db-handoff.md#development-activation-authorization--8-november-2026',backupWaived:true,explicitUserWaiver:true});
const receiptURL=new URL('./source-execution-receipt.json',import.meta.url);
export const SOURCE_METADATA_SQL=`SELECT current_user=session_user AND current_user='postgres' AS identity,
 current_database()='postgres' AS database,current_setting('server_version_num')::integer/10000=17 AS version,
 current_setting('transaction_read_only')='on' AS read_only,
 (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')) AS table_count,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='image_urls' AND NOT attisdropped) AS gallery_absent,
 EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.services'::regclass AND t.tgname='fmt_audit_record_changed' AND t.tgenabled='O' AND n.nspname='audit_capture' AND p.proname='business_record_changed' AND p.pronargs=0 AND p.prorettype='pg_catalog.trigger'::regtype) AS trigger_enabled,
 (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 (SELECT count(*)::integer FROM public.services WHERE image_url IS NOT NULL AND image_url<>'') AS legacy_image_count,
 (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend' AND datname=current_database() AND usename IN('fmt_app_dev','postgres','fmt_audit_worker_dev','fmt_audit_capture_dev') AND pid<>pg_backend_pid()) AS other_writers`;
export const FINGERPRINT_SQL=`SELECT
 (SELECT md5(coalesce(string_agg(md5((to_jsonb(s)-'image_urls')::text),'' ORDER BY id),'')) FROM public.services s) AS services,
 (SELECT md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' ORDER BY id),'')) FROM public.bookings b) AS bookings`;
export const POSTFLIGHT_SQL=`SELECT (SELECT count(*)::integer FROM public.services) AS service_count,
 (SELECT count(*)::integer FROM public.bookings) AS booking_count,
 (SELECT count(*)::integer FROM public.services WHERE cardinality(image_urls)=1) AS image_count,
 NOT EXISTS(SELECT 1 FROM public.services WHERE image_urls IS DISTINCT FROM CASE WHEN image_url IS NOT NULL AND image_url<>'' THEN ARRAY[image_url] ELSE ARRAY[]::text[] END) AS exact_backfill,
 EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.services'::regclass AND t.tgname='fmt_audit_record_changed' AND t.tgenabled='O' AND n.nspname='audit_capture' AND p.proname='business_record_changed' AND p.pronargs=0 AND p.prorettype='pg_catalog.trigger'::regtype) AS trigger_enabled`;
export const DESTINATION_READINESS_SQL=`SELECT current_user=session_user AND current_user='fmt_audit_writer_dev' AS identity,
 current_database()='postgres' AND current_setting('transaction_read_only')='on' AS read_only,
 pg_has_role(current_user,'fm_audit_writer','MEMBER') AND has_function_privilege(current_user,'audit.accept(text,text,text)','EXECUTE') AS writer_capability,
 NOT has_table_privilege(current_user,'audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS no_base_access,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='audit_contract' AND p.proname='parse_event' AND pg_catalog.pg_get_function_identity_arguments(p.oid)='canonical_json text, payload_hash text, hash_version text' AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=$1) AS parser_current`;
export const AUDIT_HEALTH_SQL=`SELECT status,event_count::integer,expired_count::integer FROM audit_capture.delivery_health WHERE status<>'delivered'`;
const hash=value=>createHash('sha256').update(value).digest('hex');
const code=(ok,name)=>requireThat(ok,'TASK048_'+name);
const own=(value,key)=>{try{const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
export function admission(args){code(args.length===2&&args.includes('--apply-approved-source='+TARGET)&&args.includes('--approval=TASK-048'),'EXACT_APPROVAL_FLAGS_REQUIRED');}
export function authorize(approval=REVIEWED_EXECUTION_APPROVAL,recovery=REVIEWED_RECOVERY){
 code(approval?.task==='TASK-048'&&approval.executor===EXECUTOR&&approval.source===TARGET&&approval.destination===DESTINATION&&approval.localRecord&&approval.privateConfigRead===true&&approval.sourceMigration===true&&approval.auditReadOnly===true,'NEW_EXECUTION_APPROVAL_REQUIRED');
 code(recovery?.task==='TASK-048'&&recovery.project===TARGET&&recovery.localRecord,'NEW_RECOVERY_CHOICE_REQUIRED');
 if(recovery.backupWaived===true)code(recovery.explicitUserWaiver===true,'EXPLICIT_BACKUP_WAIVER_REQUIRED');
 else code(recovery.verifiedRecoverable===true&&/^[0-9a-f]{64}$/.test(recovery.evidenceSha256??'')&&Date.now()-Date.parse(recovery.verifiedAt)>=0&&Date.now()-Date.parse(recovery.verifiedAt)<86400000,'CURRENT_VERIFIED_RECOVERY_REQUIRED');
 return {approvalRecord:approval.localRecord,recoveryRecord:recovery.localRecord,backupWaived:recovery.backupWaived===true};
}
function row(rows,booleans,counts,stage){
 code(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===booleans.length+counts.length,stage+'_SHAPE');
 const output={};for(const key of booleans){const value=own(rows[0],key);code(typeof value==='boolean',stage+'_SHAPE');output[key]=value;}
 for(const key of counts){const value=own(rows[0],key);code(Number.isSafeInteger(value)&&value>=0,stage+'_SHAPE');output[key]=value;}return output;
}
function fingerprints(rows){code(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===2&&['services','bookings'].every(key=>/^[0-9a-f]{32}$/.test(own(rows[0],key)??'')),'FINGERPRINT_SHAPE');return rows[0];}
function auditHealth(rows){const output={pending:0,leased:0,quarantined:0,expired:0};code(Array.isArray(rows),'AUDIT_HEALTH_SHAPE');const seen=new Set();for(const value of rows){code(value&&Object.keys(value).length===3&&['pending','leased','quarantined'].includes(value.status)&&!seen.has(value.status)&&Number.isSafeInteger(value.event_count)&&value.event_count>=0&&Number.isSafeInteger(value.expired_count)&&value.expired_count>=0,'AUDIT_HEALTH_SHAPE');seen.add(value.status);output[value.status]=value.event_count;output.expired+=value.expired_count;}return output;}
const defaults={authorize,
 async script(){const text=await readFile(new URL('./0022_service_photos.sql',import.meta.url),'utf8');code(hash(text)===MIGRATION_SHA256,'MIGRATION_CHANGED');return text;},
 async prepare(){const source=await prepareProtectedSource(),sid=privatePreflight(),settings=readSettings(privateRead('.env.audit-worker.local',sid));
 const workerValue=settings.AUDIT_SOURCE_DATABASE_URL,destinationValue=settings.AUDIT_DATABASE_URL;
 return {...source,workerValue,destinationValue,workerCA:trustedCA(connection(workerValue,'source','fmt_audit_worker_dev')),destinationCA:trustedCA(connection(destinationValue,'destination','fmt_audit_writer_dev'))};},client,connect,
 async create(value){await writeFile(receiptURL,JSON.stringify(value,null,2)+'\n',{flag:'wx'});},
 async save(value){await writeFile(receiptURL,JSON.stringify(value,null,2)+'\n');},emit(value){process.stdout.write(JSON.stringify(value)+'\n');}};
const safeInternal=new Set(['EXACT_APPROVAL_FLAGS_REQUIRED','NEW_EXECUTION_APPROVAL_REQUIRED','NEW_RECOVERY_CHOICE_REQUIRED','EXPLICIT_BACKUP_WAIVER_REQUIRED','CURRENT_VERIFIED_RECOVERY_REQUIRED','MIGRATION_CHANGED','RECEIPT_EXISTS_OR_UNWRITABLE','RECEIPT_SAVE_FAILED','BASELINE_NOT_READY','SOURCE_SHAPE','SOURCE_BASELINE_CHANGED','ACTIVE_WRITERS','FINGERPRINT_SHAPE','DESTINATION_SHAPE','DESTINATION_NOT_READY','AUDIT_HEALTH_SHAPE','AUDIT_BACKLOG_REQUIRES_REVIEW','COMMIT_NOT_CONFIRMED','POSTFLIGHT_SHAPE','POSTFLIGHT_FAILED','GALLERY_NOT_READY'].map(value=>'TASK048_'+value));
const safeExternal=new Set(['ENOTFOUND','ECONNREFUSED','ETIMEDOUT','ECONNRESET','ENETUNREACH','EHOSTUNREACH','42501','28P01','57014','23514','40P01','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE',
 'PRIVATE_ACL_OR_IGNORE_FAILED','WINDOWS_PRIVATE_HANDOFF_ONLY','CURRENT_USER_SID_UNAVAILABLE','PRIVATE_FILE_NOT_IGNORED','PRIVATE_PATH_REJECTED','PRIVATE_SYMLINK_REJECTED','PRIVATE_FILE_MISSING','BAD_CONNECTION','WRONG_TARGET','WRONG_PRINCIPAL','URI_OVERRIDE_REJECTED','TLS_MODE_REJECTED','EXPLICIT_CA_REQUIRED','CA_REJECTED','BINARY_STARTUP_OVERRIDE_REJECTED','TLS_NOT_VERIFIED','DUPLICATE_ENV_KEY','INVALID_QUOTED_ENV_VALUE','AMBIGUOUS_ENV_VALUE','INVALID_ENV_VALUE']);
function safeCode(error){const selected=own(error,'safeCode')??own(error,'code');return safeInternal.has(selected)||safeExternal.has(selected)?selected:'TASK048_UNCLASSIFIED_FAILURE';}
export async function execute(args,overrides={}){
 const deps={...defaults,...overrides};let stage='local_admission',receipt,app,owner,worker,destination;
 const save=async()=>{try{await deps.save(receipt);}catch{code(false,'RECEIPT_SAVE_FAILED');}};
 const close=async value=>{if(value)await value.end();};
 const baseline=async()=>{const rows=(await app.query(BASE_SQL,baseArgs())).rows,currency=(await app.query(CURRENCY_READINESS_SQL,currencyReadinessArguments())).rows;try{assertBase(rows);assertCurrencyReadiness(currency);}catch{code(false,'BASELINE_NOT_READY');}return BASE_KEYS.length+CURRENCY_READINESS_KEYS.length;};
 try{admission(args);const authorization=await deps.authorize(),script=await deps.script();
  receipt={task:'TASK-048',project:TARGET,auditDestination:DESTINATION,executor:EXECUTOR,startedAt:new Date().toISOString(),state:'started',authorization,script:{name:'0022_service_photos.sql',sha256:MIGRATION_SHA256,attempted:false,committed:false},retry:false,privateConfigEdited:false,auditDeliveryAttempted:false};
  try{await deps.create(receipt);}catch{receipt=undefined;code(false,'RECEIPT_EXISTS_OR_UNWRITABLE');}
  stage='protected_configuration';receipt.stage=stage;await save();const prepared=await deps.prepare();
  stage='restricted_baseline';receipt.stage=stage;await save();app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');receipt.baselineChecks=await baseline();await app.query('COMMIT');await close(app);app=undefined;
  stage='audit_readiness';receipt.stage=stage;await save();
  destination=await deps.client(prepared.destinationValue,'destination',prepared.destinationCA,'fmt_audit_writer_dev');await deps.connect(destination);await destination.query('BEGIN TRANSACTION READ ONLY');
  const destinationState=row((await destination.query(DESTINATION_READINESS_SQL,[EXPECTED_COMPLETION_AUDIT_PARSERS[0].hash])).rows,['identity','read_only','writer_capability','no_base_access','parser_current'],[],'DESTINATION');code(Object.values(destinationState).every(value=>value===true),'DESTINATION_NOT_READY');await destination.query('COMMIT');await close(destination);destination=undefined;receipt.auditDestinationReadiness=true;
  worker=await deps.client(prepared.workerValue,'source',prepared.workerCA,'fmt_audit_worker_dev');await deps.connect(worker);const health=auditHealth((await worker.query(AUDIT_HEALTH_SQL)).rows);code(Object.values(health).every(value=>value===0),'AUDIT_BACKLOG_REQUIRES_REVIEW');await close(worker);worker=undefined;
  stage='owner_readonly_preflight';receipt.stage=stage;await save();owner=await deps.client(prepared.ownerValue,'source',prepared.ownerCA,'postgres');await deps.connect(owner);await owner.query('BEGIN TRANSACTION READ ONLY');
  const meta=row((await owner.query(SOURCE_METADATA_SQL)).rows,['identity','database','version','read_only','gallery_absent','trigger_enabled'],['table_count','service_count','booking_count','legacy_image_count','other_writers'],'SOURCE');receipt.sourceMetadata=meta;
  code(['identity','database','version','read_only','gallery_absent','trigger_enabled'].every(key=>meta[key])&&meta.table_count===41&&meta.service_count<=10000&&meta.booking_count<=100000,'SOURCE_BASELINE_CHANGED');code(meta.other_writers===0,'ACTIVE_WRITERS');
  const before=fingerprints((await owner.query(FINGERPRINT_SQL)).rows);await owner.query('COMMIT');await save();
  stage='0022_service_photos.sql';receipt.stage=stage;receipt.script.attempted=true;await save();
  const response=await owner.query({text:script,query_timeout:125000}),results=Array.isArray(response)?response:[response];
  code(results.at(-1)?.command==='COMMIT'&&results.some(result=>result.rows?.length===1&&result.rows[0]?.legacy_images_backfilled===meta.legacy_image_count),'COMMIT_NOT_CONFIRMED');
  receipt.script.committed=true;await save();
  stage='owner_readonly_postflight';receipt.stage=stage;await save();await owner.query('BEGIN TRANSACTION READ ONLY');
  const after=fingerprints((await owner.query(FINGERPRINT_SQL)).rows),post=row((await owner.query(POSTFLIGHT_SQL)).rows,['exact_backfill','trigger_enabled'],['service_count','booking_count','image_count'],'POSTFLIGHT');
  receipt.existingServiceAndBookingFieldsPreserved=before.services===after.services&&before.bookings===after.bookings;receipt.postflightCounts=post;
  code(receipt.existingServiceAndBookingFieldsPreserved&&post.service_count===meta.service_count&&post.booking_count===meta.booking_count&&post.image_count===meta.legacy_image_count&&post.exact_backfill&&post.trigger_enabled,'POSTFLIGHT_FAILED');await owner.query('COMMIT');await close(owner);owner=undefined;
  stage='restricted_gallery_postflight';receipt.stage=stage;await save();app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');receipt.postflightChecks=await baseline();
  try{assertServicePhotoReadiness((await app.query(SERVICE_PHOTO_READINESS_SQL,servicePhotoReadinessArguments())).rows);}catch{code(false,'GALLERY_NOT_READY');}receipt.postflightChecks+=SERVICE_PHOTO_READINESS_KEYS.length;await app.query('COMMIT');await close(app);app=undefined;
  worker=await deps.client(prepared.workerValue,'source',prepared.workerCA,'fmt_audit_worker_dev');await deps.connect(worker);const afterHealth=auditHealth((await worker.query(AUDIT_HEALTH_SQL)).rows);receipt.auditBackfillEventsPending=afterHealth.pending;
  code(afterHealth.pending===meta.legacy_image_count&&afterHealth.leased===0&&afterHealth.quarantined===0&&afterHealth.expired===0,'POSTFLIGHT_FAILED');
  receipt.state='verified';receipt.completedAt=new Date().toISOString();await save();deps.emit({stage,passed:true,project:TARGET,checks:receipt.postflightChecks,preserved:true,auditBackfillEventsPending:afterHealth.pending,automaticRetry:false});return{passed:true,receipt};
 }catch(error){const selected=safeCode(error);if(receipt){receipt.state='stopped';receipt.stage=stage;receipt.safeCode=selected;receipt.commitOutcomeUnknown=receipt.script.attempted&&!receipt.script.committed;try{await deps.save(receipt);}catch{deps.emit({stage:'receipt_persistence',passed:false,safeCode:'TASK048_RECEIPT_SAVE_FAILED'});}}deps.emit({stage,passed:false,safeCode:selected,commitOutcomeUnknown:receipt?.commitOutcomeUnknown??false,automaticRetry:false});return{passed:false,stage,safeCode:selected,receipt};
 }finally{for(const value of [app,owner,worker,destination])if(value)await value.end().catch(()=>{});}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){if(!(await execute(process.argv.slice(2))).passed)process.exitCode=1;}
