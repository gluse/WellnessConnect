import { parseMoneyAmount } from "@shared/money";

// Accept a canonical decimal point or this locale's decimal separator, never
// grouping separators. Display formatting is deliberately not an input parser.
export function parseMoneyInput(value: string, currency: string, locale: string): string | null {
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  const input = value.trim();
  const normalized = decimal !== "." && input.includes(decimal) ? input.replace(decimal, ".") : input;
  try { return parseMoneyAmount(normalized, currency); } catch { return null; }
}
