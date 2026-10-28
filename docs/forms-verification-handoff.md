# TASK-022 — additional forms verification

21 October 2026. Executor: Front End Developer `/root`.
Local implementation and available automated verification are complete. Required
physical-device/virtual-keyboard, screen-reader and native-speaker verification
remain unverified. Deployment remains on hold.

**Status update, 23 October 2026:** TASK-022 was completed and moved to
[the completed-task archive](../TASKS_COMPLETED.md) at the user's explicit
request. This administrative closure adds no verification evidence; the manual
release checks below remain unverified and deployment remains on hold.

## Approval, scope and recovery

Approving party: user, through the existing TASK-022 frontend assignment and
“resume to complete” on 21 October 2026. Executor: `/root`. Environment: local
repository, disposable browser profiles and synthetic static fixtures. Scope:
remaining forms verification, scoped frontend corrections, offline regressions,
test language restrictions and evidence/task records. Allowed operations: edit
affected frontend/tests/docs, compile and run isolated mocked checks, and use
temporary browser test tooling. Backend/database/ORM changes, connected service
or session writes, infrastructure and deployment remain excluded.

Recovery: reverse only this pass's attributable changes in the two form CSS files,
service-card booking click handler, scoped runners/fixture helpers and new evidence
documents. Preserve concurrent changes, earlier implementation, historical evidence
and installed database objects. No shared-worktree reset or deployment rollback
is needed. No application dependency, lockfile or `.env` edit was made.

## Corrections and tooling

- Booking and service forms now allow long text to wrap anywhere. Fresh checks
  exposed horizontal overflow with Russian text at 200% text size and 320px width;
  both regressions now pass. Booking inputs also allow their minimum width to shrink.
- The service-card booking button explicitly focuses itself before opening the
  modal. WebKit pointer clicks could otherwise leave focus on the body, preventing
  return to the trigger. The Phase 2 runner exercises the actual ServiceCard for
  the guest open/close regression; its broader form layout matrix uses an isolated
  trigger to avoid including unrelated background-card layout in form acceptance.
- Existing form runners now select only en/lv/ru, including their fixed screenshots
  and formatting assertions. New evidence uses `forms-task022-*` filenames;
  earlier 11-language results/screenshots were preserved without rerunning them.
- The fixture server was extracted from the existing Chrome harness. An optional
  Playwright adapter reuses the same application components, CSS and mocked APIs
  for Firefox/WebKit. Playwright 1.64.1 and its browser binaries were installed in
  the task's temporary tools folder, outside the application dependency tree.
- WebKit's scrollbar changes the width used for media queries near 640px. The
  auth test records viewport/layout metrics on failure and verifies the name grid
  against the engine's actual media-query result, while asserting requested width.
- Pointer helpers wait for queued focus/layout frames and check dialog click
  targets. Focus restoration is awaited where asynchronous.
- Computed CSS border checks exclude native checkbox/radio painting, which cannot
  be inferred from computed border colors. This is a measurement limit, not a
  claim of verified native-control contrast or assistive-technology support.

## Passing checks

Browsers: installed Chrome 155.0.8059.84; Playwright Firefox 157.0 and WebKit 27.2
on Windows. WebKit automation does not establish physical Safari/iOS coverage.
All fresh locale/resource/browser checks used English, Latvian and Russian only.

| Runner | Browser | Behavior groups | Locale/viewport cases |
| --- | --- | ---: | ---: |
| `test-service-form-browser.mjs` | Chrome | 13 | 21 |
| `test-forms-service-cross-browser.mjs` | Firefox / WebKit, each | 5 | 12 |
| `test-forms-auth-browser.mjs` | Chrome / Firefox / WebKit, each | 8 | 21 |
| `test-forms-phase2-browser.mjs` | Chrome / Firefox / WebKit, each | 14 | 63 |
| `test-forms-phase3-browser.mjs` | Firefox / WebKit, each | 11 | 126 |

The final runs reported zero unexpected fixture requests, blocked external page
requests or runtime exceptions. Coverage includes validation, rejected/pending
synthetic saves, duplicate guards, retained drafts, safe feedback, permission
gates, keyboard/dialog focus, responsive forms and scoped contrast samples.
Phase 3's earlier Chrome evidence remains historical; its full Chrome matrix was
not repeated during this pass.

