// Meaningful offline schema/permission contract checks. No PostgreSQL emulator,
// credentials, dotenv, application startup, database connections or SQL execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {getTableConfig,PgDialect} from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema.ts';
import {preparedBillingDDL} from './prepare-monthly-subscription-database.mjs';
import {BILLING_EXPORTS,BILLING_TABLES,BILLING_FILES,BILLING_PROFILE_TABLES,BILLING_PROFILE_SEQUENCES,
  BILLING_RUNTIME_RIGHTS,billingRepositoryCompatibility} from '../migrations/billing/contract.mjs';
import {billingCheckPlan,billingRelationContracts,verifyBillingRuntime,BILLING_SQL} from '../migrations/billing/runtime-profile.mjs';
import {activeCheckPlan} from '../migrations/audit/runtime-active-profile.mjs';
import columns from '../migrations/billing/columns.json' with {type:'json'};

assert.equal(process.argv.length,3);assert.equal(process.argv[2],'offline');
let checks=0;const check=fn=>{fn();checks++;};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const sql=read(BILLING_FILES.schema),runtime=read(BILLING_FILES.runtime),security=read(BILLING_FILES.transferSecurity);
const generated=await preparedBillingDDL();
check(()=>assert.equal(sql,generated,'migration must match actual Drizzle columns, constraints, FKs and indexes'));
check(()=>assert.equal((sql.match(/^CREATE TABLE /gm)||[]).length,6));
check(()=>assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,6));
check(()=>assert.equal((sql.match(/^REVOKE ALL ON TABLE /gm)||[]).length,6));
check(()=>assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1));
check(()=>assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1));
check(()=>assert.doesNotMatch(sql,/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|GRANT)\b/gm));
check(()=>assert.doesNotMatch(sql,/CREATE (?:ROLE|FUNCTION|SEQUENCE)|ALTER DEFAULT PRIVILEGES|IF NOT EXISTS/i));
check(()=>assert.match(sql,/lock_timeout='5s'/));
check(()=>assert.match(sql,/statement_timeout='60s'/));
check(()=>assert.match(sql,/search_path=pg_catalog,pg_temp/));
check(()=>assert.ok(!sql.includes('ALTER TABLE "public"."provider_subscriptions"')));
check(()=>assert.deepEqual(getTableConfig(schema.providerSubscriptions).columns.map(c=>c.name),
  ['id','user_id','company_id','plan','pro_until','updated_by','updated_at']));
