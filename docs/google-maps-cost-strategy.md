# Google Maps cost-saving strategy

Prepared 23 October 2026 from the current working tree and Google's public
documentation. This is a proposal, not implementation or measured savings.
No cloud billing account, live database or paid Maps API was accessed.

## Recommendation

Prioritize deliberate map opening, avoiding map recreation, and avoiding
unnecessary geocoding. Add location grouping for usability. Limit zoom for a
clear search experience, but do not count it as a direct Dynamic Maps saving.
Do not build a Google tile/chunk cache.

Recommended flow:

1. Choose current location or a town/address; resolve it once.
2. Search our service catalog and show the list, with the proposed 25 km radius
   and nearest 50 matching services from the [location plan](search-location-proposal.md).
3. Open the interactive map only after an explicit Map action and a valid location.
4. Reuse that map while changing filters, sorting, opening details and switching
   between list and map. Update markers and viewport without constructing a new map.

## What actually causes charges

For the current Maps JavaScript integration, map display/loading triggers the
Dynamic Maps SKU. Panning, zooming and adding markers to an existing map do not
create additional map loads. Geocoding and Places operations are separate from
the base map charge. Fewer HTTP tile requests or fewer markers are therefore not
the same as fewer billable events.
Sources: [Google Maps FAQ](https://developers.google.com/maps/faq#usage_mapload),
[JavaScript billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing).

## Findings in this repository

| Area | Current source behavior | Consequence |
| --- | --- | --- |
| Search page | [home.tsx](../client/src/pages/home.tsx) defaults to list view. A services query starts without a selected location. Map view can mount when services exist even if location is absent. | Keep the list default; add an explicit location requirement before the first map mount. An application search request itself is not a Google request. |
| Rendering lifecycle | The map is inside the successful-results branch and conditional on map view. Loading/error states and switching to list remove it. | A new map can be created after each search/filter load or list/map round trip. This is the strongest concrete avoidable-load finding. |
| Map component | [google-map.tsx](../client/src/components/google-map.tsx) constructs a Map on mount; marker changes within a mount reuse it. Each service gets a marker. | Preserve the existing within-mount reuse and extend component lifetime. Group services sharing a location. |
| Zoom | Initial zoom is 12; fit-to-results subsequently caps excessive zoom at 15. There is no persistent min/max zoom restriction. | The existing cap is not a universal zoom limit. Further restrictions are a UX choice. |
| Library loader | [google-maps.ts](../client/src/lib/google-maps.ts) shares configuration and imports geocoding separately from map libraries. | Library reuse does not preserve a Map instance or prevent later map-load charges. |
| Seeker geocoding | Typed locations are geocoded on Search, not every keystroke. The current resolved selection is reused while retained. Device location uses browser geolocation without reverse geocoding. | Preserve these savings; avoid introducing per-keystroke geocoding or lookups merely to show a location label. |
| Provider addresses | [registeredLocations.ts](../server/registeredLocations.ts) already checks a coordinate cache, uses a 29-day TTL, shares in-flight requests and locks identical lookups across app instances. | Preserve this mechanism; a second provider-address cache would duplicate existing work. This is source evidence, not verified deployed behavior. |
| Saved seeker location | [saved-search-location.ts](../client/src/lib/saved-search-location.ts) can resolve a saved place ID/text on restoration, but the reviewed Home does not use the new preference hook. | Do not assume cross-visit seeker reuse is already delivered. Coordinate with the location plan. |

## Prioritized measures

| Priority | Strategy | Expected effect | Tradeoff / implementation guidance |
| --- | --- | --- | --- |
| 1 | Require a resolved location and explicit Map action before creating the map. | Directly avoids unused or premature map loads. | Keep an accessible location prompt. Restoring a location must not automatically open the map. Keep list search usable if the map service fails. |
| 1 | Keep one map mounted after first opening for the search-page lifetime. | Directly avoids repeat loads on view switches and query changes. | Put loading/error feedback around the existing map rather than replacing its subtree. Hide it accessibly in list view; manage focus and layout when revealed. Do not create a hidden map before the first Map action. Clear private markers/state on account or location reset. |
| 1 | Resolve each chosen seeker location once; share identical in-flight resolution. | Avoids duplicate geocoding across submissions/components. | Filters, sorting, details and map clicks must reuse coordinates. Match all request inputs, including country/language bias when supplied. An ignored stale response may already have incurred a charge. |
| 1 | Restrict keys, set quotas and monitor each SKU. | Reduces abuse and bounds request volume. | Separate browser/server key restrictions and development/production usage. Enforce server rate limits where calls go through our backend; browser controls alone are bypassable. Keep list/GPS alternatives when quotas are exhausted. |
| 2 | Reuse permitted coordinates across visits with explicit expiry. | Can avoid repeat address geocoding on return. | Treat as a separate enhancement to the conservative saved-location plan; define provenance, deletion and private cache boundaries before persistence. A saved place ID alone still needs resolution to obtain coordinates. |
| 2 | Offer a locally searched, independently licensed town list. | Town selection can avoid Google geocoding entirely. | Store licensed centroids and local names; label results as town-centered rather than exact addresses. Keep Google lookup for street addresses. This needs a data-source/license and maintenance decision. |
| 2 | One marker per service location, then spatial clustering of nearby locations. | Improves clarity and rendering performance; does not directly reduce map-load charges. | A location marker can say “8 services” and open its service list. Group by stable location identity, with cautious coordinate fallback. Do not merge a provider's different branches. Cluster counts must say whether they count locations or services. |
| 2 | Keep straight-line distance sorting; open navigation externally on demand. | Avoids adding per-result Routes/Matrix calls. | Do not calculate road travel times for all 50 results. A Get directions action can use a Maps URL and let Google Maps handle navigation. |
| 3 | If viewport-driven search is added, use “Search this area.” | Bounds our search traffic and any future lookup work. | Panning alone should not trigger geocoding. Submit current bounds only on explicit action; cancel/ignore stale responses and avoid repeated identical searches. This is not a current pan-triggered cost defect. |
| 3 | Use one-location links/embeds where custom search interaction is unnecessary. | Can replace paid custom maps on simple location pages. | Keep the interactive custom map for grouped discovery results; simpler displays have fewer customization options. |

Google documents map-instance reuse, key restrictions and quotas as cost controls.
Budget alerts notify; they do not stop spending. Use quotas supported by each API
and recognize that quotas are request limits, not a guaranteed exact monthly
currency cap. [Cost management](https://developers.google.com/maps/billing-and-pricing/manage-costs).

For grouping, Google's [marker clustering guide](https://developers.google.com/maps/documentation/javascript/marker-clustering)
describes combining nearby pins. The proposed service/location grouping uses our
catalog and needs no Google Places search.

[Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
launch Google Maps without an API key. The
[Maps Embed API](https://developers.google.com/maps/documentation/embed/usage-and-billing)
is currently available at no charge, but it does not provide our custom React
result markers and interactions.

## Caching: distinguish three different things

**Google map imagery/tiles:** Do not intercept JavaScript map tiles into our CDN,
service worker, IndexedDB or an offline chunk store, or prefetch neighboring
areas. Google's terms restrict caching unless expressly permitted. Let the
Google client and normal HTTP handling manage its resources. Keeping an existing
map instance is the useful optimization for this integration.
[Terms, section 3.2.3](https://cloud.google.com/maps-platform/terms).

**Google lookup data:** Place IDs may be retained indefinitely, but are identifiers,
not coordinates. Current service terms permit temporary geocoding coordinate
caching for up to 30 consecutive days. Recommend a conservative maximum of 29
days from the original lookup, with deletion/expiry enforcement across every
copy; cache hits must not restart the clock. Do not turn this into an indefinite
shared address directory. Current terms contain additional narrowly conditioned
user-specific storage provisions; do not assume they authorize a shared cache
designed to replace paid lookups. Billing address and integration history affect
the applicable agreement. Confirm that agreement, including EEA map-display
restrictions, before changing persisted content or usage.
Sources: [Geocoding policy](https://developers.google.com/maps/documentation/geocoding/policies),
[service terms, section 6](https://cloud.google.com/maps-platform/terms/maps-service-terms),
[EEA service terms, section 6](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms).

**Our catalog and independently obtained location data:** Reuse service results,
provider-entered addresses, independently supplied coordinates and licensed town
data under our own freshness/privacy rules. Keep any Google-derived fields under
their original expiry and provenance. Browser/device coordinates are a different
source from Google's paid Geolocation API. Private seeker preferences must remain
isolated by user and be cleared on logout/account changes as required by the
[location plan](search-location-proposal.md). Fresh availability/prices still
need appropriate invalidation and revalidation before booking.

If caching whole search responses, key by actual filters, location, radius,
locale where relevant and access scope. Reusing catalog responses mainly saves
our backend work; it does not reduce Google billing if the UI recreates the map.
The current query client already disables focus refetch and uses infinite stale
time, so do not blindly extend caching without a freshness policy.

## Zoom, result limits and previews

- Keep the proposed 25 km search radius distinct from the map viewport. Show up
  to 50 nearest matching services after filtering; do not expand the radius
  silently or hide eligible services merely because the viewport changed.
- A trial zoom range around 8–17 could keep regional discovery usable, but tune
  it against real phone/desktop layouts and the 1–500 km radius controls. A wide
  radius may need a lower minimum zoom. This is not a promised API saving.
- Keeping the user's chosen viewport during filter changes is preferable to
  repeatedly fitting every pin. Recenter on explicit location changes or a
  “Show all results” action.
- Static Maps are cheaper per paid load than Dynamic Maps, but each preview is
  another billable request. Do not place 50 automatically loaded map thumbnails
  in the results list. A plain placeholder costs no Maps call; adding a static
  preview and then an interactive map can charge for both.
  [Static billing](https://developers.google.com/maps/documentation/maps-static/usage-and-billing),
  [pricing](https://developers.google.com/maps/billing-and-pricing/pricing).
- Keep typed search on submit initially. If autocomplete is introduced for UX,
  start around three characters and debounce roughly 350 ms, request only needed
  fields, and implement the applicable session-token/termination rules. Sessions
  are not a blanket free-requests promise; abandoned sessions incur per-request
  billing. Compare completed and abandoned flows before adopting it as a saving.
  [Autocomplete session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing).

## Savings illustration and measurement

Assume 20,000 monthly map-using search visits, averaging three map creations per
visit because of toggles/refetches. Reducing that to one changes 60,000 loads to
20,000: approximately 67% fewer events. Under current global pay-as-you-go Dynamic
Maps pricing, the first 10,000 monthly events are free and the next tier costs
USD 7 per 1,000. In this isolated example, map charges fall from USD 350 to USD 70,
saving USD 280/month. This excludes geocoding, other SKUs, taxes, negotiated plans
and other usage sharing the billing account's free allowance. These volumes are
assumptions, not app telemetry. [Pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

Measure map creations per map-using search visit, location-resolution attempts
by source, duplicate resolutions avoided, permitted-cache hit rate, lookup errors
and map-to-booking conversion. Record bounded action/source/outcome counters,
not addresses, coordinates, place IDs, cookie values or raw request URLs.
Compare application counters with Google SKU usage and finalized billing;
network-request counts alone cannot establish savings. Avoid increasing location
tracking merely to measure costs.

## Delivery boundaries and validation

Suggested first implementation slice: location-gated first opening, preserving
the map through list switches/search loading, and regression tests for duplicate
map creation. Then add location grouping and evaluate seeker-coordinate reuse
or a licensed town selector using measured volumes.

Frontend work belongs to the Front End Developer; server lookup/rate-limit work
belongs to the Back End Developer. Persistent cache/schema changes require the
user's database option selection and scoped DB authority. Quotas, key restrictions
and rollout need CI/CD coordination. This proposal adds no new implementation or
deployment approval; preserve the existing deployment hold.

Acceptance should include: zero Map constructions before location plus explicit
opening; one construction through filter loading/errors, list round trips and
detail dialogs; no extra geocoding for unchanged locations; correct grouping of
shared locations and separate branches; expired-cache rejection without extending
its lifetime; private-state isolation; and usable denied GPS/lookup/quota states.
Use offline mocked Maps/geolocation/storage first, with actual browser layout and
keyboard checks for the preserved hidden map. Test only en/lv/ru; ar including
RTL, zh, fr, de, hi, ja, pt and es remain deferred.

Preparation validation: source review, current official-source review and local
Markdown link/whitespace checks. No application tests were needed for this
documentation-only change, and no fresh browser or locale coverage is claimed.
Recovery is removal/revision of this proposal only, preserving other work.
