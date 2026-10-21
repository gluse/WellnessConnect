import { useProviderAvailability, useProviderServices, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import { useFormLocale } from "@/components/forms-locale";
import AvailabilityEditor from "@/components/availability-editor";

export default function AvailabilityPage() {
  const { t } = useFormLocale();
  const { data: context } = useProviderWorkspace();
  if (!context?.permissions.manageSchedules) return <p role="alert">{t("operationsForm.availabilityDenied")}</p>;
  return <AvailabilityContent />;
}

function AvailabilityContent() {
  const { t } = useFormLocale();
  const services = useProviderServices();
  const schedules = useProviderAvailability();
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">{t("operationsForm.availability")}</h1><p className="mt-1 text-muted-foreground">{t("operationsForm.availabilityHelp")}</p></div>
    {services.isLoading || schedules.isLoading ? <p role="status">{t("operationsForm.loadingAvailability")}</p> : services.isError || schedules.isError ? <p role="alert">{t("operationsForm.loadAvailabilityError")}</p>
      : <AvailabilityEditor services={services.data ?? []} schedules={schedules.data ?? []} />}
  </div>;
}
