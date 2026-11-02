// Authorized source-project metadata inventory only; never prints secret values.
import {readFile,stat,readdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const target='hbkooiknruimukkhshrk';
const files=['.env','.env.audit-setup.local','.env.audit-test.local','.env.audit-before-runtime.local','.env.stripe-app.local','.env.audit-acl-before.local'];
for(const file of files) {
 let content;try {content=await readFile(new URL('../../'+file,import.meta.url),'utf8');}catch{console.log(JSON.stringify({file,available:false}));continue;}
 const entries=parse(content), names=Object.keys(entries).filter(name=>/DATABASE|SUPABASE|BACKUP|CA_|PG|PASSWORD|TOKEN/.test(name));
 const sourceConnections=[];
 for(const [key,value]of Object.entries(entries)) {
  if(!/^(postgres|postgresql):\/\//.test(value))continue;
  try {const url=new URL(value);if(url.hostname.includes(target)||decodeURIComponent(url.username).endsWith('.'+target)) {
   sourceConnections.push({key,principal:decodeURIComponent(url.username).replace('.'+target,''),database:url.pathname.slice(1),port:url.port||'5432',hostMatchesTarget:url.hostname.includes(target),pooler:url.hostname.includes('pooler'),hasPassword:Boolean(url.password)});
  }}catch{}
 }
 console.log(JSON.stringify({file,names,sourceConnections}));
}
try {
 const directory=new URL('../../database-backups/',import.meta.url),names=await readdir(directory);
 const files=await Promise.all(names.slice(-20).map(async name=>{const data=await stat(new URL(name,directory));return{name,bytes:data.size,modifiedAt:data.mtime.toISOString(),file:data.isFile()};}));
 console.log(JSON.stringify({backupDirectoryAvailable:true,files}));
}catch{console.log(JSON.stringify({backupDirectoryAvailable:false}));}
