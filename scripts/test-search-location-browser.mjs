import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/search-page.tsx", resources });
const { evaluate, until, click, set, viewport, visit } = fixture;
const config = changes => evaluate(changes => Object.assign(window.searchFixture, changes), changes);
const requests = () => evaluate(() => window.searchFixture.requests.length);
const attempts = () => evaluate(() => window.searchFixture.locationRequests.length);
const checks = [];
const closePicker = async () => { if (await evaluate(() => !!document.querySelector('[role="dialog"]'))) { await fixture.key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'picker dismissed'); } };
const gps = async () => { if (!await evaluate(() => !!document.querySelector('.search-location-dialog'))) { await click('[data-testid="open-search-location"]'); await until(() => !!document.querySelector('.search-location-dialog'), 'location picker'); } await click('.search-location-gps'); };
const categoryDraft = async value => { await closePicker(); await click('.search-mobile-filter-trigger'); await until(() => !!document.querySelector('.search-filter-dialog'), 'filters opened'); if(value !== undefined) await set(await evaluate(() => document.querySelector('[data-testid="search-category"]').id), value); const current = await evaluate(() => document.querySelector('[data-testid="search-category"]').value); await closePicker(); return current; };
const submit = async () => {
  await closePicker();
  await click('[data-testid="button-search-services"]');
  await until(() => !document.querySelector('[data-testid="button-search-services"]').disabled && document.querySelector('.search-results').getAttribute('aria-busy') === 'false', 'location resolution and search settled');
};
const error = async message => {
  assert.equal(await evaluate(() => document.querySelector('#search-query-feedback')?.textContent), message);
  assert.equal(await evaluate(() => document.activeElement.id), 'search-query-feedback');
  assert.equal(await evaluate(() => document.querySelector('#search-location').getAttribute('aria-invalid')), 'true');
  assert.equal(await evaluate(() => document.querySelector('.search-location-gps').disabled), false);
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-search-services"]').disabled), false);
};
try {
  await viewport(1280); await visit('/search');
  await until(() => !!document.querySelector('.search-results') && document.querySelector('.search-results').getAttribute('aria-busy') === 'false', 'initial location choice');
  assert.equal(await evaluate(() => !!document.querySelector('.search-location-dialog')), false, 'Empty search has no forced location modal');
  assert.equal(await evaluate(() => document.querySelector('option[value="distance-asc"]').disabled), true);
  await set('search-location', 'Synthetic city'); await submit();
  await until(() => document.querySelectorAll('.search-service-card').length === 3, 'initial located results');
  await set('service-query', 'Unsubmitted text');
  await categoryDraft('fitness');
  await config({ locationCoords: { latitude: 0, longitude: 0.029 }, geocode: 'error' });
  await gps();
  assert.equal(await evaluate(() => document.querySelector('option[value="distance-asc"]').disabled), false, 'Detecting current location immediately enables nearest-first sorting');
  assert.equal(await evaluate(() => document.querySelector('option[value="distance-desc"]').disabled), false);
  await until(() => document.querySelector('.search-results').getAttribute('aria-busy') === 'false', 'current location applied');
  const located = new URL(await evaluate(() => window.searchFixture.requests.at(-1)), 'http://fixture.invalid').searchParams;
  assert.equal(located.get('latitude'), '0'); assert.equal(located.get('longitude'), '0.029');
  assert.equal(located.has('searchQuery'), false); assert.equal(located.has('category'), false);
  assert.equal(await evaluate(() => document.querySelector('#service-query').value), 'Unsubmitted text');
  assert.equal(await categoryDraft(), 'fitness');
  await set('service-sort', 'distance-asc');
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('.search-service-title')].map(node => node.textContent)), ['Personal training', 'Deep tissue massage', 'Restorative yoga']);
  await click('.search-chip');
  await until(() => !document.querySelector('[data-testid="button-search-services"]').disabled && document.querySelector('.search-results').getAttribute('aria-busy') === 'false', 'location cleared');
  assert.equal(await evaluate(() => !!document.querySelector('.search-location-dialog')), false);
  assert.equal(await evaluate(() => document.querySelector('option[value="distance-asc"]').disabled), true);
  assert.equal(await evaluate(() => document.querySelector('#service-sort').value), 'default');
  checks.push('Location icon immediately applies coordinates and enables both distance sorts; nearest-first orders results; unapplied query/filter drafts stay intact; removing location disables distance sorting');
  await set('service-query', '');
  await categoryDraft('');
  await config({ geocode: 'success', locationCoords: { latitude: 0, longitude: 0 } });
  await set('search-location', 'Synthetic city'); await submit();
  const appliedRequests = await requests();
  for (const language of ['en', 'lv', 'ru']) {
    await set('fixture-language', language);
    await viewport(language === 'en' ? 1280 : 390);
    const messages = resources[language].translation.searchPage;
    for (const [outcome, message, expectedAttempts] of [
      ['error', 'locationDenied', 1], ['unavailable', 'locationUnavailable', 2],
      ['timeout', 'locationTimeout', 2], ['throw', 'locationUnavailable', 1], ['invalid', 'locationUnavailable', 1],
    ]) {
      await set('search-location', 'Keep this draft');
      await config({ geolocation: outcome }); const before = await attempts();
      await gps(); await error(messages[message]);
      assert.equal(await attempts(), before + expectedAttempts);
      assert.equal(await evaluate(() => document.querySelector('#search-location').value), 'Keep this draft');
      assert.equal(await requests(), appliedRequests, 'Failure keeps the applied search');
      assert.equal(await evaluate(() => document.querySelectorAll('.search-service-card').length), 3);
      assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Localized feedback reflows');
      if (language === 'en' && outcome === 'error') await fixture.screenshot('docs/search-redesign-gps-denied.png');
    }
    for (const outcome of ['unavailable', 'timeout']) {
      await config({ geolocation: 'success', geolocationQueue: [outcome, 'success'] });
      await gps();
      assert.equal(await evaluate(() => document.querySelector('#search-location').value), messages.currentLocation);
      assert.equal(await evaluate(() => document.querySelector('.search-location-receipt').textContent), messages.locationReady);
      assert.equal(await evaluate(() => document.querySelector('option[value="distance-asc"]').disabled), false);
      assert.equal(await requests(), appliedRequests, 'Identical detected coordinates reuse the applied search cache');
    }
    checks.push(`${language}: permission denial without retry; unavailable/timeout recovery; exceptions; invalid coordinates; retained drafts/results; localized focus/feedback/reflow`);
  }
  await set('fixture-language', 'en'); await viewport(1280);
  const messages = resources.en.translation.searchPage;
  await evaluate(() => { window.savedGeolocation = navigator.geolocation; Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }); });
  await gps(); await error(messages.locationUnsupported);
  await evaluate(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: window.savedGeolocation }); Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false }); });
  await gps(); await error(messages.locationInsecure);
  await evaluate(() => { delete window.isSecureContext; });
  checks.push('Unsupported and insecure contexts give actionable feedback without locking the form');

  await config({ geolocation: 'pending', locationCoords: { latitude: 56.95, longitude: 24.1 } });
  await set('search-location', 'Keep this draft');
  const beforePending = await attempts();
  await gps();
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-search-services"]').getAttribute('aria-label')), messages.resolvingLocation);
  assert.equal(await evaluate(() => document.querySelector('.search-location-receipt').getAttribute('role')), 'status');
  assert.equal(await evaluate(() => document.querySelector('.search-location-gps').disabled), true);
  await evaluate(() => document.querySelector('.search-location-gps').click());
  assert.equal(await attempts(), beforePending + 1, 'Disabled control prevents a duplicate pending request');
  // Use the real application deadline: this also covers a native API that never calls back.
  const started = Date.now();
  while (await evaluate(() => document.querySelector('.search-location-gps').disabled)) {
    assert.ok(Date.now() - started < 40000, 'Location must unlock within its overall deadline');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  await error(messages.locationTimeout);
  await set('search-location', 'Newer manual draft');
  await evaluate(() => window.searchFixture.resolveLocation());
  assert.equal(await evaluate(() => document.querySelector('#search-location').value), 'Newer manual draft', 'Late success cannot overwrite manual input');
  assert.equal(await requests(), appliedRequests);
  checks.push('A silent native request unlocks after 35 seconds; duplicate requests and late callbacks cannot change newer input');

  await config({ geolocation: 'pending' }); await gps();
  await set('fixture-language', 'lv'); await evaluate(() => window.searchFixture.resolveLocation());
  await until(() => !document.querySelector('[data-testid="button-search-services"]').disabled, 'location ready');
  await until(() => document.querySelector('.search-results').getAttribute('aria-busy') === 'false', 'detected location search settled');
  assert.equal(await evaluate(() => document.querySelector('#search-location').value), resources.lv.translation.searchPage.currentLocation);
  assert.equal(await requests(), appliedRequests + 1, 'Detection applies new coordinates without an extra Search click');
  assert.equal(await evaluate(() => document.querySelector('option[value="distance-asc"]').disabled), false);
  await submit();
  assert.equal(await requests(), appliedRequests + 1, 'Submitting unchanged coordinates reuses the applied search');
  const url = await evaluate(() => window.searchFixture.requests.at(-1));
  const params = new URL(url, 'http://fixture.invalid').searchParams;
  assert.equal(params.get('latitude'), '56.95'); assert.equal(params.get('longitude'), '24.1'); assert.equal(params.get('radius'), '25');
  checks.push('Successful location follows language changes, immediately searches with detected coordinates/radius, and enables distance sorting');
  assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL('../docs/search-redesign-gps-evidence.json', import.meta.url), JSON.stringify({ date: '2026-11-02', checks, languages: ['en','lv','ru'], viewports: [390,1280], browser: 'Installed headless Chrome', deferredLanguages: ['ar','zh','fr','de','hi','ja','pt','es'], limits: 'Synthetic geolocation and API responses; real application timer. No real location, external requests, database/session writes, paid services or deployment. Device/browser permission settings and live location provider remain unverified.' }, null, 2) + '\n');
  console.log(`Passed search location: ${checks.length} groups; en/lv/ru; no unexpected network or runtime errors.`);
} finally { await fixture.close(); }
