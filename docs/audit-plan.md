# Audit plan

Status: proposed plan for TASK-013 through TASK-019. No audit database, event
collection, or new credentials are created by this document.

## Purpose and scope

Provide a reliable history of who attempted an action, which account/workspace
and record it affected, when it happened, whether it succeeded, and what changed.
Use that history for support, incident investigation, access reviews, and finding
unexpected changes. This plan concerns activity auditing; a broader application
security assessment is separate work.

Aim to cover every business mutation, security decision, and sensitive read.
Keep a versioned event catalog and a coverage matrix containing the source
route/job, event name, capture point, allowed fields, retention class, owner, and
test. An event is covered only when a real execution path and its failure cases
have been verified. Public views and clicks belong in optional product analytics
unless a specific audit need justifies recording them.

## Storage recommendation

| Option | Advantages | Tradeoffs |
| --- | --- | --- |
| Dedicated schema in the application database | Simple queries and transactions; lowest operational overhead | Shared database owner, capacity, backups, and failure boundary |
| Separate PostgreSQL database with separate credentials | Independent access, retention, and storage lifecycle | Needs reliable delivery; a database on the same server still shares infrastructure |
| Separate database on independent infrastructure, such as another Supabase project | Stronger separation from the application database and its administrators | Additional hosting, monitoring, backup, and credential management |

Recommended target: a separate PostgreSQL database, preferably independently
hosted if the desired isolation and budget justify it. Choose the host during
TASK-013. A separate table or schema alone does not provide the same isolation.
Use a dedicated server-side connection such as `AUDIT_DATABASE_URL`; never expose
it to the browser or reuse application-user credentials for audit administration.

Do not write the application database and audit database independently within a
request: either write could succeed while the other fails. Use this process:

1. Validate permissions and perform a business change in the application database.
2. Insert its sanitized audit event into an `audit_outbox` in the **same transaction**.
3. Commit both together. A rolled-back change must not produce a success event.
4. A worker delivers committed outbox events to the audit database in batches.
5. Deduplicate by event UUID at the destination, then acknowledge local delivery.
   Delivery is at least once; an acknowledgement failure must be safe to retry.
6. Retain delivered outbox entries briefly for recovery, then purge on schedule.

The destination may be temporarily unavailable while changes continue to commit
with durable outbox entries. Monitor oldest pending age, queue size, retries,
delivery lag, and storage growth. Alert on sustained failure, quarantine malformed
events for investigation, and provide replay without silently dropping records.
Bound backlog growth and document behavior before application storage is exhausted.
Capture must be durable even if the process stops immediately after the response.

Failed/denied requests need a separate event transaction because their business
transaction may roll back. Do not undo an already committed change when recording
its failed response. Distinguish rejected, failed, succeeded, and unknown outcomes;
for remote Auth/payment operations, an interrupted response can require reconciliation.
The outbox cannot make a remote provider operation atomic with a local transaction.

## Event contents

| Field group | Proposed contents |
| --- | --- |
| Identity | Event UUID, event-schema version, action such as `booking.rescheduled` |
| Time | Occurred-at and received-at timestamps in UTC; display timezone explicitly |
| Actor | Authenticated user ID or named system/job identity; anonymous when unknown |
| Scope | Server-validated personal/company workspace, effective role, source application/environment |
| Target | Object type and stable object ID; related IDs for shared/bulk actions |
| Outcome | Success, rejected, denied, failed, or unknown; safe reason/error code |
| Changes | Changed field names and allowlisted before/after values |
| Correlation | Request/trace ID, job/run ID, parent event, operation/idempotency reference where applicable |
| Request context | Route template, method, status, duration; limited IP/user-agent context only if justified |

Preserve IDs as historical references without foreign keys to live application
records across databases. A deleted account or service must not cascade-delete
its history. Capture the actor and workspace at action time, rather than inferring
them later from current memberships. Do not copy full user profiles into events.

Generate trusted identity, scope, outcome, and timestamps on the server. Use
transaction-scoped context for database triggers with pooled connections; never
leave an actor attached to a reusable database session. Include job identities
for scheduled changes. Record database principal/source for direct SQL activity
when a human application actor is unavailable; do not invent attribution.

## Coverage matrix

| Area | Events to cover |
| --- | --- |
| Authentication | Signup; login success/failure; social callback success/failure; logout; session expiry/revocation; recovery requests and outcomes; password changes; rate-limit blocks |
| Accounts and workspaces | Name/profile/provider-type changes; company creation/rename/activation; workspace switches; account restriction/unrestriction and deletion when available |
| Company access | Invitation creation/revocation/acceptance/expiry; membership and role changes; employee linking; member removal; ownership transfers; cross-workspace denials |
| Services | Create/edit/copy/delete; publish/unpublish; category, price, duration, cleanup, booking-policy, employee, image, link, and address assignment changes |
| Saved addresses | Create/edit/delete; verification attempt/outcome; manual-coordinate changes; cache hit/miss; verification expiry and cleanup; shared-address impact through the address ID |
| Employees and schedules | Employee edits/deletion; recurring hours; specific-day overrides; breaks/timezones; schedule removal; service assignment and bulk schedule replacements |
| Bookings | Create/confirm/reject/cancel/complete; reschedule; participant/resource changes; conflict rejections; payment-state changes; snapshot and pricing changes where supported |
| Reviews | Create/edit/delete; rating/comment-field changes without retaining raw comment text by default; rejected duplicates and unauthorized edits |
| Categories and storefronts | Category changes/deletion conflicts; storefront settings, slug, branding, and publication; access blocked by plan expiry |
| Subscriptions and administration | Pro grants/changes/revocation/expiry; administrator actions; user-directory/detail access; sensitive settings and data exports |
| Storage | Upload authorization and outcome where observable; image association/replacement/deletion; protected-file authorization denials and successful sensitive downloads; available provider-side events |
| External services | Geocoding and embedding requests, outcomes, duration, cache reuse, quota failures, and safe provider correlation IDs; no raw provider payloads |
| Background and operations | Cleanup start/end/failure with counts; backfills; embedding batches; migrations; maintenance scripts; deploy/config version references; failed/retried jobs |
| Audit system | Viewer access and exports; permission/config changes; delivery outages/recovery; retention runs; replay, integrity checks, and restore verification |
| Future features | Payment/refund/webhook outcomes and duplicate rejection; notification/SMS delivery; discounts/campaign changes; new admin powers, when implemented |

