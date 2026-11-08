# TASK-048 service pictures — backend handoff

8 November 2026. Status: local backend implementation and focused offline
verification completed; connected migration/activation and deployment not executed.

## Acceptance, executor and limits

Requester/coordinator `/root` assigned Back End Developer
`/root/service_photos_backend` under the user's Pro service-pictures request and
[standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Owner accepted via live agent tools before implementation. Owner specifically
delegated `/root` local gallery/API/storage/image-access review, fixes and offline
tests on resume, retaining owner review. Scope is server behavior, backend test
fixtures and this record. No connected database/Storage/provider operation,
private configuration, ACL change, deployment, publishing or spending is included.
Unrelated dirty audit, reporting, native-proof and other work is preserved.

## Implemented contract

`imageUrls` is the full ordered gallery with at most 10 different paths. The first
path is mirrored to legacy `imageUrl`; an empty list clears both. A legacy
`imageUrl`-only write replaces the gallery with that cover, and an unrelated PATCH
does not touch it. API create/PATCH validate each linked image's ownership/company
reuse, supported content and size before persistence; validation is sequential and
bounded to 10 files. Existing JPEG, PNG, WebP and GIF support and the existing
10 MiB (10,485,760 bytes) per-image cap remain enforced at upload signing and actual
Storage download/confirmation. The UI calls this 10 MB, consistent with existing
copy. No new Storage bucket or configuration was created.

Existing storage create/update/copy transactions enforce effective workspace Pro
using the selected company's subscription, or the personal provider's subscription
for personal services. Missing/expired Pro grants no extra pictures. Existing
subscription rows use `FOR SHARE` until service-transaction completion, compatible
with existing subscription-writer update locks. DB owner reviewed the inherited
application DML grants and confirmed this requires no ACL expansion; no live grant
or concurrency claim is made from that source review.

Downgrade never deletes existing photos: owners may retain, reorder or remove
previous URLs while above the free one-picture limit. Adding/replacing a URL above
that limit returns 403. A Free service copy keeps only the cover; the original
gallery is unchanged. Pro copies retain all pictures. Company/personal source
scoping and inactive-company write denial remain in the existing authorization.

Image read and same-company reuse lookups now match either `imageUrl` or any
`imageUrls` entry using bound SQL parameters. Existing public-active, private-owner,
workspace and assigned-employee access decisions are retained for every image.

Startup runs the DB owner's inert, read-only gallery metadata guard after workspace
pricing readiness, before routes. Missing schema refuses startup with safe
`SERVICE_PHOTO_DB_NOT_READY` diagnostics and allowlisted checks. This makes the
unapplied migration an explicit activation dependency rather than allowing requests
to fail on an unknown column. Follow the DB handoff for cutover and recovery.

## Files and owner review

- `server/serviceImages.ts`: pure normalization and downgrade entitlement rules.
- `server/routes.ts`: gallery content/ownership validation and controlled errors.
- `server/storage.ts`: transactional entitlement enforcement and copy policy.
- `server/imageStorage.ts`: gallery-aware image links/read/reuse authorization.
- `server/index.ts`, `server/startup-diagnostics.ts`: readiness stage/diagnostics.
- `scripts/test-service-photos-backend.mjs`: strict VM offline regression suite.
- Existing booking-capacity, booking-notes and search-storage fixtures accept only
  the two newly imported pure modules. Booking-notes also received explicit inert
  adapters for preexisting audit/report registrations that had made it stale;
  unexpected-import guards and all assertions remain active.
- `scripts/test-startup-diagnostics.mjs`: gallery diagnostics redaction regression.

Owner reviewed the attributable final diff, SQL parameterization, compatibility,
company boundary, count/size limits and startup ordering. No unresolved
gallery-specific backend security issue was found in this scoped review. This
does not audit the whole application or prove live RLS, real Storage, DB lock races,
decoded-image resource bounds or production behavior.

## Verification

Node v24.22.2. All commands below use injected in-memory persistence/provider
boundaries, no environment file or live client initialization and no database or
network operation:

- `node --import tsx scripts/test-service-photos-backend.mjs` — passed. Covers
  legacy/gallery/empty/unrelated normalization, array max/uniqueness/types, personal
  and company Pro/expiry/missing entitlement, row-lock requests and denied writes,
  downgrade edits, scoped copy, gallery read/reuse authorization, actual size and
  content/extension checks, and real service create/PATCH/copy handlers with actual
  workspace checks. Handler checks are direct calls, not live HTTP/auth/session
  integration; persistence/media boundaries are fake.
- `node --import tsx scripts/test-booking-capacity.mjs` — passed.
- `node --import tsx scripts/test-booking-notes-backend.mjs` — passed, 21 initial
  message scenarios plus 25 currency scenarios.
- `node --import tsx scripts/test-search-storage.mjs` — passed.
- `node --import tsx scripts/test-startup-diagnostics.mjs` — passed, 87 checks.
- `git diff --check --` attributable backend files — passed (line-ending warnings
  only).

Full `npm run check` remains unavailable as a passing gate: latest run reports
five errors in independently changing `client/src/native/client.ts` and
`server/native-proof/service.ts` (default-target iterator errors and one unknown
value assigned to string). No gallery/backend errors remain. Coordinator reports
targeted application type checking excluding only those unrelated native-proof
directories and isolated server bundle passed; their commands/evidence belong in
the coordinator handoff. Do not claim the full repository type gate passes.

These backend checks contain no language matrix. Any integrated UI checks are
restricted to en/lv/ru. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred; their
supported translations and historical evidence are preserved.

## Recovery and next action

Before activation, DB owner must execute the reviewed migration only within
target-specific authorization; no execution is implied here. Quiesce old service
writers for the migration/new-app cutover because old cover writes cannot maintain
the new cover/gallery constraint once arrays are populated. Coordinator integrates
Frontend/DB results and records the exact remaining migration decision.

Local recovery removes only these attributable gallery hunks/new helper/test and
restores prior fixtures, preserving unrelated dirty changes. After multi-picture
data exists, do not run old cover-only writers or drop the array as a blind rollback;
follow DB's reviewed recovery and preserve every picture path. No media deletion
was added or executed by this task.

## Authorized writer quiescence — 8 November 2026

The user subsequently granted activation permission explicitly: **"Permission
granted. Go without DB backup"**, following the concrete migration handoff and
its stopped-writer prerequisite. Coordinator assigned this Backend owner the
necessary reversible local project process stops; DB execution remains solely
with `/root/service_photos_database`. This does not authorize restarting the app
or worker, audit delivery, private configuration reads or additional DB access.

Backend accepted through live tools and inspected the two project process trees.
Initial sandbox CIM access was unavailable; scoped elevation succeeded for process
metadata inspection and exact stops. Project identity was proved from absolute
dependency paths, parent chains and current-directory metadata. A narrow native
metadata reader inspected only process current-directory structures, never process
environment/configuration. All five checked launcher/worker directories were
`C:\Source\Private\WellnessConnect\`:

- Dev: npm `7648` → cmd `20564` → cross-env `52468` → cmd `52336` → tsx watch
  `46504`, running `server/index.ts`.
- Audit: npm `36384` → cmd `54472` → node `39188`, running
  `server/audit/run-worker.ts`. Its relative entry path was not treated as project
  proof until the working directory was verified.

The stop command rechecked launcher command identities, all parent links and
creation time/command line before each PID stop, captured descendants, and stopped
parents/watchers first to prevent respawn. Explicit stops: `7648`, `36384`, `52468`,
`39188`, `46504`; intermediate cmd processes exited as their parents/children
stopped. No listeners belonged to this tree before stop. No broad Node kill was
used. VS Code terminal shells `35588` and `42632` remained present.

Final elevated read-only inventory at **2026-11-08 15:21:50 UTC (17:21 Riga)**
showed no captured PID/descendant and no Node `server/index.ts` or
`server/audit/run-worker.ts` entry process, with both terminal shells still present.
No process was restarted. Backend sent this exact evidence and a go-ahead directly
to the DB executor, conditional on the runner's own live writer-session guard;
no DB guard was bypassed and Backend opened no DB connection.

These are process-stop facts, not a migration success claim. DB execution receipts
and remaining application restart/activation work belong in the DB/coordinator
handoff. Recovery is a separately authorized later restart after successful
migration/readiness; this owner has not performed it.
