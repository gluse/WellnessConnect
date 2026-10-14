# Supabase Auth and image storage

The frontend calls Express using an HTTP-only session cookie. Supabase validates
email/password or Google identities; Express stores access/refresh tokens in the
PostgreSQL `sessions` table and creates an application profile in `public.users`.
Normal login tokens, passwords, and the privileged storage key are not returned to the browser.
Auth clients are created per request to prevent sharing session state across users.

## Configuration

Populate the variables in `.env.example`, retaining the existing `DATABASE_URL`.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project API URL, `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key from Settings > API Keys |
| `SUPABASE_SECRET_KEY` | Backend-only secret key from Settings > API Keys |
| `SUPABASE_STORAGE_BUCKET` | `service-images` by default |
| `SUPABASE_GOOGLE_ENABLED` | `true` only after configuring Google |
| `APP_URL` | `http://localhost:5000` locally; your HTTPS origin in production |
| `SESSION_SECRET` | At least 32 random characters |
| `PORT` | `5000` locally; your hosting service's port in production |

Use the exact `APP_URL` origin in your browser. Requests from other origins are
rejected for cookie-authenticated writes. Update `APP_URL` when changing domains
or ports. Production startup requires HTTPS; local HTTP cookies work in development.

## Email signup and login

1. Open Supabase Authentication > Providers and enable Email.
2. In Authentication > URL Configuration, set Site URL to your application URL.
3. Add the exact `${APP_URL}/api/callback` URL to the redirect allowlist, including
   a separate entry for each local/production environment you use.
4. Keep email confirmation enabled in production. Configure your email delivery
   settings in Supabase as appropriate for your deployment.
5. Open `/login` to sign in or create an account. Confirm signup email in the same
   browser that started signup: the PKCE verifier is stored in its server session.
   If the browser session is lost, return to `/login` after confirming and sign in
   with email/password.

Signup supports Personal and Create a company. First and last names are optional.
Company signup metadata requests creation of a new workspace after verification;
it cannot grant membership or permissions in an existing company. Membership roles
are stored in the database. Confirmed accounts use the same profile on subsequent
logins. Company creation is idempotent and preserves legacy company records.

## Company invitations

Run `npm run db:setup-company` to add company workspaces and team memberships to
an existing installation. The existing company administrator becomes its owner.
Managers invite members from Company team and assign their employee and access.
Read-only and provider access are restricted to the assigned employee.

New users can receive a Supabase invitation email. Keep the Invite user email
template's `{{ .ConfirmationURL }}` link and the existing
`${APP_URL}/api/callback` redirect allowlist entry. The default invitation flow
returns tokens in the URL fragment; the callback redirects to `/invite`, which
exchanges the refresh token for an HTTP-only session and removes the fragment.
The invited user sets a password and explicitly accepts company membership.
If the sign-in expires before password setup, the invitation and login pages
offer **Send fresh sign-in email**. Enter the invited address and open the newest
link in the same browser. This uses the Supabase **Magic Link** email template
and the existing `${APP_URL}/api/callback` redirect. No password is needed for
recovery; verified email and a pending invitation are still required before
password setup. It does not create accounts for unknown email addresses.
The server requires the verified email to match the pending invitation.

Every invitation also returns a shareable application link. Use it for existing
accounts, or when Supabase email sending is unavailable. The recipient signs in
or signs up, confirms their email, and accepts. Existing accounts keep their
credentials. Shareable tokens are stored as hashes, invitations expire in seven
days, and acceptance is single-use. Supabase Auth link expiry is independent;
an expired email sign-in link can be replaced or the user can sign in normally.

## Google login

1. Create a Google OAuth web client for your app.
2. Add the Supabase callback URL shown in Authentication > Providers > Google to
   the Google client's authorized redirect URLs (normally
   `https://PROJECT_REF.supabase.co/auth/v1/callback`).
3. Enter the Google client ID/secret in Supabase and enable the provider.
4. Allow `${APP_URL}/api/callback` in Supabase Auth URL Configuration.
5. Set `SUPABASE_GOOGLE_ENABLED=true` and restart the backend.

The login page then shows Google. The backend starts a PKCE flow, exchanges the
callback code, verifies the user with Supabase, and regenerates the Express
session before redirecting to `/`. Invalid codes return to the login page;
callbacks without a code go to the invitation page for the implicit invite flow.
Google's external consent flow requires provider configuration and an interactive
browser check; it is not exercised by the automated integration test.

## Private image bucket

Run `npm run storage:setup` with the backend secret key configured. This creates
or updates only `SUPABASE_STORAGE_BUCKET` as private, allowing JPEG, PNG, WebP,
and GIF files up to 10 MB. Do not choose an unrelated existing bucket: its privacy
and upload limits would be updated. SVG is excluded.

The provider's upload button requests a signed URL from Express, sends the file
directly to Supabase's signed upload endpoint, then confirms the stable object
path with Express. The secret key is never exposed. Each path has a user-ID
prefix and a random filename; files cannot overwrite existing objects.

Express verifies ownership, size, and basic file signatures before accepting an
image for a listing. Images are read through `/objects/...` using the session
cookie. Administrators can reuse images already linked to their company, including
images uploaded by another manager. Private company images are available only to
company managers and the assigned employee. Other signed-in users can view images
attached to published services of active companies. Unattached uploads stay private.
Application tables are not exposed through the Supabase Data API.

## Verification

- `npm run check` verifies TypeScript.
- `npm run build` builds the frontend and backend.
- Start `npm run dev`, then run `npm run test:integration` explicitly.
- Run `npm run test:teams` to verify company signup and team access, including a
  generated Supabase invitation sign-in without sending email.

The integration test uses two temporary confirmed Auth users without sending
email. It checks failed/successful password login, cookie flags, session isolation,
token refresh, cross-origin rejection, signed uploads, size/type restrictions,
ownership, publication visibility, and logout. It removes its temporary Auth
users, application profiles, sessions, service, and image. The test needs network
access and a backend secret key. Use a development project for repeated testing.

Manually check signup email delivery/confirmation and Google consent after the
dashboard configurations are complete. Neither password reset nor account
administration is part of this login page.

Official references:

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [PKCE authentication](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Signed uploads](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl)
