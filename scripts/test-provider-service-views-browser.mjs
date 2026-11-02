import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

const languages = ['en','lv','ru'], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, 'utf8')) };
for (const language of languages) {
  for (const [key, value] of Object.entries(resources.en.translation.providerServices)) {
    const actual = resources[language].translation.providerServices[key];
    assert.ok(actual?.trim(), `${language}: ${key}`);
    assert.deepEqual(actual.match(/{{\w+}}/g), value.match(/{{\w+}}/g), `${language}: ${key} placeholders`);
  }
}
const engine = process.env.FORMS_BROWSER || 'chrome';
const fixture = await browserFixture({ entry: 'scripts/fixtures/provider-service-views.tsx', resources, ...(process.env.PROVIDER_VIEWS_ZOOM ? { nativeZoom: 4 } : {}) });
const { evaluate, until, click, set, visit, viewport, screenshot, key } = fixture;
const checks = [], matrix = [], captures = [];
const count = () => evaluate(() => document.querySelectorAll('.provider-service-item').length);
const ready = () => until(() => document.querySelectorAll('.provider-service-item').length === 6, 'provider services loaded');
const capture = async name => { const file = `docs/provider-service-views-${engine}${process.env.PROVIDER_VIEWS_ZOOM ? '-zoom400' : ''}-${name}.png`; await screenshot(file, !process.env.PROVIDER_VIEWS_ZOOM); captures.push(file); };
const square = () => evaluate(() => [...document.querySelectorAll('.provider-service-item .search-service-art')].every(node => { const b = node.getBoundingClientRect(); return b.width > 0 && Math.abs(b.width - b.height) <= 1; }));
const snapshots = () => evaluate(() => ({ requests: window.providerServiceViews.requests, writes: window.providerServiceViews.writes }));
try {
  if (!process.env.PROVIDER_VIEWS_ZOOM) await viewport(1280);
  await visit('/my-services/services'); await ready();
  assert.equal(await evaluate(() => document.querySelector('[data-testid="provider-view-list"]').getAttribute('aria-pressed')), 'true');
  assert.ok(await square());
  const before = await snapshots();
  await click('[data-testid="provider-view-grid"]');
  assert.equal(await count(), 6); assert.ok(await square());
  assert.deepEqual(await snapshots(), before, 'switching views neither fetches nor writes');
  assert.equal(await evaluate(() => document.querySelectorAll('.search-service-art button,.provider-service-item .search-service-title').length), 0, 'previews have no public listing actions');
  assert.equal(await evaluate(() => document.querySelectorAll('.provider-service-item img').length), 2, 'missing/broken images use placeholders');
  assert.equal(await evaluate(() => !!window.injected), false);
  assert.ok(await evaluate(() => document.querySelector('[data-testid="provider-service-6"] h3').textContent.includes('<img')));
  assert.ok(await evaluate(() => document.querySelector('[data-testid="provider-service-2"]').textContent.includes('Inactive')));
  await click('[data-testid="provider-filter-inactive"]'); assert.equal(await count(), 3);
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('.provider-service-item')].map(node => node.dataset.testid)), ['provider-service-2','provider-service-3','provider-service-5']);
  await click('[data-testid="provider-view-list"]'); assert.equal(await count(), 3);
  assert.equal(await evaluate(() => document.querySelector('[data-testid="provider-filter-inactive"]').getAttribute('aria-pressed')), 'true');
  await click('[data-testid="provider-filter-published"]'); assert.equal(await count(), 3);
  await click('[data-testid="provider-filter-all"]'); assert.equal(await count(), 6);
  assert.deepEqual(await snapshots(), before);
  checks.push('List/Grid share the Search result component and 1:1 media/fallbacks; unpublished services are visible; status/view switches preserve selections and perform no requests or writes; hostile text stays literal');

  for (const language of languages) {
    await set('fixture-language', language);
    for (const width of process.env.PROVIDER_VIEWS_ZOOM ? [await evaluate(() => innerWidth)] : [320,390,768,1280]) {
      if (!process.env.PROVIDER_VIEWS_ZOOM) await viewport(width);
      for (const view of ['list','grid']) {
        await click(`[data-testid="provider-view-${view}"]`);
        assert.equal(await count(), 6); assert.ok(await square(), `${language}/${width}/${view}: square images`);
        assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language}/${width}/${view}: page overflow`);
        assert.ok(await evaluate(() => [...document.querySelectorAll('.provider-services-page button,.provider-services-page a')].filter(node => node.getClientRects().length).every(node => { const b = node.getBoundingClientRect(); return b.left >= -1 && b.right <= innerWidth + 1; })), `${language}/${width}/${view}: controls overflow`);
        assert.ok(!await evaluate(() => /providerServices\.|views\.|common\.edit/.test(document.querySelector('.provider-services-page').textContent)), 'translated controls');
        const labels = resources[language].translation.searchPage;
        assert.ok(await evaluate(labels => [...document.querySelectorAll('.search-service-meta')].every(node => (node.textContent.includes(labels.group) || node.textContent.includes(labels.individual)) && (node.textContent.includes(labels.instant) || node.textContent.includes(labels.approval))), labels), 'session/booking labels retained');
        assert.equal(await evaluate(() => document.querySelectorAll('[data-testid^="button-edit-service-"]').length), 6);
        assert.equal(await evaluate(() => document.querySelectorAll('[data-testid^="button-copy-service-"]').length), 6);
        matrix.push({ language, width, view });
      }
    }
  }
  checks.push('en/lv/ru responsive List/Grid retain every service, publication label and editing/copy action');
  await set('fixture-language', 'en');
  if (!process.env.PROVIDER_VIEWS_ZOOM) await viewport(1280);
  await click('[data-testid="provider-view-grid"]'); await capture('desktop-grid');
  if (!process.env.PROVIDER_VIEWS_ZOOM) await viewport(390);
  await capture('phone-grid');
  const gridHeight = await evaluate(() => document.querySelector('[data-testid="provider-service-results"]').getBoundingClientRect().height);
  await click('[data-testid="provider-view-list"]'); await capture('phone-list');
  if (!process.env.PROVIDER_VIEWS_ZOOM) assert.ok(await evaluate(() => document.querySelector('[data-testid="provider-service-results"]').getBoundingClientRect().height) < gridHeight, 'list displays more services per screen than photo grid on phone');
  const light = await measureFormContrast(fixture, '.provider-services-page');
  assert.deepEqual(light.failures.filter(failure => failure.kind === 'text'), []);
  await click('#fixture-dark'); await capture('phone-dark');
  const dark = await measureFormContrast(fixture, '.provider-services-page');
  assert.deepEqual(dark.failures.filter(failure => failure.kind === 'text'), []);
  await click('#fixture-dark');
  if (!process.env.PROVIDER_VIEWS_ZOOM) {
    await viewport(320); await evaluate(() => document.documentElement.style.fontSize = '200%');
    const reflow = await evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, outside: [...document.querySelectorAll('.provider-services-page *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent.slice(0, 50) })).slice(0, 8) }));
    assert.ok(reflow.scroll <= reflow.width + 1, `200% text reflow: ${JSON.stringify(reflow)}`); assert.ok(await square());
    await evaluate(() => document.documentElement.style.fontSize = '');
  } else {
    const zoom = await evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, css: getComputedStyle(document.documentElement).zoom, visual: visualViewport.scale }));
    assert.ok(zoom.width >= 300 && zoom.width <= 320); assert.equal(zoom.dpr, 4); assert.equal(zoom.css, '1'); assert.equal(zoom.visual, 1);
  }
  checks.push('phone list is denser than grid; light/dark text contrast; text/native-zoom reflow; fixed square geometry');
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-edit-service-2"]').getAttribute('href')), '/my-services/services/2/edit');
  await evaluate(() => document.querySelector('[data-testid="provider-view-grid"]').focus()); await key('Enter');
  assert.equal(await evaluate(() => document.querySelector('[data-testid="provider-view-grid"]').getAttribute('aria-pressed')), 'true', 'keyboard switches view');
  await evaluate(() => window.providerServiceViews.copyResult = 'pending');
  await click('[data-testid="button-copy-service-2"]');
  await until(() => !!window.providerServiceViews.releaseCopy, 'copy pending');
  assert.ok(await evaluate(() => [...document.querySelectorAll('[data-testid^="button-copy-service-"]')].every(node => node.disabled)));
  await click('[data-testid="provider-view-list"]');
  assert.ok(await evaluate(() => [...document.querySelectorAll('[data-testid^="button-copy-service-"]')].every(node => node.disabled)), 'pending state survives view switch');
  await evaluate(() => document.querySelector('[data-testid="button-copy-service-2"]').click());
  assert.equal((await snapshots()).writes.length, 1, 'no duplicate copy');
  await evaluate(() => { window.providerServiceViews.copyResult = 'error'; window.providerServiceViews.releaseCopy(); });
  await until(() => !document.querySelector('[data-testid="button-copy-service-2"]').disabled, 'copy failure unlocks controls');
  assert.equal(await count(), 6);
  await until(() => document.body.textContent.includes('Unable to update services'), 'copy error reported');
  // At native zoom the existing error toast can cover the next action. Dismiss
  // it through its real close control before retrying, as a user would.
  await click('[toast-close]'); await until(() => !document.querySelector('[toast-close]'), 'copy error toast dismissed');
  await evaluate(() => window.providerServiceViews.copyResult = 'success');
  await click('[data-testid="button-copy-service-2"]');
  await until(() => location.pathname === '/my-services/services/90/edit' && !!document.querySelector('#serviceName'), 'copied inactive service opens existing editor');
  assert.equal(await evaluate(() => document.querySelector('#serviceName').value), 'Sports massage (copy)');
  checks.push('keyboard view switching; correct editor routes; pending/failed copy recovery and duplicate prevention across views; successful copy still opens existing editor');

  await visit('/my-services/services?mode=readonly'); await ready();
  await click('[data-testid="provider-view-grid"]');
  assert.equal(await evaluate(() => document.querySelectorAll('[data-testid^="button-copy-service-"],[data-testid^="button-edit-service-"],[data-testid="button-generate-ai-search"]').length), 0);
  assert.deepEqual((await snapshots()).writes, []);
  await visit('/my-services/services?mode=company'); await ready();
  assert.ok(await evaluate(() => [...document.querySelectorAll('.search-provider-row')].every(node => node.textContent === 'Balance Studio')));
  await evaluate(() => window.providerServiceViews.result = 'error'); await evaluate(() => window.providerServiceViews.refresh());
  await until(() => !!document.querySelector('.provider-services-page [role="alert"]'), 'services error');
  await evaluate(() => window.providerServiceViews.result = 'success'); await click('.provider-services-page [role="alert"] button'); await ready();
  await evaluate(() => window.providerServiceViews.result = 'empty'); await evaluate(() => window.providerServiceViews.refresh());
  await until(() => !!document.querySelector('.provider-services-page .search-state[role="status"]'), 'empty state');
  assert.equal(await count(), 0);
  await visit('/my-services/services?mode=pending');
  await until(() => !!window.providerServiceViews.releaseServices, 'loading boundary');
  assert.ok(await evaluate(() => !!document.querySelector('.provider-service-results [role="status"]')));
  await evaluate(() => { window.providerServiceViews.result = 'success'; window.providerServiceViews.releaseServices(); }); await ready();
  checks.push('read-only permissions retain previews and remove management actions; company uses business name; load error/retry, empty and loading states recover');
  assert.deepEqual(await evaluate(() => window.providerServiceViews.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  const suffix = process.env.PROVIDER_VIEWS_ZOOM ? '-zoom400' : '';
  await writeFile(`docs/provider-service-views-${engine}${suffix}-evidence.json`, JSON.stringify({ date: '2026-11-02', browser: await fixture.api('Browser.getVersion'), matrix, checks, screenshots: captures, light, dark, deferredLanguages: ['ar','zh','fr','de','hi','ja','pt','es'], limits: 'Synthetic services and data-URI images; mocked APIs/auth/workspaces/copy and blocked external network. No live server, database, publishing, paid service or deployment. Physical devices, screen readers and native-language review unverified.' }, null, 2) + '\n');
  console.log(`Provider service previews passed in ${engine}: ${checks.length} behavior groups, ${matrix.length} en/lv/ru layout cases.`);
} finally { await fixture.close(); }
