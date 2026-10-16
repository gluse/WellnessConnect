BEGIN;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS cleanup_time integer NOT NULL DEFAULT 0;
-- Historical bookings had no extra time. Keep that snapshot when listings change.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_cleanup_time integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_cleanup_time_check' AND conrelid = 'public.services'::regclass) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_cleanup_time_check CHECK (cleanup_time BETWEEN 0 AND 1440);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_cleanup_time_check' AND conrelid = 'public.bookings'::regclass) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_cleanup_time_check CHECK (booking_cleanup_time BETWEEN 0 AND 1440);
  END IF;
END $$;
COMMIT;
