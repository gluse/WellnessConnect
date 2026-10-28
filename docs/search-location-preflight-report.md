# TASK-026 database metadata preflight

23 October 2026. **Read-only preflight complete; migration unapplied and release
held.** Executor: Codex `/root`, under the user's explicit "yes" in the resumed
chat to the metadata-only preflight on development/testing project
`hbkooiknruimukkhshrk`. Approval covers catalog inspection using existing
credentials, including relevant privileged metadata, without user-row reads or
writes. Migration execution, grants, fixtures, sessions, application startup,
paid APIs, deployment and the separate audit database remain outside this scope.

## Execution and boundaries

Prepared [the fixed-target helper](../scripts/preflight-search-location.mjs).
It reuses existing private-file verification, strict connection/target checks
and the pinned provider CA. It reads the existing `.env` and configured public
CA certificate privately; credentials were neither printed nor copied. No private
file/ACL changes occurred. `DATABASE_URL` supplies the locally configured
application principal; no alternative setup credential or SET ROLE is used.
The configured Supabase API project is checked when present.

```powershell
node --check scripts/preflight-search-location.mjs
node scripts/preflight-search-location.mjs run
```

Syntax passed. An offline injected-client check passed for SELECT-only catalog
statements, BEGIN READ ONLY/ROLLBACK, rejection of non-read-only identity, and
rollback on query failure. Initial sandbox execution returned safe code
`ENOTFOUND`. The same approved command succeeded with narrow network escalation;
automatic approval review did not reject it.

The successful session verified certificate/hostname TLS and used startup
`default_transaction_read_only=on`, catalog-only search path, 10-second statement,
1-second lock and 15-second idle-transaction timeouts. Both transaction/default
read-only settings returned `on`. The helper explicitly began READ ONLY, queried
catalogs, rolled back and closed the client. No application imports, business/
user/audit/session row reads, probe functions, temporary objects or writes were
included. No database recovery is needed.

## Sanitized findings

| Item | Observed result |
| --- | --- |
| Target | `hbkooiknruimukkhshrk`; database `postgres`; verified TLS |
| Server | PostgreSQL 17.11, UTF8 |
| Locally configured application/session principal | `postgres`; no role switch; LOGIN, not superuser, BYPASSRLS |
| `public.users` | Ordinary table, owner `postgres`, RLS enabled, FORCE RLS false |
| `public.users.id` | Non-null character varying; validated `users_pkey` on `id` |
| `public.user_search_locations` | Absent; no deployed columns, constraints, policies or grants to validate |
| Planned server roles | `fmt_app_dev` and `fm_app_runtime` absent |
| Browser-role rights on `users` | `anon`/`authenticated`: schema USAGE, no schema CREATE; no SELECT/INSERT/UPDATE/DELETE/REFERENCES table privilege |
| Inspected migration journals | No ordinary/partitioned `__drizzle_migrations`, `schema_migrations` or `migrations` table in `public`/`drizzle`; no journal rows read |

For tables created by `postgres` in `public`, per-schema default ACLs grant
SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN to
`anon`, `authenticated`, `postgres` and `service_role`, without grant option.
No global table-default ACL rows were returned for this creator. These defaults
apply at object creation, not to the absent table today; see
[PostgreSQL 17 default ACLs](https://www.postgresql.org/docs/17/catalog-pg-default-acl.html).

The preflight-time draft revoked PUBLIC/anon/authenticated privileges within its
creation transaction, but did **not** revoke the inherited `service_role` grant.
No grant was changed in that preflight. The locally configured
owner/BYPASSRLS connection would rely on application owner predicates for account
isolation; RLS alone does not enforce separation for that principal. See
[PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
This is local configuration evidence, not proof of a deployed application's
identity, access to the absent table or live API isolation.

## Coordination finding from repository review

[The pending audit source-runtime migration](../migrations/audit/0003_source_runtime.sql)
rejects public application tables outside its sixteen-table manifest. Its grants,
policies, [runtime contract](../migrations/audit/runtime-contract.mjs) and related
diagnostic/disabled-install checks do not include `user_search_locations`.
Installing location storage first would conflict with pending audit setup;
installing restricted runtime roles first would leave them without location
access. The packages need matching manifests and an agreed order. No TASK-014
file, pinned digest, installed audit object or existing approval was changed.

## Next choices before database-affecting implementation

**A — Recommended: prepare a coordinated server-access package locally.** Keep
selected storage option A. Propose an additional
`REVOKE ALL ON public.user_search_locations FROM service_role` to close the
observed default grant and a narrow pending audit-runtime amendment. The server
contract would grant schema USAGE plus SELECT/INSERT/UPDATE/DELETE on this table
to `fm_app_runtime`, with a server-only RLS policy consistent with the existing
shared server-role model. No sequence grant is needed. Express still enforces
verified-account predicates; a shared role is not per-account database isolation.
Preserve NOLOGIN/activation holds and browser-role denial.

Preparation would cover the unapplied location migration, pending TASK-014
manifests, grant/policy SQL, validators and affected pinned digests/tests together.
Read the latest audit handoff and coordinate ownership before editing; preserve
unrelated work and applied 0001/0002 history. Offline checks must cover owner
predicates, manifest/digest consistency, role/grant boundaries and compatibility
order. Present exact execution commands/timeouts, validation/synthetic-test scope
and recovery afterward. This takes more local work but avoids an incompatible
runtime transition. No credential provisioning, live access, grant execution or
activation is included in this proposed choice.

**B — Defer database preparation until the audit runtime design is settled.**
Keep the feature locally prepared, without migration/runtime changes. This avoids
cross-task edits now; account persistence and live acceptance remain unavailable.
Resolve the `service_role` grant decision before execution. Do not deploy code
querying the absent table.

The user subsequently selected **A** in this resumed chat. Local preparation and
offline results are recorded in [the coordinated package](search-location-database-package.md).
That selection permits the described local grant/profile work, not connected
execution. Defaults for other tables and applied audit history remain unchanged.

## Remaining acceptance

Table creation/constraints, effective post-migration grants/RLS, persistence,
actual runtime API isolation/performance, concurrency, deletion and synthetic
cleanup remain unverified. Backup/recovery availability, lock window and deployed
runtime identity remain unverified. TASK-025/qualified privacy review and live
acceptance stay open; deployment remains held. No language/browser tests ran in
this preflight. Fresh locale scope remains en/lv/ru; ar/RTL, zh, fr, de, hi, ja,
pt and es are deferred. See [the release checklist](search-location-release-checklist.md).
