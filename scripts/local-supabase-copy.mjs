// TASK-064 DB owner: source inspection/export only; never import application startup.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import { loadPrivateConfiguration } from '../migrations/audit/execute-runtime-setup.mjs';
import { client, connect, safeCode, requireThat } from '../migrations/audit/runtime-support.mjs';
import {connection} from '../migrations/audit/runtime-support.mjs';

export const COPY_SCHEMAS = Object.freeze({
  source: ['public', 'audit_contract', 'audit_capture', 'audit_rehearsal'],
  destination: ['audit_contract', 'audit', 'audit_rehearsal'],
});
// Explicit local-only host endpoints; Docker's internal service ports stay unchanged.
export const LOCAL_COPY_PORTS=Object.freeze({source:15422,destination:15432,api:15421});
export function localAdminConnection(target,status,bootstrap){
  requireThat(Object.hasOwn(COPY_SCHEMAS,target),'COPY_LOCAL_TARGET_REJECTED');
  const u=new URL(status.DB_URL);
  requireThat(['postgres:','postgresql:'].includes(u.protocol)&&u.hostname==='127.0.0.1'&&u.port===String(LOCAL_COPY_PORTS.source)&&u.pathname==='/postgres'&&decodeURIComponent(u.username)==='postgres'&&u.password&&!u.hash&&!u.search,'COPY_LOCAL_STATUS_ENDPOINT_REJECTED');
  const password=target==='source'?decodeURIComponent(u.password):bootstrap.auditAdminPassword;
  requireThat(typeof password==='string'&&password.length>0&&!/[\r\n\0]/.test(password),'COPY_LOCAL_ADMIN_PASSWORD_REJECTED');
  return{host:'127.0.0.1',port:LOCAL_COPY_PORTS[target],database:'postgres',user:target==='source'?'supabase_admin':'postgres',password,ssl:false,connectionTimeoutMillis:5000,query_timeout:15000};
}
export const PRIVATE_DIRECTORY=path.resolve('outputs/supabase-local-private');
export const POSTGRES_IMAGE='postgres@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac';
export const NATIVE_BIN=path.resolve('outputs/supabase-local-tools/pgsql/bin');
let privateDirectoryVerified=false;
export function ensurePrivateDirectory() {
  if(privateDirectoryVerified){requireThat(fs.lstatSync(PRIVATE_DIRECTORY).isDirectory()&&!fs.lstatSync(PRIVATE_DIRECTORY).isSymbolicLink()&&fs.realpathSync(PRIVATE_DIRECTORY).toLowerCase()===PRIVATE_DIRECTORY.toLowerCase(),'COPY_PRIVATE_DIRECTORY_CHANGED');return PRIVATE_DIRECTORY;}
  requireThat(process.platform==='win32','COPY_PRIVATE_WINDOWS_REQUIRED');
  requireThat(spawnSync('git.exe',['check-ignore','--','outputs/supabase-local-private/probe'],{encoding:'utf8',windowsHide:true}).status===0,'COPY_PRIVATE_NOT_IGNORED');
  const exists=fs.existsSync(PRIVATE_DIRECTORY);
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File','scripts/protect-local-supabase-private.ps1',...(exists?['-VerifyOnly']:[])],{windowsHide:true,encoding:'utf8'});
  requireThat(result.status===0,'COPY_PRIVATE_ACL_REJECTED');
  privateDirectoryVerified=true;
  return PRIVATE_DIRECTORY;
}
export function verifyPrivateDirectoryAgain(){privateDirectoryVerified=false;return ensurePrivateDirectory();}
export function privateArtifact(name) {
  requireThat(/^[a-z0-9][a-z0-9.-]{0,90}$/.test(name),'COPY_PRIVATE_NAME_REJECTED');
  const directory=ensurePrivateDirectory();const artifact=path.join(directory,name);
  if(fs.existsSync(artifact))requireThat(!fs.lstatSync(artifact).isSymbolicLink(),'COPY_PRIVATE_SYMLINK_REJECTED');
  return artifact;
}
export function safeDocker(args,options={}) {
  const result=spawnSync('docker.exe',args,{windowsHide:true,maxBuffer:64*1024*1024,timeout:180000,...options});
  if(result.error||result.status!==0){
    const detail=String(result.stderr||'');
    const classification=/certificate|SSL error|TLS/i.test(detail)?'TLS':/could not translate|Name does not resolve|no such host/i.test(detail)?'DNS':/permission denied|row-level security/i.test(detail)?'PRIVILEGE':/snapshot/i.test(detail)?'SNAPSHOT':/password authentication failed/i.test(detail)?'AUTHENTICATION':/connection refused|timed out|could not connect/i.test(detail)?'CONNECTIVITY':/mount|pipe|docker daemon|image/i.test(detail)?'DOCKER':'TOOL';
    const file=privateArtifact(`docker-failure-${Date.now()}.log`);
    fs.writeFileSync(file,JSON.stringify({status:result.status,errorCode:result.error?.code,signal:result.signal})+'\n'+detail,{flag:'wx'});
    requireThat(false,`COPY_DOCKER_${classification}_FAILED`);
  }
  return result.stdout;
}
export function containerSourceDiagnostic(){
  const{configs,cas}=loadPrivateConfiguration(),c=connection(configs.source,'source');
  const script="IFS= read -r PGHOST; IFS= read -r PGUSER; IFS= read -r PGPASSWORD; export PGHOST PGUSER PGPASSWORD; export PGPORT=5432 PGDATABASE=postgres PGCONNECT_TIMEOUT=10 PGSSLMODE=verify-full PGSSLROOTCERT=/copy-ca.crt; export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000'; exec psql --no-psqlrc --no-password --tuples-only --no-align --command \"SELECT current_setting('transaction_read_only')='on',current_setting('server_version_num')\"";
  const output=safeDocker(['run','--rm','-i','--network','bridge','--mount',`type=bind,source=${path.resolve(cas.source.certPath)},target=/copy-ca.crt,readonly`,'--entrypoint','/bin/sh',POSTGRES_IMAGE,'-c',script],{input:Buffer.from([c.host,c.user,c.password,''].join('\n'))});
  requireThat(/^t\|170011\s*$/.test(output.toString()),'COPY_CONTAINER_DIAGNOSTIC_RESULT_REJECTED');
  return{status:'passed',dockerSourceReadOnly:true,version:'170011',sourceWrites:false};
}
export function provisionAudit(){
  const file=privateArtifact('local-bootstrap.json');
  requireThat(!fs.existsSync(file),'COPY_BOOTSTRAP_EXISTS_NO_OVERWRITE');
  requireThat(safeDocker(['ps','-a','--filter','name=^fitsmytime-local-audit$','--format','{{.Names}}']).toString().trim()==='','COPY_AUDIT_CONTAINER_EXISTS');
  requireThat(safeDocker(['volume','ls','--filter','name=^fitsmytime-local-audit-data$','--format','{{.Name}}']).toString().trim()==='','COPY_AUDIT_VOLUME_EXISTS');
  const config={auditAdminPassword:randomBytes(32).toString('base64url'),roles:Object.fromEntries(['fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','fmt_audit_writer_dev','fmt_audit_reader_dev'].map(role=>[role,randomBytes(32).toString('base64url')]))};
  fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
  safeDocker(['volume','create','--label','com.fitsmytime.local-copy=TASK-064','fitsmytime-local-audit-data']);
  safeDocker(['run','-d','--name','fitsmytime-local-audit','--label','com.fitsmytime.local-copy=TASK-064','--restart','unless-stopped','--network','fitsmytime-local','--mount','type=volume,source=fitsmytime-local-audit-data,target=/var/lib/postgresql/data','--env','POSTGRES_PASSWORD','--env','POSTGRES_DB=postgres','--health-cmd','pg_isready -U postgres -d postgres','--health-interval','5s','--health-timeout','3s','--health-retries','15',POSTGRES_IMAGE],{env:{...process.env,POSTGRES_PASSWORD:config.auditAdminPassword}});
  return{status:'started',container:'fitsmytime-local-audit',gatewayPort:LOCAL_COPY_PORTS.destination,hostPortsPublished:false,protectedBootstrap:true,remoteWrites:false};
}
export function roleStatements(target,manifest,bootstrap){
  const meta=manifest.targets[target];
  return meta.roles.map(role=>{
    requireThat(!role.super&&!role.createdb&&!role.createrole&&!role.bypassrls&&!role.replication,'COPY_SOURCE_ROLE_PRIVILEGES_REJECTED');
    const pass=bootstrap.roles[role.name];
    requireThat(!role.login||(/^[A-Za-z0-9_-]{40,50}$/.test(pass||'')),'COPY_NEW_ROLE_PASSWORD_MISSING');
    return `CREATE ROLE ${quoteIdentifier(role.name)} ${role.login?'LOGIN':'NOLOGIN'} INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT ${Number(role.limit)}${role.login?` PASSWORD '${pass}'`:''};`;
  }).concat(meta.memberships.map(m=>`GRANT ${quoteIdentifier(m.role)} TO ${quoteIdentifier(m.member)} WITH ADMIN ${m.admin?'TRUE':'FALSE'}, INHERIT ${m.inherit?'TRUE':'FALSE'}, SET ${m.set?'TRUE':'FALSE'};`)).join('\n');
}
function archiveSql(name,manifest){
  const expected=Object.values(manifest.targets).flatMap(t=>t.archives).find(a=>a.file===name);
  requireThat(expected,'COPY_ARCHIVE_NOT_IN_MANIFEST');
  const bytes=fs.readFileSync(privateArtifact(name));
  requireThat(bytes.length===expected.bytes&&createHash('sha256').update(bytes).digest('hex')===expected.sha256,'COPY_ARCHIVE_HASH_REJECTED');
  // Linux decoding preserves original function-body LF bytes; Windows stdout text mode does not.
  return safeDocker(['exec','-i','fitsmytime-local-audit','pg_restore','--no-publications','--no-subscriptions','--file=-'],{input:bytes}).toString('utf8');
}
function localPsql(target,sql){
  const name=target==='source'?'supabase_db_fitsmytime-local':'fitsmytime-local-audit';
  const principal=target==='source'?'supabase_admin':'postgres';
  return safeDocker(['exec','-i',name,'psql','-U',principal,'-d','postgres','--no-psqlrc','--set=ON_ERROR_STOP=1','--quiet'],{input:Buffer.from(sql)}).toString();
}
export function restoreLocal(){
  const manifest=JSON.parse(fs.readFileSync(privateArtifact('export-manifest.json'),'utf8'));
  const bootstrap=JSON.parse(fs.readFileSync(privateArtifact('local-bootstrap.json'),'utf8'));
  requireThat(manifest.status==='passed'&&manifest.sourceWrites===false,'COPY_EXPORT_MANIFEST_REJECTED');
  const authState=safeDocker(['inspect','supabase_auth_fitsmytime-local','--format','{{.State.Running}}']).toString().trim();
  requireThat(authState==='false','COPY_AUTH_MUST_BE_STOPPED');
  const report={status:'in-progress',hostedWrites:false,sourceSessionsCopied:false,sourceAuthTokensCleared:false,targets:{}};
  for(const target of ['destination','source']){
    const existing=localPsql(target,"SELECT count(*)::int AS count FROM pg_namespace WHERE nspname IN ('audit_contract','audit_capture','audit');");
    requireThat(/\b0\b/.test(existing),'COPY_LOCAL_TARGET_ALREADY_POPULATED');
    const main=archiveSql(`${target}-application.dump`,manifest);
    let sql='BEGIN;\nSET LOCAL session_replication_role=replica;\n'+roleStatements(target,manifest,bootstrap)+'\n';
    if(target==='source'){
      const empty=localPsql(target,"SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) AND NOT EXISTS(SELECT 1 FROM auth.users) THEN 'COPY_EMPTY' ELSE 'COPY_NOT_EMPTY' END;");
      requireThat(empty.includes('COPY_EMPTY')&&!empty.includes('COPY_NOT_EMPTY'),'COPY_LOCAL_APPLICATION_NOT_EMPTY');
      sql+='DROP SCHEMA public;\n';
    }
    sql+=main+'\n';
    if(target==='source'){
      sql+=archiveSql('source-auth.dump',manifest)+'\n';
      // A copied user may sign in, but no existing hosted confirmation/recovery token works locally.
      sql+=`UPDATE auth.users SET confirmation_token='',recovery_token='',email_change_token_new='',email_change_token_current='',reauthentication_token='',phone_change_token='';\n`;
      sql+=`DO $copy$ BEGIN IF EXISTS(SELECT 1 FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL) THEN RAISE EXCEPTION 'Local identity invariant failed'; END IF; END $copy$;\n`;
    }
    for(const [name,count]of Object.entries(manifest.targets[target].counts)){
      const[schema,table]=name.split('.');
      sql+=`DO $copy$ BEGIN IF (SELECT count(*) FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}) <> ${Number(count)} THEN RAISE EXCEPTION 'Local row-count mismatch'; END IF; END $copy$;\n`;
    }
    sql+='SET LOCAL session_replication_role=origin;\nCOMMIT;\n';
    fs.writeFileSync(privateArtifact(`${target}-restore.sql`),sql,{flag:'wx'});
    localPsql(target,sql);
    report.targets[target]={status:'restored',tables:Object.keys(manifest.targets[target].counts).length,rowCountsMatch:true};
  }
  report.status='passed';report.sourceAuthTokensCleared=true;
  fs.writeFileSync('output/supabase-local-copy-2026-11-09/database-restore-result.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return report;
}
export const FUNCTION_METADATA_SQL=`SELECT n.nspname AS schema,p.proname AS name,
 pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS hash,
 pg_get_userbyid(p.proowner) AS owner,p.proconfig AS config,p.prosecdef AS securitydefiner,
 p.provolatile AS volatility,p.proacl::text AS acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname=ANY($1::text[]) AND p.prokind IN ('f','p')
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)`;
export async function correctFunctionFidelity(){
  const{default:pg}=await import('pg');
  const manifest=JSON.parse(fs.readFileSync(privateArtifact('export-manifest.json'),'utf8'));
  const bootstrap=JSON.parse(fs.readFileSync(privateArtifact('local-bootstrap.json'),'utf8'));
  const status=JSON.parse(fs.readFileSync(privateArtifact('supabase-status.json'),'utf8'));
  const report={status:'in-progress',sourceWrites:false,sourceReads:false,correction:'Windows native SQL output newline conversion',targets:{}};
  for(const target of ['source','destination']){
    let local;
    try{
      const name=`${target}-application.dump`,archive=privateArtifact(name);
      archiveSql(name,manifest); // Verifies archive digest before decoding selected TOC entries.
      // --list stops after the TOC and can close stdin early (EPIPE through Docker).
      // Native TOC text contains no routine bodies, so Windows line endings are harmless here.
      const tocTool=spawnSync(path.join(NATIVE_BIN,'pg_restore.exe'),['--list',archive],{windowsHide:true,maxBuffer:8*1024*1024,timeout:60000});
      requireThat(!tocTool.error&&tocTool.status===0,'COPY_ARCHIVE_TOC_FAILED');
      const toc=tocTool.stdout.toString('utf8');
      const lines=toc.split(/\r?\n/).filter(line=>/^\d+; \d+ \d+ FUNCTION /.test(line));
      requireThat(lines.length>0,'COPY_ARCHIVE_FUNCTIONS_MISSING');
      const list=privateArtifact(`${target}-functions.list`);
      const listText=lines.join('\n')+'\n';
      if(fs.existsSync(list))requireThat(fs.readFileSync(list,'utf8')===listText,'COPY_FUNCTION_TOC_CHANGED');else fs.writeFileSync(list,listText,{flag:'wx'});
      const functionSql=safeDocker(['run','--rm','--network','none','--mount',`type=bind,source=${archive},target=/archive.dump,readonly`,'--mount',`type=bind,source=${list},target=/functions.list,readonly`,'--entrypoint','pg_restore',POSTGRES_IMAGE,'--use-list=/functions.list','--schema-only','--file=-','/archive.dump']).toString('utf8');
      requireThat((functionSql.match(/^CREATE FUNCTION /gm)||[]).length===lines.length&&!/^(?:CREATE TABLE|COPY|INSERT|DROP )/m.test(functionSql),'COPY_SELECTED_FUNCTION_SQL_REJECTED');
      // pg_restore emits matched restriction commands; pg sends SQL directly and does not parse psql commands.
      const statements=functionSql.replace(/^\\(?:un)?restrict[^\r\n]*(?:\r?\n|$)/gm,'').replace(/^CREATE FUNCTION /gm,'CREATE OR REPLACE FUNCTION ');
      const functionFile=privateArtifact(`${target}-exact-functions.sql`);
      if(fs.existsSync(functionFile))requireThat(fs.readFileSync(functionFile,'utf8')===statements,'COPY_FUNCTION_SQL_CHANGED');else fs.writeFileSync(functionFile,statements,{flag:'wx'});
      local=new pg.Client(localAdminConnection(target,status,bootstrap));
      await local.connect();await local.query('BEGIN');
      const before=(await local.query(FUNCTION_METADATA_SQL,[COPY_SCHEMAS[target]])).rows;
      requireThat(before.length===lines.length,'COPY_FUNCTION_COUNT_MISMATCH');
      await local.query(statements);
      const actual=(await local.query(FUNCTION_METADATA_SQL,[COPY_SCHEMAS[target]])).rows;
      const stable=rows=>rows.map(({definition,hash,...r})=>r);
      requireThat(JSON.stringify(stable(actual))===JSON.stringify(stable(before)),'COPY_FUNCTION_OWNER_CONFIG_ACL_CHANGED');
      for(const routine of actual){
        const marker=`CREATE OR REPLACE FUNCTION ${routine.schema}.${routine.name}(`;
        const start=statements.indexOf(marker);requireThat(start>=0,'COPY_FUNCTION_ARCHIVE_NAME_MISSING');
        const afterStart=statements.slice(start),opening=afterStart.match(/\bAS (\$[A-Za-z0-9_]*\$)/);
        requireThat(opening,'COPY_FUNCTION_BODY_DELIMITER_MISSING');
        const bodyStart=opening.index+opening[0].length,bodyEnd=afterStart.indexOf(opening[1],bodyStart);
        requireThat(bodyEnd>=bodyStart&&createHash('sha256').update(afterStart.slice(bodyStart,bodyEnd)).digest('hex')===routine.hash,'COPY_FUNCTION_ARCHIVE_HASH_MISMATCH');
      }
      await local.query('COMMIT');
      report.targets[target]={functions:actual.length,hashesOwnersConfigsAclsExact:true};
    }catch(e){if(local)await local.query('ROLLBACK').catch(()=>{});fs.writeFileSync(privateArtifact(`function-correction-failure-${Date.now()}.log`),String(e?.stack||e),{flag:'wx'});throw e;}
    finally{if(local)await local.end();}
  }
  report.status='passed';
  verifyPrivateDirectoryAgain();
  fs.writeFileSync('output/supabase-local-copy-2026-11-09/function-fidelity-result.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return report;
}
export const AUTH_TABLES=Object.freeze(['users','identities','mfa_factors','mfa_recovery_code_sets','mfa_recovery_codes','webauthn_credentials']);
export function quoteIdentifier(value){requireThat(/^[a-z_][a-z0-9_]*$/.test(value),'COPY_IDENTIFIER_REJECTED');return `"${value}"`;}
export function sourceDumpArguments(target,snapshot,mode) {
  requireThat(Object.hasOwn(COPY_SCHEMAS,target)&&/^[A-F0-9]+-[A-F0-9]+-[0-9]+$/.test(snapshot),'COPY_SNAPSHOT_REJECTED');
  requireThat(['application','auth'].includes(mode)&&(mode!=='auth'||target==='source'),'COPY_DUMP_MODE_REJECTED');
  return ['--format=custom','--no-password',`--snapshot=${snapshot}`,'--lock-wait-timeout=10s',
    ...(mode==='auth'?['--data-only',...AUTH_TABLES.map(name=>`--table=auth.${name}`)]:COPY_SCHEMAS[target].map(name=>`--schema=${name}`)),
    ...(target==='source'&&mode==='application'?['--exclude-table-data=public.sessions']:[])];
}
function exportArchive(config,ca,target,snapshot,mode){
  const c=connection(config,target),file=privateArtifact(`${target}-${mode}.dump`);
  requireThat(!fs.existsSync(file),'COPY_ARCHIVE_EXISTS_NO_OVERWRITE');
  const args=sourceDumpArguments(target,snapshot,mode);
  const clean=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^PG/i.test(name)));
  const result=spawnSync(path.join(NATIVE_BIN,'pg_dump.exe'),args,{windowsHide:true,maxBuffer:64*1024*1024,timeout:180000,env:{...clean,PGHOST:c.host,PGPORT:'5432',PGUSER:c.user,PGPASSWORD:c.password,PGDATABASE:'postgres',PGCONNECT_TIMEOUT:'10',PGSSLMODE:'verify-full',PGSSLROOTCERT:path.resolve(ca.certPath),PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=10000'}});
  if(result.error||result.status!==0){fs.writeFileSync(privateArtifact(`native-export-failure-${Date.now()}.log`),String(result.stderr||result.error?.code||'failed'),{flag:'wx'});requireThat(false,'COPY_NATIVE_EXPORT_FAILED');}
  const bytes=result.stdout;
  requireThat(bytes.subarray(0,5).toString()==='PGDMP','COPY_ARCHIVE_FORMAT_REJECTED');
  fs.writeFileSync(file,bytes,{flag:'wx'});
  return {file:path.basename(file),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export async function exportSources(){
  ensurePrivateDirectory();
  const {configs,cas}=loadPrivateConfiguration();
  const report={status:'in-progress',sourceWrites:false,sourceSessionsCopied:false,targets:{}};
  for(const target of ['source','destination']){
    const x=await client(configs[target],target,cas[target]);
    try{
      await connect(x);await x.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await x.query("SET LOCAL idle_in_transaction_session_timeout='600000'");
      const snapshot=(await x.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
      const scopes=[...COPY_SCHEMAS[target],...(target==='source'?['auth']:[])];
      const metadata=(await x.query(METADATA_SQL,[scopes])).rows[0];
      requireThat(metadata.readonly,'COPY_EXPORT_READONLY_REQUIRED');
      const tables=metadata.relations.filter(r=>r.kind==='r'&&(COPY_SCHEMAS[target].includes(r.schema)||(r.schema==='auth'&&AUTH_TABLES.includes(r.name))));
      const counts={};
      for(const r of tables){const name=`${r.schema}.${r.name}`;counts[name]=(await x.query(`SELECT count(*)::text AS count FROM ${quoteIdentifier(r.schema)}.${quoteIdentifier(r.name)}`)).rows[0].count;}
      if(target==='source')counts['public.sessions']='0';
      const columns=(await x.query(`SELECT n.nspname AS schema,c.relname AS table,a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS notnull,a.attgenerated AS generated FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname,c.relname,a.attnum`,[scopes])).rows;
      const archives=[exportArchive(configs[target],cas[target],target,snapshot,'application')];
      if(target==='source')archives.push(exportArchive(configs[target],cas[target],target,snapshot,'auth'));
      report.targets[target]={version:metadata.version,counts,roles:metadata.roles,memberships:metadata.memberships,columns,archives};
      await x.query('ROLLBACK');
    }finally{await x.end();}
  }
  report.status='passed';
  fs.writeFileSync(privateArtifact('export-manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  const safe={status:'passed',sourceWrites:false,sourceSessionsCopied:false,targets:Object.fromEntries(Object.entries(report.targets).map(([k,t])=>[k,{tables:Object.keys(t.counts).length,rows:Object.values(t.counts).reduce((a,n)=>a+Number(n),0),archives:t.archives}]))};
  fs.writeFileSync('output/supabase-local-copy-2026-11-09/export-result.json',JSON.stringify(safe,null,2)+'\n',{flag:'wx'});
  return safe;
}
export const METADATA_SQL = `SELECT current_setting('server_version_num') AS version,
 current_setting('transaction_read_only')='on' AS readonly,
 pg_database_size(current_database())::text AS database_bytes,
 (SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner)) ORDER BY nspname)
  FROM pg_namespace WHERE nspname=ANY($1::text[])) AS schemas,
 (SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,
    'owner',pg_get_userbyid(c.relowner),'bytes',pg_total_relation_size(c.oid),
    'select',has_table_privilege(current_user,c.oid,'SELECT')) ORDER BY n.nspname,c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','S')) AS relations,
 (SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,
    'createdb',rolcreatedb,'createrole',rolcreaterole,'bypassrls',rolbypassrls,
    'replication',rolreplication,'limit',rolconnlimit) ORDER BY rolname)
  FROM pg_roles WHERE rolname LIKE 'fm_%' OR rolname LIKE 'fmt_%') AS roles,
 (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,
    'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname)
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
  WHERE r.rolname LIKE 'fm_%' OR r.rolname LIKE 'fmt_%' OR m.rolname LIKE 'fm_%' OR m.rolname LIKE 'fmt_%') AS memberships,
 (SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',n.nspname) ORDER BY extname)
  FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace) AS extensions`;

export async function inventory() {
  const {configs,cas}=loadPrivateConfiguration();
  const report={status:'in-progress',sourceWrites:false,credentialsPrinted:false,targets:{}};
  for (const target of ['source','destination']) {
    const x=await client(configs[target],target,cas[target]);
    try {
      await connect(x);
      await x.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const schemas=[...COPY_SCHEMAS[target],...(target==='source'?['auth','storage']:[])];
      const metadata=(await x.query(METADATA_SQL,[schemas])).rows[0];
      requireThat(metadata.readonly && Number(metadata.version)>=170000 && Number(metadata.version)<180000,'COPY_SOURCE_VERSION_OR_READONLY_REJECTED');
      report.targets[target]=metadata;
      await x.query('ROLLBACK');
    } finally { await x.end(); }
  }
  report.status='passed';
  fs.mkdirSync('output/supabase-local-copy-2026-11-09',{recursive:true});
  fs.writeFileSync('output/supabase-local-copy-2026-11-09/source-metadata.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return {status:'passed',sourceWrites:false,targets:Object.fromEntries(Object.entries(report.targets).map(([target,m])=>[target,{version:m.version,databaseBytes:m.database_bytes,relations:m.relations.length,customRoles:m.roles.length,inaccessibleRelations:m.relations.filter(r=>r.kind!=='S'&&!r.select).map(r=>`${r.schema}.${r.name}`)}]))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try { requireThat(process.argv.length===3&&['inventory','export','container-diagnostic','provision-audit','restore','correct-functions'].includes(process.argv[2]),'COPY_MODE_REJECTED');console.log(JSON.stringify(await (process.argv[2]==='inventory'?inventory():process.argv[2]==='container-diagnostic'?containerSourceDiagnostic():process.argv[2]==='provision-audit'?provisionAudit():process.argv[2]==='restore'?restoreLocal():process.argv[2]==='correct-functions'?correctFunctionFidelity():exportSources()))); }
  catch(e){console.error(JSON.stringify({status:'stopped',code:safeCode(e),sourceWrites:false,automaticRetry:false}));process.exitCode=1;}
}
