// Fixed development audit completion. No environment reads or connections on import.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {ROOT,client,connect,privatePreflight,privateRead,privateWrite,readSettings,requireThat,safeCode,emit,roleURL} from './runtime-support.mjs';
import {patchPrivateEnvironment} from './private-runtime-plan.mjs';
import {beginPrivateSession,finishPrivateSession,forgetPrivateSession} from './private-session.mjs';
import {loadCompletionScripts,BUSINESS_TABLES,COMPLETION_VERSION,READER_ROLE} from './completion-package.mjs';

const selectSettings=(text,names)=>readSettings(text.split(/\r?\n/).filter(line=>names.some(name=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line))).join('\n'));
export async function inspect(){
 const {configs,cas}=loadPrivateConfiguration();
 const s=selectSettings(privateRead('.env',privatePreflight()),['APP_ADMIN_USER_IDS','AUDIT_READER_USER_IDS','AUDIT_EXPORT_USER_IDS','AUDIT_READER_DATABASE_URL']);
 emit('private-config',{adminCount:(s.APP_ADMIN_USER_IDS||'').split(',').filter(Boolean).length,readerConfigured:!!s.AUDIT_READER_DATABASE_URL});
 for(const target of ['destination','source']){let x;try{
  x=await client(configs[target],target,cas[target]);await connect(x);
  const versions=(await x.query('SELECT version FROM audit_contract.migrations ORDER BY version')).rows.map(v=>v.version);
  const tables=(await x.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname")).rows.map(v=>v.relname);
  const memberships=(await x.query("SELECT g.rolname,m.admin_option,m.inherit_option,m.set_option,grantor.rolname AS grantor FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE m.member=current_user::regrole AND g.rolname LIKE 'fm_audit_%' ORDER BY g.rolname")).rows;
  const readerPresent=(await x.query('SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS present',[READER_ROLE])).rows[0]?.present;
  emit('catalog-inspection',{target,versions,tables,memberships,readerPresent});
 }finally{if(x)await x.end();}}
}
export const READER_CAPABILITY_SQL=`SELECT current_user AS principal,r.rolcanlogin,r.rolconnlimit,
 r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 pg_has_role(current_user,'fm_audit_reader','MEMBER') AS reader_member,
 has_table_privilege(current_user,'audit.reader_events','SELECT') AS view_select,
 has_table_privilege(current_user,'audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
 has_function_privilege(current_user,'audit.accept(text,text,text)','EXECUTE') AS may_insert,
 has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
 EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege(current_user,n.oid,'CREATE')) AS schema_create,
 EXISTS(SELECT 1 FROM pg_roles other WHERE other.rolname NOT IN ('${READER_ROLE}','fm_audit_reader') AND pg_has_role(current_user,other.oid,'MEMBER')) AS extra_role
 FROM pg_roles r WHERE rolname=current_user`;
export function assertReaderCapabilities(rows){
 const r=rows[0];requireThat(rows.length===1&&r.principal===READER_ROLE&&r.rolcanlogin&&r.rolconnlimit===2&&r.reader_member&&r.view_select
  &&['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication','base_access','may_insert','database_create','schema_create','extra_role'].every(k=>r[k]===false),'READER_CAPABILITIES_REJECTED');
}
const canonical=value=>value===null?'null':Array.isArray(value)?'['+value.map(canonical).join(',')+']':typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
const args=e=>{const text=canonical(e);return[text,createHash('sha256').update(text).digest('hex'),'sha256-sorted-json-v1'];};
function fixture(eventName,patch={}){
 const id='36fead96-1ba8-4b45-9a7b-ae4681ca9991';
 return{eventId:id,requestId:id,operationId:id,schemaVersion:1,catalogVersion:1,occurredAt:new Date().toISOString(),eventName,outcome:'succeeded',retentionClass:'R',actor:{kind:'user',userId:id,effectiveRole:'support'},scope:{kind:'global'},target:{type:'request'},source:{application:'fitsmytime',environment:'development',component:'audit'},changes:[],...patch};
}
export async function rollbackContractChecks(x,target){
 await x.query("GRANT fm_audit_contract_owner TO postgres WITH ADMIN FALSE,INHERIT FALSE,SET TRUE GRANTED BY postgres");
 await x.query('SET LOCAL ROLE fm_audit_contract_owner');
 const data=fixture('data.record_updated.v1',{retentionClass:'B',actor:{kind:'service',serviceId:'database-runtime'},scope:{kind:'unknown'},target:{type:'database_record',id:'services:123'},source:{application:'fitsmytime',environment:'development',component:'database'},changes:[{field:'price',redacted:true}]});
 const auth=fixture('auth.operation_requested.v1',{retentionClass:'S',actor:{kind:'anonymous'},scope:{kind:'unknown'},source:{application:'fitsmytime',environment:'development',component:'auth'},changes:[{field:'operation',before:null,after:'login'}]});
 const location=fixture('location.observation_recorded.v1',{actor:{kind:'anonymous'},scope:{kind:'unknown'},source:{application:'fitsmytime',environment:'development',component:'location'},changes:[{field:'stage',before:null,after:'permission_observed'},{field:'reportedOutcome',before:null,after:'granted'},{field:'storageScope',before:null,after:'none'},{field:'noticeVersion',before:null,after:'location-2026-11-07'},{field:'language',before:null,after:'en'}]});
 const integration=fixture('integration.operation_requested.v1',{actor:{kind:'service',serviceId:'integration-runtime'},scope:{kind:'unknown'},source:{application:'fitsmytime',environment:'development',component:'integration'},changes:[{field:'operation',before:null,after:'geocoding'}]});
 const read=fixture('activity.records_read.v1',{actor:{kind:'user',userId:data.eventId,effectiveRole:'provider'},scope:{kind:'personal',workspaceId:data.eventId},source:{application:'fitsmytime',environment:'development',component:'application'},changes:[{field:'action',before:null,after:'bookings.provider'}]});
 const valid=[fixture('audit.records_viewed.v1'),fixture('audit.records_exported.v1'),data,auth,{...auth,eventName:'auth.operation_reported.v1',outcome:'denied',reasonCode:'INVALID_CREDENTIALS'},location,
  ...['lv','ru'].map(language=>({...location,changes:location.changes.map(c=>c.field==='language'?{...c,after:language}:c)})),integration,...['embedding','notification_batch','activity_batch'].map(operation=>({...integration,eventName:'integration.operation_reported.v1',changes:[{field:'operation',before:null,after:operation}]})),
  {...integration,eventName:'integration.operation_reported.v1',outcome:'unknown',reasonCode:'PROVIDER_TIMEOUT'},read,{...read,actor:{kind:'user',userId:data.eventId,effectiveRole:'admin'},scope:{kind:'company',workspaceId:'1'}},{...read,actor:{kind:'user',userId:data.eventId,effectiveRole:'support'},scope:{kind:'global'},changes:[{field:'action',before:null,after:'admin.users'}]}];
 for(const e of valid)requireThat((await x.query('SELECT audit_contract.parse_event($1,$2,$3) AS e',args(e))).rows[0]?.e?.eventName===e.eventName,'COMPLETION_VALID_EVENT_REJECTED');
 const invalid=[{...data,changes:[{field:'price',before:1,after:2}]},{...data,actor:{kind:'user',userId:data.eventId,effectiveRole:'support'}},{...data,retentionClass:'R'},fixture('audit.records_viewed.v1',{actor:{kind:'user',userId:data.eventId,effectiveRole:'provider'}}),fixture('audit.records_viewed.v1',{changes:[{field:'query',after:'private'}]}),{...auth,outcome:'unknown',reasonCode:'PROVIDER_TIMEOUT'},{...auth,eventName:'auth.operation_reported.v1',outcome:'failed'}, {...location,changes:location.changes.map(c=>c.field==='storageScope'?{...c,after:'profile'}:c)},
  {...integration,actor:{kind:'anonymous'}},{...integration,eventName:'integration.operation_reported.v1',outcome:'failed',reasonCode:'INVALID_INPUT'},{...read,actor:{kind:'anonymous'},scope:{kind:'unknown'}},{...read,scope:{kind:'personal',workspaceId:'9bece1c9-2cd1-49c3-b1f4-198a28636929'}},{...read,changes:[{field:'action',before:null,after:'admin.users'}]}];
 for(const e of invalid){await x.query('SAVEPOINT invalid_event');let denied=false;try{await x.query('SELECT audit_contract.parse_event($1,$2,$3)',args(e));}catch(error){requireThat(error.code==='22023','COMPLETION_INVALID_PROBE_ERROR');denied=true;}await x.query('ROLLBACK TO SAVEPOINT invalid_event');requireThat(denied,'COMPLETION_INVALID_EVENT_ACCEPTED');}
 await x.query('RESET ROLE');
 const schema=target==='source'?'audit_capture':'audit',table=target==='source'?'audit_outbox':'events',entry=target==='source'?'enqueue':'accept';
 await x.query(`GRANT fm_audit_${target}_owner TO postgres WITH ADMIN FALSE,INHERIT FALSE,SET TRUE GRANTED BY postgres`);await x.query(`SET LOCAL ROLE fm_audit_${target}_owner`);
 for(const [i,e]of valid.entries()){
  const event={...e,eventId:'36fead96-1ba8-4b45-9a7b-ae4681ca99'+String(i+10)};
  await x.query(`SELECT ${schema}.${entry}($1,$2,$3)`,args(event));
  requireThat((await x.query(`SELECT expires_at=occurred_at+($2::int*interval '24 hours') AS ok FROM ${schema}.${table} WHERE event_id=$1`,[event.eventId,event.retentionClass==='R'?90:365])).rows[0]?.ok===true,'COMPLETION_RETENTION_REJECTED');
 }
 await x.query('RESET ROLE');
 return{validEvents:valid.length,rejectedEvents:invalid.length,retentionChecked:true};
}
async function rollbackBusinessChecks(x){
 const key='audit-probe-36fead96';
 requireThat((await x.query('SELECT NOT EXISTS(SELECT 1 FROM public.categories WHERE key=$1) AS absent',[key])).rows[0]?.absent,'COMPLETION_FIXTURE_COLLISION');
 await x.query("INSERT INTO public.categories(key,name,icon,search_keywords) VALUES($1,$2,'','')",[key,'Audit private rollback probe']);
 await x.query('UPDATE public.categories SET name=$2 WHERE key=$1',[key,'Never retain this private value']);
 await x.query('DELETE FROM public.categories WHERE key=$1',[key]);
 await x.query('SET LOCAL ROLE fm_audit_source_owner');
 const events=(await x.query("SELECT canonical_json,envelope FROM audit_capture.audit_outbox WHERE envelope#>>'{target,id}'=$1 ORDER BY occurred_at,event_id",['categories:'+key])).rows;
 requireThat(events.length===3&&new Set(events.map(e=>e.envelope.eventName)).size===3,'COMPLETION_TRIGGER_CAPTURE_REJECTED');
 for(const event of events)requireThat(event.canonical_json===canonical(event.envelope)&&!event.canonical_json.includes('private value')&&!event.canonical_json.includes('private rollback')&&event.envelope.changes.every(c=>c.redacted===true&&!('before'in c)&&!('after'in c)),'COMPLETION_TRIGGER_REDACTION_REJECTED');
 await x.query('RESET ROLE');
 await x.query('SAVEPOINT capture_failure');
 await x.query('SET LOCAL ROLE fm_audit_source_owner');await x.query('ALTER FUNCTION audit_capture.enqueue(text,text,text) RENAME TO enqueue_probe_hidden');await x.query('RESET ROLE');
 let rejected=false;try{await x.query("INSERT INTO public.categories(key,name,icon,search_keywords) VALUES($1,'Capture fails closed','','')",[key]);}catch{rejected=true;}
 await x.query('ROLLBACK TO SAVEPOINT capture_failure');
 requireThat(rejected&&(await x.query('SELECT NOT EXISTS(SELECT 1 FROM public.categories WHERE key=$1) AS absent',[key])).rows[0]?.absent,'COMPLETION_TRIGGER_FAILURE_NOT_ATOMIC');
 return{capturedMutations:3,redacted:true,canonicalVerified:true,captureFailureRolledBack:true};
}
export async function migrationMode(mode){
 const scripts=loadCompletionScripts(),{configs,cas}=loadPrivateConfiguration();
 const targets=mode==='rehearse'?['destination','source']:[mode==='apply-destination'?'destination':'source'];
 if(mode==='apply-source'){let destination;try{destination=await client(configs.destination,'destination',cas.destination);await connect(destination);requireThat((await destination.query('SELECT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version=$1) AS applied',[COMPLETION_VERSION])).rows[0]?.applied===true,'COMPLETION_DESTINATION_REQUIRED_FIRST');}finally{if(destination)await destination.end();}}
 for(const target of targets){let x;let outcome='not-attempted';let stage='catalog-precondition';try{
  x=await client(configs[target],target,cas[target]);await connect(x);
  requireThat((await x.query("SELECT count(*)=0 AS idle FROM pg_stat_activity WHERE usename=ANY($1::text[])",[[target==='source'?'fmt_audit_worker_dev':'fmt_audit_writer_dev']])).rows[0]?.idle===true,'COMPLETION_EXISTING_WORKER_MUST_STOP');
  const before=(await x.query('SELECT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version=$1) AS applied',[COMPLETION_VERSION])).rows[0]?.applied;
  requireThat(before===false,'COMPLETION_ALREADY_APPLIED_RECONCILE');
  outcome='uncertain';
  stage='reviewed-migration-sql';const result=await x.query(scripts.get(target).replace(/COMMIT;\s*$/,''));
  requireThat(Array.isArray(result)&&result.some(r=>r.rows?.[0]?.completion_version_recorded===true),'COMPLETION_PRECOMMIT_RECEIPT_MISSING');
  if(mode==='rehearse'){
   stage='rollback-contract-probes';const checks=await rollbackContractChecks(x,target);stage='rollback-business-probes';const business=target==='source'?await rollbackBusinessChecks(x):undefined;
   await x.query('ROLLBACK');outcome='rolled-back';emit('completion-rehearsal',{target,outcome,checks,business,committedSyntheticRecords:0});
  }else{requireThat((await x.query('COMMIT')).command==='COMMIT','COMPLETION_COMMIT_UNCERTAIN');outcome='committed';emit('completion-applied',{target,outcome,backupTaken:false,businessTriggers:target==='source'?Object.keys(BUSINESS_TABLES).length:0});}
 }catch(e){if(x)try{if((await x.query('ROLLBACK')).command==='ROLLBACK'&&mode==='rehearse')outcome='rolled-back';}catch{}emit('completion-migration-stopped',{target,stage,outcome,code:safeCode(e),preparedSqlError:stage==='reviewed-migration-sql'?e.message:undefined,automaticRetry:false});throw e;
 }finally{if(x)await x.end();}}
}
async function checkApplied(){
 const{configs,cas}=loadPrivateConfiguration();
 for(const target of ['destination','source']){let x;try{
  x=await client(configs[target],target,cas[target]);await connect(x);
  requireThat((await x.query('SELECT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version=$1) AS applied',[COMPLETION_VERSION])).rows[0]?.applied===true,'COMPLETION_EXTENSION_NOT_APPLIED');
  const expectedBody=fs.readFileSync(path.join(ROOT,'migrations/audit/_completion_v1.sql'),'utf8').match(/AS \$completion\$([\s\S]*?)\$completion\$;/)?.[1];
  requireThat((await x.query("SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')=$1 AS exact FROM pg_proc WHERE oid='audit_contract.parse_event(text,text,text)'::regprocedure",[createHash('sha256').update(expectedBody).digest('hex')])).rows[0]?.exact,'COMPLETION_PARSER_BODY_MISMATCH');
  requireThat((await x.query("SELECT NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname=ANY($1::text[]) AND (pg_has_role(current_user,r.oid,'USAGE') OR pg_has_role(current_user,r.oid,'SET'))) AS inert",[['fm_audit_contract_owner',`fm_audit_${target}_owner`]])).rows[0]?.inert,'COMPLETION_OWNER_NOT_RESTORED');
  if(target==='source')requireThat((await x.query("SELECT count(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.tgname='fmt_audit_record_changed' AND NOT t.tgisinternal AND t.tgenabled='O' AND n.nspname='public' AND c.relname=ANY($1::text[])",[Object.keys(BUSINESS_TABLES)])).rows[0]?.count===Object.keys(BUSINESS_TABLES).length,'COMPLETION_TRIGGER_MANIFEST_MISMATCH');
  emit('completion-installed-verification',{target,parserExact:true,ownersInert:true,businessTriggers:target==='source'?Object.keys(BUSINESS_TABLES).length:0});
 }finally{if(x)await x.end();}}
 return{configs,cas};
}
export async function provisionReader(){
 loadCompletionScripts();const{configs,cas}=await checkApplied(),sid=privatePreflight();
 const original=privateRead('.env',sid),before=selectSettings(original,['AUDIT_READER_DATABASE_URL','AUDIT_READER_USER_IDS','AUDIT_EXPORT_USER_IDS','APP_ADMIN_USER_IDS']);
 requireThat(!before.AUDIT_READER_DATABASE_URL,'READER_HANDOFF_ALREADY_STARTED_RECONCILE');
 const bootstrap=(before.APP_ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
 requireThat(bootstrap.length>0&&bootstrap.every(s=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s)),'READER_BOOTSTRAP_LIST_REJECTED');
 const password=randomBytes(32).toString('base64url');
 const url=roleURL(configs.destination,'destination',READER_ROLE,password,cas.destination.certPath);
 const next=patchPrivateEnvironment(original,{AUDIT_READER_DATABASE_URL:url,AUDIT_READER_USER_IDS:before.AUDIT_READER_USER_IDS??bootstrap.join(','),AUDIT_EXPORT_USER_IDS:before.AUDIT_EXPORT_USER_IDS??bootstrap.join(',')});
 privateWrite('.env',next,sid,{expectedContent:Buffer.from(original)});requireThat(privateRead('.env',sid)===next,'READER_PRIVATE_HANDOFF_READBACK_REJECTED');
 emit('reader-private-handoff',{status:'verified',namedReaders:(before.AUDIT_READER_USER_IDS??bootstrap.join(',')).split(',').filter(Boolean).length,namedExporters:(before.AUDIT_EXPORT_USER_IDS??bootstrap.join(',')).split(',').filter(Boolean).length,credentialValuesPrinted:false,backupTaken:false});
 let x;let committed=false;try{
  x=await client(configs.destination,'destination',cas.destination);await connect(x);await beginPrivateSession(x);
  requireThat((await x.query('SELECT NOT rolcanlogin AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS disabled FROM pg_roles WHERE rolname=$1',[READER_ROLE])).rows[0]?.disabled,'READER_EXPECTED_DISABLED_ROLE_MISSING');
  await x.query("SELECT set_config('audit_setup.reader_credential',$1,true) IS NOT NULL AS bound",[password]);
  await x.query(`DO $credential$ BEGIN EXECUTE format('ALTER ROLE %I PASSWORD %L','${READER_ROLE}',current_setting('audit_setup.reader_credential'));PERFORM set_config('audit_setup.reader_credential','',true);END $credential$;`);
  await x.query(`ALTER ROLE ${READER_ROLE} LOGIN`);await finishPrivateSession(x,true);committed=true;
  emit('reader-private-provisioning',{status:'committed',loginEnabled:true,independentCredential:true});
 }catch(e){if(x){forgetPrivateSession(x);try{await x.query('ROLLBACK');}catch{}}emit('reader-provisioning-stopped',{code:safeCode(e),commitObserved:committed,automaticRetry:false,recovery:'Preserve private credential handoff and reconcile role state; never regenerate blindly.'});throw e;
 }finally{if(x)await x.end();}
 let reader;try{reader=await client(url,'destination',cas.destination,READER_ROLE);await connect(reader);assertReaderCapabilities((await reader.query(READER_CAPABILITY_SQL)).rows);await reader.query('SELECT event_id FROM audit.reader_events ORDER BY occurred_at DESC,event_id DESC LIMIT 1');emit('reader-native-verification',{status:'passed',tlsVerified:true,viewReadable:true,baseAccess:false,permanentDDL:false});}finally{if(reader)await reader.end();}
}
const ROUNDTRIP_EVENT_ID='00000008-0000-4000-8000-000000000008';
const ROUNDTRIP_RUN_ID='00000008-0000-4000-8000-000000000009';
const ROUNDTRIP_CATEGORY='audit-completion-check-0008';
export async function roundtrip(){
 loadCompletionScripts();const{cas}=await checkApplied(),sid=privatePreflight();
 const app=selectSettings(privateRead('.env',sid),['DATABASE_URL','AUDIT_CAPTURE_DATABASE_URL','AUDIT_ENABLED','AUDIT_ENVIRONMENT','AUDIT_AUTH_EVENTS_ENABLED','AUDIT_READER_DATABASE_URL','AUDIT_PRODUCER_CONTRACT']);
 const workerEnvironment=selectSettings(privateRead('.env.audit-worker.local',sid),['AUDIT_ENVIRONMENT','AUDIT_WORKER_ENABLED','AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL']);
 const {createCaptureRuntime,createWorkerRuntime}=await import('../../server/audit/runtime.ts');
 const {createAuditWorker}=await import('../../server/audit/worker.ts');
 const {createAuditContext}=await import('../../server/audit/context.ts');
 const {createAuditEvent}=await import('../../server/audit/events.ts');
 const {createAuditViewerStore}=await import('../../server/audit/viewer-runtime.ts');
 const {parseAuditViewerFilters,buildAuditViewerQuery}=await import('../../server/audit/viewer.ts');
 const {canonicalAuditJson}=await import('../../server/audit/canonical.ts');
 let x,capture,worker,store;let committed=false;
 try{
  worker=await createWorkerRuntime(workerEnvironment);const before=await worker.ports.health(new AbortController().signal);
  requireThat(before.pending<=100&&before.leased===0&&before.quarantined===0,'ROUNDTRIP_PREEXISTING_BACKLOG_REQUIRES_REVIEW');
  emit('roundtrip-initial-health',{health:before});
  x=await client(app.DATABASE_URL,'source',cas.source,'fmt_app_dev');await connect(x);
  requireThat((await x.query('SELECT NOT EXISTS(SELECT 1 FROM public.categories WHERE key=$1) AS absent',[ROUNDTRIP_CATEGORY])).rows[0]?.absent,'ROUNDTRIP_FIXTURE_COLLISION');
  store=createAuditViewerStore(()=>app);
  const existing=await store.query(buildAuditViewerQuery(parseAuditViewerFilters({from:new Date(Date.now()-86400000).toISOString(),operationId:ROUNDTRIP_RUN_ID,limit:25})));
  requireThat(existing.length===0,'ROUNDTRIP_ALREADY_STARTED_RECONCILE');
  await x.query('BEGIN READ WRITE');
  await x.query("INSERT INTO public.categories(key,name,icon,search_keywords) VALUES($1,'Synthetic audit completion verification','','')",[ROUNDTRIP_CATEGORY]);
  await x.query("UPDATE public.categories SET name='Synthetic audit verification updated' WHERE key=$1",[ROUNDTRIP_CATEGORY]);
  await x.query('DELETE FROM public.categories WHERE key=$1',[ROUNDTRIP_CATEGORY]);
  requireThat((await x.query('COMMIT')).command==='COMMIT','ROUNDTRIP_BUSINESS_COMMIT_UNCERTAIN');committed=true;
  capture=await createCaptureRuntime(app);
  const context=createAuditContext({actor:{kind:'user',userId:ROUNDTRIP_RUN_ID,effectiveRole:'support'},scope:{kind:'global'},target:{type:'request'},source:{application:'fitsmytime',environment:'development',component:'audit'},requestId:ROUNDTRIP_RUN_ID,operationId:ROUNDTRIP_RUN_ID});
  const event=createAuditEvent(context,{eventName:'audit.records_viewed.v1',outcome:'succeeded',changes:[]},{now:()=>new Date(),newId:()=>ROUNDTRIP_EVENT_ID});
  await capture.capture(event);await capture.capture(event);
  const runner=createAuditWorker(worker.ports,{batchSize:100,timeoutMs:5000,pollMs:100});
  for(let step=0;step<3;step++){
   await runner.step(new AbortController().signal);
   const health=await runner.health(new AbortController().signal);emit('roundtrip-worker',{step:step+1,metrics:runner.snapshot(),health});
   requireThat(runner.snapshot().sourceFailures===0&&runner.snapshot().destinationFailures===0&&runner.snapshot().quarantined===0,'ROUNDTRIP_WORKER_FAILED_STOP_RECONCILE');
   if(health.pending===0&&health.leased===0)break;
  }
  const filters=parseAuditViewerFilters({from:new Date(Date.now()-86400000).toISOString(),operationId:ROUNDTRIP_RUN_ID,limit:25});
  const viewer=await store.query(buildAuditViewerQuery(filters));
  requireThat(viewer.length===1&&viewer[0].event_id===ROUNDTRIP_EVENT_ID&&canonicalAuditJson(viewer[0].envelope)===event.canonicalJson,'ROUNDTRIP_VIEWER_DELIVERY_MISMATCH');
  const business=await store.query(buildAuditViewerQuery(parseAuditViewerFilters({from:filters.from,targetType:'database_record',targetId:'categories:'+ROUNDTRIP_CATEGORY,limit:25})));
  requireThat(business.length===3&&new Set(business.map(e=>e.envelope.eventName)).size===3&&business.every(e=>e.envelope.changes.every(c=>c.redacted===true&&!('before'in c)&&!('after'in c))),'ROUNDTRIP_BUSINESS_DELIVERY_MISMATCH');
  requireThat((await x.query('SELECT NOT EXISTS(SELECT 1 FROM public.categories WHERE key=$1) AS absent',[ROUNDTRIP_CATEGORY])).rows[0]?.absent,'ROUNDTRIP_BUSINESS_FIXTURE_REMAINED');
  emit('roundtrip-complete',{status:'passed',viewerEvents:1,businessEvents:3,idempotentCapture:true,hashPreserved:true,sourceBusinessFixtureAbsent:true,allPoolsClosedOnExit:true,syntheticRunId:ROUNDTRIP_RUN_ID,syntheticEventId:ROUNDTRIP_EVENT_ID,syntheticCategoryKey:ROUNDTRIP_CATEGORY});
 }catch(e){if(x)try{await x.query('ROLLBACK');}catch{}emit('roundtrip-stopped',{code:safeCode(e),businessCommitObserved:committed,automaticRetry:false,recovery:'Retain synthetic provenance and inspect committed run before any new write.'});throw e;
 }finally{if(x)await x.end();if(capture)await capture.close();if(worker)await worker.close();if(store)await store.close();}
}
export async function activate(){
 await checkApplied();const sid=privatePreflight(),original=privateRead('.env',sid),settings=selectSettings(original,['AUDIT_ENABLED','AUDIT_AUTH_EVENTS_ENABLED','AUDIT_READER_DATABASE_URL','AUDIT_READER_USER_IDS','AUDIT_EXPORT_USER_IDS']);
 requireThat(settings.AUDIT_ENABLED==='true'&&settings.AUDIT_READER_DATABASE_URL&&settings.AUDIT_READER_USER_IDS&&settings.AUDIT_EXPORT_USER_IDS,'COMPLETION_RUNTIME_NOT_READY');
 const next=patchPrivateEnvironment(original,{AUDIT_PRODUCER_CONTRACT:'completion-0008',AUDIT_AUTH_EVENTS_ENABLED:'true'});
 privateWrite('.env',next,sid,{expectedContent:Buffer.from(original)});requireThat(privateRead('.env',sid)===next,'COMPLETION_ACTIVATION_READBACK_REJECTED');
 emit('completion-activation',{status:'passed',producerContract:'completion-0008',authProducerEnabled:true,applicationRestartRequired:true,noBackgroundProcessStarted:true});
}
export async function diagnoseNative(){
 const sid=privatePreflight(),app=selectSettings(privateRead('.env',sid),['AUDIT_CAPTURE_DATABASE_URL','AUDIT_ENABLED','AUDIT_ENVIRONMENT','AUDIT_AUTH_EVENTS_ENABLED','AUDIT_PRODUCER_CONTRACT']);
 const workerEnvironment=selectSettings(privateRead('.env.audit-worker.local',sid),['AUDIT_ENVIRONMENT','AUDIT_WORKER_ENABLED','AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL']);
 let capture,worker;try{
  const{createCaptureRuntime,createWorkerRuntime}=await import('../../server/audit/runtime.ts');
  try{capture=await createCaptureRuntime(app);await capture.ready();emit('native-capture-diagnostic',{ready:true});}catch(e){emit('native-capture-diagnostic',{ready:false,errorClass:e.name});}
  worker=await createWorkerRuntime(workerEnvironment);emit('native-worker-diagnostic',{health:await worker.ports.health(new AbortController().signal),claimsAttempted:false});
 }finally{if(capture)await capture.close();if(worker)await worker.close();}
}
async function main(){
 requireThat(process.argv.length===3,'AUDIT_COMPLETION_MODE_REJECTED');
 if(process.argv[2]==='inspect')return inspect();
 if(['rehearse','apply-destination','apply-source'].includes(process.argv[2]))return migrationMode(process.argv[2]);
 if(process.argv[2]==='verify-installed')return checkApplied();
 if(process.argv[2]==='provision-reader')return provisionReader();
 if(process.argv[2]==='roundtrip')return roundtrip();
 if(process.argv[2]==='activate')return activate();
 if(process.argv[2]==='diagnose-native')return diagnoseNative();
 requireThat(false,'AUDIT_COMPLETION_MODE_REJECTED');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('audit-completion-stopped',{code:safeCode(e),automaticRetry:false});process.exitCode=1;}
}
