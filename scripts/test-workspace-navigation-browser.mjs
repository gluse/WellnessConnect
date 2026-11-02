import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/workspace-navigation.tsx", resources });
const { evaluate, until, visit, viewport, click, key, set } = fixture;
const checks = [], matrix = [], screenshots = [];
const engine = process.env.FORMS_BROWSER || "chrome";
const open = async (companies, language = "en", path = "/my-services/appointments") => {
  await visit(`${path}?companies=${companies}&lang=${language}`);
  await until(() => !!document.querySelector("main h1"), "provider page loaded");
};
const openSwitcher = async () => {
  await fixture.settle();
  await click("nav button");
  await until(() => !!document.querySelector("#workspace"), "workspace selector opens");
};
try {
  for (const language of languages) {
    for (const [width, height] of [[320, 700], [767, 900], [768, 900], [1280, 900]]) {
      await viewport(width, height);
      await open(0, language);
      assert.equal(await evaluate(() => document.querySelectorAll("nav button").length), 0, "personal-only has no workspace control");
      assert.equal(await evaluate(() => !!document.querySelector("#workspace")), false);
      for (const companies of [1, 2]) {
        await open(companies, language);
        assert.equal(await evaluate(() => document.querySelectorAll("nav button").length), 1, "personal plus companies shows one control inside navigation");
        assert.equal(await evaluate(label => document.querySelector("nav").getAttribute("aria-label") === label, resources[language].translation.providerNavigation.sections), true);
        assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${language}/${width}: page fits`);
        const labels = await evaluate(() => [...document.querySelectorAll("nav a span")].map(label => ({ text: label.textContent, height: label.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(label).lineHeight), width: label.getBoundingClientRect().width })));
        assert.equal(labels.every(label => label.height <= label.lineHeight + 1), true, `${language}/${width}: navigation labels fit without broken words: ${JSON.stringify(labels)}`);
        await openSwitcher();
        assert.equal(await evaluate(() => document.querySelectorAll("#workspace option").length), companies + 1);
        assert.equal(await evaluate(() => document.querySelector('label[for="workspace"]').textContent), resources[language].translation.providerNavigation.workspace);
        const bounds = await evaluate(() => {
          const box = document.querySelector('[role="dialog"]').getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight };
        });
        assert.ok(bounds.left >= 0 && bounds.right <= bounds.width + 1 && bounds.top >= 0 && bounds.bottom <= bounds.height + 1, "popover fits viewport");
        await key("Escape");
        await until(() => !document.querySelector("#workspace"), "Escape closes picker");
        await until(() => document.activeElement === document.querySelector("nav button"), "Escape restores focus to workspace trigger after closing animation");
      }
      matrix.push({ language, width, height, companies: [0, 1, 2] });
    }
    checks.push(`${language}: personal-only hidden; one/two companies visible in navigation; localized labels, responsive popover and Escape/focus`);
  }
  await viewport(1280, 900);
  await open(2);
  await evaluate(() => document.querySelector("nav button").focus());
  await key("Enter");
  await until(() => document.activeElement?.id === "workspace", "keyboard opens and focuses picker");
  await set("workspace", "2");
  await until(() => document.querySelector("nav button")?.title.startsWith("Synthetic company"), "company switch completes");
  await until(() => !document.querySelector("nav button").disabled, "switch settled");
  assert.equal(await evaluate(() => document.querySelectorAll("script").length), 1, "company name renders as text");
  assert.equal(await evaluate(() => document.querySelector("main").textContent.includes("Administrator")), true, "role notice stays visible");
  await fixture.screenshot(`docs/workspace-navigation-${engine}-desktop.png`); screenshots.push(`docs/workspace-navigation-${engine}-desktop.png`);
  await openSwitcher();
  await set("workspace", "personal");
  await until(() => document.querySelector("nav button")?.title === "Personal workspace" && !document.querySelector("nav button").disabled, "personal switch completes");
  await evaluate(() => { window.phase2Fixture.result = "error"; });
  await openSwitcher(); await set("workspace", "2");
  await until(() => document.body.textContent.includes("Unable to switch workspace"), "failure reported");
  assert.equal(await evaluate(() => document.querySelector("nav button").title), "Personal workspace", "failed switch retains current context");
  await evaluate(() => { window.phase2Fixture.result = "pending"; });
  await openSwitcher(); await set("workspace", "2");
  await until(() => document.querySelector("nav button")?.disabled, "pending switch disables workspace control");
  const before = await evaluate(() => window.phase2Fixture.writes.length);
  await fixture.settle();
  await evaluate(() => document.querySelector('nav a[href="/my-services/services"]').focus());
  await key("Enter");
  assert.equal(await evaluate(() => location.pathname), "/my-services/appointments", "pending switch blocks navigation");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), before, "pending switch cannot be submitted twice");
  await evaluate(() => { window.phase2Fixture.result = "success"; window.phase2Fixture.release(); });
  await until(() => document.querySelector("nav button")?.title.startsWith("Synthetic company") && !document.querySelector("nav button").disabled, "pending switch finishes");
  await openSwitcher(); await set("workspace", "3");
  await until(() => document.querySelectorAll("nav a").length === 2 && !document.querySelector("nav button").disabled, "viewer workspace updates permissions");
  assert.equal(await evaluate(() => document.querySelector("main").textContent.includes("You can view appointments assigned to you.")), true);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes.map(row => row.companyId)), [2, null, 2, 2, 3]);
  checks.push("keyboard open/focus; company and personal switching; safe company text; role notices; failed/pending switches; duplicate/navigation protection; viewer permissions");

  await open(1, "en", "/my-services/services/new");
  await until(() => !!document.querySelector("#serviceName"), "editor loaded");
  await set("serviceName", "Synthetic unsaved draft");
  await openSwitcher(); await set("workspace", "2");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "dirty switch asks before discarding");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 0);
  await fixture.settle();
  assert.equal(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement)), true, "confirmation receives focus");
  await fixture.button(resources.en.translation.serviceForm.keepEditing);
  await until(() => !document.querySelector('[role="alertdialog"]'), "keep editing cancels switch");
  await until(() => document.activeElement === document.querySelector("nav button"), "cancelled switch restores workspace trigger focus");
  assert.equal(await evaluate(() => document.querySelector("#serviceName").value), "Synthetic unsaved draft");
  await openSwitcher(); await set("workspace", "2");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "discard confirmation reopens");
  await fixture.button(resources.en.translation.serviceForm.discard);
  await until(() => location.pathname === "/my-services/services" && document.querySelector("nav button")?.title.startsWith("Synthetic company"), "confirmed switch leaves editor");
  checks.push("dirty editor switch has no request before confirmation; Keep editing preserves draft; Discard switches once");

  await viewport(320, 700); await open(1, "ru"); await openSwitcher();
  await fixture.screenshot(`docs/workspace-navigation-${engine}-phone.png`); screenshots.push(`docs/workspace-navigation-${engine}-phone.png`);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/workspace-navigation-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-02", browser: await fixture.api("Browser.getVersion"), languages, checks, matrix, screenshots, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Isolated frontend fixture, synthetic fetch mocks, blocked external network. No connected services/database/session writes. Native-language review, physical devices and screen readers unverified." }, null, 2) + "\n");
  console.log(`Passed workspace navigation ${engine}: ${checks.length} behavior groups, ${matrix.length} en/lv/ru viewport cases with 0/1/2 companies.`);
} finally { await fixture.close(); }
