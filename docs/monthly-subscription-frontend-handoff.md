# TASK-024 — local frontend billing foundation

**Current local-app integration, 26 October 2026:** The user selected local app
testing and asked the assigned owners to complete integration and setup guidance.
Front End Developer `/root/subscription_frontend` accepted reversible frontend
runtime wiring/offline verification only, under the existing assignment. No app
was run against a database, no persisted sessions/fixtures or Stripe operations
were performed, and no private configuration was read or changed.

- App now supplies its verified authentication identity to
  [BillingRuntimeProvider](../client/src/components/billing-runtime.tsx). The
  provider obtains only public `/api/billing/runtime` readiness flags and HTTPS
  hosted origins, as agreed with Backend. Logged-out state makes no runtime
  request. Disabled/missing/failed/HTML/malformed capability responses remain
  dormant and cause no private billing probes. Production/disabled readiness is
  server-owned false/empty; no URL, browser storage or `VITE_*` switch can enable it.
- Auth identity changes synchronously reset the provider, abort old capability
  requests and ignore stale responses. Focus/visibility refresh revalidates
  readiness; unchanged responses preserve transport identity and unsaved pricing
  drafts. Workspace-specific authorization and price/terms remain fresh server
  status decisions, independent of public deployment readiness.
- The existing workspace-switch mutation now carries
  `WORKSPACE_CHANGE_KEY`; Settings immediately withholds/aborts its billing
  transport while that mutation is pending, before the next context arrives.
  It reads fresh status after completion. This closes the pending-switch window
  for stale hosted responses without changing the workspace mutation itself.
- Existing Administration gating, owner-only status, manual-grant wait, immutable
  checkout offer, exact EUR amount editing and new-subscription-only prices are
  reused. The actual app receives real transports only when the server reports
  readiness. This removes the earlier hard-disabled frontend mounting gap; it
  does not activate server billing or assert local connected acceptance.
- `node --import tsx --test scripts/test-billing-runtime-ui.mjs`: **4 passed**.
  Covers signed-out/no-request, independent ready flags, disabled/404/HTML/error/
  invalid-origin failure boundaries, identity races, and unchanged-readiness
  draft preservation. No prior unaffected suites were repeated.
- `node scripts/test-billing-runtime-browser.mjs`: **11 passed**, targeted Chrome
  integration with actual Administration/Settings and fully synthetic fetch in
  en/lv/ru. Verifies capability-before-private-read ordering, disabled/missing zero
  private probes, selected workspace/manual-wait/read-only return, and pending
  switch suspension/focus/completion. The existing isolated esbuild/Tailwind
  harness compiles these components; browser errors, external requests and real
  server writes were empty. No layout/messages changed, so prior multi-browser,
  keyboard, phone and native-zoom evidence was reused, not claimed as freshly rerun.

Evidence: [runtime Chrome](monthly-subscription-runtime-chrome-evidence.json).
After Backend/DB reported stable, including Backend's final shutdown/listen
cleanup, one integrated `npm run check` **passed, exit 0**. No UI suites were
repeated for this final check. Backend and Root accepted the reviewed frontend
capability/auth/workspace contracts. Production Vite
build remains outside this check because its plugin reads private environment;
no connected, physical-device, screen-reader or native-speaker coverage is claimed.
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. Backend reviewed the agreed
capability contract; [local testing setup](stripe-local-app-testing.md) is owned by
Root and describes user-run preparation/activation gates.

Recovery: disable server readiness to withhold transports, or revert only this
phase's provider/App/capability helper and workspace mutation metadata/Settings
fence plus its new tests/fixture modes. Preserve earlier pricing/foundation work,
historical evidence and unrelated dirty files. Real local-session/payment testing
still requires its separate database/processor execution authority.

**Earlier pricing extension, 26 October 2026:** Administration pricing and HTTP integration
are implemented locally under the resumed Front End Developer assignment and
[selected decisions](monthly-subscription-decisions.md). Runtime remains disabled.
The original 25 October foundation/evidence below is historical; this extension
supersedes its unresolved local pricing, policy and freshness statements.

- [Administration editor](../client/src/components/admin-billing-price.tsx) is
  mounted in the existing application-admin gate. Fixed EUR/month/tax-inclusive
  amount accepts exact decimal text (including decimal comma), validates the
  EUR 0.50–999999.99 range, and sends canonical amount plus settings revision.
  It never grants access from company ownership. The initial 19.00 value comes
  from the server/prepared configuration, with no browser fallback.
- New-subscription-only helper copy explicitly preserves existing subscribers'
  agreed price. No repricing, proration or Stripe-price creation action exists in
  this editor. Save success requires the requested amount and a nondecreasing
  revision, with advancement required when the amount changes. Conflict, unknown
  or inconsistent acknowledgements retain the draft, block another save and
  require explicit reload. Unauthorized results clear private data and propagate
  to the existing Administration access handler. Identity changes abort/ignore
  previous work.
- [HTTP adapters](../client/src/lib/billing-http.ts) implement the agreed
  `/api/admin/billing/offer` GET/PUT and `/api/billing` status/checkout/portal paths.
  Requests use authenticated cookies, `no-store`, abort signals, JSON boundaries
  and rejected redirects; errors expose safe codes. Checkout sends the immutable
  `offerRevision` and accepted terms version, never an amount or provider price ID.
