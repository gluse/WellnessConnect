# TASK-048 — Pro service photo galleries

## Request, authorization and owners

8 November 2026: user requested multiple service pictures for Pro users, a
meaningful maximum picture size, and left/right swiping when viewing a service.
Root coordinates the accepted feature under AGENTS.md standing cooperation.
Assigned owners accepted through live agent tools:

- Front End Developer `/root/service_photos_frontend`: editor, gallery, locale
  content and isolated frontend checks.
- Back End Developer `/root/service_photos_backend`: API plan/count/ownership
  validation, image read authorization and offline mocked checks.
- DB Analyst/Developer `/root/service_photos_database`: local schema/migration
  preparation, compatibility/readiness and offline checks.

Initial scope was reversible local repository implementation and offline/mocked
testing. The later exact-target execution approval is recorded below; deployment,
publishing, spending and other connected operations remain outside scope. Existing
unrelated work remains preserved. Owners own separate files; shared contract
changes are coordinated.

After an agent usage-limit interruption, the user requested **resume**. Each
assigned owner explicitly delegated root permission for necessary local fixes,
review and offline tests within that owner's TASK-048 files, retaining owner
review. These delegations do not include connected operations or unrelated work.

## Accepted implementation contract

Existing size limit is 10 MiB per image in both browser and backend. Retain it and
show it in the editor. Pro effective workspace entitlement permits up to ten
images per service; other plans permit one. `imageUrls` is the full ordered
gallery; existing `imageUrl` remains the first/cover image for older consumers.
Legacy single-image services remain viewable. Gallery interactions include swipe,
buttons and keyboard support. Detailed downgrade/legacy update behavior and exact
migration order are recorded in the owners' handoffs.

Expiry preserves existing galleries: downgraded owners can keep, reorder or remove
their existing pictures, but adding new pictures above one requires active Pro.
A non-Pro copy retains the cover only. Removing an image from a service does not
delete its underlying uploaded storage object.

## Status and acceptance

Local implementation, owner reviews and focused verification are complete.
Development database migration and verification are also complete under the later
approval below; application/worker restart remains outstanding. Root reviewed the integrated count/plan,
ownership/read visibility, legacy fallback, cover synchronization, copy/downgrade,
editor save and touch/keyboard contracts. Root caught the legacy empty-array
fallback issue and audit-worker preflight race; the owners fixed both and added
regressions before final acceptance. No connected workflow or deployment occurred.

Test only en/lv/ru. ar including RTL, zh, fr, de, hi, ja, pt and es remain deferred;
supported translations are maintained without claiming fresh verification.

Verification:

- Server compilation passes:
  `esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=output/service-photos-server/index.js`.
- App/server/shared type checking passes with
  `tsc --project output/service-photos-typecheck.json`. This keeps the application
  and gallery included, excluding only the unrelated concurrent native proof
  directories `client/src/native` and `server/native-proof`.
- Final standard `npm run check` still fails on five unrelated errors in
  `client/src/native/client.ts` (lines 24, 34, 83) and
  `server/native-proof/service.ts` (lines 88, 89): iterator/default-target errors
  and an unknown value assigned to string. Gallery-readiness declarations were
  corrected; no TASK-048 errors remain. Full-project type verification is
  incomplete; the unrelated native proof owner must resolve those errors.
- Attributable tracked-file `git diff --check` passes; existing line-ending
  warnings do not report whitespace errors.
- Backend owner's strict offline gallery suite and booking-capacity, booking-notes,
  search-storage and startup-diagnostics regressions pass. See the linked backend
  handoff for commands, real handler coverage and mock boundaries.
- Frontend helper tests and Chrome en/lv/ru at 390px/1280px pass. This includes
  actual touch swipe in both directions, both detail layouts, keyboard/buttons,
  limits, uploads, workspace races and successful/rejected mocked PATCH saves.
  Isolated frontend Vite build (`node output/build-service-pictures.mjs`) passes.
  Root visually inspected the mobile detail and editor screenshots. Firefox and
  WebKit tooling is unavailable; no downloads occurred. Physical-device and
  assistive-technology acceptance is not established by these checks.
- DB owner's offline prepare/schema/readiness and mocked execution suites pass,
  as do the affected historical currency/workspace-pricing checks. Root reviewed
  the pinned migration/runner and independently ran
  `node --import tsx migrations/service-photos/test-execution.mjs` successfully.
  It tests admission, one submission, no retry, failures before/after COMMIT,
  preservation and sanitized receipts using injected adapters; no SQL executed.
