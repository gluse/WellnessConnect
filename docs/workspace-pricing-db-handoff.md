# TASK-044 workspace pricing — database handoff

Status, 6 November 2026: migration 0021 applied once and committed to the approved
development project under the fresh TASK-044 no-verified-backup selection. All
34 restricted read-only readiness gates pass. Existing prices, currencies and
address values were preserved; 14 personal and 4 company workspace defaults were
initialized as EUR. No application/workflow startup or deployment occurred.
TASK-039 migration/backup exceptions and its immutable receipts remain separate.

Requester/coordinator: `/root`. Assigned DB owner/executor: `/root/currency_db`.
User accepted the recommended saved personal/company workspace defaults and
confirmed business-country flow. The owner accepted the reversible local schema,
migration, offline-check and execution-preparation dependency under
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Backend owns application queries/API; Frontend owns forms, resolver and translations.
This local assignment does not authorize connected execution or waive recovery.

## Contract and implementation

- Private `workspace_pricing_settings`: UUID primary key supplied by the app,
  nullable user/company foreign keys with exactly-one-owner CHECK, unique index
  per personal/company identity and cascading owner cleanup. Nullable
  `defaultCurrency` and `businessCountryCode`; revision integer defaults to 1 and
  must be positive; required created/updated timestamps. New, unset preferences
  remain null/missing, represented by API revision 0 until first save.
- Backfill existing users' personal workspaces and existing companies with EUR
  defaults and revision 1. Business country stays null until confirmed. Creating
  seed UUIDs uses PostgreSQL's existing core generator, without a new extension,
  function or permanent UUID/currency default.
- Optional `addresses.pricingCurrency` is an explicit location override, validated
  against supported currencies. It is excluded from public `AddressLocation`/
  `Service` response types. Backend saves omitted values without overwriting
  existing overrides and supports explicit null clearing.
- Workspace settings are separate from public users/companies and protected by
  existing server authorization. DB RLS is enabled; direct public/anon/
  authenticated/service-role and nonapp runtime grants are revoked. Only the
  server runtime role receives SELECT/INSERT/UPDATE, with no DELETE privilege.
  Its policy uses the existing server-authorized workspace model, not a claim
  that database row policies independently enforce per-customer tenancy.
- No service/booking amount, currency, history or subscription policy changes.
  Default priority and draft provenance are application responsibilities: saved/
  manual choice, explicit location override, saved workspace currency, service
  country suggestion, confirmed workspace country suggestion, then manual choice.

Schema: [shared/schema.ts](../shared/schema.ts). Prepared
[0021 SQL](../migrations/workspace-pricing/0021_workspace_pricing.sql) and
[schema metadata](../migrations/workspace-pricing/schema-contract.json) derive
from the owned ORM expansion through
[prepare.mjs](../migrations/workspace-pricing/prepare.mjs).
The prior 0020 SQL/receipts/contracts are unchanged.

## Migration and compatibility

0021 is one bounded transaction with a 5-second lock timeout and 60-second
per-statement timeout. Guards require the known PG17/postgres development shape,
40 tables, applied required currency fields, the private runtime role and absence
of the new table/override column. It creates one table, its constraints/indexes/
foreign keys, the nullable address override and explicit runtime access policy.
Existing users/companies are held with SHARE locks during seed construction;
addresses use an exclusive schema-change lock. No monetary UPDATE is issued.

The new integrated runtime profile expects 41 tables. It extends the unchanged
historical 26 runtime gates with six workspace-pricing column/constraint/index/
ACL/policy/schema gates. The existing two currency gates remain separate:
34 checks total. It verifies the complete new table shape plus the address
override field/constraint, exact SELECT/INSERT/UPDATE rights and server policy.
Historical 40-table profiles remain available as the execution baseline.

