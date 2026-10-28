// Pure driver/catalog-response tests. No private files, sockets or live SQL.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../migrations/audit/runtime-support.mjs';
import {METADATA_SQL} from '../migrations/audit/execute-runtime-setup.mjs';
import {INSTALL_SQL,INACCESSIBLE_PROVIDER_VIEW,INACCESSIBLE_CRON_RELATION,INACCESSIBLE_CRON_SEQUENCE,RUNTIME_FILES,MIGRATION_TIMEOUT_MS,loadRuntimeScripts,
 verifyInstalled,preflightInstall} from '../migrations/audit/execute-runtime-disabled.mjs';
import {continueSourceDisabled,verifyExistingRuntime} from '../migrations/audit/continue-runtime-source.mjs';
import {verifyBothDisabled} from '../migrations/audit/verify-runtime-disabled.mjs';
if(process.argv.length!==3||process.argv[2]!=='offline'){
 process.stdout.write(JSON.stringify({stage:'stopped',code:'MODE_REJECTED'})+'\n');process.exit(1);
}
let checks=0;const check=work=>{work();checks++;};
const scripts=loadRuntimeScripts(),sourceSQL=scripts.get(RUNTIME_FILES.source);
const memberships=[{roleid:'1',member:'2',grantor:'3',admin_option:true,inherit_option:false,set_option:false}];
const identity=free=>({no_set_role:true,setup_principal:true,version_17:true,utf8:true,may_create_roles:true,
 rehearsal_name_free:true,setup_owner_admin_option:true,runtime_names_free:free,
 setup_owner_effective_usage:false,setup_owner_may_set:false});

// Test actual existing-destination verifier lifecycle, including all known failure
// boundaries. Scripted responses cannot establish live PostgreSQL correctness.
for(const target of ['destination','source'])for(const failure of [null,'identity','unexpected-owner-access','groups','functions','baseline','relation','owner-drift',
 ...(target==='source'?['wrong-source-profile','other-source-schema','restrictive-source-policy','wrong-installed-policy']:[])]){
 const calls=[];let membershipReads=0;
 const x={async query(sql){calls.push(sql);
  if(sql===METADATA_SQL.identity){const row=identity(false);if(failure==='identity')row.runtime_names_free=true;
   if(failure==='unexpected-owner-access')row.setup_owner_may_set=true;return{rows:[row]};}
  if(sql===METADATA_SQL.source)return{rows:[{app_policy_compatible:failure==='wrong-source-profile',
   app_tables_present:failure!=='other-source-schema'}]};
  if(sql===INSTALL_SQL.ownerMemberships)return{rows:failure==='owner-drift'&&membershipReads++>0?[]:memberships};
  if((failure==='groups'&&sql===INSTALL_SQL.groups)||(failure==='functions'&&sql===INSTALL_SQL.functions)
   ||(failure==='baseline'&&sql===(target==='destination'?INSTALL_SQL.destinationProviderBaseline:INSTALL_SQL.sourceProviderBaseline))
   ||(failure==='relation'&&sql===INSTALL_SQL.relations)
   ||(failure==='restrictive-source-policy'&&sql===INSTALL_SQL.installedSourcePolicies)
   ||(failure==='wrong-installed-policy'&&sql===INSTALL_SQL.policies))return{rows:[{ok:false}]};
  return{rows:[{ok:true}]};
 }};
 if(failure){await assert.rejects(()=>verifyExistingRuntime(x,target));checks++;}
 else{const result=await verifyExistingRuntime(x,target);check(()=>assert.equal(result.freshLedgerRead,false));
  check(()=>assert.equal(result.versionEvidence,'historical-confirmed-version-receipt-and-COMMIT'));}
 check(()=>assert.equal(calls.filter(c=>c==='BEGIN READ ONLY').length,calls.filter(c=>c==='ROLLBACK').length));
 check(()=>assert.equal(calls.some(c=>typeof c==='string'&&/^\s*(?:GRANT|REVOKE|SET ROLE|CREATE|ALTER)\b/i.test(c)),false));
 if(['baseline','relation'].includes(failure))check(()=>assert.ok(calls.includes(target==='destination'?INSTALL_SQL.destinationProviderBaseline:INSTALL_SQL.sourceProviderBaseline)));
}
for(const field of ['provider_views_not_usable_via_current_groups_or_public','geocoding_maintenance_not_inherited']){
 const calls=[];const x={async query(sql){calls.push(sql);
  if(sql===METADATA_SQL.identity)return{rows:[identity(true)]};
  if(sql===INSTALL_SQL.ownerMemberships)return{rows:memberships};
  return{rows:[{[field]:sql!==INSTALL_SQL.sourceInheritedAccess}]};
 }};
 await assert.rejects(()=>preflightInstall(x,'source'),/SOURCE_INHERITED_ACCESS_REJECTED/);checks++;
 check(()=>assert.equal(calls.at(-1),'ROLLBACK'));
}
// Every exact baseline condition stays in the same SQL statement as the relation
// classifier; no generic schema exclusion or unconditional SELECT exemption.
for(const text of ["n.nspname='extensions'","c.relname IN ('pg_stat_statements','pg_stat_statements_info')",
 "c.relkind='v'","NOT has_schema_privilege(r.oid,n.oid,'USAGE')","grantor.rolname='postgres'",
 "a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable",'aclexplode(attribute.attacl)',
 "CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END"])
 check(()=>assert.ok(INACCESSIBLE_PROVIDER_VIEW.includes(text)));
