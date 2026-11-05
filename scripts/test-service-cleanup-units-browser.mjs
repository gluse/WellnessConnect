import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-form.tsx", resources });
const { evaluate, set, click, until, viewport, key } = fixture;
const open = async (minutes = 15, language = "en") => {
  await fixture.visit(`/my-services/services/7/edit?mode=inactive&cleanupTime=${minutes}&lang=${language}`);
  await until(() => !!document.getElementById("cleanupTime-unit"), "cleanup controls ready");
};
const value = id => evaluate(id => document.getElementById(id).value, id);
const writes = () => evaluate(() => window.serviceFormFixture.writes);
const save = () => click('[data-testid="button-save-inactive-service"]');
const saved = async minutes => {
  await until(() => location.pathname === "/my-services/services", "saved");
  const payload = (await writes()).at(-1);
  assert.equal(payload.cleanupTime, minutes); assert.equal(payload.duration, 45);
  assert.equal("cleanupTimeUnit" in payload, false); assert.equal("unit" in payload, false);
};
const matrix = [];
try {
  for (const [minutes, unit, text] of [[0, "minute", "0"], [15, "minute", "15"], [120, "hour", "2"], [1440, "day", "1"]]) {
    await open(minutes); assert.equal(await value("cleanupTime"), text); assert.equal(await value("cleanupTime-unit"), unit);
    await set("cleanupTime-unit", "day"); await set("cleanupTime-unit", "minute");
    assert.equal(await value("cleanupTime"), String(minutes));
    assert.equal(await evaluate(() => document.querySelector('.service-editor > div [role="status"]')?.textContent ?? ""), "");
    await save(); await saved(minutes);
  }
  console.log("Cleanup: initial units, zero, boundaries and unchanged duration passed");
  for (const [unit, text, minutes] of [["hour", "1.5", 90], ["hour", "1,1", 66], ["day", "0.5", 720], ["hour", "24", 1440], ["day", "1", 1440]]) {
    await open(); await set("cleanupTime-unit", unit); await set("cleanupTime", text); await save(); await saved(minutes);
  }
  for (const [unit, text] of [["minute", ""], ["hour", "abc"], ["minute", "-1"], ["minute", "1.5"], ["minute", "1441"], ["hour", "24.1"], ["day", "1.01"]]) {
    await open(); await set("cleanupTime-unit", unit); await set("cleanupTime", text); await save();
    await until(() => document.getElementById("cleanupTime").getAttribute("aria-invalid") === "true", "cleanup validation");
    assert.equal((await writes()).length, 0); assert.equal(await value("cleanupTime"), text);
    assert.ok(await evaluate(() => document.getElementById("cleanupTime").getAttribute("aria-describedby").includes("cleanupTime-error")));
    await click('a[href="#cleanupTime"]'); assert.equal(await evaluate(() => document.activeElement.id), "cleanupTime");
    await set("cleanupTime", "0"); await save(); await saved(0);
  }
  console.log("Cleanup: fractional conversions and limit validation passed");
  await open(); await set("cleanupTime-unit", "hour"); await set("cleanupTime", "1,5"); await set("fixture-result", "error"); await save();
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "failed save");
  assert.equal(await value("cleanupTime"), "1,5"); assert.equal(await value("cleanupTime-unit"), "hour");
  await set("fixture-result", "pending"); await save(); await until(() => !!window.serviceFormFixture.pending, "pending save");
  assert.ok(await evaluate(() => ["cleanupTime", "cleanupTime-unit"].every(id => document.getElementById(id).matches(":disabled"))));
  await fixture.button("Resolve pending save"); await saved(90);

  for (const language of languages) {
    await open(1440, language);
    assert.equal(await evaluate(() => document.querySelector('label[for="cleanupTime"]').textContent), resources[language].translation.serviceCleanup.label + " *");
    await evaluate(() => document.getElementById("cleanupTime").focus()); await key("Tab");
    assert.equal(await evaluate(() => document.activeElement.id), "cleanupTime-unit");
    for (const [width, height] of [[320, 900], [390, 300], [768, 900], [1280, 900]]) {
      await viewport(width, height);
      const layout = await evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, controls: ["duration", "duration-unit", "cleanupTime", "cleanupTime-unit"].map(id => { const node = document.getElementById(id), box = node.getBoundingClientRect(); return { labelled: !!node.labels?.length, inside: box.left >= 0 && box.right <= innerWidth, height: box.height }; }), aligned: Math.abs(document.getElementById("cleanupTime").getBoundingClientRect().top - document.getElementById("cleanupTime-unit").getBoundingClientRect().top) < 1 }));
      assert.equal(layout.overflow, false); assert.equal(layout.aligned, true);
      assert.ok(layout.controls.every(control => control.labelled && control.inside && control.height >= 44));
      matrix.push({ language, width, height });
    }
    await set("cleanupTime-unit", "hour"); await set("cleanupTime", "0,5");
    await set("fixture-language", language === "en" ? "lv" : "en");
    assert.equal(await value("cleanupTime"), "0,5"); assert.equal(await value("cleanupTime-unit"), "hour");
    await save(); await saved(30);
    assert.deepEqual(await evaluate(() => window.serviceFormFixture.unexpected), []);
  }
  const engine = process.env.FORMS_BROWSER || "chrome";
  await open(720); await viewport(390, 800);
  await evaluate(() => document.getElementById("cleanupTime").scrollIntoView({ block: "center" }));
  await fixture.screenshot(`docs/service-cleanup-units-${engine}.png`, false);
  assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  await writeFile(`docs/service-cleanup-units-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-05", browser: await fixture.api("Browser.getVersion"), languages, matrix, checks: ["initial values and zero", "unit switches preserve minute payload and clean draft", "fractional hours/days and decimal comma", "integer-minute 0–1440 validation with linked errors", "failed save retention and pending controls", "duration remains independent", "locale switch and keyboard focus", "labelled aligned controls and responsive layout"], network: fixture.network, blocked: fixture.blocked, errors: fixture.errors, limits: "Mocked APIs only. No connected writes, physical devices or screen reader. ar (including RTL), zh, fr, de, hi, ja, pt, es deferred." }, null, 2) + "\n");
  console.log(`Passed cleanup units; ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
