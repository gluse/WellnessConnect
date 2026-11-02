# TASK-032 notifications database handoff

Status: **local implementation/review complete; user reports localdev SQL applied**.
The agent performed no database, provider, private configuration, credential,
ACL execution, deployment, or live sending operation. Earlier preparation-only
statements below describe the agent's execution evidence, not the user's later setup.

## Acceptance and authority

Requester `/root`; assigned owner/executor `/root/notifications_db`, DB Analyst/Developer,
29 October 2026. The user's explicit request to implement the PRO notifications and
reminders plan and [standing cross-role authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization)
authorize these reversible local schema/migration files and offline checks. Scope
accepted before implementation. Root records TASK-032 and coordination status.
Backend accepted the table/column/state contract directly before implementation.
Connected operations require separately recorded target/executor/action approval;
preparation does not authorize applying these files.

Applied project-local [PostgreSQL practices](../.agents/skills/postgresql-practices/SKILL.md)
and the DB role's integrity, security, compatibility and recovery requirements.

## Contract and technical choices

- `shared/schema.ts` adds service `reminderEnabled=false`, `reminderMethod=email`,
  `reminderHours=24` with database method/range checks; booking
  `notificationRevision=0` supports atomic event supersession.
- Private `user_communication_preferences` holds E.164 phone, verification timestamp,
  nullable saved preferred method, server-only email suppression (default false),
  supported notification language, opt-ins and update
  timestamp. No contact/consent columns were added to public users. Phone-based
  preferences require verification and the applicable opt-in at the database boundary.
  Clearing a number or handling opt-out must reset incompatible preference and opt-ins
  in the **same update**. Phone ownership binding and verification of the exact account
  and number are Backend responsibilities.
  Backend requested/DB accepted the email suppression field for authenticated Resend
  bounce/complaint callbacks; customers cannot clear it through preference PATCH.
- `phone_verification_challenges` binds account, exact phone and unique provider
  request ID, with status, attempt bound 0–5, expiry and resend time. No SMS codes or
  provider credentials are persisted. Backend serializes challenge reservation on
  the preferences row and bounds remote calls, retries and expiry.
  Account/date and phone/date indexes cover both per-account and shared-number
  verification throttling without reading unbounded challenge history.
- `notification_events` stores booking/revision/kind, current/previous instants,
  timezone, automatic mode and creation time. Booking's existing provider/company
  snapshot remains the workspace authority; do not derive historical workspace from
  an edited listing. Rescheduled events require a previous instant. Database uniqueness
  covers booking/revision/kind and one reminder event per booking/appointment instant.
- `notification_jobs` permits one automatic job per event, with due/expiry instants,
  state, paired lease token/expiry, attempt time and safe provider/reason identifiers.
  Partial indexes cover queued due work and expired leases. `notification_delivery_attempts`
  permits one reserved remote attempt per job and unique provider/message identity.
  Backend's durable hourly workspace/customer quota counts recent attempts through
  job/event/booking joins, serialized by a workspace advisory transaction lock. DB
  accepted that local dependency and added btree `(created_at, job_id)` to expose
  the exact one-hour range and join key; existing unique job/provider indexes cannot
  serve that leading time predicate. This adds one small index per attempt; no live
  query plan or speedup is claimed, and isolated rehearsal must confirm the plan.
  `notification_callbacks` deduplicates provider callback identities without payloads.
  Backend owns row locking, atomic claims, preventing retries after an ambiguous
  dispatch, consent/PRO rechecks, stale-event rules and ordered callback transitions.
- All new instants use `timestamptz`; legacy booking `scheduled_date` remains unchanged.
  Backend must consistently interpret its existing Date representation rather than
  cast legacy naive timestamps using an arbitrary database session timezone.
- Private tables enable RLS and revoke browser, service-role, audit-role and runtime
  access in expansion. Separate activation grants only `fm_app_runtime` DML and the
  established server-only RLS policy. Express account/workspace authorization remains
  essential: this server policy is **not** per-tenant database isolation. No new
  principal, security-definer function, extension or database scheduler is introduced.
- User-approved 30-day terminal metadata retention is implemented by Backend worker
  cleanup, preserving events for future jobs; FK cascade removes dependent attempts.
  Preference lifetime follows the account; account deletion cascades private prefs
  and verification challenges. No rendered bodies or raw callback payloads are stored.

## Migration and compatibility order

1. DB owner obtains authorization for the exact isolated rehearsal target and eventual
   rollout target/executor. Inspect actual PostgreSQL version, roles, legacy tables,
   existing audit/security profiles and backups before execution. Prepared scripts
   deliberately require PostgreSQL 17 and the repository's established principals.
