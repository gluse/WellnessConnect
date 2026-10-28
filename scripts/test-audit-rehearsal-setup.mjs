// Offline only: synthetic pg orchestration and fixed SQL boundary checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadRehearsalScripts,rehearsalFunctionContracts,setupRehearsal,checkRehearsalCommit,
 SETUP_TIMEOUT_MS} from '../migrations/audit/rehearsal-setup.mjs';
import {REHEARSAL_FILES,REHEARSAL_MANIFEST,EVENT_IDS,RUN_ID} from '../migrations/audit/rehearsal-contract.mjs';
assert.equal(process.argv.length,3);assert.equal(process.argv[2],'offline');
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const throws=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
const scripts=loadRehearsalScripts();
equal(scripts.size,2);
for(const target of ['destination','source']){
 const file=REHEARSAL_FILES[target],sql=scripts.get(file);
 equal(createHash('sha256').update(sql).digest('hex'),REHEARSAL_MANIFEST[file]);
 const funcs=rehearsalFunctionContracts(target,sql);
 equal(funcs.length,6);equal(new Set(funcs.map(f=>f.name)).size,6);
 for(const f of funcs){equal(f.body_hash.length,64);equal(f.owner,
  ['inspect','all_absent','queue_safe'].includes(f.name)?`fm_audit_${target}_owner`:'fm_audit_rehearsal_owner');}
 ok(sql.includes('CREATE SCHEMA audit_rehearsal AUTHORIZATION fm_audit_rehearsal_owner;'));
 ok(sql.includes('SET TRANSACTION READ WRITE;'));
 ok(sql.includes('CONNECTION LIMIT 2;'));
 ok(sql.includes('GRANT SELECT(event_id,run_id) ON audit_rehearsal.cohort'));
 ok(sql.includes(`REVOKE CREATE ON SCHEMA audit_rehearsal FROM fm_audit_${target}_owner;`));
 ok(!/GRANT\s+(?:SELECT|ALL)[\s\S]{0,120}\bON\s+(?:audit\.events|audit_capture\.audit_outbox)\b/i.test(sql));
 ok(!/\b(?:TRUNCATE|DELETE FROM|PASSWORD|ALTER ROLE)\b/.test(sql));
 ok(sql.includes("clock_timestamp()+interval '31536000 seconds'"));
 ok(sql.includes("retain_until=n+interval '31536000 seconds'"));
 ok(sql.includes('c.passed IS DISTINCT FROM true'));
 equal((sql.match(/FOR UPDATE;/g)||[]).length,2,'record and finish serialize on run row');
 equal((sql.match(/observed IS DISTINCT FROM original/g)||[]).length,2,'both owners restored exactly');
 equal((sql.match(/GRANTED BY %I RESTRICT/g)||[]).length,2);
 ok(sql.includes(RUN_ID));
 const allAbsent=sql.match(/CREATE FUNCTION audit_rehearsal\.all_absent\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/)[1];
 for(const id of EVENT_IDS)ok(allAbsent.includes(id),'all IDs covered independent of source status');
 ok(!allAbsent.includes('status')&&!allAbsent.includes('audit_rehearsal.cohort'));
 if(target==='destination'){
  ok(allAbsent.includes('audit.events'));ok(allAbsent.includes('audit.integrity_incidents'));
  ok(sql.includes("'receiptCount',(SELECT count(*) FROM audit.events"));
 }else{
  ok(sql.includes("q.status IN ('pending','leased','quarantined')"));
  ok(sql.includes('NOT coalesce((q.event_id=ANY'));
  ok(sql.includes("AND q.envelope#>>'{source,environment}'='development'),false)"));
  ok(sql.includes("'leaseToken',q.lease_token"));
 }
}
const receipt=()=>({command:'SELECT',fields:[{name:'rehearsal_version_recorded'}],rows:[{rehearsal_version_recorded:true}]});
const committed=()=>[receipt(),{command:'COMMIT',rows:[]}];
checkRehearsalCommit(committed());checks++;
for(const result of [[],[receipt()],{command:'COMMIT'},[{...receipt(),rows:[]},{command:'COMMIT'}],
 [{...receipt(),rows:[{rehearsal_version_recorded:false}]},{command:'COMMIT'}],
 [receipt(),receipt(),{command:'COMMIT'}]])throws(()=>checkRehearsalCommit(result),/REHEARSAL_/);

