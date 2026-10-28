-- NEW, NOT APPLIED. Fixed synthetic evidence only; no grants on audit base tables.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
 IF pg_has_role(current_user,'fm_audit_destination_owner','USAGE') OR pg_has_role(current_user,'fm_audit_destination_owner','SET') THEN
   RAISE EXCEPTION 'Existing effective setup owner access requires review'; END IF;
END $$;
DO $$ BEGIN EXECUTE format('GRANT fm_audit_destination_owner TO %I',current_user); END $$;
CREATE ROLE fmt_audit_test_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
CREATE SCHEMA audit_rehearsal AUTHORIZATION fm_audit_destination_owner;
REVOKE ALL ON SCHEMA audit_rehearsal FROM PUBLIC;
SET LOCAL ROLE fm_audit_destination_owner;
CREATE TABLE audit_rehearsal.run (
  run_id uuid PRIMARY KEY CHECK(run_id='a0140000-0000-4000-8000-000000000001'),
  synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,passed boolean,
  retain_until timestamptz NOT NULL DEFAULT clock_timestamp()+interval '31536000 seconds',
  CHECK((completed_at IS NULL)=(passed IS NULL)));
CREATE TABLE audit_rehearsal.cohort(event_id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES audit_rehearsal.run(run_id),synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),
  scenario text NOT NULL,completed_at timestamptz,passed boolean,
  CHECK((completed_at IS NULL)=(passed IS NULL)));
ALTER TABLE audit_rehearsal.run ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_rehearsal.cohort ENABLE ROW LEVEL SECURITY;
INSERT INTO audit_rehearsal.run(run_id) VALUES('a0140000-0000-4000-8000-000000000001');
INSERT INTO audit_rehearsal.cohort(event_id,run_id,scenario)
SELECT ('a0140001-0000-4000-8000-'||lpad(to_hex(n),12,'0'))::uuid,
 'a0140000-0000-4000-8000-000000000001'::uuid,
 (ARRAY['rollback-visibility','abort-on-enqueue-error','concurrent-a','concurrent-b',
 'claim-crash','commit-before-ack','conflict','transport-outage','reserved-9','reserved-10','reserved-11','reserved-12'])[n]
 FROM generate_series(1,12)n;
CREATE FUNCTION audit_rehearsal.record(id uuid,ok boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 UPDATE audit_rehearsal.cohort SET completed_at=clock_timestamp(),passed=ok
   WHERE event_id=id AND completed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or completed rehearsal case'; END IF;
END $$;
CREATE FUNCTION audit_rehearsal.status() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('runId',run_id,'completedAt',completed_at,'passed',passed)
 FROM audit_rehearsal.run
$$;
CREATE FUNCTION audit_rehearsal.inspect(id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE answer jsonb; BEGIN
  IF NOT EXISTS(SELECT 1 FROM audit_rehearsal.cohort WHERE event_id=id) THEN RAISE EXCEPTION 'Not a rehearsal ID'; END IF;
  SELECT jsonb_build_object('hash',q.payload_hash,'receivedAt',q.received_at,'expiresAt',q.expires_at,
    'incidents',(SELECT count(*) FROM audit.integrity_incidents i WHERE i.event_id=id))
    INTO answer FROM audit.events q WHERE q.event_id=id;
  RETURN answer;
END $$;
CREATE FUNCTION audit_rehearsal.finish(ok boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 UPDATE audit_rehearsal.run SET completed_at=clock_timestamp(),passed=ok,
   retain_until=clock_timestamp()+interval '31536000 seconds' WHERE completed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rehearsal already completed'; END IF;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit_rehearsal FROM PUBLIC;
GRANT USAGE ON SCHEMA audit_rehearsal TO fmt_audit_test_dev;
GRANT EXECUTE ON FUNCTION audit_rehearsal.inspect(uuid),audit_rehearsal.finish(boolean),
 audit_rehearsal.record(uuid,boolean),audit_rehearsal.status() TO fmt_audit_test_dev;
RESET ROLE;
DO $$ BEGIN EXECUTE format('REVOKE fm_audit_destination_owner FROM %I',current_user); END $$;
COMMIT;
