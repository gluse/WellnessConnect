# Account tabs redesign — 8 November 2026

Route guard follow-up, 8 November: user explicitly authorizes Frontend `/root`
to apply a provider auth guard to `/my-services/`. Accepted local implementation
and mocked verification scope: the shared MyServices entry guards the base route,
trailing slash and every descendant before mounting ProviderLayout. It waits for
authentication, sends signed-out/auth-failed users to the existing login return
destination and redirects any role other than exact `provider` to `/account#role`.
Redirects replace history and provider content is keyed by account identity.
Login redirects an existing cached user only when authentication has not failed;
this prevents an auth-error redirect loop back into the guarded route.
This supersedes the earlier visibility-only direct-route limit below. Existing
server endpoint authorization is unchanged. Verification passes:

- `node --import tsx scripts/test-provider-route-guard-browser.mjs`: actual App
  under isolated Chrome 156.0.8078.80, 6 behavior groups and 42 en/lv/ru denied-route
  cases. Base/trailing-slash, calendar/lists/services/new/edit/availability/reports/
  settings/pricing/addresses/unknown descendants redirect without provider feature
  fetches or writes. Covers unknown/missing roles, signed-out return destinations,
  pending authentication, role loss, initial/cached auth failures, provider access
  and logout. The cached-auth-error/login loop found during testing was fixed.
  [Evidence](provider-route-guard-chrome-evidence.json).
- `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.account-tabs.json`
  passes, including the updated login and MyServices modules.
- `node --import tsx scripts/test-social-auth.mjs --frontend-only` and
  `node --import tsx scripts/test-auth-return-routes.mjs` pass with mocked/pure
  frontend contracts; no backend/server/database modules are loaded.
- `git diff --check` passes. Only en/lv/ru tested; all other supported languages/
  RTL deferred. No connected operations/deployment. Full-project baseline limits
  documented below are retained; no new full-project, other-browser, physical-device
  or screen-reader coverage is claimed.
Recovery: revert only this follow-up's MyServices/login guard and fixture/test/config hunks.

Role visibility follow-up, 8 November: user specifically authorizes Frontend
`/root` to hide Calendar and My Services when `currentRole !== "provider"`.
Accepted local scope: desktop My Services link, mobile provider Calendar/menu/
workspace entries, role-change cleanup and offline mocked verification. Find
Services, My Bookings, wishlist and privacy links remain available. This is
frontend visibility; server authorization and direct route behavior are unchanged.
Mobile navigation remounts on role changes and remeasures content clearance so
open provider menus/workspace dialogs cannot persist after a role change.
Verification passes: `node --import tsx scripts/test-provider-navigation-visibility-browser.mjs`
uses the actual App with synthetic fetch mocks in Chrome 156.0.8078.80: 4 behavior
groups and 24 en/lv/ru role/viewport cases at 320/768/1024/1280px. Covers buyer and
provider navigation/menu entries, missing/unknown roles, live role changes,
workspace dialog dismissal without writes, bar clearance, the real Become Service
Provider action showing links immediately, working provider Calendar and logout.
Reviewed buyer desktop/mobile screenshots. [Evidence](provider-navigation-visibility-chrome-evidence.json).
Affected TypeScript passes via `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.account-tabs.json`;
`git diff --check` passes. No connected account/database/provider execution.
Only en/lv/ru tested; other supported languages/RTL deferred. Existing full-project
baseline failures remain as documented below; no fresh coverage is claimed for
Firefox/WebKit, physical devices, screen readers or native-language review.
Recovery: revert only this follow-up's navigation/fixture/test/config hunks.

Follow-up label request, 8 November: user specifically authorized Frontend `/root`
to rename the tab labels to General, Contact and Password; Role is retained.
Dedicated `accountTabs` translation keys keep section headings and form actions
unchanged. Updated supported translations. Existing isolated Chrome runner passes
11 behavior groups/66 en/lv/ru viewport cases; refreshed captures reviewed and
`git diff --check` passes. Other supported languages/RTL remain deferred.
Recovery: revert only these label
key references and their new resource keys.

Status: implemented locally; scoped verification passes. Project-wide checks
still have the baseline failures listed below. User's `/design Front End change` request assigns
Frontend executor `/root` to the account tabs, communication phone verification,
Role section and movement of pricing/saved addresses to My Services. Approval
covers reversible local frontend implementation, translations, offline/mocked
tests and documentation. No connected database/service execution, actual SMS,
private configuration, deployment or backend/database changes are included.

Reuse existing tabs, account settings components and authenticated APIs. Keep
server verification and provider activation authoritative. Preserve drafts between
account tabs, scope drafts to account/workspace, retain old hash destinations,
and report rejected saves without proceeding to dependent verification.

Implementation:

- `/account` uses the existing Radix tabs: Personal information, Communication
  preferences, Role and Update password. Only the selected panel is visible;
  mounted panels preserve unsaved drafts. URL hashes, keyboard arrows and browser
  history stay synchronized. Switching accounts remounts all private drafts.
