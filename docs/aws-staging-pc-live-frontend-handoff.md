# TASK-036 live frontend acceptance — 6 November 2026

Status: **scoped live guest frontend acceptance passed** after Root reported
deployment1 ACTIVE, exact registered image, and independent password-gateway
checks passing. This accepts the guest smoke below, not untested authenticated
or external-provider flows.

Later user feedback exposed repeated HTTP Basic prompts. The smoke's automatic
CDP auth handler answered every challenge and did not assert challenge counts,
so this scoped rendering acceptance did not cover single-prompt usability.
See the [local reproduced cause and fix boundary](aws-staging-basic-auth-diagnosis.md).

Requester/coordinator: `/root`; assigned Front End Developer executor:
`/root/aws_pc_live_frontend`. Accepted under AGENTS standing cooperation for the
already selected restricted staging environment. Read the frontend role, project
frontend skill and testing/device/i18n references, plus
[current build evidence](aws-staging-pc-build-handoff.md),
[deployment approval](aws-staging-deployment.md), task and coordination records.

Added `scripts/test-aws-staging-guest-browser.mjs`; Node syntax and scoped
diff checks pass. No frontend application/source configuration changed. The
runner requires an explicit active/gateway flag, uses an isolated headless Chrome
profile, reads only the protected staging-access handoff, handles HTTP Basic
credentials in memory, and closes/removes its own verified temporary profile.
It allows only same-origin GET/HEAD and four named read API routes; all external
requests and mutations fail closed. No user credentials are assigned or invented.
Normal uninitialized guest session behavior is covered by the existing named
development-target approval, but no login/signup/OAuth/email/booking/content write
will be attempted.

Completed live acceptance: login rendering and native language changes in en/lv/ru
at 320/390/1280 CSS pixels, labels/lang/direction/reflow, keyboard focus and empty
native validation without submission, guest landing and local entry links,
document/static/read API status and browser runtime errors. Screenshots and
filtered evidence are saved only under ignored
`outputs/aws-staging-build/live-frontend/`; no password, headers, cookies, tokens,
API response bodies or private user values are included in evidence.

Executed the final runner on6November2026, exit0:

```text
node scripts/test-aws-staging-guest-browser.mjs --active-gateway-verified
```

Chrome156.0.8078.80 on Windows, isolated headless profile. Nine locale/viewport
cases passed (en/lv/ru x320/390/1280). Fields remained at least250 CSS pixels wide
at320, all tested pages had no horizontal overflow, and translated login headings,
field labels, native selector, document language/direction and controls rendered.
Keyboard Tab moved to an operable control; empty form native validity focused
email without submitting. Guest landing rendered at all three widths; search
entry stayed local and its category read completed successfully.

Live HTTPS documents, production JS/CSS, en/lv/ru locale resources, provider
discovery and category read returned200; guest auth-user returned expected401.
Zero browser runtime exceptions, zero unexpected/blocked requests. No mutation,
email, OAuth, signup or app login request was sent. No manual app/database process
started and the isolated browser profile was removed after the run.

Viewed all six final login screenshots (390 CSS pixel phone and1280 desktop in
each of en/lv/ru). Layout, labels and controls are legible and uncut in those
captures. Programmatic320 reflow passed; no320 screenshot or native mobile device
claim. Initial smoke also passed, then the runner was completed to wait for
category results and capture phone visuals; the final successful evidence
supersedes the initial narrower capture. No failed live acceptance was hidden.

Evidence: `outputs/aws-staging-build/live-frontend/evidence.json` and six
`login-{en,lv,ru}-{phone,desktop}.png` files in the same ignored directory.
This smoke verifies the scoped rendered login localization, not complete
translation coverage of every guest landing string or native-language quality.

Repository auth code uses `${APP_URL}/api/callback` for signup email redirects,
social OAuth and magic-link recovery. The exact generated AWS callback must be
allowed in Supabase Auth Redirect URLs. Setting APP_URL in the application does
not establish that remote allowlist. Root was notified; this role will not mutate
Auth/cloud configuration or claim those flows passed without separate evidence.
Verified the current [Supabase redirect documentation](https://supabase.com/docs/guides/auth/redirect-urls)
(updated30October2026): `redirectTo` must match the Redirect URLs list. Adding the
exact staging callback does not require replacing the shared development Site
URL. Email templates that use SiteURL instead of RedirectTo are a separate
possible email-flow limitation; no email-template configuration was inspected.

Only en/lv/ru were tested. ar (including RTL), zh, fr, de, hi, ja, pt and es are
deferred. This smoke is not physical-device, Firefox/WebKit, screen-reader,
native-language quality or WCAG conformance verification. Existing backend/DB
and infrastructure holds stay in effect. Root owns shared task/coordination
updates and release/publication decisions. Recovery is removal/reversion of this
scoped test and handoff only; preserve the frozen build and unrelated work.
