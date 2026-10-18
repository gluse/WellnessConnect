# Multilingual interfaces and direction

Reviewed: 18 October 2026. Project sources: `client/src/lib/i18n.ts`, language picker,
and `client/public/locales/<language>/translation.json`.

## Current contract and translation coverage

Configured languages are `en`, `lv`, `es`, `zh`, `hi`, `ar`, `pt`, `ru`, `ja`, `de`,
and `fr`, with English fallback. Resources load over HTTP; the detector checks
local storage, navigator, then HTML language. Verify current behavior before edits;
configuration alone does not establish complete translations, RTL, or formatting.

Use semantic stable keys and whole messages. Avoid concatenating English fragments
or interpolating already-translatable words into fixed grammar. Use interpolation
for runtime values and context/separate messages when grammar needs them. Provide
translator context for ambiguous actions and preserve placeholders across locales.
Source: [i18next practices](https://www.i18next.com/principles/best-practices).

Use i18next plural rules with the `count` option and the configured JSON suffix
format. Supply locale-required forms rather than enforcing identical plural keys
across all languages. Test 0, 1, 2, several, large, and fractional counts where
relevant, particularly Arabic and Russian. Avoid manual English `s` suffixes.
Source: [i18next plurals](https://www.i18next.com/translation-function/plurals).

Translate visible labels, headings, empty/loading/errors, toasts, placeholders,
titles, alt text, and accessible names/help. Stable API codes and stored domain
values remain separate from presentation. Do not blindly translate user content,
names, IDs, or backend raw error text. Verify changed messages in all supported
locale resources; English fallback can hide missing keys. Mark machine/unreviewed
translations honestly instead of claiming linguistic validation.

## Language changes and loading

Honor an explicit language choice over detection and persist only the appropriate
preference. Show native language names rather than flags alone. Handle regional
tags/fallback deliberately and retain drafts/selection/focus when changing language.
Avoid showing raw keys during resource loading or silently treating a failed load
as successful translation coverage. Use `useTranslation` readiness/Suspense behavior
compatible with the application; module-scope translated strings will not update
themselves when the language changes.
Source: [react-i18next hook](https://react.i18next.com/latest/usetranslation-hook).

Synchronize the document's `lang` with the resolved supported language and mark
different-language passages where needed. Keep titles/accessibility announcements
aligned after changes. Language and direction are separate properties.
Source: [W3C language declarations](https://www.w3.org/International/questions/qa-html-language-declarations).

## RTL and mixed content

Set document `dir` appropriately, using i18next direction information where useful.
Support Arabic as a real RTL layout. Check portaled dialogs, selects, calendars,
and direction-sensitive library controls as well as the document root; verify their
installed direction APIs instead of flipping the entire page with transforms.
Source: [W3C structural direction](https://www.w3.org/International/questions/qa-html-dir).

Use logical start/end margins, padding, alignment, and borders when semantics are
direction-dependent. Mirror directional navigation icons where appropriate, but
do not mirror maps, logos, media, or every numeric/time axis indiscriminately.
Source: [CSS logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

Isolate unknown user names, email/URLs, references, and other mixed-direction text
with appropriate `bdi`/`dir="auto"` markup; use explicit LTR only for content whose
direction is known. Test punctuation, parentheses, numbers, and editable fields in
RTL. Avoid invisible direction characters as a substitute for sound markup.
Source: [W3C inline bidirectional markup](https://www.w3.org/International/articles/inline-bidi-markup/).

## Formatting, space, and trust

Use `Intl.NumberFormat`, `Intl.DateTimeFormat`, and related locale APIs with explicit
currency/unit/timezone when required. UI language does not select currency or an
appointment's timezone. Do not parse formatted display strings as canonical money
or dates; preserve API precision and date-only versus instant semantics. Test
ambiguous dates, separators, month/day order, and DST boundaries in booking flows.
Source: [Intl APIs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl).

Allow wrapping and content growth; avoid fixed control widths/heights that clip
translations. Test expanded/pseudo-localized text, German/French labels, Arabic
direction, and CJK/Devanagari glyphs, line breaking, and font fallbacks. Preserve
diacritics and Unicode names; do not use ASCII-only assumptions for display data.

The project sets `escapeValue: false`: ordinary React text rendering handles HTML
escaping, but raw HTML/DOM sinks do not become safe. Treat translation resources
as a controlled input path; do not feed arbitrary user content into executable or
HTML contexts.
Source: [i18next interpolation](https://www.i18next.com/translation-function/interpolation).

For rich translated messages prefer controlled `Trans` components over raw HTML.
Translations can override component props, including link destinations; constrain
allowed props/URLs and review resource changes as code-bearing inputs.
Source: [react-i18next Trans](https://react.i18next.com/latest/trans-component).