- Phone verification is always visible beside an unverified phone (below it on
  phones), disabled honestly for empty numbers or an unavailable provider. A
  single explicit send action validates and saves a changed number, then requests
  the code. It saves only the phone, preserving other unsaved preferences. Failed
  saves stop the send. Duplicate/pending actions, late account responses, challenge
  expiry, cooldown, invalid codes and changed-number consent resets are covered.
  The international phone input is retained with a country-code example instead
  of introducing an incomplete country picker. Verification remains server-owned.
- Role is read-only and reflects the existing server role: User/buyer or Service
  provider. Become Service Provider calls the existing authenticated role API;
  successful activation offers My Services. Denied/error/expired-session responses
  do not optimistically grant the role.
- Pricing defaults and Saved addresses now live at
  `/my-services/settings/pricing` and `/my-services/settings/addresses`, behind
  existing workspace permissions. Existing components and workspace scoping are
  reused. Legacy account hashes redirect and service-editor address links use the
  new destination. Backend owner `/root/account_return_paths_backend` accepted and
  completed the exact sign-in return allowlist dependency; see
  [its scope and evidence](account-tabs-auth-return-handoff.md).
- Added supported translations and wrapping/touch-sized actions. Stronger active
  tab styling and inactive label contrast were verified in light/dark themes.
  Existing renderer tests now provide/clean up the animation frame APIs used by
  Radix tabs; their behavior assertions remain intact.

Passing validation:

- `node --import tsx scripts/test-account-tabs-browser.mjs`: Chrome
  156.0.8078.80, 11 behavior groups, 66 en/lv/ru viewport cases at 320×700,
  390×300, 768×900 and 1280×900; additional 200% text checks at 320px, keyboard
  selection, Back history, load/error/retry, role activation/expired sessions,
  verification and account/workspace isolation. Six light/dark communication-form
  contrast checks pass (minimum measured text 4.79:1, control border 4.19:1).
  [Machine-readable evidence](account-tabs-chrome-evidence.json).
  Reviewed [desktop](account-tabs-chrome-desktop.png),
  [phone communication](account-tabs-chrome-communication-phone.png) and
  [phone role](account-tabs-chrome-role-phone.png) captures. The sandbox could not
  launch Chrome Crashpad; the same isolated fixture passed with process escalation.
  APIs are in-memory synthetic mocks; no real authentication, data or SMS sends.
- `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.account-tabs.json`:
  affected application modules and fixture pass, including My Services and the
  service address link through their imports.
- `node --import tsx scripts/test-account-details.mjs --frontend-only`.
- `node --import tsx scripts/test-password-update.mjs --frontend-only`.
- `node --import tsx scripts/test-addresses.mjs --frontend-only`.
- `node --import tsx scripts/test-workspace-pricing-frontend.mjs`: en/lv/ru CAS,
  failure retention, permissions, duplicate actions and workspace resets pass.
- `node --import tsx scripts/test-notifications-frontend.mjs`: en/lv/ru resources
  and existing notification frontend regressions pass.
- `node --import tsx scripts/test-account-settings-auth-return.mjs`: 45 pure
  routing checks; independently rerun after Backend delivery.
- Full frontend JavaScript bundle via esbuild `build` with
  `entryPoints: ['client/src/main.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }`
  passes. Browser fixture separately builds the Tailwind/form CSS. No Vite private
  environment loading, connected app startup or production output is needed.
- Final `git diff --check` passes.

Baseline failures / limits:

- `npm run check` reports TS2322 at `client/src/native/client.ts:34`: unknown is
  not assignable to string. That file is byte-equivalent to HEAD after line-ending
  normalization. The same diagnostic reproduces when type-checking only that
  native entry with strict TypeScript options. The affected account/provider
  TypeScript check above passes; the full-project check remains failed.
- `node --import tsx scripts/test-provider-navigation.mjs` fails at its existing
  failed-service-save expectation (line 125). Reproduced by bundling the HEAD test
  and HEAD versions of both changed provider modules (settings and address link),
  preserving unrelated current workspace work. Its service fixture omits the now
  required currency. A temporary corrected fixture progressed to another existing
  failed-workspace-switch assertion; those diagnostic edits were removed. This
  task leaves that runner unchanged. New settings routes and permissions have the
  dedicated passing browser coverage above. The broader regression remains failed.
- No fresh Firefox/WebKit tooling was available at the previously recorded local
  paths. Physical devices, screen readers, native-language review, real SMS
  verification and live role/database writes are unverified. No deployment.
- Only en/lv/ru were tested. ar/RTL, zh, fr, de, hi, ja, pt and es verification is
  deferred; supported translations are maintained and historical evidence retained.

Security review: no new credentials, storage of authentication material, raw HTML,
external redirects or optimistic permission grants. Code-send chaining stops on
save failure/account unmount. Backend return paths remain exact allowlist entries;
server authorization, verification and consent gates remain authoritative.

Recovery: revert only this task's hunks/files; preserve existing reminder work
and unrelated edits, including shared translation/task/coordination files.
Next: review locally in the running app when available; resolve baseline native
type-check/provider-test issues separately before claiming full-repository checks.
