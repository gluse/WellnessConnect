# Audit event catalog and backend implementation map

Catalog draft: `1`, reviewed against repository source on 19 October 2026.
TASK-013 backend deliverable; the route/event matrix describes proposed coverage
and does not establish that every producer is implemented. TASK-014 development
storage and delivery subsequently completed on 23 October 2026; see the
[final execution result](audit-runtime-execution.md#final-development-result--23-october-2026).
Earlier dated preparation checkpoints below are historical. Read with
[audit plan](audit-plan.md) and the DB Analyst's
[storage proposal](audit-storage-proposal.md).

## Audit tables and their purpose

Reference added 23 October 2026 from the applied 0001 storage and 0004 rehearsal
migrations and final execution evidence; no new database connection was made for
this documentation update. Tables use dedicated schemas rather than `public`.

The independent audit destination is project `ynygqodmtgjrngiudalw`:

| Table | Description |
| --- | --- |
| `audit.events` | Accepted audit history. Stores the event name, occurrence/receipt times, actor, workspace, target, outcome, safe field changes, correlation IDs, canonical payload/hash and retention expiry. This is the main table for investigating recorded actions. |
| `audit.integrity_incidents` | Evidence that an existing event ID was submitted with a different payload hash. Stores the candidate hash, detection time and database principal; the originally accepted event stays unchanged. |
| `audit.maintenance_runs` | Retention-cleanup receipts: who ran cleanup, when, which policy version applied, and counts of removed events, integrity incidents and older maintenance receipts. |
| `audit.schema_migrations` | Installed audit schema/contract versions and installation timestamps. Describes database setup, not user actions. |

The main application/source database is project `hbkooiknruimukkhshrk`:

| Table | Description |
| --- | --- |
| `audit_capture.audit_outbox` | Captured events awaiting or tracking delivery. Contains the payload/hash, status (`pending`, `leased`, `delivered`, `quarantined`), attempt count, next retry, lease, acknowledgment time and safe error code. Local audited mutations enqueue their event in the same transaction. |
| `audit_capture.maintenance_runs` | Source maintenance receipts for event replay, delivered-copy cleanup and expired-event disposal, including executor, time and affected counts. |
| `audit_capture.schema_migrations` | Installed source capture schema/contract versions and installation timestamps. |

Both projects also contain contract metadata:

| Table | Description |
| --- | --- |
| `audit_contract.installation` | The project's expected reference and deployment environment, checked when validating incoming events. |
| `audit_contract.migrations` | Installed shared event-contract versions and their installation timestamps. |

Both projects contain these retained test-evidence tables:

| Table | Description |
| --- | --- |
| `audit_rehearsal.run` | The explicitly synthetic development rehearsal's run ID, start/completion times, overall pass result and evidence-retention deadline. |
| `audit_rehearsal.cohort` | The twelve approved synthetic event IDs, their run/scenario association and individual completion/pass results. Identifies test events so they are not mistaken for real user activity. |

The rehearsal test login/helper permissions were revoked after acceptance;
the manifests and synthetic events remain retained evidence. Wrong-password/login
audit capture remains disabled pending TASK-015, so those attempts do not yet
produce new `audit.events` rows. The worker moves captured outbox events into
`audit.events` when running (`npm run audit:worker`).

Related **views**, rather than additional tables: destination `audit.reader_events`
filters out expired events; `audit.integrity_history` and `audit.maintenance_history`
provide incident/maintenance access. Source `audit_capture.delivery_health` exposes
queue counts/age, and `audit_capture.maintenance_history` exposes maintenance
receipts. Reading any table or view still requires the applicable database grants.

### Requested exception: explicit service details opens

On 23 October 2026 the user requested one `service.viewed.v1` event when a found
service is clicked to open its details. It records a server-accepted notification
for an available public service: verified user or anonymous actor, unknown scope,
`service` target with its ID, `service` source component, `succeeded` outcome,
empty changes and R/90-day retention. No search text, location, service content
or guest identifier is captured. It does not prove a human saw the screen.
Public viewing continues if capture fails; the existing gap signal reports that
failure. This exception does not enable other public browsing analytics.

Implemented and enabled in development configuration on 25 October 2026. The
frontend/backend focused checks, TypeScript, both DB extensions, rollback-only
R90/legacy acceptance and final read-only verification passed. Restart the app
and use the updated worker to collect new views. Follow the
[single-event execution record](audit-service-view-execution.md) for current
status, approvals and verification. Broader TASK-016/017 coverage remains open.

## Assignment and evidence limits

The user asked the General Manager to assign the Back End Developer and DB Analyst
to the Audit tasks. The General Manager assigned this backend analysis and this
new document to `/root/audit_backend`. Scope: local repository reads and Markdown
only; no application, schema, migration, frontend, infrastructure, or deployment
changes; no credentials, database/service access, startup, or API/UI tests.
Verification is source inspection and document review. Recovery is removal or
revision of this new document; existing workspace changes were preserved.

The inventory reflects checked-in source, not installed/deployed schema or live
provider configuration. No claim is made about production RLS, cron execution,
provider logs, actual retention, historical activity, or an existing audit service.
Update, 19 October 2026: the user selected storage Option C (independent
PostgreSQL destination plus transactional application outbox). The user also
approved R1 + P1 and recommended failure behavior. Private configuration
inspection identified development/testing source `hbkooiknruimukkhshrk` and audit
destination `ynygqodmtgjrngiudalw`. After user execution approval, DB Analyst
applied the additive source/destination scaffolding on both PG17.11 test projects
and read-only metadata verification passed (80 source / 60 destination checks).
See the [execution record](audit-execution-report.md) and DB proposal's decision
record. No event-producing application paths or worker are integrated yet.
TASK-014–019 remain incomplete. Local BE-14A pure modules/offline tests are complete:
11 staged event contracts, 105 invalid-input cases and TypeScript checks passed.
See [TASK-014's verification record](../TASKS.md#audit). No runtime event capture
or delivery is integrated yet; the matrix below remains proposed coverage.

## Contract proposed jointly with the DB Analyst

Use a strict server-produced envelope, validated before committing local events.
`eventName` includes the semantic version, such as `booking.created.v1`;
`schemaVersion: 1` versions the common envelope independently. Breaking field or
meaning changes introduce a new version. Event names identify an action; outcomes
do not require inventing separate names for every HTTP status.

| Field | Proposed rule |
| --- | --- |
| `eventId` | Server UUID, stable through every delivery retry; never a new ID per worker attempt. |
| `schemaVersion`, `eventName` | Integer `1` and registered versioned name; reject unknown producer contracts before business commit. |
| `occurredAt` | Server UTC instant at the business/security decision; not a client timestamp. Destination adds separate `receivedAt`. |
| `actor` | `kind: user / anonymous / system / database`; verified `userId` or named `systemId` when available. Snapshot effective role/authority at decision time. Claimed login email is never authenticated identity. |
| `scope` | `kind: personal / company / global / unknown`; `workspaceId` required for personal/company and absent for global/unknown. Personal workspace is the owner's user ID; company workspace is the company ID as text. Unknown means unverified, not global. |
| `target` | Registered object type and stable ID when resolved. Preserve historical IDs without cross-database foreign keys or profile copies. Unverified attempted IDs must be marked separately and never grant scope/access. |
| `outcome` | Exactly `succeeded`, `rejected`, `denied`, `failed`, or `unknown`; see rules below. |
| `reasonCode` | Bounded registered application/provider error classification, never exception text, SQL, URL, or provider response body. |
| `changes` | Array of allowlisted field names and optional sanitized before/after values or `redacted: true`; authoritative committed differences, not request-body diffs. |
| Correlation | Server `requestId`, `operationId`; optional `parentEventId`, job/run or safe provider reference. Reuse operation ID across phases; event IDs remain distinct. |
| `source` | `application: fitsmytime`, explicitly configured server deployment environment, component and optional release reference. Require a deployment label before enabling collection; never infer environment from client input, credentials or an ambiguous default. |
| Request detail | Route **template**, method, bounded HTTP status/duration, safe read filter categories/counts when applicable. Never raw URL/query string or cookie/session ID. |
| Policy | Retention class and catalog version; context, if approved, expires independently from core evidence. |

Proposed bounds for implementation review: 32 KiB UTF-8 sanitized envelope, at most
64 changed fields and 100 related object references per event. Split large
operations into a summary plus correlated per-record events before committing;
do not silently truncate required evidence. Field names, enums, IDs, error codes,
and string lengths need explicit schemas. Canonical payload hashing must have a
single agreed canonical JSON serialization definition and SHA-256 hash-format
version, and exclude destination `receivedAt` and optional short-lived context.
The destination accepts duplicate UUID plus identical hash as a replay, and treats
a different hash as an integrity incident. DB naming may be snake_case internally;
the JSON producer contract remains camelCase.

`succeeded` means confirmed committed local state or an explicitly confirmed remote
phase. `rejected` means validation/business conflict, including unavailable
features, duplicate reviews, expired invitations, or booking conflicts. `denied`
means authentication, authorization, origin, or rate-limit refusal. `failed` means
a known unsuccessful infrastructure/provider phase. `unknown` means a remote
request may have taken effect despite timeout/interruption. A 2xx/3xx alone cannot
establish domain success; a 5xx after commit cannot turn that commit into failure.
Record separate phase events for partial completion and reconciliation.

Actor/scope abbreviations below: **U** verified user; **A** anonymous/unverified;
**J** named system/job; **D** database principal when no application actor exists;
**P/C/G/?** personal/company/global/unknown scope. The active company must come
from verified membership and object scope, not a body/header or merely a stored
session selection. Capture the booking's owning workspace even when its actor is
a seeker in another workspace. Support actions retain both global authority and
the actual target workspace; company viewers must never inherit global visibility.

## Proposed retention and safe-field profiles

The user selected P1 retention and R1 access with Option C. The values below
describe that selected operational policy, not legal conclusions or configured
runtime enforcement. P2 remains a documented alternative. The DB proposal holds
the decision record and full policy.

| Class | Candidate duration | Use |
| --- | --- | --- |
| B | 365 days | Business and access-control changes, subscription/admin changes. |
| S | 365 days | Authentication/security decisions, credential-free account events; security-sensitive audit permission/access/export/retention/replay actions and integrity incidents. |
| R | 90 days | Sensitive reads and private object access, excluding audit viewing/export (S). |
| O | 90 days | Routine integration/job/delivery/heartbeat/maintenance counts and successful ordinary integrity checks; security-sensitive audit actions/incidents use S. |
| C | 30 days maximum | Separately stored optional request context or keyed anonymous correlation, only if user approves its purpose. Default excludes raw IP/user-agent. |
| Q | 7 days after confirmed delivery, capped by event expiry | Delivered outbox recovery copy; pending/quarantined rows must not expire through this rule. |

Core retention starts at trusted `occurredAt`; retries/replay/receipt cannot restart
it. Expired evidence must remain hidden even during bounded physical purge delays,
and restore/replay must not resurrect it. Optional context is disabled initially.
The DB proposal also defines candidate export/backup lifetimes and preservation
exceptions; these remain part of the same user policy choice.

Audit-system event classification follows the action's sensitivity: audit viewer
access, export, permission changes, retention-policy changes and retention runs,
operator replay/recovery, and integrity incidents use S. Routine worker delivery,
heartbeat, backlog/retry counters, maintenance counts and successful ordinary
integrity checks use O. A security-sensitive action can additionally produce an O
operational metric, without replacing its required S evidence. These are future
TASK-014/018/019 sources; none is implemented by this document.

Minimum-value profile applies everywhere: IDs, trusted scope/role, field names,
booleans/enums, bounded counts, reason codes, durations, and correlation references.
No passwords, refresh/access tokens, PKCE codes/verifiers, cookies, session IDs,
invitation token/hash/link, email recovery URL, keys, connection strings, raw
headers, complete bodies, SQL/query parameters, or stack traces. IDs remain
identifying data and follow the selected deletion/access policy.

| Profile | Additional allowlisted values; otherwise changed-field indicators only |
| --- | --- |
| AUTH | Provider enum, method enum, confirmed/pending phase, verified actor ID, safe reason, session operation enum; never credentials or attempted email. |
| ACCOUNT | `currentRole`, `providerType`; first/last/company names, email/avatar changes recorded by field name only. |
| ACCESS | Company/member/invitation/employee IDs, old/new role, activation flags, expiry instant, transfer source/destination IDs; invitation email omitted. |
| SERVICE | Category key, service type, price decimal string, duration/cleanup minutes, capacity, supported age/gender enums, instant-booking/advance percentage/publication flags, employee/address IDs, source copy ID. Name/description/image/external URL changes are indicators only. |
| ADDRESS | Address ID, provenance enums, verification expiry, coordinate/address changed flags and affected-service count. No address text, coordinates, location key/address hash, Google Place ID, or raw provider payload. |
| SCHEDULE | Schedule/service IDs, recurring/specific type, timezone, day indices, bounded time intervals/breaks, recurrence flags/values; use private access rules. |
| BOOKING | Booking/service/provider/employee IDs, old/new status, participant count, server-confirmed amount/snapshot values, scheduled UTC instant and duration/cleanup. Notes are indicators only. Restrict these personal appointment facts to designated readers. |
| REVIEW | Review/booking/service IDs, rating and comment-changed flag; comment text and reviewer name omitted. |
| CATEGORY | Existing validated category key, icon; name/search keyword changes indicated without text. |
| STOREFRONT | Subscription/storefront/workspace IDs, `plan`, `proUntil`, `isPublished`; name/description/slug/logo/cover changes indicated without text/URLs. |
| READ | Read kind, target IDs where scoped, result count, page-size/count, allowlisted filter **names**, requested time bounds when justified. No directory search/email, data rows, notes, precise search location, or raw query. |
| INTEGRATION | Fixed provider/model/operation enums, cache source/reuse flag, safe result/error class, counts/duration, safe non-secret provider request reference. No input text, embedding vectors, geocoding data, or signed URLs. |
| OPS | Named job/script/migration revision, release/run reference, counts by safe object type, retry/backlog age, integrity class; no data dumps, command lines containing credentials, config values, or raw SQL. |

For unchanged writes emit an explicit `noChange` result with empty changes when an
attempt matters, without claiming field modifications. Database read/locking and
returning rows must yield real before/after evidence in the same transaction;
the preflight reads currently in routes are insufficient under concurrency.
Retain outbox/backups/exports consistently, enforce expiry during restore before
exposing data, document bounded backup expiry and exceptional preservation, and
avoid copying C context into long-lived immutable payloads. No ordinary viewer
edit/delete path. Retention decisions do not authorize execution.

## Source coverage matrix

All rows are **inventory complete / instrumentation absent / verification pending**.
References give the source file and symbol or route registration line so this
matrix remains actionable. Lists of names in a row are separate registered events,
each with `.v1`; brace notation expands to the listed individual names. Every
audited route additionally emits `security.action_denied.v1` for denied decisions
and its action name with `rejected/failed/unknown` when applicable. Central denial
capture must deduplicate with domain/request capture by decision ID.

### Identity, account and company access (TASK-015)

| Source and actual path | Proposed events and capture | Actor/scope; profile/class; acceptance |
| --- | --- | --- |
| `server/auth.ts:113` POST `/api/auth/login`; `establishSession` at 58 | `auth.login.v1` for verification result; `auth.session_established.v1` only after session save. Upsert/company provisioning are separate local mutation events. | A→U/?→P/C; AUTH/S; A1,A2,A6 |
| `server/auth.ts:124` POST `/api/auth/signup` | `auth.signup.v1` includes provider accepted/pending-confirmation result; local account provisioning and session establishment have separate confirmations. Provider accepted signup is not necessarily authenticated signup. | A→U/?; AUTH/S; A2,A6 |
| `server/auth.ts:167,179` GET/POST `/api/auth/{google,facebook,apple,microsoft}`; GET `/api/callback:210`; `shared/social-auth.ts` provider list | `auth.oauth_started.v1`, `auth.oauth_callback.v1`, then `auth.session_established.v1`; record disabled/cancelled/expired/failed outcomes without callback URL/query. Invitation implicit-flow redirect is a handoff, not proof of login. | A→U/?→P/C; AUTH/S; A2,A6 |
| `server/auth.ts:192,237,251,266` POST `/api/auth/invite-recovery`, `/invite-session`, `/invite-password`; GET `/invite-status` | `auth.invitation_recovery_requested.v1`, `auth.invitation_session.v1`, `auth.invitation_password_changed.v1`; distinguish password saved from fresh sign-in/session failure. Status read is ordinary self session state; audit failures/denials only. | A/U, verified invitation target C when resolved; AUTH/S; A2,A6 |
| `server/auth.ts:111`; `server/password.ts:updatePassword` POST `/api/auth/password` | `auth.password_changed.v1`, separate session-refresh/restoration result; successful remote password write remains succeeded when later local session save fails. Verification failure carries safe code only. | U/P; AUTH/S; A2,A6 |
| `server/auth.ts:267,278` POST `/api/logout`; `isAuthenticated` refresh/getUser/destroy | `auth.logout.v1`, `auth.session_refreshed.v1`, `auth.session_invalidated.v1`; record known provider/local phases. Passive session TTL expiry/revocation outside requests needs provider/session-store source. Do not emit success on every middleware pass. | U/A/P/?; AUTH/S; A1,A2,A6 |
| `server/auth.ts:84,105` origin gate and auth limiter; `server/appAdmin.ts:requireAppAdmin`; `server/companyAccess.ts:scope/assertService/assertBooking`; route-level early returns and exception adapters | `security.action_denied.v1`: unauthenticated, wrong origin, rate-limited, missing permission, cross-workspace, employee mismatch. Do not trust identity before verification, leak foreign target details, or infer denied solely from all 403s (plan denial differs). | U/A and verified C/P or ?; AUTH or ACCESS/S; A1,A2,A10 |
| `server/routes.ts:153,164` GET/PATCH `/api/auth/user`; `DatabaseStorage.upsertUser/updateUserNames` | `account.provisioned.v1` or `account.profile_synchronized.v1` from `establishSession`; `account.details_changed.v1` for local changes; `account.auth_metadata_updated.v1` for remote metadata phase. GET self profile excluded from sensitive-read success by default; failures/denials retained. | U/P; ACCOUNT/B (remote security phase S); A3,A6 |
| `server/routes.ts:222,240` PATCH `/api/users/role`, `/api/provider/profile`; `updateUserRole/updateProviderProfile`; direct company rename | `account.active_role_changed.v1`, `account.provider_profile_changed.v1`, `company.renamed.v1`. Current role is a UI persona, not an app-admin grant. Capture DB write in same outbox transaction. | U/P/C; ACCOUNT/B; A1,A3 |
| `server/companyAccess.ts:ensureCompany` | `company.created.v1`, `company.owner_membership_created.v1`, `company.resources_reassigned.v1`; existing-user conversion reassigns employees/services/addresses/bookings/availability. Parent plus per-record events/bounded manifest; idempotent retry must not fabricate another company creation. | U/P→C; ACCESS/B; A3,A7 |
| `server/companyRoutes.ts:47,52` GET/POST `/api/company/context` | `workspace.switched.v1` after session save; `workspace.selection_reset.v1` on GET invalid-selection correction. Session-store write is not atomically part of a domain transaction; record confirmed/unknown phases. Context list otherwise self access, no browse event. | U, verified old/new P/C; ACCESS/S; A1,A6 |
| `server/companyRoutes.ts:60,102,108` GET `/api/company/team`, `/api/company/invitation?token=…`, `/api/company/my-invitations` | `company.team_read.v1`, `company.invitation_read.v1`; successful private reads and denials, counts/IDs only. Never record token/query or returned email hint. Token possession alone does not verify a user. | U/A,C/?; READ/R; A1,A8 |
| `server/companyRoutes.ts:70,96` POST `/api/company/invitations`; DELETE `/:id` | `company.invitation_created.v1`, `company.invitation_revoked.v1` including superseded invitations; remote `company.invitation_email_requested.v1` after commit, independently succeeded/failed/unknown. Local invitation exists even if send fails. No expiry worker exists: expiry is currently evaluated on read/accept. | U/C; ACCESS/B, INTEGRATION/O for email phase; A3,A6,A7 |
| `server/companyRoutes.ts:114` POST `/api/company/invitations/accept` | `company.invitation_accepted.v1`, `company.membership_created.v1`, `account.active_role_changed.v1` within existing tx; workspace session change after commit is separate. Capture expired/wrong-email/unverified/inviter-revoked rejection. | U/C; ACCESS/B; A1,A3,A6,A7 |
| `server/companyRoutes.ts:137,151,163,176` PATCH members, DELETE members, POST `/transfer`, PATCH `/active` | `company.membership_changed.v1`, `company.membership_removed.v1`, `company.ownership_transferred.v1`, `company.activation_changed.v1`, and child invitation-revocation events where roles/removal/deactivation revoke invites. Transfer affects two roles plus company owner, not stable `providerId`. | U/C; ACCESS/B; A1,A3,A7 |

Account restriction/unrestriction/deletion, general password recovery, admin grant
mutation APIs, explicit invitation-expiry jobs, and provider-side global session
revocation are not implemented application paths found in this inventory. Reserve
`account.restriction_changed.v1`, `account.deleted.v1`,
`auth.recovery_requested.v1`, `auth.session_revoked.v1`,
`company.invitation_expired.v1` for real sources when implemented; do not claim
coverage or create historical events by inspecting current rows.

### Business changes (TASK-016)

| Source and actual path | Proposed events and capture | Actor/scope; profile/class; acceptance |
| --- | --- | --- |
| `server/routes.ts:193,208,209,210`; `server/addresses.ts:addressStore` GET/POST `/api/addresses`, PATCH/DELETE `/:id` | `address.list_read.v1` (R), `address.created.v1`, `address.updated.v1`, `address.deleted.v1` (B). Same shared address can alter many service views; include address ID, affected service count and child references without location content. Delete FK conflict is rejected. | U/P/C; ADDRESS or READ; A1,A3,A7,A8 |
| `server/routes.ts:272,294,295,296`; `saveEmployee/deleteEmployee` GET/POST employees, PATCH/DELETE `/:id` | `employee.list_read.v1` (R), `employee.created.v1`, `employee.updated.v1`, `employee.deleted.v1` (B); showName flag and name-changed indicator. FK-protected history prevents some deletes; no successful deletion event in that case. | U/C; ACCESS; A1,A3,A8 |
| `server/routes.ts:325,461,477,505`; `DatabaseStorage.createService/copyService/updateService/deleteService` | POST `/api/services`, POST `/:id/copy`, PATCH/DELETE `/:id`: `service.created.v1`, `service.copied.v1`, `service.updated.v1`, `service.deleted.v1`. Publication changes are actual `isActive` differences, not a separate implemented publish API. Copy creates inactive row, does not copy bookings/schedules/embedding rows. | U/P/C; SERVICE/B; A1,A3,A7 |
| `server/routes.ts:523`; `DatabaseStorage.createBooking` | POST `/api/bookings`: `booking.created.v1` including pending/confirmed server status, calculated pricing/resource/time snapshots; `rejected` for conflict/outside-hours/changed service. Seeker actor does not own provider workspace. | U/target P/C; BOOKING/B; A1,A3,A7 |
| `server/routes.ts:584,603`; `updateBookingStatus/rescheduleBooking` | PATCH `/api/bookings/:id/status` and `/reschedule`: `booking.status_changed.v1`, `booking.rescheduled.v1`; closed-state/conflict rejection remains separate from no-op. Status enum currently pending/confirmed/cancelled/completed; no separate reject endpoint. `updateBookingPayment` exists as storage method without a live payment integration; instrument only upon authorized reachable use. | U/target P/C; BOOKING/B; A1,A3,A7 |
| `server/reviewRoutes.ts:8,21,46`; `DatabaseStorage.createReview/updateReview/deleteReview` | PATCH/DELETE/POST `/api/bookings/:id/review`: `review.updated.v1`, `review.deleted.v1`, `review.created.v1`; denied/not-found owned predicates, duplicate/noncompleted booking rejection. IDs/rating/comment indicator only. | U/booking target P/C; REVIEW/B; A1,A3,A7 |
| `server/routes.ts:613,676,704`; `createAvailability/updateAvailability/deleteAvailability` | POST `/api/availability`, PATCH/DELETE `/:id`: `schedule.created.v1`, `schedule.updated.v1`, `schedule.deactivated.v1`. DELETE currently sets `isActive=false`, not physical deletion. | U/P/C; SCHEDULE/B; A1,A3 |
| `server/schedulingRoutes.ts:74,88,99`; `replaceAvailability` | PUT `/api/availability/weekly`, PUT/DELETE `/override`: `schedule.weekly_replaced.v1`, `schedule.override_replaced.v1`, `schedule.override_removed.v1`; old rows deactivate and new rows insert in existing tx. Capture inherited/explicit-empty/closed-day distinctions, actual row IDs and changed intervals in correlated children. | U/P/C; SCHEDULE/B; A1,A3,A7 |
| `server/categoryRoutes.ts:23,26,29`; `categoryStore.create/update/remove` | POST/PATCH/DELETE `/api/admin/categories[/:key]`: `category.created.v1`, `category.updated.v1`, `category.deleted.v1`; uniqueness and service FK conflicts rejected. | U/G; CATEGORY/B; A1,A3 |
| `server/storefrontRoutes.ts:34`; `storefrontStore.save` | PUT `/api/provider/storefront`: `storefront.created.v1`, `storefront.updated.v1`; `isPublished` change captured. Current slug immutable after first save; expire/inactive plan blocks writes. | U/P/C; STOREFRONT/B; A1,A3,A7 |
| `server/storefrontRoutes.ts:53`; `storefrontStore.adminUpdate` | PUT `/api/admin/subscriptions`: `subscription.changed.v1` with free/pro and proUntil differences. Expiry is time predicate (`hasPro` / `publishedStorefrontConditions`), not a persisted expiry transition/job; reserve `subscription.expired.v1` if a deduplicated observer is added. | U/global authority, target P/C; STOREFRONT/B; A1,A3,A7 |

No generic request logger can capture actual domain changes in all of these paths.
Autocommit writes must be wrapped with outbox insertion. Existing transactions
need context/transaction propagation; calling an audit helper using global `db`
from inside a transaction would break atomicity. `server/storage.ts` is not the
sole writer: company routes/access, addresses, categories, registeredLocations,
and storefront stores write directly. Add audit coverage at each actual writer.

### Sensitive reads, integrations, provider and operational sources (TASK-017)

| Source and actual path | Proposed events and capture | Actor/scope; profile/class; acceptance |
| --- | --- | --- |
| `server/routes.ts:362,561,572,663`; `server/schedulingRoutes.ts:53` | GET `/api/services/provider`, `/api/bookings/seeker`, `/api/bookings/provider`, `/api/availability/provider`, `/api/bookings/:id/available-times`: `service.private_list_read.v1`, `booking.private_list_read.v1`, `schedule.private_read.v1`, `booking.reschedule_options_read.v1`. Record scoped result count; never row payload. Audit only data actually exposed, not unrelated fetched rows. | U/P/C; READ/R; A1,A8 |
| `server/adminRoutes.ts:20`; `server/admin-directory.ts:registeredUserDirectory`, provider `auth.admin.listUsers` | GET `/api/admin/users`: `admin.user_directory_read.v1` with safe filters/page/count. Current directory aggregates Auth identities, memberships and subscriptions; admin read requires explicit audit-access policy separately from this support flag. GET `/api/admin/access` is permission probe; denied requests captured, no sensitive success by default. | U/G; READ/R; A1,A8 |
| `server/storefrontRoutes.ts:31,47,50`; `adminOptions/adminGet/settings` | GET `/api/provider/storefront`, `/api/admin/subscriptions/options`, `/api/admin/subscriptions`: `storefront.settings_read.v1`, `admin.subscription_targets_read.v1`, `admin.subscription_read.v1`. Search values and returned names/emails omitted. | U/P/C or G with target P/C; READ/R; A1,A8 |
| `server/routes.ts:99,131`; `imageStorage.ts:createImageUpload/validateOwnedImage/validateServiceImage` | POST `/api/objects/upload`: `storage.upload_authorized.v1`; PUT `/api/service-images`: `storage.image_validated.v1`. Upload URL grants capability, not successful upload. Validation downloads the object but does not itself associate a service; actual association belongs to service/storefront mutation. Include opaque object reference, content type/declared size/result only, never signed URL/path with user text. | U/P/C; INTEGRATION/O (denials S); A1,A6,A8 |
| `server/routes.ts:110`; `imageStorage.ts:canReadImage/downloadImage` GET `/objects/:objectPath(*)` | `storage.private_download.v1` for authorized private response and denials; public images excluded from ordinary browse events. Preserve pre-auth context without treating an owner path prefix as identity. Provider read success and HTTP response-delivery failure are different observations. | U/A/P/C/?; READ/R; A1,A6,A8 |
| `server/routes.ts:186`; `registeredLocations.ts:registerLocation`, `databaseStore.locked/put`, `resolveServiceLocation`; `geocoding.ts:geocodeRegisteredAddress` | POST `/api/geocode`: `location.verification_requested.v1`, `location.verification_result.v1`, `location.cache_reused.v1`, `location.cache_written.v1`; manual/global cache/inflight reuse distinguished. Verification result and saved-address change are separate events. Cache writes share advisory-lock transaction, currently spanning Google call. No address hash/coordinates/Place ID copied to audit. | U/owner P/C; cache mutation may be J/G correlated to U request; ADDRESS/INTEGRATION O; A3,A6,A7 |
| `server/routes.ts:325,376,408`; `embeddings.ts:generateEmbedding/generateEmbeddings`; `upsertServiceEmbedding/deleteServiceEmbedding` | Creation follow-up; POST `/api/services/:id/embedding`, `/api/admin/generate-embeddings`: `embedding.requested.v1`, `embedding.generated.v1`, `embedding.stored.v1`, `embedding.batch_completed.v1`. Bulk endpoint is workspace-scoped `manageServices`, despite admin URL. Per-service failures plus batch counts; service creation already committed if embedding fails. No service text/vectors/provider payload. | U or correlated J/P/C; INTEGRATION/O; A3,A6,A7 |
| `server/publicSearch.ts:setupPublicSearchRoutes` semantic-search remote fallback | Audit `embedding.requested/generated.v1` for actual remote operation and `security.action_denied.v1` for security rate limits; normal search/browse analytics remain separate. Text-match/no-candidate fast paths do not generate embedding events; canceled/timeouts/fallback record true provider phase, no raw search string or seeker coordinates. | A/U/?; INTEGRATION/O or S denial; A2,A6,A10 |
| Supabase Auth actions invoked from `auth.ts`, `password.ts`, `routes.ts`, `companyRoutes.ts`, `admin-directory.ts`; `supabase.ts:createAuthClient/supabaseAdmin` | Collect available provider Auth events through an approved provider-side source; normalize `provider.auth_observed.v1` without inventing user/workspace attribution. Reconcile local operation IDs/time/verified provider IDs where safe. Out-of-app changes, email confirmation, global revocation, console/admin calls are application blind spots. Provider availability/permissions/export/retention not verified. | U/J/D/?; AUTH/S; A6,A11 |
| Supabase Storage direct signed upload and console/storage setup (`scripts/setup-storage.mjs`) | Provider upload/delete/bucket policy outcomes need approved provider capture: `provider.storage_observed.v1`, `storage.bucket_configured.v1`. No app object-delete route found; unlink/replacement does not prove physical deletion. Signed-upload completion or user cancellation is currently unobserved by Express. | U/J/D/?; INTEGRATION/O; A6,A11 |
| SQL `public.purge_expired_geocoding()`; migrations `0004_registered_locations.sql:23,33`, replacement `0008_account_addresses.sql:50` | `job.geocoding_purge_started.v1`, `job.geocoding_purge_completed.v1`, `job.geocoding_purge_failed.v1`: named job `fitsmytime-geocoding-cleanup` at `17 * * * *`; sanitized counts for cache/address rows. Transactional completion evidence needs DB-role design; failure evidence needs independent scheduler source because rolled-back tx cannot preserve its own failure. Startup migration call also invokes purge. | J/D/G, affected scopes only if reliably available; OPS/O; A3,A7,A11 |
| `auth.ts:setupAuth` connect-pg-simple sessions store | Provider/driver-managed session saves, refresh, deletion/TTL pruning bypass domain writers. Capture high-level session lifecycle, never row snapshots or raw `sess` JSON (contains tokens/PKCE/recovery data). Prune cadence and deployed behavior unverified; do not add trigger full-row logging to sessions. | U/J/?; AUTH/S or OPS/O; A2,A11 |
| Direct pg/SQL, Supabase console, privileged operators and future migration tools | `database.operation_observed.v1` for deliberately selected metadata-only sources, not an unreviewed full SQL log. Actor is database principal/service identity when no verified human mapping exists. Application outbox cannot cover bypassed writes/DDL by itself. DB Analyst selects triggers/native logging and privacy boundaries before implementation. | D/J/G/?; OPS/O or S for privilege change; A11 |

### Script and migration inventory

Scripts below were inspected as source and were **not run**. A script named test,
dry run, preflight, or rollback can still connect to a database or provider. Route
only execution with the DB role's scoped approval and the user's required choice.
Instrument start/confirmed completion/failure as `operation.script_started.v1`,
`operation.script_completed.v1`, `operation.script_failed.v1`; use script basename,
approved environment, run/release reference and sanitized counts. Business writes
also require their domain events inside the actual transaction. A failed
transaction cannot contain its own durable failure record; an independent
supervisor/operational sink is needed. Do not infer a human actor from OS username.

| Current files | Actual source effect and audit ownership |
| --- | --- |
| `scripts/setup-company.mjs` | Applies migrations `0001_company_providers.sql`, `0002_company_teams.sql`; company/resource migration baseline, not fabricated historical user events. DB Analyst plus CI/CD execution. |
| `scripts/setup-reviews.mjs`, `setup-categories.mjs`, `setup-cleanup-time.mjs`, `setup-storefronts.mjs`, `setup-addresses.mjs` | Apply respective `0003`, `0005`, `0006`, `0007`, `0008` SQL; categories seed/backfill, subscription/schema and shared-address conversion effects require approved operation evidence. |
| `scripts/setup-locations.mjs` | Applies `0004` then `0008`, installs/configures scheduled coordinate purge and invokes retention-related SQL. Retention runs need truthful counts, no deleted location payload. |
| `scripts/mark-locations-verified.mjs` | Explicit transaction converting legacy address provenance and inserting cache, using confirmed original verification time. Record baseline reason/count/expiry; never reset lifetime by audit replay. |
| `scripts/migrate-to-supabase.mjs`, `scripts/supabase-secure-tables.sql` | Default path connects source/target for preflight; `--apply` dumps/restores and applies access restrictions. Current table list covers sessions/users/services/bookings/service_embeddings/availability, so it is not a complete transfer inventory for newer company/address/subscription/audit entities. Do not use unchanged for audit migration/backup. Credentials and dump contents excluded from events. |
| `scripts/setup-storage.mjs` | Supabase privileged bucket list/create/update, private flag/MIME/size settings; external provider config requires independent phase/result capture. |
| `drizzle.config.ts`; `package.json` `db:push` | Direct schema operations outside migration setup wrappers; need DB operation identity/change revision and approved target. No invocation in this analysis. |
| `scripts/test-*-db.mjs`; `scripts/test-supabase-integration.mjs`, `scripts/test-company-teams.mjs` | Database tests create temp tables and/or real identities, sessions, business rows and storage objects; cleanup itself writes. Test execution must be scoped and source labeled test; it cannot stand in for audit acceptance tests. |
| Remaining `scripts/test-*.mjs/.ts`; `scripts/fixtures/{addresses,categories,storefronts}.mjs` | Mixed offline mocks, browser handlers, local listeners and import-time adapters; audit each command/import before future execution. Fixture helpers create/write when invoked by connected DB suites. No blanket offline classification. |

No application cron loop or audit-delivery worker was found in `server/`.
`server/index.ts` starts routes, pool-backed readiness checks, finish-time HTTP log
lines and shutdown; its log contains actual path/status/duration but no trusted
actor/transaction result or durable delivery. Health, static serving, config maps,
provider availability, GET `/api/login`, public categories/catalog/service/reviews/
availability/month/slots/storefront/search are excluded from successful activity
audit by default; capture security denials/integration operations as above.
`server/api-fallback.ts` unknown API requests are operational metrics unless a
security classification is justified. Do not retain untrusted unknown paths.

## Transaction and source gaps that TASK-014 must resolve

1. Existing Drizzle/pg transactions in `storage.ts` (`copyService`, `createBooking`,
   `createReview`, `updateBookingStatus`, `rescheduleBooking`, `replaceAvailability`),
   `companyAccess.ensureCompany`, company mutation handlers, `storefrontStore.save`,
   and `registeredLocations.databaseStore.locked` are insertion points, not proof
   of audit atomicity. Add the outbox write to the **same tx instance**, with
   trusted context explicitly passed by callers. DB Analyst owns schema changes.
2. Other storage/domain writes autocommit. Read before-state under the same
   transaction/appropriate lock, perform authorized mutation and append evidence
   together; use returned deleted rows. Recheck role/scope at the protected action
   boundary where concurrency demands it. Avoid requesting a new global pool
   transaction from a helper already in a transaction.
3. `ensureCompany` bulk reassigns resources; company membership removal/demotion/
   activation revokes invitations; schedule replacement deactivates/inserts rows.
   Summary-only request logs lose this evidence. Generate bounded correlated
   children with real IDs/counts, including effects of future cascades/triggers.
4. Account Auth metadata write then local names update, password writes then
   session restoration, signup/login provisioning then session save, invitation
   acceptance then workspace save, invitation commit then email send, service
   commit then embedding generation, and upload authorization then direct upload
   are non-atomic phases. Introduce durable operation intent/result/reconciliation
   where appropriate; never hold the audit destination connection in requests.
5. Capture denied/rejected/failed requests in an independent local event transaction
   after rollback, using verified decision context. Completion `res.finish` alone
   loses process-crash events and cannot prove business state. If the application
   database is unavailable even an independent outbox transaction fails: expose
   this as a measured capture gap, use an approved independent security sink and
   recovery strategy, and select critical mutation/denial/read failure behavior.
6. Destination outage should allow local commits with outbox durability. Outbox
   failure must roll back covered local mutations. Pending capacity, prolonged
   source outage, remote operation uncertainty, and audit-view read capture failure
   need explicit behavior; no silent fallback to console-only success.
7. Direct SQL/DDL, pg_cron, session pruning, Supabase Auth/Storage and maintenance
   identities need separately approved sources. Local audit cannot claim complete
   provider or privileged-operator coverage until collected and reconciled.

`server/payments.ts` currently always returns 501 `PAYMENTS_UNAVAILABLE` from POST
`/api/payments/process`; record rejected `payment.processing_requested.v1` without
payment/card input. Payment/refund/webhook/notification/SMS event catalogs remain
future work. `docs/architecture.md` lines 130/135/154 mention notifications/Stripe
configuration, but those statements and installed Stripe dependencies do not
establish live handlers or delivery. No implementation was added here.

## Acceptance mapping and meaningful evidence

Each route row names acceptance IDs. All tests below are **planned, not run**.
Offline backend tests must assert observable decisions and sanitized envelopes,
with synthetic identities and external adapters mocked. DB behavior requires
separately approved isolated database execution; provider observations require
approved service validation; deployment/backup verification belongs to CI/CD/DB.

| ID | Required behavior and evidence |
| --- | --- |
| A1 | Route/domain positive + unauthenticated + forbidden + wrong-company/employee/owner tests. Verify trustworthy actor/scope, object ownership, denied result and no state success; never mock away the authorization under test. |
| A2 | Invalid payloads, origin/rate gates, anonymous attempts and session failures produce safe codes once. Seed canary passwords/tokens/email/URLs/headers and assert absent from every captured phase/error/context. |
| A3 | Same-tx commit contains mutation plus outbox; injected outbox failure/rollback contains neither. Concurrency yields actual locked before/after, not stale preflight values; request failure after commit retains succeeded state event. DB execution required. |
| A4 | Crash before/after destination insert and before/after ack; expired lease, concurrent workers, UUID replay and conflicting payload. At-least-once retries produce one immutable destination event; mismatched hash quarantines/alerts, never overwrites. |
| A5 | Destination outage/backlog recovery, malformed events, retry exhaustion, worker restart and capacity thresholds. Confirm ordinary reads and source-backed mutations follow chosen behavior; no dropped pending/quarantined rows or unbounded silent growth. |
| A6 | Remote accepted operation plus timeout/local failure; denied/unknown/reconciliation phases correlate without inventing success. Password saved + session failed, invitation created + email failed, upload authorized + no provider completion, embedding failed after service commit all retain truthful independent outcomes. |
| A7 | Company conversion, role revocations, transfer, copy, concurrent booking conflict, bulk schedules/shared addresses and partial embedding batches preserve exact child/summary counts and actual committed field differences. No fake prior history or duplicate logical action on replay. |
| A8 | Private read success/denial captures result count/scope without content. Viewer permission checks, cross-workspace attempts, bounded pagination/time filters, object/request history, CSV formula escaping and audited exports verify backend plus Front End Developer-owned UI where applicable. |
| A9 | Writer/worker/reader/maintenance privilege boundaries; expiry of each selected class, delivered-only outbox purge, backups/exports/context/deletion policy, restore-before-serving and integrity evidence. Requires approved DB/CI/CD validation. |
| A10 | Unknown/oversized event rejection, explicit bounds/splitting, bounded retry/read/export work and no sampling of required events. Representative throughput/query/queue impact measured against agreed targets in approved environment. |
| A11 | Compare actual Auth/Storage/cron/script/direct-SQL executions with collected sources; missed/reordered provider events and source outages alert/reconcile. Attribution stays unknown/database principal where appropriate. Native SQL logging does not leak parameters/tokens. |

Do not mark a coverage row complete solely because an insert helper or schema test
passes. Link implementation, route/domain test result, approved database/provider
evidence, and rollout environment/release for that row. Mocked provider tests prove
handling logic, not provider availability, permissions or delivery completeness.

## Dependency roadmap and backend work packages

| Task | Backend package and handoff | Prerequisites / completion evidence |
| --- | --- | --- |
| TASK-013 | C + R1 + P1 and failure behavior approved; record named targets/readers/operators and remaining provider/direct-SQL gaps. | Source inventory delivered; target/ownership details pending. No checkboxes closed by this document. |
| TASK-014 | BE-14A strict event registry/sanitizer/context + offline behavior tests; BE-14B transaction-aware domain/outbox adapters under DB-approved schema contract; BE-14C leased batch worker, duplicate/hash checks, retries/quarantine/replay and metrics. | User-selected DB design and scoped implementation/execution approval; DB owns schema/roles/transactions review; CI/CD owns service/secret/host deployment. A3–A5,A9,A10. |
| TASK-015 | BE-15A origin/auth/rate/permission denial capture; BE-15B identity/profile/password/role/company phases and immutable action-time context; BE-15C remote Auth reconciliation contract. | Durable TASK-014 path; no credentials in events; A1,A2,A3,A6,A7,A11. Start here for security-critical rollout. |
| TASK-016 | BE-16A services/addresses/employees; BE-16B bookings/reviews/schedules; BE-16C company/subscription/category/storefront multi-record coverage. | Task-014 tx/context adapter, per-event safe fields and current writer inventory reviewed. A1,A3,A7; actual before/after evidence per route. |
| TASK-017 | BE-17A private/admin reads + image access; BE-17B Google/OpenAI/Storage/Auth phases; BE-17C script run identity/adapters. DB owns cron/direct-SQL sources and scope; CI/CD owns collection/alerts. | Chosen read/context retention and provider collection permissions; A2,A6,A8,A11; unresolved external blind spots recorded. |
| TASK-018 | BE-18A read-only audit API with designated audit role, explicit company scope if chosen, allowlisted filters, keyset pagination/history, safe details; BE-18B bounded controlled export + self-audit. | DB restricted reader path and user-selected access. Front End Developer owns Administration UI, translations/RTL/device/accessibility and UI tests; no frontend work authorized by this assignment. A1,A8,A9,A10. |
| TASK-019 | BE-19A offline regression/contract matrix and failure-injection harness; BE-19B worker/capture/reconciliation runbook and coverage evidence. | DB/CI/CD separately execute approved atomicity/outage/permission/retention/restore/performance checks; CI/CD deployment and rollback; named reliability and activity-review owners. A1–A11. |

Release rollback must stop/repair delivery safely while preserving pending events
and source/destination compatibility. Disabling the worker is not permission to
delete its queue, drop schemas or quietly lose capture. DB/CI/CD determine approved
rollback/backup actions. New event versions and future routes/jobs must update the
catalog and acceptance map before being called covered. History starts at rollout;
an optional initial snapshot must be explicitly a migration baseline.

## Analysis verification record

- Read `AGENTS.md`, `ROLE-BACK_END_DEVELOPER.md`, backend-practices skill, `TASKS.md`
  and `docs/audit-plan.md`; applied repository authority/isolation rules.
- Used `git status --short`, `rg --files server scripts shared`, route/symbol/
  transaction/provider/script searches, and `Get-Content` for the files cited
  above, `package.json`, schema and migration sources. This was static analysis;
  no module was imported or application/test/setup script executed.
- Reviewed the local API registration graph from `server/routes.ts:registerRoutes`
  through all setup modules and `server/index.ts` health/fallback/session path.
  Reviewed concrete writers including bypasses outside `DatabaseStorage` and the
  migration-defined scheduled purge, not only route names.
- Coordinated envelope/outbox contract with `/root/audit_database`. DB proposal
  remains the authority for storage choices and permissions. No database or
  provider verification was attempted; no tests were needed for this documentation
  change. Final diff/format/reference checks are reported in the handoff.
