// New local-app scope only: metadata guard and additive portal audit contracts.
// Scripted clients never execute SQL or access a database/private configuration.
import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {PORTAL_AUDIT_EVENTS,PORTAL_AUDIT_PINS,loadPortalAuditScripts,portalAuditFunctionContracts,portalAuditCheckPlan,verifyPortalAuditRuntime} from '../migrations/audit/billing-portal-package.mjs';
import {BILLING_AUDIT_PINS} from '../migrations/audit/billing-package.mjs';
import {EXPECTED_BILLING_PARSERS,BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments,assertBillingApplicationReadiness} from '../migrations/billing/application-readiness.mjs';
import {verifyBillingDatabaseReadiness} from '../server/billing/database-readiness.ts';
import {SUPPORTED_AUDIT_EVENTS} from '../server/audit/events.ts';
import {createHash} from 'node:crypto';
assert.equal(process.argv.length,3);assert.equal(process.argv[2],'offline');
let checks=0;const check=fn=>{fn();checks++;};const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const scripts=loadPortalAuditScripts(),include=read('migrations/audit/_billing_portal_v1.sql');
for(const [file,pin]of Object.entries({...BILLING_AUDIT_PINS,...PORTAL_AUDIT_PINS}))check(()=>assert.equal(digest(fs.readFileSync(new URL('../migrations/audit/'+file,import.meta.url))),pin));
for(const event of PORTAL_AUDIT_EVENTS){check(()=>assert.ok(SUPPORTED_AUDIT_EVENTS.includes(event)));check(()=>assert.ok(include.includes("'"+event+"'")));}
check(()=>assert.match(include,/RENAME TO parse_event_before_portal/));
check(()=>assert.match(include,/RETURN audit_contract\.parse_event_before_portal\(/));
check(()=>assert.match(include,/assert_tree\(canonical_json::json\)/));
check(()=>assert.match(include,/retentionClass' IS DISTINCT FROM 'B'/));
check(()=>assert.match(include,/n<>'billing\.portal_unknown\.v1'/));
check(()=>assert.match(include,/scope|s->>'kind' IN \('personal','company'\)/));
check(()=>assert.match(include,/target|t->>'type' IS DISTINCT FROM 'billing_operation'/));
check(()=>assert.match(include,/2147483647/));
check(()=>assert.match(include,/reasonCode' IS DISTINCT FROM 'PROVIDER_TIMEOUT'/));
check(()=>assert.doesNotMatch(include,/CREATE TABLE|ALTER TABLE|DROP FUNCTION|CREATE ROLE|GRANT.*TO.*fm_app_runtime/));
for(const target of ['source','destination']){
 const sql=scripts.get(target);check(()=>assert.match(sql,/version='billing-v1-0006'/));check(()=>assert.match(sql,/version='billing-portal-v1-0007'/));
 check(()=>assert.match(sql,/Exact billing setup owner restoration failed/));
 check(()=>assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1));check(()=>assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1));
 check(()=>assert.equal((sql.match(/INSERT INTO /g)||[]).length,1,'only migration ledger write'));
 const contracts=portalAuditFunctionContracts(target,scripts).filter(c=>c.schema==='audit_contract'&&c.name.startsWith('parse_event'));
 check(()=>assert.equal(contracts.length,3));check(()=>assert.equal(new Set(contracts.map(c=>c.body_hash)).size,3));
 for(const expected of EXPECTED_BILLING_PARSERS)check(()=>assert.equal(contracts.find(c=>c.name===expected.name).body_hash,expected.hash));
 const options={testAccess:'disabled',billingAccess:'runtime',offerAccess:'runtime'},plan=portalAuditCheckPlan(target,options,scripts);
 check(()=>assert.ok(plan.every(([,query])=>/^\s*(SELECT|WITH)\b/.test(query))));
 check(()=>assert.ok(plan.find(p=>p[0]==='billingAuditParserAcl')[1].includes("'parse_event_before_portal'")));
 for(const failIndex of [-1,plan.length-1]){
  let position=0;const calls=[];const client={async query(sql,args){calls.push(sql);
   if(['BEGIN READ ONLY','ROLLBACK'].includes(sql))return{};
   assert.deepEqual([sql,args],[plan[position][1],plan[position][2]]);return{rows:[{approved_catalog_gate:position++!==failIndex}]};
  }};
  if(failIndex===-1){await verifyPortalAuditRuntime(client,target,options,scripts);checks++;}
  else{await assert.rejects(()=>verifyPortalAuditRuntime(client,target,options,scripts),/PORTAL_AUDIT_VERIFICATION_REJECTED/);checks++;}
  check(()=>assert.equal(calls.at(-1),'ROLLBACK'));
 }
}
check(()=>assert.match(BILLING_APPLICATION_READINESS_SQL,/current_user='fmt_app_dev'/));
check(()=>assert.doesNotMatch(BILLING_APPLICATION_READINESS_SQL,/SET ROLE|FROM audit_contract\.|FROM audit_capture\.|SELECT .*\* FROM public\./i));
check(()=>assert.match(BILLING_APPLICATION_READINESS_SQL,/pg_catalog\.pg_proc/));
check(()=>assert.match(BILLING_APPLICATION_READINESS_SQL,/has_table_privilege/));
const [rightsJson,parsersJson]=billingApplicationReadinessArguments(),rights=JSON.parse(rightsJson);
check(()=>assert.equal(rights.length,27));check(()=>assert.equal(JSON.parse(parsersJson).length,3));
check(()=>assert.equal(new Set(rights.map(r=>r.name)).size,27));
check(()=>assert.match(BILLING_APPLICATION_READINESS_SQL,/has_column_privilege/));
check(()=>assert.deepEqual(rights.find(r=>r.name==='billing_offer_revisions').rights,['SELECT','INSERT']));
check(()=>assert.deepEqual(rights.find(r=>r.name==='billing_offer_settings').rights,['SELECT','UPDATE']));
const changed=billingApplicationReadinessArguments();changed[0]='tampered';check(()=>assert.equal(billingApplicationReadinessArguments()[0],rightsJson));
const good={restricted_principal:true,expected_version:true,expected_table_count:true,required_dml:true,
 no_destructive_billing_access:true,exact_public_dml:true,expected_audit_parsers:true,immutable_guards:true};
check(()=>assert.doesNotThrow(()=>assertBillingApplicationReadiness([good])));
for(const key of Object.keys(good))for(const value of [false,null,undefined,'true'])check(()=>assert.throws(()=>assertBillingApplicationReadiness([{...good,[key]:value}]),/BILLING_DB_NOT_READY/));
for(const rows of [[],[good,good],[{...good,raw_driver_detail:'PRIVATE_CANARY'}]])check(()=>assert.throws(()=>assertBillingApplicationReadiness(rows),/BILLING_DB_NOT_READY/));
let called=0;await verifyBillingDatabaseReadiness(async(sql,args)=>{called++;assert.equal(sql,BILLING_APPLICATION_READINESS_SQL);assert.deepEqual(args,billingApplicationReadinessArguments());return{rows:[good]};});checks++;
check(()=>assert.equal(called,1));
await assert.rejects(()=>verifyBillingDatabaseReadiness(async()=>{throw Error('PRIVATE_CANARY');}),error=>error.message==='BILLING_DB_NOT_READY'&&!String(error.stack).includes('PRIVATE_CANARY'));checks++;
await assert.rejects(()=>verifyBillingDatabaseReadiness(async()=>({rows:[]})),/BILLING_DB_NOT_READY/);checks++;
const inert=spawnSync(process.execPath,['--input-type=module','-e',`
 import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).includes('.env'))throw Error('PRIVATE_READ');return original.call(this,file,...args);};
 net.Socket.prototype.connect=function(){throw Error('NETWORK_ACCESS');};syncBuiltinESMExports();
 await import('./migrations/audit/billing-portal-package.mjs');await import('./migrations/billing/application-readiness.mjs');process.stdout.write('inert');
`],{encoding:'utf8',windowsHide:true,shell:false});check(()=>assert.equal(inert.status,0,inert.stderr));check(()=>assert.equal(inert.stdout,'inert'));
console.log(JSON.stringify({stage:'local-app-database-and-portal-offline',status:'passed',checks,
 databaseAccess:false,privateFileAccess:false,sqlExecuted:false,appStarted:false,oldSuitesRepeated:false}));
