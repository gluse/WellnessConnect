import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const expected = {
  en: ["45 minutes", "1 hour, 30 minutes", "4 hours", "1 day, 1 hour, 1 minute"],
  lv: ["45 minūtes", "1 stunda un 30 minūšu", "4 stundas", "1 diena, 1 stunda un 1 minūte"],
  ru: ["45 минут", "1 час 30 минут", "4 часа", "1 день 1 час 1 минута"],
};
const resources = {};
for (const language of Object.keys(expected)) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/provider-duration.tsx", resources });
const { evaluate, until, click, key, viewport } = fixture;
const visibleDuration = (duration, details = false) => evaluate(({ duration, details }) => {
  const scope = details ? document.querySelector('[role="dialog"]') : document;
  const node = [...scope.querySelectorAll('p,[data-testid="text-duration"],.search-service-meta>span')].find(item => item.textContent === duration);
  if (!node || !node.getClientRects().length || node.scrollWidth > node.clientWidth + 1) return false;
  const text = document.createRange(); text.selectNodeContents(node);
  return [...text.getClientRects()].every(rect => rect.left >= 0 && rect.right <= innerWidth + 1);
}, { duration, details });
try {
  for (const [language, values] of Object.entries(expected)) for (const width of [390, 1280]) {
    await viewport(width); await fixture.visit(`/providers/teskaistumam?lang=${language}`);
    await until(() => document.querySelectorAll('[data-testid^="button-view-details-"]').length === 4, "provider services loaded");
    for (const [index, duration] of values.entries()) {
      const id = index + 1;
      assert.equal(await evaluate(({ id, duration }) => {
        const card = document.querySelector(`[data-testid="button-view-details-${id}"]`).closest('.search-service-card');
        return [...card.querySelectorAll('.search-service-meta>span')].some(node => node.textContent === duration);
      }, { id, duration }), true, `${language}/${width} card ${id}`);
      assert.equal(await visibleDuration(duration), true, `${language}/${width} card duration wraps without horizontal clipping`);
      await click(`[data-testid="button-view-details-${id}"]`);
      await until(() => !!document.querySelector('[data-testid="text-duration"]'), "details duration loaded");
      assert.equal(await evaluate(() => document.querySelector('[data-testid="text-duration"]').textContent), duration);
      assert.equal(await visibleDuration(duration, true), true, `${language}/${width} details duration wraps without horizontal clipping`);
      await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "details closed");
    }
    if (width === 1280) {
      await click('[data-testid="button-view-details-3"]');
      await click('[data-testid="button-book-from-details"]');
      await until(() => !!document.querySelector('[role="dialog"] aside'), "booking summary loaded");
      assert.equal(await evaluate(duration => [...document.querySelectorAll('[role="dialog"] aside p')].some(node => node.textContent === duration), values[2]), true, `${language} booking duration`);
      await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "booking closed");
    }
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    assert.equal(await evaluate(() => window.phase2Fixture.recordedViews.length), width === 1280 ? 5 : 4, 'One mocked view capture per explicit details open; booking adds none');
    console.log(`Passed provider duration cards/details ${language}/${width}${width === 1280 ? ' and booking summary' : ''}.`);
  }
  // Language switches must update already loaded cards without another page visit.
  await fixture.set('fixture-language', 'en');
  assert.equal(await evaluate(() => document.body.textContent.includes('4 hours')), true);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed 24 provider card/detail duration cases and 3 booking summaries; en/lv/ru only, synthetic API, no writes or external network.');
} finally { await fixture.close(); }
