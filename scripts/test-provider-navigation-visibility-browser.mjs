import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/mobile-navigation.tsx", resources });
const { evaluate, until, visit, viewport, click, key } = fixture;
const matrix = [], screenshots = [], checks = [];
let sequence = 0;
const open = async (role, lang = "en", path = "/search", hash = "") => {
  await visit(`${path}?role=${encodeURIComponent(role)}&lang=${lang}&case=${++sequence}${hash}`);
  await until(() => !!document.querySelector('main') && !!document.querySelector('[data-mobile-navigation]'), "signed-in app ready");
};
const menu = async () => { await click('[data-mobile-navigation] button'); await until(() => !!document.querySelector('[role="menu"]')); await fixture.settle(); };
async function navigation(provider, desktop) {
  const state = await evaluate(() => {
    const bar = document.querySelector('[data-mobile-navigation]');
    const visible = element => Boolean(element?.getClientRects().length);
    return { desktopProvider: !!document.querySelector('header nav a[href="/my-services"]'),
      calendar: !!bar.querySelector('a[href="/my-services/appointments"]'), barVisible: visible(bar),
      explore: !!bar.querySelector('a[href="/"]'), bookings: !!bar.querySelector('a[href="/my-bookings"]'),
      reflow: document.documentElement.scrollWidth <= innerWidth + 1,
      targets: [...bar.querySelectorAll('a,button')].map(element => { const box = element.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }) };
  });
  assert.equal(state.desktopProvider, provider); assert.equal(state.calendar, provider);
  assert.equal(state.barVisible, !desktop); assert.ok(state.explore && state.bookings && state.reflow);
  if (!desktop) assert.ok(state.targets.every(Boolean));
}
try {
  for (const lang of languages) for (const role of ["seeker", "provider"]) for (const width of [320, 768, 1024, 1280]) {
    await viewport(width, 900); await open(role, lang); await navigation(role === "provider", width >= 1024);
    if (width < 1024) {
      await menu();
      const labels = await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map(element => element.textContent.trim()));
      const t = resources[lang].translation;
      assert.ok(labels.includes(t.wishlist.title) && labels.includes(t.legal.privacyPolicyNewTab));
      if (role === "provider") assert.ok(labels.includes(t.mobileNavigation.services) && labels.includes(t.providerNavigation.workspace));
      else assert.deepEqual(labels, [t.wishlist.title, t.legal.privacyPolicyNewTab]);
      await key("Escape"); await until(() => !document.querySelector('[role="menu"]'));
    }
    if (lang === "en" && [320, 1280].includes(width)) { const file = `docs/provider-navigation-visibility-${engine}-${role}-${width}.png`; await fixture.screenshot(file, false); screenshots.push(file); }
    matrix.push({ lang, role, width, height: 900 });
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  checks.push("en/lv/ru provider and buyer navigation, mobile provider menu/workspace visibility, personal actions, touch targets and breakpoint/reflow coverage");
  for (const role of ["", "unknown", "PROVIDER"]) { await viewport(320, 700); await open(role); await navigation(false, false); }
  await evaluate(() => window.phase2Fixture.setRole(null)); await navigation(false, false);
  checks.push("missing/empty/unknown/case-mismatched roles never show provider navigation");

  await open("provider"); await menu();
  await evaluate(label => [...document.querySelectorAll('[role="menuitem"]')].find(element => element.textContent.trim() === label).focus(), resources.en.translation.providerNavigation.workspace);
  await key("Enter");
  await until(() => !!document.getElementById("mobile-workspace"), "provider workspace dialog");
  await evaluate(() => window.phase2Fixture.setRole("seeker"));
  await until(() => !document.getElementById("mobile-workspace") && !document.querySelector('[data-mobile-navigation] a[href="/my-services/appointments"]'));
  await navigation(false, false); await menu();
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map(e => e.textContent.trim())), [resources.en.translation.wishlist.title, resources.en.translation.legal.privacyPolicyNewTab]);
  await key("Escape");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), [], "changing the role cannot submit a stale workspace choice");
  await evaluate(() => window.phase2Fixture.setRole("provider"));
  await until(() => !!document.querySelector('[data-mobile-navigation] a[href="/my-services/appointments"]'));
  await navigation(true, false);
  await until(() => parseFloat(getComputedStyle(document.querySelector('.mobile-navigation-layout')).paddingBottom) >= document.querySelector('[data-mobile-navigation]').getBoundingClientRect().height, "bar clearance remeasures after role change");
  checks.push("live role changes hide/restore navigation, dismiss stale provider workspace UI and preserve mobile bar clearance");

  await open("seeker", "en", "/account", "#role");
  await fixture.button(resources.en.translation.accountRole.become);
  await until(() => !!document.querySelector('[data-mobile-navigation] a[href="/my-services/appointments"]'), "successful provider activation reveals navigation");
  await navigation(true, false);
  await click('[data-mobile-navigation] a[href="/my-services/appointments"]');
  await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "provider calendar still opens");
  await evaluate(() => window.phase2Fixture.signOut());
  await until(() => !document.querySelector('[data-mobile-navigation]') && !document.querySelector('header nav a[href="/my-services"]'));
  checks.push("real account Role action reveals provider navigation immediately; provider calendar works and logout hides private navigation");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`docs/provider-navigation-visibility-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-08", browser: await fixture.api("Browser.getVersion"), languages, checks, matrix, screenshots,
    deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual App with synthetic in-memory fetch mocks; role changes exercise frontend visibility only. No real sessions, database writes, provider messages or deployment. No physical-device or screen-reader coverage." }, null, 2) + "\n");
  console.log(`PASS: ${engine} provider navigation visibility, ${checks.length} behavior groups and ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
