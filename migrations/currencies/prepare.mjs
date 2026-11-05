// Local file generation only. Never imports server/db or configuration.
import { writeFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { currencySchemaContract, currencyMigration } from './contract.mjs';

const contract = currencySchemaContract(schema);
await writeFile(new URL('./0020_currencies.sql', import.meta.url), currencyMigration(contract));
await writeFile(new URL('./schema-contract.json', import.meta.url), JSON.stringify(contract, null, 2) + '\n');
console.log('Prepared currency migration and metadata files only; no SQL executed.');
