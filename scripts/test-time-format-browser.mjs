import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], matrix = [];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) }])));
const engine = process.env.FORMS_BROWSER || "chrome";
const fixture = await browserFixture({ entry: "scripts/fixtures/forms-phase3.tsx", resources });
const { visit, viewport, until, evaluate, set, click, button, key } = fixture;
try {
  for (const language of languages) {
    const labels = resources[language].translation;
    await visit(`/?mode=availability&lang=${language}`);
    await until(() => document.querySelectorAll('[data-time-input]').length === 2, "weekly hours");
    await evaluate(() => document.querySelectorAll('[data-time-input]').forEach((input, index) => { input.id = `time-${index}`; }));
    for (const width of [320, 768, 1280]) {
      await viewport(width, 800);
      assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-time-input]')].map(input => ({ type: input.type, value: input.value, label: !!input.getAttribute("aria-label") }))), [{ type: "text", value: "09:00", label: true }, { type: "text", value: "17:00", label: true }]);
      matrix.push({ language, width, area: "availability" });
    }
    await viewport(320, 800);
    await evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "weekly hours reflow at 200% text: " + JSON.stringify(await evaluate(() => ({ inner: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth, offenders: [...document.querySelectorAll("body *")].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => ({ tag: node.tagName, id: node.id, cls: node.className, client: node.clientWidth, scroll: node.scrollWidth, right: node.getBoundingClientRect().right, text: node.textContent.slice(0, 60) })).slice(-10) }))));
    await evaluate(() => { document.documentElement.style.fontSize = ""; });
    if (language === "en") await fixture.screenshot(`docs/time-format-${engine}-availability-phone.png`);
    await set("time-0", "24:00"); await button(labels.operationsForm.saveWeek);
    assert.equal(await evaluate(() => window.phase3Fixture.writes.length), 0);
    await until(() => !!document.querySelector('[role="alert"]'), "invalid hours feedback");
    await click('a[href="#availability-day-1"]');
    assert.equal(await evaluate(() => document.activeElement.id), "time-0", "range error link focuses the time field");
    await set("time-0", "00:00"); await set("time-1", "23:59"); await button(labels.operationsForm.saveWeek);
    await until(() => window.phase3Fixture.writes.length === 1, "week saved");
    assert.deepEqual(await evaluate(() => window.phase3Fixture.writes[0].body.days.find(day => day.day === 1).intervals), [{ startTime: "00:00", endTime: "23:59" }]);
    assert.deepEqual(await evaluate(() => window.phase3Fixture.unexpected), []);

    await visit(`/?mode=subscriptions&lang=${language}`);
    await set("subscription-kind", "company"); await click("#subscription-target");
    await until(() => !!document.querySelector('[role="option"]'), "target options"); await key("ArrowDown"); await key("Enter");
    await button(labels.storefront.loadSubscription); await until(() => !!document.getElementById("subscription-until-time"), "expiry fields");
    await set("subscription-until", "2099-01-18");
    for (const bad of ["24:00", "13:60", "", "PM"]) {
      await set("subscription-until-time", bad); await button(labels.storefront.saveSubscription);
      assert.equal(await evaluate(() => window.phase3Fixture.writes.length), 0);
      assert.equal(await evaluate(() => document.activeElement.id), "subscription-until-time");
    }
    for (const width of [320, 768, 1280]) {
      await viewport(width, 800);
      assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      matrix.push({ language, width, area: "subscription" });
    }
    await viewport(320, 800);
    await evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "expiry reflow at 200% text");
    await evaluate(() => { document.documentElement.style.fontSize = ""; });
    await set("subscription-until-time", "15:45"); await button(labels.storefront.saveSubscription);
    await until(() => window.phase3Fixture.writes.length === 1, "expiry saved");
    assert.equal(await evaluate(() => window.phase3Fixture.writes[0].body.proUntil), "2099-01-18T15:45:00.000Z");
    if (language === "en") await fixture.screenshot(`docs/time-format-${engine}-expiry-phone.png`);
    assert.deepEqual(await evaluate(() => window.phase3Fixture.unexpected), []);
  }
  assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
} finally { await fixture.close(); }

const schedule = await browserFixture({ entry: "scripts/fixtures/time-format.tsx", resources: {} });
try {
  await schedule.visit("/"); await schedule.viewport(320, 800);
  for (const language of languages) {
    await schedule.set("fixture-language", language);
    const text = await schedule.evaluate(() => document.getElementById("times").textContent);
    for (const time of ["00:00", "12:00", "15:45", "23:59"]) assert.ok(text.includes(time), language + " " + time);
    assert.doesNotMatch(text, /\b[AP]M\b/i);
  }
  await schedule.set("schedule-start-time", "24:00"); await schedule.button("Save");
  assert.equal(await schedule.evaluate(() => window.phase2Fixture.saves.length), 0);
  assert.equal(await schedule.evaluate(() => document.activeElement.id), "schedule-start-time");
  await schedule.click("#schedule-start-time");
  if (engine === "chrome") {
    // The shared Chrome key helper handles navigation keys only. Send actual
    // selection modifiers and printable key events for this typing regression.
    await schedule.api("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await schedule.api("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    for (const digit of ["0", "9", ":", "0", "5"]) await schedule.api("Input.dispatchKeyEvent", { type: "char", text: digit });
  } else {
    await schedule.key("Control+A");
    for (const digit of ["0", "9", ":", "0", "5"]) await schedule.key(digit);
  }
  assert.equal(await schedule.evaluate(() => document.getElementById("schedule-start-time").value), "09:05");
  await schedule.button("Save");
  assert.equal(await schedule.evaluate(() => window.phase2Fixture.saves[0].updates.startTime), "09:05");
  await schedule.screenshot(`docs/time-format-${engine}-phone.png`);
  assert.deepEqual(schedule.errors, []); assert.deepEqual(schedule.blocked, []);
  assert.deepEqual(await schedule.evaluate(() => window.phase2Fixture.unexpected), []);
  await writeFile(`docs/time-format-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-03", browser: await schedule.api("Browser.getVersion"), languages, matrix, checks: ["weekly HH:mm display, invalid rejection, error link focus and canonical save", "subscription expiry rejection, focus and unchanged UTC payload", "320px 200% text reflow of availability and expiry", "midnight/noon/afternoon displays, language changes", "legacy schedule validation and keyboard entry"], limits: "Isolated synthetic fixtures; no connected database/services or deployment. Physical devices and assistive technology untested. ar/zh/fr/de/hi/ja/pt/es and Arabic RTL deferred." }, null, 2) + "\n");
  console.log(`Passed ${engine}: ${matrix.length} en/lv/ru form/viewport cases, validation, payloads and keyboard entry.`);
} finally { await schedule.close(); }
