# Audit producer completion — 7 November 2026

Authorization, selected policy, connected evidence and recovery are in the
[current completion record](audit-review-completion-2026-11-07.md). User explicitly
authorized necessary audit work without a database backup. Backend accepted the
producer scope; Root completed integration after delegated agents hit a usage
limit. This is development implementation, not a production/provider audit.

## Implemented evidence

| Producer | What the user can learn | Evidence limit |
| --- | --- | --- |
| Existing Auth/security hooks plus `auth.operation_requested.v1` / `auth.operation_reported.v1` | Sign-in/signup, OAuth start/callback, recovery/invitation Auth, password checks/changes, session refresh, logout and profile-provider requests/outcomes | Durable request precedes a remote effect; response describes the observed provider reply. Missing/unknown reply requires reconciliation. This is not provider-native log ingestion or an atomic cross-service transaction. |
| Existing account active-role / billing producers | Verified actor, selected workspace, outcome and allowlisted changes/correlation | Existing detailed producers retain their own reviewed contracts. |
| `data.record_created/updated/deleted.v1` | Actual committed record creation/change/deletion and redacted changed-field names on 26 business tables | Triggered in the same transaction; local capture failure rolls back the mutation. Actor is explicitly database-runtime and workspace unknown. Human attribution is not inferred. No row values are copied. |
| `activity.records_read.v1` | Access to account profile, user directory, addresses, employees, provider services/bookings/schedules, company/team/invitations, booking conversations/reschedules/availability, communication/booking notifications, saved services and inbox | Explicit protected GET routes wait for capture before JSON/text data is returned. Personal/company/support scope is derived from verified request context. Paths, request bodies, query text and response bodies are excluded. |
| `security.action_denied.v1` | Authentication/authorization/origin/rate-limit failures, including domain handler 401/403 responses | One denial per request; missing capture never grants access. Not every invalid business input is a security denial. |
| `integration.operation_requested/reported.v1` | Search embedding and address-geocoding calls, notification worker batches and activity worker batches | System actor, safe fixed operation name; no inputs/provider payloads. Geocoding success requires HTTP success, Google OK and usable coordinates. Exceptions remain unknown. |
| `audit.records_viewed/exported.v1` | Audit access/export by an explicitly named support reader | Protected capture before release; R90, no query/private filter contents in the audit payload. |
| `location.observation_recorded.v1` endpoint | Strictly bounded client-reported request/permission/remember/withdrawal observations | Endpoint and policy are prepared/tested. Existing browser flow is **not wired** in this change; no location-consent rollout or legal acceptance is claimed. |

Business tables: users, companies, company memberships/invitations, services,
addresses, employees, availability, bookings, reviews, categories, storefronts,
provider subscriptions, workspace pricing, booking messages/reschedule requests,
manual Pro grants, billing offers/settings/accounts/subscriptions/operations/
invoices/events/price mappings, and service embeddings. Full manifest is
`BUSINESS_TABLES` in `migrations/audit/completion-package.mjs`. Location coordinates,
addresses, text, tokens, passwords and provider responses are not retained as
change values; field-name indicators may show that such a field changed.

## Verification

- `test-audit-events.mjs`: passed, explicit reviewed 37-event registry and 105
  invalid-input rejections.
- `test-audit-auth.mjs`: passed actual handler composition over mocked
  Auth/DB/session boundaries, including local role-change rollback and denials.
- `test-audit-remote.mjs`: 76 cases passed, durable intent, report pairing,
  fail-before-effect and uncertain/report failures; password-saved and local
  logout behavior remain honest when a later audit step fails.
- `test-audit-integrations.mjs`: 20 cases passed, synthetic effects and actual
  integration functions over mocked HTTP. No paid provider/worker job was run.
- `test-audit-producers-completion.mjs`: 105 policy/HTTP checks passed; locale
  cases limited to en/lv/ru.
- `test-audit-reads.mjs`, `test-audit-viewer.mjs`, worker/loop/activation tests:
  passed. Loopback tests needed network escalation but used no external services.
- Connected trigger/transport evidence is in the current completion record;
  it does not prove live Auth provider flows or native provider logging.

## Remaining acceptance

TASK-015: provider-native Auth correlation and fully attributed account/access
changes remain to be completed; generic database evidence is not a substitute.
TASK-016: trusted per-transaction human/workspace attribution and reviewed safe
value comparisons remain beyond redacted CRUD coverage. TASK-017: protected
storage reads, all cleanup/maintenance/migration scripts and native provider/DB
sources still need reviewed producers. TASK-025: browser wiring, replay/guest
evidence and qualified legal acceptance remain open. These gaps are material;
do not mark those entire tasks complete from the tests above.

All other language/RTL verification remains deferred under AGENTS.md. There is no
new dependency, deployment, provider configuration, live account action or backup.
