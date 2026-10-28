// Changed-scope offline tests only. SQL is inspected/generated, never executed.
import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {getTableConfig,PgDialect} from 'drizzle-orm/pg-core';import * as schema from '../shared/schema.ts';
import {preparedBillingV2DDL} from './prepare-monthly-subscription-offers.mjs';
import {BILLING_EXPORTS} from '../migrations/billing/contract.mjs';
import {BILLING_V2_EXPORTS,BILLING_V2_TABLES,BILLING_V2_PROFILE_TABLES,BILLING_V2_FILES,BILLING_V2_RIGHTS,INITIAL_OFFER_ID} from '../migrations/billing/v2-contract.mjs';
import {billingV2CheckPlan,billingV2RelationContracts,verifyBillingV2Runtime} from '../migrations/billing/v2-runtime-profile.mjs';
import {BILLING_SQL} from '../migrations/billing/runtime-profile.mjs';
import {BILLING_AUDIT_EVENTS,BILLING_AUDIT_PINS,loadBillingAuditScripts,billingAuditFunctionContracts,billingAuditCheckPlan,verifyBillingAuditRuntime} from '../migrations/audit/billing-package.mjs';
import columns from '../migrations/billing/v2-columns.json' with {type:'json'};
assert.equal(process.argv.length,3);assert.equal(process.argv[2],'offline');
let checks=0;const check=fn=>{fn();checks++;};const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const sha=text=>createHash('sha256').update(text).digest('hex');
for(const [name,pin]of [['0010_monthly_billing.sql','8cef42902a4c7fe6d0a2a56e6b4393a0da040b422874eb54bbc3400bc5f28385'],['0011_monthly_billing_runtime.sql','f5bf16e8adb538cff19c613d569d123f85fdcc08a68b65425804aa0bacf3f4e5']])check(()=>assert.equal(sha(fs.readFileSync(new URL('../migrations/'+name,import.meta.url))),pin,'published v1 migration pin must not drift'));
const sql=read(BILLING_V2_FILES.schema),rights=read(BILLING_V2_FILES.runtime),security=read(BILLING_V2_FILES.transferSecurity),dialect=new PgDialect();
const expectedDDL=await preparedBillingV2DDL();check(()=>assert.equal(sql,expectedDDL));
check(()=>assert.equal((sql.match(/^CREATE TABLE /gm)||[]).length,4));
check(()=>assert.equal((sql.match(/ADD COLUMN/g)||[]).length,4));
check(()=>assert.equal((sql.match(/^INSERT INTO public\./gm)||[]).length,2));
check(()=>assert.doesNotMatch(sql,/^(UPDATE|DELETE|TRUNCATE|DROP)\b/gm));
check(()=>assert.doesNotMatch(sql,/SECURITY DEFINER|CREATE ROLE|CREATE SEQUENCE|ALTER DEFAULT PRIVILEGES/i));
check(()=>assert.match(sql,new RegExp(`VALUES\\('${INITIAL_OFFER_ID}',1,1900,'EUR','month',true,NULL\\)`)));
check(()=>assert.equal((sql.match(/^CREATE TRIGGER /gm)||[]).length,4));
check(()=>assert.match(sql,/BEFORE UPDATE OR DELETE ON public\.billing_offer_revisions/));
check(()=>assert.match(sql,/NEW\.revision<>OLD\.revision\+1/));
check(()=>assert.match(sql,/r\.version=NEW\.revision AND r\.issued_by IS NOT DISTINCT FROM NEW\.updated_by/));
check(()=>assert.match(sql,/OLD\.processor_price_id IS NOT NULL AND NEW\.processor_price_id IS DISTINCT FROM OLD\.processor_price_id/));
check(()=>assert.match(sql,/OLD\.offer_revision_id IS NOT NULL AND NEW\.offer_revision_id IS DISTINCT FROM OLD\.offer_revision_id/));
check(()=>assert.match(sql,/OLD\.price_mapping_id IS NOT NULL AND NEW\.price_mapping_id IS DISTINCT FROM OLD\.price_mapping_id/));
check(()=>assert.match(sql,/NEW\.processor_subscription_id,NEW\.approved_offer_ref,NEW\.currency,NEW\.interval/));
check(()=>assert.ok(!sql.includes('UPDATE public.provider_subscriptions')));
check(()=>assert.equal(BILLING_V2_PROFILE_TABLES.length,27));
check(()=>assert.deepEqual([...read('shared/schema.ts').matchAll(/\bpgTable\(\s*["']([a-z0-9_]+)["']/g)].map(m=>m[1]).sort(),[...BILLING_V2_PROFILE_TABLES].sort(),'current schema and full opt-in manifest must match exactly'));
check(()=>assert.deepEqual(BILLING_V2_RIGHTS.billing_offer_revisions,['SELECT','INSERT']));
check(()=>assert.deepEqual(BILLING_V2_RIGHTS.billing_offer_settings,['SELECT','UPDATE']));
check(()=>assert.match(rights,/GRANT SELECT,INSERT ON public\.billing_offer_revisions/));
check(()=>assert.match(rights,/GRANT SELECT,UPDATE ON public\.billing_offer_settings/));
check(()=>assert.doesNotMatch(rights,/GRANT[^;]*DELETE|CREATE ROLE|GRANT EXECUTE/));
check(()=>assert.equal((security.match(/^ALTER TABLE /gm)||[]).length,27));
for(const name of BILLING_V2_PROFILE_TABLES)check(()=>assert.ok(security.includes('public.'+name)));
const configs=new Map([...BILLING_EXPORTS,...BILLING_V2_EXPORTS].map(key=>{const t=getTableConfig(schema[key]);return[t.name,t];}));
for(const [name,config]of configs){
 check(()=>assert.equal(config.enableRLS,true));
 check(()=>assert.deepEqual(columns.find(c=>c.name===name).columns,config.columns.map(c=>[c.name,c.getSQLType().replaceAll(' ',''),c.notNull]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)));
 for(const fk of config.foreignKeys){
  check(()=>assert.ok(!fk.onDelete||fk.onDelete==='no action'));
  check(()=>assert.ok(Buffer.byteLength(fk.getName(),'utf8')<=63,'FK names must survive PostgreSQL identifier limits without truncation'));
 }
}
const checkSQL=name=>configs.get(name).checks.map(c=>dialect.sqlToQuery(c.value).sql).join('\n');
check(()=>assert.match(checkSQL('billing_offer_revisions'),/"amount_minor" > 0/));
check(()=>assert.match(checkSQL('billing_offer_revisions'),/"issued_by" IS NOT NULL OR .*"version" = 1/));
check(()=>assert.match(checkSQL('billing_offer_settings'),/"singleton" AND .*"revision" > 0/));
check(()=>assert.match(checkSQL('billing_price_mappings'),/"provider" = 'stripe'/));
check(()=>assert.match(checkSQL('billing_price_mappings'),/"state" = 'ready'\) = \(.*"processor_price_id" IS NOT NULL/));
for(const table of ['billing_operations','billing_subscriptions']){
 const t=configs.get(table),key=t.foreignKeys.find(f=>f.reference().name?.endsWith('_price_binding')).reference();
 check(()=>assert.deepEqual(key.columns.map(c=>c.name),['price_mapping_id','offer_revision_id','provider','merchant_account','mode']));
 check(()=>assert.deepEqual(key.foreignColumns.map(c=>c.name),['id','offer_id','provider','merchant_account','mode']));
 for(const n of ['offer_revision_id','price_mapping_id'])check(()=>assert.equal(t.columns.find(c=>c.name===n).notNull,false,'legacy references remain compatible'));
 check(()=>assert.match(checkSQL(table),/"price_mapping_id" IS NULL OR .*"offer_revision_id" IS NOT NULL/));
}
const mapping=configs.get('billing_price_mappings');
for(const [name,cols]of [['billing_price_offer_scope',['offer_id','provider','merchant_account','mode']],['billing_price_remote_identity',['provider','merchant_account','mode','processor_price_id']]]){
 const index=mapping.indexes.find(i=>i.config.name===name).config;
 check(()=>assert.equal(index.unique,true));check(()=>assert.deepEqual(index.columns.map(c=>c.name),cols));
}
check(()=>assert.equal(configs.get('billing_source_state').columns.find(c=>c.name==='workspace_id').primary,true));

function driver(plan,definitionSQL){let n=0;const calls=[];return{calls,async query(q,args){
 calls.push([q,args]);if(['BEGIN READ ONLY','ROLLBACK'].includes(q))return{};
 if(q===definitionSQL)return{rows:[{definition:'pending live semantic review'}]};
 assert.deepEqual([q,args],[plan[n][1],plan[n][2]]);n++;return{rows:[{catalog_contract:true}]};
}};}
for(const offerAccess of ['dormant','runtime']){
 const options={testAccess:'disabled',billingAccess:'runtime',offerAccess};
 const plan=billingV2CheckPlan(options),relations=billingV2RelationContracts('runtime',offerAccess);
 check(()=>assert.match(plan.find(p=>p[0]==='billingColumns')[1],/ORDER BY a\.attname COLLATE "C"/,'upgrades append columns physically; compare logical shape'));
 check(()=>assert.deepEqual(plan.find(p=>p[0]==='tables')[2],[BILLING_V2_PROFILE_TABLES]));
 check(()=>assert.ok(plan.every(([,q])=>/^\s*(SELECT|WITH)\b/.test(q))));
 check(()=>assert.equal(relations.filter(r=>BILLING_V2_TABLES.includes(r.name)).length,offerAccess==='runtime'?8:0));
 const revisionRights=relations.filter(r=>r.name==='billing_offer_revisions');
 for(const r of revisionRights)check(()=>assert.deepEqual(r.rights,['SELECT','INSERT']));
 const x=driver(plan,BILLING_SQL.definitions),result=await verifyBillingV2Runtime(x,options);
 check(()=>assert.equal(result.semanticReviewRequired,true));check(()=>assert.equal(x.calls.at(-1)[0],'ROLLBACK'));
}
check(()=>assert.throws(()=>billingV2CheckPlan({testAccess:'disabled',billingAccess:'runtime'}),/BILLING_OFFER_ACCESS_REJECTED/));
const scripts=loadBillingAuditScripts(),include=read('migrations/audit/_billing_v1.sql');
check(()=>assert.equal(BILLING_AUDIT_EVENTS.length,11));
check(()=>assert.deepEqual([...new Set([...include.matchAll(/'(billing\.[a-z_]+\.v1)'/g)].map(m=>m[1]))].sort(),[...BILLING_AUDIT_EVENTS].sort()));
check(()=>assert.match(include,/ALTER FUNCTION audit_contract\.parse_event\(text,text,text\) RENAME TO parse_event_before_billing/));
check(()=>assert.match(include,/RETURN audit_contract\.parse_event_before_billing\(canonical_json,payload_hash,hash_version\)/));
check(()=>assert.match(include,/assert_tree\(canonical_json::json\)/));
check(()=>assert.match(include,/e->'changes' IS DISTINCT FROM '\[\]'::jsonb/));
check(()=>assert.match(include,/a->>'serviceId' IS DISTINCT FROM 'billing-worker'/));
check(()=>assert.match(include,/retentionClass' IS DISTINCT FROM 'S'.*outcome' IS DISTINCT FROM 'rejected'.*reasonCode' IS DISTINCT FROM 'CONFLICT'/));
check(()=>assert.match(include,/retentionClass' IS DISTINCT FROM 'B'.*outcome' IS DISTINCT FROM 'unknown'.*reasonCode' IS DISTINCT FROM 'PROVIDER_TIMEOUT'/));
for(const [target,script]of scripts){
 check(()=>assert.equal((script.match(/^BEGIN;$/gm)||[]).length,1));check(()=>assert.equal((script.match(/^COMMIT;$/gm)||[]).length,1));
 check(()=>assert.match(script,/Exact billing setup owner restoration failed/));
 check(()=>assert.doesNotMatch(script,/ALTER TABLE|DELETE FROM|TRUNCATE|PASSWORD|CREATE ROLE|SET session_replication_role/));
 check(()=>assert.equal((script.match(/INSERT INTO /g)||[]).length,1,'only migration ledger is written'));
 check(()=>assert.ok(script.includes(`TO fm_audit_${target}_owner`)));
 const contracts=billingAuditFunctionContracts(target,scripts),parser=contracts.find(c=>c.name==='parse_event'),previous=contracts.find(c=>c.name==='parse_event_before_billing');
 check(()=>assert.ok(parser.body_hash!==previous.body_hash));check(()=>assert.equal(parser.owner,previous.owner));
 const options={testAccess:'disabled',billingAccess:'runtime',offerAccess:'runtime'},plan=billingAuditCheckPlan(target,options,scripts);
 check(()=>assert.ok(plan.every(([,q])=>/^\s*(SELECT|WITH)\b/.test(q))));
 check(()=>assert.deepEqual(plan.find(p=>p[0]==='billingAuditRetainedRetention')[2].slice(0,2),[target==='source'?'audit_capture':'audit',target==='source'?'audit_outbox':'events']));
 const x=driver(plan),result=await verifyBillingAuditRuntime(x,target,options,scripts);
 check(()=>assert.equal(result.profile,`billing-audit-${target}`));check(()=>assert.equal(x.calls.at(-1)[0],'ROLLBACK'));
}
for(const [name,pin]of Object.entries(BILLING_AUDIT_PINS))check(()=>assert.equal(sha(fs.readFileSync(new URL('../migrations/audit/'+name,import.meta.url))),pin));
const inert=spawnSync(process.execPath,['--input-type=module','-e',`
 import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).includes('.env'))throw Error('PRIVATE_READ');return original.call(this,file,...args);};
 net.Socket.prototype.connect=function(){throw Error('NETWORK_ACCESS');};syncBuiltinESMExports();
 await import('./migrations/billing/v2-contract.mjs');await import('./migrations/billing/v2-runtime-profile.mjs');await import('./migrations/audit/billing-package.mjs');
 process.stdout.write('inert');
`],{encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(inert.status,0,inert.stderr));check(()=>assert.equal(inert.stdout,'inert'));
console.log(JSON.stringify({stage:'monthly-offer-source-audit-database-offline',status:'passed',checks,
  profileTables:27,oldPinsPreserved:true,databaseAccess:false,privateFileAccess:false,sqlExecuted:false,
  deferred:['live SQL/locks/triggers/privileges','source-aware backfill rehearsal','Stripe sandbox','activation']}));
