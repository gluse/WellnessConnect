import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { readFile } from "node:fs/promises";
import { SUPPORTED_CURRENCIES, SUPPORTED_COUNTRIES, currencyDigits, isSupportedCurrency, suggestedCurrency } from "../shared/currencies.ts";
import { amountToMinor, minorToAmount, parseMoneyAmount, normalizeMoneyAmount, calculateBookingAmounts } from "../shared/money.ts";
import { formatMoney } from "../client/src/lib/money.ts";
import AppointmentStats from "../client/src/components/provider/appointment-stats.tsx";

globalThis.React = React;
assert.equal(SUPPORTED_CURRENCIES.length, 153);
assert.equal(SUPPORTED_COUNTRIES.length, 249);
for (const [country, currency] of [["LV", "EUR"], ["GB", "GBP"], ["US", "USD"], ["CA", "CAD"], ["BG", "EUR"]]) assert.equal(suggestedCurrency(country), currency);
for (const country of [null, undefined, "", "ZZ", "lv", "US<script>", "PA", "ZW"]) assert.equal(suggestedCurrency(country), null);
assert.equal(isSupportedCurrency("BGN"), false, "Historical Bulgarian currency is excluded from new-price metadata");
for (const code of ["XXX", "XTS", "XAU", "CLF", "USD<script>", "eur"]) assert.equal(isSupportedCurrency(code), false);
for (const [code, digits] of [["EUR", 2], ["JPY", 0], ["KWD", 3], ["HUF", 2], ["AFN", 2], ["IDR", 2], ["IQD", 3]]) assert.equal(currencyDigits(code), digits, "Use ISO minor units rather than CLDR display rounding");

assert.equal(parseMoneyAmount("50", "EUR"), "50.00");
assert.equal(parseMoneyAmount("50.1", "EUR"), "50.10");
assert.equal(parseMoneyAmount("50", "JPY"), "50");
assert.equal(parseMoneyAmount("50.001", "KWD"), "50.001");
assert.equal(parseMoneyAmount("50.25", "HUF"), "50.25");
assert.equal(normalizeMoneyAmount("50.000", "EUR"), "50.00");
assert.equal(normalizeMoneyAmount("50.000", "JPY"), "50");
assert.throws(() => normalizeMoneyAmount("50.001", "EUR"));
for (const [amount, currency] of [["50.000", "EUR"], ["50.0", "JPY"], ["1.0001", "KWD"], ["100000000", "EUR"], ["99999999.991", "KWD"]]) assert.throws(() => parseMoneyAmount(amount, currency));
for (const amount of ["-1", "+1", "NaN", "Infinity", "1e2", "01", "1,00", " 1", "1 ", "", "1.", 1, null]) assert.throws(() => parseMoneyAmount(amount, "EUR"));
assert.equal(parseMoneyAmount("99999999.99", "EUR"), "99999999.99");
assert.equal(parseMoneyAmount("99999999.990", "KWD"), "99999999.990");
assert.equal(amountToMinor("0.29", "EUR"), BigInt(29));
assert.equal(minorToAmount(BigInt(1), "KWD"), "0.001");
assert.deepEqual(calculateBookingAmounts("0.10", "EUR", 3, 50), { totalAmount: "0.30", advanceAmount: "0.15", balanceAmount: "0.15" });
for (const [amount, currency, expected] of [["0.01", "EUR", "0.01"], ["0.001", "KWD", "0.001"], ["1", "JPY", "1"]]) {
  const half = calculateBookingAmounts(amount, currency, 1, 50);
  assert.equal(half.advanceAmount, expected, "Half a minor unit rounds up exactly once");
  assert.equal(amountToMinor(half.totalAmount, currency), amountToMinor(half.advanceAmount, currency) + amountToMinor(half.balanceAmount, currency));
}
for (const percent of [0, 50, 100]) {
  const amounts = calculateBookingAmounts("0.00", "EUR", 100, percent);
  assert.equal(amounts.totalAmount, "0.00");
  assert.equal(amounts.advanceAmount, "0.00");
}
assert.throws(() => calculateBookingAmounts("50000000.00", "EUR", 2, 50), "Participant totals retain old monetary bound");
for (const [participants, percent] of [[0, 50], [-1, 50], [1.5, 50], [1, 101], [1, -1], [1, 0.5]]) assert.throws(() => calculateBookingAmounts("10", "EUR", participants, percent));

for (const locale of ["en", "lv", "ru"]) {
  for (const [currency, amount, digits] of [["EUR", "50.00", 2], ["USD", "50.00", 2], ["CAD", "50.00", 2], ["GBP", "50.00", 2], ["JPY", "50", 0], ["KWD", "50.001", 3], ["HUF", "50.25", 2]]) {
    assert.equal(formatMoney(amount, currency, locale), new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount));
  }
  assert.equal(formatMoney("50.000", "EUR", locale), formatMoney("50.00", "EUR", locale));
  assert.equal(formatMoney("50.001", "EUR", locale), null);
  for (const bad of [null, undefined, "XXX", "eur"]) assert.equal(formatMoney("50.00", bad, locale), null);
}
assert.equal(formatMoney("9007199254740993.01", "EUR", "en"), "EUR\u00a09,007,199,254,740,993.01", "Formatting preserves decimal strings beyond Number precision");

const resources = {};
for (const locale of ["en", "lv", "ru"]) resources[locale] = { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8")) };
await i18next.use(initReactI18next).init({ lng: "en", resources, interpolation: { escapeValue: false } });
const text = node => typeof node === "string" || typeof node === "number" ? String(node) : (node?.children ?? []).map(text).join(" ");
for (const locale of ["en", "lv", "ru"]) {
  await i18next.changeLanguage(locale);
  let component;
  await renderer.act(async () => { component = renderer.create(React.createElement(AppointmentStats, { bookings: [
    { status: "confirmed", currency: "EUR", totalAmount: "50000000.00" },
    { status: "completed", currency: "EUR", totalAmount: "50000000.00" },
    { status: "completed", currency: "USD", totalAmount: "0.29" },
    { status: "cancelled", currency: "USD", totalAmount: "999.00" },
    { status: "pending", currency: "GBP", totalAmount: "999.00" },
  ] })); });
  const content = text(component.toJSON());
  assert.ok(content.includes(formatMoney("100000000.00", "EUR", locale)), "Aggregate can exceed the individual price maximum");
  assert.ok(content.includes(formatMoney("0.29", "USD", locale)));
  assert.equal(content.includes("GBP"), false, "Summary retains confirmed/completed inclusion policy");
  assert.equal(content.includes("$"), false);
  await renderer.act(async () => component.unmount());
}
console.log("PASS: currency metadata, strict precision, database normalization, exact booking arithmetic, en/lv/ru formatting and separate currency summaries");
