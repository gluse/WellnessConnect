# TASK-024 — local app / Stripe sandbox testing

User selected local app testing and requested completion by the existing owners
on 26 October 2026. Stripe own-account authentication and configured merchant
matching have passed. Local runtime integration is prepared and offline checks
pass; connected app payment testing has not run.

Backend delivered runtime/routes/worker/auth integration, Frontend delivered
server-driven billing availability, and DB delivered migration/readiness preparation. Existing
commercial choices are in the [decision record](monthly-subscription-decisions.md).
The subsequently approved development DB package completed on 27 October. The app
and worker have not been started and no Stripe billing objects have been created
by agents. Connected payment acceptance remains pending.

## Prepare the Stripe CLI

Use a PowerShell terminal on your Windows computer. If Stripe CLI is not already
installed, use the official Windows package:

```powershell
winget install Stripe.StripeCLI
```

Open a new terminal after installation, then verify and log in:

```powershell
stripe --version
stripe login
stripe switch
```

Complete the browser login and use the interactive `stripe switch` selection for
the same **New business sandbox** used by the verified key. CLI login is separate from the application's restricted API
key. Keep the app's API key in `.env.stripe.local`; do not paste keys into commands,
chat or frontend variables.

References: [official Windows installation](https://github.com/stripe/stripe-cli#installation),
[CLI login](https://docs.stripe.com/cli/login),
[sandbox selection](https://docs.stripe.com/cli/switch).
If a newer CLI requires access to be enabled, the account administrator can select
the sandbox and use Settings → Team and security → MCP and CLI access, as
described in the login guide. Keep CLI access scoped to the sandbox.

## Local webhook secret

Backend and Frontend agreed on `http://localhost:5000` and the raw webhook route
`POST /api/billing/webhook`. In a separate PowerShell terminal, run:

```powershell
$billingEvents = @(
  'checkout.session.completed', 'checkout.session.expired',
  'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.updated',
  'charge.refunded', 'charge.dispute.created'
) -join ','
stripe listen --events $billingEvents --forward-to http://localhost:5000/api/billing/webhook
```

These are the 13 snapshot events accepted by the current event normalizer.
Forwarding becomes available after the prepared app starts. Do not add `--live`,
`--latest`, thin-event or Connect forwarding flags. The app retrieves authoritative
objects using its pinned API version rather than treating snapshot payloads or
redirects as proof of payment.

Copy the listener's displayed `whsec_…` value into the existing ignored file:

```dotenv
STRIPE_BILLING_WEBHOOK_SECRET=whsec_REPLACE_LOCALLY
```

Use the secret from that CLI listener. Dashboard webhook endpoints have their own
separate signing secrets. Keep the listener running during app tests. Local CLI
forwarding does not require a Dashboard webhook endpoint or public HTTPS URL.
See [Stripe CLI listen](https://docs.stripe.com/cli/listen) and
[local webhook testing](https://docs.stripe.com/webhooks#local-listener).

## Remaining setup before app testing

The local launcher is `npm run billing:dev`. Ordinary `npm run dev` keeps billing
disabled. The launcher uses a separate ignored `.env.stripe-app.local` file from
[the empty local profile template](../config/stripe-local-app.env.example).
Create that file locally without overwriting any existing private profile.

**After the database/startup scope is approved and its readiness checks pass**,
configure that local profile as follows:

| Profile field | Local test value |
| --- | --- |
| `STRIPE_LOCAL_APP_ENABLED` | `true` |
| `STRIPE_LOCAL_TEST_ACK` | `SANDBOX_ONLY_NO_REAL_PURCHASES` |
| `STRIPE_LOCAL_DATABASE_URL` | Approved restricted `fmt_app_dev` development connection; fill privately, never a setup/postgres credential. |
| `STRIPE_LOCAL_CHECKOUTS_ENABLED` | `true` for the approved checkout test |
| `STRIPE_LOCAL_WORKER_ENABLED` | `true` for event processing/reconciliation |
| `STRIPE_LOCAL_ORIGIN` | `http://localhost:5000` |

The profile does not silently inherit `.env`'s database selection. The launcher
still needs the normal app's base configuration in `.env`, including its existing
authentication/audit configuration. Keep `.env.stripe.local`'s preparation flags
`STRIPE_BILLING_ENABLED=false` and `STRIPE_NEW_CHECKOUTS_ENABLED=false`, with mode
`test`. Add the CLI secret and reviewed sandbox portal configuration ID there.
Local callbacks use `STRIPE_LOCAL_ORIGIN`; keep the earlier HTTPS-only
`STRIPE_BILLING_RETURN_ORIGIN` empty for this local profile.

The local implementation and offline checks are complete. The existing account-read
preflight alone does not establish database, checkout or webhook readiness.

## Review the existing sandbox customer portal

Your earlier request log showed a successful portal configuration creation.
Reuse that configuration in the same sandbox and review it under
[Billing customer portal settings](https://dashboard.stripe.com/test/settings/billing/portal):

- Keep the configuration active.
- Enable payment-method updates.
- Disable subscription/plan/quantity updates and retention coupons.
- For this **sandbox fixture only**, enable cancellation at the end of the billing
  period with no proration. This does not select the production cancellation policy.

Copy that configuration's `bpc_…` ID into
`STRIPE_BILLING_PORTAL_CONFIGURATION_ID` in `.env.stripe.local`. If the settings
page does not display its ID, the response to your existing
`POST /v1/billing_portal/configurations` request in Workbench Logs contains it.
The app checks the referenced configuration at startup and again when creating
a portal session. See [Stripe portal settings](https://docs.stripe.com/customer-management/configure-portal).

## Restricted sandbox key access

Review the policy attached to the exact application key, then **Apply changes**.
Backend's current operations require the following resource access; Dashboard
grouping can vary, so use the endpoint column to identify the matching resource.

| Resource / endpoint | Access for this implementation |
| --- | --- |
| Accounts, `GET /v1/account` | Read (`connected_account_read`, confirmed by the earlier Stripe error). |
| Prices, `POST /v1/prices` | Write; the call includes `product_data` to create the Pro product. Review the associated Products permission for that nested creation. |
| Checkout Sessions, `POST/GET /v1/checkout/sessions` | Write, which includes reads. |
| Subscriptions, `GET /v1/subscriptions/:id` | Read. |
| Invoices, `GET /v1/invoices` | Read. |
| Payment Intents and Charges, their `GET` endpoints | Read, including expansion of the successful charge. |
| Customer portal configurations, `GET /v1/billing_portal/configurations/:id` | Read. |
| Customer portal sessions, `POST /v1/billing_portal/sessions` | Write. |

This is the code-derived access review, not a claim that all provider permission
dependencies have passed connected testing. Stripe's own request-log errors
identify any missing exact permission. There are no direct customer/subscription/
payment-intent write calls, portal-configuration write calls, event-list calls or
coupon/refund/dispute writes in the current app. Hosted Checkout creates its
customer/subscription/payment objects as part of its session flow. Keep unrelated
permissions unchanged. See [restricted-key permission guidance](https://docs.stripe.com/keys/restricted-api-keys).

## Database readiness and launch steps

### If the local launcher refuses startup

A 27 October local-only diagnostic confirmed the local profile is missing, an
invalid preparation flag and a missing portal ID. No database or Stripe request
was needed to identify these configuration issues. Check these separately:

1. Create `.env.stripe-app.local` from
   [the local profile template](../config/stripe-local-app.env.example). Set
   `STRIPE_LOCAL_APP_ENABLED=true`, `STRIPE_LOCAL_CHECKOUTS_ENABLED=true` and
   `STRIPE_LOCAL_WORKER_ENABLED=true`; retain the sandbox acknowledgement and
   local origin, and fill the approved restricted development database URL.
2. In `.env.stripe.local`, retain `STRIPE_BILLING_MODE=test`,
   `STRIPE_BILLING_ENABLED=false` and `STRIPE_NEW_CHECKOUTS_ENABLED=false`.
   The separate `STRIPE_LOCAL_*` flags enable this local sandbox profile.
3. Fill `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` with your existing sandbox
   `bpc_…` configuration ID. Keep the listener's `whsec_…` secret in
   `STRIPE_BILLING_WEBHOOK_SECRET` in the same file.

Never paste API keys, webhook secrets or database URLs into chat. The already
verified migrations do not need to be applied again for a local profile error.

Use this local-only checker after editing the files:

```powershell
node --import tsx scripts/check-stripe-local-config.mjs
```

It reports allowlisted missing/invalid file and field names. It does not print
values, read base `.env`, start the app or contact Stripe/the database. The
launcher also reports these safe configuration diagnostics rather than hiding
all failures behind the original generic message.

### Verified database and app launch

The approved and verified development targets are source
`hbkooiknruimukkhshrk` and separate audit destination `ynygqodmtgjrngiudalw`.
All eight migrations and restricted runtime checks passed on 27 October. The
ordered plan and evidence are in the [DB handoff](monthly-subscription-database-handoff.md).
Do not rerun the forward setup against already-applied predecessor guards.
The application may still use a hosted development database while its browser
and server run locally. Production/live configuration and deployment remain held.

DB migrations and restricted runtime checks have passed; Backend stopped the
previous project development server with user approval. Keep the Stripe
listener open in one terminal, and start the app from the repository root in another:

```powershell
npm run billing:dev
```

The launcher performs new connected startup reads: restricted database catalog/
audit readiness, one own-account Stripe read and the referenced portal
configuration read. These belong to the future approved local-app execution
scope, not the five earlier account-read checks. Its worker then performs bounded
billing event/reconciliation writes and provider reads. Browser sign-in and test
checkout also persist data. No such startup/rehearsal has run in this preparation.

Open `http://localhost:5000/api/billing/runtime` after successful startup. The
server-owned response reports billing/Administration availability; the frontend
uses it automatically. A failed prerequisite keeps billing unavailable rather
than fabricating a usable subscription state. If startup refuses, keep the error
redacted and resolve the readiness failure before another approved attempt.

## Sandbox payment values

Once the completed app is ready for connected testing, use Stripe's successful
test card `4242 4242 4242 4242`, a future expiry and any three-digit CVC in hosted
Checkout. Sandbox payments do not move funds. See [Stripe test values](https://docs.stripe.com/testing).

After the DB/runtime preparation is approved and verified:

1. Open `http://localhost:5000` and sign into a designated provider test account.
   Use a workspace with no active manual Pro grant for the checkout test; preserve
   existing grants. Company checkout must use the current company owner.
2. Open **My services → Settings → Billing**
   (`/my-services/settings/billing`). Check the EUR19/month tax-inclusive offer,
   then start checkout from the app so its workspace/offer metadata is bound.
3. Complete hosted Checkout with the test card above. Keep the app and Stripe CLI
   listener running. On return, the app should show pending until verified Stripe
   evidence is processed, then paid Pro. A redirect alone never grants access.
4. Refresh Billing and confirm the subscription and paid-through state persists.
   Open billing management and exercise the reviewed sandbox cancellation flow.
5. Separately verify that an existing valid manual Pro grant shows the waiting
   state and company non-owners cannot start checkout/manage billing.
6. In Administration, change the test offer amount and verify it applies to a
   new test subscription while the first subscriber retains EUR19. Restore the
   EUR19 offer afterward; existing immutable revisions/contracts remain intact.

The local fixture uses `sandbox-v1` terms, automatic tax disabled, and cancellation
at period end without proration. These choices apply only to sandbox tests, not
production terms or tax treatment. Unsupported refunds/disputes/credits/trials,
incomplete long histories and uncertain remote creation remain fail-closed review
paths; full production recovery/launch remains held. This is a test plan, not
execution evidence.
Current fresh locale verification is en/lv/ru only; ar/RTL, zh, fr, de, hi, ja, pt
and es remain deferred. Preserve historical evidence.

## Delivered checks and next connected scope

- Backend: 15 distinct new local-runtime cases passed, including signed raw-body
  handling, loopback/origin boundaries, worker gating/leases, manual source guard,
  portal operation/audit outcomes and bounded provider reads. The affected 19
  selected-policy cases and existing audit regression (105 invalid inputs rejected)
  also passed; unchanged suites were reused.
- DB: 109 new portal/readiness offline checks passed; published 0010/0011/0006 pins
  are unchanged. Previous 236/190 suites were not repeated.
- Frontend: four provider cases and 11 mocked Chrome integration checks passed
  within en/lv/ru scope. Existing layout/browser evidence was reused.
- One final integrated `npm run check` passed after all owners stabilized.

User approved **DB setup only** with "Approve the DB plan", then explicitly
instructed proceeding without a backup because the targets contain test data.
The DB owner accepted that exception. Scope: the fixed development source/audit
pair, named private setup/runtime fields, prepared billing/portal-audit migration
transactions and required permission changes, with staged metadata and restricted
role checks. See the [exact execution plan](monthly-subscription-database-execution-plan.md).
The earlier backup-confirmation prerequisite is waived for this exact package.
No backup/recovery point is claimed. PostgreSQL backup client tools are not on
PATH; no fallback export or tool installation is included.

This approved DB-only scope excludes cohort/session fixtures, worker claims, app
startup, Stripe calls/writes, deployment and production. Those remain separate
connected acceptance steps after setup. The broader rehearsal proposal in the DB
plan is not automatically included. No connected actions in this integration
phase have been executed.

### Recovery limits for the approved exception

The user explicitly permits proceeding without backup on source
`hbkooiknruimukkhshrk` and audit `ynygqodmtgjrngiudalw`. The DB owner still verifies
exact targets/principals/TLS, package pins, prerequisite state and each committed
stage. Stop on the first failure/uncertain commit; preserve objects and history,
record the last confirmed commit and inspect state before any further action.
Atomic transaction rollback remains available on known failures; a snapshot
restore cannot be assumed. No destructive rollback, repair or automatic retry.

### Current database setup status

**Completed 27 October:** after user-approved identity-checked server stopping,
one released setup attempt committed and verified source0010/0011/0012/0013,
audit destination0006/0007, then audit source0006/0007. Setup memberships were
restored exactly. All four restricted-role TLS/read-only probes passed,
including the application's own-role billing DB-readiness check.

The forward executor passed 34 offline checks; its corrected process scanner
passed 23 additional synthetic checks. Earlier stopped attempts and the exact
commit/pin/check evidence are preserved in the
[execution record](monthly-subscription-database-execution-evidence.json) and
[execution plan](monthly-subscription-database-execution-plan.md).

Backend did not restart the server after migration. A later public runtime check
returned HTTP200 with billing/Administration readiness false and empty hosted
origins; the responding server is billing-disabled. Use the explicit local
profile and `billing:dev` launcher rather than changing frontend guards.
No agent-run app sign-in,
fixture/session writes, worker claims, checkout/portal/Stripe calls or production
activation were performed in this DB-only phase. Connected payment/transaction/
concurrency acceptance still needs its separate scope. Complete the webhook,
portal-key permissions and local profile steps above before launching the app
from your terminal. Database setup and backup confirmation no longer block that
remaining setup.
