// Writes only reviewable migration/metadata artifacts; never imports a DB client.
import { writeFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { photoMigration, photoSchemaContract } from './contract.mjs';
await writeFile(new URL('./0022_service_photos.sql', import.meta.url), await photoMigration(schema));
await writeFile(new URL('./schema-contract.json', import.meta.url), JSON.stringify(photoSchemaContract(schema), null, 2) + '\n');
console.log('Prepared service-photo SQL and schema metadata locally. No SQL executed.');
