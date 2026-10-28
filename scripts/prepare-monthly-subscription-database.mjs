// Offline DDL preparation only; never loads dotenv, pg, server/db or credentials.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as schema from '../shared/schema.ts';
import {BILLING_EXPORTS,BILLING_FILES,qualifyBillingDDL,BILLING_SCHEMA_PREFIX,BILLING_SCHEMA_SUFFIX} from '../migrations/billing/contract.mjs';
const {generateDrizzleJson,generateMigration}=createRequire(import.meta.url)('drizzle-kit/api');
// Reconstruct the already-published v1 shape, rather than changing its migration
// when later additive schema versions enter shared/schema.ts.
export function billingV1Snapshot(){
  const snapshot=generateDrizzleJson(schema);
  for(const name of ['billing_offer_revisions','billing_offer_settings','billing_price_mappings','billing_source_state'])delete snapshot.tables['public.'+name];
  for(const name of ['billing_operations','billing_subscriptions']){
    const table=snapshot.tables['public.'+name];
    for(const col of ['offer_revision_id','price_mapping_id'])delete table.columns[col];
    for(const [key,fk]of Object.entries(table.foreignKeys))if(fk.columnsFrom.some(col=>['offer_revision_id','price_mapping_id'].includes(col)))delete table.foreignKeys[key];
    delete table.checkConstraints[name==='billing_operations'?'billing_operation_offer_binding':'billing_subscription_offer_binding'];
  }
  return snapshot;
}
export async function preparedBillingDDL(){
  const after=billingV1Snapshot(),before=structuredClone(after);
  for(const name of BILLING_EXPORTS)delete before.tables['public.'+getName(name)];
  const statements=await generateMigration(before,after);
  return BILLING_SCHEMA_PREFIX+qualifyBillingDDL(statements.join('\n'))+'\n'+BILLING_SCHEMA_SUFFIX;
}
function getName(name){return ({billingAccounts:'billing_accounts',billingSubscriptions:'billing_subscriptions',billingInvoices:'billing_invoices',billingOperations:'billing_operations',billingEvents:'billing_events',manualProGrants:'manual_pro_grants'})[name];}
if(process.argv[1] && fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
  if(process.argv.length!==3 || !['print','write-new'].includes(process.argv[2])){
    process.stdout.write('MODE_REJECTED\n');process.exitCode=1;
  }else{
    const sql=await preparedBillingDDL();
    if(process.argv[2]==='print')process.stdout.write(sql);
    else {
      fs.writeFileSync(new URL('../'+BILLING_FILES.schema,import.meta.url),sql,{flag:'wx'});
      process.stdout.write('Prepared new dormant SQL file; no SQL executed.\n');
    }
  }
}
