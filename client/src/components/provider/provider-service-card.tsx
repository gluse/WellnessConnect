import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import type { Employee, Service } from "@shared/schema";
import ServiceResultCard from "@/components/service-result-card";
import { Button } from "@/components/ui/button";

export default function ProviderServiceCard({ service, providerName, employees, editable, copying, copyBusy, onCopy }: {
  service: Service; providerName: string; employees: Employee[]; editable: boolean; copying: boolean; copyBusy: boolean; onCopy: () => void;
}) {
  const { t } = useTranslation();
  const employeeName = service.employeeId == null ? undefined : employees.find(employee => employee.id === service.employeeId)?.name || t("providerServices.assignedEmployee");
  return <div className="provider-service-item" data-testid={`provider-service-${service.id}`}>
    <ServiceResultCard service={service} provider={<bdi>{providerName}</bdi>} employeeName={employeeName} />
    <div className="provider-service-tools">
      <div className="provider-service-status"><span className={`provider-publication-badge ${service.isActive ? "published" : ""}`}>{t(service.isActive ? "providerServices.published" : "providerServices.inactive")}</span>
        {employeeName && <span className="provider-service-employee">{t("searchPage.withEmployee", { name: employeeName })}</span>}
      </div>
      {editable && <div className="provider-service-actions">
        <Button variant="ghost" size="sm" disabled={copyBusy} onClick={onCopy} data-testid={`button-copy-service-${service.id}`} aria-label={t("providerServices.copyService", { name: service.name })}><Copy className="w-4 h-4" aria-hidden="true" />{t(copying ? "providerServices.copying" : "providerServices.copy")}</Button>
        <Button asChild variant="outline" size="sm"><Link href={`/my-services/services/${service.id}/edit`} data-testid={`button-edit-service-${service.id}`} aria-label={t("providerServices.editService", { name: service.name })}>{t("common.edit")}</Link></Button>
      </div>}
    </div>
  </div>;
}
