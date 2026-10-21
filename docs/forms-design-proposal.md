# FitsMyTime forms design proposal

Prepared 19 October 2026 by the assigned Front End Developer.
Status, 20 October 2026: **all three planned phases and the final login/signup
pass are implemented and locally Chrome-verified under TASK-022. Broader release
verification remains incomplete; deployment is on hold.**

See the [Phase 1 handoff](forms-implementation-handoff.md),
[Phase 2 handoff](forms-phase2-handoff.md), [Phase 3 handoff](forms-phase3-handoff.md)
and [final auth handoff](forms-auth-handoff.md)
for changes, passed checks, screenshots and browser/device/language verification
limits. The user directly assigned Front End Developer `/root` to finish TASK-022;
that pass completed the remaining auth verification with existing tooling and
focused checks under the same local frontend limits.

The user's request to start implementation approves the local frontend scope
recorded in [TASK-022](../TASKS.md), superseding this document's historical
proposal-only assignment for that work. Executor: `/root/forms_implementation`.
The original review evidence below describes the proposal and preview only;
application completion and verification require the implementation handoff.
Backend, database, connected-service operations and deployment remain outside
this assignment.

## Open the visual proposal

Open [forms-design-preview.html](forms-design-preview.html) in a browser by
double-clicking the file. It is self-contained and needs no installation or
server. Use the top controls to switch between **Service editor**, **Booking
review**, and **Account & address**, and between desktop and phone widths.
Fields can be explored, but actions only show preview feedback; nothing is
submitted or saved. The service summary and checklist are illustrative.

Image companions: [service editor](forms-design-preview.png),
[phone layout](forms-design-preview-phone.png),
[booking review](forms-design-preview-booking.png), and
[account and address](forms-design-preview-account.png).

The user directly assigned the Front End Developer on 19 October 2026 to create
a locally viewable visual proposal. Executor: this frontend session. Scope:
this standalone HTML, its synthetic screenshots, and this document's visual
companion notes. Allowed operations: local file creation/editing and isolated
browser rendering. Application code, backend, database operations, deployment,
and connected services remain outside this assignment. Recovery: remove the new
preview files and these companion notes, preserving the original proposal and
other sessions' work.

Verification: isolated Chrome 155 rendering; all three screens checked at 320,
390, 540, 541, 768, 850, 851 and 1280 CSS pixels, with no page-level horizontal
overflow. Checked associated field labels, screen/phone controls, keyboard Tab
navigation, conditional group capacity, coordinate disclosure, preview action
feedback and retention of edits between screens. No runtime exceptions or
external HTTP requests were observed. Reviewed rendered desktop and phone
screenshots. This is an English visual concept; the RTL check used English copy
to inspect reflow only. Full translation, screen-reader, physical-device,
Firefox/WebKit, live validation and production-flow checks are outside this
mockup's verification. No application build or connected tests were needed.

## Recommended direction

Choose **A: consistent sectioned forms**. Keep FitsMyTime's indigo primary color,
neutral backgrounds, rounded cards, existing inputs and Radix controls. Give every
form a clear task heading, short sections, predictable actions, and field-specific
feedback. Keep the existing two-step booking flow and service editor's grouped
cards. Concentrate the first implementation on the service editor, where one
pattern can establish the standard for the remaining forms.

| Option | Result | Tradeoff |
| --- | --- | --- |
| **A — Sectioned forms, recommended** | Improve current layouts, semantics, feedback and localization; keep related information visible. | Long service forms still scroll; section headings and a dependable action area support scanning. |
| B — Guided service wizard | Divide service creation into details, booking, location and publishing screens. | More navigation/state management; reviewing or editing several sections takes more steps. Consider after observing first-time provider difficulties. |
| C — Compact operational forms | Denser rows for experienced providers and administrators. | Faster scanning on large displays; needs a separate comfortable layout on small screens and at zoom. Useful later for team/admin tools. |

The requested decision is the preferred direction. Selecting a design does not
approve application implementation, backend/database work, or deployment.

## What the current source shows

This is a static repository review, not a rendered usability assessment. The
following observations are directly supported by source; overflow, visual
hierarchy and interaction impact remain hypotheses until browser verification.

