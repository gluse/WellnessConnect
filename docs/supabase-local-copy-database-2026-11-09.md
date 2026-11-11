# Independent Docker Supabase copy — database owner

TASK-064, 9 November 2026. Assigned owner/executor `/root/local_copy_database`
accepts the user's request to copy the current database, followed by the explicit
selection **Copy on my PC using Docker** and **resume**. Root coordinates local
infrastructure; Backend owns the explicit local runtime profile.

Scope: read-only logical inspection/export of the existing hosted application
project `hbkooiknruimukkhshrk` and audit project `ynygqodmtgjrngiudalw`; restore to
new isolated local Docker databases. Necessary protected owner credentials may
be read without printing them. No hosted writes, grants, credential resets,
AWS changes, spending, or reuse of consumed migration/preflight grants.

Current host endpoints after the10November Windows port repair: application
PostgreSQL `127.0.0.1:15422/postgres`, audit PostgreSQL
`127.0.0.1:15432/postgres`, Supabase API `127.0.0.1:15421`, local mailbox
`127.0.0.1:15424`. The original543xx endpoints below are historical.

Initial9November endpoints: application PostgreSQL `127.0.0.1:54322/postgres`,
audit PostgreSQL `127.0.0.1:54332/postgres`, Supabase API `127.0.0.1:54321`.
New local credentials preserve the existing restricted role names, memberships
and caps; hosted passwords are not runtime credentials for the local copy.

Copy inventory includes all application `public` objects plus source
`audit_contract`, `audit_capture`, `audit_rehearsal`; audit destination
`audit_contract`, `audit`, `audit_rehearsal`. Auth identity/password data must
remain consistent with public user IDs. Storage bytes are coordinated by Root.
The historical six-table transfer command is unsuitable and is not executed.

Connected source access must use pinned-CA TLS, fixed target verification and
read-only transactions/options. Source inspection reports metadata/counts only.
Local restores suppress trigger execution during data loading, retain grants,
sequences and constraints, and exclude usable source sessions/refresh tokens.
Workers remain stopped until local routing and copied history are verified;
no copied notification, payment or audit queue may contact a hosted endpoint.

Status: **database copy, runtime security checks and stop/start persistence
verification complete**. Backend's bounded local authentication/session/audit
smoke and exact fixture cleanup passed; Root's local restart preserved the copy.
Recovery preserves hosted state and retains the original `.env`; new local
profile/volumes/backups remain until reviewed. DB-only checks
have no locale matrix; application checks use en/lv/ru; ar/RTL, zh, fr, de, hi,
ja, pt, es remain deferred.

## Applied copy and verification

Source metadata inspection verified PostgreSQL17.11 on both fixed targets with
pinned-CA TLS/read-only transactions. Application database24,106,675bytes and
audit18,167,475bytes; all selected relations readable. The default sandbox DNS
attempt failed before a connection; the explicitly released network invocation
passed. Hosted records were never modified or paused.

Native PostgreSQL17.11 tools were downloaded from the official EDB Windows binary
archive. Vendor sidecar SHA256:
`80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`.
Only bin executables/DLLs were extracted. Docker's export attempt could not reach
the direct IPv6-only hosts; a read-only probe proved Network unreachable. The
corrected native export used the same exact targets/verified TLS and passed.
Original failure evidence is retained privately; no old one-shot grants reused.

The source application and durable Auth archives share one exported repeatable-
read snapshot. Audit uses its own consistent snapshot; AWS remained live, so the
two independent databases are forks of their individual snapshot times. Custom
archives and complete manifests reside in owner-only gitignored
`outputs/supabase-local-private/`. Application archive986,433bytes, Auth8,659bytes,
audit529,798bytes; SHA256s are in the sanitized export receipt.

Restored new local databases in per-target transactions, preserving every
selected table's count, identities, relationships, constraints, sequences,
ownership, grants, RLS and audit history. Counts cover54source tables (41public,
custom audit and6durable Auth tables) and8audit destination tables. New random
local-only passwords preserve the five restricted runtime roles and source
memberships/caps; no cloud credential becomes a local runtime password.

Native Windows pg_restore text output converted function body newlines and
initially failed the exact parser-hash gate. The custom archives remained exact.
Linux decoding of selected original FUNCTION TOC entries, followed by local
Node pg CREATE OR REPLACE, corrected all32source and17audit functions. Final
body hashes exactly match archive bytes; owner/configuration/security-definer/
volatility/ACL metadata is unchanged. No source function changes or weakened
startup checks. An intervening direct-definition metadata attempt stopped before
any artifact/local edit; correction used existing archives only. A Docker TOC
stdin early-close issue was fixed by native file-based TOC listing, which carries
no function bodies. All stopped stages and protected diagnostics are retained.

Final read-only verification:

- All38current application metadata gates passed.
- App/capture/worker/writer/reader exact rights and caps5/2/2/2/2 passed, with
  zero competing clients and exact audit parser chains. Plain transport is only
  the explicit development loopback profile; hosted TLS remains unchanged.
