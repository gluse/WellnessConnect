import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { durationInMinutes, durationUnits, minutesPerUnit, preferredDurationUnit, type DurationUnit } from "@/lib/service-duration";
import type { ServiceDraft } from "./service-draft";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";

export default function ServiceDurationField({ newService, setNewService, errors, field = "duration" }: {
  newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; errors: ServiceErrors; field?: "duration" | "cleanupTime";
}) {
  const { t } = useTranslation();
  const [unit, setUnit] = useState(() => preferredDurationUnit(newService[field]));
  // Text plus decimal input mode preserves drafts when the document language changes.
  const [value, setValue] = useState(() => String(newService[field] / minutesPerUnit[unit]));
  return <div className="space-y-2 min-w-0">
    <div className="grid grid-cols-2 gap-2 items-end">
      <div className="space-y-2 min-w-0">
        <Label id={`${field}-label`} htmlFor={field}>{t(field === "cleanupTime" ? "serviceCleanup.label" : "serviceDuration.label")} *</Label>
        <Input id={field} className="min-h-11" type="text" inputMode="decimal" required value={value}
          data-testid={field === "cleanupTime" ? "input-cleanup-time" : undefined}
          {...fieldFeedback(errors, field, `${field}-help`)}
          onChange={event => {
            const nextValue = event.target.value;
            setValue(nextValue);
            setNewService(previous => ({ ...previous, [field]: durationInMinutes(nextValue, unit) }));
          }} />
      </div>
      <div className="space-y-2 min-w-0">
        <Label id={`${field}-unit-label`} htmlFor={`${field}-unit`}>{t("serviceDuration.unit")}</Label>
        <select id={`${field}-unit`} className="w-full min-h-11 border rounded-md p-2 bg-background text-sm" value={unit}
          aria-labelledby={`${field}-label ${field}-unit-label`} aria-describedby={`${field}-help`} onChange={event => {
            const nextUnit = event.target.value as DurationUnit;
            setUnit(nextUnit);
            if (Number.isFinite(newService[field])) setValue(String(newService[field] / minutesPerUnit[nextUnit]));
          }}>
          {durationUnits.map(option => <option key={option} value={option}>{t(`serviceDuration.${option}`)}</option>)}
        </select>
      </div>
    </div>
    <div id={`${field}-help`} className="text-sm text-muted-foreground space-y-2">
      {field === "cleanupTime" && <p>{t("serviceCleanup.help")}</p>}
      <p>{t("serviceDuration.help")}</p>
    </div>
    <ServiceFieldError errors={errors} field={field} />
  </div>;
}
