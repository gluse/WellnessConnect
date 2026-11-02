import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { Employee, Service } from "@shared/schema";
import ProviderServiceCard from "@/components/provider/provider-service-card";
import { Button } from "@/components/ui/button";

export default function ServicesList({ services, providerName, view, employees, editable, copyingId, copyBusy, onCopy }: {
  services: Service[]; providerName: string; view: "list" | "grid"; employees: Employee[]; editable: boolean; copyingId?: number; copyBusy: boolean; onCopy: (id: number) => void;
}) {
  const { t } = useTranslation();
  if (!services.length) return <div className="search-state" role="status">
    <h3>{t("providerServices.empty")}</h3>
    <p>{t(editable ? "providerServices.emptyHelp" : "providerServices.assignedHelp")}</p>
    {editable && <Button asChild><Link href="/my-services/services/new">{t("provider.addService")}</Link></Button>}
  </div>;
  return <div className={`search-cards search-cards-${view}`} data-testid="provider-service-results">{services.map(service => <ProviderServiceCard key={service.id} service={service} providerName={providerName} employees={employees} editable={editable} copying={copyBusy && copyingId === service.id} copyBusy={copyBusy} onCopy={() => onCopy(service.id)} />)}</div>;
}
