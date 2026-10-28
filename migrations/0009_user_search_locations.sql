-- Prepared only. Apply to an explicitly approved target before feature rollout.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
-- The separately approved sixteen-table audit runtime must be installed and
-- verified first. Never modify/reapply its pinned source/destination scripts.
DO $$ BEGIN
  IF current_user<>session_user OR current_user<>'postgres'
     OR current_setting('server_version_num')::integer/10000<>17 THEN
    RAISE EXCEPTION 'Location migration principal/version precondition failed';
  END IF;
  IF to_regclass('public.user_search_locations') IS NOT NULL THEN
    RAISE EXCEPTION 'Location table already exists; inspect before retry';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN
      ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev'))<>4
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN
      ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev')
      AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'Verified disabled source runtime required before location migration';
  END IF;
  IF NOT pg_has_role('fmt_app_dev','fm_app_runtime','USAGE') THEN
    RAISE EXCEPTION 'Application runtime membership missing';
  END IF;
END $$;
CREATE TABLE public.user_search_locations (
  user_id varchar PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  source varchar NOT NULL,
  input_text varchar(300),
  place_id varchar(512),
  latitude double precision,
  longitude double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_location_shape CHECK (
    (source = 'device' AND input_text IS NULL AND place_id IS NULL
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    OR (source = 'address' AND input_text IS NOT NULL
      AND length(trim(input_text)) BETWEEN 1 AND 300
      AND latitude IS NULL AND longitude IS NULL
      AND (place_id IS NULL OR length(trim(place_id)) > 0))
  )
);
ALTER TABLE public.user_search_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_search_locations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_search_locations TO fm_app_runtime;
CREATE POLICY fmt_app_server ON public.user_search_locations FOR ALL
  TO fm_app_runtime USING(true) WITH CHECK(true);
-- The fixed executor requires this receipt and the final COMMIT. It is catalog
-- metadata only, not a user/location/audit-ledger row read.
SELECT to_regclass('public.user_search_locations') IS NOT NULL AS location_schema_created;
COMMIT;
