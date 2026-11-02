# TASK-036 frontend staging build handoff — 31 October 2026

Status: completed local frontend build compatibility verification. No frontend
source/configuration/translation changes, private configuration reads, application
startup, connected services, database operations or deployment were performed.

## Assignment and limits

Requester/coordinator: Codex `/root`. Assigned Front End Developer/executor:
`/root/aws_staging_frontend`. The owner accepted the scoped dependency through live
agent tools under AGENTS standing cooperation after the user selected the
restricted Lightsail staging site and existing development projects.

Scope: verify the current frontend's production build without reading `.env`
files or invoking connected application behavior. Root owns infrastructure,
source packaging and deployment; this return does not grant frontend ownership
of those operations or change existing public release/privacy holds.

Read the Front End Developer role, project frontend-practices skill, testing
reference, Vite/TypeScript/Tailwind/PostCSS configuration, client entry point and
privacy-plugin behavior before execution. No broad test runner was invoked.

## Isolation and evidence

Copied only `client/`, `shared/`, the four build/type configuration files,
`package.json` and `scripts/privacy-policy.ts` into a fresh ignored directory:
`node_modules/.cache/aws-staging-frontend-8BBYap/`. Copying rejected symlinks and
excluded `.env*`, Git/dependency directories and sensitive certificate/key/dump
extensions. Installed repository dependencies were resolved from the parent
tree; no dependency installation or lifecycle hooks ran.

The child build environment contained only Windows execution/path/temp variables,
`NODE_ENV=production` and explicit empty public privacy fixtures. It did not
inherit VITE, database, provider, credential or private privacy values. The Vite
privacy plugin's root/env lookup therefore stayed inside the isolated snapshot,
which contains no private env files. There were no browser, API or app requests.

Snapshot: **188 files / 1,441,066 bytes**. Sorted per-file content manifest digest:
`3054ab15bcf086d4057c8e39a118373d2e678f76709906ef2ce7eb9db199c51a`.
The snapshot's `build-evidence.json` contains build metadata only, no secrets.

| Check | Result |
| --- | --- |
| Isolated production Vite CLI, using the copied project's config | Pass, exit 0; Vite 5.4.19, 2,811 modules transformed, 17.26 seconds |
| Built `index.html` and asset output | Present |
| Generated privacy page with empty fixture details | Visible draft and `noindex, nofollow`, as expected for this restricted staging build |
| Production asset source maps | None emitted |
| Isolated TypeScript 5.6.3 over `client/src/**/*` and `shared/**/*`, `noEmit`, incremental cache disabled | Pass, exit 0 |

Command forms executed through a sanitized child process:

```text
node <repo>/node_modules/vite/bin/vite.js build --config <snapshot>/vite.config.ts
node <repo>/node_modules/typescript/bin/tsc --project <snapshot>/tsconfig.frontend-check.json
```

The TypeScript fixture retained the copied project's compiler options and path
aliases, restricted includes to frontend/shared, and disabled incremental writes.
It did not import or start application/backend entrypoints for execution.

Existing non-failing Vite warnings remain: Browserslist's caniuse-lite data is
reported 24 months old, and the minified main JS chunk is approximately 932.80 kB
(269.84 kB gzip), exceeding the default 500 kB warning threshold. No dependency
update or code-splitting change belongs to this build-only request.

## Limits, recovery and next owner

This establishes local frontend build/type compatibility for the captured source.
It does not prove a Docker build, Linux runtime, full-stack startup, TLS/proxy
behavior, browser/device/accessibility behavior or successful AWS deployment.
No fresh component/browser or language acceptance matrix was run. Future language
checks remain **en/lv/ru**; **ar/RTL, zh, fr, de, hi, ja, pt and es** are deferred.
Supported locale files were preserved/copied for packaging, not newly validated.

The draft privacy output remains behind staging access restriction. Public policy
configuration and public release/privacy acceptance remain separate requirements.
The build has no frontend `VITE_*` credential requirement; runtime API/provider
configuration remains owned by Backend/infrastructure.

Root next captures the final immutable build source, verifies its Linux container,
deploys only after owner preflight/access controls pass, and records actual live
checks. Any later frontend source/config change needs affected checks again.
Recovery is removal of this handoff and the named ignored snapshot if desired;
no source, database or deployed resource rollback is required for this review.
