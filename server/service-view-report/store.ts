import { sql, type SQL } from "drizzle-orm";
import { queryRows, type ProductQuery } from "../wishlist/postgres";
import type { ServiceViewReportActor, ServiceViewReportStore } from "./service";
import { SERVICE_VIEW_REPORT_MAX_ROWS, type ServiceViewReportQuery, type ServiceViewReportRow } from "../../shared/service-view-report";

/** These predicates recheck current membership/assignment at execution time. */
export function serviceViewServiceAccess(actor: ServiceViewReportActor): SQL {
  if (actor.companyId == null) return sql`s.provider_id=${actor.userId} AND s.company_id IS NULL`;
  return sql`s.company_id=${actor.companyId} AND EXISTS(SELECT 1 FROM public.company_memberships m
    JOIN public.companies c ON c.id=m.company_id WHERE c.is_active AND m.company_id=s.company_id AND m.user_id=${actor.userId}
    AND (m.role IN ('owner','admin') OR m.employee_id=s.employee_id))`;
}
export function serviceViewAccessQuery(actor: ServiceViewReportActor): SQL {
  if (actor.companyId == null) return sql`SELECT p.plan,p.pro_until AS "proUntil",true AS active FROM public.users u
    LEFT JOIN public.provider_subscriptions p ON p.user_id=u.id AND p.company_id IS NULL WHERE u.id=${actor.userId} LIMIT 1`;
  return sql`SELECT p.plan,p.pro_until AS "proUntil",c.is_active AS active FROM public.companies c
    JOIN public.company_memberships m ON m.company_id=c.id AND m.user_id=${actor.userId}
    LEFT JOIN public.provider_subscriptions p ON p.company_id=c.id WHERE c.id=${actor.companyId} LIMIT 1`;
}
export function serviceViewStatisticsQuery(actor: ServiceViewReportActor, query: ServiceViewReportQuery, asOf: Date): SQL {
  const end = new Date(`${query.to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1);
  const employee = query.employee === "all" ? sql`` : query.employee === "unassigned" ? sql`AND s.employee_id IS NULL` : sql`AND s.employee_id=${Number(query.employee)}`;
  return sql`SELECT s.id AS "serviceId",s.name AS service,s.employee_id AS "employeeId",emp.name AS "employeeName",count(e.id)::text AS views
    FROM public.services s LEFT JOIN public.employees emp ON emp.id=s.employee_id AND emp.company_id IS NOT DISTINCT FROM s.company_id
      AND (s.company_id IS NOT NULL OR emp.provider_id=s.provider_id)
    LEFT JOIN public.product_activity_events e ON e.service_id=s.id AND e.kind='service_views'
      AND e.company_id IS NOT DISTINCT FROM s.company_id AND (s.company_id IS NOT NULL OR e.provider_id=s.provider_id)
      AND e.occurred_at>=${`${query.from}T00:00:00.000Z`}::timestamptz AND e.occurred_at<${end.toISOString()}::timestamptz
      AND e.occurred_at<=${asOf.toISOString()}::timestamptz AND e.expires_at>${asOf.toISOString()}::timestamptz
    WHERE (${serviceViewServiceAccess(actor)}) ${employee}
    GROUP BY s.id,s.name,s.employee_id,emp.name ORDER BY s.name,s.id LIMIT ${SERVICE_VIEW_REPORT_MAX_ROWS + 1}`;
}
export function createServiceViewReportStore(database: ProductQuery): ServiceViewReportStore {
  return {
    async access(actor) {
      const [row] = await queryRows<{plan: string | null; proUntil: Date | string | null; active: boolean}>(database, serviceViewAccessQuery(actor));
      return row ? { ...row, proUntil: row.proUntil == null ? null : new Date(row.proUntil) } : null;
    },
    rows: (actor, query, now) => queryRows<ServiceViewReportRow>(database, serviceViewStatisticsQuery(actor, query, now)),
  };
}
