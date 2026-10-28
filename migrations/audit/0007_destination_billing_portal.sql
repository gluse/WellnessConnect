-- Forward opt-in billing portal parser; prepared only, no activation or retention change.
-- Target destination development ynygqodmtgjrngiudalw; exact future execution approval required.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $setup$ BEGIN
 IF current_user<>'postgres' OR current_user<>session_user OR current_setting('server_version_num')::integer/10000<>17
  OR pg_has_role(current_user,'fm_audit_contract_owner','USAGE') OR pg_has_role(current_user,'fm_audit_contract_owner','SET')
 THEN RAISE EXCEPTION 'Billing audit setup identity/baseline rejected'; END IF;
 PERFORM set_config('audit_billing_portal.contract_before',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
    'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)::text
   FROM pg_catalog.pg_auth_members m WHERE m.roleid='fm_audit_contract_owner'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('GRANT fm_audit_contract_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',current_user,
  CASE WHEN coalesce((SELECT admin_option FROM pg_catalog.pg_auth_members WHERE roleid='fm_audit_contract_owner'::regrole
   AND member=current_user::regrole AND grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $setup$;
SET LOCAL ROLE fm_audit_contract_owner;
DO $baseline$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM audit_contract.installation WHERE singleton AND project_ref='ynygqodmtgjrngiudalw' AND environment='development')
  OR NOT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='billing-v1-0006')
  OR EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='billing-portal-v1-0007')
  OR to_regprocedure('audit_contract.parse_event_before_portal(text,text,text)') IS NOT NULL
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='audit_contract.parse_event(text,text,text)'::regprocedure
    AND p.proowner=current_user::regrole AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='8125d3d26bb142b52ab7abbde95fefaa3123e601744aa67292bee8e6a308f796')
 THEN RAISE EXCEPTION 'Billing audit parser precondition failed'; END IF;
END $baseline$;
\ir _billing_portal_v1.sql
GRANT EXECUTE ON FUNCTION audit_contract.parse_event(text,text,text) TO fm_audit_destination_owner;
INSERT INTO audit_contract.migrations(version) VALUES('billing-portal-v1-0007');
RESET ROLE;
DO $restore$ DECLARE original jsonb:=current_setting('audit_billing_portal.contract_before')::jsonb; prior jsonb; observed jsonb; BEGIN
 SELECT value INTO prior FROM jsonb_array_elements(original) WHERE (value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN EXECUTE format('REVOKE fm_audit_contract_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE EXECUTE format('GRANT fm_audit_contract_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
  current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
  'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)
 INTO observed FROM pg_catalog.pg_auth_members m WHERE m.roleid='fm_audit_contract_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_contract_owner','USAGE') OR pg_has_role(current_user,'fm_audit_contract_owner','SET')
 THEN RAISE EXCEPTION 'Exact billing setup owner restoration failed'; END IF;
END $restore$;
SELECT true AS billing_portal_audit_contract_created;
COMMIT;
