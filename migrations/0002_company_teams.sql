BEGIN;
CREATE TABLE IF NOT EXISTS companies (
  id serial PRIMARY KEY, name varchar(150) NOT NULL,
  owner_id varchar NOT NULL REFERENCES users(id),
  provider_id varchar NOT NULL UNIQUE REFERENCES users(id),
  is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now()
);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id integer REFERENCES companies(id);
CREATE TABLE IF NOT EXISTS company_memberships (
  company_id integer NOT NULL REFERENCES companies(id), user_id varchar NOT NULL REFERENCES users(id),
  role varchar NOT NULL CHECK (role IN ('owner','admin','provider','viewer')),
  employee_id integer REFERENCES employees(id), created_at timestamp DEFAULT now(),
  PRIMARY KEY(company_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS company_memberships_employee_idx ON company_memberships(employee_id);
CREATE TABLE IF NOT EXISTS company_invitations (
  id varchar PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), email varchar NOT NULL,
  role varchar NOT NULL CHECK(role IN ('admin','provider','viewer')), employee_id integer REFERENCES employees(id),
  token_hash varchar NOT NULL UNIQUE, invited_by varchar NOT NULL REFERENCES users(id),
  expires_at timestamp NOT NULL, accepted_at timestamp, revoked_at timestamp
);
ALTER TABLE services ADD COLUMN IF NOT EXISTS company_id integer REFERENCES companies(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS company_id integer REFERENCES companies(id);
ALTER TABLE availability ADD COLUMN IF NOT EXISTS company_id integer REFERENCES companies(id);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON companies, company_memberships, company_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE companies_id_seq FROM PUBLIC, anon, authenticated;
CREATE TEMP TABLE legacy_company_backfill ON COMMIT DROP AS
SELECT u.id FROM users u WHERE u.provider_type='company' AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.provider_id=u.id);
INSERT INTO companies (name,owner_id,provider_id)
SELECT COALESCE(NULLIF(company_name,''),'Company'),id,id FROM users WHERE provider_type='company'
ON CONFLICT(provider_id) DO NOTHING;
INSERT INTO company_memberships(company_id,user_id,role)
SELECT id,owner_id,'owner' FROM companies ON CONFLICT(company_id,user_id) DO NOTHING;
UPDATE employees e SET company_id=c.id FROM companies c WHERE e.provider_id=c.provider_id AND e.company_id IS NULL AND c.provider_id IN (SELECT id FROM legacy_company_backfill);
UPDATE services s SET company_id=c.id FROM companies c WHERE s.provider_id=c.provider_id AND s.company_id IS NULL AND c.provider_id IN (SELECT id FROM legacy_company_backfill);
UPDATE bookings b SET company_id=s.company_id FROM services s WHERE b.service_id=s.id AND b.company_id IS NULL AND b.provider_id IN (SELECT id FROM legacy_company_backfill);
UPDATE availability a SET company_id=c.id FROM companies c WHERE a.provider_id=c.provider_id AND a.company_id IS NULL AND c.provider_id IN (SELECT id FROM legacy_company_backfill);
COMMIT;
