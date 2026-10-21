# Audit runtime accounts and rehearsal proposal

Prepared 19 October 2026 by the assigned DB Analyst/Developer. Status: **Choice 1
and bounded synthetic rehearsal selected for local preparation** on 19 October.
Connected runtime/grant/secret/fixture execution still requires final approval of
the concrete implementation package. No new database
connection, grants, fixtures, credential changes or application startup occurred
while preparing this document. Existing C/R1/P1/failure-policy decisions remain
selected; both [additive setup commits](audit-execution-report.md) remain installed.

Targets: source **hbkooiknruimukkhshrk**, audit **ynygqodmtgjrngiudalw**,
PostgreSQL 17.11, deployment label **development**. The previous setup execution
approval explicitly excluded runtime bindings and fixtures; “proceed with next
work” advances preparation without selecting these materially new database changes.

## Small decision package

| Choice | Concrete change and tradeoff |
| --- | --- |
| **1 — recommended: restricted app and workers** | Add a non-owner application role with explicit access to the 16 existing app/session tables and ten sequences, scoped server-role RLS policies, independent capture/worker/writer accounts. Move setup-owner connections out of application runtime. More compatibility checking because the app currently relies on owner/BYPASSRLS access. Provides a meaningful source boundary as well as an independent destination boundary. |
| **2 — staged development-only worker restriction** | Add the same independent capture/worker/writer accounts, retain the current owner-connected application for local domain transactions temporarily. No app-table/RLS permission changes yet. Smaller first cut, but a compromised app can alter source outbox/state and bypass its protections. This cannot be described as complete runtime hardening; full application restriction remains a tracked gate before production. |

For either choice, approve the same bounded rehearsal described below: rollback-
only tests plus **at most twelve explicitly marked, committed synthetic audit
events** for genuine worker visibility/crash/concurrency checks. Retain committed
evidence under P1; do not silently delete it after testing. Reader/export/human
maintenance bindings, real business/Auth/session paths, production, app deployment,
backup/restore and cron stay excluded.

The user chose **“Recommended: restricted application, capture, and worker accounts;
include the synthetic rehearsal.”** This selects local implementation of 0003 and
the test package, including private-file handoff design. It does not yet authorize
connected grants, credentials, secret-file changes or fixtures. The DB Analyst
prepares that concrete package and obtains review before final execution approval.
No need to choose C/R1/P1 or the same runtime design again.

## Named accounts, connections and secrets

| Project | Proposed login | Membership and runtime slot |
| --- | --- | --- |
| Source | `fmt_app_dev` — choice 1 | New `fm_app_runtime` plus existing `fm_audit_capture`; application `DATABASE_URL`. |
| Source | `fmt_audit_capture_dev` | Existing `fm_audit_capture` only; `AUDIT_CAPTURE_DATABASE_URL` for independent failed/denied events after rollback. |
| Source | `fmt_audit_worker_dev` | `fm_audit_delivery` plus `fm_audit_source_monitor`; `AUDIT_SOURCE_DATABASE_URL`. Monitor membership permits the existing payload-free `delivery_health` view. |
| Audit | `fmt_audit_writer_dev` | `fm_audit_writer` only; worker `AUDIT_DATABASE_URL`. |

All logins: NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS;
no table/schema ownership, owner-role membership, grant/admin options or persistent
DDL authority. Proposed single-instance dev connection caps: app 5, independent
capture 2, source worker 2, destination writer 2, subject to host-capacity preflight.
No public/schema-wide future-object grants. Verify inherited PUBLIC CREATE rights
and policy effects; unexpected rights block activation rather than triggering
unreviewed global revocations. Ordinary database TEMP rights are distinct from
permanent schema DDL; grant none additionally to runtime accounts.

Keep setup credentials under distinct names in ignored `.env.audit-setup.local`:
`AUDIT_SETUP_SOURCE_DATABASE_URL`, `AUDIT_SETUP_DESTINATION_DATABASE_URL`. Application
`.env` receives only its restricted app/capture URLs for choice 1; the separate
worker's ignored `.env.audit-worker.local` receives only source-worker/destination-
writer URLs and deployment label. Do not load setup files from either runtime
process. Choice 2 keeps the declared owner app URL exception, while worker/capture
connections remain restricted. Backend confirms exact loading/startup interfaces.

After selection, generate independent passwords with OS-backed crypto (32 random
bytes, base64url), persist only in the intended private files with current-user
access and verified git-ignore status, and provision through a reviewed private
setup path. Never print passwords/URLs, compute credential fingerprints for
reports, put credentials in command arguments or commit them. PostgreSQL's native
SCRAM storage is permitted; this proposal does not copy its credential verifiers.
Preflight must establish safe setup-session statement/parameter logging behavior;
if secrets cannot be kept out of logs/errors, stop rather than sending them.
Roles are initially NOLOGIN with no password; final enablement happens only after
private secret persistence, grants and validation succeed. Failed secret/setup
steps leave the affected account disabled. No `.env` values are changed now.

