# Development and browser security

Reviewed: 18 October 2026. Apply to installed versions, not every latest example.

## Repository baseline

Read-only evidence from `package-lock.json` and frontend configuration:

| Technology | Locked version/configuration |
| --- | --- |
| React / React DOM | 18.3.1 / 18.3.1 |
| TypeScript / Vite | 5.6.3 / 5.4.19; strict TS; ESM |
| Tailwind CSS | 3.4.17; project CSS variables and copied shadcn/Radix components |
| Radix Dialog / Select | 1.1.7 / 2.1.7; inspect other primitives individually |
| TanStack Query / wouter | 5.60.5 / 3.3.5 |
| React Hook Form / Zod | 7.55.0 / 3.25.76 |
| i18next / react-i18next | 25.7.3 / 16.5.0 |
| Detector / HTTP locale backend | 8.2.0 / 3.0.2 |
| react-test-renderer | 18.3.1; custom `node --import tsx` scripts |

Recheck the lockfile and import paths; this is not an advisory scan or proof of
installed/deployed packages. Current React documentation describes newer releases;
do not assume React 19 Actions/hooks/Compiler or Tailwind 4 configuration exists.

## Components, state, and forms

Derive values from props/state during render instead of mirroring them with Effects.
Put user actions in event handlers. Use Effects to synchronize external widgets,
listeners, or other systems; include correct dependencies and cleanup. Prevent
stale async work from updating a different route/account/workspace. Measure before
adding memoization. Keep local UI state separate from remote data.
Sources: [React state/effects](https://react.dev/learn/you-might-not-need-an-effect),
[Effect synchronization](https://react.dev/learn/synchronizing-with-effects).

Reuse RHF/Zod and UI field helpers where appropriate; use explicit labels, linked
help/errors, meaningful autocomplete/input modes, and retained input after failed
submits. Set invalid state and accessible error communication. Client validation
supports usability but never replaces server validation/authorization. Preserve
locale-aware human input versus normalized API values deliberately.
Source: [React Hook Form accessibility](https://react-hook-form.com/advanced-usage).

Use wouter's existing routes/navigation conventions. Preserve browser back/forward,
deep links, and allowed return URLs. Manage titles/focus for SPA transitions and
avoid discarding unsaved drafts without a deliberate flow.
Source: [wouter 3.3.5](https://github.com/molefrog/wouter/tree/v3.3.5).

## Data and cache boundaries

Query keys must identify changing query inputs: filters, paging, resource, and
account/workspace or locale when they change returned data. Coordinate keys with
the actual query function: this project's default helper fetches `queryKey[0]`,
so adding extra key parts alone does not add request parameters. Supply a suitable
function/URL when needed; don't let a new key fetch the old scope.
Source: [TanStack query keys](https://tanstack.com/query/v5/docs/framework/react/guides/query-keys).

Project-specific checks: global `staleTime: Infinity`, disabled focus refetch, and
disabled retries make explicit invalidation important. After mutations refresh
affected lists/details; handle 401/403 separately from transient failures. Remove
private cached results and cancel/ignore old requests on logout or scope changes.
Do not show optimistic success for payments/permissions without server confirmation.
Bound expensive lists/maps and debounce appropriate searches; confirm actual
behavior before caching, code splitting, or virtualization changes.

## Browser trust and security

Everything bundled for the browser is public. Never place secrets in `VITE_*`,
client code, assets, source maps, or generated configuration. Public Maps or
publishable keys need appropriate service restrictions; they are not user identity.
Source: [Vite 5 environment security](https://v5.vite.dev/guide/env-and-mode).

Use React text rendering or DOM `textContent` for user/provider/translation values,
including map previews. Audit escape hatches such as `dangerouslySetInnerHTML`,
`innerHTML`, executable strings, and unsafe URL protocols. Context-aware encoding
and reviewed sanitization are needed for justified rich HTML; HTML escaping alone
does not validate a URL. Avoid bypassing sanitizers or treating CSP as the sole
XSS defense.
Source: [OWASP XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

Do not store sensitive session identifiers/refresh tokens in browser storage.
Treat storage and received messages as untrusted, verify exact `postMessage`
origins/senders and payloads, and avoid wildcard delivery of private data. Keep
secrets/private payloads out of analytics/console logs and request only necessary browser permissions
through an appropriate user flow.
Source: [OWASP HTML5 security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

Preserve the existing HttpOnly server-session contract and CSRF flow. Browser route
guards, disabled controls, and client roles cannot authorize a backend operation.
Coordinate CSP, cookies, redirect validation, and external scripts with Backend/
CI/CD. Review dependencies and third-party widgets without broad automatic upgrades.
