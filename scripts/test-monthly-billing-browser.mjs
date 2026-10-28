import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

// Inspected harness compiles only this isolated entry/CSS, serves GET-only assets,
// blocks external requests, and starts no Express/session/database/environment loader.
const resources = Object.fromEntries(await Promise.all(["en", "lv", "ru"].map(async language => [language, { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) }])));
const engine = process.env.FORMS_BROWSER || "chrome", nativeZoom = process.env.BILLING_NATIVE_ZOOM === "4";
const browser = await browserFixture({ entry: "scripts/fixtures/monthly-billing.tsx", resources, ...(nativeZoom ? { nativeZoom: 4 } : {}) });
const evidence = { browser: await browser.api("Browser.getVersion"), locales: ["en", "lv", "ru"], checks: [], screenshots: [], network: [], blocked: [], errors: [] };
try {
  for (const language of ["en", "lv", "ru"]) {
    const copy = resources[language].translation.monthlyBilling;
    for (const width of nativeZoom ? [320] : [320, 768, 1280]) {
      if (!nativeZoom) await browser.viewport(width, width === 320 ? 760 : 900);
      await browser.visit(`/?lang=${language}${language === "ru" ? "&dark=true" : ""}`);
      await browser.until(() => !!document.querySelector('input[type="checkbox"]'), "monthly offer visible");
      const layout = await browser.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        raw: document.body.innerText.includes("monthlyBilling."),
        lang: document.documentElement.lang,
        viewport: { outerWidth, innerWidth, dpr: devicePixelRatio, scale: visualViewport.scale, cssZoom: getComputedStyle(document.documentElement).zoom },
        buttons: [...document.querySelectorAll("button")].map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
      }));
      assert.equal(layout.overflow, false, `${engine} ${language} ${width} reflow`); assert.equal(layout.raw, false); assert.equal(layout.lang, language);
      if (nativeZoom) {
        assert.equal(layout.viewport.outerWidth, 1280);
        assert.ok(layout.viewport.innerWidth >= 300 && layout.viewport.innerWidth <= 320);
        assert.equal(layout.viewport.dpr, 4); assert.equal(layout.viewport.scale, 1); assert.equal(Number(layout.viewport.cssZoom), 1);
      }
      assert.ok(layout.buttons.every(box => box.height >= 44 && box.width >= 24));
      const contrast = await measureFormContrast(browser, ".monthly-billing"); assert.deepEqual(contrast.failures, []);
      assert.match(await browser.evaluate(() => document.body.innerText), new RegExp(copy.title));
      if ((language === "en" && width === 1280) || (language === "lv" && width === 320) || (language === "ru" && width === 768) || nativeZoom) {
        const file = `docs/monthly-subscription-${engine}-${language}${nativeZoom ? "-zoom400" : ""}.png`;
        await browser.screenshot(file, !nativeZoom); evidence.screenshots.push(file);
      }
      if (width === 320 && !nativeZoom) {
        await browser.click('input[type="checkbox"]');
        await browser.key("Tab");
        assert.equal(await browser.evaluate(() => document.activeElement?.textContent), copy.checkout, "keyboard reaches checkout");
        await browser.key("Enter");
        await browser.until(() => !!document.querySelector('[role="alert"]'), "ambiguous result announced");
        assert.equal(await browser.evaluate(() => window.phase2Fixture.checkouts.length), 1);
        assert.equal(await browser.evaluate(() => document.querySelector('input[type="checkbox"]')), null);
        await browser.button(copy.refresh);
        await browser.until(() => window.phase2Fixture.reads === 2 && document.querySelector('[aria-busy]')?.getAttribute("aria-busy") === "false");
        assert.equal(await browser.evaluate(() => !!document.querySelector('input[type="checkbox"]')), false, "unknown reservation blocks a second checkout");
        assert.equal(await browser.evaluate(() => window.phase2Fixture.navigations.length), 0);
      }
      evidence.checks.push({ language, width, nativeZoom, viewport: layout.viewport, contrast: contrast.minText, reflow: "passed", ...(width === 320 && !nativeZoom ? { keyboardCheckoutUnknownRecovery: "passed" } : {}) });
    }
  }
  if (!nativeZoom) {
    await browser.viewport(320, 760);
    for (const mode of ["cancel", "failed", "expired", "denied", "unavailable"]) {
      await browser.visit(`/?lang=en&mode=${mode}`);
      await browser.until(() => document.body.innerText.includes("Pro subscription"));
      if (mode === "failed") {
        await browser.until(() => document.body.innerText.includes("Resolve payment")); await browser.button("Resolve payment");
        await browser.until(() => window.phase2Fixture.navigations.length === 1); assert.equal(await browser.evaluate(() => window.phase2Fixture.portals), 1);
      } else if (mode === "cancel") await browser.until(() => document.body.innerText.includes("Cancellation at period end is confirmed"));
      else if (mode === "expired") await browser.until(() => document.body.innerText.includes("Pro access is currently inactive"));
      else if (mode === "denied") await browser.until(() => !!document.querySelector('[role="alert"]'));
      else assert.equal(await browser.evaluate(() => window.phase2Fixture.reads), 0);
      assert.equal(await browser.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(await browser.evaluate(() => window.phase2Fixture.unexpected), []);
      evidence.checks.push({ mode, width: 320, result: "passed" });
    }
    await browser.visit("/?lang=en&returned=true");
    await browser.until(() => !!document.querySelector('input[type="checkbox"]'));
    assert.equal(await browser.evaluate(() => window.phase2Fixture.checkouts.length), 0);
    assert.match(await browser.evaluate(() => document.body.innerText), /access will update after confirmation/);
  }
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.blocked, []); assert.deepEqual(browser.network, []);
  evidence.network = browser.network; evidence.blocked = browser.blocked; evidence.errors = browser.errors;
  await writeFile(`docs/monthly-subscription-${engine}${nativeZoom ? "-zoom400" : ""}-evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  console.log(`${engine}${nativeZoom ? " native 400% zoom" : ""}: ${evidence.checks.length} checks passed; en/lv/ru only; no connected operations.`);
} finally { await browser.close(); }
