# TASK-026 coordinated database package

23 October 2026. **Local preparation and offline checks complete; unapplied.**
User selected next-step A in the resumed TASK-026 chat. Approver: user; executor:
Codex `/root`. Scope: local location grant/policy preparation, coordinated audit
runtime compatibility and offline/mocked verification. No connected database
operation, private configuration read, source/destination mutation, credential
provisioning, fixture/session write, activation or deployment occurred in this
preparation pass. The earlier [approved metadata preflight](search-location-preflight-report.md)
is historical evidence, not a new connection or migration approval.

## Technical choice and ownership

Preserve the active sixteen-table TASK-014 foundation and its pinned scripts.
The latest audit handoff records a committed destination and separately scoped
source recovery/continuation work. Those files belong to another thread; changing
them would invalidate its reviewed pins and require coordination with that owner.

Use a separate opt-in seventeen-table profile after the verified sixteen-table
runtime. This implements the selected location/storage privilege design without
rewriting applied history or the active continuation. Location-first is deliberately
rejected: both the unchanged foundation preflight and the new location migration
fail closed in the wrong order. There is no claim that either installer accepts
arbitrary order or unknown existing tables.

No audit owner is reachable in this thread's roster. The
[coordination queue](agent-coordination.md#task-026-local-locationruntime-extension)
records the accepted user scope, isolated file ownership and return/request for
integration. It is not evidence of delivery to or acceptance by another session.
The owning audit thread must consume the new profile for future location-enabled
verification; its old sixteen-table verifier intentionally remains strict.

## Reviewable files and contract

| File | Prepared behavior |
| --- | --- |
| [0009 migration](../migrations/0009_user_search_locations.sql) | Creates the private table/constraints; removes PUBLIC, anon, authenticated and service_role defaults within the same transaction; grants only SELECT/INSERT/UPDATE/DELETE to fm_app_runtime; adds one server-only policy |
| [Location runtime profile](../migrations/audit/search-location-runtime.mjs) | Extends the explicit table/relation contract to seventeen; retains existing role restrictions, foundation policies, sequence masks, audit entrypoints, grant-option checks and owner-membership comparison |
| [Fixed source executor](../migrations/execute-search-location.mjs) | Pins the location SQL, checks unchanged audit pins and repository declarations; verifies the sixteen-table foundation before any write; applies only location SQL; checks COMMIT/receipt and the seventeen-table profile; no destination connection |
| [Offline tests](../scripts/test-search-location-package.mjs) | Manifest/privilege/profile boundaries, wrong-order rejection, read-only metadata lifecycle, preflight failures, commit ambiguity, missing receipt, post-commit failure, cleanup and inert imports |

The existing ORM shape remains compatible. The new server policy follows the
selected shared-role model (`USING(true) WITH CHECK(true)` for fm_app_runtime).
It is not per-account database isolation; see the
[PostgreSQL 17 RLS rules](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
Verified account predicates in the API/store remain mandatory. The
[object privilege contract](https://www.postgresql.org/docs/17/sql-grant.html)
uses no grant options. The application, capture and worker accounts must remain
restricted NOLOGIN for this installation stage. No memberships, sequences,
functions, future-object privileges or audit payloads are added.

Location verification checks exact columns/types/nullability/default, validated
owner primary/foreign keys and cascade, a named validated shape CHECK, the sole
server policy, expected effective rights and absence of browser/service-role
table/column rights. It also returns the actual deparsed CHECK definition for DB
semantic review. `shapeSemanticReviewRequired:true` remains explicit: recognizing
a validated constraint name does not prove its expression matches the intended
device/address invariants. Pinned creation SQL and later live constraint probes
are separate evidence.

| Artifact | SHA-256 |
| --- | --- |
| Current unapplied location migration | `fcd68625be336928dc992354d2b0ef8e96bce416022c7eb34e673fcc98302838` |
| Preserved source runtime 0003 | `964cde32cb2dd43e308d7cfdf96b73f715d3112dd95dbc1b5ca4be3682c6d025` |
| Preserved committed destination runtime 0003 | `28a8403d4145751e684c2b5f4965964c47587a3b09751fd20031058413ed7b53` |

The old location hash in earlier preparation evidence is superseded for future
execution, not evidence of an applied-file rewrite. Existing audit pins and files
were not changed by this package. The original sixteen-table runner continues to
report 16 expected/17 declared repository tables; that warning is intentional.
Only the new explicit profile accepts the complete seventeen-table declaration.

## Offline verification performed

| Command | Result |
| --- | --- |
| `node migrations/execute-search-location.mjs offline` | Pinned SQL, existing audit pins and seventeen-table repository contract pass; no private I/O or SQL execution |
| `node scripts/test-search-location-package.mjs offline` | 155 checks pass; synthetic catalog/driver adapters, no PostgreSQL emulation claim |
| `node scripts/test-audit-runtime-install.mjs offline` | 242 checks pass against the unchanged foundation |
| `node --import tsx scripts/test-audit-db.mjs offline` | 243 checks pass; historical sixteen-table drift remains reported |
| `node --import tsx scripts/test-search-location.mjs` | Actual store owner predicates/provenance, cookie validation, owner-only API, account isolation, atomic adoption and sanitized failures pass with mocked database |
| Node syntax checks for new executor/profile | Pass |

The mocked HTTP regression initially failed with sandbox loopback `EACCES`.
The same inspected test passed with a narrow escalation; automatic approval review
did not reject it. Its HTTP server and synthetic in-memory store are test fixtures,
not a connected application/database. No Google request or real account was used.
No application behavior changed, so this pass did not repeat the earlier browser
matrix/build. Fresh test language scope remains en/lv/ru; ar/RTL, zh, fr, de, hi,
ja, pt and es remain deferred. No new language/browser coverage is claimed here.

Offline checks do not compile SQL on PostgreSQL or prove effective live grants,
RLS, constraint semantics, locks, performance, actual login behavior or concurrency.
Those required checks remain incomplete until their separately approved execution.

## Exact proposed execution and acceptance sequence

1. The audit owners reconcile and verify their committed destination and install/
   verify the unchanged sixteen-table source runtime under their own recorded
   execution scope. Do not transfer their executor-specific approval to this
   thread, retry the destination, or bypass a stop/no-reapply hold. Obtain their
   integration acceptance for this separate extension before location execution.
2. Confirm source development/testing project `hbkooiknruimukkhshrk`, current
   schema/state and runtime intent. Record backup/recovery availability and an
   acceptable lock window. Table creation references existing users; its foreign
   key requires lock planning. This package uses five-second lock and sixty-second
   statement/idle-transaction bounds, with a 180-second client migration timeout.
3. Obtain the missing named-executor approval for source-only location DDL/grants/
   policy and metadata verification, including private read of the existing `.env`
   connection/CA for that target. The fixed helper requires postgres setup identity,
   verified TLS and disabled runtime roles. No credential relocation is prepared
   here; if the setup connection has moved, route that dependency to the audit owner
   rather than copying/printing credentials or replacing runtime URLs.
4. After that approval only, the proposed command is:

   ```powershell
   node migrations/execute-search-location.mjs apply-location
   ```

   **Not executed.** It opens source only, verifies exact foundation metadata,
   runs the pinned location transaction, and returns bounded catalog evidence and
   the shape definition. This supersedes the earlier standalone psql command as
   the coordinated execution path. No `db:push`, role enablement, existing-user
   update, audit-ledger mutation, seed or application startup is included.
5. Review the deparsed CHECK against the pinned provenance/range/text constraints.
   Approve exact disposable synthetic accounts/records, operations and cleanup
   before constraint rejection, persistence, adoption races, cascade or API tests.
   Test actual runtime access after separately approved credential provisioning.
   Catalogue privileges for a NOLOGIN role do not prove actual login/API behavior.
6. Complete TASK-025, qualified privacy review and the live acceptance in the
   [release checklist](search-location-release-checklist.md). Preserve the deployment
   hold. Permission/consent auditing is not implemented by these grants.

No source mutation approval is requested or inferred from preparing this package.
Audit-owner integration, execution/acceptance evidence and release gates stay open.

## Failure and recovery

Preflight/collision failure leaves the location migration unattempted. A known
pre-COMMIT statement error with successful rollback is recorded rolled-back.
Transport errors, cancellation and missing COMMIT remain uncertain even if a
rollback call succeeds. A confirmed COMMIT remains committed if its receipt or
later verification fails. There is one attempt and no automatic retry, DROP,
grant repair, destination action or activation.

Preserve disabled objects and sanitized evidence on uncertainty or post-commit
failure; obtain bounded read-only reconciliation before deciding the next step.
Keep the unused table while diagnosing. Dropping it deletes saved preferences
and needs separate approval. Revert only attributable local package changes if
needed; preserve unrelated working-tree edits, audit history and applied SQL.
