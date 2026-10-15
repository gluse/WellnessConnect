import { useProviderAvailability, useProviderServices, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import AvailabilityEditor from "@/components/availability-editor";

export default function AvailabilityPage() {
  const { data: context } = useProviderWorkspace();
  if (!context?.permissions.manageSchedules) return <p role="alert">Your access level does not allow managing availability.</p>;
  return <AvailabilityContent />;
}

function AvailabilityContent() {
  const services = useProviderServices();
  const schedules = useProviderAvailability();
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Availability</h1><p className="mt-1 text-neutral-600">Set your normal week, then adjust individual dates. Existing appointments stay in place.</p></div>
    {services.isLoading || schedules.isLoading ? <p role="status">Loading availability…</p> : services.isError || schedules.isError ? <p role="alert">Unable to load availability. Please refresh to try again.</p>
      : <AvailabilityEditor services={services.data ?? []} schedules={schedules.data ?? []} />}
  </div>;
}
