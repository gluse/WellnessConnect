import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const engine = process.env.FORMS_BROWSER || "chrome";
const fixture = await browserFixture({ entry: "scripts/fixtures/search-pagination.tsx", resources });
const { evaluate, until, click, set, key, visit, viewport } = fixture;
const more = '[data-testid="button-search-load-more"]';
const refresh = '[data-testid="button-search-refresh"]';
const count = () => evaluate(() => document.querySelectorAll('.search-service-card').length);
const ready = () => until(() => document.querySelectorAll('.search-service-card').length === 24, 'first 24 services');
const ids = () => evaluate(() => [...document.querySelectorAll('.search-service-title')].map(node => Number(node.dataset.testid.replace('button-view-details-', ''))));
const requestCount = () => evaluate(() => window.paginationFixture.requests.length);
const submit = async text => { await set('service-query', text); await click('[data-testid="button-search-services"]'); };
const groups = [], matrix = [];
try {
  for (const language of languages) {
    await viewport(390, 820); await visit('/search?redesign=1&noObserver=1'); await ready();
    await set('fixture-language', language);
    const first = await evaluate(() => window.paginationFixture.requests[0]);
    assert.equal(first.limit, 24); assert.equal(first.cursor, null);
    assert.equal(await count(), 24);
    await evaluate(() => { window.paginationFixture.holdNext = true; document.querySelector('[data-testid="button-search-load-more"]').focus(); });
    await key('Enter');
    await until(() => window.paginationFixture.requests.length === 2, 'keyboard starts append');
    assert.equal(await count(), 24, 'append keeps visible cards');
    const appendY = await evaluate(() => scrollY);
    await evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('[data-testid="button-search-load-more"]')?.click(); });
    assert.equal(await requestCount(), 2, 'no duplicate concurrent append');
    await evaluate(() => window.paginationFixture.release());
    await until(() => document.querySelectorAll('.search-service-card').length === 48, 'second page appended');
    const afterAppendY = await evaluate(() => scrollY);
    assert.ok(Math.abs(afterAppendY - appendY) <= 2, `appending keeps scroll position: ${appendY} -> ${afterAppendY}`);
    await evaluate(() => { window.paginationFixture.failNext = true; }); await click(more);
    await until(() => !!document.querySelector('[data-search-pagination] [role="alert"]'), 'append failure announced');
    assert.equal(await count(), 48, 'failure preserves loaded cards');
    const failedCount = await requestCount();
    await fixture.settle(); assert.equal(await requestCount(), failedCount, 'failed page has no automatic retry');
    await click(more); await until(() => document.querySelectorAll('.search-service-card').length === 72, 'manual retry appends');
    assert.equal((await ids()).length, new Set(await ids()).size);
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    matrix.push({ language, viewport: [390, 820], keyboardAppend: true, retainedErrorCards: 48, afterRetry: 72 });
  }
  groups.push('en/lv/ru first-page24, keyboard append, concurrent input guard, retained cards on next-page failure and explicit retry');

  await visit('/search?redesign=1&noObserver=1'); await ready();
  await evaluate(() => { window.paginationFixture.overlapNext = true; }); await click(more);
  await until(() => document.querySelectorAll('.search-service-card').length === 48, 'overlap deduplicated');
  while (await evaluate(() => !!document.querySelector('[data-testid="button-search-load-more"]'))) {
    const before = await count(); await click(more);
    await until(() => !document.querySelector('[data-testid="button-search-load-more"]') || !document.querySelector('[data-testid="button-search-load-more"]').disabled, 'page append settles');
    assert.ok(await count() > before);
  }
  assert.equal(await count(), 157, 'all matches beyond 50 are accessible');
  assert.equal(new Set(await ids()).size, 157);
  await until(() => document.activeElement?.getAttribute('data-testid') === 'search-results-end', 'last manual page preserves keyboard focus at end status');
  groups.push('All157 matches accessible across seven pages; duplicate overlap removed; final page ends continuation');

  await visit('/search?redesign=1&noObserver=1'); await ready();
  await set('service-sort', 'price-asc'); await ready();
  await until(() => document.querySelector('.search-service-title')?.dataset.testid === 'button-view-details-157', 'global price order starts beyond old50');
  assert.equal((await evaluate(() => window.paginationFixture.requests.at(-1))).cursor, null);
  await click(more); await until(() => document.querySelectorAll('.search-service-card').length === 48, 'price page2');
  assert.deepEqual(await ids(), Array.from({ length: 48 }, (_, i) => 157 - i));
  await submit('massage'); await ready();
  assert.equal((await evaluate(() => window.paginationFixture.requests.at(-1))).cursor, null);
  assert.ok((await ids()).every(id => id % 2 === 0));
  groups.push('Sort and applied query restart continuation; server-global price ordering spans pages including matches outside former50');

  await visit('/search?redesign=1&noObserver=1'); await ready();
  await evaluate(() => { window.paginationFixture.holdNext = true; }); await click(more);
  await until(() => window.paginationFixture.requests.length === 2, 'held old append');
  await submit('massage'); await ready();
  await evaluate(() => window.paginationFixture.release());
  assert.ok((await ids()).every(id => id % 2 === 0), 'old results cannot append into new filter');
  assert.ok((await evaluate(() => window.paginationFixture.aborted.length)) >= 1);
  await evaluate(() => window.setFixtureUser({ id: 'pagination-other', firstName: 'Other', lastName: 'User' })); await ready();
  assert.equal((await evaluate(() => window.paginationFixture.requests.at(-1))).cursor, null);
  groups.push('Filter/account changes cancel stale requests and restart at first page without mixed results');

  await visit('/search?redesign=1&noObserver=1'); await ready();
  await click('.search-query-options summary');
  await click('input[name="search-mode"][value="semantic"]');
  await submit('yoga'); await ready();
  await until(() => window.paginationFixture.requests.at(-1)?.path === '/api/services/semantic-search/page', 'semantic paged endpoint');
  await evaluate(() => { window.paginationFixture.expireNext = true; }); await click(more);
  await until(() => !!document.querySelector('[data-testid="button-search-refresh"]'), 'expired continuation refresh control');
  assert.equal(await count(), 24); await click(refresh); await ready();
  assert.equal((await evaluate(() => window.paginationFixture.requests.at(-1))).cursor, null);
  assert.equal((await evaluate(() => window.paginationFixture.requests.at(-1))).path, '/api/services/semantic-search/page');
  await evaluate(() => { window.paginationFixture.mode = 'text-fallback'; });
  await submit('massage'); await ready();
  await until(() => document.querySelector('.search-truncated')?.textContent.includes('keyword'), 'semantic fallback disclosed');
  groups.push('Semantic search uses paged endpoint; expired continuation retains cards and refreshes explicitly from first page');

  await visit('/search?redesign=1&noObserver=1'); await ready();
  await evaluate(() => { window.paginationFixture.invalidNext = true; }); await click(more);
  await until(() => !!document.querySelector('[data-testid="button-search-refresh"]'), 'invalid continuation can refresh');
  assert.equal(await count(), 24); await click(refresh); await ready();
  assert.equal((await evaluate(() => window.paginationFixture.requests.at(-1))).cursor, null);
  groups.push('Invalid/restarted-process continuation offers a fresh search instead of retrying a rejected cursor');

  await visit('/search?redesign=1'); await ready();
  const scrolledY = await evaluate(() => { document.querySelector('[data-testid="button-search-load-more"]').scrollIntoView({ block: 'center' }); return scrollY; });
  await until(() => document.querySelectorAll('.search-service-card').length >= 48, 'real intersection scroll appends');
  assert.ok(Math.abs(await evaluate(() => scrollY) - scrolledY) <= 2, 'automatic append preserves scroll position');
  assert.equal(new Set(await ids()).size, await count());
  groups.push('Real IntersectionObserver loads another page when scrolling near results end');

  await visit('/search?redesign=1&noObserver=1'); await ready();
  await click('[data-testid="button-view-map"]');
  await until(() => !!document.querySelector('.search-map'), 'offline map'); await click(more);
  await until(() => window.paginationFixture.requests.length === 2 && !document.querySelector('[data-testid="button-search-load-more"]')?.disabled, 'map appends');
  await click('[data-testid="button-view-list"]');
  await until(() => document.querySelectorAll('.search-service-card').length === 48, 'map/list share loaded pages');
  groups.push('Map manual continuation and switching back to list retain the same loaded services');
  await fixture.screenshot(`docs/search-pagination-${engine}-phone.png`, false);
  await evaluate(() => document.querySelector('[data-testid="button-search-load-more"]').scrollIntoView({ block: 'center' }));
  await fixture.screenshot(`docs/search-pagination-${engine}-more.png`, false);
  assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`docs/search-pagination-${engine}-evidence.json`, JSON.stringify({ date: '2026-11-05', engine, version: await fixture.api('Browser.getVersion'), groups, matrix, limits: 'Synthetic static fixture; real client/query/scroll behavior, mocked APIs/auth/Maps. No connected DB/session writes, embeddings, live-service or physical-device coverage.', deferredLanguages: ['ar', 'zh', 'fr', 'de', 'hi', 'ja', 'pt', 'es'] }, null, 2) + '\n');
  console.log(`Search pagination: ${groups.length} groups, ${matrix.length} locales passed in ${engine}.`);
} finally { await fixture.close(); }
