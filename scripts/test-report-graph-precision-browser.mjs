import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-reports.tsx", resources });
const { evaluate, until, click, set } = fixture;
try {
  await fixture.viewport(320);
  for (const language of ["en", "lv", "ru"]) {
    await fixture.visit(`/my-services/reports?company=1&graph=tiny&lang=${language}`);
    await until(() => document.querySelectorAll('[data-report-row]').length === 3, 'Tiny KWD bookings loaded');
    await click(`button[aria-label="${resources[language].translation.reports.graph}"]`);
    for (const mode of ['services', 'byService']) {
      await set('report-type', mode);
      await until(() => !!document.querySelector('[data-graph-currency="KWD"] .recharts-surface'), 'KWD chart rendered');
      const ticks = await evaluate(mode => [...document.querySelector('[data-graph-currency="KWD"]').querySelectorAll(mode === 'services' ? '.recharts-yAxis text' : '.recharts-xAxis text')].map(node => node.textContent), mode);
      assert.ok(ticks.some(value => Number(value.replace(',', '.')) > 0), `${language}/${mode}: nonzero axis ticks remain nonzero`);
      const amounts = await evaluate(() => [...document.querySelectorAll('[data-graph-currency="KWD"] [data-graph-metric]')].map(node => node.dataset.amount));
      assert.ok(amounts.includes('0.001')); assert.ok(amounts.includes('0.002')); assert.ok(amounts.includes('0.003'));
      assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    }
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []); assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
  }
  await mkdir('output/reports-graph-check', { recursive: true });
  await evaluate(() => document.querySelector('[data-graph-currency="KWD"]').scrollIntoView({ block: 'start' }));
  await fixture.screenshot('output/reports-graph-check/tiny-kwd-ru-320.png', false);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed tiny0.001/0.002KWD axes and exact values in daily/service graphs; en/lv/ru320, mocked APIs and no writes/network.');
} finally { await fixture.close(); }
