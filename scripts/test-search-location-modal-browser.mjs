import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/search-page.tsx", resources });
const { evaluate, until, click, set, key, viewport } = fixture;
const open = () => until(() => !!document.querySelector('.search-location-dialog[data-state="open"]'), "location modal open");
const closed = () => until(() => !document.querySelector('.search-location-dialog'), "location modal closed");
const settled = () => until(() => document.querySelector('.search-results')?.getAttribute('aria-busy') === 'false' && !document.querySelector('[data-testid="button-search-services"]').disabled, "search settled");
const checks = [], matrix = [];
try {
  await viewport(1280); await fixture.visit('/search'); await open();
  assert.equal(await evaluate(() => document.activeElement.id), 'modal-search-location');
  assert.equal(await evaluate(() => window.searchFixture.requests.length), 0);
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0);
  assert.equal(await evaluate(() => document.querySelector('.search-query-form .search-state')), null);
  for (let index = 0; index < 12; index++) {
    await key('Tab');
    assert.ok(await evaluate(() => document.querySelector('.search-location-dialog').contains(document.activeElement)), 'focus stays in modal');
  }
  await key('Escape'); await closed();
  assert.equal(await evaluate(() => document.activeElement.dataset.testid), 'open-search-location');
  await set('service-query', 'Unsubmitted query');
  await click('[data-testid="open-search-location"]'); await open();
  await click('[data-testid="confirm-search-location"]');
  await until(() => document.activeElement.id === 'search-query-feedback', 'validation focuses feedback');
  assert.equal(await evaluate(() => document.querySelector('#modal-search-location').getAttribute('aria-invalid')), 'true');
  await evaluate(() => window.searchFixture.geolocation = 'error');
  await click('.search-location-gps');
  await until(() => document.querySelector('#search-query-feedback')?.textContent.includes('Location permission is blocked'), 'GPS denied feedback');
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 1);
  await set('modal-search-location', 'Synthetic city');
  await click('[data-testid="confirm-search-location"]'); await closed(); await settled();
  assert.equal(await evaluate(() => document.querySelectorAll('.search-service-card').length), 3);
  assert.equal(await evaluate(() => document.querySelector('#service-query').value), 'Unsubmitted query');
  assert.equal(await evaluate(() => new URL(window.searchFixture.requests.at(-1), location.origin).searchParams.has('searchQuery')), false);
  checks.push('Initial modal makes no search/GPS request; traps focus; Escape restores trigger; required/denied feedback; address selection closes modal without applying query draft');

  await click('[data-testid="open-search-location"]'); await open();
  assert.equal(await evaluate(() => document.querySelector('#modal-search-location').value), 'Synthetic city');
  await click('.search-location-gps');
  await until(() => document.querySelector('#search-query-feedback')?.textContent.includes('Location permission is blocked'), 'existing-location GPS denial');
  assert.ok(await evaluate(() => !!document.querySelector('.search-location-dialog[data-state="open"]')), 'failed update keeps modal open');
  await evaluate(() => window.searchFixture.geocode = 'error');
  await set('modal-search-location', 'Unresolvable address');
  await click('[data-testid="confirm-search-location"]');
  await until(() => !document.querySelector('[data-testid="confirm-search-location"]').disabled, 'failed address finished');
  assert.ok(await evaluate(() => !!document.querySelector('.search-location-dialog[data-state="open"]')), 'failed address update keeps modal open');
  assert.equal(await evaluate(() => document.querySelectorAll('.search-service-card').length), 3);
  await key('Escape'); await closed();
  assert.equal(await evaluate(() => document.querySelectorAll('.search-service-card').length), 3);
  checks.push('Change reopens selected location; dismiss preserves results');

  const account = '00000000-0000-4000-8000-000000000001';
  await evaluate(id => { window.savedLocationFixture.preferenceError = true; window.setFixtureUser({ id }); }, account);
  await open();
  await until(() => document.querySelector('.search-location-error')?.textContent.includes('could not be restored'), 'restoration error inside modal');
  assert.equal(await evaluate(() => document.querySelector('.search-location-dialog [data-testid="remember-search-location"]').checked), false);
  await fixture.screenshot('docs/search-location-modal-restore-error.png');
  await evaluate(id => { window.savedLocationFixture.preferenceError = false; window.savedLocationFixture.preferences[id] = { source: 'device', latitude: 0, longitude: 0 }; }, account);
  await click('.search-location-error button'); await closed(); await settled();
  checks.push('Account restoration failure and retry are contained in modal; successful retry closes it');

  for (const language of ['en', 'lv', 'ru']) {
    await set('fixture-language', language);
    await click('[data-testid="open-search-location"]'); await open();
    if (language === 'ru') await evaluate(() => document.documentElement.classList.add('dark'));
    for (const width of [320, 390, 768, 1280]) {
      await viewport(width, width === 768 ? 480 : 900); await fixture.settle();
      assert.ok(await evaluate(() => {
        const dialog = document.querySelector('.search-location-dialog'), box = dialog.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight + 1 && dialog.scrollWidth <= dialog.clientWidth + 1;
      }), `${language}/${width}: dialog fits`);
      assert.ok((await evaluate(() => document.querySelector('.search-location-dialog').textContent)).includes(resources[language].translation.searchLocation.title));
      matrix.push({ language, width });
    }
    await viewport(language === 'en' ? 1280 : 390);
    await fixture.screenshot(`docs/search-location-modal-${language}.png`);
    await viewport(320); await evaluate(() => document.documentElement.style.fontSize = '200%');
    assert.ok(await evaluate(() => { const d = document.querySelector('.search-location-dialog'); return d.scrollWidth <= d.clientWidth + 1; }), '200% text reflows');
    await evaluate(() => document.documentElement.style.fontSize = '');
    await key('Escape'); await closed();
  }
  checks.push('en/lv/ru modal fits desktop/tablet/phone and short viewports, 200% text, Russian dark theme');
  assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile('docs/search-location-modal-evidence.json', JSON.stringify({ date: '2026-10-23', checks, matrix, browser: 'Installed headless Chrome', services: 'All APIs, geocoding and geolocation mocked; no connected app/DB', deferred: ['ar/RTL','zh','fr','de','hi','ja','pt','es'], limits: 'No physical device, screen reader or real permission-dialog coverage' }, null, 2) + '\n');
  console.log(`Passed location modal: ${checks.length} groups, ${matrix.length} locale/viewport cases.`);
} finally { await fixture.close(); }
