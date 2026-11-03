import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-calendar.tsx", resources, timezoneId: "Europe/Riga", nativeZoom: 4 });
const matrix = [];
try {
  for (const language of languages) {
    await fixture.visit(`/my-services/appointments?lang=${language}`);
    await fixture.until(() => !!document.querySelector('[data-testid="appointment-filters"]'), "page ready");
    await fixture.until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "calendar ready");
    const state = await fixture.evaluate(() => ({ width: innerWidth, fits: document.documentElement.scrollWidth <= innerWidth + 1, mode: document.querySelector('#appointment-calendar-mode').value }));
    assert.ok(state.width <= 320); assert.equal(state.fits, true); assert.equal(state.mode, "day");
    await fixture.set("appointment-calendar-date", "2026-10-25");
    const offsets = await fixture.evaluate(() => ({ note: document.querySelector('[role="note"]')?.textContent, labels: [...document.querySelector('[data-calendar-day]').querySelectorAll('span')].map(node => node.textContent).join(" ") }));
    assert.equal(offsets.note, resources[language].translation.appointmentCalendar.dstNote);
    assert.ok(offsets.labels.includes("+2") && offsets.labels.includes("+3"), "Repeated local hours show distinct offsets");
    await fixture.set("appointment-calendar-date", "2026-03-29");
    assert.ok(await fixture.evaluate(() => !!document.querySelector('[role="note"]')), "Spring transition is explicitly labelled");
    await fixture.set("appointment-calendar-mode", "week");
    assert.equal(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "Week overflow remains scoped to the calendar");
    await fixture.set("appointment-calendar-mode", "day"); await fixture.set("appointment-calendar-date", "2026-11-03");
    await fixture.screenshot(`docs/appointment-calendar-zoom-${language}.png`, false);
    matrix.push({ language, ...state, dst: true });
    assert.deepEqual(await fixture.evaluate(() => window.phase2Fixture.unexpected), []);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL("../docs/appointment-calendar-zoom-evidence.json", import.meta.url), JSON.stringify({ browser: await fixture.api("Browser.getVersion"), zoom: "Native Chrome 400% at 1280px window", timezone: "Europe/Riga", matrix, limits: "Synthetic offline fixture; en/lv/ru only. Other locales/RTL deferred." }, null, 2) + "\n");
  console.log("Passed native Chrome 400% en/lv/ru reflow, scoped weekly scrolling and Europe/Riga DST labels.");
} finally { await fixture.close(); }
