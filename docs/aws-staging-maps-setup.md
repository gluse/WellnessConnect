# TASK-036 Maps configuration diagnosis — 6 November 2026

User asks what is needed for Google Maps on AWS after “The map could not load”.
Root performed read-only repository/current-service review. Deployed version4
has no nonempty GOOGLE_MAPS_API_KEY or GOOGLE_GEOCODING_API_KEY in app environment.
No credential value was printed/read from general `.env`; private IDE selections
are not used as configuration authorization. No Maps request, Google Cloud change,
app/database write or deployment was performed in this diagnosis.

Immediate cause: GET `/api/config/maps` returns the runtime browser key or empty
string; client loader rejects an empty key before loading Google. Local `.env`
does not populate AWS runtime variables. The initial staging allowlist deliberately
excluded optional Maps inputs; its deploy helper currently needs optional-key
support before being used for Maps provisioning on a future fresh deployment.

Required setup:

- Google Cloud project with billing and Maps JavaScript API enabled. Enable
  Geocoding API for this app's browser address lookup too.
- Browser key with Websites application restriction and API restrictions for
  actual used Maps/Geocoding APIs. Add exact staging website pattern:
  `https://fitsmytime-staging.d23y0j7mb3r92.eu-north-1.cs.amazonlightsail.com/*`.
  Preserve separately needed localhost entries; do not remove restrictions.
- App runtime GOOGLE_MAPS_API_KEY set securely to that browser key; controlled
  staging restart preserving all live app/gateway/worker configuration/secret and
  the existing DB stop-before-start limit. No frontend rebuild needed for this
  runtime endpoint.
- Gateway currently sends Referrer-Policy:no-referrer. This suppresses browser
  referrers; Google's docs say referrer-policy can affect website-key acceptance.
  Compatibility issue is an inference from that documented contract, not a live
  Google rejection test (no browser key is configured yet). Recommend an origin-
  only cross-origin policy such as strict-origin-when-cross-origin, reviewed and
  tested as infrastructure before publication. This is a proposed change only.
- Backend service-address registration additionally uses GOOGLE_GEOCODING_API_KEY.
  Keep a separate server-only Geocoding key with appropriate outbound-IP/API
  restrictions; do not use a website-restricted browser key as server credential.
  Lightsail container egress stability/restriction design needs verification
  before promising an IP-allowlisted server key. This is separate from map display.

After configuration, verify Maps rendering and browser console errors under the
frontend owner (en/lv/ru only); external Google Maps calls can incur Google charges.
No claim of enabled billing/APIs, correct live key restrictions or working map
was established by this read-only check. Existing staging protection remains.

Primary current guidance:
[Maps troubleshooting](https://developers.google.com/maps/documentation/javascript/troubleshooting),
[key security/referrers](https://developers.google.com/maps/api-security-best-practices),
[browser geocoding](https://developers.google.com/maps/documentation/javascript/geocoding).
