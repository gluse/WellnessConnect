import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

// The component suite covers App routing. This fixture checks the rendered
// Search/header at both entry URLs without connected APIs or session writes.
const resources = {};
for (const language of ["en", "lv", "ru"]) {
  resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
}
const fixture = await browserFixture({ entry: "scripts/fixtures/search-redesign.tsx", resources });
try {
  for (const language of ["en", "lv", "ru"]) for (const width of [390, 1280]) {
    await fixture.viewport(width);
    for (const path of ["/", "/search"]) {
      await fixture.visit(`${path}?redesign=1`);
      await fixture.set("fixture-language", language);
      await fixture.until(() => !!document.querySelector('#service-query') && !!document.querySelector('.search-app-header'), 'Search and header rendered');
      assert.equal(await fixture.evaluate(() => !!document.querySelector('[data-testid="button-get-started"]')), false);
      assert.equal(await fixture.evaluate(() => !!document.querySelector('a[href="/login?returnTo=%2Fsearch"]')), true);
      assert.equal(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language}/${width}/${path}: no horizontal overflow`);
      if (width === 390) assert.equal(await fixture.evaluate(() => getComputedStyle(document.querySelector('header a[href="/search"]')).display), 'none');
      assert.deepEqual(await fixture.evaluate(() => window.searchFixture.unexpected), []);
      assert.deepEqual(await fixture.evaluate(() => window.savedLocationFixture.writes), []);
    }
  }
  assert.deepEqual(fixture.errors, []);
  assert.deepEqual(fixture.network, []);
  assert.deepEqual(fixture.blocked, []);
  console.log('Passed: Search/header at / and /search in Chrome, en/lv/ru, 390/1280px; login, welcome absence, mobile browse visibility and overflow. Mocked APIs only.');
} finally { await fixture.close(); }
