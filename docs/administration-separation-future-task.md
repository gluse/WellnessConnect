# TASK-029 — Separate platform administration

Recorded 27 October 2026, Europe/Riga, from the user's security/architecture
discussion and explicit request to save it as future work. Linked from
[TASKS.md](../TASKS.md#security).

## Status and authorization

**Deferred; not started.** The user intends to return to this later. Current
authorization is to record the task only. No implementation, owner assignment,
service/database access, configuration changes or deployment is started by this
record. Follow [project authority and existing approvals](../AGENTS.md) when
resuming; preserve all existing execution and deployment holds.

## Problem and recommendation

Move platform-wide staff administration to a separately protected web app.
Keep customer company/workspace administration in the customer application.
The intended benefit is isolation of privileged activity from the public app's
browser context, sessions and backend runtime. Another URL or frontend alone
provides only part of that protection; server authorization remains essential.

Read-only source observations from the discussion, not a production audit:

- [Admin middleware](../server/appAdmin.ts) checks a server-configured user-ID
  allowlist independently of company roles. User-directory, category and
  subscription administration have server-side gates.
- [Administration](../client/src/pages/administration.tsx) is part of the public
  React application and shares the Express runtime and
  [customer session mechanism](../server/auth.ts).
- The inspected admin middleware does not itself require MFA or recent
  authentication. Effective identity-provider/deployment policy was not verified.
- Administration handles registered-user information, manual subscription
  entitlements and pricing configuration, making stronger isolation worthwhile.

A public-app XSS vulnerability could issue privileged requests while a staff
member is signed in there. HttpOnly cookies prevent direct cookie reads but do
not prevent malicious page scripts making authenticated requests. Independent
origins and admin sessions reduce this exposure. A public-backend compromise
still threatens shared data if that runtime retains broad credentials.

## Proposed architecture and stages

1. Strengthen existing administration first: staff MFA, preferably passkeys or
   security keys; server-enforced admin idle/absolute timeouts; recent
   authentication for sensitive changes; scoped permissions and audit coverage.
2. Extract the staff frontend to a separate origin, such as `admin.<domain>`,
   with a staff access gateway. Establish independent host-only admin cookies
   and sessions; customer login alone must not authorize administration. Preserve
   strict CSRF/origin controls; sibling subdomains must not be trusted implicitly.
3. Run the admin backend separately and remove privileged admin routes from
   public ingress. Give public and admin runtimes distinct, least-privilege
   credentials and service/database permissions. Do not expose service secrets
   to either browser frontend.
4. Share domain rules, validation and contracts within the repository to avoid
   divergent subscription/pricing behavior. A separate repository or database
   is not inherently required. Preserve billing, entitlement and audit invariants.
5. Prepare, validate and execute an explicitly authorized migration/rollout with
   monitoring, access revocation, incident procedures and recovery.

Separate support-directory, category, subscription-grant and pricing permissions
where appropriate. Record actor, target, safe changes, result and reason for
sensitive operations, integrating with the existing audit work rather than
creating a parallel audit mechanism. Coordinate the
[TASK-018 audit viewer](../TASKS.md#audit) and
[TASK-024 billing decisions](monthly-subscription-decisions.md).

## Tradeoffs and decisions when resumed

Separate applications add deployment, monitoring, authentication configuration,
testing and configuration-drift costs. Shared databases, identity providers,
dependencies and delivery infrastructure remain common risk boundaries.

Before implementation, refresh the source inventory and threat model, then agree
the concrete origin/hosting, staff identity/MFA/access-gateway approach, session
and revocation policy, permission model, runtime credential boundaries, release
sequence and operational cost. These recommendations are not recorded as final
user selections of vendors, topology or security policy.

Frontend, Backend, CI/CD and DB owners must accept their respective scopes when
assigned. Connected execution requires the exact existing or newly authorized
target/operation scope; possession of local configuration is not authorization.

## Acceptance and verification when implemented

- Customer/company roles and sessions cannot grant platform administration;
  denied, expired, revoked and missing-MFA cases fail closed at the server.
- Admin sessions remain isolated from the public origin. Verify cookie scope,
  CORS/CSRF, session expiry, recent-authentication and logout/revocation behavior.
- Privileged routes are unavailable through public ingress, and the public
  runtime cannot exercise admin-only service/database capabilities. Verify actual
  credential permissions, not only route checks.
- Each staff permission has allowed/denied operation tests; sensitive access,
  changes and failures produce protected, redacted audit evidence.
- Existing support, category, manual-grant and immutable billing-offer behavior
  remains correct. Shared rules do not diverge across applications.
- Owners complete meaningful offline/mocked security and regression checks,
  then separately authorized connected acceptance. Frontend language checks cover
  only en/lv/ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
- Document deployment, monitoring and recovery. Rollback must preserve financial
  and audit evidence and must not silently restore weaker admin access; keep
  administration unavailable if safe recovery requires it.

No application tests or live checks were run for this backlog-only record.
Recovery now is to revise/remove only this brief and its TASK-029 entry.

## Guidance retained from the discussion

- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  deny by default and validate permissions on every request.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html):
  cookie scope, separation of applications with differing security levels,
  privilege transitions and server-enforced session expiry.
- [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html):
  MFA and reauthentication for sensitive activity.

Recheck guidance and actual application/deployment behavior when resuming.
