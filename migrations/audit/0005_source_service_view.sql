-- NEW, NOT APPLIED. One service.viewed.v1/R90 extension; source development hbkooiknruimukkhshrk.
-- Execute through execute-service-view.mjs, which pins/expands the single include.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
SET LOCAL intervalstyle='postgres';
DO $$ BEGIN IF current_user<>'postgres' OR current_user<>session_user
 OR current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION 'Fixed PG17 setup identity required'; END IF; END $$;
DO $$ BEGIN
 IF pg_has_role(current_user,'fm_audit_contract_owner','USAGE') OR pg_has_role(current_user,'fm_audit_contract_owner','SET') THEN
  RAISE EXCEPTION 'Setup owner access must start inert'; END IF;
 PERFORM set_config('audit_service_view.contract_before',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
   'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)::text
   FROM pg_auth_members m WHERE m.roleid='fm_audit_contract_owner'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('GRANT fm_audit_contract_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',current_user,
  CASE WHEN coalesce((SELECT admin_option FROM pg_auth_members WHERE roleid='fm_audit_contract_owner'::regrole
   AND member=current_user::regrole AND grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $$;
DO $$ BEGIN
 IF pg_has_role(current_user,'fm_audit_source_owner','USAGE') OR pg_has_role(current_user,'fm_audit_source_owner','SET') THEN
  RAISE EXCEPTION 'Setup owner access must start inert'; END IF;
 PERFORM set_config('audit_service_view.storage_before',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
   'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)::text
   FROM pg_auth_members m WHERE m.roleid='fm_audit_source_owner'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('GRANT fm_audit_source_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',current_user,
  CASE WHEN coalesce((SELECT admin_option FROM pg_auth_members WHERE roleid='fm_audit_source_owner'::regrole
   AND member=current_user::regrole AND grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $$;
SET LOCAL ROLE fm_audit_contract_owner;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM audit_contract.installation WHERE singleton AND project_ref='hbkooiknruimukkhshrk' AND environment='development')
 OR NOT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='contract-v1')
 OR EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='service-view-v1-0005')
 THEN RAISE EXCEPTION 'Service-view installation/version precondition failed'; END IF; END $$;
\ir _service_view_v1.sql
INSERT INTO audit_contract.migrations(version) VALUES('service-view-v1-0005');
RESET ROLE;
SET LOCAL ROLE fm_audit_source_owner;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM audit_capture.schema_migrations WHERE version='source-rehearsal-0004')
 OR EXISTS(SELECT 1 FROM audit_capture.schema_migrations WHERE version='source-service-view-0005')
 THEN RAISE EXCEPTION 'Storage installation/version precondition failed'; END IF; END $$;
-- Match the two exact original checks by referenced columns and normalized PG17
-- definition, rather than assuming automatically generated constraint names.
DO $$ DECLARE q record; expiry_name name; class_name name; compact text; BEGIN
 FOR q IN SELECT c.conname,c.conkey,pg_get_constraintdef(c.oid,false) AS definition FROM pg_constraint c
 WHERE c.conrelid='audit_capture.audit_outbox'::regclass AND c.contype='c' AND c.convalidated LOOP
  compact:=regexp_replace(replace(replace(q.definition,'::text',''),'::interval',''),'[[:space:]()]','','g');
  IF ARRAY(SELECT unnest(q.conkey) ORDER BY 1)=ARRAY[6,7]::smallint[]
   AND compact IN ('CHECKexpires_at=occurred_at+''8760:00:00''','CHECKexpires_at=occurred_at+''31536000seconds''') THEN
   IF expiry_name IS NOT NULL THEN RAISE EXCEPTION 'Ambiguous expiry constraint'; END IF; expiry_name:=q.conname;
  ELSIF q.conkey=ARRAY[3]::smallint[] AND compact='CHECKenvelope->>''retentionClass''=ANYARRAY[''B'',''S'']ISTRUE' THEN
   IF class_name IS NOT NULL THEN RAISE EXCEPTION 'Ambiguous class constraint'; END IF; class_name:=q.conname;
  END IF;
 END LOOP;
 IF expiry_name IS NULL OR class_name IS NULL THEN RAISE EXCEPTION 'Exact original retention checks missing'; END IF;
 EXECUTE format('ALTER TABLE audit_capture.audit_outbox DROP CONSTRAINT %I, DROP CONSTRAINT %I',expiry_name,class_name);
END $$;
ALTER TABLE audit_capture.audit_outbox ADD CONSTRAINT service_view_retention_v1 CHECK ((CASE
 WHEN envelope->>'eventName'='service.viewed.v1' THEN envelope->>'retentionClass'='R' AND expires_at=occurred_at+interval '7776000 seconds'
 ELSE envelope->>'retentionClass' IN ('B','S') AND expires_at=occurred_at+interval '31536000 seconds' END) IS TRUE);
CREATE OR REPLACE FUNCTION audit_capture.enqueue(canonical_json text,payload_hash text,hash_version text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE e jsonb; id uuid; old audit_capture.audit_outbox%ROWTYPE; occurred timestamptz; n timestamptz:=clock_timestamp();
BEGIN
  e:=audit_contract.parse_event(canonical_json,payload_hash,hash_version);
  id:=(e->>'eventId')::uuid; occurred:=(e->>'occurredAt')::timestamptz;
  IF occurred>n+interval '300 seconds' OR occurred+(CASE WHEN e->>'retentionClass'='R' THEN interval '7776000 seconds' ELSE interval '31536000 seconds' END)<=n THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Audit event outside ingestion window';
  END IF;
  INSERT INTO audit_capture.audit_outbox(event_id,canonical_json,envelope,payload_hash,hash_version,occurred_at,expires_at)
  VALUES(id,canonical_json,e,payload_hash,hash_version,occurred,occurred+CASE WHEN e->>'retentionClass'='R' THEN interval '7776000 seconds' ELSE interval '31536000 seconds' END)
  ON CONFLICT(event_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO STRICT old FROM audit_capture.audit_outbox q WHERE q.event_id=id;
    IF old.canonical_json IS DISTINCT FROM canonical_json OR old.payload_hash IS DISTINCT FROM payload_hash OR old.hash_version IS DISTINCT FROM hash_version THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Audit event identity conflict';
    END IF;
  END IF;
  RETURN id;
END $$;
INSERT INTO audit_capture.schema_migrations(version) VALUES('source-service-view-0005');
SELECT EXISTS(SELECT 1 FROM audit_capture.schema_migrations WHERE version='source-service-view-0005') AS service_view_version_recorded;
RESET ROLE;
DO $$ DECLARE original jsonb:=current_setting('audit_service_view.storage_before')::jsonb; prior jsonb; observed jsonb; BEGIN
 SELECT value INTO prior FROM jsonb_array_elements(original) WHERE (value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN EXECUTE format('REVOKE fm_audit_source_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE EXECUTE format('GRANT fm_audit_source_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
  current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
  'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)
 INTO observed FROM pg_auth_members m WHERE m.roleid='fm_audit_source_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_source_owner','USAGE') OR pg_has_role(current_user,'fm_audit_source_owner','SET')
 THEN RAISE EXCEPTION 'Exact setup owner restoration failed'; END IF;
END $$;
DO $$ DECLARE original jsonb:=current_setting('audit_service_view.contract_before')::jsonb; prior jsonb; observed jsonb; BEGIN
 SELECT value INTO prior FROM jsonb_array_elements(original) WHERE (value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN EXECUTE format('REVOKE fm_audit_contract_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE EXECUTE format('GRANT fm_audit_contract_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
  current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
  'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)
 INTO observed FROM pg_auth_members m WHERE m.roleid='fm_audit_contract_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_contract_owner','USAGE') OR pg_has_role(current_user,'fm_audit_contract_owner','SET')
 THEN RAISE EXCEPTION 'Exact setup owner restoration failed'; END IF;
END $$;
COMMIT;
