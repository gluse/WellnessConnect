import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
import { formatMoney } from "../client/src/lib/money.ts";
const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) }])));
for (const language of languages) for (const [key, value] of Object.entries(resources.en.translation.currency)) {
  const translated = resources[language].translation.currency[key];
  assert.ok(translated?.trim(), language + ":" + key);
  assert.deepEqual(translated.match(/{{\w+}}/g)?.sort(), value.match(/{{\w+}}/g)?.sort());
}
const checks = [], screenshots = [];
async function reflow(fixture) { assert.ok(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "page reflow"); }
const forms = await browserFixture({ entry: "scripts/fixtures/service-form.tsx", resources });
try {
  for (const language of languages) {
    const t = resources[language].translation;
    await forms.viewport(360, 800); await forms.visit(`/my-services/services/new?mode=new&lang=${language}`);
    await forms.until(() => !!document.querySelector('#service-address option[value="4"]'), "addresses");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "");
    await forms.set("service-address", "4");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "GBP");
    await forms.set("service-address", "3");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "EUR", "untouched suggestion follows final address");
    await forms.set("service-address", "5");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "", "unknown address clears untouched suggestion");
    await forms.set("service-currency", "CAD"); await forms.set("service-address", "3");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "CAD", "address cannot overwrite explicit currency");
    await forms.visit(`/my-services/services/new?mode=new&lang=${language}`);
    await forms.until(() => !!document.querySelector('#service-address option[value="5"]'));
    await forms.set("service-address", "5");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "", "unknown country requires choice");
    await forms.visit(`/my-services/services/7/edit?lang=${language}`);
    await forms.until(() => document.getElementById("service-currency")?.value === "EUR");
    await forms.set("service-address", "4");
    assert.equal(await forms.evaluate(() => document.getElementById("service-currency").value), "EUR", "saved currency survives address change");
    await forms.set("fixture-result", "error");
    await forms.set("price", language === "en" ? "50.25" : "50,25");
    await forms.click('[data-testid="button-save-service"]');
    await forms.until(() => window.serviceFormFixture.writes.length === 1 && !document.querySelector('form[aria-busy="true"]'), "rejected save");
    assert.deepEqual(await forms.evaluate(() => { const p = window.serviceFormFixture.writes[0]; return [p.price, p.currency]; }), ["50.25", "EUR"]);
    assert.equal(await forms.evaluate(() => document.getElementById("price").value), language === "en" ? "50.25" : "50,25", "draft retained");
    await forms.set("service-currency", "KWD"); await forms.set("price", "1.0001");
    await forms.click('[data-testid="button-save-service"]');
    assert.equal(await forms.evaluate(() => window.serviceFormFixture.writes.length), 1);
    assert.equal(await forms.evaluate(() => document.getElementById("price").getAttribute("aria-invalid")), "true");
    await forms.set("price", "1.005"); await forms.click('[data-testid="button-save-service"]');
    await forms.until(() => !!document.querySelector('[role="alertdialog"][data-state="open"]'));
    assert.equal(await forms.evaluate(() => window.serviceFormFixture.writes.length), 1, "currency change waits for amount review");
    await forms.button(t.serviceForm.keepEditing); await forms.until(() => !document.querySelector('[role="alertdialog"]'));
    await forms.until(() => document.activeElement.id === "service-currency", "cancel restores currency focus");
    await forms.click('[data-testid="button-save-service"]'); await forms.button(t.currency.confirmChange);
    await forms.until(() => window.serviceFormFixture.writes.length === 2 && !document.querySelector('form[aria-busy="true"]'));
    assert.deepEqual(await forms.evaluate(() => { const p = window.serviceFormFixture.writes[1]; return [p.price, p.currency]; }), ["1.005", "KWD"]);
    const formImage = `docs/currency-${engine}-${language}-form.png`; await forms.screenshot(formImage); screenshots.push(formImage);
    await reflow(forms);
    await forms.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow(forms);
    await forms.viewport(1280, 900); await reflow(forms);
    checks.push(language + ": country suggestion/manual override/unknown, immutable saved currency, localized input, precision, failed save retention, currency-change review/focus and 200% reflow");
  }
  assert.deepEqual(await forms.evaluate(() => window.serviceFormFixture.unexpected), []);
  assert.deepEqual(forms.errors, []); assert.deepEqual(forms.network, []);
} finally { await forms.close(); }

