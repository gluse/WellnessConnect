import assert from 'node:assert/strict';
import {decodePrivateUtf8,patchPrivateEnvironment,makePrivateRuntimePlan} from '../migrations/audit/private-runtime-plan.mjs';
import {TARGETS} from '../migrations/audit/runtime-contract.mjs';
if(process.argv.length!==3||process.argv[2]!=='offline'){process.stdout.write('{"stage":"stopped","code":"MODE_REJECTED"}\n');process.exit(1);}
let checks=0;const check=work=>{work();checks++;};
const original='# preserve\r\nUNRELATED = "literal$`\\n"\nexport DATABASE_URL = "old"\r\nAUDIT_DATABASE_URL="old-destination"\nLAST=value';
check(()=>assert.equal(decodePrivateUtf8(Buffer.from('\ufeffA=one\r\nB=two\n')), '\ufeffA=one\r\nB=two\n'));
check(()=>assert.throws(()=>decodePrivateUtf8(Buffer.from([0xff])),/PRIVATE_UTF8_ROUNDTRIP_REJECTED/));
check(()=>assert.equal(patchPrivateEnvironment('\ufeffDATABASE_URL=old\n',{DATABASE_URL:'new'}),'\ufeffDATABASE_URL="new"\n'));
const patched=patchPrivateEnvironment(original,{DATABASE_URL:'new',AUDIT_ENABLED:'false'},['AUDIT_DATABASE_URL']);
check(()=>assert.ok(patched.startsWith('# preserve\r\nUNRELATED = "literal$`\\n"\nexport DATABASE_URL = "new"\r\nLAST=value')));
check(()=>assert.ok(patched.endsWith('\r\nAUDIT_ENABLED="false"\r\n')));
check(()=>assert.throws(()=>patchPrivateEnvironment('DATABASE_URL=a\nDATABASE_URL=b\n',{DATABASE_URL:'new'}),/DUPLICATE_PRIVATE_PATCH_KEY/));
check(()=>assert.throws(()=>patchPrivateEnvironment('',{A:'a\nb'}),/PRIVATE_PATCH_VALUE_REJECTED/));
check(()=>assert.throws(()=>patchPrivateEnvironment('',{'not-valid':'x'}),/PRIVATE_PATCH_VALUE_REJECTED/));
const configs={source:`postgresql://postgres:synthetic-owner@db.${TARGETS.source}.supabase.co:5432/postgres`,
 destination:`postgresql://postgres:synthetic-owner@db.${TARGETS.destination}.supabase.co:5432/postgres`};
const passwords={app:'a'.repeat(43),capture:'b'.repeat(43),worker:'c'.repeat(43),writer:'d'.repeat(43)};
const plan=makePrivateRuntimePlan(original,configs,{source:{certPath:'C:/synthetic-ca.crt'},destination:{certPath:'C:/synthetic-ca.crt'}},passwords);
check(()=>assert.equal(plan.backup,original));
check(()=>assert.ok(!plan.app.includes('synthetic-owner')));
check(()=>assert.ok(plan.setup.includes(configs.source)&&plan.setup.includes(configs.destination)));
check(()=>assert.ok(!plan.worker.includes('synthetic-owner')));
for(const key of ['app','capture','worker','writer']){
 const uri=new URL(plan.urls[key]);check(()=>assert.equal(decodeURIComponent(uri.password),passwords[key]));
 check(()=>assert.equal(uri.searchParams.get('sslmode'),'verify-full'));
 check(()=>assert.equal(uri.searchParams.get('sslrootcert'),'C:/synthetic-ca.crt'));
}
for(const flag of ['AUDIT_ENABLED','AUDIT_WORKER_ENABLED','AUDIT_AUTH_EVENTS_ENABLED'])check(()=>assert.ok(plan.app.includes(flag+'="false"')));
check(()=>assert.throws(()=>makePrivateRuntimePlan(original,configs,{},{app:'short'}),/PRIVATE_PASSWORD_MATERIAL_REJECTED/));
const withSetup=makePrivateRuntimePlan(original+'\nAUDIT_SETUP_SOURCE_DATABASE_URL="synthetic-owner"\nAUDIT_SETUP_DESTINATION_DATABASE_URL="synthetic-owner"\n',
 configs,{source:{certPath:'C:/synthetic-ca.crt'},destination:{certPath:'C:/synthetic-ca.crt'}},passwords);
check(()=>assert.ok(!withSetup.app.includes('AUDIT_SETUP_SOURCE_DATABASE_URL')&&!withSetup.app.includes('AUDIT_SETUP_DESTINATION_DATABASE_URL')));
process.stdout.write(JSON.stringify({stage:'private-runtime-plan-tests',status:'passed',checks,privateFileAccess:false,databaseAccess:false})+'\n');