const dialect=new PgDialect(),configs=new Map(BILLING_EXPORTS.map(name=>{const config=getTableConfig(schema[name]);return[config.name,config];}));
check(()=>assert.deepEqual([...configs.keys()],BILLING_TABLES));
for(const [name,config]of configs){
  check(()=>assert.equal(config.enableRLS,true));
  check(()=>assert.equal(config.policies.length,0,'ORM is dormant; opt-in policies live in 0011'));
  check(()=>assert.equal(config.columns.find(c=>c.name==='id').getSQLType(),'uuid'));
  check(()=>assert.ok(config.columns.find(c=>c.name==='id').primary));
  check(()=>assert.ok(config.checks.length>0));
  for(const fk of config.foreignKeys){
    check(()=>assert.ok(!fk.onDelete || fk.onDelete==='no action','financial/grant history cannot cascade'));
    const ref=fk.reference();
    if(ref.name?.endsWith('_binding') && !ref.name.endsWith('_price_binding')){
      check(()=>assert.ok(['workspace_id','provider','merchant_account','mode'].every(n=>ref.columns.some(c=>c.name===n))));
      check(()=>assert.equal(ref.columns.length,ref.foreignColumns.length));
    }
  }
  const expected=columns.find(c=>c.name===name);
  check(()=>assert.deepEqual(expected.columns,config.columns.filter(c=>!['offer_revision_id','price_mapping_id'].includes(c.name)).map(c=>[c.name,c.getSQLType().replaceAll(' ','').replace('charactervarying','varchar'),c.notNull])));
}
const index=(table,name)=>configs.get(table).indexes.find(i=>i.config.name===name)?.config;
for(const [table,name,keys]of [
  ['billing_accounts','billing_account_customer_identity',['provider','merchant_account','mode','customer_id']],
  ['billing_subscriptions','billing_subscription_identity',['provider','merchant_account','mode','processor_subscription_id']],
  ['billing_invoices','billing_invoice_identity',['provider','merchant_account','mode','processor_invoice_id']],
  ['billing_events','billing_event_identity',['provider','merchant_account','mode','event_id']],
  ['billing_operations','billing_operation_idempotency',['workspace_id','mode','kind','idempotency_key']],
  ['manual_pro_grants','manual_pro_grant_source',['workspace_id','source','source_reference']],
]){
  const rule=index(table,name);check(()=>assert.equal(rule.unique,true));check(()=>assert.deepEqual(rule.columns.map(c=>c.name),keys));
}
for(const [table,name]of [['billing_operations','billing_checkout_workspace_slot'],['billing_subscriptions','billing_subscription_workspace_slot']]){
  const slot=index(table,name);check(()=>assert.equal(slot.unique,true));check(()=>assert.deepEqual(slot.columns.map(c=>c.name),['workspace_id','mode']));
}
const checkoutPredicate=dialect.sqlToQuery(index('billing_operations','billing_checkout_workspace_slot').where).sql;
check(()=>assert.match(checkoutPredicate,/"kind" = 'checkout' AND .*"resolved_at" IS NULL/));
check(()=>assert.ok(!checkoutPredicate.includes('state'),'hosted URL creation/completed must retain slot'));
check(()=>assert.match(dialect.sqlToQuery(index('billing_subscriptions','billing_subscription_workspace_slot').where).sql,/"state" <> 'ended'/));
const checkSQL=table=>configs.get(table).checks.map(c=>dialect.sqlToQuery(c.value).sql).join('\n');
check(()=>assert.match(checkSQL('billing_events'),/\("billing_events"\."account_id" IS NULL\) = \("billing_events"\."workspace_id" IS NULL\)/));
check(()=>assert.match(checkSQL('billing_events'),/"state" <> 'processed' OR "billing_events"\."account_id" IS NOT NULL/));
check(()=>assert.match(checkSQL('billing_subscriptions'),/"generation" >= 0 AND .*"revision" >= 0/));
check(()=>assert.match(checkSQL('billing_subscriptions'),/"period_end" > .*"period_start"/));
check(()=>assert.match(checkSQL('billing_invoices'),/"amount_refunded" <= .*"amount_paid"/));
for(const field of ['amount_due','amount_paid','amount_refunded'])check(()=>assert.equal(configs.get('billing_invoices').columns.find(c=>c.name===field).getSQLType(),'numeric(18, 0)'));
check(()=>assert.match(checkSQL('manual_pro_grants'),/"ends_at" > .*"starts_at"/));
check(()=>assert.match(checkSQL('billing_operations'),/\^\[a-f0-9\]\{64\}\$/));
check(()=>assert.equal(BILLING_PROFILE_TABLES.length,23));check(()=>assert.equal(BILLING_PROFILE_SEQUENCES.length,10));
check(()=>assert.equal(billingRepositoryCompatibility(BILLING_PROFILE_TABLES.map(n=>`pgTable("${n}",{})`).join('\n')),true));
check(()=>assert.equal(billingRepositoryCompatibility(read('shared/schema.ts')),false,'v1 exact profile rejects expanded v2 repository'));
check(()=>assert.equal(billingRepositoryCompatibility(read('shared/schema.ts')+'\npgTable("unreviewed",{})'),false));
check(()=>assert.equal(billingRepositoryCompatibility(read('shared/schema.ts').replace('pgTable("billing_events"','pgTable("billing_events_changed"')),false));
check(()=>assert.deepEqual(BILLING_RUNTIME_RIGHTS,['SELECT','INSERT','UPDATE']));
check(()=>assert.doesNotMatch(runtime,/\b(?:CREATE|ALTER)\s+ROLE\b|\b(?:INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE|DROP)\b/i));
check(()=>assert.equal((runtime.match(/^CREATE POLICY /gm)||[]).length,6));
check(()=>assert.equal((runtime.match(/^GRANT /gm)||[]).length,1));
check(()=>assert.doesNotMatch(runtime,/GRANT[^;]*(?:DELETE|ALL|SEQUENCE)/));
check(()=>assert.equal((security.match(/^ALTER TABLE /gm)||[]).length,23));
check(()=>assert.doesNotMatch(security,/\bGRANT\b/));
for(const name of BILLING_PROFILE_TABLES)check(()=>assert.ok(security.includes('public.'+name)));
const transfer=read('scripts/migrate-to-supabase.mjs');
check(()=>assert.ok(transfer.indexOf('if (billing.rows.length)')<transfer.indexOf('const sourceCounts =')));
check(()=>assert.ok(transfer.includes('[[...BILLING_TABLES,...BILLING_V2_TABLES]]')));
check(()=>assert.match(read('drizzle.config.ts'),/BILLING_SCHEMA_PROFILE === "choice2" \? \[\.\.\.BILLING_PROFILE_TABLES\]/));

