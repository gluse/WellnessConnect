# Audit review and completion — 7 November 2026

## Authorization and ownership

The user requested review/completion of pending Audit tasks and an application
Audit section with understandable queries and records, granting full permissions
and explicitly directing **no database backup**. This authorizes necessary audit
frontend, backend, database-file and development database work in this task.
Existing source `hbkooiknruimukkhshrk` and independent destination
`ynygqodmtgjrngiudalw` remain the targets; no production deployment or new paid
infrastructure is inferred. Preserve existing stop-on-failure and uncertain-commit
reconciliation rules. No backup is created or claimed.

Root owns integration, viewer API/read runtime, task records and review.
Assigned Front End Developer `/root/audit_frontend` owns frontend and translations;
Back End Developer `/root/audit_backend` owns producers and backend tests;
DB Analyst/Developer `/root/audit_database` is the sole connected database executor
and owns versioned migrations, restricted reader provisioning and database checks.
All owners accepted under AGENTS.md standing cooperation. Existing unrelated
report/location work must be preserved.

## User workflow and safeguards

Open **Administration → Audit**, or `/administration?section=audit`. Audit readers
have independent named server-side access. Directory/billing administration stays
separately protected. One-time development bootstrap copies the currently named
administrator into explicit reader/export lists; future administrators are not
automatically audit readers. Separate export permission is enforced on the server.

Apply a UTC date range and optional activity, outcome, user, workspace, object,
source, request or operation filters. The applied query is understandable filter
text, not executable SQL. Read event details, redacted changed-field indicators,
and related request/object history. Protected access itself must be durably
captured before records leave the API. There are no ordinary event-edit/delete
controls. CSV export includes at most the newest 1,000 matching records, with
spreadsheet-formula escaping. Local downloaded exports remain the reader's
responsibility and are not a server-side indefinite copy.

The API uses strict parameterized filters, a maximum 366-day window, pages up to
100 entries, stable time/ID cursors bound to the applied query, no-store responses,
bounded read concurrency/timeouts and a separate verified-TLS SELECT-only reader.
Invalid filters do not query the database; denied reads/exports never expose rows;
capture/read failures produce safe unavailability responses. Reader configuration
never falls back to writer or owner credentials.

## Evidence and status

The development database extension and viewer integration are implemented.
The final Audit TypeScript/build, browser and focused regressions passed. Audit
tasks are closed only to their verified acceptance scope; remaining legal,
provider-native and production operational requirements are listed separately.

Root checks completed so far:

- `node --import tsx scripts/test-audit-viewer.mjs`: passed. Synthetic loopback
  HTTP with injected database/capture; permissions and independent export,
  query bounds/injection rejection, cursor normalization and query binding,
  formula escaping, TLS/principal configuration rejection, capture failure and
  mid-request permission revocation. Loopback network escalation was required.
- `npm run check`: passed after correcting the new reader iterator for the
  repository TypeScript target, including the final integrated run.
- Existing `test-audit-worker.mjs` and `test-audit-worker-loop.mjs`: passed with
  mocked ports. Updated event registry regression passed, rejecting 105 invalid
  inputs. Durable remote Auth tests passed 76 cases; integration/job checks passed
  with mocked effects. No real provider login/signup/email/charge is claimed.
- `node --import tsx scripts/test-audit-reads.mjs`: passed synthetic HTTP tests
  proving protected JSON/text reads await capture, fail closed, omit private
  response bodies from evidence, preserve personal/company/admin scope, and
  leave public browsing uninstrumented. Domain 401/403 responses are captured;
  capture failure never grants access. Request-level denials are deduplicated.

### Applied development state

DB owner applied the pinned destination-first and source completion-v1-0008
migrations. Both exact parser bodies and inert setup owners were verified;
26 business tables have enabled CRUD triggers. A dedicated verified-TLS reader
can SELECT only the unexpired audit view, without base-table access, permanent
DDL, writer rights or extra role memberships. Explicit bootstrap created one
named reader and one named exporter; no UUID or credential is published here.

The first rollback rehearsal failed on a circular ADMIN grant in its rehearsal
helper. Metadata proved rollback; the revised helper passed 16 valid/13 rejected
contracts per target, selected retention and source CRUD/failure atomicity. Applied
SQL/pins remain unchanged. The initial committed runtime test stopped after three
synthetic category changes, before worker delivery. Its category was deleted in
the same committed transaction; evidence was retained.

