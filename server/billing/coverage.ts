import { BillingError, invoiceSchema, periodSchema, type InvoiceEvidence, type Period } from "./contracts";

export type Coverage = { proUntil: number | null; nextChangeAt: number | null };

/** Pure interval math. Source eligibility/manual overlap is decided by the caller. */
export function coverageAt(input: readonly Period[], now: number): Coverage {
  if (!Number.isSafeInteger(now) || now < 0) throw new BillingError("INVALID_INPUT");
  if (input.length > 2000) throw new BillingError("INVALID_INPUT");
  const periods = input.map(value => periodSchema.parse(value)).sort((a, b) => a.start - b.start);
  const merged: Period[] = [];
  for (const period of periods) {
    const previous = merged.at(-1);
    if (previous && period.start <= previous.end) previous.end = Math.max(previous.end, period.end);
    else merged.push({ ...period });
  }
  const current = merged.find(period => period.start <= now && now < period.end);
  const next = merged.find(period => period.start > now);
  return { proUntil: current?.end ?? null, nextChangeAt: current?.end ?? next?.start ?? null };
}

/** Required explicit policy: no refund, grace or manual-source policy is selected here. */
export type InvoiceAccessPolicy = (invoice: Readonly<InvoiceEvidence>) => "grant" | "withhold" | "review";
export function invoiceCoverage(invoices: readonly InvoiceEvidence[], now: number, policy: InvoiceAccessPolicy): Coverage {
  const byId = new Map<string, InvoiceEvidence>();
  if (invoices.length > 1000) throw new BillingError("INVALID_INPUT");
  for (const value of invoices) {
    const invoice = invoiceSchema.parse(value);
    const previous = byId.get(invoice.processorInvoiceId);
    if (previous && (previous.status !== invoice.status || previous.period.start !== invoice.period.start ||
      previous.period.end !== invoice.period.end)) throw new BillingError("CONFLICT");
    byId.set(invoice.processorInvoiceId, invoice);
  }
  const periods: Period[] = [];
  for (const invoice of Array.from(byId.values())) {
    const decision = policy(invoice);
    if (decision === "review") throw new BillingError("POLICY_REVIEW");
    // Even a permissive policy cannot manufacture paid evidence from an unpaid invoice.
    if (decision === "grant" && invoice.status === "paid") periods.push(invoice.period);
  }
  return coverageAt(periods, now);
}
