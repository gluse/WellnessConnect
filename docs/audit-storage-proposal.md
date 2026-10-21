# Audit storage and delivery proposal

Prepared 19 October 2026 by the assigned DB Analyst/Developer for TASK-013.
Status: C + R1 + P1 approved; development/test scaffolding applied and metadata verified; capture/delivery pending.
This database proposal changed no database, credentials, infrastructure, migration,
ORM definition or deployed service. No live database/service was accessed.
This document contributes to TASK-013; TASK-014 and TASK-019 remain incomplete.

Execution update: DB Analyst successfully committed `destination-0001` on
`ynygqodmtgjrngiudalw` and `source-0001` on `hbkooiknruimukkhshrk`, both PG17.11,
after verified-TLS preflights. Metadata checks passed (60 destination / 80 source).
The helper reused the existing fingerprint-pinned public provider CA for the
destination only; no private config/trust-store changes or business DML.
Runtime login bindings, instrumentation, worker and behavioral/recovery tests
remain pending. See [execution report](audit-execution-report.md).

Read with [the audit plan](audit-plan.md) and the backend
[event catalog](audit-event-catalog.md). The
Back End Developer and DB Analyst agreed the proposed envelope and retention
classes below. Agreement between agents is design coordination, not user approval.

## User decision — 19 October 2026

The user selected **Option C**: "I want to go with Recommend C for the intended
durable audit service." The selected architecture is an independently hosted
PostgreSQL audit destination, delivered from a transactional outbox in the
application database. A separate Supabase project is the intended hosting
direction from the discussion; no project, region, plan or environment has been
identified or provisioned. The user subsequently confirmed that the existing
application database is **development/testing**. Initially the audit project was
not created; the user has now supplied `https://ynygqodmtgjrngiudalw.supabase.co`,
reference **`ynygqodmtgjrngiudalw`**, as the audit project. They also reported adding
the audit Supabase API variables privately. Values were not read or tested.
The user now reports that the PostgreSQL connection is stored privately in `.env`
as `AUDIT_DATABASE_URL`. The DB Analyst is assigned local migration preparation
and bounded private configuration inspection; no connection or role validation
has occurred. Do not treat this account as the future restricted runtime writer
until privileges are established. DB Analyst privately confirmed configured
source reference `hbkooiknruimukkhshrk` and destination `ynygqodmtgjrngiudalw` are
distinct and consistent with their Supabase URLs. Credentials were not printed;
no database was contacted and privileges/version remain unverified.

Approving party: user. General Manager records the decision; the assigned DB
Analyst and Back End Developer retain their respective implementation ownership.
The user then approved: **"Approve R1, P1, and the recommended failure behavior."**
The selected bundle is **C + R1 + P1**, including no company self-service readers,
separate export permission, and the P1 retention table below. Optional request
context stays disabled initially. Audited local mutations roll back on capture
failure; required protected reads/exports fail closed. Denials still deny access
if capture fails, with the gap independently reported. Destination-only outages
queue locally while source capture and capacity remain available.
Reuse these selections; no repeat policy approval is needed within this scope.

Covered now: selected architecture/policies, repository preparation and the
assigned Back End Developer's local BE-14A pure modules/offline tests. Named
readers/operators, hosting budget, region and target database metadata remain pending.
The user subsequently approved DB Analyst execution of the prepared package:
preflight both named development/test targets, then additive audit objects and
NOLOGIN roles if checks pass, plus read-only metadata verification. Label is
`development`; destination first, source second, with transaction rollback on
local failure and preservation of already committed evidence. A fixed-manifest
Node/pg helper may use installed tooling; Backend reviews it read-only.
Business DML, fixtures, runtime login bindings, cron, backups/restores,
infrastructure provisioning and deployment are excluded. No repeat approval
is needed within that recorded scope. See [test setup handoff](audit-test-setup.md)
and [migration package](audit-migration-package.md) for actual execution evidence.
Validation for this record is document consistency/whitespace review; recovery
is correction of this Markdown record without touching runtime state.

