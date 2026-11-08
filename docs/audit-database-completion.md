# Audit database completion — 7 November 2026

See [authorization and integrated evidence](audit-review-completion-2026-11-07.md).
Targets remain development source `hbkooiknruimukkhshrk` and independent audit
destination `ynygqodmtgjrngiudalw`. **No database backup was taken**, as requested.

The DB owner applied pinned `0008_destination_completion.sql` followed by
`0008_source_completion.sql`; exact files and helper hashes are in
`completion-package.mjs`. Preserve these applied bytes. Shared migration marker
is `completion-v1-0008`. Legacy parser bodies are retained; the new dispatcher
validates viewer, redacted business CRUD, bounded location reports, remote Auth,
protected reads and integration/background operations. P1 remains R90/B-S365.

All 26 reviewed business tables have an enabled AFTER INSERT/UPDATE/DELETE
trigger. It captures actual changed field names, a stable table/row reference and
database-runtime actor in the business transaction. No-op updates create no
event. A capture error fails the mutation; old/new row values never enter audit
history. Human/workspace attribution remains a separate required enhancement.

A new independent `fmt_audit_reader_dev` LOGIN is a member only of the existing
read-only reader role, connection limit2. Verified TLS, view SELECT, denied base
table/DDL/write/extra-role access were checked. Credential was provisioned using
verified session-local secret logging controls and protected file handoff. App
`.env` holds the reader URL plus explicit reader/exporter UUID lists; values are
not published. The existing named development admin was copied once into those
lists; future app-admin changes do not confer audit access automatically.

Rehearsal: 16 accepted/13 rejected event contracts per target, retention checks,
canonical redaction and source3 CRUD events passed after fixing a rehearsal-only
circular ADMIN self-grant. Capture-failure injection proved business rollback.
Exact setup memberships were restored. No rehearsal rows were committed.

The later fixed native test committed three synthetic category changes before
stopping. Root reconciled it with **existing restricted roles only**, delivered
six pending records, found its three redacted events through the actual reader,
then captured one fixed synthetic viewer event twice and delivered exactly one
matching record/hash. Source category is absent; final pending/leased/quarantined/
expired/failure counts are zero. No business changes were repeated and no ACLs
changed during Root's reconciliation. See the integrated record for provenance.

The current integrated app readiness was updated to pin the new active parser
and the preserved legacy chain. Historical migration readiness profiles are
unchanged. The restricted application login passed all32 integrated plus2
currency checks using read-only metadata; no startup checks were bypassed.

`AUDIT_PRODUCER_CONTRACT=completion-0008` and Auth producers are enabled in the
protected development `.env`. Restart the app and updated audit worker. No
daemon, production deployment, retention purge, native provider ingestion or
restore exercise is claimed. Recovery uses forward fixes, retained history and
restricted account/configuration rollback; never reinstall applied SQL blindly.
