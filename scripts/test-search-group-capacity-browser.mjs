import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/search-group-capacity.tsx", resources });
const { visit, viewport, click, evaluate, until, key } = fixture;
const open = async route => {
  await visit(route);
  await until(() => !!document.querySelector('[data-testid="button-view-details-7"]'), "service search result");
  await click('[data-testid="button-view-details-7"]');
  await until(() => !!document.querySelector('[role="dialog"]'), "service details open");
};
try {
  for (const language of languages) {
    for (const width of [1280, 768, 375, 320]) {
      await viewport(width, 900);
      await open("/search?lang=" + language);
      assert.deepEqual(await evaluate(() => {
        const value = document.querySelector('[data-testid="text-max-group-capacity"]');
        return { label: value?.previousElementSibling.textContent, value: value?.textContent, semantic: value?.tagName };
      }), { label: resources[language].translation.searchPage.maxGroupCapacity, value: "6", semantic: "DD" }, "Group details show total capacity six regardless of remaining capacity two");
      assert.deepEqual(await evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const value = document.querySelector('[data-testid="text-max-group-capacity"]');
        return { page: document.documentElement.scrollWidth <= innerWidth + 1, dialog: dialog.scrollWidth <= dialog.clientWidth + 1, visible: value.getBoundingClientRect().height > 0 };
      }), { page: true, dialog: true, visible: true });
      await key("Tab");
      assert.equal(await evaluate(() => !!document.activeElement.closest('[role="dialog"]')), true, "Focus remains in service details");
      await click('[data-testid="button-book-from-details"]');
      assert.equal(await evaluate(() => window.phase2Fixture.bookings), 1, "Choose time action is preserved");
      await key("Escape");
      await until(() => !document.querySelector('[role="dialog"]'), "Escape closes service details");
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
    await open(`/search?lang=${language}&type=one_to_one`);
    assert.equal(await evaluate(() => !!document.querySelector('[data-testid="text-max-group-capacity"]')), false, "Individual service has no group capacity");
    await open(`/search?lang=${language}&maximum=1`);
    assert.equal(await evaluate(() => document.querySelector('[data-testid="text-max-group-capacity"]').textContent), "1");
    await open(`/search?lang=${language}&legacy=true`);
    assert.equal(await evaluate(() => document.querySelector('[data-testid="text-max-group-capacity"]').textContent), "1", "Null maximum matches booking fallback");
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  if (process.env.CAPACITY_SCREENSHOT) {
    await viewport(375, 900); await open("/search?lang=en");
    await fixture.screenshot(process.env.CAPACITY_SCREENSHOT);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log((await fixture.api("Browser.getVersion")).product);
  console.log("Passed: search result opens localized maximum group capacity in en/lv/ru at 1280/768/375/320px; total versus remaining capacity, individual exclusion, one/null fallback, choose-time action, Escape, focus containment and reflow. All APIs isolated; no app server/database.");
} finally { await fixture.close(); }