## Findings and evidence limits

| Repository evidence | Consequence for auditing |
| --- | --- |
| `server/db.ts:12` constructs a `pg.Pool` with five connections and exports Drizzle. `docs/supabase.md` describes Express using the database owner. | Do not assume an RLS-enabled audit table is isolated from the application's present database principal. Verify actual target roles before implementation. |
| `server/storage.ts:459`, `:515`, `:606`, `:627`, `:718` contain booking, review creation, booking-status, rescheduling, and schedule replacement transactions; service copy is at `:223`. | Insert success events using the exact existing transaction handle and preserve its locks. A second global `db` call would break atomicity. |
| Other storage methods, including profile/employee/service updates, review edits/deletion, embedding changes and payment-state updates, use independent statements. | Refactor each covered mutation into a transaction with its event. Multi-step operations need one agreed domain boundary rather than one unrelated event per SQL statement. |
| `server/companyRoutes.ts`, `server/companyAccess.ts`, `server/addresses.ts`, `server/categories.ts`, and `server/storefronts.ts` perform writes outside `DatabaseStorage`; storefront subscription administration is an autocommit upsert. | Central storage instrumentation alone is incomplete. Inventory every direct write and propagate trusted actor/context into its capture point. |
| `server/companyAccess.ts:53` and company membership/ownership routes already use transactions and locks. `shared/schema.ts:51` distinguishes `companies.ownerId` from the stable legacy `providerId`. | Preserve historical company scope and the actual acting member. Never infer actor or current owner from legacy provider/storage IDs. |
| `server/registeredLocations.ts:34` acquires an advisory transaction lock; the Google call occurs inside that callback before its cache write. | Do not add a remote audit write or another long-held audit lock. Cache outcome instrumentation must preserve current serialization; redesigning the Google call is separate work. |
| `migrations/0004_registered_locations.sql:33` schedules `purge_expired_geocoding`; `0008_account_addresses.sql:50` replaces its function and invokes it. | Database-scheduled cleanup bypasses Express. Add safe aggregate job events and operational failure monitoring after approval. This repository does not establish whether the job is installed or healthy. |
| `server/supabase.ts`, `server/auth.ts`, `server/social-auth.ts`, `server/password.ts`, and `server/imageStorage.ts` use remote Auth/Storage operations; signed uploads go directly to Storage. | A local transaction cannot guarantee remote atomicity or observe every upload/provider action. Record intent/outcome/uncertainty and reconcile provider records. |
| `shared/schema.ts:22` stores session JSON; `company_invitations` includes email and token hashes. | Never audit whole rows or generic request/session objects. Exclude credentials, tokens, token hashes, invitation links, email and free text by default. |
| `drizzle.config.ts` scopes synchronization to `public` and a table list that omits companies, memberships, invitations, employees and addresses. `scripts/migrate-to-supabase.mjs:8` lists six older tables; `scripts/supabase-secure-tables.sql` lists those same six. | These tools are not a complete audit migration, security or backup mechanism. Prepare explicit versioned audit migrations and complete object manifests; do not add audit tables to a broad push and assume parity. |

These are source-code observations. Server versions, applied migrations, real
principals, host plan, data volumes, existing backups and runtime behavior remain
unverified. No performance, capacity or coverage guarantee follows from this review.

## Choices for the user

### Storage and isolation

| Choice | Proposed arrangement | Benefits and tradeoffs |
| --- | --- | --- |
| A — simplest pilot | Dedicated `audit` schema in the application database; separate non-owner application, reader and maintenance roles. | Lowest operational overhead; local atomic insertion is possible. Shares capacity, outage, owner and backup boundaries. Changing the existing owner-connected application to a restricted role is a prerequisite for meaningful append-only protection and requires application compatibility testing. If adopted, revise TASK-014's separate-database target explicitly. |
| B — separate logical database | Application outbox plus a separate PostgreSQL database and credentials on existing infrastructure, only if that host supports it. | Independent ordinary grants and logical retention; shared cluster/platform administrators and infrastructure failures. Needs worker, recovery coordination and additional connection/storage capacity. Host support is unverified. |
| C — recommended target | Application outbox plus PostgreSQL on independent infrastructure, such as a separate Supabase project with separately assigned administrators. | Best fit for the existing audit plan and isolation from compromise of the application's database owner. Additional hosting, backups, secrets, egress, monitoring and incident ownership. A second project with identical broad administrator access still shares a human access boundary. |

