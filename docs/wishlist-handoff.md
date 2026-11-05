# TASK-042 wishlist and header inbox implementation

## Global header badge fix — 5 November 2026

User reported unread badges appearing on provider appointments but disappearing on
Search and other paths. The header had reused a route-selected scope hook, changing
its provider counts to customer-only counts when leaving `/my-services`. This
follow-up supersedes the earlier route-scoped header choice.

Assigned Frontend `/root/wishlist_frontend` and Backend `/root/wishlist_backend_plan`
accepted the local fix and coordinated `scope=all`. Frontend specifically delegated
the hook/header feed/inbox page, related fixtures and translation edits to root;
Backend implemented shared types, routes, query predicates and offline tests.
Only reversible repository changes and isolated mocked checks were authorized;
no schema, migration, connected service/database, private configuration or deployment
operation was needed. Recovery: revert this follow-up's application/contracts/tests
and strings together, preserving applied migrations, receipts and message history.

Header summaries/popups always request `scope=all` on every page: own customer
conversations plus currently authorized provider conversations/activity in the
selected workspace. One OR access predicate counts a message/booking once even for
self-bookings. The global unread projection honors any existing receipt for the
same user/message, so reading through either authorized role clears the global
badge. Explicit customer/provider APIs retain their context-specific semantics.
No other workspace's provider data or another account's read state is included.

Global rows carry explicit customer/provider viewer and provider company ID for
conversation links. Single-booking fetch/read endpoints reject `scope=all`; mixed
global booking targets are safely rejected by the client. `/inbox` defaults to
the global feed; header "View all" preserves global/current-workspace scope.
Workspace/account changes refresh/isolate counts; ordinary route navigation does
not change them. New scope-label translations are maintained in all supported
resources without claiming native-speaker verification.

Passing checks: Backend returned 80 actual-route/mock scenarios plus 16 cases
evaluating production-generated SQL predicates over synthetic records, including
duplicate ownership, reads through either context, employee/viewer access, stale
membership and unrelated workspace/user denial. These are not live SQL tests.
Chrome 156.0.8078.80, Firefox 157.0 and WebKit 27.2 each passed the updated isolated
wishlist suite with en/lv/ru/27 viewport cases and a dedicated global badge
regression across appointments, search, wishlist, account, customer bookings and
inbox, dual-role popup targets, selected-workspace refresh and account isolation.
TypeScript and the isolated frontend build pass; existing bundle/Browserslist
warnings remain. Other languages/RTL remain deferred, with historical evidence
preserved. No app server or connected database was exercised.

Evidence: [Chrome](inbox-global-chrome-evidence.json),
[Firefox](inbox-global-firefox-evidence.json), [WebKit](inbox-global-webkit-evidence.json).

## Heart corner-position follow-up — 5 November 2026

User supplied a DevTools example to move the heart closer to the image corner.
Assigned Frontend `/root/wishlist_frontend` accepted and delegated to `/root` the
two wishlist alignment properties in `client/src/index.css` plus existing isolated
geometry/interaction checks. The visible 18px heart now aligns to the top-right
of its transparent 44px button, 2px inside the image edges. The click area extends
inward; no negative offsets, overhang or `!important` are needed. Transparent
appearance, red saved state, focus and header layout are preserved. Local reversible
CSS/test work only; no connected operation, private configuration or deployment.
Recovery: revert these alignment properties and related geometry checks only.

The existing mocked Chrome suite passed for en/lv/ru, including 27 viewport cases,
exact visible-SVG corner measurements on thumbnails, a larger details photo,
44px targets, keyboard/toggle/focus and all previous flow regressions. Dialog
geometry is measured after its opening animation settles. Visually reviewed the
[new corner-position screenshot](wishlist-corner-chrome-320.png); see
[verification evidence](wishlist-corner-chrome-evidence.json). Scoped whitespace
checks pass. Other languages/RTL remain deferred; Firefox/WebKit were not rerun
for this two-property CSS follow-up. Previous artifacts are preserved.

## One-line header follow-up — 5 November 2026

User requested consistent icon sizes and one header line on smaller devices, with
tighter right-side spacing. Assigned Frontend `/root/wishlist_frontend` accepted
and specifically delegated to `/root` the header/inbox/language/account components,
scoped styles and existing isolated fixtures/tests. Local reversible changes only;
no private configuration, connected services/database operations or deployment.