function harness(fault={}){
 const actions=[],events=[],clients={};
 const error=()=>Object.assign(new Error('synthetic'),{code:fault.code||'P0001'});
 const fail=(stage,target)=>fault.stage===stage&&fault.target===target;
 const makeClient=async(_config,target)=>{
  actions.push(['client',target]);if(fail('client',target))throw error();
  const x={target,async query(q){
   if(typeof q==='string'){actions.push([q,target]);if(fail('rollback',target))throw error();return{command:q};}
   actions.push(['write',target,q.query_timeout]);equal(q.text,scripts.get(REHEARSAL_FILES[target]));
   if(fail('write',target))throw error();
   if(fail('receipt',target))return[{command:'COMMIT'}];
   if(fail('commit',target))return[receipt(),{command:'ROLLBACK'}];
   return committed();
  },async end(){actions.push(['close',target]);if(fail('close',target))throw error();}};
  clients[target]=x;return x;
 };
 const run=()=>setupRehearsal({configs:{},cas:{},scripts,makeClient,
  open:async x=>{actions.push(['open',x.target]);if(fail('open',x.target))throw error();},
  preflight:async(_x,target)=>{actions.push(['preflight',target]);if(fail('preflight',target))throw error();return{memberships:[]};},
  verify:async(_x,target,before,sql)=>{actions.push(['verify',target]);equal(before,{memberships:[]});equal(sql,scripts.get(REHEARSAL_FILES[target]));
   if(fail('verify',target))throw error();return{synthetic:true};},
  onEvent:event=>events.push(event)});
 return{run,actions,events,clients};
}
{
 const h=harness();const result=await h.run();equal(result,{status:'passed',commits:{destination:'committed',source:'committed'}});
 equal(h.actions.filter(a=>a[0]==='write'),[['write','destination',SETUP_TIMEOUT_MS],['write','source',SETUP_TIMEOUT_MS]]);
 ok(h.actions.findIndex(a=>a[0]==='preflight'&&a[1]==='source')<h.actions.findIndex(a=>a[0]==='write'));
 equal(h.actions.filter(a=>a[0]==='close').length,2);
 equal(h.events.filter(e=>e.stage==='rehearsal-installed').length,2);
 for(const event of h.events.filter(e=>e.stage==='rehearsal-installed')){
  equal(event.loginsEnabled,false);equal(event.passwordsProvisioned,false);equal(event.fixturesEnqueued,false);
 }
}
for(const stage of ['client','open','preflight'])for(const target of ['destination','source']){
 const h=harness({stage,target});await assert.rejects(h.run());checks++;
 equal(h.actions.filter(a=>a[0]==='write').length,0);
 equal(h.events.at(-1).commits,{destination:'not-attempted',source:'not-attempted'});
 equal(h.actions.filter(a=>a[0]==='close').length,Object.keys(h.clients).length);
}
for(const target of ['destination','source'])for(const code of ['42501','P0001','55P03','57014','ETIMEDOUT','40003','08006']){
 const h=harness({stage:'write',target,code});await assert.rejects(h.run());checks++;
 const state=['42501','P0001','55P03'].includes(code)?'rolled-back':'uncertain';
 equal(h.events.at(-1).commits,target==='destination'?{destination:state,source:'not-attempted'}:{destination:'committed',source:state});
 equal(h.actions.filter(a=>a[0]==='write'&&a[1]===target).length,1,'no retry');
 equal(h.actions.filter(a=>a[0]==='ROLLBACK'&&a[1]===target).length,1);
 equal(h.actions.filter(a=>a[0]==='close').length,2);
}
for(const stage of ['receipt','verify'])for(const target of ['destination','source']){
 const h=harness({stage,target});await assert.rejects(h.run());checks++;
 equal(h.events.at(-1).commits,target==='destination'?{destination:'committed',source:'not-attempted'}:{destination:'committed',source:'committed'});
 equal(h.actions.filter(a=>a[0]==='ROLLBACK').length,0,'confirmed commits are never rolled back or re-applied');
 equal(h.actions.filter(a=>a[0]==='close').length,2);
}
{
 const h=harness({stage:'commit',target:'destination'});await assert.rejects(h.run());checks++;
 equal(h.events.at(-1).commits,{destination:'uncertain',source:'not-attempted'});
 equal(h.actions.filter(a=>a[0]==='write').length,1);
}
for(const mode of ['offline','invalid','apply','preflight']){
 const child=spawnSync(process.execPath,['migrations/audit/rehearsal-setup.mjs',mode],{encoding:'utf8'});
 equal(child.status,mode==='offline'?0:1);equal(child.stderr,'');
 if(mode==='offline')ok(JSON.parse(child.stdout).privateFileAccess===false);
 else equal(JSON.parse(child.stdout).code,'REHEARSAL_MODE_REJECTED');
}
const inert=spawnSync(process.execPath,['--input-type=module','-e',"await import('./migrations/audit/rehearsal-setup.mjs'); process.stdout.write('inert');"],{encoding:'utf8'});
equal(inert.status,0);equal(inert.stdout,'inert');equal(inert.stderr,'');
const sqlFiles=Object.values(REHEARSAL_FILES).map(file=>fs.readFileSync(`migrations/audit/${file}`,'utf8'));
ok(sqlFiles.every(sql=>!sql.includes('fm_app_runtime')&&!sql.includes('CREATE POLICY fmt_app_server')),'application profiles untouched');
console.log(JSON.stringify({stage:'audit-rehearsal-setup-offline-tests',status:'passed',checks,databaseAccess:false,privateFileAccess:false,sqlExecuted:false}));
