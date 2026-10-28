// TASK-014 reviewed recovery preparation: verify the already committed disabled
// destination, then first attempt of the unchanged pinned source runtime SQL.
// No destination migration/reapply, credential, activation or repair path.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,requireThat,emit,safeCode,client,connect} from './runtime-support.mjs';
import {TARGETS} from './runtime-contract.mjs';
import {loadPrivateConfiguration,inspectMetadata,MANIFEST,repositoryCompatibility} from './execute-runtime-setup.mjs';
import {RUNTIME_FILES,INSTALL_SQL,MIGRATION_TIMEOUT_MS,loadRuntimeScripts,installedFunctionContracts,
 requireBooleans,readonly,preflightInstall,verifyInstalled,checkCommit,deterministicPrecommitError} from './execute-runtime-disabled.mjs';

export async function verifyExistingRuntime(x,target){
 requireThat(['source','destination'].includes(target),'TARGET_REJECTED');
 const snapshot=await inspectMetadata(x,target);
 for(const key of ['no_set_role','setup_principal','version_17','utf8','may_create_roles','rehearsal_name_free','setup_owner_admin_option'])
  requireThat(snapshot.identity[key]===true,'EXISTING_DESTINATION_IDENTITY_REJECTED');
 requireThat(snapshot.identity.runtime_names_free===false&&snapshot.identity.setup_owner_effective_usage===false
  &&snapshot.identity.setup_owner_may_set===false,'EXISTING_DESTINATION_ROLE_STATE_REJECTED');
 const schemaCompatible=target==='source'
  ?snapshot.schema.app_policy_compatible===false&&Object.entries(snapshot.schema).every(([key,value])=>key==='app_policy_compatible'||value===true)
  :Object.values(snapshot.schema).every(v=>v===true);
 requireThat(Object.values(snapshot.rights).every(v=>v===true)&&schemaCompatible,
  'EXISTING_DESTINATION_SCHEMA_REJECTED');
 const before=await readonly(x,async()=>{
  const groups=target==='destination'?['fm_audit_writer']:['fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor'];
  requireBooleans(await x.query(INSTALL_SQL.groups,[groups]),'BASE_GROUPS_REJECTED');
  requireBooleans(await x.query(INSTALL_SQL.functions,[JSON.stringify(installedFunctionContracts(target))]),'INSTALLED_FUNCTIONS_REJECTED');
  const memberships=(await x.query(INSTALL_SQL.ownerMemberships,[`fm_audit_${target}_owner`])).rows;
  requireThat(memberships.length>0&&memberships.some(r=>r.admin_option===true)
   &&memberships.every(r=>r.inherit_option===false&&r.set_option===false),'OWNER_BASELINE_REJECTED');
  return{memberships};
 });
 const checks=await verifyInstalled(x,target,before);
 return{checks,versionEvidence:'historical-confirmed-version-receipt-and-COMMIT',
  freshLedgerRead:false,latentProviderAcl:target==='destination'?'two-exact-inaccessible-PUBLIC-SELECT-views':
   'exact-inaccessible-cron-tables-and-sequences; exact-provider-view-rule-also-enforced'};
}
export const verifyExistingDestination=x=>verifyExistingRuntime(x,'destination');

export async function continueSourceDisabled({configs,cas,sourceSQL,onEvent=()=>{},makeClient=client,open=connect,
 verifyDestination=verifyExistingDestination,preflightSource=preflightInstall,verifySource=verifyInstalled}){
 const connections={},commits={destination:'committed',source:'not-attempted'};
 let stage='existing-destination-verification',target='destination';
 try{
  connections.destination=await makeClient(configs.destination,'destination',cas.destination);await open(connections.destination);
  const destination=await verifyDestination(connections.destination);
  onEvent({stage,target,status:'verified',...destination,commits:{...commits},destinationWrites:false});
  target='source';stage='source-preflight';
  connections.source=await makeClient(configs.source,'source',cas.source);await open(connections.source);
  const before=await preflightSource(connections.source,'source');
  onEvent({stage,target,status:'passed',commits:{...commits}});
  stage='source-migration';commits.source='uncertain';
  try{
   const result=await connections.source.query({text:sourceSQL,query_timeout:MIGRATION_TIMEOUT_MS});
   const items=Array.isArray(result)?result:[result];
   if(items.at(-1)?.command==='COMMIT')commits.source='committed';
   checkCommit(result);
  }catch(e){
   if(commits.source!=='committed'){
    try{await connections.source.query('ROLLBACK');if(deterministicPrecommitError(e))commits.source='rolled-back';}
    catch{/* Unknown outcome stays uncertain; never retry. */}
   }throw e;
  }
  stage='source-verification';const checks=await verifySource(connections.source,'source',before);
  onEvent({stage,target,status:'verified',file:RUNTIME_FILES.source,sha256:MANIFEST[RUNTIME_FILES.source],
   version:'source-runtime-0003',versionReceipt:true,checks,commits:{...commits},loginsEnabled:false,
   passwordsProvisioned:false,applicationCutover:false,destinationWrites:false,
   latentProviderAclRule:'exact-two-provider-views-only-if-inaccessible; all-other-rights-rejected'});
  return{status:'passed',commits};
 }catch(e){onEvent({stage,target,status:'stopped',code:safeCode(e),commits:{...commits},destinationWrites:false});throw e;}
 finally{for(const x of Object.values(connections))try{await x.end();}catch{/* No driver contents. */}}
}

async function main(){
 const mode=process.argv[2];requireThat(process.argv.length===3&&['offline','continue-source-disabled'].includes(mode),'MODE_REJECTED');
 const scripts=loadRuntimeScripts();for(const target of ['source','destination'])installedFunctionContracts(target);
 const repository=repositoryCompatibility(fs.readFileSync(path.join(ROOT,'shared/schema.ts'),'utf8'));
 if(mode==='offline'){
  emit('source-continuation-offline',{status:'passed',sourceFile:RUNTIME_FILES.source,sha256:MANIFEST[RUNTIME_FILES.source],
   destinationFileExecuted:false,repository,privateFileAccess:false,databaseAccess:false,sqlExecuted:false});return;
 }
 const {configs,cas}=loadPrivateConfiguration();
 emit('source-continuation-scope',{source:TARGETS.source,destination:TARGETS.destination,repository,
  destinationWrites:false,loginsEnabled:false,passwordsProvisioned:false,applicationCutover:false});
 await continueSourceDisabled({configs,cas,sourceSQL:scripts.get(RUNTIME_FILES.source),onEvent:value=>emit('runtime-source-continuation',value)});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('stopped',{code:safeCode(e)});process.exitCode=1;}
}
