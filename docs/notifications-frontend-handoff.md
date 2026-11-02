# TASK-032 frontend notifications and reminders

30 October follow-up: PRO appointment reminder presentation and manual fallback
are corrected in [the scoped handoff](pro-appointment-reminder-handoff.md).
Configured services show **Automatic reminders** with actual delivery details;
services with automation disabled offer **Send reminder**, including PRO accounts.
The original verification below remains historical evidence from 29 October.

## Acceptance and authority

Accepted 29 October 2026 by the assigned Front End Developer agent `/root/notifications_frontend`, requested by `/root` for the user's explicit instruction to implement the PRO notifications/reminders plan. Scope: reversible local client components/pages, translations and offline frontend fixtures/checks. Authorization: user-approved plan and [standing cooperation](../AGENTS.md#cross-role-cooperation-and-standing-authorization). No connected database, real phone verification, message sends, credential access, deployments or publishing are included. Recovery: revert only the notification-related frontend changes; preserve unrelated concurrent work.

Frontend owns Account communication settings, provider booking notifications, service reminder controls and appointment reminder presentation. Backend owns `shared/notifications.ts` and APIs; DB owns schema/migrations; root coordinates rollout and configuration. The live integrations remain separately authorized operations. See [task inventory](../TASKS.md) and [coordination queue](agent-coordination.md).

## Integrated behavior and contracts

- Private settings use `GET/PATCH /api/account/communication`, `POST /verify/start` and `/verify/check` beneath that path. Phone preferences remain disabled until server confirmation and channel opt-in. Changes retain drafts after rejected saves. Number edits clear local verification/consent; the server remains authoritative. No private fields enter public users or browser persistence.
- Scoped `GET /api/notifications/capabilities` controls PRO reminder presentation. Service draft saves `reminderEnabled`, `reminderMethod` and `reminderHours`, defaults off/email/24, with integer hours 1–168. Existing dirty-state guards include the new fields. Subscription links use the existing `/my-services/settings/billing` route.
- Booking mutation `notification` determines manual/automatic feedback. Preview `POST /api/bookings/:id/notification-preview` returns localized server text and canonical links. A second frontend scheme/host/recipient guard rejects unsafe links and accepts fully encoded email recipients. Composer links do not claim delivery or initiate server sending.
- PRO inline feedback polls `GET /api/bookings/:id/notifications`, independently of the appointment card (including rejected bookings). Accepted and delivered remain distinct; unknown outcome does not offer automatic retry. Appointment reminder badges read the same endpoint and include the actual channel and time/timezone.
- Account/workspace/booking-permission changes unmount private dialogs and discard their query data. In-flight queries consume abort signals; late mutations are ignored after scope unmount. StrictMode effect cleanup/setup is supported. A synchronous action lock prevents duplicate account saves/verifications before pending state renders. Codes require exactly six digits. Dialog focus restores after the modal releases background focus, to the original unchanged trigger or appointment heading when the status action disappears; this fixes WebKit leaving focus on body.
- The `notifications` resource is maintained in all 11 supported locale files. Fresh validation is restricted to **en, lv, ru**. **ar including RTL, zh, fr, de, hi, ja, pt, es are deferred**. Translations are authored without native-speaker review.

## Validation

Completed local checks:

- `npx tsc --noEmit --incremental false`: passed.
- `node --import tsx scripts/test-notifications-frontend.mjs`: passed; encoded email/scheme guards, service defaults/bounds, en/lv/ru resources.
- `node --import tsx scripts/test-account-details.mjs --frontend-only`: passed; existing profile validation/error/expiry behavior with private settings mocked.
- `node --import tsx scripts/test-booking-completion.mjs`: passed; existing completion/permissions/cache/revenue behavior. The existing test emits an uninitialized i18next warning.
- `node --import tsx scripts/test-provider-navigation.mjs`: passed; provider routes, service copy/create/edit, rejected saves, dirty workspace switching, permissions and redirects.
- `node --import tsx scripts/test-password-update.mjs --frontend-only`: passed; existing password validation, response rejection, failed-save retention, secret clearing and session redirects. Its form inventory now explicitly includes the independent communication form.
- `node --import tsx scripts/test-customer-bookings.mjs`: passed; existing customer routes, auth/data isolation, filters/history, cache/error/retry behavior. It emits the existing uninitialized i18next warning.
- `npx tsc --project scripts/fixtures/tsconfig.notifications.json`, `npx tsc --project scripts/fixtures/tsconfig.forms-phase2.json` and `npx tsc --project scripts/fixtures/tsconfig.service-form.json`: all passed.
- `node --import tsx scripts/test-notifications-browser.mjs`: passed in **Chrome 155.0.8059.85**, **Firefox 157.0** and **WebKit 27.2**; each ran 9 behavior groups and 36 viewport cases (en/lv/ru × account/service/modal × 320×700, 390×300, 768×900, 1280×900). [Chrome evidence](notifications-chrome-evidence.json), [Firefox evidence](notifications-firefox-evidence.json), [WebKit evidence](notifications-webkit-evidence.json).
- `node --import tsx scripts/test-notifications-accessibility.mjs`: passed 9 en/lv/ru native Chrome **400% zoom** cases with reachable controls and light/dark computed text/control-border contrast. The 1280px browser window reflows to 300–320 CSS px; DPR4, CSS zoom1 and visual viewport scale1 verify native zoom. [Accessibility evidence](notifications-accessibility-evidence.json).

Alternate-engine browser command setup (already installed tooling; no downloads):

```powershell
$env:FORMS_BROWSER='firefox' # use 'webkit' for the other engine
$env:FORMS_PLAYWRIGHT_MODULE='C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools/node_modules/playwright/index.mjs'
$env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/LuseG/AppData/Local/Temp/fits-task022-tools/browsers'
node --import tsx scripts/test-notifications-browser.mjs
```

Browser interaction cases cover free accept/reject/reschedule modals, verified/permission-limited channels, encoded email recipients, failed changes and excluded actions, manual reminders, keyboard containment/Escape/focus restoration, account/workspace/permission changes during pending previews, PRO automatic feedback after the card disappears, worker failure updates and PRO expiry returning manual controls. Account cases include invalid phones, failed saves, incorrect-code recovery, six-digit verification, consent and number resets, null/default preference persistence, duplicate submits and late cross-account save results. Service cases cover default/bounded hours, payload/dirty-state integration and failed-save retention.

Rendered Chrome phone [Account](notifications-chrome-account.png), [Service](notifications-chrome-service.png) and [Modal](notifications-chrome-appointments.png) screenshots were inspected visually. No clipping or horizontal overflow was observed. Existing historical form evidence was preserved; new evidence uses notification-specific filenames.

Every notification fixture API uses synthetic in-memory fetch mocks. Unexpected API requests throw; the local static harness blocks external network requests. The application server and database are not started. A sandbox-only Chrome launch failed because Crashpad could not start; the same isolated browser command was allowed through scoped escalation and ran successfully.

Local frontend implementation and required local verification are complete. Root performs the final integrated type/build checks after all owners freeze their changes. Remaining rollout limitations: real Vonage/Resend delivery/verification, connected migration/rollout, approved WhatsApp templates, physical phones/tablets, screen-reader behavior, native-language review and the eight deferred locales are unverified. Computed contrast does not inspect native checkbox paint. This is local UI evidence, not deployment or WCAG certification.
