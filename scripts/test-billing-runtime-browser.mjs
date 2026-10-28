import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

// No Express startup/private environment. Real components + runtime provider, synthetic fetch.
const resources = Object.fromEntries(await Promise.all(["en", "lv", "ru"].map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const browser = await browserFixture({ entry: "scripts/fixtures/monthly-billing.tsx", resources });
const checks = [];
try {
  await browser.viewport(390, 844);
  for (const lang of ["en", "lv", "ru"]) {
    const copy = resources[lang].translation.monthlyBilling;
    await browser.visit(`/?mode=runtime-admin-page&lang=${lang}`);
    await browser.until(() => window.phase2Fixture.requests.some(r => r.path === "/api/billing/runtime"));
    await browser.button(copy.priceTitle);
    await browser.until(() => document.getElementById("billing-monthly-amount")?.value === "19.00");
    const calls = await browser.evaluate(() => window.phase2Fixture.requests);
    assert.ok(calls.findIndex(r => r.path === "/api/billing/runtime") < calls.findIndex(r => r.path === "/api/admin/billing/offer"));
    assert.ok(calls.every(r => r.method === "GET")); checks.push({ lang, flow: "server-ready Administration gate", result: "passed" });
    await browser.visit(`/?mode=runtime-settings&lang=${lang}&billing_return=1`);
    await browser.until(() => window.phase2Fixture.requests.some(r => r.path.startsWith("/api/billing/subscription?")));
    await browser.until(() => !!document.querySelector("time"));
    assert.ok((await browser.evaluate(() => document.body.innerText)).includes(copy.manualWait));
    assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.some(r => r.method !== "GET")), false);
    assert.equal(await browser.evaluate(() => !!document.querySelector('input[type="checkbox"]')), false);
    checks.push({ lang, flow: "server-ready selected workspace/manual grant/return", result: "passed" });
  }
  for (const query of ["disabled=true", "missing=true"]) {
    for (const mode of ["runtime-admin-page", "runtime-settings"]) {
      await browser.visit(`/?mode=${mode}&lang=en&${query}`);
      await browser.until(() => window.phase2Fixture.requests.some(r => r.path === "/api/billing/runtime"));
      if (mode === "runtime-admin-page") await browser.button("Monthly subscription price");
      await browser.until(() => document.body.innerText.includes("currently unavailable"));
      assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.some(r => /^\/api\/(?:billing\/(?:subscription|checkout|portal)|admin\/billing\/offer)/.test(r.path))), false);
      checks.push({ mode, state: query, privateBillingProbes: 0, result: "passed" });
    }
  }
  await browser.visit("/?mode=runtime-settings&lang=en");
  await browser.until(() => !!document.querySelector("time"));
  const before = await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.path.startsWith("/api/billing/subscription?")).length);
  await browser.evaluate(() => window.phase2Fixture.startWorkspaceSwitch());
  await browser.until(() => document.body.innerText.includes("Monthly billing is currently unavailable"));
  assert.equal(await browser.evaluate(() => !!document.querySelector("time")), false);
  await browser.evaluate(() => window.dispatchEvent(new Event("focus")));
  await browser.until(() => window.phase2Fixture.requests.filter(r => r.path === "/api/billing/runtime").length >= 2);
  assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.path.startsWith("/api/billing/subscription?")).length), before);
  await browser.evaluate(() => window.phase2Fixture.finishWorkspaceSwitch());
  await browser.until(() => !!document.querySelector("time"));
  assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.path.startsWith("/api/billing/subscription?")).length), before + 1);
  checks.push({ flow: "pending workspace switch suspends private billing and refreshes on completion", result: "passed" });
  assert.deepEqual(await browser.evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.blocked, []); assert.deepEqual(browser.network, []);
  await writeFile("docs/monthly-subscription-runtime-chrome-evidence.json", JSON.stringify({ date: "2026-10-26", browser: await browser.api("Browser.getVersion"), locales: ["en", "lv", "ru"], checks, errors: browser.errors, externalRequests: browser.blocked, serverWrites: browser.network }, null, 2) + "\n");
  console.log(`${checks.length} runtime bootstrap integration checks passed; en/lv/ru, mocked APIs only.`);
} finally { await browser.close(); }
