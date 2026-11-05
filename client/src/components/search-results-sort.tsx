import { useTranslation } from "react-i18next";
import { ArrowDownUp } from "lucide-react";
import type { ServiceSort } from "@/lib/service-sort";

interface SearchResultsSortProps {
  value: ServiceSort;
  onChange: (value: ServiceSort) => void;
  hasLocation: boolean;
  hasRatings: boolean;
  priceSortAvailable?: boolean;
  compact?: boolean;
  mobileLayout?: boolean;
}

export default function SearchResultsSort({ value, onChange, hasLocation, hasRatings, priceSortAvailable = true, compact = false, mobileLayout = false }: SearchResultsSortProps) {
  const { t } = useTranslation();
  return (
    <div className={compact ? "search-compact-sort" : "space-y-1"}>
      <label htmlFor="service-sort" className="block text-sm font-medium text-neutral-700">{mobileLayout && <ArrowDownUp aria-hidden="true" />}<span>{t(mobileLayout ? "searchPage.sortAction" : "sorting.label")}</span>{mobileLayout && value !== "default" && <span className="search-sort-indicator" aria-hidden="true" />}</label>
      <select
        id="service-sort"
        data-testid="select-service-sort"
        value={value}
        onChange={event => onChange(event.target.value as ServiceSort)}
        aria-describedby="service-sort-help"
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
      >
        <option value="default">{t("sorting.default")}</option>
        <option value="distance-asc" disabled={!hasLocation}>{t("sorting.distanceAsc")}</option>
        <option value="distance-desc" disabled={!hasLocation}>{t("sorting.distanceDesc")}</option>
        <option value="price-asc" disabled={!priceSortAvailable}>{t("sorting.priceAsc")}</option>
        <option value="price-desc" disabled={!priceSortAvailable}>{t("sorting.priceDesc")}</option>
        <option value="rating-asc">{t("sorting.ratingAsc")}</option>
        <option value="rating-desc">{t("sorting.ratingDesc")}</option>
      </select>
      <p id="service-sort-help" className={compact ? "sr-only" : "text-xs text-neutral-500"} aria-live="polite">
        {!hasLocation && t("sorting.locationRequired")}
        {!hasLocation && !hasRatings && " "}
        {!hasRatings && t("sorting.ratingsUnavailable")}
        {!priceSortAvailable && " " + t("currency.mixedSort")}
      </p>
    </div>
  );
}