`node --import tsx scripts/test-forms-zoom-browser.mjs` passed **39 form views**:
service editor; login/signup/recovery; account/password; manual address editor;
booking selection/review; availability, team, filters including advanced fields,
categories, storefront and subscription search. Each ran in en/lv/ru. A disposable
Chrome profile sets native browser zoom to 400% using
`partition.default_zoom_level.x = log(4)/log(1.2)`. The runner asserts a 1280px
outer window, 315px content viewport on this Windows host, DPR 4, visual viewport
scale 1, CSS zoom 1, no horizontal page overflow, visible control bounds and
scrollable/reachable enabled fields. It does not use a device-metrics override or
CSS/pinch scaling. See Chromium's [zoom preference implementation](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc).

Other passing checks:

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `node node_modules/typescript/bin/tsc --project scripts/fixtures/tsconfig.forms-phase2.json`
- `npm run build` (existing Browserslist-age and bundle-size warnings)
- `node --import tsx scripts/test-guest-search.mjs --frontend-only`
- `node --import tsx scripts/test-provider-catalog.mjs --frontend-only`
- `node --import tsx scripts/test-public-search-ui.mjs`
- New runner/helper syntax checks and scoped whitespace checks.

Browser fixtures use a static loopback server and synthetic fetch responses; no
connected Express startup, OAuth/email provider, geocoding, booking, session or
database write was exercised. Browsers ran outside the process sandbox through
automatic approval review. Security review found no introduced unresolved issue:
the production edits affect text layout and local focus only, retaining existing
API/auth contracts. Screenshots and reports contain synthetic data.

## Evidence and reproduction

JSON reports and their screenshot lists use
`docs/forms-task022-{service,auth,phase2,phase3}-{chrome,firefox,webkit}-evidence.json`
for the combinations in the table. Native zoom has its own
[report](forms-task022-zoom-evidence.json). Sampled visual review covered WebKit's
[Russian booking review](forms-task022-phase2-webkit-booking-russian-dark.png),
Firefox's [200% text availability](forms-task022-phase3-firefox-availability-text200.png),
Chrome's [Russian dirty-exit dialog](forms-task022-service-chrome-russian-dark-dialog.png)
and [native-zoom booking notes](forms-task022-zoom-booking-review.png).
This is sampled visual evidence, not a complete accessibility audit.

Run existing scripts with `node --import tsx scripts/<runner>.mjs`. Defaults use
installed Chrome. For Firefox/WebKit set process-only `FORMS_BROWSER` to the chosen
engine, `FORMS_PLAYWRIGHT_MODULE` to the temporary Playwright `index.mjs`, and
`PLAYWRIGHT_BROWSERS_PATH` to its browser directory. This session's tools are under
`C:\Users\LuseG\AppData\Local\Temp\fits-task022-tools`; they may need reinstalling
if the temporary directory is cleaned. Use Playwright 1.64.1 and its matching
Firefox/WebKit binaries to reproduce this evidence. No app server is required.

## Remaining acceptance work

The following require manual evidence; they cannot be claimed from these tools:

- Physical phone/tablet and virtual-keyboard checks: input editing, orientation,
  keyboard open/close, scrolling and access to errors/actions across the forms.
- Screen-reader checks: reading order, names, errors/status announcements and
  focus entering/leaving booking, confirmation and selection dialogs.
- Native-speaker review of the changed English, Latvian and Russian messages,
  including validation, dates, appointment timezones and booking terminology.

Next owner: Front End Developer with access to the relevant devices, assistive
technology and language reviewers. Record actual device/OS/browser/reader/locale
and outcomes before closing these checks. Short-height emulation, DOM labels,
keyboard automation and translation-key checks do not replace them. The project
[frontend skill](../.agents/skills/frontend-practices/SKILL.md) states:
“Required failures/unavailable checks remain incomplete verification”.

Arabic including RTL, Chinese, French, German, Hindi, Japanese, Portuguese and
Spanish remain deferred under the user's language scope. They were not freshly
tested and are not current acceptance blockers. Historical evidence is retained.
The user has not separately resumed deployment; nothing was deployed.
