# Remembered location and nearby search

Prepared 23 October 2026. The user selected **option A** in this conversation.
Local implementation and an additive migration are prepared; no migration has
been applied. See [the implementation handoff](search-remembered-location-handoff.md) for
verification and the remaining release gates, including TASK-025.

After read-only preflight, the user selected coordinated next-step A. The
[database package](search-location-database-package.md) records the prepared
server-only grants/policy, preserved audit foundation, required installation order
and offline evidence. This supersedes the original schema outline's privilege
detail for future execution; no database migration or deployment is implied.

## Requested behavior and authority

The user accepted the proposed location-first search: default radius 25 km,
choose current location or enter a town/address, wait for a resolved location
before requesting services, and show up to 50 nearest matching services within
the radius. The user also requested remembering the selected location in the
registered user's profile or a cookie for guests, without asking on each return.
Nearest means straight-line distance. Do not automatically expand the radius.

Approving party: user in this conversation. Executor: Codex `/root`.
The request covers local frontend/backend implementation for this search flow,
location preference handling and meaningful offline/mocked verification.
The user selected A and authorized local implementation and migration preparation
on 23 October 2026. It does not authorize live database access, migration execution, persistent API/browser
tests, Google API calls, infrastructure changes or deployment. Preserve the
existing deployment hold and unrelated working-tree changes.

## Repository findings

- `client/src/pages/home.tsx` initializes radius 50 and immediately queries
  `/api/services/search` with no location. Device location uses browser
  geolocation; typed addresses use the Google JavaScript geocoder.
- `server/storage.ts` filters by coordinates/radius and orders by distance when
  coordinates are supplied, but public search rejects more than 500 matches.
- `shared/schema.ts` has no saved search-location preference on `users`.
- `shared/provider.ts` spreads the application user row into public provider
  responses. Adding private fields to that row requires explicit public-response
  exclusions and regression coverage.
- Provider workspace addresses in `addresses` are public service locations and
  must not be reused for a seeker's private search preference.

These are repository observations, not verified live database state.

## Storage options

**A — Recommended: private preference row linked to the profile.** Add
`user_search_locations`, at most one row per user. Only a verified account-owner
endpoint reads/writes it. It is logically part of the profile and follows the
user across devices, without joining it into public provider responses.
Tradeoff: one small table and a separate private read. No changes to existing
user rows or public provider contracts are needed for storage.

**B — Not selected: nullable fields on the existing `users` profile.** Add source, label,
coordinates and place ID to `users`, with equivalent validation and deletion.
Tradeoff: fewer separate reads, but couples private location to shared user types
and requires reviewing/redacting every public/admin serialization of that row.
Adding columns also changes an existing table rather than creating a new one.

Both options require a reviewed additive migration and ORM definitions. Existing
users have no saved location initially; there is no backfill or data correction.
The table option avoids an existing-table rewrite; its foreign key still needs
normal migration lock planning. Live timing/lock behavior has not been measured.
No indexes/extensions beyond the one-row-per-user primary key are proposed.

## Proposed persistence contract

- Registered: store in the private profile-linked row until changed, forgotten,
  or the account is deleted. Fetch only through authenticated owner-scoped
  `GET /api/account/search-location`; update with `PUT`, forget with `DELETE`.
  Derive the user ID from verified identity, never request body input.
- Guest: store the same bounded, versioned preference in a host-only cookie for
  180 days, with `SameSite=Lax`, `Path=/`, and `Secure` over HTTPS. Treat cookie
  content as untrusted, validate it, and never use it for authorization. It is a
  frontend-readable functional preference; it contains no authentication token.
  Enforce an encoded-size cap below browser cookie limits.
- Store only the latest selected location, not location history. A device
  selection stores its coordinates and a localized presentation label is derived
  at render time. Do not reverse-geocode a device location just for its label.
