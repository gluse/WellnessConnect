# TASK-036 staging-session browser regression — 6 November 2026

Status: **local HTTPS regression and live deployment4 guest acceptance passed**
for Root's secure staging-cookie implementation.
Requester/coordinator: `/root`; assigned frontend verification executor:
`/root/aws_pc_live_frontend`. User requested publication of the repeated-password
prompt fix. Scope accepted under AGENTS standing cooperation. Root owns gateway
implementation, configuration, image publication and deployment; this role owns
only browser regression scripts and frontend handoff documentation.

No application frontend/backend behavior, HTTP status policy or private runtime
input changed in this verification. The original reproduced cause and earlier
smoke gap are preserved in [the diagnosis](aws-staging-basic-auth-diagnosis.md).

## Local proof

Added `scripts/test-staging-session-browser.mjs`. It uses the actual gateway
request handler before a minimal mock app, over HTTPS loopback with a generated
temporary self-signed certificate. Only that certificate's SPKI is allowed in
an isolated headless Chrome profile; external traffic is blocked. Basic password
and signing secret are generated dummy values held in memory. No staging private
handoff, real login credential, database, AWS or external auth request is used.

Executed once after Root signaled implementation ready, exit0:

```text
node scripts/test-staging-session-browser.mjs
```

Chrome156.0.8078.80, eleven fetch steps plus the initial document. Initial
navigation deliberately returns application401 without WWW-Authenticate. The
gateway still mints its session after valid Basic, and Chrome stores it. Exactly
one initial browser auth challenge occurs. GET/POST200 and repeated GET/POST401
followed by good GETs preserve their statuses with zero further prompts while
the staging cookie is valid. Those reads/posts rely on the cookie after Chromium
has cleared Basic; the reproduction's failure condition is therefore exercised.

Verified `__Host-fmt-staging` is Secure, HttpOnly, SameSite=Lax, Path=/, host-only
and absent from document.cookie. Initial app Set-Cookie is preserved; subsequent
app cookie reaches the mock app. Basic and the gateway-owned cookie never reach
the mock app. Cookie expiry remains unchanged after a15-minute injected-clock
advance and a normal read. At61minutes, the browser still carries the old cookie
but the gateway rejects it by its absolute server-side age; the next protected
GET produces exactly one new challenge, accepts the password and succeeds.

All test servers, browser, temporary profile and generated TLS material were
closed/removed. No cookie values, passwords, Authorization headers or mock body
were logged. Filtered evidence:
`outputs/aws-staging-build/staging-session-browser-evidence.json`.
The loopback certificate pin is test-only and is not used in the live runner.

Read-only gateway review is consistent with the observed browser contract:
dedicated signing key, origin/username/password-verifier binding, fixed one-hour
expiry and upstream stripping. Root owns additional signature tamper, duplicate
cookie, key/password/origin rotation and fail-closed unit coverage. This browser
proof does not substitute for those infrastructure tests or cross-browser review.

## Live acceptance preparation

Updated the existing `scripts/test-aws-staging-guest-browser.mjs` to assert
**exactly one** auth challenge for the whole guest smoke, and verify the secure
HttpOnly staging cookie is stored and not script-visible. This closes the
earlier smoke gap where CDP silently answered every challenge. Both scripts pass
Node syntax and scoped diff checks. No live run against the replacement version
had occurred at the preparation checkpoint; the completed result follows below.
The replacement smoke writes `outputs/aws-staging-build/live-frontend-session/`,
preserving the original gateway's `live-frontend/` evidence and screenshots.

Root released live traffic after reporting deployment4 ACTIVE/RUNNING, no next
deployment, exact gateway image `:fitsmytime-staging.app.2`, independent cookie,
gateway and audit-health checks passing. Root reported app/audit images and
configuration preserved from the user's existing deployment2; only gateway
image/signing-key intent changed. This frontend role did not independently read
secret-bearing AWS deployment responses.

Executed on6November2026, exit0:

```text
node scripts/test-aws-staging-guest-browser.mjs --active-gateway-verified
```

Chrome156.0.8078.80 at the existing AWS HTTPS origin. **Exactly one initial staging
challenge** across the entire guest session, including application auth-user401
and later page/resource requests. Secure/HttpOnly/SameSite=Lax/Path=/ staging
cookie stored and absent from document.cookie. Nine en/lv/ru login cases at
320/390/1280 CSS pixels passed heading, labels, language/direction, field widths
and reflow. Keyboard focus and empty native validity passed without submission.
Guest landing rendered at all three widths and categories read returned200.
Production documents/assets, en/lv/ru resources and provider discovery returned
200; auth-user401 was expected. Zero browser runtime errors, zero unexpected or
blocked requests. Reviewed all six final phone390/desktop1280 screenshots; text,
fields and controls were legible and uncut. Google option rendered from the
preserved provider configuration; it was not clicked or exercised.

Filtered evidence: `outputs/aws-staging-build/live-frontend-session/evidence.json`,
SHA256 `9ED608DC87AEB21BEE4576799D1684C6A16AF02FC175F01E58D5F6D3601635EF`,
plus six screenshots in the same ignored directory. Original release's
`live-frontend/` evidence remains untouched. No password, signing key, cookie
value, Authorization header, auth submission, live POST401, email or OAuth action
was included. The temporary browser profile was removed.

The repeated POST401 condition is covered by the local mock above, not a real
login attempt that could write audit records. This role did not verify Supabase
allowlist, OAuth/email delivery or successful app sign-in. Other languages and
Arabic RTL remain deferred; no physical mobile, Firefox/WebKit or screen-reader
claim is made. Root owns shared release/task records and rollback decisions.
Recovery for this role is reverting its two test files/docs only, preserving
unrelated work and runtime state.
