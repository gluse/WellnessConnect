# WellnessFind

A service marketplace for local health, wellness, education, and entertainment.
The app uses React, Express, Drizzle, and Supabase for PostgreSQL, authentication,
and private image storage.

## Local setup

1. Install a supported Node.js version (Node 22 or newer) and run `npm ci`.
2. Copy `.env.example` to `.env` and fill in the Supabase database/API credentials,
   session secret, Google Maps key, and OpenAI key. Keep `.env` private.
3. For a fresh database, run `npm run db:push` to create the seven application tables
   with row-level security enabled.
4. Run `npm run storage:setup` to configure the private image bucket.
5. Configure email and optional Google login using the
   [authentication and storage guide](docs/supabase-auth-storage.md).
6. Run `npm run dev` and open the `APP_URL` configured in `.env` (by default
   `http://localhost:5000`). This starts both Express and the Vite frontend.

The current Supabase installation started without importing historical records.
For a future database transfer, see [the database migration guide](docs/supabase.md).
Do not create tables with `db:push` before restoring a database dump.

## Features

- Search services by location, category, audience, date, and keywords.
- Browse service lists, Google Maps, and calendars.
- Create provider listings and availability schedules.
- Offer services as an individual or a company, with employees managed by one
  administrator and optional public employee names.
- Copy an owned listing into an inactive service, edit its details, and publish
  it using the editor's Save and Publish button. Use Save Inactive to keep it hidden.
  Copies reuse the same image and employee assignment and
  do not duplicate bookings, service-specific schedules, or AI embeddings.
- Request bookings and manage their status.
- Sign up and sign in using Supabase email/password or configured Google login.
- Upload private service images, with access controlled by Express.
- Find related services using OpenAI embeddings.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Full backend and frontend development server |
| `npm run check` | TypeScript check |
| `npm run build` | Compile frontend and backend into `dist/` |
| `npm start` | Serve the production build |
| `npm run db:push` | Apply reviewed application schema changes |
| `npm run db:setup-company` | Add company profiles and employees to an existing Supabase database |
| `npm run storage:setup` | Configure the private image bucket |
| `npm run test:integration` | Live Auth/Storage, company, employee, and booking tests with temporary users |

## Company providers

In the provider dashboard, choose **Company** in **Provider profile**, enter the
company name, and click **Save Profile**. The same administrator manages all
company offers and bookings. Existing offers use the saved company name too.

Add employees using a name or an internal label (for example, "Massage therapist").
Leave **Show this name to customers** off to show only the company publicly.
Assign an employee in each service's editor, then **Save and Publish**. To have
several employees offer the same treatment, copy the offer and assign each copy
to its employee. Copies start inactive and need publishing.

Different employees can accept simultaneous appointments. Offers assigned to
the same employee share booking conflicts, including across different treatments.
Offers without an employee share the administrator's booking schedule. General
working hours apply to all employees; service-specific schedules can define
different hours. Employee assignment cannot change while a service has upcoming
bookings, and employees with booking history are retained.

Each administrator account has one provider profile. Employees do not need their
own login accounts. To update an existing installation, run
`npm run db:setup-company` before restarting the backend.

## Deployment

Use a Node.js host capable of running Express. Build with `npm ci` followed by
`npm run build`; run with `npm start`. Set the backend environment variables on
that host, including an HTTPS `APP_URL`, `PORT`, and the registered Supabase Auth
callback URL. Local `.env` changes do not update a deployed host's settings.

Keep frontend and API on the same origin. Serve HTTPS through the host's proxy.
The production server loads development tooling only when running in development.
Replit-specific login, image storage, and Vite plugins are no longer required.
The optional `.replit` file still describes how to launch the app on that host.

For Google Maps, enable Maps JavaScript and Geocoding APIs. Use a browser key in
`GOOGLE_MAPS_API_KEY`, restricted to your local and production website origins.
Use a separate backend key in `GOOGLE_GEOCODING_API_KEY`, restricted to the
backend's outbound IP addresses and the Geocoding API. Website/referrer-restricted
keys cannot call the server-side Geocoding endpoint. Restart the backend after
changing `.env`. A place/business name may need its full street address to match.

## Project structure

- `client/src/pages/login.tsx`: signup and login interface
- `server/auth.ts`: Supabase verification, PKCE callbacks, and Express sessions
- `server/supabase.ts`: isolated Auth clients and backend-only privileged client
- `server/imageStorage.ts`: signed uploads and image ownership checks
- `server/db.ts`: PostgreSQL connection pool
- `server/routes.ts`: service, booking, availability, and image endpoints
- `shared/schema.ts`: seven application tables and validation schemas
- `docs/`: Supabase setup and migration instructions

## License

MIT; see `package.json`.