The DB agent then became unavailable due to a usage limit. Root's proposed
temporary owner grant for reconciliation was rejected by automatic approval
review. That approach was abandoned. Root reconciled and completed verification
with existing restricted app/capture/worker/reader accounts, making **no ACL
changes and no repeated business mutations**:

- `verify-completion-runtime.mjs inspect`: pending6, no leases/quarantine/expiry;
  zero destination records for the fixed synthetic test.
- `verify-completion-runtime.mjs deliver-existing`: six existing outbox entries
  delivered, no failures/retries/quarantine; all three retained synthetic CRUD
  events found by the actual SELECT-only viewer.
- `verify-completion-runtime.mjs verify-capture`: one fixed synthetic viewer
  event captured twice identically; one delivered record, canonical hash retained,
  original source category absent; final queue counts/failures zero.
- `complete-audit-development.mjs activate`: exact installed parsers/26 triggers
  checked, protected `.env` marker `completion-0008` and Auth producers enabled.
  All tool-created pools closed; no daemon or production deployment started.

Synthetic provenance: category `audit-completion-check-0008`, run
`00000008-0000-4000-8000-000000000009`, viewer event
`00000008-0000-4000-8000-000000000008`. Preserve these labels; they are acceptance
evidence, not historical customer activity. Runtime verification uses fixed modes
and stops on failure; do not rerun fixture/capture modes blindly.

### Startup error found and fixed

The user encountered `workspace_pricing_database / WORKSPACE_PRICING_DB_NOT_READY /
expected_audit_parsers`. The new migration preserved the old parser as
`parse_event_before_completion`, while the current app readiness profile still
expected its hash under `parse_event`. Current integrated readiness now pins the
reviewed completion parser **and** its preserved legacy chain. Historical
installation profiles and applied SQL are unchanged; the check was not disabled.

`node migrations/workspace-pricing/test-readiness.mjs` and startup diagnostic
regressions passed. `node migrations/audit/verify-application-startup.mjs` passed
all 32 integrated plus two currency gates against the restricted development
application login using only read-only metadata queries. Restart the app to load
the corrected check and producer configuration; restart/run the updated worker
with `npm run audit:worker` to keep new records flowing.

Required language tests cover **en, lv, ru only**. Arabic/RTL, Chinese, French,
German, Hindi, Japanese, Portuguese and Spanish verification is deferred; their
supported translations must still be maintained.

## Limits and recovery

Current detailed evidence: [database](audit-database-completion.md),
[producers and coverage gaps](audit-producers-completion.md), and
[viewer/frontend](audit-viewer-frontend-completion.md).

Final `npm run build` passed (existing large-chunk and stale Browserslist data
warnings). The exact current registry's37 activity labels,20 protected-read labels
and plural interpolation were verified for en/lv/ru. Chrome passed the9 scoped
locale/width cases plus12 concrete new activity/attribution cases and the access/
stale-response matrix. Existing administration and isolated storefront regression
passed. The broader category and guest runners still encounter documented
unrelated stale-selector/old-search-response assumptions; these are not claimed
as passing checks. No fresh deferred-language coverage is claimed.

The viewer is implemented and development database acceptance passed. Broader
tasks remain open for human attribution of generic mutations, provider-native
sources and uncovered storage/maintenance paths, production alerting/restore/
rollout, and browser location wiring plus qualified legal review. The existing
location UI was deliberately not silently redesigned under an audit rollout;
the prepared report endpoint alone does not complete TASK-025.

An audit record describes observed evidence, not certainty beyond its source.
Database-trigger events must explicitly identify a database runtime when the
human is unknown. Browser location observations are client reports, not verified
OS decisions or legally reviewed consent. Provider-native logs, external alert
delivery, production rollout and independent legal/restore acceptance must not
be claimed from offline tests or development migrations.

Recovery preserves accepted history and applied/pinned SQL. Disable new producers
and close/restart incompatible workers before reverting application code; use
forward fixes for database changes. Revoke named reader/export entries to remove
viewer access; do not substitute a privileged credential. Preserve existing
private setup recovery material. Investigate uncertain commits before another
write; do not automatically retry failed installation or erase captured evidence.
