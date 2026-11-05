-- Read-only, bounded catalog/aggregate verification after separately approved execution.
-- Run using the authorized verified-TLS target/principal only. No customer rows.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog, pg_temp;
SELECT table_name, column_name, data_type, character_maximum_length,
  numeric_precision, numeric_scale, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND (
  (table_name = 'addresses' AND column_name = 'country_code') OR
  (table_name = 'services' AND column_name IN ('currency','price')) OR
  (table_name = 'bookings' AND column_name IN ('currency','total_amount','advance_amount')))
ORDER BY table_name, column_name;
SELECT c.relname AS table_name, con.conname, con.convalidated, pg_get_constraintdef(con.oid, true) AS definition
FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
WHERE c.relnamespace = 'public'::regnamespace AND con.conname IN (
  'addresses_country_code_check', 'services_currency_check', 'services_price_money_check',
  'services_advance_percent_check', 'bookings_currency_check', 'bookings_total_money_check', 'bookings_advance_money_check')
ORDER BY c.relname, con.conname;
SELECT 'services' AS table_name, count(*) AS total, count(*) FILTER (WHERE currency IS NULL) AS missing_currency,
  count(*) FILTER (WHERE currency = 'EUR') AS eur_records FROM public.services
UNION ALL SELECT 'bookings', count(*), count(*) FILTER (WHERE currency IS NULL),
  count(*) FILTER (WHERE currency = 'EUR') FROM public.bookings;
ROLLBACK;
