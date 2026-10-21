import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServiceRating from "@/components/service-rating";
import { useCategories } from "@/hooks/use-categories";
import { serviceAmount } from "@/components/forms-locale";
import { getProviderName } from "@shared/provider";
import { currentLocation } from "@shared/locations";
import type { ServiceWithProvider } from "@shared/schema";

export default function SearchServiceCard({ service: source, onViewDetails, onViewProvider, hasLocation }: {
  service: ServiceWithProvider; onViewDetails: () => void; onViewProvider?: () => void; hasLocation: boolean;
}) {
  const { t, i18n } = useTranslation();
  const categories = useCategories();
  const service = currentLocation(source);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const provider = getProviderName(service.provider);
  return <article className="search-service-card">
    <div className="search-service-art" aria-hidden="true">{service.imageUrl && failedImage !== service.imageUrl ? <img src={service.imageUrl} alt="" loading="lazy" onError={() => setFailedImage(service.imageUrl)} /> : <Leaf />}</div>
    <div className="search-service-body">
      <div className="search-service-top"><span className="search-category-name">{categories.data?.find(category => category.key === service.category)?.name ?? service.category}</span><ServiceRating service={service} /></div>
      <h3><button type="button" className="search-service-title" data-testid={`button-view-details-${service.id}`} onClick={onViewDetails}><bdi>{service.name}</bdi></button></h3>
      <div className="search-provider-row">{service.storefrontSlug ? <Link href={`/providers/${service.storefrontSlug}`}><bdi>{provider}</bdi></Link> : onViewProvider ? <button type="button" data-testid={`button-provider-${service.id}`} onClick={onViewProvider} aria-label={t("catalog.view", { name: provider })}><bdi>{provider}</bdi></button> : <span><bdi>{provider}</bdi></span>}{hasLocation && typeof service.distance === "number" && Number.isFinite(service.distance) && <span data-testid={`text-distance-${service.id}`}>· {t("searchPage.distanceAway", { distance: new Intl.NumberFormat(i18n.resolvedLanguage).format(service.distance) })}</span>}</div>
      {service.employee?.name && <p className="search-service-description">{t("searchPage.withEmployee", { name: service.employee.name })}</p>}
      {service.description && <p className="search-service-description search-description-clamp">{service.description}</p>}
      <div className="search-service-meta"><span>{t("searchPage.durationValue", { duration: service.duration })}</span><span aria-hidden="true">·</span><span>{t(service.serviceType === "group" ? "searchPage.group" : "searchPage.individual")}</span><span className={`search-booking-badge ${service.instantBooking ? "instant" : ""}`}>{t(service.instantBooking ? "searchPage.instant" : "searchPage.approval")}</span></div>
      <div className="search-card-actions"><div className="search-price"><strong>{serviceAmount(Number(service.price), i18n.resolvedLanguage || i18n.language)}</strong>{service.serviceType === "group" && <span>{t("searchPage.perPerson")}</span>}</div><Button type="button" onClick={onViewDetails}>{t("searchPage.details")}</Button></div>
    </div>
  </article>;
}