- [Runtime context](../client/src/components/billing-runtime.tsx) is explicitly
  disabled in App: no absent-endpoint probes or billing/admin-price requests.
  Settings/Administration consume real transports only after separately approved
  runtime readiness is supplied. Code preparation does not activate billing.
- The panel now displays the selected manual-grant wait reason/end date, handles
  changed offers with a mandatory review/refresh, refreshes status on focus,
  visibility and confirmed access expiry, and bounds pending/return status polling
  to eight reads. Expired/skewed active snapshots fail closed with a refreshable
  verification error; they cannot repeatedly schedule expiry timers or grant access.
  `/my-services/settings/billing?billing_return=1` is the agreed fixed return path;
  the marker only triggers status presentation/reads.
- New messages were maintained in all supported resources. New component/HTTP
  coverage includes amount precision, CAS/no-op acknowledgements, unknown and
  mismatched saves, readiness/admin denials, identity races, immutable checkout
  revisions, manual wait, deterministic expiry/no-loop and bounded status polling.
  Prior affected tests were reused; unrelated BE/DB suites were not repeated.
- New changed-scope browser checks: **10 each Chrome/Firefox/WebKit**, en/lv/ru
  at 320/1280 CSS px; native Chrome 400% zoom **3 passed**. Actual Administration
  and provider settings components were exercised with mocked HTTP/auth/session
  results, including keyboard validation/save, conflict/reload, inaccessible and
  dormant price settings, and billing return/manual wait. Esbuild/Tailwind compiled
  the actual components. Screenshots were visually inspected; contrast/reflow,
  browser errors, external requests and server writes passed their assertions.
  These are synthetic local flows, not connected session or database operations.

Current evidence: [pricing Chrome](monthly-subscription-price-chrome-evidence.json),
[Firefox](monthly-subscription-price-firefox-evidence.json),
[WebKit](monthly-subscription-price-webkit-evidence.json),
[native zoom](monthly-subscription-price-chrome-zoom400-evidence.json),
[Latvian phone](monthly-subscription-price-chrome-lv-phone.png),
[Russian desktop](monthly-subscription-price-chrome-ru-desktop.png).
`node --import tsx --test scripts/test-monthly-billing-ui.mjs`: **22 passed** in
the final focused run. Deterministic expiry tests prove a repeated expired active
snapshot cannot loop, and pending return polling stops after eight status reads.
The later Stripe EUR minimum alignment updated help/errors and boundary checks;
the three affected model/decimal/editor validation tests passed. Existing browser
evidence predates that validation-only minimum change; unchanged layout/flows
were not repeated. EUR settlement-account readiness remains a backend launch gate.
Assigned Backend read-only reviewed the current HTTP/model/price-editor contract
and found no blocking mismatch. After Backend/DB reported stable, the integrated
`npm run check` initially found one Backend dispatcher invoice-ID optionality
error. Backend fixed it at the provider boundary and reran its affected checks;
the required TypeScript rerun **passed, exit 0**. No unrelated tests were repeated.
Production Vite/private-environment and all
connected/physical-device/screen-reader/native-language limitations below remain.

Remaining: approved runtime mounting/bootstrap, complete backend status/lifecycle,
Stripe/account/tax/terms readiness and separately authorized connected acceptance.
Recovery for this extension removes only its new adapter/context/editor and
attributable App/settings/Administration/model/message/test additions; preserve
the original foundation, historical evidence and unrelated dirty work.

## Historical 25 October foundation

