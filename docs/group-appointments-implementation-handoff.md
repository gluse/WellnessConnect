# Group appointments, messages and reschedule agreements — implementation

2 November 2026. Implemented and verified locally. User approved database
activation and read-only verification. Both migrations committed on the approved
development project and all 20 restricted-role live readiness checks passed.
No deployment is claimed.

## Approval, owners and limits

User approved implementation with “go ahead. implement changes” after reviewing
the [v2 plan](group-appointments-design-v2.md), [v3 revision](group-appointments-design-v3.md)
and their pictures. This approves the revised layout, retained two-way private
messaging, PRO private group broadcasts, individual/event actions, and consent-based
rescheduling including the proposed acceptance-time availability check.
Earlier user choices remain: each booking responds independently; silence keeps
the original reservation with Awaiting response.

Coordinator/integrated reviewer: `/root`. Assigned Front End Developer:
`/root/appointments_frontend`; assigned Back End Developer:
`/root/appointments_backend`; assigned DB Analyst/Developer:
`/root/appointments_db`. Owners accept local dependencies under AGENTS.md standing
cooperation, record their choices and return evidence. Existing dirty repository
changes must be preserved.

Allowed: necessary reversible local application/translation/schema/migration files,
offline/mocked tests and local type/build/browser checks using synthetic data.
No new connected database/service access, private configuration, migration execution,
real sending, spending or deployment is included. Existing target/executor-specific
approvals from other tasks are not silently transferred.

Ownership: Frontend owns client, localization and frontend fixtures/tests. Backend
owns server changes and `shared/appointment-collaboration.ts`. DB owns
`shared/schema.ts`, new appointment migration/contracts and DB offline checks.
Coordinate mixed startup/readiness contract changes before editing. Root owns
this integrated record and the common task/coordination entries.

Frontend explicitly delegated non-English `appointmentCollaboration` resources
to `/root`, followed by the existing notifications/reminder fixtures/regressions
and customer-booking page/change fixtures/regressions. Root accepted and implemented
those bounded frontend scopes. Backend later delegated any routine local integration
fixes in its new modules/contracts and route/storage/lifecycle/readiness hooks to
root, preserving DB ownership and the connected-operation holds.

## Retention choice

User selected **12 months** on 2 November 2026, after completion/cancellation or
the last message, whichever is later. Unresolved bookings retain their history
until resolved. DB and Backend owners received the decision through live agent
tools and implemented precise terminal-time persistence, bounded hourly cleanup
and offline policy checks. Forward UTC calendar-month anniversaries clamp leap
day correctly. No retention job was run against a connected database. This
resolves the material retention choice required by AGENTS.md.

## Evidence and next action

Owner handoffs record implementation, exact checks and limitations:

- [Frontend](group-appointments-frontend-handoff.md).
- [Backend](group-appointments-backend-handoff.md).
- [Database](group-appointments-db-handoff.md), including migration, runtime
  activation, catalog checks and data-preserving recovery.

## Integrated result

Implemented: one expandable card per group session, distinct event header,
independent notes disclosure, compact customer/event menus, confirmed-only group
completion, scoped individual/event cancellation, retained private bidirectional
messages and PRO broadcast review, and consent-based individual/group rescheduling.
Both decline fallbacks and independent group responses are covered; silence and
failed acceptance preserve the original. The immediate HTTP reschedule path now
refuses mutation with `consent_required`. Message type selection was removed.

Review corrections include true overlap queries rather than a history-wide
availability limit, legacy duration fallback, server-only batch linkage,
batched recipient/author lookups, correct singular/plural text, stale-slot recovery,
explicit conversation counterpart/booking reference, and permission-scoped provider
booking caches. Revoked history/recipient data is suppressed rather than left visible
from a previous successful fetch. Optional dead-code cleanup was unnecessary and
left untouched; the functional reschedule wrapper and HTTP defense remain verified.

Root maintained all delegated non-English resources, preserving prior namespaces.
Only en/lv/ru were validated. Translations have no native-speaker quality claim.