2. Apply `migrations/notifications/0014_notifications.sql` with a stop-on-error SQL
   client only to that approved target. It is an additive transaction with 5-second
   lock and 60-second statement/idle limits. New table existence or principal/version
   mismatch fails closed; it is intentionally not a blind rerunnable migration.
   Constant-default columns expand existing services/bookings; named checks may scan
   them and ALTERs require locks. Schedule based on measured table size and workload.
3. Review actual catalog output and rehearse under the real application principal.
   Apply `0015_notifications_runtime.sql` only with separately covered ACL activation
   authority. Its RLS policies preserve existing server-authorized application access
   and exclude browser/service-role/audit workers. The notification worker must use
   an authorized app-runtime principal, never reuse the restricted audit worker role.
4. Use `verify.sql` for bounded read-only catalog evidence after separately authorized
   execution. Expect six ordinary RLS tables, denied private roles, application DML,
   four NOT NULL columns with expected defaults, validated checks/FKs, valid indexes
   and the specified unique event/attempt/callback identities. Compare against the
   prepared contract; a table's existence alone does not prove readiness.
5. Deploy application code **after schema expansion and runtime rights**. Existing
   Drizzle blanket service/booking selects include the new columns even while
   notification flags are off; an unmigrated database cannot run the new application.
   Rehearse mocked/isolated verification first, then separately authorize provider
   setup, WhatsApp templates, worker scheduling and live messaging. No deployment or
   feature activation occurs in this local task.

`drizzle.config.ts` retains the existing explicit filters. The six private tables are
excluded from default and billing profiles, so generic push does not manage them;
services/bookings are already included and would see the new columns. **Do not use
`db:push` to roll out this feature**. Use the explicit migrations. The current
application readiness inventory is now updated to the exact 33-table notification
profile as recorded below. Historical audit runtime/transfer profiles remain pinned;
review a separately approved successor before any future transfer/rehearsal that
must include notifications. No historical pinned audit/billing profile was widened.

## Offline verification and remaining evidence

Run `node --import tsx migrations/notifications/check.mjs`. It imports schema and the
offline Drizzle serializer only, reads no environment file and opens no connection.
Passed: ORM/generated SQL parity for all added columns, constraints, indexes, FKs and
RLS; explicitly qualified additive DDL; private-table revocations and runtime policy
contract; reminder/event/attempt/callback uniqueness; public users unchanged; defaults;
reminder hours 1/24/168 accepted and 0/169/fractional rejected. Generation command
`node --import tsx migrations/notifications/prepare.mjs` writes only the explicit
local expansion SQL file and is not a database executor.

No live SQL syntax, constraint enforcement, lock/concurrency, actual grants/RLS,
runtime-principal, migration rehearsal, query-plan, rollback or notification-provider
evidence is claimed. Those checks remain release gates for their authorized owners.
Application integration, TypeScript/build checks and offline behavior evidence are
reported by Backend/Frontend/root. Locale scope is **en/lv/ru**; ar/RTL, zh, fr, de,
hi, ja, pt and es remain deferred. All supported language values remain maintained.

Read-only cross-owner concurrency review found and Backend corrected job/booking and
attempt/job lock-order inversions, made multi-booking reconciliation deterministic,
requeued expired leases only before any reserved attempt, and invalidated unattempted
leases during reminder recalculation. Booking preparation now uses booking→job;
callback/finalization uses job→attempt. The event/job/attempt uniqueness constraints
remain the last boundary against duplicate dispatch. Reviewed cleanup preserves future
reminder appointment identities and all active or recently updated job metadata, so retention
does not allow a future appointment to receive a second attempted reminder. These are
source/contract findings; actual PostgreSQL concurrent execution still needs the
separately authorized isolated rehearsal.
Worker clock review also replaced tick-start time with fresh claim/preparation time
after row locks, preserving PRO expiry, lease duration and reminder grace checks in
slow ticks. Explicit injected timestamps remain available only for deterministic tests.

## Local setup readiness compatibility correction

During guided setup, the user reported manually applying 0014/0015 on their existing
Supabase PostgreSQL **17.11** localdev target: six private RLS tables/expected grants,
23 valid/ready indexes, four defaulted columns, 13 validated checks, five validated
FKs and six validated PKs. This is user-reported evidence; the agent did not connect
to verify it. A subsequent application start failed its generic billing DB readiness
guard, because `migrations/billing/application-readiness.mjs` still required the older
27-table application profile and rejected the six new private runtime table grants.

