import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ['en','lv','ru']) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, 'utf8')) };
const fixture = await browserFixture({ entry: 'scripts/fixtures/search-redesign.tsx', resources, nativeZoom: 4 });
const { evaluate, until, click, set, key } = fixture;
const matrix = [];
try {
  await fixture.visit('/search?redesign=1');
  await until(() => document.querySelectorAll('.search-service-card').length === 9, 'zoomed results');
  const zoom = await evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom, visualScale: visualViewport.scale }));
  assert.ok(zoom.width >= 300 && zoom.width <= 320, JSON.stringify(zoom));
  assert.equal(zoom.dpr, 4); assert.equal(zoom.cssZoom, '1'); assert.equal(zoom.visualScale, 1);
  for (const language of ['en','lv','ru']) {
    await set('fixture-language', language);
    for (const view of ['grid','list']) {
      await click(`[data-testid="button-view-${view}"]`);
      assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language}/${view}: zoomed page reflows`);
      assert.ok(await evaluate(() => [...document.querySelectorAll('.search-service-art')].every(node => { const b = node.getBoundingClientRect(); return b.width > 0 && Math.abs(b.width - b.height) <= 1; })), `${language}/${view}: square media at native zoom`);
      for (const target of ['[data-testid="open-search-when"]','.search-mobile-filter-trigger']) {
        await click(target); await fixture.settle();
        assert.ok(await evaluate(() => { const d = document.querySelector('[role="dialog"]'), b = d.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1 && d.scrollWidth <= d.clientWidth + 1; }), `${language}/${view}: zoomed dialog fits and scrolls`);
        await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'zoomed dialog closed');
      }
      matrix.push({ language, view, ...zoom });
    }
  }
  // Capture the actual viewport: CDP's beyond-viewport screenshot can crop to
  // CSS width rather than physical width at persisted native browser zoom.
  await fixture.screenshot('docs/search-redesign-chrome-native-zoom400.png', false);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.network, []);
  await writeFile('docs/search-redesign-zoom400-evidence.json', JSON.stringify({ date: '2026-11-02', browser: await fixture.api('Browser.getVersion'), matrix, deferredLanguages: ['ar','zh','fr','de','hi','ja','pt','es'], limits: 'Native Chrome 400% browser zoom; synthetic APIs and images. No physical-device or screen-reader verification and no live services or database writes.' }, null, 2) + '\n');
  console.log(`Search native 400% zoom: ${matrix.length} en/lv/ru grid/list cases and scrollable When/Filters dialogs passed.`);
} finally { await fixture.close(); }
