import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";
const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/notifications.tsx", resources, nativeZoom: 4 });
const cases = [];
try {
  for (const language of languages) for (const mode of ["account", "service", "appointments"]) {
    await fixture.visit(`/?mode=${mode}&pro=${mode === "service"}&verified=true&lang=${language}`);
    await fixture.until(() => !!document.querySelector('#communication-method, #service-reminder-enabled, article'), "content");
    if (mode === "service") await fixture.click("#service-reminder-enabled");
    if (mode === "appointments") { await fixture.button(resources[language].translation.notifications.sendReminder); await fixture.until(() => !!document.querySelector('a[href^="mailto:"]')); }
    const selector = mode === "appointments" ? '[role="dialog"]' : mode === "service" ? ".service-editor" : "#communication";
    await fixture.settle();
    const metrics = await fixture.evaluate(selector => {
      const fields = [...document.querySelectorAll(selector + ' input,' + selector + ' select,' + selector + ' button,' + selector + ' a')].filter(e => e.getClientRects().length && !e.closest('[aria-hidden="true"]'));
      return { outerWidth, innerWidth, dpr: devicePixelRatio, scale: visualViewport.scale, cssZoom: getComputedStyle(document.documentElement).zoom, scrollWidth: document.documentElement.scrollWidth, controls: fields.length, clipped: fields.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.id || e.textContent.slice(0, 30)) };
    }, selector);
    assert.equal(metrics.outerWidth, 1280); assert.ok(metrics.innerWidth >= 300 && metrics.innerWidth <= 320, JSON.stringify(metrics)); assert.equal(metrics.dpr, 4); assert.equal(metrics.scale, 1); assert.equal(Number(metrics.cssZoom), 1); assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1); assert.deepEqual(metrics.clipped, []);
    const focus = await fixture.evaluate(selector => [...document.querySelectorAll(selector + ' input,' + selector + ' select,' + selector + ' button,' + selector + ' a')].filter(e => !e.matches(':disabled') && e.getClientRects().length && !e.closest('[aria-hidden="true"]')).map(e => { e.focus(); e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { id: e.id || e.textContent.slice(0, 30), focused: document.activeElement === e, visible: r.bottom > 0 && r.top < innerHeight }; }), selector);
    assert.ok(focus.every(e => e.focused && e.visible), JSON.stringify(focus));
    const contrast = [];
    for (const theme of ["light", "dark"]) {
      await fixture.evaluate(theme => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
      const measured = await measureFormContrast(fixture, selector); assert.deepEqual(measured.failures, [], `${mode}/${language}/${theme}: contrast`); contrast.push({ theme, ...measured });
    }
    await fixture.evaluate(() => document.documentElement.classList.remove("dark"));
    cases.push({ language, mode, metrics, focus, contrast });
    assert.deepEqual(await fixture.evaluate(() => window.phase2Fixture.unexpected), []);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL("../docs/notifications-accessibility-evidence.json", import.meta.url), JSON.stringify({ date: "2026-10-29", browser: await fixture.api("Browser.getVersion"), languages, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], method: "Native Chrome 400% zoom in a 1280px window (DPR4, CSS zoom1, no pinch); computed contrast and reachable focus for account/service/modal controls in light/dark themes.", cases, limits: "Synthetic local fixture; computed contrast does not inspect native checkbox paint; screen readers, native languages and physical devices unverified. No live APIs/database/provider sends." }, null, 2) + "\n");
  console.log(`Passed notifications accessibility: ${cases.length} en/lv/ru native 400% zoom/reachable-focus cases with light/dark computed contrast.`);
} finally { await fixture.close(); }
