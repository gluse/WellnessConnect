# TASK-026 release checklist

Prepared 23 October 2026 after reviewing the task, proposal, implementation and
handoff in the resumed chat. This is a preparation record, not execution approval.
Local implementation and mocked verification are complete. TASK-026 remains open.

## Decisions and execution boundary

Reuse the user's selected option A and recorded approval for local frontend/API
work, additive migration preparation and isolated mocked checks. Preserve the
deployment hold. The initial review made no live connection; the user subsequently
approved metadata-only database preflight, completed as recorded below. No new
grants or service calls were exercised. TASK-025 remains separate implementation
and privacy-review work.

| Gate | Owner and required evidence | Current state |
| --- | --- | --- |
| Database preflight | Codex `/root`, specifically approved by the user: named target, schema/version, local configured runtime principal and metadata | Complete; see [findings and limits](search-location-preflight-report.md) |
| Migration and database acceptance | DB executor: additive migration, verified constraints/RLS/grants, synthetic persistence/isolation checks, measured queries and cleanup | [Coordinated local package](search-location-database-package.md) prepared/tested; execution and acceptance pending |
| TASK-025 and privacy review | Frontend/backend/DB owners within their approvals; qualified privacy/legal reviewer: accepted evidence contract, durable capture/failure behavior, notice, withdrawal and retention decisions | Open; no coverage claimed by TASK-026 |
| Live acceptance | Authorized application owners and DB executor: approved synthetic accounts/records, browser/service scope, privacy-safe evidence and cleanup | Pending scope and execution |
| Release | CI/CD: preceding evidence accepted and user explicitly lifts deployment hold | Held |

## Proposed first operation: read-only database preflight

Recommend a bounded, read-only preflight before requesting migration execution.
The alternative is to defer database access until TASK-025/privacy decisions are
settled; this avoids access now but leaves runtime-role compatibility unresolved.

The user subsequently confirmed the application development/testing project
`hbkooiknruimukkhshrk` and approved Codex `/root` to run this metadata-only scope.
The preflight completed on 23 October 2026. See [the report](search-location-preflight-report.md)
for read-only execution, observed defaults, the pending audit-runtime dependency
and next choices. This approval does not authorize migration/grant execution.
Do not use the separate audit destination for location storage or infer additional
authority from unrelated task approvals.

Before connecting, record the user's confirmation of environment/project and
specific executor. Proposed access is metadata-only, including privileged catalog
inspection only if expressly authorized. Use existing secure connection tooling;
do not print connection strings or read user/location/session rows. No application
startup, authentication/session creation, SQL writes, temporary objects, role
changes, geocoding, or migrations belong to this preflight.

Collect only the following bounded metadata with read-only transactions and
timeouts appropriate to the approved tooling:

1. Server version, database/current principal and verified project mapping.
2. `public.users.id` type/key compatibility; existence and actual definition of
   `public.user_search_locations`; any recorded application migration state.
3. The new table's columns, keys, shape constraint, cascade relationship, owner,
   RLS/forced-RLS flags, policies and effective privileges if it already exists.
4. The actual application runtime principal, its schema/table privileges and
   owner/BYPASSRLS relationship, without copying credential values. Inspect
   relevant default privileges and browser-role access as well.

Stop on a target mismatch, an existing table with unknown provenance, or missing
runtime-role evidence. A missing table is the expected pre-migration state, not
permission to create it. Return a sanitized report and concrete next proposal.
If tooling/verified TLS is unavailable, report the blocker; do not weaken it.

## Migration execution proposal after preflight

The reviewable change is [0009_user_search_locations.sql](../migrations/0009_user_search_locations.sql).
It creates one private table and primary key, a cascading user foreign key, the
source/field-shape constraint, enables RLS, and revokes PUBLIC/anon/authenticated/
service_role access. There is no backfill. The [ORM definition](../shared/schema.ts)
describes the same fields/constraint. User-selected next-step A is now prepared
in [the coordinated database package](search-location-database-package.md): four
DML privileges and a server-only policy for fm_app_runtime, installed only after
the verified sixteen-table audit runtime. Existing audit pins are preserved.

