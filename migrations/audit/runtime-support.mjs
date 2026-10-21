// DB-owned fixed-target support. No environment/file/network access on import.
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {TARGETS} from './runtime-contract.mjs';
export const ROOT=path.resolve(import.meta.dirname,'../..');
export const CA_PIN='80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';
export function requireThat(ok,code){if(!ok){const e=new Error(code);e.safeCode=code;throw e;}}
export function safeCode(e){return e?.safeCode||(/^(?:[0-9A-Z]{5}|E[A-Z_]{2,60})$/.test(e?.code||'')?e.code:'UNCLASSIFIED_FAILURE');}
export function emit(stage,detail={}){process.stdout.write(JSON.stringify({stage,...detail})+'\n');}
export function readSettings(text){
 const values={};
 for(const line of text.split(/\r?\n/)){
  const m=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m)continue;
  requireThat(!Object.hasOwn(values,m[1]),'DUPLICATE_ENV_KEY');let v=m[2];
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  values[m[1]]=v;
 }return values;
}
export function connection(value,target,expectedUser){
 try{
  const u=new URL(value);const host=u.hostname.toLowerCase();const user=decodeURIComponent(u.username);
  const password=decodeURIComponent(u.password);const database=decodeURIComponent(u.pathname.slice(1));
  requireThat(['postgres:','postgresql:'].includes(u.protocol)&&!u.hash&&(!u.port||u.port==='5432'),'BAD_CONNECTION');
  requireThat(user&&password&&database&&!/[<>\r\n]/.test(user+password+database),'BAD_CONNECTION');
  const direct=host===`db.${TARGETS[target]}.supabase.co`;
  const pooler=/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host)&&user.endsWith(`.${TARGETS[target]}`);
  requireThat(direct||pooler,'WRONG_TARGET');
  const principal=pooler?user.slice(0,-21):user;
  requireThat(expectedUser?principal===expectedUser:principal==='postgres','WRONG_PRINCIPAL');
  for(const k of u.searchParams.keys())requireThat(['sslmode','sslrootcert','application_name','connect_timeout'].includes(k)&&u.searchParams.getAll(k).length===1,'URI_OVERRIDE_REJECTED');
  requireThat(!u.searchParams.has('sslmode')||['require','verify-ca','verify-full'].includes(u.searchParams.get('sslmode')),'TLS_MODE_REJECTED');
  return{u,host,user,password,database,principal};
 }catch(e){if(e?.safeCode)throw e;requireThat(false,'BAD_CONNECTION');}
}
export function trustedCA(source){
 const certPath=source.u.searchParams.get('sslrootcert');requireThat(certPath,'EXPLICIT_CA_REQUIRED');
 const pem=fs.readFileSync(certPath,'utf8');const c=new X509Certificate(pem);
 requireThat((pem.match(/BEGIN CERTIFICATE/g)||[]).length===1&&c.ca&&c.fingerprint256===CA_PIN&&c.checkIssued(c)&&c.verify(c.publicKey)&&Date.parse(c.validFrom)<=Date.now()&&Date.parse(c.validTo)>Date.now(),'CA_REJECTED');
 return{pem,certPath};
}
export function client(value,target,ca,user){
 const c=connection(value,target,user);
 const configured=c.u.searchParams.get('sslrootcert');
 if(configured)requireThat(new X509Certificate(fs.readFileSync(configured)).fingerprint256===CA_PIN,'CA_REJECTED');
 const x=new pg.Client({host:c.host,port:5432,user:c.user,password:c.password,database:c.database,
  ssl:{ca:ca.pem,rejectUnauthorized:true,servername:c.host,checkServerIdentity:tls.checkServerIdentity,minVersion:'TLSv1.2'},
  application_name:'fitsmytime-audit-runtime-setup',client_encoding:'UTF8',connectionTimeoutMillis:10000,query_timeout:90000});
 x.on('notice',()=>{});x.on('error',()=>{});return x;
}
export async function connect(x){await x.connect();requireThat(x.connection.stream.encrypted&&x.connection.stream.authorized,'TLS_NOT_VERIFIED');}
export function roleURL(value,target,role,password,certPath){const c=connection(value,target);const u=c.u;u.username=c.user.includes('.')?`${role}.${TARGETS[target]}`:role;u.password=password;u.search='';u.searchParams.set('sslmode','verify-full');u.searchParams.set('sslrootcert',certPath);return u.href;}
const files=new Set(['.env','.env.audit-setup.local','.env.audit-worker.local','.env.audit-test.local','.env.audit-before-runtime.local']);
export function privatePath(name){requireThat(files.has(name),'PRIVATE_PATH_REJECTED');const p=path.join(ROOT,name);if(fs.existsSync(p))requireThat(!fs.lstatSync(p).isSymbolicLink(),'PRIVATE_SYMLINK_REJECTED');return p;}
function fixed(program,args){const r=spawnSync(program,args,{cwd:ROOT,encoding:'utf8',windowsHide:true,shell:false});requireThat(r.status===0,'PRIVATE_ACL_OR_IGNORE_FAILED');return r.stdout;}
export function privatePreflight(){
 requireThat(process.platform==='win32','WINDOWS_PRIVATE_HANDOFF_ONLY');
 const out=fixed('whoami.exe',['/user','/fo','csv','/nh']);const sid=out.match(/S-1-5-\d+(?:-\d+)+/)?.[0];requireThat(sid,'CURRENT_USER_SID_UNAVAILABLE');
 for(const name of files)requireThat(fixed('git.exe',['check-ignore','--',name]).trim()===name,'PRIVATE_FILE_NOT_IGNORED');
 return sid;
}
export function privateWrite(name,value,sid,{newOnly=false}={}){
 const p=privatePath(name);if(newOnly)requireThat(!fs.existsSync(p),'PRIVATE_FILE_EXISTS');
 const temp=p+'.audit-tmp';requireThat(!fs.existsSync(temp),'PRIVATE_TEMP_EXISTS');
 const fd=fs.openSync(temp,'wx');fs.closeSync(fd);
 try{
  fixed('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',
    path.join(ROOT,'migrations/audit/protect-private-file.ps1'),'-TargetPath',temp,'-UserSid',sid]);
  fs.writeFileSync(temp,value);fs.renameSync(temp,p);
 }catch(e){if(fs.existsSync(temp))fs.unlinkSync(temp);throw e;}
}
export function replaceSettings(original,replace,remove=[]){
 const newline=original.includes('\r\n')?'\r\n':'\n';const seen=new Set();
 const result=original.split(/\r?\n/).filter(line=>{
  const key=line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/)?.[1];
  if(!key)return true;if(remove.includes(key))return false;
  if(Object.hasOwn(replace,key)){seen.add(key);return false;}return true;
 });
 while(result.at(-1)==='')result.pop();
 for(const [k,v]of Object.entries(replace)){requireThat(!/[\r\n]/.test(v),'MULTILINE_PRIVATE_VALUE');result.push(`${k}=${JSON.stringify(v)}`);}
 return result.join(newline)+newline;
}
export async function inRollback(x,work){await x.query('BEGIN');try{return await work(x);}finally{await x.query('ROLLBACK');}}
