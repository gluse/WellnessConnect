-- TASK-024 OPT-IN runtime extension. Prepared, not applied.
-- Apply only after 0010 dormant-profile verification and authorized rehearsal.
-- Does not activate billing, source-aware entitlement writes, audit or backfill.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $billing$ BEGIN
  IF current_user<>session_user OR current_user<>'postgres'
     OR current_setting('server_version_num')::integer/10000<>17
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
       AND NOT(rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Billing restricted source runtime required';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN('r','p'))<>23 THEN
    RAISE EXCEPTION 'Verified dormant billing expansion required';
  END IF;
END $billing$;
GRANT SELECT,INSERT,UPDATE ON TABLE public.billing_accounts, public.billing_subscriptions,
  public.billing_invoices, public.billing_operations, public.billing_events, public.manual_pro_grants TO fm_app_runtime;
CREATE POLICY fmt_billing_server ON public.billing_accounts FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_subscriptions FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_invoices FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_operations FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.billing_events FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_billing_server ON public.manual_pro_grants FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
SELECT true AS billing_runtime_extension_created;
COMMIT;
