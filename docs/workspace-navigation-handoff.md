# Workspace navigation — 2 November 2026

User specifically approved frontend implementation by this session `/root`:
“Redesign Front End: Move 'Workspace' into the 'My Services sections' Nav bar
and show only when user have more than Workspace available.” Scope: local
provider navigation/layout, workspace selector, related locale resources and
offline/mocked frontend checks. No backend/database/infrastructure changes,
connected operations, private configuration or deployment. This record reuses
that task-specific approval; it does not assign unrelated frontend work.

Interpretation: personal is always one available workspace; the server context's
`workspaces` list contains additional company memberships. Show Workspace when
at least one company is available, including while a company is selected.

Implementation: move the selector into a compact navigation popover; preserve
the personal/company options, mutation disabling, cache reset, permissions and
unsaved-editor confirmation. Keep company/role notices visible above content.
Translate the moved workspace labels and navigation accessible name across all
supported resources without rewriting their existing changes.

Validation:

- `npm run check`: passed. Fixture TypeScript check via
  `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.workspace-navigation.json`:
  passed.
- `node --import tsx scripts/test-provider-navigation.mjs`: passed. Existing
  provider routes, failed saves, save-pending disabling, draft confirmation,
  permissions, feature isolation and sign-in redirects remain covered. Updated
  the old observer assertion to accept a removed `gcTime: 0` query as zero
  observers, matching the current hook contract.
- `node --import tsx scripts/test-workspace-navigation-browser.mjs`: Chrome
  passed five behavior groups and twelve en/lv/ru viewport combinations, each
  checking personal-only, one company and two companies. Widths: 320, 767, 768
  and 1280 CSS pixels. Firefox and WebKit also passed the same matrix and
  interaction checks; browser versions are recorded in the evidence files.
- Actual popover/selector interactions cover keyboard opening, focused native
  select, Escape and focus return, viewport bounds, readable labels, personal/
  company switching, pending/failed changes, duplicate/navigation protection,
  viewer permissions and dirty-editor Keep editing/Discard. Synthetic company
  markup is safely rendered as text. Draft cancellation restores focus to the
  persistent navigation trigger instead of the unmounted selector.
- Isolated esbuild/Tailwind bundle compilation passed through the browser
  harness. No production build or connected application startup was run.

Only en/lv/ru are tested; ar (including RTL), zh, fr, de, hi, ja, pt and es remain
deferred. New translations have no native-language review. Checks use synthetic
mocks and blocked external network; no real session or database writes. Browser
sandbox startup/loopback failures were resolved through scoped escalation for
isolated checks. Physical devices, screen readers and native browser zoom are
unverified. Chrome desktop and Russian 320px phone screenshots were inspected;
the mobile workspace label wraps at a word boundary and section labels fit.

Evidence: [Chrome](workspace-navigation-chrome-evidence.json),
[Firefox](workspace-navigation-firefox-evidence.json),
[WebKit](workspace-navigation-webkit-evidence.json),
[desktop](workspace-navigation-chrome-desktop.png),
[phone](workspace-navigation-chrome-phone.png).

Status: completed locally. No backend/database/infrastructure dependency or
deployment action is required for this frontend change.

Recovery: reverse only this task's changes to provider-navigation.tsx,
workspace-switcher.tsx, MyServices layout, new providerNavigation translation
namespace and navigation tests/evidence. Preserve pre-existing dirty work in
MyServices, translations, navigation regressions and all unrelated files. No
data recovery is needed.
