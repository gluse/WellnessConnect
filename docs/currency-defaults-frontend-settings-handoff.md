# TASK-044 workspace pricing settings frontend handoff

Status: implemented locally; focused offline component checks pass. Integrated
type/build/browser evidence belongs to the coordinating frontend owner.

Requester/coordinator `/root` assigned `/root/currency_money` as Front End
Developer for the accepted currency-defaults follow-up. Scope accepted:
`account-pricing-settings.tsx`, Account integration/navigation,
`address-location-fields.tsx`, supported translation resources, scoped component
checks and this handoff. Implementation continued on 6 November 2026 following
the user's instruction to proceed. Existing TASK-039 changes and other owners'
work were preserved. No private configuration, connected database/service,
application startup, deployment or new migration execution was performed.

## Behavior and contract

Account now contains a Pricing defaults section with the current workspace name,
optional default currency and business country. Country suggestions follow later
country edits while the default remains unset and untouched; unknown country
clears that automatic suggestion. A persisted default, explicit currency or
explicit empty selection is preserved. Settings affect defaults for new services; saved service and booking
currencies keep their existing behavior.

The component uses root's `useWorkspacePricing(actorId)` hook and the shared
`WorkspacePricingSettingsView` schema. GET/PATCH target
`/api/workspace/pricing-settings`; PATCH carries both `expectedWorkspace` and
`expectedRevision`. The server selects and authorizes the target; the supplied
workspace is only a comparison binding. Mutation responses are schema-validated
and checked against the bound workspace before caching.

Settings render loading, denied, read-only, initial load error/retry, save error,
success and revision-conflict states. Client validation links errors to controls
and focuses the invalid field; save errors focus their announcement. Errors and
CAS conflicts retain drafts. Explicit reload discards edits only after a successful
fresh read; failed reload retains the draft and a retry action. Saves prevent
duplicate submission and are not automatically retried.

Keys include actor, workspace and edit permission. Workspace/account changes or
switch-in-progress unmount the previous form, abort its request and prevent its
late callbacks from updating another workspace. GET 401/403 hides cached settings;
PATCH 401/403 removes fields and save controls, with 401 also clearing the auth
cache. Transient 503 errors preserve the draft.

Shared address forms now persist nullable `pricingCurrency` separately from
`countryCode`. “Use workspace default” sends null. Changing country does not
replace an explicit location pricing currency. The component does not infer
country from text/coordinates or run a lookup for currency selection.

All eleven supported translation resources were maintained for settings,
location overrides and root's currency-source/default-loading/amount-lock copy.
Fresh language verification covers only en/lv/ru. Other translations have not
received native-language review in this task.

## Verification and limits

`node --import tsx scripts/test-workspace-pricing-frontend.mjs` passes. It uses
synthetic fixtures, React rendering, the real query/mutation hooks and an in-memory
fetch boundary rejecting unexpected requests. Covered behavior:

- en/lv/ru settings copy and placeholders; GB → LV → unknown automatic country
  suggestions, persisted/default and explicit empty choice preservation;
  successful bound CAS payload and cache revision update.
- Unsupported-currency validation/focus; 503 and 409 draft retention; failed
  reload retention/retry; successful explicit reload; pending duplicate prevention.
- Read-only controls; PATCH permission loss; GET 401/403 with cached data; clearing
  an old private draft when switching workspaces.
- Independent address-country and location-pricing-currency controls, including
  null override without changing the selected country.

Scoped `git diff --check` passes. Root owns integrated TypeScript/build and actual
Chrome/Firefox/WebKit browser checks. Renderer checks do not establish browser
layout, real DOM focus or physical-device behavior.

Arabic/RTL, Chinese, French, German, Hindi, Japanese, Portuguese and Spanish
verification remain deferred. No live state or database authorization was inferred
from component checks. TASK-044's migration is separate from TASK-039/0020 and was
not executed by this owner.

Read-only root-editor review identified that the “Use suggested currency” action
changed currency selection without affecting the existing dirty calculation;
the coordinator was notified to include deliberate selection in unsaved-change
handling. Price-freeze and source-priority behavior otherwise matched the shared
resolver contract at review time. Root owns final integration review and fixes.

Recovery: revert only attributable local settings/address/navigation/resource
changes while preserving TASK-039's explicit currency support and other owners'
changes. Once workspace defaults exist, preserve their storage and coordinate a
compatible rollout or disable the new settings write path; no database recovery
operation was performed here.
