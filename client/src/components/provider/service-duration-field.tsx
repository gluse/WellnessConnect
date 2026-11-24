import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { durationInMinutes, durationUnits, minutesPerUnit, preferredDurationUnit, type DurationUnit } from "@/lib/service-duration";
import type { ServiceDraft } from "./service-draft";
import type { ServiceErrors } from "./service-field-feedback";

export default function ServiceDurationField({ newService, setNewService, errors, field = "duration", idPrefix = "" }: {
  newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; errors: ServiceErrors; field?: "duration" | "cleanupTime"; idPrefix?: string;
}) {
  const { t } = useTranslation();
  const controlId = `${idPrefix}${field}`;
  const [unit, setUnit] = useState(() => preferredDurationUnit(newService[field]));
  // Text plus decimal input mode preserves drafts when the document language changes.
  const [value, setValue] = useState(() => String(newService[field] / minutesPerUnit[unit]));
  return <div className="space-y-2 min-w-0">
    <div className="grid grid-cols-2 gap-2 items-end">
      <div className="space-y-2 min-w-0">
        <Label id={`${controlId}-label`} htmlFor={controlId}>{t(field === "cleanupTime" ? "serviceCleanup.label" : "serviceDuration.label")} *</Label>
        <Input id={controlId} className="min-h-11" type="text" inputMode="decimal" required value={value}
          data-testid={field === "cleanupTime" ? "input-cleanup-time" : undefined}
          aria-invalid={Boolean(errors[field]) || undefined} aria-describedby={`${controlId}-help${errors[field] ? ` ${controlId}-error` : ""}`}
          onChange={event => {
            const nextValue = event.target.value;
            setValue(nextValue);
            setNewService(previous => ({ ...previous, [field]: durationInMinutes(nextValue, unit) }));
          }} />
      </div>
      <div className="space-y-2 min-w-0">
        <Label id={`${controlId}-unit-label`} htmlFor={`${controlId}-unit`}>{t("serviceDuration.unit")}</Label>
        <select id={`${controlId}-unit`} className="w-full min-h-11 border rounded-md p-2 bg-background text-sm" value={unit}
          aria-labelledby={`${controlId}-label ${controlId}-unit-label`} aria-describedby={`${controlId}-help`} onChange={event => {
            const nextUnit = event.target.value as DurationUnit;
            setUnit(nextUnit);
            if (Number.isFinite(newService[field])) setValue(String(newService[field] / minutesPerUnit[nextUnit]));
          }}>
          {durationUnits.map(option => <option key={option} value={option}>{t(`serviceDuration.${option}`)}</option>)}
        </select>
      </div>
    </div>
    <div id={`${controlId}-help`} className="text-sm text-muted-foreground space-y-2">
      {field === "cleanupTime" && <p>{t("serviceCleanup.help")}</p>}
      <p>{t("serviceDuration.help")}</p>
    </div>
    {errors[field] && <p id={`${controlId}-error`} className="text-sm text-red-700 dark:text-red-300">{errors[field]}</p>}
  </div>;
}
