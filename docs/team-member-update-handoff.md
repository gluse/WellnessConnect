# Team member update — 27 October 2026

State: local frontend implementation completed and returned to root for
integration. The user requested visible frontend changes after guidance did not
resolve discoverability. Actual component and translation changes now exist;
see [latest pending invitation editing](#pending-invitation-editing--completed-extension).
Earlier diagnostic/guidance-only phases below are explicitly historical, not the
current implementation status. No deployment/live execution is claimed.
Requester/coordinator: `/root`; assigned Front End
Developer/executor: `/root/team_member_frontend`. Approval: user's team update
bug report, explicit owner assignment and AGENTS standing cooperation. The
accidentally referenced artifact-template skill is withdrawn and unused.

## Historical diagnostic scope

Accepted scope: read the team component/API contract; reproduce successful
member PATCH followed by team GET through the real frontend component using
synthetic, mocked APIs; make only an evidence-supported minimal local frontend
fix and regression if a defect is reproduced. Own `company-team.tsx`, a new narrow
fixture/test, and this handoff; root owns TASKS/coordination. Preserve unrelated
dirty work. No backend/schema/ORM edits or connected operation authority.

Limits: no private environment/configuration/credentials, real browser/user
session, live API/DB/Auth/Stripe/email, connected application startup, deployment
or external messages. Static isolated fixture startup is allowed. Test only en,
lv and ru; ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. Do not run the
live `scripts/test-company-teams.mjs` runner.

Contract under investigation: PATCH `/api/company/members/:userId` edits one
existing login membership (role and linked employee); POST
`/api/company/invitations` invites another login. An employee profile alone does
not add a login membership. The component currently awaits broad workspace
invalidation (including the team query) and mirrors fetched member fields into
the member editor. No runtime defect has yet been reproduced. The user's
follow-up GET/no-GET observation remains unknown.

Recovery: undo only new attributable diagnostic files or a subsequently proven
fix; leave existing invitations, memberships and unrelated work intact.

## Historical diagnostic result and evidence

No frontend defect was reproduced, and no application code was changed. Added
[`team-member-update.tsx`](../scripts/fixtures/team-member-update.tsx) and
[`test-team-member-update-browser.mjs`](../scripts/test-team-member-update-browser.mjs)
to exercise the real `CompanyTeam`, its real TanStack Query client, real member
editor and actual en/lv/ru translation resources. Fetch alone is replaced by a
synthetic in-memory API. This is evidence about the client contract, not proof
of real backend persistence or security authorization.

`node scripts/test-team-member-update-browser.mjs` passed in Chrome
155.0.8059.85 for en, lv and ru. Per-language assertions cover:

- Exact role/employee PATCH payload and request order: initial team GET, member
  PATCH, follow-up team GET. The mock PATCH returns only `{success:true}`, matching
  the actual API acknowledgement.
- Controls remain disabled until held GET completes. Successful saves retain
  fetched role and employee association.
- A subsequent authoritative GET returns viewer/employee13, differing from both
  previous provider/employee12 props and submitted admin/employee11 draft. The
  editor follows the returned fields; a remounted component uses the same fetched
  fields. This explicitly verifies synchronization beyond draft retention.
- Two PATCH requests to the same member UUID reassign that login; member count
  remains unchanged. A rejected 403 produces error feedback, preserves the draft,
  leaves the mock server value unchanged and does not claim a successful refresh.
- Two sequential invitations for distinct available employees post distinct
  employee IDs/emails successfully. Neither adds an accepted login before
  invitation acceptance.

No unexpected/mock API calls, external requests, browser errors or HTTP writes
reached the isolated static fixture server. Chrome's first sandboxed startup
failed in Crashpad before tests ran; the same scoped command passed using the
approved escalation path with a fresh temporary browser profile. There was no
automatic approval rejection. Existing browser harness source was reused without
changes; no connected Express server was started.

`node --check scripts/test-team-member-update-browser.mjs` passed. Scoped
TypeScript `createProgram` using the repository options, only the new TSX fixture
as root, ES2022 target (matching the harness's modern ESM/top-level-await build),
noEmit and no incremental cache produced zero diagnostics. The first attempt
without a target override flagged only fixture top-level await because the root
config omits target; correcting the scoped verification target resolved it. No
full application build/check or broad language suite was run because application
code is unchanged. Existing component diff/whitespace checks are clean.

Limitations/next action: the actual failing browser's follow-up
`GET /api/company/team` is still unknown. Root should obtain whether this GET
occurs and whether this member's returned `role`/`employeeId` are old or updated,
along with the submitted PATCH fields and which displayed values fail to change.
Avoid collecting unrelated member personal data or private tokens. If GET is
absent despite this regression, investigate the running browser bundle/query
lifecycle; if GET returns old values, route backend persistence/target-workspace
inspection to Backend/DB under their execution limits. If GET returns new values
while the same member editor stays old, capture that runtime mismatch for the
Frontend owner. The root owner must review the integrated evidence before closing
the user-reported bug. Other locales/RTL, real services, other browsers, physical
devices and live acceptance remain unverified; no deployment or security audit
is claimed.

## Historical user clarification and read-only UX assessment

The user subsequently stated: "First selected Service Provider is overwritten
with new employeeId instead of adding another entry." This matches the confirmed
contract and existing regression: saving another employee on the same member
UUID changes that account's assignment. It does not add another member. The
earlier missing GET observation above remains historical; that observation is
not needed to explain the now-clarified overwrite. No persistence defect is
established by this clarification.

Root resumed this owner for read-only assessment only. No application/locale
changes, new tests or connected actions were performed. The user then selected
**separate login for each employee**. The existing contract supports that choice;
no schema/API change is required or authorized by this guidance-only resolution.

Existing visible wording is ambiguous: member cards show a name/email, two
selectors and "Save access"; the employee selector has an accessible name but no
visible field label. The same `assignmentHelp` text appears in both member
editing and invitation creation: "Add an employee in Provider profile first.
Providers and read-only members need an assignment." This explains assignment
prerequisites but never says a new selection replaces the current assignment.
"Invite a team member" / "Create invitation" are correctly separate actions.
Reviewed en/lv/ru text only; no new broader locale coverage is claimed.

Guidance for the existing separate-account flow:

1. Restore the first member's original employee in their existing card and use
   "Save access" if that reassignment was unintended.
2. In "Invite a team member", enter the second person's own email, choose
   "Service provider", choose that person's employee profile, and use
   "Create invitation". Repeat for other people using their respective emails.
3. Share the generated link with its intended recipient (or use the invitation
   email). The recipient signs in or creates an account with that invited email,
   verifies it and sets a password if prompted, then selects "Accept Invitation".
   The server requires the invited verified email and inserts the new member
   only at acceptance; before that, it appears as a pending invitation. Opening
   the link while still signed in as the owner cannot accept another email's
   invitation. These are source-reviewed flow requirements, not live execution.

Optional future UX proposal (not implemented): keep the existing
single-assignment contract and split the shared help into member-edit help and
invitation help. Beside the existing member selectors, say: "Changing the
employee replaces this member's current assignment. To add another person,
use Invite a team member below." In the invite form, say: "Enter the person's
email and choose their employee profile. They will appear in Team access after
accepting the invitation." This needs only component help-key selection and
translations, with scoped interaction/content regression; no API/schema change.
Changing section titles, adding confirmations or redesigning membership is
unnecessary for this minimal clarification. Root would route any separately
accepted implementation scope. Current resolution is the existing invitation
flow above; the prior mocked tests already establish this contract, so no
additional tests are needed for this documentation-only clarification.

## Accepted frontend implementation

Root resumed `/root/team_member_frontend` as assigned Front End Developer under
the user's follow-up request and AGENTS standing cooperation. Scope: actual local
`CompanyTeam` changes, related supported translations, narrow synthetic fixture
and regression, this handoff. Root owns queue/task records. Desired behavior:
discoverable add-another-login action; combined list with distinct member
and pending invitation states/employee; explicit reassignment guidance; invitation
reset and assigned/pending employee filtering. Preserve separate accounts and
acceptance/authorization contracts. No automatic membership, backend/schema/API
change, connected operation, private config, real email, deployment or broader
authority. Preserve existing dirty locale resources with targeted new keys.
Test only en/lv/ru; deferred languages/RTL remain deferred despite maintaining
their translations. Validation: real-component mocked regression, phone/desktop,
affected keyboard flow, scoped fixture typing, root integrated TypeScript check.
Recovery: undo only attributable component changes/new message keys/fixture/test
and this phase's evidence; retain existing dirty work and earlier evidence.

## Completed implementation and verification

This section records the earlier add-login clarification phase. The pending
invitation editor and final expanded verification are recorded in the extension
below; that extension supersedes this phase's nine-group test total.

[`company-team.tsx`](../client/src/components/company-team.tsx) now has a prominent
**Add another employee login** button above the list; it focuses the separate
invitation form's email field. The form explains separate email accounts and
membership only after acceptance. **Members and invitations** displays existing
members labeled **Member** and separate invitation entries labeled **Pending
acceptance**, with invited email, role and associated employee. Invitations grow
the visible list while retaining their pending status; they do not create
memberships. Each revoke action has an accessible name containing its recipient.

Member editors have visible role/employee labels and explicit help about editing
or reassigning an existing login. Changing employee shows a linked, announced
reassignment warning and changes the save action to **Save reassignment**.
Creating an invitation resets email/employee, excludes employees already assigned
to members or pending invitations, and retains drafts after rejection. Admin
invitations can still omit an employee. Submission stays locked during mutation
and refetch; management invitation creation also waits for successfully loaded
team data. Existing shareable link/copy, error/retry feedback, removal and owner
controls remain. API requests/authorization, schema and acceptance remain unchanged.

Eleven new localized messages were inserted into all supported resource files
without rewriting other task changes. These are authored translations; native
language review is not claimed. Only en/lv/ru were exercised. Deferred languages
ar (including RTL), zh, fr, de, hi, ja, pt and es remain untested.

Final checks:

- `node scripts/test-team-member-update-browser.mjs`: **passed**, Chrome
  **155.0.8059.85**, **9 scenario groups**. Three en/lv/ru groups retain the
  member PATCH/authoritative-GET/refetch/reassignment regression. Six additional
  groups cover en/lv/ru at **1280px and 320px** widths. These create two distinct
  invitations and assert list growth **2 → 3 → 4**, explicit member/pending labels
  and employee names, unchanged original employee10/member, and **zero PATCH
  requests from adding logins**. They also cover failure draft retention,
  mutation/held-GET duplicate lock, email/employee reset, member/pending filtering,
  prominent action keyboard activation/focus and native field Tab order,
  selectable share link, revoke restoring employee availability, and unassigned
  admin invitation. No unexpected mock calls, browser errors, external requests
  or HTTP writes reached the static fixture server. The approved escalation path
  was used for the isolated fresh Chrome profile because of the earlier
  sandbox Crashpad startup limitation; no approval rejection occurred.
- Scoped fixture TypeScript via `node --input-type=module` and TypeScript
  `createProgram(['scripts/fixtures/team-member-update.tsx'], {...parsed.options,
  target: ts.ScriptTarget.ES2022, incremental: false, noEmit: true})`:
  **passed, zero diagnostics**, including imported real component dependencies.
  No generated app artifacts or private config were needed.
- Root ran **`npm run check`**, **passed exit 0** after application source was
  finished. Only locale wording was refined afterward; final browser checks use
  that wording. No duplicate broad check/build was run by the frontend owner.
- Attributable component `git diff --check` passes; only repository CRLF
  normalization warnings appeared.

Synthetic screenshots:
[`English desktop`](team-member-update-en-1280.png) and
[`Russian phone`](team-member-update-ru-320.png). Frontend and root inspected both:
distinct pending/member entries, visible add action and form, readable wrapping,
no page horizontal overflow. The selected invitation URL is synthetic fixture
data. Browser tests assert reflow at both widths in all three test languages.

Limits: this verifies the real frontend against a synthetic in-memory API. It
does not verify live Auth/email delivery, database persistence, invitation
acceptance or the user's currently running browser bundle. No real session,
private config, connected application startup, service/database operation,
deployment or schema change occurred. Other browser engines, physical devices,
screen readers and deferred locales/RTL were not tested; no accessibility or
security certification is claimed. Root accepted screenshot review through live
agent messages and owns final task/queue closure. User should refresh the team
page after their local dev server serves the updated source; a new invitation
appears as pending immediately after successful refetch and becomes a member
only after recipient acceptance.

## Pending invitation editing — completed extension

User clarification: Santa was a pending Administrator invitation with no Save
control, while Juris's existing member card offered Save access. Editing that
member could only update Juris. Root resumed this assigned Front End Developer
for actual pending-card editing under the user request and standing cooperation.
Scope accepted: `CompanyTeam`, targeted localized messages, the isolated
fixture/regression and this handoff/screenshots; root retained coordination and
final integrated checks. Assigned Backend `/root/team_invitation_backend` owns
the endpoint and server tests; no frontend agent edited backend/database files.
The offline/private/live limits above remain in force.

Frontend and Backend agreed directly through live agent messages before wiring:
PATCH `/api/company/invitations/:id`, body `{role, employeeId}`, acknowledgement
`{success:true}`. Manager/current workspace and pending-only checks belong to
Backend. Invalid assignment/input is 400, denied manager/company state 403,
foreign/missing invitation 404, assignment conflict 409, and an
accepted/revoked/expired invitation or original inviter no longer managing is
410. Email, ID, token, expiry and inviter remain unchanged; editing neither
resends email nor creates/changes membership. See the
[Backend handoff](team-invitation-backend-handoff.md) for authoritative contract
and its actual-handler evidence. Frontend failures use existing localized save
error feedback, retaining the draft rather than claiming success.

Implemented: every pending invitation now has its **own role and employee
selectors and Save access button**, named for the invited email. Email is
immutable text; pending acceptance status and acceptance help remain visible.
Pending/error/success feedback is keyed to that invitation ID. A successful edit
refetches the team and synchronizes the editor to authoritative returned fields.
The mutation/refetch lock and provider/viewer employee requirement are preserved;
admins may remain unassigned. Revoke, creation/share link and owner controls are
preserved.

Pending employee options include its own current assignment and unreserved
employees; other member/pending assignments are excluded. Existing member
editors also exclude other member/pending reservations. If an existing or draft
selected ID becomes unavailable (including a remote reservation), all affected
employee selectors retain a **disabled Employee unavailable** option for that
ID, rather than visually falling back to another employee. Save stays disabled
until a valid choice is made. These UI restrictions are advisory; server
authorization and assignment validation remain the Backend owner's boundary.
Two new help/access-name messages were maintained across all supported locales;
only en/lv/ru were tested. Native linguistic review is not claimed.

Final verification:

- **`node scripts/test-team-member-update-browser.mjs` passed, 15 scenario
  groups**, Chrome **155.0.8059.85**, synthetic fetch/API only and no unexpected
  calls, browser errors, external requests or HTTP writes to the static server.
  This reuses the existing nine groups and adds Santa-specific en/lv/ru cases at
  **1280px/320px**. The fixture starts with Juris as an existing provider and
  Santa as a pending admin assigned employee11, plus another pending employee12.
  Santa's admin→provider save PATCHes only her invitation ID; Juris's role,
  employee and all member records remain unchanged, and Santa's same
  ID/email/expiry remain pending. Provider's required employee, own assignment
  retention, other reservation filtering, per-card rejection feedback/draft
  retention, real keyboard Tab/Enter Save activation, disabled controls and
  duplicate protection through held PATCH/GET, authoritative GET differing from
  draft and editor remount all pass. A remote reservation makes draft employee13
  visibly unavailable in both editors and add form, with no resulting writes.
  Assertions were updated meaningfully to count member editors rather than all
  list selects now that pending cards are editable.
- Scoped TypeScript fixture program (same `node --input-type=module`/
  `createProgram` command/options recorded above) passed again with **zero
  diagnostics** for the updated fixture/imported component.
- Root's **final `npm run check` passed exit 0 after the unavailable-selection
  source fix**. Backend independently returned **43 passing hermetic
  actual-handler checks**, reviewed by root. Frontend does not claim it executed
  those backend checks or connected acceptance.
- [English desktop](team-invitation-edit-en-1280.png) and
  [Russian phone](team-invitation-edit-ru-320.png) screenshots show Santa's own
  Save access with pending status and unchanged Juris. Frontend and root visually
  reviewed and accepted both; no page horizontal overflow, controls/help wrap
  within the phone viewport. These contain only synthetic identities.

Status: local frontend implementation and verification complete; root owns
final integration/user handoff. The existing development server must be
**restarted** to load the new backend PATCH handler, then refresh the team page;
the current billing development command imports the server without a watch
reload. No restart, real invitation edit, live acceptance, private config access
or deployment was performed by this frontend owner. No schema/dependency change.
Other engines, physical devices, screen readers and ar/RTL, zh, fr, de, hi, ja,
pt, es remain unverified/deferred. Recovery: reverse only attributable editor,
message keys, fixture/test and evidence changes, preserving earlier work and
recorded invitations; coordinate the new endpoint's recovery with its Backend
owner. Do not erase unrelated dirty work or change data as a rollback shortcut.
