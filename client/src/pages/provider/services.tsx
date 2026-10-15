import { useState } from "react";
import { Link } from "wouter";
import { Plus, Sparkles } from "lucide-react";
import { useProviderEmployees, useProviderServices, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import { useServiceActions } from "@/hooks/use-service-actions";
import ServicesList from "@/components/provider/services-list";
import { Button } from "@/components/ui/button";

export default function ServicesPage() {
  const services = useProviderServices();
  const employees = useProviderEmployees();
  const { data: context } = useProviderWorkspace();
  const { copy, search } = useServiceActions();
  const [status, setStatus] = useState<"all" | "published" | "inactive">("all");
  const editable = context?.permissions.manageServices ?? false;
  const filtered = (services.data ?? []).filter(service => status === "all" || (status === "published" ? service.isActive : !service.isActive));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Services</h1><p className="text-neutral-600 mt-1">Manage your published and inactive offers.</p></div>
      {editable && <Button asChild><Link href="/my-services/services/new"><Plus className="w-4 h-4 mr-2" />Add Service</Link></Button>}
    </div>
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1" aria-label="Service status">{(["all", "published", "inactive"] as const).map(value => <Button key={value} size="sm" className="min-h-11" variant={status === value ? "default" : "ghost"} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "All" : value === "published" ? "Published" : "Inactive"}</Button>)}</div>
      {editable && <Button variant="outline" disabled={search.isPending || !services.data?.length} onClick={() => search.mutate()} data-testid="button-generate-ai-search"><Sparkles className="w-4 h-4 mr-2" />{search.isPending ? "Updating…" : "Update AI Search"}</Button>}
    </div>
    {services.isLoading ? <p role="status">Loading services…</p> : services.isError ? <p role="alert">Unable to load services. Please refresh to try again.</p>
      : <ServicesList services={filtered} employees={employees.data ?? []} editable={editable} copyingId={copy.variables} copyBusy={copy.isPending} onCopy={id => copy.mutate(id)} />}
  </div>;
}
