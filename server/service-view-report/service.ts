import { hasPro } from "../../shared/storefront";
import {
  SERVICE_VIEW_REPORT_MAX_ROWS, SERVICE_VIEW_RETENTION_DAYS, serviceViewReportQuerySchema,
  serviceViewReportRowSchema, serviceViewReportWindow, validServiceViewPeriod,
  type ServiceViewCapabilities, type ServiceViewReport, type ServiceViewReportQuery, type ServiceViewReportRow,
} from "../../shared/service-view-report";

export class ServiceViewReportError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export type ServiceViewReportActor = { userId: string; companyId: number | null };
export type ServiceViewReportAccess = { plan: string | null; proUntil: Date | null; active: boolean };
export type ServiceViewReportStore = {
  access(actor: ServiceViewReportActor): Promise<ServiceViewReportAccess | null>;
  rows(actor: ServiceViewReportActor, query: ServiceViewReportQuery, asOf: Date): Promise<ServiceViewReportRow[]>;
};

export function createServiceViewReportService(store: ServiceViewReportStore, trackingEnabled: () => boolean, clock = () => new Date()) {
  const history = (now: Date) => ({
    ...serviceViewReportWindow(now), asOf: now.toISOString(), trackingEnabled: trackingEnabled(),
    retentionDays: SERVICE_VIEW_RETENTION_DAYS, timezone: "UTC" as const, measurement: "recorded_detail_opens" as const,
    historyCoverage: "unknown" as const, captureStartedAt: null,
  });
  async function access(actor: ServiceViewReportActor) {
    const result = await store.access(actor);
    if (!result || !result.active) throw new ServiceViewReportError(403, "workspace_unavailable");
    return result;
  }
  const pro = (current: ServiceViewReportAccess, now: Date) => hasPro({ plan: current.plan, proUntil: current.proUntil } as Parameters<typeof hasPro>[0], now.getTime());
  return {
    async capabilities(actor: ServiceViewReportActor): Promise<ServiceViewCapabilities> {
      const current = await access(actor), now = clock();
      return { ...history(now), hasPro: pro(current, now), proUntil: current.proUntil?.toISOString() ?? null };
    },
    async report(actor: ServiceViewReportActor, input: unknown): Promise<ServiceViewReport> {
      // Entitlement is re-read on every execution, before any statistics query.
      const current = await access(actor), now = clock();
      if (!pro(current, now)) throw new ServiceViewReportError(403, "pro_required");
      if (!trackingEnabled()) throw new ServiceViewReportError(503, "tracking_unavailable");
      const query = serviceViewReportQuerySchema.parse(input);
      if (!validServiceViewPeriod(query.from, query.to, now)) throw new ServiceViewReportError(400, "period_out_of_range");
      const raw = await store.rows(actor, query, now);
      if (raw.length > SERVICE_VIEW_REPORT_MAX_ROWS) throw new ServiceViewReportError(503, "report_too_large");
      const parsed = serviceViewReportRowSchema.array().safeParse(raw);
      if (!parsed.success) throw new ServiceViewReportError(503, "report_unavailable");
      const rows = parsed.data;
      // Never release a result after this request's subscription lease expires.
      if (!pro(current, clock())) throw new ServiceViewReportError(403, "pro_required");
      return { ...history(now), trackingEnabled: true, from: query.from, to: query.to, employee: query.employee,
        proUntil: current.proUntil!.toISOString(), rows, totalViews: rows.reduce((sum, row) => sum + BigInt(row.views), BigInt(0)).toString() };
    },
  };
}
export type ServiceViewReportService = ReturnType<typeof createServiceViewReportService>;
