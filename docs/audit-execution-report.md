# Audit development/test setup execution record

Date: 19 October 2026. Executor: assigned DB Analyst/Developer. Times below use
Europe/Riga (UTC+03:00). No production environment is in scope.

## Authorization and bounded scope

The user approved C, R1, P1 and the recommended failure behavior, then answered
**yes** to preflight followed by additive schemas/roles on both test projects if
checks pass. Targets: application **hbkooiknruimukkhshrk** and independent audit
**ynygqodmtgjrngiudalw**. The recorded source deployment label is **development**
in both databases. No repeat policy/setup permission is required within this scope.

Approved operations: bounded metadata preflight, reviewed additive audit namespaces,
NOLOGIN group roles/tables/indexes/functions/views, and read-only metadata
verification. Excluded: business-row changes, event fixtures, runtime login/binding
changes, cron/extensions, provider operations, deployment, backup/restore and app
startup. Existing credentials stay private and were not copied into artifacts.

## Execution history

| Riga time | Stage | Observed result |
| --- | --- | --- |
| 16:00–16:01 | Helper preparation | Syntax/offline endpoint, directive and metadata-gate checks passed; Backend reviewed fixed manifest, strict TLS, output sanitization and uncertainty handling. |
| 16:01:36 | Sandbox preflight attempt | Destination DNS returned ENOTFOUND; no SQL executed. |
| 16:01:59 | Approved network preflight | Destination TLS returned SELF_SIGNED_CERT_IN_CHAIN before authentication/metadata completed; no writes attempted. |
| 16:02:50 | Both-target preflight, existing OS CA store | Destination still failed chain verification; source passed verified TLS and read-only metadata checks. Dual-target gate blocked every migration. |
| 16:04–16:06 | Trust prerequisite inspection | Browser inventory had no enabled authenticated surfaces. Audit URL has no explicit sslrootcert; source URL does. Existing configured source public CA inspected without printing PEM or private settings. Parent authorized bounded reuse of this existing provider anchor for destination-only TLS, subject to review and successful hostname/chain verification. |
| 16:09:35 | CA-reuse read-only preflight | Both direct connections passed certificate/hostname validation and every preflight gate. Backend reviewed the explicit destination-only trust option before this attempt. |
| 16:09:49–16:09:50 | Apply-mode preflight | Both preflights repeated and passed on the retained connections before any migration. Both servers PG17.11, UTF8, setup principal postgres, required powers and expected source/destination object patterns; no audit namespaces/roles existed. |
| 16:09:50 | Destination migration | destination-0001 and local contract-v1 committed successfully on ynygqodmtgjrngiudalw. |
| 16:09:51 | Destination metadata verification | Passed: SELECT row counts [6,3,1,3,6,9]; 60 boolean checks true. |
| 16:09:51 | Source migration | source-0001 and local contract-v1 committed successfully on hbkooiknruimukkhshrk. |
| 16:09:51 | Source metadata verification | Passed: SELECT row counts [6,2,1,9,4,15]; 80 boolean checks true. Helper completed successfully with both commits known. |

Current status: **both additive migrations committed; both read-only metadata
verification scripts passed**. No SQL compatibility corrections, migration retries,
rollbacks or uncertain commit outcomes occurred. No event/procedure behavior tests
ran. Fresh-install apply/preflight now intentionally rejects existing audit objects;
do not rerun it as an upgrade or health check.

## Verified source and destination metadata

- Connection: direct PostgreSQL, certificate chain and hostname verification
  enforced and successful on both; intended references checked before connection.
- Server: **PostgreSQL 17.11**, server_version_num **170011**, UTF8.
- Setup principal: **postgres**; non-superuser, BYPASSRLS enabled; CREATEROLE and
  database CREATE/schema creation permission reported available.
- No prior SET ROLE; source users/bookings relations found by metadata, destination
  has neither. Both had no audit namespaces/group roles before setup.
