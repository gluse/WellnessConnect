import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-reports.tsx", resources });
const { evaluate, until, viewport, set } = fixture;
const folder = "output/reports-mobile-summary-check"; await mkdir(folder, { recursive: true });
const results = [];
try {
  for (const language of ["en", "lv", "ru"]) for (const width of [320, 390, 768, 1280]) {
    await viewport(width);
    for (const scenario of ['single', 'multiple', 'large', 'zero', 'empty']) {
      const company = scenario !== 'single';
      await fixture.visit(`/my-services/reports?lang=${language}${company ? '&company=1' : ''}${scenario === 'large' || scenario === 'zero' ? `&sums=${scenario}` : ''}${scenario === 'empty' ? '&state=empty' : ''}`);
      await until(() => document.querySelectorAll('[data-report-summary-card]').length === 4, 'Four summary cards loaded');
      for (const mode of ['services', 'byService']) {
        await set('report-type', mode);
        await until(() => document.querySelectorAll('[data-report-summary-card]').length === 4, 'Summary remains available');
        if (mode === 'byService') await until(() => !!document.querySelector('[data-report-group]'), 'Service catalog ready');
        const layout = await evaluate(() => {
          const summary = document.querySelector('[data-testid="report-summary"]'), cards = [...summary.querySelectorAll('[data-report-summary-card]')];
          const rects = cards.map(card => card.getBoundingClientRect());
          const visible = node => !!node.getClientRects().length && getComputedStyle(node).display !== 'none';
          const clipped = [];
          for (const node of summary.querySelectorAll('h2, [data-testid^="total-"]')) {
            const box = node.getBoundingClientRect(), card = node.closest('[data-report-summary-card]').getBoundingClientRect();
            const range = document.createRange(); range.selectNodeContents(node);
            if (node.scrollWidth > node.clientWidth + 1 || box.left < card.left || box.right > card.right + 1 || [...range.getClientRects()].some(line => line.left < card.left || line.right > card.right + 1 || line.bottom > card.bottom + 1)) clipped.push(node.textContent);
          }
          return {
            columns: getComputedStyle(summary).gridTemplateColumns.split(' ').length,
            helpersVisible: [...summary.querySelectorAll('[data-summary-help]')].every(visible),
            helpersHidden: [...summary.querySelectorAll('[data-summary-help]')].every(node => !visible(node)),
            iconsVisible: [...summary.querySelectorAll('[data-summary-icon]')].every(visible),
            iconsHidden: [...summary.querySelectorAll('[data-summary-icon]')].every(node => !visible(node)),
            sameRow: Math.abs(rects[0].top - rects[1].top) < 1,
            secondRow: rects[2].top > rects[0].bottom && Math.abs(rects[2].top - rects[3].top) < 1,
            overflow: document.documentElement.scrollWidth > innerWidth + 1, clipped,
            height: summary.getBoundingClientRect().height,
            labels: cards.map(card => ({ accessible: card.getAttribute('aria-label'), heading: card.querySelector('h2').textContent })),
            values: cards.map(card => [...card.querySelectorAll('[data-testid^="total-"]')].map(node => node.textContent)),
          };
        });
        assert.equal(layout.columns, width >= 1280 ? 4 : 2, `${language}/${width}/${scenario}/${mode} columns`);
        assert.equal(layout.sameRow, true); if (width < 1280) assert.equal(layout.secondRow, true);
        assert.equal(layout.overflow, false, `${language}/${width}/${scenario}/${mode} no page overflow`);
        assert.deepEqual(layout.clipped, [], `${language}/${width}/${scenario}/${mode} complete labels and amounts`);
        assert.ok(layout.labels.every(label => label.accessible && label.accessible === label.heading), 'Each metric retains an accessible heading');
        if (width < 640) { assert.equal(layout.helpersHidden, true); assert.equal(layout.iconsHidden, true); }
        else { assert.equal(layout.helpersVisible, true); assert.equal(layout.iconsVisible, true); }
        if (scenario === 'single') assert.ok(layout.values.every(values => values.length === 1));
        if (scenario === 'multiple' || scenario === 'large' || scenario === 'zero') assert.ok(layout.values.every(values => values.length === 2));
        if (scenario === 'zero') assert.ok(layout.values.flat().every(value => /0[.,]00/.test(value)));
        if (scenario === 'large') assert.ok(layout.values.flat().some(value => value.length > 12), 'Long monetary totals were actually exercised');
        if (scenario === 'empty' && mode === 'services') assert.ok(layout.values.every(values => values.length === 0));
        if (width < 640 && scenario === 'single') assert.ok(layout.height < 230, 'Single-currency phone summary is compact');
        results.push({ language, width, scenario, mode, height: layout.height, columns: layout.columns });
        if (language === 'en' && scenario === 'multiple' && mode === 'services' && [390, 1280].includes(width)) {
          await evaluate(() => document.querySelector('[data-testid="report-summary"]').scrollIntoView({ block: 'center' }));
          await fixture.screenshot(`${folder}/summary-${width}.png`, false);
        }
        if (language === 'ru' && scenario === 'large' && mode === 'byService' && width === 320) {
          await evaluate(() => document.querySelector('[data-testid="report-summary"]').scrollIntoView({ block: 'center' }));
          await fixture.screenshot(`${folder}/summary-large-ru-320.png`, false);
        }
      }
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
      assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    }
    console.log(`Passed compact report summaries ${language}/${width}.`);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`${folder}/evidence.json`, JSON.stringify({ date: '2026-11-07', browser: await fixture.api('Browser.getVersion'), results, deferredLanguages: ['ar', 'zh', 'fr', 'de', 'hi', 'ja', 'pt', 'es'], limits: 'Synthetic API, Chrome CSS viewport emulation; no connected writes, external network, physical devices or screen readers.' }, null, 2));
  console.log(`Passed ${results.length} compact summary cases; en/lv/ru, two report modes, single/multiple currencies, large/zero/empty sums, no clipping or page overflow.`);
} finally { await fixture.close(); }
