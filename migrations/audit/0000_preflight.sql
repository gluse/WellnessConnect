-- READ-ONLY metadata only. PREPARED, NOT EXECUTED. Run separately on each
-- privately verified service/profile. SQL cannot infer a Supabase project ref.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog,pg_temp;
SELECT current_database() AS database_name,current_user AS migration_principal,
  session_user AS login_principal,current_user=session_user AS no_prior_set_role,
  current_setting('server_version_num')::integer AS server_version_num,
  current_setting('server_version_num')::integer>=140000 AS supported_version,
  current_setting('server_encoding')='UTF8' AS utf8_database;
SELECT rolcreaterole,rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user;
SELECT has_database_privilege(current_user,current_database(),'CREATE') AS may_create_schema,
  to_regclass('public.users') IS NOT NULL AS application_users_present,
  to_regclass('public.bookings') IS NOT NULL AS application_bookings_present;
SELECT nspname AS existing_audit_namespace FROM pg_namespace
  WHERE nspname IN ('audit_contract','audit_capture','audit');
SELECT rolname AS existing_audit_role FROM pg_roles WHERE rolname LIKE 'fm_audit_%' ORDER BY rolname;
COMMIT;
