import { z } from "zod";

export const SERVICE_VIEW_RETENTION_DAYS = 90 as const;
export const SERVICE_VIEW_REPORT_MAX_ROWS = 10_000;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.string().datetime();
const count = z.string().regex(/^(?:0|[1-9]\d*)$/).max(30);
export const serviceViewEmployeeSchema = z.union([z.literal("all"), z.literal("unassigned"), z.string().regex(/^[1-9]\d{0,9}$/).refine(value => Number(value) <= 2147483647)]);
export type ServiceViewEmployee = z.infer<typeof serviceViewEmployeeSchema>;
export const serviceViewReportQuerySchema = z.object({ from: day, to: day, employee: serviceViewEmployeeSchema.default("all") }).strict();
export type ServiceViewReportQuery = z.infer<typeof serviceViewReportQuerySchema>;

const history = {
  trackingEnabled: z.boolean(), retentionDays: z.literal(SERVICE_VIEW_RETENTION_DAYS), timezone: z.literal("UTC"),
  availableFrom: day, availableTo: day, asOf: instant,
  measurement: z.literal("recorded_detail_opens"), historyCoverage: z.literal("unknown"), captureStartedAt: z.null(),
};
export const serviceViewCapabilitiesSchema = z.object({ ...history, hasPro: z.boolean(), proUntil: instant.nullable() }).strict();
export type ServiceViewCapabilities = z.infer<typeof serviceViewCapabilitiesSchema>;
export const serviceViewReportRowSchema = z.object({
  serviceId: z.number().int().positive().max(2147483647), service: z.string(),
  employeeId: z.number().int().positive().max(2147483647).nullable(), employeeName: z.string().nullable(), views: count,
}).strict();
export type ServiceViewReportRow = z.infer<typeof serviceViewReportRowSchema>;
export const serviceViewReportSchema = z.object({
  ...history, trackingEnabled: z.literal(true), from: day, to: day, employee: serviceViewEmployeeSchema,
  proUntil: instant, rows: z.array(serviceViewReportRowSchema).max(SERVICE_VIEW_REPORT_MAX_ROWS), totalViews: count,
}).strict();
export type ServiceViewReport = z.infer<typeof serviceViewReportSchema>;

/** Earliest complete UTC day inside the rolling 90-day event retention. */
export function serviceViewReportWindow(now: Date) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const first = new Date(today); first.setUTCDate(first.getUTCDate() - (SERVICE_VIEW_RETENTION_DAYS - 1));
  return { availableFrom: first.toISOString().slice(0, 10), availableTo: today.toISOString().slice(0, 10) };
}
export function validServiceViewPeriod(from: string, to: string, now: Date): boolean {
  const validDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const window = serviceViewReportWindow(now);
  return validDay(from) && validDay(to) && from <= to && from >= window.availableFrom && to <= window.availableTo;
}
