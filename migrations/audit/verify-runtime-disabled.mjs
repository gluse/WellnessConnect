// Fixed read-only recovery of both committed disabled runtime installations.
// Historical version receipts are not represented as fresh ledger reads.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPrivateConfiguration,MANIFEST} from './execute-runtime-setup.mjs';
import {loadRuntimeScripts,RUNTIME_FILES} from './execute-runtime-disabled.mjs';
import {verifyExistingRuntime} from './continue-runtime-source.mjs';
import {client,connect,requireThat,emit,safeCode} from './runtime-support.mjs';
export async function verifyBothDisabled({configs,cas,makeClient=client,open=connect,verify=verifyExistingRuntime,onEvent=()=>{}}){
 const connections={};let target;
 try{for(target of ['destination','source']){
  const x=connections[target]=await makeClient(configs[target],target,cas[target]);await open(x);
  const result=await verify(x,target);
  onEvent({stage:'committed-disabled-runtime-verification',target,status:'verified',...result,
   file:RUNTIME_FILES[target],sha256:MANIFEST[RUNTIME_FILES[target]],databaseWrites:false,
   loginsEnabled:false,passwordsProvisioned:false,applicationCutover:false});
 }return{status:'passed'};}
 catch(e){onEvent({stage:'committed-disabled-runtime-verification',target,status:'stopped',code:safeCode(e),databaseWrites:false});throw e;}
 finally{for(const x of Object.values(connections))try{await x.end();}catch{/* No driver contents. */}}
}
async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');loadRuntimeScripts();
 const {configs,cas}=loadPrivateConfiguration();await verifyBothDisabled({configs,cas,onEvent:value=>emit('runtime-disabled-verification',value)});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('stopped',{code:safeCode(e)});process.exitCode=1;}
}