- All41public tables have RLS. Sixteen Auth users/eighteen identities match the
  application profiles; no unmatched application users.
- No copied application/Auth sessions, refresh tokens or user confirmation/
  recovery tokens remain. Email/password identities and hashes are preserved.
- Storage delegate copied32objects,13,145,565bytes through local API; all bytes
  verified. Twenty referenced application object paths resolve locally, with
  zero missing paths and zero hosted Storage URLs. External social avatars are
  not rewritten. Storage metadata was not SQL-restored.
- No cron.job table/scheduler copied; no hosted job replay. Local notification,
  activity, payments and OAuth provider integrations remain dormant under the
  explicit local profile. Ordinary audit remains enabled and locally routed.

Receipts: `output/supabase-local-copy-2026-11-09/export-result.json`,
`database-restore-result.json`, `function-fidelity-result.json`,
`database-verification.json`, and the Storage delegate's `storage-result.json`.

Passed offline export/role safety checks and scoped diff whitespace checks.
Backend's new historical-operation guard was reviewed/accepted: ordinary npm
db:push,db:setup-*,db:mark-locations-verified,db:transfer,storage:setup and
test:integration refuse before executing while the local profile exists, so
retained hosted `.env` cannot be used accidentally through those commands.
Existing source-specific executors/migrations are unchanged and need exact
target review before deliberate use. New db:local:start/stop/status are local
infrastructure operations. This is a development fork, not synchronization.

## Local smoke, cleanup and persistence completion — 10 November 2026

The Backend owner's bounded local-only smoke passed application startup/readiness,
guest search, synthetic password login, server session roundtrip, logout and
audit delivery. A `.invalid` synthetic identity was created with local Admin Auth
and confirmed without external email. All task app processes and worker pools
closed before final database checks. The DB owner removed only the exact marked
profile after asserting its email/ID against local Auth and verifying no dependent
business rows; logout had already removed its session. Business audit triggers
remained active and their deletion evidence was retained. Backend deleted the
exact local Auth fixture and delivered the cleanup audit event in one bounded
local step. Original sixteen users/eighteen identities remain. Existing236
quarantined records were inherited from the copied source; no new smoke failures,
retry or quarantine was reported. Earlier234 evidence is historical, not the
current local baseline. See the Backend handoff for application-specific receipts.

Final 9 November owner verification also checked every public serial sequence
is ahead of existing IDs without invoking nextval or modifying sequence state.
The protected persistence baseline covers58source tables (public, custom audit,
durable Auth and cleared session state, local Storage metadata) and8audit tables,
all49custom functions, ten source sequences,22role definitions, and constraints.
Rows are compared through counts and sorted per-row SHA256 aggregate hashes;
private values are never reported.

The user resumed on10November and instructed continuation. Offline baseline
integrity and a fresh **pre-stop** read-only snapshot matched exactly, proving
there was no overnight drift. Root independently verified no app/worker consumer
or port5000listener, then executed the approved local stop/start lifecycle.
Volumes remained; six Supabase containers were recreated and the existing audit/
ingress containers restarted. No hosted operation was performed.

The DB owner's sole postrestart compare passed with the exact original fingerprint:
`a9b8485e3f3f95b70ebae33c8b419c5a8f4ee6992dbf304ff0b4b57f60b96371`.
No table rows, function bodies/metadata, sequence state, role attributes,
constraints or copied Storage metadata changed across restart.

A distinct create-only postrestart receipt preserves historical verification:
all38current application gates and all five restricted-role rights/caps passed;
zero competing runtime clients,41RLS-protected application tables,16Auth users,
18identities, no unmatched users or copied sessions/refresh/user tokens,
32Storage objects,20referenced paths with zero missing or hosted Storage URLs,
no copied scheduler, and safe serial-sequence advancement. All probe connections
closed. Backend and Storage owners were released only after that compare for
their minimal postrestart API and byte checks; those remain their own evidence.

Completion receipts in `output/supabase-local-copy-2026-11-09/`:
`persistence-baseline.json`, `persistence-prestop-20261110.json`,
`persistence-compare.json`, `database-verification-postrestart-20261110.json`,
and `fixture-profile-cleanup.json`. The complete baseline and fixture identity
remain protected under `outputs/supabase-local-private/`.

The DB owner delegated Storage bucket creation/upload metadata writes only to
`/root/local_copy_storage` on the new local API; hosted Storage was read-only.
Backend's guarded command routing was accepted under standing cooperation, with
no delegation of source mutation or old consumed grants. The original protected
`.env` and AWS runtime were retained throughout. No new source reads/exports,
source writes, migrations, credential resets or cloud operations occurred during
the10November persistence completion. No DB acceptance check remains pending.

## Windows excluded-port repair — 10 November 2026

The user reported that `npm run db:local:start` failed. Root reproduced Windows
denying the host bind on54322 and measured an excluded TCP range54310–54409,
covering every original local host endpoint. Database containers and their
persistent volumes were healthy; the ingress host bindings were absent. This
was a host routing failure, not database loss. No Windows reservation/security
policy was changed.

