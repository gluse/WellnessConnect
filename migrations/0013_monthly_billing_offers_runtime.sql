-- Opt-in rights for selected local offer/source persistence; no network/activation.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $billing$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
  OR current_setting('server_version_num')::integer/10000<>17
  OR (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p'))<>27
 THEN RAISE EXCEPTION 'Verified billing offer expansion required'; END IF;
END $billing$;
GRANT SELECT,INSERT ON public.billing_offer_revisions TO fm_app_runtime;
GRANT SELECT,UPDATE ON public.billing_offer_settings TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE ON public.billing_price_mappings,public.billing_source_state TO fm_app_runtime;
CREATE POLICY fmt_billing_server ON public.billing_offer_revisions FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_offer_settings FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_price_mappings FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_source_state FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
SELECT true AS billing_offer_runtime_created;
COMMIT;
