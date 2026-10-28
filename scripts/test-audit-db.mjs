// Offline contract/catalog-preflight rehearsal. No connected test mode yet.
// Never load dotenv, application startup, Express, Supabase or any private file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixtureEnvelope,EVENT_IDS,RUN_ID,SCENARIOS,APP_TABLES,TARGETS,ROLES,assertCohort} from '../migrations/audit/runtime-contract.mjs';
import {ROOT,readSettings,connection,replaceSettings,safeCode} from '../migrations/audit/runtime-support.mjs';
import {MANIFEST,loadManifest,repositoryCompatibility,booleanSnapshot,inspectMetadata,inspectPair,METADATA_SQL} from '../migrations/audit/execute-runtime-setup.mjs';
import {parseAuditEnvelope} from '../server/audit/events.ts';
import {canonicalAuditJson,auditPayloadHash,AUDIT_HASH_VERSION} from '../server/audit/canonical.ts';

// No accidental "live" fallthrough. Refuse before any private/environment I/O.
if(process.argv.length!==3||process.argv[2]!=='offline'){
 process.stdout.write(JSON.stringify({stage:'stopped',code:'MODE_REJECTED'})+'\n');process.exit(1);
}

let checks=0;
function check(work){work();checks++;}
const sql=loadManifest();
check(()=>assert.equal(sql.size,4));
check(()=>assert.equal(new Set(EVENT_IDS).size,12));
check(()=>assert.equal(SCENARIOS.length,EVENT_IDS.length));
for(let i=0;i<EVENT_IDS.length;i++){
 const e=fixtureEnvelope(i);
 check(()=>assert.deepEqual(parseAuditEnvelope(e),e));
 const canonical=canonicalAuditJson(e),hash=auditPayloadHash(canonical);
 check(()=>assert.match(hash,/^[a-f0-9]{64}$/));
 check(()=>assert.equal(e.operationId,RUN_ID));
 check(()=>assert.equal(e.eventId,EVENT_IDS[i]));
 check(()=>assert.equal(e.actor.kind,'anonymous'));
 check(()=>assert.equal(e.scope.kind,'unknown'));
 check(()=>assert.deepEqual(e.changes,[]));
 check(()=>assert.equal(AUDIT_HASH_VERSION,'sha256-sorted-json-v1'));
}
for(const bad of [
 {...fixtureEnvelope(0),password:'CANARY_NEVER_REPORT'},
 {...fixtureEnvelope(0),reasonCode:'CANARY_NEVER_REPORT'},
 {...fixtureEnvelope(0),changes:[{field:'password',before:'CANARY_NEVER_REPORT'}]},
 {...fixtureEnvelope(0),eventId:'not-a-uuid'},
 {...fixtureEnvelope(0),source:{...fixtureEnvelope(0).source,environment:'CANARY INVALID ENVIRONMENT'}},
])check(()=>assert.throws(()=>parseAuditEnvelope(bad)));
check(()=>assert.throws(()=>canonicalAuditJson('x'.repeat(32769))));
check(()=>assert.throws(()=>fixtureEnvelope(12)));
check(()=>assertCohort(EVENT_IDS.map(event_id=>({event_id}))));
check(()=>assert.throws(()=>assertCohort([{event_id:'11111111-1111-4111-8111-111111111111'}])));

