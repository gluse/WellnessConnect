import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "file:///C:/Source/Private/WellnessConnect/scripts/fixtures/browser-harness.mjs";
const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-reports.tsx", resources });
const { evaluate, until, click, set, viewport, key } = fixture;
const folder = "output/aws-publish-frontend-2026-11-09/graphs"; await mkdir(folder, { recursive: true });
const points = async count => { await evaluate(count => { window.expectedGraphCount = count; }, count); await until(() => document.querySelectorAll('[data-graph-point]').length === window.expectedGraphCount, `${count} exact graph points`); };
const clean = async () => { assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []); assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []); };
async function bounds() {
  const layout = await evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    escaped: [...document.querySelectorAll('.recharts-surface text')].filter(node => {
      const box = node.getBoundingClientRect(), svg = node.closest('svg').getBoundingClientRect();
      return box.width && (box.left < svg.left - 1 || box.right > svg.right + 1 || box.top < svg.top - 1 || box.bottom > svg.bottom + 1);
    }).map(node => node.textContent),
    unlabeled: [...document.querySelectorAll('[data-graph-currency]')].some(node => !document.getElementById(node.getAttribute('aria-labelledby'))?.textContent),
  }));
  assert.equal(layout.overflow, false, 'Charts and data tables stay in bounded scrollers');
  assert.deepEqual(layout.escaped, [], 'All chart axis text remains inside the SVG');
  assert.equal(layout.unlabeled, false);
}
try {
  for (const language of ["en", "lv", "ru"]) for (const width of [320, 390, 768, 1280]) {
    const text = resources[language].translation.reports;
    await viewport(width); await fixture.visit(`/my-services/reports?company=1&graph=days&lang=${language}`);
    await until(() => document.querySelectorAll('[data-report-row]').length === 6, 'Default list loaded');
    assert.equal(await evaluate(label => document.querySelector(`button[aria-label="${label}"]`).getAttribute('aria-pressed'), text.list), 'true');
    const summaryHeight = await evaluate(() => document.querySelector('[data-testid="report-summary"]').getBoundingClientRect().height);
    await click(`button[aria-label="${text.graph}"]`); await points(4);
    await until(() => document.querySelectorAll('.recharts-surface').length === 2, 'Two currency charts rendered');
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-graph-currency]')].map(node => node.dataset.graphCurrency)), ['EUR', 'USD']);
    assert.equal(await evaluate(() => document.querySelectorAll('.recharts-bar').length), 8, 'Four distinct status series per currency');
    assert.equal(await evaluate(() => !!document.querySelector('article[data-report-row]')), false, 'No thumbnail view remains');
    assert.equal(await evaluate(() => document.querySelector('[data-testid="report-summary"]').getBoundingClientRect().height), summaryHeight, 'Compact summary unchanged by Graph mode');
    const euro = await evaluate(() => [...document.querySelector('[data-graph-currency="EUR"]').querySelectorAll('[data-graph-point]')].map(node => ({ day: node.dataset.date.slice(-2), count: node.querySelector('[data-graph-count]').textContent, values: [...node.querySelectorAll('[data-graph-metric]')].map(cell => cell.dataset.amount) })));
    assert.deepEqual(euro, [{ day: '03', count: '2', values: ['10.00', '0.00', '0.00', '40.00'] }, { day: '07', count: '1', values: ['0.00', '20.00', '0.00', '0.00'] }, { day: '11', count: '2', values: ['3.00', '0.00', '30.00', '0.00'] }]);
    await evaluate(() => document.querySelector('[data-graph-data] summary').focus()); await key('Enter');
    assert.equal(await evaluate(() => document.querySelector('[data-graph-data]').open), true, 'Exact values available by keyboard without hover');
    assert.equal(await evaluate(() => !!document.querySelector('[data-graph-data] table').getClientRects().length), true);
    await key('Enter'); assert.equal(await evaluate(() => document.querySelector('[data-graph-data]').open), false);
    await click('[data-graph-data] summary'); assert.equal(await evaluate(() => document.querySelector('[data-graph-data]').open), true, 'Exact values available by click/touch-style activation');
    await click('[data-graph-data] summary');
    await bounds();
    assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-scroll]')].every(node => node.scrollWidth <= node.clientWidth + 1)), true, 'Few-day graph fits without horizontal scrolling');
    if (language === 'en' && [390, 1280].includes(width)) { await evaluate(() => document.querySelector('[data-graph-currency]').scrollIntoView({ block: 'start' })); await fixture.screenshot(`${folder}/daily-${width}.png`, false); }
    await set('report-employee', '11'); await points(4);
    await fixture.button(text.show); await points(3);
    assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-currency="EUR"] [data-graph-metric="pending"]')].every(node => node.dataset.amount === '0.00')), true, 'Applied employee selection filters graph totals');
    await set('report-type', 'byService'); await points(5);
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-graph-point]')].map(node => Number(node.dataset.serviceId)).sort((a,b) => a-b)), [101,101,102,103,999]);
    assert.equal(await evaluate(() => document.querySelector('[data-graph-point][data-service-id="103"] [data-graph-count]').textContent), '0');
    assert.equal(await evaluate(() => [...document.querySelectorAll('.recharts-yAxis text')].some(node => node.textContent.includes('#103') && node.textContent.includes('0'))), true, 'Zero-booking service has a visible label/count');
    await bounds();
    assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-scroll]')].every(node => node.scrollWidth <= node.clientWidth + 1)), true, 'Service graph and full numeric scale fit the panel');
    if (language === 'en' && [390,1280].includes(width)) { await evaluate(() => document.querySelector('[data-graph-currency]').scrollIntoView({ block: 'start' })); await fixture.screenshot(`${folder}/services-${width}.png`, false); }
    if (language === 'en' && width === 1280) {
      await click('[data-testid="export-csv"]'); await until(() => window.phase2Fixture.downloads.length > 0, 'Graph mode exports data');
      const download = await evaluate(() => window.phase2Fixture.downloads.shift()), bytes = Buffer.from(download.base64, 'base64');
      assert.ok(bytes.toString('utf8').includes('Anna Visible')); assert.ok(bytes.toString('utf8').includes('"Massage","101","EUR","1","1","0","0","0","10","0","0","0"'));
      await writeFile(`${folder}/filtered-graph.csv`, bytes);
    }
    await click(`button[aria-label="${text.list}"]`); await until(() => document.querySelectorAll('[data-report-group]').length === 5, 'List alternative returns');
    assert.equal(await evaluate(() => !!document.querySelector('[data-testid="report-graphs"]')), false);
    await click(`button[aria-label="${text.graph}"]`); await points(5);
    const next = language === 'en' ? 'lv' : 'en'; await set('fixture-language', next);
    assert.equal(await evaluate(title => document.querySelector('[data-graph-currency] h3').textContent.includes(title), resources[next].translation.reports.serviceGraph), true, 'Graph labels follow live locale changes');
    await clean(); console.log(`Passed List/Graph data, filters and accessibility ${language}/${width}.`);
  }
  await viewport(320); await fixture.visit('/my-services/reports?company=1&graph=manyDays&lang=en');
  await until(() => document.querySelectorAll('[data-report-row]').length === 24, 'Many appointment dates');
  await click(`button[aria-label="${resources.en.translation.reports.graph}"]`); await points(24); await bounds();
  await evaluate(() => document.querySelector('[data-graph-scroll]').focus()); await key('ArrowRight');
  await until(() => document.querySelector('[data-graph-scroll]').scrollLeft > 0, 'Many-date graph scrolls by keyboard'); await clean();
  await fixture.visit('/my-services/reports?company=1&graph=many&lang=ru');
  await until(() => document.querySelectorAll('[data-report-row]').length === 6, 'Many-service fixture');
  await click(`button[aria-label="${resources.ru.translation.reports.graph}"]`); await set('report-type', 'byService'); await points(31); await bounds();
  assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-point]')].filter(node => node.textContent.includes('Long named service')).length), 24, 'Long-name zero services all remain in exact values');
  assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-currency] [role="region"]')].some(node => node.scrollHeight > node.clientHeight)), true, 'Many service chart is bounded vertically');
  assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-scroll]')].every(node => node.scrollWidth <= node.clientWidth + 1)), true, 'Long-name service graph still fits horizontally');
  await evaluate(() => document.querySelector('[data-graph-currency]').scrollIntoView({ block: 'start' })); await fixture.screenshot(`${folder}/many-services-ru-320.png`, false); await clean();
  for (const state of ['empty', 'zero']) {
    await fixture.visit(`/my-services/reports?company=1&lang=en${state === 'empty' ? '&state=empty' : '&sums=zero'}`);
    await until(() => !!document.querySelector('[data-testid="report-summary"]'), 'Report ready');
    await click(`button[aria-label="${resources.en.translation.reports.graph}"]`);
    if (state === 'empty') { await until(() => !document.querySelector('[data-report-row]'), 'Empty graph'); assert.equal(await evaluate(() => document.querySelectorAll('[data-graph-currency]').length), 0); }
    else { await points(2); assert.equal(await evaluate(() => [...document.querySelectorAll('[data-graph-metric]')].every(node => node.dataset.amount === '0.00')), true); }
    await set('report-type','byService'); await points(state === 'empty' ? 5 : 7); await bounds(); await clean();
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed Reports graphs across en/lv/ru320/390/768/1280: currency-separated status series, exact non-hover values, keyboard scrolling, applied filters, zero/empty/many names, List return and numeric export.');
} finally { await fixture.close(); }
