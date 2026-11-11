// TASK-064 local-only persistence fingerprints. No hosted configuration or clients.
import fs from 'node:fs';
import pg from 'pg';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {COPY_SCHEMAS,AUTH_TABLES,FUNCTION_METADATA_SQL,privateArtifact,quoteIdentifier,verifyPrivateDirectoryAgain,safeDocker,localAdminConnection} from './local-supabase-copy.mjs';
import {requireThat,safeCode} from '../migrations/audit/runtime-support.mjs';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pick=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]]));
export function normalizeContainerSnapshot(data){
  return{
    tables:data.tables.map(r=>pick(r,['schema','name','rls','owner','acl','rows','sha256'])),
    functions:data.functions.map(r=>pick(r,['schema','name','arguments','hash','owner','config','securitydefiner','volatility','acl'])),
    sequences:data.sequences.map(r=>Object.fromEntries(['schemaname','sequencename','sequenceowner','data_type','start_value','min_value','max_value','increment_by','cycle','cache_size','last_value'].map(k=>[k,['start_value','min_value','max_value','increment_by','cache_size','last_value'].includes(k)&&r[k]!==null?String(r[k]):r[k]]))),
    roles:data.roles.map(r=>pick(r,['rolname','rolcanlogin','rolinherit','rolconnlimit','rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls'])),
    constraints:data.constraints.map(r=>pick(r,['schema','table_name','conname','definition','convalidated'])),
  };
}
export function containerSnapshotSql(target){
  requireThat(Object.hasOwn(COPY_SCHEMAS,target),'LOCAL_SNAPSHOT_TARGET_REJECTED');
  const literalArray=values=>'ARRAY['+values.map(v=>{quoteIdentifier(v);return `'${v}'`;}).join(',')+']::text[]';
  const scopes=literalArray(COPY_SCHEMAS[target]);
  const schemas=literalArray([...COPY_SCHEMAS[target],...(target==='source'?['auth','storage']:[])]);
  const auth=literalArray([...AUTH_TABLES,'sessions','refresh_tokens']);
  const functions=FUNCTION_METADATA_SQL.replace(/\$1::text\[\]/g,scopes);
  return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $snapshot$ DECLARE r record; row_count text; row_hash text; tables jsonb:='[]'; functions jsonb; sequences jsonb; roles jsonb; constraints jsonb;
BEGIN
 FOR r IN SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY(${schemas}) AND c.relkind='r'
  AND (n.nspname=ANY(${scopes}) OR (n.nspname='auth' AND c.relname=ANY(${auth})) OR (n.nspname='storage' AND c.relname IN('buckets','objects')))
  ORDER BY n.nspname,c.relname
 LOOP
  EXECUTE format('SELECT count(*)::text,encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex''),'''' ORDER BY encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')),''''),''UTF8'')),''hex'') FROM %I.%I t',r.schema,r.name) INTO row_count,row_hash;
  tables:=tables||jsonb_build_array(to_jsonb(r)||jsonb_build_object('rows',row_count,'sha256',row_hash));
 END LOOP;
 SELECT coalesce(jsonb_agg(to_jsonb(q)-'definition' ORDER BY q.schema,q.name,q.arguments),'[]') INTO functions FROM (${functions})q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.schemaname,q.sequencename),'[]') INTO sequences FROM(
  SELECT schemaname,sequencename,sequenceowner,data_type::text,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,last_value::text
  FROM pg_sequences WHERE schemaname=ANY(${scopes}))q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.rolname),'[]') INTO roles FROM(
  SELECT rolname,rolcanlogin,rolinherit,rolconnlimit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'fm_%' OR rolname LIKE 'fmt_%')q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.schema,q.table_name,q.conname),'[]') INTO constraints FROM(
  SELECT n.nspname AS schema,c.relname AS table_name,q.conname,pg_get_constraintdef(q.oid) AS definition,q.convalidated FROM pg_constraint q JOIN pg_class c ON c.oid=q.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY(${scopes}))q;
 PERFORM set_config('fmt_copy.snapshot',jsonb_build_object('tables',tables,'functions',functions,'sequences',sequences,'roles',roles,'constraints',constraints)::text,true);
