import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BarChart3, ArrowDownToLine, CalendarDays, CheckCircle2, Clock3, List, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProviderBookings, useProviderWorkspace, WORKSPACE_CHANGE_KEY } from "@/hooks/use-provider-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createServiceReport, groupServiceReport, reportEmployees, sortServiceGroups, presetPeriod, reportTypes, validPeriod, type Period, type EmployeeFilter, type ReportType, type ServiceGroupSort } from "@/lib/service-report";
import type { Employee, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ReportServiceGroups from "@/components/provider/report-service-groups";
import type { ExportDocument } from "@/lib/report-downloads";
import ServiceViewStatistics from "@/components/provider/service-view-statistics";

const ReportGraphs = lazy(() => import("@/components/provider/report-graphs"));

export default function ReportsPage() {
  const { user } = useAuth();
  const { data: context } = useProviderWorkspace();
  const switching = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  if (!user || !context || switching) return null;
  const scope = JSON.stringify([user.id, context.company?.id ?? "personal", context.permissions, context.membership]);
  return <ReportsShell key={scope} scope={scope} company={context.company !== null} canManageBilling={!context.company || context.permissions.isOwner} />;
}

function ReportsShell({ scope, company, canManageBilling }: { scope: string; company: boolean; canManageBilling: boolean }) {
  const { t } = useTranslation();
  const [type, setType] = useState<ReportType>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("report") === "serviceViews" ? "serviceViews" : "services");
  return <div className="space-y-6" data-testid="reports-page">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-primary p-3 text-white"><BarChart3 className="h-6 w-6" aria-hidden="true" /></div><div><h1 className="text-2xl font-bold tracking-tight">{t("reports.title")}</h1><p className="mt-1 text-sm text-slate-600">{t("reports.subtitle")}</p></div></div>
      <div className="min-w-0"><Label htmlFor="report-type" className="sr-only">{t("reports.type")}</Label><select id="report-type" value={type} onChange={event => { setType(event.target.value as ReportType); }} className="min-h-11 max-w-full rounded-xl border border-slate-500 bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary">{reportTypes.map(type => <option key={type.id} value={type.id}>{t(type.labelKey)}</option>)}</select></div>
    </header>
    {type === "serviceViews" ? <ServiceViewStatistics scope={scope} company={company} canManageBilling={canManageBilling} /> : <ReportsContent scope={scope} company={company} type={type} />}
  </div>;
}

