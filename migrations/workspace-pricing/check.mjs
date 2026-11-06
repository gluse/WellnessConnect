// Offline schema/migration contract checks. No private settings, DB engine or sockets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { SUPPORTED_CURRENCIES } from '../../shared/currencies.ts';
import { pricingSchemaContract, pricingRuntimeContract, pricingMigration, pricingSnapshots } from './contract.mjs';
const profile = pricingSchemaContract(schema), runtime = pricingRuntimeContract(schema), { previous, current } = pricingSnapshots(schema);
assert.equal(Object.keys(previous.tables).length, 40);
assert.equal(Object.keys(current.tables).length, 41);
assert.ok(!previous.tables['public.workspace_pricing_settings']);
assert.equal(previous.tables['public.addresses'].columns.pricing_currency, undefined);
const column = (name, table = 'workspace_pricing_settings') => profile.columns.find(column => column.table === table && column.name === name);
assert.deepEqual(column('revision'), { table: 'workspace_pricing_settings', name: 'revision', type: 'integer', notNull: true, default: '1' });
for (const name of ['default_currency', 'business_country_code']) { assert.equal(column(name).notNull, false); assert.equal(column(name).default, null); }
assert.equal(column('id').default, null, 'Application supplies a UUID; no schema default dependency');
assert.equal(column('pricing_currency', 'addresses').notNull, false);
assert.equal(column('pricing_currency', 'addresses').default, null);
assert.deepEqual(profile.runtimeRights.rights, ['SELECT','INSERT','UPDATE']);
assert.equal(profile.indexes.length, 3);
assert.deepEqual(profile.indexes.filter(index => !index.primary).map(index => index.columns), [['user_id'], ['company_id']]);
assert.ok(profile.foreignKeys.every(fk => fk.onDelete === 'cascade'));
assert.deepEqual(profile.foreignKeys.map(fk => [fk.columns[0], fk.referenceTable]), [['user_id','users'],['company_id','companies']]);
assert.equal(profile.constraints.find(check => check.name === 'workspace_pricing_owner_check').canonical, 'user_idisnotnull<>company_idisnotnull');
assert.equal(profile.constraints.find(check => check.name === 'workspace_pricing_revision_check').canonical, 'revision>0');
for (const pricingCurrency of [...SUPPORTED_CURRENCIES, null, undefined]) {
  assert.equal(schema.addressInputSchema.safeParse({ address: 'Street 10 Riga Latvia', latitude: 0, longitude: 0, pricingCurrency }).success, true);
}
for (const pricingCurrency of ['eur','XXX','XTS','ZZZ', '', "EUR');DROP TABLE users;--"]) {
  assert.equal(schema.addressInputSchema.safeParse({ address: 'Street 10 Riga Latvia', latitude: 0, longitude: 0, pricingCurrency }).success, false);
}
assert.deepEqual(JSON.parse(await readFile(new URL('./schema-contract.json', import.meta.url), 'utf8')), profile);
assert.deepEqual(JSON.parse(await readFile(new URL('./runtime-contract.json', import.meta.url), 'utf8')), runtime);
const migration = await readFile(new URL('./0021_workspace_pricing.sql', import.meta.url), 'utf8');
assert.equal(migration, await pricingMigration(schema), 'Generated SQL tracks only this owned schema expansion');
assert.match(migration, /GRANT SELECT,INSERT,UPDATE ON TABLE public\.workspace_pricing_settings TO fm_app_runtime/);
assert.doesNotMatch(migration, /UPDATE\s+(?:public\.)?(?:services|bookings)|ALTER TABLE "public"\."(?:services|bookings)"|DELETE FROM|CREATE FUNCTION|CREATE TRIGGER/i);
assert.match(migration, /SELECT gen_random_uuid\(\),id,'EUR',1 FROM public\.users/);
assert.match(migration, /SELECT gen_random_uuid\(\),id,'EUR',1 FROM public\.companies/);
assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'));
assert.ok(migration.includes('LOCK TABLE public.users, public.companies IN SHARE MODE'));
assert.doesNotMatch(migration, /INSERT INTO public\.workspace_pricing_settings\([^)]*business_country_code/i, 'Existing workspace seed leaves unconfirmed business country null');
// No permanent EUR defaults: existing rows are explicitly seeded, new workspaces
// have null/missing preferences until the owner confirms a choice.
assert.ok(!/"default_currency"\s+[^\n]*\bDEFAULT\s/i.test(migration));
console.log('PASS: offline TASK-044 private workspace shape/XOR/unique/CAS constraints, nullable address override, valid/invalid currencies,41-table migration drift, EUR-only settings seed and narrow runtime rights. No SQL executed.');
