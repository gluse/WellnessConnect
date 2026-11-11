// Local generation only. No SQL, configuration or services.
import { writeFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { customerNotificationMigration, customerNotificationRuntimeContract } from './contract.mjs';
await writeFile(new URL('./0024_customer_service_notifications.sql', import.meta.url), await customerNotificationMigration(schema));
await writeFile(new URL('./runtime-contract.json', import.meta.url), JSON.stringify(customerNotificationRuntimeContract(schema), null, 2) + '\n');
console.log('Prepared customer notification migration/metadata locally; no SQL executed.');
