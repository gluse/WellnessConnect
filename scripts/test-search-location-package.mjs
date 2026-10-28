// Offline contract/driver tests only. No private configuration or database I/O.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {ROOT} from '../migrations/audit/runtime-support.mjs';
import {APP_TABLES,APP_SEQUENCES,ROLES} from '../migrations/audit/runtime-contract.mjs';
import {INSTALL_SQL,relationContracts,loadRuntimeScripts} from '../migrations/audit/execute-runtime-disabled.mjs';
import {LOCATION_SQL,LOCATION_TABLES,locationRelationContracts,locationRepositoryCompatibility,
  preflightLocation,verifyLocationRuntime} from '../migrations/audit/search-location-runtime.mjs';
import {loadLocationPackage,applyLocation,checkLocationCommit,LOCATION_SHA256} from '../migrations/execute-search-location.mjs';

if(process.argv.length!==3 || process.argv[2]!=='offline') {
  process.stdout.write('{"code":"MODE_REJECTED"}\n');process.exit(1);
}
let checks=0;const check=fn=>{fn();checks++;};
const sql=loadLocationPackage();
check(()=>assert.match(LOCATION_SHA256,/^[a-f0-9]{64}$/));
check(()=>assert.equal(loadRuntimeScripts().size,2)); // Existing pins still validate.
check(()=>assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1));
check(()=>assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1));
check(()=>assert.match(sql,/REVOKE ALL ON public\.user_search_locations FROM PUBLIC, anon, authenticated, service_role;/));
check(()=>assert.deepEqual(sql.match(/^GRANT .*;$/gm),[
  'GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_search_locations TO fm_app_runtime;']));
check(()=>assert.doesNotMatch(sql,/\b(?:CREATE|ALTER)\s+ROLE\b|\bPASSWORD\b|\bSEQUENCE\b|\bALTER DEFAULT PRIVILEGES\b|\bSET ROLE\b/i));
check(()=>assert.equal((sql.match(/CREATE TABLE/g)||[]).length,1));
check(()=>assert.match(sql,/CREATE POLICY fmt_app_server ON public\.user_search_locations FOR ALL\s+TO fm_app_runtime USING\(true\) WITH CHECK\(true\)/));
check(()=>assert.ok(sql.indexOf('CREATE TABLE')>sql.indexOf('Verified disabled source runtime required')));
check(()=>assert.match(sql,/lock_timeout='5s'/));
check(()=>assert.match(sql,/statement_timeout='60s'/));
const extended=locationRelationContracts(),base=relationContracts('source');
check(()=>assert.deepEqual(extended.slice(0,base.length),base));
check(()=>assert.deepEqual(extended.slice(base.length),['fm_app_runtime',ROLES.app].map(role=>({
  role,schema:'public',name:'user_search_locations',rights:['SELECT','INSERT','UPDATE','DELETE'],
}))));
check(()=>assert.equal(LOCATION_TABLES.length,17));
check(()=>assert.equal(APP_TABLES.length,16));
check(()=>assert.equal(APP_SEQUENCES.length,10));
const declarations=names=>names.map(name=>`pgTable("${name}", {})`).join('\n');
check(()=>assert.equal(locationRepositoryCompatibility(declarations(LOCATION_TABLES)),true));
for(const names of [APP_TABLES,[...LOCATION_TABLES,'unreviewed'],[...LOCATION_TABLES.slice(1),'user_search_locations']])
  check(()=>assert.equal(locationRepositoryCompatibility(declarations(names)),false));
for(const text of Object.values(LOCATION_SQL)) check(()=>assert.match(text.trim(),/^(SELECT|WITH)\b/));

const memberships=[{roleid:'11',member:'12',grantor:'13',admin_option:true,inherit_option:false,set_option:false}];
const before={memberships};
function catalog(failure) {
  const calls=[];
  return {calls,async query(text,args) {
    calls.push({text,args});
    if(text===failure) return {rows:[{rejected:false}]};
    if(text===INSTALL_SQL.ownerMemberships) return {rows:memberships};
    if(text===LOCATION_SQL.definition) return {rows:[{definition:'CHECK (synthetic)'}]};
    return {rows:[{ok:true}]};
  }};
}
const initial=catalog();await preflightLocation(initial);checks++;
check(()=>assert.equal(initial.calls.filter(c=>c.text==='BEGIN READ ONLY').length,2));
check(()=>assert.equal(initial.calls.at(-1).text,'ROLLBACK'));
check(()=>assert.deepEqual(initial.calls.find(c=>c.text===LOCATION_SQL.foundation).args,[APP_TABLES]));
for(const gate of [LOCATION_SQL.identity,LOCATION_SQL.absence,LOCATION_SQL.foundation,INSTALL_SQL.roleState,INSTALL_SQL.relations]) {
  const x=catalog(gate);await assert.rejects(()=>preflightLocation(x));checks++;
  check(()=>assert.equal(x.calls.at(-1).text,'ROLLBACK'));
}
const post=catalog(),result=await verifyLocationRuntime(post,before);checks++;
check(()=>assert.equal(result.shapeSemanticReviewRequired,true));
check(()=>assert.equal(post.calls.at(-1).text,'ROLLBACK'));
check(()=>assert.deepEqual(post.calls.find(c=>c.text===LOCATION_SQL.tables).args,[LOCATION_TABLES]));
check(()=>assert.deepEqual(JSON.parse(post.calls.find(c=>c.text===INSTALL_SQL.relations).args[1]),extended));
check(()=>assert.deepEqual(post.calls.find(c=>c.text===INSTALL_SQL.sequences).args[2],APP_SEQUENCES));
check(()=>assert.deepEqual(post.calls.find(c=>c.text===INSTALL_SQL.installedSourcePolicies).args,[LOCATION_TABLES]));
check(()=>assert.deepEqual(post.calls.find(c=>c.text===INSTALL_SQL.sourceProviderBaseline).args,[]));
check(()=>assert.deepEqual(result.checks.inaccessibleCronBaseline,{ok:true}));
check(()=>assert.deepEqual(result.checks.policyCompatibility,{ok:true}));
for(const gate of [LOCATION_SQL.tables,LOCATION_SQL.shape,LOCATION_SQL.privateAcl,LOCATION_SQL.policy,
  INSTALL_SQL.roleState,INSTALL_SQL.grantOptions,INSTALL_SQL.sequences,INSTALL_SQL.policies,
  INSTALL_SQL.installedSourcePolicies,INSTALL_SQL.sourceProviderBaseline]) {
  const x=catalog(gate);await assert.rejects(()=>verifyLocationRuntime(x,before));checks++;
  check(()=>assert.equal(x.calls.at(-1).text,'ROLLBACK'));
}
await assert.rejects(()=>verifyLocationRuntime(catalog(),{memberships:[]}));checks++;

