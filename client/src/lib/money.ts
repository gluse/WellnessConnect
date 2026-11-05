import { currencyDigits, isSupportedCurrency } from "@shared/currencies";

/** Display only: no exchange, rounding of entered prices, or inferred currency. */
export function formatMoney(amount: unknown, currency: unknown, locale: string): string | null {
  if (!isSupportedCurrency(currency) || typeof amount !== "string" || amount.length > 50 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) return null;
  const digits = currencyDigits(currency);
  const fraction = amount.split(".")[1] ?? "";
  if (/[1-9]/.test(fraction.slice(digits))) return null;
  try {
    const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: digits, maximumFractionDigits: digits });
    // ECMA-402 ToIntlMathematicalValue accepts decimal strings without Number's
    // precision loss. TypeScript 5.6's overload still declares only number/bigint.
    return formatter.format(amount as unknown as number);
  } catch { return null; }
}
