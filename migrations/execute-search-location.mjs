// TASK-026 dependency consumed by TASK-014 completion authorization on the fixed
// development source. No destination connection, role enablement or API use.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ROOT, requireThat, safeCode, emit, client, connect} from './audit/runtime-support.mjs';
import {loadPrivateConfiguration} from './audit/execute-runtime-setup.mjs';
import {loadRuntimeScripts, deterministicPrecommitError, MIGRATION_TIMEOUT_MS} from './audit/execute-runtime-disabled.mjs';
import {preflightLocation, verifyLocationRuntime, locationRepositoryCompatibility} from './audit/search-location-runtime.mjs';

export const LOCATION_FILE='0009_user_search_locations.sql';
export const LOCATION_SHA256='fcd68625be336928dc992354d2b0ef8e96bce416022c7eb34e673fcc98302838';
export const PROJECT='hbkooiknruimukkhshrk';
export function loadLocationPackage() {
  loadRuntimeScripts(); // Validate, never run, the unchanged foundation pins.
  const bytes=fs.readFileSync(path.join(ROOT,'migrations',LOCATION_FILE));
  requireThat(createHash('sha256').update(bytes).digest('hex')===LOCATION_SHA256,'LOCATION_DIGEST_MISMATCH');
  requireThat(locationRepositoryCompatibility(fs.readFileSync(path.join(ROOT,'shared/schema.ts'),'utf8')),
    'LOCATION_REPOSITORY_CONTRACT_REJECTED');
  return bytes.toString('utf8');
}
export function checkLocationCommit(result) {
  const results=Array.isArray(result)?result:[result];
  requireThat(results.at(-1)?.command==='COMMIT','LOCATION_COMMIT_UNCERTAIN');
  const receipts=results.filter(row=>row.command==='SELECT' && row.fields?.length===1 &&
    row.fields[0].name==='location_schema_created');
  requireThat(receipts.length===1 && receipts[0].rows.length===1 &&
    receipts[0].rows[0].location_schema_created===true,'LOCATION_RECEIPT_REJECTED');
}
export async function applyLocation({value,ca,sql,onEvent=()=>{},makeClient=client,open=connect,
  preflight=preflightLocation,verify=verifyLocationRuntime}) {
  let x,stage='location-preflight',commit='not-attempted';
  try {
    // No arbitrary SQL input in the CLI. This injectable boundary is used only by
    // offline driver tests; production main always supplies loadLocationPackage().
    requireThat(createHash('sha256').update(sql).digest('hex')===LOCATION_SHA256,'LOCATION_DIGEST_MISMATCH');
    x=await makeClient(value,'source',ca);await open(x);
    const before=await preflight(x);
    onEvent({stage,status:'passed',project:PROJECT,commit});
    stage='location-migration';commit='uncertain';
    try {
      const result=await x.query({text:sql,query_timeout:MIGRATION_TIMEOUT_MS});
      const items=Array.isArray(result)?result:[result];
      if(items.at(-1)?.command==='COMMIT')commit='committed';
      checkLocationCommit(result);
    } catch(error) {
      if(commit!=='committed')try {
        await x.query('ROLLBACK');
        if(deterministicPrecommitError(error))commit='rolled-back';
      } catch { /* Unknown outcome stays uncertain. Never reapply automatically. */ }
      throw error;
    }
    stage='location-verification';
    const result=await verify(x,before);
    onEvent({stage,status:'passed',project:PROJECT,commit,...result,sha256:LOCATION_SHA256,
      loginsEnabled:false,passwordsProvisioned:false,applicationCutover:false});
    return {commit,...result};
  } catch(error) {
    onEvent({stage,status:'stopped',project:PROJECT,commit,code:safeCode(error)});
    throw error;
  } finally { if(x)try{await x.end();}catch{/* No private driver output. */} }
}
async function main() {
  const mode=process.argv[2];
  requireThat(process.argv.length===3 && ['offline','apply-location'].includes(mode),'MODE_REJECTED');
  const sql=loadLocationPackage();
  if(mode==='offline') {
    emit('location-package',{status:'passed',file:LOCATION_FILE,sha256:LOCATION_SHA256,
      profile:'seventeen-tables-after-verified-sixteen-table-runtime',privateFileAccess:false,
      databaseAccess:false,sqlExecuted:false});return;
  }
  const {configs,cas}=loadPrivateConfiguration();
  await applyLocation({value:configs.source,ca:cas.source,sql,onEvent:event=>emit('location-executor',event)});
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  try{await main();}catch(error){emit('location-stopped',{code:safeCode(error)});process.exitCode=1;}
}
