import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture } from "./fixtures/browser-harness.mjs";
import { languages, deferredLanguages, verificationDate, evidencePrefix } from "./fixtures/forms-verification-scope.mjs";

assert.ok(["firefox", "webkit"].includes(process.env.FORMS_BROWSER), "Choose Firefox or WebKit");
const root = path.resolve(import.meta.dirname, ".."), resources = {}, checks = [], matrix = [], screenshots = [];
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/service-form.tsx", resources });
const { evaluate, until, set, click, button, key, viewport } = fixture;
const value = id => evaluate(id => document.getElementById(id)?.value, id);
const writes = () => evaluate(() => window.serviceFormFixture.writes);
const open = (mode = "inactive", language = "en") => fixture.visit("/my-services/services/7/edit?mode=" + mode + "&lang=" + language);
const prefix = evidencePrefix("service");
try {
  await viewport(1280); await open("new");
  await click('[data-testid="button-save-inactive-service"]');
  await until(() => document.querySelector('[role="alert"]')?.contains(document.activeElement), "error summary focus");
  assert.equal((await writes()).length, 0);
  assert.equal(await evaluate(() => document.getElementById("serviceName").getAttribute("aria-invalid")), "true");
  assert.ok(await evaluate(() => document.getElementById("serviceName").getAttribute("aria-describedby").includes("serviceName-error")));
  checks.push("invalid save makes no write; linked errors and focused summary");

  await open(); await set("serviceName", "Synthetic edited service"); await set("fixture-result", "error");
  await click('[data-testid="button-save-inactive-service"]');
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "save rejection");
  assert.equal(await value("serviceName"), "Synthetic edited service"); assert.equal(await evaluate(() => document.querySelectorAll('[role="alert"] img').length), 0);
  await set("fixture-result", "pending"); await click('[data-testid="button-save-inactive-service"]');
  await until(() => !!window.serviceFormFixture.pending, "pending save"); const pending = (await writes()).length;
  await evaluate(() => document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal((await writes()).length, pending); assert.ok(await evaluate(() => document.querySelector('[data-testid="button-save-inactive-service"]').disabled));
  await button("Resolve pending save"); await until(() => location.pathname === "/my-services/services", "save success");
  checks.push("rejected save retains draft and sanitizes feedback; pending guard prevents duplicate write; successful save returns to services");

  await open(); await set("serviceName", "Unsaved synthetic service"); await button("Switch workspace");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "dirty exit dialog"); await fixture.settle();
  assert.ok(await evaluate(() => !!document.getElementById(document.querySelector('[role="alertdialog"]').getAttribute("aria-labelledby"))?.textContent.trim()));
  for (let index = 0; index < 8; index++) { await key("Tab"); assert.ok(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement))); }
  await key("Escape"); await until(() => !document.querySelector('[role="alertdialog"]'), "Escape cancels exit");
  assert.equal(await value("serviceName"), "Unsaved synthetic service"); assert.equal(await evaluate(() => window.serviceFormFixture.workspaceChanges), 0);
  checks.push("named dirty-exit dialog traps keyboard focus; Escape preserves draft and workspace");

  for (const language of languages) {
    await open("inactive", language); await set("serviceName", "Synthetic retained name");
    for (const [width, height] of [[320, 900], [390, 300], [768, 900], [1280, 900]]) {
      await viewport(width, height);
      const layout = await evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, unnamed: [...document.querySelectorAll('.service-editor input,.service-editor textarea,.service-editor select')].filter(element => element.getClientRects().length && !element.closest('[aria-hidden="true"]') && !element.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")).map(element => element.id),
        clipped: [...document.querySelectorAll('main button, main input:not([type="radio"]):not([type="checkbox"]),main select')].filter(element => { const box = element.getBoundingClientRect(); return element.getClientRects().length && (box.left < -1 || box.right > innerWidth + 1); }).map(element => element.id) }));
      assert.equal(layout.overflow, false, language + " reflow"); assert.deepEqual(layout.unnamed, [], "form control labels"); assert.deepEqual(layout.clipped, [], "control bounds");
      await evaluate(() => { const input = document.getElementById("serviceName"); input.focus(); input.scrollIntoView({ block: "center" }); });
      assert.ok(await evaluate(() => { const input = document.getElementById("serviceName"), box = input.getBoundingClientRect(); return document.activeElement === input && box.bottom > 0 && box.top < innerHeight; }));
      assert.equal(await value("serviceName"), "Synthetic retained name");
      matrix.push({ language, width, height, layout });
    }
    assert.deepEqual(await evaluate(() => window.serviceFormFixture.unexpected), []);
  }
  checks.push("en/lv/ru phone/tablet/desktop and short-height reflow, control labels, reachable focus and retained drafts; short height is emulation only");
  await viewport(390, 700); const screenshot = "docs/" + prefix + "-phone.png"; await fixture.screenshot(screenshot); screenshots.push(screenshot);
  await open("denied"); assert.equal(await evaluate(() => !!document.getElementById("serviceName")), false); assert.equal((await writes()).length, 0);
  checks.push("denied permission exposes no editor or save");
  assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  await writeFile(path.join(root, "docs/" + prefix + "-evidence.json"), JSON.stringify({ date: verificationDate, browser: await fixture.api("Browser.getVersion"), languages, deferredLanguages, checks, matrix, screenshots, unexpectedRequests: fixture.network, blockedRequests: fixture.blocked, runtimeErrors: fixture.errors, limits: "Synthetic mocked APIs only. Short viewport does not verify a physical keyboard/device. Screen reader and native-speaker review remain unverified." }, null, 2) + "\n");
  console.log("Passed service: " + checks.length + " groups; " + matrix.length + " en/lv/ru viewport cases.");
} finally { await fixture.close(); }