Brand and controls now use a nonwrapping row with a shrinkable wordmark and tighter
mobile padding/gaps. All header symbols are 20px with independent 44px targets;
the larger account avatar background is removed. Language text appears on desktop;
guest browse/login retain labels through compact icons on smaller screens. The
full brand stays visible at normal 320px width and can truncate at enlarged text,
with its full accessible name preserved. Badges, menus, focus, navigation guards
and the earlier heart-only styling remain intact. Recovery: revert only this
follow-up's header/component/style/test changes, retaining TASK-042 data/receipts.

Passing verification: existing wishlist suite in Chrome 156.0.8078.79, Firefox
157.0 and WebKit 27.2, each 27 explicit en/lv/ru viewport cases plus guest search/
general header cases, 200% text and interaction regressions. Checks measure same-row
brand/controls, no overlap/overflow, uniform 20px SVGs and 44px targets, including
640/1024 breakpoint edges. Native Chrome 400% zoom passes the same header check
at 315 CSS pixels plus new-page reflow. Chrome mobile navigation passes 6 groups/
18 cases, including account menus, workspace and dirty-editor guards. TypeScript,
isolated Vite build and scoped whitespace checks pass; existing bundle/Browserslist
warnings remain. All APIs/persistence mocked; no application server was started.

Evidence: [Chrome](header-one-line-chrome-evidence.json),
[Firefox](header-one-line-firefox-evidence.json),
[WebKit](header-one-line-webkit-evidence.json),
[native zoom](header-one-line-zoom-evidence.json),
[navigation](header-one-line-navigation-chrome-evidence.json).
Visually inspected [320px header](header-one-line-chrome-320.png).
Fresh language coverage remains en/lv/ru only; other languages/RTL are deferred.

## Heart-only style follow-up — 5 November 2026

User requested removing the circle because it covered the service image. Assigned
Frontend `/root/wishlist_frontend` accepted and specifically delegated to `/root`
the local `.wishlist-heart` rule in `client/src/index.css` and isolated verification.
The visible background, border, round shape and shadow are removed. The 18px heart,
outlined/filled-red states, transparent 44px target and keyboard focus indicator
remain. Scope: reversible CSS only, mocked local browser checks; no connected
operation, private configuration or deployment. Recovery: revert only those rule
properties, preserving the existing implementation and applied DB receipts.

`node scripts/test-wishlist-browser.mjs` passed in Chrome 156.0.8078.79 for en/lv/ru,
including 15 viewport cases, pointer/keyboard, saved state, focus and flow regressions.
Visually inspected [heart-only phone view](wishlist-heart-only-chrome-320.png);
[new evidence](wishlist-heart-only-chrome-evidence.json) preserves prior artifacts.
Scoped whitespace check passed. Other languages/RTL testing remains deferred;
Firefox/WebKit were not rerun for this CSS-only follow-up.

## Authorization and status

