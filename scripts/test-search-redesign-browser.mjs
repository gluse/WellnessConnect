import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const engine = process.env.FORMS_BROWSER || "chrome";
const artifactPrefix = process.env.SEARCH_REDESIGN_ARTIFACT_PREFIX || "search-mobile-reference";
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
const fixture = await browserFixture({ entry: "scripts/fixtures/search-redesign.tsx", resources });
const { evaluate, until, click, set, key, viewport: browserViewport, visit, screenshot } = fixture;
// Windows WebKit reserves a scrollbar gutter in its CSS media viewport.
// Exercise the requested CSS breakpoint width in every engine.
const viewport = async (width, height = 900) => {
  await browserViewport(width, height);
  const gutter = await evaluate(() => matchMedia(`(width: ${document.documentElement.clientWidth}px)`).matches ? innerWidth - document.documentElement.clientWidth : 0);
  if (gutter) await browserViewport(width + gutter, height);
};
const checks = [], matrix = [], captures = [];
const settled = () => until(() => document.querySelector('.search-results')?.getAttribute('aria-busy') === 'false' && !document.querySelector('[data-testid="button-search-services"]').disabled, "search settled");
const requestCount = () => evaluate(() => window.searchFixture.requests.length);
const count = () => evaluate(() => document.querySelectorAll('.search-service-card').length);
const submit = async () => { await click('[data-testid="button-search-services"]'); await settled(); };
const choose = async (selector, value) => set(await evaluate(selector => document.querySelector(selector).id, selector), value);
const openFilters = async () => { await click('.search-mobile-filter-trigger'); await until(() => !!document.querySelector('.search-filter-dialog[data-state="open"]'), "filters open"); await fixture.settle(); };
const closeDialog = async () => { await fixture.settle(); await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "dialog dismissed"); };
const apply = async () => { await click('.search-filter-dialog button[type="submit"]'); await until(() => !document.querySelector('.search-filter-dialog'), "filters applied"); await settled(); };
const capture = async (name, fullPage = true) => { const path = `docs/${artifactPrefix}-${engine}-${name}.png`; await screenshot(path, fullPage); captures.push(path); };
const square = () => evaluate(() => [...document.querySelectorAll('.search-service-art')].filter(node => node.getClientRects().length).every(node => { const b = node.getBoundingClientRect(); return b.width > 0 && Math.abs(b.width - b.height) <= 1; }));
try {
  await viewport(1280); await visit('/search?redesign=1'); await settled();
  assert.equal(await count(), 9);
  assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"]')), false, "empty search never forces location selection");
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0);
  assert.equal(await evaluate(() => window.searchFixture.configRequests), 0);
  assert.ok(await evaluate(() => document.querySelector('[data-testid="button-view-list"]').getAttribute('aria-pressed') === 'true'));
  assert.ok(await evaluate(() => [...document.querySelectorAll('.search-query-bar label,.search-field-label')].map(node => node.textContent).join('/') === 'Where/When/What'));
  assert.ok(!(await evaluate(() => window.searchFixture.requests[0])).includes('latitude='));
  await submit(); assert.equal(await count(), 9);
  await viewport(390); await capture('phone-initial', false);
  checks.push('Empty search immediately returns the unfiltered catalog in list mode; Where/When/What are optional; no GPS or Maps access');

  // Real shared header, including authenticated account menu, remains intact.
  await evaluate(() => window.setFixtureUser({ id: 'synthetic-customer', firstName: 'Fixture', lastName: 'Customer' }));
  await until(() => !!document.querySelector('header button[aria-label="Open account menu"]'), 'account icon');
  assert.ok(await evaluate(() => [...document.querySelectorAll('header button')].filter(node => node.getClientRects().length).every(node => {
    const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
  })), 'header globe/account have usable touch targets');
  assert.ok(await evaluate(() => !!document.querySelector('header [data-testid="button-language-picker"] svg')));
  await click('header button[aria-label="Open account menu"]');
  await until(() => !!document.querySelector('[role="menu"]'), 'existing account menu');
  await key('Escape');
  await capture('header-account');
  await evaluate(() => window.setFixtureUser(null)); await settled();
  checks.push('Existing shared header language globe and authenticated account icon/menu rendered without replacing their behavior');

  await fixture.settle();
  await evaluate(() => document.querySelector('#service-sort').focus());
  await until(() => document.activeElement.id === 'service-sort', 'sort receives keyboard focus after account menu closes');
  await key('Home'); await key('ArrowDown');
  if (engine === 'webkit') await key('Enter');
  await until(() => document.querySelector('#service-sort').value === 'price-asc', 'native keyboard sort commits selection');
  assert.equal(await evaluate(() => document.querySelector('#service-sort').value), 'price-asc', 'native keyboard sort skips unavailable distance options');
  assert.equal(await evaluate(() => document.activeElement.id), 'service-sort');
  await set('service-sort', 'price-desc');
  const sorted = await evaluate(() => [...document.querySelectorAll('.search-service-title')].map(node => node.textContent));
  const beforeViews = await requestCount();
  await click('[data-testid="button-view-grid"]');
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('.search-service-title')].map(node => node.textContent)), sorted);
  assert.equal(await requestCount(), beforeViews, 'view change reuses the applied search');
  assert.ok(await square());
  assert.ok(await evaluate(() => [...document.querySelectorAll('.search-service-art img')].every(node => getComputedStyle(node).objectFit === 'cover')));
  await until(() => document.querySelectorAll('.search-service-art img').length === 3, 'broken images become square placeholders');
  const en = resources.en.translation;
  assert.ok(await evaluate(labels => [...document.querySelectorAll('.search-service-card')].every(card => card.textContent.includes(labels.group) || card.textContent.includes(labels.individual)), en.searchPage));
  assert.ok(await evaluate(labels => [...document.querySelectorAll('.search-service-card')].every(card => card.textContent.includes(labels.instant) || card.textContent.includes(labels.approval)), en.searchPage));
  checks.push('Grid/list share sorting and data with no request on view switch; square cover images and missing/broken-image placeholders; session and booking labels retained');

  // Changes to a Filters draft remain independent of the query and When picker.
  await openFilters(); await choose('[data-testid="search-category"]', 'fitness'); await closeDialog('.search-filter-dialog');
  await set('service-query', 'massage'); const beforeDraft = await requestCount();
  await evaluate(() => new Promise(resolve => setTimeout(resolve, 450)));
  assert.equal(await requestCount(), beforeDraft, 'typing alone never submits');
  await submit(); assert.equal(await count(), 3);
  assert.ok(!(await evaluate(() => window.searchFixture.requests.at(-1))).includes('category='));
  await set('service-query', 'unfinished query'); await openFilters(); await apply();
  assert.equal(await count(), 0);
  assert.ok((await evaluate(() => window.searchFixture.requests.at(-1))).includes('category=fitness'));
  assert.ok((await evaluate(() => window.searchFixture.requests.at(-1))).includes('searchQuery=massage'));
  await click('.search-state button'); await settled(); assert.equal(await count(), 9);
  checks.push('Independent query/filter drafts; explicit Search/Apply; empty-result recovery restores the catalog');

  await click('[data-testid="open-search-when"]');
  await until(() => !!document.querySelector('.search-when-dialog'), 'When picker');
  const beforeInvalid = await requestCount();
  await set('search-when-date', '2030-01-02'); await set('search-when-dateEnd', '2030-01-01');
  await click('.search-when-dialog button[type="submit"]');
  assert.equal(await requestCount(), beforeInvalid); assert.equal(await count(), 9);
  assert.equal(await evaluate(() => document.activeElement.id), 'search-when-error');
  await set('search-when-dateEnd', '2030-01-05'); await set('search-when-time', '09:00'); await set('search-when-timeEnd', '12:00');
  await click('.search-when-dialog button[type="submit"]'); await until(() => !document.querySelector('.search-when-dialog'), 'When applied'); await settled();
  const whenRequest = await evaluate(() => window.searchFixture.requests.at(-1));
  for (const text of ['date=2030-01-02', 'dateEnd=2030-01-05', 'time=09%3A00', 'timeEnd=12%3A00']) assert.ok(whenRequest.includes(text), text);
  assert.equal(await evaluate(() => document.activeElement.dataset.testid), 'open-search-when');
  await click('[data-testid="open-search-when"]'); await set('search-when-date', '2030-01-03'); await closeDialog('.search-when-dialog');
  assert.equal(await evaluate(() => window.searchFixture.requests.at(-1)), whenRequest, 'Escape discards unapplied date changes');
  await openFilters(); assert.equal(await evaluate(() => document.querySelector('[data-testid="search-date"]').value), '2030-01-02'); await closeDialog('.search-filter-dialog');
  checks.push('When date/time ranges use existing request contract; invalid dates focus feedback and retain results; Apply synchronizes Filters; Escape restores focus without applying drafts');

  await set('service-query', ''); await set('search-location', 'Synthetic city'); await submit();
  const beforeGeocodeFailure = await requestCount();
  await evaluate(() => window.searchFixture.geocode = 'error'); await set('search-location', 'Invalid synthetic city'); await submit();
  assert.equal(await requestCount(), beforeGeocodeFailure); assert.equal(await count(), 9);
  assert.ok(await evaluate(() => !!document.querySelector('.search-query-error')));
  await evaluate(() => window.searchFixture.geocode = 'success');
  await click('[data-testid="open-search-location"]'); await until(() => !!document.querySelector('.search-location-dialog'), 'location picker');
  await evaluate(() => window.searchFixture.geolocation = 'error'); await click('.search-location-gps');
  await until(() => document.querySelector('.search-location-dialog [role="alert"]')?.textContent.includes('Location permission'), 'denied GPS');
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 1);
  await evaluate(() => window.searchFixture.geolocation = 'success'); await click('.search-location-gps');
  await until(() => !document.querySelector('.search-location-dialog'), 'successful location closes picker'); await settled();
  assert.ok((await evaluate(() => window.searchFixture.requests.at(-1))).includes('latitude=0'));
  checks.push('Explicit location and geolocation actions retain permission handling, failed-location result retention, and existing resolution contract');

  await click('[data-testid="button-view-map"]');
  await until(() => !!document.querySelector('[data-map-marker="Restorative yoga"]'), 'mocked map markers');
  await evaluate(() => document.querySelector('[data-map-marker="Restorative yoga"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await until(() => !!document.querySelector('.search-map-preview'), 'real map preview');
  assert.ok(await square());
  const previewText = await evaluate(() => document.querySelector('.search-map-preview').textContent);
  assert.ok(previewText.includes(en.searchPage.group)); assert.ok(previewText.includes(en.searchPage.instant));
  assert.ok(await evaluate(() => !!document.querySelector('.search-map-preview img')));
  await until(() => !!document.querySelector('.search-map-preview [data-wishlist-heart="1"]:not(:disabled)'), 'map image heart');
  await click('.search-map-preview [data-wishlist-heart="1"]');
  await until(() => !!document.querySelector('[role="dialog"] a[href^="/login?"]'), 'guest map save sign-in prompt');
  await fixture.settle(); await key('Escape');
  await until(() => !document.querySelector('[role="dialog"]'), 'map sign-in prompt dismisses');
  await until(() => !!document.querySelector('.search-map-preview') && document.activeElement?.getAttribute('data-wishlist-heart') === '1', 'map heart and preview retain focus after prompt');
  await capture('map-preview');
  await key('Escape'); await until(() => !document.querySelector('.search-map-preview'), 'map preview Escape');
  await click('.search-map-help button'); assert.equal(await count(), 9);
  checks.push('Existing map markers/hover previews/Escape/list recovery retained, with square thumbnail and service-type/booking-mode labels');

  await evaluate(() => window.searchFixture.mapsConfig = 'error');
  // The configured loader is cached; make the existing mocked SDK explicitly fail.
  await evaluate(() => { window.fixtureMapImport = google.maps.importLibrary; google.maps.importLibrary = async () => { throw Error('Offline map failure'); }; });
  await click('[data-testid="button-view-map"]');
  await until(() => !!document.querySelector('.search-map [role="alert"]'), 'map error');
  await click('.search-map-help button'); assert.equal(await count(), 9);
  await evaluate(() => { google.maps.importLibrary = window.fixtureMapImport; window.searchFixture.mapsConfig = 'success'; });
  await evaluate(() => window.searchFixture.result = 'rateLimited'); await set('service-query', 'failure'); await submit();
  assert.ok(await evaluate(() => document.querySelector('.search-state')?.getAttribute('role') === 'alert'));
  await evaluate(() => window.searchFixture.result = 'success'); await click('.search-state button'); await settled();
  await set('service-query', ''); await submit(); assert.equal(await count(), 9);
  checks.push('Map-load fallback and rate-limit retry remain recoverable without resetting chosen view/filter state');

  const requestsBeforeResize = await requestCount();
  const sortBeforeResize = await evaluate(() => document.querySelector('#service-sort').value);
  for (const language of languages) {
    await set('fixture-language', language);
    for (const width of [320, 390, 768, 1023, 1024, 1280]) {
      await viewport(width);
      for (const view of ['grid', 'list', 'map']) {
        await click(`[data-testid="button-view-${view}"]`);
        if (view === 'map') {
          await until(() => !!document.querySelector('[data-map-marker="Restorative yoga"]'), 'localized map markers');
          await evaluate(() => document.querySelector('[data-map-marker="Restorative yoga"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
          await until(() => !!document.querySelector('.search-map-preview'), 'localized map preview');
          const labels = resources[language].translation.searchPage;
          assert.ok(await evaluate(labels => { const text = document.querySelector('.search-map-preview').textContent; return text.includes(labels.group) && text.includes(labels.instant); }, labels));
        }
        assert.ok(await square(), `${language}/${width}/${view}: square media`);
        assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language}/${width}/${view}: page overflow`);
        assert.ok(await evaluate(() => [...document.querySelectorAll('.search-page button,.search-page input,.search-page select')].filter(node => node.getClientRects().length).every(node => { const b = node.getBoundingClientRect(); return b.left >= -1 && b.right <= innerWidth + 1; })), `${language}/${width}/${view}: controls outside viewport`);
        assert.ok(!await evaluate(() => /searchPage\.|views\./.test(document.querySelector('.search-page').textContent)), 'localized interface');
        const mobile = width < 1024;
        assert.equal(await evaluate(() => document.querySelector('.search-submit').textContent), mobile ? resources[language].translation.common.search : '', 'visible Search label is mobile-only');
        assert.equal(await evaluate(() => document.querySelector('#search-location').placeholder), resources[language].translation.searchPage[mobile ? 'anywhere' : 'anyLocation']);
        assert.equal(await evaluate(() => document.querySelector('#service-query').placeholder), resources[language].translation.searchPage[mobile ? 'anything' : 'allServices']);
        if (mobile) {
          assert.ok(await evaluate(() => {
            const toolbar = document.querySelector('.search-results-toolbar').getBoundingClientRect();
            const count = document.querySelector('#search-results-title').getBoundingClientRect();
            return count.top >= toolbar.bottom && [...document.querySelectorAll('.search-results-toolbar button,.search-results-toolbar select')].every(node => {
              const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
            });
          }), 'mobile count follows toolbar and controls retain touch targets');
          assert.ok(await evaluate(() => {
            const boxes = [...document.querySelector('.search-query-bar').children].map(node => node.getBoundingClientRect());
            return boxes.every((box, i) => Math.abs(box.width - boxes[0].width) <= 1 && (!i || box.top >= boxes[i - 1].bottom - 1));
          }), 'mobile search fields stack above full-width Search');
        } else {
          const desktop = await evaluate(() => {
            const query = document.querySelector('.search-query-bar');
            const boxes = [...query.children].map(node => node.getBoundingClientRect());
            const count = document.querySelector('.search-results-head').getBoundingClientRect();
            const actions = document.querySelector('.search-view-actions').getBoundingClientRect();
            const views = document.querySelector('.search-view-toggle').getBoundingClientRect();
            const language = document.querySelector('header [data-testid="button-language-picker"]>span');
            return { horizontal: boxes.every(box => Math.abs(box.top - boxes[0].top) <= 1),
              rounded: parseFloat(getComputedStyle(query).borderRadius) > 0,
              icon: !!query.querySelector('.search-submit>svg'),
              sort: getComputedStyle(document.querySelector('#service-sort')).opacity === '1',
              sameRow: count.top < actions.bottom && actions.top < count.bottom,
              viewsBelow: views.top >= actions.bottom,
              viewLabels: document.querySelectorAll('.search-view-toggle button>span').length === 3,
              language: getComputedStyle(language).display !== 'none' };
          });
          assert.ok(Object.values(desktop).every(Boolean), `desktop presentation ${language}/${width}/${view}: ${JSON.stringify(desktop)}`);
        }
        if (view === 'list' && mobile) assert.ok(await evaluate(() => [...document.querySelectorAll('.search-service-card')].every(card => {
          const meta = card.querySelector('.search-service-meta').getBoundingClientRect();
          const actions = card.querySelector('.search-card-actions').getBoundingClientRect();
          return actions.top >= meta.bottom;
        })), 'list price and details sit below service information');
        if (view === 'list' && !mobile) assert.ok(await evaluate(() => [...document.querySelectorAll('.search-service-body')].every(body => getComputedStyle(body).display === 'grid')), 'desktop keeps the existing list price/details column');
        const labels = resources[language].translation.searchPage;
        assert.ok(await evaluate(labels => [...document.querySelectorAll('.search-service-meta')].every(node => node.textContent.includes(labels.individual) || node.textContent.includes(labels.group)), labels));
        matrix.push({ language, width, view });
      }
    }
  }
  assert.equal(await requestCount(), requestsBeforeResize, 'locale/view/viewport changes reuse the applied search');
  assert.equal(await evaluate(() => document.querySelector('#service-sort').value), sortBeforeResize, 'responsive presentation retains selected sorting');
  await set('fixture-language', 'en'); await viewport(1280); await click('[data-testid="button-view-grid"]'); await capture('desktop-grid');
  await viewport(390); await capture('phone-grid'); await click('[data-testid="button-view-list"]'); await capture('phone-list');
  const contrast = await measureFormContrast(fixture, '.search-page');
  assert.deepEqual(contrast.failures.filter(failure => failure.kind === 'text'), [], 'light search text contrast');
  await click('#fixture-theme'); await capture('phone-dark');
  const darkContrast = await measureFormContrast(fixture, '.search-page');
  assert.deepEqual(darkContrast.failures.filter(failure => failure.kind === 'text'), [], 'dark search text contrast');
  await viewport(320); await evaluate(() => document.documentElement.style.fontSize = '200%');
  assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '200% text reflow');
  assert.ok(await square()); await evaluate(() => document.documentElement.style.fontSize = '');
  await openFilters();
  for (let index = 0; index < 14; index++) { await key('Tab'); assert.ok(await evaluate(() => document.querySelector('.search-filter-dialog').contains(document.activeElement)), 'keyboard focus stays inside Filters'); }
  await closeDialog('.search-filter-dialog');
  await until(() => document.activeElement.classList.contains('search-mobile-filter-trigger'), 'Filters restores trigger focus');
  checks.push('en/lv/ru grid/list/map at phone/tablet/desktop widths; light/dark text contrast; 200% text reflow; Filters keyboard focus containment and restoration');
  await viewport(700, 390);
  assert.equal(await evaluate(() => getComputedStyle(document.querySelector('header')).position), 'static', 'short landscape viewport releases sticky header');
  assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'landscape reflow');
  assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
  assert.deepEqual(await evaluate(() => window.savedLocationFixture.writes), [], 'no mocked account-preference writes in this flow');
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  checks.push('Mobile-only reference layout below 1024px; desktop original presentation restored and breakpoint edges checked, including live resize with applied filters/sort/view state retained');
  const evidence = { date: '2026-11-04', browser: await fixture.api('Browser.getVersion'), checks, matrix, screenshots: captures, contrast, darkContrast, unexpectedNetwork: fixture.network, blocked: fixture.blocked, runtimeErrors: fixture.errors, deferredLanguages: ['ar','zh','fr','de','hi','ja','pt','es'], limits: 'Synthetic local static fixture; mocked APIs/auth/geocoding/geolocation/Maps and images. No connected application server, database writes, paid Maps calls or deployment. Browser emulation does not establish physical-device or screen-reader coverage.' };
  await writeFile(`docs/${artifactPrefix}-${engine}-evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Search redesign: ${checks.length} behavior groups; ${matrix.length} locale/viewport/view cases passed in ${engine}.`);
} finally { await fixture.close(); }
