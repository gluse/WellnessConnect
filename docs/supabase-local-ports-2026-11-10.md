# Local Docker startup port repair — 10 November 2026

Status: **fixed and verified**. The normal npm start command succeeds; all eight
local services are running and healthy. Original copy/verification evidence is
preserved and the application itself remains stopped.

The user reports `npm run db:local:start` fails and asks whether Docker Images
must be started manually. Root reproduced the failure from WellnessConnect:
Docker cannot bind127.0.0.1:54322 and returns Windows socket access forbidden.
Read-only `netsh` inspection confirms both IPv4 and IPv6 TCP exclusions include
54310–54409, covering all old54321/54322/54324/54332 host ports. There are no
competing listeners, application or audit-worker processes. Docker's Linux
containers report running/healthy, but the gateway has no actual published
bindings; image play buttons would create unrelated new containers.

## Accepted scope and ownership

This continues TASK-064 under the user's startup-error request and existing local
Docker selection. Root owns local infrastructure. Assigned Backend and DB owners
accepted the necessary reversible local port/config dependencies under AGENTS.md
standing cooperation. DB specifically delegates Root's local config db/shadow
port edit and protected bootstrap-status URL update. Backend owns strict local
runtime ports and protected runtime-profile URL updates. DB owns before/after
fingerprints and current local verification. No hosted access, database changes,
Windows port-reservation/security edits, source credential edits or AWS changes.

Chosen loopback host endpoints, verified with exclusive bind probes:

| Service | Old port | New port |
| --- | --- | --- |
| Supabase API | 54321 | 15421 |
| Application PostgreSQL | 54322 | 15422 |
| Test mailbox | 54324 | 15424 |
| Audit PostgreSQL | 54332 | 15432 |

The app remains at http://localhost:5000. Shadow development port becomes15420;
shadow DB operations remain disabled. HAProxy's internal Linux ports/routes stay
unchanged; only its loopback host publications change. Root recreates only the
gateway and managed Supabase containers, retaining all data volumes and the
existing independent audit database. Protected profile/status backups precede
URL edits; keys, passwords, IDs, membership and activation flags are preserved.

## Preparation and validation

Root strengthened lifecycle checks to require every actual expected published
gateway binding. Missing bindings no longer count as a healthy gateway. Start
skips already-running auxiliary containers; failures identify the operation and
Windows port/engine cause without printing raw credential-bearing output.
Stopping a gateway with broken publications remains possible. Offline isolation,
missing/wrong/public-port, privilege and diagnostic-secret checks pass in
`node deploy/local-supabase/test-manage.mjs`; syntax and scoped diff checks pass.

The full stopped-state test exposed another stale publication on the independent
audit container. Under explicit DB-owner delegation, Root verified its stopped
state, pinned image, sole named PGDATA volume, password/database, network and
restart policy, then saved a protected minimal recovery specification. Root
recreated only that container without `--publish` and without `docker rm -v`.
The exact volume identity/password/data remained intact. Audit access now uses
only the gateway; a direct stopped-state audit restart succeeds with no host
port bindings. The fresh-provision helper also omits that redundant publication.

Completed checks:

- Four replacement loopback ports passed exclusive-bind probes; Windows TCP
  exclusions/settings were never changed.
- All six runtime-profile endpoint values and five bootstrap-status URL fields
  were migrated with protected backups. Passwords, API/session keys, membership,
  flags and unrelated settings are unchanged. Hosted `.env` remains intact.
- Before-repair Docker-internal and after-repair host snapshots match exactly,
  including a final comparison after actual container restart. The original
  fingerprint remains `a9b8485e3f3f95b70ebae33c8b419c5a8f4ee6992dbf304ff0b4b57f60b96371`:
  66 selected tables, 49 functions, 10 sequences, 22 roles and constraints.
- All 38 readiness gates/five restricted roles, sequence safety, original
  16 Auth users/18 identities, RLS and image references pass on the new endpoints.
- Local app readiness/search and actual127.0.0.1:5000 listener pass; Auth health
  on15421 is200. One random unknown `.invalid` password request correctly returned
  `invalid_credentials` with no account/session/token creation. Its incidental
  local failure log was within DB-owner-approved scope; no real password used.
- All32 images/13,145,565bytes match original hashes/size/types through15421;
  private bucket configuration and both anonymous-access denials pass.
- Actual `npm run db:local:stop` and the repaired `npm run db:local:start` pass.
  Repeating start while the services are running succeeds. Actual loopback
  publications are checked; empty mappings can no longer pass as healthy.

New receipts under `output/supabase-local-copy-2026-11-09/`:
`port-repair-before-20261110.json`, `port-repair-after-20261110.json`,
`database-verification-ports-20261110.json`, `audit-no-publish-repair-20261110.json`,
`port-repair-lifecycle-20261110.json`, `backend-port-fix-result.json`,
`storage-port-repair-result.json`, `port-repair-startup-result.json`.
See the [backend owner handoff](supabase-local-port-fix-2026-11-10-backend.md) and
[DB owner handoff](supabase-local-copy-database-2026-11-09.md) for scoped evidence.
Earlier receipts are not overwritten. Focused isolation/migration/diagnostic
tests, TypeScript and scoped syntax/diff checks pass. No locale matrix was
needed; en/lv/ru scope and other-language/RTL deferrals remain unchanged.

## Run the local app

Start Docker Desktop and wait for its Linux engine. Run from WellnessConnect,
even if the IDE is displaying a different project:

```powershell
cd C:\Source\Private\WellnessConnect
npm run db:local:start
npm run dev
```

Open http://localhost:5000. No image play buttons or new manual containers are
needed: the script starts the configured services with the existing volumes.
Use Docker's Containers tab to inspect them. Test mailbox is now
http://127.0.0.1:15424. Run `npm run audit:worker` in another terminal when needed.

Background: [Microsoft documentation on excluded-port socket error10013](https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/error-10013-wsaeacces-is-returned).
This machine's actual reserved range was established by local `netsh` output.

## Recovery

Preserve all original volumes and protected configuration backups. If any local
step fails, stop for diagnosis with the data intact; do not reset or re-copy the
databases. Old Windows-reserved host ports are not a usable fallback while the
exclusion exists. Recovery can recreate only the gateway with a verified local
port set; no source rollback or cloud deployment is needed.
