---
name: frontend-practices
description: Implement, test, and review WellnessConnect / FitsMyTime frontend work using React, TypeScript, Vite, Tailwind, Radix, TanStack Query, and i18next. Use for UI components, forms, browser behavior, security, multilingual/RTL interfaces, accessibility, and responsive device support; not backend-only work, database operations, or infrastructure deployment.
---

# Frontend practices

Official framework, W3C, browser, and OWASP guidance reviewed on 18 October 2026.
This project-local skill supports implementation/review; it does not establish
that existing interfaces are secure, accessible, translated, or tested.

## Authority and context

- Read project-root `AGENTS.md` and `ROLE-FRONT-END-DEVELOPER.md`. Preserve the assigned
  role/task and scoped approvals. Loading this skill does not assign the role or
  authorize frontend changes by other agents.
- Preserve backend, database, and CI/CD boundaries. Browser/API tests can write
  session/application records; use offline fixtures/mocked APIs unless the exact
  live operations and environment are authorized under the applicable role rules.
- Use `AGENTS.md` cross-role cooperation and `docs/agent-coordination.md`: contact
  Backend, DB or CI/CD directly for dependencies, check recorded approvals before
  escalating, and implement accepted local frontend requests without another user
  approval. Return verification evidence and check the integrated contract.
- Inspect the manifest/lockfile, existing components, locales, styles, query
  helpers, and test scripts. Keep current architecture and versions unless an
  upgrade is in scope. Read-only review does not approve implementation.

## References to load as needed

- State, data fetching, forms, performance, browser security, version baseline:
  [development and security](references/development-security.md).
- Translations, plurals, language selection, formatting, RTL and mixed direction:
  [internationalization](references/internationalization.md).
- Responsive layouts, input modes, accessible controls, reflow and browser matrix:
  [devices and accessibility](references/devices-accessibility.md).
- Component/browser/regression checks and safe verification commands:
  [testing](references/testing.md).

## Working approach

1. Trace the user flow and data/permission boundaries. Establish affected locales,
   layouts, controls, and API behavior; separate confirmed code behavior from
   assumptions about devices or live services.
2. Reuse the existing design system and shared helpers. Prefer native semantics
   and small cohesive components; preserve deliberate product behavior and avoid
   broad rewrites, new frameworks, or speculative abstractions.
3. Include loading, empty, error, denied, pending, and successful states. Protect
   private data/caches and drafts across account, workspace, route, and language
   changes. Coordinate contract changes with the responsible role.
4. For changed user-facing content/layout, check translations and accessible names,
   text expansion, RTL, formatting, keyboard flow, zoom, and touch behavior in the
   relevant references. Do not treat a translated string as a complete localized UI.
5. Write meaningful tests, run safe affected checks, and inspect rendered browser
   behavior for visual/input changes when available. Mock external boundaries;
   don't mock the behavior under test or mistake snapshots for accessibility proof.
6. Review the final diff for security, scope, compatibility, and localization.
   Report tests/results, actual browser/locale coverage, unavailable checks,
   approvals, recovery, and remaining risks. Required failures/unavailable checks
   remain incomplete verification; documentation-only updates need no UI tests.

Recheck official documentation when APIs, security guidance, or browser support
matter. Keep review dates/source links with updates. Skill files on disk and
project routing do not prove automatic discovery in every other session.
