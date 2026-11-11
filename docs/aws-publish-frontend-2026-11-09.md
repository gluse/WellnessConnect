# AWS publication frontend acceptance — 9 November 2026

Status: current frontend production build, repository-wide TypeScript, focused
synthetic browser checks and scoped live replacement-service guest acceptance
pass. A minimal coordinated native-proof type correction resolved five earlier
type diagnostics. The existing full native-client proof still has a reproduced
baseline replay-assertion failure, detailed below; no full native-client or real
application-login acceptance is claimed. Root owns infrastructure release.

## Scope and ownership

The user requested publishing the app to AWS. Coordinator `/root` assigned
`/root/aws_publish_frontend` as Front End Developer under
[AGENTS.md standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
The owner accepted current-source production-build compatibility review and
focused isolated regression checks. The project frontend-practices skill and
Front End Developer role were read and applied. Source baseline was clean commit
`81b68e5`. This assignment includes no private dotenv access, connected database
or service operations, real login/session/application writes, email or OAuth.

The existing password-protected Lightsail staging selection in `eu-north-1`,
micro/one node, and public-release/activation holds are retained. Root owns
infrastructure, deployment and integration; application/database owner boundaries
remain in effect.

## Packaging review and delegation

The frontend uses the existing Vite React plugin and aliases. No `VITE_` or
`import.meta.env` use was found in `client/src`. The normal privacy-policy plugin
explicitly loads public policy settings from dotenv files, so the standalone
review build intentionally omits that plugin and disables Vite env loading.
Its successful result proves frontend compilation, not production privacy-policy
configuration.

The existing allowlisted Docker source snapshot excludes dotenv files, Git
history, dependency caches and private keys. The Docker build can therefore
reproduce the normal frontend/privacy-policy plugin compilation without those
local private inputs. The Front End Developer specifically delegates Root to
reproduce the frontend portion of the exact reviewed source-snapshot Docker build
using `deploy/aws/build-local.ps1` for this release. This delegation covers build
reproduction only; it grants no app startup, database, backend modification or
deployment authority. Root must validate the actual snapshot/manifest and image.

## Fresh checks

- `node output/aws-publish-frontend-2026-11-09/build.mjs`: passed, Vite 5.4.19,
  3,661 modules. `configFile:false`, `envFile:false`, a task-specific env prefix,
  existing aliases/React plugin, and separate build output avoid private settings
  and previous evidence. Existing stale Browserslist and large-chunk warnings
  remain; main JS is approximately 1,128 kB, 322 kB gzip, and the graph chunk is
  approximately 383 kB, 107 kB gzip.
- `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.settings-translations.json`:
  passed.
- `node --import tsx scripts/test-report-graph.mjs`: passed exact status/day and
  currency-separated totals, large valid aggregates, tiny amounts, stable service
  identities, zero-booking services and applied employee filtering.
- `node --import tsx scripts/test-service-view-statistics.mjs`: passed UTC bounds,
  exclusive Pro expiry, response scope/totals, stable ranking, exact bigint exports,
  spreadsheet-formula protection and scoped messages.
- `node --import tsx scripts/test-account-settings-auth-return.mjs`: passed 45
  allowed/rejected return-destination cases, without app/database imports.
- `node --import tsx scripts/test-account-details.mjs --frontend-only`: passed
  mocked profile normalization/validation, failed-save retention, independent
  saves and expired-session redirect. The backend section was not loaded.
- Chrome Settings regression: passed four behavior groups and 12 locale/viewport
  form cases. Covers language-reactive labels, helpers, canonical values, unsaved
  drafts, pending/success/error receipts, synthetic employee operations, empty,
  loading, failed, denied/team and not-found states, control names and reflow.
- Chrome Reports graphs: passed exact data, applied employee filters, separate
  currency panels/status patterns, keyboard/click exact values, List return,
  numeric CSV, long-name/zero/empty states and bounded chart scrolling.
- Chrome Service view statistics: passed discoverable Free lock, Pro execution,
  exact counts, employee/date filters, List/Graph, numeric CSV/XLSX/PDF, unavailable,
  error/empty states, expiry/revocation and late old-workspace response isolation.

All browser matrices use **en/lv/ru at 320/390/768/1280 CSS pixels**. The existing
runners were inspected before use. Task-local runner copies change only the
harness import, artifact paths and Settings evidence date, preserving all
assertions and earlier artifacts. They use actual frontend components with
synthetic in-memory APIs and block external network. No connected writes occurred.
Chrome's sandbox crashpad child failed to launch; the same scoped synthetic
commands passed after automatic review allowed execution outside the sandbox.

Evidence and runner copies are under
`output/aws-publish-frontend-2026-11-09/`. Owner visually inspected the new Latvian
phone Settings screenshot, phone named-service graph and phone Service views
report. Text/controls fit; graphs retain visible scale/data disclosure and reports
retain explicit measurement/coverage wording. Firefox/WebKit, physical devices,
assistive technology and successful live account/OAuth flows are unverified.
Arabic/RTL, Chinese, French, German, Hindi, Japanese, Portuguese and Spanish
verification remains deferred; supported translations and historical evidence
are preserved.

## Coordinated native TypeScript correction and verification

`node node_modules/typescript/bin/tsc --incremental false` exits 1 on the same five
diagnostics recorded by the prior Settings handoff:

- TS2802: `client/src/native/client.ts:24,83`, iterator spread under the current
  implicit legacy TypeScript target.
- TS2322: `client/src/native/client.ts:34`, `displayName` remains typed unknown
  after the conditional equality check.
- TS2802: `server/native-proof/service.ts:88,89`, Map iteration under that target.

Those native files were introduced in earlier commit `9ff45f9`. Root specifically
authorized minimal frontend corrections after reviewing the failed gate and asked
Backend to correct its separate file. Frontend replaced the two URLSearchParams
iterator spreads with `Array.from` and explicitly narrows `displayName` to string
before returning it. Accepted synthetic-user values and exact query validation
remain unchanged; no configuration, protocol, target or TypeScript compiler option
was broadened. Backend separately changed its two Map loop inputs to `Array.from`.

After both owner changes,
`node node_modules/typescript/bin/tsc --incremental false` passes repository-wide.
The final isolated Vite build also passes again with identical output hashes and
the same existing warnings. Scoped diff/whitespace checks pass.

`node --import tsx output/aws-publish-frontend-2026-11-09/native-type-compatibility.mjs`
passes exact callback/query acceptance, duplicate/extra query rejection, allowed
synthetic users, nonstring/altered/secret-bearing user rejection and browser
attempt/query binding. No network/app/database or native bridge is exercised.
Backend reports all 14 existing native-auth proof scenario groups passed; its
separate [owner handoff](aws-publish-backend-2026-11-09.md) records that evidence.

The existing `node --import tsx scripts/test-native-client-proof.mjs` passes its
first two origin/path/callback validation groups, then fails its existing replay
assertion: the JavaScript simulation adapter has cleared its verifier after a
successful exchange, and submitting the replay sends an undefined verifier.
The backend returns `invalid_request`, normalized by the existing client to
`unavailable`, while the test expects `invalid_handoff`. Running the identical
test against the committed `81b68e5` client source reproduces the same failure.
The isolated baseline source/test and exact output are preserved under this
task's output directory, including `native-client-baseline-result.txt` and
`prove-native-baseline.mjs`. This was not caused by the type correction. Root
explicitly directed preserving this evidence and leaving unrelated synthetic
adapter/error semantics unchanged. No assertion was weakened/skipped and no
full native-client, native-device or credential-store acceptance is claimed.

## Recovery and next action

Revert only the three attributed expression changes in
`client/src/native/client.ts` and this task's new report/output artifacts if
needed; Backend owns recovery of its separate two-loop change. Preserve all prior
evidence and unrelated files. No data recovery is required. Root coordinates
exact image packaging, database compatibility and AWS release. Live guest
read-only browser acceptance is a later
assignment after the exact candidate is ACTIVE; this report does not authorize
real account writes, failed-login attempts, OAuth or provider callbacks.

## Replacement service guest acceptance preparation

The user subsequently approved replacement service `fitsmytime-staging-20261109`
and cleanup of the old service after the replacement passes acceptance. Root
reused this Front End Developer for scoped read-only guest browser verification.
Root owns provisioning, protected credential handoff, exact candidate health and
the eventual cleanup; this frontend assignment does not execute those operations.

The existing `scripts/test-aws-staging-guest-browser.mjs` now accepts the explicit
`--replacement-20261109` preset after its mandatory active/gateway proof flag.
The preset pins the new service's HTTPS Stockholm hostname, reads only
`.env.aws-staging-access-20261109.local` and writes separate evidence under
`outputs/aws-staging-build/live-frontend-20261109/`, dated 9 November. Without the
preset, the old origin/access/evidence selection remains unchanged. Arbitrary
target/file/output arguments are rejected. Existing API allowlisting, external
traffic/mutation blocking, isolated Chrome profile, exactly-one Basic challenge
and secure HttpOnly cookie assertions are preserved.

Preparation checks: Node syntax and scoped whitespace checks pass. No private
handoff was read and no browser or live request was started during preparation.
The command for the later explicitly released acceptance is:

```text
node scripts/test-aws-staging-guest-browser.mjs --active-gateway-verified --replacement-20261109
```

Execution waits for Root's report that the exact new candidate is ACTIVE with
independent gateway/readiness/audit-health acceptance. Scope remains en/lv/ru
320/390/1280 guest login rendering, landing/category reads, browser challenge,
cookie and phone/desktop visual checks, without submitting login/OAuth or any
POST/write. The runner currently navigates login and landing only; it does not
claim a separate storefront-record/details flow. Later live evidence must be
recorded separately; preparation is not a passing live verification.

## Replacement live result

Root released the live check after reporting replacement deployment 1
ACTIVE/RUNNING with no pending deployment, all three containers using exact image
`:fitsmytime-staging-20261109.app.4`, independent HTTPS/password restriction,
sanitized readiness, cookie/tamper/app-401 checks and current audit delivery
acceptance. Root also reported the old service absent. This frontend owner did
not provision/delete resources, inspect secret-bearing AWS responses or change
runtime settings. The sole private read in the smoke was the new protected access
handoff, whose origin is validated before any browser authentication.

The first live run exited 1 with `LANDING_NOT_RENDERED`, zero runtime errors and
one blocked request. All six login screenshots had already been captured.
Read-only source diagnosis proved `App.tsx` routes both `/` and `/search` to
`Home`; the historical smoke expected buttons from the unused `Landing` component.
Current `fetchPublicSearch` also uses
`GET /api/services/search/page?limit=24&sort=default`, absent from the historical
smoke's API allowlist. This precise request was derived from source; the first
failed process had not persisted its blocked-path trace. Its command/result and
all six original screenshots are preserved in
`outputs/aws-staging-build/live-frontend-20261109/initial-stale-run/`.

Root explicitly accepted a test-only contract correction and a distinct check
after that diagnosis. The replacement preset now allows only that exact default
search path/query in addition to the four existing named read APIs; semantic
search, other search parameters, tracking POSTs, mutation methods and external
traffic remain blocked. It verifies the actual query/location/search labels,
settled result-or-empty state, default disabled Map without a location request,
exact local `/login?returnTo=%2Fsearch` destination and responsive reflow. The
historical default branch is retained. Failure evidence now persists sanitized
method/path/status traces; no credentials, cookie values, headers or response
bodies are saved. Node syntax and scoped whitespace checks pass. No application
source or deployed image changed for this test correction.

The distinct corrected command then exited 0 on 9 November:

```text
node scripts/test-aws-staging-guest-browser.mjs --active-gateway-verified --replacement-20261109
```

Chrome 156.0.8078.80, isolated headless Windows profile. Nine en/lv/ru login cases
at 320/390/1280 passed live language switching, translated headings, labels,
document language/direction and reflow; fields are at least 250 CSS pixels wide
at 320. Keyboard focus and empty native form validation passed without submitting
authentication. `/` opens working guest search directly, default public search
and categories returned 200, required controls and settled results-or-empty state
rendered without overflow at all three widths, and the login link stayed local.
Guest auth-user 401 is expected. Exactly one initial Basic challenge occurred
across all page/resource/API reads. The gateway session was Secure, HttpOnly,
SameSite=Lax, Path=/ and absent from `document.cookie`. No browser runtime errors,
blocked/unexpected requests or mutation requests occurred.

The owner inspected all six final en/lv/ru login screenshots at 390 phone and
1280 desktop; headings, options, labels, fields and actions are readable and
uncut. The 320 reflow is programmatic. Provider sign-in buttons are visible but
were not clicked. No real app login, OAuth, email, signup, service-details tracking,
booking, business write or separate storefront-record flow was attempted. No
physical-device, other-engine, screen-reader, linguistic-certification or WCAG
conformance claim is made. Other language/RTL testing remains deferred.

Final filtered evidence:
`outputs/aws-staging-build/live-frontend-20261109/evidence.json`, SHA256
`515A761F3B0C089CEC2F69809E5A4F573461B818CAD925649E819E935E1A0B28`,
plus six `login-{en,lv,ru}-{phone,desktop}.png` files. Historical previous-service
captures and the initial failed-run archive remain intact. The test closed its
browser and removed only its verified temporary profile. Root owns release
acceptance, old-service cleanup evidence and the separately reported inherited
audit-quarantine warning; this frontend smoke does not diagnose historical audit
records or establish remote Supabase callback allowlisting.
