# Appointment authentication return routes

3 November 2026. Requester: Frontend `/root`. Assigned Backend owner/executor:
`/root/appointment_return_routes`. **Completed / verified offline** under the
[standing cooperation authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization)
for the user's appointment navigation redesign.

Scope: exact authentication return destinations for the new Upcoming Appointments
and Past & Cancelled Appointments pages, plus isolated security regression tests.
Files: `shared/navigation.ts` and `scripts/test-auth-return-routes.mjs`.
Local repository changes/offline checks only; no services, database/session writes,
private configuration, deployment or frontend edits. Frontend `/root` owns the pages
and integrated navigation checks.

Added only `/my-services/upcoming-appointments` and `/my-services/past-appointments`
to the exact destination allowlist. No prefix, query, external-URL or descendant
allowance was introduced. Existing destinations remain supported.

Validation passed:

- `node --import tsx scripts/test-auth-return-routes.mjs`: exact calendar/new-page
  destinations; trailing slashes, descendants, suffixes, query/hash injection,
  absolute/protocol-relative/backslash URLs, traversal, CRLF, case/whitespace and
  non-string rejection; existing destination regressions.
- `npx tsc --noEmit --incremental false --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck shared/navigation.ts`.
- `git diff --check -- shared/navigation.ts` (only Git's existing LF/CRLF notice).

Security review: change preserves the exact-match redirect boundary; no secrets,
private data or new runtime side effects. Real sign-in/OAuth execution was not run.
Next: Frontend `/root` verifies the integrated routes and navigation.

Recovery: revert only this dependency's two allowlist entries and new test/handoff
files, preserving other work. Language coverage remains en/lv/ru when applicable;
ar/RTL, zh, fr, de, hi, ja, pt and es are deferred. These pure route checks contain
no localized resources.
