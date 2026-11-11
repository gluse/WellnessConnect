-- Customer listing-change notifications runtime activation. PREPARED, NOT APPLIED.
-- Requires separate exact-target execution/recovery authorization after 0024.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $customer_notice$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>42
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
  AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.customer_service_notifications'::regclass
  AND relkind='r' AND relrowsecurity AND NOT relforcerowsecurity AND relowner='postgres'::regrole)
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass
  AND attname='deleted_at' AND atttypid='timestamptz'::regtype AND NOT attnotnull AND NOT atthasdef AND NOT attisdropped)
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.services'::regclass
  AND conname='services_deleted_inactive_check' AND contype='c' AND convalidated)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.customer_service_notifications'::regclass)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.oid='public.customer_service_notifications'::regclass AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Customer notification runtime preconditions failed; inspect target and do not retry'; END IF;
END $customer_notice$;
-- The existing restricted server role enforces recipient/booking authorization.
-- Browser Supabase roles and audit principals receive no access.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.customer_service_notifications TO fm_app_runtime;
CREATE POLICY fmt_customer_notice_server ON public.customer_service_notifications FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
COMMIT;
