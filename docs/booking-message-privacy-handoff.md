# Booking message privacy disclosure — 4 November 2026

## Authorization and scope

User approved the proposed presentation plan with “go ahead implement”. Specific
frontend approval: user → `/root`, conversation and initial-message disclosure,
policy content and navigation, supported translations and isolated local checks.
Allowed operations: reversible repository edits, mocked browser checks, type and
isolated build checks. No connected database/service operations, private
configuration, retention/access-rule changes, deployment or publishing. Preserve
unrelated dirty work. Recovery: revert only this task's edits, retaining messages
and the existing access/retention implementation.

Status: completed and verified locally (TASK-041).

## Result

- Shared native `details` / `summary` disclosure in the conversation (including
  read-only viewers) and beside the initial-message field. The two full notices
  are collapsed initially; “Message privacy & retention” remains visible.
- Access and retention wording is unchanged. Expanding/collapsing retains drafts
  and does not submit either form. Explicit zero tab index keeps the policy link
  in WebKit's keyboard sequence as well as Chrome/Firefox.
- The generated English Privacy Policy has a `#booking-messages` section and
  contents link covering the initial message, conversation readers and exact
  retention rule. Its booking-information description includes messages and
  historical notes, consistent with TASK-040's preserved historical data.
- Disclosure links open the policy section in a new tab with `noopener noreferrer`
  and a translated label announcing English/new-tab behavior. The mobile Menu and
  account menu also expose the policy without leaving the current page/draft.
- Two new strings are maintained in every supported locale. Policy remains English
  as indicated by the links. No new dependencies or executable HTML rendering.

## Verification

- `node --import tsx scripts/test-reservation-initial-message-browser.mjs` passed
  in Chrome 156.0.8078.79, Firefox 157.0 and WebKit 27.2 with **en/lv/ru only**.
  Covers initially hidden details, keyboard/pointer expansion, exact notices and
  link attributes, keyboard order, draft preservation/no submission, 200% text,
  1280/768/375/320 CSS-pixel reflow, customer/provider replies, safe multiline text,
  error recovery, focus restoration, blank and instant/group/read-only flows.
  The customer action locator now uses its existing accessible icon-button name.
- `node --import tsx scripts/test-mobile-navigation-browser.mjs` passed in Chrome:
  six behavior groups and 18 viewport/locale cases, including public policy links
  in both menus and loading/error/viewer permission states. Existing workspace,
  dirty-editor, navigation, focus and responsive regressions passed. Artifacts used
  `MOBILE_NAV_ARTIFACT_PREFIX=booking-message-privacy-navigation` to preserve older
  evidence; see [navigation evidence](booking-message-privacy-navigation-chrome-evidence.json).
- `node --import tsx scripts/test-booking-message-policy.mjs` passed in Chrome.
  Synthetic configuration only; exact English disclosure text, valid anchor/contents,
  script-free static rendering, 320/768/1280px reflow, 200% text and light/dark
  contrast. No project/private configuration was loaded by this check.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` and
  `node scripts/build-appointment-calendar-check.mjs` passed after the final UI
  change. Build uses `configFile:false`/`envFile:false`, without server plugins,
  application startup or clearing shared output. Existing Browserslist-age and
  bundle-size warnings remain. Scoped `git diff --check` passed.
- Visually reviewed the [collapsed phone dialog](booking-message-privacy-chrome-320.png),
  [expanded phone dialog](booking-message-privacy-chrome-320-expanded.png), and
  [policy section](booking-message-policy-chrome-320.png). Expanded content uses the
  existing scrollable dialog; the collapsed view restores room for conversation.

Chrome initially failed at its crash handler within the sandbox. Authorized
isolated browser processes were then run with escalated process access. Early
checks also identified an obsolete text-button locator, menu expectations needing
the new public item, and WebKit link tab order; all were corrected and the affected
checks passed on rerun. No automatic approval rejection occurred.

All application fetch/auth/persistence boundaries were mocked. Firefox/WebKit used
the existing `C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools` installation with
process-only `FORMS_BROWSER`, `FORMS_PLAYWRIGHT_MODULE` and
`PLAYWRIGHT_BROWSERS_PATH` settings. No application server/database/connected service
was exercised. Physical devices, assistive technology and live publication were
not tested. This is local implementation evidence, not a compliance certification.

Validation will cover en/lv/ru only. ar (including RTL), zh, fr, de, hi, ja, pt and
es remain supported with maintained translations; verification is deferred.

Next action: user review/local use. Deployment and publishing remain on hold.
