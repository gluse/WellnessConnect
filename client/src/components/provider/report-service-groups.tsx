import { useTranslation } from "react-i18next";
import type { ServiceReportGroup } from "@/lib/service-report";

export default function ReportServiceGroups({ groups, money }: {
  groups: ServiceReportGroup[]; money: (amount: string, currency: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const count = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language).format(value);
  const metrics = ["earned", "planned", "pending", "lost"] as const;
  const statuses = ["completed", "confirmed", "pending", "cancelled"] as const;
  const counts = (row: ServiceReportGroup) => <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">{statuses.map(status => <div key={status} className="flex gap-1"><dt>{t(`reports.${status}`)}</dt><dd>{count(row[`${status}Count`])}</dd></div>)}</dl>;
  const name = (row: ServiceReportGroup) => <><bdi>{row.service}</bdi><span className="mt-1 block text-xs font-normal text-slate-600">{t("reports.serviceId")}: {row.serviceId} · {row.currency}</span>{!row.bookingCount && <span className="mt-2 block text-xs font-medium text-amber-900">{t("reports.noBookings")}</span>}</>;
  if (!groups.length) return <p className="p-8 text-center text-slate-600">{t("reports.noServices")}</p>;
  return <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("reports.results")}><table className="w-full min-w-[900px] text-start text-sm"><caption className="sr-only">{t("reports.byService")}</caption>
    <thead className="bg-slate-50 text-slate-600"><tr>{["service", "bookings", ...metrics].map(key => <th key={key} scope="col" className={`px-5 py-3 font-medium ${key === "service" || key === "bookings" ? "text-start" : "text-end"}`}>{t(`reports.${key}`)}</th>)}</tr></thead>
    <tbody className="divide-y">{groups.map(row => <tr key={`${row.serviceId}:${row.currency}`} className="hover:bg-slate-50" data-report-group data-service-id={row.serviceId} data-currency={row.currency}>
      <th scope="row" className="max-w-xs break-words px-5 py-4 text-start font-medium">{name(row)}</th><td className="px-5 py-4"><span className="font-semibold">{count(row.bookingCount)}</span>{counts(row)}</td>{metrics.map(key => <td key={key} className="whitespace-nowrap px-5 py-4 text-end font-semibold" data-group-metric={key}>{money(row[key], row.currency)}</td>)}
    </tr>)}</tbody></table></div>;
}
