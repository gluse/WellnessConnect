-- NEW, NOT APPLIED. Audit ynygqodmtgjrngiudalw, development.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
DO $$ BEGIN
  IF current_user<>session_user OR current_setting('server_version_num')::integer/10000<>17
     OR pg_has_role(current_user,'fm_audit_destination_owner','USAGE') OR pg_has_role(current_user,'fm_audit_destination_owner','SET')
     OR to_regclass('public.users') IS NOT NULL OR to_regclass('public.bookings') IS NOT NULL THEN
    RAISE EXCEPTION 'Destination principal/version/separation precondition failed'; END IF;
END $$;
CREATE ROLE fmt_audit_writer_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT fm_audit_writer TO fmt_audit_writer_dev WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege('fmt_audit_writer_dev',n.oid,'CREATE'))
     OR has_database_privilege('fmt_audit_writer_dev',current_database(),'CREATE')
     OR has_table_privilege('fmt_audit_writer_dev',
       (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='audit' AND c.relname='events'),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'Destination inherited privilege requires review'; END IF;
  PERFORM set_config('audit_runtime.owner_memberships_before',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,
      'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
      ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m
     WHERE m.roleid='fm_audit_destination_owner'::regrole AND m.member=current_user::regrole),true);
  EXECUTE format('GRANT fm_audit_destination_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',
    current_user,CASE WHEN coalesce((SELECT m.admin_option FROM pg_auth_members m
      WHERE m.roleid='fm_audit_destination_owner'::regrole AND m.member=current_user::regrole
      AND m.grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $$;
SET LOCAL ROLE fm_audit_destination_owner;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM audit.schema_migrations WHERE version='destination-0001') THEN
    RAISE EXCEPTION 'Installed destination version missing'; END IF;
END $$;
INSERT INTO audit.schema_migrations(version) VALUES('destination-runtime-0003');
-- Installation metadata only; combine this receipt with final COMMIT.
SELECT EXISTS(SELECT 1 FROM audit.schema_migrations
  WHERE version='destination-runtime-0003') AS runtime_version_recorded;
RESET ROLE;
DO $$ DECLARE original jsonb:=current_setting('audit_runtime.owner_memberships_before')::jsonb;
 prior jsonb; observed jsonb; BEGIN
 SELECT item.value INTO prior FROM jsonb_array_elements(original) AS item(value)
   WHERE (item.value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN
   EXECUTE format('REVOKE fm_audit_destination_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE
   EXECUTE format('GRANT fm_audit_destination_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
     current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,
   'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
   ORDER BY m.grantor),'[]'::jsonb) INTO observed FROM pg_auth_members m
   WHERE m.roleid='fm_audit_destination_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_destination_owner','USAGE')
    OR pg_has_role(current_user,'fm_audit_destination_owner','SET') THEN
   RAISE EXCEPTION 'Setup owner membership restoration failed'; END IF;
END $$;
COMMIT;