- Root reran the targeted type check and isolated server bundle after final owner
  changes; both pass. No live Storage behavior, SQL constraints/locks, app startup
  or audit delivery was exercised for this task.

## Recovery and next action

All owners returned attributable file lists, final reviews and recovery details.
Revert only TASK-048 changes, preserving existing dirty work. The migration is now
applied, so do not drop the gallery column or run old cover-only writers as a blind
rollback.

**Authorization received, 8 November 2026:** user replied **"Permission granted.
Go without DB backup"** to the concrete migration 0022/checks request linked to
the database handoff. This is a new TASK-048 development-only no-backup exception,
not reuse of historical waivers. Executor `/root/service_photos_database` was
contacted through live agent tools to record acceptance and execute once on
development `hbkooiknruimukkhshrk`, including necessary protected target
configuration reads, source preflight/postflight and bounded read-only audit
readiness on `ynygqodmtgjrngiudalw`. No backup creation, ACL changes, deployment,
app/worker startup or audit delivery is included. The assigned owner accepted
through live tools and completed the single approved attempt successfully.

Read-only local process inspection found running project app/watch entries and an
audit-worker entry before any database attempt. Root routed the necessary
reversible quiescence dependency to the existing assigned Backend owner through
live tools, under this approved stopped-writer cutover. Backend must verify
project ownership/parents, stop only attributable project trees, prevent watcher
respawn and return evidence to DB; ambiguous or unrelated processes are excluded.
Backend verified exact project working directories/parent chains, stopped only
the two attributable npm process trees parent-first and confirmed no respawn at
15:21:50 UTC (17:21 Riga). Terminal shells and unrelated processes were preserved.
The DB owner's independent database guard then confirmed zero other writers.
No app/worker restart is authorized by this handoff.

The concrete command, pinned digest, 34/36 readiness gates, field/count preservation,
trigger-generated audit effects and recovery are in the database handoff. Execution
was initially locked by unset approval/recovery records; the assigned DB owner
may now record this fresh approval and no-backup choice. Keep old app/service writers and
audit-worker/capture processes stopped through migration/verification and updated
app cutover. The runner stops on first failure and does not retry, start services,
deliver audit events, change ACLs or deploy. After a confirmed COMMIT preserve the
gallery column and use a reviewed forward fix; blindly reverting old cover writers
or dropping the gallery risks failure/data loss.

## Development execution and independent receipt review

The assigned DB owner executed the reviewed one-shot command once on
8 November 2026. Before connecting, a metadata-only trigger identity guard was
corrected to use catalog joins rather than resolve a private-schema procedure
name. Root reviewed the corrected SQL and pin; DDL/backfill/timeouts and privileges
were unchanged. Offline guard/pin tests passed. Final migration SHA-256:
`ceae2a5dd684aea626e9cc63a09b71cd360eda91dc5dc895d7ed6bf8a90e0775`.

[Sanitized execution receipt](../migrations/service-photos/source-execution-receipt.json),
SHA-256 `c9ccf7269f73fcbc440b51d66edcaee5f98403f4a11da3347957ad4fb31ba2ea`,
records verified completion at 15:22:20 UTC (17:22 Riga):

- Correct executor/source/audit destination and fresh explicit backup waiver.
- Confirmed single migration COMMIT, no retry, 34 starting and 36 final readiness
  gates passed; bounded read-only audit destination readiness passed.
- All original fields/counts of 28 services and 36 bookings preserved; 22 existing
  service covers backfilled exactly into one-picture galleries.
- Audit trigger remains enabled; 22 expected redacted backfill events are pending
  normal delivery. No audit delivery was attempted by the executor.
- No backup, ACL change, private configuration edit, app/worker startup or
  deployment occurred.

Root independently read the receipt, checked its SHA-256, targets/executor/waiver,
committed and verified states, pinned migration digest, preservation/counts,
readiness and pending-event count. No second connection or write was made by root.

Next operational action: start the updated development app and audit worker under
their normal execution scope. They remain stopped after the authorized migration;
no connected browser workflow, upload or audit-delivery verification is claimed.
Existing full-project native-proof type failures and unavailable Firefox/WebKit
coverage remain stated above and are not fresh gallery failures.

Owner evidence: [frontend](service-photos-frontend-handoff.md),
[backend](service-photos-backend-handoff.md), [database](service-photos-db-handoff.md).