Both runtime endpoints need verified certificate chains and native hostname
checks. Use explicit per-connection `sslrootcert` pointing to the existing verified
public Supabase Root 2021 CA; no machine trust changes or accepted server-presented
certificate shortcuts. The installed setup helper's pinned in-memory reuse proves
this provider anchor works for both projects; do not reuse owner credentials.

## Choice 1: exact application compatibility scope

Repository evidence: `shared/schema.ts` declares these sixteen public tables;
`server/db.ts` exports the shared pool used by business queries and sessions.
`server/auth.ts:101` sets `createTableIfMissing:false`; session reads/upserts/touch/
deletes/pruning need DML, not schema creation. The role still trusts Express for
tenant authorization; a role-scoped all-row policy is **not tenant-isolating RLS**.

| Explicit public tables | Minimum current server operations |
| --- | --- |
| sessions, employees, categories, addresses, services, service_reviews, service_embeddings | SELECT, INSERT, UPDATE, DELETE |
| users, companies, company_memberships, company_invitations, provider_subscriptions, storefronts, geocoding_cache, bookings, availability | SELECT, INSERT, UPDATE, with DELETE additionally on company_memberships |

Bookings cancel and availability delete currently update state; invitations revoke
updates a timestamp. No blanket DELETE on every table is proposed. Sequence USAGE
only: companies_id_seq, provider_subscriptions_id_seq, storefronts_id_seq,
employees_id_seq, addresses_id_seq, services_id_seq, bookings_id_seq,
service_reviews_id_seq, service_embeddings_id_seq, availability_id_seq. No sequence
UPDATE/setval, business-table TRUNCATE, grants to auth/storage/cron schemas, role
administration, migrations or execution of `public.purge_expired_geocoding()`.
That scheduled cleanup remains a maintenance operation with its existing owner.

The following is reviewable SQL **inside this proposal**, not a migration applied
or implemented before selection. Authentication secrets are deliberately absent:

```sql
-- Source: choice 1 only; new role names/policy collisions must fail preflight.
CREATE ROLE fm_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;
CREATE ROLE fmt_app_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
GRANT USAGE ON SCHEMA public TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sessions,public.employees,
  public.categories,public.addresses,public.services,public.service_reviews,
  public.service_embeddings TO fm_app_runtime;
GRANT SELECT,INSERT,UPDATE ON public.users,public.companies,
  public.company_memberships,public.company_invitations,public.provider_subscriptions,
  public.storefronts,public.geocoding_cache,public.bookings,public.availability
  TO fm_app_runtime;
GRANT DELETE ON public.company_memberships TO fm_app_runtime;
GRANT USAGE ON SEQUENCE public.companies_id_seq,public.provider_subscriptions_id_seq,
  public.storefronts_id_seq,public.employees_id_seq,public.addresses_id_seq,
  public.services_id_seq,public.bookings_id_seq,public.service_reviews_id_seq,
  public.service_embeddings_id_seq,public.availability_id_seq TO fm_app_runtime;
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['sessions','users','companies','company_memberships',
    'company_invitations','provider_subscriptions','storefronts','employees',
    'categories','addresses','services','geocoding_cache','bookings',
    'service_reviews','service_embeddings','availability'] LOOP
    EXECUTE format('CREATE POLICY fmt_app_server ON public.%I FOR ALL '
      'TO fm_app_runtime USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
GRANT fm_app_runtime,fm_audit_capture TO fmt_app_dev
  WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;

-- Source: both choices. Enable passwords/LOGIN privately only after validation.
CREATE ROLE fmt_audit_capture_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE fmt_audit_worker_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT fm_audit_capture TO fmt_audit_capture_dev
  WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
GRANT fm_audit_delivery,fm_audit_source_monitor TO fmt_audit_worker_dev
  WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;

-- Independent audit project: both choices.
CREATE ROLE fmt_audit_writer_dev NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT fm_audit_writer TO fmt_audit_writer_dev
  WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;
```

Live preflight after selection compares exact tables/sequences, RLS flags, policies,
ownership, PUBLIC/inherited privileges, role absence and 0001 versions. Missing
tables, disabled RLS, restrictive policies or unexpected inherited DDL rights stop
choice 1; do not silently enable/disable RLS, grant BYPASSRLS or rewrite existing
policies. Existing rows are unchanged; RLS policy DDL takes table/catalog locks,
so use five-second lock/60-second statement limits and roll back a failed local
transaction. Test app upsert/row-lock/session compatibility structurally and with
mocked adapters; real session/business-path tests are outside this rehearsal.

## Rehearsal package: precise scope and honest limits

Proposed new files after selection: `migrations/audit/0003_source_runtime.sql`,
`0003_destination_runtime.sql`, scoped `0003_source_rehearsal.sql` /
`0003_destination_rehearsal.sql`, fixed-manifest `execute-runtime-setup.mjs`, and
`scripts/test-audit-db.mjs`. Never edit already applied 0001 files or their pinned
helper. The runner accepts exact target refs, fixed operation/run IDs, safe modes
and parameterized calls only; it never starts Express or uses Supabase APIs.

