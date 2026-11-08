# TASK-047 mobile frontend readiness review

Date: 8 November 2026 (Europe/Riga).
Requester: Root. Assigned Front End Developer / executor:
`/root/release_frontend_review`. Status: accepted -> reviewed and offline checks
completed; native implementation and device acceptance remain open.

## Scope and authority

Accepted Root's scoped dependency under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization):
read-only frontend/build inspection, existing isolated mocked checks, and this
Markdown evidence file only. Applied [frontend practices](../.agents/skills/frontend-practices/SKILL.md)
and its testing/security guidance. Read role, TASK-034/035 and
[release plan](worldwide-release-plan.md). No application/configuration/dependency
edits, private configuration, app startup, installs, device services, connected
API/database/provider operations, spending or publication. Existing dirty work
was preserved. Mobile architecture remains a user decision.

Root relayed the user's selected planning requirements during this review:
**99.9% monthly availability**, **EUR 100-300/month** operating planning budget
excluding development/store fees, and **worldwide-ready architecture with an
initial Latvia/EU launch**. These choices do not select the mobile architecture,
native session mechanism, retention policy or connected execution target.

## Findings that change the implementation scope

### 1. Packaged assets need an API transport boundary before ordinary flows work

Confirmed in source: [queryClient.ts](../client/src/lib/queryClient.ts) lines
17/35 fetch supplied relative URLs with credentials. Six additional call sites
bypass that helper: [google-maps.ts](../client/src/lib/google-maps.ts):19,
[public-search.ts](../client/src/lib/public-search.ts):59,
[saved-search-location.ts](../client/src/lib/saved-search-location.ts):43,
[booking-modal.tsx](../client/src/components/booking-modal.tsx):137,
[provider-services-dialog.tsx](../client/src/components/provider-services-dialog.tsx):22
and [service-reviews.tsx](../client/src/components/service-reviews.tsx):15.
Thus the inspected client has eight API fetch expressions, plus the intentionally
external signed upload fetch. A change only in `apiRequest` will leave Maps,
search, catalog, reviews, saved location and duplicate-booking reads behind.

Inference for bundled native assets: those `/api` URLs resolve against the local
app origin rather than the hosted Express API. Define a central API destination
and transport contract covering all eight expressions, response/error parsing,
cancellation and credentials; preserve web same-origin behavior. Do not rewrite
local static assets, public external destinations or signed upload capabilities
through a blanket fetch interceptor.

Images need the same explicit URL policy: [service-card.tsx](../client/src/components/service-card.tsx):41
renders `service.imageUrl` directly, while [routes.ts](../server/routes.ts):200
serves protected image paths at `/objects/...`. Verify the actual API response
forms and private-image credential behavior on native devices; neither source
alone proves whether every returned image URL is relative.

Additional resource/navigation inventory bounds the future transport edit:

| Surface | Current source locations | Required classification |
| --- | --- | --- |
| API requests | Eight fetch expressions listed above; other callers use `apiRequest`/default query function | Hosted API, exact origin and credential policy; preserve abort and error behavior. |
| Signed upload | `ImageUploader.tsx:27-36` | Authenticated API signing/confirmation; capability URL PUT is external and credential-free. |
| Service images | `service-card.tsx:41`, `service-detail-modal.tsx:83`, `search-service-details.tsx:21`, `service-result-card.tsx:18`; Maps preview uses `google-map.tsx:168` | Hosted object URLs versus approved external URLs; protected-image delivery may need the native authenticated adapter. |
| Storefront branding | `pages/storefront.tsx:44/48`, `provider/storefront-editor.tsx:86` | Same object-URL policy, including editor preview, without attaching credentials to arbitrary external URLs. |
| Translations/static assets | `lib/i18n.ts:31`, `client/index.html:10`, `service-map.tsx:61` | Packaged local resources. The legacy map icon is local; Home uses GoogleMap, not that map. |
| Privacy documents | `login.tsx:123`, `landing.tsx:114`, `home.tsx:331`, `account-menu.tsx:58`, `mobile-navigation.tsx:123` | Generated packaged document and/or reviewed hosted public URL; define native new-window behavior. |
| Auth and route reloads | `login.tsx:61/62/78`, `invite.tsx:37/80`, `lib/authUtils.ts:10`, `landing.tsx:12`, `account-password-form.tsx:28`, `hooks/use-service-actions.ts:13`, `provider/appointments.tsx:73`, `booking-modal.tsx:103/151`, `provider/service-editor.tsx:123` | App route, hosted auth start, provider destination and validated app return must be separate operations. |
| Billing/external communication | `provider/monthly-billing-panel.tsx:13/83-85`, `provider/notification-dialog.tsx:34` | Allowlisted hosted billing versus email/SMS/WhatsApp launch, with cancel/unavailable handling and store policy review. |
| Internal new tab | `provider/service-location-fields.tsx:27` opens `/account#addresses` | Prefer app route navigation preserving drafts, or explicitly selected external behavior. |
| Downloads | `lib/report-downloads.ts:122-126` | Local generated bytes, save/share adapter rather than API URL rewriting. |

This inventory is current source evidence, not runtime request coverage or a
license to alter every listed surface. Confirm generated URLs in the native proof.

### 2. OAuth, email/invitation returns and session transport are a release blocker

Confirmed: [login.tsx](../client/src/pages/login.tsx):49-78 navigates the current
window to a relative `/api/auth/...` route or returned provider URL, then uses
`location.assign(returnTo)` on success. [invite.tsx](../client/src/pages/invite.tsx):18-48
reads query/hash from the current browser URL, removes the fragment, and sends a
temporary invitation refresh token to the server. [authUtils.ts](../client/src/lib/authUtils.ts):7-10
logs out through the API, clears cache and reloads `/`.

There is no inspected native URL-open/cold-launch handling or native callback
handoff contract. A system-browser cookie must not be assumed to appear in the
app WebView or native HTTP cookie store. Frontend, Backend and CI/CD must agree
an exact-origin, request-bound OAuth handoff and app return URL validation before
implementation. Preserve server-held long-lived tokens, HttpOnly sessions,
CSRF/origin controls, session rotation and cache clearing. App lifecycle return
is not proof that authentication or booking succeeded. Never log or persist
invitation/auth fragments as ordinary route telemetry.