function ReportsContent({ scope, company, type }: { scope: string; company: boolean; type: Exclude<ReportType, "serviceViews"> }) {
  const { t, i18n } = useTranslation();
  const bookings = useProviderBookings(scope);
  const [employee, setEmployee] = useState<EmployeeFilter>("all"), [appliedEmployee, setAppliedEmployee] = useState<EmployeeFilter>("all");
  const [groupSort, setGroupSort] = useState<ServiceGroupSort>("name");
  // Scope keys include user, workspace, membership and permissions. Never reuse
  // the unscoped global employee/catalog cache or keep previous-workspace data.
  const employees = useQuery<Employee[]>({ queryKey: ["/api/provider/employees", scope], enabled: company, gcTime: 0, staleTime: 30_000, retry: false,
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/provider/employees", undefined, signal)).json() });
  const catalog = useQuery<Service[]>({ queryKey: ["/api/services/provider", scope], enabled: type === "byService", gcTime: 0, staleTime: 30_000, retry: false,
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/services/provider", undefined, signal)).json() });
  const [period, setPeriod] = useState<Period>(() => presetPeriod("month"));
  const [applied, setApplied] = useState<Period>(() => presetPeriod("month"));
  const [view, setView] = useState<"list" | "graph">("list");
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const locale = i18n.resolvedLanguage || i18n.language;
  const report = useMemo(() => {
    try { return createServiceReport(bookings.data ?? [], applied, appliedEmployee); } catch { return null; }
  }, [bookings.data, applied, appliedEmployee]);
  const employeeOptions = useMemo(() => reportEmployees(bookings.data ?? [], employees.data ?? []), [bookings.data, employees.data]);
  const groups = useMemo(() => {
    try { return sortServiceGroups(groupServiceReport(report?.rows ?? [], catalog.data ?? [], appliedEmployee), groupSort); } catch { return null; }
  }, [report, catalog.data, appliedEmployee, groupSort]);
  const totals = [...(report?.totals ?? [])];
  if (type === "byService") for (const group of groups ?? []) if (!totals.some(total => total.currency === group.currency)) totals.push({ currency: group.currency, earned: group.earned, planned: group.planned, pending: group.pending, lost: group.lost });
  totals.sort((a, b) => a.currency.localeCompare(b.currency));
  const invalid = !validPeriod(period);
  const dirty = period.from !== applied.from || period.to !== applied.to || employee !== appliedEmployee;
  const loading = bookings.isLoading || (company && employees.isPending) || (type === "byService" && catalog.isPending);
  const failed = bookings.isError || (company && employees.isError) || (type === "byService" && (catalog.isError || !groups)) || !report;
  const available = !loading && !failed && !!report;
  const money = (amount: string, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
  const date = (value: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);
  const status = (value: string) => t(`reports.${value}`);
  const employeeName = (id: number | null, name?: string | null) => id == null ? t("reports.unassigned") : employeeOptions.find(option => option.id === id)?.name || name || t("reports.employeeFallback", { id });
  const employeeScope = appliedEmployee === "all" ? t("reports.allEmployees") : appliedEmployee === "unassigned" ? t("reports.unassigned") : employeeName(Number(appliedEmployee));
  const title = t(type === "byService" ? "reports.byService" : "reports.servicesRevenue");
  const resultCount = type === "byService" ? groups?.length ?? 0 : report?.rows.length ?? 0;
  const periodLabel = `${applied.from} — ${applied.to}`;
  const exportReport = async (format: "pdf" | "xlsx" | "csv") => {
    if (!available || !report || exporting) return;
    setExporting(true); setExportError(false);
    try {
      const doc: ExportDocument = {
        title, subtitle: `${periodLabel} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}${company ? ` · ${employeeScope}` : ""}`,
        note: `${t("reports.definitions")}${type === "byService" ? ` ${t("reports.demandHelp")}` : ""}`,
        summary: [[t("reports.currency"), t("reports.earned"), t("reports.planned"), t("reports.pending"), t("reports.lost")], ...totals.map(total => [total.currency, Number(total.earned), Number(total.planned), Number(total.pending), Number(total.lost)])],
        columns: type === "byService" ? [t("reports.service"), t("reports.serviceId"), t("reports.currency"), t("reports.bookings"), ...["completed", "confirmed", "pending", "cancelled"].map(value => t("reports.statusBookings", { status: status(value) })), t("reports.earned"), t("reports.planned"), t("reports.pending"), t("reports.lost")]
          : [t("reports.service"), ...(company ? [t("reports.employee")] : []), t("reports.date"), t("reports.status"), t("reports.amount"), t("reports.currency")],
        rows: type === "byService" ? (groups ?? []).map(row => [row.service, row.serviceId, row.currency, row.bookingCount, row.completedCount, row.confirmedCount, row.pendingCount, row.cancelledCount, Number(row.earned), Number(row.planned), Number(row.pending), Number(row.lost)])
          : report.rows.map(row => [row.service, ...(company ? [employeeName(row.employeeId, row.employee)] : []), date(row.date), status(row.status), Number(row.amount), row.currency]),
      };
      const { reportCsv, reportXlsx, reportPdf, downloadReport } = await import("@/lib/report-downloads");
      const blob = format === "csv" ? reportCsv(doc) : format === "xlsx" ? reportXlsx(doc) : await reportPdf(doc);
      if (alive.current) downloadReport(blob, `${type === "byService" ? "services-summary" : "services-report"}-${applied.from}-${applied.to}.${format}`);
    } catch { if (alive.current) setExportError(true); } finally { if (alive.current) setExporting(false); }
  };
  const presets = (preset: "week" | "month") => { const next = presetPeriod(preset); setPeriod(next); setApplied(next); setAppliedEmployee(employee); setExportError(false); };
  const badgeClass: Record<string, string> = { completed: "bg-emerald-50 text-emerald-800", confirmed: "bg-blue-50 text-blue-800", pending: "bg-amber-50 text-amber-900", cancelled: "bg-rose-50 text-rose-800" };
  const metrics = [
    { key: "earned" as const, icon: CheckCircle2, style: "bg-emerald-50 text-emerald-800", border: "border-emerald-100", help: "earnedHelp" },
    { key: "planned" as const, icon: Clock3, style: "bg-violet-50 text-violet-800", border: "border-violet-100", help: "plannedHelp" },
    { key: "pending" as const, icon: Clock3, style: "bg-amber-50 text-amber-900", border: "border-amber-100", help: "pendingHelp" },
    { key: "lost" as const, icon: TrendingDown, style: "bg-rose-50 text-rose-800", border: "border-rose-100", help: "lostHelp" },
  ];
  return <div className="space-y-6" data-testid="reports-financial">
    <form className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm" onSubmit={event => { event.preventDefault(); if (!invalid) { setApplied({ ...period }); setAppliedEmployee(employee); setExportError(false); } }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />{t("reports.period")}</h2><div className="flex flex-wrap gap-2">{(["week", "month"] as const).map(preset => { const range = presetPeriod(preset); return <Button key={preset} type="button" variant={period.from === range.from && period.to === range.to ? "secondary" : "ghost"} className="min-h-11 rounded-xl" onClick={() => presets(preset)}>{t(preset === "week" ? "reports.thisWeek" : "reports.thisMonth")}</Button>; })}</div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">{(["from", "to"] as const).map(field => <div key={field} className="min-w-0 space-y-2"><Label htmlFor={`report-${field}`}>{t(`reports.${field}`)}</Label><Input id={`report-${field}`} type="date" required value={period[field]} aria-invalid={invalid} aria-describedby={invalid ? "report-period-error" : undefined} className="min-h-11 w-full min-w-0 rounded-xl border-slate-500" onChange={event => setPeriod({ ...period, [field]: event.target.value })} /></div>)}<Button type="submit" disabled={invalid} className="min-h-11 rounded-xl px-6">{t("reports.show")}</Button></div>
      {company && <div className="mt-4 space-y-2"><Label htmlFor="report-employee" className="block">{t("reports.employee")}</Label><select id="report-employee" value={employee} disabled={employees.isPending || employees.isError} className="min-h-11 w-full max-w-full rounded-xl border border-slate-500 bg-white px-3 text-sm sm:max-w-md" onChange={event => setEmployee(event.target.value as EmployeeFilter)}><option value="all">{t("reports.allEmployees")}</option>{employeeOptions.map(option => <option key={option.id} value={option.id}>{employeeName(option.id, option.name)}</option>)}<option value="unassigned">{t("reports.unassigned")}</option></select><p className="text-xs text-slate-600">{t("reports.employeeHelp")}</p></div>}
      {invalid && <p id="report-period-error" role="alert" className="mt-3 text-sm text-red-700">{t("reports.invalidPeriod")}</p>}
      {dirty && !invalid && <p role="status" className="mt-3 text-sm text-slate-600">{t("reports.unapplied")}</p>}
    </form>
    {loading ? <p role="status" className="rounded-2xl bg-white p-6">{t("reports.loading")}</p> : failed || !report ? <div role="alert" className="rounded-2xl border bg-white p-6"><p>{t("reports.loadError")}</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => { void bookings.refetch(); if (company) void employees.refetch(); if (type === "byService") void catalog.refetch(); }}>{t("reports.retry")}</Button></div> : <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" data-testid="report-summary">{metrics.map(({ key, icon: Icon, style, border, help }) => <section key={key} className={`min-w-0 rounded-xl border ${border} bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5`} data-report-summary-card aria-label={t(`reports.${key}`)}><div className="flex items-center justify-between gap-2"><h2 className="min-w-0 text-xs font-medium leading-snug text-slate-600 sm:text-sm">{t(`reports.${key}`)}</h2><span className={`hidden rounded-xl p-2 sm:inline-flex ${style}`} data-summary-icon><Icon className="h-5 w-5" aria-hidden="true" /></span></div><div className="mt-2 space-y-1 sm:my-3">{totals.length ? totals.map(total => <p key={total.currency} className="break-words text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-2xl" data-testid={`total-${key}-${total.currency}`}>{money(total[key], total.currency)}</p>) : <p className="text-lg font-bold sm:text-2xl">—</p>}</div><p className="hidden text-xs leading-relaxed text-slate-600 sm:block" data-summary-help>{t(`reports.${help}`)}</p></section>)}</div>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" aria-labelledby="report-results-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5"><div><h2 id="report-results-title" className="font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-600">{periodLabel} · {t("reports.bookingCount", { count: report.rows.length })}{company && <> · <bdi data-testid="report-employee-scope">{employeeScope}</bdi></>}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border p-1" role="group" aria-label={t("reports.view")}><Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-11 w-11" aria-label={t("reports.list")} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" className="h-4 w-4" /></Button><Button variant={view === "graph" ? "secondary" : "ghost"} size="icon" className="h-11 w-11" aria-label={t("reports.graph")} aria-pressed={view === "graph"} onClick={() => setView("graph")}><BarChart3 aria-hidden="true" className="h-4 w-4" /></Button></div><div className="flex flex-wrap gap-1" role="group" aria-label={t("reports.download")}>{(["pdf", "xlsx", "csv"] as const).map(format => <Button key={format} variant="outline" className="min-h-11 rounded-xl" disabled={exporting || !resultCount} onClick={() => void exportReport(format)} data-testid={`export-${format}`}><ArrowDownToLine className="me-1 h-4 w-4" aria-hidden="true" />{format.toUpperCase()}</Button>)}</div></div></div>
        {exporting && <p role="status" className="px-5 py-3 text-sm">{t("reports.exporting")}</p>}{exportError && <p role="alert" className="px-5 py-3 text-sm text-red-700">{t("reports.exportError")}</p>}
        {type === "byService" && <div className="space-y-3 border-b p-4 sm:p-5"><p className="text-sm text-slate-600">{t("reports.demandHelp")}</p><div className="space-y-2"><Label htmlFor="report-group-sort" className="block">{t("reports.sort")}</Label><select id="report-group-sort" value={groupSort} onChange={event => setGroupSort(event.target.value as ServiceGroupSort)} className="min-h-11 w-full max-w-full rounded-xl border border-slate-500 bg-white px-3 text-sm sm:max-w-md">{(["name", "earned", "fewest", "most"] as const).map(value => <option key={value} value={value}>{t(`reports.sort_${value}`)}</option>)}</select></div></div>}
        {view === "graph" ? <Suspense fallback={<p role="status" className="p-6">{t("reports.loading")}</p>}><ReportGraphs rows={report.rows} groups={groups ?? []} byService={type === "byService"} /></Suspense> : type === "byService" ? <ReportServiceGroups groups={groups ?? []} money={money} /> : !report.rows.length ? <div className="p-10 text-center"><BarChart3 className="mx-auto mb-3 h-9 w-9 text-slate-400" aria-hidden="true" /><h3 className="font-semibold">{t("reports.empty")}</h3><p className="mt-2 text-sm text-slate-600">{t("reports.emptyHelp")}</p></div> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("reports.results")}><table className="w-full min-w-[540px] text-start text-sm"><caption className="sr-only">{title} · {periodLabel}</caption><thead className="bg-slate-50 text-slate-600"><tr>{["service", ...(company ? ["employee"] : []), "date", "status", "amount"].map(key => <th key={key} scope="col" className={`px-5 py-3 font-medium ${key === "amount" ? "text-end" : "text-start"}`}>{t(`reports.${key}`)}</th>)}</tr></thead><tbody className="divide-y">{report.rows.map(row => <tr key={row.id} className="hover:bg-slate-50" data-report-row><th scope="row" className="max-w-xs whitespace-normal break-words px-5 py-4 text-start font-medium"><bdi>{row.service}</bdi></th>{company && <td className="max-w-xs break-words px-5 py-4 text-slate-600"><bdi data-report-employee>{employeeName(row.employeeId, row.employee)}</bdi></td>}<td className="px-5 py-4 text-slate-600">{date(row.date)}</td><td className="px-5 py-4"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass[row.status]}`}>{status(row.status)}</span></td><td className="whitespace-nowrap px-5 py-4 text-end font-semibold">{money(row.amount, row.currency)}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="text-xs leading-relaxed text-slate-600">{t("reports.definitions")} {t("reports.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
    </>}
  </div>;
}