END $snapshot$;
SELECT current_setting('fmt_copy.snapshot');
ROLLBACK;`;
}
export async function persistenceSnapshot({transport='host'}={}){
  requireThat(['host','container'].includes(transport),'LOCAL_SNAPSHOT_TRANSPORT_REJECTED');
  if(transport==='container'){
    const targets={};
    for(const target of ['source','destination']){
      const output=safeDocker(['exec','-i',target==='source'?'supabase_db_fitsmytime-local':'fitsmytime-local-audit','psql','-U',target==='source'?'supabase_admin':'postgres','-d','postgres','--no-psqlrc','--set=ON_ERROR_STOP=1','--quiet','--tuples-only','--no-align'],{input:Buffer.from(containerSnapshotSql(target))}).toString();
      const row=output.split(/\r?\n/).find(line=>line.startsWith('{'));requireThat(row,'LOCAL_CONTAINER_SNAPSHOT_MISSING');
      targets[target]=normalizeContainerSnapshot(JSON.parse(row));
    }
    return{targets,fingerprint:sha(targets)};
  }
  const bootstrap=JSON.parse(fs.readFileSync(privateArtifact('local-bootstrap.json'),'utf8'));
  const status=JSON.parse(fs.readFileSync(privateArtifact('supabase-status.json'),'utf8'));
  const targets={};
  for(const target of ['source','destination']){
    const x=new pg.Client({...localAdminConnection(target,status,bootstrap),options:'-c default_transaction_read_only=on -c statement_timeout=10000'});
    try{
      await x.connect();await x.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const schemas=[...COPY_SCHEMAS[target],...(target==='source'?['auth','storage']:[])];
      const relations=(await x.query(`SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind='r' ORDER BY n.nspname,c.relname`,[schemas])).rows.filter(r=>COPY_SCHEMAS[target].includes(r.schema)||(r.schema==='auth'&&[...AUTH_TABLES,'sessions','refresh_tokens'].includes(r.name))||(r.schema==='storage'&&['buckets','objects'].includes(r.name)));
      const tables=[];
      for(const r of relations){
        const row=(await x.query(`SELECT count(*)::text AS rows,encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'' ORDER BY encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')),''),'UTF8')),'hex') AS sha256 FROM ${quoteIdentifier(r.schema)}.${quoteIdentifier(r.name)} t`)).rows[0];
        tables.push({...r,...row});
      }
      const functions=(await x.query(FUNCTION_METADATA_SQL,[COPY_SCHEMAS[target]])).rows.map(({definition,...r})=>r);
      const sequences=(await x.query(`SELECT schemaname,sequencename,sequenceowner,data_type::text,start_value,min_value,max_value,increment_by,cycle,cache_size,last_value FROM pg_sequences WHERE schemaname=ANY($1::text[]) ORDER BY schemaname,sequencename`,[COPY_SCHEMAS[target]])).rows;
      const roles=(await x.query(`SELECT rolname,rolcanlogin,rolinherit,rolconnlimit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'fm_%' OR rolname LIKE 'fmt_%' ORDER BY rolname`)).rows;
      const constraints=(await x.query(`SELECT n.nspname AS schema,c.relname AS table_name,q.conname,pg_get_constraintdef(q.oid) AS definition,q.convalidated FROM pg_constraint q JOIN pg_class c ON c.oid=q.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) ORDER BY n.nspname,c.relname,q.conname`,[COPY_SCHEMAS[target]])).rows;
      targets[target]={tables,functions,sequences,roles,constraints};
      await x.query('ROLLBACK');
    }finally{await x.end();}
  }
  return{targets,fingerprint:sha(targets)};
}
export async function runPersistence(mode){
  requireThat(['baseline','compare'].includes(mode),'LOCAL_PERSISTENCE_MODE_REJECTED');
  const filename=privateArtifact('persistence-baseline.json');
  if(mode==='baseline')requireThat(!fs.existsSync(filename),'LOCAL_PERSISTENCE_BASELINE_EXISTS');
  const current=await persistenceSnapshot();
  if(mode==='baseline')fs.writeFileSync(filename,JSON.stringify(current,null,2)+'\n',{flag:'wx'});
  else{const prior=JSON.parse(fs.readFileSync(filename,'utf8'));requireThat(current.fingerprint===prior.fingerprint,'LOCAL_PERSISTENCE_MISMATCH');}
  verifyPrivateDirectoryAgain();
  const result={status:'passed',mode,hostedAccess:false,localWrites:false,fingerprint:current.fingerprint,targets:Object.fromEntries(Object.entries(current.targets).map(([k,t])=>[k,{tables:t.tables.length,functions:t.functions.length,sequences:t.sequences.length,roles:t.roles.length}]))};
  fs.writeFileSync(`output/supabase-local-copy-2026-11-09/persistence-${mode}.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runPersistence(process.argv[2])));}catch(e){console.error(JSON.stringify({status:'stopped',code:safeCode(e),hostedAccess:false}));process.exitCode=1;}
}
