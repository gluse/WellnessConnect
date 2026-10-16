BEGIN;
CREATE TABLE IF NOT EXISTS public.categories (
  key varchar(64) PRIMARY KEY,
  name varchar(100) NOT NULL,
  icon varchar(16) NOT NULL DEFAULT '',
  search_keywords text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_idx ON public.categories (lower(name));
INSERT INTO public.categories (key, name, icon, search_keywords) VALUES
  ('health_wellness', 'Health & Wellness', '🏥', 'health wellness spa massage sauna bath relaxation therapy healing'),
  ('education', 'Education', '🎓', 'education learning teaching tutoring lessons classes school study math science language'),
  ('entertainment', 'Entertainment', '🎵', 'entertainment fun activities recreation leisure games events party')
ON CONFLICT (key) DO NOTHING;
-- Preserve any additional categories already present in legacy services.
INSERT INTO public.categories (key, name)
SELECT DISTINCT category, category FROM public.services
ON CONFLICT (key) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_category_categories_key_fk' AND conrelid = 'public.services'::regclass) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_category_categories_key_fk
      FOREIGN KEY (category) REFERENCES public.categories(key) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS services_category_idx ON public.services(category);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated;
COMMIT;