Recommend C for the intended durable audit service, first rehearsed in an isolated
non-production environment. Choose A for a deliberately smaller pilot if its
shared failure and ownership boundary is acceptable. B is useful when an existing
host supports it economically, but is not independent infrastructure. Defer
provisioning if budget or ownership remains undecided; the documents remain useful.
No current vendor prices or deployed plan were inspected. Compare incremental
compute/storage, backups/PITR, log ingestion/drains, network transfer and operator
time before purchasing. Event size and volume, not table count, determine growth.

### Reader policy

| Choice | Proposed permission |
| --- | --- |
| R1 — recommended initial scope | Designated named security/support readers only; no company self-service and no automatic access for existing application administrators. Separate permission for exports. |
| R2 — additional company view | R1 plus explicitly designated company roles, limited to approved event classes/fields for their validated company ID; exclude global/unknown/personal events and sensitive security context. Requires a separately scoped reader path, cross-workspace tests and Front End Developer involvement in TASK-018. |

R1 still needs the actual people/groups and an access review owner. Neither
`APP_ADMIN_USER_IDS` nor company `owner`/`admin` membership automatically grants
audit-reading rights. Workers are not viewers. Initially omit raw IP addresses,
raw user-agent strings and anonymous tracking identifiers; introduce any limited
request context only after its purpose, reader scope and lifetime are selected.

### Retention policy

These are operational proposals, not claims about a legal retention requirement.
The user must choose durations and identify any exceptional preservation needs.

| Class | P1 — recommended investigation window | P2 — smaller data footprint |
| --- | --- | --- |
| B: business changes | 365 days | 90 days |
| S: security/access events; audit privilege/access/export, retention/replay and integrity incidents | 365 days | 180 days |
| R: sensitive reads | 90 days | 30 days |
| O: routine jobs/integrations/delivery/heartbeat/maintenance metrics; successful routine integrity checks | 90 days | 30 days |
| Optional sensitive request context, separate store | At most 30 days; disabled initially | At most 7 days; disabled initially |
| Delivered source outbox | 7 days after acknowledged delivery, capped by event expiry | 2 days after acknowledged delivery, capped by event expiry |
| Controlled exported files | Automatic expiry within 7 days | Automatic expiry within 2 days |
| Backup recovery copies | Target maximum 35 days of retained recovery points | Target maximum 14 days of retained recovery points |

P1 supports a longer investigation period and uses more storage than P2. Retention
starts at trusted `occurredAt`, not at retries or destination receipt. Context and
exports may have shorter expiry. Daily bounded purges imply up to one day of
physical deletion delay; readers must exclude expired records immediately. Backup
windows are targets for CI/CD to verify with the chosen service, not current host
capabilities. A record deleted from active storage can remain in protected backups
until those copies expire. Restore into quarantine and reapply expiry/deletion
rules before enabling readers or workers. Do not promise immediate erasure from
backups. Exceptional preservation must specify authorized scope, owner, purpose
and expiry; there is no default indefinite hold.

### Suggested bundled decision

**Selected by the user: C + R1 + P1 and the failure behavior below.** Alternatives
remain documented for reference. A local capture failure
rolls back audited mutations, required sensitive reads/exports fail closed, and
denials still deny access even if their capture fails, with an independently
reported capture gap. A destination-only outage queues locally and preserves
normal operation while source capacity is available. An alternate fail-open
policy needs an explicitly accepted coverage risk before implementation.
Also identify an isolated non-production target or ask CI/CD to
propose one, name the permitted readers and operational owner, and set the hosting
budget/region constraints. The DB Analyst then prepares target-specific migration
files and rehearsals for review. Applying them needs explicit approval for the
named environment and operations; production collection is a later rollout step.

