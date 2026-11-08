# Map view requires a location — 6 November 2026

Status: completed / verified locally. Not deployed.

Originating request: “do not allow to switch to map view before you have selected
location.” Requester/coordinator: `/root`. Assigned Front End Developer/executor:
`/root/map_location_frontend`, accepted through live agent tools under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: `client/src/pages/home.tsx`, focused mocked browser regression and this
handoff/queue entry. Environment: local repository and synthetic browser fixtures
only. No private configuration, connected services/database writes, spending,
backend/database changes or deployment authorized or performed.

Map is a native disabled button until an applied, resolved location exists.
Typing an address does not enable it; successful manual, current-device or saved
location selection does. The handler independently guards map entry. A derived
view returns immediately to List when location disappears, so GoogleMap cannot
render with an absent location, and the stored map choice resets so selecting a
new location does not automatically reopen Map. Grid/List remain available.
Existing button styling, accessible names, translations, Maps boundaries and
location privacy/remembering behavior are retained. No new text or dependencies.

Validation:

- `npm run check` passed.
- Isolated frontend Vite build passed with `configFile:false`, `envFile:false`,
  React plugin and existing aliases; output `output/map-location-build`.
  Existing Browserslist-age and bundle-size warnings remain. No environment files
  or privacy-policy plugin were loaded.
- `node --import tsx scripts/test-search-map-location-browser.mjs` passed with
  exit 0: six en/lv/ru phone/desktop cases in installed headless Chrome, no
  unexpected requests or runtime errors; teardown completed. Evidence:
  [Chrome results](search-map-location-chrome-evidence.json).
- `git diff --check` passed. Existing line-ending conversion warnings remain.

The default process sandbox prevented Chrome crashpad startup. The browser runner
used scoped process escalation; all network/API/Maps boundaries remained mocked.
An initial assertion exposed a fixture-only close-animation race; the runner now
waits for the existing animation-settle helper. One later run timed out evaluating
the browser during concurrent build/host slowdown. The final complete run after
the build finished passed; assertions were not weakened or skipped.

Browser boundaries are synthetic fetch/API responses, Maps classes, geolocation,
and guest cookies; unexpected network/runtime errors fail the runner. Checks
target en/lv/ru at 390px and 1280px: missing/typed/pending/failed location, native
disabled button and keyboard skip, Grid/List availability, manual/GPS selection,
location-chip removal, browse without location, forget, blank search, saved-device
restoration, and no automatic return to Map. No connected data is used. Physical
devices/screen readers and additional browser engines are not verified. Languages
ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred.

Security review: no new trust boundary, request, dependency or unsafe rendering;
the existing location validation/resolution contract supplies applied coordinates.
This is a presentation prerequisite and does not change API authorization.

Recovery: reverse only the task's `home.tsx` hunks and new test/docs/evidence,
preserving unrelated `TASKS.md` edits and pre-existing untracked build/cache files.
Next: root reviews the integrated result; user may review the local change.
