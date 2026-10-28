# Team invitation email diagnostic — 27 October 2026

Requester/coordinator: `/root`; accepting assigned Back End Developer/executor:
`/root/team_invitation_backend`. Accepted read-only review and scoped reversible
local diagnostic remediation under [AGENTS.md standing cooperation](../AGENTS.md).
Origin and user clarification: [coordination queue](agent-coordination.md).
No private configuration/credentials, connected account/log/database inspection,
email sending/resending, application startup, provider configuration, deployment
or publishing is covered or performed. Existing pending-invitation editor is
preserved.

## Findings and accepted local contract

The existing invitation creation transaction commits before
`supabaseAdmin.auth.admin.inviteUserByEmail`. Returned provider errors currently
produce `emailSent:false` and the share-link fallback without a diagnostic;
unexpected thrown errors produce a generic 500 after the invitation already
exists. Therefore a failure response is not safe evidence that creation rolled
back, and repeating creation is not a mail delivery repair.

Proposed to root before implementation and explicitly accepted by root: preserve
the response fields and keep
provider diagnostics server-only. Attempt the existing Auth invitation call once;
classify returned/thrown failures using bounded allowlisted reason/code/status,
never raw messages, email addresses, tokens or keys. Preserve 201/share-link
fallback for the already-created invitation even if the mail adapter throws.
No transport, resend, account lookup, membership or template changes. No new
global account-existence information is returned to the workspace manager.

Status: implemented; scoped pure and actual-handler offline tests pass. Root
owns integrated TypeScript verification after this source-finished handoff.
Actual delivery root cause is unverified because neither project SMTP settings,
provider logs nor recipient account status have been inspected.

`server/invitationEmail.ts` exports a pure bounded classifier and a one-shot
adapter wrapper used by the existing POST route. Failure diagnostics contain
only the fixed event `company_invitation_email_failed`, allowlisted provider code
or `other`, allowlisted reason (`recipient_restricted`, `rate_limited`,
`existing_account`, `provider_error`) and integer HTTP status 400–599 or null.
They go to the server warning stream only. Successful send requests do not log
failure; `sendEmail:false` does not call the adapter. Failure of diagnostic logging
also preserves the already-created invitation's fallback. No automatic retry or
additional provider lookup occurs. `emailSent:true` means the provider accepted
the request, not verified delivery to the recipient's inbox.

Files owned by this dependency: `server/invitationEmail.ts`, the POST mail section
of `server/companyRoutes.ts`, `scripts/test-team-invitation-email.mjs`, expanded
hermetic route harness `scripts/test-team-invitation-update.mjs`, and this handoff.
Root separately owns SMTP setup guidance and coordination records.

## Offline verification and recovery

Passed on Node v24.21.0:

```text
node --import tsx scripts/test-team-invitation-email.mjs
Passed 35 pure invitation email diagnostic cases

node scripts/test-team-invitation-update.mjs
Passed 43 offline pending-invitation handler cases
Passed 13 offline invitation creation/email cases

node --check scripts/test-team-invitation-update.mjs
git diff --check -- server/companyRoutes.ts
```

The pure helper imports no application configuration or adapters. Cases cover
allowlisted and malformed error codes/statuses, private-field redaction,
returned/thrown failures, logger failure and exact single-attempt behavior.
The hermetic real-handler harness replaces DB/query/schema/Auth/mail boundaries
before runtime evaluation, verifies committed state before send, preserves the
201 response schema/manual link after returned/thrown provider errors, prevents
mail attempts after transaction failure, avoids mail when disabled, preserves
memberships and prevents private diagnostic text from reaching response or logs.
The previous 43 pending-edit cases remain passing after the route import change.
These checks prove no actual inbox delivery, real SMTP settings, Auth state, SQL,
database concurrency or live integration. No connected send/test/retry occurred.

Recovery: revert this helper/import and attributable POST mail-wrapper lines to
the previous direct call if necessary, preserving the pending-invitation PATCH
and unrelated work. No connected data or configuration recovery is required.
Root records full TypeScript results, returns the safe diagnostic instructions
and awaits the user's project SMTP/account context before selecting any
connected configuration action. Restarting the existing non-watching local
server is a user action; agents have not started or stopped it.

## Supported causes and setup boundary

Supabase's default SMTP service sends only to the project's organization team
addresses and is currently limited to two messages per hour. Normal employee
delivery needs custom SMTP. Configure the selected provider's host, port,
username/password, sender email and sender name in the project's Auth SMTP
settings, then review the Auth email rate limits. These are Supabase Auth
project settings, separate from the application's Stripe environment files.
Provider/domain verification follows the chosen mail service's requirements.
See [Supabase custom SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

An existing confirmed Auth account can also reject Auth signup invitation mail;
that person can still use the preserved workspace invitation with their existing
verified login. See [Supabase users/invites](https://supabase.com/docs/guides/auth/users).
The safe diagnostic codes considered are `email_address_not_authorized`,
`over_email_send_rate_limit`, `email_exists` and `user_already_exists`; other errors
need the bounded generic category, not parsing private message text. See
[Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).

The exact provider, project and authorized configuration executor must be recorded
before any connected SMTP change. No organization membership/privilege expansion,
automatic retries, unsolicited recipient tests or provider provisioning is part
of this diagnostic. Existing invitation links remain usable subject to normal
verified-email/expiry/acceptance checks; do not assume mail delivery from HTTP 201
or even provider acceptance.

Language-sensitive checks, if needed, remain en/lv/ru only; ar/RTL, zh, fr, de,
hi, ja, pt and es are deferred. No new language coverage is claimed.
