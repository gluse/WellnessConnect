import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/notifications.tsx", resources });
const { evaluate, until, visit, viewport, button, key } = fixture;
const checks = [], matrix = [], screenshots = [];
const configure = values => evaluate(values => Object.assign(window.phase2Fixture, values), values);
const renderSettled = () => evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const refresh = async () => { await evaluate(() => window.phase2Fixture.refreshStatus()); await renderSettled(); };
const open = async extra => {
  await visit(`/?mode=appointments&pro=true${extra}`);
  await until(() => !!document.querySelector("article"), "appointments loaded");
};
const manualCount = label => evaluate(label => [...document.querySelectorAll("article button")].filter(element => element.textContent === label).length, label);
const textVisible = label => evaluate(label => [...document.querySelectorAll("article")].some(element => element.textContent.includes(label)), label);
const waitForText = async label => {
  await configure({ expectedText: label });
  await until(() => [...document.querySelectorAll("article")].some(element => element.textContent.includes(window.phase2Fixture.expectedText)), "expected reminder content renders");
};
try {
  for (const language of languages) {
    const messages = resources[language].translation.notifications;
    await viewport(320, 700);
    await open(`&lang=${language}`);
    await waitForText(messages.sendReminder);
    assert.equal(await manualCount(messages.sendReminder), 1, "only the confirmed future appointment offers a reminder");
    assert.equal(await textVisible(messages.automaticReminders), false);
    await configure({ reminderState: "unavailable", reminderReasonCode: "missing_email" }); await refresh();
    assert.equal(await textVisible(messages.reminderState.unavailable), false, "disabled service must not display stale automation unavailability");
    await button(messages.sendReminder);
    await until(() => !!document.querySelector('[role="dialog"] a[href^="mailto:"]'), "PRO manual preview opens");
    assert.equal(await evaluate(() => window.phase2Fixture.writes.every(row => row.path.endsWith("/notification-preview") && row.body.kind === "reminder")), true);
    for (let index = 0; index < 6; index++) { await key("Tab"); assert.equal(await evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), true); }
    if (language === "en") { const file = `docs/pro-reminders-collaboration-${process.env.FORMS_BROWSER || "chrome"}-manual.png`; await fixture.screenshot(file); screenshots.push(file); }
    await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "manual dialog closes");
    await until(() => document.activeElement?.tagName === "BUTTON" && !!document.activeElement.closest("article"), "reminder trigger focus restores");
    assert.equal(await evaluate(label => document.activeElement?.textContent === label, messages.sendReminder), true);
    checks.push(`${language}: disabled service offers one manual action, composer preview and focus recovery; stale automation status hidden`);

    await open(`&lang=${language}&reminder=true`);
    await waitForText(messages.automaticReminders); await waitForText(messages.reminderState.scheduled);
    assert.equal(await textVisible(messages.automaticReminders), true);
    assert.equal(await textVisible(messages.reminderState.scheduled), true);
    assert.equal(await manualCount(messages.sendReminder), 0);
    for (const state of ["unavailable", "failed", "sent", "paused"]) {
      await configure({ reminderState: state, reminderReasonCode: state === "unavailable" ? "missing_email" : null }); await refresh();
      await waitForText(messages.reminderState[state]);
      assert.equal(await textVisible(messages.automaticReminders), true);
      assert.equal(await textVisible(messages.reminderState[state]), true, `${language}: actual ${state} state retained`);
      if (state === "unavailable") assert.equal(await textVisible(messages.reasons.missing_email), true, "specific failure reason remains visible");
    }
    await configure({ stateResult: "error" }); await refresh();
    await waitForText(messages.statusUnavailable);
    assert.equal(await textVisible(messages.automaticReminders), true);
    assert.equal(await textVisible(messages.statusUnavailable), true);
    assert.equal(await manualCount(messages.sendReminder), 0);
    await configure({ stateResult: "success", reminderState: "scheduled" }); await refresh();
    for (const [width, height] of [[320, 700], [768, 900], [1280, 900]]) {
      await viewport(width, height); await fixture.settle();
      assert.equal(await evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${language}/${width}: no horizontal overflow`);
      matrix.push({ language, width, height, mode: "automatic" });
    }
    if (language === "en") { await viewport(320, 700); const file = `docs/pro-reminders-collaboration-${process.env.FORMS_BROWSER || "chrome"}-automatic.png`; await fixture.screenshot(file); screenshots.push(file); }
    await evaluate(() => window.phase2Fixture.setServiceReminder(false)); await waitForText(messages.sendReminder);
    assert.equal(await manualCount(messages.sendReminder), 1, "refetched disabled service returns manual action");
    assert.equal(await textVisible(messages.automaticReminders), false);
    await evaluate(() => window.phase2Fixture.setServiceReminder(true)); await refresh(); await waitForText(messages.automaticReminders);
    assert.equal(await manualCount(messages.sendReminder), 0);
    assert.equal(await textVisible(messages.automaticReminders), true);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    checks.push(`${language}: configured service shows Automatic reminders and honest delivery/errors, no duplicate manual action; service changes update presentation`);
  }
  await open("&capabilities=pending");
  assert.equal(await manualCount(resources.en.translation.notifications.sendReminder), 0, "unknown entitlement has no manual control");
  await configure({ capabilitiesResult: "error" }); await evaluate(() => window.phase2Fixture.release());
  await until(() => document.body.textContent.includes("Unable to check"), "capability error visible");
  assert.equal(await manualCount(resources.en.translation.notifications.sendReminder), 0, "failed entitlement has no manual control");
  await open(""); await evaluate(() => window.phase2Fixture.setServiceReminder(undefined)); await renderSettled();
  assert.equal(await manualCount(resources.en.translation.notifications.sendReminder), 0, "missing service flag fails closed like the server");
  await open("&reminder=true&denied=true");
  assert.equal(await textVisible(resources.en.translation.notifications.automaticReminders), false);
  assert.equal(await manualCount(resources.en.translation.notifications.sendReminder), 0);
  checks.push("unknown/failed capabilities, missing setting and revoked booking permission do not expose reminder controls");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  const engine = process.env.FORMS_BROWSER || "chrome";
  await writeFile(new URL(`../docs/pro-reminders-collaboration-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-02", browser: await fixture.api("Browser.getVersion"), checks, matrix, screenshots, languages, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Synthetic fetch mocks and blocked external network; no database writes or real sending. Physical devices, screen readers and native-language review unverified." }, null, 2) + "\n");
  console.log(`Passed PRO reminder ${engine}: ${checks.length} behavior groups, ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
