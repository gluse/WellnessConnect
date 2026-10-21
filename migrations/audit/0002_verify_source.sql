-- READ-ONLY metadata; execute only after approved source migration/target mapping.
-- Every named boolean must be true. No functions that enqueue/claim/purge.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SET LOCAL search_path=pg_catalog,pg_temp;
SELECT r.rolname,NOT r.rolcanlogin AS no_login,NOT r.rolsuper AS no_superuser,
  NOT r.rolbypassrls AS no_rls_bypass,NOT r.rolcreaterole AS no_create_role
FROM pg_roles r WHERE r.rolname IN ('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_capture',
  'fm_audit_delivery','fm_audit_source_maintenance','fm_audit_source_monitor') ORDER BY r.rolname;
SELECT n.nspname,c.relname,c.relrowsecurity AS rls_enabled,c.relowner='fm_audit_source_owner'::regrole AS dedicated_owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='audit_capture' AND c.relname IN ('audit_outbox','maintenance_runs') AND c.relkind='r';
SELECT has_function_privilege('fm_audit_capture','audit_capture.enqueue(text,text,text)','EXECUTE') AS capture_enqueue,
  NOT has_function_privilege('fm_audit_capture','audit_capture.claim(integer)','EXECUTE') AS capture_cannot_claim,
  has_function_privilege('fm_audit_delivery','audit_capture.claim(integer)','EXECUTE') AS delivery_claim,
  NOT has_function_privilege('fm_audit_delivery','audit_capture.purge_delivered(uuid,integer)','EXECUTE') AS delivery_cannot_purge,
  NOT has_table_privilege('fm_audit_capture','audit_capture.audit_outbox','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS capture_no_direct_table_access,
  NOT has_table_privilege('fm_audit_delivery','audit_capture.audit_outbox','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS delivery_no_direct_table_access;
SELECT p.proname,p.prosecdef AS security_definer,
  array_to_string(p.proconfig,';') ~ 'search_path=pg_catalog, ?pg_temp' AS trusted_path,
  NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS no_public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='audit_capture' AND p.proname IN ('enqueue','claim','ack','retry','quarantine','replay','purge_delivered','dispose_expired'))
   OR (n.nspname='audit_contract' AND p.proname='parse_event') ORDER BY n.nspname,p.proname;
SELECT tgname,tgenabled='O' AS enabled FROM pg_trigger WHERE tgrelid IN
  ('audit_capture.audit_outbox'::regclass,'audit_capture.maintenance_runs'::regclass) AND NOT tgisinternal ORDER BY tgname;
SELECT conname,convalidated AS validated FROM pg_constraint WHERE conrelid='audit_capture.audit_outbox'::regclass ORDER BY conname;
COMMIT;
