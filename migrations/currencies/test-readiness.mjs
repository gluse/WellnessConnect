// Mocked query boundary only. No database, private configuration or sockets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CURRENCY_READINESS_SQL, canonicalCurrencyExpression, currencyReadinessArguments,
  verifyCurrencyDatabaseReadiness, assertCurrencyReadiness, CurrencyDatabaseReadinessError } from './application-readiness.mjs';

const profile = JSON.parse(await readFile(new URL('./schema-contract.json', import.meta.url), 'utf8'));
const values = currencyReadinessArguments();
assert.equal(JSON.parse(values[0]).length, 6);
assert.equal(JSON.parse(values[1]).length, 7);
assert.deepEqual(JSON.parse(values[1]).map(row => row.name), profile.constraints.map(row => row.name));
let calls = 0;
await verifyCurrencyDatabaseReadiness(async (text, args) => {
  calls++;
  assert.equal(text, CURRENCY_READINESS_SQL);
  assert.deepEqual(args, values);
  return { rows: [{ currency_columns: true, currency_constraints: true }] };
});
assert.equal(calls, 1);
for (const key of ['currency_columns', 'currency_constraints']) {
  assert.throws(() => assertCurrencyReadiness([{ currency_columns: true, currency_constraints: true, [key]: false }]),
    error => error.code === 'CURRENCY_DB_NOT_READY' && assert.deepEqual(error.checks, [key]) === undefined);
}
for (const rows of [null, [], [{}], [{ currency_columns: true }], [{ currency_columns: true, currency_constraints: true, injected: true }], [{ currency_columns: 1, currency_constraints: true }]]) {
  assert.throws(() => assertCurrencyReadiness(rows), CurrencyDatabaseReadinessError);
}
await assert.rejects(verifyCurrencyDatabaseReadiness(async () => { throw new Error('private://credential@target'); }), error => {
  assert.equal(error.message, 'CURRENCY_DB_NOT_READY');
  assert.deepEqual(error.checks, ['metadata_query']);
  assert.ok(!JSON.stringify(error).includes('credential'));
  return true;
});
// Static PG17 ruleutils fixtures: these verify normalization, not live catalog state.
assert.equal(canonicalCurrencyExpression(`((currency)::text = ANY ((ARRAY['EUR'::character varying, 'USD'::character varying])::text[]))`),
  canonicalCurrencyExpression(`"currency" IN ('EUR', 'USD')`));
assert.equal(canonicalCurrencyExpression(`((price >= (0)::numeric) AND (price <= 99999999.99) AND (price = trunc(price, CASE WHEN ((currency)::text = ANY ((ARRAY['JPY'::character varying])::text[])) THEN 0 WHEN ((currency)::text = ANY ((ARRAY['KWD'::character varying])::text[])) THEN 3 ELSE 2 END)))`),
  canonicalCurrencyExpression(`"price" >= 0 AND "price" <= 99999999.99 AND "price" = trunc("price", CASE WHEN "currency" IN ('JPY') THEN 0 WHEN "currency" IN ('KWD') THEN 3 ELSE 2 END)`));
console.log('PASS: injected currency readiness accepts complete metadata, rejects missing/drifted/malformed results, redacts driver errors; PG17 normalization fixtures pass. No SQL executed.');
