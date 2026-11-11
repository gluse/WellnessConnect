# Independent local Supabase copy — 9 November 2026

Status: **completed and verified10November2026**. Independent local databases,
Auth and Storage are ready. The8local infrastructure containers remain running;
test application/worker processes are stopped. Hosted Supabase/AWS configuration
was not changed.

Startup port repair,10November: Windows later excluded the original543xx host
ports. The local endpoints now use15421(API),15422(application DB),15424(test
mailbox),15432(audit DB); the app remains on5000. Data/keys were preserved and
startup, database fingerprints, image bytes and local app checks passed. See
the [current startup instructions and repair evidence](supabase-local-ports-2026-11-10.md).

User requested an independent database for local app development and the
published AWS app, then selected **Copy on my PC using Docker (recommended)**
and resumed. Root accepts local infrastructure coordination. Under AGENTS.md
standing cooperation, DB owner `/root/local_copy_database` and Backend owner
`/root/local_copy_backend` accepted their necessary scoped dependencies.

## Selected operation and targets

- Retain hosted application `hbkooiknruimukkhshrk` and hosted audit
  `ynygqodmtgjrngiudalw` for existing AWS staging, without cloud changes.
- Read those sources only for bounded metadata, logical exports and Storage
  downloads. This is a new copy operation, not reuse of consumed migration or
  deployment preflight grants. Do not modify source roles, data, jobs or settings.
- Create isolated local Docker Supabase PostgreSQL/Auth/Storage and a separate
  local audit PostgreSQL destination. Current loopback ports: API15421,
  application PostgreSQL15422, audit PostgreSQL15432. Preserve least privilege.
- Necessary protected private configuration reads and new local configuration
  are scoped to the copy. Keep secrets, tokens, password hashes, rows and raw
  provider/tool errors out of source, chat, logs and images. Preserve the original
  protected `.env`; create separate protected `.env.local-docker.local` and make
  ordinary development commands select it. Leave AWS handoffs intact.
- Restore business data and identity references. Do not reuse hosted sessions,
  provider secrets or replay copied queues to external services. Preserve audit
  evidence and route all local audit activity to the separate local destination.

## Implementation and checks

Docker29.9.2 engine is available; initial inventory shows no running containers.
Initial C drive free space:12.14GB. Installed workspace-local official
Supabase CLI3.0.0 and native PostgreSQL17.11 client binaries, verified against
vendor SHA256 checksums. No global PATH change or unrelated cleanup occurred.

Minimal local Supabase PostgreSQL/Auth/Storage/REST/gateway/Mailpit services run
on internal network `fitsmytime-local`; separate audit PostgreSQL uses its own
persistent volume. Optional Studio, Realtime, edge functions and analytics are
disabled. Docker29 silently omits published ports on internal-only networks;
the initial startup attempts stopped before restore. A fixed HAProxy relay
joins that network and a separate ingress network and publishes only
127.0.0.1 ports15421/15422/15424/15432 after the startup repair. Database/Auth/Storage containers have no
internet route. The relay is unprivileged, read-only, drops all capabilities
and forwards only its four fixed internal destinations. Test email is captured
locally by Mailpit. Detailed local initialization diagnostics are protected.

Source metadata and logical exports used verified TLS and read-only snapshots.
Docker source export initially failed because the hosted direct endpoints are
IPv6-only and the Docker bridge has no IPv6 route. Native verified client tools
resolved that transport limitation; no source configuration or network security
was changed. Application and durable Auth used the same exported snapshot;
audit export followed from its own consistent snapshot while AWS remained live.

Copied and verified before local smoke mutations:

- All41 public application tables plus source audit/durable Auth:54 tables,
  3,135 rows; independent audit destination:8 tables,2,534 rows.
- Auth16 users/18 identities and password hashes preserved; usable sessions,
  refresh tokens and one-time token history excluded. Copied confirmation,
  recovery and reauthentication tokens cleared locally before Auth restarted.
- Source ownership, constraints, sequences, RLS/grants and memberships restored
  with new independent local runtime passwords. Each database restore was atomic
  and all snapshot row counts matched.
- Windows SQL decoding changed routine-body line endings, detected by the
  existing startup parser-hash check. Linux decoding of the original archives
  followed by local Node-based routine replacement restored all32 source and17
  destination functions byte for byte. Archive body hashes matched; owners,
  configuration, security properties and ACLs were unchanged. No hosted
  function or startup security check was changed for this correction.
- One private image bucket,32 objects/13,145,565bytes. All32 re-downloaded from
  the local service and matched SHA256/size/type; bucket configuration and object
  manifests matched. Anonymous/public access to the private bucket was denied.

Owner evidence: [database](supabase-local-copy-database-2026-11-09.md),
[backend](supabase-local-copy-backend-2026-11-09.md),
[Storage](supabase-local-copy-storage-2026-11-09.md). Sanitized receipts are in
`output/supabase-local-copy-2026-11-09/`; private archives/manifests/bootstrap
credentials are under owner-only `outputs/supabase-local-private/`.

