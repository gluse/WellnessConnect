# Registered service locations

Run `npm run db:setup-locations` before starting the updated backend, including
after `db:push` on a fresh installation. It adds location provenance, a private
coordinate cache and the PostgreSQL hourly cleanup job
`fitsmytime-geocoding-cleanup`. Setup is transactional and can be rerun. It fails
if `pg_cron` cannot be installed/scheduled, rather than leaving an unmanaged cache.
Use the database owner's connection; on Supabase, Cron can also be enabled under
Database integrations. See [Supabase Cron](https://supabase.com/docs/guides/cron/install).

## Registration and reuse

1. The editor and backend validate the address locally: 5–500 characters, at
   least one Unicode letter, no URLs, emails or control characters. This is a
   syntax check, not proof that an address exists. Rural/venue addresses need
   not contain a building number.
2. Verification first checks explicitly manual coordinates in the same personal
   or company workspace, then the unexpired shared Google coordinate cache.
   Address comparison normalizes Unicode, case, spaces and comma spacing;
   accents, building numbers and unit punctuation remain significant.
3. A cache miss calls Google's Geocoding API. Identical concurrent requests share
   the lookup in-process; a PostgreSQL transaction advisory lock prevents duplicate
   calls across app instances. Failed responses are not stored as successful results.
4. New Google results must contain one specific address/building/venue result,
   a Place ID, valid coordinates, no partial match, and `ROOFTOP` or
   `RANGE_INTERPOLATED` precision. Ambiguous, city, route and approximate matches
   require a more specific address or independently supplied manual coordinates.
   Interpolated results are approximate street positions, not guaranteed entrances.
   See [Google's response fields](https://developers.google.com/maps/documentation/geocoding/requests-geocoding#Results).
5. The service retains the provider's original address. Google formatted addresses,
   address components and raw responses are not newly persisted. The backend
   checks the cache against the submitted address and coordinates before saving
   Google provenance; clients cannot choose a new expiry or invent a Place ID.

Opening search, cards, catalogs, details, maps, bookings or the editor never
geocodes a registered service address. Address changes clear stale coordinates;
pending responses cannot overwrite a different address. Double clicks and
verification of an unchanged eligible location do not trigger another lookup.
Manual entry requires a complete, valid pair, including zero values; switching
from Google to manual entry clears the other coordinate so it is not silently retained.
Only workspace members with service-management permission can use the registration
endpoint. The unused public uncached `GET /api/geocode` shortcut has been removed;
customer location searches continue to use the browser geocoder on explicit search.

## Retention

The implementation uses a 29-day lifetime, beginning at the **original lookup**,
inside the temporary 30-day latitude/longitude allowance in
[Google's terms, section 6.3.1](https://cloud.google.com/maps-platform/terms/maps-service-terms#6.-geocoding-api)
and [EEA section 6.2.1](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms).
It does not rely on the separate indefinite, end-user-isolated exception for a
shared marketplace cache. Reuse, edits and service copies never extend expiry.
Place IDs may remain after coordinate deletion, as described in
[Google's geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies).

Expired Google coordinates are omitted from new API responses and server distance
filtering immediately. The browser clears expired query data and editor drafts
every minute without making network requests. The hourly database job physically clears the cache and
all service copies without needing the web process. Provider-entered addresses
and independently supplied manual coordinates remain. Coordinate expiry does
not call Google automatically: providers explicitly verify again to restore
their map location. Other search modes and booking history remain available.
Service, booking and registration API responses use `Cache-Control: no-store`
so HTTP caches do not retain additional copies outside these controls.

Monitor Supabase **Integrations > Cron > History** for job failures. The one-day
margin allows time to address failures. Application snapshots, database backups,
replicas and exports also need retention appropriate to their Google-derived
content; restoring a backup must run cleanup before exposing the app.

## Existing locations

The additive migration preserves unclassified legacy coordinates without treating
them as reusable or assuming a new lookup date. Only after the owner confirms
that they were Google-verified and supplies the original verification date, run:

```powershell
npm run db:mark-locations-verified -- --verified-at 2026-10-14T21:00:00.000Z
```

This timestamp is the start of **October 15, 2026 in Europe/Riga**, the confirmed
date for the current installation. It marks valid existing locations as verified
without contacting Google, using the earliest instant of that date so their
lifetime is not extended. It seeds reusable coordinates only where old records
agree about an address; original Place IDs and match-quality flags were not
recorded, so those remain unknown. No new quality check is claimed for this
owner-confirmed backfill. Later runs skip already-classified records.

The previous editor replaced typed addresses with Google's formatted addresses.
These legacy addresses are flagged separately and cleared with their expired
coordinates; providers should replace them with independently entered address
text. New registrations preserve the provider's input instead. Unclassified
legacy data in another deployment must be audited rather than assigning today's
date or automatically labeling it manual.

## Checks

`npm run test:geocoding` mocks Google and covers validation, response quality,
concurrency, reuse/expiry, trusted save metadata and editor races.
`npm run test:geocoding-db` checks the real PostgreSQL implementation and scheduled
job using connection-local temporary copies of application tables and sequences;
it never calls Google or changes customer data. Its cleanup test substitutes only
temporary table names into the migration's cleanup body.
