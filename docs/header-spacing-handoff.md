# Header JSX spacing — 2 November 2026

User specifically authorized Codex `/root` to fix the ambiguous-spacing warning
at line 23 of `client/src/components/app-header.tsx`. Scope: local frontend edit
and offline verification only; no connected services or deployment.

Wrapped the brand text in a span so the link has explicit element children.
The existing flex gap still controls spacing between the icon and name.
No authentication, data handling or translation changes are involved.

Validation: `npm run check` (TypeScript) and `git diff --check` passed.
The IDE spacing analyzer and browser layout were not rerun. No locale matrix is needed for
this markup-only change. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
Recovery: revert only the brand-text wrapper and this handoff.
