# Audit viewer frontend completion — 7 November 2026

User authorization, environment, owners and recovery:
[integrated record](audit-review-completion-2026-11-07.md). Frontend accepted the
Audit section; Root completed final usability, translations and verification
after agents reached a usage limit. Existing unrelated reports/location work was
preserved. No connected UI sessions/rows or production deployment were created.

The account menu offers **Audit** to designated readers. Administration contains
an independent Audit section at `/administration?section=audit`; app-admin
directory/category/subscription tools remain separately protected. Unauthenticated
and expired audit links preserve the exact audit destination after sign-in.

The main query shows UTC dates, a readable activity selector and result selector.
Advanced user/workspace/object/request/operation/source filters are collapsed by
default. Applied query is shown separately from drafts, with explicit search,
refresh and stable cursor paging. Records explain the concrete activity, result,
actor evidence, target and scope, with details/expiry/redacted changes and related
object/request history. Database events never invent a human actor. Request/intent
events explicitly do not prove completion. CSV export requires separate permission
and explains the newest1,000-record limit and sensitive downloads.

No previous rows are displayed after read failure, account change or lost access;
in-flight account responses cannot restore old private data. Requests and export
are abortable; automatic mutation retry is not introduced. Strings render through
React text, with no HTML sinks or browser database credentials. Query caches are
identity-scoped and ephemeral. There are no event edit/delete controls.

`node --import tsx scripts/test-audit-viewer-browser.mjs` passed isolated Chrome
en/lv/ru at320/768/1280 CSS widths. Covers filters, draft/apply behavior, UTC stable
pagination, redacted details, request/object history, download, independent reader/
export permission, empty/error/denied/unavailable, keyboard date-field order,
reflow, account switch and late stale response. Additional en/lv/ru cases verify
concrete read/DB/auth-intent/integration titles and unknown human attribution.
APIs are mocked, with no unexpected external requests or fixture writes.

Screenshots inspected: `output/audit-viewer/audit-desktop.png` and
`audit-phone.png`. Existing Administration regression and storefront frontend
regression passed. Category and guest-search legacy runners encounter unrelated
stale assumptions: category test expects Radix SelectContent for the search
selector that is currently native; guest test supplies old array search responses
instead of the current paged response. Their audit-capability mocks were updated,
but those broader baseline failures are not represented as passing coverage.

Audit resources are maintained for all supported languages. **Fresh tests cover
only en/lv/ru**; ar/RTL, zh, fr, de, hi, ja, pt and es are deferred. No physical
device, screen reader, Firefox/WebKit, qualified linguistic/legal review or general
Administration localization certification is claimed. Existing location-permission
browser UI is not wired to the prepared observation endpoint in this release.