check(()=>assert.ok(INSTALL_SQL.relations.includes(INACCESSIBLE_PROVIDER_VIEW)));
check(()=>assert.ok(INSTALL_SQL.destinationProviderBaseline.includes(INACCESSIBLE_PROVIDER_VIEW)));
check(()=>assert.ok(INSTALL_SQL.relations.includes("needed.privilege='SELECT' AND has_table_privilege")));
check(()=>assert.doesNotMatch(INACCESSIBLE_PROVIDER_VIEW,/ARRAY\[\]::aclitem/));
for(const predicate of [INACCESSIBLE_CRON_RELATION,INACCESSIBLE_CRON_SEQUENCE]){
 for(const text of ["n.nspname='cron'","rolname='supabase_admin'","NOT has_schema_privilege(r.oid,n.oid,'USAGE')",
  'a.grantee=0','NOT a.is_grantable',"pg_has_role(r.oid,a.grantee,'USAGE')"])
  check(()=>assert.ok(predicate.includes(text)));
 check(()=>assert.ok(INSTALL_SQL.sourceProviderBaseline.includes(predicate)));
}
check(()=>assert.ok(INACCESSIBLE_CRON_RELATION.includes("ARRAY['SELECT','DELETE']")));
check(()=>assert.ok(INACCESSIBLE_CRON_RELATION.includes('aclexplode(attribute.attacl)')));
check(()=>assert.ok(INACCESSIBLE_CRON_SEQUENCE.includes("c.relname IN ('jobid_seq','runid_seq')")));
check(()=>assert.ok(INSTALL_SQL.sequences.includes(INACCESSIBLE_CRON_SEQUENCE)));

for(const failure of [null,'destination-open','destination-verify','source-open','source-verify']){
 const calls=[],events=[],closed=[];
 const settings={configs:{destination:'synthetic',source:'synthetic'},cas:{},onEvent:e=>events.push(e),
  makeClient:async(_,target)=>({target,async query(){throw Error('DRIVER_MUST_NOT_WRITE');},async end(){closed.push(target);}}),
  open:async x=>{calls.push(['open',x.target]);if(failure===`${x.target}-open`)throw Error('CANARY_PRIVATE');},
  verify:async(_,target)=>{calls.push(['verify',target]);if(failure===`${target}-verify`)throw Error('CANARY_PRIVATE');return{freshLedgerRead:false};}};
 if(failure){await assert.rejects(()=>verifyBothDisabled(settings));checks++;}
 else{const result=await verifyBothDisabled(settings);check(()=>assert.equal(result.status,'passed'));}
 check(()=>assert.deepEqual(closed,failure?.startsWith('destination-')?['destination']:['destination','source']));
 check(()=>assert.ok(events.every(e=>e.databaseWrites===false)));
 check(()=>assert.ok(!JSON.stringify(events).includes('CANARY_PRIVATE')));
 if(!failure)check(()=>assert.deepEqual(calls,[['open','destination'],['verify','destination'],['open','source'],['verify','source']]));
}

