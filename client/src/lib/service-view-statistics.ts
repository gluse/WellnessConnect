import type { ServiceViewCapabilities, ServiceViewReport, ServiceViewReportQuery, ServiceViewReportRow } from "@shared/service-view-report";
import { validServiceViewPeriod } from "@shared/service-view-report";

export function activeViewPro(capabilities: ServiceViewCapabilities | undefined, now = Date.now()): boolean {
  return capabilities?.hasPro === true && capabilities.proUntil != null && Date.parse(capabilities.proUntil) > now;
}
export function viewStatisticsPeriod(capabilities: ServiceViewCapabilities, preset: "week" | "month" = "month") {
  const end = new Date(`${capabilities.availableTo}T00:00:00Z`), start = new Date(end);
  if (preset === "week") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  else start.setUTCDate(1);
  return { from: [start.toISOString().slice(0, 10), capabilities.availableFrom].sort().at(-1)!, to: capabilities.availableTo };
}
export function allowedViewStatisticsPeriod(period: { from: string; to: string }, capabilities: ServiceViewCapabilities): boolean {
  return validServiceViewPeriod(period.from, period.to, new Date(capabilities.asOf)) && period.from >= capabilities.availableFrom && period.to <= capabilities.availableTo;
}
export function verifyViewStatistics(report: ServiceViewReport, query: ServiceViewReportQuery) {
  if (report.from !== query.from || report.to !== query.to || report.employee !== query.employee
    || report.rows.reduce((sum, row) => sum + BigInt(row.views), BigInt(0)) !== BigInt(report.totalViews)) throw Error("Invalid statistics response");
  return report;
}
export function rankedViewStatistics(rows: ServiceViewReportRow[]) {
  return [...rows].sort((a, b) => {
    const difference = BigInt(b.views) - BigInt(a.views);
    return difference > BigInt(0) ? 1 : difference < BigInt(0) ? -1 : a.service.localeCompare(b.service) || a.serviceId - b.serviceId;
  });
}
export function viewBarPercent(value: string, maximum: string): number {
  return BigInt(maximum) === BigInt(0) ? 0 : Number(BigInt(value) * BigInt(10000) / BigInt(maximum)) / 100;
}
