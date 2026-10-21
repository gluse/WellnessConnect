-- INCLUDED by exactly one source/destination migration, inside its transaction.
-- PostgreSQL 14+; fresh audit namespaces/roles only. No credentials/extensions.
-- Do not run this include by itself. Exact canonical JSON remains a BE boundary.
DO $$ BEGIN
  IF current_user <> session_user OR current_setting('server_version_num')::integer < 140000
     OR current_setting('server_encoding') <> 'UTF8'
     OR current_setting('audit_migration.environment', true) IS NULL
     OR current_setting('audit_migration.environment') !~ '^[a-z][a-z0-9-]{0,31}$'
     OR current_setting('audit_migration.project_ref', true) IS NULL THEN
    RAISE EXCEPTION 'Audit migration precondition failed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('audit_contract','audit_capture','audit')) THEN
    RAISE EXCEPTION 'Audit namespaces already exist; reconcile migration history';
  END IF;
END $$;

CREATE ROLE fm_audit_contract_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
DO $$ BEGIN EXECUTE format('GRANT fm_audit_contract_owner TO %I', current_user); END $$;
CREATE SCHEMA audit_contract AUTHORIZATION fm_audit_contract_owner;
REVOKE ALL ON SCHEMA audit_contract FROM PUBLIC;
SET LOCAL ROLE fm_audit_contract_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE audit_contract.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project_ref text NOT NULL,
  environment text NOT NULL CHECK (environment ~ '^[a-z][a-z0-9-]{0,31}$'),
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO audit_contract.installation(project_ref, environment)
VALUES (current_setting('audit_migration.project_ref'), current_setting('audit_migration.environment'));
CREATE TABLE audit_contract.migrations (
  version text PRIMARY KEY,
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO audit_contract.migrations(version) VALUES ('contract-v1');

CREATE FUNCTION audit_contract.assert_object(p jsonb, required text[], optional text[] DEFAULT ARRAY[]::text[])
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR (p ?& required) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid audit event contract';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p) AS k(key) WHERE NOT (key = ANY(required || optional))) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid audit event contract';
  END IF;
END $$;

-- Inspect raw JSON before jsonb can collapse duplicate keys. Bounded recursion.
CREATE FUNCTION audit_contract.assert_tree(p json, depth integer DEFAULT 0)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE n integer := 1; child json; k text; count_keys integer;
BEGIN
  IF depth > 12 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF json_typeof(p) = 'object' THEN
    SELECT count(*) INTO count_keys FROM json_each(p);
    IF count_keys > 256 OR count_keys <> (SELECT count(DISTINCT key COLLATE "C") FROM json_each(p)) THEN
      RAISE EXCEPTION 'Invalid audit event contract';
    END IF;
    FOR k, child IN SELECT key, value FROM json_each(p) LOOP
      IF k IN ('__proto__','constructor','prototype') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
      n := n + audit_contract.assert_tree(child, depth + 1);
    END LOOP;
  ELSIF json_typeof(p) = 'array' THEN
    IF json_array_length(p) > 100 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
    FOR child IN SELECT value FROM json_array_elements(p) LOOP
      n := n + audit_contract.assert_tree(child, depth + 1);
    END LOOP;
  END IF;
  IF n > 8192 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  RETURN n;
END $$;

CREATE FUNCTION audit_contract.is_uuid(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT COALESCE(jsonb_typeof(p) = 'string' AND (p #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false)
$$;
CREATE FUNCTION audit_contract.is_company_id(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT COALESCE(jsonb_typeof(p) = 'string' AND (p #>> '{}') ~ '^[1-9][0-9]{0,9}$', false)
$$;

CREATE FUNCTION audit_contract.parse_event(canonical_json text, payload_hash text, hash_version text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE e jsonb; a jsonb; s jsonb; t jsonb; src jsonb; c jsonb; v jsonb;
  name text; outcome text; reason text; kind text; field_name text; component text;
  local_mutation boolean; self_event boolean; company_event boolean; expected_class text;
  expected_fields text[]; seen_fields text[] := ARRAY[]::text[]; ts timestamptz;
BEGIN
  IF canonical_json IS NULL OR octet_length(convert_to(canonical_json, 'UTF8')) NOT BETWEEN 2 AND 32768
     OR hash_version IS DISTINCT FROM 'sha256-sorted-json-v1'
     OR payload_hash IS NULL OR payload_hash !~ '^[0-9a-f]{64}$'
     OR encode(sha256(convert_to(canonical_json, 'UTF8')), 'hex') IS DISTINCT FROM payload_hash THEN
    RAISE EXCEPTION 'Invalid audit event contract';
  END IF;
  PERFORM audit_contract.assert_tree(canonical_json::json);
  e := canonical_json::jsonb;
  PERFORM audit_contract.assert_object(e, ARRAY['actor','scope','target','source','requestId','operationId',
    'eventId','schemaVersion','catalogVersion','occurredAt','eventName','outcome','changes','retentionClass'],
    ARRAY['parentEventId','reasonCode']);
  IF e->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR e->'catalogVersion' IS DISTINCT FROM '1'::jsonb
     OR NOT audit_contract.is_uuid(e->'eventId') OR NOT audit_contract.is_uuid(e->'requestId')
     OR NOT audit_contract.is_uuid(e->'operationId')
     OR (e ? 'parentEventId' AND NOT audit_contract.is_uuid(e->'parentEventId')) THEN
    RAISE EXCEPTION 'Invalid audit event contract';
  END IF;
  IF jsonb_typeof(e->'occurredAt') IS DISTINCT FROM 'string'
     OR (e->>'occurredAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN
    RAISE EXCEPTION 'Invalid audit event contract';
  END IF;
  ts := (e->>'occurredAt')::timestamptz;
  IF ts < '2000-01-01 00:00:00+00'::timestamptz OR ts >= '2200-01-01 00:00:00+00'::timestamptz
     OR to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> e->>'occurredAt' THEN
    RAISE EXCEPTION 'Invalid audit event contract';
  END IF;
  a:=e->'actor'; s:=e->'scope'; t:=e->'target'; src:=e->'source';
  kind:=a->>'kind';
  IF kind = 'user' THEN
    PERFORM audit_contract.assert_object(a, ARRAY['kind','userId','effectiveRole']);
    IF NOT audit_contract.is_uuid(a->'userId') OR (a->>'effectiveRole' IN ('seeker','provider','owner','admin','viewer','support')) IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid audit event contract';
    END IF;
  ELSIF kind = 'anonymous' THEN
    PERFORM audit_contract.assert_object(a, ARRAY['kind']);
  ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF s->>'kind' IN ('personal','company') THEN
    PERFORM audit_contract.assert_object(s, ARRAY['kind','workspaceId']);
    IF (s->>'kind' = 'personal' AND NOT audit_contract.is_uuid(s->'workspaceId'))
       OR (s->>'kind' = 'company' AND NOT audit_contract.is_company_id(s->'workspaceId')) THEN
      RAISE EXCEPTION 'Invalid audit event contract';
    END IF;
  ELSIF s->>'kind' = 'unknown' THEN
    PERFORM audit_contract.assert_object(s, ARRAY['kind']);
  ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF; -- No staged global events.
  IF t->>'type' = 'request' THEN
    PERFORM audit_contract.assert_object(t, ARRAY['type']);
  ELSIF t->>'type' IN ('user','membership','company') THEN
    PERFORM audit_contract.assert_object(t, ARRAY['type','id']);
    IF (t->>'type' = 'company' AND NOT audit_contract.is_company_id(t->'id'))
       OR (t->>'type' <> 'company' AND NOT audit_contract.is_uuid(t->'id')) THEN
      RAISE EXCEPTION 'Invalid audit event contract';
    END IF;
  ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF (kind='anonymous' AND (s->>'kind'<>'unknown' OR t->>'type'<>'request'))
     OR (s->>'kind'='unknown' AND t->>'type'<>'request')
     OR (s->>'kind'='company' AND kind='user' AND a->>'effectiveRole' NOT IN ('owner','admin','provider','viewer'))
     OR (s->>'kind'='personal' AND kind='user' AND a->>'effectiveRole' NOT IN ('seeker','provider'))
     OR (t->>'type'='company' AND (s->>'kind'<>'company' OR t->>'id'<>s->>'workspaceId'))
     OR (t->>'type'='membership' AND s->>'kind'<>'company') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  PERFORM audit_contract.assert_object(src, ARRAY['application','environment','component'], ARRAY['release']);
  IF src->>'application' IS DISTINCT FROM 'fitsmytime'
     OR jsonb_typeof(src->'environment') IS DISTINCT FROM 'string'
     OR (src->>'environment') IS DISTINCT FROM (SELECT environment FROM audit_contract.installation WHERE singleton)
     OR (src ? 'release' AND (jsonb_typeof(src->'release') IS DISTINCT FROM 'string' OR (src->>'release') !~ '^[a-f0-9]{7,64}$')) THEN
    RAISE EXCEPTION 'Invalid audit event contract';
  END IF;
  name:=e->>'eventName'; outcome:=e->>'outcome'; reason:=e->>'reasonCode';
  IF (name IN ('auth.login.v1','auth.oauth_started.v1','auth.oauth_callback.v1','auth.session_established.v1',
      'auth.logout.v1','auth.password_changed.v1','security.action_denied.v1','account.details_changed.v1',
      'account.active_role_changed.v1','company.membership_changed.v1','company.ownership_transferred.v1')) IS NOT TRUE
     OR (outcome IN ('succeeded','rejected','denied','failed','unknown')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  company_event:=name IN ('company.membership_changed.v1','company.ownership_transferred.v1');
  local_mutation:=name LIKE 'account.%' OR company_event;
  self_event:=name IN ('auth.session_established.v1','auth.logout.v1','auth.password_changed.v1','account.details_changed.v1','account.active_role_changed.v1');
  component:=CASE WHEN name LIKE 'auth.%' THEN 'auth' WHEN name LIKE 'account.%' THEN 'account' WHEN company_event THEN 'company-access' ELSE 'authorization' END;
  expected_class:=CASE WHEN local_mutation THEN 'B' ELSE 'S' END;
  IF src->>'component' IS DISTINCT FROM component OR e->>'retentionClass' IS DISTINCT FROM expected_class
     OR (local_mutation AND outcome='unknown') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF name='security.action_denied.v1' AND (outcome<>'denied' OR t->>'type'<>'request'
     OR (reason IN ('UNAUTHENTICATED','FORBIDDEN','CROSS_WORKSPACE','WRONG_ORIGIN','RATE_LIMITED','SESSION_EXPIRED')) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF self_event AND (kind<>'user' OR t->>'type'<>'user' OR t->>'id'<>a->>'userId'
     OR s->>'kind'='unknown' OR (s->>'kind'='personal' AND s->>'workspaceId'<>a->>'userId')) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF company_event AND (kind<>'user' OR s->>'kind'<>'company' OR a->>'effectiveRole' NOT IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF (name='company.membership_changed.v1' AND t->>'type'<>'membership')
     OR (name='company.ownership_transferred.v1' AND (t->>'type'<>'company' OR kind<>'user' OR a->>'effectiveRole'<>'owner'))
     OR (name LIKE 'account.%' AND s->>'kind'<>'personal') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF name LIKE 'auth.%' AND NOT self_event THEN
    IF (outcome='succeeded' AND name<>'auth.oauth_started.v1' AND kind<>'user')
       OR (kind='user' AND (t->>'type'<>'user' OR t->>'id'<>a->>'userId'))
       OR (kind='user' AND s->>'kind'='personal' AND s->>'workspaceId'<>a->>'userId') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  END IF;
  IF e ? 'reasonCode' AND (jsonb_typeof(e->'reasonCode') IS DISTINCT FROM 'string' OR reason NOT IN (
     'INVALID_INPUT','INVALID_CREDENTIALS','UNAUTHENTICATED','FORBIDDEN','CROSS_WORKSPACE','WRONG_ORIGIN','RATE_LIMITED',
     'PROVIDER_DISABLED','OAUTH_CANCELLED','SESSION_EXPIRED','CONFLICT','PROVIDER_UNAVAILABLE','PROVIDER_TIMEOUT','LOCAL_FAILURE','NO_CHANGE')) THEN
    RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF (outcome<>'succeeded' AND reason IS NULL) OR (outcome='succeeded' AND reason IS NOT NULL AND reason<>'NO_CHANGE')
     OR (outcome='unknown' AND (reason IS DISTINCT FROM 'PROVIDER_TIMEOUT' OR name='auth.session_established.v1'))
     OR (outcome='failed' AND (reason IN ('PROVIDER_UNAVAILABLE','LOCAL_FAILURE')) IS NOT TRUE)
     OR (outcome='denied' AND (reason IN ('INVALID_CREDENTIALS','UNAUTHENTICATED','FORBIDDEN','CROSS_WORKSPACE','WRONG_ORIGIN','RATE_LIMITED','SESSION_EXPIRED')) IS NOT TRUE)
     OR (outcome='rejected' AND (reason IN ('INVALID_INPUT','CONFLICT','PROVIDER_DISABLED','OAUTH_CANCELLED','SESSION_EXPIRED')) IS NOT TRUE)
     OR (reason='INVALID_CREDENTIALS' AND name NOT IN ('auth.login.v1','auth.password_changed.v1'))
     OR (reason='NO_CHANGE' AND (NOT local_mutation OR outcome<>'succeeded')) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF jsonb_typeof(e->'changes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF jsonb_array_length(e->'changes') > 64 OR (outcome<>'succeeded' AND jsonb_array_length(e->'changes')<>0)
     OR (reason='NO_CHANGE' AND jsonb_array_length(e->'changes')<>0) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  expected_fields:=CASE name WHEN 'account.details_changed.v1' THEN ARRAY['firstName','lastName']
    WHEN 'account.active_role_changed.v1' THEN ARRAY['currentRole'] WHEN 'company.membership_changed.v1' THEN ARRAY['role','employeeId']
    WHEN 'company.ownership_transferred.v1' THEN ARRAY['ownerId'] ELSE ARRAY[]::text[] END;
  FOR c IN SELECT value FROM jsonb_array_elements(e->'changes') LOOP
    field_name:=c->>'field';
    IF jsonb_typeof(c->'field') IS DISTINCT FROM 'string' OR (field_name=ANY(expected_fields)) IS NOT TRUE
       OR field_name=ANY(seen_fields) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
    seen_fields:=array_append(seen_fields, field_name);
    IF name='account.details_changed.v1' THEN
      PERFORM audit_contract.assert_object(c, ARRAY['field','redacted']);
      IF c->'redacted' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
    ELSE
      PERFORM audit_contract.assert_object(c, ARRAY['field','before','after']);
      IF c->'before' IS NOT DISTINCT FROM c->'after' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
      FOR v IN SELECT value FROM jsonb_each(c) WHERE key IN ('before','after') LOOP
        IF field_name='currentRole' AND (jsonb_typeof(v)<>'string' OR (v #>> '{}') NOT IN ('seeker','provider')) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
        IF field_name='role' AND (jsonb_typeof(v)<>'string' OR (v #>> '{}') NOT IN ('admin','provider','viewer')) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
        IF field_name='ownerId' AND NOT audit_contract.is_uuid(v) THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
        IF field_name='employeeId' AND jsonb_typeof(v)<>'null' THEN
          IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
          IF (v #>> '{}')::numeric<=0 OR (v #>> '{}')::numeric>1.7976931348623157e308::numeric
             OR trunc((v #>> '{}')::numeric)<>(v #>> '{}')::numeric THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
        END IF;
      END LOOP;
      IF name='company.ownership_transferred.v1' AND c->>'before'<>a->>'userId' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
    END IF;
  END LOOP;
  IF outcome='succeeded' AND cardinality(expected_fields)>0 AND cardinality(seen_fields)=0
     AND reason IS DISTINCT FROM 'NO_CHANGE' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  RETURN e;
EXCEPTION WHEN OTHERS THEN
  -- Do not leak raw JSON, cast inputs, parser locations or provider/private text.
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid audit event contract';
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA audit_contract FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA audit_contract FROM PUBLIC;
RESET ROLE;
-- Enclosing migration retains this temporary membership until its owner-to-owner
-- grants are complete, then revokes it. Never execute this include standalone.
