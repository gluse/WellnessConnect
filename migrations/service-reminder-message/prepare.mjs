// Local artifact generation only; no database clients or configuration.
import { writeFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { serviceReminderMessageContract, serviceReminderMessageMigration } from './contract.mjs';
await writeFile(new URL('./0023_service_reminder_message.sql', import.meta.url), await serviceReminderMessageMigration(schema));
await writeFile(new URL('./schema-contract.json', import.meta.url), JSON.stringify(serviceReminderMessageContract(schema), null, 2) + '\n');
console.log('Prepared service reminder message migration and metadata locally. No SQL executed.');
