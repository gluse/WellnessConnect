# TASK-047 backend release review

Reviewed: 8 November 2026 (Europe/Riga). Executor:
`/root/release_backend_review`, assigned Back End Developer by Root. Scope accepted
through live collaboration under [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization).

Root reports the user's selected planning requirements: **99.9% monthly
availability**, **EUR 100–300/month operating budget** excluding development and
store fees, and **worldwide readiness with an initial Latvia/EU launch**. These
choices do not authorize spending, production provisioning or connected access.

Initial scope: read-only backend review, inspected existing offline/mocked checks,
and this review document. Root subsequently accepted a narrow local test repair:
`scripts/test-booking-capacity.mjs` fixture adapters only. No application,
dependency, configuration, schema or credential changes were authorized or made.
No environment file, application startup, live provider/database, or deployed
service was used. Preserve other sessions' dirty work.

## Findings and release consequences

### 1. Confirmed: pagination cannot move between app instances

[service.ts](../server/search-pagination/service.ts:18) generates a random cursor
signing secret per service instance; embedding contexts are kept in an instance
`Map` at line 19. [routes.ts](../server/search-pagination/routes.ts:10) constructs
the service without shared options.

An offline reproduction using the **real** `createSearchPageService` and synthetic
rows/store confirmed both outcomes:

- A normal first-page cursor produced by instance A is rejected by default
  instance B as `400 INVALID_SEARCH_CURSOR`.
- Supplying the same signing secret to both instances fixes that signature
  mismatch, but a semantic-search cursor still fails on instance B as
  `410 SEARCH_EXPIRED`, because B does not have A's embedding context.

A restart similarly discards both defaults. Scaling instances or rolling a new
release can therefore interrupt valid continuations within the intended ten-minute
TTL. Sticky routing alone does not provide restart/failure continuity. This is a
confirmed scale/release blocker, not a measured database performance problem.

**Backend/DB/CI next contract:** select the smallest compatible way to make cursor
verification and bounded semantic context available across healthy instances and
deployment overlap. Preserve opaque, tamper-resistant, filter-bound cursors,
privacy, expiry, memory/storage bounds and current currency/visibility checks.
Use a shared signing key with reviewed rotation and either a shared expiring
context adapter or a separately reviewed stateless design. A new service or
security-policy choice requires the corresponding selection. Add two-instance,
restart/rotation, expiry and changed-filter regressions before increasing replicas.

Reproduction: an inline `node --import tsx --input-type=module` command imported
only the pager, used two synthetic EUR service DTOs and a fake `rows/hydrate` store,
created two default instances, then two instances with `Buffer.alloc(32, 5)` as a
synthetic shared secret, and asserted the two status/code pairs above. Exit 0.
The first fixture attempt omitted `currency` from hydrated DTOs and correctly hit
`SEARCH_CURRENCY_CHANGED`; supplying matching EUR DTOs completed the intended
replica test. No real key or persistence was used.

### 2. Confirmed: the existing browser auth contract is not a native-app contract

[auth.ts](../server/auth.ts:101) rejects non-read requests with cross-site Fetch
Metadata or a nonmatching Origin. Lines 118–120 use a PostgreSQL session and
HttpOnly, Secure-in-HTTPS, SameSite=Lax cookie. These browser protections must
remain. [The OAuth flow](../server/auth.ts:177) stores PKCE state in that server
session, uses the hosted `/api/callback`, and redirects to an allowed website path
at line 283. No native-app handoff or native-session authentication branch was
identified in this bounded review.

An app fetching directly from its local packaged origin does not satisfy the
current same-origin POST contract. A system browser completing OAuth does not
prove that the packaged WebView/native transport obtained its authenticated
session. Return-link wiring and a CORS allowlist alone are insufficient.

**Proposed option A, recommended for the mobile proof; not selected:** retain the
website cookie contract, and add a small explicit native authentication/transport
boundary using an opaque app-session credential held in native protected storage.
Supabase access and refresh tokens remain server-side. The shared React code uses
an adapter to request API operations; it does not obtain a credential getter.

Proposed flow and invariants:

1. The native adapter creates an authentication-attempt verifier and challenge.
   A bounded/rate-limited backend start operation binds the challenge, intended
   app identity, exact approved return link and browser OAuth transaction.