Scoped test objects: per-project `audit_test` namespace, NOLOGIN
`fm_audit_test_owner`, temporary login `fmt_audit_test_dev`, protected run/event
manifest and bounded inspection/fixture helpers. The test login can inspect only
the predeclared manifest cohort; it gets no application/session tables or arbitrary
audit SELECT/DELETE. Actual capture/worker/writer logins exercise installed runtime
procedures, so tests do not certify cloned queues instead of the real ones.
Any owner-only backdated expiry fixtures occur within transactions that always
roll back and are restricted to the manifest IDs. Negative privilege probes use
ROLLBACK/savepoints and catalog checks, not existing-row UPDATE/DELETE attempts.

Run ID: `a0140000-0000-4000-8000-000000000001`. Closed committed event allowlist:
`a0140001-0000-4000-8000-000000000001` through
`a0140001-0000-4000-8000-00000000000c` (twelve explicit UUIDs, materialized as an
array in the reviewed helper; no prefix-based cleanup). The durable manifest on
both projects records **synthetic audit rehearsal**, run/operation ID, exact event
IDs, scenario names, timestamps and outcomes. No credential material goes there.

Committed probes use only anonymous/unknown-scope synthetic denied-request events
with empty changes and safe registered reasons, deployment development, component
authorization, no real user IDs or user activity. Their operationId joins the run
manifest. Future viewer/history/export must label these IDs as synthetic from the
manifest; do not present them as real authentication attempts. The manifest is
retained with its S evidence for 365 days. Source delivered copies follow seven-
day/expiry P1 cleanup; destination/incident evidence follows 365-day P1. No early
fixture deletion or altered retention clock is authorized by this recommendation.

| Can be proved in rollback-only transactions | Requires committed, marked cohort |
| --- | --- |
| Temp-table synthetic mutation and enqueue roll back together; enqueue error aborts that temp mutation. This verifies the transaction adapter, not real business routes. | Separate worker connection sees committed outbox and cannot see rolled-back records. |
| Parser/redaction/oversize/secret-like synthetic input rejection; exact hash/UUID rules; expired destination refusal and source expired-ingestion refusal. | Competing real claim connections obtain distinct records; crash after claim recovers after actual lease expiry. |
| Same-transaction lease/CAS refusal; owner-only backdated expiry fixtures, bounded purge and maintenance counts, all rolled back. | Destination commit before missing source ack retries as matching and eventually acknowledges once; first receivedAt stays unchanged. |
| Restricted-role metadata/permission assertions; safe SQL errors; no real business or session rows touched. | Changed valid payload for an accepted UUID produces safe conflict evidence without changing original; outage/error injection preserves pending source evidence and later catchup. |

The installed claim API has no event-ID filter. Therefore live cohort tests require
an explicitly exclusive test window: normal audit producers/worker processes
disabled, test logins not distributed elsewhere, and zero preexisting pending/
leased/quarantined events. The runner verifies this before seeding, asserts every
claimed ID belongs to the closed manifest, and stops on drift; it must never drain
an unrelated backlog. If exclusivity cannot be established, do not run real-queue
tests; use a separate isolated test project pair or defer that evidence. A row-
count check alone does not prevent an unrelated concurrent producer.

Outage scenarios use isolated test-client connection failure/rejection injection;
no provider outages, firewall edits, database shutdown, role disabling or global
network changes. Distinguish live source/destination transaction evidence from
injected transport failure. Concurrency/lease tests may wait for the real 30-second
lease. Backup restore, crash of the database server, full disk and existing
business rollback are not demonstrated by this suite.

## Execution, zero-leak cleanup and recovery

After choice, the concrete helper will expose offline preparation, runtime
preflight/apply, rollback rehearsal and committed-cohort rehearsal modes. Commands
will contain only script/mode and the fixed run ID, never URLs/passwords. Before
live execution, DB and Backend review exact files, private secret handling,
fixture allowlist and assertions; record selected choice/executor/targets/limits.
Destination writer setup precedes source bindings, then restricted-role metadata
checks, rollback-only tests and finally the exclusive committed cohort.

Cleanup closes all pools and removes temp relations, disables/revokes the temporary
test login/probes and eliminates temporary fixture privileges. Keep only protected
run provenance and the selected P1 audit evidence; zero-leak cleanup does not mean
erasing committed audit history. Report any undelivered/quarantined test events as
incomplete and resolve only those manifest IDs through reviewed procedures.
No blanket DELETE/TRUNCATE or source/destination reset is included.

On partial failure, preserve installed audit objects/evidence, disable newly
provisioned affected logins and retain private setup access for repair. Do not
auto-restore the owner URL into app runtime or broaden roles to make tests pass.
Roll back failed local grant/policy transactions; committed grant corrections use
new versioned SQL with before/after ACL/policy evidence. Disable new app/capture/
worker activation until required checks pass. Future production accounts and
runtime activation/deployment remain separate named-environment work.
