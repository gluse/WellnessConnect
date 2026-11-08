import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { formatMoney } from "@/lib/money";
import { dailyReportGraphs, serviceReportGraphs, formatReportGraphTick, reportGraphMetrics, type ReportGraphMetric, type ReportGraphPanel } from "@/lib/report-graph";
import type { ReportRow, ServiceReportGroup } from "@/lib/service-report";

const colors = { earned: "#047857", planned: "#6d28d9", pending: "#b45309", lost: "#be123c" };
function StatusPattern({ id, metric }: { id: string; metric: ReportGraphMetric }) {
  return <pattern id={id} patternUnits="userSpaceOnUse" width={8} height={8}>
    <rect width={8} height={8} fill={colors[metric]} />
    {metric === "planned" && <path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="white" strokeWidth={1.3} />}
    {metric === "pending" && <circle cx={4} cy={4} r={1.1} fill="white" />}
    {metric === "lost" && <path d="M0 4H8M4 0V8" stroke="white" strokeWidth={1} />}
  </pattern>;
}

export default function ReportGraphs({ rows, groups, byService }: { rows: ReportRow[]; groups: ServiceReportGroup[]; byService: boolean }) {
  const { t } = useTranslation();
  const panels = useMemo(() => byService ? serviceReportGraphs(groups) : dailyReportGraphs(rows), [rows, groups, byService]);
  if (!panels.length) return <p className="p-8 text-center text-slate-600" role="status">{t(byService ? "reports.noServices" : "reports.empty")}</p>;
  return <div className="space-y-5 p-3 sm:p-5" data-testid="report-graphs"><p className="text-sm text-slate-600">{t(byService ? "reports.serviceGraphHelp" : "reports.dailyGraphHelp")} {t("reports.graphHelp")}</p>{panels.map(panel => <ReportGraphPanelView key={panel.currency} panel={panel} byService={byService} />)}</div>;
}

function ReportGraphPanelView({ panel, byService }: { panel: ReportGraphPanel; byService: boolean }) {
  const { t, i18n } = useTranslation();
  const id = useId().replace(/:/g, ""), locale = i18n.resolvedLanguage || i18n.language;
  const viewport = useRef<HTMLDivElement>(null), [plotWidth, setPlotWidth] = useState(0);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => setPlotWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const narrow = plotWidth < 520, nameLimit = narrow ? 8 : 18;
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const amount = (value: string) => formatMoney(value, panel.currency, locale) ?? t("currency.unavailable");
  const pointName = (point: ReportGraphPanel["points"][number]) => byService ? `${point.service} #${point.serviceId}` : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${point.date}T12:00:00`));
  const data = panel.points.map(point => ({ ...point, label: pointName(point), axis: byService
    ? `${(point.service ?? "").slice(0, nameLimit)}${(point.service?.length ?? 0) > nameLimit ? "…" : ""} #${point.serviceId} · ${count(point.bookingCount)}`
    : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(`${point.date}T12:00:00`)),
    earnedValue: Number(point.earned), plannedValue: Number(point.planned), pendingValue: Number(point.pending), lostValue: Number(point.lost) }));
  const compact = (value: number) => formatReportGraphTick(value, locale);
  const height = byService ? Math.max(300, data.length * 100 + 50) : 320;
  const config = Object.fromEntries(reportGraphMetrics.map(key => [key, { label: t(`reports.${key}`), color: colors[key] }]));
  return <section className="min-w-0 rounded-xl border bg-white p-3 sm:p-4" aria-labelledby={`${id}-title`} data-graph-currency={panel.currency}>
    <h3 id={`${id}-title`} className="font-semibold">{t(byService ? "reports.serviceGraph" : "reports.dailyGraph")} · {panel.currency}</h3>
    <ul className="my-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700" aria-label={t("reports.graphLegend")}>{reportGraphMetrics.map(key => <li key={key} className="flex items-center gap-2"><svg width={12} height={12} className="shrink-0" aria-hidden="true"><defs><StatusPattern id={`${id}-legend-${key}`} metric={key} /></defs><rect width={12} height={12} rx={2} fill={`url(#${id}-legend-${key})`} /></svg>{t(`reports.${key}`)}</li>)}</ul>
    <p className="mb-2 text-xs text-slate-600">{t("reports.amount")} ({panel.currency})</p>
    <div ref={viewport} className="max-w-full overflow-auto rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" style={{ maxHeight: byService ? 560 : undefined }} tabIndex={0} role="region" aria-label={t("reports.graphScroll")} data-graph-scroll>
      <div style={{ minWidth: !byService && data.length > 7 ? data.length * 70 + 85 : 0 }}>
        <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
          <BarChart data={data} layout={byService ? "vertical" : "horizontal"} accessibilityLayer title={`${t(byService ? "reports.serviceGraph" : "reports.dailyGraph")} ${panel.currency}`} margin={{ top: 12, right: 20, bottom: 12, left: 8 }} barGap={2}>
            <defs>
              {reportGraphMetrics.map(key => <StatusPattern key={key} id={`${id}-${key}`} metric={key} />)}
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={!byService} vertical={byService} />
            {byService ? <><XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11 }} tickCount={narrow ? 3 : 5} allowDecimals /><YAxis type="category" dataKey="axis" width={narrow ? 120 : 200} tick={{ fontSize: 11 }} interval={0} /></>
              : <><XAxis dataKey="axis" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} /><YAxis tickFormatter={compact} width={65} tick={{ fontSize: 11 }} /></>}
            <Tooltip isAnimationActive={false} content={({ active, payload }) => {
              const point = payload?.[0]?.payload as typeof data[number] | undefined;
              if (!active || !point) return null;
              return <div className="max-w-xs rounded-lg border bg-white p-3 text-xs shadow-md" role="status"><p className="mb-2 font-semibold"><bdi>{point.label}</bdi></p>{reportGraphMetrics.map(key => <p key={key}>{t(`reports.${key}`)}: {amount(point[key])}</p>)}<p className="mt-2">{t("reports.bookingCount", { count: point.bookingCount })}</p></div>;
            }} />
            {reportGraphMetrics.map(key => <Bar key={key} dataKey={`${key}Value`} name={t(`reports.${key}`)} fill={`url(#${id}-${key})`} stroke={colors[key]} maxBarSize={24} isAnimationActive={false} />)}
          </BarChart>
        </ChartContainer>
      </div>
    </div>
    <details className="mt-3 rounded-lg border" data-graph-data>
      <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t("reports.graphData")}</summary>
      <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-label={t("reports.graphData")}><table className="w-full min-w-[700px] text-sm"><caption className="sr-only">{t("reports.graphData")} · {panel.currency}</caption><thead><tr>{[byService ? "service" : "date", "bookings", ...reportGraphMetrics].map(key => <th key={key} scope="col" className="px-3 py-2 text-start font-medium">{t(`reports.${key}`)}</th>)}</tr></thead><tbody>{panel.points.map(point => <tr key={point.key} className="border-t" data-graph-point data-service-id={point.serviceId} data-date={point.date}>
        <th scope="row" className="max-w-xs break-words px-3 py-2 text-start font-medium"><bdi>{pointName(point)}</bdi>{!point.bookingCount && <span className="mt-1 block text-xs text-slate-600">{t("reports.noBookings")}</span>}</th><td className="px-3 py-2" data-graph-count>{count(point.bookingCount)}</td>{reportGraphMetrics.map(key => <td key={key} className="whitespace-nowrap px-3 py-2" data-graph-metric={key} data-amount={point[key]}>{amount(point[key])}</td>)}
      </tr>)}</tbody></table></div>
    </details>
  </section>;
}
