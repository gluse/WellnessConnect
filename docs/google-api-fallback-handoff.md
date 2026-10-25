# Google API fallback — TASK-027

Prepared 23 October 2026; standalone commit prepared 25 October 2026.
Approver: user, requesting the fallback and then its commit. Frontend owner:
`/root/maps_fallback_frontend`; coordinator and commit executor: `/root`.
Scope is reversible local frontend implementation, isolated mocked verification
and a local Git commit. No backend/schema changes, external provider, dependency,
private configuration, connected database/service execution or deployment.

## Committed behavior

The committed inline search flow keeps the service catalog accessible without
Google. **Browse without location** clears an unsuccessful address draft and
location filtering while retaining the service query and other filters. Radius
and distance controls are disabled without coordinates. Browser GPS still works
without Google; an unsuccessful replacement address preserves valid results.
Map errors offer **Show service list**. Configuration, script loading and geocoder
callbacks each have an eight-second deadline; late completion cannot initialize
a map after authentication failure or apply an expired geocoder result.

The earlier working-tree implementation integrates with separate remembered-
location and modal work. Those uncommitted prerequisites are excluded here.
This commit preserves the existing committed inline location flow and 50 km
default. The active working tree and its original evidence are retained.

## Verification

Validation runs against an archive of the parent commit with exactly the scoped
frontend candidates overlaid, using the existing installed dependencies. No
uncommitted location/auth/audit implementation or private environment is copied.
The loader and map lifecycle tests use mocked Google boundaries; the browser
fixture serves only static synthetic content with API, Maps and GPS mocks.

- `node --import tsx scripts/test-google-api-fallback.mjs`: passed configuration,
  library and geocoder-callback deadlines, abort, late-result isolation, explicit
  configuration retry and successful callback resolution.
- `node --import tsx scripts/test-map-lifecycle.mjs`: passed existing lifecycle
  behavior, map authentication failure, direct list action and late-load isolation.
- `node --import tsx scripts/test-public-search-ui.mjs`: passed the existing
  committed query/filter, validation, error/retry and cancellation regression.
- `npx tsc --noEmit`: passed.
- `node --import tsx scripts/test-google-api-fallback-browser.mjs`: passed four
  scenario groups and twelve en/lv/ru viewport cases (320, 390, 768 and 1280 px,
  including a short tablet viewport). Root visually reviewed the Russian phone
  screenshot. See [evidence](google-api-fallback-commit-browser-evidence.json),
  [English](google-api-fallback-commit-en.png),
  [Latvian](google-api-fallback-commit-lv.png) and
  [Russian](google-api-fallback-commit-ru.png).
  The first browser run passed its assertions but hit a transient Windows EBUSY
  error while deleting the temporary profile. One exact retry passed and exited
  zero, including cleanup; the existing browser harness is unchanged.
- Vite frontend build: passed (2,793 modules); existing old Browserslist data and
  large-chunk warnings remain.

Fresh language testing covers en/lv/ru only. ar/RTL, zh, fr, de, hi, ja, pt and es
are deferred; their two supported translation messages are maintained. Mocked
browser results do not establish live Google behavior, physical-device or screen-
reader coverage, native-language quality or deployment acceptance.

Recovery: revert only this scoped commit after reviewing subsequent work. Do not
discard the separate uncommitted location, audit, forms or coordination changes.
