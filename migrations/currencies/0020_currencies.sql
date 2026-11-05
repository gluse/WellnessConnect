-- TASK-039 currency expansion/backfill. PREPARED ONLY, NOT APPLIED.
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
ALTER TABLE public.addresses ADD CONSTRAINT "addresses_country_code_check" CHECK ("country_code" IS NULL OR "country_code" IN ('AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW')) NOT VALID;
ALTER TABLE public.services ADD CONSTRAINT "services_currency_check" CHECK ("currency" IN ('AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG')) NOT VALID;
ALTER TABLE public.services ADD CONSTRAINT "services_price_money_check" CHECK ("price" >= 0 AND "price" <= 99999999.99 AND "price" = trunc("price", CASE WHEN "currency" IN ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') THEN 0 WHEN "currency" IN ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') THEN 3 ELSE 2 END)) NOT VALID;
ALTER TABLE public.services ADD CONSTRAINT "services_advance_percent_check" CHECK ("advance_payment_percent" IS NULL OR ("advance_payment_percent" >= 0 AND "advance_payment_percent" <= 100)) NOT VALID;
ALTER TABLE public.bookings ADD CONSTRAINT "bookings_currency_check" CHECK ("currency" IN ('AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG')) NOT VALID;
ALTER TABLE public.bookings ADD CONSTRAINT "bookings_total_money_check" CHECK ("total_amount" >= 0 AND "total_amount" <= 99999999.99 AND "total_amount" = trunc("total_amount", CASE WHEN "currency" IN ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') THEN 0 WHEN "currency" IN ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') THEN 3 ELSE 2 END)) NOT VALID;
ALTER TABLE public.bookings ADD CONSTRAINT "bookings_advance_money_check" CHECK ("advance_amount" >= 0 AND "advance_amount" <= 99999999.99 AND "advance_amount" = trunc("advance_amount", CASE WHEN "currency" IN ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') THEN 0 WHEN "currency" IN ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') THEN 3 ELSE 2 END) AND "advance_amount" <= "total_amount") NOT VALID;
ALTER TABLE public.addresses VALIDATE CONSTRAINT "addresses_country_code_check";
ALTER TABLE public.services VALIDATE CONSTRAINT "services_currency_check";
ALTER TABLE public.services VALIDATE CONSTRAINT "services_price_money_check";
ALTER TABLE public.services VALIDATE CONSTRAINT "services_advance_percent_check";
ALTER TABLE public.bookings VALIDATE CONSTRAINT "bookings_currency_check";
ALTER TABLE public.bookings VALIDATE CONSTRAINT "bookings_total_money_check";
ALTER TABLE public.bookings VALIDATE CONSTRAINT "bookings_advance_money_check";
SELECT (SELECT count(*) FROM public.services) AS services_backfilled_eur,
  (SELECT count(*) FROM public.bookings) AS bookings_backfilled_eur;
COMMIT;
