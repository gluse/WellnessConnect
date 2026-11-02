import type { Dispatch, SetStateAction } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useNotificationCapabilities } from "@/hooks/use-notification-capabilities";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ServiceDraft } from "./service-draft";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";

export default function ServiceReminderFields({ draft, setDraft, errors }: { draft: ServiceDraft; setDraft: Dispatch<SetStateAction<ServiceDraft>>; errors: ServiceErrors }) {
  const { t } = useTranslation();
  const capabilities = useNotificationCapabilities();
  const pro = capabilities.data?.hasPro === true && !capabilities.isError;
  return <div className="space-y-4">
    {capabilities.isPending ? <p role="status">{t("notifications.loading")}</p> : capabilities.isError ? <p role="alert">{t("notifications.capabilityError")}</p> : !pro ? <p className="text-sm">{t("notifications.proBanner")} <Link className="underline py-2 inline-block" href="/my-services/settings/billing">{t("notifications.subscription")}</Link></p> : !capabilities.data.automationEnabled && <p className="text-sm" role="status">{t("notifications.automationUnavailable")}</p>}
    <label className="flex gap-3 items-start min-h-11"><input id="service-reminder-enabled" type="checkbox" className="h-5 w-5 mt-1 shrink-0" disabled={!pro} checked={draft.reminderEnabled} onChange={event => setDraft(current => ({ ...current, reminderEnabled: event.target.checked }))} /><span>{t("notifications.enableReminder")}</span></label>
    {draft.reminderEnabled && <fieldset disabled={!pro} className="grid gap-4 sm:grid-cols-2 min-w-0">
      <div className="space-y-2 min-w-0"><Label htmlFor="service-reminder-method">{t("notifications.reminderMethod")}</Label><select id="service-reminder-method" className="border rounded-md bg-background min-h-11 p-2 w-full" value={draft.reminderMethod} onChange={event => setDraft(current => ({ ...current, reminderMethod: event.target.value as ServiceDraft["reminderMethod"] }))}>{(["email", "sms", "whatsapp"] as const).map(method => <option key={method} value={method}>{t(`notifications.method.${method}`)}</option>)}</select></div>
      <div className="space-y-2 min-w-0"><Label htmlFor="service-reminder-hours">{t("notifications.hours")}</Label><Input id="service-reminder-hours" type="number" min={1} max={168} step={1} value={Number.isNaN(draft.reminderHours) ? "" : draft.reminderHours} onChange={event => setDraft(current => ({ ...current, reminderHours: event.target.value === "" ? Number.NaN : Number(event.target.value) }))} {...fieldFeedback(errors, "reminderHours", "service-reminder-help")} /><ServiceFieldError errors={errors} field="reminderHours" /></div>
      <p id="service-reminder-help" className="text-sm text-muted-foreground sm:col-span-2">{t("notifications.reminderHelp")}</p>
    </fieldset>}
  </div>;
}
