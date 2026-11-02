import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) };
const base = resources.en.translation.searchPage;
for (const language of languages) {
  const messages = resources[language].translation.searchPage;
  for (const [key, value] of Object.entries(base).filter(([key]) => !key.startsWith("resultsCount_"))) {
    assert.ok(messages[key]?.trim(), `${language}: ${key}`);
    assert.deepEqual(messages[key].match(/{{\w+}}/g)?.sort(), value.match(/{{\w+}}/g)?.sort(), `${language}: placeholders ${key}`);
  }
}
const fixture = await browserFixture({ entry: "scripts/fixtures/search-page.tsx", resources });
const { api, evaluate, until, click, set, key, viewport, screenshot, visit } = fixture;
const checks = [], matrix = [], screenshots = [];
const count = () => evaluate(() => document.querySelectorAll(".search-service-card").length);
const requests = () => evaluate(() => window.searchFixture.requests);
const config = changes => evaluate(changes => Object.assign(window.searchFixture, changes), changes);
const openFilters = async () => { if (!await evaluate(() => !!document.querySelector('.search-filter-dialog'))) { await click('.search-mobile-filter-trigger'); await until(() => !!document.querySelector('.search-filter-dialog'), 'filters opened'); } };
const choose = async (selector, value) => { if (selector.includes('.search-filter-dialog')) await openFilters(); await set(await evaluate(selector => document.querySelector(selector).id, selector), value); };
const closePicker = async () => { if (await evaluate(() => !!document.querySelector('[role="dialog"]'))) { await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'picker dismissed'); } };
const locate = async () => { if (!await evaluate(() => !!document.querySelector('.search-location-dialog'))) { await click('[data-testid="open-search-location"]'); await until(() => !!document.querySelector('.search-location-dialog'), 'location picker'); } await click('.search-location-gps'); };
const submit = async () => { await closePicker(); await click('[data-testid="button-search-services"]'); await until(() => !document.querySelector('[data-testid="button-search-services"]').disabled && document.querySelector('.search-results').getAttribute('aria-busy') === 'false', "location resolution and search settled"); };
const apply = async () => { await openFilters(); await click('.search-filter-dialog button[type="submit"]'); await until(() => !document.querySelector('.search-filter-dialog') && document.querySelector('.search-results').getAttribute('aria-busy') === 'false', "filter settled"); };
const capture = async name => { const file = `docs/search-redesign-regression-${name}.png`; await screenshot(file); screenshots.push(file); };
try {
  await viewport(1280); await visit("/search");
  await until(() => !!document.querySelector('.search-results') && document.querySelector('.search-results').getAttribute('aria-busy') === 'false', 'location choice ready');
  assert.equal(await count(), 3, 'Unfiltered catalog appears without a location modal');
  assert.equal(await evaluate(() => !!document.querySelector('.search-location-dialog')), false);
  await set('search-location', 'Synthetic city'); await submit();
  await until(() => document.querySelectorAll(".search-service-card").length === 3, "initial located services");
  const initial = (await requests()).length;
  await choose('.search-filter-dialog [data-testid="search-category"]', 'fitness');
  await set('service-query', 'massage');
  await evaluate(() => new Promise(resolve => setTimeout(resolve, 450)));
  assert.equal((await requests()).length, initial, "editing drafts does not search");
  assert.equal(await count(), 3, "draft changes retain the applied results");
  await submit(); assert.equal(await count(), 1); assert.ok(!(await requests()).at(-1).includes('category='));
  await set('service-query', 'unfinished query'); await apply();
  assert.ok((await requests()).at(-1).includes('category=fitness')); assert.ok((await requests()).at(-1).includes('searchQuery=massage'));
  await choose('.search-filter-dialog [data-testid="search-category"]', ''); await apply(); assert.equal(await count(), 1);
  checks.push('independent query/filter drafts, no automatic requests, explicit Search/Apply and empty results');

  await choose('.search-filter-dialog [data-testid="input-distance"]', '0'); const beforeInvalid = (await requests()).length;
  await click('.search-filter-dialog button[type="submit"]');
  assert.equal((await requests()).length, beforeInvalid); assert.equal(await count(), 1);
  assert.equal(await evaluate(() => document.activeElement.getAttribute('role')), 'alert');
  await choose('.search-filter-dialog [data-testid="input-distance"]', '50');
  await click('.search-filter-dialog summary');
  await choose('.search-filter-dialog [data-testid="search-date"]', '2030-01-01');
  await choose('.search-filter-dialog [data-testid="search-dateEnd"]', '2030-02-01');
  await click('.search-filter-dialog button[type="submit"]'); assert.equal((await requests()).length, beforeInvalid);
  await choose('.search-filter-dialog [data-testid="search-date"]', ''); await choose('.search-filter-dialog [data-testid="search-dateEnd"]', '');
  await set('service-query',''); await submit(); await until(() => document.querySelectorAll('.search-service-card').length === 3,'cleared query');
  await set('service-sort','price-asc'); assert.equal(await evaluate(() => document.querySelector('.search-service-title').textContent), 'Restorative yoga');
  checks.push('invalid radius/date range retains prior results, focuses feedback; existing price sort');

  await set('search-location','Synthetic city'); await submit(); assert.ok((await requests()).at(-1).includes('latitude=0')); assert.ok((await requests()).at(-1).includes('radius=25'));
  const previous = (await requests()).length;
  await config({ geocode: 'error' }); await set('search-location','Unresolvable address'); await submit();
  assert.equal((await requests()).length,previous); assert.equal(await count(),3);
  assert.ok(await evaluate(() => document.querySelector('.search-query-error').textContent.includes('previous search')));
  await config({ geolocation: 'error' }); await locate();
  assert.equal(await evaluate(() => document.querySelector('.search-query-error')?.textContent), base.locationDenied);
  await config({ geocode: 'success', geolocation: 'success' });
  await locate(); assert.equal((await requests()).length,previous,'identical detected coordinates reuse the applied search');
  assert.equal(await evaluate(() => document.querySelector('option[value="distance-asc"]').disabled),false);
  await submit(); assert.ok((await requests()).at(-1).includes('latitude=0'));
  checks.push('explicit geocoding, resolved coordinates, failed-location retention and current location enabling distance sorting');

  await config({ result: 'rateLimited' }); await set('service-query','new failure'); await submit();
  assert.ok(await evaluate(() => document.querySelector('.search-state').getAttribute('role') === 'alert'));
  await config({ result: 'success' }); await click('.search-state button'); await until(() => document.querySelector('.search-results').getAttribute('aria-busy') === 'false','retry');
  await set('service-query',''); await submit();
  await click('[data-testid="button-view-map"]'); await until(() => !!document.querySelector('.search-map [role="alert"]'), 'synthetic map failure');
  await click('.search-map-help button'); assert.equal(await count(),3);
  await click('.search-service-title'); await until(() => !!document.querySelector('[data-testid="dialog-service-details"]'), 'details');
  assert.ok(!await evaluate(() => document.querySelector('[data-testid="dialog-service-details"]').textContent.includes('spots available')));
  await click('[data-testid="button-book-from-details"]'); await until(() => !!document.querySelector('[data-testid="dialog-booking-sign-in"]'), 'guest sign-in');
  await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'guest dialog closed');
  checks.push('rate-limit retry, map fallback to list, details-first flow and guest sign-in without writes');

  for (const language of languages) {
    await set('fixture-language',language);
    for (const width of [320,390,768,1280]) {
      await viewport(width);
      assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), `${language}/${width} page overflow`);
      assert.ok(await evaluate(() => [...document.querySelectorAll('.search-page input,.search-page select,.search-page button')].filter(n=>n.getClientRects().length).every(n=>{const b=n.getBoundingClientRect();return b.left>=-1&&b.right<=innerWidth+1;})), `${language}/${width} controls overflow`);
      assert.ok(!await evaluate(() => /searchPage\./.test(document.querySelector('.search-page').textContent)));
      matrix.push({language,width});
    }
  }
  await set('fixture-language','en'); await viewport(1280); await capture('desktop');
  await viewport(390); await capture('phone'); await click('.search-mobile-filter-trigger');
  await until(() => !!document.querySelector('.search-filter-dialog'), 'filter dialog');
  assert.ok(await evaluate(() => document.querySelector('.search-filter-dialog').contains(document.activeElement)));
  for (let index = 0; index < 16; index++) {
    await key('Tab');
    assert.ok(await evaluate(() => document.querySelector('.search-filter-dialog').contains(document.activeElement)), 'filter dialog contains keyboard focus');
  }
  await choose('.search-filter-dialog [data-testid="search-category"]','fitness');
  await key('Escape'); await until(() => !document.querySelector('.search-filter-dialog'),'filter closed');
  assert.ok(await evaluate(() => document.activeElement.classList.contains('search-mobile-filter-trigger')));
  await click('.search-mobile-filter-trigger');
  assert.equal(await evaluate(() => document.querySelector('.search-filter-dialog [data-testid="search-category"]').value),'fitness');
  await capture('phone-filters'); await click('.search-filter-dialog button[type="submit"]');
  await until(() => document.querySelectorAll('.search-service-card').length === 1,'mobile apply');
  await until(() => !document.querySelector('.search-filter-dialog'), 'mobile filter exit animation');
  await set('fixture-language','ru'); await click('#fixture-theme'); await capture('russian-dark');
  await viewport(320); await evaluate(() => {document.documentElement.style.fontSize='200%';});
  assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),'320px 200% text reflow');
  await evaluate(() => {document.documentElement.style.fontSize='';});
  await api('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.deepEqual(await evaluate(() => window.searchFixture.unexpected),[]); assert.deepEqual(fixture.errors,[]); assert.deepEqual(fixture.network,[]); assert.deepEqual(fixture.blocked,[]);
  checks.push('en/lv/ru responsive matrix, draft-preserving phone dialog/Escape/focus/apply, dark mode, 200% text and reduced motion');
  await writeFile(new URL('../docs/search-redesign-regression-evidence.json',import.meta.url),JSON.stringify({date:'2026-11-02',checks,matrix,screenshots,unexpectedNetwork:fixture.network,runtimeErrors:fixture.errors,deferredLanguages:['ar','de','es','fr','hi','ja','pt','zh'],limits:'Installed headless Chrome; synthetic API/geocoding/location boundaries. No real maps, connected server/session/database writes or deployment. Physical devices, screen readers, other browser engines and native-language review not performed.'},null,2)+'\n');
  console.log(`Passed search page: ${checks.length} groups, ${matrix.length} locale/viewport cases; no unexpected requests/runtime exceptions.`);
} finally { await fixture.close(); }
