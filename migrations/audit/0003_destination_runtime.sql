-- NEW, NOT APPLIED. Audit ynygqodmtgjrngiudalw, development.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
CREATE ROLE fmt_audit_writer_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT fm_audit_writer TO fmt_audit_writer_dev WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
DO $$ BEGIN
  IF has_schema_privilege('fmt_audit_writer_dev','public','CREATE')
     OR has_database_privilege('fmt_audit_writer_dev',current_database(),'CREATE')
     OR has_table_privilege('fmt_audit_writer_dev','audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'Destination inherited privilege requires review'; END IF;
  EXECUTE format('GRANT fm_audit_destination_owner TO %I',current_user);
END $$;
SET LOCAL ROLE fm_audit_destination_owner;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM audit.schema_migrations WHERE version='destination-0001') THEN
    RAISE EXCEPTION 'Installed destination version missing'; END IF;
END $$;
INSERT INTO audit.schema_migrations(version) VALUES('destination-runtime-0003');
RESET ROLE;
DO $$ BEGIN EXECUTE format('REVOKE fm_audit_destination_owner FROM %I',current_user); END $$;
COMMIT;