The DB owner accepted this routine local configuration dependency and delegated
Root's DB port/shadow-port configuration edits and protected status URL rewrite;
Backend owned strict runtime constants and protected profile URL changes. New
host ports are15421(API),15422(application DB),15424(Mailpit),15432(audit DB),
with15420reserved in local configuration for the unused shadow DB. Docker's
internal HAProxy ports remain543xx; Root owns ingress/lifecycle changes.
Credentials, identities, memberships, flags and all database/volume state remain
the same. The original hosted `.env` and AWS configuration are unchanged.

Before any stop, the DB owner captured both local databases directly through
Docker exec in read-only repeatable-read transactions, because old host ports
were inaccessible. Counts plus per-row SHA256 hashes and function/sequence/role/
constraint metadata were saved in a new owner-only baseline; original baselines
and receipts were preserved. The container transport keeps64-bit sequence values
as text and restores the original metadata field order for exact comparison.
It performs no schema/grant/data writes. This new baseline still matched the
original copy fingerprint, confirming no intervening drift.

Root verified new ports with exclusive loopback bind probes and no app/worker
consumers, then recreated local routing/managed containers without deleting
volumes. Backend rewrote only the five protected DB URLs and local Supabase URL,
retaining a protected rollback. Root captured and compared fresh CLI status:
only five endpoint URL fields changed; credentials and remaining settings were
bit-identical, with owner-only ACL verification and a protected backup.

DB administrative runners now pin15422/15432 and validate the current protected
status DB URL as loopback15422/postgres/principalpostgres before reading its
local password. Old54322, remote hosts, hostname aliases, wrong database names
and URL overrides fail before any socket. The verifier's runtime URLs match the
Backend's new strict port contract; hosted validators/TLS are unchanged.

After `npm run db:local:start` succeeded and actual host bindings were verified,
the DB owner compared the new **host** route against the pre-repair container
snapshot. Both produced the same exact fingerprint:
`a9b8485e3f3f95b70ebae33c8b419c5a8f4ee6992dbf304ff0b4b57f60b96371`.
This covers58source/8audit tables,49functions, ten sequences,22roles and
constraints. All38application gates and five restricted-role checks passed
through the new ports, including exact caps5/2/2/2/2, no competing clients,
41RLS tables, sixteen Auth users/eighteen identities, no copied sessions/tokens,
32images/twenty referenced paths with zero missing or hosted Storage URLs, and
safe sequence advancement. All probe connections closed before Backend's
fixture-free API/negative-password probe was released.

New receipts in `output/supabase-local-copy-2026-11-09/`:
`port-repair-before-20261110.json`, `port-repair-after-20261110.json`,
`database-verification-ports-20261110.json`. The complete new baseline remains
protected as `outputs/supabase-local-private/port-repair-baseline-20261110.json`.
Focused tests passed for admin endpoint rejection, container snapshot precision/
read-only behavior and the Backend/DB port contract; syntax/diff checks passed.
No connected source access, source export, schema/grant/data change, cloud action
or Windows policy modification was needed for this repair. DB acceptance is
complete; Root/Backend own final command/API behavior evidence.

The full real npm stop/start test then exposed one remaining legacy setting:
the already-running audit container still had HostConfig publishing54332.
Stopping it succeeded, but starting that same container hit the Windows excluded
range even on the internal Docker network. This failed start did not delete or
modify its database volume. Root held the managed stack while the DB owner
accepted and explicitly delegated replacement of only that stopped audit
container with the same pinned image, name, environment/password, health check,
restart policy, task label, internal network and exact named PGDATA volume,
**without any direct published ports**.

The reviewed Root repair saved a protected minimal prior specification, checked
the sole volume/image/environment/network, removed the container without `-v`,
and recreated it without `--publish`. It verified the retained volume's original
creation time/mountpoint, healthy database and empty HostConfig.PortBindings.
The DB-owned fresh provisioning helper was also corrected to omit publication;
it was not executed against the existing volume. All external-to-container audit
connections now use the loopback15432 ingress route.

Root's actual `npm run db:local:start` subsequently exited0 with all eight local
services healthy. Root additionally stopped and started the new audit container
to prove that a completely stopped restart no longer requests54332. The DB
owner's distinct **final post-lifecycle** host-port comparison again matched the
original before-repair fingerprint exactly across all66selected tables and
metadata. Previous new-port38gate/five-role/sequence evidence remains applicable
because those attributes were unchanged; no redundant broad checks were run.
The Backend owner's fixture-free app/new-API/negative-password test had passed
without creating an account/session, and all consumers were closed before this
final comparison.

Additional receipts: `audit-no-publish-repair-20261110.json` (Root) and
`port-repair-lifecycle-20261110.json` (DB). This completes database acceptance
for the reported startup error while preserving all historical failure evidence,
original/private baselines, user data and hosted state.
