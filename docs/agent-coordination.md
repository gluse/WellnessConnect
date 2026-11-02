# Cross-role dependency queue

Follow [AGENTS.md standing authorization](../AGENTS.md#cross-role-cooperation-and-standing-authorization).
Contact a reachable owning agent directly and link the request here or in the
task handoff. Use this shared queue when a dependency spans sessions or cannot
be delivered. An entry is a durable request, not evidence that a session received
it. Owners check relevant entries when starting/resuming a task and record
acceptance before implementation. Keep detailed approvals/results in their
owning task/handoff and link them here.

For each request record the task/problem and expected contract, requester,
receiving owner/executor, state, files/environment, approval source and limits,
acceptance checks, recovery and next action. Use requested, accepted, in progress,
blocked or completed; state a concrete reason for blocked work. Owners return
results and evidence; requesters check integration before closing dependencies.

## Appointment layout redesign — 2 November 2026

**Completed / verified locally.**
User approved the reviewed image except the duplicate My Services/My Bookings
labels above Appointments. Specific frontend executor `/root` owns local shared
agenda/stats, both page layouts, the scoped short-height header adjustment,
locale resources and mocked checks. One heading, compact summary/filters, dates
inside white cards and lavender/mint area backgrounds are implemented.
See [scope, evidence, limits and recovery](appointment-layout-handoff.md).
TypeScript, provider/customer route regressions, Chrome collaboration checks,
Chrome/Firefox/WebKit en/lv/ru layout matrices and native Chrome 400% checks pass.
The updated customer-action Chrome regression passes six behavior groups across
en/lv/ru, including mutations, permission/error handling and dialog focus.
New evidence files preserve historical results. No backend/database dependency,
connected operation, private configuration or deployment is included. Other
locales and Arabic RTL remain deferred; preserve all pre-existing dirty work.

## Workspace moved into My Services navigation — 2 November 2026

**Completed / verified locally.** User's
specific frontend redesign request authorizes `/root` for local provider
navigation/layout, workspace selector, locale resources and mocked frontend
checks. Show the selector only for personal plus at least one company workspace.
Preserve mutation/draft safeguards and visible role/company notices. No other
owner dependency, connected operation or deployment is included. See
[scope, validation and recovery](workspace-navigation-handoff.md). Check only
en/lv/ru; other locales and Arabic RTL remain deferred. Recovery preserves all
pre-existing dirty work.
TypeScript, provider-navigation regression and isolated esbuild/Tailwind build
pass. Chrome/Firefox/WebKit each pass five behavior groups and twelve en/lv/ru
viewport combinations with personal-only, one-company and two-company cases.
No connected verification or deployment occurred; no remaining local dependency.

## Group appointments, messages and reschedule agreements — 2 November 2026

**Implemented / verified locally; development database activation verified.** User approved implementation of the reviewed v2/v3
designs. Coordinator `/root`; Frontend `/root/appointments_frontend`, Backend
`/root/appointments_backend`, DB `/root/appointments_db` assigned through live agent
tools for their respective local scopes. See [approval, ownership, limits and
integrated evidence](group-appointments-implementation-handoff.md). Private
per-booking messaging, PRO private group sending, event actions and consent-based
rescheduling are included. User selected 12-month message history after the later
closure/last-message time, retaining unresolved bookings. Initial implementation
covered local files/offline checks; connected activation was authorized separately
below. No real message delivery or deployment is included. Checks: isolated/mocked en/lv/ru;
other supported locales/RTL deferred. Frontend, Backend and DB owner handoffs and
root integrated checks pass: final browser suites in Chrome/Firefox/WebKit,
type/build, 43 repository / 22 API / 16 retention / 142 schema checks. Prepared
0016/0017 migrations and recovery are reviewed. User subsequently approved
application to development project `hbkooiknruimukkhshrk` and read-only verification.
The assigned DB owner accepted that named execution through live tools, with
bounded preflight and stop-on-first-failure. No audit connection, fixture writes,
purge, messages or deployment is included. TASK-037 remains unchecked while the
owner performs activation and reports actual results/live acceptance limits.
The named-target read-only preflight passed (PG17/33 tables/no prior appointment
objects). No DDL/grants ran during preflight. A recoverable backup was unverified,
so execution was held for a new recovery decision; a separate billing waiver was
not reused.
User then explicitly selected “Apply migrations 0016/0017 without a verified
backup” for the named development project. The TASK-037 backup hold is resolved;
assigned DB owner proceeds with the existing stop-on-first-failure and read-only
verification scope. No backup or successful migration is claimed until reported.
The assigned DB owner subsequently applied each script once successfully;
0016 backfilled six terminal timestamps, 0017 activated server-only runtime access.
All 20 restricted-app-role read-only readiness checks passed against the expanded
35-table schema. Root checked the sanitized receipt/hashes/verified booleans without
another DB connection. No backup, app startup, audit connection, fixture writes,
purge, message sending or deployment is claimed. Next: user functional review of
the updated application; TASK-037 remains unchecked for that live acceptance.

## Provider booking notes — 31 October 2026

**Completed locally.** User reports notes entered during booking are not
visible to the provider. Front End Developer/requester `/root` owns the provider
notes presentation, translations and isolated browser verification. Backend owner
`/root/booking_notes_backend` accepted a directly delivered scoped dependency to
trace and verify notes through the existing API/storage using mocked adapters;
see its [record](booking-notes-backend-handoff.md). Standing cooperation authorizes
necessary reversible local backend fixes if data loss is found. No schema/ORM,
connected database/services, private configuration or deployment. Preserve all
existing changes. Acceptance: submitted notes are clearly labelled on the matching
provider booking, preserve multiline Unicode text and render safely. Empty notes
do not create an empty section; customer view/permissions remain as before.
Provider notes now have a distinct labelled section. The isolated backend trace
found no data loss in current code. See the [integrated findings, frontend tests
and limits](provider-booking-notes-handoff.md). Chrome/Firefox/WebKit en/lv/ru
checks at desktop/tablet/phone widths, TypeScript, frontend build and provider
completion regression pass. Other supported locales/RTL remain deferred.
Recovery: remove only this task's additions. No remaining local dependency;
next: local user review. The user's specific live booking is unverified.

## Duplicate group booking confirmation — 31 October 2026

**Completed locally.** User assigned
the frontend warning while retaining repeat bookings. Requester/approver: user;
Front End Developer/executor: `/root`. See the [scope, behavior, checks and
recovery record](duplicate-group-booking-handoff.md). Existing authenticated
bookings read supplies the match; no backend/database dependency or connected
execution. Local frontend tests use en/lv/ru only; other locales/RTL deferred.
Chrome/Firefox/WebKit, existing capacity/guest regressions, TypeScript and frontend
build passed. Next: local user review. No deployment included.

## Search group service maximum capacity — 31 October 2026

**Completed locally.** User requested the frontend change; `/root` accepted and
executed the scoped Front End Developer assignment. Search service details now
show the maximum group capacity. See the [approval, implementation, verification
and recovery record](group-service-capacity-handoff.md). Chrome/Firefox/WebKit
isolated checks pass in en/lv/ru at desktop/tablet/phone widths, along with
TypeScript and production frontend build. Other supported locales/RTL are deferred
for testing. No backend/database/service execution or deployment; no dependency
request remains. Next: local user review.

## TASK-036 — Restricted AWS staging — 31 October 2026

**In progress; Lightsail and development targets selected.** Requester: user. Infrastructure coordinator
and executor: `/root`. User selected restricted staging and High guidance.
Backend `/root/aws_staging_backend` and DB `/root/aws_staging_database` accepted
scoped dependencies via live agent tools and completed their initial repository
reviews, then resumed within the user's selected connected/preparation scope.
See [findings, execution choices and recovery](aws-staging-deployment.md).

AWS read-only connectivity, Free plan/credits, regional availability and pricing
are verified. User selected Lightsail micro/one node, USD 10/month base with a
staging password, explicitly accepted deployment-spec credential storage, and
approved source hbkooiknruimukkhshrk/audit ynygqodmtgjrngiudalw after owner preflight,
including secure runtime provisioning and normal test-session/audit writes.
DB owner completed named-target preflight: four exact principals/TLS/caps and
all 14 current 33-table gates pass; zero other connections at individual snapshots.
Frontend production build/client-shared TypeScript, Backend offline audit worker
tests/bundle and root proxy security/coalesced-health tests pass. Protected app
and worker handoffs are separate; only the reviewed public CA enters the image.
Normal worker delivery covers any eligible shared-development audit backlog;
no worker claims have been made.
Supporting S3/ECR/role/encrypted logs/KMS/CodeBuild resources were created under
the selected staging scope. First build start failed before running because all
CodeBuild compute quotas are zero. User approved a one-small-Linux-build quota
request, including a possible Support case. Fresh quota/history checks passed;
the single request succeeded; latest status CASE_OPENED, case 179346682900519.
Request ID and execution
evidence are in the linked deployment record. AWS review/effective capacity is
the current dependency; no build retry, plan upgrade or Lightsail creation.
Docker is unavailable, so actual Linux container evidence is still missing.
Public location/privacy holds remain. Next: supported build capacity/path, then
image verification and restricted Lightsail deployment.
No deployment is claimed. No fresh language tests; en/lv/ru only for future
acceptance, other supported locales/RTL deferred.

## Pending requests and group booking availability — 29 October 2026

**Implemented and verified locally.** User reports that submitting a request
with Instant booking disabled makes the slot unavailable; the slot must remain
available until approval. User added a second bug in the same task: a group
session with capacity six and two confirmed participants must retain four
bookable places. Requester/integration reviewer: `/root`; assigned
Back End Developer/executor: `/root/pending_booking_backend`, contacted through
live collaboration tools after confirming no reachable owner was already working.
Assignment follows AGENTS.md standing cooperation. Backend records acceptance,
implementation and evidence in the
[booking availability handoff](pending-booking-availability-handoff.md).

Scope: necessary reversible local backend scheduling/availability, booking
creation/rescheduling/approval logic and offline mocked regression tests. Shared
scheduling application logic follows backend ownership; frontend helpers must
remain compatible. No private configuration, connected database/service access,
schema/migration/ORM changes, deployment or spending. Acceptance: pending requests
do not occupy slots, approved/instant bookings still block conflicts, approval
rechecks occupancy under the existing serialization lock. Preserve unrelated work,
including pre-existing TASKS.md edits. Recovery: revert only this fix's changes.
**Expanded / accepted frontend dependency:** Front End Developer
`/root/pending_booking_frontend_tests` owns the booking modal's participant limit,
picker capacity refresh, focused mocked UI checks, and en/lv/ru scope correction
in the existing cleanup runner. Backend finished that runner's scheduling
assertions before frontend editing began. Contract: optional
`BookableSlot.availableCapacity`, populated by the server; group sessions share
only the same service/start/duration/cleanup interval and confirmed/completed
participant counts consume capacity. Other resource overlaps remain exclusive.
Booking creation, rescheduling and approval enforce capacity under the existing
provider lock; reschedule previews honor the reservation's participant count.
Frontend caps its participant input at the selected slot's remaining capacity.
Frontend evidence belongs in the
[test/UI handoff](pending-booking-test-scope-handoff.md).

Concurrent TASK-032 notification changes are present in the workspace; preserve
them, re-read mixed files before edits, and do not revert or claim their evidence.
Those owners are outside this thread's reachable roster; this queue is a durable
coordination notice, not evidence of live delivery. In particular backend booking
mutation/route changes must retain each task's behavior.
**Resolved check dependency:** an intermediate full `npm run check` reported
TS1378 in the concurrent notification worker. That entrypoint was subsequently
wrapped by the concurrent task, and the final full typecheck passed without
shared compiler changes.

**Completed / integrated review:** Backend's isolated capacity/API regression and
existing customer booking action checks passed against the merged notification
and availability source. The regression also fails against pre-fix tracked code
at the pending-availability assertion. Frontend's isolated Chrome regression
passed in en/lv/ru at desktop/tablet/phone widths, including four remaining places,
over-capacity rejection, canonical booking payload, capacity refresh, retained
participant choice, sold-out reset, focus and reflow. Focused fixture typecheck,
cleanup frontend-only regression and scoped whitespace checks passed. Root
reviewed shared capacity, serialized mutations, reschedule previews, UI limits,
test isolation and the final integrated diff; unrelated changes were preserved.
No connected DB/service check or deployment occurred; live database concurrency
remains unverified. No local owner dependency remains. Next: user reviews the
local booking behavior; connected execution remains separately authorized.
Language-sensitive testing is limited to en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt
and es remain deferred.

## TASK-032 — PRO notifications and reminders — 29 October 2026

**PRO appointment reminder follow-up — 30 October 2026, completed locally.** User
requests `Automatic reminders` when the service automated-reminder flag is enabled,
otherwise `Send reminder`, including PRO workspaces. Requester/reviewer `/root`
assigned Front End Developer `/root/reminder_frontend` and Back End Developer
`/root/reminder_backend` after checking the reachable roster; both accepted through
live collaboration. Frontend owns appointment presentation, translations and mocked
UI regressions. Backend owns the preview route and mocked authorization regressions:
allow PRO manual reminder previews only when service reminders are off; preserve
automatic status previews, enabled-reminder duplicate protection, workspace access
and future-confirmed eligibility. Scope: reversible local files and offline/mocked
checks under this user request and standing cooperation. No private configuration,
connected app/database/provider access, messages, schema changes or deployment.
Checks cover en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred.
Owners returned evidence; root reviewed the component/route contract and Chrome
phone screenshots. Application TypeScript, offline server/worker bundles, 34 actual
bootstrap and 42 API scenarios pass. Frontend records scoped browser/resource and
fixture type checks in the linked follow-up handoff. Recovery:
reverse only this follow-up's edits, preserving existing TASK-032 and unrelated work.
Frontend evidence: [follow-up handoff](pro-appointment-reminder-handoff.md); backend
evidence: [backend handoff](notifications-backend-handoff.md).

**Guided setup follow-up:** User reports applying notification migrations 0014
and 0015 to the existing local-development Supabase database, with PostgreSQL
17.11 and all supplied catalog checks passing. During setup, user-run
`npm run billing:dev` stops with the generic readiness refusal. Read-only review
found the application billing guard still pins 27 public tables and excludes the
six new notification tables from its exact DML list. DB owner
`/root/notifications_db` accepted the routine local contract update to the exact
33-table application schema; Backend `/root/notifications_backend` accepted safe
allowlisted startup diagnostics and offline checks. Preserve historical pinned
migration/rehearsal profiles and all existing authorization checks. No agent DB,
private configuration or provider access/startup retry is approved or performed.
**Completed / locally verified:** both owners froze their changes. Passed 129
runtime-contract assertions, ORM/SQL/manifest parity, 133 monthly-database checks,
60 safe diagnostic checks, 16 mocked billing-runtime tests, TypeScript and build.
Next: root guides a single user retry without rerunning migrations; inspect safe
stage/code/checks if refused. This fixes a missing local integration dependency,
not a reason to weaken readiness or change database privileges.

**Second guided startup result:** user reports only `notification_constraints`
false at `billing_database`; all other readiness flags pass. DB owner accepted
the local follow-up. Source review of PostgreSQL 17's `ruleutils.c` identifies
`TRIM(BOTH FROM ...)` deparsing absent from the comparison fixtures/normalizer.
Reproduce and correct that representation locally, retain integrity checks and
prepare a bounded read-only catalog query if further live evidence is needed.
No agent connects, reads private configuration, changes constraints or retries
startup. **Completed locally:** DB reproduced the default-trim comparison failure
and narrowly normalized that representation in JavaScript and metadata SQL;
explicit trim characters/directions remain distinct. Passed 141 contract checks,
ORM/SQL/manifest parity and 133 monthly-database fixtures. Migration/manifest and
permissions are unchanged. Next is one user startup retry; if still refused, use
the prepared catalog-only `migrations/notifications/diagnose-check-constraints.sql`
to gather evidence before further changes.

**Notification API workspace follow-up:** after enabling the feature during guided
setup, user reports `/api/bookings/36/notifications` responds with `Choose a
workspace you belong to.` Root traced a definite bootstrap-order defect:
`setupNotificationRoutes` mounts before `setupCompanyRoutes`, which installs the
`/api` workspace middleware. Backend `/root/notifications_backend` receives the
routine local fix and regression dependency: register notifications after workspace
loading; preserve authentication, authorization, raw webhook boundaries and
cross-company isolation. Existing route tests injected workspace in their auth
stub, masking the integration defect. Scope remains reversible local server/tests
and mocked checks; no agent private configuration, connected app/DB/provider
operation or session writes. Root owns integration review/build and next user step.
**Completed locally:** Backend moved notification registration after company
workspace middleware. Actual-bootstrap regression reproduces the original 403
and passes 29 scenarios with real workspace/access logic. Full notification
suite, TypeScript and scoped diff checks pass; root reviewed integration and built
the server bundle successfully. Next: one user app restart and appointments refresh;
no database changes. Evidence/recovery: [handoff](notifications-handoff.md).

**Implemented / locally verified; connected activation pending.** The user's implementation request assigns
Frontend `/root/notifications_frontend`, Backend `/root/notifications_backend`
and DB `/root/notifications_db` their respective scopes. Root coordinates shared
contracts, integration and documentation. Owners accepted necessary reversible
repository changes and offline/mocked tests under standing cooperation.
Frontend owns client/UI/translations and isolated browser checks; Backend owns
APIs, worker/transports and backend tests; DB owns schema/migration files and
offline database-contract checks. CI/CD `/root/notifications_delivery` accepted
the opt-in worker/configuration/setup scope and completed offline YAML checks;
Docker is unavailable, so actual container verification remains a release gate.
Backend coordinates the shared notification
types; DB owns shared ORM definitions. No live DB/service access, private config,
real sending, provider provisioning, spending or deployment is authorized.

**Concurrent booking-availability coordination:** TASK-032 Backend is adding
narrow notification transaction hooks to `server/storage.ts` and booking routes.
Preserve the pending/group availability owner's resource/capacity logic in those
same files. That separate task's owners are outside this thread's reachable live
roster; this entry records the shared-file coordination requirement without
claiming delivery. Re-read current files before patches; no broad replacements.

Acceptance: PRO automatically sends qualifying status changes and configured
confirmed-appointment reminders; free providers receive manual composer links;
verified phone and opt-ins gate phone channels; customer preference wins; stale
jobs, expiry, races and ambiguous sends must be handled safely. Existing future
appointments follow updated settings; elapsed schedules are skipped. Tests only
en/lv/ru; all other languages/RTL deferred. Integrated TypeScript, production build,
all five backend mocked runners, offline ORM/SQL parity and frontend checks passed.
Chrome/Firefox/WebKit each passed nine interaction groups and 36 locale/viewports;
native Chrome 400% zoom/contrast passed. Root reviewed contracts, privacy, source,
sample screenshots, duplicate handling and retention. Shared booking-availability
changes were preserved; their separate owner reports integrated regressions passed.
Recovery and evidence: [TASK-032 handoff](notifications-handoff.md). No local owner
dependency remains. Next: DB owner performs separately authorized migration/rights
rehearsal before running the updated app (new ORM columns require schema-first
rollout even with flags off), followed by authorized provider/worker activation.

## Team management redesign — 28 October 2026

**Completed locally.** User assigned Front End Developer `/root`, approved the
roster and side-panel mockup and requested implementation. Executor `/root`
completed frontend changes, maintained translations and reviewed integration.
Mocked Chrome/Firefox/WebKit team regressions, en/lv/ru responsive/contrast checks,
native 400% Chrome zoom, the shared-form regression, TypeScript and isolated
frontend build passed. No backend, DB or deployment action was performed.
Approval, exact limits, recovery, screenshots, evidence and deferred coverage
belong in the [redesign handoff](team-management-redesign-handoff.md).
Next: user reviews the updated local team page; no owner dependency remains.
Prior team member/invitation evidence below remains historical and preserved.

## Team invitation diagnostic — 27 October 2026

**Pending invitation editing completed locally; initial frontend clarification completed.** User reports that a workspace owner with
four employees can invite one service provider but cannot invite the second at
`/my-services/settings/team`. Requester/diagnostic executor: `/root`; receiving
owners: Front End Developer (form/feedback/tests), Back End Developer if an API
failure is confirmed. This thread's live agent roster contains only `/root`;
historical owner IDs are not reachable agents. Initial review made no application
changes. After the user clarified the successful member PATCH symptom, root
assigned the scoped frontend dependency through live tools to Front End Developer
`/root/team_member_frontend` under standing cooperation. That owner accepted the
real-component mocked diagnostic and records evidence in the
[team-member update handoff](team-member-update-handoff.md); root owns this queue.
No backend/DB execution authority is delegated.

Read-only source review: `client/src/components/company-team.tsx`, provider
settings/workspace hooks, `server/companyRoutes.ts`, `server/companyAccess.ts`,
and the existing company-team migration show no workspace-wide one-provider
limit. The invitation form clears email after success but retains employee
selection; its options exclude member assignments but include pending invitation
assignments. API duplicate employee/pending/member rejections are replaced by
generic localized save feedback in the UI. These are confirmed source behaviors,
not a confirmed explanation of the user's second-employee failure. User was
asked whether the employee is missing, submission is disabled, or an error is
shown (and its text).

**Clarification:** User reports `PATCH /api/company/members/:userId` succeeds but
the team page does not reflect the change. The accidentally referenced Team
Alignment presentation skill was explicitly withdrawn. Source already calls
workspace/team invalidation on success and synchronizes member controls from
fetched role/employee assignment; missing invalidation is not established.
User was initially asked whether a following `GET /api/company/team` occurs and
whether its member `role`/`employeeId` are old or new. The user's subsequent
clarification supersedes that refresh hypothesis: the first selected service
provider's `employeeId` is overwritten when another employee is selected.
PATCH edits an existing
account membership/employee association; it does not create a second membership
or invitation. No server success response proves fresh runtime DB persistence
without the corresponding read evidence.

**User choice confirmed:** Each employee should have a **separate login and
invitation**. This matches the existing supported model; no multi-employee login,
schema/API change or connected correction is requested/authorized. Root resumed
the existing Front End Developer for a read-only wording/workflow assessment.
Guidance: restore the original employee association on the existing member if
needed and save it, then use **Invite a team member**, the next employee's distinct
email, Service provider role, and that employee's assignment to create a new
invitation. Share/send that invitation; acceptance creates the additional member.
Repeat separately for the remaining employees. Editing the existing member row
continues to reassign that login. No fresh GET evidence is needed to explain this
confirmed reassignment behavior; no live repair or invitation was executed.

**Offline frontend result:** Owner reports the isolated Chrome 155 regression
passes for en/lv/ru: exact member PATCH payload triggers GET, controls stay locked
through the awaited read, authoritative GET fields differing from the submitted
draft update the controls and survive component remount, failed writes retain
drafts, and two distinct employees can receive separate mocked invitations.
Root reviewed the fixture/assertions. No application source changed and no live
defect is claimed fixed. The existing membership PATCH does not return saved
member fields. Narrow fixture TypeScript and script syntax checks passed; exact
commands/results belong in the owner handoff. Broader/live acceptance remains
unverified.

Next: user follows the selected separate-login invitation workflow. Frontend
returns the confirmed diagnosis in its handoff; explanatory wording improvements
may be proposed separately without claiming implementation. Regression already
covers sequential invitations for distinct available employees and preserves the
current membership contract. No application code has changed. No private `.env`
files, connected browser/session/API/DB/service
operations, email delivery, app startup or deployment were performed or approved.
`scripts/test-company-teams.mjs` imports private configuration and writes live
Auth/database/storage fixtures; do not use it as an offline regression.
Tests remain en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred.
Recovery: reverse only attributable diagnostic documentation or subsequently
accepted local changes; preserve unrelated dirty work and existing invitations.

### Actual UI implementation — 27 October 2026

User reports no visible change and asks whether Front End Developer implemented
anything. Root explicitly corrected the status: the preceding phase added only
diagnostic tests/documentation, with no application change. Root resumed the
existing assigned Front End Developer `/root/team_member_frontend` through live
tools for the actual, bounded local UI implementation. Owner acceptance and
delivery evidence belong in the [same handoff](team-member-update-handoff.md).

Scope: make adding a separate employee login distinct from editing/reassigning
an existing member; show pending invitations with explicit status and employee
alongside accepted members; clarify/prevent accidental replacement; reset the
invitation employee after successful creation and exclude already assigned or
pending employees. Preserve administrator invitations without employee assignment,
share/copy, failed-write drafts, permissions and owner controls. An invitation is
not an accepted membership: separate membership still requires the existing
verified acceptance flow. No multi-employee account, automatic membership or
API/schema/security-policy change is authorized or needed.

Allowed: necessary reversible frontend/locales changes and scoped synthetic
mocked tests using actual components, en/lv/ru only, phone/desktop and relevant
keyboard checks, plus scoped TypeScript. Maintain all supported translations;
ar/RTL, zh, fr, de, hi, ja, pt and es verification remains deferred. Root owns
coordination records/integration review; Frontend owns implementation/tests and
handoff. Existing live/private/DB/email/startup/deployment limits remain. Recovery:
selectively reverse this UI change, preserving earlier diagnostic artifacts and
unrelated dirty work. Next: return actual source changes and passing evidence;
root verifies the separate-login contract before reporting completion.

**Implemented / verified locally:** Frontend accepted and changed
`company-team.tsx` plus targeted supported locale messages. Root reviewed the
source: prominent add-login action, combined member/pending-invitation list with
employee labels and named revoke controls, reassignment help/warning and explicit
save label, invitation employee reset and member/pending filtering. Root ran
`npm run check` after the owner confirmed source was ready; it passed (exit0).
Owner's narrow Chrome 155 runner passed nine groups: en/lv/ru existing member
reassignment/readback plus en/lv/ru at 1280/320px add-flow cases. Two invitations
grow the visible list from two entries to three then four, each explicitly
pending with its employee; the original member assignment is preserved and no
PATCH occurs in the add flow. Checks also pass for failed-write draft retention,
duplicate/refetch lock, employee reset/filtering, keyboard add-action focus/tab
order, share-link selection, named revoke/released assignment and unassigned
administrator invitations. Scoped fixture TypeScript reports zero diagnostics.
No further application source changed after root's passing integrated check;
locale wording was refined to say membership follows acceptance, avoiding claims
about activating an existing account. Root reviewed source/tests and visually
inspected the synthetic [English desktop](team-member-update-en-1280.png) and
[Russian phone](team-member-update-ru-320.png) screenshots: distinct member/pending
states, readable wrapping and no page overflow. Exact evidence/limitations are in
the [owner handoff](team-member-update-handoff.md).

No real invitation/membership state was changed by agents. User refreshes the
local team page and uses **Add another employee login**; creation visibly adds a
pending entry, and the existing verified acceptance flow makes it a member.
Live acceptance, other browsers/devices and deferred languages/RTL are not claimed.

### Save access on the pending invitation — 27 October 2026

**Completed locally:** User's screenshot confirms the updated
list is served: Juris is an existing provider member and Santa has a pending
Administrator invitation. User clarifies that Santa has no Save access action;
changing the employee on Juris's member card updates Juris. The prior UI change
made pending entries visible but did not make them editable. Root acknowledged
this remaining gap and assigned actual pending-invitation editing to the existing
Front End Developer `/root/team_member_frontend` and new Back End Developer
`/root/team_invitation_backend` through live tools. Backend accepted; each owner
records its acceptance/contract/evidence in the
[frontend handoff](team-member-update-handoff.md) and
[backend handoff](team-invitation-backend-handoff.md).

Contract agreed directly by Frontend and Backend before wiring: authenticated workspace manager PATCH
`/api/company/invitations/:id` changes only role and employee assignment of that
company's still-pending invitation. Preserve invited email, token, expiry,
sender and verified acceptance requirements. No membership update/insertion,
email resend or silent editing of an existing member. Santa gets role/employee
controls and her own Save action on her pending card. Backend rechecks manager,
workspace/invitation lifecycle, employee ownership and existing member/other
pending assignment conflicts under the established company lock; reject unsafe
or stale changes. Admin can remain unassigned; provider/viewer require employee.

Ownership: Backend owns `server/companyRoutes.ts`, narrow mocked backend tests
and its new handoff; Frontend owns `company-team.tsx`, targeted locale messages,
synthetic fixture/browser tests/screenshots and its existing handoff; root owns
queue/integrated review and one final TypeScript check. Acceptance: saving Santa's
invitation changes its own role/employee using its invitation ID, preserves
Juris's membership/assignment and invitation identity, remains pending until
acceptance, and has usable failure/pending/retry behavior. No private env/config,
connected DB/Auth/email/Stripe/API access, app startup, schema/ORM/migration,
deployment or real-state repair is authorized. Only reversible local application
edits/offline mocked checks; en/lv/ru testing, other locales/RTL deferred.
Recovery: selectively undo this additional application phase, preserving earlier
UI/test evidence and unrelated dirty work. Next: owner agreement, implementation,
security/regression evidence and root integrated review; do not report the
user's pending-edit gap fixed based solely on the earlier visibility tests.

**Implementation / integrated verification:** Backend implemented the pending-only
PATCH endpoint and passed 43 hermetic actual-handler cases covering Santa's own
role/employee change, unchanged Juris/members and invitation identity, manager/
workspace/lifecycle/inviter checks, malformed input, conflicts, rollback and safe
failures. Frontend added each pending card's own selectors, recipient-named Save
access, pending/error/success state and immutable email, using the agreed
invitation path rather than the member path. Assignment options exclude other
reservations but retain this invitation's own valid employee. If a selected draft
becomes unavailable, all affected selects visibly keep it as unavailable and
disable submission instead of showing a different employee.

Root reviewed the route and isolation harness, and ran final `npm run check`
after both backend and the last frontend source change; passed exit0. The earlier
in-flight integrated run also passed; final run accounts for the subsequently
completed unavailable-selection fix. Root visually inspected synthetic
[English desktop](team-invitation-edit-en-1280.png) and
[Russian phone](team-invitation-edit-ru-320.png): Santa's own Save access controls,
pending status and saved feedback are present; Juris remains separate and the
layout wraps without page overflow. Final narrow Chrome runner passed **15
groups**: prior nine regression groups plus Santa pending-edit cases for
en/lv/ru at 1280/320px. Santa admin-to-provider save targets only its invitation
ID, leaves Juris/member records and invitation ID/email/expiry unchanged, retains
pending status, and passes targeted feedback, failed draft retention, keyboard
Save, duplicate/refetch lock, authoritative GET/remount and unavailable-selection
zero-write checks. Scoped fixture TypeScript reports zero diagnostics. Root
accepted the integrated contract/evidence; owner handoffs preserve exact checks
and live/deferred-coverage limitations.

Runtime reload: `billing:dev` imports server code without a watch supervisor.
User must restart their own existing local server command and refresh the team
page to load the newly added backend route. No agent start/stop or live save was
performed. Editing the invitation preserves its existing link and pending status;
the recipient's normal verified acceptance is still required for membership.

### Invitation email delivery diagnosis — 27 October 2026

**Local diagnostics completed / delivery cause unverified:** User reports employee invitations do not arrive;
their POST returned `emailSent:false` while creating the pending invitation.
Root reused assigned Backend `/root/team_invitation_backend`; it accepted the
bounded local diagnostic dependency. Source confirms the route commits the
invitation before calling Supabase Auth `inviteUserByEmail`, discards returned
send errors, and currently converts a thrown send error into500 even though the
invitation exists. No current SMTP configuration, Auth log or actual recipient
account status has been inspected. Root asked whether custom SMTP is configured
and whether the recipient already had an account; answers are pending.

Root accepted Backend's minimal remediation: a one-shot helper retains the
existing send operation, handles returned/thrown failure without retries and
preserves201/manual-share response after invitation commit. It logs only a
server-side bounded allowlist of reason/provider code/status; no raw message,
email, token, key or private details, and no new manager-UI account-existence
disclosure. Existing POST response shape, recipient verification, pending edit,
acceptance and permission contracts remain. No new mail transport/provider,
automatic resend, configuration/credentials or connected send is authorized.

Owners: Backend helper/route/offline tests and
`docs/team-invitation-email-handoff.md`; root coordination and public Supabase
setup guidance. Meaningful pure and actual-handler mocked cases must cover
requested/disabled/successful/returned-error/thrown-error mail attempts,
redaction, single attempt, persisted invitation/manual link after failure and
no private imports/network. Final integrated TypeScript belongs to root.
Recovery: reverse only this phase's helper/call/log/test/doc changes; preserve
existing invitations and unrelated work. No private `.env`, account/DB/Auth/SMTP
access, email/resend, app startup, spending or deployment. Language-sensitive
tests remain en/lv/ru; other supported locales/RTL deferred.

Official documentation reviewed by root and Backend identifies possible causes,
not a verified diagnosis of this user's project: the default SMTP service sends
only to Supabase organization team addresses and is rate-limited; Auth invites
for confirmed existing accounts return an error. Custom SMTP is project Auth
configuration, separate from Stripe `.env` profiles. References:
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Auth users](https://supabase.com/docs/guides/auth/users),
[Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).
Next: safe local diagnostic evidence plus user SMTP/account answer or sanitized
Auth log code; do not claim delivery fixed or change provider settings by inference.

**Delivery:** Backend implemented `server/invitationEmail.ts` and the one-shot
POST adapter. Safe server diagnostics now distinguish bounded recipient
restriction, rate-limit, existing-account and other-provider categories without
raw provider payloads. The existing HTTP response remains unchanged and returned
or thrown mail failures preserve201 plus the already-created invitation link;
no automatic retry occurs. Passed35 pure helper cases,13 actual POST/email cases
and43 existing pending-edit cases. Root reviewed source/test isolation and final
`npm run check` passed exit0. Exact evidence/recovery is in the
[email handoff](team-invitation-email-handoff.md). Root added documented SMTP and
existing-account limitations to
[Auth email delivery](supabase-auth-storage.md#auth-email-delivery).

No actual mail setting/account/log was inspected and no mail was sent or
configuration changed. User's SMTP/account answers or sanitized Supabase Auth
log error code are still needed to establish this particular failure and choose
the actual remediation. New server diagnostics require user-owned server reload;
historical Auth logs can be inspected without creating another invitation.
Current result is diagnostic preparation, not successful email delivery.

## TASK-030 — Customer booking cancellation and rescheduling

**Completed locally, 27 October 2026:** User reports a regular customer can
book but cannot cancel/reschedule. Root performed read-only review and assigned
the scoped dependency through live agent tools to Front End Developer
`/root/booking_frontend` and Back End Developer `/root/booking_backend`; neither
owner was already reachable in this thread. Root owns TASKS/queue/integration
review. Owners record acceptance and implementation evidence in
[frontend handoff](customer-booking-frontend-handoff.md) and
[backend handoff](customer-booking-backend-handoff.md).
Both assigned owners accepted through live agent tools and recorded their local
scope in those handoffs. Backend offline route/access/storage checks, existing
customer/provider regressions, frontend browser checks and final integrated
`npm run check` pass. Browser coverage: Chrome155/Firefox157/WebKit27.2,
en1280/lv768/ru375, and Chrome native400% CSS315×201 for all three. Root reviewed
contracts/source, owner evidence and rendered Russian phone plus corrected native
zoom dialog top/footer captures. A provider/customer permission overlap and stale
account display were resolved during review; no current local failures remain.

Approval source: user's bug-fix request plus AGENTS standing cooperation. Scope:
local customer booking controls/components/translations/tests (Frontend), booking
API authorization/transitions/storage application logic/tests (Backend), and
these handoffs. No schema/migration, private configuration/credentials, connected
DB/service reads/writes, app startup against live services, deployment or spending.
Coordinate existing status/reschedule/availability contracts before edits;
customer actions apply only to own future pending/confirmed bookings and preserve
provider behavior. Required checks include owner isolation, forbidden transitions,
invalid/stale/conflicting times, cancellation confirmation/dismissal, rejected
writes, cache refresh, and affected UI/device/accessibility regressions using
synthetic mocked data. Test en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es deferred.
Recovery: revert only attributable task edits; preserve extensive existing dirty
work. Local work closed and [archived](../TASKS_COMPLETED.md#customer-booking-management).
Any live acceptance/deployment needs its separate scoped authorization; neither
was performed. No user booking was changed.

## TASK-024 — Monthly Pro subscriptions

### Renewed no-backup execution request — 27 October 2026

**Stop + DB setup completed:** User replied "yes, stop it" to the exact
combined proposal: Backend revalidates and stops only verified watch17744
(creation `2026-10-20T10:34:25.0836300Z`), then app50916
(creation `2026-10-26T15:25:46.6737900Z`) if still matching; DB then makes one fresh
guarded attempt of the unchanged approved package without backup. Root routed
stop execution to the existing Backend owner and gated the DB owner's retry on
its outcome. Recheck node/PID/creation/project-loader/parent identities; abort on
mismatch, no unrelated ancestors/descendants, no automatic restart. No app
startup/Stripe/fixture/session/worker scope is added; first-failure stop remains.

Backend stop completed with exit0: fresh same-view CIM and pinned process-handle
creation identities verified the exact project/parent association. Parent17744
was stopped first; child50916 exited with it and needed no separate termination.
Post-action both absent. No unrelated process or restart/private/DB/Stripe action.
Root released the separately authorized single DB attempt after this result;
DB performed its own fresh guard. The single released attempt exited0 and
committed/verified all eight migrations in order: source0010/0011/0012/0013,
audit destination0006/0007, then audit source0006/0007. Source baseline passed
19 groups/72 booleans, destination12/53; staged checks passed22/79,22/79,26/88,
26/88, destination15/56 each and source29/91 each. Exact setup memberships were
restored/compared. Verified-TLS read-only restricted app/capture/worker/writer
probes passed, including the app's own-role billing DB-readiness guard.
No further DB call, fixture/session write, worker claim, app startup, Stripe
operation, backup or deployment was performed. No automatic restart. Detailed
receipts/evidence belong to the [DB execution plan](monthly-subscription-database-execution-plan.md).
Earlier failed attempts below are historical; DB setup is no longer blocked.

**Local startup diagnosis, 27 October:** User reports the launcher's generic
refusal. Backend accepted bounded local metadata diagnosis of the named Stripe
profile/credentials, with no private-file edits, app/worker startup, service
control, Stripe/DB request or migration rerun. Check confirms the profile is
missing, `STRIPE_BILLING_ENABLED` violating the preparation-disabled rule and
missing `STRIPE_BILLING_PORTAL_CONFIGURATION_ID`; base `.env` was not read.
Backend completed allowlisted field/stage diagnostics and the local-only checker
`node --import tsx scripts/check-stripe-local-config.mjs`; four new synthetic tests,
narrow TypeScript, script syntax and whitespace checks passed. Root reviewed the
diagnostics and added concrete remediation to the local guide. Values/raw errors
remain redacted. Existing app/connected-execution holds remain unchanged.

**Subscribe visibility review, 27 October:** User reports "Billing unavailable".
Frontend read-only review confirms the wired path My Services → Settings → Pro
subscription and CTA "Continue to secure checkout". No missing route or source
change was needed, and no prior UI suites were repeated. Root's unauthenticated
public runtime GET returned HTTP200 with subscriptionsReady=false,
administrationReady=false and empty hosted origins. This proves dormant billing
on the responding local server; it does not require bypassing frontend guards.
Next user setup is the explicit `.env.stripe-app.local` profile and `billing:dev`
launcher with required Stripe settings. No private configuration or connected
startup/payment execution was performed by agents for this diagnostic.

**Latest / fresh retry authorized:** User answered the pending quiescence question
"Stopped — retry DB setup". Root resumed the same DB executor for one guarded
attempt of the unchanged approved package, with actual absence checked before
private inputs/connections. This reports user-owned stopping; it does not approve
agent process termination or expand app/Stripe/fixture scope. Backup remains
waived; first-failure/no-automatic-retry limits remain. This attempt stopped at
fresh quiescence: the same app50916/watch-parent17744 and creation identities
remain present. No private reads, sockets, SQL or commits; no retry/termination.
User-reported Ctrl+C did not remove the observed pair. The precise Backend
stop+single-DB-retry proposal still needs explicit service-control authorization.

**Accepted / in progress:** User confirms the projects are on Supabase Free with
no managed backups and asks to proceed without backup. The existing explicit
test-data exception remains effective. Root resumed the same DB owner for one
fresh guarded attempt under the unchanged exact development DB-only package;
that owner accepted. No fresh backup selection/approval is needed.

Backend's intervening read-only review found both earlier PIDs absent in its
process view and could not query port5000. Therefore old PIDs17744/50916 are
historical evidence, not current stop targets. DB reviews argument matching and
refreshes safe process/project identity before the new attempt. Service stopping
is not authorized. Same first-failure/no-automatic-retry limits, named private
fields/targets/pins and staged verification apply. No app/Stripe/fixture/worker
activity or production/deployment is added.

Scanner review replaced substring matching with Windows argv/entry-point
classification and safe project/parent evidence; 23 new synthetic checks passed
without repeating the old 34. The single fresh attempt then stopped before
private reads, sockets or SQL: application PID50916, creation
`2026-10-26T15:25:46.6737900Z`, parent17744 creation
`2026-10-20T10:34:25.0836300Z`, has a relative entry whose project is unresolved.
No audit-worker category was reported. No commits, retry or termination occurred.
Root resumed Backend for same-provider identity review and requested that the
user stop their own project dev server and explicitly confirm a setup retry.
Backup remains waived; actual process identity/quiescence is the only reported
current prerequisite. Do not reuse an old PID as termination authority.

Backend aligned its read-only check with DB's elevated Windows CIM inventory:
both PID+creation identities match, child50916's own public tsx preload path proves
this exact project, and parent17744 is its matching node watch supervisor. Earlier
sandbox absence was a visibility limitation. No service was stopped. The concrete
next proposal is Backend stopping only the revalidated watch parent/app pair,
then DB making one fresh guarded attempt of the unchanged approved package.
That stop+retry authorization is not yet provided. Root's earlier request for
user-owned Ctrl+C/retry confirmation is also unanswered. No backup confirmation
is requested; no SQL/commits have occurred.

### Local app runtime integration — 26 October 2026

**Local preparation completed; connected acceptance pending:** User selected local app testing, explicitly requested
the agents complete integration and asked for setup instructions. Root resumed
the existing Backend, Frontend and DB owners; all three accepted through live
agent tools. Backend owns disabled-by-default sandbox runtime/bootstrap/raw
webhook/auth/worker/source cutover/portal recovery and backend tests; Frontend owns
server-driven runtime availability and affected UI/tests; DB owns local migration/
readiness dependencies and the reviewable target-specific execution plan.
Owners coordinate interfaces directly before mixed edits. Root owns this entry,
the decision/task records and the [local setup guide](stripe-local-app-testing.md).

Scope: necessary reversible repository changes and offline/mocked checks for the
existing selected requirements. No private configuration inspection/edit, real
app/worker/CLI startup, connected DB/session/Stripe operations, privilege changes,
charges, spending, live activation or deployment. The five earlier single-account
read approvals are consumed. Local app selection does not authorize or identify
a local/hosted database. Preserve existing dirty work, historical migrations/pins
and stopped-operation holds. Reuse existing test evidence; test only en/lv/ru.

Acceptance: runnable local sandbox wiring and commands, server-owned readiness,
exact webhook events/path, narrow development loopback origin handling, isolated
changed-scope checks, final integrated TypeScript, and precise remaining connected
scope/recovery. Do not claim app payment testing complete without actual evidence.
Recovery: selectively undo attributable local changes before activation; no
connected state has changed in this phase.

Delivery: Backend returned explicit `billing:dev` launcher/profile, raw middleware,
verified runtime, bounded worker, source-aware manual writer and durable portal
audit. Frontend returned auth-scoped server readiness and pending-workspace-switch
guards. DB returned forward portal0007 and exact own-role metadata guard plus
[execution plan](monthly-subscription-database-execution-plan.md). Root reviewed
contracts; early-parser ordering and worker shutdown/startup cleanup findings were
fixed. Backend 15 new cases plus 19 affected cases/audit regression (105 invalid
inputs rejected), DB 109 new offline checks, Frontend four provider/11 mocked
en/lv/ru browser checks and one final integrated TypeScript check passed. Old
236/190 DB and unchanged UI suites were reused, not repeated. No connected work.

Next approved scope is DB migration/readiness only on the selected hosted dev
source `hbkooiknruimukkhshrk` and audit destination `ynygqodmtgjrngiudalw`.
Required pg backup client tools are unavailable; the user explicitly waived the
backup prerequisite for these test-data targets. Approved
scope includes the plan's named private setup/runtime fields, staged SQL/required
permissions and restricted metadata/role checks; excludes fixtures, sessions,
worker claims, app startup, Stripe operations and deployment. User explicitly
approved with "Approve the DB plan"; the existing DB owner accepted via live
agent tools. **No-backup exception accepted; stopped on local-process preflight:** User asks
"Can you Proceed without backup? I have only test data here". Root routed the
explicit exception to the existing DB owner, who accepted it. It supersedes the
earlier backup-confirmation hold for this exact package; no backup/restore point
is claimed or new backup/export/installation authorized. Stop on first failed
precondition/statement/verification or uncertain commit, no automatic retry or
destructive rollback/repair. DB first checks pinned contracts/targets and actual
quiescence prerequisites, then performs approved bounded execution if satisfied.
No new app/Stripe/fixture/worker scope is inferred. Broader rehearsals remain separate. Billing stays
disabled until verified readiness and the separate connected acceptance scope.

The DB owner prepared the fixed-target forward executor and passed 34 new offline
checks. Its one authorized attempt stopped at local producer/worker absence,
before private reads, database sockets, SQL, ACLs or commits. One safe diagnostic
confirmed inventory capability and matching `node.exe` PIDs 17744 and 50916 in the
app/billing category; no audit-worker category was reported. No setup retry or
process termination occurred. Root resumed the Backend owner for safe read-only
PID/project/parent identity review before proposing exact quiescence control.
Stopping another process is outside the current DB package. Backup confirmation
is no longer a blocker; actual local process quiescence is the current dependency.

### Sandbox configuration preflight — 26 October 2026

**Local preparation and own-account verification completed; billing disabled:** User reports filling `STRIPE_BILLING_API_KEY` and
`STRIPE_BILLING_ACCOUNT_ID` in `.env.stripe.local` and asks for the next step.
Root resumed the existing Backend owner for a pure configuration parser, redacted
local validation of only that named file and synthetic tests. The owner accepted
this bounded private setup check; no values, account identity or raw errors may be
printed/persisted, and no other private configuration may be read or edited.

Backend also prepares a bounded own-account Stripe GET check for later specific
approval, without executing it. No Stripe/customer/price/session/webhook write,
database operation, app startup, activation or deployment is authorized. Existing
billing flags stay disabled. Root owns coordination/decision records; Backend
owns server parser/CLI/fixtures/setup note/handoff. Next: return redacted local
results and reviewable API operation/command. Local validation passed once:
sandbox key/account formats present, test mode and disabled flags, optional
webhook/portal/origin absent. Nine synthetic checks plus one failure-output
regression and the targeted two-file TypeScript check passed. No existing
application suites need repeating.

User's subsequent **"please proceed"**, 26 October, authorizes the same Backend
executor to run the prepared `--account` command once: one sandbox
`GET https://api.stripe.com/v1/account`, compare the configured account, safe
boolean-only output, 10-second timeout, zero retries, no redirects/Connect
header. Stop on failure; no other requests, private files, writes, app/DB
startup, activation or deployment. The single command exited 1: local
configuration valid, connected check attempted, account check unsuccessful.
The original redacted output cannot distinguish network, permission or identity
failure; no cause is inferred and no retry is authorized. Backend prepares only
allowlisted diagnostic categories locally: network/timeout, authentication/
permission, account mismatch or other. Two focused mocked diagnostics and the
changed-file TypeScript check passed; no private-file reread or network retry.
The unchanged command is ready for a separately authorized diagnostic attempt.
Billing stays disabled. See the
[setup note](stripe-sandbox-setup.md) for the concrete command and boundaries.

**Diagnostic attempt completed / verification blocked:** User explicitly said "yes, go
ahead" to one additional diagnostic GET on 26 October. Root resumed the same
Backend executor with the unchanged command and limits above; only safe category/
boolean output, stop on failure, no further retries or changes to credentials/
permissions. No earlier suites repeated. The command exited 1 with
`stripe_authentication_or_permission`; local configuration remains valid and
billing disabled. The category cannot distinguish authentication from a denied
read permission. Backend stopped without retry or configuration changes; both
one-shot approvals are consumed. Stripe account owner must review sandbox-key
status/own-account read permissions before any further connected check. Details
are in the setup note; no raw values or Stripe response details were retained.

**Policy-update retry completed / verification blocked:** User reports "Access policy
added. please retry". Root resumed the same Backend executor for one further
execution of the unchanged diagnostic command with all prior read-only limits.
The changed policy is user-reported, not independently inspected. No permission
edits, other requests, automatic retries or repeated tests are authorized. The
third separately approved attempt exited 1 with
`stripe_authentication_or_permission` again. Local configuration remains valid;
account access/identity remain unverified. Backend stopped, recorded the result
and consumed this one-attempt scope. Next evidence belongs to the Stripe account
owner: the failed request log's error code/missing permission, without credentials
or identity data. No further retry; billing remains disabled.

**Accounts-read retry completed / verification blocked:** User supplied the request-log
error identifying `connected_account_read` and then explicitly said "retry"
after root's Accounts Read guidance. Root resumed the same Backend executor for
one fourth execution of the unchanged diagnostic command with all prior limits.
No permissions inspected/edited, other operations, automatic retries or repeated
tests. The fourth separately approved command exited 1 with
`stripe_authentication_or_permission` again; authentication/account equality
remain unverified. Backend stopped with no further attempt; all four single-check
approvals are consumed. The Stripe account owner must confirm that the saved
Accounts Read policy applies to the exact key used by `.env.stripe.local`, or
inspect the latest request-log error. No policy effectiveness is inferred;
billing stays disabled.

**Applied-change retry completed / passed:** User explains they had not
clicked Apply Changes earlier and explicitly asks to retry again. Root resumed
the same Backend executor for one fifth guarded own-account GET under unchanged
limits. No policy inspection/edit, other operations, automatic retries or repeated
tests. The fifth separately approved command exited 0:
`accountReadSucceeded:true`, `configuredAccountMatched:true`, test mode and
disabled billing/new-checkout flags. The key authenticates for this own-account
read and matches the configured merchant. Wider permissions, policy correctness
and payment-flow readiness are not established. Optional webhook/portal/origin
remain absent. No other API/DB/app operations occurred; no tests repeated.
Backend recorded the result in its setup note/handoff; all five distinct
single-check approvals are consumed. Billing remains disabled; remaining
TASK-024 runtime, configuration, connected rehearsal and launch gates persist.

### Selected Stripe and Administration pricing — 25 October 2026

**Accepted / in progress:** User selected Stripe, current-company-owner-only
billing, waiting for valid manual Pro expiry and EUR 19/month tax-inclusive,
configurable through Administration. Root resumed the same Backend, DB and
Frontend owners; all accepted via live agent tools. Exact authority, shared-file
ownership, unchanged execution holds and recovery are in the
[decision record](monthly-subscription-decisions.md). Backend/DB coordinate
durable offer revisions, lifecycle/source/audit contracts; Frontend owns the
Administration editor and transport/billing UI. Frontend owns the final integrated
TypeScript check; owners run only changed-scope tests. No new connected execution.

**26 October selection:** amount changes apply to new subscriptions only;
existing subscribers retain their agreed price. No existing-subscriber migration,
renewal repricing or proration from an Administration amount change. Earlier
unselected vendor/price/owner/manual-wait entries below are
historical and superseded by the linked decisions; other gates persist.
All three owners confirmed they could resume on 26 October after a usage-limit
interruption; prior foundation work is reused. Backend/Frontend agreed on a pinned
offer revision for checkout and a version/CAS-protected Administration editor.

**Local selected-policy delivery complete, 26 October:** Backend returned an
injected application/route composition, Stripe adapter/raw verification, durable
event bridge, conversion/invoice/lease/CAS/source writes and immutable new-only
pricing. Frontend returned the Administration editor, guarded HTTP transports,
manual-wait and bounded freshness behavior. DB returned 0012/0013, explicit
27-table profiles and forward source/destination audit validators. The published
0010/0011 pins and historical applied SQL remain unchanged. Current handoffs:
[Backend](monthly-subscription-backend-handoff.md),
[DB](monthly-subscription-database-handoff.md),
[Frontend](monthly-subscription-frontend-handoff.md).

Evidence: 42 distinct Backend billing cases and the existing audit regression
(105 invalid inputs rejected); DB 236 preserved-foundation +190 new offline
checks; Frontend 22 component/transport cases +3 affected minimum validation
checks and 33 new en/lv/ru browser/zoom checks. The final integrated TypeScript
check passed after one new optional-invoice-ID error was fixed and rechecked.
Backend replaced a sandbox-blocked loopback HTTP fixture with in-process streams.
Root reviewed code/contracts, audit SQL/permission compatibility and Latvian-phone/
Russian-desktop price-editor screenshots. Acknowledgement revision, unknown
checkout, customer reuse/return path, manual-only status and dispute binding
findings were addressed. No private configuration, connected DB/Stripe operations,
app/session writes, charges, spending, activation or deployment occurred.

Runtime stays unmounted/disabled. Remaining gates include approved connected
rehearsal/bootstrap/account/tax/terms, inbox retry/backoff scheduling, unknown
price/session recovery, exception/paginated histories, old-manual-writer source
cutover and durable portal-phase audit/recovery. Other commercial inputs are in
the decision record. No repeat approval is needed for the selected price/vendor/
owner/manual-wait/new-only rules. Recovery remains selective local reversal
before application, preserving dirty work and all existing rights/evidence.
Root final handoff check: nine Markdown files/168 local links pass, with no
whitespace or missing-target issues. Required runtime/connected checks remain
unperformed, so TASK-024 stays open.

**Choice 2 selected; local foundation delivered, 25 October 2026:** User requested starting TASK-024,
with minimal tokens and no repeated tasks. Requester/coordinator `/root` assigned
Back End Developer `/root/subscription_backend` and DB Analyst/Developer
`/root/subscription_database`; both accepted through live agent tools. Assignment
uses [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).

Initial contract: turn the [selected brief](monthly-subscription-brief.md) into a concrete
backend contract and reviewable subscription-only data options, grounded in
existing Pro/workspace authorization and audit code. Owners coordinate shared
interfaces directly. Backend owns `docs/monthly-subscription-backend-design.md`;
DB owns `docs/monthly-subscription-data-options.md`; root owns TASKS/queue/brief.
Initial scope: local source reads and Markdown edits only. No code/schema/config changes,
private configuration, connected services/database, charges, spending or deployment.
That design-only phase is complete. User subsequently selected **choice 2 for
paid recurring access** on 25 October. Root resumed the same live owners for
additive local database expansion and provider-neutral backend/offline checks
under standing cooperation. DB owns billing Drizzle additions, new migrations,
DB runtime/security/list parity and DB tests; Backend owns new billing domain/
repository/adapter contracts and mocked tests. They coordinate interfaces before
edits. Existing application behavior remains unchanged until policy/audit/cutover
dependencies are ready. Delivered handoffs:
[DB](monthly-subscription-database-handoff.md) and
[Backend](monthly-subscription-backend-handoff.md). Root retains TASKS/queue/brief.
No connected access, private configuration, processor setup, charges, spending,
activation or deployment. Processor/commercial terms remain unselected; EUR 19
is a hypothesis. No other task's execution approvals transfer here.

Deliverables: [backend contract](monthly-subscription-backend-design.md) and
[data options](monthly-subscription-data-options.md), cross-reviewed by both owners.
Selected choice 2: separate billing records/manual sources, stable existing
Pro projection and source-aware admin writes. Proposed policy preserves valid
manual grants, projects eligible manual/paid coverage, and restricts company
billing to the current owner. Data choice 2 is selected; this does not adopt
every proposed commercial or security policy. Billing audit actor/event and
retention contracts also need owner preparation before those portions change.

Initial design validation: root reviewed integration, including interval-start/gap handling and
test/live entitlement isolation; owners incorporated those requirements. Final
native PowerShell check passed for four handoff documents and 56 local links,
with no whitespace/link issues; `git diff --check -- TASKS.md` passed. Python's
Windows alias was unavailable, so the check used PowerShell. No application
runners for design-only work; do not repeat these checks without relevant edits.

Backend/DB implementation evidence: DB reports 231 offline structural/driver checks; Backend
reports 23 offline tests, 2 affected coverage checks after a TypeScript fix, and
one final passing integrated `npm run check`. Root reviewed migration/schema
compatibility, opt-in profiles, transfer refusal, actual checkout/event repository
and the hosted-session reservation regression. Actual SQL behavior and processor
signatures are unverified. No SQL/private configuration/service/browser execution
or billing activation occurred. Reconciliation claim/commit persistence and initial
checkout-to-contract conversion remain implementation gaps; the current intake
quarantines unknown bindings. Required audit/authorization hooks have no runtime
implementation and no production instance is registered. Existing manual access
and the active seventeen-table runtime remain unchanged. User's later question
about the two options was answered; choice 2 remains selected, with no repeat
data-selection approval needed.
Final handoff validation: seven Markdown files/114 local links checked with
native PowerShell; zero whitespace or missing-target issues.

Future language checks cover en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are
deferred. Recovery: revert only attributable dormant implementation/preparation
edits using the handoffs, preserving the existing dirty worktree; no data was
changed. Next: continue the handoffs' remaining implementation gaps, resolve
material authorization/source/audit policies and choose the processor/commercial
terms needed for integration. Connected rehearsal requires exact target/scope.
Commercial activation and connected execution stay separate.

### Frontend start — 25 October 2026

**Completed locally; live integration pending:** User explicitly asked the Front End Developer to start
TASK-024. Root assigned `/root/subscription_frontend` through live agent tools;
no existing Frontend owner was active in this thread. The owner accepted through
live agent tools and applied frontend-practices. Scope: reversible local
billing components/view model, minimally invasive settings integration if useful,
translations, offline fixtures/tests and actual mocked browser verification.
Frontend owns those files and `docs/monthly-subscription-frontend-handoff.md`;
root retains TASKS/queue/brief. Backend/DB files remain with their owners.

Contract: build monthly offer/status, pending/return/recovery/cancellation/expiry,
manual-access and denied/unavailable UI against injected server capabilities.
Real billing has no mounted backend routes. Keep checkout/portal unavailable in
the current application; no fictional price or paid data, frontend-selected price,
entitlement from a redirect or new assumed permission/commercial policy. Request
contract review from the existing Backend owner, resumed for read-only support
with no new backend implementation/test assignment. No live services,
private configuration, database/session writes, charges, activation or deployment.
Approval source: user's explicit frontend-start request plus standing cooperation.
Validation: owner inspects runners, runs meaningful isolated component/browser
checks and applicable type/build verification; en/lv/ru only, other locales/RTL
deferred. Preserve dirty work. Recovery: revert only attributable frontend edits.
Delivered: Pro subscription tab at `/my-services/settings/billing`, reusable
server-driven status/offer/terms, manual/paid dates, return/pending/recovery and
denied/unavailable flows; current application mounts only unavailable mode, with
no live transport. No tariff or permission policy was adopted. Backend accepted
the frontend contract after read-only review. See [frontend handoff](monthly-subscription-frontend-handoff.md).

Owner evidence: 12 component/model checks pass; isolated esbuild/Tailwind bundle
and TypeScript pass; Chrome/Firefox/WebKit each pass 14 mocked browser checks
(en/lv/ru, 320/768/1280 widths plus cancellation/failure/expiry/denied/unavailable).
Chrome native 400% zoom passes 3 en/lv/ru cases. No external/unexpected requests.
Root reviewed desktop, Latvian phone and Russian 400% zoom screenshots and the
unknown-checkout regression. Browser startup required the approved escalation
path after sandbox Crashpad failure; no unresolved approval rejection. Production
Vite build was not run because its plugin loads private configuration; isolated
build verification was used. Deferred locales/RTL remain untested. No real API,
processor, session/database operation, activation or deployment was exercised.
Root final documentation check: four Markdown files/82 local links pass with
zero whitespace/missing-target issues; attributable tracked diff check passes.

Recovery: revert only the new frontend billing files/fixtures/tests/evidence,
settings tab additions and new translation namespace, preserving other dirty work.
Next: Backend supplies real authorized routes, checkout conversion and
reconciliation/audit/source cutover. Frontend owns the future transport adapter,
status freshness and scoped end-to-end acceptance after those gates.

## TASK-027 — Google unavailable browsing fallback

**Requested / assigned, 23 October 2026:** User requested service availability
when the Google API key is unavailable. Requester/coordinator: `/root`; assigned
Front End Developer/executor: `/root/maps_fallback_frontend`, reached through
agent tools (no duplicate owner in this thread). Local owner implementation is
authorized by the user request and AGENTS standing cooperation.

Contract: browse our existing catalog without resolved coordinates, retain
keyword/category/other non-location filters, label the absence of radius/distance,
keep device-location search independent of Google, and provide list recovery for
Maps/config/geocoding failures. Bound pending external lookups and preserve valid
location/results after failed replacement lookups. Existing APIs already accept
coordinate-free search; backend/database work is not currently needed.

Files/environment: local frontend search/maps/loading logic, translations and
offline/mocked frontend tests, owned by Frontend; root owns TASKS/queue entries.
No new provider/dependency/persistent caching, live service/database use, private
configuration or deployment. Test en/lv/ru only; other locales/RTL deferred.
State: completed locally; the assigned Frontend owner accepted and returned
implementation/evidence through agent tools and [the handoff](google-api-fallback-handoff.md).
Loader/map lifecycle/public-search UI/frontend-only guest checks, final TypeScript
and Vite build pass; mocked Chrome fallback (6 groups/12 en/lv/ru viewport cases)
and saved-location regressions (7 groups) pass. Full guest runner's backend portion
was stopped by its existing audit configuration guard before pool creation;
frontend-only checks pass. Root reviewed the existing no-coordinate API contract,
failure transitions, evidence and desktop/phone screenshots. No connected
execution/deployment; TASK-025/026 release gates remain separate. Recovery:
undo only attributable fallback edits while preserving
pre-existing dirty work; no data/schema recovery required.

## Single service-view event — requested 23 October 2026

**Implemented and activated in development configuration, 25 October 2026.**
Both 0005 migrations committed/verified under the user's explicit Apply and
activate selection. Rollback-only R90/legacy/invalid-input checks passed on both
targets, no synthetic events were committed, native worker health checked with
no claims, and the protected producer flag read back true. Frontend mocked
en/lv/ru and Backend checks/TypeScript passed. App reload and updated normal
worker command are the usage handoff; no HTTP server/daemon was started. Broader
TASK-016/017 work remains open. Earlier states below are historical.

Backend accepted the user's one-event follow-up: `service.viewed.v1` for explicit
found-service details opens, with server-validated service ID and R/90-day read
retention. Root coordinates sequential Backend, DB and Frontend work; only one
implementation agent runs at a time. Backend implementation/checks and DB local
package/63 offline checks passed. Front End Developer `/root/service_view_frontend`
completed the callback, focused mocked en/lv/ru checks and TypeScript. State:
all local work is complete and the user selected **Apply and activate** for both
named development projects. DB execution/rollback-only checks/guarded producer
activation are authorized and in progress; native worker readiness checks health
without claiming records. The producer remains off until final verification.
See [contract, approvals, validation and recovery](audit-service-view-execution.md).
Local owner work is authorized; prepare the exact new database extension before
seeking any missing connected execution approval. No wider business audit rollout.

## TASK-014 — Unblock dependent frontend/backend work

**Completed for prototype development, 23 October 2026:** Assigned DB executor
finished the twelve-event connected rehearsal, retained P1 outcomes/evidence,
revoked test login/schema/helper access and verified both final active profiles.
Protected capture/worker configuration is enabled; the final bounded worker run
was healthy with zero backlog/failure counters. No daemon, application HTTP
server or production deployment remains. See the
[completion acceptance and limits](audit-completion-execution.md).
TASK-015 remote Auth and broader producer coverage, TASK-025 consent auditing
and TASK-026 release/privacy work remain separate. Earlier dependency stages
below are historical; the TASK-014 permission/cutover dependency is resolved.

**Completion work resumed:** The user approved all actions required to complete
TASK-014 in the audit thread. Reachable DB and Backend owners resumed under the
[completion scope](audit-completion-execution.md), including necessary private
provisioning, connected development rehearsal, integration and activation after
verification. This supersedes old missing-permission statements for those phases;
secret safety, cohort bounds, failure reconciliation and deployment holds remain.
The completed local TASK-026 package below is delivered to the audit owners for
compatibility review as an application-cutover dependency. Completion is pending
actual acceptance evidence, not another repetition of covered phase approvals.

### TASK-026 local location/runtime extension

**Audit integration accepted:** The audit thread received this completed local
package during TASK-014 completion. Its DB and Backend owners are reviewing the
new opt-in profile as the existing seventeen-table application's restricted-
credential cutover dependency. The audit user's later all-required-actions
approval covers necessary reviewed development compatibility operations; the
earlier local-only A approval below remains historical and is not independently
treated as connected permission. Apply any accepted source dependency before
owner-credential relocation/LOGIN, preserve all applied audit SQL, and record
actual execution in the [completion record](audit-completion-execution.md).
TASK-025 consent/audit and location release/privacy work remain separate.

**Audit completion dependency applied:** Assigned audit DB owner executed the
reviewed 0009 source-only migration once under the later TASK-014 completion
authorization. COMMIT/receipt and seventeen-table metadata verification passed;
all runtime accounts remained NOLOGIN. DB reviewed the actual deparsed CHECK;
no user/location rows were inserted. Hash
`fcd68625be336928dc992354d2b0ef8e96bce416022c7eb34e673fcc98302838`
is now applied/immutable. Original audit SQL is unchanged; follow-up verification
uses the explicit seventeen-table profile. Earlier local-only preparation and
not-delivered statements below are preserved historical records.

**Local package completed; audit-owner integration requested, 23 October 2026:**
User selected next-step A in the
TASK-026 chat: coordinated local location privileges and runtime compatibility.
Requester/executor: that chat's Codex `/root`, specifically approved for this
local package. The audit owners listed below are not in this thread's live roster;
this entry is a durable cross-session request/return, not claimed delivery.

Ownership isolation: preserve the committed destination migration, pending
sixteen-table source migration/continuation, existing pinned digests and their
verifiers. Prepare the unapplied `migrations/0009_user_search_locations.sql`
and new opt-in location extension/helper/tests instead of rewriting the active
audit package. Supported order: separately approved/verified sixteen-table source
runtime first; location migration second; explicit seventeen-table verification
afterward. Location-first is rejected, not silently accepted by the old executor.

Contract: revoke inherited `service_role` access as well as PUBLIC/browser access;
grant only SELECT/INSERT/UPDATE/DELETE to `fm_app_runtime`, with the existing
server-only policy model. Keep all runtime accounts NOLOGIN; no new sequence,
audit payload, role memberships or future-object privileges. TASK-025 stays open.
Validation: offline manifest/digest consistency, privilege/profile boundaries,
order/collision/failure handling and owner-predicate regression. Recovery: revert
only this new package's edits; retain all applied SQL and other sessions' work.
No connected access, private configuration, writes, fixtures, activation or
deployment is authorized by this A selection.

**Return:** [coordinated package and exact hashes](search-location-database-package.md)
is prepared, with 155 new offline checks, 242 existing installer checks, 243 audit
checks and mocked owner-scoped API/store regression passing. Existing sixteen-table
SQL/pins are unchanged; the new opt-in profile preserves their restrictive checks
and extends only location access. No private reads or connected DB execution
occurred in this preparation. Next owner action: audit DB/Backend review the
separate profile and consume it after the verified source foundation when location
execution is separately approved. This thread cannot deliver to those owners;
the durable return remains queued, not acknowledged by another session.

**Delivered and accepted in the audit thread, 23 October 2026:** This thread's
`/root` read the request and contacted the reachable assigned owners
`/root/audit_database` and `/root/audit_backend`. Both accepted the scoped
dependency. This updates delivery/acceptance for these actual agents; it does
not establish contact with an independent Front End Developer session. Root owns
this queue/status update, DB owns SQL/helpers/execution evidence, Backend owns
application capture-contract evidence and peer review.

**Reconciliation evidence:** Reviewed bounded destination-only catalog inspection
completed read-only. Extra ACLs are PUBLIC SELECT on exactly
`extensions.pg_stat_statements` and `extensions.pg_stat_statements_info`, owned
and granted by `postgres`; writer schema USAGE is false and no grant option is
present. All 51 column SELECT observations derive from these table-level grants;
no separate column ACL or other relation rights were found. Writer NOLOGIN and
restricted-role checks passed again. Applied destination SQL is preserved; source
has not been attempted. Owners accepted a routine verifier correction under
standing authorization: pin only these two existing PUBLIC SELECT grants while
their schemas remain unusable, preserve all other checks, and report the latent
ACLs explicitly. This changes no database grants or selected usable-access
boundary. DB prepared the correction and source-only continuation; Backend
independently passed 186 continuation and 242 affected installer checks and
reviewed SQL. Root reviewed code/tests and released the same-target first source
attempt under the existing exact source-operation approval. This re-verifies
destination read-only and checks source freshly; no destination reapply, generic
extension exclusion, new privilege grants or schema-USAGE grant is allowed.
Static SQL review is distinct from unperformed live mutated-object tests.
Continuation then freshly verified destination and source gates, and source
runtime-0003 committed. Source postflight still rejects unreviewed relation/
column and extra sequence ACLs; intended grants, NOLOGIN restrictions, policies,
entrypoints and no-grant-option checks pass. Both migrations are committed;
neither will be reapplied. Reviewed source catalog reconciliation identified
PUBLIC grants by `supabase_admin` on exactly `cron.job` (SELECT),
`cron.job_run_details` (SELECT, DELETE), `cron.jobid_seq` and `cron.runid_seq`
(SELECT); every new source role has cron schema USAGE false, with no grant
options or applicable column ACLs. DB/Backend accepted an exact-object dormant-
ACL classifier correction and are preparing read-only final verification,
without privilege repair, more migration writes or activation. See the
[runtime handoff](audit-runtime-execution.md) for commands and actual evidence.

**Runtime-install stage completed:** Final reviewed read-only
`verify-runtime-disabled.mjs` exited 0 on both projects. Both runtime migrations
are committed and catalog-verified; all new roles remain NOLOGIN/passwordless.
Installed-state source policy checks were corrected and independently tested
(264 continuation / 246 installer checks), retaining rejection of restrictive
policies and the exact sixteen-policy contract. Fresh catalog verification and
historical receipt/COMMIT evidence are reported separately. No grant repair,
reapply, credentials, fixtures or activation. TASK-014 and the broader runtime
dependency remain open for secure private provisioning/logging safety, connected
delivery rehearsals and application activation gates. This supersedes earlier
in-progress reconciliation statements above, preserving their history.

**Backend contract returned:** The
[accepted dependency and frontend contract](audit-backend-handoff.md#accepted-cross-role-dependency-and-frontend-contract--23-october-2026)
documents normal domain API use, server-derived identity, internal transactional
enqueue, failure/outage semantics and offline/live verification limits. Frontend
may continue isolated UI and mocked API work. There is no generic browser audit
endpoint or browser DB credential. TASK-025 permission/consent names and intake
are not implemented; Backend accepted that separate local contract dependency
without claiming production capture. No reachable Front End Developer agent is
exposed in this audit thread, so this queue is the durable return to that owner;
delivery to an independent frontend session is not claimed.

The original request/snapshot follows for provenance; its unknown-delivery
statement is superseded by the actual delivery record above.

**Requested, 23 October 2026.** Requester: user, recorded by `/root` during
coordination-rule maintenance. Receiving owners: assigned Back End Developer and
DB Analyst/Developer for TASK-014; recorded executor IDs are `/root/audit_backend`
and `/root/audit_database`. Their current live status/reachability is unknown;
neither appears in this thread's roster. This request has not been delivered to
those independent sessions and is not owner acceptance or an execution result.

**Need:** the user reports Frontend waiting for TASK-014. Audit capture/delivery
is also a recorded dependency of TASK-025's location-permission audit. Return
the usable capture contract, remaining activation gates and verification evidence
to the requesting Front End Developer; do not treat unrelated frontend work as
blocked. Backend owns the application contract/tests; DB owns runtime SQL,
installation/catalog checks and execution evidence. Coordinate shared files first.

**Scope and approval lookup:** [TASK-014](../TASKS.md#audit),
[runtime execution handoff](audit-runtime-execution.md),
[Backend handoff](audit-backend-handoff.md), and
[selected runtime proposal](audit-runtime-proposal.md). The user's Choice 1,
named-target metadata approval, ACL approval and disabled-runtime installation
approval are recorded in TASKS.md. Reuse covered permissions rather than asking
for them again. New local owner-accepted dependency work follows the 23 October
standing authorization. Existing connected permissions remain limited to their
recorded executors, operations and development targets: source
`hbkooiknruimukkhshrk`, destination `ynygqodmtgjrngiudalw`.

**Latest recorded execution result:** destination runtime-0003 committed, then
post-install verification failed on extra relation/column privilege checks.
Source migration was not attempted. Writer restrictions, memberships/caps,
no ownership/permanent DDL, expected audit entrypoints and six no-grant-option
checks passed. This is an unresolved verification failure, not simply missing
permission to start TASK-014. Check the owner's latest evidence before resuming;
this entry is a snapshot, not a fresh database observation.

**Next owner action:** accept this dependency, reconcile the failing verifier
against exact object/grant provenance using the already-reviewed, authorized
read-only checks, and coordinate Backend's contract/security review. If a local
verifier correction is warranted, the owning role may implement and offline-test
it under standing authorization. Return the finding and exact next allowed step.
If correction needs new catalog access, grant repair or changed SQL, finish a
reviewable plan and obtain only the missing connected-operation scope.

**Limits/recovery:** preserve the committed disabled destination objects and
evidence; the recorded stop prohibits reapply, grant repair or source writes.
No automatic retry, credential provisioning, rehearsal, location change, app
cutover, activation or deployment follows from this request. Existing rollback/
close and preserve-on-failure instructions remain. Revert only attributable local
instruction/code changes when appropriate, preserving other sessions' work.

**Completion evidence:** owner review of the failure, passing meaningful offline
checks for corrections, and scoped live verification where authorized. Report
prepared/applied/verified/active states separately. TASK-014 stays open until its
required delivery/runtime evidence passes. Frontend can continue isolated UI and
mocked-contract work while the runtime dependency is unresolved. Test languages
remain en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred.
