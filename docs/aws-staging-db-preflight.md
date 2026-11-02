# AWS restricted staging database preflight — 31 October 2026

Status: **passed; protected runtime handoff prepared**. No application, audit
worker, synthetic/session flow or message sender was started by this DB owner.
No schema, data, database ACL, role, connection limit or credential was changed.

## Scope and authority

Requester/coordinator: Codex `/root`; assigned DB owner/executor:
`/root/aws_staging_database`. Accepted repository review, followed by the user's
explicit selection of Lightsail password-protected staging and approval of the
existing development source **hbkooiknruimukkhshrk** and independent audit
destination **ynygqodmtgjrngiudalw**. See the
[coordinator's approval and deployment record](aws-staging-deployment.md).

The resumed DB scope covers bounded read-only schema/TLS/principal checks and
secure staging of existing restricted runtime credentials. User authorization
also includes normal test-session/audit writes after preflight; this DB owner
did not exercise that later scope. No owner/setup credentials, migration, ACL
repair, role change, limit increase or automatic retry is included. Existing
public-release/privacy, billing and notification-provider holds remain.

## Private inventory and first connected attempt

Existing `.env` and `.env.audit-worker.local` passed their established
current-user-only ACL verification. Required app inputs were present, the
Supabase API URL matched the approved source, and all four database URLs mapped
to the approved target and expected restricted principal before any socket.
No credential values, connection URLs or private file contents were output.

The old audit `readSettings` parser refused valid current dotenv formatting
locally with `INVALID_QUOTED_ENV_VALUE`. No connection was attempted by that
inventory. The application's non-evaluating dotenv parser was used instead,
with duplicate-key rejection and unchanged strict target/principal/TLS checks.

Commands:

```text
node --check scripts/aws-staging-db-preflight.mjs
node --import tsx scripts/aws-staging-db-preflight.mjs
```

Both exited 0. The connected command ran **once**, through the approved
network-capable execution path. The script starts every probe read-only,
bounds connection/query/statement/lock waits, suppresses driver notices/errors,
prints only allowlisted results and closes each connection before the next.
No app database module, startup hook, claim API or migration executor is loaded.

| Principal | Target | Actual verified result | Other same-role connections at its snapshot |
| --- | --- | --- | --- |
| fmt_app_dev | source | Verified TLS, PostgreSQL 17, read-only, restricted app role, LOGIN, cap 5 | 0 |
| fmt_audit_capture_dev | source | Verified TLS, PostgreSQL 17, read-only, restricted capture capabilities, LOGIN, cap 2 | 0 |
| fmt_audit_worker_dev | source | Verified TLS, PostgreSQL 17, read-only, restricted delivery capabilities, LOGIN, cap 2 | 0 |
| fmt_audit_writer_dev | destination | Verified TLS, PostgreSQL 17, read-only, restricted writer capabilities, LOGIN, cap 2 | 0 |

Source passes all **14** current application readiness checks: restricted
principal, expected version, exact 33-table count, required DML, no destructive
billing access, exact public DML, expected audit parsers, immutable guards,
notification columns/constraints/indexes/private ACL/policies/schema access.
This reconciles the user's earlier notification SQL report against fresh
catalog evidence on the actual named remote source. Already applied audit,
location and billing migrations were preserved and not rerun.

These connection counts are individual observations, not reserved capacity.
The app pool allows five connections and its principal has a total cap of five;
avoid simultaneous local application activity or deployment overlap that can
consume that budget. No process was stopped and no limit was raised.

## Protected runtime handoff and Linux CA

- `.env.aws-staging.local`: ignored, current-user-only ACL; required app inputs
  and capture URL only. Fresh staging session secret. Audit capture/service
  views stay enabled with `AUDIT_ENVIRONMENT=development`; remote Auth auditing,
  local billing runtime, notification feature/automation/verification and social
  providers remain off. APP_URL is intentionally pending the actual HTTPS URL.
- `.env.aws-staging-worker.local`: separate ignored, current-user-only ACL;
  only audit worker/writer credentials and necessary audit/runtime flags.
  No HTTP app, setup-owner or notification-provider credentials.
- Public certificate: `deploy/aws-staging/supabase-ca.crt`, for the image/runtime
  path `/app/certs/supabase-ca.crt`. All four staged URLs retain strict
  `sslmode=verify-full` and use that Linux `sslrootcert` path. No TLS fallback.

Both original private inputs were checked unchanged after handoff. Staging
files were protected while empty, then written and checked in memory. An initial
PowerShell security-module loading failure happened before secret writes; the
corrected invocation explicitly loaded that engine's own security module and
verified owner-only ACL before writing. No credentials entered build inputs.

All four original connections share the same pinned, valid, self-signed CA.
The copied file contains exactly one public CA certificate and no private key.
Certificate SHA-256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
PEM file SHA-256:
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.

## Remaining execution and recovery

Root owns image/public-CA packaging, HTTPS APP_URL, restriction verification,
secure deployment-spec injection and actual app/audit-worker startup. Normal
audit delivery claims **any eligible event** in the shared development source,
not just newly generated staging events. This preflight did not read backlog,
claim, accept or acknowledge records; a worker start can process existing
eligible local-development events too. Coordinate that shared-target behavior
before starting the worker and preserve uncertain outcomes on failure.

Health-only smoke is distinct from normal session use. The session store does
not create tables; its first get/set/touch/destroy operation schedules expired
session pruning. User-approved normal staging session activity can therefore
touch/create/delete session records as well as generate audit events.

Recovery: stop only newly deployed staging workloads first and reconcile any
uncertain audit/session outcomes. Preserve databases, data, applied SQL and
existing private inputs. Remove only this task's protected handoff files when
they are no longer needed; never include them in a source archive or image.
No restore/backup guarantee or new destructive recovery permission is implied.

No locale/UI matrix was run for this database task. Accepted future coverage is
en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
