import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

const root = path.resolve(import.meta.dirname, ".."), resources = {};
const languages = ["en", "lv", "ru"];
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/team-member-update.tsx", resources });
const { visit, until, click, set, evaluate, button, settle } = fixture;
const checks = [];
try {
  for (const language of languages) {
    await fixture.viewport(1280); await visit(`/?lang=${language}&scenario=santa`);
    await until(() => !!document.getElementById("team-roster"), "roster fetched");
    // Expand these controls before measuring: closed <details> descendants may
    // have layout rectangles despite deferred rendering in browser engines.
    await click("summary");
    await evaluate(() => document.getElementById("team-invite").focus());
    const light = await measureFormContrast(fixture, ".team-management"); assert.deepEqual(light.failures, []);
    await evaluate(() => document.documentElement.classList.add("dark")); await settle();
    const dark = await measureFormContrast(fixture, ".team-management"); assert.deepEqual(dark.failures, []);
    await click("#edit-member-member"); await settle(); await set("member-role-member", "admin");
    await evaluate(() => { window.teamUpdateFixture.errorGet = true; });
    await button(resources[language].translation.operationsForm.saveAccess);
    await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "saved mutation but failed GET");
    assert.ok(await evaluate(() => document.getElementById("save-member-member").disabled));
    const count = await evaluate(() => window.teamUpdateFixture.calls.filter(call => call.method !== "GET").length);
    await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
    assert.equal(await evaluate(() => window.teamUpdateFixture.calls.filter(call => call.method !== "GET").length), count, "no repeat write after failed refresh");
    await evaluate(() => { window.teamUpdateFixture.errorGet = false; }); await button(resources[language].translation.teamManagement.retry);
    await until(() => !document.querySelector('[role="dialog"] [role="alert"]'), "in-panel retry clears stale failure");
    assert.equal(await evaluate(() => document.getElementById("member-role-member").value), "admin");
    await button(resources[language].translation.teamManagement.cancel); await settle();
    checks.push({ language, light, dark, recovery: "save confirmed, failed GET blocks additional writes, in-panel retry recovers authoritative data and clears error" });
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.network, []);
  const evidence = { browser: await fixture.api("Browser.getVersion"), checks, externalRequests: 0 };
  await writeFile(path.join(root, `docs/team-management-${process.env.FORMS_BROWSER || "chrome"}-recovery-evidence.json`), JSON.stringify(evidence, null, 2) + "\n");
  console.log(`${process.env.FORMS_BROWSER || "chrome"}: en/lv/ru roster and expanded owner-control contrast light/dark + in-panel recovery passed`);
} finally { await fixture.close(); }
