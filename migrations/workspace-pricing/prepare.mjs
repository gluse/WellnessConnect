// Local generation only: imports schema descriptors, no configuration/DB engine.
import { writeFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { pricingSchemaContract, pricingRuntimeContract, pricingMigration } from './contract.mjs';
await writeFile(new URL('./0021_workspace_pricing.sql', import.meta.url), await pricingMigration(schema));
await writeFile(new URL('./schema-contract.json', import.meta.url), JSON.stringify(pricingSchemaContract(schema), null, 2) + '\n');
await writeFile(new URL('./runtime-contract.json', import.meta.url), JSON.stringify(pricingRuntimeContract(schema), null, 2) + '\n');
console.log('Prepared TASK-044 migration and schema metadata files only; no SQL executed.');
