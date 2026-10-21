# Audit migration package — installed in development/testing

Prepared by the assigned DB Analyst/Developer on 19 October 2026 under the user's
selected **C + R1 + P1 and recommended failure behavior**. This package contains
additive audit SQL only. The user subsequently approved metadata preflight and
conditional additive setup on both named test projects. Both preflights passed;
destination and source additive migrations committed and metadata verification
passed on 19 October 2026. See the
[execution report](audit-execution-report.md). No provisioning, credential change,
application startup, login binding or business rewrite occurred. See [storage design](audit-storage-proposal.md),
[event catalog](audit-event-catalog.md) and [setup handoff](audit-test-setup.md).

## Targets and authorization boundary

Only four permitted `.env` settings were parsed privately in memory. No connection
strings, passwords, API keys or environment lines were printed or copied.

| Target | Sanitized configuration result | Live state |
| --- | --- | --- |
| Application development/testing | `DATABASE_URL` present, reference **hbkooiknruimukkhshrk**; `SUPABASE_URL` identifies the same project. | Verified-TLS direct preflight passed, PG17.11; source-0001 committed, 80 metadata boolean checks passed. Setup postgres is non-superuser with BYPASSRLS/CREATEROLE/schema CREATE; full business schema revision/capacity unverified. |
| Independent audit test project | `AUDIT_DATABASE_URL` present, reference **ynygqodmtgjrngiudalw**, matching the user-supplied target; `AUDIT_SUPABASE_URL` agrees. | Verified-TLS direct preflight passed after in-memory reuse of the existing configured Supabase public CA; PG17.11; destination-0001 committed, 60 metadata boolean checks passed. Administrator separation/backups remain unverified. |

Distinct configured references and verified connections establish the targeted
endpoints, not independent administrator control. Treat the provided audit PostgreSQL connection
as **setup-only**. It must not become the worker's runtime accept-only connection.
No production authorization is inferred. The source deployment label is explicitly
recorded as **development** for both databases.

The user approved execution on these named test targets: read-only metadata
preflight, conditional additive namespaces,
NOLOGIN group roles, tables/indexes/functions/views and read-only metadata
verification. No runtime login creation/grants, business rewrites, fixtures,
extensions, schedules/cron, backups/restores or application deployment are included.
Live write/concurrency/outage rehearsals require their own explicit target scope.
This setup scope is now complete. Fresh-install preflight/apply deliberately
rejects existing namespaces/roles; do not rerun it as a health check or upgrade.
Both gates passed before either migration; TLS verification was never weakened.

## Exact manifest

| File | Purpose |
| --- | --- |
| [0000_preflight.sql](../migrations/audit/0000_preflight.sql) | Read-only metadata on either verified endpoint: version/encoding, migration principal powers, expected app objects, existing audit namespaces/roles. |
| [_contract_v1.sql](../migrations/audit/_contract_v1.sql) | Include shared by each database's migration; separate local contract owner, immutable installation label/project record, contract version, strict staged event parsing/hash verification. Do not execute standalone. |
| [0001_destination.sql](../migrations/audit/0001_destination.sql) | Independent event store, deduplication, immutable history, safe conflict evidence, reader projection and counted retention procedure. |
| [0001_source.sql](../migrations/audit/0001_source.sql) | Local transactional outbox, immutable payload guard, bounded claim/ack/retry/quarantine/replay/purge functions and delivery/maintenance views. |
| [0002_verify_destination.sql](../migrations/audit/0002_verify_destination.sql) | Read-only destination metadata/privilege/trigger checks. |
| [0002_verify_source.sql](../migrations/audit/0002_verify_source.sql) | Read-only source metadata/privilege/trigger checks. |
| [execute-approved-setup.mjs](../migrations/audit/execute-approved-setup.mjs) | Reviewed Node/pg helper: fixed-digest preprocessing, independent read-only preflights and dual-gated destination-then-source application only. |

No modifications to `shared/schema.ts`, Drizzle configuration, old migrations,
application code or `.env` are part of this package. Explicit `public` table filters
will not apply these namespaces; do not substitute `db:push` or legacy transfers.

## Contract with BE-14A

