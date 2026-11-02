-- Read-only catalog verification for a separately authorized PostgreSQL 17 target.
-- This file has NOT been executed. No customer rows or secrets are returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
SELECT current_setting('server_version_num') AS server_version_num;
WITH expected(name) AS (VALUES
 ('user_communication_preferences'), ('phone_verification_challenges'),
 ('notification_events'), ('notification_jobs'), ('notification_delivery_attempts'), ('notification_callbacks'))
SELECT e.name, c.relkind='r' AS ordinary_table, c.relrowsecurity AS rls_enabled,
 EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=c.oid AND p.polname='fmt_notification_server') AS runtime_policy_present,
 NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','fmt_audit_capture_dev','fmt_audit_worker_dev']) AS roles(role_name)
  WHERE has_table_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS private_roles_denied,
 (has_table_privilege('fm_app_runtime',c.oid,'SELECT')
  AND has_table_privilege('fm_app_runtime',c.oid,'INSERT')
  AND has_table_privilege('fm_app_runtime',c.oid,'UPDATE')
  AND has_table_privilege('fm_app_runtime',c.oid,'DELETE')) AS application_dml_granted
FROM expected e LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass('public.'||e.name) ORDER BY e.name;
-- Expect all NOT NULL, defaults false/email/24/0, with the indicated types.
SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS column_type,a.attnotnull,
 pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped
 AND ((c.relname='services' AND a.attname IN('reminder_enabled','reminder_method','reminder_hours'))
  OR (c.relname='bookings' AND a.attname='notification_revision')) ORDER BY c.relname,a.attname;
SELECT c.relname AS table_name,q.conname,q.contype,q.convalidated,pg_get_constraintdef(q.oid) AS definition
FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
WHERE c.relnamespace='public'::regnamespace AND (c.relname IN
 ('user_communication_preferences','phone_verification_challenges','notification_events','notification_jobs','notification_delivery_attempts','notification_callbacks')
 OR q.conname IN('services_reminder_settings_check','bookings_notification_revision_check')) ORDER BY c.relname,q.conname;
SELECT c.relname AS index_name,i.indisunique,i.indisvalid,i.indisready,pg_get_indexdef(c.oid) AS definition
FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
WHERE t.relnamespace='public'::regnamespace AND t.relname IN
 ('user_communication_preferences','phone_verification_challenges','notification_events','notification_jobs','notification_delivery_attempts','notification_callbacks') ORDER BY c.relname;
COMMIT;
