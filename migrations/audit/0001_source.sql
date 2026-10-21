-- PREPARED, NOT APPLIED. Target application dev/test: hbkooiknruimukkhshrk.
-- psql --no-psqlrc --set=ON_ERROR_STOP=1 --set=audit_environment=<explicit-label> --file <this-file>
-- Includes its own transaction; do not use --single-transaction. No login binding.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL timezone = 'UTC';
SET LOCAL search_path = pg_catalog, pg_temp;
SELECT set_config('audit_migration.environment', :'audit_environment', true) AS audit_environment \gset
SELECT set_config('audit_migration.project_ref', 'hbkooiknruimukkhshrk', true) AS audit_project_ref \gset
DO $$ BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.bookings') IS NULL THEN
    RAISE EXCEPTION 'Expected application schema missing; verify target';
  END IF;
END $$;
\ir _contract_v1.sql

CREATE ROLE fm_audit_source_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_capture NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_delivery NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_source_maintenance NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_source_monitor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
DO $$ BEGIN EXECUTE format('GRANT fm_audit_source_owner TO %I', current_user); END $$;
CREATE SCHEMA audit_capture AUTHORIZATION fm_audit_source_owner;
REVOKE ALL ON SCHEMA audit_capture FROM PUBLIC;
-- Grant only the validated entry point, never internal contract helpers/tables.
SET LOCAL ROLE fm_audit_contract_owner;
GRANT USAGE ON SCHEMA audit_contract TO fm_audit_source_owner;
GRANT EXECUTE ON FUNCTION audit_contract.parse_event(text,text,text) TO fm_audit_source_owner;
RESET ROLE;
DO $$ BEGIN EXECUTE format('REVOKE fm_audit_contract_owner FROM %I', current_user); END $$;
SET LOCAL ROLE fm_audit_source_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE audit_capture.schema_migrations(version text PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO audit_capture.schema_migrations VALUES ('source-0001', clock_timestamp());
CREATE TABLE audit_capture.audit_outbox (
  event_id uuid PRIMARY KEY,
  canonical_json text NOT NULL CHECK (octet_length(convert_to(canonical_json,'UTF8')) BETWEEN 2 AND 32768),
  envelope jsonb NOT NULL CHECK (canonical_json::jsonb = envelope),
  payload_hash text NOT NULL CHECK (payload_hash = encode(sha256(convert_to(canonical_json,'UTF8')),'hex')),
  hash_version text NOT NULL CHECK (hash_version = 'sha256-sorted-json-v1'),
  occurred_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at = occurred_at + interval '31536000 seconds'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','delivered','quarantined')),
  attempts bigint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  last_error_code text CHECK (last_error_code IN ('DESTINATION_UNAVAILABLE','DESTINATION_TIMEOUT','DESTINATION_BUSY',
    'INVALID_CONTRACT','HASH_CONFLICT','EXPIRED_AT_DESTINATION','UNSUPPORTED_VERSION','AUTHORIZATION_CONFIGURATION')),
  CHECK ((event_id = (envelope->>'eventId')::uuid) IS TRUE),
  CHECK ((occurred_at = (envelope->>'occurredAt')::timestamptz) IS TRUE),
  CHECK ((envelope->>'retentionClass' IN ('B','S')) IS TRUE),
  CHECK ((status = 'leased') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK ((status = 'delivered') = (delivered_at IS NOT NULL))
);
ALTER TABLE audit_capture.audit_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_outbox_pending_idx ON audit_capture.audit_outbox(next_attempt_at,created_at,event_id) WHERE status='pending';
CREATE INDEX audit_outbox_lease_idx ON audit_capture.audit_outbox(lease_until,event_id) WHERE status='leased';
CREATE INDEX audit_outbox_delivered_idx ON audit_capture.audit_outbox(delivered_at,event_id) WHERE status='delivered';
CREATE INDEX audit_outbox_expiry_idx ON audit_capture.audit_outbox(expires_at,event_id);
CREATE TABLE audit_capture.maintenance_runs (
  run_id uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('replay','purge_delivered','dispose_expired')),
  target_event_id uuid,
  executed_by name NOT NULL DEFAULT session_user,
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  affected_count integer NOT NULL CHECK (affected_count>=0),
  evidence_purged_count integer NOT NULL DEFAULT 0 CHECK (evidence_purged_count>=0),
  CHECK ((operation='replay') = (target_event_id IS NOT NULL)),
  retention_class text NOT NULL DEFAULT 'S' CHECK (retention_class='S')
);
ALTER TABLE audit_capture.maintenance_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX source_maintenance_expiry_idx ON audit_capture.maintenance_runs(completed_at);

CREATE FUNCTION audit_capture.guard_payload() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,pg_temp AS $$ BEGIN
  IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'Audit truncate forbidden'; END IF;
  IF ROW(NEW.event_id,NEW.canonical_json,NEW.envelope,NEW.payload_hash,NEW.hash_version,NEW.occurred_at,NEW.expires_at,NEW.created_at)
     IS DISTINCT FROM ROW(OLD.event_id,OLD.canonical_json,OLD.envelope,OLD.payload_hash,OLD.hash_version,OLD.occurred_at,OLD.expires_at,OLD.created_at) THEN
    RAISE EXCEPTION 'Audit payload immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outbox_payload_immutable BEFORE UPDATE ON audit_capture.audit_outbox FOR EACH ROW EXECUTE FUNCTION audit_capture.guard_payload();
CREATE TRIGGER outbox_no_truncate BEFORE TRUNCATE ON audit_capture.audit_outbox FOR EACH STATEMENT EXECUTE FUNCTION audit_capture.guard_payload();
CREATE FUNCTION audit_capture.reject_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Audit maintenance evidence immutable'; END $$;
CREATE TRIGGER source_runs_no_update BEFORE UPDATE ON audit_capture.maintenance_runs FOR EACH ROW EXECUTE FUNCTION audit_capture.reject_change();
CREATE TRIGGER source_runs_no_truncate BEFORE TRUNCATE ON audit_capture.maintenance_runs FOR EACH STATEMENT EXECUTE FUNCTION audit_capture.reject_change();

-- MUST execute using the same checked-out transaction as the business mutation.
-- This function neither opens nor commits a transaction and never writes remotely.
CREATE FUNCTION audit_capture.enqueue(canonical_json text,payload_hash text,hash_version text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE e jsonb; id uuid; old audit_capture.audit_outbox%ROWTYPE; occurred timestamptz; n timestamptz:=clock_timestamp();
BEGIN
  e:=audit_contract.parse_event(canonical_json,payload_hash,hash_version);
  id:=(e->>'eventId')::uuid; occurred:=(e->>'occurredAt')::timestamptz;
  IF occurred>n+interval '300 seconds' OR occurred+interval '31536000 seconds'<=n THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Audit event outside ingestion window';
  END IF;
  INSERT INTO audit_capture.audit_outbox(event_id,canonical_json,envelope,payload_hash,hash_version,occurred_at,expires_at)
  VALUES(id,canonical_json,e,payload_hash,hash_version,occurred,occurred+interval '31536000 seconds')
  ON CONFLICT(event_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO STRICT old FROM audit_capture.audit_outbox q WHERE q.event_id=id;
    IF old.canonical_json IS DISTINCT FROM canonical_json OR old.payload_hash IS DISTINCT FROM payload_hash OR old.hash_version IS DISTINCT FROM hash_version THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Audit event identity conflict';
    END IF;
  END IF;
  RETURN id;
END $$;

CREATE FUNCTION audit_capture.claim(batch_limit integer DEFAULT 100)
RETURNS TABLE(event_id uuid,canonical_json text,payload_hash text,hash_version text,lease_token uuid,lease_until timestamptz,attempts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF batch_limit IS NULL OR batch_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid audit batch limit'; END IF;
  RETURN QUERY WITH ready AS (
    SELECT q.event_id FROM audit_capture.audit_outbox q
    WHERE q.expires_at>clock_timestamp() AND
      ((q.status='pending' AND q.next_attempt_at<=clock_timestamp()) OR (q.status='leased' AND q.lease_until<=clock_timestamp()))
    ORDER BY q.next_attempt_at,q.created_at,q.event_id FOR UPDATE SKIP LOCKED LIMIT batch_limit
  ) UPDATE audit_capture.audit_outbox q SET status='leased',lease_token=gen_random_uuid(),
      lease_until=clock_timestamp()+interval '30 seconds',attempts=q.attempts+1
    FROM ready WHERE q.event_id=ready.event_id
    RETURNING q.event_id,q.canonical_json,q.payload_hash,q.hash_version,q.lease_token,q.lease_until,q.attempts;
END $$;
CREATE FUNCTION audit_capture.ack(id uuid,token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
  UPDATE audit_capture.audit_outbox SET status='delivered',delivered_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error_code=NULL
  WHERE event_id=id AND status='leased' AND lease_token=token AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;
CREATE FUNCTION audit_capture.retry(id uuid,token uuid,error_code text,delay_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
  IF error_code IS NULL OR error_code NOT IN ('DESTINATION_UNAVAILABLE','DESTINATION_TIMEOUT','DESTINATION_BUSY')
     OR delay_seconds IS NULL OR delay_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Invalid audit retry'; END IF;
  UPDATE audit_capture.audit_outbox SET status='pending',next_attempt_at=clock_timestamp()+make_interval(secs=>delay_seconds),
    lease_token=NULL,lease_until=NULL,last_error_code=error_code
  WHERE event_id=id AND status='leased' AND lease_token=token AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;
CREATE FUNCTION audit_capture.quarantine(id uuid,token uuid,error_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
  IF error_code IS NULL OR error_code NOT IN ('INVALID_CONTRACT','HASH_CONFLICT','EXPIRED_AT_DESTINATION','UNSUPPORTED_VERSION','AUTHORIZATION_CONFIGURATION') THEN
    RAISE EXCEPTION 'Invalid audit quarantine'; END IF;
  UPDATE audit_capture.audit_outbox SET status='quarantined',lease_token=NULL,lease_until=NULL,last_error_code=error_code
  WHERE event_id=id AND status='leased' AND lease_token=token AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;

CREATE FUNCTION audit_capture.replay(id uuid,run uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE previous audit_capture.maintenance_runs%ROWTYPE; affected integer;
BEGIN
  IF id IS NULL OR run IS NULL THEN RAISE EXCEPTION 'Invalid audit maintenance run'; END IF;
  SELECT * INTO previous FROM audit_capture.maintenance_runs WHERE run_id=run;
  IF FOUND THEN
    IF previous.operation<>'replay' OR previous.executed_by<>session_user OR previous.target_event_id IS DISTINCT FROM id THEN
      RAISE EXCEPTION 'Audit maintenance run conflict'; END IF;
    RETURN previous.affected_count;
  END IF;
  UPDATE audit_capture.audit_outbox SET status='pending',next_attempt_at=clock_timestamp(),last_error_code=NULL
    WHERE event_id=id AND status='quarantined' AND expires_at>clock_timestamp();
  GET DIAGNOSTICS affected=ROW_COUNT;
  INSERT INTO audit_capture.maintenance_runs(run_id,operation,target_event_id,affected_count) VALUES(run,'replay',id,affected);
  RETURN affected;
END $$;
CREATE FUNCTION audit_capture.purge_delivered(run uuid,batch_limit integer DEFAULT 1000) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE previous audit_capture.maintenance_runs%ROWTYPE; affected integer; evidence_purged integer;
BEGIN
  IF run IS NULL OR batch_limit IS NULL OR batch_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid audit purge'; END IF;
  SELECT * INTO previous FROM audit_capture.maintenance_runs WHERE run_id=run;
  IF FOUND THEN
    IF previous.operation<>'purge_delivered' OR previous.executed_by<>session_user THEN RAISE EXCEPTION 'Audit maintenance run conflict'; END IF;
    RETURN previous.affected_count;
  END IF;
  WITH expired AS (SELECT q.event_id FROM audit_capture.audit_outbox q WHERE q.status='delivered'
    AND (q.delivered_at<=clock_timestamp()-interval '604800 seconds' OR q.expires_at<=clock_timestamp())
    ORDER BY q.delivered_at,q.event_id FOR UPDATE SKIP LOCKED LIMIT batch_limit)
    DELETE FROM audit_capture.audit_outbox q USING expired WHERE q.event_id=expired.event_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  -- Local S evidence also expires after 365 days. This run remains as evidence.
  WITH expired AS (SELECT q.run_id FROM audit_capture.maintenance_runs q
    WHERE q.completed_at<=clock_timestamp()-interval '31536000 seconds'
    ORDER BY q.completed_at,q.run_id FOR UPDATE SKIP LOCKED LIMIT batch_limit)
    DELETE FROM audit_capture.maintenance_runs q USING expired WHERE q.run_id=expired.run_id;
  GET DIAGNOSTICS evidence_purged=ROW_COUNT;
  INSERT INTO audit_capture.maintenance_runs(run_id,operation,affected_count,evidence_purged_count)
    VALUES(run,'purge_delivered',affected,evidence_purged);
  RETURN affected;
END $$;
CREATE FUNCTION audit_capture.dispose_expired(run uuid,batch_limit integer DEFAULT 1000) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE previous audit_capture.maintenance_runs%ROWTYPE; affected integer;
BEGIN
  IF run IS NULL OR batch_limit IS NULL OR batch_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid audit disposal'; END IF;
  SELECT * INTO previous FROM audit_capture.maintenance_runs WHERE run_id=run;
  IF FOUND THEN
    IF previous.operation<>'dispose_expired' OR previous.executed_by<>session_user THEN RAISE EXCEPTION 'Audit maintenance run conflict'; END IF;
    RETURN previous.affected_count;
  END IF;
  WITH expired AS (SELECT q.event_id FROM audit_capture.audit_outbox q WHERE q.status<>'delivered'
    AND q.expires_at<=clock_timestamp() AND (q.status<>'leased' OR q.lease_until<=clock_timestamp())
    ORDER BY q.expires_at,q.event_id FOR UPDATE SKIP LOCKED LIMIT batch_limit)
    DELETE FROM audit_capture.audit_outbox q USING expired WHERE q.event_id=expired.event_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  INSERT INTO audit_capture.maintenance_runs(run_id,operation,affected_count) VALUES(run,'dispose_expired',affected);
  RETURN affected; -- Coverage loss count: independent operator alert required.
END $$;
CREATE VIEW audit_capture.delivery_health WITH (security_barrier=true) AS
  SELECT status,count(*) AS event_count,min(created_at) AS oldest_created_at,
    min(occurred_at) AS oldest_occurred_at,max(attempts) AS max_attempts,
    min(next_attempt_at) AS earliest_next_attempt_at,
    count(*) FILTER (WHERE expires_at<=clock_timestamp()) AS expired_count
  FROM audit_capture.audit_outbox GROUP BY status;
CREATE VIEW audit_capture.maintenance_history WITH (security_barrier=true) AS
  SELECT * FROM audit_capture.maintenance_runs WHERE completed_at>clock_timestamp()-interval '31536000 seconds';
REVOKE ALL ON ALL TABLES IN SCHEMA audit_capture FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA audit_capture FROM PUBLIC;
GRANT USAGE ON SCHEMA audit_capture TO fm_audit_capture,fm_audit_delivery,fm_audit_source_maintenance,fm_audit_source_monitor;
GRANT EXECUTE ON FUNCTION audit_capture.enqueue(text,text,text) TO fm_audit_capture;
GRANT EXECUTE ON FUNCTION audit_capture.claim(integer),audit_capture.ack(uuid,uuid),
  audit_capture.retry(uuid,uuid,text,integer),audit_capture.quarantine(uuid,uuid,text) TO fm_audit_delivery;
GRANT EXECUTE ON FUNCTION audit_capture.replay(uuid,uuid),audit_capture.purge_delivered(uuid,integer),
  audit_capture.dispose_expired(uuid,integer) TO fm_audit_source_maintenance;
GRANT SELECT ON audit_capture.delivery_health,audit_capture.maintenance_history TO fm_audit_source_monitor,fm_audit_source_maintenance;
RESET ROLE;
DO $$ BEGIN EXECUTE format('REVOKE fm_audit_source_owner FROM %I', current_user); END $$;
COMMIT;