Confirm runtime access before proceeding. The API's owner predicates and RLS are
separate controls: an owner/bypass connection does not prove database-enforced
per-user isolation. The selected shared server-role model retains owner predicates
in the API. No browser roles receive location access. Material changes to this
selected design still require review under AGENTS.md.

After the preflight report, obtain named-target approval for this migration and
its validation operations, including any synthetic writes and cleanup. Record
backup/recovery availability and an acceptable execution window. The foreign key
touches the existing users table; assess lock contention and bound execution.

Prepared coordinated command, **not executed**, using a securely supplied approved
source connection after audit-owner integration and named mutation approval:

```text
node migrations/execute-search-location.mjs apply-location
```

The pinned file contains BEGIN/COMMIT and bounded timeouts; the fixed executor
verifies the foundation before any write and the seventeen-table profile afterward.
The earlier standalone psql command is superseded for this coordinated package.
Do not substitute `db:push` or broad setup
scripts. A failure needs state inspection before retry; do not mask an existing
table with `IF NOT EXISTS`. Apply and verify before activating the account API.

## Database and live acceptance plan

Agree exact synthetic accounts/record identifiers, operations and cleanup before
running this plan. Rolled-back writes, invalid constraint probes, account deletion
and session creation still require explicit database scope. Never use real users
to test the cascade; approve a disposable account if that check is needed.

- Verify the deployed definition, owner, constraints and effective grants/RLS
  against the approved package; confirm browser roles cannot access preferences.
  Verify the API through the actual runtime principal. Check unauthenticated and
  account-A/account-B access, forged owner fields and no-store responses.
- Save/read/update/delete both device and typed preferences. Verify provenance
  clearing, one row per account, constraint rejection, atomic guest adoption when
  an account preference already exists, and explicitly approved cascade behavior.
- With approved synthetic service data, establish nearest-50 ordering and stable
  ties, radius 25/reset behavior, and availability matches beyond the first 50
  candidates. Record actual query timing/plans within approved load; offline query
  assertions are not performance measurements.
- In the approved browser/service environment, cover first visit, returning guest
  and account, cookie failure/expiry, account precedence, login/logout/switching,
  forget/withdrawal, failed preference reads/saves/deletes and retry. Verify real
  permission behavior and the limits of revocation observation. Use mocked Google
  boundaries until real calls and any cost are separately authorized.
- Accept TASK-025's durable evidence, failure/withdrawal behavior and reviewed
  disclosures before consent-dependent release. Confirm coordinates, input text,
  place IDs and cookie values stay out of public payloads, audit records and
  application/proxy/analytics logs. Store sanitized outcomes, not private payloads.
- Fresh language coverage is en/lv/ru only. Arabic/RTL, zh, fr, de, hi, ja, pt and
  es remain deferred. Retain historical evidence; physical devices, other engines,
  screen readers and native-speaker review have no fresh coverage from this review.

Record each gate's approver, executor, environment, permitted operations, limits,
command/results, unresolved findings and cleanup. Mark TASK-026 complete only
after required implementation and acceptance evidence is present. Deployment
authorization remains separate.

## Recovery

On migration failure, verify transaction outcome and existing objects before any
retry. On feature failure after activation, revert only attributable feature edits
or use the approved release rollback; preserve unrelated workspace changes. Keep
the unused private table while diagnosing. Dropping it destroys saved preferences
and needs a separate user choice/approval. Guest-cookie clearing or version
invalidation belongs to an approved application recovery. Remove only explicitly
approved synthetic fixtures, and preserve audit evidence under its reviewed rules.

See the [implementation handoff](search-remembered-location-handoff.md) for local
evidence, scope and recovery, and the [proposal](search-location-proposal.md) for
the selected storage contract and TASK-025 requirements.
