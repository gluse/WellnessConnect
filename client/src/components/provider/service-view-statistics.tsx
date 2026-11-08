import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ArrowDownToLine, BarChart3, Eye, List, LockKeyhole } from "lucide-react";
import { serviceViewCapabilitiesSchema, serviceViewReportSchema, type ServiceViewReport, type ServiceViewReportQuery, type ServiceViewEmployee } from "@shared/service-view-report";
import type { Employee } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { activeViewPro, allowedViewStatisticsPeriod, rankedViewStatistics, verifyViewStatistics, viewBarPercent, viewStatisticsPeriod } from "@/lib/service-view-statistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ServiceViewStatistics({ scope, company, canManageBilling }: { scope: string; company: boolean; canManageBilling: boolean }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(Date.now), [denied, setDenied] = useState(false);
  const capabilities = useQuery({ queryKey: ["/api/reports/service-views/capabilities", scope], gcTime: 0, staleTime: 0, retry: false, refetchOnMount: "always", refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) => serviceViewCapabilitiesSchema.parse(await (await apiRequest("GET", "/api/reports/service-views/capabilities", undefined, signal)).json()) });
  const pro = !denied && !capabilities.isError && activeViewPro(capabilities.data, now);
  const roster = useQuery<Employee[]>({ queryKey: ["/api/provider/employees", scope, "service-view-statistics"], enabled: company && pro && !capabilities.isFetching, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => (await apiRequest("GET", "/api/provider/employees", undefined, signal)).json() });
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null), [employee, setEmployee] = useState<ServiceViewEmployee>("all");
  const [result, setResult] = useState<ServiceViewReport | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false), [view, setView] = useState<"list" | "graph">("list");
  const request = useRef<AbortController | null>(null), generation = useRef(0), alive = useRef(true), access = useRef(false);
  access.current = pro && capabilities.data?.trackingEnabled === true;
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; request.current?.abort(); }; }, []);
  useEffect(() => { if (capabilities.data && !period) setPeriod(viewStatisticsPeriod(capabilities.data)); }, [capabilities.data, period]);
  useEffect(() => {
    if (pro && capabilities.data?.trackingEnabled) return;
    generation.current++; request.current?.abort(); setResult(null); setBusy(false);
  }, [pro, capabilities.data?.trackingEnabled]);
  useEffect(() => {
    const until = Math.min(Date.parse(capabilities.data?.proUntil ?? ""), result ? Date.parse(result.proUntil) : Infinity);
    if (!Number.isFinite(until) || until <= Date.now()) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      if (Date.now() >= until) { generation.current++; request.current?.abort(); setResult(null); setBusy(false); }
      void capabilities.refetch();
    }, Math.min(Math.max(0, until - Date.now() + 1), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [capabilities.data?.proUntil, result?.proUntil, now]);
  const locale = i18n.resolvedLanguage || i18n.language;
  const count = (value: string) => new Intl.NumberFormat(locale).format(BigInt(value));
  const employeeName = (id: number | null, name?: string | null) => id == null ? t("reports.unassigned") : name || roster.data?.find(item => item.id === id)?.name || t("reports.employeeFallback", { id });
  const invalid = period && capabilities.data ? !allowedViewStatisticsPeriod(period, capabilities.data) : true;
  const runnable = pro && capabilities.data?.trackingEnabled && !capabilities.isFetching && !busy && !invalid && (!company || roster.isSuccess);
  const visible = pro && !capabilities.isFetching && !capabilities.isError && capabilities.data?.trackingEnabled && result && Date.parse(result.proUntil) > now ? result : null;
  const rows = visible ? rankedViewStatistics(visible.rows) : [];
  const employeeScope = (value: ServiceViewEmployee) => value === "all" ? t("reports.allEmployees") : value === "unassigned" ? t("reports.unassigned") : employeeName(Number(value));
  const run = async () => {
    if (!runnable || !period) return;
    const current = ++generation.current;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const fresh = await capabilities.refetch();
      if (!alive.current || current !== generation.current) return;
      if (fresh.isError || !fresh.data) throw Error("Capability unavailable");
      if (!activeViewPro(fresh.data)) { setDenied(true); return; }
      if (!fresh.data.trackingEnabled) { setError("reports.viewsUnavailable"); return; }
      if (!allowedViewStatisticsPeriod(period, fresh.data)) { setError("reports.viewsPeriodError"); return; }
      const query: ServiceViewReportQuery = { ...period, employee };
      const data = serviceViewReportSchema.parse(await (await apiRequest("GET", `/api/reports/service-views?${new URLSearchParams(query)}`, undefined, controller.signal)).json());
      if (!alive.current || controller.signal.aborted || current !== generation.current || !access.current || !activeViewPro(fresh.data) || Date.parse(data.proUntil) <= Date.now()) return;
      setResult(verifyViewStatistics(data, query));
    } catch (failure) {
      if (!alive.current || controller.signal.aborted || current !== generation.current) return;
      if (failure instanceof Error && failure.message.startsWith("403:") && failure.message.includes("pro_required")) { setDenied(true); void capabilities.refetch(); }
      else setError(failure instanceof Error && failure.message.includes("tracking_unavailable") ? "reports.viewsUnavailable" : "reports.loadError");
    } finally { if (alive.current && current === generation.current) setBusy(false); }
  };
  const download = async (format: "csv" | "xlsx" | "pdf") => {
    if (!visible || exporting || !access.current || Date.parse(visible.proUntil) <= Date.now()) return;
    setExporting(true); setError("");
    try {
      const { reportCsv, reportXlsx, reportPdf, downloadReport } = await import("@/lib/report-downloads");
      const document = { title: t("reports.serviceViews"), subtitle: `${visible.from} — ${visible.to} · UTC${company ? ` · ${employeeScope(visible.employee)}` : ""}`,
        note: `${t("reports.viewsDefinition")} ${t("reports.viewsCoverage")}`,
        summary: [[t("reports.viewsTotal"), BigInt(visible.totalViews)]],
        columns: [t("reports.service"), t("reports.serviceId"), ...(company ? [t("reports.employee")] : []), t("reports.viewsCount")],
        rows: rows.map(row => [row.service, row.serviceId, ...(company ? [employeeName(row.employeeId, row.employeeName)] : []), BigInt(row.views)]) };
      const blob = format === "csv" ? reportCsv(document) : format === "xlsx" ? reportXlsx(document) : await reportPdf(document);
      if (alive.current && access.current && activeViewPro(capabilities.data) && Date.parse(visible.proUntil) > Date.now()) downloadReport(blob, `service-views-${visible.from}-${visible.to}.${format}`);
    } catch { if (alive.current) setError("reports.exportError"); } finally { if (alive.current) setExporting(false); }
  };
  const table = () => <div className="max-h-[36rem] overflow-auto" tabIndex={0} role="region" aria-label={t("reports.results")}><table className="w-full min-w-[480px] text-sm"><caption className="sr-only">{t("reports.serviceViews")} · UTC</caption><thead className="bg-slate-50"><tr>{["service", ...(company ? ["employee"] : []), "viewsCount"].map(key => <th key={key} scope="col" className="px-4 py-3 text-start font-medium">{t(`reports.${key}`)}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.serviceId} className="border-t" data-service-view-row data-service-id={row.serviceId}><th scope="row" className="max-w-xs break-words px-4 py-3 text-start font-medium"><bdi>{row.service}</bdi><span className="mt-1 block text-xs font-normal text-slate-600">{t("reports.serviceId")}: {row.serviceId}</span></th>{company && <td className="max-w-xs break-words px-4 py-3"><bdi>{employeeName(row.employeeId, row.employeeName)}</bdi></td>}<td className="px-4 py-3 font-semibold tabular-nums" data-view-count={row.views}>{count(row.views)}</td></tr>)}</tbody></table></div>;
  return <section className="min-w-0 space-y-4" data-testid="service-view-statistics">
    <div className="rounded-2xl border bg-white p-4 sm:p-5"><h2 className="font-semibold">{t("reports.serviceViews")}</h2><p className="mt-2 text-sm text-slate-600">{t("reports.viewsDefinition")}</p><p className="mt-2 text-xs leading-relaxed text-slate-600">{t("reports.viewsCoverage")}</p></div>
    {capabilities.isPending ? <p role="status">{t("reports.loading")}</p> : capabilities.isError ? <div role="alert" className="rounded-xl border bg-white p-4"><p>{t("reports.viewsAccessError")}</p><Button className="mt-3 min-h-11" variant="outline" onClick={() => void capabilities.refetch()}>{t("reports.retry")}</Button></div> : !pro ? <div className="rounded-2xl border bg-white p-5" data-testid="service-views-locked"><LockKeyhole aria-hidden="true" className="mb-3 h-6 w-6 text-primary" /><h3 className="font-semibold">{t("reports.viewsProRequired")}</h3><p className="mt-2 text-sm text-slate-600">{t(canManageBilling ? "reports.viewsProHelp" : "reports.viewsAskOwner")}</p><div className="mt-4 flex flex-wrap gap-3">{canManageBilling && <Button asChild className="min-h-11"><Link href="/my-services/settings/billing">{t("monthlyBilling.title")}</Link></Button>}<Button variant="outline" className="min-h-11" onClick={() => { setDenied(false); void capabilities.refetch(); }}>{t("reports.retry")}</Button></div></div> : !capabilities.data?.trackingEnabled ? <p role="status" className="rounded-xl border bg-white p-5">{t("reports.viewsUnavailable")}</p> : <>
      <form className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5" onSubmit={event => { event.preventDefault(); void run(); }}>
        <div className="flex flex-wrap gap-2">{(["week", "month"] as const).map(preset => <Button key={preset} type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setPeriod(viewStatisticsPeriod(capabilities.data!, preset))}>{t(preset === "week" ? "reports.thisWeek" : "reports.thisMonth")}</Button>)}</div>
        <p className="text-xs text-slate-600">{t("reports.viewsWindow", { from: capabilities.data.availableFrom, to: capabilities.data.availableTo })}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">{(["from", "to"] as const).map(field => <div key={field} className="min-w-0 space-y-2"><Label htmlFor={`view-report-${field}`}>{t(`reports.${field}`)} (UTC)</Label><Input id={`view-report-${field}`} type="date" required min={capabilities.data!.availableFrom} max={capabilities.data!.availableTo} value={period?.[field] ?? ""} disabled={busy} aria-invalid={invalid || undefined} aria-describedby={invalid ? "view-period-error" : undefined} className="min-h-11 min-w-0" onChange={event => setPeriod(previous => ({ from: previous?.from ?? "", to: previous?.to ?? "", [field]: event.target.value }))} /></div>)}<Button type="submit" className="min-h-11" disabled={!runnable} data-testid="run-service-views">{t("reports.show")}</Button></div>
        {invalid && <p id="view-period-error" role="alert" className="text-sm text-red-700">{t("reports.viewsPeriodError")}</p>}
        {company && <div className="space-y-2"><Label htmlFor="view-report-employee" className="block">{t("reports.employee")}</Label><select id="view-report-employee" value={employee} className="min-h-11 w-full max-w-full rounded-lg border border-slate-500 bg-white px-3 text-sm sm:max-w-md" disabled={busy || roster.isPending || roster.isError} onChange={event => setEmployee(event.target.value as ServiceViewEmployee)}><option value="all">{t("reports.allEmployees")}</option>{roster.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="unassigned">{t("reports.unassigned")}</option></select>{roster.isError && <p role="alert" className="text-sm text-red-700">{t("reports.loadError")} <Button type="button" variant="outline" className="min-h-11" onClick={() => void roster.refetch()}>{t("reports.retry")}</Button></p>}<p className="text-xs text-slate-600">{t("reports.viewsEmployeeHelp")}</p></div>}
        {visible && period && (period.from !== visible.from || period.to !== visible.to || employee !== visible.employee) && <p role="status" className="text-xs text-slate-600">{t("reports.unapplied")}</p>}
      </form>
      {(busy || capabilities.isFetching) && <p role="status">{t("reports.loading")}</p>}
      {error && <p role="alert" className="rounded-xl border bg-white p-4 text-sm text-red-700">{t(error)}</p>}
      {visible && <><section className="max-w-sm rounded-xl border bg-white p-4" aria-label={t("reports.viewsTotal")}><div className="flex items-center gap-2 text-sm text-slate-600"><Eye aria-hidden="true" className="h-4 w-4" /><h3>{t("reports.viewsTotal")}</h3></div><p className="mt-2 break-words text-2xl font-bold tabular-nums" data-testid="service-views-total">{count(visible.totalViews)}</p></section><section className="min-w-0 overflow-hidden rounded-2xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><p className="min-w-0 break-words text-sm text-slate-600">{visible.from} — {visible.to} · UTC{company && <> · <bdi>{employeeScope(visible.employee)}</bdi></>}</p><div className="flex flex-wrap gap-2"><div role="group" aria-label={t("reports.view")} className="flex rounded-lg border p-1">{(["list", "graph"] as const).map(value => <Button key={value} variant={view === value ? "secondary" : "ghost"} size="icon" className="h-11 w-11" aria-label={t(`reports.${value}`)} aria-pressed={view === value} onClick={() => setView(value)}>{value === "list" ? <List aria-hidden="true" className="h-4 w-4" /> : <BarChart3 aria-hidden="true" className="h-4 w-4" />}</Button>)}</div>{(["pdf", "xlsx", "csv"] as const).map(format => <Button key={format} variant="outline" className="min-h-11" disabled={exporting || !rows.length} data-testid={`views-export-${format}`} onClick={() => void download(format)}><ArrowDownToLine aria-hidden="true" className="me-1 h-4 w-4" />{format.toUpperCase()}</Button>)}</div></div>
        {!rows.length ? <p className="p-8 text-center text-slate-600">{t("reports.noServices")}</p> : view === "list" ? table() : <div className="space-y-4 p-4"><ul className="max-h-[36rem] space-y-4 overflow-auto" aria-label={t("reports.serviceViews")} data-testid="service-views-graph">{rows.map(row => <li key={row.serviceId} className="space-y-2" data-view-bar={row.serviceId}><div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><span className="min-w-0 break-words"><bdi>{row.service}</bdi> <span className="text-xs text-slate-600">#{row.serviceId}</span></span><span className="break-words font-semibold tabular-nums" data-view-count={row.views}>{count(row.views)}</span></div><div className="h-3 overflow-hidden rounded bg-primary/10" aria-hidden="true"><div className="h-full rounded bg-primary" style={{ width: `${viewBarPercent(row.views, rows[0].views)}%` }} /></div></li>)}</ul><details className="rounded-lg border"><summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">{t("reports.graphData")}</summary>{table()}</details></div>}
      </section></>}
    </>}
  </section>;
}
