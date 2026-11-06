import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/service-form.tsx", resources });
const { evaluate, until, visit, set, button, click, viewport, screenshot } = fixture;
const value = id => evaluate(id => document.getElementById(id)?.value, id);
const checks = [], screenshots = [];
async function newService(lang, extra = "workspaceCurrency=EUR") {
  await visit(`/my-services/services/new?mode=new&lang=${lang}&${extra}`);
  await until(() => !!document.querySelector('#service-address option[value="6"]'), "service editor");
}
async function reflow() {
  const state = await evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("main *, nav *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(e => ({ tag: e.tagName, id: e.id, class: e.className, text: e.textContent.slice(0, 70), right: e.getBoundingClientRect().right })) }));
  assert.ok(state.scroll <= state.width + 1, "page reflow: " + JSON.stringify(state));
}
async function waitText(text, present = true) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await evaluate(({ text, present }) => document.body.textContent.includes(text) === present, { text, present })) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw Error("Text state not reached: " + text);
}
async function capture(name) { const file = `docs/currency-defaults-${engine}-${name}.png`; await screenshot(file); screenshots.push(file); }
try {
  for (const lang of languages) {
    const t = resources[lang].translation;
    await viewport(360, 800); await newService(lang);
    await until(() => document.getElementById("service-currency")?.value === "EUR", "workspace prefill before address");
    assert.ok((await evaluate(() => document.querySelector('[data-testid="currency-default-source"]').textContent)).includes(t.currency.defaultSource_workspace.replace("{{currency}}", "EUR")));
    await set("service-address", "4"); assert.equal(await value("service-currency"), "EUR", "workspace intent beats inferred country");
    assert.ok((await evaluate(() => document.body.textContent)).includes(t.currency.suggestLocal.replace("{{currency}}", "GBP")));
    await set("service-address", "6"); assert.equal(await value("service-currency"), "CAD", "explicit location override wins");
    await set("price", "12.50"); await set("service-address", "4");
    assert.equal(await value("service-currency"), "CAD", "entered amount locks its currency");
    await evaluate(() => { window.serviceFormFixture.pricing.defaultCurrency = "JPY"; void window.serviceFormFixture.refreshPricing(); });
    await until(() => window.serviceFormFixture.pricingReads >= 2, "updated preference loaded");
    assert.equal(await value("service-currency"), "CAD", "late preference cannot relabel entered amount");
    await set("price", ""); assert.equal(await value("service-currency"), "JPY", "cleared amount restores automatic choice");
    await set("service-currency", "KWD"); await set("price", "1.005"); await set("service-address", "3");
    assert.equal(await value("service-currency"), "KWD");
    await reflow(); await capture(`${lang}-service-360`);
    await evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow();
    await viewport(1280, 900); await reflow();
    checks.push(`${lang}: workspace prefill/source, inferred-country suggestion, explicit location, amount locking, preference refresh, manual selection and enlarged-text reflow`);

    await newService(lang, "businessCountry=GB");
    await until(() => document.getElementById("service-currency")?.value === "GBP");
    await set("service-address", "3"); assert.equal(await value("service-currency"), "EUR");
    await set("service-address", "5"); assert.equal(await value("service-currency"), "GBP");
    await newService(lang, "pricingResult=error");
    await waitText(t.currency.defaultsLoadError);
    assert.equal(await value("service-currency"), ""); await set("service-currency", "USD");
    assert.equal(await value("service-currency"), "USD", "manual choice works on settings outage");

    await newService(lang, "pricingResult=pending"); await set("service-currency", "JPY"); await set("price", "1");
    await evaluate(() => { const f = window.serviceFormFixture; f.pricing.defaultCurrency = "EUR"; f.pricingResult = "success"; f.resolvePricing(); });
    await waitText(t.currency.defaultsLoading, false);
    assert.equal(await value("service-currency"), "JPY");
    await newService(lang, "pricingResult=pending"); await set("serviceName", "Private personal draft"); await set("service-currency", "JPY");
    await evaluate(() => { const f = window.serviceFormFixture; window.oldPricingResolve = f.resolvePricing; f.pricingResult = "success"; f.setWorkspace(7); });
    await until(() => document.getElementById("service-currency")?.value === "GBP", "company scope prefill");
    assert.equal(await value("serviceName"), "", "workspace switch clears old draft");
    await evaluate(() => window.oldPricingResolve());
    assert.equal(await value("service-currency"), "GBP", "late personal response cannot populate company");
    await set("serviceName", "Private company draft");
    await evaluate(() => window.serviceFormFixture.setActor("synthetic-second-provider"));
    await until(() => document.getElementById("service-currency")?.value === "GBP" && document.getElementById("serviceName")?.value === "", "account switch within same company clears old draft");
    checks.push(`${lang}: country fallback, settings-error manual recovery, late default and cross-workspace isolation`);

    await visit(`/my-services/services/7/edit?lang=${lang}&currency=USD&workspaceCurrency=GBP`);
    await until(() => document.getElementById("service-currency")?.value === "USD");
    await button(t.currency.useSuggested.replace("{{currency}}", "EUR"));
    assert.equal(await value("service-currency"), "EUR"); await click('a[href="/away"]');
    await until(() => !!document.querySelector('[role="alertdialog"]'), "local suggestion participates in unsaved-change guard");
    await button(t.serviceForm.keepEditing);
    assert.equal(await value("service-currency"), "EUR");

    await visit(`/account?mode=pricing&lang=${lang}&workspaceCurrency=EUR&businessCountry=LV`);
    await until(() => !!document.getElementById("pricing-default-currency"), "pricing panel");
    await set("pricing-default-currency", "USD"); await set("pricing-business-country", "GB");
    assert.equal(await value("pricing-default-currency"), "USD");
    await evaluate(() => { window.serviceFormFixture.pricingResult = "error"; }); await button(t.pricingSettings.save);
    await waitText(t.pricingSettings.saveError);
    assert.equal(await value("pricing-default-currency"), "USD");
    await evaluate(() => { window.serviceFormFixture.pricingResult = "conflict"; }); await button(t.pricingSettings.save);
    await waitText(t.pricingSettings.conflict);
    assert.equal(await value("pricing-default-currency"), "USD");
    await evaluate(() => { const f = window.serviceFormFixture; f.pricingResult = "success"; f.pricing.defaultCurrency = "GBP"; f.pricing.revision = 5; });
    await button(t.pricingSettings.reload); await until(() => document.getElementById("pricing-default-currency")?.value === "GBP");
    await set("pricing-default-currency", "CAD"); await button(t.pricingSettings.save);
    await waitText(t.pricingSettings.saved);
    assert.deepEqual(await evaluate(() => { const p = window.serviceFormFixture.writes.at(-1); return [p.defaultCurrency, p.businessCountryCode, p.expectedWorkspace, p.expectedRevision]; }), ["CAD", "LV", { kind: "user", id: "synthetic-provider" }, 5]);
    await viewport(360, 800); await reflow(); await capture(`${lang}-settings-360`);
    await evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow();
    await viewport(1280, 900); await reflow();
    checks.push(`${lang}: saved-service protection/dirty guard, settings failed-save/CAS retention, explicit reload and scoped revision save with keyboard-sized controls/reflow`);
  }
  await visit("/account?mode=pricing&workspaceCurrency=EUR&readOnly");
  await until(() => !!document.getElementById("pricing-default-currency"));
  assert.ok(await evaluate(() => document.getElementById("pricing-default-currency").matches(":disabled")));
  assert.ok(!await evaluate(() => !!document.querySelector('#workspace-pricing-settings-form button[type="submit"]')));
  checks.push("read-only settings remain non-editable");
  assert.deepEqual(await evaluate(() => window.serviceFormFixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`docs/currency-defaults-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-06", browser: await fixture.api("Browser.getVersion"), languages, checks, screenshots, deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], boundaries: "Synthetic data and in-memory API mocks; isolated loopback fixtures; no connected database/services or credentials" }, null, 2) + "\n");
  console.log(`PASS: ${engine} workspace defaults browser, ${checks.length} groups in en/lv/ru.`);
} finally { await fixture.close(); }
