// Focused checks for the standalone approval preview; reuses the existing harness.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const fixture = await browserFixture({ html: await readFile(new URL("../docs/search-design-preview.html", import.meta.url), "utf8") });
const { api, evaluate, until, viewport, set, click, key, screenshot } = fixture;
const checks = [], matrix = [], screenshots = [];
const capture = async name => { const file = `docs/search-design-${name}.png`; await screenshot(file); screenshots.push(file); };
try {
  await api("Page.navigate", { url: fixture.origin + "/preview" });
  await until(() => window.searchDesign?.ready, "search design ready");
  const keys = await evaluate(() => Object.keys(window.searchDesign.messages.en).sort());
  for (const language of ["en", "lv", "ru"]) {
    assert.deepEqual(await evaluate(language => Object.keys(window.searchDesign.messages[language]).sort(), language), keys);
    await set("preview-language", language);
    for (const width of [320, 390, 768, 1280]) {
      await viewport(width);
      assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language}/${width}: page overflow`);
      assert.ok(await evaluate(() => [...document.querySelectorAll('.shell button,.shell input,.shell select')].filter(n => n.getClientRects().length).every(n => { const b = n.getBoundingClientRect(); return b.left >= -1 && b.right <= innerWidth + 1; })), `${language}/${width}: control overflow`);
      assert.equal(await evaluate(() => document.documentElement.lang), language);
      matrix.push({ language, width });
    }
  }
  checks.push("English/Latvian/Russian message parity and 12 language/viewport reflow cases");
  await set("preview-language", "en"); await viewport(1280);
  assert.equal(await evaluate(() => document.querySelectorAll(".service").length), 3);
  await capture("desktop");
  await set("category", "fitness"); await click("#apply-filters");
  assert.equal(await evaluate(() => document.querySelectorAll(".service").length), 1);
  await click("#reset"); await set("sort", "price");
  assert.equal(await evaluate(() => document.querySelector(".service h3").textContent), "Restorative yoga");
  await click(".titlebutton"); assert.ok(await evaluate(() => document.getElementById("detail").open));
  await click("#detail-book"); assert.ok(await evaluate(() => !document.getElementById("detail-feedback").hidden));
  await key("Escape"); assert.ok(!await evaluate(() => document.getElementById("detail").open));
  checks.push("category apply/reset, sorting and service details/demo booking dialog");
  await set("location", "Rīga"); await click('.searchbar button[type="submit"]');
  await click('[data-view="map"]'); await capture("map");
  await click(".pin"); assert.ok(await evaluate(() => !!document.querySelector(".pin.selected")));
  await viewport(390); await click("#mobile-view"); await capture("phone");
  await click("#open-filters"); assert.equal(await evaluate(() => document.activeElement.id), "close-filters");
  await capture("phone-filters"); await key("Escape");
  assert.equal(await evaluate(() => document.activeElement.id), "open-filters");
  checks.push("map selection, phone list/filter drawer, Escape and focus restoration");
  for (const state of ["empty", "loading", "error", "location", "maperror"]) {
    await set("preview-state", state);
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), state);
  }
  await click(".status-panel button"); assert.ok(await evaluate(() => !!document.querySelector(".service")));
  await set("preview-state", "error"); await capture("error");
  await click(".status-panel button");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  checks.push("empty/loading/error/location-denied/map-failure recovery; no unexpected requests or runtime errors");
  await writeFile(new URL("../docs/search-design-evidence.json", import.meta.url), JSON.stringify({ date: "2026-10-20", browser: "Installed headless Chrome", checks, matrix, screenshots, runtimeErrors: fixture.errors, unexpectedNetwork: fixture.network, deferredLanguages: ["ar", "de", "es", "fr", "hi", "ja", "pt", "zh"], limits: "Standalone synthetic design only; no app, APIs, maps service, geolocation, sessions, booking or database. Physical devices, screen readers and cross-browser checks not performed." }, null, 2) + "\n");
  console.log(`Search design passed: ${checks.length} groups, ${matrix.length} locale/viewport cases; ${screenshots.length} screenshots.`);
} finally { await fixture.close(); }
