import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/mobile-navigation.tsx", resources });
const { evaluate, until, viewport, visit } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome";
const matrix = [];
try {
  for (const language of languages) {
    for (const [width, height] of [[320, 700], [360, 800], [390, 844], [545, 900]]) {
      await viewport(width, height);
      await visit(`/my-services/appointments?lang=${language}`);
      await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "appointments rendered");
      // Match CSS viewport widths in Windows WebKit, where the scrollbar consumes 4px.
      const gutter = await evaluate(() => matchMedia(`(width: ${document.documentElement.clientWidth}px)`).matches ? innerWidth - document.documentElement.clientWidth : 0);
      if (gutter) await viewport(width + gutter, height);
      await fixture.settle();
      const labels = await evaluate(() => [...document.querySelectorAll('[data-mobile-navigation] a, [data-mobile-navigation] button')].map(control => {
        const label = control.querySelector("span");
        const range = document.createRange(); range.selectNodeContents(label);
        const box = control.getBoundingClientRect(), text = label.getBoundingClientRect();
        return { text: label.textContent, lines: range.getClientRects().length,
          width: box.width, height: box.height,
          fits: text.left >= box.left && text.right <= box.right + 1 && control.scrollWidth <= control.clientWidth + 1 };
      }));
      assert.equal(labels.length, 4);
      assert.ok(labels.every(label => label.lines === 1 && label.fits && label.width >= 44 && label.height >= 44), `${engine}/${language}/${width}: ${JSON.stringify(labels)}`);
      assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      if (width === 360) {
        await fixture.screenshot(`docs/mobile-navigation-labels-${engine}-${language}-360x800.png`, false);
        await fixture.click('[data-mobile-navigation] a[href="/my-services/appointments"]');
        assert.equal(await evaluate(() => location.pathname), "/my-services/appointments");
      }
      matrix.push({ language, width, height, labels });
      await evaluate(() => { document.documentElement.style.fontSize = "32px"; });
      await until(() => parseFloat(getComputedStyle(document.querySelector('.mobile-navigation-layout')).paddingBottom) >= document.querySelector('[data-mobile-navigation]').getBoundingClientRect().height, "enlarged-label clearance");
      assert.equal(await evaluate(() => {
        const bar = document.querySelector('[data-mobile-navigation]');
        return bar.scrollWidth <= bar.clientWidth + 1 && [...bar.querySelectorAll('a,button')].every(control => control.scrollWidth <= control.clientWidth + 1);
      }), true, `${language}/${width}: enlarged text remains inside the bar`);
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/mobile-navigation-labels-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, matrix, enlargedText: "200% root font size: wrapping permitted, no clipped controls, reserved bar clearance", deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Isolated real App, synthetic fetch mocks; emulated CSS viewports, no physical Galaxy A55 or connected service/database operations." }, null, 2) + "\n");
  console.log(`Passed ${engine}: single-line labels at 320/360/390/545px in en/lv/ru; 200% text wrapping and bar clearance.`);
} finally { await fixture.close(); }
