# Service categories

Application administrators manage the category catalog at **Administration →
Categories** (`/administration`). Access uses the same server-configured
`APP_ADMIN_USER_IDS` allowlist as the user directory. Company administrators and
providers cannot change the catalog.

Each category has a stable key, display name, optional emoji, and optional search
keywords. Administrators can add categories, edit names/icons/keywords, and delete
unused categories after confirmation. Keys cannot be changed after creation.
Names are unique without regard to case. Category names are shared display text;
they are not automatically translated.

Search filters, active filter labels, service details, card placeholders, the
landing page, and the provider editor read `/api/categories`. Reading the catalog
is public; writes to `/api/admin/categories` require verified authentication and
application administrator access. Express owns authorization; the database table
has RLS enabled and grants no Supabase browser-role access.

`services.category` references `categories.key`. Unknown categories cannot be
saved, and categories referenced by any service (including inactive services)
cannot be deleted. Reassign those services first. Renaming a category preserves
service associations and existing search keys.

## Database setup

Before starting the updated app against an existing database, run:

```powershell
npm run db:setup-categories
```

This applies `migrations/0005_categories.sql` transactionally. It seeds the three
original categories, preserves additional legacy category keys, adds the foreign
key and lookup index, and enables RLS. Existing service records remain unchanged.
It has been applied to the currently configured database. Rerunning setup keeps
administrator edits, but recreates missing original seed categories. On a fresh
database, run the reviewed `db:push` schema setup first, then this seed command.

Category names and search keywords are included when service embeddings are
generated. Existing embeddings keep their previous text until regenerated through
the existing provider embedding endpoints. Exact category filtering uses the
stable key and takes effect immediately. Catalog changes invalidate the current
browser's category query; other browsers pick them up on reload or a subsequent
mount once their 30-second cache is stale.

## Verification

- `npm run test:categories`: mocked administration CRUD, confirmation, failures,
  session/access revocation, public rendering, dynamic provider/search selectors,
  route permissions, validation, and safe error responses.
- `npm run test:categories-db`: real PostgreSQL migration/idempotency, legacy data
  preservation, unique names, foreign keys, CRUD, and browser-role restrictions.
  Test writes use temporary tables on one pinned database connection.
- Existing administration, guest search, provider navigation, provider catalog,
  and search sorting regressions cover the affected screens.

For a manual check, sign in as an application administrator, open Categories,
add a category, select it in a provider listing, and find it through search. Rename
it and verify its service remains linked. Deleting it should fail until all linked
services have been reassigned. A regular account should have no category
management access.