| Area and source | Existing strength | Proposed improvement |
| --- | --- | --- |
| [Login/signup](../client/src/pages/login.tsx) | Narrow card, password autocomplete, enabled-provider discovery, linked confirmation-password errors. | Localize hard-coded text; stack signup names on narrow screens; separate authentication options from profile details with a labeled divider. |
| [Account](../client/src/pages/account.tsx), [password](../client/src/components/account-password-form.tsx) | Separate cards/actions, explicit labels, name/password autocomplete, pending and inline success states. | Reuse common section spacing and field errors; retain independent saves and make the read-only email/company details visually distinct. |
| [Service editor](../client/src/components/provider/service-editor.tsx) | Four cards, sticky save actions, pending guard, local dirty comparison, reload warning and Back-link discard prompt. | Clarify inactive/published state, associate errors with controls, finish localization, and accommodate long action labels. Other navigation paths need a deliberate draft policy. |
| [Service details](../client/src/components/provider/service-details-fields.tsx), [booking fields](../client/src/components/provider/service-booking-fields.tsx) | Category loading/retry and conditional capacity field. | Service Type's label names an ID missing from its trigger; Instant Booking lacks an explicit label association. Age/gender buttons show selection through variants without exposed checked/pressed state. Price/duration remain two columns at all widths. |
| [Saved addresses](../client/src/components/account-addresses.tsx), [location fields](../client/src/components/address-location-fields.tsx) | Explicit Verify action; manual coordinates available; editing a shared address warns of effects on all services. | Separate the normal address task from manual coordinates, make verification feedback persistent, and stack address/Verify controls when space is short. Keep expiry information. |
| [Booking](../client/src/components/booking-modal.tsx), [time picker](../client/src/components/booking-time-picker.tsx) | Choose-time/review stages, timezone selection, availability loading/retry, selected-slot announcement, conflict recovery. | Give stages and selected appointment a consistent hierarchy; field-level participant errors; translate authenticated flow and format prices/dates by UI locale. |
| [Availability](../client/src/components/availability-editor.tsx) | General/service-specific hours, inherited-hours explanation, separate weekly and exception saves, labeled range inputs. | Make affected service/timezone persistently clear; protect unsaved changes when scope changes; place range errors in their day/date section. The Effect currently resets editor state when service/schedules change. |
| [Company team](../client/src/components/company-team.tsx) | Permission-aware sections, role explanations and owner confirmations. | Separate invitation, access editing and owner controls; show why an action needs employee assignment and place errors beside the relevant operation. |
| [Admin filters](../client/src/components/admin-user-filters.tsx), [categories](../client/src/components/admin-categories.tsx), [storefront](../client/src/components/provider/storefront-editor.tsx) | Explicit Apply/Clear, immutable category keys, translated storefront with preview and publication state. | Use common form feedback; give advanced filters a secondary group; preserve immutable fields, preview, permission and subscription restrictions. |

Shared foundations already exist in [form helpers](../client/src/components/ui/form.tsx),
[inputs](../client/src/components/ui/input.tsx), [buttons](../client/src/components/ui/button.tsx),
[dialogs](../client/src/components/ui/dialog.tsx), [CSS tokens](../client/src/index.css)
and [Tailwind configuration](../tailwind.config.ts). Current buttons use fixed heights
and `whitespace-nowrap`; form-specific wrapping needs review. The shared dialog's
accessible Close text is English. A source search found no document `lang`/`dir`
synchronization in `client/src`; verify document/bootstrap behavior before implementation.
`schedule-edit-modal.tsx` has no other source references found in that tree, so it
is not treated as a confirmed current user flow.

The lockfile confirms React 18.3.1, Tailwind 3.4.17, React Hook Form 7.55.0,
Zod 3.25.76 and i18next 25.7.3. This direction requires no framework upgrade.

## Shared visual and interaction rules

Use a centered content width around 48rem for long editors and 28rem for sign-in.
Use 16px page/card padding on phones and 24px on larger layouts. Start with 24px
between sections, 16px between fields, and 8px between label, control and help.
Use existing system fonts: roughly 24px page headings, 18px section headings,
16px input/body text and 14px help/errors. Allow all text to wrap and grow.

Use semantic background/card/foreground tokens so light and dark appearances can
be checked together; replace affected hard-coded white/neutral treatments only
within selected forms. Keep accent colors subordinate to the primary action.
Use persistent labels, an explained required indicator and explicit optional
labels. Put units next to the relevant field. Prefer 44px touch controls; use
content-driven two-column groups only when both fields fit comfortably.

Each independently saved section has one clearly named primary action. Cancel
stays secondary; deletion and ownership actions have a separate confirmation
with the named object and consequence. Retain entered non-secret values after
rejected saves. Show validation after meaningful interaction or submission,
link errors to fields, and move focus to a linked summary after a failed submit
with several errors. Do not disable submit merely because a user has yet to
discover validation rules. Pending writes block duplicate submission and announce
their task. Show confirmed success beside its action; toasts are supplementary.

