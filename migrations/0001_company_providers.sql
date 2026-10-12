BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_type varchar NOT NULL DEFAULT 'individual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name varchar(150);
CREATE TABLE IF NOT EXISTS employees (
  id serial PRIMARY KEY,
  provider_id varchar NOT NULL REFERENCES users(id),
  name varchar(100) NOT NULL,
  show_name boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_provider_idx ON employees(provider_id);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE employees FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE employees_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE services ADD COLUMN IF NOT EXISTS employee_id integer REFERENCES employees(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS employee_id integer REFERENCES employees(id);
CREATE INDEX IF NOT EXISTS bookings_employee_date_idx ON bookings(employee_id, scheduled_date);
COMMIT;
