import { amountToMinor, minorToAmount } from "@shared/money";
import { localDate, type ReportRow, type ServiceReportGroup } from "./service-report";

export const reportGraphMetrics = ["earned", "planned", "pending", "lost"] as const;
export type ReportGraphMetric = typeof reportGraphMetrics[number];
export type ReportGraphPoint = { key: string; date?: string; service?: string; serviceId?: number; bookingCount: number } & Record<ReportGraphMetric, string>;
export type ReportGraphPanel = { currency: string; points: ReportGraphPoint[] };
export function formatReportGraphTick(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, Math.abs(value) >= 1000
    ? { notation: "compact", maximumFractionDigits: 1 }
    : { maximumSignificantDigits: 3 }).format(value);
}

/** Only applied rows enter here. Group exact minor units before numeric drawing. */
export function dailyReportGraphs(rows: ReportRow[]): ReportGraphPanel[] {
  const sums = new Map<string, { currency: string; date: string; count: number; earned: bigint; planned: bigint; pending: bigint; lost: bigint }>();
  for (const row of rows) {
    const date = localDate(row.date), key = JSON.stringify([row.currency, date]);
    const sum = sums.get(key) ?? { currency: row.currency, date, count: 0, earned: BigInt(0), planned: BigInt(0), pending: BigInt(0), lost: BigInt(0) };
    const metric = row.status === "completed" ? "earned" : row.status === "confirmed" ? "planned" : row.status === "cancelled" ? "lost" : "pending";
    sum[metric] += amountToMinor(row.amount, row.currency); sum.count++;
    sums.set(key, sum);
  }
  const panels = new Map<string, ReportGraphPoint[]>();
  for (const sum of Array.from(sums.values())) {
    const points = panels.get(sum.currency) ?? [];
    points.push({ key: sum.date, date: sum.date, bookingCount: sum.count,
      earned: minorToAmount(sum.earned, sum.currency), planned: minorToAmount(sum.planned, sum.currency), pending: minorToAmount(sum.pending, sum.currency), lost: minorToAmount(sum.lost, sum.currency) });
    panels.set(sum.currency, points);
  }
  return Array.from(panels, ([currency, points]) => ({ currency, points: points.sort((a, b) => a.key.localeCompare(b.key)) })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function serviceReportGraphs(groups: ServiceReportGroup[]): ReportGraphPanel[] {
  const panels = new Map<string, ReportGraphPoint[]>();
  for (const group of groups) {
    const points = panels.get(group.currency) ?? [];
    points.push({ key: String(group.serviceId), serviceId: group.serviceId, service: group.service, bookingCount: group.bookingCount,
      earned: group.earned, planned: group.planned, pending: group.pending, lost: group.lost });
    panels.set(group.currency, points);
  }
  return Array.from(panels, ([currency, points]) => ({ currency, points })).sort((a, b) => a.currency.localeCompare(b.currency));
}
