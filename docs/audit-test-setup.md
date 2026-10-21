# Audit non-production setup handoff

Prepared 19 October 2026 by the assigned DB Analyst/Developer. Documentation only:
no connections, credentials, provisioning, migrations, application changes or
database tests performed. Continue from [storage design](audit-storage-proposal.md),
[event catalog](audit-event-catalog.md) and [audit plan](audit-plan.md).

**Execution update, 19 October 2026:** the user-approved additive migrations
committed on both development/test targets after verified-TLS preflights.
Destination metadata checks (60 booleans) and source checks (80) passed.
The destination uses the fingerprint-pinned existing provider CA in the helper
only; `.env` and system trust were not changed. See
[execution record](audit-execution-report.md). No business DML, fixtures,
runtime bindings, cron or deployment occurred; capture/delivery remains inactive.
Preparation-only statements below describe the earlier handoff, superseded by
this execution result and the existing approval within its recorded scope.

**Next package:** [runtime accounts and bounded rehearsal](audit-runtime-proposal.md)
was selected by the user: Choice 1, restricted application, capture and
worker accounts with private setup/runtime credential separation. The proposed
rehearsal permits at most twelve marked synthetic audit events; no such fixtures
or new role bindings have been applied. Concrete runtime SQL/helpers are being
prepared for review and final execution approval. Backend capture/worker implementation and
isolated verification are in progress. Do not enable collection merely because
the initial database objects exist.

## Approved policy

The user selected C, then explicitly approved R1, P1 and the recommended failure
behavior. Carry these decisions forward without requesting them again:

- Independent PostgreSQL destination, intended as a separate Supabase project;
  transactional outbox in the application database.
- Named security/support readers only; separate export permission; no company
  self-service or automatic application-administrator audit access.
- Business/security evidence: 365 days; sensitive reads/routine operations:
  90 days. Optional request context: at most 30 days, disabled initially.
  Delivered outbox: seven days after acknowledgment, capped by event expiry.
  Exports: seven-day maximum. Backup recovery-point retention target: 35-day
  maximum, subject to verifying the chosen service's capability.
- Audited mutations roll back when local capture fails. Required sensitive
  reads/exports fail closed. Denials still deny access when capture fails and
  report a capture gap independently. Destination-only outages queue locally
  while source capacity is available. Retrying never restarts retention.

Execution approval, 19 October 2026: the user approved DB Analyst preflight on
source `hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`, followed by the
prepared additive migrations/NOLOGIN roles and read-only metadata verification
if both pass. Use label `development`; no business data, fixtures, runtime login
bindings, cron, backup/restore or deployment. The DB Analyst executes; Backend
reviews the fixed-manifest helper read-only. Keep TLS verification and target
gates; preserve committed objects on later failure. See TASK-014 for the record.

The user confirmed the existing FitsMyTime application database is development/
testing. They subsequently reported adding `AUDIT_SUPABASE_URL`,
`AUDIT_SUPABASE_PUBLISHABLE_KEY` and `AUDIT_SUPABASE_SECRET_KEY`, and supplied the
audit endpoint `https://ynygqodmtgjrngiudalw.supabase.co` (project reference
`ynygqodmtgjrngiudalw`). Record this as the user-identified audit target for the
intended non-production setup. No `.env` values or project configuration were
inspected; connectivity, independence from the source, and database state remain
unverified. The user now confirms that the PostgreSQL connection is stored in
`.env` as **`AUDIT_DATABASE_URL`**. Do not print or duplicate its value. Treat the
current account as setup-supplied with unverified privileges; the eventual runtime
slot must use the restricted destination writer, not an assumed owner account.
The DB Analyst's private configuration check confirmed that `AUDIT_DATABASE_URL`
and `AUDIT_SUPABASE_URL` match audit reference `ynygqodmtgjrngiudalw`.
`DATABASE_URL` and `SUPABASE_URL` identify source `hbkooiknruimukkhshrk`, distinct
from the audit target. Only those non-secret references/presence were reported;
no connection or privilege verification occurred. Next: finish the local migration
package for execution under the user approval above. Actual outcomes will be
recorded separately; configuration matching alone does not prove live identity.

## Non-secret inputs still needed

| Input | Owner and required detail |
| --- | --- |
| Source | Existing development/testing source `hbkooiknruimukkhshrk`, identified consistently by private `DATABASE_URL`/`SUPABASE_URL` inspection. Explicit run label, synthetic fixture scope and execution approval remain pending. |
| Destination | `ynygqodmtgjrngiudalw`, consistently identified by configured `.env` `AUDIT_DATABASE_URL`/`AUDIT_SUPABASE_URL`; no connection tested. Privileges/TLS/connectivity remain unverified. CI/CD validates region/budget/administrators. |
| Access | Named reader/export groups, access reviewer, DB executor, CI/CD operator, delivery incident owner and independent capture-gap alert destination. |
| Compatibility | DB Analyst establishes PostgreSQL version, applied migration revision, actual runtime/owner roles, pool/direct connection mode and verified TLS requirements within authorized inspection. |
| Capacity/recovery | CI/CD and DB Analyst establish connection/storage limits, estimated peak event volume, outage reserve/admission threshold, available backup/PITR and provider-log capability, and user-agreed RPO/RTO. The 35-day target does not establish these capabilities. |

