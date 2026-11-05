// Offline schema/API contract checks. No environment files or DB clients imported.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import { SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, currencyDigits } from '../../shared/currencies.ts';
import { currencySchemaContract, currencyMigration } from './contract.mjs';

const profile = currencySchemaContract(schema);
const column = (table, name) => profile.columns.find(row => row.table === table && row.name === name);
for (const table of ['services', 'bookings']) {
  assert.deepEqual(column(table, 'currency'), { table, name: 'currency', type: 'varchar(3)', notNull: true, hasDefault: false });
}
assert.deepEqual(column('addresses', 'country_code'), { table: 'addresses', name: 'country_code', type: 'varchar(2)', notNull: false, hasDefault: false });
for (const [table, name] of [['services', 'price'], ['bookings', 'total_amount'], ['bookings', 'advance_amount']]) {
  assert.equal(column(table, name).type, 'numeric', 'No typmod rounding before the CHECK can reject excess precision');
  assert.equal(column(table, name).notNull, true);
  assert.equal(column(table, name).hasDefault, false);
}

const serviceCurrency = schema.insertServiceSchema.pick({ currency: true });
const bookingCurrency = schema.insertBookingSchema.pick({ currency: true });
for (const code of SUPPORTED_CURRENCIES) {
  assert.equal(serviceCurrency.parse({ currency: code }).currency, code);
  assert.equal(bookingCurrency.parse({ currency: code }).currency, code);
}
for (const currency of ['', 'eur', 'EU', 'EURO', 'XXX', 'XTS', null, 50, "EUR'); DELETE FROM services;--"]) {
  assert.equal(serviceCurrency.safeParse({ currency }).success, false);
  assert.equal(bookingCurrency.safeParse({ currency }).success, false);
}
assert.equal(serviceCurrency.safeParse({}).success, false, 'New listings require an explicit currency');
assert.equal(bookingCurrency.safeParse({}).success, false, 'Bookings require their independent currency snapshot');
const advancePercent = schema.insertServiceSchema.pick({ advancePaymentPercent: true });
for (const advancePaymentPercent of [undefined, null, 0, 50, 100]) assert.equal(advancePercent.safeParse({ advancePaymentPercent }).success, true);
for (const advancePaymentPercent of [-1, 101, 50.5, '50']) assert.equal(advancePercent.safeParse({ advancePaymentPercent }).success, false);
const address = { address: 'Street 10, Riga, Latvia', latitude: 0, longitude: 0 };
assert.equal(schema.addressInputSchema.safeParse(address).success, true, 'Country unknown stays valid');
assert.equal(schema.addressInputSchema.parse({ ...address, countryCode: null }).countryCode, null);
for (const countryCode of SUPPORTED_COUNTRIES) {
  assert.equal(schema.addressInputSchema.parse({ ...address, countryCode }).countryCode, countryCode);
}
for (const countryCode of ['lv', 'UK', 'EU', 'ZZ', 'USA', '', "LV'); DROP TABLE addresses;--"]) {
  assert.equal(schema.addressInputSchema.safeParse({ ...address, countryCode }).success, false);
}
assert.equal(currencyDigits('JPY'), 0);
assert.equal(currencyDigits('EUR'), 2);
assert.equal(currencyDigits('HUF'), 2, 'ISO minor units, not CLDR formatting defaults');
assert.equal(currencyDigits('IQD'), 3);

for (const constraint of profile.constraints.filter(row => /money/.test(row.name))) {
  assert.ok(constraint.expression.includes('<= 99999999.99'), 'Original upper bound survives precision expansion');
  assert.ok(constraint.expression.includes('>= 0'));
  assert.ok(constraint.expression.includes('= trunc('), 'Reject precision rather than round it');
  for (const code of SUPPORTED_CURRENCIES.filter(code => currencyDigits(code) !== 2)) {
    assert.ok(constraint.expression.includes(`'${code}'`), 'Currency precision branch remains complete');
  }
}
assert.ok(profile.constraints.find(row => row.name === 'bookings_advance_money_check').expression.includes('"advance_amount" <= "total_amount"'));
const migration = await readFile(new URL('./0020_currencies.sql', import.meta.url), 'utf8');
assert.equal(migration, currencyMigration(profile), 'Prepared migration matches current ORM/currency metadata');
assert.deepEqual(JSON.parse(await readFile(new URL('./schema-contract.json', import.meta.url), 'utf8')), profile);
assert.match(migration, /UPDATE public\.services SET currency = 'EUR';/);
assert.match(migration, /UPDATE public\.bookings SET currency = 'EUR';/);
assert.doesNotMatch(migration, /SET (?:price|total_amount|advance_amount)\s*=/i, 'Backfill must never convert numerical values');
assert.doesNotMatch(migration, /SET DEFAULT|DEFAULT 'EUR'|GRANT |CREATE POLICY|CREATE FUNCTION/i);
assert.equal((migration.match(/VALIDATE CONSTRAINT/g) ?? []).length, 7);
assert.ok(migration.includes('LOCK TABLE public.addresses, public.services, public.bookings IN ACCESS EXCLUSIVE MODE'));
assert.ok(migration.endsWith('COMMIT;\n'));
console.log('PASS: offline currency schema, supported/invalid codes, required snapshots, unknown country, ISO precision and prepared migration contract. No SQL executed.');