Capacitor provides browser and URL-open APIs, but they do not themselves implement
the application's secure handoff. Its deep-link guide also requires website/app
association files. [Browser API](https://capacitorjs.com/docs/apis/browser),
[deep links](https://capacitorjs.com/docs/guides/deep-links).

### 3. A native wrapper with a remote website URL is not the proposed release

No Capacitor dependency/configuration, Android manifest/project or Xcode project
was found in the inspected repository paths, excluding generated output and
dependencies. The current [Vite configuration](../vite.config.ts) emits web assets
to `dist/public`. It can be an input to a native build; it is not an APK/AAB or
iOS archive.

The minimal candidate is the shared React UI bundled into native projects, with
platform adapters for the capabilities below and the hosted Express API. A
remote `server.url` shortcut would leave packaging, auth and native lifecycle
acceptance unresolved; Capacitor documents it as a live-reload facility outside
production use. [Configuration](https://capacitorjs.com/docs/config).

### 4. Browser-dependent capabilities require proof, not assumed replacement

| Capability and current evidence | Native proof / contract |
| --- | --- |
| Device location: [home.tsx](../client/src/pages/home.tsx):169-207 uses secure-context checks and browser geolocation, explicit action, timeout/denial handling | Confirm permission prompt and lifecycle behavior on each OS, manifest/usage-description requirements and browser-vs-native adapter choice. Preserve manual address alternative and existing consent/audit release gates. This review does not establish that WebView geolocation is broken. |
| Maps: current Home imports [google-map.tsx](../client/src/components/google-map.tsx), using the JS loader and API configuration read | Prove allowed Maps key/origin restrictions, script loading, gestures, keyboard and permission-denied states. A separate legacy Leaflet component is not the active Home map; do not attribute it to the current search flow. |
| Image upload: [ImageUploader.tsx](../client/src/components/ImageUploader.tsx):18-47 uses file input, file size/type checks, an authenticated signing request, multipart signed PUT with `credentials: omit`, then authenticated confirmation | Test photo/file selection, cancellation, supported formats, background/network interruption and hosted-origin response access. Keep server cookies out of the signed upload request. Do not introduce a camera permission unless the selected feature needs it. |
| Downloads: [report-downloads.ts](../client/src/lib/report-downloads.ts):122-126 creates a Blob URL and clicks an anchor with `download` | Prove PDF/XLSX/CSV save/share on device, cancellation and error handling. Native filesystem/share adapters may be needed; web download success does not establish native support. |
| Guest location: [saved-search-location.ts](../client/src/lib/saved-search-location.ts):6-18 uses a browser cookie and checks read-after-write | Prove persistence/deletion on each selected app origin and across logout/account adoption. If a native preference adapter is selected, preserve scope, expiry, minimization and explicit remember/forget semantics. No retention change is selected here. |
| Navigation/drafts: [service-navigation-guard.ts](../client/src/components/provider/service-navigation-guard.ts):18-57 intercepts browser history/popstate; editor uses beforeunload | Define Android back behavior for top dialog, dirty form, history and root; define cold/warm links and resume handling. Keep unsaved-change confirmation and focus restoration. Native lifecycle events are currently unimplemented. |

### 5. Some web foundations can be reused, with clear verification limits

The viewport already uses `viewport-fit=cover` in [index.html](../client/index.html):5.
Header and bottom navigation already account for safe-area insets
([app-header.tsx](../client/src/components/app-header.tsx):19,
[mobile-navigation.tsx](../client/src/components/mobile-navigation.tsx):43/79).
Dynamic viewport heights are present in many dialogs/pages. These are useful
foundations, not fresh iOS/Android keyboard or physical-device evidence.

[i18n.ts](../client/src/lib/i18n.ts):31 loads translations from the local
`/locales/{{lng}}/translation.json` path and remembers language in localStorage.
Package the supported locale resources as local assets. A mobile API base must
not redirect locale loads to the API. Test only en/lv/ru; ar/RTL, zh, fr, de, hi,
ja, pt and es remain deferred, while supported translations are maintained.

The privacy-policy link is local `/privacy-policy.html` in Login. The
[privacy-policy build plugin](../scripts/privacy-policy.ts):42-59 reads configuration
through Vite `loadEnv` and generates this page. A routine Vite build therefore
does not satisfy this review's no-private-configuration scope; no build was run.
A later isolated build needs explicitly supplied public details and verified
input exclusion. This review makes no claim about current private policy values.

## Tool availability observed read-only

`Get-Command` found Node/npm; `node --version` returned `v24.22.2`. It did not find
adb, java, Android Studio, Gradle or xcodebuild on PATH. Explicit path checks found:

- `C:\Program Files\Android\Android Studio\bin\studio64.exe`.
- Android Studio's bundled Java executable in `jbr\bin\java.exe`.
- The user's `AppData\Local\Android\Sdk`, including `platform-tools\adb.exe`
  and installed platform directories `android-33`, `android-34`, `android-35`.
- The user's `.gradle\wrapper\dists` directory.

The sandbox's `LOCALAPPDATA` is redirected; initial SDK checks against it were
negative. Checking `USERPROFILE\AppData\Local` established the paths above.
No IDE/adb/Gradle/device service was launched and no files inside private
configuration were read. These observations establish available tool files, not
their compatible versions, complete SDK packages, emulator/device connectivity,
license acceptance, successful compilation or signing capability. Android build
capability needs a scoped build preflight, not an installation request by default.

This is a Windows host with no xcodebuild found. iOS compilation/signing requires
an available macOS/Xcode executor; static project scaffolding on Windows cannot
establish an installable iOS build. [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).

## Existing isolated evidence collected

Inspected both runners and their frontend imports before execution. No package
install or lifecycle command was invoked. Both commands completed with exit 0:

| Command | What this actually verifies |
| --- | --- |
| `node --import tsx scripts/test-social-auth.mjs --frontend-only` | Existing Login rendering and interactions with faked fetch/window/router: provider availability, request/redirect contracts, safe return handling, cancellation/expiry/error presentation, personal/company signup and password confirmation. The flag exits before backend/config imports. |
| `node --import tsx scripts/test-invite-ui.mjs` | Existing invitation UI with faked fetch/window/router: expired session, stale password flags, 401 recovery and invitation-preserving return/recovery requests. |

These tests load English resources only. They provide no fresh lv/ru, browser
layout, cookies/CORS, real provider, mobile WebView, physical-device, API, database,
store or worldwide scale evidence. No application change was made, so broader
frontend tests were not repeated. No native build was attempted.

## Reviewable next implementation slice

Recommend evaluating **bundled Capacitor plus small platform adapters**, retaining
the existing React UI and hosted API. Compared with a separately rewritten native
UI, this preserves the established component/translation/form work and avoids an
immediate second UI implementation. This is a source-fit inference; selection
must follow the architecture decision and native authentication proof. A web-only
PWA does not fulfill the requested two app-store deliverables.

Coordinated with assigned Back End Developer `/root/release_backend_review`:
recommend presenting these concrete authentication options with the architecture
choice, rather than assuming that provider browser and app share cookies:

- **A, recommended proof candidate:** keep the web cookie/CSRF contract. Add an
  explicit native session transport: an opaque app-session credential held by a
  native secure-storage/HTTP adapter, never returned through a JavaScript
  credential getter. Supabase access/refresh tokens remain server-side. Start a
  challenge-bound, server-correlated system-browser attempt; return only a short
  lived single-use handoff code to a verified app/universal link; exchange it
  with the verifier to establish the app session. The native adapter must pin the
  exact HTTPS API destination and prevent credentials crossing redirects or
  arbitrary URLs. Define protected object delivery separately from signed upload.
  Backend/DB must specify replay, expiry, revocation and failure semantics.
- **B, conditional alternative:** retain a cookie-based native WebView transport
  after a reviewed handoff only if physical proof demonstrates HttpOnly cookie
  persistence, SameSite/CSRF behavior and OS restrictions. Adding CORS origins
  alone does not establish this contract.

These are proposed application designs, not implemented controls. Native
architecture and the new session/security contract are material user choices.
After a choice and accepted scope, module layout, updating all eight request
expressions, distinguishing local/hosted resource destinations and preserving
query/cache/error behavior are routine owner implementation. Connected test
environment, domain/app identity, credential provisioning and store publication
remain separate named execution scopes. No approval for them is inferred here.

The first proof should demonstrate one installable Android test artifact and an
iOS simulator build from the same client snapshot, before broad native feature
work. Frontend owns packaged asset/API routing and platform adapters; Backend
owns authentication/origin/CSRF and callback contracts; CI/CD owns native projects,
macOS executor, reproducible tooling/signing and association hosting; DB owns any
connected session/fixture authorization. Agree mixed files before edits.

Proof acceptance: launch bundled assets without the website; load en/lv/ru local
resources; fetch public search via the hosted API; perform email and one configured
system-browser social sign-in with warm/cold return; verify cancellation, callback
replay/invalid route, expiry/logout and no cross-account cached data; load protected
images; prove failed/offline writes never display success. Capture actual device/
simulator cookies and return behavior without tokens in logs. Preserve website
regressions. Native feature/store acceptance remains the full TASK-034/035 matrix.

This proof needs a selected architecture, app identity/domain, API/test environment,
available compatible native executors and scoped connected test authorization.
The current review completes preparation only. Recovery: remove this Markdown
file; no runtime/data rollback is needed.
