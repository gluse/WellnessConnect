# Privacy policy page handoff

22 October 2026. Local implementation and isolated verification complete;
**operator content confirmation and deployment pending**. Required public values
are now populated in local `.env`; the latest build renders without a draft notice.

## Scope and authority

The user requested creation of a privacy policy page for the Facebook App Privacy
Policy URL, then explicitly asked for operator/contact/domain details to come from
`.env`. Approver: user. Executor: `/root`, scoped frontend work in the local
WellnessConnect workspace. Operations: public static policy, Vite asset generation,
landing/login links, locale link labels, public environment fields, isolated
verification and documentation. No backend business logic, schema, database,
live auth, charges, infrastructure or deployment operations authorised/performed.
Existing unrelated changes were preserved. Deployment remains on hold.

## Result and configuration

The page is `/privacy-policy.html`, generated from
[`client/privacy-policy.template.html`](../client/privacy-policy.template.html)
by [`scripts/privacy-policy.ts`](../scripts/privacy-policy.ts). Development serves
it through Vite, including the existing custom Express/Vite integration. Production
build emits `dist/public/privacy-policy.html` for existing static hosting. It is
complete HTML without scripts, external fonts, maps, analytics or sign-in.
Landing and sign-in pages link to it with translated labels identifying English.
The policy is intentionally in English with document language/direction set.

Required public fields initially added blank to local `.env` and documented in `.env.example`:

```dotenv
PRIVACY_POLICY_OPERATOR_NAME=
PRIVACY_POLICY_OPERATOR_ADDRESS=
PRIVACY_POLICY_EMAIL=
PRIVACY_POLICY_PUBLIC_ORIGIN=
```

Origin must be an HTTPS origin only. These are public disclosures, not secrets.
Optional `PRIVACY_POLICY_RETENTION` and
`PRIVACY_POLICY_INTERNATIONAL_TRANSFERS` replace general text with the operator's
verified arrangements. Review those arrangements and disclosures before publication;
repository inspection does not establish actual vendor contracts or legal compliance.
The operator also needs to operate the published mailbox and fulfil deletion requests.

Values are read at build/dev-server start. Restart development or rebuild after
changing them. Production changes are **not runtime-dynamic**. Container builds
exclude `.env`; CI/CD must arrange the allowed public build inputs in a separately
authorised delivery task. No Docker/CI configuration was changed here.

Missing/invalid required details produce an explicit draft notice and `noindex`.
During this task the required local values were populated; they were preserved.
The configured public origin is `https://fitsmytime.com`. The latest standalone
build has no draft notice or unresolved tokens. When published, the Privacy Policy URL is
`https://fitsmytime.com/privacy-policy.html`; the data-deletion instructions are
on the same page at `#data-deletion`. This implements instructions, not an automatic
Meta deletion callback or backend deletion endpoint.

## Verification

- `npm run check`: passed.
- `npm run build`: passed; generated standalone policy asset. Existing warnings
  concern old Browserslist data and large bundle chunks.
- `node --import tsx scripts/test-privacy-policy.mjs`: passed using the existing
  isolated local Chrome harness. Vite-only GET/HEAD returned HTML without cookies,
  JavaScript or application startup. Browser checks exercised HTML with scripts
  disabled, semantic document/anchors, configured canonical and email links,
  hostile-value escaping/no private-environment leakage, draft behaviour for
  invalid/missing inputs, keyboard skip link, navigation, 320/768/1280 CSS-pixel
  widths, 200% text reflow, light/dark text contrast and print navigation removal.
- Actual login privacy links rendered in **en/lv/ru**, using the existing mocked
  auth fixture. No real auth, session persistence, email, paid service or database.
- Reviewed synthetic screenshots in `output/privacy-policy/desktop.png` and
  `output/privacy-policy/phone-dark.png`. No unexpected browser requests/errors.
- Loopback access needed sandbox escalation. Earlier harness runs found disabled
  animation-frame helpers, wrapped inline-link hit areas and implicit favicon
  requests; corrected and reran the complete focused check successfully.

Firefox/WebKit, physical devices, screen readers, native-language review, actual
400% browser zoom and public hosting/Meta crawler acceptance are unverified.
**ar/RTL, zh, fr, de, hi, ja, pt, es are deferred**, with no fresh test coverage.
Supported translations remain maintained. Limited checks do not establish WCAG
conformance, compliance or external app approval.

## Sources and recovery

Data-handling descriptions were checked against schema, booking routes,
`server/social-auth.ts`, session configuration and search/embedding code read-only.
No payment collection is claimed. Policy structure references the
[Data Protection Commission transparency guidance](https://www.dataprotection.ie/en/organisations/know-your-obligations/transparency)
and [Supabase Facebook sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-facebook),
reviewed 22 October 2026. Meta basic settings/terms pages were inaccessible through
the web tool; no claim of fresh direct Meta approval or complete legal review.

Recovery: remove only the new policy plugin/template/test and their Vite import,
the new landing/login links, legal label keys and public privacy `.env` fields.
Preserve other work in these files. No database recovery is needed. Next owner:
user confirms configured public values and real practices; CI/CD publishes only
after deployment is explicitly resumed and then verifies the public HTTPS URL.
