# Service view statistics report — 7 November 2026

Status: completed locally, 8 November 2026; offline verification passed. Not deployed.

Resumed 8 November 2026 at the user's request. The earlier workers were no longer
reachable in the live agent inventory. Root assigned replacement owners
`/root/service_views_frontend_finish` (Front End Developer) and
`/root/service_views_backend_finish` (Back End Developer) under the same local
scope and limits below; both accepted. They reuse the existing implementation
and completed DB review rather than starting duplicate work. Frontend owns the
remaining translations, UI/capture checks and handoff; Backend owns the new
report's case/trailing-slash audit matcher, regression checks and handoff.

The user requested per-service view counts for a selected period, with the report
listed for all users and execution restricted to Pro. Root routes accepted local
work under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization):

- Frontend `/root/provider_duration_frontend`: report discovery, Pro lock and
  available/error states, date/employee scope, list/graph and numeric exports;
  [owner handoff](service-view-statistics-frontend-handoff.md).
- Backend `/root/service_views_backend`: authenticated report/capability contract,
  server Pro enforcement, workspace/employee restrictions and aggregate-only API;
  [owner handoff](service-view-statistics-backend-handoff.md).
- DB `/root/service_views_database_review`: existing source/retention/query review
  without connected access; [review](service-view-statistics-db-review.md).
- Root: integration, coordination and final acceptance review.

The existing product activity source records explicit service details opens and
retains events for 90 days, using UTC reporting dates. It excludes identifiable
provider/team activity; repeat opens count. Capture start/interruptions and human
identity cannot be inferred from retained events. Reuse that approved policy and
report recorded events truthfully; do not expand retention, tracking identifiers
or expose visitor identities. Source-event counts avoid worker lag/current-day
omissions. Schema changes are not expected; DB owner reviews the chosen query.

The report appears for Free and Pro users of the existing Reports area. This does
not add anonymous/customer navigation or broaden workspace/employee access.
Pro authorization must run on the server before statistics queries, including
direct API calls. Runtime capture disabled/unavailable must remain explicit,
never be presented as complete zero traffic. Existing runtime activation holds
remain in effect.

Scope: reversible repository changes and synthetic/offline checks only. No
connected database/service access or writes, private configuration/credentials,
deployment, publishing or spending. Any later exact-target connected operation
needs its existing or new scoped authorization. Preserve unrelated audit work,
prior reports, Pro rules, existing money calculations and historical evidence.

Test only en/lv/ru. ar (including RTL), zh, fr, de, hi, ja, pt and es remain
deferred; supported translations are maintained.

Recovery: revert only this report's local additions and scoped integration hunks.
No database/configuration/deployment recovery is anticipated because none is
authorized or performed.

## Integrated review, 8 November 2026

Backend completion is accepted. Root reviewed the shared DTO, service gate,
compiled-query design, route registration, protected-read integration and actual
Express regression coverage. The statistics endpoint rechecks workspace Pro
before querying counts; Free/expired access cannot retrieve statistics through
direct requests. Current workspace/membership/employee predicates remain server
controlled. The capability endpoint exposes availability without running counts.

The new report's audit mapping now matches Express's case-insensitive paths and
optional trailing slash. Four actual in-process route variants require durable
capture and return 503 without service names/counts if it fails. This correction
is limited to the new mapping and preserves unrelated audit work. Backend tests,
the final backend TypeScript check and scoped whitespace checks passed; details
are in the linked backend handoff. The previously completed DB query review is
unchanged, and no SQL/schema/permission change followed it.

Frontend completion is accepted. The report is selectable for Free/Pro users,
with explicit Pro execution, UTC dates, company employee filters, exact totals,
zero-view services, List/Graph and CSV/XLSX/PDF exports. Scope keys and abort/
generation guards prevent old workspace responses from entering new results;
expiry, denial, capability failure and revocation suppress counts. A final timer
correction prevents repeated zero-delay capability checks after expiry.

Frontend helper/export tests and Chrome browser checks passed in en/lv/ru at
320/390/768/1280, covering access, periods, filters, list/graph/exact data,
downloads and stale responses. Focused final timer/revocation/capability-error
regressions passed after the correction. Existing report, graph, storefront and
duration regressions passed. Final TypeScript and the isolated frontend build
passed (3656 modules); existing bundle-size/Browserslist warnings remain. Root
reviewed the actual component/helper/fixture behavior and screenshots of Free
mobile, filtered mobile/desktop and long-name/all-service mobile Graph. Controls,
counts and zero-view services remain readable without page overflow. See the
frontend handoff for commands, artifacts and precise coverage limits.

Public storefront explicit details opens now reuse existing product capture;
rendering, preview, booking and sign-in booking return do not create a view.
Recognizable provider/team exclusions remain in the existing server policy.
No source retention, identifiers, schema, permissions, private configuration,
connected operations or deployment changed. Actual runtime capture availability,
live counts and query plans were not verified. If capture is disabled/unavailable,
the report says so rather than presenting successful zero traffic.

All authorized local work is complete. A later release or connected verification
is a separate exact-target operation under existing project authority. Other
supported languages, RTL, physical devices, screen readers and additional browser
engines have no fresh coverage from this task; the language deferrals above stand.
