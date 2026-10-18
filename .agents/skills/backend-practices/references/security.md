# Backend security

Reviewed: 18 October 2026. Apply to affected behavior; this reference does not
establish that existing controls are implemented or effective.

## Identity and workspace authorization

Authorize every action and object on the server. Derive the actor from verified
identity; check current membership, privileges, ownership, and entitlements. Scope
related lookups to the authorized workspace, not just an ID. Test denied paths
and intended public access. UI hiding and unpredictable IDs are insufficient.
Do not use user-editable metadata as the authority for roles.
Source: [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Supabase `getSession()` reads attached storage; it does not verify identity from
untrusted request storage. `getUser(token)` queries Auth; `getClaims(token)` verifies
the JWT and can use cached asymmetric signing keys. Choose according to identity
and freshness requirements, not speed alone. Do not silently replace this project's
`getUser` flow. A valid JWT alone does not prove current company membership or
immediate revocation. Establish/test the sensitive-action revocation contract
against current Supabase guidance; expiry checks alone cannot promise immediate
logout enforcement.
Sources: [getSession](https://supabase.com/docs/reference/javascript/auth-getsession),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims),
[server-side Auth](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

Isolate user-auth clients/tokens from privileged `supabaseAdmin`. Secret/service
credentials bypass RLS: authorize caller, operation, workspace, and object before
privileged access. Direct pg connections need their real role/privileges established
by the DB owner; do not assume Supabase Auth or HTTP RLS automatically scopes them.
Never ship/log secret keys or use them in fixtures. Publishable API keys identify
application components, not end users.
Source: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Sessions, proxies, browser requests

Use a production-capable session store; MemoryStore belongs in isolated fixtures.
Set secure transport/cookies and intentional lifetimes. Regenerate sessions at
authentication/privilege transitions, save before redirects when required, and
destroy/clear on logout. Check store capabilities when selecting resave/touch
behavior rather than treating examples as universal settings.
Source: [express-session](https://expressjs.com/en/resources/middleware/session/).

Match `trust proxy` to the actual trusted network/hop topology. Arbitrary caller
forwarded headers must not determine client identity or secure-request status.
A copied hop count can fail with alternate routing paths. Coordinate with CI/CD.
Source: [Express proxies](https://expressjs.com/en/guide/behind-proxies/).

Evaluate a complete CSRF defense for cookie-authenticated mutations. SameSite and
CORS alone do not prove CSRF protection. Validate trusted origins and relevant
Fetch Metadata, with explicit handling of missing headers and `Origin: null`;
neither establishes same-origin trust. Use an appropriate token strategy where
needed. Test OAuth top-level navigation separately; avoid state-changing GETs and
document narrowly scoped compatibility exceptions.
Source: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## API abuse and configuration

Restrict methods/content types, bound inputs/response work, and enforce business
state transitions server-side. Return appropriate failures without internal details.
Cap expensive search, uploads, and paid integrations as well as login attempts;
authenticated users can also abuse resources.
Source: [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

Rate limits depend on trusted client identification, IPv6-safe keys, store scope,
and failure behavior. An in-memory store does not provide one quota across replicas.
Use supported IP helpers when customizing keys and verify the installed version.
Report gaps without adding new infrastructure solely to satisfy a checklist.
Source: [express-rate-limit](https://express-rate-limit.mintlify.app/reference/configuration).

Use intentional security headers, TLS, secure cookies, and allowed redirects.
Assess Helmet/CSP compatibility with the SPA, Maps, and auth before middleware
changes. Review dependency advisories and install scripts; avoid incidental broad
automated upgrades/fixes.
Source: [Express security](https://expressjs.com/en/advanced/best-practice-security/).

## Files and outbound requests

Keep private Storage private. Authorize uploads, downloads, deletes, and URL signing;
secret-key access bypasses Storage policies. Signed URLs are bearer capabilities:
use a short suitable expiry and avoid logging. Do not assume Auth key rotation or
logout revokes existing signed URLs.
Sources: [Storage access](https://supabase.com/docs/guides/storage/security/access-control),
[private downloads/signed URLs](https://supabase.com/docs/guides/storage/serving/downloads).

Validate size, formats, content, and safe object names. Client MIME/extensions alone
are insufficient. Consider decoded image/resource bounds and unsafe active content.
Signed upload permission does not replace ownership and content validation.
Source: [OWASP uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

For user-influenced URLs, allow intended schemes/hosts and block internal, loopback,
link-local, and metadata destinations as appropriate. Resolve/validate destinations
consistently; revalidate redirects or disable them. Coordinate egress controls with
CI/CD. URL syntax validation alone does not prevent SSRF.
Source: [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Private data and logs

Log useful request/security outcomes, durations, and correlation identifiers.
Redact secrets, cookies, access/refresh tokens, signed URLs, and private wellness
payloads; prevent log injection. Verify failure paths and avoid unbounded body
logging. Coordinate log access and retention with owners.
Source: [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
