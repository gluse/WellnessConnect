-- Forward dispatch extension, included in an explicitly approved transaction.
-- Preserve the exact prior parser for every non-billing event.
ALTER FUNCTION audit_contract.parse_event(text,text,text) RENAME TO parse_event_before_billing;
CREATE FUNCTION audit_contract.parse_event(canonical_json text,payload_hash text,hash_version text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $billing$
DECLARE e jsonb; a jsonb; s jsonb; t jsonb; src jsonb; n text; k text; ts timestamptz; service boolean; user_actor boolean;
BEGIN
 IF canonical_json IS NULL OR octet_length(convert_to(canonical_json,'UTF8')) NOT BETWEEN 2 AND 32768
  OR hash_version IS DISTINCT FROM 'sha256-sorted-json-v1' OR payload_hash IS NULL OR payload_hash !~ '^[a-f0-9]{64}$'
  OR encode(sha256(convert_to(canonical_json,'UTF8')),'hex') IS DISTINCT FROM payload_hash
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_tree(canonical_json::json);
 e:=canonical_json::jsonb; n:=e->>'eventName';
 IF n NOT LIKE 'billing.%' OR n IS NULL THEN
  RETURN audit_contract.parse_event_before_billing(canonical_json,payload_hash,hash_version);
 END IF;
 PERFORM audit_contract.assert_object(e,ARRAY['actor','scope','target','source','requestId','operationId','eventId','schemaVersion','catalogVersion','occurredAt','eventName','outcome','changes','retentionClass'],ARRAY['parentEventId','reasonCode']);
 IF (n IN ('billing.checkout_reserved.v1','billing.checkout_created.v1','billing.checkout_unknown.v1',
  'billing.event_accepted.v1','billing.event_quarantined.v1','billing.subscription_reconciled.v1',
  'billing.offer_changed.v1','billing.manual_grant_changed.v1','billing.price_mapping_changed.v1','billing.workspace_initialized.v1','billing.checkout_resolved.v1')) IS NOT TRUE
  OR e->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR e->'catalogVersion' IS DISTINCT FROM '1'::jsonb
  OR NOT audit_contract.is_uuid(e->'eventId') OR NOT audit_contract.is_uuid(e->'requestId') OR NOT audit_contract.is_uuid(e->'operationId')
  OR (e ? 'parentEventId' AND NOT audit_contract.is_uuid(e->'parentEventId'))
  OR e->'changes' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF jsonb_typeof(e->'occurredAt') IS DISTINCT FROM 'string'
  OR (e->>'occurredAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ts:=(e->>'occurredAt')::timestamptz;
 IF ts<'2000-01-01 00:00:00+00'::timestamptz OR ts>='2200-01-01 00:00:00+00'::timestamptz
  OR to_char(ts AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>e->>'occurredAt'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 a:=e->'actor';s:=e->'scope';t:=e->'target';src:=e->'source';
 service:=a->>'kind'='service'; user_actor:=a->>'kind'='user';
 IF service THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','serviceId']);
  IF a->>'serviceId' IS DISTINCT FROM 'billing-worker' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF user_actor THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','userId','effectiveRole']);
  IF NOT audit_contract.is_uuid(a->'userId') OR (a->>'effectiveRole' IN ('provider','owner','support')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF s->>'kind' IN ('personal','company') THEN
  PERFORM audit_contract.assert_object(s,ARRAY['kind','workspaceId']);
  IF (s->>'kind'='personal' AND NOT audit_contract.is_uuid(s->'workspaceId'))
   OR (s->>'kind'='company' AND (NOT audit_contract.is_company_id(s->'workspaceId') OR (s->>'workspaceId')::numeric>2147483647))
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF s->>'kind' IN ('global','unknown') THEN PERFORM audit_contract.assert_object(s,ARRAY['kind']);
 ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_object(t,ARRAY['type','id']);
 IF n='billing.workspace_initialized.v1' THEN
  IF (t->>'type'='user' AND NOT audit_contract.is_uuid(t->'id'))
   OR (t->>'type'='company' AND (NOT audit_contract.is_company_id(t->'id') OR (t->>'id')::numeric>2147483647))
   OR (t->>'type' IN ('user','company')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF (t->>'type' IN ('billing_operation','billing_subscription','billing_event','manual_grant','billing_offer')) IS NOT TRUE
  OR NOT audit_contract.is_uuid(t->'id') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_object(src,ARRAY['application','environment','component'],ARRAY['release']);
 IF src->>'application' IS DISTINCT FROM 'fitsmytime' OR src->>'component' IS DISTINCT FROM 'billing'
  OR src->>'environment' IS DISTINCT FROM (SELECT environment FROM audit_contract.installation WHERE singleton)
  OR (src ? 'release' AND (jsonb_typeof(src->'release') IS DISTINCT FROM 'string' OR (src->>'release') !~ '^[a-f0-9]{7,64}$'))
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF n='billing.offer_changed.v1' THEN
  IF NOT user_actor OR a->>'effectiveRole'<>'support' OR s->>'kind'<>'global' OR t->>'type'<>'billing_offer' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n='billing.manual_grant_changed.v1' THEN
  IF NOT user_actor OR a->>'effectiveRole'<>'support' OR s->>'kind' NOT IN ('personal','company') OR t->>'type'<>'manual_grant' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n='billing.workspace_initialized.v1' THEN
  IF NOT user_actor OR (s->>'kind'='personal' AND (a->>'effectiveRole'<>'provider' OR s->>'workspaceId'<>a->>'userId' OR t->>'type'<>'user' OR t->>'id'<>a->>'userId'))
   OR (s->>'kind'='company' AND (a->>'effectiveRole'<>'owner' OR t->>'type'<>'company' OR t->>'id'<>s->>'workspaceId'))
   OR s->>'kind' NOT IN ('personal','company') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n IN ('billing.checkout_reserved.v1','billing.checkout_created.v1','billing.checkout_unknown.v1') THEN
  IF s->>'kind' NOT IN ('personal','company') OR t->>'type'<>'billing_operation'
   OR (service AND n<>'billing.checkout_unknown.v1')
   OR (user_actor AND ((s->>'kind'='personal' AND (a->>'effectiveRole'<>'provider' OR s->>'workspaceId'<>a->>'userId')) OR (s->>'kind'='company' AND a->>'effectiveRole'<>'owner')))
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSE
  IF NOT service OR (n<>'billing.event_quarantined.v1' AND s->>'kind' NOT IN ('personal','company'))
   OR (n='billing.event_quarantined.v1' AND s->>'kind' NOT IN ('personal','company','unknown'))
   OR (n IN ('billing.event_accepted.v1','billing.event_quarantined.v1') AND t->>'type'<>'billing_event')
   OR (n='billing.subscription_reconciled.v1' AND t->>'type'<>'billing_subscription')
   OR (n IN ('billing.price_mapping_changed.v1','billing.checkout_resolved.v1') AND t->>'type'<>'billing_operation')
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 END IF;
 IF n='billing.event_quarantined.v1' THEN
  IF e->>'retentionClass' IS DISTINCT FROM 'S' OR e->>'outcome' IS DISTINCT FROM 'rejected' OR e->>'reasonCode' IS DISTINCT FROM 'CONFLICT' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n='billing.checkout_unknown.v1' THEN
  IF e->>'retentionClass' IS DISTINCT FROM 'B' OR e->>'outcome' IS DISTINCT FROM 'unknown' OR e->>'reasonCode' IS DISTINCT FROM 'PROVIDER_TIMEOUT' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSE
  IF e->>'retentionClass' IS DISTINCT FROM 'B' OR e->>'outcome' IS DISTINCT FROM 'succeeded' OR e ? 'reasonCode' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 END IF;
 RETURN e;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid audit event contract';
END $billing$;
REVOKE ALL ON FUNCTION audit_contract.parse_event(text,text,text) FROM PUBLIC;
