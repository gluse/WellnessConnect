import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const root = path.resolve(import.meta.dirname, ".."), resources = {};
const languages = ["en", "lv", "ru"];
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/team-member-update.tsx", resources, nativeZoom: 4 });
const { api, visit, until, evaluate, click, button, key, settle, screenshot } = fixture;
const checks = [];
try {
  await api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  for (const language of languages) {
    const ui = resources[language].translation.teamManagement;
    await visit(`/?lang=${language}&scenario=santa`);
    await until(() => !!document.getElementById("team-roster"), "roster ready");
    const size = await evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(size.width <= 330 && size.height < 300, "native 400% zoom remains active");
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "zoom roster reflow");
    await click("#edit-member-member"); await settle();
    assert.equal(await evaluate(() => document.activeElement.id), "member-role-member");
    assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)));
    await screenshot(`docs/team-management-chrome-zoom400-${language}-edit.png`, false);
    await evaluate(() => document.getElementById("save-member-member").focus());
    assert.ok(await evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1; }), "save button visible on focus");
    await screenshot(`docs/team-management-chrome-zoom400-${language}-footer.png`, false);
    for (let i = 0; i < 9; i++) { await key("Tab"); assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))); }
    await button(ui.cancel); await settle();
    await click("#team-invite"); await settle();
    assert.equal(await evaluate(() => document.activeElement.id), "team-email");
    await screenshot(`docs/team-management-chrome-zoom400-${language}-invite.png`, false);
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await button(ui.cancel); await settle();
    checks.push({ language, ...size, nativeZoom: "400%", checks: "roster/edit/invite reflow, footer focus/reachability, modal focus, reduced motion" });
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  const evidence = { browser: await api("Browser.getVersion"), checks, localesDeferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], externalRequests: 0 };
  await writeFile(path.join(root, "docs/team-management-chrome-zoom400-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally { await fixture.close(); }
