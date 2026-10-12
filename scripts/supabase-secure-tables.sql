-- Express owns authorization and connects as the database owner.
-- Application data is accessed through Express, not the Supabase Data API.
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sessions, public.users, public.services,
  public.bookings, public.service_embeddings, public.availability
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON SEQUENCE public.services_id_seq, public.bookings_id_seq,
  public.service_embeddings_id_seq, public.availability_id_seq
  FROM PUBLIC, anon, authenticated;
