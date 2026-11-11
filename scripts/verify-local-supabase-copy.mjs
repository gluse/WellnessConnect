// TASK-064 local-only read-only checks; imports do not use old connected grants.
import fs from 'node:fs';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import {loadLocalDevelopmentEnvironment} from './start-local-development.mjs';
import {ROLES,verifyOne} from './aws-publish-db-preflight-2026-11-09.mjs';
import {requireThat,safeCode} from '../migrations/audit/runtime-support.mjs';
import {safeDocker,LOCAL_COPY_PORTS} from './local-supabase-copy.mjs';

export async function verifyLocalCopy(receiptName='database-verification.json'){
  requireThat(['database-verification.json','database-verification-postrestart-20261110.json','database-verification-ports-20261110.json'].includes(receiptName),'LOCAL_COPY_RECEIPT_NAME_REJECTED');
  const environment=loadLocalDevelopmentEnvironment();
  const results=[];
  for(const role of ROLES){
    console.log(JSON.stringify({stage:'local-role-readiness',kind:role.kind}));
    const value=environment[role.key],uri=new URL(value);
    requireThat(uri.hostname==='127.0.0.1'&&uri.port===String(LOCAL_COPY_PORTS[role.target]),'LOCAL_COPY_TARGET_REQUIRED');
    const result=await verifyOne({...role,value},environment,async()=>new pg.Client({host:'127.0.0.1',port:Number(uri.port),database:'postgres',user:decodeURIComponent(uri.username),password:decodeURIComponent(uri.password),ssl:false,connectionTimeoutMillis:5000,query_timeout:15000,options:'-c default_transaction_read_only=on -c statement_timeout=10000'}),async x=>{
      await x.connect();requireThat(x.connection.stream.remoteAddress==='127.0.0.1'||x.connection.stream.remoteAddress==='::ffff:127.0.0.1','LOCAL_COPY_NONLOOPBACK_PEER');
    });
    delete result.tlsVerified;results.push({...result,transport:'explicit-local-loopback'});
  }
  const sql=`WITH refs AS (
    SELECT image_url AS path FROM public.services WHERE image_url IS NOT NULL
    UNION SELECT unnest(image_urls) FROM public.services
    UNION SELECT profile_image_url FROM public.users WHERE profile_image_url LIKE '/objects/%'
  ), checked AS (SELECT path,EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='service-images' AND o.name=substring(path FROM 10)) AS present FROM refs)
  SELECT json_build_object('storageObjects',(SELECT count(*) FROM storage.objects WHERE bucket_id='service-images'),
   'referencedObjectPaths',count(*) FILTER(WHERE path LIKE '/objects/%'),
   'missingObjectPaths',count(*) FILTER(WHERE path LIKE '/objects/%' AND NOT present),
   'hostedStorageUrls',count(*) FILTER(WHERE path LIKE 'https://%.supabase.co/storage/%'),
   'authUsers',(SELECT count(*) FROM auth.users),'authIdentities',(SELECT count(*) FROM auth.identities),
   'unmatchedApplicationUsers',(SELECT count(*) FROM public.users p LEFT JOIN auth.users a ON a.id::text=p.id WHERE a.id IS NULL),
   'copiedApplicationSessions',(SELECT count(*) FROM public.sessions),'copiedAuthSessions',(SELECT count(*) FROM auth.sessions),
   'copiedRefreshTokens',(SELECT count(*) FROM auth.refresh_tokens),
   'remainingSourceUserTokens',(SELECT count(*) FROM auth.users WHERE coalesce(confirmation_token,'')<>'' OR coalesce(recovery_token,'')<>'' OR coalesce(email_change_token_new,'')<>'' OR coalesce(email_change_token_current,'')<>'' OR coalesce(reauthentication_token,'')<>'' OR coalesce(phone_change_token,'')<>''),
   'applicationTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
   'publicTablesWithoutRls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity),
   'cronJobTablePresent',to_regclass('cron.job') IS NOT NULL)::text FROM checked;`;
  const sequenceCheck=`DO $sequences$ DECLARE r record; highest numeric; last_id bigint; called boolean;
   BEGIN FOR r IN SELECT ns.nspname AS sequence_schema,seq.relname AS sequence_name,nt.nspname AS table_schema,t.relname AS table_name,a.attname AS column_name
    FROM pg_class seq JOIN pg_depend d ON d.objid=seq.oid AND d.classid='pg_class'::regclass AND d.deptype IN ('a','i')
    JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace nt ON nt.oid=t.relnamespace JOIN pg_namespace ns ON ns.oid=seq.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE seq.relkind='S' AND nt.nspname='public'
   LOOP EXECUTE format('SELECT max(%I)::numeric FROM %I.%I',r.column_name,r.table_schema,r.table_name) INTO highest;
    EXECUTE format('SELECT last_value,is_called FROM %I.%I',r.sequence_schema,r.sequence_name) INTO last_id,called;
    IF highest IS NOT NULL AND (last_id<highest OR (last_id=highest AND NOT called)) THEN RAISE EXCEPTION 'Local sequence is behind existing rows'; END IF;
   END LOOP; END $sequences$;`;
  const output=safeDocker(['exec','-i','supabase_db_fitsmytime-local','psql','-U','supabase_admin','-d','postgres','--no-psqlrc','--set=ON_ERROR_STOP=1','--tuples-only','--no-align'],{input:Buffer.from('BEGIN READ ONLY;\n'+sequenceCheck+'\n'+sql+'\nROLLBACK;\n')}).toString();
  const row=output.split(/\r?\n/).find(line=>line.startsWith('{'));
  requireThat(row,'LOCAL_COPY_INVARIANTS_MISSING');const invariants=JSON.parse(row);
  requireThat(invariants.storageObjects===32&&invariants.missingObjectPaths===0&&invariants.hostedStorageUrls===0&&invariants.authUsers===16&&invariants.authIdentities===18&&invariants.unmatchedApplicationUsers===0&&invariants.copiedApplicationSessions===0&&invariants.copiedAuthSessions===0&&invariants.copiedRefreshTokens===0&&invariants.remainingSourceUserTokens===0&&invariants.applicationTables===41&&invariants.publicTablesWithoutRls===0&&invariants.cronJobTablePresent===false,'LOCAL_COPY_INVARIANTS_FAILED');
  const report={status:'passed',hostedWrites:false,localWrites:false,applicationChecks:38,roles:results,invariants,sequenceAdvancementSafe:true};
  fs.writeFileSync(`output/supabase-local-copy-2026-11-09/${receiptName}`,JSON.stringify(report,null,2)+'\n',{...(receiptName==='database-verification.json'?{}:{flag:'wx'})});
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const receipts={'--postrestart-20261110':'database-verification-postrestart-20261110.json','--ports-20261110':'database-verification-ports-20261110.json'};requireThat(process.argv.length===2||(process.argv.length===3&&Object.hasOwn(receipts,process.argv[2])),'LOCAL_COPY_VERIFICATION_MODE_REJECTED');console.log(JSON.stringify(await verifyLocalCopy(process.argv[2]?receipts[process.argv[2]]:'database-verification.json')));}catch(e){console.error(JSON.stringify({status:'stopped',code:safeCode(e),type:/^[A-Za-z]+$/.test(e?.name||'')?e.name:'Error',checks:Array.isArray(e?.checks)?e.checks.filter(c=>/^[a-z_]+$/.test(c)):undefined,hostedWrites:false}));process.exitCode=1;}
}
