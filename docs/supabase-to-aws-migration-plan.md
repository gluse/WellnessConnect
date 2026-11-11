# Future Supabase to AWS migration

Planning record: 9 November 2026. Backlog: **TASK-052–063** in [TASKS.md](../TASKS.md#supabase-to-aws-migration).
User requested validation of Gemini's suggestions and a task list for a smooth
future migration. This record adopts preparation priorities, not a final service
purchase or implementation assignment. All new tasks remain unstarted.

## Validated recommendations

| Suggestion | Assessment and adaptation |
| --- | --- |
| Use Supabase only as PostgreSQL, through Drizzle | Good destination for reducing Supabase dependence. Application SQL already uses `pg` and Drizzle in `server/db.ts`; keep this. Supabase still supplies Auth and Storage, so it cannot become database-only until their replacements pass acceptance. Drizzle does not migrate identities, files, grants, triggers or jobs. |
| Use AWS S3 for files/images | Recommended first service migration after the inventory and adapter work. Keep a private general-purpose bucket in `eu-north-1`, preserve `/objects/...` application references, and retain backend access decisions. Existing upload requests require an S3-compatible browser contract. |
| Build our own social authorization | Adapt: FitsMyTime owns **authorization** (roles, companies, bookings, Pro access); delegate **authentication** (proving identity and managing credentials) to a maintained provider. Recommend evaluating Amazon Cognito for Google, Apple and Facebook. Preserve Microsoft from TASK-003 and email/password, recovery and invitations. A custom UI is compatible with managed authentication; implementing an identity server or token cryptography adds maintenance and security risk. |

Drizzle supports standard PostgreSQL connections through `node-postgres`, which
matches the current driver. [Drizzle PostgreSQL documentation](https://orm.drizzle.team/docs/get-started-postgresql).
S3 supports time-limited signed object access, but signed URLs can be reused and
uploads can replace an existing key. Preserve the current protection against
overwrites explicitly. [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).
Cognito supports the requested three social providers; developer registrations,
redirects and provider configuration still have to be maintained.
[Cognito social providers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp.html).

Recommended sequence: **inventory → adapters and database portability → S3 →
managed authentication → application and audit databases → cutover → retirement**.
Do not move every service in one release. Keep Supabase Auth until its replacement
is ready; there is no benefit in prematurely disabling working sign-in.

For database planning, start by costing **RDS for PostgreSQL** as the straightforward
community-PostgreSQL target. Compare **Aurora PostgreSQL** if measured availability,
capacity or scaling needs justify it. Final selection follows TASK-059; neither
is selected for deployment here. Preserve the current relational model, transactions
and audit triggers. Do not bundle an engine rewrite into this migration.

## Repository evidence and gaps

This is a read-only source review, not an inspection of live resources or records.

| Area | Evidence reviewed | Migration implication |
| --- | --- | --- |
| Database driver | `server/db.ts`, `drizzle.config.ts`, `shared/schema.ts` | Drizzle/`pg` already provide the database access boundary. Drizzle's default table filter is narrower than the application plus setup/migration estate; inventory every object, not just ORM-managed tables. |
| Identity | `server/auth.ts`, `server/password.ts`, `server/social-auth.ts` | Sessions contain Supabase tokens; profiles are upserted with `id: user.id` from Supabase. Preserve existing application IDs and map new provider identities to them. |
| Other Auth callers | `server/companyRoutes.ts`, `server/routes.ts`, `server/admin-directory.ts` | Invitations, profile/password operations and the administration directory also depend on Supabase. Login buttons alone are insufficient migration scope. |
| Images | `server/imageStorage.ts`, `client/src/components/ImageUploader.tsx`, [TASK-048 handoff](service-photos-handoff.md) | References already use `/objects/<userId>/<file>`. Browser upload currently sends a Supabase-specific multipart PUT with `x-upsert`; S3 needs a coordinated contract change. Preserve 10 MiB validation, galleries, ordering, cover fallback, entitlement rules and private reads. Include storefront logos/covers and all other discovered media. |
| Audit | `server/audit/config.ts`, `server/audit/viewer-runtime.ts`, `migrations/audit/` | Source/destination hosts, principals and environment checks are tied to current Supabase projects. Changing `DATABASE_URL` alone fails. Preserve separate capture/worker/writer/reader privileges, durable delivery and history integrity. |
| Jobs/search | `migrations/0004_registered_locations.sql`, `server/search-pagination/query.ts` | Location expiry uses `pg_cron`; embedding search currently uses JSONB arrays. Inventory actual extensions and jobs; do not assume pgvector is required or migrate to a new vector service without a separate reason. |
| Existing AWS hosting | [TASK-036](../TASKS.md#aws-hosting), [session release](aws-staging-session-release.md) | Restricted Lightsail staging is already published according to recorded evidence and still uses Supabase. Hosting on AWS and replacing Supabase are separate milestones. Reuse the hosting work; do not redeploy it merely to plan this migration. |
| Older transfer guide | [Supabase migration guide](supabase.md) | Its six-table transfer narrative is historical and targets Supabase. It is not an AWS export manifest or current acceptance record. Reconcile current schema/readiness, including later billing, messages, galleries and audit additions. |

## Task acceptance and dependencies

Owners below are responsible roles for future assignment, not newly contacted
agents or accepted implementation requests. Each task must record its executor,
file ownership, target/environment, approvals, verification and recovery when started.

### Prepare now through ordinary development

**TASK-052 — Inventory dependencies and agree migration objectives.**
Owner: Backend + DB + CI/CD; Frontend reviews browser contracts.

- Catalogue all Supabase SDK/HTTP/SQL dependencies, scripts, startup checks,
  hard-coded targets, external avatar URLs, provider credentials, mail delivery,
  callbacks, jobs, workers and operational runbooks. Mark unused features as
  verified absent or unknown; do not assume Edge Functions/Realtime are in use.
- Build a complete source/application/audit object manifest and a data/identity/file
  ownership map. Obtain volumes, growth and traffic only through authorized
  target-specific inspection; no private data is needed in the planning record.
- Document proposed acceptable downtime, maximum data loss (RPO), recovery time
  (RTO), service budget and user impact, then obtain the user's material choices.
- Acceptance: every dependency has a destination or a reason to retain it; unknowns
  have owners; scope includes all current features, not just the original tables.

**TASK-053 — Isolate Auth and Storage provider integrations.**
Owner: Backend; Frontend owns upload/browser changes; DB owns mapping definitions.
Depends on TASK-052.

- Introduce small provider boundaries around existing SDK calls, keeping current
  Supabase implementations and application API behavior working. Cover token/user
  verification, refresh/revocation, profile/password/recovery, invitations, admin
  directory and object sign/upload-confirm/read/delete operations actually used.
- Define an internal authenticated identity using the stable application user ID.
  Represent external identity with issuer/provider and subject; do not spread
  Supabase or Cognito user types through business rules.
- Agree upload method, headers, body encoding, constraints and confirmation with
  Frontend. Do not assume replacing only `signedUrl` makes uploads portable.
- Acceptance: meaningful mocked provider-contract/security regressions pass;
  existing role/workspace checks and public/private image behavior remain intact.
  Keep the Supabase adapters available for a controlled rollback.

**TASK-054 — Make PostgreSQL schema, security and jobs reproducible.**
Owner: DB; Backend owns application/audit connection changes. Depends on TASK-052.

- Reconcile Drizzle schema/filter, ordered migrations, setup scripts and readiness
  gates into a complete reviewed installation and upgrade path. Preserve applied
  history; do not regenerate it from an incomplete ORM filter.
- Identify Supabase-specific roles, RLS helpers/policies, grants, function ownership,
  extensions and scheduled jobs. Prepare target equivalents and prove tenant
  isolation with restricted application credentials; never solve compatibility by
  disabling TLS, RLS, audit capture or target validation.
- Replace hard-coded audit connection assumptions with explicitly approved target
  profiles and certificate/principal checks. Preserve audit-source/destination
  separation and existing retention/integrity contracts.
- Acceptance: offline schema review and an authorized disposable PostgreSQL
  rehearsal cover installation, upgrades, jobs, constraints and restricted roles.
  Any local database writes, even rolled-back tests, need execution authority.

### Move media independently

**TASK-055 — Prepare and verify the S3 storage implementation.**
Owner: Backend + CI/CD; Frontend owns browser upload changes.
Depends on TASK-053; resource creation also depends on TASK-059.

- Prepare a private S3 general-purpose bucket in `eu-north-1`: Block Public Access,
  ACLs disabled, encryption, TLS-only requests, least-privilege runtime role,
  browser CORS and bounded upload authorization. Use workload credentials rather
  than long-lived browser AWS keys. Keep stable application object references.
- Preserve guest reads of published images and deny draft, closed-company,
  unlinked and unauthorized cross-workspace access as required by current behavior.
  Initially retain backend-mediated reads; consider CDN caching separately only
  with reviewed publication/revocation semantics.
- Enforce actual size/type/signature checks at confirmation, prevent key overwrite
  and path substitution, handle expired/replayed uploads and partial failures.
  Avoid treating a signed URL as a one-use credential.
- Set reviewed versioning/recovery, lifecycle and orphan-upload cleanup policies.
  Do not delete objects merely because a gallery reference was removed; retention
  changes require a choice. Plan access logs, relevant CloudTrail data events,
  metrics and alarms with explicit retention and cost.
- Acceptance: offline contract checks, followed by separately authorized S3/browser
  tests, cover galleries/storefronts, upload limits, read authorization and recovery.

**TASK-056 — Copy images, reconcile them and switch media storage.**
Owner: CI/CD + Backend; DB owns any reference changes; Frontend validates behavior.
Depends on TASK-055 and approved transfer scope.

- Inventory every source object and reference, including shared/copied images and
  unattached uploads. Create a protected copy manifest with source key, destination
  key, byte count, content type and independently comparable checksum.
- Copy without source deletion; preserve keys where possible. A database dump
  does not copy storage bytes. Reconcile missing/orphaned objects and encrypted
  or multipart checksum differences rather than assuming an ETag is an MD5.
- Define one active write location, a bounded upload pause/final delta copy and
  read switch. Avoid uncontrolled dual writes. If rollback follows new S3 uploads,
  reconcile/copy those objects back before switching providers.
- Acceptance: manifest reconciliation, authorized read/access checks, gallery and
  storefront regressions pass. Supabase Storage remains available through the
  agreed rollback window; no automatic source deletion.

### Move authentication without losing accounts

**TASK-057 — Select managed authentication and design identity migration.**
Owner: Backend + DB + CI/CD; Frontend reviews flows.
Depends on TASK-052/053; costs and availability reviewed with TASK-059.

- Evaluate Cognito as the recommendation, keeping Supabase Auth temporarily as the
  fallback. Record the final provider, supported flows, user-impact and budget
  choice before provider-specific rollout. A maintained OIDC provider is an
  alternative if Cognito cannot meet a verified requirement.
- Retain existing `users.id` values as application identifiers, even if they
  originated in Supabase. Design an external-identity mapping with uniqueness
  guarantees; map verified issuer/subject to existing IDs. Preserve bookings,
  ownership, team membership, Pro/billing links, image prefixes and audit actors.
- Inventory password, social, multi-provider, invited/unconfirmed, disabled,
  email-less and Apple relay accounts. Specify verified linking and duplicate
  handling; matching email alone is not proof of account ownership.
- Compare compatible password-hash import, first-login migration against the
  legacy verifier, and password reset. Check current Cognito APIs, source hash
  formats/parameters and selected Region before choosing. Never export plaintext
  passwords. Protect and remove any credential export under an approved policy.
- Specify session invalidation/re-login, pending invitations/recovery links, logout
  and rollback after new users or password changes. Legacy sessions/tokens are
  not automatically valid at the new provider.
- Acceptance: reviewed mapping/collision rules, synthetic migration cases and
  recovery procedure; user choice recorded for material user-impact/security changes.

**TASK-058 — Implement managed sign-in and migrate identities in stages.**
Owner: Backend + Frontend + CI/CD; DB owns mapping operations.
Depends on TASK-057/059 and the identity mapping preparation.

- Implement the selected provider behind the adapter; preserve server-side
  sessions with secure HttpOnly cookies. Keep credentials/tokens out of browser
  persistence and logs. Use maintained OIDC/OAuth libraries, authorization code
  flow with PKCE where appropriate, state/nonce checks and exact redirect lists.
- Register/configure Google, Apple, Facebook and the existing Microsoft requirement
  for each approved environment. Verify provider app ownership/review, claim
  mapping, callback domains, Apple keys/relay behavior and secret rotation.
- Preserve signup, email/password, confirmation, recovery, password change,
  invitation acceptance, company signup, account deletion, support directory,
  refresh/revocation and attributable audit events. Keep application permissions
  authoritative and fail closed when identity verification is unavailable.
- Acceptance: mocked security tests, then approved test-tenant/provider migration
  prove stable IDs, no duplicate/taken-over accounts and correct old/new sessions.
  Real emails, provider configuration, identity exports/imports and live tests
  require their exact target/operation approvals before execution.

### Prepare the AWS data platform and prove recovery

**TASK-059 — Select, cost and prepare the AWS target.**
Owner: CI/CD + DB; Backend reviews connectivity. Depends on TASK-052.

- Confirm selected Region in AWS Settings → View all projects → Overview →
  Additional Info → Region (`eu-north-1` is the recorded choice). Recheck current
  Free/Paid plan, credits, spend limit, service eligibility, quotas and capacity.
  Historical TASK-036 evidence does not establish current availability or approve
  an upgrade. All Regional resources stay in the selected Region.
- Compare RDS PostgreSQL and Aurora PostgreSQL against the actual version,
  extension/job/trigger requirements, workload, availability and cost. Propose
  database sizing and placement for both application and audit data, preserving
  the selected audit isolation/security contract. Consolidation is a separate
  architecture decision, not an automatic migration optimization.
- Estimate steady state and overlap: database compute/storage/IO/backups,
  audit storage, S3 storage/requests/egress/versioning, Supabase export/egress,
  Cognito usage, mail, logs/data events, KMS/secrets, networking/NAT and compute.
  Check restricted Lightsail-to-database private connectivity before selecting
  infrastructure; do not expose PostgreSQL broadly to make it reachable.
- Prepare reviewed infrastructure/configuration, restricted roles, secrets,
  certificate verification, backups/PITR, monitoring and restore procedures.
  Choose monthly limits, downtime/RPO/RTO and alert/retention policies with the user.
- Acceptance: target design and dated cost estimate, ownership and resource list,
  deployment/cleanup plan and exact execution approval. No resources are created
  by this planning task list.

**TASK-060 — Rehearse application and audit database migration.**
Owner: DB + CI/CD; Backend validates app/worker behavior.
Depends on TASK-054/059; final rehearsal also uses TASK-056/058 outcomes.

- Prepare a new full manifest and reviewed PostgreSQL export/restore procedure
  for application and audit objects, roles, grants, functions, triggers, sequences,
  jobs and migration/readiness metadata. Use compatible clients/target versions;
  translate managed-platform roles instead of blindly restoring them.
- Prefer a planned short write pause and native dump/restore for a suitably small
  database. If measured size/downtime requirements rule it out, evaluate a supported
  replication/CDC method separately, including permissions and change catch-up.
  Neither path authorizes access or transfer by itself.
- Test in an approved disposable target with synthetic or explicitly permitted
  protected data. Verify counts plus deterministic content checks, foreign keys,
  sequence next values, transaction/booking concurrency, permissions, TLS, search,
  job execution and application readiness. Do not run `db:push` over a restored
  database to conceal migration gaps.
- Coordinate source writes, outbox drain/checkpoint, audit destination and worker
  switch; retain event IDs, ordering/hash continuity and idempotence. No gap or
  duplicate delivery and no competing retention/reminder jobs during cutover.
- Acceptance: measured duration meets chosen objectives; encrypted backup restore
  and rollback/reconciliation are demonstrated. Earlier task-specific backup
  waivers do not waive migration backup/restore acceptance.

**TASK-061 — Rehearse the complete application and operational cutover.**
Owner: Backend + Frontend + DB + CI/CD. Depends on TASK-056/058/060.

- Run the integrated app against the approved test target: guest search/images,
  all sign-in paths, recovery/invitations, provider/company roles, bookings and
  concurrent capacity, galleries/storefronts, administration and audit delivery.
  Include billing/reminders/inbox only within their separately accepted activation
  scope; migration must not accidentally enable messages, payments or cleanup.
- Validate email templates/deliverability, redirects, cookies, CORS, clock/expiry,
  retention schedules, worker restart, logs/redaction, alerts and backup restore.
  Test expired/revoked tokens, provider/storage/DB outages and denied cross-tenant
  access. Measure connection budgets, latency, throughput and likely cost.
- Exercise failure before the switch and after new target writes. Document who
  stops writers/jobs, reconciles data and restores service; DNS/config reversal
  alone does not recover new bookings, uploads or changed credentials.
- Acceptance: signed owner evidence, production runbook with exact commands and
  stop conditions, reconciled manifests and unresolved release blockers recorded.
  Tests cover **en/lv/ru only**. Arabic including RTL, zh/fr/de/hi/ja/pt/es remain
  deferred; preserve historical evidence and continue supported translations.

**TASK-062 — Execute an approved, observable cutover.**
Owner: CI/CD coordinates; DB executes data operations; Backend/Frontend validate.
Depends on TASK-061 and named-target release approval.

- Reconfirm environment/version/readiness, backup/restore receipts, resource
  costs, cutover window, executors and stop/no-retry conditions. Freeze source
  writes and jobs as rehearsed, take final consistent export/deltas, reconcile
  media/identities/data/audit, switch endpoints/secrets and enable one writer set.
- Validate smoke checks, authentication and audit/worker health before reopening
  writes. Monitor errors, availability, queues, data differences and costs against
  explicit rollback criteria. Reconcile target writes before any fallback.
- Acceptance: approved checks and recovery objectives met; retain Supabase sources
  for the agreed rollback period with access constrained by the reviewed plan.
  Existing restricted-staging approval does not authorize production migration.

**TASK-063 — Retire Supabase safely and close migration evidence.**
Owner: CI/CD + DB + Backend; Frontend removes any remaining provider coupling.
Depends on TASK-062 and successful agreed observation/rollback period.

- Prove no live traffic, jobs, provider callbacks, auth fallbacks or media reads
  still require Supabase. Reconcile late data and keep required audit/history
  evidence and a tested AWS recovery path.
- Prepare a reviewable keep/delete list: source databases, buckets, backups,
  secrets, provider callbacks and temporary AWS/transfer resources. Ask the user
  which successfully created resources to retain or clean up; execute destructive
  retirement and billing cancellation only under explicit scope.
- Revoke retired credentials, remove obsolete SDK/configuration paths, update
  README/setup/runbooks and verify cost/monitoring after cleanup. Preserve useful
  historical receipts; do not place credential exports in Git.
- Acceptance: no runtime Supabase dependency, approved deletion/retention receipts,
  working AWS restore and a recorded final cost/ownership handoff.

## Decisions and execution limits

No application, schema, credentials, service settings or resources changed for
this plan. No AWS/Supabase connection or live test was performed. The earlier
staging deployment and task-specific approvals/backup waivers remain scoped to
their original records; they do not approve this migration.

At execution time, obtain only missing material choices and exact connected
operation/target authority. Use standing owner cooperation for accepted reversible
local dependencies. Existing deployment, privacy, messaging/payment activation
and stop-on-failure holds remain in force. Missing workload/cost/downtime choices
do not prevent completing the inventory or local proposals first.

## Sources and validation notes

Official documentation checked on 9 November 2026. AWS MCP documentation/skill
tools are not exposed in this session; local AWS skills and official web
documentation were used. No current service eligibility, Region capacity,
project plan or cost quote is claimed. Revalidate at implementation time.

- [RDS PostgreSQL import](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Procedural.Importing.html)
  and [extensions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Extensions.html):
  native migration tools and managed-role/extension compatibility need review.
- [Cognito CSV imports, including password hashes](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-using-import-tool.html)
  and [CreateUserImportJob API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateUserImportJob.html):
  current docs support compatible password-hash imports; do not assume all
  migrations require resets or that every source hash is accepted.
- [Cognito first-login migration](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-import-using-lambda.html)
  and [trusted identity linking](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html):
  alternatives and safeguards for preserving access to existing accounts.
- [S3 private access defaults](https://docs.aws.amazon.com/AmazonS3/latest/userguide/granting-public-access.html),
  [security practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
  and [pricing dimensions](https://aws.amazon.com/s3/pricing/): retain private
  storage; budget requests, transfer and observability as well as bytes stored.
- [Supabase restore scope](https://supabase.com/docs/guides/self-hosting/restore-from-platform):
  database backup and storage-object transfer are separate workstreams; this
  source is not a procedure for importing Supabase Auth schemas into Cognito.

Documentation verification: source-to-plan review, task-ID/dependency checks,
local-link checks and whitespace validation only. Application tests were not
run because this change only adds planning documentation.
