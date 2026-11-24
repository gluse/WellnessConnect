# Ordelino

Marketplace for local health, wellness, education, and entertainment services.
Built with React, Express, Drizzle, and Supabase (PostgreSQL, authentication,
and private image storage), with Google Maps and OpenAI semantic search.

## Core features

- Guest search, filters, sorting, maps, provider catalogs, and service details;
  sign-in is required for bookings and account features.
- Customer booking management and reviews of completed appointments.
- Personal/company workspaces, employee permissions, listings, availability,
  group capacity, and preparation/cleanup time.
- Saved addresses, reusable registered locations, and private image uploads.
- Administration for accounts, categories, and Pro storefront access.
- Email/password and configured social sign-in providers.

## Development

1. Install Node.js 22+ and run `npm ci`.
2. Configure the intended environment; keep credentials and environment files private.
   The current `npm run dev` launcher uses the protected local Docker profile
   `.env.local-docker.local`. Hosted development uses `npm run dev:hosted` and
   `.env`; see `.env.example` and the [Auth/Storage guide](docs/supabase-auth-storage.md).
3. With the local profile and Docker services configured, run `npm run dev` and
   open `http://localhost:5000`. Keep the terminal open while using the app.

Database/storage setup and migrations require the correct owner and recorded
approval under [AGENTS.md](AGENTS.md). Existing installations need the applicable
feature migrations before starting the updated backend; saved addresses require
`db:setup-addresses` before `db:push`. Do not run `db:push` before restoring a dump.
Historical setup commands are guarded when the independent local profile exists;
review the target with the DB owner rather than bypassing the guard.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Docker development launcher |
| `npm run check` | TypeScript check |
| `npm run build` | Build production assets into `dist/` |
| `npm start` | Serve the production build |

See [package.json](package.json) for feature tests, workers, and setup scripts.
Inspect test runners before execution: current language coverage is **en, lv, ru**;
all other supported languages, including Arabic/RTL, are deferred. Connected tests
and temporary database writes require the applicable recorded authorization.

## Documentation

- [Agent authority and operating rules](AGENTS.md), [tasks](TASKS.md),
  and [coordination queue](docs/agent-coordination.md)
- [Architecture and historical changelog](docs/architecture.md)
- [Supabase setup and migration](docs/supabase.md),
  [Auth/Storage](docs/supabase-auth-storage.md), and [social sign-in](docs/social-sign-in.md)
- [Registered locations](docs/registered-locations.md) and
  [preparation/cleanup time](docs/preparation-cleanup-time.md)
- [Categories](docs/categories.md) and [Pro storefronts](docs/pro-storefronts.md)

Code: `client/` contains the UI, `server/` contains APIs, authentication,
company access and storage, and `shared/schema.ts` contains shared schemas.

## Hosting

AWS publishing has two prepared entry points: `npm run publish:aws:local` and
`npm run publish:aws:codebuild`. Both default to an offline plan. See the
[publishing guide](docs/aws-one-command-publishing.md) for exact release commands,
the CodeBuild setup and remaining execution/verification prerequisites.

Use a Node.js host running Express: `npm ci`, `npm run build`, then `npm start`.
Configure host environment variables, an HTTPS `APP_URL`, `PORT`, and Supabase Auth
callbacks. Keep frontend/API on one origin behind HTTPS. Local environment edits
do not update deployed settings; follow recorded deployment approvals and holds.

Restrict the browser Maps key to website origins and use a separate backend
Geocoding key restricted to outbound IPs and the Geocoding API.
Application support access uses backend `APP_ADMIN_USER_IDS`; company roles do
not grant it, and an empty setting grants none.

License: MIT (see [package.json](package.json)).