for(const [file,text]of sql){
 check(()=>assert.match(text,/SET LOCAL idle_in_transaction_session_timeout='60s'/));
 check(()=>assert.doesNotMatch(text,/\b(?:PASSWORD\s+'|BYPASSRLS\s*;|TRUNCATE\s+TABLE|DELETE\s+FROM\s+(?:public|audit)\.)/i));
 if(file.includes('rehearsal')){
  check(()=>assert.match(text,/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit_rehearsal FROM PUBLIC/));
  check(()=>assert.match(text,/CREATE FUNCTION audit_rehearsal\.record\(id uuid,ok boolean\)/));
  check(()=>assert.match(text,/CHECK\(\(completed_at IS NULL\)=\(passed IS NULL\)\)/));
  for(const name of SCENARIOS)check(()=>assert.ok(text.includes(`'${name}'`)));
  const definerCount=(text.match(/SECURITY DEFINER/g)||[]).length;
  check(()=>assert.ok(definerCount>=4));
  check(()=>assert.equal((text.match(/SECURITY DEFINER SET search_path=pg_catalog,pg_temp/g)||[]).length,definerCount));
  check(()=>assert.doesNotMatch(text,/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+(?:TABLE\s+)?(?:audit\.|audit_capture\.)/i));
 }else{
  check(()=>assert.match(text,/NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/));
  check(()=>assert.match(text,/server_version_num'\)::integer\/10000<>17/));
 }
}

// URL/config boundary: synthetic credentials only, including control characters
// the WHATWG URL parser would otherwise normalize before principal checks.
for(const [target,role]of [['source',ROLES.capture],['destination',ROLES.writer]]){
 const base=`postgresql://${role}:synthetic@db.${TARGETS[target]}.supabase.co/postgres`;
 check(()=>assert.equal(connection(base,target,role).principal,role));
 check(()=>assert.equal(connection(`postgresql://${role}.${TARGETS[target]}:synthetic@fixture.pooler.supabase.com:5432/postgres`,target,role).principal,role));
 for(const bad of [base.replace('synthetic','syn\tthetic'),base.replace('synthetic','syn%09thetic'),
  base.replace('/postgres','/other'),base+'?sslmode=disable',base+'?host=elsewhere.invalid',
  base+'?sslmode=verify-full&sslmode=require',base.replace(role,'postgres')])
  check(()=>assert.throws(()=>connection(bad,target,role)));
}
check(()=>assert.throws(()=>readSettings('X=a\nX=b')));
check(()=>assert.throws(()=>readSettings('X=a # comment')));
check(()=>assert.throws(()=>readSettings('X="x\\nCANARY_NEVER_REPORT"')));
// Editing helper preserves unrelated bytes and intentionally literal escapes.
const original='# unchanged\r\nSECRET="synthetic\\\\path"\r\nOTHER=value\r\n';
const edited=replaceSettings(original,{X:'synthetic\\path'});
check(()=>assert.ok(edited.startsWith(original)));
check(()=>assert.equal(readSettings(edited).X,'synthetic\\path'));
check(()=>assert.equal(repositoryCompatibility(APP_TABLES.map(t=>`pgTable("${t}", {})`).join('\n')).matches,true));
check(()=>assert.equal(repositoryCompatibility('pgTable("user_search_locations", {})').unexpectedCount,1));
check(()=>assert.throws(()=>booleanSnapshot({rows:[{ok:null}]})));
check(()=>assert.throws(()=>booleanSnapshot({rows:[]})));
check(()=>assert.equal(safeCode(new Error('CANARY_NEVER_REPORT')),'UNCLASSIFIED_FAILURE'));

// Meaningful driver-control checks use a scripted catalog adapter, not a fake
// PostgreSQL engine. They prove read-only boundaries and rollback-on-failure;
// they do not prove SQL syntax, permissions, queue semantics or database state.
for(const target of ['source','destination']){
 const observed=[];
 const adapter={async query(text,values){
  observed.push({text,values});
  if(text===METADATA_SQL.identity)return {rows:[{no_set_role:true,setup_principal:true,version_17:true,utf8:true}]};
  return {rows:[{observed:true}]};
 }};
 const result=await inspectMetadata(adapter,target);
 check(()=>assert.deepEqual(Object.keys(result),['identity','rights','schema','logging','runtime']));
 check(()=>assert.equal(observed[0].text,'BEGIN READ ONLY'));
 check(()=>assert.equal(observed.at(-1).text,'ROLLBACK'));
 check(()=>assert.equal(observed.filter(c=>Object.values(METADATA_SQL).includes(c.text)).length,5));
 check(()=>assert.doesNotMatch(observed.map(c=>c.text.replace(/'(?:[^']|'')*'/g,"''")).join('\n'),
  /\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE)\b|SET\s+(?:LOCAL\s+)?ROLE/i));
 check(()=>assert.doesNotMatch(observed.map(c=>c.text).join('\n'),/\bFROM\s+(?:audit|audit_capture|public)\./i));
 for(const failure of ['bad-shape','identity','catalog']){
  const calls=[];
  const failing={async query(text){
   calls.push(text);
   if(text===METADATA_SQL.identity){
    if(failure==='bad-shape')return {rows:[{no_set_role:null}]};
    return {rows:[{no_set_role:failure!=='identity',setup_principal:true,version_17:true,utf8:true}]};
   }
   if(text===METADATA_SQL.publicRights)throw new Error('CANARY_NEVER_REPORT');
   return {rows:[]};
  }};
  await assert.rejects(()=>inspectMetadata(failing,target));checks++;
  check(()=>assert.equal(calls.at(-1),'ROLLBACK'));
 }
}
for(const failure of ['none','open-source','inspect-source','output-destination']){
 const created=[],closed=[],reported=[];
 const work=()=>inspectPair({source:'synthetic',destination:'synthetic'},{},async target=>{
  if(failure==='output-destination')throw new Error('CANARY_NEVER_REPORT');reported.push(target);
 },{makeClient:async(_,target)=>{created.push(target);return{target,end:async()=>{closed.push(target);}};},
 open:async x=>{if(failure===`open-${x.target}`)throw new Error('CANARY_NEVER_REPORT');},
 inspect:async x=>{if(failure===`inspect-${x.target}`)throw new Error('CANARY_NEVER_REPORT');return{};}});
 if(failure==='none')await work();else await assert.rejects(work);
 checks++;
 check(()=>assert.deepEqual(closed,created));
 check(()=>assert.deepEqual(created,failure==='output-destination'?['destination']:['destination','source']));
 if(failure==='none')check(()=>assert.deepEqual(reported,['destination','source']));
}
// Unsupported CLI modes must terminate before private-file/connection handling;
// only a safe fixed error code is emitted, with no stack or error detail.
for(const mode of ['apply','provision','rehearsal','--env-file=.env']){
 const child=spawnSync(process.execPath,['migrations/audit/execute-runtime-setup.mjs',mode],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
 check(()=>assert.equal(child.status,1));
 check(()=>assert.equal(child.stderr,''));
 check(()=>assert.deepEqual(JSON.parse(child.stdout),{stage:'stopped',code:'MODE_REJECTED'}));
}
const guardedImport=`
 const fs=await import('node:fs');
 const net=await import('node:net');
 const original=fs.default.readFileSync;
 let privateReads=0,sockets=0;
 fs.default.readFileSync=function(file,...args){
  if(/(?:^|[\\\\/])\\.env(?:\\.|$)/.test(String(file))){privateReads++;throw new Error('PRIVATE_READ');}
  return original.call(this,file,...args);
 };
 net.Socket.prototype.connect=function(){sockets++;throw new Error('SOCKET_OPEN');};
 await import('./migrations/audit/execute-runtime-setup.mjs');
 process.stdout.write(JSON.stringify({privateReads,sockets}));`;
const imported=spawnSync(process.execPath,['--input-type=module','--eval',guardedImport],
 {cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(imported.status,0));
check(()=>assert.equal(imported.stderr,''));
check(()=>assert.deepEqual(JSON.parse(imported.stdout),{privateReads:0,sockets:0}));
const startupGuard=`
 import assert from 'node:assert/strict';
 import net from 'node:net';
 import {client,DIAGNOSTIC_OPTIONS} from './migrations/audit/runtime-support.mjs';
 net.Socket.prototype.connect=function(){throw new Error('UNEXPECTED_SOCKET');};
 process.env.PGOPTIONS='CANARY_UNEXPECTED_OPTIONS';process.env.PGREPLICATION='database';
 process.env.PGSSLNEGOTIATION='direct';process.env.PGSSLMODE='no-verify';delete process.env.PGBINARY;
 const x=await client('postgresql://postgres:synthetic@db.${TARGETS.source}.supabase.co/postgres','source',{pem:'synthetic-public-ca'});
 const p=x.connectionParameters;
 assert.equal(p.options,DIAGNOSTIC_OPTIONS);assert.equal(p.replication,'false');
 assert.equal(p.sslnegotiation,'postgres');assert.equal(p.ssl.rejectUnauthorized,true);
 assert.equal(p.ssl.servername,'db.${TARGETS.source}.supabase.co');
 process.env.PGBINARY='CANARY';
 await assert.rejects(()=>client('postgresql://postgres:synthetic@db.${TARGETS.source}.supabase.co/postgres','source',{pem:'synthetic-public-ca'}));
 process.stdout.write('passed');`;
const startup=spawnSync(process.execPath,['--input-type=module','--eval',startupGuard],
 {cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(startup.status,0));
check(()=>assert.equal(startup.stderr,''));
check(()=>assert.equal(startup.stdout,'passed'));
if(process.platform==='win32'){
 const aclVerifier=fs.readFileSync(path.join(ROOT,'migrations/audit/protect-private-file.ps1'),'utf8');
 check(()=>assert.ok(aclVerifier.includes("Import-Module -Name (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop")));
 // Reproduce Node -> Windows PowerShell module resolution without reading any
 // private file or invoking Get-Acl against a real target.
 const code="$ErrorActionPreference='Stop';Import-Module -Name (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop;[pscustomobject]@{getAclAvailable=[bool](Get-Command Get-Acl -ErrorAction SilentlyContinue)}|ConvertTo-Json -Compress";
 const moduleProbe=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
 check(()=>assert.equal(moduleProbe.status,0));
 check(()=>assert.equal(moduleProbe.stderr,''));
 check(()=>assert.deepEqual(JSON.parse(moduleProbe.stdout),{getAclAvailable:true}));
}
const repository=repositoryCompatibility(fs.readFileSync(path.join(ROOT,'shared/schema.ts'),'utf8'));
process.stdout.write(JSON.stringify({stage:'offline-db-rehearsal',status:'passed',checks,runId:RUN_ID,
 manifestFiles:Object.keys(MANIFEST),repository,privateFileAccess:false,databaseAccess:false,sqlExecuted:false,
 coverage:'contract, fixed SQL boundaries, metadata-driver control, endpoint/mode guards',
 deferred:['connected rollback','real claim concurrency/lease expiry','committed duplicate/conflict/outage catchup',
  'retention maintenance','private credential provisioning/cutover','temporary probe cleanup']})+'\n');
