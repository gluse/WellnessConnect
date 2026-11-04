# Unrated service indicator — 3 November 2026

User specifically requested replacing “Not rated yet” with an empty or grey star.
Frontend executor `/root` accepted the local shared rating-component change and
offline/mocked verification. No backend/database work, connected operations,
private configuration or deployment is included.

Unrated services now show a 16px grey outline star. The existing localized text
remains the accessible name of a non-interactive image; it is no longer visible.
Rated services retain their filled star, numeric score and review dialog.
The shared component covers search list/grid cards, service details and other
existing consumers. No translation resources or rating rules changed.

Validation: the existing search/sorting regression, `npm run check` and
`git diff --check` pass. The synthetic search fixture has an optional unrated
service case. Chrome, Firefox and WebKit passed rendered list/grid/details checks,
localized accessible names in en/lv/ru and existing rated-service review behavior.
The list/grid matrix covers 18 combinations; the visible star has no fill and a
neutral grey stroke. The 360×800 Chrome screenshot was visually inspected.
Evidence:
[browser results](unrated-star-evidence.json) and
[360×800 preview](unrated-star-chrome-360x800.png).

Only en/lv/ru are checked. ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred.
All browser data is synthetic and external traffic blocked; physical devices
and screen readers are unverified. Recovery: reverse only the unrated branch,
its existing regression assertion, optional fixture case and task records.
Preserve unrelated navigation, dropdown and time-format work.
Completed locally; no remaining dependency. Next action is user review.