- Post-migration result counts matched the reviewed scripts: six NOLOGIN groups
  per database, dedicated table owners/RLS, intended execute/view permissions,
  no runtime-group base-table access, protected definer paths/PUBLIC execution,
  four source/six destination guards and validated table constraints.

No application rows were read. Full migration history, capacity, runtime login
privileges and operational backups were not inspected. Both setup principals have
the same sanitized PostgreSQL role name, each in its separate named project.
No runtime logins or application role bindings were created.

## Existing trust anchor

Only the public certificate already referenced by the source connection's
sslrootcert was examined. It contains one CA certificate, issuer/subject
**Supabase Inc / Supabase Root 2021 CA**, self-issued and signature-valid; validity
28 April 2021 10:56:53 UTC through 26 April 2031 10:56:53 UTC.

SHA256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The reviewed helper option `--audit-use-source-ca` is limited to this exact
already configured public anchor, validates CA status/validity/self-signature and
supplies it only to the destination TLS configuration in memory. It refuses to
replace an explicit audit CA. It neither accepts a certificate merely presented
by the server nor changes `.env` or system trust. Chain/hostname verification
remains mandatory; failed verification still stops setup. This reuse succeeded
for destination before either additive migration was attempted.

## Applied file digests and version evidence

SHA256 values are of the exact repository file bytes pinned by the executor.
Version names below are evidenced by successful committed versioned scripts;
restricted installation/version table contents were not separately read back.

| File | SHA256 |
| --- | --- |
| _contract_v1.sql | `030f81d453a22216719cefdd550e052df558ec89dc99334b92460e86ee3ae64b` |
| 0000_preflight.sql | `d89af727f54c046be4f8ef3e81bdc9c2af9c8e22dd65794169276a90582f5b63` |
| 0001_destination.sql | `13c44e20635125ab0918f1acc5c4424a0bf64b36b2945f2a336497b3eacf3381` |
| 0001_source.sql | `2cdd5712867a328779dd3062d7344ce69459594ca4405bfffbea21394838978a` |
| 0002_verify_destination.sql | `f21583e63abecb3b741aac04d18f8bf3be14d6e17494e43af1eee2a5e9aef733` |
| 0002_verify_source.sql | `cbe1bbb20b0c9c24816a1d416fff7b4efbedc4d962a5d8ecb8ccb26d836adfba` |
| execute-approved-setup.mjs | `4bdc6d5242b995642737091c2c447ab556182d2938c1c380f1f6a01525c91993` |

Installed by these commits: contract-v1 independently on both databases,
destination-0001 and source-0001. The staged eleven-event B/S contract and deployment
label development are the versions selected in the committed manifest. Runtime
capture/delivery is not implemented or enabled by this setup.

## Artifacts and recovery boundary

See [the migration package](audit-migration-package.md) for the exact six SQL
files, signatures/roles, compatibility constraints and recovery plan. The helper
[execute-approved-setup.mjs](../migrations/audit/execute-approved-setup.mjs) pins
their digests, accepts only offline/preflight/apply with the optional fixed trust
choice, preserves BEGIN/COMMIT and includes, checks both targets before any write,
then applies/verifies destination before source on retained connections.

Both commits are known successful and no recovery is needed. Preserve installed
objects and evidence; future corrections require additive versioned migrations.
If one database later commits and the next fails, preserve the committed objects.
Class08/40003 outcomes remain uncertain even after best-effort rollback; do not
blind-retry an uncertain or committed migration. The setup principal may retain
bootstrap-granted creator ADMIN rights on newer PostgreSQL versions; temporary
explicit SET-capable grants do not promise removal of all administrative access.

Outstanding beyond setup: actual login inheritance/permission probes, enqueue/
rollback, worker leases/crashes/deduplication, source/destination outages, capture
instrumentation, reader self-audit, scheduled retention, performance and recovery
rehearsals. These have not been executed or claimed complete.
