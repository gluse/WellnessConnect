# Google API fallback — TASK-027 frontend handoff

Date: 23 October 2026. Owner/executor: assigned Front End Developer (`maps_fallback_frontend`). Accepted the scoped dependency from the coordinating agent under the user's request to implement a fallback and [AGENTS.md standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization). This authorizes reversible local frontend files and offline/mock verification only. No backend/database/infrastructure changes, connected service operations, credentials, new provider, dependency, deployment or publishing are included.

## Implemented behavior

- The initial location prompt retains its explicit opt-in contract. **Browse without location** is available immediately, including while a remembered address is still being restored. This is a session choice; it does not remove the saved guest/account preference.
- Browsing, submitting a query with no address, or applying filters without a location uses the existing public search endpoint without latitude/longitude/radius. Applied keyword/category/type/date/audience filters remain usable. Existing server result limits and truncation feedback apply.
- Radius controls and distance sorting/display are unavailable without a resolved location. An invalid unfinished radius cannot trap browsing behind a disabled field. GPS still uses browser coordinates directly and does not call Google.
- Failed address changes retain the existing valid location/results. Late remembered-address resolution cannot silently reactivate location after browsing was selected. Explicit restoration retry can restore location; failed preference-delete retry keeps browsing usable.
- Maps configuration and external library loading each settle within eight seconds; a hanging configuration fetch is aborted. Existing saved-address resolution has a fifteen-second overall deadline. Map error/auth-failure states offer **Show service list**, and late library completion after authentication failure cannot construct a map.
- Added two whole-message translations in every supported locale. These are draft translations; native-language review is not claimed.

## Files and recovery

Frontend: `client/src/pages/home.tsx`, `client/src/components/service-filters.tsx`, `client/src/components/google-map.tsx`, `client/src/lib/google-maps.ts`, and supported `translation.json` resources. Tests: dedicated fallback loader/browser runners, scoped map lifecycle regressions, saved-location browser expectations, and the existing static search fixture.

Recovery: reverse only this task's scoped hunks; preserve pre-existing uncommitted changes in the same files. No migration, persistent coordinate cache, external configuration or data recovery is necessary. Browser preference persistence is only exercised against synthetic cookie/in-memory API fixtures.

## Validation

- `node --import tsx scripts/test-google-api-fallback.mjs` — passed; missing/rejected configuration, fetch/script/geocoder deadlines, abort and late configuration, cleanup, explicit configuration recovery, all boundaries mocked.
- `node --import tsx scripts/test-map-lifecycle.mjs` — passed; existing map lifecycle plus pre-load authentication failure, direct list action and late-success isolation. Resource validation restricted to en/lv/ru before execution.
- `node --import tsx scripts/test-public-search-ui.mjs` — passed; query/filter draft isolation, validation/error/retry, cancellation, truncation and en/lv/ru.
- `node --import tsx scripts/test-guest-search.mjs --frontend-only` — passed; public UI and authenticated/guest booking components mocked. An earlier full-run attempt stopped at the existing backend audit configuration guard before pool creation. Its backend section was not validated and is outside this task; no connected database was accessed.
- `node --import tsx scripts/test-saved-search-location-browser.mjs` — passed all seven groups in isolated Chrome; remember/restore/adoption/account isolation, forget-to-catalog, failed preference writes and retry, late-account geocoder isolation, and en/lv/ru reflow. Updated obsolete forget-to-empty expectations; wait for closed dialog transitions before pointer interaction. Evidence: [JSON](google-api-fallback-saved-evidence.json) and [phone](google-api-fallback-saved-phone.png); historical artifacts preserved.
- `npx tsc --noEmit` — passed, including after the final retry-state edit.
- `npx vite build` — passed; existing old Browserslist data and large bundle warnings remain.
- `node --import tsx scripts/test-google-api-fallback-browser.mjs` — passed in installed headless Chrome: six scenario groups and twelve en/lv/ru viewport cases at 320, 390, 768 and 1280 pixels, including a short tablet viewport. Evidence: [JSON](google-api-fallback-browser-evidence.json), [English](google-api-fallback-en.png), [Latvian](google-api-fallback-lv.png), [Russian](google-api-fallback-ru.png). All API, preference, geocoding, GPS and Maps boundaries mocked; local static server only. Initial sandbox Chrome launch failed at crashpad startup; the scoped isolated browser run succeeded with escalation.

Security: no new data provider, credentials, external requests or unsafe HTML sinks; remembered addresses remain in the existing consent/persistence contract. Failed lookups do not substitute invented coordinates/distances or erase remembered location. This is a review of changed behavior, not a broader security audit.

Deferred by the user's language scope: ar (including RTL), zh, fr, de, hi, ja, pt and es. Historical evidence was preserved. Physical devices, screen readers, native-language quality and live Google outage behavior are not verified. No connected server or deployment was performed.
