# WellnessFind

A service marketplace for local health, wellness, education, and entertainment.
The app uses React, Express, Drizzle, and Supabase for PostgreSQL, authentication,
and private image storage.

## Local setup

1. Install a supported Node.js version (Node 22 or newer) and run `npm ci`.
2. Copy `.env.example` to `.env` and fill in the Supabase database/API credentials,
   session secret, Google Maps key, and OpenAI key. Keep `.env` private.
3. For a fresh database, run `npm run db:push` to create the ten application tables
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
- Browse service lists and Google Maps.
- View customer appointments on the separate My Bookings page, with upcoming,
  date, status, and booking history filters.
- Create provider listings and availability schedules.
- Manage appointments, services, availability, and settings on separate My Services
  pages, with a shared workspace selector and responsive section navigation.
- Offer services as an individual or a company, with employees managed by one
  or more administrators, separate employee logins, and optional public employee names.
- Copy an owned listing into an inactive service, edit its details, and publish
  it using the editor's Save and Publish button. Use Save Inactive to keep it hidden.
  Copies reuse the same image and employee assignment and
  do not duplicate bookings, service-specific schedules, or AI embeddings.
- Request bookings and manage their status.
- Sign up and sign in using Supabase email/password or configured Google,
  Facebook, Apple, and Microsoft login. See the [social sign-in setup guide](docs/social-sign-in.md).
- Update your password from Account details after verifying your current password.
- Browse all registered accounts from Administration with application support access.
- Upload private service images, with access controlled by Express.
- Find related services using OpenAI embeddings.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend hot reload and automatic backend restarts |
| `npm run check` | TypeScript check |
| `npm run build` | Compile frontend and backend into `dist/` |
| `npm start` | Serve the production build |
| `npm run db:push` | Apply reviewed application schema changes |
| `npm run db:setup-company` | Add company workspaces, employees, and team permissions; preserve existing records |
| `npm run storage:setup` | Configure the private image bucket |
| `npm run test:integration` | Live Auth/Storage, company, employee, and booking tests with temporary users |
| `npm run test:teams` | Live team permissions, invitation sign-in, rescheduling, and ownership tests without sending emails |
| `npm run test:invite-ui` | Invitation session expiry and stale password-state regression tests |
| `npm run test:provider-navigation` | Provider routes, service editing, workspace switching, and permission regression tests |
| `npm run test:customer-bookings` | Customer booking navigation, authentication, filters, loading, errors, and retry tests |
| `npm run test:administration` | Support access, user directory pagination, response privacy, and administration UI regression tests |
| `npm run test:social-auth` | Social buttons, provider flags/scopes, PKCE callbacks, redirects, and profile/session regression tests with Auth mocked |
| `npm run test:password` | Password validation, current-password verification, and session handling regression tests |
| `npm run test:api-transport` | Real local HTTP, API fallback, password response, and session cookie tests; Supabase is mocked |

## Application administration

Set `APP_ADMIN_USER_IDS` on the backend to a comma-separated list of trusted
support staff's Supabase Auth user IDs, then restart the server. Find these IDs
in Supabase **Authentication > Users**. Empty configuration grants no access.
Company owners and administrators do not automatically receive application
support access. Signup data and editable user metadata cannot grant it.

Authorized staff can open **Administration** from the account menu or visit
`/administration`. The **App users** directory lists all Supabase Auth accounts,
including users who have not verified their email or signed in. It shows their
name, user ID, email verification, account status, company affiliations and roles,
registration time, and last sign-in. Search by name/email or company, combine
email verification and account status filters, or select an inclusive registration
date range in the timezone shown on the page. Sort by name or registration date
in either direction. Apply filters to search, or Clear filters to reset them.
Paging supports 25, 50, or 100 users, defaults to 50, and shows the matching count.
Company information includes every ownership/membership, including closed companies.
Account status is **Blocked** for a current Supabase Auth ban or a deleted Auth
account, and **Active** otherwise; email verification is independent. The directory
is read-only and does not change accounts or company access.

Search, filters, and sorting apply across the whole directory before paging.
The backend reads Auth accounts in batches on each request and joins application
company memberships; only the selected result page is sent to the browser.
Refresh reloads the current filters and page from the source records.
Every directory request verifies the signed-in identity and configured access;
Auth metadata and credentials are not included in directory responses.
No database migration is required.

## Company providers

On `/login`, choose **Create a company**, enter the company name, email, and
password, and verify the email. Personal names are optional. The verified creator
becomes the company owner. Existing personal accounts can create a company from
**Provider profile**; the initial conversion preserves their offers and schedules.

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

Use **Workspace** to switch between personal offers and companies you belong to.
Each account can create one company and join other companies by invitation.
Employees can remain managed records, or receive separate logins through
**Company team**. Invite by email, choose access and the associated employee,
then send the email or share the generated invitation link. Existing Supabase
accounts receive a shareable link when Supabase cannot send an Auth invitation.
Invitations expire after seven days and can be revoked.

| Access | Permissions |
| --- | --- |
| Owner | Company management, team management, ownership transfer, close/reopen |
| Administrator | All company services, schedules, team access, and reservations |
| Service provider | View, confirm, cancel, and reschedule assigned reservations |
| Read-only | View assigned services and reservations; no company changes |

Company membership is checked on the backend for every request. Removing a
member or changing access applies to existing sessions. Public listings show the
company name, with employee names optional. Owners can close companies without
destroying reservation history, then reopen them. Personal workspaces retain
separate offers. To update an existing installation, run
`npm run db:setup-company` before restarting the backend. Existing company
administrators are migrated to owner memberships automatically.

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
- `server/companyRoutes.ts`: invitations, team access, workspace selection, and ownership
- `server/companyAccess.ts`: company authorization and signup conversion
- `shared/schema.ts`: ten application tables and validation schemas
- `docs/`: Supabase setup and migration instructions

## License

MIT; see `package.json`.
