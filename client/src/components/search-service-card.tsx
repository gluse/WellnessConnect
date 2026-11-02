import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import ServiceRating from "@/components/service-rating";
import ServiceResultCard from "@/components/service-result-card";
import { useCategories } from "@/hooks/use-categories";
import { getProviderName } from "@shared/provider";
import { currentLocation } from "@shared/locations";
import type { ServiceWithProvider } from "@shared/schema";

export default function SearchServiceCard({ service: source, onViewDetails, onViewProvider, hasLocation }: {
  service: ServiceWithProvider; onViewDetails: () => void; onViewProvider?: () => void; hasLocation: boolean;
}) {
  const { t } = useTranslation();
  const categories = useCategories();
  const service = currentLocation(source);
  const provider = getProviderName(service.provider);
  return <ServiceResultCard service={service} onViewDetails={onViewDetails} employeeName={service.employee?.name}
    category={categories.data?.find(category => category.key === service.category)?.name ?? service.category}
    distance={hasLocation ? service.distance : undefined}
    rating={<ServiceRating service={service} compact />}
    provider={service.storefrontSlug ? <Link href={`/providers/${service.storefrontSlug}`}><bdi>{provider}</bdi></Link> : onViewProvider ? <button type="button" data-testid={`button-provider-${service.id}`} onClick={onViewProvider} aria-label={t("catalog.view", { name: provider })}><bdi>{provider}</bdi></button> : <span><bdi>{provider}</bdi></span>} />;
}
