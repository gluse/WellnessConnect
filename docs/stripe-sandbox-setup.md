# Stripe sandbox details — preparation only

Local app integration is now prepared through `npm run billing:dev` and the separate
[sandbox profile example](../config/stripe-local-app.env.example). Follow the
[local testing guide](stripe-local-app-testing.md) for the newly required database,
app/session/worker and Stripe CLI/API execution scope. Nothing has been started.
The previous five account-check approvals below are exhausted. Ordinary startup
and the credential preparation flags remain disabled.

The explicit launcher will read `.env` for existing app Auth/session settings,
`.env.stripe.local` for the test key/account, CLI listener signing secret and
existing portal configuration ID, and `.env.stripe-app.local` for the explicitly
selected restricted development database and local-only acknowledgement/switches.
The local HTTP origin comes from `STRIPE_LOCAL_ORIGIN`; leave the older HTTPS-only
`STRIPE_BILLING_RETURN_ORIGIN` preparation field empty for this flow. No files were
read/changed or processes/services started by preparing this launcher.

Copy **only the Stripe section** at the end of [.env.example](../.env.example)
into a file named `.env.stripe.local` in the repository root. That local filename
is ignored by Git. No actual credential file was created by this preparation.

Keep `STRIPE_BILLING_MODE=test` and both enable flags `false`.

| Field | What belongs there |
| --- | --- |
| `STRIPE_BILLING_API_KEY` | Server-side sandbox API key. Prefer a restricted `rk_test_…` key; exact required permissions will be reviewed before integration. |
| `STRIPE_BILLING_ACCOUNT_ID` | Sandbox merchant account identifier, `acct_…`. |
| `STRIPE_BILLING_WEBHOOK_SECRET` | Leave empty until an approved webhook endpoint is supplied; its signing secret begins `whsec_…`. |
| `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` | Leave empty until a reviewed sandbox portal configuration exists; identifier begins `bpc_…`. |
| `STRIPE_BILLING_RETURN_ORIGIN` | Leave empty until the approved HTTPS application origin is known. Origin only, without path/query/trailing slash. |

