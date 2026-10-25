import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/use-categories";

export interface SearchFilters {
  category: string;
  searchQuery: string;
  searchMode: "exact" | "semantic";
  serviceType: string;
  ageGroups: string[];
  distance: number;
  date: string;
  dateEnd: string;
  time: string;
  timeEnd: string;
  availableOnly: boolean;
}

interface ServiceFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApply: () => boolean;
  onReset: () => void;
  error: string | undefined;
  pending: boolean;
  hasLocation?: boolean;
}

export default function ServiceFilters({ filters, onFiltersChange, onApply, onReset, error, pending, hasLocation = true }: ServiceFiltersProps) {
  const { t } = useTranslation();
  const categories = useCategories();
  const id = useId();
  const feedback = useRef<HTMLParagraphElement>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const update = (changes: Partial<SearchFilters>) => onFiltersChange({ ...filters, ...changes });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!onApply()) {
      setDatesOpen(true);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  const dateFields = ["date", "dateEnd", "time", "timeEnd"] as const;
  const errorField = error === "searchPage.invalidRadius" ? "distance" : error === "publicSearch.invalidTimes" ? "time" : "date";
  return <form className="search-filter-form" onSubmit={submit} noValidate aria-label={t("searchPage.filters")}>
    <div className="search-filter-heading"><h2>{t("searchPage.filters")}</h2><Button type="button" variant="ghost" onClick={onReset} disabled={pending}>{t("searchPage.reset")}</Button></div>
    <div className="search-filter-body">
      <div className="search-filter-section"><label htmlFor={`${id}-category`}>{t("searchPage.category")}</label>
        <select id={`${id}-category`} value={filters.category} onChange={event => update({ category: event.target.value })} data-testid="search-category"><option value="">{t("searchPage.allCategories")}</option>{categories.data?.map(category => <option key={category.key} value={category.key}>{category.icon} {category.name}</option>)}</select>
        {categories.isPending && <p role="status">{t("searchPage.categoriesLoading")}</p>}
        {categories.isError && <p role="alert">{t("searchPage.categoriesError")} <button type="button" className="search-text-button" onClick={() => void categories.refetch()}>{t("publicSearch.retry")}</button></p>}
      </div>
      <div className="search-filter-section"><label htmlFor={`${id}-distance`}>{t("searchPage.radius")}</label><div className="search-radius"><input id={`${id}-distance`} data-testid="input-distance" disabled={!hasLocation} type="number" inputMode="numeric" min={1} max={500} step={1} value={Number.isNaN(filters.distance) ? "" : filters.distance} onChange={event => update({ distance: event.target.value === "" ? NaN : Number(event.target.value) })} aria-invalid={errorField === "distance" && !!error} aria-describedby={errorField === "distance" && error ? `${id}-radius-help ${id}-error` : `${id}-radius-help`} /><span>km</span></div><p id={`${id}-radius-help`}>{t(hasLocation ? "searchPage.radiusHelp" : "searchLocation.browseHelp")}</p></div>
      <fieldset className="search-filter-section"><legend>{t("searchPage.sessionType")}</legend>{[["", "allTypes"], ["one_to_one", "individual"], ["group", "group"]].map(([value, key]) => <label className="search-choice" key={value}><input type="radio" name={`${id}-type`} value={value} checked={filters.serviceType === value} onChange={() => update({ serviceType: value })} /><span>{t(`searchPage.${key}`)}</span></label>)}</fieldset>
      <fieldset className="search-filter-section"><legend>{t("searchPage.audience")}</legend><div className="search-audience">{["children", "teens", "adults", "seniors"].map(age => <label className="search-choice" key={age}><input type="checkbox" checked={filters.ageGroups.includes(age)} onChange={event => update({ ageGroups: event.target.checked ? [...filters.ageGroups, age] : filters.ageGroups.filter(value => value !== age) })} /><span>{t(`searchPage.${age}`)}</span></label>)}</div></fieldset>
      <details className="search-filter-section" open={datesOpen} onToggle={event => setDatesOpen(event.currentTarget.open)}><summary>{t("searchPage.dateTime")}</summary><div className="search-date-grid">{dateFields.map((key, index) => <div key={key}><label htmlFor={`${id}-${key}`}>{t(`searchPage.${["fromDate", "toDate", "fromTime", "toTime"][index]}`)}</label><input id={`${id}-${key}`} data-testid={`search-${key}`} type={index < 2 ? "date" : "time"} aria-invalid={!!error && errorField !== "distance"} aria-describedby={error && errorField !== "distance" ? `${id}-error` : undefined} value={filters[key]} onChange={event => update({ [key]: event.target.value })} /></div>)}</div><p>{t("searchPage.dateHelp")}</p><label className="search-choice"><input type="checkbox" checked={filters.availableOnly} onChange={event => update({ availableOnly: event.target.checked })} /><span>{t("searchPage.availableOnly")}</span></label></details>
    </div>
    {error && <p ref={feedback} id={`${id}-error`} tabIndex={-1} role="alert" className="search-filter-error">{t(error)} <a href={`#${id}-${errorField}`} onClick={event => { event.preventDefault(); document.getElementById(`${id}-${errorField}`)?.focus(); }}>{t(errorField === "distance" ? "searchPage.radius" : errorField === "time" ? "searchPage.fromTime" : "searchPage.fromDate")}</a></p>}
    <div className="search-filter-actions"><Button type="submit" disabled={pending}>{t("searchPage.apply")}</Button></div>
  </form>;
}
