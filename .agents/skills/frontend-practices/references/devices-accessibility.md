# Devices, layout, and accessibility

Reviewed: 18 October 2026. Aim for usable interfaces across the agreed audience
and WCAG 2.2 AA for changed flows; this is not a conformance certification.

## Responsive behavior

Use content-driven breakpoints and fluid grid/flex layouts. Tailwind 3 is mobile
first: unprefixed utilities define the base, and breakpoint prefixes apply from
their minimum width. Do not treat `sm:` as a small-phone-only selector. Prefer CSS
for presentation; use JS media queries only when behavior needs them, with cleanup.
Source: [Tailwind 3 responsive design](https://v3.tailwindcss.com/docs/responsive-design).

Keep task content/actions consistent across widths. Avoid user-agent sniffing and
device-name assumptions. Provide touch/keyboard alternatives to hover and dragging;
hybrid laptops may have coarse/fine pointers. Use appropriate image sizes/aspect
ratios, bounded overlays, and stable layout; make dense tables/calendars usable
without hiding essential data. Check low bandwidth and content-loading states.
Source: [web.dev responsive design](https://web.dev/learn/design/).

Account for virtual keyboards, dynamic viewport height, browser chrome, and safe
areas. Fixed bottom navigation must not cover inputs, errors, or submit actions.
Use safe-area `env()` values with suitable fallbacks where needed; verify actual
target browser support and portrait/landscape behavior.
Source: [CSS environment variables](https://developer.mozilla.org/en-US/docs/Web/CSS/env).

## Semantics, focus, and input

Prefer native buttons/links/inputs with real labels, landmarks, headings, and clear
names. Preserve visible focus and logical reading/tab order when rearranging CSS.
Keep errors associated with fields and announce meaningful asynchronous status.
Do not rely on color alone. Avoid disabling zoom or forcing an orientation.

Check reflow at 320 CSS pixels and text resizing to 200%; a 1280px-wide viewport at
400% zoom is a useful reflow check. Truly two-dimensional maps/tables may need
scoped scrolling, without causing the surrounding page to overflow. Normal text
needs 4.5:1 contrast; large text and applicable non-text UI need 3:1. Meet the
24-by-24 CSS pixel target-size requirement or its defined spacing/other exceptions;
prefer larger touch areas when practical. Focus must not be entirely obscured.
Source: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Reuse existing Radix/shadcn controls, but supply accessible labels and descriptions
and preserve semantics/keyboard support when composing them. Their presence does
not prove the final page is accessible. Check `asChild` forwarding and custom
handlers against the actual installed primitive contract.
Source: [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility).

For modal dialogs, place initial focus intentionally, contain keyboard focus,
support Escape as appropriate, and restore focus to the trigger or logical next
element. Keep the dialog titled and background interaction inert. Adapt long
content without hiding its top or trapping a control behind a virtual keyboard.
Source: [WAI-ARIA modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Respect reduced-motion preferences, including transitions and animated charts;
essential meaning must remain understandable without motion.
Source: [Reduced-motion guidance](https://web.dev/articles/prefers-reduced-motion).

## Verification matrix

Choose a documented matrix for the affected flow. If none is defined, start with
representative small-phone, tablet, and desktop widths; portrait/landscape; touch,
mouse, and keyboard; and maintained Chromium, Firefox, and WebKit-based browsers
where available. Check just below/above breakpoints and long localized content.
This is a practical starting matrix, not a claim of support for every device.

Use browser tools/emulation to find viewport, locale, color-scheme, touch, and
motion issues. Record what actually ran. Emulated mobile/WebKit is not proof that
physical iOS Safari, Android, screen readers, or virtual keyboards were tested.
Source: [Playwright emulation](https://playwright.dev/docs/emulation).

For maps/calendars, preserve a usable list/form alternative and meaningful
keyboard interaction. Manually check critical focus and reading flows alongside
automated checks; screenshots alone cannot establish operability.
