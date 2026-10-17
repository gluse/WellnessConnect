# Pro storefronts

A storefront is a public, branded page at `/providers/<slug>`. Visitors can browse
and book published services using the existing availability and booking rules.
Creating, editing, previewing, and publishing a storefront requires active Pro
access. Customers do not need Pro to browse or book.

## Setup

After the company workspace migration, run:

```sh
npm run db:setup-storefronts
```

The migration adds `provider_subscriptions` and `storefronts`, enables RLS, and
revokes browser-role access to both tables and sequences. It can be rerun safely
and grants no existing account Pro access. Apply it before starting the updated
server: service search and private image checks now reference these tables.

## Granting and managing Pro

This release provides manually administered Pro access. Payment collection,
checkout, prices, automatic renewals, and billing-provider webhooks are not
implemented. Granting access does not charge anyone or establish a payment
subscription.

1. Sign in as an application administrator configured by `APP_ADMIN_USER_IDS`.
2. Open **Administration → Pro subscriptions**.
3. Select **Individual** or **Company**, then use the searchable dropdown to choose
   a provider or company. Individuals can be found by name or email; companies by
   company name or owner details. Results show identifying details and load in
   pages of 20, with **Show more matches** for additional results. Individual
   providers must have signed in at least once to have an app profile.
   Changing workspace type or editing the search clears the previous selection.
   Select a result to enable **Load subscription**; typing a name alone does not
   select a workspace.
4. Load the subscription and verify the displayed name.
5. Select **Pro**, choose a future expiry, and save. The form displays the browser's
   timezone; the server stores the instant in UTC. Select **Free** to revoke access.

The database records the administrator ID and update time with the latest change.
This is not a complete financial audit log.

**Administration → App users** shows each user's personal subscription in the
**Personal Pro** column and a separate Pro badge for each company affiliation.
Active subscriptions include an expiry date; missing, expired, or revoked access
is shown as not enabled. A company subscription does not mark its owner's personal
subscription as enabled. Subscription changes refresh the directory data, and
**Refresh** reloads current status. These indicators describe the subscription;
account blocking and company closure remain separate statuses.

Each individual workspace has its own subscription. A company subscription belongs
to the company and covers its storefront and authorized owner/administrators.
It survives ownership changes and does not grant personal Pro to employees or
owners. Provider and read-only company members cannot edit or preview drafts.
Closed companies cannot publish or expose storefronts.

## Provider workflow

Choose the desired workspace and open **My Services → Settings → Storefront**.
Free or expired workspaces see a Pro access notice. A Pro provider can set a
display name, introduction, logo, and cover image; preview changes; save a draft;
and publish or unpublish. The page lists all published services in that workspace,
including services from different company employees. Search, category filters,
and sorting work within that catalog.

The slug must contain 3–64 lowercase ASCII letters, digits, or single hyphens,
without leading or trailing hyphens. Slugs are globally unique and permanent after
the first save, so links remain stable. Publication does not create or copy
services. The public page can be shared using the link field and copy button.
Service cards and details link provider names to a currently published Pro page;
providers without one retain the existing catalog dialog.

Guest booking links return to the same storefront and selected service after
email or social sign-in. Booking still checks service availability and permissions
on the server; knowing a storefront URL never grants provider access.

## Expiry and images

Public reads, service-result links, branding-image reads, and every storefront
write check Pro entitlement on the server. Storefronts require both publication
and a future Pro expiry. Revoked, expired, unpublished, and closed-company pages
return 404. A free-plan user cannot bypass the rule using the API.

Expiry and revocation preserve content and the publication setting. Renewing Pro
restores a previously published page automatically. Existing marketplace services
and reservations continue working. Existing viewers refresh access every minute
and when returning to the tab; a failed check hides previously loaded page content.

Branding uses the existing private image uploader. New images must belong to the
editor; previously saved company branding remains usable after ownership changes.
Unpublished and expired branding is available only to the uploader or authorized
workspace managers. An image also used by a published marketplace service remains
public through that service. Image responses and storefront APIs use `no-store`.

## Verification

```sh
npm run test:storefronts
npm run test:storefronts-db
npm run check
npm run build
```

The first suite uses mocked external services and React rendering to check public
pages, filtering/sorting, sign-in returns, editing, Pro notices, administrator
controls, API authorization, validation, and all 11 locale dictionaries. The
database suite uses connection-local temporary tables and sequences; it never
grants real users Pro access or changes public application data. It exercises
the migration, RLS/grants, catalogs, ownership changes, expiry/renewal/revocation,
slug conflicts, and branding access.

Manually review desktop/mobile layout, upload real logo/cover images, grant Pro
to a test workspace, publish and share its page, complete a test booking, then
revoke/renew access and confirm page visibility changes. Use test accounts and
existing non-production billing arrangements; this release has no checkout.
