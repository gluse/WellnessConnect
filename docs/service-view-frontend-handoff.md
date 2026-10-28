# Explicit service-details notification: Frontend

Frontend owner/executor `/root/service_view_frontend` accepted Root's scoped
23 October 2026 assignment under [standing owner authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Scope: reversible local frontend implementation and isolated mocked checks for
the [single service-view contract](audit-service-view-execution.md), sequentially
after Backend/DB preparation. No other owner was contacted or spawned.

Only this task's production edits are the `apiRequest` import and the `details`
callback in `client/src/pages/home.tsx`. Existing unrelated search/location edits
are preserved. The existing modal state opens immediately; valid positive int32
IDs produce one `POST /api/services/:id/view` through the shared transport, with
no body/query/extra identity/search/location fields. A rejected notification is
caught silently; no retries, audit error UI, or cache mutations are added.
Existing card native-button activation, map selection and provider catalog
explicit details all use the same callback. Rendering, fetching/searching,
provider-only opening and booking remain outside it. No copy/style/translation,
backend, database, private configuration or deployment changes were made.

Verification:

- `node --import tsx scripts/test-service-view-ui.mjs`: passed. New focused test
  uses actual Home/children and `apiRequest` with synthetic fetch, Maps, auth
  cache, location cookie and React renderer. It checks exactly one body/query-free
  request per activation, modal opening with an unresolved request, network/HTTP
  failures leaving it open, no retry, the three callback paths, invalid-ID
  rejection, unrelated-action exclusions, and en/lv/ru behavior. No unexpected
  requests occurred. The Maps loader emits its expected synthetic-loader notice.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.

These are mocked component checks only: no live Express listener, Auth/session,
database/service writes, actual browser layout/focus/keyboard synthesis, physical
devices, screen readers or deployment were exercised. The native button and
existing keyboard handler path are preserved; the renderer does not prove
browser keyboard behavior. ar (including RTL), zh, fr, de, hi, ja, pt and es are
deferred. No new security-policy decision or sensitive client payload was added.

Activation remains Root/DB's next action under the [execution record](audit-service-view-execution.md):
keep `AUDIT_SERVICE_VIEWS_ENABLED` off until the approved DB extension and updated
worker verification are complete. A 204 response alone never proves capture.
Recovery: remove only the import/callback addition and this task's new focused
test; preserve all unrelated working changes and existing audit evidence.
