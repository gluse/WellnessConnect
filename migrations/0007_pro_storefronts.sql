BEGIN;
CREATE TABLE IF NOT EXISTS public.provider_subscriptions (
  id serial PRIMARY KEY,
  user_id varchar UNIQUE REFERENCES public.users(id),
  company_id integer UNIQUE REFERENCES public.companies(id),
  plan varchar NOT NULL DEFAULT 'free',
  pro_until timestamptz,
  updated_by varchar NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_workspace_check CHECK ((user_id IS NOT NULL) <> (company_id IS NOT NULL)),
  CONSTRAINT subscription_plan_check CHECK (plan IN ('free','pro') AND (plan <> 'pro' OR pro_until IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.storefronts (
  id serial PRIMARY KEY,
  subscription_id integer NOT NULL UNIQUE REFERENCES public.provider_subscriptions(id),
  slug varchar(64) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_url text,
  cover_url text,
  is_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_subscriptions, public.storefronts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.provider_subscriptions_id_seq, public.storefronts_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