25 October 2026, Europe/Riga. **Local interface implemented; real billing remains
inactive.** The user requested that Front End Developer start TASK-024. Coordinator
`/root` assigned Front End Developer/executor `/root/subscription_frontend` under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Accepted reversible local UI/translations and isolated offline/browser checks;
no backend/DB/configuration, connected service, session writes or deployment.
Used [frontend practices](../.agents/skills/frontend-practices/SKILL.md).
Scope is recorded in [TASKS](../TASKS.md#billing) and
[coordination](agent-coordination.md#task-024--monthly-pro-subscriptions).

## Delivered behavior

- [Provider settings](../client/src/pages/provider/settings.tsx) includes a Pro
  subscription tab. Its runtime mount deliberately has no transport and shows
  truthful billing-unavailable information: no price, invented billing facts,
  checkout or requests to absent endpoints. Existing manual administration and
  storefront behavior remain unchanged.
- [Billing panel](../client/src/components/provider/monthly-billing-panel.tsx)
  renders injected monthly offer/currency/tax/recurring terms, explicit consent,
  loading/error/denied/unavailable states, checkout return/pending/unknown status,
  active/failed/authentication/canceled/expired lifecycle, separate manual-grant
  and paid-through dates, server-confirmed effective access, cancellation-at-end
  status, and hosted management/payment recovery actions.
- [Client contract](../client/src/lib/monthly-billing.ts) validates server state,
  exact target, monthly EUR offer, explicit capabilities and hosted responses.
  It introduces no vendor, tariff, owner-only policy, overlap/grace/refund terms,
  HTTP route or payment activation. The fixture's **EUR 12.34 is synthetic**, never
  included in the application billing mount or configured as a tariff.
- Checkout requires displayed terms consent. Mutations never retry automatically.
  Ambiguous outcomes block a second checkout; only an explicit authoritative
  status response with no operation plus checkout capability and offer can unlock
  a fresh attempt/key. Hosted creation and return never grant Pro.
- Actor/workspace changes synchronously remount private UI, clear consent and
  state, abort requests and ignore late responses/redirects. No billing cache or
  browser storage is introduced. Server identity must come from its session;
  `actorId` is a local scope identifier, never authorization.
- Hosted URLs require an explicit user action, echoed target and exact trusted
  HTTPS origin; credentials, unsafe schemes and unconfigured origins fail closed.
  URLs are not logged, cached or persisted. Backend remains responsible for fresh
  authority, session security, durable reservations and trusted provider bindings.
- Added `monthlyBilling` messages to all supported locale resources, preserving
  concurrent changes. Only **en/lv/ru** were verified. Other translations are draft
  language work without native-speaker review.

Assigned Backend `/root/subscription_backend` read-only reviewed the two new
frontend source files and accepted the dormant/injected contract and security
boundaries. Root reviewed copy and representative desktop/phone/zoom screenshots.

## Verification

- `node --import tsx --test scripts/test-monthly-billing-ui.mjs`: **12 passed**
  after final copy edits. Tests cover scope/URL tampering, strict monthly shape,
  no-transport behavior, consent/duplicate locks, ambiguous recovery/new key,
  read-only return, source dates/cancellation/expiry, recovery permissions,
  denied/unauthenticated/unavailable states, stale read/redirect suppression and
  live en/lv/ru messages/interpolation.
- `npm run check`: **passed** with the integrated repository changes. No backend
  or database test suites were repeated.
- `node scripts/test-monthly-billing-browser.mjs`: **14 checks per engine** in
  Chrome, Firefox and WebKit. en/lv/ru at 320, 768 and 1280 CSS px, keyboard checkout,
  settled unknown-state refresh blocking, cancellation/payment recovery/expiry,
  denied and unavailable views; text contrast and reflow assertions passed.
- With `BILLING_NATIVE_ZOOM=4`: **3 Chrome checks passed**, en/lv/ru; real 400%
  browser zoom with outer width 1280, inner width 300–320, DPR 4, no CSS/pinch zoom.
  Captures use viewport mode to avoid Chromium's cropped beyond-viewport capture
  at native zoom. Representative screenshots were visually inspected.
- The established [GET-only harness](../scripts/fixtures/browser-harness.mjs)
  compiled the actual panel and primitives using esbuild plus Tailwind/PostCSS.
  [Fixture](../scripts/fixtures/monthly-billing.tsx) injects all billing data and
  mutations. Network/errors/unexpected application writes were empty. Chrome
  initially failed sandbox Crashpad startup; the same scoped browser checks passed
  with reviewed escalation. Firefox/WebKit reused existing temporary tooling via
  `FORMS_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH`; no installation occurred.

Evidence: [Chrome](monthly-subscription-chrome-evidence.json),
[Firefox](monthly-subscription-firefox-evidence.json),
[WebKit](monthly-subscription-webkit-evidence.json),
[native zoom](monthly-subscription-chrome-zoom400-evidence.json).
Screenshots include [desktop](monthly-subscription-chrome-en.png),
[Latvian phone](monthly-subscription-webkit-lv.png),
[Russian dark](monthly-subscription-chrome-ru.png) and
[400% zoom](monthly-subscription-chrome-en-zoom400.png).

Production Vite build was not rerun: its privacy-policy plugin loads local `.env`
configuration. The scoped isolated bundle avoids private configuration and proves
panel compilation, not complete production asset packaging. Browser checks use
synthetic transport and emulation; no actual hosted payment, connected permission,
session/database, physical device, screen reader or native-language acceptance is
claimed. **ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred**;
historical evidence is preserved.

## Remaining integration and recovery

TASK-024 remains open. Backend must expose the authenticated status/checkout/portal
contract and map user/company targets to the durable workspace anchor; a verified
resolved reservation is required before returning operation `none` and allowing a
new checkout. The current client envelope is an injected view model, not a claim
that design endpoints exist. Freshness on expiry, permission changes and return
reconciliation/polling must be wired and verified with the real adapter before
mounting it. Server status/access and lifecycle remain independent; dates alone
must never grant access or bridge unpaid gaps.

The existing [backend gates](monthly-subscription-backend-handoff.md),
[database gates](monthly-subscription-database-handoff.md), vendor/approved price,
tax/commercial terms, permissions and connected-execution/launch requirements
still apply. No new security issue was found within the local changed boundary;
this is not a security audit or commercial launch acceptance.

Recovery: remove only the new panel/client contract, billing fixtures/tests and
evidence, the three settings integration lines and `monthlyBilling` resource
objects. Preserve all unrelated dirty work and historical evidence. No data
restore or connected rollback is needed for this dormant phase.
