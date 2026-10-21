import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@shared/schema";
import type { ServiceDraft } from "./service-draft";
import { Label } from "@/components/ui/label";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";

export default function ServiceLocationFields({ newService, setNewService, errors = {} }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; errors?: ServiceErrors }) {
  const { t } = useTranslation();
  const addresses = useQuery<Address[]>({ queryKey: ["/api/addresses"], refetchOnWindowFocus: "always" });
  return <div className="space-y-2">
    <Label htmlFor="service-address">{t("serviceForm.address")} *</Label>
    <select id="service-address" className="w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base" value={newService.addressId ?? ""}
      disabled={addresses.isLoading || addresses.isError} data-testid="select-service-address" {...fieldFeedback(errors, "addressId", "service-address-help service-address-status")}
      onChange={event => setNewService(prev => ({ ...prev, addressId: event.target.value ? Number(event.target.value) : null }))}>
      <option value="">{t(addresses.isLoading ? "serviceForm.addressesLoading" : "serviceForm.chooseAddress")}</option>
      {addresses.data?.map(address => <option key={address.id} value={address.id} dir="auto" disabled={!address.address}>{address.address || t("serviceForm.addressNeedsUpdate")}</option>)}
    </select>
    <ServiceFieldError errors={errors} field="addressId" />
    <div id="service-address-status" className="text-sm text-muted-foreground">
      {addresses.isLoading && <p role="status">{t("serviceForm.addressesLoading")}</p>}
      {addresses.isError && <p role="alert">{t("serviceForm.addressesError")} <button type="button" className="underline min-h-11" onClick={() => void addresses.refetch()}>{t("publicSearch.retry")}</button></p>}
      {addresses.data?.length === 0 && <p>{t("serviceForm.addressesEmpty")}</p>}
    </div>
    <p id="service-address-help" className="text-sm text-muted-foreground">{t("serviceForm.addressHelp")} <a href="/account#addresses" target="_blank" rel="noopener noreferrer" className="underline text-primary inline-block py-2">{t("serviceForm.manageAddresses")}</a></p>
  </div>;
}
