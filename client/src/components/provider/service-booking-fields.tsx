import type { Dispatch, SetStateAction } from "react";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";
import ServiceDurationField from "./service-duration-field";

type Props = { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; errors?: ServiceErrors };
export default function ServiceBookingFields({ newService, setNewService, errors = {} }: Props) {
  const { t } = useTranslation();
  const numeric = (field: "maxCapacity" | "advancePaymentPercent", id: string, label: string, min: number, max?: number) => <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} className="min-h-11" type="number" min={min} max={max} step="1" required={field !== "advancePaymentPercent"}
      value={Number.isNaN(newService[field]) ? "" : newService[field]} {...fieldFeedback(errors, field)}
      onChange={event => setNewService(prev => ({ ...prev, [field]: event.target.value === "" ? (field === "advancePaymentPercent" ? 0 : NaN) : Number(event.target.value) }))}
      data-testid={field === "advancePaymentPercent" ? "input-advance-payment" : undefined} />
    <ServiceFieldError errors={errors} field={field} />
  </div>;
  return <div className="space-y-4">
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium mb-2">{t("filters.serviceType")}</legend>
      <div className="grid sm:grid-cols-2 gap-2">{["one_to_one", "group"].map(value => <label key={value} className="flex items-center gap-3 border rounded-lg min-h-11 p-3 has-[:checked]:border-primary">
        <input type="radio" name="serviceType" value={value} checked={newService.serviceType === value} className="accent-primary h-4 w-4 shrink-0"
          onChange={() => setNewService(prev => ({ ...prev, serviceType: value as ServiceDraft["serviceType"], maxCapacity: value === "one_to_one" ? 1 : 10 }))} />
        {t(value === "group" ? "filters.group" : "filters.oneToOne")}
      </label>)}</div>
    </fieldset>
    {newService.serviceType === "group" && numeric("maxCapacity", "maxCapacity", `${t("service.capacity")} *`, 1)}
    <div className="grid sm:grid-cols-2 gap-4">
      <ServiceDurationField newService={newService} setNewService={setNewService} errors={errors} />
      <ServiceDurationField field="cleanupTime" newService={newService} setNewService={setNewService} errors={errors} />
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2"><Label htmlFor="price">{t("serviceForm.price")} *</Label>
        <Input id="price" className="min-h-11" type="number" min="0" step="0.01" required value={newService.price} {...fieldFeedback(errors, "price")}
          onChange={event => setNewService(prev => ({ ...prev, price: event.target.value }))} />
        <ServiceFieldError errors={errors} field="price" />
      </div>
      {numeric("advancePaymentPercent", "advancePayment", t("serviceForm.advance"), 0, 100)}
    </div>
  </div>;
}

export function ServiceAudienceFields({ newService, setNewService }: Props) {
  const { t } = useTranslation();
  return <div className="space-y-4">
    <fieldset className="min-w-0"><legend className="text-sm font-medium mb-2">{t("serviceForm.ageGroups")}</legend>
      <div className="grid sm:grid-cols-2 gap-2">{["children", "teens", "adults", "seniors"].map(value => <label key={value} className="flex items-center gap-3 border rounded-lg min-h-11 p-3 has-[:checked]:border-primary">
        <input type="checkbox" className="accent-primary h-4 w-4 shrink-0" checked={newService.ageGroups.includes(value)} data-testid={`button-age-${value}`}
          onChange={() => setNewService(prev => ({ ...prev, ageGroups: prev.ageGroups.includes(value) ? prev.ageGroups.filter(group => group !== value) : [...prev.ageGroups, value] }))} />
        {t(`serviceForm.age_${value}`)}
      </label>)}</div>
    </fieldset>
    <fieldset className="min-w-0"><legend className="text-sm font-medium mb-2">{t("serviceForm.gender")}</legend>
      <div className="grid sm:grid-cols-3 gap-2">{["females", "males", "both"].map(value => <label key={value} className="flex items-center gap-3 border rounded-lg min-h-11 p-3 has-[:checked]:border-primary">
        <input type="radio" name="targetGender" className="accent-primary h-4 w-4 shrink-0" checked={newService.targetGender === value} data-testid={`button-gender-${value}`}
          onChange={() => setNewService(prev => ({ ...prev, targetGender: value as ServiceDraft["targetGender"] }))} />
        {t(`serviceForm.gender_${value}`)}
      </label>)}</div>
    </fieldset>
  </div>;
}
export function ServiceInstantBookingField({ newService, setNewService }: Props) {
  const { t } = useTranslation();
  return <div className="flex items-center justify-between gap-4">
    <Label htmlFor="instantBooking" className="py-3">{t("serviceForm.instantBooking")}</Label>
    <Switch id="instantBooking" checked={newService.instantBooking} onCheckedChange={checked => setNewService(prev => ({ ...prev, instantBooking: checked }))} />
  </div>;
}
