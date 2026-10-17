BEGIN;
CREATE TABLE IF NOT EXISTS public.addresses (
  id serial PRIMARY KEY,
  provider_id varchar NOT NULL REFERENCES public.users(id),
  company_id integer REFERENCES public.companies(id),
  address text,
  latitude double precision,
  longitude double precision,
  location_source varchar NOT NULL DEFAULT 'legacy',
  location_key varchar,
  location_place_id text,
  location_expires_at timestamptz,
  location_address_source varchar NOT NULL DEFAULT 'user',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.addresses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.addresses_id_seq FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS addresses_workspace_idx ON public.addresses(provider_id, company_id);
CREATE INDEX IF NOT EXISTS addresses_google_expiry_idx ON public.addresses(location_expires_at) WHERE location_source = 'google';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS address_id integer REFERENCES public.addresses(id);
CREATE INDEX IF NOT EXISTS services_address_idx ON public.services(address_id);

-- Preserve provenance and original expiry. Merge only identical locations in the
-- same workspace; conflicting coordinates/metadata remain separate records.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'address') THEN
    INSERT INTO public.addresses(provider_id, company_id, address, latitude, longitude,
      location_source, location_key, location_place_id, location_expires_at, location_address_source)
    SELECT DISTINCT coalesce(c.provider_id, s.provider_id), s.company_id, s.address, s.latitude, s.longitude,
      s.location_source, s.location_key, s.location_place_id, s.location_expires_at, s.location_address_source
    FROM public.services s LEFT JOIN public.companies c ON c.id = s.company_id
    WHERE s.address_id IS NULL AND (s.address IS NOT NULL OR s.latitude IS NOT NULL OR s.longitude IS NOT NULL);

    UPDATE public.services s SET address_id = a.id
    FROM public.addresses a
    WHERE s.address_id IS NULL
      AND (a.company_id IS NOT NULL AND a.company_id = s.company_id
        OR a.company_id IS NULL AND s.company_id IS NULL AND a.provider_id = s.provider_id)
      AND ROW(a.address, a.latitude, a.longitude, a.location_source, a.location_key,
        a.location_place_id, a.location_expires_at, a.location_address_source)
        IS NOT DISTINCT FROM ROW(s.address, s.latitude, s.longitude, s.location_source, s.location_key,
          s.location_place_id, s.location_expires_at, s.location_address_source);
  END IF;
END $$;

-- Replace the existing cleanup function before removing its old service columns.
CREATE OR REPLACE FUNCTION public.purge_expired_geocoding() RETURNS void
LANGUAGE sql SET search_path = pg_catalog AS $$
  UPDATE public.geocoding_cache SET latitude = NULL, longitude = NULL
    WHERE expires_at <= now() AND (latitude IS NOT NULL OR longitude IS NOT NULL);
  UPDATE public.addresses SET latitude = NULL, longitude = NULL,
    address = CASE WHEN location_address_source = 'google' THEN NULL ELSE address END
    WHERE location_source = 'google' AND (location_expires_at IS NULL OR location_expires_at <= now())
      AND (latitude IS NOT NULL OR longitude IS NOT NULL OR (location_address_source = 'google' AND address IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public.purge_expired_geocoding() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.services
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS location_source,
  DROP COLUMN IF EXISTS location_key,
  DROP COLUMN IF EXISTS location_place_id,
  DROP COLUMN IF EXISTS location_expires_at,
  DROP COLUMN IF EXISTS location_address_source;
SELECT public.purge_expired_geocoding();
COMMIT;
