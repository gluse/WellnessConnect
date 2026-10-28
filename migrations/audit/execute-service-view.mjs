// Fixed, forward-only service.viewed.v1 extension. Offline/import never access
// private configuration, process inventory or a database. Connected modes need
// this new task's explicit named-target execution approval (TASK-014 is history).
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ROOT,requireThat,safeCode,emit,client,connect,privatePreflight,privateRead,privateWrite,readSettings} from './runtime-support.mjs';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {activeCheckPlan} from './runtime-active-profile.mjs';
import {INSTALL_SQL,installedFunctionContracts,requireBooleans,readonly,deterministicPrecommitError} from './execute-runtime-disabled.mjs';
import {patchPrivateEnvironment} from './private-runtime-plan.mjs';
import {ROLES} from './runtime-contract.mjs';

export const FILES=Object.freeze({destination:'0005_destination_service_view.sql',source:'0005_source_service_view.sql'});
export const MANIFEST=Object.freeze({
 '_service_view_v1.sql':'4eb10c1922b7d27c6acf9c4dfb42578a01f7009932219b5804c68a9adb76f3b8',
 '0005_destination_service_view.sql':'205852b34350eb922b13cf48e9ad6a37a331a3d2651b6cae90e6d82f3c106c5d',
 '0005_source_service_view.sql':'a04a9f5bf9d16768d66b4eec135a5d0789f334acf1fb01c0fec293160fe90a83',
});
const digest=value=>createHash('sha256').update(value).digest('hex');
export function loadScripts(){
 const raw=new Map(Object.entries(MANIFEST).map(([file,pin])=>{
  const bytes=fs.readFileSync(path.join(ROOT,'migrations/audit',file));
  requireThat(digest(bytes)===pin,'SERVICE_VIEW_DIGEST_MISMATCH');return[file,bytes.toString('utf8')];
 }));
 const scripts=new Map();
 for(const[target,file]of Object.entries(FILES)){
  const text=raw.get(file);requireThat((text.match(/^\\ir _service_view_v1.sql$/gm)||[]).length===1,'SERVICE_VIEW_INCLUDE_REJECTED');
  const sql=text.replace(/^\\ir _service_view_v1.sql$/m,()=>raw.get('_service_view_v1.sql'));
  requireThat((sql.match(/^BEGIN;$/gm)||[]).length===1&&(sql.match(/^COMMIT;$/gm)||[]).length===1
   &&!/^\s*\\/m.test(sql)&&sql.includes(`'${target}-service-view-0005'`)
   &&sql.includes('AS service_view_version_recorded;')&&sql.includes('Exact setup owner restoration failed')
   &&!/(?:\b(?:PASSWORD|CREATE\s+(?:TABLE|ROLE|INDEX)|DROP\s+(?:TABLE|FUNCTION)|TRUNCATE)\b|ALTER\s+(?:SYSTEM|DATABASE))/i.test(sql),
   'SERVICE_VIEW_SQL_SCOPE_REJECTED');scripts.set(target,sql);
 }return scripts;
}
export function functionContracts(target,scripts=loadScripts()){
 const contracts=installedFunctionContracts(target).map(c=>({...c}));
 const replacements=[...scripts.get(target).matchAll(/CREATE OR REPLACE FUNCTION ([a-z_]+)\.([a-z_]+)\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)];
 requireThat(replacements.length===2,'SERVICE_VIEW_FUNCTION_COUNT_REJECTED');
 for(const[,schema,name,body]of replacements){
  const item=contracts.find(c=>c.schema===schema&&c.name===name&&c.args==='text, text, text');
  requireThat(item,'SERVICE_VIEW_UNEXPECTED_FUNCTION');item.body_hash=digest(body);
 }return contracts;
}
const EXPIRY_OLD="CHECKexpires_at=occurred_at+'8760:00:00'";
const CLASS_OLD="CHECKenvelope->>'retentionClass'=ANYARRAY['B','S']ISTRUE";
export const RETENTION_NEW="CHECKCASEWHENenvelope->>'eventName'='service.viewed.v1'THENenvelope->>'retentionClass'='R'ANDexpires_at=occurred_at+'2160:00:00'ELSEenvelope->>'retentionClass'=ANYARRAY['B','S']ANDexpires_at=occurred_at+'8760:00:00'ENDISTRUE";
export const SQL=Object.freeze({
 retention:`WITH checks AS(SELECT q.conname,q.convalidated,
 ARRAY(SELECT unnest(q.conkey) ORDER BY 1) AS keys,
 regexp_replace(replace(replace(pg_get_constraintdef(q.oid,false),'::text',''),'::interval',''),'[[:space:]()]','','g') AS definition
 FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname=$1 AND c.relname=$2 AND q.contype='c') SELECT
 CASE WHEN $3::boolean THEN
  (SELECT count(*) FROM checks WHERE conname='service_view_retention_v1' AND convalidated AND definition=$4)=1
  AND (SELECT count(*) FROM checks WHERE keys=ARRAY[3]::smallint[] OR keys=ARRAY[6,7]::smallint[] OR keys=ARRAY[3,6,7]::smallint[])=1
 ELSE (SELECT count(*) FROM checks WHERE convalidated AND keys=ARRAY[6,7]::smallint[] AND definition=$5)=1
  AND (SELECT count(*) FROM checks WHERE convalidated AND keys=ARRAY[3]::smallint[] AND definition=$6)=1
  AND (SELECT count(*) FROM checks WHERE keys=ARRAY[3]::smallint[] OR keys=ARRAY[6,7]::smallint[] OR keys=ARRAY[3,6,7]::smallint[])=2
  AND NOT EXISTS(SELECT 1 FROM checks WHERE conname='service_view_retention_v1') END AS exact_retention_contract`,
 owners:`SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])
 AND (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
 OR pg_has_role(current_user,r.oid,'USAGE') OR pg_has_role(current_user,r.oid,'SET')
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)))
 AND (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]))=2
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=ANY(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]))
 AND NOT(m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option))
 AS inert_restricted_owners`,
 metadata:`SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'oid',p.oid,'owner',p.proowner,'acl',p.proacl)
 ORDER BY n.nspname,p.proname),'[]'::jsonb) AS value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='audit_contract' AND p.proname='parse_event' OR n.nspname=$1 AND p.proname=$2)
 AND oidvectortypes(p.proargtypes)='text, text, text'`,
 memberships:`SELECT m.roleid,m.member,m.grantor,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m
 WHERE m.roleid=ANY(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])) AND m.member=current_user::regrole ORDER BY m.roleid,m.grantor`,
 workerConnections:`SELECT count(*)=0 AS no_worker_connections FROM pg_catalog.pg_stat_activity WHERE usename=$1`,
});
const storage=target=>target==='source'?['audit_capture','audit_outbox','enqueue']:['audit','events','accept'];
const owners=target=>['fm_audit_contract_owner',`fm_audit_${target}_owner`];
export async function verifyProfile(x,target,{extended=false,scripts=loadScripts()}={}){
 requireThat(['source','destination'].includes(target),'SERVICE_VIEW_TARGET_REJECTED');
 return readonly(x,async()=>{
  await x.query("SET LOCAL intervalstyle='postgres'");
  const checks={};for(const[key,sql,args]of activeCheckPlan(target,{testAccess:'disabled'})){
   const params=key==='originalFunctions'&&extended?[JSON.stringify(functionContracts(target,scripts))]:args;
   checks[key]=requireBooleans(await x.query(sql,params),'SERVICE_VIEW_PROFILE_REJECTED');
  }
  checks.owners=requireBooleans(await x.query(SQL.owners,[owners(target)]),'SERVICE_VIEW_OWNER_REJECTED');
  const[schema,table,entry]=storage(target);
  checks.retention=requireBooleans(await x.query(SQL.retention,[schema,table,extended,RETENTION_NEW,EXPIRY_OLD,CLASS_OLD]),'SERVICE_VIEW_RETENTION_REJECTED');
  const metadata=(await x.query(SQL.metadata,[schema,entry])).rows[0]?.value;
  const memberships=(await x.query(SQL.memberships,[owners(target)])).rows;
  requireThat(Array.isArray(metadata)&&metadata.length===2,'SERVICE_VIEW_METADATA_REJECTED');
  return{checks,metadata,memberships};
 });
}
export function checkCommit(result){
 const items=Array.isArray(result)?result:[result];requireThat(items.at(-1)?.command==='COMMIT','SERVICE_VIEW_COMMIT_UNCERTAIN');
 const receipts=items.filter(r=>r.fields?.length===1&&r.fields[0].name==='service_view_version_recorded');
 requireThat(receipts.length===1&&receipts[0].rows.length===1&&receipts[0].rows[0].service_view_version_recorded===true,'SERVICE_VIEW_RECEIPT_REJECTED');
}
export async function applyExtension({configs,cas,scripts=loadScripts(),continueSource=false,makeClient=client,open=connect,verify=verifyProfile,onEvent=()=>{}}){
 const xs={},before={},commits={destination:continueSource?'previously-committed':'not-attempted',source:'not-attempted'};let target,stage='preflight';
 try{
  for(target of ['destination','source']){
   xs[target]=await makeClient(configs[target],target,cas[target]);await open(xs[target]);
   before[target]=await verify(xs[target],target,{extended:continueSource&&target==='destination',scripts});
   onEvent({stage,target,status:'passed'});
  }
  for(target of continueSource?['source']:['destination','source']){
   stage='migration';commits[target]='uncertain';
   try{const result=await xs[target].query({text:scripts.get(target),query_timeout:180000});
    if((Array.isArray(result)?result:[result]).at(-1)?.command==='COMMIT')commits[target]='committed';checkCommit(result);
   }catch(e){if(commits[target]!=='committed')try{await xs[target].query('ROLLBACK');if(deterministicPrecommitError(e))commits[target]='rolled-back';}catch{}throw e;}
   stage='verification';const after=await verify(xs[target],target,{extended:true,scripts});
   requireThat(JSON.stringify(after.metadata)===JSON.stringify(before[target].metadata),'SERVICE_VIEW_FUNCTION_OWNER_OR_ACL_CHANGED');
   requireThat(JSON.stringify(after.memberships)===JSON.stringify(before[target].memberships),'SERVICE_VIEW_OWNER_MEMBERSHIP_CHANGED');
   onEvent({stage,target,status:'verified',version:`${target}-service-view-0005`,file:FILES[target],sha256:MANIFEST[FILES[target]],commits:{...commits}});
  }return{commits};
 }catch(e){onEvent({stage,target,status:'stopped',code:safeCode(e),
  ...(/^\d{1,8}$/.test(e?.position??'')?{sqlPosition:Number(e.position)}:{}),
  ...(/^\d{1,8}$/.test(e?.internalPosition??'')?{internalPosition:Number(e.internalPosition)}:{}),
  commits:{...commits},automaticRetry:false});throw e;}
 finally{for(const x of Object.values(xs))try{await x.end();}catch{}}
}
function selected(text,names){return readSettings(text.split(/\r?\n/).filter(line=>names.some(name=>new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line))).join('\n'));}
function requireProducerOff(sid){
 const env=selected(privateRead('.env',sid),['AUDIT_SERVICE_VIEWS_ENABLED']);
 requireThat(env.AUDIT_SERVICE_VIEWS_ENABLED===undefined||env.AUDIT_SERVICE_VIEWS_ENABLED==='false','SERVICE_VIEW_PRODUCER_MUST_BE_OFF');
}
export function requireNoLocalWorker(){
 requireThat(process.platform==='win32','SERVICE_VIEW_WINDOWS_WORKER_CHECK_REQUIRED');
 const script="$ErrorActionPreference='Stop'; Import-Module (Join-Path $PSHOME 'Modules/CimCmdlets/CimCmdlets.psd1') -ErrorAction Stop; $items=@(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -and ($_.CommandLine.Replace('\\','/') -match '(?i)(?:server/audit/run-worker\\.ts|scripts/rehearse-audit-db\\.mjs|audit:worker)') }); if($items.Count -eq 0){[Console]::Write('absent')}else{[Console]::Write('present')};";
 const out=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
 requireThat(out.status===0&&out.stdout==='absent','EXISTING_WORKER_MUST_BE_STOPPED');
}
async function rollbackProbe(x,target,work){
 const owner=`fm_audit_${target}_owner`;
 const before=(await x.query(SQL.memberships,[owners(target)])).rows;
 try{
  await x.query('BEGIN');await x.query('SET TRANSACTION READ WRITE');
  await x.query(`GRANT ${owner} TO CURRENT_USER WITH INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER`);
  await x.query(`SET LOCAL ROLE ${owner}`);await work(x);
 }finally{
  requireThat((await x.query('ROLLBACK')).command==='ROLLBACK','SERVICE_VIEW_PROBE_ROLLBACK_UNCERTAIN');
  requireThat(JSON.stringify((await x.query(SQL.memberships,[owners(target)])).rows)===JSON.stringify(before),'SERVICE_VIEW_PROBE_OWNER_CHANGED');
 }
}
export async function rollbackAcceptance(x,target){
 const {createAuditContext}=await import('../../server/audit/context.ts');
 const {createAuditEvent}=await import('../../server/audit/events.ts');
 const {canonicalAuditJson,auditPayloadHash}=await import('../../server/audit/canonical.ts');
 const {fixtureEnvelope}=await import('./runtime-contract.mjs');
 const id='a0160001-0000-4000-8000-000000000001',oldId='a0160001-0000-4000-8000-000000000002';
 const context=createAuditContext({actor:{kind:'anonymous'},scope:{kind:'unknown'},target:{type:'service',id:'2147483647'},
  source:{application:'fitsmytime',environment:'development',component:'service'},requestId:id,operationId:id});
 const event=createAuditEvent(context,{eventName:'service.viewed.v1',outcome:'succeeded',changes:[]},{now:()=>new Date(),newId:()=>id});
 const old={...fixtureEnvelope(0,new Date(Date.now()-91*86400000).toISOString()),eventId:oldId,requestId:oldId,operationId:oldId};
 const[schema,table,entry]=storage(target);const args=e=>{const json=canonicalAuditJson(e);return[json,auditPayloadHash(json),'sha256-sorted-json-v1'];};
 await rollbackProbe(x,target,async tx=>{
  requireThat((await tx.query(`SELECT NOT EXISTS(SELECT 1 FROM ${schema}.${table} WHERE event_id=ANY($1::uuid[])) AS ok`,[[id,oldId]])).rows[0]?.ok===true,'SERVICE_VIEW_FIXTURE_ID_COLLISION');
  for(const envelope of [event.envelope,old]){
   const answer=(await tx.query(`SELECT ${schema}.${entry}($1,$2,$3) AS value`,args(envelope))).rows[0]?.value;
   requireThat(target==='source'?answer===envelope.eventId:answer==='inserted','SERVICE_VIEW_VALID_EVENT_REJECTED');
   const days=envelope.retentionClass==='R'?90:365;
   requireThat((await tx.query(`SELECT expires_at=occurred_at+($2::integer*interval '24 hours') AS ok FROM ${schema}.${table} WHERE event_id=$1`,[envelope.eventId,days])).rows[0]?.ok===true,'SERVICE_VIEW_EXPIRY_CHANGED');
  }
  for(const effectiveRole of ['seeker','provider'])await tx.query('SELECT audit_contract.parse_event($1,$2,$3)',
   args({...event.envelope,actor:{kind:'user',userId:id,effectiveRole}}));
  const expired={...event.envelope,occurredAt:new Date(Date.now()-91*86400000).toISOString()};
  await tx.query('SAVEPOINT expired');let rejected=false;
  try{const value=(await tx.query(`SELECT ${schema}.${entry}($1,$2,$3) AS value`,args(expired))).rows[0]?.value;
   requireThat(target==='destination'&&value==='expired','SERVICE_VIEW_EXPIRED_ACCEPTED');rejected=true;
  }catch(e){requireThat(target==='source'&&e.code==='22023','SERVICE_VIEW_EXPIRY_PROBE_ERROR');rejected=true;}
  await tx.query('ROLLBACK TO SAVEPOINT expired');requireThat(rejected,'SERVICE_VIEW_EXPIRED_ACCEPTED');
  for(const patch of [{target:{type:'service',id:'0'}},{target:{type:'service',id:'2147483648'}},{retentionClass:'S'},
   {reasonCode:'NO_CHANGE'},{changes:[{field:'anything',before:false,after:true}]},{actor:{kind:'user',userId:id,effectiveRole:'admin'}},
   {scope:{kind:'personal',workspaceId:id}},{outcome:'failed',reasonCode:'LOCAL_FAILURE'}]){
   await tx.query('SAVEPOINT invalid');let denied=false;
   try{await tx.query('SELECT audit_contract.parse_event($1,$2,$3)',args({...event.envelope,...patch}));}
   catch(e){requireThat(e.code==='22023','SERVICE_VIEW_INVALID_PROBE_ERROR');denied=true;}
   await tx.query('ROLLBACK TO SAVEPOINT invalid');requireThat(denied,'SERVICE_VIEW_INVALID_CONTRACT_ACCEPTED');
  }
 });
 return{r90:true,legacy365:true,expiredRefused:true,invalidVariants:8,allRolledBack:true,committedSyntheticEvents:0};
}
export async function workerHealthOnly(environment,open){
 const runtime=await (open??(await import('../../server/audit/runtime.ts')).createWorkerRuntime)(environment);
 try{
  const health=await runtime.ports.health(new AbortController().signal);
  requireThat(['pending','leased','quarantined','expired'].every(k=>health[k]===0),'SERVICE_VIEW_WORKER_NOT_IDLE_HEALTHY');
  return health;
 }finally{await runtime.close();}
}
async function activate({configs,cas,scripts,sid}){
 requireNoLocalWorker();const xs={};let stage='activation-profile';
 try{
  for(const target of ['destination','source']){
   xs[target]=await client(configs[target],target,cas[target]);await connect(xs[target]);await verifyProfile(xs[target],target,{extended:true,scripts});
   requireBooleans(await xs[target].query(SQL.workerConnections,[target==='source'?ROLES.worker:ROLES.writer]),'EXISTING_WORKER_CONNECTIONS');
   stage='rollback-only-r90-acceptance';emit(stage,{target,status:'passed',...await rollbackAcceptance(xs[target],target)});
  }
  stage='updated-worker-readiness';
  const appBefore=privateRead('.env',sid),worker=selected(privateRead('.env.audit-worker.local',sid),['AUDIT_ENVIRONMENT','AUDIT_WORKER_ENABLED','AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL']);
  const app=selected(appBefore,['AUDIT_ENABLED','AUDIT_AUTH_EVENTS_ENABLED','AUDIT_ENVIRONMENT','AUDIT_SERVICE_VIEWS_ENABLED']);
  requireThat(app.AUDIT_ENABLED==='true'&&app.AUDIT_AUTH_EVENTS_ENABLED==='false'&&app.AUDIT_ENVIRONMENT==='development'
   &&worker.AUDIT_WORKER_ENABLED==='true'&&worker.AUDIT_ENVIRONMENT==='development','SERVICE_VIEW_ACTIVE_FLAGS_REJECTED');
  const health=await workerHealthOnly({...worker,AUDIT_AUTH_EVENTS_ENABLED:'false'});
  emit(stage,{status:'healthy',health,healthOnly:true,claimsAttempted:false});
  requireNoLocalWorker();
  stage='activate-service-view-flag';const after=patchPrivateEnvironment(appBefore,{AUDIT_SERVICE_VIEWS_ENABLED:'true'});
  privateWrite('.env',after,sid,{expectedContent:Buffer.from(appBefore)});
  requireThat(privateRead('.env',sid)===after,'SERVICE_VIEW_FLAG_READBACK_REJECTED');
  emit(stage,{status:'passed',producerEnabled:true,backgroundProcess:false,httpServerStarted:false,committedSyntheticEvents:0});
 }catch(e){emit('service-view-activation-stopped',{stage,code:safeCode(e),automaticRetry:false});throw e;}
 finally{for(const x of Object.values(xs))try{await x.end();}catch{}}
}
async function main(){
 const mode=process.argv[2];requireThat(process.argv.length===3&&['offline','apply','continue-source','verify','activate'].includes(mode),'SERVICE_VIEW_MODE_REJECTED');
 const scripts=loadScripts();for(const target of ['source','destination'])functionContracts(target,scripts);
 if(mode==='offline'){emit('service-view-offline',{status:'passed',manifest:MANIFEST,privateAccess:false,databaseAccess:false});return;}
 const sid=privatePreflight();if(mode!=='verify')requireProducerOff(sid);
 const {configs,cas}=loadPrivateConfiguration();
 if(mode==='apply'||mode==='continue-source')await applyExtension({configs,cas,scripts,continueSource:mode==='continue-source',onEvent:e=>emit('service-view-extension',e)});
 else if(mode==='activate')await activate({configs,cas,scripts,sid});
 else for(const target of ['destination','source']){let x;try{x=await client(configs[target],target,cas[target]);await connect(x);await verifyProfile(x,target,{extended:true,scripts});emit('service-view-verified',{target,status:'passed'});}finally{if(x)await x.end();}}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('service-view-stopped',{code:safeCode(e),automaticRetry:false});process.exitCode=1;}
}
