# App users service-provider status — TASK-051

## Scope and authorization

8 November 2026 user request: show whether each App user is a service provider
when opening App users from `/administration`. This is specific user approval for
Frontend executor `/root` to change that page, supported translations and isolated
frontend tests locally. Root accepts that scope. Backend dependency requested from
assigned Back End Developer `/root/admin_provider_backend` under AGENTS.md standing
cooperation; backend owns `shared/admin.ts`, directory application queries, routes,
backend tests and its separate handoff. Root owns integrated review and task records.

Allowed operations: reversible repository edits and offline/mocked validation.
No connected authentication/session/database/service operations, protected
configuration reads, app startup, deployment or publishing. No schema changes.
Recovery: revert only TASK-051 patches, preserving unrelated dirty work.

## Contract and verification

Add a localized Service provider column beside the user's name. Show Yes for
the authoritative personal provider role, No for seeker, Unknown for missing or
unrecognized roles. Pro, company affiliations and service count are separate.
Keep existing support authorization, filtering, paging and refresh behavior.

Implemented and verified locally. Backend owner accepted and completed the
dependency; root reviewed the protected API/DTO/query diff and independently
reran the focused backend regression. See
[backend evidence](admin-provider-status-backend-handoff.md).

Passing checks:

- `node --import tsx scripts/test-administration.mjs --frontend-only`: existing
  auth/access/loading/paging/filter/refresh/error regressions plus explicit
  true/false/null/absent provider values; company/Pro remain independent.
- `node --import tsx scripts/test-admin-provider-status-backend.mjs`: authoritative
  role mapping, metadata isolation, bounded bulk queries and sanitized failure.
- `node --import tsx scripts/test-administration.mjs`: full inspected mocked
  frontend/backend administration regression passes, independently rerun by root.
- `node --import tsx scripts/test-admin-provider-status-browser.mjs`: real
  Administration component and bundled transitive components with in-memory
  synthetic APIs; three behavior groups and nine en/lv/ru viewport cases at
  320, 768 and 1280 CSS pixels. Checks Yes/No/Unknown, semantic column heading,
  page reflow/table scrolling, live language change, provider activation after
  Refresh, pending refresh, hidden stale results on failure, retry, access
  revocation, initial denial and empty results. Chrome required sandbox elevation
  after crashpad failed to start in the sandbox; no connected application ran.
- `npx tsc --noEmit --project scripts/fixtures/tsconfig.admin-provider-status.json`:
  affected frontend and transitive types pass. Browser fixture bundle passes.
  Backend owner separately verified scoped backend types and in-memory bundle.
- Scoped `git diff --check`: passed. Root inspected actual phone and desktop
  screenshots; the existing table scroll contains overflow on narrow screens.

Full `npx tsc --noEmit --incremental false` reproduces the five previously recorded
native-proof baseline errors in `client/src/native/client.ts` and
`server/native-proof/service.ts`; no new administration diagnostics. This task's
affected checks pass, while the full-project type-check remains failed.

[Chrome evidence](admin-provider-status-chrome-evidence.json),
[desktop screenshot](admin-provider-status-chrome-1280.png),
[phone screenshot](admin-provider-status-chrome-320.png).

New labels are maintained in all supported translation resources. Tests restricted
to en/lv/ru; ar (including RTL), zh, fr, de, hi, ja, pt and es verification remains
deferred. Chrome only; no fresh Firefox/WebKit, physical-device, screen-reader or
live database coverage. No new security issues identified within the small changed
surface: ordinary React text, server-derived role and existing admin access gates.
This is local implementation, with no deployment or live-service verification.
Next action is normal application review; no database migration is required.
