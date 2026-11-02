import { useTranslation } from "react-i18next";
import type { SearchFilters } from "@/components/service-filters";

export function searchDates(filters: SearchFilters) {
  return { date: filters.date, dateEnd: filters.dateEnd, time: filters.time, timeEnd: filters.timeEnd, availableOnly: filters.availableOnly };
}

export default function SearchDateFields({ id, filters, onChange, error, disabled = false }: {
  id: string; filters: SearchFilters; onChange: (changes: Partial<SearchFilters>) => void; error?: string; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return <>
    <div className="search-date-grid">{(["date", "dateEnd", "time", "timeEnd"] as const).map((key, index) => <div key={key}>
      <label htmlFor={`${id}-${key}`}>{t(`searchPage.${["fromDate", "toDate", "fromTime", "toTime"][index]}`)}</label>
      <input id={`${id}-${key}`} data-testid={`search-${key}`} type={index < 2 ? "date" : "time"} disabled={disabled}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : `${id}-help`} value={filters[key]} onChange={event => onChange({ [key]: event.target.value })} />
    </div>)}</div>
    <p id={`${id}-help`}>{t("searchPage.dateHelp")}</p>
    <label className="search-choice"><input type="checkbox" checked={filters.availableOnly} disabled={disabled} onChange={event => onChange({ availableOnly: event.target.checked })} /><span>{t("searchPage.availableOnly")}</span></label>
  </>;
}
