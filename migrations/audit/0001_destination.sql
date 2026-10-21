-- PREPARED, NOT APPLIED. Independent audit dev/test: ynygqodmtgjrngiudalw.
-- psql --no-psqlrc --set=ON_ERROR_STOP=1 --set=audit_environment=<source-deploy-label> --file <this-file>
-- Includes its own transaction; do not use --single-transaction. No login binding.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL timezone = 'UTC';
SET LOCAL search_path = pg_catalog, pg_temp;
SELECT set_config('audit_migration.environment', :'audit_environment', true) AS audit_environment \gset
SELECT set_config('audit_migration.project_ref', 'ynygqodmtgjrngiudalw', true) AS audit_project_ref \gset
DO $$ BEGIN
  IF to_regclass('public.users') IS NOT NULL OR to_regclass('public.bookings') IS NOT NULL THEN
    RAISE EXCEPTION 'Application objects found on audit target; verify separation';
  END IF;
END $$;
\ir _contract_v1.sql

CREATE ROLE fm_audit_destination_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_export NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE fm_audit_destination_maintenance NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
DO $$ BEGIN EXECUTE format('GRANT fm_audit_destination_owner TO %I', current_user); END $$;
CREATE SCHEMA audit AUTHORIZATION fm_audit_destination_owner;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
SET LOCAL ROLE fm_audit_contract_owner;
GRANT USAGE ON SCHEMA audit_contract TO fm_audit_destination_owner;
GRANT EXECUTE ON FUNCTION audit_contract.parse_event(text,text,text) TO fm_audit_destination_owner;
RESET ROLE;
DO $$ BEGIN EXECUTE format('REVOKE fm_audit_contract_owner FROM %I', current_user); END $$;
SET LOCAL ROLE fm_audit_destination_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE audit.schema_migrations(version text PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO audit.schema_migrations VALUES ('destination-0001',clock_timestamp());
CREATE TABLE audit.events (
  event_id uuid PRIMARY KEY,
  canonical_json text NOT NULL CHECK (octet_length(convert_to(canonical_json,'UTF8')) BETWEEN 2 AND 32768),
  envelope jsonb NOT NULL CHECK (canonical_json::jsonb = envelope),
  payload_hash text NOT NULL CHECK (payload_hash = encode(sha256(convert_to(canonical_json,'UTF8')),'hex')),
  hash_version text NOT NULL CHECK (hash_version='sha256-sorted-json-v1'),
  occurred_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at=occurred_at+interval '31536000 seconds'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  event_name text GENERATED ALWAYS AS (envelope->>'eventName') STORED,
  outcome text GENERATED ALWAYS AS (envelope->>'outcome') STORED,
  retention_class text GENERATED ALWAYS AS (envelope->>'retentionClass') STORED,
  actor_kind text GENERATED ALWAYS AS (envelope#>>'{actor,kind}') STORED,
  actor_id text GENERATED ALWAYS AS (envelope#>>'{actor,userId}') STORED,
  scope_kind text GENERATED ALWAYS AS (envelope#>>'{scope,kind}') STORED,
  workspace_id text GENERATED ALWAYS AS (envelope#>>'{scope,workspaceId}') STORED,
  target_type text GENERATED ALWAYS AS (envelope#>>'{target,type}') STORED,
  target_id text GENERATED ALWAYS AS (envelope#>>'{target,id}') STORED,
  request_id text GENERATED ALWAYS AS (envelope->>'requestId') STORED,
  operation_id text GENERATED ALWAYS AS (envelope->>'operationId') STORED,
  CHECK ((event_id = (envelope->>'eventId')::uuid) IS TRUE),
  CHECK ((occurred_at = (envelope->>'occurredAt')::timestamptz) IS TRUE),
  CHECK ((envelope->>'retentionClass' IN ('B','S')) IS TRUE)
);
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_events_time_idx ON audit.events(occurred_at DESC,event_id DESC);
CREATE INDEX audit_events_workspace_idx ON audit.events(scope_kind,workspace_id,occurred_at DESC,event_id DESC);
CREATE INDEX audit_events_target_idx ON audit.events(target_type,target_id,occurred_at DESC,event_id DESC);
CREATE INDEX audit_events_operation_idx ON audit.events(operation_id);
CREATE INDEX audit_events_request_idx ON audit.events(request_id);
CREATE INDEX audit_events_expiry_idx ON audit.events(expires_at,event_id);
CREATE TABLE audit.integrity_incidents (
  event_id uuid NOT NULL,
  candidate_hash text NOT NULL CHECK (candidate_hash ~ '^[0-9a-f]{64}$'),
  hash_version text NOT NULL CHECK (hash_version='sha256-sorted-json-v1'),
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  detected_by name NOT NULL DEFAULT session_user,
  PRIMARY KEY(event_id,candidate_hash,hash_version)
);
ALTER TABLE audit.integrity_incidents ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_incidents_expiry_idx ON audit.integrity_incidents(detected_at);
CREATE TABLE audit.maintenance_runs (
  run_id uuid PRIMARY KEY,
  executed_by name NOT NULL DEFAULT session_user,
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  policy_version text NOT NULL DEFAULT 'P1-v1' CHECK (policy_version='P1-v1'),
  events_purged integer NOT NULL CHECK (events_purged>=0),
  incidents_purged integer NOT NULL CHECK (incidents_purged>=0),
  runs_purged integer NOT NULL CHECK (runs_purged>=0)
);
ALTER TABLE audit.maintenance_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_maintenance_expiry_idx ON audit.maintenance_runs(completed_at);
CREATE FUNCTION audit.reject_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Accepted audit evidence immutable'; END $$;
CREATE TRIGGER events_no_update BEFORE UPDATE ON audit.events FOR EACH ROW EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON audit.events FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER incidents_no_update BEFORE UPDATE ON audit.integrity_incidents FOR EACH ROW EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER incidents_no_truncate BEFORE TRUNCATE ON audit.integrity_incidents FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER runs_no_update BEFORE UPDATE ON audit.maintenance_runs FOR EACH ROW EXECUTE FUNCTION audit.reject_change();
CREATE TRIGGER runs_no_truncate BEFORE TRUNCATE ON audit.maintenance_runs FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();

CREATE FUNCTION audit.accept(canonical_json text,payload_hash text,hash_version text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE e jsonb; id uuid; occurred timestamptz; old audit.events%ROWTYPE; n timestamptz:=clock_timestamp();
BEGIN
  e:=audit_contract.parse_event(canonical_json,payload_hash,hash_version);
  id:=(e->>'eventId')::uuid; occurred:=(e->>'occurredAt')::timestamptz;
  IF occurred>n+interval '300 seconds' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Audit event outside ingestion window';
  END IF;
  -- Reject expired replay before inserting: no resurrection after retention/restore.
  IF occurred+interval '31536000 seconds'<=n THEN RETURN 'expired'; END IF;
  INSERT INTO audit.events(event_id,canonical_json,envelope,payload_hash,hash_version,occurred_at,expires_at)
  VALUES(id,canonical_json,e,payload_hash,hash_version,occurred,occurred+interval '31536000 seconds')
  ON CONFLICT(event_id) DO NOTHING;
  IF FOUND THEN RETURN 'inserted'; END IF;
  SELECT * INTO STRICT old FROM audit.events q WHERE q.event_id=id;
  IF old.payload_hash IS NOT DISTINCT FROM payload_hash AND old.hash_version IS NOT DISTINCT FROM hash_version
     AND old.canonical_json IS NOT DISTINCT FROM canonical_json THEN RETURN 'matching'; END IF;
  -- Candidate payload is never retained. Caller must commit this disposition,
  -- then quarantine source/alert independently rather than rolling it back.
  INSERT INTO audit.integrity_incidents(event_id,candidate_hash,hash_version)
    VALUES(id,payload_hash,hash_version) ON CONFLICT DO NOTHING;
  RETURN 'conflict';
END $$;

CREATE FUNCTION audit.purge_expired(run uuid,batch_limit integer DEFAULT 1000)
RETURNS TABLE(events_purged integer,incidents_purged integer,runs_purged integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE previous audit.maintenance_runs%ROWTYPE;
BEGIN
  IF run IS NULL OR batch_limit IS NULL OR batch_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid audit purge'; END IF;
  SELECT * INTO previous FROM audit.maintenance_runs WHERE run_id=run;
  IF FOUND THEN
    IF previous.executed_by<>session_user THEN RAISE EXCEPTION 'Audit maintenance run conflict'; END IF;
    RETURN QUERY SELECT previous.events_purged,previous.incidents_purged,previous.runs_purged; RETURN;
  END IF;
  WITH expired AS (SELECT q.event_id FROM audit.events q WHERE q.expires_at<=clock_timestamp()
    ORDER BY q.expires_at,q.event_id FOR UPDATE SKIP LOCKED LIMIT batch_limit)
    DELETE FROM audit.events q USING expired WHERE q.event_id=expired.event_id;
  GET DIAGNOSTICS events_purged=ROW_COUNT;
  WITH expired AS (SELECT q.event_id,q.candidate_hash,q.hash_version FROM audit.integrity_incidents q
    WHERE q.detected_at<=clock_timestamp()-interval '31536000 seconds'
    ORDER BY q.detected_at,q.event_id FOR UPDATE SKIP LOCKED LIMIT batch_limit)
    DELETE FROM audit.integrity_incidents q USING expired
    WHERE q.event_id=expired.event_id AND q.candidate_hash=expired.candidate_hash AND q.hash_version=expired.hash_version;
  GET DIAGNOSTICS incidents_purged=ROW_COUNT;
  WITH expired AS (SELECT q.run_id FROM audit.maintenance_runs q WHERE q.completed_at<=clock_timestamp()-interval '31536000 seconds'
    ORDER BY q.completed_at,q.run_id FOR UPDATE SKIP LOCKED LIMIT batch_limit)
    DELETE FROM audit.maintenance_runs q USING expired WHERE q.run_id=expired.run_id;
  GET DIAGNOSTICS runs_purged=ROW_COUNT;
  INSERT INTO audit.maintenance_runs(run_id,events_purged,incidents_purged,runs_purged)
  VALUES(run,events_purged,incidents_purged,runs_purged);
  RETURN NEXT;
END $$;

-- PG14 view-owner semantics; only dedicated view owner accesses base tables.
-- Backend must durably audit reader/export authorization before exposing data.
CREATE VIEW audit.reader_events WITH (security_barrier=true) AS
  SELECT event_id,occurred_at,received_at,expires_at,event_name,outcome,retention_class,
    actor_kind,actor_id,scope_kind,workspace_id,target_type,target_id,request_id,operation_id,envelope
  FROM audit.events WHERE expires_at>clock_timestamp();
CREATE VIEW audit.maintenance_history WITH (security_barrier=true) AS
  SELECT * FROM audit.maintenance_runs WHERE completed_at>clock_timestamp()-interval '31536000 seconds';
CREATE VIEW audit.integrity_history WITH (security_barrier=true) AS
  SELECT * FROM audit.integrity_incidents WHERE detected_at>clock_timestamp()-interval '31536000 seconds';
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA audit FROM PUBLIC;
GRANT USAGE ON SCHEMA audit TO fm_audit_writer,fm_audit_reader,fm_audit_destination_maintenance;
GRANT EXECUTE ON FUNCTION audit.accept(text,text,text) TO fm_audit_writer;
GRANT SELECT ON audit.reader_events TO fm_audit_reader;
GRANT SELECT ON audit.maintenance_history,audit.integrity_history TO fm_audit_destination_maintenance;
GRANT EXECUTE ON FUNCTION audit.purge_expired(uuid,integer) TO fm_audit_destination_maintenance;
-- fm_audit_export intentionally grants no database access. Export permission is
-- separately enforced by the future backend; reader SQL access can itself copy.
RESET ROLE;
DO $$ BEGIN EXECUTE format('REVOKE fm_audit_destination_owner FROM %I', current_user); END $$;
COMMIT;
