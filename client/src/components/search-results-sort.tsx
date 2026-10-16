import { useTranslation } from "react-i18next";
import type { ServiceSort } from "@/lib/service-sort";

interface SearchResultsSortProps {
  value: ServiceSort;
  onChange: (value: ServiceSort) => void;
  hasLocation: boolean;
  hasRatings: boolean;
}

export default function SearchResultsSort({ value, onChange, hasLocation, hasRatings }: SearchResultsSortProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <label htmlFor="service-sort" className="block text-sm font-medium text-neutral-700">{t("sorting.label")}</label>
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
        <option value="price-asc">{t("sorting.priceAsc")}</option>
        <option value="price-desc">{t("sorting.priceDesc")}</option>
        <option value="rating-asc">{t("sorting.ratingAsc")}</option>
        <option value="rating-desc">{t("sorting.ratingDesc")}</option>
      </select>
      <p id="service-sort-help" className="text-xs text-neutral-500" aria-live="polite">
        {!hasLocation && t("sorting.locationRequired")}
        {!hasLocation && !hasRatings && " "}
        {!hasRatings && t("sorting.ratingsUnavailable")}
      </p>
    </div>
  );
}
