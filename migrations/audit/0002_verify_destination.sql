-- READ-ONLY metadata; execute only after approved destination target mapping.
-- Every named boolean must be true. This does not execute acceptance or purge.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL search_path=pg_catalog,pg_temp;
SELECT r.rolname,NOT r.rolcanlogin AS no_login,NOT r.rolsuper AS no_superuser,
  NOT r.rolbypassrls AS no_rls_bypass,NOT r.rolcreaterole AS no_create_role
FROM pg_roles r WHERE r.rolname IN ('fm_audit_contract_owner','fm_audit_destination_owner','fm_audit_writer',
  'fm_audit_reader','fm_audit_export','fm_audit_destination_maintenance') ORDER BY r.rolname;
SELECT n.nspname,c.relname,c.relrowsecurity AS rls_enabled,c.relowner='fm_audit_destination_owner'::regrole AS dedicated_owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='audit' AND c.relname IN ('events','integrity_incidents','maintenance_runs') AND c.relkind='r';
SELECT has_function_privilege('fm_audit_writer','audit.accept(text,text,text)','EXECUTE') AS writer_accept,
  NOT has_table_privilege('fm_audit_writer','audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS writer_no_direct_table_access,
  NOT has_function_privilege('fm_audit_writer','audit.purge_expired(uuid,integer)','EXECUTE') AS writer_cannot_purge,
  has_table_privilege('fm_audit_reader','audit.reader_events','SELECT') AS reader_projection,
  NOT has_table_privilege('fm_audit_reader','audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS reader_no_base_access,
  NOT has_table_privilege('fm_audit_export','audit.reader_events','SELECT') AS export_marker_has_no_read_access;
SELECT p.proname,p.prosecdef AS security_definer,
  array_to_string(p.proconfig,';') ~ 'search_path=pg_catalog, ?pg_temp' AS trusted_path,
  NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS no_public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='audit' AND p.proname IN ('accept','purge_expired'))
   OR (n.nspname='audit_contract' AND p.proname='parse_event') ORDER BY n.nspname,p.proname;
SELECT tgname,tgenabled='O' AS enabled FROM pg_trigger WHERE tgrelid IN
  ('audit.events'::regclass,'audit.integrity_incidents'::regclass,'audit.maintenance_runs'::regclass) AND NOT tgisinternal ORDER BY tgname;
SELECT conname,convalidated AS validated FROM pg_constraint WHERE conrelid='audit.events'::regclass ORDER BY conname;
COMMIT;