| Final local verification | Evidence |
| --- | --- |
| Full application TypeScript and fixture TypeScript | Pass; frontend owner also confirms final source after scoped cache/counterpart changes. |
| `npm run build` | Final frontend, server and notification-worker bundles pass. Existing stale Browserslist and large-chunk warnings remain. |
| `node --import tsx scripts/test-appointment-collaboration.mjs` | 43 injected repository scenarios pass; root independently verified. |
| `node --import tsx scripts/test-appointment-collaboration-api.mjs` | Backend reports 22 real Express/loopback scenarios pass with mocked Auth/DB. |
| `node --import tsx scripts/test-booking-message-retention.mjs` | 16 in-memory scenarios pass, including exact forward leap anniversary, unresolved/last-message protection, bounded cleanup, race and lifecycle. Root and DB review verified. |
| `node --import tsx migrations/appointments/check.mjs` | 142 ORM/DDL/runtime-readiness checks pass; no SQL executed. |
| New collaboration browser suite | Final source passes Chrome 156.0.8078.79, Firefox 157.0, WebKit 27.2; en/lv/ru at 1280/768/375/320px, plus private messaging, consent and permission cases. |
| Existing notes regression | Final source passes all three browsers, en/lv/ru at 1280/768/375/320px. |
| `node scripts/test-notifications-browser.mjs` | Final scoped-cache source passes all three browsers: 9 behavior groups and 36 en/lv/ru viewport cases each. Separate collaboration evidence preserves historical captures. |
| `node scripts/test-pro-appointment-reminders-browser.mjs` | All three browsers pass: 7 behavior groups and 9 en/lv/ru viewport cases each. Pure notification link/settings/resource regression also passes. |
| `node scripts/test-customer-booking-changes-browser.mjs` | All three browsers pass 6 behavior groups over en/lv/ru. Chrome native 400% zoom also passes all three locales at approximately 315×201 CSS px with focus/scroll/reflow checks. |
| `node --import tsx scripts/test-customer-bookings.mjs` | Customer auth/navigation/filter/cache/error/session checks pass, permitting only owning-customer request-state reads. Existing renderer i18next initialization warning remains. |
| Existing backend/completion regressions | Owner reports completion, customer HTTP consent guard, shared capacity, notes, notification worker/bootstrap and startup diagnostics passing; exact commands in owner handoffs. |
| Locale resources | Root validated 383 en/lv/ru base message/placeholder/plural checks; other translations maintained without executing their deferred checks. |
| Scoped whitespace and document-link checks | Pass. |

Visual review: [desktop](group-appointments-implemented-desktop-chrome.png),
[phone](group-appointments-implemented-chrome.png) and the customer native-zoom
captures were inspected. Test data are synthetic. The app server/session store
was never started for browser tests; API/auth requests are mocked in memory and
external browser requests blocked. Initial sandbox browser startup failed before
UI execution; reviewed isolated commands passed through scoped escalation.
No new browser tooling was downloaded. Native hardware/screen-reader verification,
connected PostgreSQL constraints/RLS/locking and external delivery are unverified.

Root's adapted regression evidence is preserved separately:
[notifications Chrome](notifications-collaboration-chrome-evidence.json),
[Firefox](notifications-collaboration-firefox-evidence.json),
[WebKit](notifications-collaboration-webkit-evidence.json),
[customer Chrome](customer-booking-collaboration-chrome-evidence.json),
[Firefox](customer-booking-collaboration-firefox-evidence.json),
[WebKit](customer-booking-collaboration-webkit-evidence.json), and
[native zoom](customer-booking-collaboration-chrome-zoom400-evidence.json).

Acceptance: approved UI, correct event identity/capacity/status context, visible
frequent controls and independent notes disclosures, private messages/history and
PRO broadcast review, explicit reschedule outcomes in both directions, atomic
decision and group actions, secure permissions, duplicate-safe failures and no
other customer/thread disclosure. Verify meaningful regressions and actual browser
layout/interactions. Test en/lv/ru only; ar (including RTL), zh, fr, de, hi, ja, pt
and es remain deferred. Mocks do not prove live DB RLS/races or external delivery.

## Activation approval and result

Local implementation and development database activation are complete. TASK-037
stays unchecked for live workflow/user acceptance, which was not included in the
read-only verification scope. Existing rollout records name development
application project `hbkooiknruimukkhshrk`; their earlier preflight/test approvals
do not authorize this new DDL/runtime-grant operation or silently transfer their
executor's access.

