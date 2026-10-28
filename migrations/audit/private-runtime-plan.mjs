// Pure private-text transformation. Never prints or writes credential material.
import {requireThat,roleURL} from './runtime-support.mjs';
import {ROLES} from './runtime-contract.mjs';
export function decodePrivateUtf8(bytes){
 try{const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  requireThat(Buffer.from(text,'utf8').equals(bytes),'PRIVATE_UTF8_ROUNDTRIP_REJECTED');return text;
 }catch{requireThat(false,'PRIVATE_UTF8_ROUNDTRIP_REJECTED');}
}
export function patchPrivateEnvironment(original,patches,remove=[]){
 requireThat(typeof original==='string'&&!original.includes('\0'),'PRIVATE_TEXT_REJECTED');
 const seen=new Set();const newline=original.match(/\r\n|\n|\r/)?.[0]||'\r\n';
 const lines=original.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g).filter(Boolean);
 const output=lines.map(line=>{
  const ending=line.match(/(?:\r\n|\n|\r)$/)?.[0]||'';
  const content=ending?line.slice(0,-ending.length):line;
  const match=content.match(/^(\s*(?:export\s+)?)([A-Z][A-Z0-9_]*)(\s*=\s*)(.*)$/);
  if(!match)return line;const key=match[2];
  if(!Object.hasOwn(patches,key)&&!remove.includes(key))return line;
  requireThat(!seen.has(key),'DUPLICATE_PRIVATE_PATCH_KEY');seen.add(key);
  if(remove.includes(key))return'';
  requireThat(typeof patches[key]==='string'&&!/[\r\n\0]/.test(patches[key]),'PRIVATE_PATCH_VALUE_REJECTED');
  return match[1]+key+match[3]+JSON.stringify(patches[key])+ending;
 }).join('');
 let result=output;
 for(const[key,value]of Object.entries(patches))if(!seen.has(key)){
  requireThat(/^[A-Z][A-Z0-9_]*$/.test(key)&&typeof value==='string'&&!/[\r\n\0]/.test(value),'PRIVATE_PATCH_VALUE_REJECTED');
  if(result&&!/[\r\n]$/.test(result))result+=newline;
  result+=key+'='+JSON.stringify(value)+newline;
 }return result;
}
export function makePrivateRuntimePlan(original,configs,cas,passwords){
 requireThat(Object.keys(passwords).length===4&&['app','capture','worker','writer'].every(k=>
  /^[A-Za-z0-9_-]{43}$/.test(passwords[k]||'')),'PRIVATE_PASSWORD_MATERIAL_REJECTED');
 const urls={app:roleURL(configs.source,'source',ROLES.app,passwords.app,cas.source.certPath),
  capture:roleURL(configs.source,'source',ROLES.capture,passwords.capture,cas.source.certPath),
  worker:roleURL(configs.source,'source',ROLES.worker,passwords.worker,cas.source.certPath),
  writer:roleURL(configs.destination,'destination',ROLES.writer,passwords.writer,cas.destination.certPath)};
 const setup='AUDIT_SETUP_SOURCE_DATABASE_URL='+JSON.stringify(configs.source)+'\r\n'
  +'AUDIT_SETUP_DESTINATION_DATABASE_URL='+JSON.stringify(configs.destination)+'\r\n';
 const worker='AUDIT_ENVIRONMENT="development"\r\nAUDIT_WORKER_ENABLED="false"\r\n'
  +'AUDIT_SOURCE_DATABASE_URL='+JSON.stringify(urls.worker)+'\r\nAUDIT_DATABASE_URL='+JSON.stringify(urls.writer)+'\r\n';
 const app=patchPrivateEnvironment(original,{DATABASE_URL:urls.app,AUDIT_CAPTURE_DATABASE_URL:urls.capture,
  AUDIT_ENABLED:'false',AUDIT_WORKER_ENABLED:'false',AUDIT_AUTH_EVENTS_ENABLED:'false',AUDIT_ENVIRONMENT:'development'},
  ['AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL','AUDIT_SETUP_SOURCE_DATABASE_URL','AUDIT_SETUP_DESTINATION_DATABASE_URL']);
 return{backup:original,setup,worker,app,urls};
}
