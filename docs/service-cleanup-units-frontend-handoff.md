# Preparation and cleanup units — 5 November 2026

User approved this frontend follow-up to [duration units](service-duration-frontend-handoff.md):
also add time units to “Preparation and cleanup after service”. Executor `/root`.
Accepted scope: local frontend components, translations, fixtures and offline/mocked
tests. No backend/database changes, connected writes or deployment. Recovery is to
revert only this follow-up's local edits; no migration or data recovery is needed.

The shared duration field now handles `duration` and `cleanupTime` independently.
Both accept Minutes / Hours / Days, fractional values and decimal dot/comma.
Changing units preserves canonical minutes. Cleanup still accepts zero and is
limited to 1440 minutes (24 hours / 1 day), following the existing backend/database
contract. Partial minutes, blank/invalid text and out-of-range values are rejected.
Save errors retain drafts; pending saves disable the controls. Both input/select
pairs have labels, linked help/errors, and aligned controls when labels wrap.

Updated cleanup labels and validation text in all supported translations. The
minute-only label was removed. Customers continue to see service duration only;
the preparation/cleanup value is not added to public duration displays.

Completed locally. All listed checks passed. Chrome 156, Firefox 157 and WebKit
27.2 each passed 12 en/lv/ru viewport cases (36 total), covering 320×900, 390×300,
768×900 and 1280×900. Phone screenshots from all three engines were visually reviewed.
The build retains existing Browserslist age and chunk-size notices. No deployment
was performed; next action is normal frontend review/release workflow.

Evidence: [Chrome](service-cleanup-units-chrome-evidence.json),
[Firefox](service-cleanup-units-firefox-evidence.json),
[WebKit](service-cleanup-units-webkit-evidence.json). Screenshots:
[Chrome](service-cleanup-units-chrome.png), [Firefox](service-cleanup-units-firefox.png),
[WebKit](service-cleanup-units-webkit.png).

Checks: `node --import tsx scripts/test-service-duration.mjs`,
`node --import tsx scripts/test-cleanup-time.mjs --frontend-only`,
`node --import tsx scripts/test-service-cleanup-units-browser.mjs`, `npm run check`,
`npx tsc -p scripts/fixtures/tsconfig.service-form.json`, `npx vite build`, and
`git diff --check`. The cleanup regression explicitly exits before loading backend
test setup. Browser tests use synthetic in-memory API responses and reject unexpected
requests; no application server or live session is started. Existing matching
Firefox/WebKit tooling is documented in the original duration handoff.

Test language scope: en/lv/ru only. ar (including RTL), zh, fr, de, hi, ja, pt and es
are deferred. Physical devices, virtual keyboards, screen readers and native-speaker
translation review are unverified. No new dependency, browser persistence, secret,
or raw HTML path was introduced; server validation and authorization are unchanged.

Historical duration evidence and unrelated work are preserved. Newly generated
cleanup artifacts use `docs/service-cleanup-units-<engine>` filenames.

Follow-up label rename, 5 November 2026: user specifically approved changing
“Preparation and cleanup after service” to “Cleanup after service”; executor
`/root` updated only that label and its supported translations. Exact en/lv/ru
resource assertions and `git diff --check` passed. Existing browser evidence above
predates this text-only rename; deferred language coverage remains unchanged.
