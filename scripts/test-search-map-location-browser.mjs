import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/search-redesign.tsx", resources });
const { evaluate, until, click, set, key, viewport, visit } = fixture;
const map = '[data-testid="button-view-map"]';
const settled = () => until(() => document.querySelector('.search-results')?.getAttribute('aria-busy') === 'false' && !document.querySelector('[data-testid="button-search-services"]').disabled, 'search settled');
const submit = async () => { await click('[data-testid="button-search-services"]'); await settled(); };
const openLocation = async () => { await fixture.settle(); await click('[data-testid="open-search-location"]'); await until(() => !!document.querySelector('.search-location-dialog[data-state="open"]'), 'location picker open'); await fixture.settle(); };
const listSelected = () => evaluate(() => document.querySelector('[data-testid="button-view-list"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('.search-map'));
const disabled = () => evaluate(selector => document.querySelector(selector).disabled, map);
const blockedMap = async () => {
  assert.equal(await disabled(), true);
  await evaluate(selector => document.querySelector(selector).click(), map);
  assert.equal(await listSelected(), true, 'native disabled map leaves list selected');
};
const enterMap = async () => {
  assert.equal(await disabled(), false);
  await click(map);
  await until(() => !!document.querySelector('.search-map'), 'map entered after a location is applied');
  assert.equal(await evaluate(selector => document.querySelector(selector).getAttribute('aria-pressed'), map), 'true');
};
const cases = [];
try {
  for (const language of languages) for (const width of [390, 1280]) {
    await viewport(width); await visit('/search'); await set('fixture-language', language); await settled();
    await blockedMap();
    assert.equal(await evaluate(() => window.searchFixture.configRequests), 0, 'blocked map does not load Maps');
    assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0, 'blocked map does not request GPS');
    await evaluate(() => document.querySelector('[data-testid="button-view-list"]').focus()); await key('Tab');
    assert.equal(await evaluate(selector => document.activeElement === document.querySelector(selector), map), false, 'disabled map is skipped by keyboard');
    await click('[data-testid="button-view-grid"]');
    assert.equal(await evaluate(() => document.querySelector('[data-testid="button-view-grid"]').getAttribute('aria-pressed')), 'true', 'grid remains available without location');
    await click('[data-testid="button-view-list"]');

    await set('search-location', 'Synthetic city'); await blockedMap();
    await evaluate(() => window.searchFixture.geocode = 'error'); await submit(); await blockedMap();
    await evaluate(() => window.searchFixture.geocode = 'pending');
    await click('[data-testid="button-search-services"]');
    await until(() => !!window.searchFixture.resolveGeocode, 'address resolution pending');
    await blockedMap();
    await evaluate(() => { window.searchFixture.geocode = 'success'; window.searchFixture.resolveGeocode(); });
    await settled(); await enterMap();
    await click('.search-chip'); await settled(); await blockedMap();
    assert.equal(await evaluate(() => document.querySelector('#search-location').value), '', 'removing location clears the applied address');

    await set('search-location', 'Synthetic city'); await submit();
    assert.equal(await listSelected(), true, 'reselecting a location does not silently reopen map');
    await enterMap(); await openLocation(); await click('[data-testid="browse-without-location"]'); await settled(); await blockedMap();

    await openLocation();
    await evaluate(() => window.searchFixture.geolocation = 'error'); await click('.search-location-gps');
    assert.equal(await disabled(), true, 'denied GPS never enables map');
    await evaluate(() => window.searchFixture.geolocation = 'success'); await click('.search-location-gps');
    await until(() => !document.querySelector('.search-location-dialog'), 'GPS applied'); await settled();
    assert.equal(await listSelected(), true); await enterMap();
    await openLocation(); await click('[data-testid="forget-search-location"]');
    await key('Escape'); await until(() => !document.querySelector('.search-location-dialog'), 'picker closed');
    await settled(); await blockedMap();

    await set('search-location', 'Synthetic city'); await submit(); await enterMap();
    await set('search-location', ''); await submit(); await blockedMap();
    await openLocation(); await click('[data-testid="remember-search-location"]'); await click('.search-location-gps');
    await until(() => !document.querySelector('.search-location-dialog'), 'remembered GPS applied'); await settled();
    await visit('/search'); await set('fixture-language', language); await settled();
    assert.equal(await listSelected(), true, 'restored location starts in list'); await enterMap();
    assert.equal(await evaluate(() => window.searchFixture.locationRequests.length), 0, 'restoration enables map without another GPS request');
    await click('.search-chip'); await settled(); await blockedMap();
    assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
    assert.deepEqual(await evaluate(() => window.savedLocationFixture.writes), [], 'guest flow makes no account writes');
    cases.push({ language, width, checks: 'Disabled initially, while typing/resolving, after failed address/GPS, chip removal, browse without location, forget and blank submission; enabled after manual/GPS choice or saved restoration; no automatic map return; list/grid and keyboard remain usable.' });
    console.log(`Passed ${language}/${width} map/location interactions.`);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  const engine = process.env.FORMS_BROWSER || 'chrome';
  await writeFile(`docs/search-map-location-${engine}-evidence.json`, JSON.stringify({ date: '2026-11-06', engine, cases, deferredLanguages: ['ar', 'zh', 'fr', 'de', 'hi', 'ja', 'pt', 'es'], limits: 'Synthetic API, Maps and geolocation. No connected services, database writes, private configuration or deployment. Physical devices and screen readers unverified.' }, null, 2) + '\n');
  console.log(`Passed map/location guard: ${cases.length} en/lv/ru phone/desktop cases in ${engine}; no unexpected network or runtime errors.`);
} finally { await fixture.close(); }