Unresolved before target-specific integration/execution: actual project and region; target
PostgreSQL version and connection mode; whether a separate database/project can
be created; permitted infrastructure budget; named principals/readers/maintainers;
backup availability and actual retention; recovery-point/time objectives; observed
or estimated peak event rates and payload distribution; allowed outage backlog
and storage reserve; provider log collection capability and retention. These can
be established by the responsible roles after the bundled design choice. Do not
paste credentials or private row samples into the decision record.

## Proposed event contract, coordinated with Backend

JSON uses camelCase and schema version 1. SQL names may use snake_case.

| Field | Contract |
| --- | --- |
| `eventId`, `schemaVersion`, `eventName` | Server-generated UUID, integer `1`, catalog name ending `.v1`; event ID reused unchanged for delivery retry. |
| `occurredAt` | Trusted UTC instant; local business event constructed inside its committing transaction. It is not a global commit sequence. Preserve provider occurrence time only from an authenticated/validated provider source. |
| `actor` | `kind`: user, anonymous, system or database; verified `userId` or named `systemId` where available; effective role at action time. Unknown identity remains unknown; do not copy names/email. |
| `scope` | `kind`: personal, company, global or unknown; historical `workspaceId` required for personal/company, absent for global/unknown. Personal ID is the owning user ID; company ID is the stable company ID represented as text. |
| `target` | Object `type` and optional historical text `id`; anonymous failures can have no resolved object. No live-record foreign key or cascading deletion. |
| `outcome`, `reasonCode` | Exactly succeeded, rejected, denied, failed or unknown; optional bounded safe reason from catalog. No raw exception/provider text. |
| `changes` | Allowlisted entries `{field,before?,after?,redacted?}`; true values from locked/atomic committed changes where approved. Sensitive fields retain only changed indicators. |
| Correlation | `requestId`, `operationId`, optional `parentEventId`; related IDs bounded and allowlisted. Never use cookie/session ID, refresh/access token or invitation token as correlation. |
| `source` | `{application:'fitsmytime', environment:<server deployment label>, component, release?}`; require explicit deploy label, no inference from a client request or ambiguous development/production fallback. |
| Policy/request details | Retention class and catalog version; optional route template, method, bounded status/duration and safe filter categories/counts from the event registry. No raw URL/query string. |
| Destination metadata | `receivedAt` generated by destination on first accepted insert; canonical payload hash and hash-format version; not part of the source envelope. |

Limit sanitized UTF-8 envelope to 32 KiB, 64 changed fields and 100 related IDs.
Enforce per-field limits and strict event registries before the write. Larger
operations use a parent operation plus bounded per-record child events in the
same domain transaction; never silently truncate required evidence. Validate
timestamp formats/ranges, finite numbers and scope consistency; catalog defines
which actors/scopes/outcomes are valid for each name. Reject unknown fields by
default. All limits are proposed and need representative fixture validation.

Do not retain raw address text, exact coordinates, booking notes, review comments,
profile/email text, provider payloads, embeddings, credential material or full SQL.
Review event-specific exceptions before enabling them. Audit insertion does not
create additional permission to retain provider data beyond its original lifetime.

Compute a deterministic SHA-256 digest of the immutable sanitized envelope using
one documented canonical JSON encoding and hash version on both sides. A hash
supports duplicate comparison; it does not prove who authored an event or prevent
privileged deletion. Keep optional short-lived context outside that envelope and
digest so context deletion neither edits accepted evidence nor invalidates replay.

## Proposed database objects and access

The following is a schema design, not executable DDL or an applied migration.
Use explicit SQL checks as well as application validation. Start without table
partitioning or JSONB-wide indexes; add complexity only from measured workload.

