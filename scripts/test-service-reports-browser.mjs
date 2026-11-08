import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-reports.tsx", resources });
const { evaluate, until, click, set, viewport, key } = fixture;
const output = process.env.REPORTS_TEST_OUTPUT || "output/reports-pending-check";
await mkdir(output, { recursive: true });
try {
  for (const language of ["en", "lv", "ru"]) for (const width of [390, 1280]) {
    const text = resources[language].translation.reports;
    await viewport(width); await fixture.visit(`/my-services/reports?lang=${language}`);
    await until(() => document.querySelectorAll('[data-report-row]').length === 4, "report loaded");
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${language}/${width} no page overflow`);
    assert.equal(await evaluate(title => document.querySelector('h1').textContent === title, text.title), true);
    if (width === 390) {
      await click('[data-mobile-navigation] button');
      assert.equal(await evaluate(title => [...document.querySelectorAll('[role="menuitem"]')].some(node => node.textContent.includes(title)), text.title), true, "mobile burger entry");
      await key("Escape");
    } else assert.equal(await evaluate(() => !!document.querySelector('a[href="/my-services/reports"][aria-current="page"]')), true, "desktop entry");
    await click(`button[aria-label="${text.graph}"]`);
    await until(() => !!document.querySelector('[data-testid="report-graphs"] .recharts-surface'), 'daily graph rendered');
    assert.equal(await evaluate(() => document.querySelectorAll('[data-graph-point]').length), 1);
    if (language === "en") await fixture.screenshot(`${output}/reports-${width}.png`);
    await click(`button[aria-label="${text.list}"]`);
    assert.equal(await evaluate(() => document.querySelectorAll('tbody tr').length), 4);
    assert.equal(await evaluate(() => document.querySelector('[data-testid="total-earned-EUR"]').textContent.includes('10')), true);
    assert.equal(await evaluate(() => document.querySelector('[data-testid="total-planned-EUR"]').textContent.includes('20')), true);
    assert.equal(await evaluate(() => document.querySelector('[data-testid="total-pending-EUR"]').textContent.includes('30')), true);
    assert.equal(await evaluate(label => !!document.querySelector(`section[aria-label="${label}"] [data-testid="total-pending-EUR"]`), text.pending), true, "separate accessible pending summary");
    assert.equal(await evaluate(() => document.querySelector('[data-testid="total-lost-EUR"]').textContent.includes('40')), true);
    if (width === 1280) {
      for (const format of ["csv", "xlsx", "pdf"]) {
        await click(`[data-testid="export-${format}"]`);
        await until(() => window.phase2Fixture.downloads.length > 0, "download produced");
        const download = await evaluate(() => window.phase2Fixture.downloads.shift());
        const bytes = Buffer.from(download.base64, "base64");
        assert.ok(download.size > 100); await writeFile(`${output}/browser-report-${language}.${format}`, bytes);
        if (format === "csv") {
          const lines = bytes.toString('utf8').split('\r\n');
          assert.equal(lines[4], [text.currency, text.earned, text.planned, text.pending, text.lost].map(value => `"${value}"`).join(','));
          assert.equal(lines[5], '"EUR","10","20","30","40"');
        } else if (format === "xlsx") {
          assert.match(bytes.toString('utf8'), /<c r="D6"><v>30<\/v><\/c>/, "Downloaded pending summary uses a numeric XLSX cell");
          assert.ok(bytes.toString('utf8').includes(text.pending), "Downloaded XLSX pending header is localized");
        } else {
          const drawn = await evaluate(() => window.phase2Fixture.pdfText);
          assert.ok(drawn.some(cell => cell.text === text.pending && cell.x === 1040), "Pending header rendered in PDF summary column");
          assert.ok(drawn.some(cell => cell.text === '30' && cell.x === 1040), "Pending amount rendered in PDF summary column");
        }
      }
    }
    if (language === "en" && width === 1280) {
      await set("report-from", "2020-01-01"); await set("report-to", "2020-01-02");
      assert.equal(await evaluate(() => document.querySelectorAll('tbody tr').length), 4, "draft dates do not change exports/results");
      await fixture.button(text.show); await until(() => !document.querySelector('[data-report-row]'), "empty applied period");
      assert.equal(await evaluate(() => document.querySelector('[data-testid="export-csv"]').disabled), true);
      await set("report-from", "2020-02-02");
      assert.equal(await evaluate(() => document.querySelector('#report-from').getAttribute('aria-invalid')), "true");
      await fixture.button(text.thisMonth); await until(() => document.querySelectorAll('[data-report-row]').length === 4, "month preset");
      await set("fixture-language", "lv");
      assert.equal(await evaluate(title => document.querySelector('h1').textContent === title, resources.lv.translation.reports.title), true, "live language switch");
    }
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    console.log(`Passed report interaction and navigation ${language}/${width}.`);
  }
  for (const language of ["en", "lv", "ru"]) {
    await viewport(390); await fixture.visit(`/my-services/reports?lang=${language}&state=pending`);
    await until(() => !!document.querySelector('[data-testid="total-pending-EUR"]'), "pending-only report");
    const amounts = await evaluate(() => ['earned', 'planned', 'pending', 'lost'].map(key => document.querySelector(`[data-testid="total-${key}-EUR"]`).textContent));
    const money = amount => new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(amount);
    assert.deepEqual(amounts, [0, 0, 30, 0].map(money), `${language} pending-only does not double count planned`);
    assert.equal(await evaluate(() => document.querySelectorAll('[data-report-row]').length), 1);
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  await fixture.visit('/my-services/reports?lang=en&state=confirmed');
  await until(() => !!document.querySelector('[data-testid="total-pending-EUR"]'), "zero pending report");
  assert.equal(await evaluate(() => document.querySelector('[data-testid="total-pending-EUR"]').textContent), '€0.00');
  await fixture.visit('/my-services/reports?lang=en&state=error');
  await until(() => !!document.querySelector('[role="alert"]'), "denied report");
  assert.equal(await evaluate(() => !!document.querySelector('[data-testid="export-csv"]')), false);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed Chrome en/lv/ru phone/desktop reports, separate pending totals, pending-only/zero states, numeric CSV/XLSX and PDF pending summaries, invalid/empty/error states; mocked APIs, no writes or external network.');
} finally { await fixture.close(); }