Supply names/references and constraints in the task record. Deliver credentials
through the approved secret mechanism; never paste passwords, URLs containing
passwords, tokens, private rows or dumps into chat/documentation.

## Roles, objects and secret slots

Migration/maintenance principals stay separate from runtime. The existing
owner-connected application is a known source-tampering risk; inspect and plan
restricted runtime compatibility rather than assuming grants constrain an owner.

| Connection slot | Target and authority |
| --- | --- |
| `DATABASE_URL` | Existing application connection; domain DML plus validated enqueue in the same transaction. No destination access. |
| `AUDIT_SOURCE_DATABASE_URL` — proposed | Worker source role: bounded claim/ack/retry/quarantine procedures; no business DML or payload edits. |
| `AUDIT_DATABASE_URL` | User reports this is populated in `.env`. Current role/privileges unverified. Intended runtime account: accept/deduplicate only, with no general read, update, delete or DDL; setup credentials must be separated before runtime wiring. |
| `AUDIT_READ_DATABASE_URL` — proposed | Backend reader connection; approved projections, audited access and export authorization. |
| Private migration/maintenance service profiles | Separate source/destination owner and controlled expiry/recovery roles; never installed in browser or application runtime. |

Only `AUDIT_DATABASE_URL` has been reported configured for PostgreSQL audit access;
the other audit connection slots remain proposed. CI/CD records private secret
references, rotation, network rules and per-process pool budgets.

DB Analyst prepares an explicit versioned manifest: source `audit_capture` schema,
immutable outbox, delivery-state checks/indexes and enqueue/claim/ack/retry/
quarantine/purge functions; destination `audit` schema, immutable events,
accept/deduplicate function, reader projections, retention/run evidence, indexes,
roles/grants/default privileges and scheduled maintenance. Optional context storage
stays disabled. Include all dependencies, jobs and roles in backup/restore manifests;
legacy transfer lists and broad `db:push` are insufficient.

## Setup order and proposed rehearsal

1. General Manager records named targets, executor, allowed inspection/write/test
   scope, limits and recovery authorization. CI/CD verifies independent hosting,
   secrets/network, backups and monitoring within its assigned authority.
2. DB Analyst inspects authorized metadata, prepares and reviews destination then
   source migrations, compatibility/lock limits and recovery procedure. Backend
   starts BE-14A pure registry/sanitizer/context/canonical-hash modules and synthetic
   offline tests without DB/Supabase imports. Later adapters require the scoped
   package. No target execution precedes approval of the concrete package.
3. DB Analyst applies approved additive objects to isolated targets, verifies
   actual privileges, then Backend/CI/CD starts compatible capture and worker
   processes using synthetic fixtures and an explicit non-production label.
4. Run atomicity, concurrency, duplicate/hash-conflict, stale-lease/crash, outage,
   redaction, expiry/replay, reader/export and restore rehearsals. Record event
   IDs/counts/hashes, timings and failures without retaining secret payloads.

The initial migrations were applied through the reviewed fixed-manifest helper;
see the [execution report](audit-execution-report.md). Its fresh-install preflight
intentionally rejects the now-existing audit objects. Do not rerun that setup as
an activation or upgrade command, and do not execute `_contract_v1.sql` independently.
The [new runtime package](audit-runtime-proposal.md) defines the next incremental
scope. Its implementation must provide reviewed scenario interfaces, retained
fixture provenance, private credential references and target safeguards before
any connected rehearsal command is used.
Enqueue takes the caller's domain transaction; claim returns immutable versioned
envelopes/hash plus lease token; ack/retry compare current token/state. Use trusted
UTC occurrence-based expiry, database-time leases, stable UUIDs and one canonical
SHA-256/hash-version contract. Never infer environment from credentials.

## Acceptance and recovery

Require real mutation/event atomicity; rollback produces no success event;
duplicate delivery accepts once; mismatched hashes quarantine; stale leases cannot
ack; destination outage preserves queued capture; source failure follows approved
fail-closed behavior; privilege checks deny modification/truncation; expired data
cannot reappear after replay/restore. Measure backlog growth/catchup and restore
time against agreed capacity/RPO/RTO. Coverage starts only at verified rollout.

For failure, pause delivery, preserve source queue/destination evidence and restore
compatible application/worker releases; avoid destructive down migrations. Restore
both stores into quarantine, reapply retention, reconcile IDs/acknowledgments and
report gaps before readers resume. A destination restore older than retained source
copies can lose evidence: backup/recovery design must address this explicitly.
Failed/unavailable required checks leave TASK-014/019 incomplete. Production needs
its own named-target rollout authorization and evidence.