2. Open OAuth in the system browser. The server callback verifies provider/PKCE
   state and identity using the existing provider policy. Cancellation or failed
   capture must never become successful authentication.
3. Return only a short-lived, single-use, attempt-bound **handoff code** through
   an OS-verified universal/app link. Do not include a provider token, app-session
   credential, existing website session ID, account data or arbitrary redirect in
   the URL. Treat returned links as untrusted input.
4. The native adapter redeems the code with its verifier over the pinned HTTPS API
   origin. The backend atomically consumes the code and creates a revocable app
   session. Replay, expiry, wrong verifier, wrong app/return link and cross-account
   substitution fail without granting a session. Atomic cross-instance storage
   and expiry belong to the DB owner; concrete TTLs remain to be selected.
5. Keep the opaque app credential in native Keychain/Keystore-backed storage and
   attach it only through a constrained native HTTP boundary. Restrict destination,
   redirects and API operations; never forward it to signed upload URLs, analytics,
   external links or another host. JS may invoke authorized operations but must not
   read the credential. This does not eliminate XSS risk; compromised JS must not
   gain an unrestricted native proxy.
6. Backend authorization/audit policy remains shared with web. Revoke the app
   session on logout/account deletion or applicable security changes, clear private
   caches, and distinguish an unavailable identity provider from invalid identity.
   Prove process death/restart, app upgrade, concurrent expiry, lost-network
   completion and account switching without falsely reporting success.

**Alternative B:** exchange a bound browser handoff into a WebView/native cookie
session while retaining HttpOnly protection. Choose it only after demonstrating
actual cookie-store behavior, credentialed transport, SameSite/CORS/CSRF boundaries,
logout and persistence on supported physical iOS/Android devices. Do not claim
system-browser and WebView cookies are shared. This alternative can reduce native
credential plumbing but makes platform cookie behavior a critical dependency.

