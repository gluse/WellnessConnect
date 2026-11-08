# TASK-047 delivery and artifact review

Reviewed 8 November 2026 (Europe/Riga).
Requester: `/root`. Assigned CI/CD Developer: `/root/release_delivery_review`.
Originating scope and requirements: [worldwide release plan](worldwide-release-plan.md).

## Acceptance and limits

Accepted current-source delivery review, safe inert/local checks and ownership of
this document. Root subsequently accepted one narrow infrastructure dependency:
add the activity-worker artifact to the existing buildspec presence gate and test
its extracted Node payload against synthetic files. That scope follows AGENTS.md
standing cooperation; it grants no cloud execution or publication authority.

Selected planning requirements are **99.9% monthly availability**, **EUR 100–300
monthly operating budget**, excluding development/store fees, and worldwide
readiness with an initial Latvia/EU launch. These are not evidence of achieved
reliability or permission to provision, upgrade or spend.

No private configuration, credentials, live database, cloud or external service was
accessed. No dependency installation, Docker command, daemon startup, actual
buildspec execution, app startup, image publication or deployment occurred. No
cloud pricing or platform capability claim is made by this local file review.
Existing unrelated dirty work and historic artifacts were preserved.

## Findings and repair

### Current source is different from the last staged application snapshot

The [gateway release record](aws-staging-session-release.md:26) names the last
application image and explains that the later gateway overlay did not rebuild
application/frontend code. The recorded application snapshot is
`outputs/aws-staging-build/source-numRWC`, manifest
`2ea7c952e9935e964c86516a12d498822bd0e1b029428e02a4d5f097301b0349`.
Its local build receipt records image
`sha256:283569798ce4701a333c4d05992b94618c5e5a6016b644346d4d0e559fec1a02`.

A bounded PowerShell SHA-256 comparison of its 472 recorded source inputs found:

- All 472 archived snapshot files still match the manifest; none were missing.
- Before this review's buildspec repair, 40 corresponding current-worktree files
  differed and none of those recorded paths were missing. Examples include
  `server/auth.ts`, `server/routes.ts`, client components, `package.json` and the
  staging gateway source. Newly added files were outside this count.
- The accepted buildspec repair adds another intentional source difference.

This was byte/provenance verification, not translation/resource validation or
fresh locale coverage. No deferred-language behavior was tested. The count is a
dated observation of a shared worktree, not an immutable current release manifest.

**Consequence:** prior staged-image tests cannot establish the current source is a
release candidate. CI/CD must create a new reviewed source snapshot, build/test
that exact candidate, record input/image identities and obtain scoped promotion
authority. No remote staging inventory or live health was checked here.

### Fixed: cloud artifact gate omitted the activity worker

[package.json](../package.json:22) emits `dist/activity-worker.js`, and its
production command at line 24 executes that file. The existing
[local image gate](../deploy/aws/build-local.ps1:51) already required it. The
equivalent [buildspec gate](../deploy/aws/buildspec.yaml:14) omitted it, permitting
the artifact-presence check to pass without a required production entry point.

Reproduced the old behavior by extracting the actual quoted Node payload and
running it in a temporary synthetic tree: the gate exited 0 while
`dist/activity-worker.js` was absent. With Root's accepted narrow scope, added
only that artifact name to the existing gate. Existing isolation, stop-on-failure,
build, authentication and publication commands remain unchanged.

Verified the new extracted payload with seven cases:

| Synthetic case | Expected and observed exit |
| --- | --- |
| All six required artifacts exist | 0 |
| Missing `dist/index.js` | 1 |
| Missing `dist/audit-worker.js` | 1 |
| Missing `dist/notification-worker.js` | 1 |
| Missing `dist/activity-worker.js` | 1 |
| Missing `dist/public/index.html` | 1 |
| Missing `certs/supabase-ca.crt` | 1 |

The tested payload was extracted from the edited file, not rewritten as a test
implementation. Fixture artifacts were empty files because the gate checks
presence; these cases do not prove executable module behavior. Temporary paths
were resolved and verified beneath the intended temporary directory before
recursive native PowerShell cleanup. No Docker/cloud operation was invoked.

### Production packaging foundations exist, with evidence limits

The [Dockerfile](../Dockerfile:4) uses separate build/production-dependency stages,
`npm ci`, production dependency pruning, a non-root runtime and a health check.
The [.dockerignore](../.dockerignore) allowlists context inputs and excludes dotenv
files/private key extensions. The [source snapshot helper](../deploy/aws/prepare-source.mjs:12)
uses an explicit input list, refuses symlinks and selected credential-shaped
content, and hashes copied inputs. These safeguards should be retained; the
pattern scanner is not a comprehensive secret audit.