Backend integrates
[the injected readiness guard](../migrations/workspace-pricing/application-readiness.mjs)
at startup and switches its billing readiness aliases to the integrated 41-table
profile. Importing the guard opens no socket or settings file. Old app startup
profiles that insist on exactly 40 tables cannot be used after this migration;
coordinate compatible application cutover. No startup/deployment is performed here.

## Cross-owner review

DB delegated/reviewed Backend's local workspace query/upsert implementation.
Personal-user/company locks and membership SHARE locks guard authenticated writes;
owned predicates enforce the user/company XOR. Required expected workspace and
revision comparisons prevent cross-workspace stale saves and lost updates.
Missing-row creation generates a UUID and uses conflict-controlled insertion;
existing-row updates include both ID and expected revision. INTMAX revision is
handled as a controlled conflict. Address override data remains absent from
public service DTOs. Backend reports 43 passing offline cases including role/
revocation/CAS/ownership, omitted/present/null address override and nonrepricing
behavior. This review did not exercise connected queries or claim live tenancy.

## Offline verification

Passed using schema descriptors, generated SQL and mocked query adapters only:

```
node --import tsx migrations/workspace-pricing/prepare.mjs
node --import tsx migrations/workspace-pricing/check.mjs
node --import tsx migrations/workspace-pricing/test-readiness.mjs
node --import tsx migrations/workspace-pricing/test-execution.mjs
node --import tsx migrations/currencies/check.mjs
```

Checks cover owner XOR/uniqueness/cascade/CAS metadata, nullable validated
overrides/preferences, private runtime rights, EUR-only existing-workspace seeds,
no service/booking writes, unchanged historical profiles, generated migration
drift and injected readiness/error shapes. Execution tests use mocks to verify
recovery admission, one submission, baseline/postflight, value preservation,
active-writer stop, unknown commit handling and no automatic retry. They do not
execute PostgreSQL, establish live ACL/constraint behavior or verify backups.
Application type/build/browser checks belong to Frontend/Backend. Test languages
are en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.

## Historical execution/recovery proposal — before authorization

Known proposed development target: `hbkooiknruimukkhshrk`; named executor:
`/root/currency_db`. This is preparation only. Obtain one concrete exact-target
execution/recovery decision before any protected settings read or live query.
The earlier TASK-039 no-backup selection is not transferable to TASK-044.

[execute-approved.mjs](../migrations/workspace-pricing/execute-approved.mjs) reuses
existing protected source-only verified-TLS helpers and pins 0021 SHA-256
`91971cfbf5c2a462acde1df3329a783a445c80974564df45d832a597b88ecfd7`, plus
the immutable prior currency activation receipt. An exclusive new execution
receipt prevents duplicate runs. Fresh restricted read-only checks verify all
28 baseline gates; owner guards inspect exact target/schema/absence, aggregate
counts and active app/owner connections. One migration submission then requires
explicit COMMIT and expected seed counts. Bounded owner/restricted postflight
checks unchanged existing money/currencies/address fingerprints (kept only in
memory), unchanged source counts, complete EUR workspace seeds, unset business
countries/overrides and all 34 new readiness gates. It stops on first failure,
timeout, target mismatch, uncertain commit or verification failure without retry.

Two recovery routes are prepared:

- Verified recovery: independently establish a current source recovery point and
  usable restore method. DB owner reviews the real evidence and pins its digest
  before enabling the fixed reviewed-proof route. An arbitrary JSON assertion or
  archive setting cannot unlock it. No evidence is currently pinned or claimed.
- Exact-task development exception: user can explicitly authorize one 0021
  application **without a verified backup**, accepting post-commit recovery risk,
  for TASK-044 only. The prepared identifier is `TASK-044-2026-11-06`.

Only after the user selects the latter route for this exact target, execute once
with network-enabled `exec_command` `sandbox_permissions=require_escalated`:

```
node --import tsx migrations/workspace-pricing/execute-approved.mjs --apply-approved-source=hbkooiknruimukkhshrk --backup-waived=TASK-044-2026-11-06
```

