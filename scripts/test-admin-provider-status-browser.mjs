import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/admin-provider-status.tsx", resources });
const { evaluate, until, visit, viewport, button } = fixture;
const matrix = [], checks = [], screenshots = [];
const values = () => evaluate(() => [...document.querySelectorAll('[data-testid^="service-provider-"]')].map(element => element.textContent.trim()));
try {
  for (const lang of languages) for (const width of [320, 768, 1280]) {
    await viewport(width, 900); await visit(`/administration?lang=${lang}`);
    await until(() => document.querySelectorAll('[data-testid^="service-provider-"]').length === 3, "provider statuses loaded");
    const labels = resources[lang].translation.adminUsers;
    assert.deepEqual(await values(), [labels.yes, labels.no, labels.unknown]);
    assert.ok(await evaluate(label => [...document.querySelectorAll('th[scope="col"]')].some(element => element.textContent.trim() === label), labels.serviceProvider));
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "table scrolls within page on small viewports");
    if (width === 320) {
      await evaluate(() => { const cell = document.querySelector('[data-testid="service-provider-synthetic-0"]'); cell.scrollIntoView({ inline: "center", block: "center" }); });
      assert.ok(await evaluate(() => { const box = document.querySelector('[data-testid="service-provider-synthetic-0"]').getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; }));
    }
    if (lang === "en" && width !== 768) { const file = `docs/admin-provider-status-chrome-${width}.png`; await fixture.screenshot(file, false); screenshots.push(file); }
    matrix.push({ lang, width, height: 900 });
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  checks.push("Yes/No/Unknown render in en/lv/ru; Pro/company do not imply provider; phone/tablet/desktop table reflow and scroll reachability");
  await viewport(1280, 900); await visit('/administration');
  await until(() => document.querySelectorAll('[data-testid^="service-provider-"]').length === 3);
  await evaluate(() => window.phase2Fixture.language('lv'));
  assert.deepEqual(await values(), Object.values(resources.lv.translation.adminUsers).slice(1));
  await evaluate(() => window.phase2Fixture.language('en'));
  await evaluate(() => { window.phase2Fixture.activate(); window.phase2Fixture.result = "pending"; });
  await button('Refresh');
  await until(() => [...document.querySelectorAll('button')].find(element => element.textContent === 'Refresh')?.disabled);
  await evaluate(() => { window.phase2Fixture.result = "success"; window.phase2Fixture.release(); });
  await until(() => document.querySelector('[data-testid="service-provider-synthetic-1"]').textContent.trim() === 'Yes');
  await evaluate(() => { window.phase2Fixture.result = "error"; }); await button('Refresh');
  await until(() => !!document.querySelector('[role="alert"]') && !document.querySelector('table'));
  await evaluate(() => { window.phase2Fixture.result = "success"; }); await button('Try again');
  await until(() => !!document.querySelector('table'));
  await evaluate(() => { window.phase2Fixture.result = "forbidden"; }); await button('Refresh');
  await until(() => !document.querySelector('table') && document.body.innerText.includes('Application support access is required'));
  checks.push("live language switch, refreshed provider activation, pending refresh, failure hides stale status, retry and access revocation");
  await visit('/administration?denied');
  await until(() => !!document.querySelector('[role="alert"]'));
  assert.equal(await evaluate(() => window.phase2Fixture.reads.some(path => path.startsWith('/api/admin/users?'))), false);
  await visit('/administration?empty');
  await until(() => document.body.innerText.includes('No registered users yet.'));
  assert.equal(await evaluate(() => !!document.querySelector('table')), false);
  checks.push("denied access never fetches directory; empty directory contains no invented provider status");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile('docs/admin-provider-status-chrome-evidence.json', JSON.stringify({ date: "2026-11-08", browser: await fixture.api('Browser.getVersion'), languages, matrix, checks, screenshots,
    deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Real Administration component; synthetic in-memory APIs, no connected sessions/database/services or deployment. Chrome only; no physical devices or screen reader." }, null, 2) + '\n');
  console.log(`PASS: ${checks.length} administration provider behavior groups, ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