- The first selection offers an unchecked, explicit remember choice. Without
  that choice the location is used for this visit only. Restored preferences
  retain the remember choice. Resetting search filters keeps the chosen location;
  Forget location removes it. TASK-025 must review/capture the permission and
  consent evidence before release; this UI alone is not consent-audit coverage.
- A typed selection stores the user's original text and optional Google place ID.
  Do not persist Google's formatted address or geocoded coordinates in this
  first implementation. Keep resolved coordinates in page memory and reuse them
  while filters change. Resolve the saved place ID/text once on a new visit,
  without asking the user to type again. This can incur a geocoding request on
  return. Retained Google coordinate caching would be a separate design choice.
- Google documents storage restrictions and a place-ID exception in its
  [geocoding policy](https://developers.google.com/maps/documentation/geocoding/policies).
  Applicable agreement/EEA terms must govern any future persistent Google cache;
  no billing jurisdiction or extended-storage permission is assumed here.
- Use the saved device coordinates on return; do not silently track a moving
  user or trigger repeated browser permission requests. Show that this is the
  saved location and provide explicit update/change/forget controls.
- If a profile preference exists, it wins over the guest cookie. If it does not,
  adopt a valid guest selection for the signed-in account using an atomic
  insert-if-absent, so a concurrent profile selection wins, and clear the guest
  cookie only after successful persistence. A failed read is not a missing row.
  Clear the guest preference after login so logout does not reveal the account's
  saved selection; never copy a profile preference into an anonymous cookie.
- Wait for authentication/preference resolution before searching. Reset private
  location state on account changes/logout and ignore stale in-flight responses.
  Clear/invalid/expired/missing guest cookies return to location choice. Cookie
  deletion/blocking cannot support cross-visit guest persistence.
- Save failures must be visible; searching may continue with the chosen location
  for the current page without claiming it was remembered.
- Do not log raw location labels, coordinates or cookies. Keep preference data
  out of public provider payloads and audit payloads; any required audit event
  records only safe action metadata. Keep owner responses `Cache-Control: no-store`.
  Validate origin/CSRF protection for cookie-authenticated write endpoints and
  bound input length, coordinate ranges and request rates.

## Location permission and consent audit

**TASK-025**, added at the user's request on 23 October 2026 in
[the Audit backlog](../TASKS.md#audit). This is required delivery scope for the
location feature, not implemented audit coverage. A was subsequently selected;
that choice does not mark TASK-025 complete.

Record current-location permission evidence for registered users and guests.
Keep three facts separate: the user's explicit app action, the browser permission
state/result the app observes, and the user's choice to persist a location in
their profile or guest cookie. A click alone must not generate a granted event.
Previously granted permission, successful location retrieval and a newly made
permission choice are different observations. Do not infer a new grant on return
visits, saved-location restoration or login migration.

Propose versioned event names and allowlisted fields through TASK-013's catalog
before implementation. Cover use requested, permission observed, remember choice
recorded/changed, and explicit withdrawal/forget outcomes. The backend stamps
receipt time and records verified account identity when available; guest
correlation needs a purpose/retention decision without persistent fingerprinting.
Include operation/event IDs, purpose, notice/consent-text version and language,
storage scope and bounded result/evidence-source enums. Distinguish a client
observation time from the authoritative server receipt time. Browser observations
are client-reported evidence, not proof that the server independently witnessed
the browser/OS permission dialog. Never copy coordinates, addresses, place IDs,
cookie/session values, browser payloads or raw IP/user-agent into audit records.

Browser permission may already exist, expire or be revoked outside the app;
observe changes where supported and document unobservable periods. A denied
geolocation operation may reflect browser/policy settings rather than a newly
clicked refusal. Timeouts/unavailable GPS are separate failures, not denials.
An explicit app withdrawal/forget must stop the affected use/storage and remove
the saved preference/cookie as applicable; audit evidence follows its separately
reviewed retention policy. Explain how to revoke browser permission because the
app cannot promise to reset the browser's permission itself. The
[W3C geolocation specification](https://www.w3.org/TR/geolocation/)
describes permission lifetimes and location privacy considerations.

Use TASK-014's durable capture/delivery with validation, bounds, rate limiting,
idempotency and privacy-safe retry handling. Determine whether an evidence
receipt is required before processing/persistence, and test the failure path;
do not claim consent was recorded until durable capture succeeds. Validate guest
report handling without creating authenticated identity or trusting supplied
user IDs. Coordinate separate, truthful committed preference-change events.

Before release, qualified privacy/legal review must settle applicable lawful
basis, necessary disclosures, whether/where separate consent is required for use
and storage, guest-cookie treatment, withdrawal and evidence retention/access/
deletion. A browser grant is not assumed to establish every required consent.
The [EDPB consent guidelines](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf)
discuss demonstrating and withdrawing consent without excessive evidence
collection. Adding audit records does not itself establish full legal compliance.

Acceptance: mocked fresh/already-granted/denied states, geolocation failure,
revocation observation limits, withdrawal/forget, separate remember choice,
guest/login/account isolation, forged reports, duplicate delivery, retries and
audit-outage behavior; verify no sensitive location data reaches audit or public
responses. Front End Developer owns browser/UI checks; Back End Developer owns
capture/unit tests; DB Analyst owns user-selected database changes. Restrict fresh
locale checks to en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
No new implementation, schema execution or deployment approval is implied.

## Reviewable schema outline for option A

This SQL is a proposal only, not a migration to run. The implementation must
follow the chosen option and inspect the authorized target before execution.

```sql
CREATE TABLE public.user_search_locations (
  user_id varchar PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  source varchar NOT NULL CHECK (source IN ('device', 'address')),
  input_text varchar(300),
  place_id varchar(512),
  latitude double precision,
  longitude double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_location_shape CHECK (
    (source = 'device'
      AND input_text IS NULL AND place_id IS NULL
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180)
    OR
    (source = 'address'
      AND input_text IS NOT NULL AND length(trim(input_text)) BETWEEN 1 AND 300
      AND latitude IS NULL AND longitude IS NULL
      AND (place_id IS NULL OR length(trim(place_id)) > 0))
  )
);
ALTER TABLE public.user_search_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_search_locations FROM PUBLIC, anon, authenticated;
```

Use the existing backend database access model and explicit owner predicates.
No direct browser/Supabase table access or new privileged grants are proposed.
Confirm the actual application DB role privileges during authorized migration
preparation/execution; repository schema is not evidence of deployed grants.

## Search change

Use location plus radius 25 by default. Return at most 50 after applying relevant
filters and distance ordering, with stable tie breakers. Filtering must precede
the final cap: existing availability checks occur after candidate loading and
must not cause nearer unavailable services to hide later matching services.
Do not simply slice the browser response or globally change limits for provider
catalogs/storefronts. Preserve their separate contracts and bound expensive
availability/semantic work. Define honest truncation/too-broad feedback for paths
that cannot safely establish the complete matching set.

## Validation and recovery

Offline tests must cover first visit, device/typed selection, returning guest,
returning account, account precedence, guest adoption, logout/account switching,
invalid/oversized cookies, geocoder failure, denied GPS, save/read failure,
forget/change/update, and nearest-50 ordering/filter semantics. Verify that
private locations cannot appear in public service/provider responses or logs.
Use synthetic coordinates, mocked APIs/geolocation/storage, and isolated caches.
Inspect runners before executing; test only en/lv/ru. Arabic/RTL, zh, fr, de, hi,
ja, pt and es are deferred, with supported translations preserved.

Prepare the additive migration before deploying code that queries the new table.
Perform live schema/grant verification and migration execution only after explicit
target/environment approval. No production/service changes are part of this
proposal. Recovery: revert feature code first; retain the unused private table
while investigating. Dropping it deletes saved preferences and needs explicit
approval. Guest cookies can be version-invalidated/cleared by feature recovery.

The original preparation was documentation-only. Subsequent local implementation
uses mocked verification recorded in [the handoff](search-remembered-location-handoff.md).