| Object | Essential columns and invariants |
| --- | --- |
| Application `audit_capture.audit_outbox` | `event_id uuid` primary key; immutable `envelope jsonb`, `payload_hash`, `hash_version`, trusted `occurred_at timestamptz`, `created_at timestamptz`, class/expiry; mutable `status` pending/leased/delivered/quarantined, nonnegative `attempts`, `next_attempt_at`, `lease_token uuid`, `lease_until`, `delivered_at`, bounded safe `last_error_code`. CHECK lease fields together and delivered timestamp only for delivered state; require schema/hash/size invariants. No FK to a live user/object. |
| Destination `audit.events` | Same stable UUID primary key and immutable envelope/hash; first `received_at timestamptz`; indexed projections for `occurred_at`, class/expiry, actor ID/kind, scope kind/workspace ID, target type/ID, event name/outcome and correlation IDs. Projections must be generated/extracted or validated against the envelope, never independently supplied contradictory values. No live app FKs, no cascading deletion. |
| Optional `audit.event_context` | Event ID, bounded approved context, expiry earlier than or equal to event expiry; separate restricted writer/reader and purge. No context collected initially. The exact canonical representation and context delivery receipt must be settled before enabling this optional feature. |
| `audit.maintenance_runs` or equivalent catalog events | Run/operation ID, named principal, reason/policy version, started/completed/failed state and times, bounded counts/scope, approved preservation exception reference. No deleted payload copy. |

Initial candidate indexes: source ready queue on `(next_attempt_at, created_at,
event_id)` for pending rows; separate expired-lease lookup; delivered purge on
`delivered_at`. Destination: `(occurred_at DESC, event_id DESC)`, company history
`(scope_kind, workspace_id, occurred_at DESC, event_id DESC)`, target history
`(target_type, target_id, occurred_at DESC, event_id DESC)`, and operation/request
ID lookup. Actor filters may justify another B-tree after representative plans.
Retain UUID deduplication across the entire accepted event lifetime; do not switch
to time partitions that allow duplicate UUIDs across partitions without a separate
uniqueness design. Keyset pagination uses time plus UUID; this orders display,
not concurrent causal history.

| Principal | Proposed minimum authority |
| --- | --- |
| Migration owner | Non-runtime ownership of schemas, tables, functions and grants. No owner secret in the application or delivery worker. |
| Application capture role | Execute validated enqueue inside the domain transaction; no queue read/update/delete or destination access. Existing owner connection weakens this protection until explicitly changed. |
| Source delivery role | Execute bounded claim, ack, retry and quarantine procedures; read claimed sanitized events only. Cannot edit envelope, purge rows, change permissions or mutate application business tables. |
| Destination writer | Execute accept-and-deduplicate function only; no general SELECT, UPDATE, DELETE, TRUNCATE, DDL or grant authority. Function returns inserted/matching/conflict disposition without exposing other events. |
| Global viewer | Read approved projections through the backend; separate export permission and limits. No maintenance or raw optional context permission by default. |
| Maintenance | Execute expiry-based bounded purge/recovery procedures; separately controlled, no ordinary viewer delete UI. Privileged emergency access is logged and reviewed. |

Revoke access from PUBLIC, `anon` and `authenticated`; no browser-facing audit Data
API policy. Revoke default PUBLIC function execution when creating restricted
functions. Any SECURITY DEFINER function needs a non-runtime owner, qualified
objects, a trusted `search_path` with `pg_temp` last, bounded arguments and narrow
EXECUTE grants. Worker state transitions must be checked by procedures, not just
column-level UPDATE permissions. Current owner credentials remain a known source
tampering risk; independent destination protects accepted history, not unshipped
events or forged new events from a compromised application. Append-only protection
is not protection against destination owners or maintenance administrators.