The [local builder](../deploy/aws/build-local.ps1:17) checks snapshot containment,
link absence, file count and each recorded file hash, constrains the Docker
endpoint to a local named pipe and runs proxy/artifact checks without container
networking. Its aggregate manifest hash is checked for format but not independently
recomputed there. Stronger provenance verification can validate canonical aggregate
hash and unique/exact input paths; no tampering of the inspected archive was found.

The default [base image](../Dockerfile:2) is a mutable Node tag. Release source hashes
alone do not guarantee byte-identical future images. A release should record/pin
the reviewed base digest alongside lockfile, toolchain/platform and produced image
digest after current security review. No new base image/version was selected.

The normal frontend build invokes the [privacy-policy plugin](../scripts/privacy-policy.ts:44),
which loads dotenv-backed public policy configuration. Therefore no full worktree
`npm run build` was run under this no-private-configuration scope. An isolated,
reviewed snapshot without dotenv files and with explicit synthetic public policy
values is the appropriate next owner build proof; a public policy still needs
actual operator details and reviewed disclosures before release.

### Native release capability and service evidence remain incomplete

There is no inspected native Android/iOS project or Capacitor configuration in the
current application. The [Frontend review](worldwide-mobile-frontend-review.md)
records available Windows Android-tool files and the missing macOS/Xcode capability.
Those observations do not prove an Android build, working SDK version, signed AAB,
iOS archive, physical-device acceptance or store submission readiness.

The [existing staging release](aws-staging-session-release.md) deliberately used
a controlled maintenance transition to avoid overlapping constrained database
consumers. That is useful recovery evidence for its narrow staging operation; it
does not establish rolling production releases within the 99.9% objective. The
[DB review](worldwide-database-review.md) and [Backend review](worldwide-backend-review.md)
identify production-target, role-budget and per-instance-state dependencies that
must be resolved before replica/failover and release-overlap testing.

No production incident rota, alert delivery, restore RPO/RTO, complete isolated
restore rehearsal, representative load/soak acceptance or sustained end-to-end
availability evidence was established in this review. The full goal remains open.

## Verification performed and reused

Fresh checks in this review:

- Read-only manifest/file SHA-256 comparison described above, exit 0.
- Old extracted artifact gate reproduced the missing-worker false positive,
  exit 0 as expected for the defective gate.
- New actual extracted artifact payload: seven expected cases passed.
- Inert `esbuild` graphs for `server/audit/run-worker.ts`,
  `server/notifications/run-worker.ts` and `server/wishlist/run-worker.ts` each
  bundled with `write:false`/`metafile:true`; every static external import was a
  Node builtin or a declared production dependency. Node module code/app startup
  was not executed, and dynamic/runtime dependencies are outside this evidence.
- `git diff --check -- deploy/aws/buildspec.yaml` passed, with the repository's
  existing LF/CRLF conversion warning.
- This document's local link targets, trailing whitespace and conflict-marker
  checks passed.

Reused the Backend owner's fresh exact checks without repeating them:
`node scripts/test-production-server-imports.mjs` passed after approved escalation
for a sandbox-blocked temporary Express junction; the real inert production helper
imported without development packages and the app graph used production static
packages. `node --import tsx scripts/test-audit-reads.mjs` passed after approved
escalation for sandbox-blocked synthetic loopback listening. The owner also
reported audit-remote 76, startup-diagnostics 84 and repaired booking-capacity checks
passing. Commands, scope and failure history belong in the [Backend review](worldwide-backend-review.md).

No language matrix was run here. Test scope remains en/lv/ru; ar/RTL, zh, fr, de,
hi, ja, pt and es are deferred while translations/historical evidence are retained.

## Recovery and next owner action

Recovery for the repair is to remove only the added activity-worker list entry
from the buildspec; no runtime/data rollback is needed. The review document can
be revised or removed independently. Preserve all other worktree changes and the
archived manifests/receipts.

Root should integrate the accepted repair and review evidence, then assign the
isolated exact-source build and selected native proof. CI/CD must prepare a
costed production/recovery proposal within the selected budget; Backend and DB
must return compatible production identity, capacity and shared-state contracts.
Provisioning, credentials, database rehearsal, store signing/submission and
deployment each retain their named-target operation requirements.
