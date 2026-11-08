# Direct Search entry — 8 November 2026

Completed locally. User assigned a frontend task: skip the pictured welcome page
and show Search immediately. Approver/requester: user; accepting Front End
Developer/executor: `/root`. Scope: local App routing, search header behavior and
offline/mocked frontend checks. No deployment, connected API/database operations,
credentials or private configuration access.

`client/src/App.tsx` now renders Home (the existing Search page) at both `/` and
`/search`, without selecting Landing based on authentication. The existing Search
identity-loading/error handling remains responsible for safe location restoration.
`client/src/components/app-header.tsx` recognizes both paths as Search for guests
and signed-in users, including while identity loads. Logo navigation therefore
opens Search. No new content, translations, permissions or backend changes.

Verification passed:

- `node --import tsx scripts/test-guest-search.mjs --entry-only`: actual App routes,
  pending/resolved guest identity, public results, login destination and logo
  navigation in en/lv/ru. Updated the obsolete landing assertion and paginated
  search mock; reused the existing fail-on-unexpected-request fixture. The broader
  guest/backend sections were not executed.
- `node --import tsx scripts/test-search-entry-browser.mjs`: Chrome, en/lv/ru,
  390px/1280px, both entry paths; rendered Search/header, login link, no welcome
  CTA, hidden redundant mobile browse control and no horizontal overflow. This
  browser fixture renders Home/header directly; App route selection is covered
  by the component check above. APIs/geolocation/Maps are mocked and external
  network is blocked. Initial sandbox Chrome crash-handler startup failed; the
  same scoped test passed with automatically approved sandbox escalation.
- `npm run check`: passed.
- `node output/build-search-entry.mjs`: frontend production build passed with
  config/environment-file loading disabled and isolated output. Existing bundle
  size and outdated Browserslist warnings remain informational.

No new security finding in this routing change. Physical devices, assistive
technology and other browser engines were not checked. ar (including RTL), zh,
fr, de, hi, ja, pt and es remain deferred; all supported resources are preserved.

Recovery: revert only the attributable App/header changes, entry tests and this
task's documentation/build helper. Preserve existing unrelated dirty work,
including the pre-existing guest-test Audit access mock. Next: user can review
locally; publishing remains outside this task.
