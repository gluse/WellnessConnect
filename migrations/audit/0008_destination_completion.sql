-- Forward development audit completion, no backup by explicit user request 7 November 2026.
-- Target destination ynygqodmtgjrngiudalw; execute only through complete-audit-development.mjs.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL timezone='UTC';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $identity$ BEGIN IF current_user<>'postgres' OR current_user<>session_user OR current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION 'Fixed PG17 setup identity required'; END IF; END $identity$;
DO $membership$ BEGIN
 IF pg_has_role(current_user,'fm_audit_contract_owner','USAGE') OR pg_has_role(current_user,'fm_audit_contract_owner','SET') THEN RAISE EXCEPTION 'Setup owner baseline must be inert'; END IF;
 PERFORM set_config('audit_completion.fm_audit_contract_owner',(SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m WHERE m.roleid='fm_audit_contract_owner'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('GRANT fm_audit_contract_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',current_user,CASE WHEN coalesce((SELECT admin_option FROM pg_auth_members WHERE roleid='fm_audit_contract_owner'::regrole AND member=current_user::regrole AND grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $membership$;
DO $membership$ BEGIN
 IF pg_has_role(current_user,'fm_audit_destination_owner','USAGE') OR pg_has_role(current_user,'fm_audit_destination_owner','SET') THEN RAISE EXCEPTION 'Setup owner baseline must be inert'; END IF;
 PERFORM set_config('audit_completion.fm_audit_destination_owner',(SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m WHERE m.roleid='fm_audit_destination_owner'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('GRANT fm_audit_destination_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',current_user,CASE WHEN coalesce((SELECT admin_option FROM pg_auth_members WHERE roleid='fm_audit_destination_owner'::regrole AND member=current_user::regrole AND grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $membership$;
SET LOCAL ROLE fm_audit_contract_owner;
DO $baseline$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM audit_contract.installation WHERE singleton AND project_ref='ynygqodmtgjrngiudalw' AND environment='development')
 OR NOT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='billing-portal-v1-0007')
 OR EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='completion-v1-0008')
 OR to_regprocedure('audit_contract.parse_event_before_completion(text,text,text)') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='audit_contract.parse_event(text,text,text)'::regprocedure AND proowner=current_user::regrole AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='986d13a576a6bb53a5204670117f448d505defd7703f639ce3665adbc9f9e8d5')
 THEN RAISE EXCEPTION 'Completion fixed baseline rejected'; END IF;
END $baseline$;
-- Additive dispatch: legacy parser bodies and accepted history remain unchanged.
ALTER FUNCTION audit_contract.parse_event(text,text,text) RENAME TO parse_event_before_completion;
CREATE FUNCTION audit_contract.parse_event(canonical_json text,payload_hash text,hash_version text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $completion$
DECLARE e jsonb; a jsonb; s jsonb; t jsonb; src jsonb; n text; ts timestamptz; c jsonb;
 fields text[]:=ARRAY[]::text[]; field_name text; v text; stage text; reported text; storage text;
BEGIN
 IF canonical_json IS NULL OR octet_length(convert_to(canonical_json,'UTF8')) NOT BETWEEN 2 AND 32768
  OR hash_version IS DISTINCT FROM 'sha256-sorted-json-v1' OR payload_hash IS NULL OR payload_hash !~ '^[a-f0-9]{64}$'
  OR encode(sha256(convert_to(canonical_json,'UTF8')),'hex') IS DISTINCT FROM payload_hash
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 PERFORM audit_contract.assert_tree(canonical_json::json);e:=canonical_json::jsonb;n:=e->>'eventName';
 IF n IS NULL OR n NOT IN ('data.record_created.v1','data.record_updated.v1','data.record_deleted.v1',
  'audit.records_viewed.v1','audit.records_exported.v1','location.observation_recorded.v1','auth.operation_requested.v1','auth.operation_reported.v1','activity.records_read.v1','integration.operation_requested.v1','integration.operation_reported.v1') THEN
  RETURN audit_contract.parse_event_before_completion(canonical_json,payload_hash,hash_version);
 END IF;
 PERFORM audit_contract.assert_object(e,ARRAY['actor','scope','target','source','requestId','operationId','eventId','schemaVersion','catalogVersion','occurredAt','eventName','outcome','changes','retentionClass'],ARRAY['reasonCode','parentEventId']);
 IF e->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR e->'catalogVersion' IS DISTINCT FROM '1'::jsonb
  OR NOT audit_contract.is_uuid(e->'eventId') OR NOT audit_contract.is_uuid(e->'requestId') OR NOT audit_contract.is_uuid(e->'operationId')
  OR (e ? 'parentEventId' AND NOT audit_contract.is_uuid(e->'parentEventId'))
  OR (n NOT LIKE 'auth.operation_%' AND n NOT LIKE 'integration.operation_%' AND (e->>'outcome' IS DISTINCT FROM 'succeeded' OR e ? 'reasonCode')) OR jsonb_typeof(e->'changes') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF jsonb_typeof(e->'occurredAt') IS DISTINCT FROM 'string'
  OR (e->>'occurredAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ts:=(e->>'occurredAt')::timestamptz;
 IF ts<'2000-01-01 00:00:00+00'::timestamptz OR ts>='2200-01-01 00:00:00+00'::timestamptz
  OR to_char(ts AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>e->>'occurredAt'
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 a:=e->'actor';s:=e->'scope';t:=e->'target';src:=e->'source';
 PERFORM audit_contract.assert_object(src,ARRAY['application','environment','component'],ARRAY['release']);
 IF src->>'application' IS DISTINCT FROM 'fitsmytime'
  OR src->>'environment' IS DISTINCT FROM (SELECT environment FROM audit_contract.installation WHERE singleton)
  OR (src ? 'release' AND (jsonb_typeof(src->'release') IS DISTINCT FROM 'string' OR (src->>'release') !~ '^[a-f0-9]{7,64}$'))
 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 IF n LIKE 'data.%' THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','serviceId']);
  PERFORM audit_contract.assert_object(s,ARRAY['kind']);
  PERFORM audit_contract.assert_object(t,ARRAY['type','id']);
  IF a IS DISTINCT FROM '{"kind":"service","serviceId":"database-runtime"}'::jsonb
   OR s IS DISTINCT FROM '{"kind":"unknown"}'::jsonb OR t->>'type' IS DISTINCT FROM 'database_record'
   OR jsonb_typeof(t->'id') IS DISTINCT FROM 'string' OR (t->>'id') !~ '^[a-z][a-z_]{0,47}:[A-Za-z0-9_-]{1,100}(\|[A-Za-z0-9_-]{1,100})?$'
   OR src->>'component' IS DISTINCT FROM 'database' OR e->>'retentionClass' IS DISTINCT FROM 'B'
   OR jsonb_array_length(e->'changes') NOT BETWEEN 1 AND 64
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(e->'changes') LOOP
   PERFORM audit_contract.assert_object(c,ARRAY['field','redacted']);field_name:=c->>'field';
   IF jsonb_typeof(c->'field') IS DISTINCT FROM 'string' OR field_name !~ '^[a-z_]{1,64}$'
    OR field_name=ANY(fields) OR c->'redacted' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
   fields:=array_append(fields,field_name);
  END LOOP;
 ELSIF n LIKE 'audit.%' THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','userId','effectiveRole']);
  PERFORM audit_contract.assert_object(s,ARRAY['kind']);PERFORM audit_contract.assert_object(t,ARRAY['type']);
  IF a->>'kind' IS DISTINCT FROM 'user' OR NOT audit_contract.is_uuid(a->'userId') OR a->>'effectiveRole' IS DISTINCT FROM 'support'
   OR s IS DISTINCT FROM '{"kind":"global"}'::jsonb OR t IS DISTINCT FROM '{"type":"request"}'::jsonb
   OR src->>'component' IS DISTINCT FROM 'audit' OR e->>'retentionClass' IS DISTINCT FROM 'R'
   OR e->'changes' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n='activity.records_read.v1' THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','userId','effectiveRole']);PERFORM audit_contract.assert_object(t,ARRAY['type']);
  IF a->>'kind' IS DISTINCT FROM 'user' OR NOT audit_contract.is_uuid(a->'userId') OR t IS DISTINCT FROM '{"type":"request"}'::jsonb
   OR src->>'component' IS DISTINCT FROM 'application' OR e->>'retentionClass' IS DISTINCT FROM 'R' OR jsonb_array_length(e->'changes')<>1 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  c:=e->'changes'->0;PERFORM audit_contract.assert_object(c,ARRAY['field','before','after']);v:=c->>'after';
  IF c->>'field' IS DISTINCT FROM 'action' OR c->'before' IS DISTINCT FROM 'null'::jsonb OR jsonb_typeof(c->'after') IS DISTINCT FROM 'string'
   OR (v IN ('account.profile','admin.users','addresses.list','employees.list','services.provider','bookings.seeker','bookings.provider','schedules.provider','company.context','company.team','company.invitations','appointments.conversation','appointments.reschedules','appointments.available_times','notifications.settings','notifications.booking','wishlist.list','inbox.summary','inbox.messages','inbox.notifications')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF v='admin.users' THEN
   PERFORM audit_contract.assert_object(s,ARRAY['kind']);
   IF s IS DISTINCT FROM '{"kind":"global"}'::jsonb OR a->>'effectiveRole' IS DISTINCT FROM 'support' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSIF s->>'kind'='personal' THEN
   PERFORM audit_contract.assert_object(s,ARRAY['kind','workspaceId']);
   IF s->>'workspaceId' IS DISTINCT FROM a->>'userId' OR (a->>'effectiveRole' IN ('seeker','provider')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSIF s->>'kind'='company' THEN
   PERFORM audit_contract.assert_object(s,ARRAY['kind','workspaceId']);
   IF NOT audit_contract.is_company_id(s->'workspaceId') OR (s->>'workspaceId')::numeric>2147483647 OR (a->>'effectiveRole' IN ('owner','admin','provider','viewer')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSE RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n LIKE 'integration.operation_%' THEN
  PERFORM audit_contract.assert_object(a,ARRAY['kind','serviceId']);PERFORM audit_contract.assert_object(s,ARRAY['kind']);PERFORM audit_contract.assert_object(t,ARRAY['type']);
  IF a IS DISTINCT FROM '{"kind":"service","serviceId":"integration-runtime"}'::jsonb OR s IS DISTINCT FROM '{"kind":"unknown"}'::jsonb OR t IS DISTINCT FROM '{"type":"request"}'::jsonb
   OR src->>'component' IS DISTINCT FROM 'integration' OR e->>'retentionClass' IS DISTINCT FROM 'R' OR jsonb_array_length(e->'changes')<>1 THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  c:=e->'changes'->0;PERFORM audit_contract.assert_object(c,ARRAY['field','before','after']);
  IF c->>'field' IS DISTINCT FROM 'operation' OR c->'before' IS DISTINCT FROM 'null'::jsonb OR jsonb_typeof(c->'after') IS DISTINCT FROM 'string' OR (c->>'after' IN ('geocoding','embedding','notification_batch','activity_batch')) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF n='integration.operation_requested.v1' THEN
   IF e->>'outcome' IS DISTINCT FROM 'succeeded' OR e ? 'reasonCode' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSIF NOT (e->>'outcome'='succeeded' AND NOT(e ? 'reasonCode') OR e->>'outcome'='failed' AND e->>'reasonCode'='PROVIDER_UNAVAILABLE' OR e->>'outcome'='unknown' AND e->>'reasonCode'='PROVIDER_TIMEOUT') IS TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSIF n LIKE 'auth.operation_%' THEN
  PERFORM audit_contract.assert_object(t,ARRAY['type']);
  IF t IS DISTINCT FROM '{"type":"request"}'::jsonb OR src->>'component' IS DISTINCT FROM 'auth' OR e->>'retentionClass' IS DISTINCT FROM 'S' OR jsonb_array_length(e->'changes')<>1
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF a->>'kind'='anonymous' THEN
   PERFORM audit_contract.assert_object(a,ARRAY['kind']);PERFORM audit_contract.assert_object(s,ARRAY['kind']);
   IF s IS DISTINCT FROM '{"kind":"unknown"}'::jsonb THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSE
   PERFORM audit_contract.assert_object(a,ARRAY['kind','userId','effectiveRole']);PERFORM audit_contract.assert_object(s,ARRAY['kind','workspaceId']);
   IF a->>'kind' IS DISTINCT FROM 'user' OR NOT audit_contract.is_uuid(a->'userId') OR (a->>'effectiveRole' IN ('seeker','provider')) IS NOT TRUE
    OR s->>'kind' IS DISTINCT FROM 'personal' OR s->>'workspaceId' IS DISTINCT FROM a->>'userId' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  END IF;
  c:=e->'changes'->0;PERFORM audit_contract.assert_object(c,ARRAY['field','before','after']);
  IF c->>'field' IS DISTINCT FROM 'operation' OR c->'before' IS DISTINCT FROM 'null'::jsonb OR jsonb_typeof(c->'after') IS DISTINCT FROM 'string'
   OR (c->>'after' IN ('login','signup','oauth_start','oauth_callback','recovery','invite_session','invite_password','logout','password_verify','password_change','session_refresh','profile_update')) IS NOT TRUE
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF n='auth.operation_requested.v1' THEN
   IF e->>'outcome' IS DISTINCT FROM 'succeeded' OR e ? 'reasonCode' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSIF NOT (e->>'outcome'='succeeded' AND NOT(e ? 'reasonCode') OR e->>'outcome'='rejected' AND e->>'reasonCode'='INVALID_INPUT'
   OR e->>'outcome'='denied' AND e->>'reasonCode' IN ('INVALID_CREDENTIALS','RATE_LIMITED') OR e->>'outcome'='failed' AND e->>'reasonCode'='PROVIDER_UNAVAILABLE'
   OR e->>'outcome'='unknown' AND e->>'reasonCode'='PROVIDER_TIMEOUT') IS TRUE THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 ELSE
  PERFORM audit_contract.assert_object(t,ARRAY['type']);
  IF t IS DISTINCT FROM '{"type":"request"}'::jsonb OR src->>'component' IS DISTINCT FROM 'location'
   OR e->>'retentionClass' IS DISTINCT FROM 'R' OR jsonb_array_length(e->'changes')<>5
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  IF a->>'kind'='anonymous' THEN
   PERFORM audit_contract.assert_object(a,ARRAY['kind']);PERFORM audit_contract.assert_object(s,ARRAY['kind']);
   IF s IS DISTINCT FROM '{"kind":"unknown"}'::jsonb THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  ELSE
   PERFORM audit_contract.assert_object(a,ARRAY['kind','userId','effectiveRole']);PERFORM audit_contract.assert_object(s,ARRAY['kind','workspaceId']);
   IF a->>'kind' IS DISTINCT FROM 'user' OR NOT audit_contract.is_uuid(a->'userId')
    OR (a->>'effectiveRole' IN ('seeker','provider')) IS NOT TRUE OR s->>'kind' IS DISTINCT FROM 'personal'
    OR s->>'workspaceId' IS DISTINCT FROM a->>'userId' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(e->'changes') LOOP
   PERFORM audit_contract.assert_object(c,ARRAY['field','before','after']);field_name:=c->>'field';v:=c->>'after';
   IF field_name=ANY(fields) OR c->'before' IS DISTINCT FROM 'null'::jsonb OR jsonb_typeof(c->'after') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
   fields:=array_append(fields,field_name);
   CASE field_name
    WHEN 'stage' THEN stage:=v;
    WHEN 'reportedOutcome' THEN reported:=v;
    WHEN 'storageScope' THEN storage:=v;
    WHEN 'noticeVersion' THEN IF v<>'location-2026-11-07' THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
    WHEN 'language' THEN IF v NOT IN ('en','lv','ru','ar','zh','fr','de','hi','ja','pt','es') THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
    ELSE RAISE EXCEPTION 'Invalid audit event contract';
   END CASE;
  END LOOP;
  IF (fields @> ARRAY['stage','reportedOutcome','storageScope','noticeVersion','language']) IS NOT TRUE
   OR (storage IN ('none','profile','cookie')) IS NOT TRUE
   OR NOT (stage='requested' AND reported='requested' AND storage='none'
    OR stage='permission_observed' AND reported IN ('granted','already_granted','denied','timeout','unavailable','policy_blocked','unknown') AND storage='none'
    OR stage='remember_chosen' AND reported='remember' AND storage IN ('profile','cookie')
    OR stage='withdrawn' AND reported='forget')
  THEN RAISE EXCEPTION 'Invalid audit event contract'; END IF;
 END IF;
 RETURN e;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid audit event contract';
END $completion$;
REVOKE ALL ON FUNCTION audit_contract.parse_event(text,text,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION audit_contract.parse_event(text,text,text) TO fm_audit_destination_owner;
INSERT INTO audit_contract.migrations(version) VALUES('completion-v1-0008');
RESET ROLE;
SET LOCAL ROLE fm_audit_destination_owner;
ALTER TABLE audit.events DROP CONSTRAINT service_view_retention_v1;
ALTER TABLE audit.events ADD CONSTRAINT audit_policy_retention_v2 CHECK ((
 (envelope->>'retentionClass'='R' AND expires_at=occurred_at+interval '7776000 seconds')
 OR (envelope->>'retentionClass' IN ('B','S') AND expires_at=occurred_at+interval '31536000 seconds')) IS TRUE);

INSERT INTO audit.schema_migrations(version) VALUES('destination-completion-v1-0008');
RESET ROLE;
CREATE ROLE fmt_audit_reader_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT fm_audit_reader TO fmt_audit_reader_dev WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
DO $reader$ BEGIN IF has_database_privilege('fmt_audit_reader_dev',current_database(),'CREATE') OR EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege('fmt_audit_reader_dev',n.oid,'CREATE')) OR has_table_privilege('fmt_audit_reader_dev','audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR NOT has_table_privilege('fmt_audit_reader_dev','audit.reader_events','SELECT') THEN RAISE EXCEPTION 'Reader capability mismatch'; END IF; END $reader$;
DO $restore$ DECLARE original jsonb:=current_setting('audit_completion.fm_audit_destination_owner')::jsonb; prior jsonb; observed jsonb; BEGIN
 SELECT value INTO prior FROM jsonb_array_elements(original) WHERE (value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN EXECUTE format('REVOKE fm_audit_destination_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE EXECUTE format('GRANT fm_audit_destination_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb) INTO observed FROM pg_auth_members m WHERE m.roleid='fm_audit_destination_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_destination_owner','USAGE') OR pg_has_role(current_user,'fm_audit_destination_owner','SET') THEN RAISE EXCEPTION 'Exact completion setup membership restoration failed'; END IF;
END $restore$;
DO $restore$ DECLARE original jsonb:=current_setting('audit_completion.fm_audit_contract_owner')::jsonb; prior jsonb; observed jsonb; BEGIN
 SELECT value INTO prior FROM jsonb_array_elements(original) WHERE (value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN EXECUTE format('REVOKE fm_audit_contract_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE EXECUTE format('GRANT fm_audit_contract_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb) INTO observed FROM pg_auth_members m WHERE m.roleid='fm_audit_contract_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_contract_owner','USAGE') OR pg_has_role(current_user,'fm_audit_contract_owner','SET') THEN RAISE EXCEPTION 'Exact completion setup membership restoration failed'; END IF;
END $restore$;
SELECT true AS completion_version_recorded;
COMMIT;