Current hosted checkout uses a server API key; a publishable `pk_…` key is not
needed for this preparation. Business verification/KYC and bank details stay in
the Stripe Dashboard. Do not place secrets in Administration, `VITE_*`, source
code or chat. [Stripe API key guidance](https://docs.stripe.com/keys).

**These values are not consumed automatically by billing.** An explicit preflight
reader now validates only this named local file. It does not mount routes, start
the app, connect to a database, create prices or enable checkout.

## Local check completed

Command: `node --import tsx scripts/preflight-stripe-sandbox.mjs --local`

The bounded check found a restricted sandbox key and account identifier with valid
formats, default test mode and both enable flags disabled. Webhook secret, portal
configuration and return origin are absent, which is allowed at this preparation
stage. No credential/account values were printed or stored; no Stripe request ran.
This establishes local format/presence only; authentication and account identity
have not yet been verified.

## Authorized own-account reads — latest check passed

**Fifth, separately approved attempt:** the user explained that Apply Changes
had not been clicked earlier and requested “Please retry again.” The same Backend
executor ran the unchanged guarded command exactly once on 26 October 2026.
**Result: exit 0**, `accountReadSucceeded:true`, `configuredAccountMatched:true`.
Local configuration is valid, mode test, billing and new checkout remain disabled.
This verifies this sandbox key can read its own account and that the returned
merchant ID matches the configured value. It does not verify any wider permissions,
applied policy details, checkout, webhook, portal, tax or launch readiness. No
secret/account values were output; no further operation or activation followed.
All five distinct one-check approvals are now spent. Prior failed outcomes and
stop-on-failure records remain below unchanged.

**Fourth, separately approved attempt:** after the user supplied a Stripe error
naming Accounts Read (`connected_account_read`), the user said “retry”. The same
Backend executor ran the unchanged guarded command exactly once on 26 October
2026. Result **exit 1**, `stripe_authentication_or_permission`; local configuration
valid, mode test and both enable flags disabled. Account authentication/equality
remain unverified. The reported permission requirement is user-provided evidence;
the actually applied policy was not inspected or inferred. Stopped without another
request, policy/configuration change, test, database action or activation. All four
separate one-attempt approvals are spent; prior results remain preserved below.

**Third, separately approved attempt:** the user reported “Access policy added.
please retry” on 26 October 2026, authorizing one additional guarded read. The
same Backend executor ran the existing command exactly once. Result **exit 1**,
`accountFailureCategory:"stripe_authentication_or_permission"`; local configuration
remained valid, mode test, billing and new checkout disabled. Authentication and
configured account equality remain unverified. The reported policy was not
inspected or changed, and its exact scope is not established by this result.
Stopped without retry or any other operation. All three distinct one-attempt
approvals are now spent; earlier outcomes below are preserved unchanged.

**Second, separately approved diagnostic attempt:** on 26 October 2026 the user
said “yes, go ahead” to one additional bounded own-account read. The same assigned
Backend executor ran the prepared `--account` command exactly once. Result:
**exit 1**, `accountFailureCategory:"stripe_authentication_or_permission"`.
Local configuration remained valid, mode test, billing/new checkout disabled;
authentication/account equality was not verified. This category does not
distinguish invalid/expired credentials from denied permissions. No raw error,
secret, identity or request ID was output. No retry, permission/key change or
other action followed. Both one-attempt approvals are now spent; any additional
connected request requires separate exact scope. The first attempt below remains
unknown and is not retrospectively reclassified.

The user authorized this exact read with “please proceed” on 26 October 2026.
Assigned Backend `/root/subscription_backend` executed the command **once**:

```powershell
node --import tsx scripts/preflight-stripe-sandbox.mjs --account
```

**Result: exit 1, stopped without retry.** Local configuration/known fields remained
valid; test mode and both disabled flags were preserved. The safe output reported
`connectedCheckAttempted:true` and `accountCheckSucceeded:false`. Authentication
and configured account equality were **not verified**. The deliberately redacted
output does not establish whether the cause was permissions, network or account
mismatch; no cause is inferred here. No further connected action was attempted.

After that attempt, the local reader was extended to report only one allowlisted
failure category: `network_or_timeout`, `stripe_authentication_or_permission`,
`account_mismatch` or `other`. Categories use SDK status/type/code fields, never
raw messages, response bodies, request IDs or account details. This cannot recover
or reclassify the original redacted failure. Two focused synthetic diagnostics
checks and the changed-file TypeScript check passed before the separately
approved second attempt recorded above.

It used the sandbox key in `.env.stripe.local` for the bounded single-attempt
`GET https://api.stripe.com/v1/account`, then compare the returned account ID with
the configured merchant ID. SDK18's own-account retrieval is used; no configured
ID is inserted into an arbitrary/Connect account path. Output is limited to safe
booleans/test mode; returned business, bank, identity and contact details are never
printed or retained. Maximum 10 seconds, zero retries, no redirects or Connect
headers. Any mismatch, timeout, denied read or other failure stops without retry.

The key needs permission for this own-account **read** only; no write access or
customer/product/price/session/webhook listing is requested. Exact Dashboard
permission labels are not guessed or changed here. If a restricted-key read is
denied, its relevant permission must be reviewed separately, not replaced with
broad write access. [Account retrieval](https://docs.stripe.com/api/accounts/retrieve),
[restricted key permissions](https://docs.stripe.com/keys/restricted-api-keys).

The one-attempt authorization has been used. A new connected diagnostic/retry
requires its own precise scope; do not automatically rerun this command. The owner
can first review the configured merchant selection and relevant restricted-key
read permission in Stripe Dashboard without sharing secrets in chat.
The prepared diagnostic command remains the same `--account` command above; a
separately authorized one-shot run would add the safe category if it fails.
Webhook/portal/origin and runtime/DB/launch gates come later; adding the two fields
does not yet establish a working payment flow.
