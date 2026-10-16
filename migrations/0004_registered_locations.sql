BEGIN;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS location_source varchar NOT NULL DEFAULT 'legacy';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS location_key varchar;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS location_place_id text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS location_expires_at timestamptz;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS location_address_source varchar NOT NULL DEFAULT 'user';
-- Avoid float4 serialization rounding causing valid verifications to mismatch.
ALTER TABLE public.services ALTER COLUMN latitude TYPE double precision, ALTER COLUMN longitude TYPE double precision;
CREATE INDEX IF NOT EXISTS services_google_expiry_idx ON public.services(location_expires_at) WHERE location_source = 'google';
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
  address_key varchar PRIMARY KEY,
  latitude double precision,
  longitude double precision,
  place_id text,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.geocoding_cache ALTER COLUMN latitude TYPE double precision, ALTER COLUMN longitude TYPE double precision;
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geocoding_cache FROM PUBLIC, anon, authenticated;

-- Scheduled in PostgreSQL, so deletion runs even when the web app is stopped.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE OR REPLACE FUNCTION public.purge_expired_geocoding() RETURNS void
LANGUAGE sql SET search_path = pg_catalog AS $$
  UPDATE public.geocoding_cache SET latitude = NULL, longitude = NULL
    WHERE expires_at <= now() AND (latitude IS NOT NULL OR longitude IS NOT NULL);
  UPDATE public.services SET latitude = NULL, longitude = NULL,
    address = CASE WHEN location_address_source = 'google' THEN NULL ELSE address END
    WHERE location_source = 'google' AND (location_expires_at IS NULL OR location_expires_at <= now())
      AND (latitude IS NOT NULL OR longitude IS NOT NULL OR (location_address_source = 'google' AND address IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public.purge_expired_geocoding() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('fitsmytime-geocoding-cleanup', '17 * * * *', 'SELECT public.purge_expired_geocoding()');
COMMIT;
