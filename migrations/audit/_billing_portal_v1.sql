-- Forward extension: preserve the published billing and legacy parsers unchanged.
ALTER FUNCTION audit_contract.parse_event(text,text,text) RENAME TO parse_event_before_portal;
CREATE FUNCTION audit_contract.parse_event(canonical_json text,payload_hash text,hash_version text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $portal$
DECLARE e jsonb; a jsonb; s jsonb; t jsonb; src jsonb; n text; ts timestamptz;
BEGIN
 IF canonical_json IS NULL OR octet_length(convert_to(canonical_json,'UTF8')) NOT BETWEEN 2 AND 32768
  OR hash_version IS DISTINCT FROM 'sha256-sorted-json-v1' OR payload_hash IS NULL OR payload_hash !~ '^[a-f0-9]{64}$'
  OR encode(sha256(convert_to(canonical_json,'UTF8')),'hex') IS DISTINCT FROM payload_hash
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_tree(canonical_json::json); e:=canonical_json::jsonb; n:=e->>'eventName';
 IF n NOT IN ('billing.portal_reserved.v1','billing.portal_created.v1','billing.portal_unknown.v1') OR n IS NULL THEN
  RETURN audit_contract.parse_event_before_portal(canonical_json,payload_hash,hash_version);
 END IF;
 PERFORM audit_contract.assert_object(e,ARRAY['actor','scope','target','source','requestId','operationId','eventId','schemaVersion','catalogVersion','occurredAt','eventName','outcome','changes','retentionClass'],ARRAY['parentEventId','reasonCode']);
 IF e->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR e->'catalogVersion' IS DISTINCT FROM '1'::jsonb
  OR NOT audit_contract.is_uuid(e->'eventId') OR NOT audit_contract.is_uuid(e->'requestId') OR NOT audit_contract.is_uuid(e->'operationId')
  OR (e ? 'parentEventId' AND NOT audit_contract.is_uuid(e->'parentEventId'))
  OR e->'changes' IS DISTINCT FROM '[]'::jsonb OR e->>'retentionClass' IS DISTINCT FROM 'B'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF jsonb_typeof(e->'occurredAt') IS DISTINCT FROM 'string'
  OR (e->>'occurredAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ts:=(e->>'occurredAt')::timestamptz;
 IF ts<'2000-01-01 00:00:00+00'::timestamptz OR ts>='2200-01-01 00:00:00+00'::timestamptz
  OR to_char(ts AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>e->>'occurredAt'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 a:=e->'actor';s:=e->'scope';t:=e->'target';src:=e->'source';
 IF s->>'kind' IN ('personal','company') THEN
  PERFORM audit_contract.assert_object(s,ARRAY['kind','workspaceId']);
  IF (s->>'kind'='personal' AND NOT audit_contract.is_uuid(s->'workspaceId'))
   OR (s->>'kind'='company' AND (NOT audit_contract.is_company_id(s->'workspaceId') OR (s->>'workspaceId')::numeric>2147483647))
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF a->>'kind'='user' THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','userId','effectiveRole']);
  IF NOT audit_contract.is_uuid(a->'userId')
   OR (s->>'kind'='personal' AND (a->>'effectiveRole' IS DISTINCT FROM 'provider' OR a->>'userId'<>s->>'workspaceId'))
   OR (s->>'kind'='company' AND a->>'effectiveRole' IS DISTINCT FROM 'owner')
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF a->>'kind'='service' THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','serviceId']);
  IF a->>'serviceId' IS DISTINCT FROM 'billing-worker' OR n<>'billing.portal_unknown.v1' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_object(t,ARRAY['type','id']);
 IF t->>'type' IS DISTINCT FROM 'billing_operation' OR NOT audit_contract.is_uuid(t->'id') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_object(src,ARRAY['application','environment','component'],ARRAY['release']);
 IF src->>'application' IS DISTINCT FROM 'fitsmytime' OR src->>'component' IS DISTINCT FROM 'billing'
  OR src->>'environment' IS DISTINCT FROM (SELECT environment FROM audit_contract.installation WHERE singleton)
  OR (src ? 'release' AND (jsonb_typeof(src->'release') IS DISTINCT FROM 'string' OR (src->>'release') !~ '^[a-f0-9]{7,64}$'))
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF n='billing.portal_unknown.v1' THEN
  IF e->>'outcome' IS DISTINCT FROM 'unknown' OR e->>'reasonCode' IS DISTINCT FROM 'PROVIDER_TIMEOUT' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF e->>'outcome' IS DISTINCT FROM 'succeeded' OR e ? 'reasonCode' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 RETURN e;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid audit event contract';
END $portal$;
REVOKE ALL ON FUNCTION audit_contract.parse_event(text,text,text) FROM PUBLIC;
