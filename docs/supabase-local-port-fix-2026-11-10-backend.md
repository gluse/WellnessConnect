# TASK-064 local port correction — backend, 10 November 2026

Status: **backend correction complete: protected six-value URL migration, focused
offline checks and released new-port application/Auth acceptance passed.** Root
owns the final integrated npm lifecycle check and user delivery.

The user reported `npm run db:local:start` failing. Root reproduced a Windows
excluded-port conflict covering 54310–54409, which includes the original local
Supabase host ports. Root selected and exclusive-bind checked the replacement
154xx host ports. Backend owner `/root/local_copy_backend` accepted the necessary
local runtime/configuration changes, and DB owner `/root/local_copy_database`
accepted and delegated the connection configuration rewrite under the standing
cooperation rule. Existing hosted target/TLS gates, credentials, roles and data
remain unchanged. No Windows reservation, networking or security setting is
changed. No source, AWS or paid-provider operation is included.

## Current local endpoint contract

| Endpoint | Host address |
| --- | --- |
| Supabase API/Auth/Storage | `127.0.0.1:15421` |
| Application/capture/source-worker PostgreSQL | `127.0.0.1:15422` |
| Independent audit PostgreSQL writer/reader | `127.0.0.1:15432` |
| Application | `127.0.0.1:5000` |

Root owns Mailpit 15424, CLI shadow 15420, the published Docker ports, Supabase
CLI configuration and fresh protected CLI status capture. Internal container
service ports stay unchanged. The local profile remains explicit, development
only, literal-loopback only, with exact role/port checks and no mixed hosted URLs.
The hosted default is unchanged.

Backend changed `server/audit/config.ts`, the profile assembler, focused local
tests and the local integration probe to use the new host endpoint contract.
The assembler now consumes the same exported local port constants as the runtime.
Legacy 543xx host URLs are rejected by the current local runtime.

## Protected runtime migration

The reviewed command ran once successfully:

```powershell
node --import tsx scripts/start-local-development.mjs --migrate-ports
node --import tsx scripts/start-local-development.mjs --check
node --import tsx scripts/start-local-development.mjs --worker --check
```

It verified ignore status, owner-only protected ACL, non-symlink identity and
bounded size before reading `.env.local-docker.local`. It prepared and checked
exactly six changes: the five local database URL ports and `SUPABASE_URL`.
Passwords, usernames, database names, URL query options, API keys, session secret,
membership selections, activation flags and all other fields were preserved.

Before replacement, the helper created and verified the protected rollback copy
`.env.local-docker.local.before-154xx-20261110`, applying its owner-only ACL before
writing any contents. A protected temporary file held the validated new profile;
the original bytes were checked unchanged immediately before atomic replacement.
The migrated profile and both app/worker configuration checks passed. The helper
printed only a fixed aggregate result. Original hosted `.env` was untouched.

The migration refuses unexpected/mixed targets and an already-migrated profile;
it does not reset passwords or silently expand accepted endpoint ranges. Recovery
uses the protected rollback copy through a reviewed owner-only replacement after
stopping local consumers; restoring old ports also requires matching Root's
infrastructure configuration, and does not cure the Windows exclusion.

## Verification

Passed:

```powershell
node --import tsx scripts/test-local-supabase-backend.mjs
npm run check
```

The focused suite verifies the new exact port contract, rejection of the reserved
legacy ports, the six-field migration, unchanged credentials and unrelated
settings, preserved comments/CRLF, and rejection of missing/mixed/remote input.
Existing local isolation, actual-peer, hosted TLS, provider dormancy and command
guard checks also pass. These are offline synthetic tests; no database/API
connection was opened by them or by the protected profile migration.

No locale matrix is needed for this connection/configuration change. Any related
language checks stay limited to en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es
remain deferred. Historical copy, login/session, cleanup and persistence evidence
from [the original backend handoff](supabase-local-copy-backend-2026-11-09.md)
is preserved and is not relabelled as a fresh check of these new ports.

## Connected new-port acceptance

After Root recreated the local ingress/managed containers while preserving volumes,
the DB owner verified the exact before/after data fingerprint, all 38 application
gates, five restricted roles, sequences, RLS, Auth identities and image references.
All DB probes closed before the owner released Backend's bounded smoke.

```powershell
node --import tsx scripts/test-local-supabase-live.mjs --verify-persistence=TASK-064-LOCAL-SMOKE-2026-11-09
```

It passed using API 15421 and application PostgreSQL 15422. The actual task app
listener was exactly `127.0.0.1:5000`, application health/readiness and guest search
passed, and local Auth health returned 200. Root and DB owner accepted one bounded
negative password-grant request using a new random unknown `.invalid` address;
it returned `invalid_credentials` with no access token, refresh token or user.
No account/session was created, no known user's password was read or used, and
no signup/invitation email was sent. Incidental local provider failure logging
was within the DB owner's explicit scope.

No audit worker ran. The test's nonlocal TCP guard stayed active. Its own app was
stopped and the test process exited 0; no user's app process was stopped. The
original positive password/session evidence and the DB owner's preserved password
hash/identity verification remain separate evidence. No historical receipt was
overwritten.

Protected receipt:
`outputs/supabase-local-private/local-backend-smoke-persistence-1794320334435.json`.
Public safe aggregate:
`output/supabase-local-copy-2026-11-09/backend-port-fix-result.json`.

All Backend consumers are closed and no backend blocker remains. Root is
performing the final real `npm run db:local:stop`/`npm run db:local:start` lifecycle
check from fully stopped auxiliary containers, then owns final integrated delivery.
