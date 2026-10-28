# Frontend tests and verification

Reviewed: 18 October 2026. Test responsibility/completion rules belong to
`ROLE-FRONT-END-DEVELOPER.md`; keep database authorization in `AGENTS.md` intact.

## Tooling and isolation

Existing scripts use React 18 `react-test-renderer`, `node:assert/strict`, mocked
browser globals, and `tsx`; some scripts also import backend/database modules.
Read each script and transitive setup/teardown before running it. Inspect package
lifecycle hooks. Do not infer an offline test from its name or a fixture URL.
Use synthetic data and mocked APIs, Maps/geolocation, storage, and clocks; reject
unexpected requests and reset query caches/globals between tests.

Preserve useful existing tests. React's current guidance deprecates test renderer;
it does not provide a real DOM/layout engine. Favor user-facing DOM tests for new
interaction coverage when tooling is needed and authorized, but do not introduce
a React upgrade or blanket migration as an incidental change.
Source: [React test-renderer guidance](https://react.dev/warnings/react-test-renderer).

Test through visible behavior, accessible roles/names, and realistic interactions.
Avoid assertions coupled to component internals or source strings. Keep snapshots
focused; they do not establish behavior, security, or accessibility.
Source: [Testing Library principles](https://testing-library.com/docs/guiding-principles/).

## Select meaningful cases

| Area changed | Checks to consider |
| --- | --- |
| Forms/mutations | Invalid/missing/boundary data, linked errors, pending/duplicate submission, failed-save draft retention, retry, server rejection |
| Permissions/cache | Logged out/forbidden/revoked, workspace switch, logout/login, stale in-flight responses, no private data flash, affected invalidation |
| Localization | Changed keys for all supported locales, placeholders and correct locale plural categories, fallback/load failure, live language switch |
| RTL/formatting | Arabic mixed text, menus/dialog portals, logical spacing/icons, locale dates/numbers, explicit timezone/currency, preserved canonical values |
| Layout/input | Small/tablet/desktop widths, breakpoint edges, text expansion/zoom, touch and keyboard, safe areas, scroll/focus and virtual keyboard where available |
| Security | Untrusted text/URLs, translation link props, no raw HTML execution, no private logs/bundles, denied permissions and failed API writes |
| Accessibility | Names/labels, keyboard order, dialog open/close focus, status/error announcements, contrast and scoped reflow |

Compare translation message/placeholder coverage intelligently: plural suffixes
differ by locale, so a literal all-files-identical-key test is insufficient. Check
actual plural resolution and text meaning when relevant; don't claim native
language quality based solely on key existence.

## Browser checks and evidence

Use browser tests for layout, focus, pointer, and navigation behavior. With tools
such as Playwright, prefer stable role/label locators, awaited assertions, isolated
contexts, and controlled network responses over sleeps and live third parties.
Use an isolated fixture/static UI with mocked APIs rather than starting connected
Express just to obtain a page. Browser startup hooks, auth setup, session stores,
API writes, and teardown can mutate databases and still need scoped approval.
Source: [Playwright practices](https://playwright.dev/docs/best-practices).

Automated accessibility checks should complement manual keyboard, focus, and
appropriate assistive-technology checks. Record unavailable browsers/devices and
language review explicitly. Neither passing scans nor component snapshots prove
WCAG conformance or physical-device compatibility.

Inspect `tsconfig.json`: it excludes `**/*.test.ts`, and scripts under `scripts/`
are outside its normal source includes. Running `tsx` does not prove type checking.
Choose relevant safe tests and type/build commands after inspecting current hooks.
`npm run check` runs `tsc` with an incremental cache; `npm run build` runs Vite and
esbuild and writes output. Do not automatically invoke all `test:*` scripts.

Fix introduced failures and rerun affected checks. Report exact commands/results,
mock boundaries, browser/viewport/locale coverage, security findings, and baseline
failures. Required failing/unavailable checks remain incomplete verification.
For documentation-only role/skill work, validate structure/links rather than
running application or connected-service tests.