The legacy `db:transfer` six-table runner is unsuitable for the current schema.
DB owner owns the complete object/dependency manifest, source snapshot export,
local restore and metadata/count/security validation. Backend owns explicit
local-profile support because audit runtime currently pins hosted projects.
Root owns CLI/Docker lifecycle, loopback exposure, local secret handling,
Storage byte-copy orchestration and integrated configuration handoff.

Acceptance: independent persistent local databases and uploaded images; matched
business/identity data; scoped local runtime credentials; preserved audit flow;
no mixed local/hosted routes; local startup and bounded local-only smoke checks;
simple start/stop instructions and secure original-configuration recovery.
Social OAuth provider configuration is separate from copied Auth identities;
report actual local sign-in capabilities without claiming untested coverage.

No locale matrix required for DB-only work. Application language tests, if run,
cover en/lv/ru only; ar/RTL,zh,fr,de,hi,ja,pt,es are deferred. Preserve historical
evidence and existing dirty worktree changes.

## Final acceptance — 10 November

- All38current application metadata gates and five restricted runtime roles
  passed, with exact caps5/2/2/2/2, correct parser chains and no competing clients.
  All41public tables have RLS. Original16Authusers/18identities remain, with no
  unmatched application profiles or copied sessions/refresh/one-time tokens.
  Serial sequences are safely ahead of existing identifiers.
- Live local startup/readiness/search, synthetic email/password login, cookie
  session roundtrip/logout and local audit delivery passed. Three test events
  and one cleanup event delivered without new failures/retries/quarantine/gaps.
  The synthetic account/profile was removed; original users remain intact.
  The copied236inherited quarantines are preserved evidence, not new local
  failures or permission to replay/repair them.
- Root stopped and started only this local stack, retaining volumes. The DB
  owner compared58source+8audit tables' row hashes/counts,49functions,10sequences,
  22roles, constraints and Storage metadata. Prestop and postrestart fingerprints
  matched exactly;38gates/five roles/sequence safety passed again.
- After restart, all32images/13,145,565bytes matched their original hashes,
  sizes/types and bucket settings; anonymous access remained denied. All20
  application image references resolve locally, with no missing files or hosted
  Supabase Storage URLs.
- Postrestart local app readiness/search passed and its actual listener was
  exactly127.0.0.1:5000. No new fixture or worker was started for that final test;
  the task's own app process was stopped afterward. External API credentials
  were excluded and the smoke denied nonlocal TCP connections.

Final sanitized evidence: `lifecycle-20261110.json`,
`persistence-prestop-20261110.json`, `persistence-compare.json`,
`database-verification-postrestart-20261110.json`,
`storage-persistence-result.json`, plus the linked owner handoffs/receipts.
All are under `output/supabase-local-copy-2026-11-09/` except private smoke
receipts, which stay in owner-only private storage. Earlier tooling/deadline
failure evidence is preserved; successful corrected checks are identified in
the owner handoffs. Full TypeScript and scoped security/offline regressions
passed. No fresh frontend/browser or deferred-language coverage is claimed.

## Everyday use

Open Docker Desktop, then from the repository:

```powershell
npm run db:local:start
npm run dev
```

Open http://localhost:5000. For local audit delivery, run `npm run audit:worker`
in a second terminal. `npm run db:local:status` reports container state without
printing credentials. Stop application/worker terminals with Ctrl+C, then use
`npm run db:local:stop` to stop local infrastructure while retaining volumes.
Test mailbox: http://127.0.0.1:15424.

Historical `db:push`, database setup/transfer, `storage:setup` and the old connected
integration runner now stop before loading hosted `.env` while the local profile
exists. Future migrations need an explicitly reviewed local target. Other old
connected test/maintenance scripts remain source-specific; inspect their target
before using them. These commands are not required to start the local app.

`npm run dev` and the normal audit-worker command have no hosted fallback. They
validate the owner-only local configuration, reject mixed local/hosted database
routes and strip inherited service credentials. The original protected `.env`
and AWS handoff files remain intact. Explicit `:hosted` runtime commands are
intentional historical-hosted access, not part of ordinary local development.

This is a one-time snapshot. New local and AWS edits are independent and are
never synchronized automatically. Existing email/password identities were
copied; social OAuth requires separate local provider configuration. To avoid
external side effects, paid AI/geocoding, social OAuth, payments, outbound
notifications and activity automation are dormant in this local profile.
Those providers can be configured later through their owners; the existing
AWS configuration was not changed.

## Recovery

The original protected `.env` and AWS handoffs remain intact. Preserve the
protected local profile, exports and any failed-attempt evidence. To reverse
local runtime routing, stop the local app/worker and review the explicit hosted
commands or revert only this task's scoped launcher changes; no source rollback
is required. New local data does not automatically synchronize to the hosted DBs.
Stopping containers retains local volumes. Do not delete volumes/backups without
an explicit cleanup choice. No AWS redeployment or source rollback is needed.