User explicitly approved the expanded wishlist implementation plan on 4 November
2026. Status: implemented and verified locally; development migrations 0018/0019
applied once and the restricted 40-table runtime contract verified under the
explicit TASK-042 no-backup exception. Live workflow acceptance remains unperformed. Approver: user;
requester/integration coordinator: `/root`. Assigned Frontend
`/root/wishlist_frontend`, Backend `/root/wishlist_backend_plan` and DB
`/root/wishlist_database_plan` accepted their respective local scopes under
[AGENTS.md](../AGENTS.md#cross-role-cooperation-and-standing-authorization).

Initial local implementation scope allowed reversible repository changes, additive migration/runtime preparation,
synthetic/offline/mocked tests, isolated loopback browser fixtures and type/build
checks. That initial scope excluded connected database/service operations, real sessions/writes,
private configuration/credentials, deployment/publishing/spending. Earlier tasks'
executor-specific connected approvals do not apply to TASK-042.

Selected behavior: one account-owned wishlist, guest sign-in/manual save, retained
unpublished entries, UTC reporting and 90-day notification/activity/dedup history.
Private dedup linkage may persist after unsave for that period. Existing booking
message access and 12-month retention are preserved. See [approved plan](header-messages-notifications-plan.md).

## Owners and coordination

| Owner | Accepted scope | Status |
| --- | --- | --- |
| Frontend `/root/wishlist_frontend` | Client hearts/state/page, auth-return loader, menus/header inboxes, translations and isolated UI checks | Implemented; final fixes/tests delegated to root |
| Backend `/root/wishlist_backend_plan` | Shared DTO/navigation, private APIs, queries, activity processor, message/activity inbox and mocked tests | Completed locally; peer review returned |
| DB `/root/wishlist_database_plan` | Five private schema tables, SQL/runtime readiness, offline checks and later exact-target execution | Applied and verified on development |
| `/root` | Task/plan/coordination, delegated frontend fixes/fixtures, independent integration review and checks | Completed locally |

Frontend specifically delegated local browser fixture/test support to `/root`:
`scripts/fixtures/wishlist.tsx`, `scripts/test-wishlist-browser.mjs` and isolated
mocked browser execution. After its usage limit interrupted the final turn, the
assigned owner specifically delegated remaining integration fixes/review in
`wishlist.tsx`, `wishlist-provider.tsx`, `conversation-read-state.tsx`, `google-map.tsx`
and the existing fixtures/tests to root. A subsequent explicit delegation covered
adding `/wishlist` and `/inbox` to AppHeader's existing short-screen static-header
condition and checking both routes at native 400% zoom. Same local environment,
limits and recovery apply. Backend explicitly delegated local integration review/
fixes to root and returned a final independent contract/security review.

The owner's separate `docs/wishlist-frontend-handoff.md` creation was not executed:
the owner reported automatic approval review could not complete because of its
usage limit. That action was not retried. This existing root-owned integration
record contains the returned frontend evidence and root's authorized work instead.

Owners coordinated directly. DB design: wishlist memberships, view/wishlist
activity source/dedup, service/day groups, user read versions and per-message/user/
context receipts. Runtime readiness expands 35 to 40 tables through a compatible
versioned profile; historical migrations stay immutable. Bell types are view and
wishlist activity; new booking-status bell producers are outside this expansion.

## Verification, limits and recovery

### Result

- Public search, catalog, storefront, details, wishlist and map-preview images have
  accessible outlined/filled-red hearts, including placeholders. Provider previews
  have no save action. Image/details/booking/view callbacks remain independent.
- One private list per account, with newest-first pages, safe unavailable entries,
  removal, empty/error recovery and account/mobile menu links. Guest sign-in returns
  to the selected service and requires another click; no automatic save or view.
- Mounted hearts share batched, reference-counted membership state. Duplicate
  cards agree, per-service pending state prevents duplicate mutations, failed saves
  restore state, and departed accounts/cards cannot leave stale private state.
- Header message and bell controls provide real counts, linked lists, 99+ visual
  badges/exact accessible counts, desktop popovers and mobile dialogs. Message
  bodies appear only in authorized conversations. Following the 5 November fix,
  header scope combines own customer conversations and the selected provider
  workspace independently of navigation; explicit conversation targets remain scoped.
  The wishlist itself remains account-wide.
- Receipts acknowledge incoming messages exposed within both history and dialog
  viewports. Hidden/unloaded/own messages stay unacknowledged; failed receipts have
  explicit retry. Other readers, contexts and later arrivals retain their state.
- View/wishlist activity groups use UTC days, private source deduplication and
  revision-based read state. Providers receive aggregates only. Current resource
  and workspace permissions apply; default-seeker profiles with existing personal
  service ownership remain compatible with provider inbox access.
- Privacy policy explains wishlist membership and 90-day activity/dedup retention,
  including after unsave, without changing booking-message notices. All supported
  translation resources are maintained; new text has no native-speaker review.

### Passing checks

Scripts/imports were inspected for side effects. API/auth/persistence, Maps and
external services were mocked; static loopback fixtures blocked external traffic.
No application server, real session, connected DB or product worker was started.

| Check | Evidence |
| --- | --- |
| `node scripts/test-wishlist-browser.mjs` | Passed Chrome 156.0.8078.79, Firefox 157.0 and WebKit 27.2: each 15 explicit en/lv/ru viewport cases plus save/remove, duplicate state, errors/retries, guest continuation, cache isolation, list/unavailable/republish, logical removal focus, message links/receipts, inner/outer clipping, own messages, notification reads and badge boundaries. |
| Same script with `WISHLIST_NATIVE_ZOOM=4` | Passed native Chrome 400% zoom for en/lv/ru: 315 CSS-pixel layout, DPR4/CSS zoom1/viewport scale1, keyboard/modal focus, text contrast, and static short-screen header/reflow on both new pages. |
| `node --import tsx scripts/test-wishlist-backend.mjs` | Backend returned 74 passing scenarios: atomic/idempotent saves, UTC/dedup, worker rollback/replay/late commits, ownership/scope/read state, safe view capture and validated navigation. |
| `node --import tsx migrations/wishlist/check.mjs` | DB returned 268 passing offline schema/SQL/runtime checks. No SQL executed. |
| Historical appointment/notification schema checks | DB returned 147 appointment checks and notification parity passing; historical contracts preserved. |
| Startup/service-view/creation/capacity regressions | Backend returned 72 startup diagnostics, existing service-view audit, 21 initial-message cases and capacity checks passing. |
| Frontend regressions | Owner returned Chrome search 10 groups/54 en/lv/ru cases including map-heart guest-dialog focus; navigation 6 groups/18 cases; reservation-message and generated static privacy-policy checks passing. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Integrated TypeScript passed. |
| `node scripts/build-appointment-calendar-check.mjs` | Isolated Vite build passed with `configFile:false`/`envFile:false`, without server plugins/private configuration or shared-output clearing. Existing Browserslist-age/large-bundle warnings remain. |
| Backend bundles/whitespace | Backend returned in-memory routes/worker bundles passing; final scoped whitespace/document links checked by root. |

Root browser evidence: [Chrome](wishlist-chrome-evidence.json),
[Firefox](wishlist-firefox-evidence.json), [WebKit](wishlist-webkit-evidence.json),
[native zoom](wishlist-zoom-evidence.json). Owner-returned regressions:
[search](wishlist-search-chrome-evidence.json),
[navigation](wishlist-navigation-chrome-evidence.json).
Visually reviewed [320px hearts/header](wishlist-chrome-320.png),
[native zoom](wishlist-zoom-400.png) and [map heart](wishlist-search-chrome-map-preview.png).
Backend and DB implementation/verification details:
[Backend handoff](wishlist-backend-handoff.md), [DB handoff](wishlist-db-handoff.md).

Early checks identified guest dialog focus/navigation, wishlist removal focus
during membership refresh, and nested-scroll receipt collection; these were fixed
and the affected suites passed. WebKit required waiting for dialog transitions/
focus restoration in the test. Chrome initially could not launch its crash handler
in the sandbox; the same isolated checks passed with approved process escalation.

Fresh languages: **en/lv/ru** only.
**ar/RTL, zh, fr, de, hi, ja, pt and es are deferred**; maintain supported
translations and preserve historical evidence.
Physical devices, assistive technology, live SQL/RLS/concurrency/migrations and live
workflow acceptance were not tested. Offline checks do not establish production
activation or a compliance certification.

<a id="connected-authorization"></a>

### Connected authorization — 4 November 2026

User explicitly instructed: “Authorize the DB role to activate TASK-042 on
development project hbkooiknruimukkhshrk, checking backup/recovery first and
stopping on any failure.” Assigned executor `/root/wishlist_database_plan` accepted
through the live collaboration tool. Exact scope: necessary protected named-target
access, bounded read-only target/schema/runtime/backup/recovery preflight, prepared
0018 expansion once then 0019 runtime activation once if all gates pass, followed
by restricted 40-table read-only catalog verification. Stop on the first failed
gate/query/operation; no blind retry, reapply, privilege repair or destructive
rollback. Other tasks' no-backup waivers do not silently transfer to this package.

No audit-destination access, service/app/worker startup, product flag/private
configuration edits, persisted workflow/fixture writes, messages or deployment is
included. Root coordinates documentation and independently checks sanitized
receipts; this does not grant root database execution or credential access.
Backend supports offline runner/security review only. Authorization is not evidence
of application.

**Actual connected result:** the DB owner made one source-only preflight attempt
using the reviewed `migrations/wishlist/preflight-approved.mjs`. Verified TLS and
read-only transactions confirmed the exact source, PostgreSQL 17, expected owner/
runtime identities, all 20 existing restricted-runtime checks, exactly 35 public
tables, absence of all five new tables and zero other application connections at
that snapshot. Archive settings/backup-function availability were inspected but
do not establish a recoverable backup.

Execution stopped at `TASK042_RECOVERABLE_BACKUP_NOT_VERIFIED`. Neither 0018 nor
0019 was attempted or committed; no DDL/grants/configuration/worker or application
operation occurred and no retry followed. A current backup/restore path could not
be independently verified through available tools. The missing decision is to
verify recovery first or explicitly accept applying this package to this named
development project without a verified backup. Existing migration authorization
persists; older tasks' waivers are not reused.

[Sanitized preflight receipt](../migrations/wishlist/source-preflight-receipt.json)
records the actual stop. Root independently checked the target/executor, 20 true
readiness flags, 35-table state, unchanged SQL hashes and both zero-attempt flags
without another database connection. Backend independently reviewed the read-only
runner and passed 140 synthetic admission/stop/redaction/recovery-gate checks.

**Recovery choice resolved:** user then selected “Proceed with 0018/0019 without
a verified backup on this development project, retaining stop-on-failure.” This
is a new explicit TASK-042 exception for `hbkooiknruimukkhshrk`, not reuse of an
older task's waiver. The same assigned DB executor may continue with fresh guarded
target/35-table checks, apply each pinned migration at most once and perform only
the approved restricted 40-table read-only postflight. No verified backup is
claimed. The earlier preflight receipt remains immutable historical evidence;
activation uses a separate single-attempt receipt. First-failure/no-retry and all
other target/environment/operation limits persist. Actual commits/verification
must be reported separately from this authorization.

### Applied and verified — 4 November 2026

Assigned DB executor `/root/wishlist_database_plan` ran the separately reviewed
single-attempt activation on development project `hbkooiknruimukkhshrk` at
20:37:55–20:37:59 UTC (22:37 Europe/Riga). Fresh restricted 35-table readiness and
owner target/principal/PG17/no-new-table/zero-other-app-connection guards passed.
Both pinned files committed once, in order: `0018_wishlist.sql`, then
`0019_wishlist_runtime.sql`. The restricted application role's read-only postflight
passed all **26** current 40-table checks, including new columns, constraints,
index directions, private ACLs, server policies and schema access. The command
exited 0; no uncertain COMMIT or retry occurred.

[Sanitized activation receipt](../migrations/wishlist/source-activation-receipt.json)
records the exact target/executor, explicit TASK-042 backup exception, ordered
attempt/commit flags, hashes and passing checks. Root independently matched both
SQL hashes and verified the 20 fresh baseline/26 postflight results, selected
waiver, zero app connections and unchanged historical preflight receipt without
opening another database connection. Backend independently reviewed the runner
and passed **204** synthetic activation/failure/redaction/receipt checks before
the DB attempt. This is actual database activation/catalog evidence; it does not
claim persisted workflow/concurrency, physical-device or deployment acceptance.

No verified backup was created or claimed. No destination access, existing-row
backfill, cleanup, app/worker startup, private configuration/flag change, real
message or deployment occurred. Existing message history/retention is preserved.
Never rerun the activation runner, reapply these files or remove its receipt to
bypass the single-attempt guard.

Starting state was clean apart from pre-existing untracked
`.search-commit-check-K0YgF2/`; preserve it and unrelated committed privacy work.

Recovery: revert only TASK-042 changes before activation. Any later connected
expansion uses DB-reviewed recovery/order and a compatible build. Disable new
producers/UI first, preserve conversations, and require exact-target DB approval.

### Next operation and activation boundary

The [0018 expansion](../migrations/wishlist/0018_wishlist.sql) and
[0019 runtime activation](../migrations/wishlist/0019_wishlist_runtime.sql) are now
applied and verified on the named development project. Preserve these applied
files and receipts. The compatible application checks the exact 40-table runtime
profile; an old 35-table build cannot restart against the expanded database.

Next: start/restart the updated application for user workflow review. App startup
and persisted workflow testing were not performed by this database-only action.
View capture and the daily processor
require server-only `PRODUCT_ACTIVITY_ENABLED=true` and an explicitly started
`npm run activity:worker` or production worker. Production build includes
`dist/activity-worker.js`. The worker processes at most 200 completed-day events
per 15-minute tick, so grouped notifications appear after the UTC day finishes
and processing occurs. Wishlist saves queue deduplicated additions even while the
worker is stopped. No email/SMS/push sends were added. This paragraph documents
future operation; none of these connected commands or configuration edits ran.
