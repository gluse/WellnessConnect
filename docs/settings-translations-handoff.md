# Provider settings translations — 8 November 2026

Completed locally. `/my-services/settings` now updates its settings heading,
description, Profile & employees / Team & access links, accessible navigation
name, loading/failure/permission/not-found states and profile/employee forms when
the interface language changes. The form includes translated provider-type
options, labels, helpers, placeholders, visibility labels, actions and receipts.
Unsaved names, provider-type selection and visibility choices survive a language
change. User/company/employee names remain user content.

## Assignment, approval and boundaries

Requester/coordinator `/root` assigned Front End Developer
`/root/settings_translation_frontend` under AGENTS.md standing cooperation for
the user's settings translation bug. The owner accepted local frontend code,
supported locale resources and isolated synthetic verification. Root also
accepted the necessary type-only `use-toast.ts` correction described below.
No backend/database/private configuration changes, connected access, deployment,
publishing, spending or real session/application writes were performed.

Existing settings pricing/address navigation changes and all other dirty work
were preserved. Before editing, the settings/profile files and locale resources
were copied to the task-specific temporary snapshot
`fits-settings-translation-06d108e82df248899162274241291f22`.

## Cause and changes

`client/src/pages/provider/settings.tsx` used English literals around otherwise
translated child panels. `client/src/components/provider-profile.tsx` had no
translation subscription and used English literals for the entire profile and
employee UI. Both now resolve semantic messages during rendering.

The `providerSettings` namespace adds 33 messages to every supported locale.
Existing common, saving, removal and generic save-error messages are reused.
Language-changing toast content uses react-i18next `Translation` components;
`ToasterToast` now omits the inherited HTML `title: string` before declaring its
existing `title: ReactNode` intent. This type-only change permits the content the
existing Toaster already renders and changes no toast runtime behavior.

Save failures show a localized generic retry message instead of untranslated
raw server details. Failed drafts remain intact. Existing request paths,
canonical provider-type values, payloads and permission gates are unchanged.
Navigation/save labels can wrap to accommodate translated text.

## Verification

- `node --import tsx scripts/test-settings-translations-browser.mjs` passed in
  Chrome 156: four behavior groups and 12 en/lv/ru form viewport cases at
  320/390/768/1280 pixels. This covers live language switching without remounting,
  draft/selection retention, labels/options/placeholders/helpers/navigation names,
  translated pending/success/failure receipts, rejected-save retention, synthetic
  employee edit/add/remove payloads, empty/loading/load-failure, individual/company,
  permission/team hint and not-found states. No clipping/page overflow, unnamed
  visible form controls, unexpected requests or browser exceptions were found.
- `node node_modules/typescript/bin/tsc -p scripts/fixtures/tsconfig.settings-translations.json`
  passed, including both affected components, the shared toast hook and fixture.
- `node --import tsx scripts/test-account-details.mjs --frontend-only` passed;
  the runner exits before loading its backend section.
- An isolated Vite frontend production build passed with `configFile: false`,
  `envFile: false`, React plugin, existing aliases, a task-specific environment
  prefix and temporary output directory. No project private environment files or
  privacy-policy environment-loading plugin were loaded. The build reported the
  existing stale Browserslist-data and large-chunk warnings.
- Scoped `git diff --check` passed.
- `npm run check` remains failed on unchanged native code: TS2802 at
  `client/src/native/client.ts:24,83` and `server/native-proof/service.ts:88,89`,
  plus TS2322 at `client/src/native/client.ts:34`. `git diff --exit-code` confirmed
  both files and `tsconfig.json` are unchanged. The focused settings TypeScript
  check has no diagnostics; no unrelated native fixes were made.

The first sandbox Chrome launch failed because its crashpad child process could
not start. The same isolated runner succeeded after automatic review allowed its
scoped execution outside the sandbox. No approval rejection or connected retry
occurred.

Evidence: [browser checks](settings-translations-chrome-evidence.json),
[Latvian phone view](settings-translations-chrome-phone.png),
[Russian desktop view](settings-translations-chrome-desktop.png).
Root independently reviewed the code, fixture, evidence and both screenshots.

Tests use the actual SettingsPage, ProviderProfile, i18next and query behavior in
a loopback fixture with synthetic in-memory fetch responses. An isolated receipt
wrapper renders actual toast React content; native toast animations and
screen-reader announcements are not covered. No live provider/session/database
operation occurred. No new raw HTML, credentials, external redirects or client
permission grants were introduced.

Only en/lv/ru received fresh testing. ar (including RTL), zh, fr, de, hi, ja, pt
and es verification remains deferred. Their supported messages are maintained;
no native linguistic review or fresh browser/locale coverage is claimed for them.
Firefox/WebKit, physical devices and assistive technology were not exercised.

## Recovery and next action

Revert only this task's settings/profile/toast-type hunks and the
`providerSettings` namespaces; remove only its new fixture, regression script,
scoped TypeScript config and handoff/evidence artifacts as appropriate. Preserve
pre-existing pricing/address links, locale edits and unrelated concurrent work.
No data recovery is needed. Root owns integration/task records; no deployment is
included. Resolve the baseline native full-project TypeScript failures separately
before claiming a passing repository-wide type check.
