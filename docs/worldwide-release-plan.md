# Worldwide web and mobile release plan

Recorded: 8 November 2026 (Europe/Riga). Tracking: TASK-047.

## Goal and current state

User goal: a publishable, scalable FitsMyTime application that can operate
worldwide, continuously, with a defined SLA; one shared codebase for the website,
Apple App Store app and Google Play app. The thread goal is active. This document
is preparation, not evidence of production readiness or store approval.

The request authorizes this readiness review and planning documentation. Material
architecture, service commitments, retention and production spending choices remain
subject to selection. Existing role boundaries and target-specific execution holds
in [AGENTS.md](../AGENTS.md) continue to apply.

Repository review found:

| Area | Evidence | Release implication |
| --- | --- | --- |
| Shared application | React/TypeScript/Vite client, Express/TypeScript API, Drizzle/PostgreSQL, Supabase Auth/private Storage in [package.json](../package.json) and [architecture](architecture.md) | Reuse the existing application; evaluate mobile integration before choosing a rewrite. |
| Mobile | TASK-034 and TASK-035 are unstarted; no Capacitor dependency or platform project was identified in the inspected app sources | Installable, signed and device-verified apps still need implementation. Responsive web checks do not establish native compatibility. |
| Staging | [Deployment record](aws-staging-deployment.md) reports password-restricted Lightsail micro/scale-one staging using existing development projects | Preserve that environment. Its historical release evidence does not establish current live health, public production isolation or an end-to-end SLA. |
| Sessions and API | [auth.ts](../server/auth.ts) uses server-held tokens, PostgreSQL sessions, HttpOnly/SameSite=Lax cookies and same-origin request checks; [queryClient.ts](../client/src/lib/queryClient.ts) uses relative URLs and credentialed fetch | Packaged-app origins, cookie transport and OAuth returns need a joint frontend/backend design and proof. Do not relax origin checks globally or put server credentials in apps. |
| Runtime | [health.ts](../server/health.ts), [index.ts](../server/index.ts) and [Dockerfile](../Dockerfile) include probes, startup gates, container packaging and graceful shutdown | Useful foundations already exist; readiness probes do not measure all customer journeys or external dependencies. |
| Scale | [db.ts](../server/db.ts) limits the application pool to five connections per process; auth rate limiting has no shared store configured in the inspected setup | Budget total connections across replicas, workers, audit pools, deployments and administration. Review abuse controls before horizontal scaling. Five connections alone does not prove a bottleneck. |
| Jobs | Startup launches booking-message retention and optional billing work; separate audit, notification and activity workers also exist | Review leases, locking, duplicate delivery and shutdown across replicas before increasing capacity. Preserve existing retention policies. |
| Distribution blockers | TASK-003 provider setup, TASK-024 billing, TASK-025/026 location release gates, TASK-046 account deletion and TASK-019 operations retain unfinished acceptance | Resolve the applicable gates or make an explicit, reviewed first-release feature decision. A local implementation is not live acceptance. |
| CI | No `.github/workflows` directory was present during review | Establish reproducible release gates; this observation does not rule out an external pipeline. |

This was a bounded read-only review, not a security audit, load test, database
inspection or live deployment check. Existing unrelated work is preserved.

## Selected requirements and remaining choices

The user explicitly answered the three planning questions on 8 November 2026:

1. **99.9% monthly availability** as the planning target. This is not a claim of
   current reliability or an approved customer-facing SLA contract.
2. **EUR 100–300/month operating budget** for production hosting, database,
   monitoring, backups and delivery services; development and store fees excluded.
   This planning budget does not authorize provisioning, paid-plan upgrades or
   charges. Cost the complete selected design before requesting execution scope.
3. **Worldwide-ready architecture, initial Latvia/EU launch.** Fresh verification
   remains en/lv/ru; other supported languages/RTL remain deferred.