At preparation time that command had not run; its later authorized result is
recorded below. It does not authorize backup exports/installations,
other targets, service startup, workflow/session fixtures or deployment. Fresh
writer counts are point-in-time observations; migration locks protect its own
transaction, and preservation checks detect concurrent external changes rather
than prove a permanent writer stop. Keep relevant writers stopped through cutover.

Before COMMIT, PostgreSQL transaction rollback is the recovery path. After COMMIT,
retain the settings and address fields while diagnosing; do not revert to a
40-table-only startup profile or silently discard defaults. A destructive down
migration is not supplied. Any restore or broader policy change needs its own
reviewed scope. No backup, restore capability or continuing quiescence is claimed.

Next: root integrates application evidence, reviews this concrete execution
package, then obtains only the missing exact-target action/recovery selection.

## Exact TASK-044 connected authorization accepted

On 6 November 2026 the user answered “approve” to root's concrete request for
the assigned DB owner to apply migration 0021 once to development project
`hbkooiknruimukkhshrk` **without a verified backup**, retaining
stop-on-first-failure. Root routed that fresh task/target decision to the existing
DB executor `/root/currency_db`, who accepted. Identifier:
`TASK-044-2026-11-06`. This permits protected configuration/verified-TLS source
inspection, one prepared migration submission and bounded read-only postflight.
It does not represent a verified backup or authorize retries, alternate targets/
hosts, timeout increases, backup/export/tool installation, application/worker
startup, live booking/session fixtures or deployment. The reviewed runner and
0021/prior-receipt pins are reused; TASK-039 receipts remain unchanged.

## Applied once and verified — 6 November 2026

The assigned DB executor ran the exact prepared TASK-044 command once with
`sandbox_permissions=require_escalated`. Automatic network review allowed
execution. Protected exact-source/principal/trusted-CA checks and all 28 baseline
runtime/currency gates passed. Fresh owner read-only inspection verified the
expected PG17 database and 40-table starting schema, absence of new settings/
override fields, and zero observed other application/owner connections.

[The exclusive execution receipt](../migrations/workspace-pricing/source-execution-receipt.json)
records `state=verified`, `script.attempted=true` and `script.committed=true`.
The runner received an explicit COMMIT result from its one migration submission.
The post-migration profile has 41 tables and all 34 restricted-role read-only
checks passed, including new private column/constraint/index/ACL/policy checks
and both established currency checks.

Aggregate results:

- Personal defaults initialized: 14; company defaults initialized: 4.
- Every seeded setting has EUR default currency, revision 1 and null/unconfirmed
  business country. Every address pricing override remains null/unset.
- Counts unchanged from this run's fresh baseline: 14 users, 4 companies,
  12 addresses, 28 services and 32 bookings. A service added after TASK-039 is
  included in this fresh baseline; earlier task counts were not reused.
- Exact before/after fingerprints of existing service prices/currencies,
  booking totals/advances/currencies and existing address fields all matched.
  Only the boolean preservation result was persisted, not raw data or hashes.
- Private settings runtime permissions are exactly SELECT/INSERT/UPDATE with
  the reviewed server-role policy; direct public/nonapp access remains denied.

Backup remains explicitly unverified and waived only under
`TASK-044-2026-11-06`. No recovery point, export or restore capability is claimed.
There was no failure, retry, alternate target/host, relaxed timeout, backup/export/
tool installation, unrelated ACL/configuration mutation, app/worker startup,
live booking/session fixture or deployment. Both read-only connections closed
normally. Migration locks protected its transaction; observed zero writers is
not a continuing lock on later application activity.

The DB execution dependency is complete. Root can independently review the
sanitized receipt and mark the accepted task scope complete. Subsequent connected
application startup/workflow acceptance is outside this execution; use the
compatible 41-table application and preserve settings/snapshots/precision during
any future recovery. TASK-039 receipt and SQL hashes remain unchanged.
