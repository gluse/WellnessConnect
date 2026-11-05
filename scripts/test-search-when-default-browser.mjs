import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const artifactPrefix = process.env.SEARCH_WHEN_ARTIFACT_PREFIX || "search-when-default-chrome";
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/search-page.tsx", resources });
const { visit, viewport, until, evaluate, click, set, key } = fixture;
const checkbox = '.search-when-dialog input[type="checkbox"]';
const requestCount = () => evaluate(() => window.searchFixture.requests.length);
const settled = () => until(() => document.querySelector('.search-results')?.getAttribute('aria-busy') === 'false', 'search settled');
const open = async () => {
  await click('[data-testid="open-search-when"]');
  await until(() => !!document.querySelector('.search-when-dialog'), 'When opened');
  assert.equal(await evaluate(selector => document.querySelector(selector).checked, checkbox), true, 'Availability defaults to enabled on opening');
};
const apply = async () => {
  await click('.search-when-dialog button[type="submit"]');
  await until(() => !document.querySelector('.search-when-dialog'), 'When applied');
  await settled();
};
const matrix = [];
try {
  for (const language of languages) {
    for (const width of [390, 1280]) {
      await viewport(width, 900); await visit('/search'); await settled();
      await set('fixture-language', language);
      const initial = await requestCount();
      assert.equal(await evaluate(() => new URL(window.searchFixture.requests.at(-1), location.origin).searchParams.has('availableOnly')), false, 'Initial catalog stays unfiltered');
      await open(); assert.equal(await requestCount(), initial, 'Opening does not apply the filter');
      await key('Escape'); await until(() => !document.querySelector('.search-when-dialog'), 'When cancelled');
      assert.equal(await requestCount(), initial, 'Cancelling does not search');
      await until(() => document.activeElement?.dataset.testid === 'open-search-when', 'Focus restored');
      await open(); await click('.search-when-dialog button[type="submit"]');
      await until(() => document.activeElement?.id === 'search-when-error', 'Missing date validation is focused');
      assert.equal(await requestCount(), initial, 'Availability still requires a date');
      await set('search-when-date', '2030-01-02');
      await click(checkbox);
      assert.equal(await evaluate(selector => document.querySelector(selector).checked, checkbox), false, 'User can disable availability');
      await apply();
      assert.equal(await evaluate(() => new URL(window.searchFixture.requests.at(-1), location.origin).searchParams.has('availableOnly')), false, 'Explicit opt-out is applied');
      await open();
      assert.equal(await evaluate(() => document.querySelector('#search-when-date').value), '2030-01-02', 'Opening preserves applied date');
      await apply();
      assert.equal(await evaluate(() => new URL(window.searchFixture.requests.at(-1), location.origin).searchParams.get('availableOnly')), 'true', 'Apply sends the enabled availability filter');
      await open();
      assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Modal reflows');
      if (language === 'en' && width === 390) await fixture.screenshot(`docs/${artifactPrefix}-phone.png`, false);
      await key('Escape'); await until(() => !document.querySelector('.search-when-dialog'), 'When closed');
      assert.deepEqual(await evaluate(() => window.searchFixture.unexpected), []);
      matrix.push({ language, width });
    }
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/${artifactPrefix}-evidence.json`, import.meta.url), JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: await fixture.api('Browser.getVersion'), matrix,
    checks: ['enabled on each opening', 'unfiltered initial catalog', 'opening/cancelling does not search', 'cancel restores focus', 'required date validation', 'explicit opt-out applies', 'applied date preserved', 'enabled availability sent on Apply', 'modal reflow'],
    deferredLanguages: ['ar', 'zh', 'fr', 'de', 'hi', 'ja', 'pt', 'es'], limits: 'Installed headless Chrome with synthetic API mocks and external traffic blocked. No connected services/database/session writes, physical-device or screen-reader verification.' }, null, 2) + '\n');
  console.log('Passed Search When default: six en/lv/ru phone/desktop cases, validation, opt-out, Apply, cancellation and focus.');
} finally { await fixture.close(); }