Both stores accept `(canonical_json text, payload_hash text, hash_version text)`.
Pass BE-14A's `canonicalJson`, `payloadHash`, `hashVersion` unchanged using bound
query parameters. The database parses its own envelope from those exact bytes.
It stores the original text plus JSONB, checks their semantic equality and verifies
`encode(sha256(convert_to(canonical_json,'UTF8')),'hex')`. It never hashes
`jsonb::text`. Version is exactly **sha256-sorted-json-v1**: JS UTF-16 key order,
array order preserved, JSON.stringify primitives/-0 handling, no normalization.

SQL validates the 32 KiB byte cap, raw duplicate/dangerous keys, depth/node/array
bounds, strict envelope/nested keys, UUIDs, UTC millisecond timestamps, environment,
the eleven staged BE-14A names, B/S classification, actor/scope/target policies,
outcomes/reasons and safe changed fields. It is not a second implementation of
JavaScript canonical serialization or IEEE-754 rounding. Exact canonicality and
trusted user/workspace attribution remain Backend responsibilities; a compromised
authorized producer can forge new events. SQL bounds numeric employee IDs to
positive integral values within finite JS-number magnitude; real IDs still need
domain authorization. The raw tree allows 256 object keys versus BE's 257 maximum,
which does not affect any valid staged shape. No system/database actors, global
events, R/O names or optional context are enabled by this staged migration.

B/S expiry is `occurredAt + 31,536,000 seconds`, preserving BE's fixed 365-day
duration across DST; it is not calendar-year arithmetic. Source enqueue rejects
expired events; both ingestion functions reject timestamps over five minutes in
the future. This ingestion clock-skew bound is additional to BE's parser date
range; operators must verify clocks. Destination expired replay returns `expired`
without reinsertion. Selected shorter R/O and context policy remains unchanged
but needs later supported registries/migrations before those events are enabled.

## Roles and runtime adapters

All new roles are NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS with no
runtime bindings. Owners are separate from operating groups. Only narrowly scoped
SECURITY DEFINER functions use owner rights, with qualified objects, trusted
`pg_catalog, pg_temp` search paths and revoked PUBLIC execution. Owner membership
is explicitly granted temporarily for setup and that grant is revoked before
commit. Newer PostgreSQL versions can retain creator ADMIN membership granted by
the bootstrap superuser; removing the explicit grant does not strip all setup
administrator authority. Existing owner-connected app credentials remain capable of source
tampering; do not claim these grants restrict a database owner/administrator.

| Database | Owner/group | Authority/connection slot after separately approved login setup |
| --- | --- | --- |
| Both independently | `fm_audit_contract_owner` | Contract/installation objects; no runtime ownership. |
| Source | `fm_audit_source_owner` | Outbox/procedures owner; no runtime ownership. |
| Source | `fm_audit_capture` | Enqueue only, on the caller's existing domain transaction (`DATABASE_URL` application role). |
| Source | `fm_audit_delivery` | Claim, ack, retry, quarantine only; proposed `AUDIT_SOURCE_DATABASE_URL`. |
| Source | `fm_audit_source_maintenance`, `fm_audit_source_monitor` | Controlled replay/purge/disposal versus payload-free health/history reads. |
| Destination | `fm_audit_destination_owner` | Destination owner; no runtime ownership. |
| Destination | `fm_audit_writer` | `audit.accept` only; future restricted `AUDIT_DATABASE_URL`. |
| Destination | `fm_audit_reader` | Nonexpired safe event projection; future `AUDIT_READ_DATABASE_URL`. |
| Destination | `fm_audit_export` | Marker only, no SQL access; backend export permission remains separate. |
| Destination | `fm_audit_destination_maintenance` | Counted expiry purge plus incident/maintenance history; separate maintenance connection. |

Enqueue neither commits nor opens another connection. Capture failure must roll
back the business transaction. Worker claims at most 100 events with fresh tokens
and 30-second database-time leases, then commits that source transaction **before**
network delivery. Use a bounded remote timeout shorter than the remaining lease;
there is no renewal API in this first package. Long delivery may duplicate safely.
Ack/retry/quarantine compare event ID, current token, leased state and unexpired
lease. A false return is a stale claim, not success. Retry accepts only safe codes
and 1–300-second delay; worker implements jitter/backoff. No raw provider errors.