The user then selected **React/Vite + Capacitor for the local proof**, including
explicit API endpoint, secure native session storage and system-browser sign-in
returns with mocked services, no deployment or store submission. Frontend,
Backend and CI/CD owners accepted their separated local proof scopes. The
selected proof does not authorize real provider, database or credential access.
Remaining material choices include production targets, recovery/incident service
terms and retention policy for account deletion.
Capacitor supports adding native platforms to an existing web project; this is a
fit assessment followed by the selected local proof, not a production release.
[Capacitor installation](https://capacitorjs.com/docs/getting-started).

One codebase means shared UI, contracts, validation, translations and business
logic, with small platform adapters and separate native build/signing projects.
Server code remains hosted. App versions installed by users must remain compatible
with newer backend releases; record API support and retirement rules.

## Availability and scale acceptance

Continuous operation is the service intent. An SLO is a measurable reliability
target; an SLA adds agreed consequences and terms. Define the contract before
advertising a guarantee. [Google SRE service objectives](https://sre.google/sre-book/service-level-objectives/).

| Proposed availability choice | Downtime budget in a 30-day month |
| --- | --- |
| 99.9% | 43 minutes 12 seconds |
| 99.95% | 21 minutes 36 seconds |
| 99.99% | 4 minutes 19.2 seconds |

These figures assume time-based availability; request-based measurements need
their own denominator. The user selected the 99.9% planning target. No measured
availability level or customer-facing SLA has been demonstrated or approved yet.

Before production, owners must provide a reviewable service specification:

- Define critical journeys: search, sign-in/session refresh, booking creation and
  confirmation, provider changes and private history access. Define valid expected
  outcomes, latency limits and which dependent services can block each journey.
- Define measurement window, probe locations/cadence, request and synthetic SLIs,
  partial outages, maintenance treatment, exclusions and evidence retention.
  A successful `/health/ready` alone cannot count as booking availability.
- Agree initial and peak concurrent users, requests per second, search/listing
  volume, booking-write rate, dataset size and geographic latency targets. Measure
  a representative load/soak profile and overload behavior against those numbers;
  do not infer capacity from instance size or daily active users alone.
- Define backup scope, recovery-point objective (maximum lost data), recovery-time
  objective (time to recover), verified restore evidence and deletion-on-restore
  safeguards across database, audit, Auth and private objects. Recovery time must
  be evaluated against the selected monthly downtime budget.
- Name primary/backup incident responders and establish actual 24/7 coverage,
  alert routing, acknowledgement/escalation targets, status communication and
  incident exercises. Automated monitoring alone does not provide human coverage.
- Define release rollback and schema compatibility, worker lag/dead-letter alerts,
  error-budget actions and a representative observation period before claiming
  sustained availability. No finite test guarantees future uptime.

## Delivery sequence and owner contracts

The delivery sequence below remains a proposal. During continuation, fresh owners
`/root/release_frontend_review`, `/root/release_backend_review` and
`/root/release_database_review` accepted scoped current-source reviews and safe
offline/mocked checks through live tools. Each owns a separate review document.
Backend subsequently accepted a narrow booking-capacity fixture repair after its
runner failed on a newly added audit import; implementation behavior and live
environments remain outside that follow-up. These assignments do not select a
mobile architecture or production policy. See the [coordination record](agent-coordination.md).

| Order | Owner and scope | Concrete acceptance / output |
| --- | --- | --- |
| 1 | Product/service owner with CI/CD, Backend and DB input | Select target/budget/markets; define traffic, latency, recovery and incident coverage. Produce costed deployment choices and a service specification without provisioning. |
| 2 | Front End Developer + Back End Developer; CI/CD for tooling | TASK-034/035 shared mobile proof: packaged assets, explicit API endpoint, secure session/origin/CSRF design, system-browser OAuth with verified return links, logout/revocation, no secret leakage. Demonstrate web behavior is preserved and login works on Android and iOS before broad feature work. |
| 3 | DB Analyst/Developer + Backend | Production data isolation and recovery design; bounded connection budget, booking concurrency/idempotency, worker leases and migration compatibility. Review the current schema and representative workload before proposing indexes or caching. Connected tests/restore work require the named target and operation scope. |
| 4 | CI/CD + Backend + DB | Reproducible versioned builds, security/dependency checks, staged promotion/rollback, secret delivery, multi-instance failure handling where selected, monitoring and restore rehearsal. Production design must address failure domains and every critical dependency within the chosen budget. |
| 5 | Frontend + Backend + DB; user/legal review for policy choices | Complete applicable account deletion/retention, location/privacy, user-content handling and authentication gates. Classify physical-service payments separately from digital Pro entitlements before choosing mobile billing. |
| 6 | Frontend + CI/CD, with API/DB owners for integrated checks | Complete shared client flows, native permission/navigation handling, signed Android/iOS artifacts, emulator/simulator and physical-device evidence, privacy/store metadata and reviewer access. |
| 7 | Service owner + all release owners | Review a concrete production release candidate and bounded rollout/recovery package, authorize named operations, release website and approved store distributions, and verify post-release journeys and alerts. Keep the goal open until all acceptance evidence exists. |

Production selection should first evaluate retaining the existing backend and
database services with appropriately isolated production environments. Provider
replacement, microservices, sharding and distributed writes require evidence and
separate material choices; worldwide access alone does not justify them.

Retain the recorded AWS selected Region `eu-north-1` and existing single-Region
constraints. No new AWS platform recommendation, cost quote, resource inventory or
operation was performed in this review. AWS planning must load the required
current service skills, verify project plan/availability and cost the selected
design. Required AWS skill-search tools are not exposed in this thread; historical
price/plan observations are not current quotes. Do not treat a worldwide goal as
authorization for cross-Region resources or a staging budget increase.

## Mobile and worldwide release gates

- Bundle the app's client assets for a reproducible release. Verify deep/universal
  links, system-browser callbacks, expiry/logout, safe areas, keyboards, back
  navigation, accessible touch/keyboard flows, maps/uploads and denied permissions.
  Network loss must not present an unconfirmed booking as saved. Any retry of a
  write must preserve idempotency and return the actual server outcome.
- iOS build/signing requires macOS/Xcode access, locally or through an approved
  build service. Windows web development does not establish iOS build capability.
  Pin compatible tools after review. [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).
- Apple requires meaningful app utility and in-app initiation of account deletion
  for apps supporting account creation. Assess social-login, privacy and
  user-generated-content requirements against the actual enabled features.
  [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/),
  [deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- Google Play account creation requires discoverable deletion initiation inside
  the app and through a designated external web resource. TASK-046 must cover
  that web route and truthful retained-data disclosures.
  [Google Play user data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- Review subscriptions by product and storefront. Physical appointments and
  digital Pro functionality may follow different rules; do not assume the web
  Stripe integration can ship unchanged in mobile apps.
  [Apple payment rules](https://developer.apple.com/app-store/review/guidelines/#business),
  [Google Play payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).
- Worldwide readiness needs explicit provider/customer appointment zones and DST
  behavior, separate locale/currency handling, international addresses and Unicode,
  processor and store-country availability, supported contact formats and reviewed
  market-specific notices/terms/data handling. Existing timezone fields and
  currency work are foundations, not verified worldwide behavior.
- Verify website and mobile journeys only in **en/lv/ru**, inspecting runners
  first. **ar (including RTL), zh, fr, de, hi, ja, pt and es remain deferred**;
  maintain their translations and historical evidence. Worldwide distribution
  must not imply fresh language coverage outside that agreed scope.
- Developer account ownership, app name/identifiers, signing custody, support and
  privacy/deletion URLs, content ratings, SDK disclosures, screenshots, current
  target-SDK/tool requirements and applicable testing-track requirements must be
  established before submission. Store approval remains an external decision.

## Evidence, limits and next action

Completed this turn: repository/source/handoff review and current official
Capacitor, Apple, Google Play and SRE documentation review; preparation of this
plan and tracking links. No application code, configuration, schema, credentials,
live service, cloud resource or store listing was changed. No runtime tests were
run for these documentation changes. Local Markdown link-target checks across
this plan, TASKS.md and the coordination queue passed; TASK-047 appears once in
the task list. `git diff --check -- TASKS.md docs/agent-coordination.md` passed
with existing LF/CRLF conversion warnings. The new plan was also inspected for
trailing whitespace and conflict markers.

Next: record the user's availability, budget and launch choices; turn steps 1 and
2 into accepted scoped owner assignments and settle the mobile architecture from
the proof. Remaining service-policy and execution decisions should be requested
with concrete reviewable proposals, reusing existing in-scope approvals.

Recovery for this preparation: remove only TASK-047's attributable documentation
and links. Preserve all pre-existing dirty work and earlier evidence. Goal status
remains active; nothing in this plan establishes a publishable worldwide release.
