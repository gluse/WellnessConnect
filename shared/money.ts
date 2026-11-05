import { currencyDigits } from "./currencies";

// Preserve the previous decimal(10,2) business bound even for other scales.
export const MAX_MONEY_AMOUNT = "99999999.99";
const zero = BigInt(0);
const scale = (digits: number) => [BigInt(1), BigInt(10), BigInt(100), BigInt(1000)][digits];

function readAmount(amount: unknown, currency: unknown, allowTrailingZeros: boolean): { minor: bigint; digits: number } {
  const digits = currencyDigits(currency);
  if (typeof amount !== "string" || amount.length > 24 || !/^(?:0|[1-9]\d{0,7})(?:\.\d+)?$/.test(amount)) throw new RangeError("Invalid money amount");
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > digits && (!allowTrailingZeros || /[1-9]/.test(fraction.slice(digits)))) throw new RangeError("Invalid currency precision");
  const minor = BigInt(whole) * scale(digits) + BigInt(fraction.slice(0, digits).padEnd(digits, "0") || "0");
  // Compare thousandths so zero-decimal currencies cannot accidentally raise the cap.
  if (minor * scale(3 - digits) > BigInt("99999999990")) throw new RangeError("Money amount exceeds limit");
  return { minor, digits };
}

/** Canonical provider input. Excess precision, even trailing zero digits, is rejected. */
export function parseMoneyAmount(amount: unknown, currency: unknown): string {
  const { minor } = readAmount(amount, currency, false);
  return minorToAmount(minor, currency);
}

/** Database numerics can contain scale-padding zeros; never discard a nonzero digit. */
export function normalizeMoneyAmount(amount: unknown, currency: unknown): string {
  const { minor } = readAmount(amount, currency, true);
  return minorToAmount(minor, currency);
}

export function amountToMinor(amount: unknown, currency: unknown): bigint {
  return readAmount(amount, currency, false).minor;
}

/** Also used for aggregate totals, which can legitimately exceed a single price. */
export function minorToAmount(minor: bigint, currency: unknown): string {
  const digits = currencyDigits(currency);
  if (typeof minor !== "bigint" || minor < zero) throw new RangeError("Invalid minor units");
  const divisor = scale(digits);
  return String(minor / divisor) + (digits ? "." + String(minor % divisor).padStart(digits, "0") : "");
}

export function calculateBookingAmounts(price: unknown, currency: unknown, participants: number, advancePercent: number) {
  if (!Number.isSafeInteger(participants) || participants < 1 || !Number.isSafeInteger(advancePercent) || advancePercent < 0 || advancePercent > 100) throw new RangeError("Invalid booking amount inputs");
  const unit = amountToMinor(normalizeMoneyAmount(price, currency), currency);
  const total = unit * BigInt(participants);
  const totalAmount = parseMoneyAmount(minorToAmount(total, currency), currency);
  // Nonnegative monetary amounts: round half up once to the selected minor unit.
  const advance = (total * BigInt(advancePercent) + BigInt(50)) / BigInt(100);
  return { totalAmount, advanceAmount: minorToAmount(advance, currency), balanceAmount: minorToAmount(total - advance, currency) };
}