PostgreSQL owners usually bypass RLS, and superusers/BYPASSRLS do so even with
ordinary policies. Test actual principals and ordinary privileges, including
TRUNCATE, rather than treating RLS as an append-only guarantee.
[PostgreSQL row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
and [function security](https://www.postgresql.org/docs/18/sql-createfunction.html).

## Transaction and worker protocol

1. Resolve trusted actor and workspace; do not use request body IDs as authority.
   In the existing domain transaction, capture true allowed before/after values,
   perform the mutation and enqueue its event using the same transaction handle.
   An enqueue failure rolls back the mutation. Preserve booking/provider lock
   order; for new update transactions use locks or atomic techniques appropriate
   to the existing operation. A prior unlocked SELECT is not a reliable before value.
2. Emit failed/rejected/denied outcomes in an independent short transaction after
   the failed domain transaction has rolled back. A response error after commit
   must not replace a committed success with failure. If the source database is
   unavailable, local durable capture is impossible: report capture failure via
   an independent operator channel; do not claim that event was saved.
3. Claim a small ready batch in a short source transaction with row locks and
   `SKIP LOCKED`; assign fresh random lease tokens and lease expiry using database
   time. Proposed starting limits: 100 events/batch, 30-second lease, bounded
   remote timeout below the lease, and jittered retry from 1 second to 5 minutes.
   Tune from rehearsal. Commit the claim before any destination network call.
4. Destination validates the catalog and hash and accepts each event once. An
   existing UUID with matching canonical content is a successful duplicate;
   differing content is an integrity conflict and must be quarantined/alerted,
   never overwritten. The definer accept function can internally read the hash;
   the writer cannot read the event store. Insert-on-conflict alone is insufficient
   without checking matching content. Destination expiry rules also apply to
   replay, so restored old envelopes cannot resurrect expired history.
5. Acknowledge only after destination commit, conditionally on event ID plus
   current lease token/state. A worker with an expired/superseded token cannot
   ack or reschedule another worker's claim. Death before delivery expires the
   lease; death after destination commit retries the same UUID safely. A network
   timeout has unknown delivery state and must be retried, never presumed absent.
6. Release or renew claims with the same token using bounded procedures. Retry
   transient failures with safe codes; isolate poison events so a bad item cannot
   block the whole queue. Quarantine is retained evidence needing investigation,
   not a successful delivery or an automatic purge. Replay preserves event IDs,
   hashes and occurrence times. Correct incompatible events through an explicit
   remediation contract, not ad hoc payload edits.
7. Purge only acknowledged source rows after the selected window and expiry rules.
   Pending/leased/quarantined rows are never deleted merely because delivery is
   old. For events that reach their policy expiry while still undelivered, stop
   normal replay and require the authorized maintenance disposition, count/report
   the coverage gap and honor the selected retention policy; do not extend data
   retention indefinitely or mark them delivered. Dispose of expired recovery
   copies under the same policy. An old backup cannot restart a retention clock.

At least once describes transport; business idempotency is a separate API/domain
contract. Operation IDs group real retries and multi-record actions, without
claiming one UUID per HTTP request makes a business change exactly once. Worker
batch order is not strict action order; if a future feature requires per-object
causality it needs an explicit domain revision/sequence design.

`SKIP LOCKED` is appropriate for competing queue consumers, not a consistent
general query view. Supported target versions and actual procedure permissions
must be verified before preparing DDL.
[PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html),
[PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html).

Proposed operational starting alerts: oldest pending age >5 minutes, oldest >30
minutes urgent, any integrity conflict/quarantine, missing worker heartbeat, failed
purge, and projected source storage exhaustion. Set capacity thresholds from an
approved host budget, not invented live disk figures. Reserve source capacity
and apply admission control to audited mutations before exhaustion; public reads
continue if the application DB remains healthy. Required sensitive reads/exports
must durably record authorization/access before releasing protected data or fail
closed with an availability error. Destination outage alone must not block them
while source capture works. Define incident owner/escalation and critical backlog
behavior before production; an outbox cannot permit unlimited outage tolerance.

## Provider and direct SQL coverage gaps

| Source | Proposed capture and remaining gap |
| --- | --- |
| Supabase Auth | Local attempt and observed result plus provider log ingestion/reconciliation; a remote success followed by local capture/session failure is a partial/unknown flow. Persist an operation intent before a consequential remote action where possible; use provider confirmation rather than retrying password/account changes blindly. Provider logs are not automatically collected by this repository. |
| Signed Storage upload/private download | Audit local authorization and confirmed validation/association separately. Issuing a signed URL proves permission, not completed upload. Direct client uploads and provider-console deletes need provider observations; protected downloads report authorized/started/completed only at the observable boundary. No signed URLs or full provider payloads in events. |
| SQL scripts and migrations | Named maintenance principal and run/approval ID; sanitized summary, affected object IDs/counts and outcomes. Script completion logs alone cannot cover arbitrary console SQL. Do not fabricate a human actor from a shared database username. |
| Geocoding cron | Named database job identity, safe aggregate run events, failures from database job/log monitoring. No expired address/coordinate copy in its audit. Event retention must not retain expiring geocoding content. |
| Arbitrary SQL/privileged access | Targeted triggers can capture safe committed row changes and database identity, but cannot see reads or preserve rejected statements after rollback; privileged owners can disable them. Separate selective pgAudit/platform logs and independently controlled collection cover additional access/DDL; they do not provide domain intent or guaranteed true before/after values. |
| Third-party API calls | Local intent/outcome/duration and safe provider reference when available; redacted timeouts are unknown until reconciled. Do not hold a new database audit transaction open for remote calls. |

Auth database audit storage is optional; verify whether it is enabled rather than
assuming `auth.audit_log_entries` contains every required event. Import with a
stable provider ID and source cursor/dedup key, authenticated transport, safe
mapping, bounded backfill and reconciliation windows. App and provider observations
remain distinct events linked when supported; do not merge them by timestamp
alone. [Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs).

Supabase documents pgAudit with managed-host configuration restrictions; review
the exact allowed role/object scope. SQL text and parameters can contain private
data even when parameter logging is disabled. Define redaction, log readers and
retention before enabling collection; avoid blanket statement logging.
[Supabase pgAudit](https://supabase.com/docs/guides/database/extensions/pgaudit).
Log drains can send Auth/Storage/Postgres logs elsewhere, but plan entitlements,
delivery behavior and ingestion costs must be confirmed for this deployment.
Platform audit logs are a different source for dashboard/API administration.
[Log drains](https://supabase.com/docs/guides/observability/log-drains),
[platform audit logs](https://supabase.com/docs/guides/security/platform-audit-logs).
These official capabilities were reviewed online; none were checked or enabled
in the user's projects.

## Preparation, migration and recovery sequence after a choice

1. Record selected bundle, approving party, executor, named environment, limits
   and validation/recovery scope. CI/CD proposes host/network/secret/backup setup;
   DB Analyst verifies version, ownership and supported connection modes within
   separately authorized inspection. Establish event rates, backlog capacity,
   recovery objectives and named operational/review owners.
2. Prepare explicit versioned destination roles/schema/accept function and source
   roles/outbox/state procedures, with both fresh-install and upgrade paths.
   Reconcile `shared/schema.ts`, migration filters and backup manifests with the
   backend owner. New tables are additive; do not edit old applied migrations or
   backfill invented history. These files require the user's design selection
   before implementation, then target-specific review before execution.
3. Rehearse approved migrations, grants, rollback, worker concurrency and restore
   in the named isolated database. Set statement/lock limits and confirm expected
   grants/default privileges/functions. No existing business-table rewrite is
   proposed, but catalog locks and resource use still need rehearsal.
4. Deploy additive objects first, then backward-compatible capture/worker code,
   initially covering agreed security-critical events. Old code can operate during
   expansion but leaves a declared coverage gap; record release/time boundaries.
   Claim a path covered only after its transaction, failure, privacy and delivery
   checks pass. Expand to business, reads, jobs and provider/direct SQL sources.
5. Rollback application release if needed while preserving queue/destination
   tables and allowing a compatible worker to drain them. Never run a destructive
   down migration to recover from a bad release. Turning off capture creates an
   explicit audit gap requiring operator review. Pause a bad worker and retain its
   queue; fix/replay with unchanged UUIDs and report integrity conflicts.
6. Restore source and destination into quarantine; reapply retention/deletion
   rules and verify grants, functions, jobs, source/destination event counts and
   IDs before cutover. Reconcile delivered-but-purged source entries against
   destination recovery coverage. Restoring source alone or destination alone
   can lose history beyond the seven-day outbox window; backup RPO and independent
   evidence/archive policy must explicitly address that risk. Cross-database
   recovery is coordinated, not atomic. Record genuine gaps rather than inventing
   successful historical actions. No independent immutable archive is provisioned
   or assumed by this proposal.

## Verification contract for TASK-014 and TASK-019

No database tests were run in this analysis. All database writes, temporary
fixtures, rolled-back tests, app startup/session writes and restore rehearsals
need approval for the isolated target. Offline backend tests may proceed within
the backend assignment. A mocked insert test is insufficient to certify delivery.

| Check | Required evidence before declaring complete |
| --- | --- |
| Domain atomicity | Successful mutation and exact event commit together; injected enqueue failure rolls both back; rolled-back mutation has no success event; denied event survives a separate rollback. |
| Real differences/concurrency | Two concurrent edits produce serially correct before/after values; preserve booking/provider lock behavior; no extra event for a no-op unless catalog labels it explicitly. |
| Worker crashes/leases | Kill after claim, during destination call and after commit before ack; expiry reclaims safely; stale token cannot ack or reschedule; multiple workers do not double-accept. |
| Duplicate/integrity | Same UUID/content accepted once with stable first receipt; reordered canonical JSON equivalent; same UUID/changed payload quarantined; UUID collision and batch poison isolation tested. |
| Outage/capacity | Destination outage commits queued events and normal public reads; source capture failure rolls back protected mutations; privileged reads/exports fail closed; catchup/alerts/admission behavior verified before capacity runs out. |
| Scope/permissions | Test every actual role including denied DELETE/TRUNCATE/DDL and envelope updates; cross-company/unknown/personal data inaccessible to company readers if R2; application owner bypass risk documented and separately tested. |
| Privacy/schema bounds | Credentials/free text/coordinates and provider errors absent; malformed envelope/oversize operations rejected safely; large bulk operation retains bounded correlated evidence; optional context independent expiry tested if enabled. |
| Remote uncertainty | Timeout after actual provider success produces honest partial/unknown state; reconciliation links provider evidence without duplicating a business change or blindly repeating it. |
| Jobs/direct SQL | Rehearse selected cron/script/trigger/pgAudit source with database identity and safe fields; prove known read/rejection/privileged gaps remain visible in the coverage register. |
| Retention/replay | Pending/quarantine not silently purged; only selected expiry purge allowed; exact boundary and reader filtering work; restored/replayed expired envelopes cannot resurrect history; backup/export expiry and exceptions exercised. |
| Restore | Isolated source/destination backups restored; verify constraints/grants/functions/jobs and event IDs/hashes; reconcile source acknowledgments against destination RPO; report unrecoverable gaps and measured recovery time. |
| Practical workload | Representative event sizes/peak rates; bounded query plans, write overhead, worker catchup rate, backlog growth and connection budget; inspect before adding indexes/partitioning. |

DB Analyst owns database migration/permission/retention/restore evidence; Back End
Developer owns domain capture, worker, redaction and API unit/integration evidence;
CI/CD owns host, secrets, backups/alerts and delivery operations; Front End
Developer owns TASK-018 UI behavior and meaningful UI verification. General
Manager records dependencies and the user's choices. TASK-013 remains open until
catalog/policy gaps and hosting/readers/retention choices are settled; later tasks
remain open until implementation and their required checks pass.