Capture at the domain/storage transaction boundary for successful changes so that
different API routes, jobs, and scripts cannot bypass auditing. Use request/auth
instrumentation for attempts, denials, and sensitive reads. Inventory triggers or
database-native audit facilities for direct SQL and privileged access that bypass
the app. Scope those facilities deliberately: they may capture sensitive query
parameters and will need separate access and retention rules.

Combine source records deliberately. Application events provide user/workspace
intent; Supabase Auth, Storage, and database logs provide provider-side activity
where available. Identify how each source is collected, correlated, and monitored,
and document gaps rather than assuming application middleware sees everything.

For multi-record updates, correlate a parent operation with per-record events or
a bounded safe change manifest. Record actual committed differences, including
bulk updates and shared-address changes. Use an operation ID to investigate a
customer retry without counting duplicate delivery as a new business action.

## Safe data and retention

- Use an explicit field allowlist per event. Never store passwords, tokens,
  cookies, invitation/recovery URLs, API keys, connection strings, card details,
  authorization headers, or full request/response bodies.
- Record sensitive/free-text changes using IDs and changed-field indicators
  unless their contents have an approved audit purpose. This includes booking
  notes, review comments, names, emails, exact addresses, and location histories.
  Do not create an indefinite extra copy of expiring geocoding data in audit logs.
- Keep public browsing/search analytics separate, with aggregation or sampling
  where appropriate. Do not sample required security or business-change events.
  Avoid raw search text, precise seeker locations, and persistent device tracking.
- If identifying repeated anonymous attempts is necessary, use an approved
  short-lived identifier, such as keyed hashing, rather than retaining raw email
  addresses or assuming a plain email hash makes them anonymous.
- Choose retention separately for business/security events, sensitive request
  context, and delivered outbox entries. Set explicit durations during TASK-013;
  no indefinite retention by default. Include replicas, backups, exports, and
  deletion/anonymization procedures in the policy.
- Treat retention deletion as a privileged, scheduled operation with counts and
  a reason. Do not add ordinary edit/delete controls to the event viewer.

## Access, integrity, and the viewer

Separate destination writer, worker-delivery, read-only viewer, and maintenance
credentials. Restrict direct browser access. The application writer must not be
able to update/delete/truncate accepted audit events or change their permissions.
Restrict updates to outbox delivery state to the worker/maintenance path.

Give global audit access only to designated support/security roles. If company
managers get a view, enforce workspace scope in the backend and define which
event classes and fields they can see. Do not equate every existing administrator
permission with permission to read all audit data. Audit accesses and exports,
without recursively auditing the worker's own event inserts and internal reads.

The viewer should filter by time range, actor, workspace, target, event/action,
outcome, source, and request/job ID. Provide server-side pagination, object history,
safe field comparisons, and clearly displayed timezones. Gate and bound exports,
escape spreadsheet formulas in CSV, and record who exported which scope.

Append-only permissions protect against ordinary application edits, not a database
owner or compromised maintenance account. Evaluate independent immutable archives
or externally anchored signed/hash summaries if stronger tamper evidence is needed.
Document the chosen threat model and verify restore/retention behavior against it.

## Delivery stages and operating process

1. **TASK-013:** Inventory sources; define the event catalog, ownership, coverage,
   privacy/retention policy, and storage/access decisions.
2. **TASK-014:** Build schema/outbox/worker and verify retries, rollback, deduplication,
   outages, permissions, and observable delivery before broad instrumentation.
3. **TASK-015:** Cover identity, permissions, ownership, restrictions, and denials first.
4. **TASK-016:** Cover every business mutation and administrative data change.
5. **TASK-017:** Add sensitive reads, integrations, scheduled work, scripts, and
   provider/database sources; list any remaining blind spots explicitly.
6. **TASK-018:** Deliver controlled investigation and export tools.
7. **TASK-019:** Run the full acceptance matrix, document incident/recovery procedures,
   and enable production collection with monitored delivery and retention.

Name an owner for audit reliability and an owner for reviewing high-risk activity.
Alert promptly on audit delivery failures, unexpected privilege/ownership changes,
repeated authorization denials, and unusual export activity. Set review cadence
and escalation thresholds during implementation. Investigations should identify
affected actors/objects, correlate events, record findings/actions, and close with
a tracked outcome. Review coverage whenever adding a route, job, or integration.

Acceptance checks must cover successful and denied cross-workspace actions,
anonymous/system actors, true before/after values, rollback, concurrent requests,
worker crashes, duplicate delivery, provider uncertainty/reconciliation, prolonged
outages and recovery, secret redaction, viewer/export permissions, retention,
backup restoration, and practical query/write performance. Verify captured events
against real actions; do not rely only on schema or mocked insert tests.

Start history at rollout. An optional initial-state inventory must be labeled as
a migration baseline, not fabricated historical user activity. Do not claim that
actions predating auditing can be reconstructed from current database rows.
