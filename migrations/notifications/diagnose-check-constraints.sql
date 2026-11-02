-- Fallback diagnosis only: read-only catalog metadata, at most 13 fixed checks.
-- Prepared, NOT executed by the agent. No customer rows, contacts or secrets.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
WITH expected(table_name,constraint_name) AS (VALUES
 ('user_communication_preferences','communication_preferences_phone_check'),
 ('user_communication_preferences','communication_preferences_verification_check'),
 ('user_communication_preferences','communication_preferences_method_check'),
 ('user_communication_preferences','communication_preferences_language_check'),
 ('phone_verification_challenges','phone_verification_shape'),
 ('notification_events','notification_event_shape'),
 ('notification_jobs','notification_job_state_check'),
 ('notification_jobs','notification_job_lease_check'),
 ('notification_jobs','notification_job_expiry_check'),
 ('notification_delivery_attempts','notification_attempt_shape'),
 ('notification_callbacks','notification_callback_shape'),
 ('services','services_reminder_settings_check'),
 ('bookings','bookings_notification_revision_check'))
SELECT e.table_name,e.constraint_name,q.oid IS NOT NULL AS present,
 q.convalidated AS validated,pg_catalog.pg_get_expr(q.conbin,q.conrelid) AS expression
FROM expected e LEFT JOIN pg_catalog.pg_constraint q
 ON q.conrelid=to_regclass('public.'||e.table_name)
 AND q.conname=e.constraint_name AND q.contype='c'
ORDER BY e.table_name,e.constraint_name;
COMMIT;
