-- TASK-042 runtime activation. PREPARED, NOT APPLIED; separate authorization.
-- App server authorization enforces account/booking/workspace boundaries.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $wishlist$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>40
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads')
  AND relkind='r' AND relrowsecurity AND NOT relforcerowsecurity AND relowner='postgres'::regrole)<>5
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads'))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads') AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Wishlist runtime preconditions failed; inspect target and do not retry blindly'; END IF;
END $wishlist$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wishlist_services TO fm_app_runtime;
CREATE POLICY fmt_wishlist_server ON public.wishlist_services FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.product_activity_events TO fm_app_runtime;
CREATE POLICY fmt_wishlist_server ON public.product_activity_events FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.service_activity_groups TO fm_app_runtime;
CREATE POLICY fmt_wishlist_server ON public.service_activity_groups FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.service_activity_reads TO fm_app_runtime;
CREATE POLICY fmt_wishlist_server ON public.service_activity_reads FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.booking_message_reads TO fm_app_runtime;
CREATE POLICY fmt_wishlist_server ON public.booking_message_reads FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
SELECT true AS wishlist_runtime_created;
COMMIT;
