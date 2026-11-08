import type { BookingWithDetails, Employee, Service } from "@shared/schema";
import { amountToMinor, minorToAmount, normalizeMoneyAmount } from "@shared/money";
import { currencyDigits } from "@shared/currencies";

export const reportTypes = [{ id: "services", labelKey: "reports.servicesRevenue" }, { id: "byService", labelKey: "reports.byService" }, { id: "serviceViews", labelKey: "reports.serviceViews" }] as const;
export type ReportType = typeof reportTypes[number]["id"];
export type EmployeeFilter = "all" | "unassigned" | `${number}`;
export type Period = { from: string; to: string };
export type ReportRow = { id: number; serviceId: number; service: string; employeeId: number | null; employee: string | null; date: Date; status: string; currency: string; amount: string };
export type ReportTotal = { currency: string; earned: string; planned: string; pending: string; lost: string };
export type ServiceReportGroup = ReportTotal & { serviceId: number; service: string; bookingCount: number; completedCount: number; confirmedCount: number; pendingCount: number; cancelledCount: number };
export type ServiceGroupSort = "name" | "earned" | "fewest" | "most";
export function matchesReportEmployee(employeeId: number | null | undefined, filter: EmployeeFilter): boolean {
  return filter === "all" || (filter === "unassigned" ? employeeId == null : employeeId === Number(filter));
}
export function reportEmployees(bookings: BookingWithDetails[], employees: Pick<Employee, "id" | "name">[]): { id: number; name: string | null }[] {
  const names = new Map<number, string | null>();
  for (const employee of employees) names.set(employee.id, employee.name);
  for (const booking of bookings) if (booking.employeeId != null && !names.has(booking.employeeId)) names.set(booking.employeeId, booking.employee?.name ?? null);
  return Array.from(names, ([id, name]) => ({ id, name })).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.id - b.id);
}
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function presetPeriod(preset: "week" | "month", now = new Date()): Period {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  else start.setDate(1);
  const end = new Date(start);
  if (preset === "week") end.setDate(end.getDate() + 6);
  else { end.setMonth(end.getMonth() + 1); end.setDate(0); }
  return { from: localDate(start), to: localDate(end) };
}
function dateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value ? date : null;
}
export function validPeriod(period: Period): boolean {
  return !!dateInput(period.from) && !!dateInput(period.to) && period.from <= period.to;
}
export function createServiceReport(bookings: BookingWithDetails[], period: Period, employee: EmployeeFilter = "all"): { rows: ReportRow[]; totals: ReportTotal[] } {
  if (!validPeriod(period)) throw new RangeError("Invalid report period");
  const start = dateInput(period.from)!;
  const end = dateInput(period.to)!; end.setDate(end.getDate() + 1);
  const rows = bookings.filter(booking => {
    const date = new Date(booking.scheduledDate);
    return date >= start && date < end && matchesReportEmployee(booking.employeeId, employee);
  }).map(booking => ({ id: booking.id, serviceId: booking.serviceId, service: booking.service.name, employeeId: booking.employeeId ?? null, employee: booking.employee?.name ?? null, date: new Date(booking.scheduledDate), status: booking.status ?? "pending", currency: booking.currency, amount: normalizeMoneyAmount(booking.totalAmount, booking.currency) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
  const sums = new Map<string, { earned: bigint; planned: bigint; pending: bigint; lost: bigint }>();
  for (const row of rows) {
    const total = sums.get(row.currency) ?? { earned: BigInt(0), planned: BigInt(0), pending: BigInt(0), lost: BigInt(0) };
    const bucket = row.status === "completed" ? "earned" : row.status === "cancelled" ? "lost" : row.status === "confirmed" ? "planned" : "pending";
    total[bucket] += amountToMinor(row.amount, row.currency);
    sums.set(row.currency, total);
  }
  return { rows, totals: Array.from(sums).sort(([a], [b]) => a.localeCompare(b)).map(([currency, sum]) => ({ currency, earned: minorToAmount(sum.earned, currency), planned: minorToAmount(sum.planned, currency), pending: minorToAmount(sum.pending, currency), lost: minorToAmount(sum.lost, currency) })) };
}

export function groupServiceReport(rows: ReportRow[], catalog: Pick<Service, "id" | "name" | "currency" | "employeeId">[], employee: EmployeeFilter = "all"): ServiceReportGroup[] {
  const groups = new Map<string, ServiceReportGroup>();
  const amounts = new Map<string, { earned: bigint; planned: bigint; pending: bigint; lost: bigint }>();
  const names = new Map(catalog.map(service => [service.id, service.name]));
  const makeGroup = (serviceId: number, service: string, currency: string): ServiceReportGroup => ({
    serviceId, service, currency, bookingCount: 0, completedCount: 0, confirmedCount: 0, pendingCount: 0, cancelledCount: 0,
    earned: minorToAmount(BigInt(0), currency), planned: minorToAmount(BigInt(0), currency), pending: minorToAmount(BigInt(0), currency), lost: minorToAmount(BigInt(0), currency),
  });
  const booked = new Set<number>();
  for (const row of rows) {
    if (!matchesReportEmployee(row.employeeId, employee)) continue;
    booked.add(row.serviceId);
    const key = JSON.stringify([row.serviceId, row.currency]);
    const group = groups.get(key) ?? makeGroup(row.serviceId, names.get(row.serviceId) ?? row.service, row.currency);
    const [bucket, count] = row.status === "completed" ? ["earned", "completedCount"] as const : row.status === "confirmed" ? ["planned", "confirmedCount"] as const : row.status === "cancelled" ? ["lost", "cancelledCount"] as const : ["pending", "pendingCount"] as const;
    const sum = amounts.get(key) ?? { earned: BigInt(0), planned: BigInt(0), pending: BigInt(0), lost: BigInt(0) };
    sum[bucket] += amountToMinor(row.amount, row.currency);
    amounts.set(key, sum);
    group[count]++; group.bookingCount++;
    groups.set(key, group);
  }
  // Only actual bookings measure demand. Unbooked catalog services remain visible,
  // including inactive services; assignment filters their zero rows, not history.
  for (const service of catalog) if (!booked.has(service.id) && matchesReportEmployee(service.employeeId, employee)) groups.set(JSON.stringify([service.id, service.currency]), makeGroup(service.id, service.name, service.currency));
  return sortServiceGroups(Array.from(groups, ([key, group]) => {
    const sum = amounts.get(key);
    return sum ? { ...group, earned: minorToAmount(sum.earned, group.currency), planned: minorToAmount(sum.planned, group.currency), pending: minorToAmount(sum.pending, group.currency), lost: minorToAmount(sum.lost, group.currency) } : group;
  }), "name");
}

// Aggregate strings can exceed a single booking's cap. Do not apply price/input
// validation to already calculated totals when comparing them.
function aggregateMinor(amount: string, currency: string): bigint {
  const digits = currencyDigits(currency), [whole, fraction = ""] = amount.split(".");
  if (!/^\d+(?:\.\d+)?$/.test(amount) || fraction.length > digits) throw new RangeError("Invalid report total");
  return BigInt(whole) * [BigInt(1), BigInt(10), BigInt(100), BigInt(1000)][digits] + BigInt(fraction.padEnd(digits, "0") || "0");
}

export function sortServiceGroups(groups: ServiceReportGroup[], sort: ServiceGroupSort): ServiceReportGroup[] {
  return [...groups].sort((a, b) => {
    if (sort === "earned") {
      const currency = a.currency.localeCompare(b.currency); if (currency) return currency;
      const difference = aggregateMinor(b.earned, b.currency) - aggregateMinor(a.earned, a.currency);
      if (difference !== BigInt(0)) return difference > BigInt(0) ? 1 : -1;
    } else if (sort === "fewest" || sort === "most") {
      const difference = (a.bookingCount - b.bookingCount) * (sort === "most" ? -1 : 1); if (difference) return difference;
    }
    return a.service.localeCompare(b.service) || a.serviceId - b.serviceId || a.currency.localeCompare(b.currency);
  });
}
