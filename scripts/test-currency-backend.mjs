import assert from "node:assert/strict";
import { bookingMoneyDto, bookingPriceSnapshot, expectedPriceSchema, MoneyInputError, PriceChangedError, serviceMoneyChanges, serviceMoneyDto } from "../server/money.ts";
import { addressInputSchema } from "../shared/schema.ts";

// Pure application contracts only: no database/auth/configuration/client imports.
let checks = 0;
const check = fn => { fn(); checks++; };
check(() => assert.deepEqual(serviceMoneyChanges({ price: "10.50", currency: "EUR" }), { price: "10.50", currency: "EUR" }));
check(() => assert.deepEqual(serviceMoneyChanges({}, { price: "10.500", currency: "EUR" }), {}));
check(() => assert.deepEqual(serviceMoneyChanges({ currency: "EUR" }, { price: "10.500", currency: "EUR" }), { price: "10.50", currency: "EUR" }));
for (const input of [{ price: "10.001", currency: "EUR" }, { price: "0.1", currency: "JPY" }, { price: "-1", currency: "EUR" }, { price: "Infinity", currency: "USD" }, { price: "10", currency: "ZZZ" }, { price: "99999999.991", currency: "KWD" }]) {
  check(() => assert.throws(() => serviceMoneyChanges(input), MoneyInputError));
}
check(() => assert.throws(() => serviceMoneyChanges({ currency: "GBP" }, { price: "10.00", currency: "EUR" }), MoneyInputError));
check(() => assert.deepEqual(serviceMoneyChanges({ price: "11.00", currency: "GBP" }, { price: "10.00", currency: "EUR" }), { price: "11.00", currency: "GBP" }));
check(() => assert.deepEqual(serviceMoneyDto({ price: "10.500", currency: "EUR", id: 1 }), { price: "10.50", currency: "EUR", id: 1 }));
check(() => assert.deepEqual(bookingMoneyDto({ totalAmount: "11.000", advanceAmount: "5.500", currency: "EUR" }), { totalAmount: "11.00", advanceAmount: "5.50", currency: "EUR" }));
check(() => assert.equal(serviceMoneyDto({ price: "10", currency: null }).currency, null));
check(() => assert.deepEqual(expectedPriceSchema.parse({ expectedPrice: "10", expectedCurrency: "EUR", expectedAdvancePaymentPercent: 50, totalAmount: "1" }), { expectedPrice: "10.00", expectedCurrency: "EUR", expectedAdvancePaymentPercent: 50 }));
check(() => assert.throws(() => bookingPriceSnapshot({ price: "1.000", currency: "KWD", advancePaymentPercent: 50 }, 1, { expectedPrice: "1.00", expectedCurrency: "KWD", expectedAdvancePaymentPercent: 50 }), PriceChangedError));
check(() => assert.deepEqual(bookingPriceSnapshot({ price: "0.010", currency: "EUR", advancePaymentPercent: 50 }, 3, { expectedPrice: "0.01", expectedCurrency: "EUR", expectedAdvancePaymentPercent: 50 }), { currency: "EUR", totalAmount: "0.03", advanceAmount: "0.02" }));
check(() => assert.throws(() => bookingPriceSnapshot({ price: "10.00", currency: "EUR", advancePaymentPercent: 100 }, 1, { expectedPrice: "10.00", expectedCurrency: "EUR", expectedAdvancePaymentPercent: 0 }), error => error instanceof PriceChangedError && error.currentAdvancePaymentPercent === 100));
check(() => assert.deepEqual(bookingPriceSnapshot({ price: "10.00", currency: "EUR", advancePaymentPercent: null }, 1, { expectedPrice: "10.00", expectedCurrency: "EUR", expectedAdvancePaymentPercent: 0 }), { currency: "EUR", totalAmount: "10.00", advanceAmount: "0.00" }));
const address = { address: "Street 10, Riga, Latvia", latitude: 0, longitude: 0 };
check(() => assert.equal(addressInputSchema.parse({ ...address, countryCode: "LV" }).countryCode, "LV"));
check(() => assert.equal(addressInputSchema.parse(address).countryCode, undefined));
check(() => assert.equal(addressInputSchema.parse({ ...address, countryCode: null }).countryCode, null));
for (const countryCode of ["ZZ", "lv", "LVA", "<script>"]) check(() => assert.equal(addressInputSchema.safeParse({ ...address, countryCode }).success, false));
console.log(`Passed ${checks} currency backend contract scenarios: price/currency validation, explicit currency changes, canonical DTOs, exact snapshot/rounding, required quotes and country metadata. Offline only.`);
