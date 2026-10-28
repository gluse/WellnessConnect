import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

// Same isolated GET-only harness; all fetch/session/API boundaries in fixture are synthetic.
const resources = Object.fromEntries(await Promise.all(["en", "lv", "ru"].map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const engine = process.env.FORMS_BROWSER || "chrome", nativeZoom = process.env.BILLING_NATIVE_ZOOM === "4";
const browser = await browserFixture({ entry: "scripts/fixtures/monthly-billing.tsx", resources, ...(nativeZoom ? { nativeZoom: 4 } : {}) });
const evidence = { date: "2026-10-26", browser: await browser.api("Browser.getVersion"), locales: ["en", "lv", "ru"], checks: [], screenshots: [] };
try {
  for (const lang of ["en", "lv", "ru"]) for (const width of nativeZoom ? [320] : [320, 1280]) {
    if (!nativeZoom) await browser.viewport(width, 900);
    await browser.visit(`/?mode=admin&lang=${lang}${lang === "ru" ? "&dark=true" : ""}`);
    await browser.until(() => document.getElementById("billing-monthly-amount")?.value === "19.00");
    const copy = resources[lang].translation.monthlyBilling;
    const metrics = await browser.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, innerWidth, outerWidth, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom, scale: visualViewport.scale,
      clipped: [...document.querySelectorAll("input,button")].some(el => { const b = el.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth + 1; }) }));
    assert.equal(metrics.overflow, false); assert.equal(metrics.clipped, false);
    if (nativeZoom) { assert.equal(metrics.outerWidth, 1280); assert.ok(metrics.innerWidth >= 300 && metrics.innerWidth <= 320); assert.equal(metrics.dpr, 4); assert.equal(Number(metrics.cssZoom), 1); assert.equal(metrics.scale, 1); }
    const contrast = await measureFormContrast(browser, ".billing-price"); assert.deepEqual(contrast.failures, []);
    assert.ok((await browser.evaluate(() => document.body.innerText)).includes(copy.priceScope));
    const file = `docs/monthly-subscription-price-${engine}-${lang}${nativeZoom ? "-zoom400" : width === 320 ? "-phone" : "-desktop"}.png`;
    await browser.screenshot(file, !nativeZoom); evidence.screenshots.push(file);
    if (!nativeZoom && width === 320) {
      await browser.set("billing-monthly-amount", "1e3"); await browser.button(copy.priceSave);
      await browser.until(() => document.getElementById("billing-monthly-amount")?.getAttribute("aria-invalid") === "true");
      assert.equal(await browser.evaluate(() => document.activeElement.id), "billing-monthly-amount");
      assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.method === "PUT").length), 0);
      await browser.click("#billing-monthly-amount"); await browser.set("billing-monthly-amount", "20,05"); await browser.key("Tab");
      assert.equal(await browser.evaluate(() => document.activeElement.textContent), copy.priceSave);
      await browser.key("Enter");
      await browser.until(() => document.getElementById("billing-monthly-amount")?.value === "20.05");
      assert.deepEqual(await browser.evaluate(() => window.phase2Fixture.requests.find(r => r.method === "PUT").body), { amount: "20.05", expectedRevision: "1" });
      assert.ok((await browser.evaluate(() => document.body.innerText)).includes(copy.priceSaved));
      await browser.evaluate(() => { window.phase2Fixture.priceResult = "conflict"; });
      await browser.set("billing-monthly-amount", "22.00"); await browser.button(copy.priceSave);
      await browser.until(() => !!document.querySelector('[role="alert"]'));
      assert.equal(await browser.evaluate(() => document.getElementById("billing-monthly-amount").value), "22.00");
      assert.equal(await browser.evaluate(copy => [...document.querySelectorAll("button")].find(b => b.textContent === copy.priceSave).disabled, copy), true);
      assert.ok((await browser.evaluate(() => document.body.innerText)).includes(copy.price_conflict));
      await browser.button(copy.priceReload); await browser.until(() => document.getElementById("billing-monthly-amount")?.value === "20.05");
    }
    assert.deepEqual(await browser.evaluate(() => window.phase2Fixture.unexpected), []);
    evidence.checks.push({ lang, width, nativeZoom, metrics, contrast: contrast.minText, result: "passed", ...(width === 320 && !nativeZoom ? { exactDecimalKeyboardSaveConflictReload: "passed" } : {}) });
  }
  if (!nativeZoom) {
    await browser.viewport(320, 900);
    await browser.visit("/?mode=admin-page&lang=en");
    await browser.until(() => [...document.querySelectorAll("button")].some(button => button.textContent === "Monthly subscription price"));
    await browser.button("Monthly subscription price");
    await browser.until(() => document.getElementById("billing-monthly-amount")?.value === "19.00");
    assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.path === "/api/admin/billing/offer").length), 1);
    evidence.checks.push({ mode: "actual Administration page", result: "passed" });
    for (const query of ["mode=admin-page&denied=true", "mode=admin&unavailable=true"]) {
      await browser.visit("/?lang=en&" + query);
      await browser.until(() => document.body.innerText.includes("required") || document.body.innerText.includes("currently unavailable"));
      assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.path === "/api/admin/billing/offer").length), 0);
      evidence.checks.push({ mode: query, result: "passed" });
    }
    await browser.visit("/?mode=settings&lang=en&billing_return=1");
    await browser.until(() => document.body.innerText.includes("after your manual Pro access expires"));
    assert.match(await browser.evaluate(() => document.body.innerText), /access will update after confirmation/);
    assert.equal(await browser.evaluate(() => window.phase2Fixture.requests.filter(r => r.method === "POST" || r.method === "PUT").length), 0);
    assert.equal(await browser.evaluate(() => !!document.querySelector('input[type="checkbox"]')), false);
    evidence.checks.push({ mode: "actual provider settings return/manual-wait", result: "passed" });
  }
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.blocked, []); assert.deepEqual(browser.network, []);
  await writeFile(`docs/monthly-subscription-price-${engine}${nativeZoom ? "-zoom400" : ""}-evidence.json`, JSON.stringify({ ...evidence, errors: browser.errors, externalRequests: browser.blocked, serverWrites: browser.network }, null, 2) + "\n");
  console.log(`${engine}${nativeZoom ? " 400% zoom" : ""}: ${evidence.checks.length} changed-scope price/settings browser checks passed (en/lv/ru).`);
} finally { await browser.close(); }
