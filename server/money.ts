import { z } from "zod";
import { isSupportedCurrency } from "@shared/currencies";
import { calculateBookingAmounts, normalizeMoneyAmount, parseMoneyAmount } from "@shared/money";

export class MoneyInputError extends Error {
  readonly status = 400;
}
export class PriceChangedError extends Error {
  readonly status = 409;
  readonly code = "PRICE_CHANGED";
  constructor(readonly currentPrice: string, readonly currentCurrency: string, readonly currentAdvancePaymentPercent: number) {
    super("The service price or advance has changed. Review the updated amounts before booking.");
  }
}
export const expectedPriceSchema = z.object({
  expectedPrice: z.string().min(1).max(30),
  expectedCurrency: z.string().refine(isSupportedCurrency, "Choose a supported currency."),
  expectedAdvancePaymentPercent: z.number().int().min(0).max(100),
}).transform(input => {
  try { return { expectedPrice: parseMoneyAmount(input.expectedPrice, input.expectedCurrency), expectedCurrency: input.expectedCurrency, expectedAdvancePaymentPercent: input.expectedAdvancePaymentPercent }; }
  catch { throw new MoneyInputError("Choose a valid expected service price."); }
});
export type ExpectedPrice = { expectedPrice: string; expectedCurrency: string; expectedAdvancePaymentPercent: number };

export function serviceMoneyChanges(input: { price?: string; currency?: string }, previous?: { price: string; currency: string }) {
  if (previous && input.price === undefined && input.currency === undefined) return {};
  if (previous && input.currency !== undefined && input.currency !== previous.currency && input.price === undefined) {
    throw new MoneyInputError("Review and provide the service amount when changing its currency.");
  }
  const currency = input.currency ?? previous?.currency;
  const price = input.price ?? previous?.price;
  if (!currency || !isSupportedCurrency(currency) || price === undefined) throw new MoneyInputError("Choose a price and supported currency.");
  try { return { currency, price: input.price === undefined ? normalizeMoneyAmount(price, currency) : parseMoneyAmount(price, currency) }; }
  catch { throw new MoneyInputError("Enter an amount within the supported limit and currency precision."); }
}

export function bookingPriceSnapshot(service: { price: string; currency: string; advancePaymentPercent: number | null }, participantCount: number, expected: ExpectedPrice) {
  let price: string;
  try { price = normalizeMoneyAmount(service.price, service.currency); }
  catch { throw new MoneyInputError("This service has no valid currency price and cannot be booked."); }
  const advancePaymentPercent = service.advancePaymentPercent ?? 0;
  if (expected.expectedCurrency !== service.currency || expected.expectedPrice !== price || expected.expectedAdvancePaymentPercent !== advancePaymentPercent) throw new PriceChangedError(price, service.currency, advancePaymentPercent);
  try {
    const { totalAmount, advanceAmount } = calculateBookingAmounts(price, service.currency, participantCount, advancePaymentPercent);
    return { currency: service.currency, totalAmount, advanceAmount };
  } catch { throw new MoneyInputError("The reservation amount exceeds the supported limit."); }
}

export function serviceMoneyDto<T extends { price: string; currency: string }>(service: T): T {
  // An unresolved legacy record must retain its missing currency for the UI's
  // explicit unavailable state; never manufacture EUR/USD while reading it.
  if (!isSupportedCurrency(service.currency)) return service;
  return { ...service, price: normalizeMoneyAmount(service.price, service.currency) };
}
export function bookingMoneyDto<T extends { totalAmount: string; advanceAmount: string; currency: string }>(booking: T): T {
  if (!isSupportedCurrency(booking.currency)) return booking;
  return { ...booking, totalAmount: normalizeMoneyAmount(booking.totalAmount, booking.currency), advanceAmount: normalizeMoneyAmount(booking.advanceAmount, booking.currency) };
}
