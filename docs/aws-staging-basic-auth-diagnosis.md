# TASK-036 repeated staging-password prompts — 6 November 2026

Status: **cause reproduced locally**; no application or gateway fix/deployment
performed. Requester: user through Root. Assigned frontend diagnosis executor:
`/root/aws_pc_live_frontend`, under the existing scoped frontend ownership.
Root owns infrastructure review. No live AWS, database, auth endpoint or private
handoff access was used for this diagnosis.

Later user explicitly requested publishing the cookie fix. Current implementation,
verification and controlled deployment are tracked in the
[session release record](aws-staging-session-release.md); statements below retain
the original diagnostic checkpoint.

Subsequent user-authorized cookie-fix verification is tracked separately in the
[staging-session frontend handoff](aws-staging-session-frontend-handoff.md).
The diagnosis below preserves the pre-fix behavior.

The outer gateway uses browser HTTP Basic authentication. The application uses
its own session authentication and returns HTTP401 JSON for an unsigned-in user
or rejected login. Its response has no WWW-Authenticate header. The gateway
currently forwards that application status unchanged. The client already uses
`credentials: "include"` for both query GETs and mutation POSTs.

An isolated Chrome156.0.8078.80 test ran the **actual**
`deploy/aws/staging-proxy.mjs` before a minimal local mock app. Both servers bound
only to127.0.0.1 on ephemeral ports; Basic credentials were generated dummy values
held in memory. Browser traffic was restricted to those local servers. Recorded
only method/path, status, challenge counts and Authorization-presence/validity
booleans; no password, Authorization value, cookie or request body was logged.
All browser/server processes and the test's verified temporary profile closed.

| Browser step | First request carried valid Basic | Application status / challenge header | New browser auth challenges |
| --- | --- | --- | --- |
| Initial document | No; authorized retry follows | Gateway challenge then app200 | 1 |
| Baseline GET200 | Yes | 200 / none | 0 |
| Baseline POST200, credentials include | Yes | 200 / none | 0 |
| GET401 | Yes | 401 / none | 0 |
| Next good GET | **No**; authorized retry follows | Gateway challenge then app200 | **1** |
| POST401 | Yes | 401 / none | 0 |
| Next good GET | **No**; authorized retry follows | Gateway challenge then app200 | **1** |
| Repeated POST401 after another POST401 | **No**; authorized retry follows | Gateway challenge then app401 | **1** |

The observed condition is application401 invalidating Chromium's cached HTTP
Basic credentials. A subsequent request therefore omits Basic; the gateway
correctly rejects that request and asks the browser for the staging password
again. POST supports cached Basic normally; it is not missing credentials mode.
All requests that reached the mock application had Basic stripped by the gateway.

Root independently verified the relevant current Chromium implementation in
[http_auth_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/net/http/http_auth_controller.cc).
The local evidence is the primary reproduction; loopback HTTP is not a live AWS
TLS test and does not establish behavior in every browser.

Evidence: ignored `outputs/aws-staging-build/basic-auth-diagnosis.mjs` and
`outputs/aws-staging-build/basic-auth-diagnosis-evidence.json`. Exact command:
`node outputs/aws-staging-build/basic-auth-diagnosis.mjs`, exit0. No application
code changes, staging credentials, app-user credentials, external email/OAuth,
session/database writes or live fix were involved. No language matrix rerun;
en/lv/ru scope and all other locale/RTL deferrals remain unchanged.

## Fix boundary and previous verification gap

A fix can stay in gateway infrastructure by granting its own short-lived signed
HttpOnly/Secure staging-access cookie after correct password authentication,
checking that independently of the browser's Basic cache and keeping application
401s intact. Root must review the token signing, expiry, cookie scope/flags,
verification/tamper/failure paths, and removal of that gateway cookie before
forwarding upstream. That is a proposed infrastructure design, not an approved
security-policy change or implemented fix.

Changing every forwarded application401 to403/another status would avoid the
browser cache effect but is not transparent to this application: queryClient
interprets401 as logged out and login maps401 to invalid credentials. Such a
status-rewrite design needs an agreed frontend/backend contract. Simply removing
WWW-Authenticate from application responses cannot fix this case because the
reproduced responses already omitted it.

The earlier live guest smoke's CDP auth handler automatically supplied the
staging password for **every** browser Basic challenge. It verified restricted
access and UI rendering but did not assert challenge counts, so it masked this
repeated-prompt usability problem. Its scoped rendering results remain valid;
they were not proof of a single-prompt authentication experience. Root was
notified of this gap before any fix or new deployment.
