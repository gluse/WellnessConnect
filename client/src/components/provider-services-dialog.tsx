import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ServiceWithProvider } from "@shared/schema";
import { getProviderName } from "@shared/provider";
import { providerCatalogQuery } from "@shared/provider-catalog";
import ServiceCard from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CatalogProps {
  source: ServiceWithProvider;
  onBook: (service: ServiceWithProvider) => void;
  onViewDetails: (service: ServiceWithProvider) => void;
}

export function ProviderServicesList({ source, onBook, onViewDetails }: CatalogProps) {
  const { t } = useTranslation();
  const query = providerCatalogQuery(source);
  const services = useQuery<ServiceWithProvider[]>({
    queryKey: ["/api/services/catalog", query],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/services/catalog?${query}`, { signal });
      if (!response.ok) throw new Error("Unable to load provider services");
      return response.json();
    },
    staleTime: 0,
  });
  if (services.isLoading) return <p role="status">{t("catalog.loading")}</p>;
  if (services.isError) return <div role="alert" className="space-y-3">
    <p>{t("catalog.loadError")}</p>
    <Button variant="outline" disabled={services.isFetching} onClick={() => void services.refetch()}>{t("catalog.retry")}</Button>
  </div>;
  return <div className="space-y-4">
    <p className="text-sm text-neutral-500" role="status">{t("catalog.count", { count: services.data?.length ?? 0 })}</p>
    {!services.data?.length ? <p>{t("catalog.empty")}</p> : <div className="grid gap-4 lg:grid-cols-2">
      {services.data.map(service => <ServiceCard key={service.id} service={service}
        onBook={() => onBook(service)} onViewDetails={() => onViewDetails(service)} />)}
    </div>}
  </div>;
}

export default function ProviderServicesDialog({ source, open, onClose, onBook, onViewDetails }: Omit<CatalogProps, "source"> & {
  source: ServiceWithProvider | null; open: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!source) return null;
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="max-w-5xl max-h-[90dvh] overflow-y-auto" data-testid="dialog-provider-services">
      <DialogHeader>
        <DialogTitle className="break-words pr-6">{t("catalog.title", { name: getProviderName(source.provider) })}</DialogTitle>
        <DialogDescription>{t("catalog.description")}</DialogDescription>
      </DialogHeader>
      <ProviderServicesList source={source} onBook={onBook} onViewDetails={onViewDetails} />
      <Button variant="outline" onClick={onClose}>{t("catalog.back")}</Button>
    </DialogContent>
  </Dialog>;
}
