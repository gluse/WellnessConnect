# Header colors — 21 October 2026

The user specifically approved the shared header background `#20263a` and light
text/icons. Approver: user; executor: Codex `/root`; environment: local repository.
Scope: `app-header.tsx`, its account icon and service navigation, isolated frontend
verification and this record. No backend/database operations or deployment.
Recovery: revert only these header changes and this task's evidence, preserving
unrelated working changes.

The shared header now uses white text/icons, a subtle light border, lighter hover
backgrounds and white keyboard focus indicators. Its service navigation uses a
translucent background and wraps when enlarged text needs more room. Portaled
menus retain the application theme. No translations or authentication behavior
changed. No new external inputs or services were introduced.

Theme inspection found light and `.dark` CSS palettes and class-based Tailwind
support, but no application theme switch, preference persistence or system-theme
detection. The application defaults to light mode; full dark-mode support is not
established by the existing CSS alone.

Validation:

- `npx tsc --noEmit --incremental false`: passed.
- `npx vite build`: passed; existing outdated Browserslist data and large-bundle
  warnings remain.
- Temporary isolated preview using the actual header and existing
  `scripts/fixtures/browser-harness.mjs`: 48 cases passed in installed headless
  Chrome: en/lv/ru × guest/signed-in × light/dark CSS × 320/390/768/1280px.
  Checked computed background, light icons, normal text contrast and overflow;
  also checked hover, keyboard focus, menu opening/Escape/focus restoration and
  320px with 200% text. Account/session/admin responses were synthetic; unknown
  requests and writes were rejected. No external requests, runtime exceptions or
  connected application/database startup. The preview files were removed after
  verification; no permanent automated test suite was added for this color edit.
- Visually inspected [desktop](header-color-desktop.png) and
  [phone](header-color-phone.png) screenshots of the isolated signed-in header.

Chrome needed execution outside the filesystem sandbox because its crash handler
could not launch inside it. Physical devices, screen readers and other browser
engines were not tested. Arabic (including RTL), Chinese, French, German, Hindi,
Japanese, Portuguese and Spanish remain deferred per the user's test scope.
No supported translations were removed. No unresolved security findings were
identified in the changed styling; this was not an application security audit.

Local implementation is complete; no deployment was requested or performed.

## Shared palette follow-up

On 21 October 2026 the user specifically requested moving `#20263a` into the
shared palette. Approver: user; executor: Codex `/root`; environment: local
repository. Approved scope: shared frontend color token, Tailwind mapping,
header references and offline validation. Recovery: revert only this follow-up.
`client/src/index.css` now defines `--header-background: #20263a` once, inherited
in both theme styles. Tailwind exposes it as `bg-header`; the header also uses
the token for its local focus-ring background. Appearance remains the same.
No translations, backend/database operations or deployment are included. Existing
language deferrals above continue to apply; no fresh locale/browser coverage is
claimed for this token extraction.

Follow-up validation passed: `npx tsc --noEmit --incremental false`,
`npx vite build`, scoped `git diff --check`, and inspection of generated CSS for
the `bg-header` utility and token-based focus background. The same build warnings
listed above remain.
