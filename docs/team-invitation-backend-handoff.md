# Pending team invitation access editing — backend handoff

Date: 27 October 2026. Status: implemented and scoped offline tests passed;
integrated TypeScript verification is owned by root after frontend completion.

## Assignment and acceptance

Requester/coordinator: `/root`; accepting assigned Back End Developer/executor:
`/root/team_invitation_backend`; frontend contract owner:
`/root/team_member_frontend`. Dependency accepted under the user-selected separate
employee login model and [AGENTS.md standing cooperation](../AGENTS.md).
Origin and integrated acceptance records: [coordination queue](agent-coordination.md)
and [frontend handoff](team-member-update-handoff.md).

Authorized scope is reversible local `server/companyRoutes.ts`, the isolated
backend regression script, and this handoff. No database/ORM/schema/configuration
files, private environment files, connected services, application startup,
database execution, email sending, deployment or publishing were authorized or
performed. Preserve all unrelated existing work. This acceptance grants no
connected-operation authorization.

## Contract and implementation

`PATCH /api/company/invitations/:id` accepts
`{ role: "admin" | "provider" | "viewer", employeeId: number | null }` and returns
`{ success: true }`. The UUID identifies the pending invitation, independently
of member login IDs. Provider/viewer need a positive integer employee ID; admin
can be unassigned (omitted employee defaults to null, consistent with creation).
Only parsed role/employeeId fields are writable; unknown payload fields are
stripped. Email, company, token hash, inviter, expiry and lifecycle fields remain
unchanged. There is no email resend, membership insert/update, automatic
acceptance, session write or invitation token replacement.

The existing authenticated route guard and actual workspace scope check apply.
Inside a transaction the handler locks the company first, rechecks the actor's
current manager membership and company active status, then locks the invitation
scoped to that company. This matches existing manager/acceptance lock ordering.
Accepted, revoked, expired and exact-expiry invitations are rejected. The original
inviter must still manage the company so an unusable invitation cannot report a
successful edit. Employee assignment must belong to this company and be free of
accepted logins and other live pending invitations. The same invitation may keep
its own current employee. A scoped guarded update checks lifecycle/expiry again
and requires a returned row before acknowledging success.

Responses: 400 invalid UUID/body/employee/company selection; 401 unauthenticated;
403 unavailable manager privilege/inactive company; 404 missing or other-company
invitation; 409 assignment/pending-invitation conflict; 410 unusable lifecycle,
expired invite, original inviter lost management, or zero affected rows; 500
unexpected adapter failure with generic message. Existing creation, member edits,
revocation and verified acceptance behavior remain unchanged. Frontend owner
confirmed this contract directly before implementation.

## Verification and limits

Passed on Node v24.21.0:

```text
node scripts/test-team-invitation-update.mjs
Passed 43 offline pending-invitation handler cases
```

The harness bundles real route, scope, manager, assignment and error decisions,
replacing DB/query/schema, verified-identity and email boundaries before runtime
evaluation. A require allowlist prevents private runtime imports. A frozen clock
and transactional in-memory state test Santa's own role/employee save, unchanged
Juris/all memberships and invitation identity, no email, admin/viewer assignment,
own-invitation assignment exclusion, stripped privileged payload fields, denied
authentication/workspace/current-manager access, inactive companies, malformed
inputs, foreign/missing employees and invitations, accepted-member/pending
conflicts, accepted/revoked/exactly expired invitations, stale inviter, guarded
zero-row failure, adapter failure rollback and safe error responses.

The script has no locale matrix; no deferred-language checks were run. ar/RTL,
zh, fr, de, hi, ja, pt and es remain deferred. No live
`scripts/test-company-teams.mjs`, real Auth/database/email/Stripe tests, app server
start/stop, live UI writes or deployment occurred. Mocks do not prove actual SQL,
database locks/races, RLS, provider identity verification or running-server
integration. Integrated `npm run check` is delegated to root, avoiding duplicate
checks while frontend implementation is in progress.

## Recovery and next action

Root integrates the frontend editor, records integrated checks, and asks the user
to restart their existing local server command if it does not watch backend
changes. User then refreshes and edits Santa on Santa's pending-invitation card;
normal verified invitation acceptance still creates her separate membership.
Local recovery is removing this new PATCH registration and its `ne` import plus
its targeted test/handoff, preserving unrelated work. No data recovery is needed
because agents performed no connected writes.
