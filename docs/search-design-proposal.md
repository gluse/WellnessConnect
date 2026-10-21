# Service search — design for approval

Prepared 20 October 2026 by Front End Developer `/root` at the user's request.
Status: **option A approved and implemented locally after the user instructed
“Go ahead and implement as planned.”** Focused offline/Chrome checks pass;
broader release verification remains limited and deployment stays on hold.
See [implementation and evidence](search-implementation-handoff.md).

Open [the interactive design preview](search-design-preview.html) in a browser.
It works directly from disk and needs no installation or application server.
Use the top controls for Desktop/Phone, English/Latvian/Russian and example states.

Screenshots: [desktop](search-design-desktop.png), [phone](search-design-phone.png),
[map](search-design-map.png), [phone filters](search-design-phone-filters.png),
[search error](search-design-error.png).

## Recommended direction

**User decision, 20 October 2026:** “In Recommended direction, I choose option A.”
Option A is the selected layout direction. The subsequent instruction to implement
as planned also approved the deliberate interaction changes below.

**A — a clear search bar, focused filters and readable service rows.** Keep the
current indigo brand, neutral surfaces and familiar controls. Put the service
query and location together at the top, then show results promptly with a small
filter summary. Make price, duration, provider and booking method easy to compare.

| Area | Proposed design |
| --- | --- |
| Search | A visible heading, labeled query/location fields and one Search services action. Keywords and AI Search are native choices with short explanations. |
| Desktop filters | A compact sidebar: category, distance, session type, audience and expandable date/time. Apply filters commits the draft together. |
| Phone filters | Search remains visible; a Filters button opens a scrollable panel. Apply stays reachable; Escape/Close returns focus to the opener. |
| Results | Count and search area above removable chips. Sorting and list/map controls share a predictable position. One service per row on desktop; cards stack on phones. |
| Service card | Category, service title, provider, optional distance, rating/count, brief description, duration, format, booking method and price. A clear View details button leads into the existing details/booking flow. |
| Images | Use existing service images when available. Quiet category artwork provides a fallback; the plants in this preview are decorative placeholders, not proposed branding or photos. |
| Map | Retain a separate view with selected-service context and an equivalent list. The preview map is illustrative, without real tiles, coordinates or API usage. |
| Recovery | Loading, no matches, failed search, denied location and unavailable map each provide a next action. Preserve current selections during errors. |
| Guest access | Browse without authentication. Sign-in remains part of the existing booking path. |

**B — retain the current two-column result grid** is a smaller alternative. It
would preserve more cards above the fold, but leave less space for long names,
prices and translated actions. The supplied visuals show recommended option A.

## Deliberate changes to approve

The current `/search` route renders `client/src/pages/home.tsx`. It places the
full filter form above results on phones, updates search after a 400ms debounce,
and uses a two-column desktop card grid. The proposal makes these choices explicit:

- Submit the query/location with Search services; commit filter drafts with Apply
  filters. This replaces automatic requests while editing, including AI Search.
  Existing results/chips should continue describing the last applied search until
  the next apply. Clearing an applied chip runs the corresponding updated search.
- Move phone filters into a modal panel so results begin sooner. Closing it keeps
  draft choices for the next opening; Reset clears its draft; Apply commits it.
  Changing the query should not silently commit unapplied filter drafts. The
  standalone preview simplifies this separation by committing its controls together.
- Use larger comparison rows and one main card action, View details. Details then
  offers Choose a time, maintaining the existing booking flow. If direct card
  booking is preferred, it can be retained during design revision.
- Keep real availability separate from booking method. Do not show an unconditional
  “Available today” label or imply a slot/remaining capacity from general service
  metadata. Show actual time/capacity only when the relevant API confirms it.

No new backend endpoint, filter dimension, pricing system, pagination, favorites
or account feature is proposed. Preserve the current sort choices (default, both
distance directions, both price directions and both rating directions), existing
31-day range validation, category source, provider routing, API limits, truncated
result notice and authorization. Distance sorting remains unavailable without a
resolved location. Location text alone is not a resolved geographic position.
The preview uses dollars because current cards use `$`; currency changes need
separate product/API agreement. Do not infer currency from the example city.

## What the preview demonstrates

The file is a visual prototype, not a replacement frontend. It supports:

- Category/session-type filtering over three synthetic records, sorting, filter
  chips, list/map switching, map selection and a service-details dialog.
- Draft input, Apply/Reset, date-range validation and native keyboard controls.
- Locale switching without clearing inputs, plus example loading/empty/error states.

Query/AI matching, audience, radius, schedule availability and geocoding are visual
examples; no real semantic matching, spatial search or scheduling runs. Booking,
provider and account actions show preview feedback. Final application behavior
must use the existing validated APIs. The review-toolbar text is English; the
product preview is supplied in English, Latvian and Russian. Translation quality
still benefits from native-speaker review. The other eight languages are deferred
under the user's current testing instruction.

## Scope, approval and recovery

Approving party for this proposal work: user, requesting design files for `/search`.
Executor: assigned Front End Developer `/root`. Environment: local repository.
Allowed operations: read-only application review, standalone HTML/Markdown design,
synthetic screenshots and focused isolated preview checks. No application source,
backend, ORM/database, connected session, geolocation, paid API, infrastructure or
deployment changes. Existing shared work is preserved. Recovery: remove only these
new search-design artifacts and undo the small optional static-HTML extension to
the existing browser harness plus this task's status entry.

The user selected **option A's layout direction** on 20 October 2026.
The subsequent “Go ahead and implement as planned” instruction approved the
interaction changes and assigned the local frontend implementation to `/root`.
The original proposal-only boundaries above describe the earlier design phase;
the [implementation handoff](search-implementation-handoff.md) records current
approval, scope, validation and recovery. Deployment remains on hold.

## Verification

Reused `scripts/fixtures/browser-harness.mjs`, adding an optional static HTML input;
the existing bundled-fixture path remains unchanged. No new browser framework,
dependencies or separate harness. `scripts/preview-search-design.mjs` is the small
preview-specific check/capture script.

Installed headless Chrome: 4 behavior groups and 12 locale/viewport combinations
passed (en/lv/ru at 320, 390, 768 and 1280 CSS pixels). Checked message-key parity,
page/control reflow, category Apply/Reset, price sorting, details/dialog dismissal,
preview action feedback, map selection, phone filter initial focus/Escape/restoration
and the five recovery states. No unexpected requests or runtime exceptions.
Five synthetic screenshots were generated and visually reviewed.
[Machine-readable evidence](search-design-evidence.json).

Browser-connector inventory was empty; the existing isolated Chrome harness was
used. Automatic approval review allowed that runner outside the process sandbox,
where Chrome's crash handler can start. The disposable profile is cleaned up after
its resolved temporary path is validated. CSP denies network connections; no real
API or application server was exercised. Text values render through DOM text APIs;
the only HTML insertion is fixed local decorative SVG markup.

These checks validate a light-theme design preview only. Full application
integration, dark theme, physical devices, screen readers, actual zoom behavior,
comprehensive contrast/accessibility review and other browser engines remain
implementation/release work. Application type/build/regression suites were not
repeated for standalone design files.
