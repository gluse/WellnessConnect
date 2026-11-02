-- PREPARED EMERGENCY ACCESS DISABLE ONLY. Preserves all message/request data.
-- Not a schema rollback; old exact-33-table builds still cannot restart.
-- Requires separate target-specific authorization and service maintenance.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $appointments$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 THEN RAISE EXCEPTION 'Appointments disable preconditions failed'; END IF;
END $appointments$;
REVOKE SELECT,INSERT,UPDATE,DELETE ON public.booking_messages FROM fm_app_runtime;
REVOKE SELECT,INSERT,UPDATE,DELETE ON public.booking_reschedule_requests FROM fm_app_runtime;
DROP POLICY fmt_appointment_server ON public.booking_messages;
DROP POLICY fmt_appointment_server ON public.booking_reschedule_requests;
SELECT true AS appointments_runtime_disabled;
COMMIT;
