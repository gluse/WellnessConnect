import { Link, useRoute } from "wouter";
import { useProviderEmployees, useProviderServices, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import ServiceEditor from "@/components/provider/service-editor";

export default function ServiceEditPage() {
  const [editing, params] = useRoute("/my-services/services/:id/edit");
  const services = useProviderServices();
  const employees = useProviderEmployees();
  const { data: context } = useProviderWorkspace();
  if (!context?.permissions.manageServices) return <p role="alert">Your access level does not allow editing services.</p>;
  if (employees.isLoading || (editing && services.isLoading)) return <p role="status">Loading service details…</p>;
  if (employees.isError || (editing && services.isError)) return <p role="alert">Unable to load service details. Please refresh to try again.</p>;
  const service = editing ? services.data?.find(row => row.id === Number(params?.id)) : undefined;
  if (editing && !service) return <div className="space-y-3"><h1 className="text-2xl font-semibold">Service not found</h1><p>This service is unavailable in your current workspace.</p><Link href="/my-services/services" className="text-primary underline">Back to services</Link></div>;
  return <ServiceEditor key={service?.id ?? "new"} service={service} employees={employees.data ?? []} company={Boolean(context.company)} />;
}
