BEGIN;
CREATE TABLE IF NOT EXISTS service_reviews (
  id serial PRIMARY KEY,
  booking_id integer NOT NULL UNIQUE REFERENCES bookings(id),
  rating integer NOT NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT service_reviews_comment_check CHECK (
    length(comment) <= 2000 AND (rating >= 3 OR length(btrim(comment)) > 0)
  )
);
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON service_reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE service_reviews_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
