# Search current-location fix — 21 October 2026

## Follow-up: detected location now enables distance sorting

The user clarified that `http://localhost:5000/search` successfully fills Current
location, but Distance: Nearest first remains disabled. This identifies an
application-state issue: detection updated only `resolvedDraft`; sorting used
the applied `location`. The previous error-handling changes did not resolve it.

The user's clarification authorizes correcting that interaction within the
existing Front End Developer/local frontend assignment. Successful detection now
sets the applied location immediately, refreshes results with those coordinates
and the last applied query/filters, and enables both distance sorting options.
Unsubmitted query/filter drafts remain intact. The existing chosen sort remains;
removing the location disables distance sorting and restores the default sort.
Typed addresses still require Search. Success text now explains that distance
sorting is available, with translations maintained for all supported languages.

A new browser regression reproduced the reported disabled option before the
one-line state fix. The corrected regression also verifies actual nearest-first
order, the applied coordinate request, draft preservation, both distance options
and removal/reset. Earlier error-handling coverage remains. Browser and offline
sorting tests, public-search UI tests, application/fixture TypeScript checks and
the frontend production build passed. Browser coverage remains en/lv/ru only;
other languages and real-device verification remain deferred as detailed below.
No backend, database/session writes, paid geocoding, permission changes or
deployment operations were performed. APIs and location were synthetic.

Current evidence: [JSON](search-location-evidence.json). The earlier result is
retained as [initial evidence](search-location-initial-evidence.json). Earlier
search implementation/design records describe the original draft-until-Search
behavior and are superseded by this follow-up for the location icon only.
Recovery for this follow-up: remove the successful callback's `setLocation(target)`
and its explanatory comment, restore the previous `locationReady` messages and
reverse only the associated regression assertions; preserve all other work.

## Initial error-handling work (historical)

The user assigned this task to the Front End Developer: fix the current-location
icon on `/search`. They reported that Search services changes to Getting location
with no page network traffic. Executor: `/root`, assigned Front End Developer.
Environment: local repository. Approved operations: focused frontend code,
translations, offline/mocked browser tests and local compilation. No backend,
database/session writes, real location permission, paid Maps calls, infrastructure
or deployment operations were performed. The existing deployment hold remains.

## Finding and change

The old handler used one native request with a 10-second acquisition timeout and
mapped every error to the same generic message. It had no overall deadline, so
waiting for browser permission/visibility could keep the form disabled indefinitely.
The user's exact browser/device cause was not verified. Browser geolocation is not
a page fetch, so absent page Network traffic alone does not diagnose failure.
The [W3C acquisition algorithm](https://www.w3.org/TR/geolocation/#request-a-position)
and [MDN API reference](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition)
were consulted on 21 October 2026.

`client/src/pages/home.tsx` now:

- Retries unavailable/timeout responses once using a fresh high-accuracy request
  with a 20-second native timeout. Permission denial is never retried automatically.
- Caps the entire operation at 35 seconds, including stalled permission callbacks.
  Clears the deadline on success/failure/unmount and ignores late responses.
- Explains insecure connections, unsupported browsers, blocked permission,
  unavailable position and timeout separately, using fixed translated messages.
  Synchronous device exceptions and invalid coordinates release the form safely.
- Announces pending status, associates feedback with the location control and
  button, and focuses errors. Failures retain the draft and applied results.
- Preserves explicit Search: detection sets the location draft; Search submits it.
  Does not introduce IP lookups, paid geocoding or automatic search requests.

The five error messages are maintained in all supported locale resources.
Only English, Latvian and Russian were tested. Arabic/RTL, Chinese, French,
German, Hindi, Japanese, Portuguese and Spanish verification remains deferred.
No independent native-language review was performed.

## Verification

Passed:

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.search-page.json`
- `node --import tsx scripts/test-public-search-ui.mjs`
- `node --import tsx scripts/test-search-location-browser.mjs`
- `node node_modules/vite/bin/vite.js build`
- Scoped `git diff --check` (existing line-ending notices only).

Chrome checks cover en/lv/ru, 1280px desktop and 390px phone viewports, error
focus/announcements/reflow, denied permission without retry, timeout/unavailable
recovery, synchronous failure, invalid coordinates, missing API/insecure context,
retained results/drafts, duplicate prevention, a real 35-second overall deadline,
late-callback rejection, locale changes during detection and explicit submission
of synthetic detected coordinates/radius. All APIs/geolocation were mocked;
external traffic and writes were blocked. No unexpected requests/runtime errors.

Evidence: [JSON](search-location-evidence.json) and
[visually inspected permission-error screenshot](search-location-denied.png).
The existing browser fixture was extended with location outcomes/options. The
existing full search runner's denial-message assertion was updated, but that
broader runner was not rerun and its historical evidence was preserved.

The first Chrome launch failed because its crash handler cannot start inside the
sandbox. Automatic approval allowed the isolated test outside that process
sandbox. An initial test attempted a pointer click on a disabled button; the
harness correctly rejected it. The test now verifies the disabled control and
native disabled-click behavior; the complete corrected run passed.

Vite reports existing stale Browserslist data and a large bundle warning.
Real device location/provider behavior, browser and OS permission settings,
other browser engines, physical devices and screen readers remain unverified.
This fix cannot grant browser/OS permission or guarantee a device location fix.
Reload the page, allow location access when prompted, then select Search services
after detection. A timeout now points to the browser permission prompt and offers
manual city/address entry.

## Security, recovery and ownership

No raw device error text or coordinates are logged; permission is requested only
after the explicit location action. Coordinates remain in the existing in-memory
draft until Search. No new dependencies or security-policy changes. Scoped review
found no introduced unresolved security issue.

Recovery: reverse only this task's current-location handler/cleanup, pending
status and feedback associations, five localized error messages, fixture/test
changes and new `search-location-*` evidence/handoff files. Preserve prior
uncommitted search/forms/backend work; do not reset shared files or the worktree.
Next owner: Front End Developer for any follow-up based on the user's actual
browser/device result; CI/CD only after deployment is separately authorized.