const bookings = await browserFixture({ entry: "scripts/fixtures/forms-phase2.tsx", resources });
try {
  async function open(language, extra = "") {
    await bookings.visit(`/?mode=booking&lang=${language}${extra}`); await bookings.click("#open-booking button");
    await bookings.until(() => !!document.querySelector('button[name="day"]:not([disabled])'));
    await bookings.click('button[name="day"]:not([disabled])');
    await bookings.until(() => !!document.querySelector('button[aria-pressed="false"]'));
    await bookings.click('button[aria-pressed="false"]');
  }
  for (const language of languages) {
    const t = resources[language].translation;
    await bookings.viewport(360, 800); await open(language);
    await bookings.button(t.bookingForm.continue); await bookings.until(() => !!document.getElementById("booking-participants"));
    await bookings.set("booking-participants", "2"); await bookings.set("booking-initial-message", "Synthetic note");
    assert.ok((await bookings.evaluate(() => document.querySelector('[role="dialog"]').textContent)).includes(formatMoney("50.00", "EUR", language)));
    await bookings.evaluate(() => { window.phase2Fixture.bookingResult = "priceChanged"; }); await bookings.button(t.bookingForm.requestBooking);
    await bookings.until(() => !document.getElementById("booking-initial-message") && document.querySelector('[role="alert"]')?.textContent.length > 0, "price review resets confirmation");
    assert.ok((await bookings.evaluate(() => document.querySelector('[role="dialog"]').textContent)).includes(t.currency.priceChanged));
    assert.ok((await bookings.evaluate(() => document.querySelector('[role="dialog"]').textContent)).includes(formatMoney("35.00", "GBP", language)));
    assert.equal(await bookings.evaluate(() => window.phase2Fixture.writes.filter(w => w.path === "/api/bookings").length), 1, "no automatic retry");
    await bookings.button(t.bookingForm.continue); await bookings.until(() => !!document.getElementById("booking-participants"));
    assert.equal(await bookings.evaluate(() => document.getElementById("booking-initial-message").value), "Synthetic note");
    assert.ok((await bookings.evaluate(() => document.querySelector('[role="dialog"] dl:last-of-type').textContent)).includes(formatMoney("0.00", "GBP", language)), "updated 100% advance leaves zero balance");
    const bookingImage = `docs/currency-${engine}-${language}-booking.png`; await bookings.screenshot(bookingImage); screenshots.push(bookingImage);
    await bookings.evaluate(() => { window.phase2Fixture.bookingResult = "success"; }); await bookings.button(t.bookingForm.requestBooking);
    await bookings.until(() => document.querySelector('[role="status"]')?.textContent.length > 0 && !document.getElementById("booking-initial-message"), "booking accepted");
    assert.deepEqual(await bookings.evaluate(() => { const p = window.phase2Fixture.writes.filter(w => w.path === "/api/bookings").at(-1).body; return [p.expectedPrice, p.expectedCurrency, p.participantCount, p.expectedAdvancePaymentPercent]; }), ["35.00", "GBP", 2, 100]);
    await reflow(bookings);
    for (const [currency, price] of [["JPY", "1"], ["KWD", "0.001"]]) {
      await open(language, `&currency=${currency}&price=${price}`); await bookings.button(t.bookingForm.continue);
      await bookings.until(() => !!document.getElementById("booking-participants"));
      assert.ok((await bookings.evaluate(() => document.querySelector('[role="dialog"]').textContent)).includes(formatMoney(price, currency, language)));
    }
    await open(language, "&unknownCurrency");
    assert.ok((await bookings.evaluate(() => document.querySelector('[role="dialog"]').textContent)).includes(t.currency.unavailable));
    assert.ok(await bookings.evaluate(label => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === label)?.disabled, t.bookingForm.continue));
    checks.push(language + ": exact booking quote, price-change re-review/no retry, message retention, new quote payload, zero/three-decimal currencies and unknown-currency block");
  }
  await bookings.visit("/account?lang=en"); await bookings.until(() => !!document.getElementById("account-name"), "account loaded"); await bookings.button(resources.en.translation.addressForm.add);
  await bookings.set("address-country", "LV"); await bookings.set("address", "Synthetic street address");
  await bookings.click("details summary"); await bookings.set("latitude", "0"); await bookings.set("longitude", "0");
  await bookings.button(resources.en.translation.addressForm.save);
  await bookings.until(() => window.phase2Fixture.writes.some(w => w.path === "/api/addresses"));
  assert.equal(await bookings.evaluate(() => window.phase2Fixture.writes.find(w => w.path === "/api/addresses").body.countryCode), "LV");
  checks.push("address country saved with manual location, no geocoding required");
  assert.deepEqual(await bookings.evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(bookings.errors, []); assert.deepEqual(bookings.network, []);
} finally { await bookings.close(); }

const preview = await browserFixture({ entry: "scripts/fixtures/currency-preview.tsx", resources });
try {
  for (const language of languages) for (const width of [360, 1280]) {
    await preview.viewport(width, 800); await preview.visit(`/?lang=${language}`); await reflow(preview);
    for (const [currency, amount] of [["EUR", "50.25"], ["USD", "50.25"], ["CAD", "50.25"], ["GBP", "50.25"], ["JPY", "50"], ["KWD", "50.001"]])
      assert.ok((await preview.evaluate(code => document.querySelector(`[data-currency="${code}"]`).textContent, currency)).includes(formatMoney(amount, currency, language)));
    const summary = await preview.evaluate(() => document.querySelector('[data-testid="appointment-summary"]').textContent);
    assert.ok(summary.includes(formatMoney("0.30", "EUR", language))); assert.ok(summary.includes(formatMoney("25.00", "USD", language)));
    assert.ok(!summary.includes("999"));
    assert.ok(await preview.evaluate(() => document.querySelector('#service-sort option[value="price-asc"]').disabled));
    assert.equal(await preview.evaluate(() => document.querySelector('[data-testid="large-money"]').textContent), formatMoney("9007199254740993.05", "EUR", language));
    if (width === 360) { const file = `docs/currency-${engine}-${language}-360.png`; await preview.screenshot(file); screenshots.push(file); }
    checks.push(`${language}/${width}: exact code displays, mixed totals, disabled price sort and reflow`);
  }
  assert.deepEqual(preview.errors, []); assert.deepEqual(preview.network, []);
} finally { await preview.close(); }
await writeFile(`docs/currency-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-05", engine, languages, checks, screenshots, deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], boundaries: "Synthetic data, in-memory fetch mocks, isolated loopback static fixtures; no connected APIs/database" }, null, 2) + "\n");
console.log(`PASS: ${engine} currency browser (${checks.length} behavior/viewport groups), en/lv/ru only.`);
