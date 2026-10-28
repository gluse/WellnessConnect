# Search-location modal — 23 October 2026

## Assignment and authorization

User specifically requested replacing the illustrated search-location block with
a modal. Approver: user; executor: Codex `/root`, authorized for this frontend task.
Accepted scope: reversible local search-page React/CSS changes, related frontend
browser regressions and offline/mocked validation. No backend/database changes,
connected application execution, deployment or publishing are part of this work.
TASK-026's separate release gates and other sessions' work remain intact.

## Behavior and files

- `client/src/pages/home.tsx`: replaces the inline choice/privacy/error block
  with the existing Radix Dialog primitive. Opens after restoration when no
  location is available or persistence fails. A compact location summary and
  change/choose button reopen it. Contains GPS, typed address, optional remember,
  privacy link, retry and forget. Location-only submission preserves unfinished
  service-query/filter drafts. Successful selection/restoration closes it;
  address/GPS/persistence failures retain feedback. Close/Escape return focus to
  the location button; background interaction and keyboard focus are contained.
- `client/src/components/search-page.css`: bounded, scrollable phone/desktop
  modal, themed privacy panel, touch targets and reduced-motion styling.
- `scripts/test-search-location-modal-browser.mjs`: focused modal interaction,
  failure, keyboard and responsive coverage. Existing saved-location/search/GPS
  regressions now navigate or dismiss the modal and save distinct evidence names
  to preserve historical artifacts.

No new translations, dependencies, API contracts, permission requests on page
load, or persistence rules. Uses existing translated messages. Privacy link opens
separately so reading it does not discard the location draft. All user text remains
React-rendered; no new executable markup or credential/storage handling.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.
- `node --import tsx scripts/test-public-search-ui.mjs`: pass, mocked/offline.
- `node scripts/test-search-location-modal-browser.mjs`: pass, four groups and
  12 en/lv/ru viewport cases (320/390/768/1280), short viewport, 200% text,
  keyboard focus/Escape, address/GPS failures and restoration retry.
- `node scripts/test-saved-search-location-browser.mjs`: pass, seven groups;
  guest/account persistence, failure/retry, switching and late callback isolation.
- `node scripts/test-search-page-browser.mjs`: pass, five groups and 12 locale/
  viewport cases; query/filter drafts, results, sorting, errors, dialogs and reflow.
- `node scripts/test-search-location-browser.mjs`: pass, seven groups; en/lv/ru
  GPS failure/recovery, pending timeout, duplicate prevention and late callbacks.
- Frontend build: `node node_modules/vite/bin/vite.js build --mode
  location-modal-test --outDir ../output/location-modal-build --emptyOutDir false`:
  pass. Existing Browserslist-age and >500 kB chunk warnings remain.

Installed headless Chrome, isolated fixture only: fetch/account APIs, Google
geocoding and device geolocation mocked; no application server/database or paid
services. Browser startup initially failed inside the sandbox (Chrome crashpad
pipe); the same bounded tests ran successfully with approved tool escalation.
No automatic-approval rejection occurred. See `search-location-modal-evidence.json`,
`search-modal-saved-evidence.json`, `search-modal-regression-evidence.json`,
`search-modal-gps-evidence.json` and
the corresponding PNGs. Visually inspected English desktop, Russian dark phone
and restoration-error screenshots. Historical evidence was preserved.

Fresh testing is en/lv/ru only. ar (including RTL), zh, fr, de, hi, ja, pt and es
are deferred. Other browser engines, physical devices, screen readers and native
permission prompts were not tested. This UI work does not establish live feature
acceptance or lift the deployment hold.

Recovery: undo only this modal's attributable React/CSS/test/doc edits, preserving
the pre-existing remembered-location work and other working-tree changes. No data
or schema recovery is required.
