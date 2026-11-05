// Offline metadata only: no private configuration, connections or SQL execution.
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { CURRENCY_DATA_VERSION } from '../../shared/currencies.ts';

export const CURRENCY_CONSTRAINT_NAMES = Object.freeze({
  addresses: ['addresses_country_code_check'],
  services: ['services_currency_check', 'services_price_money_check', 'services_advance_percent_check'],
  bookings: ['bookings_currency_check', 'bookings_total_money_check', 'bookings_advance_money_check'],
});
const dialect = new PgDialect();
export function currencySchemaContract(schema) {
  const contract = { version: 'currencies-v1', dataVersion: CURRENCY_DATA_VERSION, columns: [], constraints: [] };
  for (const [table, names] of Object.entries(CURRENCY_CONSTRAINT_NAMES)) {
    const metadata = getTableConfig(schema[table]);
    const selected = table === 'addresses' ? ['country_code'] : table === 'services' ? ['currency', 'price'] : ['currency', 'total_amount', 'advance_amount'];
    for (const column of metadata.columns.filter(column => selected.includes(column.name))) {
      contract.columns.push({ table, name: column.name, type: column.getSQLType(), notNull: column.notNull, hasDefault: column.hasDefault });
    }
    for (const name of names) {
      const check = metadata.checks.find(check => check.name === name);
      if (!check) throw new Error('Missing currency constraint: ' + name);
      const query = dialect.sqlToQuery(check.value);
      if (query.params.length) throw new Error('Migration CHECK cannot contain query parameters');
      contract.constraints.push({ table, name, expression: query.sql.replaceAll(`"${table}".`, '') });
    }
  }
  return contract;
}

export function currencyMigration(contract) {
  const addChecks = contract.constraints.map(check => `ALTER TABLE public.${check.table} ADD CONSTRAINT "${check.name}" CHECK (${check.expression}) NOT VALID;`).join('\n');
  const validateChecks = contract.constraints.map(check => `ALTER TABLE public.${check.table} VALIDATE CONSTRAINT "${check.name}";`).join('\n');
  return `-- TASK-039 currency expansion/backfill. PREPARED ONLY, NOT APPLIED.
-- Stop old app/service/booking writers before this transaction and keep them stopped
-- until the compatible app passes readiness. Exact-target DB approval is required.
-- Stop on the first failure; do not retry or repair legacy values automatically.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL search_path = pg_catalog, pg_temp;
DO $currencies$ BEGIN
  IF current_user <> session_user OR current_user <> 'postgres'
    OR current_setting('server_version_num')::integer / 10000 <> 17
    OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('addresses','services','bookings') AND relkind = 'r'
      AND relowner = 'postgres'::regrole AND relrowsecurity) <> 3
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND ((table_name IN ('services','bookings') AND column_name = 'currency')
        OR (table_name = 'addresses' AND column_name = 'country_code')))
    OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
      AND ((table_name = 'services' AND column_name = 'price')
        OR (table_name = 'bookings' AND column_name IN ('total_amount','advance_amount')))
      AND data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2 AND is_nullable = 'NO') <> 3
  THEN RAISE EXCEPTION 'Currency migration preconditions failed; inspect and do not retry blindly'; END IF;
END $currencies$;
LOCK TABLE public.addresses, public.services, public.bookings IN ACCESS EXCLUSIVE MODE;
DO $legacy$ BEGIN
  IF EXISTS (SELECT 1 FROM public.services WHERE price < 0 OR price > 99999999.99 OR price <> trunc(price, 2)
      OR advance_payment_percent < 0 OR advance_payment_percent > 100)
    OR EXISTS (SELECT 1 FROM public.bookings WHERE total_amount < 0 OR total_amount > 99999999.99
      OR advance_amount < 0 OR advance_amount > total_amount
      OR total_amount <> trunc(total_amount, 2) OR advance_amount <> trunc(advance_amount, 2))
  THEN RAISE EXCEPTION 'Existing monetary values violate the currency contract; no values changed'; END IF;
END $legacy$;
-- Removing typmod avoids implicit rounding before the currency precision checks.
ALTER TABLE public.services ALTER COLUMN price TYPE numeric;
ALTER TABLE public.bookings ALTER COLUMN total_amount TYPE numeric, ALTER COLUMN advance_amount TYPE numeric;
ALTER TABLE public.addresses ADD COLUMN country_code varchar(2);
ALTER TABLE public.services ADD COLUMN currency varchar(3);
ALTER TABLE public.bookings ADD COLUMN currency varchar(3);
-- User confirmed every existing amount is EUR. No amount, address or listing join.
UPDATE public.services SET currency = 'EUR';
UPDATE public.bookings SET currency = 'EUR';
ALTER TABLE public.services ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN currency SET NOT NULL;
-- No permanent default: every new price and booking must select its currency.
${addChecks}
${validateChecks}
SELECT (SELECT count(*) FROM public.services) AS services_backfilled_eur,
  (SELECT count(*) FROM public.bookings) AS bookings_backfilled_eur;
COMMIT;
`;
}
