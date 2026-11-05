// TASK-042 exact-source activation, selected backup waiver, one attempt, no retry.
// No workflow writes, service startup, flags, private edits or destination access.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parse} from 'dotenv';
import {privatePreflight,privateRead,connection,trustedCA,client,connect,requireThat} from '../audit/runtime-support.mjs';
import {APPROVED_SOURCE,EXECUTOR,SCRIPT_PINS,SOURCE_METADATA_SQL,failureCode} from './preflight-approved.mjs';
import {BILLING_APPLICATION_READINESS_SQL,BILLING_APPLICATION_READINESS_KEYS,billingApplicationReadinessArguments,assertBillingApplicationReadiness} from '../billing/application-readiness.mjs';
import {WISHLIST_APPLICATION_READINESS_SQL,WISHLIST_APPLICATION_READINESS_KEYS,wishlistApplicationReadinessArguments,assertWishlistApplicationReadiness} from './application-readiness.mjs';
export const WAIVER='TASK-042-2026-11-04';
export const PREFLIGHT_RECEIPT_PIN='19dee27a8399dd2d63667b2b54991d34a68d26c2ada60e3fbe58a76956b458fd';
const activationCodes=new Set(['TASK042_ACTIVATION_FLAG_REQUIRED','TASK042_EXACT_BACKUP_WAIVER_REQUIRED','TASK042_PRIOR_PREFLIGHT_CHANGED','TASK042_MIGRATION_DIGEST_CHANGED','TASK042_ACTIVATION_RECEIPT_EXISTS_OR_UNWRITABLE','TASK042_RECEIPT_SAVE_FAILED','TASK042_SOURCE_BASELINE_REJECTED','TASK042_ACTIVE_APPLICATION_CONNECTIONS','TASK042_METADATA_SHAPE_REJECTED','TASK042_READINESS_SHAPE_REJECTED','TASK042_RESTRICTED35_NOT_READY','TASK042_RESTRICTED40_NOT_READY','TASK042_COMMIT_NOT_CONFIRMED','DUPLICATE_ENV_KEY']);
function data(value,key){try{const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;}catch{return undefined;}}
function code(error){const selected=data(error,'safeCode');return activationCodes.has(selected)?selected:failureCode(error);}
export function admission(args){
 requireThat(args.length===2&&args.includes('--apply-approved-source='+APPROVED_SOURCE),'TASK042_ACTIVATION_FLAG_REQUIRED');
 requireThat(args.includes('--backup-waived='+WAIVER),'TASK042_EXACT_BACKUP_WAIVER_REQUIRED');
}
function cleanReadiness(rows,keys){
 requireThat(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===keys.length,'TASK042_READINESS_SHAPE_REJECTED');
 return Object.fromEntries(keys.map(key=>[key,data(rows[0],key)===true]));
}
function cleanMetadata(rows){
 requireThat(Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===10,'TASK042_METADATA_SHAPE_REJECTED');
 const row=rows[0],clean={};
 for(const key of ['expected_principal','expected_database','expected_version','read_only','wishlist_tables_absent','archive_command_configured','backup_function_present']){
  const value=data(row,key);requireThat(typeof value==='boolean','TASK042_METADATA_SHAPE_REJECTED');clean[key]=value;
 }
 for(const key of ['public_table_count','other_application_connections']){const value=data(row,key);requireThat(Number.isSafeInteger(value)&&value>=0,'TASK042_METADATA_SHAPE_REJECTED');clean[key]=value;}
 const archive=data(row,'archive_mode');requireThat(['on','off','always'].includes(archive),'TASK042_METADATA_SHAPE_REJECTED');clean.archive_mode=archive;return clean;
}
function settings(file,sid){const text=privateRead(file,sid),names=[...text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(match=>match[1]);requireThat(new Set(names).size===names.length,'DUPLICATE_ENV_KEY');return parse(text);}
const receiptURL=new URL('./source-activation-receipt.json',import.meta.url);
const defaults={
 async scripts(){
  const prior=await readFile(new URL('./source-preflight-receipt.json',import.meta.url),'utf8');
  requireThat(createHash('sha256').update(prior).digest('hex')===PREFLIGHT_RECEIPT_PIN,'TASK042_PRIOR_PREFLIGHT_CHANGED');
  const scripts=[];
  for(const pin of SCRIPT_PINS){const text=await readFile(new URL('./'+pin.name,import.meta.url),'utf8');requireThat(createHash('sha256').update(text).digest('hex')===pin.sha256,'TASK042_MIGRATION_DIGEST_CHANGED');scripts.push({...pin,text,flag:pin.name.startsWith('0018')?'wishlist_expansion_created':'wishlist_runtime_created'});}
  return scripts;
 },
 async create(value){await writeFile(receiptURL,JSON.stringify(value,null,2)+'\n',{flag:'wx'});},
 async save(value){await writeFile(receiptURL,JSON.stringify(value,null,2)+'\n');},
 async prepare(){const sid=privatePreflight(),appValue=settings('.env',sid).DATABASE_URL,ownerValue=settings('.env.audit-setup.local',sid).AUDIT_SETUP_SOURCE_DATABASE_URL;
  const appConfig=connection(appValue,'source','fmt_app_dev'),ownerConfig=connection(ownerValue,'source','postgres');return {appValue,ownerValue,appCA:trustedCA(appConfig),ownerCA:trustedCA(ownerConfig)};
 },client,connect,emit(value){process.stdout.write(JSON.stringify(value)+'\n');},
};
export async function activate(args,overrides={}){
 const deps={...defaults,...overrides};let stage='local_admission',receipt,app,owner,activeScript=-1,submitted=false,receiptWriteFailed=false;
 const persist=async()=>{try{await deps.save(receipt);}catch{receiptWriteFailed=true;requireThat(false,'TASK042_RECEIPT_SAVE_FAILED');}};
 const closeApp=async()=>{const current=app;app=undefined;if(current)await current.end();};
 const closeOwner=async()=>{const current=owner;owner=undefined;if(current)await current.end();};
 try{
  admission(args);const scripts=await deps.scripts();
  const initial={task:'TASK-042',project:APPROVED_SOURCE,executor:EXECUTOR,startedAt:new Date().toISOString(),state:'started',
   priorPreflightReceiptSha256:PREFLIGHT_RECEIPT_PIN,backup:{verified:false,waived:true,selection:WAIVER,
    userInstruction:'Proceed with 0018/0019 without a verified backup on this development project, retaining stop-on-failure.'},
   scripts:SCRIPT_PINS.map(pin=>({...pin,attempted:false,committed:false})),retry:false,sourceOnly:true};
  try{await deps.create(initial);}catch{requireThat(false,'TASK042_ACTIVATION_RECEIPT_EXISTS_OR_UNWRITABLE');}receipt=initial;
  stage='protected_source_configuration';receipt.stage=stage;await persist();const prepared=await deps.prepare();
  stage='fresh_restricted35_readonly_preflight';receipt.stage=stage;await persist();
  app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');
  receipt.baselineVerification=cleanReadiness((await app.query(BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments())).rows,BILLING_APPLICATION_READINESS_KEYS);
  try{assertBillingApplicationReadiness([receipt.baselineVerification]);}catch{requireThat(false,'TASK042_RESTRICTED35_NOT_READY');}
  await app.query('COMMIT');await closeApp();await persist();deps.emit({stage,passed:true,readOnly:true,tlsVerified:true,checks:receipt.baselineVerification});
  stage='fresh_source_owner_readonly_guard';receipt.stage=stage;await persist();
  owner=await deps.client(prepared.ownerValue,'source',prepared.ownerCA,'postgres');await deps.connect(owner);await owner.query('BEGIN TRANSACTION READ ONLY');
  receipt.sourceMetadata=cleanMetadata((await owner.query(SOURCE_METADATA_SQL)).rows);const metadata=receipt.sourceMetadata;
  requireThat(metadata.expected_principal&&metadata.expected_database&&metadata.expected_version&&metadata.read_only&&metadata.public_table_count===35&&metadata.wishlist_tables_absent,'TASK042_SOURCE_BASELINE_REJECTED');
  requireThat(metadata.other_application_connections===0,'TASK042_ACTIVE_APPLICATION_CONNECTIONS');
  await owner.query('COMMIT');await persist();deps.emit({stage,passed:true,readOnly:true,tlsVerified:true,checks:metadata,backupVerified:false,backupWaived:true});
  for(let index=0;index<scripts.length;index++){
   const script=scripts[index];activeScript=index;submitted=false;stage=script.name;receipt.stage=stage;receipt.scripts[index].attempted=true;await persist();
   submitted=true;const raw=await owner.query({text:script.text,query_timeout:125000});
   const results=Array.isArray(raw)?raw:[raw];
   requireThat(data(results.at(-1),'command')==='COMMIT'&&results.some(result=>Array.isArray(data(result,'rows'))&&data(data(result,'rows')[0],script.flag)===true),'TASK042_COMMIT_NOT_CONFIRMED');
   receipt.scripts[index].committed=true;receipt.scripts[index].completedAt=new Date().toISOString();await persist();
   deps.emit({stage,passed:true,committed:true,sha256:script.sha256});
  }
  activeScript=-1;submitted=false;await closeOwner();
  stage='restricted40_readonly_postflight';receipt.stage=stage;await persist();
  app=await deps.client(prepared.appValue,'source',prepared.appCA,'fmt_app_dev');await deps.connect(app);await app.query('BEGIN TRANSACTION READ ONLY');
  receipt.verification=cleanReadiness((await app.query(WISHLIST_APPLICATION_READINESS_SQL,wishlistApplicationReadinessArguments())).rows,WISHLIST_APPLICATION_READINESS_KEYS);
  try{assertWishlistApplicationReadiness([receipt.verification]);}catch{requireThat(false,'TASK042_RESTRICTED40_NOT_READY');}
  await app.query('COMMIT');await closeApp();receipt.state='verified';receipt.completedAt=new Date().toISOString();receipt.commitOutcomeUnknown=false;await persist();
  deps.emit({stage,passed:true,readOnly:true,tlsVerified:true,checks:receipt.verification});
  deps.emit({stage:'complete',passed:true,project:APPROVED_SOURCE,backupVerified:false,backupWaived:true,retry:false,applicationStarted:false,workerStarted:false,configurationChanged:false,destinationAccessed:false});
  return {passed:true,receipt};
 }catch(error){
  const safeCode=code(error);const commitOutcomeUnknown=!!(receipt&&activeScript>=0&&submitted&&!receipt.scripts[activeScript].committed);
  if(receipt){receipt.state='stopped';receipt.stage=stage;receipt.safeCode=safeCode;receipt.commitOutcomeUnknown=commitOutcomeUnknown;receipt.stoppedAt=new Date().toISOString();
   if(activeScript>=0&&!submitted)receipt.scripts[activeScript].attempted=false;
   if(safeCode==='TASK042_RESTRICTED35_NOT_READY')receipt.failedChecks=BILLING_APPLICATION_READINESS_KEYS.filter(key=>receipt.baselineVerification?.[key]!==true);
   if(safeCode==='TASK042_RESTRICTED40_NOT_READY')receipt.failedChecks=WISHLIST_APPLICATION_READINESS_KEYS.filter(key=>receipt.verification?.[key]!==true);
   if(!receiptWriteFailed)try{await persist();}catch{}
  }
  deps.emit({stage,passed:false,safeCode,checks:receipt?.failedChecks,commitOutcomeUnknown,retry:false,receiptWriteFailed,
   scripts:receipt?.scripts.map(script=>({name:script.name,attempted:script.attempted,committed:script.committed}))});return {passed:false,stage,safeCode,receipt};
 }finally{try{await closeApp();}catch{}try{await closeOwner();}catch{}}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const result=await activate(process.argv.slice(2));if(!result.passed)process.exitCode=1;}
