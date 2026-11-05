import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
import { formatServiceDuration } from "../client/src/lib/service-duration.ts";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) {
  resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
  for (const key of ["label", "unit", "minute", "hour", "day", "help", "invalid"]) assert.ok(resources[language].translation.serviceDuration[key]?.trim());
}
const fixture = await browserFixture({ entry: "scripts/fixtures/service-form.tsx", resources });
const { evaluate, until, set, click, key, viewport } = fixture;
const open = async (minutes = 45, language = "en", extra = "") => {
  await fixture.visit(`/my-services/services/7/edit?mode=inactive&duration=${minutes}&lang=${language}${extra}`);
  await until(() => !!document.getElementById("duration-unit"), "duration controls ready");
};
const value = id => evaluate(id => document.getElementById(id).value, id);
const writes = () => evaluate(() => window.serviceFormFixture.writes);
const save = () => click('[data-testid="button-save-inactive-service"]');
const assertSaved = async minutes => {
  await until(() => location.pathname === "/my-services/services", "saved");
  const payloads = await writes();
  assert.equal(payloads.at(-1).duration, minutes);
  assert.equal("durationUnit" in payloads.at(-1), false);
  assert.equal("unit" in payloads.at(-1), false);
};
const matrix = [];
try {
  console.log("Duration: initial units and unchanged minute payload");
  await open(120);
  assert.equal(await value("duration"), "2"); assert.equal(await value("duration-unit"), "hour");
  await set("duration-unit", "day"); await set("duration-unit", "minute");
  assert.equal(await value("duration"), "120");
  assert.equal(await evaluate(() => document.querySelector('.service-editor > div [role="status"]')?.textContent ?? ""), "");
  await save(); await assertSaved(120);

  console.log("Duration: fractional days and failed/pending saves");
  await open(2880); assert.equal(await value("duration"), "2"); assert.equal(await value("duration-unit"), "day");
  await set("duration", "1.5"); await save(); await assertSaved(2160);

  await open(); await set("duration-unit", "hour"); await set("duration", "1.1");
  await set("fixture-result", "error"); await save();
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "failed save retains draft");
  assert.equal(await value("duration"), "1.1"); assert.equal(await value("duration-unit"), "hour");
  assert.equal((await writes()).at(-1).duration, 66);
  await set("fixture-result", "pending"); await save();
  await until(() => !!window.serviceFormFixture.pending, "pending save");
  assert.ok(await evaluate(() => document.getElementById("duration").disabled || document.getElementById("duration").matches(":disabled")));
  assert.ok(await evaluate(() => document.getElementById("duration-unit").matches(":disabled")));
  await fixture.button("Resolve pending save"); await assertSaved(66);

  for (const invalid of ["", "0", "-1", "1.025", "abc"]) {
    console.log("Duration: invalid input " + JSON.stringify(invalid));
    await open(); await set("duration-unit", "hour"); await set("duration", invalid); await save();
    await until(() => document.getElementById("duration").getAttribute("aria-invalid") === "true", "invalid duration");
    assert.equal((await writes()).length, 0);
    assert.equal(await value("duration"), invalid);
    assert.ok(await evaluate(() => document.getElementById("duration").getAttribute("aria-describedby").includes("duration-error")));
    await click('a[href="#duration"]');
    assert.equal(await evaluate(() => document.activeElement.id), "duration");
    await set("duration", "1.5"); await save(); await assertSaved(90);
  }

  for (const language of languages) {
    console.log("Duration: search and layout " + language);
    for (const minutes of [45, 60, 90, 1440, 2880, 1501]) {
      await open(minutes, language, "&durationPreview=1");
      assert.equal(await evaluate(() => document.querySelector('.search-service-meta > span').textContent), formatServiceDuration(minutes, language));
      await click('[data-testid="button-view-details-7"]');
      await until(() => !!document.querySelector('[role="dialog"]'), "details open");
      assert.ok(await evaluate(text => document.querySelector('[role="dialog"]').textContent.includes(text), formatServiceDuration(minutes, language)));
      await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "details close");
    }
    await set("duration-unit", "hour"); await set("duration", "1.5");
    await evaluate(() => document.getElementById("duration").focus()); await key("Tab");
    assert.equal(await evaluate(() => document.activeElement.id), "duration-unit");
    await key("ArrowDown"); await key("Enter");
    assert.equal(await value("duration-unit"), "day");
    for (const [width, height] of [[320, 900], [390, 300], [768, 900], [1280, 900]]) {
      await viewport(width, height);
      const layout = await evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, controls: ["duration", "duration-unit"].map(id => { const node = document.getElementById(id), rect = node.getBoundingClientRect(); return { labelled: !!node.labels?.length, height: rect.height, inside: rect.left >= 0 && rect.right <= innerWidth }; }) }));
      assert.equal(layout.overflow, false); assert.ok(layout.controls.every(control => control.labelled && control.height >= 44 && control.inside));
      matrix.push({ language, width, height });
    }
    await set("fixture-language", language === "en" ? "lv" : "en");
    assert.equal(await value("duration-unit"), "day"); assert.equal(await value("duration"), "0.0625");
    await set("duration-unit", "hour"); await set("duration", "1,5");
    await set("fixture-language", language);
    assert.equal(await value("duration"), "1,5");
    await save(); await assertSaved(90);
    assert.deepEqual(await evaluate(() => window.serviceFormFixture.unexpected), []);
  }
  await open(2880, "en", "&durationPreview=1"); await viewport(390, 800);
  await evaluate(() => document.getElementById("duration").scrollIntoView({ block: "center" }));
  const engine = process.env.FORMS_BROWSER || "chrome";
  await fixture.screenshot(`docs/service-duration-${engine}.png`, false);
  assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  await writeFile(`docs/service-duration-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-05", browser: await fixture.api("Browser.getVersion"), languages, matrix, checks: ["initial minutes/hours/days", "unit switching preserves minutes and clean draft", "fractional hours/days become integer-minute payloads", "blank/zero/negative/partial-minute validation and correction", "failed save retains draft, pending controls disabled", "localized exact search card and details display", "keyboard unit selection and locale switch retain duration", "labelled 44px controls and reflow"], network: fixture.network, blocked: fixture.blocked, errors: fixture.errors, limits: "Synthetic mocked APIs only. No connected writes, physical devices or screen reader. ar (including RTL), zh, fr, de, hi, ja, pt, es deferred." }, null, 2) + "\n");
  console.log(`Passed duration browser interactions and search display; ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