for(const billingAccess of ['dormant','runtime']){
  const base=activeCheckPlan('source',{testAccess:'disabled'}),plan=billingCheckPlan({testAccess:'disabled',billingAccess});
  check(()=>assert.equal(new Set(plan.map(p=>p[0])).size,plan.length));
  check(()=>assert.equal(base.find(p=>p[0]==='tables')[2][0].length,17,'historical active profile remains unchanged'));
  check(()=>assert.deepEqual(plan.find(p=>p[0]==='tables')[2],[BILLING_PROFILE_TABLES]));
  check(()=>assert.deepEqual(JSON.parse(plan.find(p=>p[0]==='relations')[2][1]),billingRelationContracts(billingAccess)));
  for(const entry of base.filter(p=>!['relations','tables','allPoliciesPermissive'].includes(p[0])))check(()=>assert.deepEqual(plan.find(p=>p[0]===entry[0]),entry));
  check(()=>assert.ok(plan.every(([,q])=>/^\s*(SELECT|WITH)\b/.test(q))));
  const extra=billingRelationContracts(billingAccess).filter(r=>BILLING_TABLES.includes(r.name));
  check(()=>assert.equal(extra.length,billingAccess==='runtime'?12:0));
  for(const right of extra)check(()=>assert.deepEqual(right.rights,['SELECT','INSERT','UPDATE']));
  function client(fail=-1){let n=0;const calls=[];return{calls,async query(q,args){
    calls.push([q,args]);if(['BEGIN READ ONLY','ROLLBACK'].includes(q))return{};
    if(q===BILLING_SQL.definitions)return{rows:[{definition:'synthetic pending semantic review'}]};
    assert.deepEqual([q,args],[plan[n][1],plan[n][2]]);return{rows:[{catalog_gate:n++!==fail}]};
  }};}
  const success=client(),result=await verifyBillingRuntime(success,{testAccess:'disabled',billingAccess});
  check(()=>assert.equal(result.semanticReviewRequired,true));check(()=>assert.equal(success.calls.at(-1)[0],'ROLLBACK'));
  for(const fail of [0,plan.length-3,plan.length-2,plan.length-1]){
    const bad=client(fail);await assert.rejects(()=>verifyBillingRuntime(bad,{testAccess:'disabled',billingAccess}),/BILLING_RUNTIME_VERIFICATION_REJECTED/);checks++;
    check(()=>assert.equal(bad.calls.at(-1)[0],'ROLLBACK'));check(()=>assert.equal(bad.calls.length,fail+3));
  }
}
for(const options of [undefined,{}, {testAccess:'disabled',billingAccess:'auto'},{testAccess:'disabled',billingAccess:true}])check(()=>assert.throws(()=>billingCheckPlan(options),/BILLING_ACCESS_PROFILE_REJECTED/));
check(()=>assert.throws(()=>billingCheckPlan({billingAccess:'dormant'}),/ACTIVE_TEST_ACCESS_REJECTED/));

const inert=spawnSync(process.execPath,['--input-type=module','-e',`
  import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
  const original=fs.readFileSync;fs.readFileSync=function(file,...args){
    if(String(file).includes('.env'))throw Error('PRIVATE_READ');return original.call(this,file,...args);};
  net.Socket.prototype.connect=function(){throw Error('NETWORK_ACCESS');};syncBuiltinESMExports();
  await import('./migrations/billing/contract.mjs');await import('./migrations/billing/runtime-profile.mjs');
  process.stdout.write('inert');
`],{encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(inert.status,0,inert.stderr));check(()=>assert.equal(inert.stdout,'inert'));
console.log(JSON.stringify({stage:'monthly-subscription-database-offline',status:'passed',checks,
  tables:6,profileTables:23,databaseAccess:false,privateFileAccess:false,sqlExecuted:false,
  deferred:['live SQL constraints/locks/grants','migration semantic rehearsal','live legacy backfill/source-aware cutover','audit contract application','activation']}));
