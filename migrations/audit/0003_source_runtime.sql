-- Choice 1. NEW, NOT APPLIED. Source hbkooiknruimukkhshrk, development.
-- Own transaction. Logins stay NOLOGIN/passwordless until private provisioning.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
DO $$ DECLARE t text; p record; BEGIN
  IF current_user<>session_user OR current_setting('server_version_num')::integer/10000<>17 THEN
    RAISE EXCEPTION 'Runtime migration principal/version precondition failed'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN
      ('sessions','users','companies','company_memberships','company_invitations',
       'provider_subscriptions','storefronts','employees','categories','addresses','services',
       'geocoding_cache','bookings','service_reviews','service_embeddings','availability')) THEN
    RAISE EXCEPTION 'Unreviewed application table requires a new grant decision'; END IF;
  IF pg_has_role(current_user,'fm_audit_source_owner','USAGE') OR pg_has_role(current_user,'fm_audit_source_owner','SET') THEN
    RAISE EXCEPTION 'Existing effective setup owner access requires review'; END IF;
  FOREACH t IN ARRAY ARRAY['sessions','users','companies','company_memberships','company_invitations',
    'provider_subscriptions','storefronts','employees','categories','addresses','services',
    'geocoding_cache','bookings','service_reviews','service_embeddings','availability'] LOOP
    SELECT c.relowner,c.relrowsecurity,c.relkind INTO STRICT p FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t;
    IF p.relkind<>'r' OR NOT p.relrowsecurity OR p.relowner<>current_user::regrole THEN
      RAISE EXCEPTION 'App table owner/RLS precondition failed'; END IF;
    IF EXISTS(SELECT 1 FROM pg_policy q WHERE q.polrelid=format('public.%I',t)::regclass AND
      (q.polname='fmt_app_server' OR NOT q.polpermissive)) THEN
      RAISE EXCEPTION 'App policy collision/restrictive policy requires review'; END IF;
  END LOOP;
END $$;
CREATE ROLE fm_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fmt_app_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
CREATE ROLE fmt_audit_capture_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE fmt_audit_worker_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT USAGE ON SCHEMA public TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sessions,public.employees,public.categories,
  public.addresses,public.services,public.service_reviews,public.service_embeddings TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE ON public.users,public.companies,public.company_memberships,
  public.company_invitations,public.provider_subscriptions,public.storefronts,
  public.geocoding_cache,public.bookings,public.availability TO fm_app_runtime;
GRANT DELETE ON public.company_memberships TO fm_app_runtime;
GRANT USAGE ON SEQUENCE public.companies_id_seq,public.provider_subscriptions_id_seq,public.storefronts_id_seq,
  public.employees_id_seq,public.addresses_id_seq,public.services_id_seq,public.bookings_id_seq,
  public.service_reviews_id_seq,public.service_embeddings_id_seq,public.availability_id_seq TO fm_app_runtime;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['sessions','users','companies','company_memberships','company_invitations',
    'provider_subscriptions','storefronts','employees','categories','addresses','services',
    'geocoding_cache','bookings','service_reviews','service_embeddings','availability'] LOOP
    EXECUTE format('CREATE POLICY fmt_app_server ON public.%I FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true)',t);
  END LOOP;
END $$;
GRANT fm_app_runtime,fm_audit_capture TO fmt_app_dev WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
GRANT fm_audit_capture TO fmt_audit_capture_dev WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
GRANT fm_audit_delivery,fm_audit_source_monitor TO fmt_audit_worker_dev WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_namespace n
       WHERE r.rolname IN ('fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev')
       AND (has_schema_privilege(r.oid,n.oid,'CREATE') OR has_database_privilege(r.oid,current_database(),'CREATE')))
     OR has_function_privilege('fmt_app_dev','public.purge_expired_geocoding()','EXECUTE') THEN
    RAISE EXCEPTION 'Inherited DDL/maintenance privilege requires review'; END IF;
  -- Preserve every pre-existing maintenance membership, including creator
  -- ADMIN-only rows from a different grantor. Do not use a blanket REVOKE.
  PERFORM set_config('audit_runtime.owner_memberships_before',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,
      'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
      ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m
     WHERE m.roleid='fm_audit_source_owner'::regrole AND m.member=current_user::regrole),true);
  EXECUTE format('GRANT fm_audit_source_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',
    current_user,CASE WHEN coalesce((SELECT m.admin_option FROM pg_auth_members m
      WHERE m.roleid='fm_audit_source_owner'::regrole AND m.member=current_user::regrole
      AND m.grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $$;
SET LOCAL ROLE fm_audit_source_owner;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM audit_capture.schema_migrations WHERE version='source-0001') THEN
    RAISE EXCEPTION 'Installed source version missing'; END IF;
END $$;
INSERT INTO audit_capture.schema_migrations(version) VALUES('source-runtime-0003');
-- Installation metadata only. The executor requires this true result AND the
-- final COMMIT before reporting a committed version; no audit rows are read.
SELECT EXISTS(SELECT 1 FROM audit_capture.schema_migrations
  WHERE version='source-runtime-0003') AS runtime_version_recorded;
RESET ROLE;
DO $$ DECLARE original jsonb:=current_setting('audit_runtime.owner_memberships_before')::jsonb;
 prior jsonb; observed jsonb; BEGIN
 SELECT item.value INTO prior FROM jsonb_array_elements(original) AS item(value)
   WHERE (item.value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN
   EXECUTE format('REVOKE fm_audit_source_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE
   EXECUTE format('GRANT fm_audit_source_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
     current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,
   'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
   ORDER BY m.grantor),'[]'::jsonb) INTO observed FROM pg_auth_members m
   WHERE m.roleid='fm_audit_source_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_source_owner','USAGE')
    OR pg_has_role(current_user,'fm_audit_source_owner','SET') THEN
   RAISE EXCEPTION 'Setup owner membership restoration failed'; END IF;
END $$;
COMMIT;