This is a proposed application design, not an implemented or standardized handoff
protocol. [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) supports external-user-agent
OAuth and PKCE for native apps; it does not by itself validate these application
session details. [Capacitor cookie documentation](https://capacitorjs.com/docs/apis/cookies)
describes available native cookie APIs, not proof of this app's secure behavior.
Frontend reviewer agreed that A is the clearest proof candidate, with protected
object/image fetches and credential-free signed uploads treated separately.
User architecture/security selection and a joint Backend/Frontend/DB contract
remain necessary before implementation.

### 3. Confirmed local scope; unproven cross-instance refresh behavior

[auth.ts](../server/auth.ts:355) suppresses concurrent refreshes through a
process-local `Map`. Sessions themselves are stored in PostgreSQL. Two instances
can therefore attempt to refresh snapshots of the same session independently;
the current map cannot coordinate them. Session saves can also overlap with
logout/workspace changes. The outer authentication catch destroys the local
session and returns 401 at lines 393–395, while a provider 5xx from the later
`getUser` check receives 503 at line 378.

These are review risks, **not a demonstrated cross-instance revocation bug**.
Provider token-rotation/reuse behavior and session-store ordering matter. The
[Supabase session documentation](https://supabase.com/docs/guides/auth/sessions)
must inform the exact test. Backend/DB should first reproduce two-instance
refresh/save/logout interleavings with injected provider/store clocks and failures,
then choose conditional session updates or a bounded shared refresh guard if
needed. Preserve user identity checks and avoid turning provider outages into
silent successful access or unnecessary destructive session changes.

### 4. Confirmed: creation retries have no operation identity

[POST /api/bookings](../server/routes.ts:613) validates customer/service/quote and
calls `storage.createBooking` at line 643. The transaction in
[storage.ts](../server/storage.ts:530) locks the provider row before checking
capacity and inserting, which is a useful concurrency foundation. No
client-supplied booking-creation idempotency key or request-result lookup was found
in that path. The message UUID created inside the transaction at line 550 is not
a booking-operation key.

If a response is lost after commit, repeating a pending request or a group request
with remaining capacity can create another booking; capacity serialization does
not identify a replay. Mobile write retries must remain off until a user-scoped,
payload-bound durable operation identity/result contract is implemented by
Backend/DB. Acceptance: concurrent identical retries return one booking/result;
changed payload under the same key rejects; a genuinely separate booking remains
possible; lost response and transaction failure recover truthfully. No live race
or duplicate write was exercised in this review.

### 5. Confirmed: abuse state is per process; customer health is broader than readiness

[auth.ts](../server/auth.ts:122) and inspected search/location/report route limiters
do not configure a shared store. The default counter is per process and resets
on restart, so a stated fleet-wide limit is not enforced by this setup. Select
an appropriately scoped shared-store/edge policy with CI/CD and DB if required;
keep trusted forwarding/proxy topology explicit. Current dependency behavior is
documented in [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration#store).

[health.ts](../server/health.ts:3) correctly registers no-session probes and fails
readiness while draining or when the injected database query fails. The query is
`SELECT 1` in [index.ts](../server/index.ts:31); it does not establish Auth, private
Storage, audit queue delivery or successful customer booking. For the selected
99.9% objective, CI/CD/Backend must measure critical journeys separately and
alert on dependencies and queue delay. Preserve liveness independence to avoid
restart loops during external outages.

Shutdown already marks draining and bounds request drain to 25 seconds. Retention
and optional billing workers are stopped at [index.ts](../server/index.ts:89).
Review active job completion against container grace periods before claiming
lossless rolling releases; timer cancellation alone is not that proof. Notification
jobs already use leases/reserved delivery attempts/unknown outcomes; activity jobs
use database row locking. Those foundations should be tested, not replaced merely
because they run in multiple processes. See the separate DB review for fixed
connection limits and production audit-target contracts.

## Local repair and verification evidence

The first inspected `node --import tsx scripts/test-booking-capacity.mjs` run failed
before route checks at the strict VM loader: current `server/routes.ts` imports
`./audit/remote`, absent from the older fixture. Root then explicitly assigned
this narrow fixture dependency repair. Subsequent imports exposed additional
stale registrations. The eleven added lines:

- Explicitly reject any unexpected remote-auth provider operation in this
  booking-only fixture.
- Stub unrelated audit read/denial middleware and viewer/location/report route
  registration/store construction, consistently with existing unrelated route
  adapters. Direct booking handlers under test do not exercise those middleware.
- Preserve the strict unexpected-import assertion, booking logic, transaction
  adapter, capacity assertions and authorization/error assertions unchanged.

| Check | Result and boundary |
| --- | --- |
| `node --import tsx scripts/test-booking-capacity.mjs` | Pass after fixture repair: pending/confirmed capacity, snapshots/cleanup, creation/approval/reschedule conflicts, ownership/status, participant validation, SQL filters, previews and 403/409. Injected memory adapters; no env/client loading. |
| `node --import tsx scripts/test-audit-remote.mjs` | Pass: 76 durable intent/observed-outcome, failure/redaction/replay-boundary assertions with injected audit sink and synthetic effects. |
| `node --import tsx scripts/test-audit-reads.mjs` | Initial sandbox run hit loopback `EACCES`; inspected synthetic-loopback rerun outside sandbox passed. Real middleware, injected capture; no database/provider. |
| `node --import tsx scripts/test-startup-diagnostics.mjs` | Pass: 84 pure/injected metadata and safe diagnostics checks. No configuration/DB/provider access. |
| `node scripts/test-production-server-imports.mjs` | Initial sandbox run hit temporary junction `EPERM`; inspected inert packaging rerun outside sandbox passed. Builds graph without startup and imports only inert production helper in isolated child environment. |
| Real pager two-instance inline reproduction | Pass proving the two undesired cursor outcomes described above. No implementation fix performed. |

Runtime for these checks: Node v24.22.2. Locale testing was not broadened; no
deferred-language checks ran. **en/lv/ru only** remains the acceptance scope;
ar/RTL, zh, fr, de, hi, ja, pt and es remain deferred. No native-device, live RLS,
provider OAuth, production proxy, load/soak, restore or sustained SLA claim follows
from these results. No application TypeScript check is claimed for a fixture-only
repair. Whitespace/link checks are recorded in the final handoff.

Recovery: revert only the eleven attributable fixture lines and this review
document if required. No persisted application state changed. Next: Root reviews
the integrated owner evidence, routes the confirmed pagination defect as local
Backend/DB/CI work, and obtains the material mobile-auth design selection before
preparing the native proof. Goal remains incomplete.