DB accepted the routine local compatibility dependency from `/root` under the same
approved TASK-032 implementation/setup scope. Current application readiness now
requires the **exact 33 named tables**, independent of notification feature flags:
the ORM includes the added service/booking columns even with automation disabled.
There is no legacy-27 fallback or broad greater-than-count exception. All earlier
audit/parser/immutable-guard and exact DML checks remain; historical pinned migration,
source, destination and runtime profiles are unchanged.

The new pure `migrations/notifications/runtime-contract.mjs` imports static metadata
JSON only, with no ORM generator, private files, configuration, socket or connection
on import. The offline generator/check keeps that manifest aligned with ORM and
prepared SQL. The single application metadata query adds six fail-closed flags for
notification columns/defaults, validated constraints/FK bindings, index shape/readiness,
private ACLs, exact RLS policies and restricted public-schema/runtime membership.
It accepts PostgreSQL 17's known varchar/text casts, ANY array and btrim/range
deparser representations through a narrowly scoped expression normalizer, rather
than requiring raw generated DDL text to equal catalog formatting.

Backend owns safe diagnostic stage reporting. DB assertion preserves
`BILLING_DB_NOT_READY` and emits only allowlisted failing check names or the fixed
`readiness_result_shape` marker; no raw catalog values or driver text are exposed.
The agent did not rerun application startup or execute the metadata query.

Offline verification passed: `node migrations/notifications/test-runtime-contract.mjs`
(129 checks including exact 33-table rights, 57 notification/added columns, 23 indexes,
13 checks/five FKs/six PKs, each malformed/false gate, representative PG17 expression
fixtures and inert import); `node --import tsx migrations/notifications/check.mjs`
(ORM/migration/runtime manifest parity); and
`node --import tsx scripts/test-monthly-subscription-local-database.mjs offline`
(133 checks, including the updated 33-table/14-flag injected current-app fixture and
unchanged historical parser pins). Scoped diff whitespace checks pass. Backend/root
report their separate diagnostics, TypeScript and build verification. User-guided
single startup retry is the next step; any remaining failure must be diagnosed from
the new fixed stage/check names, preserving existing stop/no-retry limits.

### Follow-up: PostgreSQL 17 default TRIM deparser

The user's next startup reported only `notification_constraints=false`. DB accepted
continued local diagnosis under the same TASK-032 setup scope, without database,
application startup, provider or private-configuration access. Reviewing the official
[PostgreSQL 17 deparser source](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/adt/ruleutils.c)
identified a definite matcher defect: `F_BTRIM_TEXT` reconstructs the default
whitespace trim as `TRIM(BOTH FROM expression)`, while the local fixture had covered
only `btrim(expression)`. This affects `notification_event_shape`'s timezone-length
range and `notification_callback_shape`'s nonblank callback identifier. The
[PostgreSQL 17 documentation](https://www.postgresql.org/docs/17/functions-info.html)
confirms `pg_get_expr` returns reconstructed SQL, rather than the originally written
expression.

Added the official default-TRIM forms to offline fixtures and reproduced the
`notification_callback_shape` comparison failure before changing implementation.
The JS manifest/check normalizer and SQL catalog normalizer now consistently map
only `TRIM(BOTH FROM expression)` with an omitted character set to ordinary trim.
Explicit trim characters, LEADING, TRAILING, ltrim and rtrim remain distinct; no
constraint, migration, permission or readiness check was removed or relaxed.
Complete timezone range/callback fixtures and the prior btrim representation pass.

Focused offline checks now pass **141** runtime-contract checks, ORM/SQL/manifest
parity and the **133** monthly app-database fixture checks. The bounded fallback
`migrations/notifications/diagnose-check-constraints.sql` is prepared but not executed;
it returns only the 13 fixed check names, presence, validation and deparsed catalog
expressions, without reading customer rows. No other definite FK/PK representation
defect was found in source review. The runtime fix is verified offline; resolution
of the user's actual startup still needs their single guided retry. Use the catalog
diagnostic if the same gate fails again, without rerunning migrations or bypassing
the readiness guard.

## Recovery and next owner

A failure before COMMIT rolls back the expansion or activation transaction. Stop and
inspect rather than retry a precondition, timeout or unexpected integrity failure.
After committed expansion, rollback application/worker to the prior version and keep
the additive columns/tables while reviewing metadata and delivery state. Disable new
dispatch first and reconcile reserved/unknown attempts before reactivation; rollback
cannot unsend messages. Do not drop private tables, purge data, revoke live ACLs or
restore a backup without scoped DB authorization. Root integrates local application
contracts; DB owner next needs an explicitly authorized isolated rehearsal target.
