import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
import { renderMessage } from "../shared/notification-message.ts";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/notifications.tsx", resources });
const { evaluate, until, visit, viewport, click, set, key } = fixture;
const checks = [], matrix = [], screenshots = [];
const configure = values => evaluate(values => Object.assign(window.phase2Fixture, values), values);
const writes = () => evaluate(() => window.phase2Fixture.writes);
const preview = () => evaluate(() => document.getElementById("service-reminder-preview")?.textContent);
const open = async (extra = "") => {
  await visit(`/?mode=service&pro=true${extra}`);
  await until(() => !!document.getElementById("service-reminder-enabled"), "service editor loaded");
};
const expectPreview = async (message, language = "en", service = "Synthetic service <img src=x onerror=alert(1)>") => {
  const expected = renderMessage({ kind: "reminder", service, date: new Date("2030-01-18T15:00:00Z"), language, timeZone: "UTC", reminderMessage: message }).message;
  await configure({ expectedPreview: expected });
  await until(() => document.getElementById("service-reminder-preview")?.textContent === window.phase2Fixture.expectedPreview, "shared renderer matches live preview");
};
try {
  await open();
  assert.equal(await evaluate(() => !!document.getElementById("service-reminder-message")), false);
  await click("#service-reminder-enabled");
  await expectPreview("");
  assert.equal(await evaluate(() => document.getElementById("service-reminder-message").maxLength), 1000);
  const note = "Bring a towel.\nĀrsta piezīme: <img src=x onerror=alert(1)> & {date}";
  await set("service-reminder-message", note); await expectPreview(note);
  assert.equal(await evaluate(() => document.getElementById("service-reminder-preview").querySelector("img,script")), null);
  assert.equal((await writes()).length, 0, "editing and preview never send requests");
  await set("serviceName", "Changed service"); await expectPreview(note, "en", "Changed service");
  await click("#service-reminder-enabled");
  assert.equal(await preview(), undefined);
  await click("#service-reminder-enabled"); await expectPreview(note, "en", "Changed service");
  await set("service-reminder-message", " \n "); await expectPreview("", "en", "Changed service");
  checks.push("conditional editor, shared-renderer preview, live name/note updates, whitespace fallback, safe literal text, toggle retention and no preview sends");

  await set("service-reminder-message", "a".repeat(1001));
  await click('[data-testid="button-save-service"]');
  await until(() => document.getElementById("service-reminder-message")?.getAttribute("aria-invalid") === "true", "length validation linked to field");
  assert.equal((await writes()).length, 0);
  assert.ok(await evaluate(() => document.getElementById("service-reminder-message").getAttribute("aria-describedby").includes("service-reminder-message-error")));
  await set("service-reminder-message", "a".repeat(1000)); await configure({ result: "error" });
  await click('[data-testid="button-save-service"]');
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "failed save visible");
  assert.equal(await evaluate(() => document.getElementById("service-reminder-message").value.length), 1000);
  assert.equal((await writes()).at(-1).body.reminderMessage, "a".repeat(1000));
  assert.equal((await writes()).at(-1).body.reminderEnabled, true);
  await set("service-reminder-message", note); await configure({ result: "pending" });
  await click('[data-testid="button-save-service"]');
  await until(() => !!window.phase2Fixture.release, "save pending");
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-save-service"]').disabled), true);
  await configure({ result: "error" }); await evaluate(() => window.phase2Fixture.release());
  await until(() => !document.querySelector('[data-testid="button-save-service"]').disabled, "failed pending save released");
  assert.equal(await evaluate(() => document.getElementById("service-reminder-message").value), note);
  checks.push("1000 boundary, over-limit blocked with linked error, mutation payload, rejected/pending save retention and duplicate-submit prevention");

  await open("&reminder=true&message=Saved%20note"); await expectPreview("Saved note");
  assert.equal(await evaluate(() => document.getElementById("service-reminder-message").value), "Saved note");
  await evaluate(() => document.getElementById("service-reminder-method").focus()); await key("Tab"); await key("Tab");
  assert.equal(await evaluate(() => document.activeElement.id), "service-reminder-message", "keyboard can reach labeled custom field");
  await set("service-reminder-message", note);
  await evaluate(() => window.phase2Fixture.changeLanguage("lv")); await expectPreview(note, "lv");
  assert.equal(await evaluate(() => document.getElementById("service-reminder-message").value), note);
  await evaluate(() => window.phase2Fixture.switchUser());
  await until(() => document.getElementById("service-reminder-message")?.value === "Saved note", "account change remounts draft without previous edits");
  checks.push("existing saved message, keyboard focus, language-change retention and account-change draft isolation");

  for (const extra of ["&pro=false", "&pro=true&capabilities=error", "&pro=true&capabilities=pending"]) {
    await visit(`/?mode=service&reminder=true${extra}`);
    await until(() => !!document.getElementById("service-reminder-message"), "stored settings visible");
    assert.equal(await evaluate(() => document.getElementById("service-reminder-enabled").disabled), true);
    assert.equal(await evaluate(() => document.getElementById("service-reminder-message").matches(":disabled")), true);
  }
  checks.push("free, unknown and failed entitlement disable stored custom-message editing");

  for (const language of languages) {
    await open(`&reminder=true&lang=${language}`); await set("service-reminder-message", note + "\n" + "x".repeat(500));
    await expectPreview(note + "\n" + "x".repeat(500), language);
    for (const [width, height] of [[320, 700], [390, 300], [768, 900], [1280, 900]]) {
      await viewport(width, height); await fixture.settle();
      const result = await evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        label: document.getElementById("service-reminder-message").labels[0]?.textContent,
        help: document.getElementById("service-reminder-message").getAttribute("aria-describedby"),
        previewName: document.getElementById("service-reminder-preview-title").textContent,
        previewOverflow: document.getElementById("service-reminder-preview").scrollWidth > document.getElementById("service-reminder-preview").clientWidth + 1,
      }));
      assert.equal(result.overflow, false, `${language}/${width} page reflow`); assert.equal(result.previewOverflow, false);
      assert.equal(result.label, resources[language].translation.notifications.customMessage);
      assert.equal(result.previewName, resources[language].translation.notifications.messagePreview);
      assert.ok(result.help.includes("service-reminder-message-help"));
      matrix.push({ language, width, height });
      if (language === "en" && width === 320 && (process.env.FORMS_BROWSER || "chrome") === "chrome") { const file = "docs/custom-service-reminder-chrome-phone.png"; await fixture.screenshot(file); screenshots.push(file); }
    }
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  checks.push("en/lv/ru long-text wrapping, translated labels/help and sample preview at phone, short-height, tablet and desktop sizes");
  if ((process.env.FORMS_BROWSER || "chrome") === "chrome") {
    await open("&reminder=true"); await set("serviceName", "Yoga session");
    await set("service-reminder-message", "Please arrive 10 minutes early.\nBring a towel.");
    await expectPreview("Please arrive 10 minutes early.\nBring a towel.", "en", "Yoga session");
    await viewport(390, 900);
    await evaluate(() => { document.getElementById("service-reminder-method").scrollIntoView({ block: "start" }); window.scrollBy(0, -24); });
    const file = "docs/custom-service-reminder-chrome-preview.png"; await fixture.screenshot(file, false); screenshots.push(file);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  const engine = process.env.FORMS_BROWSER || "chrome";
  await writeFile(new URL(`../docs/custom-service-reminder-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-08", browser: await fixture.api("Browser.getVersion"), checks, matrix, screenshots, languages, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual editor with synthetic fetch boundaries; no connected database, real sends, credentials or external requests. Native-language review, screen readers and physical devices unverified." }, null, 2) + "\n");
  console.log(`Passed custom service reminder ${engine}: ${checks.length} behavior groups and ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
