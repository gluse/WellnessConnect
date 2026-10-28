// Pure local follow-up DDL generation; no configuration, client or SQL execution.
import fs from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import * as schema from '../shared/schema.ts';
import {billingV1Snapshot} from './prepare-monthly-subscription-database.mjs';
import {qualifyBillingDDL} from '../migrations/billing/contract.mjs';
import {BILLING_V2_FILES,BILLING_V2_PREFIX,BILLING_V2_SUFFIX} from '../migrations/billing/v2-contract.mjs';
const {generateDrizzleJson,generateMigration}=createRequire(import.meta.url)('drizzle-kit/api');
export async function preparedBillingV2DDL(){return BILLING_V2_PREFIX+qualifyBillingDDL((await generateMigration(billingV1Snapshot(),generateDrizzleJson(schema))).join('\n'))+'\n'+BILLING_V2_SUFFIX;}
if(process.argv[1] && fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
 if(process.argv.length!==3 || !['print','write-new'].includes(process.argv[2])){process.stdout.write('MODE_REJECTED\n');process.exitCode=1;}
 else {const sql=await preparedBillingV2DDL();if(process.argv[2]==='print')process.stdout.write(sql);
  else{fs.writeFileSync(new URL('../'+BILLING_V2_FILES.schema,import.meta.url),sql,{flag:'wx'});process.stdout.write('Prepared new local offer SQL; no SQL executed.\n');}}
}