## Three representative before/after flows

### 1. Create or edit a service — first implementation

**Before:** Four useful cards, but Booking and pricing combines price, duration,
cleanup, audience, capacity, instant booking and advance payment. One error appears
near the bottom. Save Inactive and Save and Publish share a fixed two-column row.

**After:** Retain one page and all current fields. Refine grouping into
**Service details** (name, category, description, company employee), **Session and
price** (service type, capacity when applicable, duration, cleanup, price and
advance percentage), **Who can book** (existing audience choices), **Booking and
location** (instant booking, saved address), then **Image and links**.
Keep required content visible; optional media may be collapsible with a clear
heading. Expose age groups as checkboxes and gender as a radio group using existing
values. Explain cleanup immediately below its control.

```text
< Services                         Unsaved changes
Edit service
Changes appear publicly after you save and publish.

+ Service details --------------------------------+
| Service name *   [Deep tissue massage           ] |
| Category *       [Massage                      v] |
| Description     [                              ] |
+--------------------------------------------------+
+ Session and price -------------------------------+
| Duration (min) * [60]     Cleanup (min) [15]       |
| Price (USD) *    [70.00]  Advance payment (%) [0] |
| Service type     (o) One-to-one   ( ) Group       |
+--------------------------------------------------+
  Who can book / Booking and location / Image and links
  ...all existing fields remain available below...

Published services appear in search.
[Cancel]          [Save inactive] [Save and publish]
```

Wireframe content is synthetic. Currency wording must follow the actual supported
currency contract; it does not introduce currency selection or conversion.

Keep inactive-save behavior and its existing required-field rules; **do not call
it Save draft**, which could imply partially complete data can be persisted.
For an already published service, warn that Save inactive hides it. Keep pending
status specific to the chosen action. Retain local edits across language changes
and ordinary failed saves. Cancel/Back and other deliberate route/workspace exits
offer Keep editing or Discard when dirty; retain the reload warning. An
authentication loss must not cause cross-account draft recovery. No browser
storage or autosave is added by this design.

On phones stack fields and action buttons as needed. A sticky action area is
acceptable only when content/focus remains visible with zoom, safe areas and the
virtual keyboard; otherwise use the same actions in document flow.

### 2. Book an appointment

**Before:** The existing sidebar summarizes the service while the main region
switches between time selection and review. Selected dates/timezone are already
shown. A participant error can leave the final action disabled without inline
guidance. Booking success closes the dialog with a toast.

**After:** Keep the two steps: **1 Choose time → 2 Review appointment**. On wide
screens retain the summary beside the task; on phones use a short summary above
the active step. Keep service, provider, date, start/end time and timezone together
on review. Display participants and optional notes below, then itemized total and
the existing advance-payment notice. Keep its explicit message that collection
is unavailable in this form; do not imply payment was taken.

```text
2 of 2 · Review appointment
Deep tissue massage · Provider name
Tue 20 October · 10:00–11:00 · Europe/Riga
[Change time]
Notes (optional) [                              ]
Total                                           USD 70.00
[Back]                                 [Confirm booking]
```

For request-based services use Request booking and Request sent, never Confirmed
before provider confirmation. Announce step changes and move focus to the new
heading. Back retains participants/notes. Explain valid participant limits beside
the input. If a slot is lost, keep those edits, return to selection and announce
the conflict. Server success produces durable feedback in the appointments view
or an accessible confirmation state; do not add an extra write for this message.
Retain close/escape behavior while submission is pending and make that status
clear. Verify intentional focus restoration when the dialog closes.

### 3. Account and saved address

**Before:** Personal details, addresses and password already save separately.
Adding an address reveals street text, Verify and latitude/longitude together;
verification outcome is largely toast-based. Cancel closes the address editor.

**After:** Keep those separate save boundaries. Add compact section navigation
for long account pages if needed. In Personal information show editable names
first, then labeled read-only email/company details, then Save changes and inline
Saved status. Password fields remain in a dedicated section with existing
autocomplete and policy guidance; a show/hide control may improve entry without
changing authentication requirements or password retention.

For an address, show **Address → Verify location → Save address**. Put manual
coordinates in an explicitly available Use coordinates instead disclosure,
automatically expanded when existing manual coordinates or an error needs them.
Opening that disclosure grants no location permission and performs no lookup.
Show Location set or Needs verification next to the address, retain coordinate
expiry text and the warning about all linked services, and keep verification
separate from saving. Failed verification offers manual entry and retry. A dirty
Cancel asks before discarding. Successful save restores focus to the saved
address; closing never silently persists it.

