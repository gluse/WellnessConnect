-- TASK-032 separately reviewed runtime activation, prepared only, not applied.
-- Application authorization remains responsible for account/workspace isolation.
-- No browser, Supabase service-role, or audit-worker role gets private contacts.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $notifications$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('user_communication_preferences','phone_verification_challenges','notification_events','notification_jobs','notification_delivery_attempts','notification_callbacks')
  AND c.relkind='r' AND c.relrowsecurity)<>6
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('user_communication_preferences','phone_verification_challenges','notification_events','notification_jobs','notification_delivery_attempts','notification_callbacks'))
 THEN RAISE EXCEPTION 'Notifications runtime preconditions failed; inspect before retry'; END IF;
END $notifications$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_communication_preferences TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.phone_verification_challenges TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_events TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_jobs TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_delivery_attempts TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_callbacks TO fm_app_runtime;
CREATE POLICY fmt_notification_server ON public.user_communication_preferences FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_notification_server ON public.phone_verification_challenges FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_notification_server ON public.notification_events FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_notification_server ON public.notification_jobs FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_notification_server ON public.notification_delivery_attempts FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_notification_server ON public.notification_callbacks FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
SELECT true AS notifications_runtime_created;
COMMIT;