Destination returns `inserted`, `matching`, `conflict` or `expired`. Only the first
two permit acknowledgment after destination commit. Matching requires UUID plus
identical hash version/hash/canonical bytes, preserving first receipt. Conflict
stores safe digest evidence without candidate content: commit that disposition,
then quarantine/alert at source. Do not throw inside the destination transaction
and inadvertently roll back its incident record. `expired` needs source quarantine
and an authorized expiry disposition/coverage-gap report, never normal ack.
Serialization/deadlock failures require bounded whole-transaction retries.

Delivered cleanup is bounded and limited to seven days after ack or event expiry,
whichever first. Pending/leased/quarantined events do not expire through this rule.
Separate maintenance-only disposal removes truly expired undelivered events,
counting the gap; it never labels them delivered. Replay preserves payload/UUID
and binds its run UUID to the target event. Maintenance run UUIDs must identify
one operation; concurrent identical run requests can conflict and require retry.
Maintenance/incident evidence is local S-class history retained for 365 days with
bounded purges. Shipping those operations as catalog events and independent
failure alerts needs later Backend/CI/CD integration; it is not implemented here.

R1 does not authorize direct human database logins. Leave reader/export bindings
disabled until backend durable self-audit exists: the eleven-event registry does
not yet include audit-view/export events. SQL SELECT can copy data; a separate
export marker does not constrain a person with direct SQL reader access. No
ordinary role can mutate/truncate base events; owners can disable protections.

## Preflight and exact execution design

Current host: `psql` was not found on PATH; the Python launcher points to a missing
interpreter, and the inspected local Node SQL-parser packages are absent. No SQL
parser/server was installed. The live server accepted both schema packages and
metadata checks passed; stored-procedure behavior and concurrency remain untested.

The reviewed helper now substitutes exactly the two `gset` settings, removes only
the fixed ON_ERROR_STOP directive and expands only the contract include. It pins
all six SQL digests, preserves transactions, builds explicit target-checked client
configuration without connectionString overrides and enforces TLS/hostname checks.
Offline checks cover six endpoint/security rejections, three directive/wrapper
rejections and four metadata gate cases. One failed preflight blocks all writes.
Only safe error codes/positions and bounded metadata summaries are emitted.

```powershell
node migrations/audit/execute-approved-setup.mjs offline
node migrations/audit/execute-approved-setup.mjs preflight --audit-use-source-ca
node migrations/audit/execute-approved-setup.mjs apply --audit-use-source-ca
```

These are the actual successful setup commands, now retained for provenance;
do not repeat the installed fresh migrations. An earlier `--use-system-ca` attempt
failed destination trust. The reviewed `--audit-use-source-ca` option instead
validated/pinned the existing configured Supabase Root 2021 CA, supplied it only
to destination TLS in memory and verified chain plus hostname. No system trust or
environment file changed. Private psql-profile commands below document the
alternative original execution design, not pending required actions.

CI/CD first supplies private libpq service profiles and TLS verification using
approved secret delivery. Resolve each profile privately to the expected reference;
the source/audit scripts' hardcoded project-reference records are **labels, not
server identity checks**. `current_database()` often equals `postgres` on both
projects. App-object preconditions catch some mistakes, not another similar app
database. Verify profile-to-endpoint mapping independently before any command;
never print its full URI or password. Use a direct/session setup connection,
verified certificates, no prior SET ROLE and a principal allowed to create schema,
NOLOGIN roles and temporary owner memberships. Do not grant broader powers merely
to bypass a failed managed-host precondition; revise the reviewed package instead.

For the already authorized scope, substitute private profile names and the recorded
source deployment label in the commands below. Profiles themselves are not part
of this repository. Execute from the repository root and retain sanitized output:

```powershell
psql 'service=<audit-setup-profile>' --no-psqlrc --set=ON_ERROR_STOP=1 --file migrations/audit/0000_preflight.sql
psql 'service=<source-setup-profile>' --no-psqlrc --set=ON_ERROR_STOP=1 --file migrations/audit/0000_preflight.sql
psql 'service=<audit-setup-profile>' --no-psqlrc --set=ON_ERROR_STOP=1 --set=audit_environment=<approved-label> --file migrations/audit/0001_destination.sql
psql 'service=<source-setup-profile>' --no-psqlrc --set=ON_ERROR_STOP=1 --set=audit_environment=<approved-label> --file migrations/audit/0001_source.sql
psql 'service=<audit-setup-profile>' --no-psqlrc --set=ON_ERROR_STOP=1 --file migrations/audit/0002_verify_destination.sql
psql 'service=<source-setup-profile>' --no-psqlrc --set=ON_ERROR_STOP=1 --file migrations/audit/0002_verify_source.sql
```

These concrete scripts supersede the setup handoff's earlier generic examples.
**Do not add `--single-transaction`: each script owns its transaction and migrations
use relative `\ir` for their shared include.** Expected source preflight finds app
users/bookings; destination finds neither. Both require PG14+, UTF8, permitted
migration powers and no audit namespaces/roles. Verify version/managed-host support
against the actual server before approval. Initial install creates fresh audit
schemas beside an existing app; collision/re-execution fails and rolls back rather
than guessing that an existing definition matches. Later upgrades need new ordered
migrations with explicit previous-version checks, not edits or blind reruns.

Migrations set UTC, five-second lock timeout, 60-second statement/idle-transaction
timeouts. New empty-table indexes are ordinary transactional indexes. No business
table is locked for rewrite; role/catalog DDL still takes locks and consumes WAL.
Record applied file digests, server version, principals and migration versions in
the approved execution handoff. Metadata verification expects six named roles
per database, all result booleans true, all eight source state/capture/maintenance
functions plus parser secured, four source guard triggers, and six destination
immutability triggers. Metadata checks are necessary but do not prove runtime
capture, permissions under real login inheritance, or correct procedures.

## Required rehearsal, recovery and remaining limits

Before binding runtime credentials or declaring TASK-014 complete, obtain scoped
synthetic-test approval and demonstrate: real domain transaction rollback/commit;
parallel claims and stale-token refusal; death before/after destination commit;
duplicate and hash-conflict handling; expired/clock-skew cases; exact canonical
hash fixtures (including numeric/Unicode differences); attempts/capture outage
behavior; safe fields and unknown-contract refusal; actual reader/writer denied
UPDATE/DELETE/TRUNCATE/DDL; bounded expiry/disposal and replay run conflicts;
restore expiry/reconciliation; representative write/query/backlog/connection load.
No such behavioral tests have run. Selected denial/fail-closed behavior requires Backend
instrumentation; these tables alone do not implement it.

If a migration fails before commit, its whole local transaction rolls back,
including newly created roles. If destination commits but source fails, retain
the inert destination and fix/review source; independent commits are not atomic.
After commit, preserve namespaces/evidence and use an additive corrective migration
or compatible worker rollback. No destructive down migration is included. Stop
a faulty worker without deleting queue evidence. Restores require separate
authorization, quarantine, retention reapplication, UUID/hash reconciliation and
gap reporting. Destination recovery older than surviving source copies can lose
history; backup/PITR capacity, 35-day recovery-point retention target, agreed
RPO/RTO and independent recovery evidence remain CI/CD/DB validation work.

Official PG14 references checked for this package: native
[SHA256/UTF8 functions](https://www.postgresql.org/docs/14/functions-binarystring.html),
[JSON functions](https://www.postgresql.org/docs/14/functions-json.html),
[queue locking](https://www.postgresql.org/docs/14/sql-select.html),
[function security](https://www.postgresql.org/docs/14/sql-createfunction.html),
and [timestamp arithmetic](https://www.postgresql.org/docs/14/functions-datetime.html).
Both servers report PG17.11; untested managed-service restrictions remain unknown.
No broad
statement logging or provider log collection has been enabled.

Preparation verification: source/contract inspection and Backend compatibility
review completed; nine local document links resolve. All six SQL files passed
offline quote/dollar-quote/parenthesis and include-existence checks; all package
files passed whitespace checks. These lexical checks do not compile SQL or
PL/pgSQL. Subsequent successful preflights, both commits, SQL digests and all 140
metadata boolean checks are documented in the execution report. No procedure
behavior, actual runtime-login permission, concurrency or recovery rehearsal has
been performed. TASK-014 remains incomplete until integration and required tests.
