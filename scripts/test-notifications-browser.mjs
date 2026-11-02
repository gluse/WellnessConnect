import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
const languages = ["en", "lv", "ru"], deferredLanguages = ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/notifications.tsx", resources });
const { evaluate, until, visit, click, button, set, key, viewport } = fixture;
const checks = [], matrix = [], screenshots = [];
const open = async (mode = "appointments", extra = "") => { await visit(`/?mode=${mode}${extra}`); await until(() => !!document.querySelector('#communication-method, #service-reminder-enabled, article'), "content ready"); };
const writes = () => evaluate(() => window.phase2Fixture.writes);
const configure = values => evaluate(values => Object.assign(window.phase2Fixture, values), values);
const dialog = () => until(() => !!document.querySelector('[role="dialog"]'), "notification dialog opens");
const noDialog = () => until(() => !document.querySelector('[role="dialog"]'), "notification dialog closes");
const submit = () => evaluate(() => document.getElementById("communication-form").requestSubmit());
const bookingAction = async (id, label) => {
  await click(`[data-testid="booking-actions-${id}"]`);
  await until(() => !!document.querySelector('[role="menuitem"]'), "booking actions open");
  await evaluate(label => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find(node => node.textContent.trim() === label);
    assertMenuItem(item, label);
    function assertMenuItem(item, label) { if (!item) throw Error("Missing booking action " + label); }
    item.id = "notification-fixture-action";
  }, label);
  await click("#notification-fixture-action");
};
try {
  await viewport(1280); await open("account");
  assert.equal(await evaluate(() => document.querySelector('#communication-method option[value="sms"]').disabled), true);
  assert.equal(await evaluate(() => document.querySelector('#communication-method option[value="whatsapp"]').disabled), true);
  await set("communication-phone", "123"); await submit();
  await until(() => !!document.querySelector('[role="alert"]'), "invalid phone feedback"); assert.equal((await writes()).length, 0);
  await set("communication-phone", "+37120000001"); await configure({ result: "error" }); await submit();
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "save failure");
  assert.equal(await evaluate(() => document.getElementById("communication-phone").value), "+37120000001");
  await configure({ result: "success" }); await submit(); await until(() => [...document.querySelectorAll('[role="status"]')].some(e => e.textContent.includes("preferences saved")), "saved phone");
  await button("Send verification code"); await until(() => !!document.getElementById("communication-code"), "verification input");
  assert.equal(await evaluate(() => document.querySelector('#communication-method option[value="sms"]').disabled), true);
  await set("communication-code", "123456"); await configure({ verifyResult: "error" }); await button("Verify phone number");
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Verification failed"), "invalid code");
  assert.equal(await evaluate(() => document.getElementById("communication-code").value), "123456");
  await configure({ verifyResult: "success" }); await button("Verify phone number");
  await until(() => [...document.querySelectorAll('[role="status"]')].some(e => e.textContent === "Phone verified"), "server verified");
  const smsConsent = '#communication-form input[type="checkbox"]'; await click(smsConsent);
  await set("communication-method", "sms"); await submit();
  await until(() => window.phase2Fixture.preferences().preferredMethod === "sms", "verified sms preference saved");
  assert.equal((await writes()).at(-1).body.phoneVerified, undefined, "client never asserts verification");
  await set("communication-method", ""); await submit(); await until(() => window.phase2Fixture.preferences().preferredMethod === null, "service default persists null rather than an empty string");
  await set("communication-phone", "+37120000002");
  assert.equal(await evaluate(() => document.querySelector('#communication-method option[value="sms"]').disabled), true);
  assert.equal(await evaluate(() => document.querySelector('#communication-form input[type="checkbox"]').checked), false);
  checks.push("StrictMode account verification, disabled SMS/WhatsApp before verification/permission, invalid phone, failed-save retention, incorrect-code recovery, server-only verification and number-change resets");

  await open("account"); await set("communication-phone", "+37120000003"); await configure({ result: "pending" }); await submit();
  await until(() => !!window.phase2Fixture.release, "save pending"); const count = (await writes()).length; await submit(); assert.equal((await writes()).length, count);
  await click("#fixture-switch-account"); await until(() => document.getElementById("communication-phone")?.value === "", "account switch clears phone");
  await evaluate(() => window.phase2Fixture.release()); await fixture.settle(); assert.equal(await evaluate(() => document.getElementById("communication-phone").value), "");
  checks.push("duplicate-submit guard and late save response cannot restore previous account private fields");

  await open(); await button("Approve"); await dialog(); await until(() => !!document.querySelector('a[href^="mailto:"]'), "manual preview");
  assert.ok(await evaluate(() => document.querySelector('a[href^="mailto:"]').href.includes("%40example.test")));
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"] img, [role="dialog"] script').length), 0);
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"] a[href^="sms:"], [role="dialog"] a[href^="https://wa.me/"]').length), 0);
  for (let index = 0; index < 9; index++) { await key("Tab"); assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))); }
  await key("Escape"); await noDialog(); await until(() => document.activeElement === document.querySelector("h1"), "removed approve trigger falls back to heading").catch(async error => { console.log("Focus diagnostic", await evaluate(() => ({ active: document.activeElement?.outerHTML, heading: document.querySelector('h1')?.outerHTML }))); throw error; });
  const messages = (await writes()).filter(row => row.path.endsWith("notification-preview")); assert.ok(messages.length >= 1); assert.ok((await writes()).every(row => row.path.endsWith("/status") || row.path.endsWith("/notification-preview")), "opening the read-only preview never sends a message; StrictMode may restart its request");
  checks.push("free accept opens accessible modal, encoded email works, unverified phone channels disabled, text injection escaped, focus containment/Escape and removed-trigger recovery");

  await open("appointments", "&verified=true"); await bookingAction(1, "Decline request"); await dialog(); await button("Confirm cancellation"); await until(() => !!document.querySelector('a[href^="sms:"]'), "verified channel links");
  assert.ok(await evaluate(() => !!document.querySelector('a[href^="https://wa.me/"][rel="noopener noreferrer"]')));
  await button("Done"); await noDialog();
  await open(); await bookingAction(2, "Cancel this booking"); await dialog(); await button("Confirm cancellation"); await until(() => window.phase2Fixture.writes.some(w => w.path === "/api/bookings/2/status"), "cancellation saved"); await noDialog();
  await open(); await button("Mark complete"); await until(() => window.phase2Fixture.writes.some(w => w.body.status === "completed"), "completion saved"); assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"]')), false);
  await open(); await configure({ result: "error" }); await button("Approve"); await until(() => window.phase2Fixture.writes.length > 0, "failed action attempted"); assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"]')), false);
  checks.push("reject opens links for verified opted-in contacts; confirmed cancellation, completion and failed saves do not open notification modal");

  await open("appointments", "&verified=true"); await bookingAction(1, "Reschedule this booking"); await dialog();
  await until(() => [...document.querySelectorAll('[role="dialog"] button')].some(b => b.textContent.trim() === "18" && !b.disabled), "available date");
  await evaluate(() => { [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === "18" && !b.disabled).id = "fixture-available-day"; });
  await click("#fixture-available-day");
  await until(() => [...document.querySelectorAll('[role="dialog"] button')].some(node => node.textContent.trim() === "16:00" && !node.disabled), "available time loads");
  await button("16:00");
  assert.equal(await evaluate(() => document.querySelector('[role="dialog"]').textContent.includes("No response keeps the original reservation")), true);
  await button("Send reschedule request"); await noDialog();
  await until(() => document.body.textContent.includes("Awaiting response"), "consent request remains visible");
  const changedTime = (await writes()).find(row => row.path.endsWith("/reschedule-requests"));
  assert.equal(changedTime.body.scheduledDate, "2030-01-18T16:00:00Z"); assert.equal(changedTime.body.timeZone, "UTC"); assert.equal(changedTime.body.fallback, "keep_original");
  assert.equal(await evaluate(() => window.phase2Fixture.bookings().find(row => row.id === 1).scheduledDate), "2030-01-17T15:00:00Z", "a proposal does not move the original reservation");
  assert.equal((await writes()).some(row => row.path.endsWith("/reschedule") || row.path.endsWith("/notification-preview")), false, "request creation neither changes time immediately nor opens an obsolete moved-booking preview");
  checks.push("reschedule requests canonical appointment/timezone with explicit no-response fallback; original reservation remains until recipient decides");

  await open(); await button("Send reminder"); await dialog(); await until(() => document.querySelector('[role="dialog"]')?.textContent.includes("Reminder:"), "manual reminder wording");
  await evaluate(() => window.phase2Fixture.revoke()); await noDialog(); assert.equal(await evaluate(() => !!document.querySelector('a[href^="mailto:"]')), false);
  await open(); await button("Send reminder"); await dialog(); await key("Escape"); await noDialog(); await until(() => document.activeElement?.textContent === "Send reminder", "existing reminder trigger recovers focus");
  for (const action of ["switchWorkspace", "switchUser"]) { await open(); await configure({ previewResult: "pending" }); await button("Send reminder"); await dialog(); await until(() => !!window.phase2Fixture.release, "preview in flight"); await evaluate(action => window.phase2Fixture[action](), action); await noDialog(); await evaluate(() => window.phase2Fixture.release()); assert.equal(await evaluate(() => !!document.querySelector('a[href^="mailto:"]')), false); }
  checks.push("free confirmed-future reminder; Escape restores existing trigger; permission, workspace and account changes clear private data and pending previews");

  await open("appointments", "&pro=true&reminder=true"); assert.equal(await evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Send reminder")), false);
  await until(() => document.body.textContent.includes("Automatic reminder scheduled"), "automatic reminder badge");
  await bookingAction(1, "Decline request"); await dialog(); await button("Confirm cancellation"); await until(() => document.body.textContent.includes("Customer notification queued"), "automatic queued feedback after rejected card removal");
  assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"]')), false);
  await configure({ automaticState: "failed" }); await evaluate(() => window.phase2Fixture.refreshStatus());
  await until(() => document.body.textContent.includes("automatic notification is unavailable or failed"), "worker failure reaches inline feedback");
  await configure({ pro: false }); await evaluate(() => window.phase2Fixture.refreshCapabilities()); await until(() => document.body.textContent.includes("Activate PRO"), "PRO expiry exposes manual reminders");
  assert.ok(await evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Send reminder")));
  checks.push("PRO has no modal/manual reminder; automatic badge and worker failure stay visible after rejection; entitlement expiry restores manual reminders");

  await open("service", "&pro=true"); await click("#service-reminder-enabled");
  assert.equal(await evaluate(() => document.getElementById("service-reminder-hours").value), "24");
  await set("service-reminder-hours", "169"); await click('[data-testid="button-save-service"]');
  await until(() => document.getElementById("service-reminder-hours")?.getAttribute("aria-invalid") === "true", "hours validated"); assert.equal((await writes()).length, 0);
  await set("service-reminder-hours", "48"); await set("service-reminder-method", "whatsapp"); await configure({ result: "error" }); await click('[data-testid="button-save-service"]');
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "service save failed"); assert.equal(await evaluate(() => document.getElementById("service-reminder-hours").value), "48");
  const saved = (await writes()).at(-1).body; assert.equal(saved.reminderEnabled, true); assert.equal(saved.reminderHours, 48); assert.equal(saved.reminderMethod, "whatsapp");
  await open("service"); assert.equal(await evaluate(() => document.getElementById("service-reminder-enabled").disabled), true);
  checks.push("service PRO toggle, 24-hour default, 1–168 validation, dirty-state/save integration, failed-save retention and free disabled automation");

  for (const language of languages) {
    for (const mode of ["account", "service", "appointments"]) {
      await open(mode, `&pro=${mode === "service"}&lang=${language}&verified=true`);
      if (mode === "service") await click("#service-reminder-enabled");
      if (mode === "appointments") { const label = resources[language].translation.notifications.sendReminder; await button(label); await dialog(); await until(() => !!document.querySelector('a[href^="mailto:"]'), "localized preview"); }
      for (const [width, height] of [[320, 700], [390, 300], [768, 900], [1280, 900]]) {
        await viewport(width, height); await fixture.settle();
        const bounds = await evaluate(() => ({ pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, dialogOverflow: [...document.querySelectorAll('[role="dialog"]')].some(e => e.scrollWidth > e.clientWidth + 1), unnamed: [...document.querySelectorAll('input,select')].filter(e => e.getClientRects().length && !e.closest('[aria-hidden="true"]') && !e.labels?.length && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby")).map(e => e.id) }));
        assert.equal(bounds.pageOverflow, false, `${language}/${mode}/${width} reflow`); assert.equal(bounds.dialogOverflow, false); assert.deepEqual(bounds.unnamed, []);
        matrix.push({ language, mode, width, height });
        if (language === "en" && width === 320 && (process.env.FORMS_BROWSER || "chrome") === "chrome") { const file = `docs/notifications-collaboration-chrome-${mode}.png`; await fixture.screenshot(file); screenshots.push(file); }
      }
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
  }
  checks.push("en/lv/ru account, enabled service settings and reminder modal reflow/labels at phone, tablet, desktop and short-height viewports");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  const engine = process.env.FORMS_BROWSER || "chrome";
  await writeFile(new URL(`../docs/notifications-collaboration-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-02", browser: await fixture.api("Browser.getVersion"), checks, matrix, screenshots, languages, deferredLanguages, unexpectedRequests: fixture.network, blockedRequests: fixture.blocked, runtimeErrors: fixture.errors, limits: "Synthetic isolated fetch mocks; no database, provider sends or verification service calls. Physical devices, screen readers and native-language review are unverified." }, null, 2) + "\n");
  console.log(`Passed notifications ${engine}: ${checks.length} behavior groups and ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
