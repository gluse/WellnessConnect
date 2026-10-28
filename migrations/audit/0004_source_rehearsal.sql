-- NEW, NOT APPLIED. TASK-014 fixed twelve-ID rehearsal, source development only.
-- Local preparation is not execution evidence. No credentials, login enablement or fixture enqueue.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
DO $$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
    OR current_setting('server_version_num')::integer/10000<>17
    OR pg_has_role(current_user,'fm_audit_source_owner','USAGE')
    OR pg_has_role(current_user,'fm_audit_source_owner','SET')
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('fm_audit_rehearsal_owner','fmt_audit_test_dev'))
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='audit_rehearsal') THEN
   RAISE EXCEPTION 'Rehearsal target/principal/collision precondition failed'; END IF;
 IF to_regclass('public.users') IS NULL OR to_regclass('public.bookings') IS NULL THEN
   RAISE EXCEPTION 'Rehearsal database separation precondition failed'; END IF;
END $$;
CREATE ROLE fm_audit_rehearsal_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fmt_audit_test_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
DO $$ BEGIN
  PERFORM set_config('audit_rehearsal_setup.new_owner_memberships',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,
      'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
      ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m
      WHERE m.roleid='fm_audit_rehearsal_owner'::regrole AND m.member=current_user::regrole),true);
  EXECUTE format('GRANT fm_audit_rehearsal_owner TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',
    current_user,CASE WHEN coalesce((SELECT m.admin_option FROM pg_auth_members m
      WHERE m.roleid='fm_audit_rehearsal_owner'::regrole AND m.member=current_user::regrole
      AND m.grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $$;
CREATE SCHEMA audit_rehearsal AUTHORIZATION fm_audit_rehearsal_owner;
REVOKE ALL ON SCHEMA audit_rehearsal FROM PUBLIC;
SET LOCAL ROLE fm_audit_rehearsal_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE audit_rehearsal.run (
 run_id uuid PRIMARY KEY CHECK(run_id='a0140000-0000-4000-8000-000000000001'),
 synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,passed boolean,
 retain_until timestamptz NOT NULL DEFAULT clock_timestamp()+interval '31536000 seconds',
 CHECK((completed_at IS NULL)=(passed IS NULL)),
 CHECK(completed_at IS NULL OR retain_until>=completed_at+interval '31536000 seconds'));
CREATE TABLE audit_rehearsal.cohort (
 event_id uuid PRIMARY KEY CHECK(event_id=ANY(ARRAY['a0140001-0000-4000-8000-000000000001'::uuid,'a0140001-0000-4000-8000-000000000002'::uuid,'a0140001-0000-4000-8000-000000000003'::uuid,'a0140001-0000-4000-8000-000000000004'::uuid,'a0140001-0000-4000-8000-000000000005'::uuid,'a0140001-0000-4000-8000-000000000006'::uuid,'a0140001-0000-4000-8000-000000000007'::uuid,'a0140001-0000-4000-8000-000000000008'::uuid,'a0140001-0000-4000-8000-000000000009'::uuid,'a0140001-0000-4000-8000-00000000000a'::uuid,'a0140001-0000-4000-8000-00000000000b'::uuid,'a0140001-0000-4000-8000-00000000000c'::uuid])),
 run_id uuid NOT NULL REFERENCES audit_rehearsal.run(run_id),
 synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),
 scenario text NOT NULL CHECK(scenario IN ('rollback-visibility','abort-on-enqueue-error','concurrent-a','concurrent-b','claim-crash','commit-before-ack','conflict','transport-outage','reserved-9','reserved-10','reserved-11','reserved-12')),
 completed_at timestamptz,passed boolean,
 CHECK((completed_at IS NULL)=(passed IS NULL)));
ALTER TABLE audit_rehearsal.run ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_rehearsal.cohort ENABLE ROW LEVEL SECURITY;
INSERT INTO audit_rehearsal.run(run_id) VALUES('a0140000-0000-4000-8000-000000000001');
INSERT INTO audit_rehearsal.cohort(event_id,run_id,scenario) VALUES
 ('a0140001-0000-4000-8000-000000000001','a0140000-0000-4000-8000-000000000001','rollback-visibility'),
 ('a0140001-0000-4000-8000-000000000002','a0140000-0000-4000-8000-000000000001','abort-on-enqueue-error'),
 ('a0140001-0000-4000-8000-000000000003','a0140000-0000-4000-8000-000000000001','concurrent-a'),
 ('a0140001-0000-4000-8000-000000000004','a0140000-0000-4000-8000-000000000001','concurrent-b'),
 ('a0140001-0000-4000-8000-000000000005','a0140000-0000-4000-8000-000000000001','claim-crash'),
 ('a0140001-0000-4000-8000-000000000006','a0140000-0000-4000-8000-000000000001','commit-before-ack'),
 ('a0140001-0000-4000-8000-000000000007','a0140000-0000-4000-8000-000000000001','conflict'),
 ('a0140001-0000-4000-8000-000000000008','a0140000-0000-4000-8000-000000000001','transport-outage'),
 ('a0140001-0000-4000-8000-000000000009','a0140000-0000-4000-8000-000000000001','reserved-9'),
 ('a0140001-0000-4000-8000-00000000000a','a0140000-0000-4000-8000-000000000001','reserved-10'),
 ('a0140001-0000-4000-8000-00000000000b','a0140000-0000-4000-8000-000000000001','reserved-11'),
 ('a0140001-0000-4000-8000-00000000000c','a0140000-0000-4000-8000-000000000001','reserved-12');
CREATE FUNCTION audit_rehearsal.record(id uuid,ok boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF id IS NULL OR ok IS NULL THEN RAISE EXCEPTION 'Invalid rehearsal result'; END IF;
 -- Serialize record/finish so no completion can race a case write.
 PERFORM 1 FROM audit_rehearsal.run r WHERE r.run_id='a0140000-0000-4000-8000-000000000001' AND r.completed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rehearsal run already completed'; END IF;
 UPDATE audit_rehearsal.cohort SET completed_at=clock_timestamp(),passed=ok
   WHERE event_id=id AND completed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or completed rehearsal case'; END IF;
END $$;
CREATE FUNCTION audit_rehearsal.status() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('runId',r.run_id,'startedAt',r.started_at,'completedAt',r.completed_at,
  'passed',r.passed,'retainUntil',r.retain_until,'synthetic',r.synthetic,
  'cohort',(SELECT jsonb_agg(jsonb_build_object('eventId',c.event_id,'scenario',c.scenario,
   'completedAt',c.completed_at,'passed',c.passed) ORDER BY c.event_id) FROM audit_rehearsal.cohort c))
 FROM audit_rehearsal.run r WHERE r.run_id='a0140000-0000-4000-8000-000000000001'
$$;
CREATE FUNCTION audit_rehearsal.finish(ok boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE n timestamptz:=clock_timestamp(); BEGIN
 IF ok IS NULL THEN RAISE EXCEPTION 'Invalid rehearsal completion'; END IF;
 PERFORM 1 FROM audit_rehearsal.run r WHERE r.run_id='a0140000-0000-4000-8000-000000000001' AND r.completed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rehearsal run already completed'; END IF;
 IF ok AND ((SELECT count(*) FROM audit_rehearsal.cohort)<>12 OR EXISTS
   (SELECT 1 FROM audit_rehearsal.cohort c WHERE c.completed_at IS NULL OR c.passed IS DISTINCT FROM true)) THEN
   RAISE EXCEPTION 'Cannot pass unfinished or failed rehearsal'; END IF;
 UPDATE audit_rehearsal.run SET completed_at=n,passed=ok,retain_until=n+interval '31536000 seconds'
   WHERE run_id='a0140000-0000-4000-8000-000000000001';
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA audit_rehearsal FROM PUBLIC,fmt_audit_test_dev;
REVOKE ALL ON FUNCTION audit_rehearsal.record(uuid,boolean),audit_rehearsal.status(),audit_rehearsal.finish(boolean) FROM PUBLIC;
GRANT USAGE ON SCHEMA audit_rehearsal TO fmt_audit_test_dev,fm_audit_source_owner;
GRANT EXECUTE ON FUNCTION audit_rehearsal.record(uuid,boolean),audit_rehearsal.status(),audit_rehearsal.finish(boolean) TO fmt_audit_test_dev;
-- Only fixed ID/run metadata crosses owners; no ownership or write grant.
GRANT SELECT(event_id,run_id) ON audit_rehearsal.cohort TO fm_audit_source_owner;
CREATE POLICY rehearsal_inspector ON audit_rehearsal.cohort FOR SELECT TO fm_audit_source_owner USING(true);
GRANT CREATE ON SCHEMA audit_rehearsal TO fm_audit_source_owner;
RESET ROLE;
DO $$ BEGIN
  PERFORM set_config('audit_rehearsal_setup.old_owner_memberships',
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
 IF NOT EXISTS(SELECT 1 FROM audit_capture.schema_migrations WHERE version='source-runtime-0003') THEN
   RAISE EXCEPTION 'Required installed runtime version missing'; END IF;
END $$;
CREATE FUNCTION audit_rehearsal.inspect(id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE answer jsonb; BEGIN
 IF id IS NULL OR NOT id=ANY(ARRAY['a0140001-0000-4000-8000-000000000001'::uuid,'a0140001-0000-4000-8000-000000000002'::uuid,'a0140001-0000-4000-8000-000000000003'::uuid,'a0140001-0000-4000-8000-000000000004'::uuid,'a0140001-0000-4000-8000-000000000005'::uuid,'a0140001-0000-4000-8000-000000000006'::uuid,'a0140001-0000-4000-8000-000000000007'::uuid,'a0140001-0000-4000-8000-000000000008'::uuid,'a0140001-0000-4000-8000-000000000009'::uuid,'a0140001-0000-4000-8000-00000000000a'::uuid,'a0140001-0000-4000-8000-00000000000b'::uuid,'a0140001-0000-4000-8000-00000000000c'::uuid])
   OR NOT EXISTS(SELECT 1 FROM audit_rehearsal.cohort c WHERE c.event_id=id AND c.run_id='a0140000-0000-4000-8000-000000000001') THEN
   RAISE EXCEPTION 'Not a rehearsal ID'; END IF;
 SELECT jsonb_build_object('eventId',q.event_id,'hash',q.payload_hash,'status',q.status,
   'attempts',q.attempts,'leaseToken',q.lease_token,'leaseUntil',q.lease_until,
   'nextAttemptAt',q.next_attempt_at,'expiresAt',q.expires_at,'deliveredAt',q.delivered_at,
   'lastErrorCode',q.last_error_code) INTO answer FROM audit_capture.audit_outbox q WHERE q.event_id=id;
 RETURN answer;
END $$;
-- Literal twelve-ID boundary is independent of status and cohort row presence.
CREATE FUNCTION audit_rehearsal.all_absent() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT NOT EXISTS(SELECT 1 FROM audit_capture.audit_outbox q WHERE q.event_id=ANY(ARRAY['a0140001-0000-4000-8000-000000000001'::uuid,'a0140001-0000-4000-8000-000000000002'::uuid,'a0140001-0000-4000-8000-000000000003'::uuid,'a0140001-0000-4000-8000-000000000004'::uuid,'a0140001-0000-4000-8000-000000000005'::uuid,'a0140001-0000-4000-8000-000000000006'::uuid,'a0140001-0000-4000-8000-000000000007'::uuid,'a0140001-0000-4000-8000-000000000008'::uuid,'a0140001-0000-4000-8000-000000000009'::uuid,'a0140001-0000-4000-8000-00000000000a'::uuid,'a0140001-0000-4000-8000-00000000000b'::uuid,'a0140001-0000-4000-8000-00000000000c'::uuid]))
$$;
CREATE FUNCTION audit_rehearsal.queue_safe(require_empty boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF require_empty IS NULL THEN RAISE EXCEPTION 'Invalid rehearsal queue gate'; END IF;
 RETURN (SELECT NOT EXISTS(SELECT 1 FROM audit_capture.audit_outbox q WHERE
   q.status IN ('pending','leased','quarantined') AND
   (require_empty OR NOT coalesce((q.event_id=ANY(ARRAY['a0140001-0000-4000-8000-000000000001'::uuid,'a0140001-0000-4000-8000-000000000002'::uuid,'a0140001-0000-4000-8000-000000000003'::uuid,'a0140001-0000-4000-8000-000000000004'::uuid,'a0140001-0000-4000-8000-000000000005'::uuid,'a0140001-0000-4000-8000-000000000006'::uuid,'a0140001-0000-4000-8000-000000000007'::uuid,'a0140001-0000-4000-8000-000000000008'::uuid,'a0140001-0000-4000-8000-000000000009'::uuid,'a0140001-0000-4000-8000-00000000000a'::uuid,'a0140001-0000-4000-8000-00000000000b'::uuid,'a0140001-0000-4000-8000-00000000000c'::uuid])
     AND q.envelope->>'operationId'='a0140000-0000-4000-8000-000000000001'
     AND q.envelope->>'eventName'='security.action_denied.v1'
     AND q.envelope#>>'{actor,kind}'='anonymous'
     AND q.envelope#>>'{source,environment}'='development'),false))));
END $$;
REVOKE ALL ON FUNCTION audit_rehearsal.inspect(uuid),audit_rehearsal.all_absent(),audit_rehearsal.queue_safe(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit_rehearsal.inspect(uuid),audit_rehearsal.all_absent(),audit_rehearsal.queue_safe(boolean) TO fmt_audit_test_dev;
INSERT INTO audit_capture.schema_migrations(version) VALUES('source-rehearsal-0004');
SELECT EXISTS(SELECT 1 FROM audit_capture.schema_migrations WHERE version='source-rehearsal-0004') AS rehearsal_version_recorded;
RESET ROLE;
SET LOCAL ROLE fm_audit_rehearsal_owner;
REVOKE CREATE ON SCHEMA audit_rehearsal FROM fm_audit_source_owner;
RESET ROLE;
DO $$ DECLARE original jsonb:=current_setting('audit_rehearsal_setup.old_owner_memberships')::jsonb;
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
   RAISE EXCEPTION 'Rehearsal setup membership restoration failed'; END IF;
END $$;
DO $$ DECLARE original jsonb:=current_setting('audit_rehearsal_setup.new_owner_memberships')::jsonb;
 prior jsonb; observed jsonb; BEGIN
 SELECT item.value INTO prior FROM jsonb_array_elements(original) AS item(value)
   WHERE (item.value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN
   EXECUTE format('REVOKE fm_audit_rehearsal_owner FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE
   EXECUTE format('GRANT fm_audit_rehearsal_owner TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
     current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,
   'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
   ORDER BY m.grantor),'[]'::jsonb) INTO observed FROM pg_auth_members m
   WHERE m.roleid='fm_audit_rehearsal_owner'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'fm_audit_rehearsal_owner','USAGE')
    OR pg_has_role(current_user,'fm_audit_rehearsal_owner','SET') THEN
   RAISE EXCEPTION 'Rehearsal setup membership restoration failed'; END IF;
END $$;
COMMIT;
