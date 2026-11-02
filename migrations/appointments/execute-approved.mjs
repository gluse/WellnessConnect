// TASK-037 approved source-only activation. Single attempt, no retry or raw errors.
// No application/audit startup, fixture writes, purge, backup export or deployment.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import {pathToFileURL} from 'node:url';
import {privatePreflight,privateRead,connection,trustedCA,client,connect,requireThat,safeCode} from '../audit/runtime-support.mjs';
import {BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments,assertBillingApplicationReadiness} from '../billing/application-readiness.mjs';
export const APPROVED_SOURCE='hbkooiknruimukkhshrk';
const migrations=[
 ['0016_appointments.sql','8488b5755ecd74b0f55764640e98796a2b50d152401e7257047d51e4c532e663','appointments_expansion_created'],
 ['0017_appointments_runtime.sql','ef3b5db7e27e75303ccde782096940f8daa3acf6cffdc0e3c5411f9f1cc8fe6b','appointments_runtime_created']
];
const receiptURL=new URL('./source-activation-receipt.json',import.meta.url);
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
export function admission(args) {
 requireThat(args.length===2&&args.includes('--apply-approved-source='+APPROVED_SOURCE),'EXACT_ACTIVATION_FLAG_REQUIRED');
 const choice=args.find(value=>value.startsWith('--backup-'));
 requireThat(choice==='--backup-waived=TASK-037-2026-11-02'||choice?.startsWith('--backup-evidence='),'EXPLICIT_BACKUP_GATE_REQUIRED');
 return choice;
}
export async function activate(args) {
 let stage='local_admission',owner,app,receipt;
 const save=async()=>{if(receipt)await writeFile(receiptURL,JSON.stringify(receipt,null,2)+'\n');};
 try {
  const choice=admission(args);
  let backup;
  if(choice==='--backup-waived=TASK-037-2026-11-02') backup={waived:true,source:APPROVED_SOURCE,userSelection:'Apply migrations 0016/0017 without a verified backup',date:'2026-11-02'};
  else {
   const evidenceText=await readFile(new URL('../../'+choice.slice('--backup-evidence='.length),import.meta.url),'utf8');
   requireThat(evidenceText.length<8192,'BACKUP_EVIDENCE_TOO_LARGE');
   const evidence=JSON.parse(evidenceText);
   requireThat(evidence.project===APPROVED_SOURCE&&evidence.verifiedRecoverable===true&&typeof evidence.verifiedAt==='string'&&Date.now()-Date.parse(evidence.verifiedAt)>=0&&Date.now()-Date.parse(evidence.verifiedAt)<86400000,'BACKUP_EVIDENCE_NOT_CURRENT_OR_VERIFIED');
   backup={waived:false,evidenceSha256:createHash('sha256').update(evidenceText).digest('hex')};
  }
  const scripts=[];
  for(const [name,pinned,flag]of migrations) {
   const text=await readFile(new URL('./'+name,import.meta.url),'utf8');
   requireThat(createHash('sha256').update(text).digest('hex')===pinned,'MIGRATION_DIGEST_CHANGED');
   scripts.push({name,pinned,flag,text});
  }
  const sid=privatePreflight();
  function settings(file) {
   const input=privateRead(file,sid),keys=[...input.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(m=>m[1]);
   requireThat(new Set(keys).size===keys.length,'DUPLICATE_ENV_KEY');return parse(input);
  }
  const ownerValue=settings('.env.audit-setup.local').AUDIT_SETUP_SOURCE_DATABASE_URL;
  const appValue=settings('.env').DATABASE_URL;
  const ownerConfig=connection(ownerValue,'source','postgres'),appConfig=connection(appValue,'source','fmt_app_dev');
  const ownerCA=trustedCA(ownerConfig),appCA=trustedCA(appConfig);
  receipt={project:APPROVED_SOURCE,executor:'/root/appointments_db',startedAt:new Date().toISOString(),backup,scripts:scripts.map(({name,pinned})=>({name,sha256:pinned,attempted:false,committed:false})),state:'started'};
  try{await writeFile(receiptURL,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}catch{receipt=undefined;requireThat(false,'ACTIVATION_RECEIPT_ALREADY_EXISTS_OR_UNWRITABLE');}
  stage='source_fresh_readonly_guard';receipt.stage=stage;await save();
  owner=await client(ownerValue,'source',ownerCA,'postgres');await connect(owner);
  await owner.query('BEGIN TRANSACTION READ ONLY');
  const [baseline]=(await owner.query(`SELECT current_user=session_user AND current_user='postgres' AS identity,
    current_setting('server_version_num')::integer/10000=17 AS version,
    current_database()='postgres' AS database,
    (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))=33 AS table_count,
    to_regclass('public.booking_messages') IS NULL AND to_regclass('public.booking_reschedule_requests') IS NULL AS tables_absent,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.bookings'::regclass AND attname='closed_at' AND NOT attisdropped) AS column_absent`)).rows;
  requireThat(baseline&&Object.values(baseline).every(value=>value===true),'SOURCE_BASELINE_CHANGED');
  await owner.query('COMMIT');emit({stage,passed:true,tlsVerified:true,checks:baseline});
  for(let index=0;index<scripts.length;index++) {
   const script=scripts[index];stage=script.name;receipt.stage=stage;receipt.scripts[index].attempted=true;await save();
   const result=await owner.query({text:script.text,query_timeout:125000});
   const results=Array.isArray(result)?result:[result];
   requireThat(results.at(-1)?.command==='COMMIT'&&results.some(item=>item.rows?.[0]?.[script.flag]===true),'COMMIT_NOT_CONFIRMED');
   receipt.scripts[index].committed=true;receipt.scripts[index].completedAt=new Date().toISOString();
   receipt.scripts[index].updatedRows=results.filter(item=>item.command==='UPDATE').reduce((sum,item)=>sum+(item.rowCount||0),0);
   await save();emit({stage,passed:true,committed:true,updatedRows:receipt.scripts[index].updatedRows});
  }
  await owner.end();owner=undefined;
  stage='restricted_app_readonly_verification';receipt.stage=stage;await save();
  app=await client(appValue,'source',appCA,'fmt_app_dev');await connect(app);
  await app.query('BEGIN TRANSACTION READ ONLY');
  const rows=(await app.query(BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments())).rows;
  assertBillingApplicationReadiness(rows);
  const counts=(await app.query('SELECT (SELECT count(*)::integer FROM public.booking_messages) AS messages,(SELECT count(*)::integer FROM public.booking_reschedule_requests) AS reschedule_requests')).rows[0];
  await app.query('COMMIT');receipt.verification=rows[0];receipt.privateRowCounts=counts;receipt.state='verified';receipt.completedAt=new Date().toISOString();await save();
  emit({stage,passed:true,tlsVerified:true,readOnly:true,checks:rows[0],rowCounts:counts});
  emit({stage:'complete',passed:true,project:APPROVED_SOURCE,backupVerified:!backup.waived,retry:false,purge:false,auditConnection:false,applicationStarted:false});
 }catch(error) {
  const code=safeCode(error);
  if(receipt){receipt.state='stopped';receipt.stage=stage;receipt.safeCode=code;receipt.commitOutcomeUnknown=migrations.some(([name],index)=>name===stage&&receipt.scripts[index].attempted&&!receipt.scripts[index].committed);receipt.failedAt=new Date().toISOString();await save().catch(()=>{});}
  emit({stage,passed:false,safeCode:code,checks:Array.isArray(error?.checks)?error.checks:undefined,commitOutcomeUnknown:receipt?.commitOutcomeUnknown??false,retry:false});
  process.exitCode=1;
 }finally{await owner?.end().catch(()=>{});await app?.end().catch(()=>{});}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await activate(process.argv.slice(2));

