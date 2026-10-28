// Pure argv classification plus one bounded Windows process inventory. Raw
// command lines remain transient in memory and are never emitted or persisted.
import {spawnSync} from 'node:child_process';
import {ROOT,requireThat} from '../audit/runtime-support.mjs';
const normalized=value=>value.replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
export function windowsArguments(command){
 const result=[];let i=0;
 while(i<command.length){
  while(/\s/.test(command[i]??'')&&i<command.length)i++;
  if(i===command.length)break;
  let value='',quoted=false;
  while(i<command.length&&(quoted||! /\s/.test(command[i]))){
   let slashes=0;while(command[i]==='\\'){slashes++;i++;}
   if(command[i]==='"'){
    value+='\\'.repeat(Math.floor(slashes/2));
    if(slashes%2)value+='"';else quoted=!quoted;
    i++;
   }else{value+='\\'.repeat(slashes);if(i<command.length)value+=command[i++];}
  }
  result.push(value);
 }
 return result;
}
function entry(args,start=1){
 for(let i=start;i<args.length;i++){
  const arg=args[i];
  if(['-e','--eval','-p','--print','-c','--check'].includes(arg)||/^--(?:eval|print|check)=/.test(arg))return null;
  if(['--import','--loader','--experimental-loader','-r','--require','--watch-path','--conditions','-C'].includes(arg)){i++;continue;}
  if(arg==='--')return args[i+1]??null;
  if(arg.startsWith('-'))continue;
  return arg;
 }
 return null;
}
const ROLES=new Map([
 ['server/index.ts','application'],['server/audit/run-worker.ts','audit-worker'],
 ['server/billing/run-worker.ts','billing-worker'],['scripts/rehearse-audit-db.mjs','audit-rehearsal'],
 ['scripts/start-stripe-local.mjs','billing-launcher'],
 ['dist/index.js','application'],['dist/index.mjs','application'],
]);
function roleOf(args,root){
 let script=entry(args);if(!script)return null;
 let normalizedScript=normalized(script),project=normalizedScript.startsWith(root+'/');
 if(/\/node_modules\/tsx\/dist\/(?:cli|watch)\.m?js$/.test(normalizedScript)){
  const position=args.indexOf(script);script=entry(args,position+1);
  if(script==='watch')script=entry(args,args.indexOf(script,position+1)+1);
  if(!script)return null;normalizedScript=normalized(script);
 }
 const relative=normalizedScript.startsWith(root+'/')?normalizedScript.slice(root.length+1):normalizedScript.replace(/^\.\//,'');
 const role=ROLES.get(relative);if(!role)return null;
 // An absolute entry belonging to another project is unrelated.
 if(/^(?:[a-z]:\/|\/)/.test(normalizedScript)&&!normalizedScript.startsWith(root+'/'))return null;
 return{role,project:project||normalizedScript.startsWith(root+'/')?'verified':'unresolved'};
}
export function classifyProcesses(records,root=ROOT){
 const base=normalized(root),byId=new Map(records.map(p=>[p.pid,p])),matches=[];
 for(const p of records){
  if(p.name?.toLowerCase()!=='node.exe'||typeof p.command!=='string')continue;
  const own=roleOf(windowsArguments(p.command),base);if(!own)continue;
  const parent=byId.get(p.parent);
  if(own.project==='unresolved'&&typeof parent?.command==='string'){
   const parentArgs=windowsArguments(parent.command),parentEntry=entry(parentArgs);
   if(parentEntry&&normalized(parentEntry).startsWith(base+'/'))own.project='verified';
  }
  matches.push({pid:p.pid,name:'node.exe',creation:p.creation,parentPid:p.parent,
   parentName:parent?.name??'unavailable',parentCreation:parent?.creation??'unavailable',...own});
 }
 return matches;
}
export function requireLocalQuiescence(onEvidence=()=>{}){
 const script=`$ErrorActionPreference='Stop'
 Import-Module (Join-Path $PSHOME 'Modules/CimCmdlets/CimCmdlets.psd1') -ErrorAction Stop
 $nodes=@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'")
 if($nodes.Count -gt 128){throw 'Inventory bound'}
 $parents=@($nodes | Select-Object -ExpandProperty ParentProcessId -Unique | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $_" })
 $items=@(@($nodes)+@($parents) | Sort-Object ProcessId -Unique | ForEach-Object {
  [pscustomobject]@{pid=[int]$_.ProcessId;name=$_.Name;creation=$_.CreationDate.ToUniversalTime().ToString('o');parent=[int]$_.ParentProcessId;command=$_.CommandLine}
 })
 ConvertTo-Json -InputObject $items -Compress -Depth 3`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false,maxBuffer:1024*1024});
 requireThat(r.status===0,'LOCAL_PROCESS_INVENTORY_UNAVAILABLE');
 let records;try{records=JSON.parse(r.stdout);}catch{requireThat(false,'LOCAL_PROCESS_INVENTORY_MALFORMED');}
 requireThat(Array.isArray(records)&&records.length<=256&&records.every(p=>Number.isInteger(p.pid)&&Number.isInteger(p.parent)&&typeof p.creation==='string'),'LOCAL_PROCESS_INVENTORY_MALFORMED');
 const matches=classifyProcesses(records);
 onEvidence({status:matches.length?'not-quiescent':'quiescent',matches});
 requireThat(matches.length===0,'LOCAL_PRODUCER_OR_WORKER_NOT_ABSENT');
}