const receipt=()=>[{command:'SELECT',fields:[{name:'runtime_version_recorded'}],rows:[{runtime_version_recorded:true}]},{command:'COMMIT'}];
for(const scenario of ['success','destination-open','destination-verification','source-open','source-preflight',
 'source-sql','source-timeout','source-cancel','source-ambiguous','source-rollback-fails','bad-receipt','source-verification']){
 const calls=[],events=[],closed=[];
 const settings={configs:{destination:'synthetic',source:'synthetic'},cas:{},sourceSQL,
  onEvent:event=>events.push(event),
  makeClient:async(_,target)=>({target,async query(query){const sql=typeof query==='string'?query:query.text;calls.push([target,sql]);
   if(target==='destination')throw new Error('DESTINATION_WRITE_FORBIDDEN');
   if(sql==='ROLLBACK'){if(scenario==='source-rollback-fails')throw new Error('CANARY_PRIVATE');return{command:'ROLLBACK'};}
   check(()=>assert.equal(sql,sourceSQL));check(()=>assert.equal(query.query_timeout,MIGRATION_TIMEOUT_MS));
   const code={'source-sql':'42501','source-timeout':'ETIMEDOUT','source-cancel':'57014','source-ambiguous':'40003','source-rollback-fails':'42501'}[scenario];
   if(code){const e=new Error('CANARY_PRIVATE');e.code=code;throw e;}
   if(scenario==='bad-receipt')return[{command:'COMMIT'}];return receipt();},async end(){closed.push(target);}}),
  open:async x=>{if(scenario===`${x.target}-open`)throw new Error('CANARY_PRIVATE');},
  verifyDestination:async()=>{calls.push(['destination','verify-existing']);if(scenario==='destination-verification')throw new Error('CANARY_PRIVATE');return{freshLedgerRead:false};},
  preflightSource:async()=>{calls.push(['source','preflight']);if(scenario==='source-preflight')throw new Error('CANARY_PRIVATE');return{memberships};},
  verifySource:async()=>{calls.push(['source','verify']);if(scenario==='source-verification')throw new Error('CANARY_PRIVATE');return{all:true};},
 };
 if(scenario==='success'){const result=await continueSourceDisabled(settings);check(()=>assert.deepEqual(result.commits,{destination:'committed',source:'committed'}));}
 else{await assert.rejects(()=>continueSourceDisabled(settings));checks++;}
 const wrote=calls.filter(([,sql])=>sql===sourceSQL);
 const beforeWrite=['destination-open','destination-verification','source-open','source-preflight'].includes(scenario);
 check(()=>assert.equal(wrote.length,beforeWrite?0:1));
 check(()=>assert.equal(calls.some(([target,sql])=>target==='destination'&&sql===scripts.get(RUNTIME_FILES.destination)),false));
 check(()=>assert.deepEqual(closed,scenario.startsWith('destination-')?['destination']:['destination','source']));
 if(!beforeWrite){check(()=>assert.ok(calls.findIndex(([,sql])=>sql==='verify-existing')<calls.findIndex(([,sql])=>sql==='preflight')));
  check(()=>assert.ok(calls.findIndex(([,sql])=>sql==='preflight')<calls.findIndex(([,sql])=>sql===sourceSQL)));}
 const last=events.at(-1);check(()=>assert.equal(last.commits.destination,'committed'));
 check(()=>assert.equal(last.destinationWrites,false));
 check(()=>assert.equal(last.commits.source,beforeWrite?'not-attempted':scenario==='source-sql'?'rolled-back':
  ['source-timeout','source-cancel','source-ambiguous','source-rollback-fails'].includes(scenario)?'uncertain':'committed'));
 check(()=>assert.ok(!JSON.stringify(events).includes('CANARY_PRIVATE')));
}
for(const mode of ['apply-runtime-disabled','apply-destination','provision','rehearsal']){
 const r=spawnSync(process.execPath,['migrations/audit/continue-runtime-source.mjs',mode],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
 check(()=>assert.equal(r.status,1));check(()=>assert.equal(r.stderr,''));
 check(()=>assert.deepEqual(JSON.parse(r.stdout),{stage:'stopped',code:'MODE_REJECTED'}));
}
const guarded=`const fs=await import('node:fs'),net=await import('node:net');const original=fs.default.readFileSync;
let privateReads=0,sockets=0;fs.default.readFileSync=function(file,...args){if(/(?:^|[\\\\/])\\.env(?:\\.|$)/.test(String(file))){privateReads++;throw Error('PRIVATE_READ');}return original.call(this,file,...args);};
net.Socket.prototype.connect=function(){sockets++;throw Error('SOCKET');};
await import('./migrations/audit/continue-runtime-source.mjs');await import('./migrations/audit/verify-runtime-disabled.mjs');
process.stdout.write(JSON.stringify({privateReads,sockets}));`;
const r=spawnSync(process.execPath,['--input-type=module','--eval',guarded],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(r.status,0));check(()=>assert.equal(r.stderr,''));check(()=>assert.deepEqual(JSON.parse(r.stdout),{privateReads:0,sockets:0}));
process.stdout.write(JSON.stringify({stage:'source-continuation-tests',status:'passed',checks,privateFileAccess:false,databaseAccess:false,sqlExecuted:false})+'\n');
