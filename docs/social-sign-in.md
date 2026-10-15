# Configure social sign-in

TASK-003 has application integrations for Google, Facebook, Apple, and Microsoft.
Each provider needs an OAuth application in its developer console and credentials
in your Supabase project before its button should be enabled. No database
migration is needed. Email/password sign-in remains available.

## Shared callback configuration

There are two different callback URLs:

| Where to configure it | URL |
| --- | --- |
| OAuth provider's redirect/return URL | Copy the callback from that provider's Supabase configuration, normally `https://PROJECT_REF.supabase.co/auth/v1/callback` |
| Supabase Authentication → URL Configuration → Redirect URLs | `${APP_URL}/api/callback`, for example `http://localhost:5000/api/callback` locally |

Use the exact callback displayed by Supabase if you use a custom Auth domain.
Set the Supabase Site URL to your application origin. Add a separate app callback
for production, with HTTPS. Open the app using the same origin as `APP_URL`.

Enter OAuth client credentials in **Supabase Authentication → Sign In / Providers**.
The app uses the existing backend Supabase keys. Provider secrets and Apple's
signing key do not belong in frontend code, `VITE_` variables, or this repository.

## Google

1. In Google Cloud, configure an OAuth consent screen and create an OAuth client
   with application type **Web application**.
2. Add the Supabase callback as an authorized redirect URI.
3. In Supabase's Google provider, enter the client ID and client secret and enable it.
4. While Google's app is in testing, add the accounts you will use as test users.
   Complete Google's publishing requirements before offering it publicly.
5. Set `SUPABASE_GOOGLE_ENABLED=true` in the backend `.env`.

See the [official Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Facebook

1. In Meta for Developers, create an app with the Facebook Login use case.
2. Set its valid OAuth redirect URI to the Supabase callback.
3. Configure the `email` permission alongside `public_profile`; Supabase requires
   email for this flow. Test using a Facebook account with a confirmed email.
4. In Supabase's Facebook provider, enter the App ID and App Secret and enable it.
5. Add development testers or complete Meta's public-app requirements, as appropriate.
6. Set `SUPABASE_FACEBOOK_ENABLED=true` in `.env`.

See the [official Facebook setup guide](https://supabase.com/docs/guides/auth/social-login/auth-facebook).

## Apple

1. Use an Apple Developer account and an App ID with Sign in with Apple enabled.
2. Create a linked **Services ID** for the website. Configure its website domain
   and return URL using the Supabase Auth host and callback.
3. Create a Sign in with Apple signing key. Use the `.p8` key, Key ID, Team ID,
   and Services ID to generate the OAuth client secret as described in the guide.
4. In Supabase's Apple provider, configure the Services ID as the web client ID
   and the generated secret. If listing multiple client IDs, place the web
   Services ID first. Enable the provider.
5. Set `SUPABASE_APPLE_ENABLED=true` in `.env`.
6. Rotate the Apple OAuth secret at least every six months. Keep the signing
   key secure for later rotations.

Apple's web OAuth flow may not provide a name. Sign-in works without one; users
can enter or update their names in **Account details**. Later logins preserve saved
names when Apple omits name metadata. Apple relay email addresses are supported.

See the [official Apple setup guide](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## Microsoft

1. In Microsoft Entra ID, register an application. Choose the supported account
   types for your audience; support both personal and organizational accounts if
   both should be able to use the marketplace.
2. Add a **Web** redirect URI using the Supabase callback.
3. Create a client secret. Copy its **Value**, not its Secret ID.
4. In Supabase, configure the **Azure (Microsoft)** provider with the Application
   (client) ID and secret. Use a tenant configuration consistent with the account
   types chosen above; the common tenant supports the broadest audience.
5. Follow Supabase's guidance for the optional `xms_edov` email-verification claim.
   The app requests the `email` scope when starting Microsoft sign-in.
6. Enable the provider and set `SUPABASE_MICROSOFT_ENABLED=true` in `.env`.
7. Renew the Microsoft client secret before its configured expiration date.

The app calls this provider Microsoft; Supabase's API identifier is `azure`.
See the [official Microsoft setup guide](https://supabase.com/docs/guides/auth/social-login/auth-azure).

## Enable and test each configured provider

Restart the backend after editing `.env`:

```powershell
# Stop the running process with Ctrl+C, then:
npm run dev
```

Refresh `/login`. Only enabled providers appear. Test one provider at a time:

1. Sign in with a new test account and verify that an application profile is created.
2. Sign out and sign in again; the existing profile and saved names should remain.
3. Open `/my-bookings` while signed out, sign in, and verify the return to that page.
4. Cancel provider consent and try again. A cancelled or expired attempt should
   return to login with a useful message and retain the requested destination.
5. Verify email/password login and invitation acceptance still work.

Both personal and company signup support configured social providers. For a
company, enter the company name before choosing Continue with Google (or another
provider). Social signup does not require the email/password fields in the form.
The app saves the company request in its server session and creates the workspace
only after verifying the social identity. An existing personal account can create
its company this way; an existing company is reused without renaming it.
Company creation requests expire after one hour and are cleared on cancellation
or failure. Company names and membership IDs are not passed through provider URLs.
Email/password company signup and creating a company from Provider profile also
remain available.

`npm run test:social-auth` checks the UI, provider configuration, real SDK PKCE
generation/code exchange, safe redirects, session rotation, failure handling,
and sparse profiles with mocked Auth responses. It does not prove that external
credentials or consent screens are configured correctly; finish the live checks
above for each provider before marking TASK-003 complete.
