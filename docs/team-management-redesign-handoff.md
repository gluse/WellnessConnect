# Team management redesign — 28 October 2026

Status: completed locally; implementation, integration review and scoped
verification passed. No deployment or connected-service verification claimed.

## Assignment and limits

User assigned `/root` as Front End Developer, approved the compact roster and
side-panel design preview, and explicitly requested implementation on 28 October
2026. Executor `/root` accepts the frontend-only task under AGENTS.md and
ROLE-FRONT-END-DEVELOPER.md. Scope: local team UI, supporting Sheet props/styles,
translations, isolated fixtures/browser regressions, and this handoff. Existing
member/invitation/ownership endpoint contracts and one-login-per-employee model
must be preserved. No backend, schema, database, private configuration, connected
application/session/service writes, real invitation email, deployment or publishing.

The working tree already contains substantial unrelated and earlier team work.
Preserve it. Recovery means reverting only this task's attributable hunks, never
resetting whole files or the repository. Root owns the integrated implementation
and review; no cross-role implementation dependency is needed.

## Implementation

- Compact searchable roster with All/Members/Pending filters, clear status/role
  badges, protected owner and responsive summary cards.
- Focused member and invitation editors in a right-side Sheet (direction-aware
  placement retained), full-width on phones. Invite flow uses the same panel,
  success receipt, copy/select link and Invite another; latest link survives closing.
- Existing PATCH/POST/DELETE bodies, assignment restrictions, permission gates,
  native destructive confirmations and awaited workspace invalidation retained.
  Owner transfer and close/reopen live in a separate collapsed section.
- Failed writes retain drafts; pending operations prevent duplicate submission
  and dismissal. Cancel discards; other dismissal confirms dirty drafts. Team
  query keys include company ID, and a keyed editor clears state on workspace,
  membership or management-permission changes. Old completion cannot display a
  receipt in a new context. A saved write followed by a failed GET is identified
  separately and must be reloaded before another edit can be saved.
- Sheet's optional close label and overlay class preserve defaults for other
  consumers. Portalled team forms carry their own scoped styling and short-height
  scrolling, accessible labels, focus containment/restoration and live feedback.
- New `teamManagement` copy maintained in all supported translation resources.
  Existing source/test evidence and historical screenshots are preserved.

## Verification

Tests use real React components, QueryClient and en/lv/ru resources; only fetch,
clipboard and confirmation boundaries are replaced with synthetic in-memory data.
The fixture serves static files only. No connected app or services are started.

Initial `npm run check`: passed. Browser Chrome startup failed in sandbox at
Crashpad before testing. The exact isolated runner was then allowed through the
escalated tool path with a fresh temporary profile; no automatic approval
rejection occurred. Test waits were corrected for animated panel opening.

Final verification:

- `npm run check`: passed on final source. Narrow TypeScript `createProgram`
  rooted at `scripts/fixtures/team-member-update.tsx`, repository compiler options,
  ES2022 target, no emit/incremental cache: passed.
- `node scripts/test-team-member-update-browser.mjs`: passed in Chrome
  155.0.8059.85, Firefox 157.0 and WebKit 27.2. Each browser ran 16 contract groups
  and 9 layout combinations (en/lv/ru, 1280/768/320 CSS pixels). Includes member
  PATCH→GET synchronization, same-UUID reassignment, independent invitations,
  pending edit identity/expiry preservation, reservation conflicts, failure draft
  retention, pending locks, focus restoration/containment, cancel/discard,
  search/filters, permissions, empty/loading/errors, ownership actions and context
  changes. The final Chrome pass also covers in-panel failed-refresh recovery.
- `node scripts/test-team-management-recovery-browser.mjs`: passed against final
  source in all three browsers, each in en/lv/ru. Measures roster and expanded
  owner-control text/input contrast in light/dark themes, checks that a confirmed
  write followed by failed GET cannot repeat the mutation, and verifies that
  in-panel retry recovers authoritative data and clears the stale error.
- `node scripts/test-team-management-zoom-browser.mjs`: passed in Chrome with
  native 400% browser zoom (315×201 CSS viewport), en/lv/ru, reduced motion,
  roster/edit/invite reflow, focus containment and reachable/visible save footer.
- `node scripts/test-forms-phase3-browser.mjs`: passed 11 shared-form groups and
  126 en/lv/ru locale/viewport combinations. Existing team assertions were adapted
  to open the new editors; the regression's purpose/assertions are preserved.
  Its new `-team-redesign` evidence suffix preserves historical evidence. The
  shared date label was corrected for this run (28 October 2026).
- Production frontend bundle: passed using Vite's programmatic `build`,
  `configFile:false`, `envFile:false`, React plugin and existing source aliases,
  with output isolated in `node_modules/.cache/team-management-build`. This avoids
  loading private environment files or running the connected Express app/build
  plugin. Existing Browserslist age and >500 kB bundle advisory messages remain;
  no dependency upgrades or unrelated code splitting were introduced.
- Changed script syntax and scoped `git diff --check`: passed. No unexpected
  HTTP writes, external requests or browser runtime errors in successful runs.

Firefox diagnosed persistent color transitions on the inaccessible page behind
an open modal. Its fixture settle helper now ignores hidden/inert background
targets while continuing to await visible modal transitions. WebKit regressions
now await close-focus restoration and React's refreshed reservation rendering.
These are lifecycle waits, not removed assertions. A callout text contrast issue
was found and fixed; all recorded final contrast checks pass. Closed details are
expanded before owner-control contrast measurement to avoid measuring content
whose rendering the browser defers.

Screenshots inspected: [desktop roster](team-management-chrome-roster.png),
[member editor](team-management-chrome-en-1280-edit.png),
[invitation form](team-management-chrome-invite.png),
[Russian phone/dark](team-management-chrome-ru-320-dark.png) and native zoom
captures. Full browser evidence:
[Chrome](team-management-chrome-evidence.json),
[Firefox](team-management-firefox-evidence.json),
[WebKit](team-management-webkit-evidence.json),
[native zoom](team-management-chrome-zoom400-evidence.json),
[shared forms](forms-task022-phase3-chrome-team-redesign-evidence.json).
Final contrast/recovery details:
[Chrome](team-management-chrome-recovery-evidence.json),
[Firefox](team-management-firefox-recovery-evidence.json),
[WebKit](team-management-webkit-recovery-evidence.json).

Firefox/WebKit commands use process-only `FORMS_BROWSER`,
`FORMS_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH` settings with the existing
temporary `fits-task022-tools` installation described in the forms verification
handoff. No dependencies were installed.

Integration review: original team endpoints, payloads, assignment rules,
permission gates and confirmations retained; no backend/schema/credential edits.
Optional Sheet props keep previous consumers' defaults. New styles stay scoped
to the team UI. Existing unrelated dirty changes are preserved. Next action:
user reviews `/my-services/settings/team` in their running local app. No local
implementation dependency or required failing check remains.

Deferred coverage: ar (including RTL verification), zh, fr, de, hi, ja, pt and es.
Translations are maintained, but no fresh tests in these locales are claimed.
Physical devices, screen readers, native language review, connected backend
persistence/email delivery and deployment are outside this local verification.
