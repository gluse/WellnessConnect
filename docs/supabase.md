# Supabase database migration

The application now uses standard PostgreSQL through `pg` and Drizzle. Set
`DATABASE_URL` to Supabase to move application records and Express sessions there.
Login and images now use Supabase Auth and Storage. See
[authentication and image setup](supabase-auth-storage.md).

## Connection setup

1. Create an empty Supabase project and open **Connect**.
2. Copy the **Session pooler** PostgreSQL connection string (port 5432), or use
   the direct connection if your network supports it. Do not use the transaction
   pooler for this migration. Do not use a publishable or service-role API key.
3. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the Supabase connection
   and `SOURCE_DATABASE_URL` to the source PostgreSQL connection string from your
   existing host. Include the database passwords; URL-encode special characters.
4. Use TLS with certificate verification (`sslmode=verify-full`). If the
   connection requires a private CA, download the project's database CA from
   Supabase and add `sslrootcert=URL_ENCODED_ABSOLUTE_CERTIFICATE_PATH` to the URL.
   Do not disable certificate verification to get past a certificate error.
5. Install PostgreSQL client tools and put `pg_dump`, `pg_restore`, and `psql`
   on PATH. Use client versions compatible with both servers; `pg_dump` must not
   be older than the source server. Run the tools on a machine with access to
   both databases.

The local `.env` file and `database-backups/` are ignored by Git. Database
passwords and backups belong on the backend only.

## Copy existing data into an empty project

Do **not** run `db:push` before the transfer: it creates tables that would
conflict with the restored database. Supabase's own `auth` and `storage` schemas
can remain; the transfer only selects this application's six public tables and
four ID sequences.

Start with a read-only check:

```powershell
npm run db:transfer
```

This checks connections, source tables, source row counts, PostgreSQL utilities,
Supabase API roles, and absence of application tables/sequences on the target.
It refuses to overwrite existing application objects.

Stop the old application and any jobs that write to the source database before
the final transfer. Keep writes paused until verification and cutover finish.

```powershell
npm run db:transfer -- --apply
```

The transfer:

- Makes a dated backup under `database-backups/` without altering the source.
- Preserves users and their IDs, services, bookings, availability, embeddings,
  sessions, foreign keys, and sequence values.
- Excludes source ownership and grants and leaves Supabase-managed schemas alone.
- Restores the application objects and enables row-level security in a single
  transaction. A restore or security SQL error rolls that transaction back.
- Revokes access from Supabase's `anon` and `authenticated` API roles.
- Compares exact row counts and checks row-level security before reporting success.

If verification fails after the restore commits, keep the backend on the source.
Investigate before cutover. Do not rerun with a populated target or drop tables
to silence the empty-target check. Keep the backup, which includes sensitive
user and session information, in private storage.

After verification, set **the deployed backend's** `DATABASE_URL` to the same
Supabase connection and restart it. Local `.env` changes do not update the
deployed host's environment. Verify login/session storage,
service search, provider ownership, creating a booking, and availability editing.
Only then resume writes on the new backend. Retain the source for rollback;
after new writes begin, rollback requires reconciling those records first.

## Authorization and subsequent schema changes

Express enforces access using verified Supabase identities. Application profiles
use the Supabase Auth user ID, and the backend connects as the database owner.
Application tables have RLS enabled without browser-facing policies; all access
continues through Express, not the Supabase Data API. The `sessions` table contains
server-only tokens and must never be exposed to browser clients.

If importing data from a previous authentication system, map old user IDs to new Auth
identities and their service/booking references before cutover. The dump utility
copies records but does not perform identity migration. The current installation
started with empty tables and needs no such mapping.

For a fresh database with no existing data, `npm run db:push` creates the tables
and enables RLS. For later schema changes, review Drizzle's proposed changes
before applying them. Configuration scopes introspection to the six application
tables in `public`; it does not manage Supabase's platform tables.

Sources:

- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [PostgreSQL migration to Supabase](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Drizzle's PostgreSQL driver](https://orm.drizzle.team/docs/get-started-postgresql)