const receipt=()=>[{command:'BEGIN'},{command:'SELECT',fields:[{name:'location_schema_created'}],
  rows:[{location_schema_created:true}]},{command:'COMMIT'}];
check(()=>checkLocationCommit(receipt()));
for(const bad of [receipt().slice(0,-1),[{command:'COMMIT'}],
  [{command:'SELECT',fields:[{name:'location_schema_created'}],rows:[{location_schema_created:false}]},{command:'COMMIT'}]])
  check(()=>assert.throws(()=>checkLocationCommit(bad)));

for(const scenario of ['success','open','preflight','denied','transport','cancel','rollback-fails','missing-commit','missing-receipt','verify']) {
  const calls=[],events=[];let closed=0,attempts=0;
  const x={async query(query) {
    if(query==='ROLLBACK') {calls.push('rollback');if(scenario==='rollback-fails')throw Error('CANARY_PRIVATE');return{};}
    attempts++;calls.push('migration');check(()=>assert.equal(query.text,sql));
    check(()=>assert.equal(query.query_timeout,180000));
    if(['denied','transport','cancel','rollback-fails'].includes(scenario)) {
      const error=Error('CANARY_PRIVATE');
      error.code={denied:'42501',transport:'ETIMEDOUT',cancel:'57014','rollback-fails':'42501'}[scenario];throw error;
    }
    if(scenario==='missing-commit')return receipt().slice(0,-1);
    if(scenario==='missing-receipt')return [{command:'COMMIT'}];
    return receipt();
  },async end(){closed++;}};
  const options={value:'synthetic',ca:{},sql,onEvent:event=>events.push(event),
    makeClient:async(_,target)=>{check(()=>assert.equal(target,'source'));return x;},
    open:async()=>{calls.push('open');if(scenario==='open')throw Error('CANARY_PRIVATE');},
    preflight:async()=>{calls.push('preflight');if(scenario==='preflight')throw Error('CANARY_PRIVATE');return before;},
    verify:async()=>{calls.push('verify');if(scenario==='verify')throw Error('CANARY_PRIVATE');return {checks:{synthetic:true}};}};
  if(scenario==='success')await applyLocation(options);else await assert.rejects(()=>applyLocation(options));checks++;
  check(()=>assert.equal(closed,1));
  check(()=>assert.equal(attempts,['open','preflight'].includes(scenario)?0:1));
  check(()=>assert.ok(!JSON.stringify(events).includes('CANARY_PRIVATE')));
  const expected=['open','preflight'].includes(scenario)?'not-attempted':scenario==='denied'?'rolled-back':
    ['success','missing-receipt','verify'].includes(scenario)?'committed':'uncertain';
  check(()=>assert.equal(events.at(-1).commit,expected));
  if(scenario==='success')check(()=>assert.equal(events.at(-1).applicationCutover,false));
  if(['missing-receipt','verify'].includes(scenario))check(()=>assert.ok(!calls.includes('rollback')));
}
let privateBoundary=0;
await assert.rejects(()=>applyLocation({sql:sql+'\n',makeClient:async()=>{privateBoundary++;}}));checks++;
check(()=>assert.equal(privateBoundary,0));

const modules=['migrations/execute-search-location.mjs','migrations/audit/search-location-runtime.mjs'];
const probe=spawnSync(process.execPath,['--input-type=module','-e',`
  import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
  const original=fs.readFileSync;fs.readFileSync=function(file,...args){
    if(String(file).includes('.env'))throw Error('PRIVATE_READ');return original.call(this,file,...args);};
  net.Socket.prototype.connect=function(){throw Error('NETWORK_ACCESS');};syncBuiltinESMExports();
  for(const url of ${JSON.stringify(modules.map(file=>pathToFileURL(path.join(ROOT,file)).href))})await import(url);
  process.stdout.write('inert');
`],{encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(probe.status,0,probe.stderr));check(()=>assert.equal(probe.stdout,'inert'));
const wrongMode=spawnSync(process.execPath,['migrations/execute-search-location.mjs','not-approved'],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(wrongMode.status,1));check(()=>assert.match(wrongMode.stdout,/MODE_REJECTED/));
console.log(JSON.stringify({status:'passed',checks,scope:'offline-contract-and-driver',
  privateFileAccess:false,databaseAccess:false,sqlExecuted:false,
  deferred:['live SQL/constraints/ACL semantics','actual runtime API isolation','CHECK expression semantic review','TASK-025/privacy','deployment']}));