## Localization, access and privacy

The [configured languages](../client/src/lib/i18n.ts) are en, lv, es, zh, hi, ar,
pt, ru, ja, de and fr. All changed headings, actions, help, errors, confirmations
and accessible names need semantic translation keys in all 11 resource files.
Use whole messages and locale plural rules; distinguish coverage checks from
native-language review. Keep an accessible language choice on authentication
screens. Preserve entered values on language change.

Synchronize document language/direction and check portaled controls in Arabic RTL.
Use logical start/end positioning; isolate mixed-direction email, URLs, names and
references. Test long German/French labels and CJK/Devanagari fonts. Format dates,
money and numbers by the selected UI locale while retaining actual currency,
appointment timezone, API precision and stored values. Do not parse formatted
display strings as API values or change scheduling/price semantics incidentally.

Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/): visible focus, linked labels
and errors, keyboard operation, non-color selection cues, text/UI contrast and
announced status. Validate 320 CSS-pixel reflow, 200% text sizing and 400% zoom;
keep focused controls clear of sticky actions. Touch targets should normally be
44px; meet the 24px minimum or applicable exceptions. Check dialog focus entry,
containment, Escape and restoration against the
[WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Respect reduced motion. This proposal is not a conformance claim.

Preserve server sessions, CSRF, authorization, existing privacy boundaries and
permission-denied states. Use safe text rendering and synthetic review/test data.
Do not persist passwords, booking notes, addresses or invitation links in draft
storage, logs or analytics. New error-code contracts need Backend coordination;
no backend, schema, payment, geocoding or upload behavior is approved here.

## Delivery sequence and acceptance

1. **Phase 1: service editor pilot.** Apply A to its existing components and changed
   translations, with shared field/error/action conventions scoped to this flow.
   Link labels, expose choice semantics, preserve inactive/publish behavior,
   improve narrow layouts and draft exits. Use existing primitives; no broad
   global button/token rewrite or new dependency is required.
2. **Phase 2: booking and account/address.** Apply the selected visual rules and
   feedback states, preserving the flow contracts described above.
3. **Phase 3: availability, company and admin/storefront.** Add scope-change draft
   protection, precise per-operation feedback and consistent grouping. Owner
   controls stay separate; no permission model or database behavior changes.

For each implemented phase, Front End Developer owns these acceptance checks:

- Mocked component/interaction checks cover valid/invalid input, pending duplicate
  protection, rejected-write value retention, local draft exits, denied access and
  confirmed success. Service pilot also covers active-to-inactive intent and the
  label/choice semantics identified above.
- Browser fixtures with synthetic data and blocked unexpected requests cover
  320/390/768/1280px widths, breakpoint edges, keyboard order, dialogs, contrast,
  zoom/reflow, light/dark and reduced motion. Run maintained Chromium, Firefox
  and WebKit where available; record unavailable coverage. Check physical-device
  virtual-keyboard behavior separately before claiming it verified.
- Check all 11 locales for changed keys/placeholders; review English, Latvian,
  Arabic RTL, long German/French, CJK and Hindi layouts. Verify locale switching
  retains edits and currency/timezone stay explicit. Native-language quality
  remains subject to language review.
- Run affected existing offline regressions and relevant type/build checks after
  inspecting script imports/hooks. Add browser/DOM tooling only under a separate
  scoped implementation assignment if existing tooling cannot verify behavior.
  Connected tests that create sessions or application records need database
  authorization. Required failed/unavailable checks keep implementation incomplete.

## Handoff and evidence limits

The user requested a proposal; the General Manager assigned this Front End
Developer child agent for local source review and this Markdown document only.
Application implementation, connected services, database access/writes and
deployment were outside this assignment. The parent owns task/status coordination.
Recovery is to revise/remove this proposal alone, preserving other sessions' work.

Reviewed the role, frontend skill and its four reference documents, relevant
source/locale configuration, manifest and lockfile. Checked the current W3C
accessibility/dialog references on 19 October 2026. No app was started, no
credentials or connected data were accessed, and no UI tests or rendered/browser
verification were run. Documentation-only work needs no application test run.
Visual appearance, measured contrast, actual overflow, assistive-technology
behavior and physical-device usability remain unverified. Next owner: General
Manager to obtain the user's preferred direction and scope a Front End Developer
implementation assignment.
