-- Separate runtime activation, PREPARED ONLY. No connected execution authorized.
-- Server-side booking/workspace authorization enforces tenant boundaries.
-- Browser roles, Supabase service_role and audit workers receive no access.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $appointments$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('booking_messages','booking_reschedule_requests')
  AND c.relkind='r' AND c.relrowsecurity AND c.relowner='postgres'::regrole)<>2
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('booking_messages','booking_reschedule_requests'))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('booking_messages','booking_reschedule_requests') AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Appointments runtime preconditions failed; inspect target and do not retry blindly'; END IF;
END $appointments$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.booking_messages TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.booking_reschedule_requests TO fm_app_runtime;
CREATE POLICY fmt_appointment_server ON public.booking_messages FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
CREATE POLICY fmt_appointment_server ON public.booking_reschedule_requests FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
SELECT true AS appointments_runtime_created;
COMMIT;
