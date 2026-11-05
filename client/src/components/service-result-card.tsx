import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Leaf } from "lucide-react";
import type { Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import WishlistHeart from "@/components/wishlist-heart";
import { formatServiceDuration } from "@/lib/service-duration";

// Shared presentation for public Search and the provider's unpublished previews.
// An omitted details callback renders a read-only preview with no public writes.
export default function ServiceResultCard({ service, provider, rating, category, employeeName, distance, onViewDetails }: {
  service: Service; provider: ReactNode; rating?: ReactNode; category?: ReactNode; employeeName?: string | null;
  distance?: number; onViewDetails?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = service.imageUrl && failedImage !== service.imageUrl ? <img src={service.imageUrl} alt="" loading="lazy" onError={() => setFailedImage(service.imageUrl)} /> : <Leaf aria-hidden="true" />;
  return <article className="search-service-card">
  <div className="wishlist-image relative min-w-0 w-full">
    {onViewDetails ? <button type="button" className="search-service-art" onClick={onViewDetails} aria-label={service.name}>{image}</button> : <div className="search-service-art" aria-hidden="true">{image}</div>}
    {onViewDetails && <WishlistHeart serviceId={service.id} />}
  </div>
    <div className="search-service-body">
      {category && <div className="search-service-top"><span className="search-category-name">{category}</span></div>}
      <h3>{onViewDetails ? <button type="button" className="search-service-title" data-testid={`button-view-details-${service.id}`} onClick={onViewDetails}><bdi>{service.name}</bdi></button> : <bdi>{service.name}</bdi>}</h3>
      <div className="search-provider-row">{provider}{typeof distance === "number" && Number.isFinite(distance) && <span data-testid={`text-distance-${service.id}`}>· {t("searchPage.distanceAway", { distance: new Intl.NumberFormat(i18n.resolvedLanguage).format(distance) })}</span>}{rating && <span className="search-inline-rating">{rating}</span>}</div>
      {employeeName && <p className="search-service-description">{t("searchPage.withEmployee", { name: employeeName })}</p>}
      {service.description && <p className="search-service-description search-description-clamp">{service.description}</p>}
      <div className="search-service-meta"><span>{formatServiceDuration(service.duration, i18n.resolvedLanguage || i18n.language)}</span><span aria-hidden="true">·</span><span>{t(service.serviceType === "group" ? "searchPage.group" : "searchPage.individual")}</span><span className={`search-booking-badge ${service.instantBooking ? "instant" : ""}`}>{t(service.instantBooking ? "searchPage.instant" : "searchPage.approval")}</span></div>
      <div className="search-card-actions"><div className="search-price"><strong>{formatMoney(service.price, service.currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable")}</strong>{service.serviceType === "group" && <span>{t("searchPage.perPerson")}</span>}</div>{onViewDetails && <Button variant="ghost" type="button" onClick={onViewDetails}>{t("searchPage.details")}</Button>}</div>
    </div>
  </article>;
}
