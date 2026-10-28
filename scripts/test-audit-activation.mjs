// Pure policy + injected pool, then a guarded import with synthetic env only.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assertAuditActivation,auditApplicationConnection,AUDIT_PROJECTS} from '../server/audit/config.ts';
import {assertAuditApplicationRole,verifyAuditApplicationPool} from '../server/audit/application.ts';
import {createCaptureRuntime,createWorkerRuntime} from '../server/audit/runtime.ts';
import {AuditCaptureUnavailable} from '../server/audit/capture.ts';
const url=`postgresql://fmt_app_dev:synthetic@db.${AUDIT_PROJECTS.source}.supabase.co/postgres?sslmode=require`;
const env={AUDIT_ENABLED:'true',AUDIT_ENVIRONMENT:'development',DATABASE_URL:url,AUDIT_AUTH_EVENTS_ENABLED:'false'};
assert.equal(auditApplicationConnection(url).user,'fmt_app_dev');
assert.equal(auditApplicationConnection(url.replace(`db.${AUDIT_PROJECTS.source}.supabase.co`,'aws-0-eu.pooler.supabase.com').replace('fmt_app_dev:',`fmt_app_dev.${AUDIT_PROJECTS.source}:`)).user,`fmt_app_dev.${AUDIT_PROJECTS.source}`);
for(const invalid of [url.replace('fmt_app_dev','postgres'),url.replace(AUDIT_PROJECTS.source,AUDIT_PROJECTS.destination),url+'&options=unsafe',url+'&sslmode=disable',url+'\n',url.replace('/postgres','/other')]) assert.throws(()=>auditApplicationConnection(invalid));
assertAuditActivation(env);assertAuditActivation({});
for(const patch of [{AUDIT_AUTH_EVENTS_ENABLED:'true'},{AUDIT_AUTH_EVENTS_ENABLED:'FALSE'},{AUDIT_ENABLED:'1'},
 {AUDIT_WORKER_ENABLED:'yes'},{AUDIT_SERVICE_VIEWS_ENABLED:'yes'},{AUDIT_ENVIRONMENT:'production'},{AUDIT_ENVIRONMENT:undefined},{PGBINARY:'1'}]) assert.throws(()=>assertAuditActivation({...env,...patch}));
for(const factory of [createCaptureRuntime,createWorkerRuntime]) await assert.rejects(()=>factory({...env,AUDIT_WORKER_ENABLED:'true',AUDIT_AUTH_EVENTS_ENABLED:'true'}),/Invalid audit runtime configuration/);
const row={principal:'fmt_app_dev',rolcanlogin:true,rolinherit:true,rolconnlimit:5,app_member:true,capture_member:true,may_enqueue:true,
 rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,extra_role:false,membership_admin:false,
 owns_objects:false,permanent_ddl:false,audit_base_access:false};
assertAuditApplicationRole([row]);
for(const key of Object.keys(row)) for(const bad of [null,undefined,key==='principal'?'postgres':key==='rolconnlimit'?100:!row[key]])
 assert.throws(()=>assertAuditApplicationRole([{...row,[key]:bad}]),AuditCaptureUnavailable);
assert.throws(()=>assertAuditApplicationRole([]),AuditCaptureUnavailable);
for(const kind of ['valid','owner','TLS','query','connect','disabled','ambient-owner']) {
 let connects=0,queries=0,releases=[];
 const pool={async connect(){connects++;if(kind==='connect')throw Error('CANARY_credentials');return{
  connection:{stream:{encrypted:kind!=='TLS',authorized:true}},
  async query(){queries++;if(kind==='query')throw Error('CANARY_credentials');return{rows:[kind==='owner'?{...row,principal:'postgres'}:row]};},
  release(destroy){releases.push(destroy);}};}};
 const input=kind==='disabled'?{AUDIT_ENABLED:'false'}:kind==='ambient-owner'?{...env,DATABASE_URL:url.replace('fmt_app_dev','postgres')}:env;
 if(['valid','disabled'].includes(kind))await verifyAuditApplicationPool(pool,input);
 else await assert.rejects(()=>verifyAuditApplicationPool(pool,input),error=>!error.message.includes('CANARY'));
 assert.equal(connects,['disabled','ambient-owner'].includes(kind)?0:1);
 assert.equal(queries,['valid','owner','query'].includes(kind)?1:0);
 assert.deepEqual(releases,['disabled','ambient-owner','connect'].includes(kind)?[]:[kind!=='valid']);
}
const absent=fileURLToPath(new URL('../.audit-unit-no-env',import.meta.url));assert.equal(existsSync(absent),false);
// Import actual pool composition with a stale owner ambient URL; guard sockets
// and redirect dotenv so this proves refusal without private reads/network.
const child=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',`
 import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
 net.Socket.prototype.connect=function(){throw Error('UNEXPECTED_SOCKET')};syncBuiltinESMExports();
 try{await import('./server/db.ts');process.exitCode=2;}catch(e){if(e.message==='Invalid audit runtime configuration')process.stdout.write('refused');else throw e;}
`],{encoding:'utf8',windowsHide:true,shell:false,env:{...process.env,...env,DATABASE_URL:url.replace('fmt_app_dev','postgres'),
 AUDIT_WORKER_ENABLED:'false',DOTENV_CONFIG_PATH:absent,DOTENV_PATH:absent,DOTENV_CONFIG_QUIET:'true',DOTENV_QUIET:'true',PGBINARY:''}});
assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'refused');
console.log('Passed: activation/remote-Auth staging, app URI and actual capability/TLS gates, stale ambient owner refusal before socket; synthetic offline only.');
