import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ["en", "lv", "ru"]) {
  resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
  for (const key of Object.keys(resources.en.translation.searchLocation)) assert.ok(resources[language].translation.searchLocation[key], `${language}: ${key}`);
}
const fixture = await browserFixture({ entry: "scripts/fixtures/search-page.tsx", resources });
const { api, evaluate, until, click, set, viewport, visit } = fixture;
const checks = [];
const settle = async () => {
  await until(() => !!document.querySelector('.search-results') && document.querySelector('.search-results').getAttribute('aria-busy') === 'false' && !document.querySelector('[data-testid="button-search-services"]').disabled, 'settled search');
  await until(() => !document.querySelector('.search-location-dialog[data-state="closed"]'), 'closed modal transition completed');
};
const count = () => evaluate(() => document.querySelectorAll('.search-service-card').length);
const submit = async () => { await click(await evaluate(() => document.querySelector('.search-location-dialog[data-state="open"]') ? '[data-testid="confirm-search-location"]' : '[data-testid="button-search-services"]')); await settle(); };
const setLocation = async value => set(await evaluate(() => document.querySelector('.search-location-dialog[data-state="open"]') ? 'modal-search-location' : 'search-location'), value);
const forget = async () => { if (!await evaluate(() => !!document.querySelector('.search-location-dialog[data-state="open"]'))) await click('[data-testid="open-search-location"]'); await until(() => !!document.querySelector('.search-location-dialog[data-state="open"]'), 'forget modal ready'); await click('[data-testid="forget-search-location"]'); await settle(); };
try {
  await viewport(1280); await visit('/search'); await settle();
  assert.equal(await count(), 0);
  assert.equal(await evaluate(() => window.searchFixture.requests.length), 0, 'No unfiltered initial request');
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0, 'No automatic GPS request');
  assert.equal(await evaluate(() => document.querySelector('.search-desktop-filters [data-testid="input-distance"]').value), '25');
  await setLocation('Synthetic city');
  await click('[data-testid="remember-search-location"]'); await submit();
  assert.equal(await count(), 3);
  const url = await evaluate(() => window.searchFixture.requests.at(-1));
  const params = new URL(url, 'http://fixture.invalid').searchParams;
  assert.equal(params.get('radius'), '25'); assert.equal(params.get('limit'), '50');
  const cookie = await evaluate(() => JSON.parse(decodeURIComponent(document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('fmt.search-location.v1=')).split('=').slice(1).join('='))));
  assert.equal(cookie.preference.source, 'address'); assert.equal(cookie.preference.inputText, 'Synthetic city');
  assert.equal('latitude' in cookie.preference, false, 'No Google-derived coordinates persisted');
  await visit('/search'); await settle();
  assert.equal(await count(), 3); assert.equal(await evaluate(() => window.savedLocationFixture.geocodes), 1);
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0);
  checks.push('First visit asks; 25 km/50 cap; explicit remember; typed guest return resolves automatically without persistent Google coordinates or GPS prompt');

  await forget(); assert.equal(await count(), 3);
  assert.equal(await evaluate(() => new URL(window.searchFixture.requests.at(-1), location.origin).searchParams.has("latitude")), false);
  assert.equal(await evaluate(() => document.cookie.includes('fmt.search-location.v1=')), false);
  await click('[data-testid="remember-search-location"]');
  await click('.search-location-gps'); await settle(); assert.equal(await count(), 3);
  await visit('/search'); await settle();
  assert.equal(await count(), 3); assert.equal(await evaluate(() => window.savedLocationFixture.geocodes), 0);
  assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0);
  checks.push('Guest GPS selection restores without geocoding or another browser permission request; forget clears cookie and continues catalog browsing without location');

  const accountA = '00000000-0000-4000-8000-000000000001', accountB = '00000000-0000-4000-8000-000000000002';
  await evaluate(id => window.setFixtureUser({ id }), accountA); await settle();
  assert.equal(await count(), 3);
  assert.equal(await evaluate(id => window.savedLocationFixture.preferences[id].source, accountA), 'device');
  assert.equal(await evaluate(() => document.cookie.includes('fmt.search-location.v1=')), false);
  await evaluate(() => window.setFixtureUser(null)); await settle(); assert.equal(await count(), 0);
  await evaluate(id => window.setFixtureUser({ id }), accountA); await settle(); assert.equal(await count(), 3);
  await evaluate(id => window.setFixtureUser({ id }), accountB); await settle(); assert.equal(await count(), 0);
  checks.push('Guest preference adopted only into empty profile; no cookie survives login; logout and account switching clear private location/results; account return restores');

  await evaluate(id => { window.savedLocationFixture.preferenceError = true; window.setFixtureUser({ id }); }, accountA);
  await until(() => !!document.querySelector('[role="alert"]'), 'restore failure');
  assert.equal(await count(), 0, 'Failed profile read must not show old account results');
  assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent.includes('could not be restored')), true);
  await evaluate(() => window.savedLocationFixture.preferenceError = false);
  await click('[role="alert"] button'); await settle(); assert.equal(await count(), 3);
  await evaluate(() => window.savedLocationFixture.preferenceError = true);
  await forget(); assert.equal(await count(), 3);
  assert.equal(await evaluate(() => new URL(window.searchFixture.requests.at(-1), location.origin).searchParams.has("latitude")), false);
  assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent.includes('could not be deleted')), true);
  await evaluate(() => window.savedLocationFixture.preferenceError = false);
  await click('[role="alert"] button'); await settle();
  assert.equal(await evaluate(id => !!window.savedLocationFixture.preferences[id], accountA), false);
  checks.push('Profile read failure retains error instead of guest fallback; failed forget stops location use while browsing continues, preserves honest feedback and supports retry');

  await evaluate(() => window.setFixtureUser(null)); await settle();
  await evaluate(id => {
    window.savedLocationFixture.preferences[id] = { source: 'device', latitude: 1, longitude: 2 };
    window.searchFixture.geocode = 'pending';
  }, accountB);
  await setLocation('Obsolete guest draft');
  await click('[data-testid="confirm-search-location"]');
  await until(() => !!window.searchFixture.resolveGeocode, 'old guest geocoding pending');
  await evaluate(id => window.setFixtureUser({ id }), accountB); await settle();
  await evaluate(() => window.searchFixture.resolveGeocode()); await settle();
  assert.equal(await evaluate(id => window.savedLocationFixture.preferences[id].source, accountB), 'device');
  assert.equal(await evaluate(() => document.querySelector('#search-location').value), resources.en.translation.searchPage.currentLocation);
  checks.push('Late geocoder completion after account change cannot update the new account or expose an obsolete draft');

  await evaluate(() => { window.searchFixture.geocode = 'success'; window.savedLocationFixture.preferenceError = true; });
  await setLocation('New account place'); await submit();
  assert.equal(await count(), 3, 'A failed save can still search for this visit');
  assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent.includes('could not be saved')), true);
  await evaluate(() => window.savedLocationFixture.preferenceError = false);
  await click('[role="alert"] button'); await settle();
  assert.equal(await evaluate(id => window.savedLocationFixture.preferences[id].inputText, accountB), 'New account place');
  checks.push('Failed account save is visible; retry persists the selected place without another location prompt');

  await evaluate(() => window.setFixtureUser(null)); await settle();
  for (const language of ['en', 'lv', 'ru']) {
    await set('fixture-language', language); await viewport(language === 'en' ? 1280 : 390);
    assert.ok((await evaluate(() => document.body.textContent)).includes(resources[language].translation.searchLocation.title));
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await evaluate(() => document.querySelector('[data-testid="remember-search-location"]').checked), false);
  }
  await fixture.screenshot('docs/google-api-fallback-saved-phone.png');
  checks.push('English/Latvian/Russian location choice, notice and remember control reflow at desktop/phone widths');
  assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.blocked, []);
  await writeFile('docs/google-api-fallback-saved-evidence.json', JSON.stringify({ checks, locales: ['en','lv','ru'], viewports: [1280,390], externalServices: 'mocked', deferred: ['ar/RTL','zh','fr','de','hi','ja','pt','es'] }, null, 2) + '\n');
  console.log(`Passed ${checks.length} saved-search-location browser groups. All APIs and device services mocked.`);
} finally { await fixture.close(); }