**Connected approval, 2 November:** user answered “yes” to applying the prepared
migration and runtime grants to development project `hbkooiknruimukkhshrk`, followed
by read-only verification. Executor: assigned DB owner `/root/appointments_db`;
approval delivered through the live agent tool and accepted. The scope below is
now authorized. Necessary existing protected connection inputs may be inspected
by that executor for the named target; never print or copy their values into
task records. This does not transfer other tasks' executor-specific credentials
or approvals.

Authorized next operation: assigned DB owner
performs bounded target/backup readiness inspection, applies
`migrations/appointments/0016_appointments.sql` once and
`migrations/appointments/0017_appointments_runtime.sql` once with stop-on-error,
then verifies the 35-table catalog/runtime checks. No audit-database changes,
test-data writes, real messages, cleanup execution or deployment are included in
that proposed activation. Do not retry a failed migration blindly. The DB handoff
contains commands and recovery; a live isolated rehearsal/ACL/concurrency check
needs its corresponding authorized target/scope.

The new application requires the expanded schema. Old builds with an exact
33-table startup contract may refuse restart after expansion, so coordinate the
schema/application cutover. Preserve private history on recovery; do not drop
populated tables to make an old build start. Recover only task hunks, preserving
all pre-existing changes. No automatic-review rejection blocks required work;
the rejected optional cleanup was left guarded and verified instead.

### Connected preflight result and backup hold

Assigned DB owner accepted the connected approval and inspected necessary
source-only credentials through the existing protected-file/TLS helpers. A
single bounded read-only preflight passed: approved source, PostgreSQL 17,
`postgres` session identity, database `postgres`, 33 public tables, expected seven
roles, and no appointment tables/`closed_at` yet. Six terminal bookings would
receive the conservative timestamp backfill. Four other client connections were
observed at that snapshot. No audit target was connected.

No DDL, grants, data export, cleanup or test-data writes occurred. A recoverable
backup could not yet be verified: no local backup or pg_dump on PATH, no available
management connector/token, and earlier project records report a plan without
managed backups. Those historical plan records do not prove the current backup
state. PostgreSQL WAL/archive settings are not evidence of a restorable backup.
The earlier no-backup waiver applies to a different billing package and cannot
be silently transferred to this migration.

The DB handoff's current-recoverable-backup prerequisite initially held execution
pending a new recovery decision. Existing approval for this target and migration
persisted; only backup evidence/preparation or explicit acceptance of proceeding
without a verified backup was missing. That decision is now recorded below.

**Backup decision resolved:** user subsequently selected “Apply migrations
0016/0017 without a verified backup” for development project
`hbkooiknruimukkhshrk`. This is an explicit TASK-037 waiver, distinct from the
earlier billing approval. It was delivered to the assigned DB owner through live
agent tools. No backup is claimed. Apply each prepared script at most once,
stop on the first failure, then perform only the approved read-only verification.
All other connected-operation limits remain.

### Applied and verified

Assigned executor `/root/appointments_db` ran the guarded activation once using
the explicit TASK-037 no-backup waiver. Both pinned migration files committed:

- `0016_appointments.sql`: private tables, timestamp/index/constraint expansion;
  six existing terminal bookings received the conservative `closed_at` backfill.
- `0017_appointments_runtime.sql`: runtime grants and server-only RLS policies.

Fresh exact-target/TLS/33-table guards passed before DDL. Afterwards,
`fmt_app_dev` connected with verified TLS in a read-only transaction and passed
all **20** current application readiness booleans, including the 35-table count,
exact DML, appointment/notification columns, constraints, indexes, private ACLs,
policies and schema rights. Both new private tables had zero rows. No application
server, audit connection, fixture writes, purge, message send or deployment ran.

[Sanitized single-attempt receipt](../migrations/appointments/source-activation-receipt.json)
records target, executor, user waiver, script hashes, commits and verification.
Root independently checked the receipt: exact target, both attempted/committed
scripts with hashes matching current SQL, verified state and all 20 booleans true.
This local receipt check did not open another database connection or retry anything.

No verified backup is claimed. Never rerun the executor or delete its receipt to
force a second attempt. The database now matches the updated application's startup
contract. Running the updated app, exercising persisted workflows/concurrency and
deployment remain separate operations; no fresh authority for them is inferred
from this migration approval. Next: user reviews the running updated application.
