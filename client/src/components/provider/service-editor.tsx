import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Employee, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { createServiceDraft } from "./service-draft";
import ServiceDetailsFields from "./service-details-fields";
import ServiceBookingFields from "./service-booking-fields";
import ServiceLocationFields from "./service-location-fields";
import ServiceMediaFields from "./service-media-fields";

export default function ServiceEditor({ service, employees, company }: { service?: Service; employees: Employee[]; company: boolean }) {
  const [newService, setNewService] = useState(() => createServiceDraft(service));
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dirty = JSON.stringify(newService) !== JSON.stringify(createServiceDraft(service));
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async (isActive: boolean) => (await apiRequest(service ? "PATCH" : "POST", service ? `/api/services/${service.id}` : "/api/services", { ...newService, isActive })).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/services/") });
      toast({ title: service ? "Service Updated" : "Service Created" });
      navigate("/my-services/services");
    },
    onError: error => {
      if (isUnauthorizedError(error)) { window.location.assign("/login?returnTo=" + encodeURIComponent(service ? `/my-services/services/${service.id}/edit` : "/my-services/services/new")); return; }
      try { setError(JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || "Unable to save service."); }
      catch { setError("Unable to save service. Please try again."); }
    },
  });
  const submit = (isActive: boolean) => {
    if (save.isPending) return;
    if (!newService.name.trim() || !newService.price) { setError("Enter a service name and price."); return; }
    if (!Number.isFinite(Number(newService.price)) || Number(newService.price) < 0 || newService.duration < 1 || newService.maxCapacity < 1) { setError("Use a non-negative price and a positive duration and capacity."); return; }
    if (!newService.address.trim() || newService.latitude == null || newService.longitude == null) { setError("Enter an address and verify it, or provide coordinates manually."); return; }
    setError(""); save.mutate(isActive);
  };
  return <div className="max-w-3xl mx-auto space-y-5">
    <Button variant="ghost" asChild className="-ml-3"><Link href="/my-services/services" onClick={event => { if (save.isPending || (dirty && !window.confirm("Discard unsaved service changes?"))) event.preventDefault(); }}><ArrowLeft className="w-4 h-4 mr-2" />Back to services</Link></Button>
    <div><h1 className="text-2xl font-semibold">{service ? "Edit Service" : "Add New Service"}</h1><p className="mt-1 text-neutral-600">{service ? "Update your offer and choose whether to publish it." : "Add the details customers need to book your service."}</p></div>
    <form onSubmit={event => { event.preventDefault(); submit(true); }} className="space-y-6">
      <fieldset disabled={save.isPending} className="space-y-6 min-w-0">
        <div className="bg-white border rounded-xl p-4 sm:p-6 space-y-4"><h2 className="font-semibold">Service details</h2><ServiceDetailsFields newService={newService} setNewService={setNewService} employees={employees} company={company} /></div>
        <div className="bg-white border rounded-xl p-4 sm:p-6 space-y-4"><h2 className="font-semibold">Booking and pricing</h2><ServiceBookingFields newService={newService} setNewService={setNewService} /></div>
        <div className="bg-white border rounded-xl p-4 sm:p-6 space-y-4"><h2 className="font-semibold">Location</h2><ServiceLocationFields newService={newService} setNewService={setNewService} /></div>
        <div className="bg-white border rounded-xl p-4 sm:p-6 space-y-4"><h2 className="font-semibold">Image and links</h2><ServiceMediaFields newService={newService} setNewService={setNewService} /></div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="sticky bottom-0 z-20 bg-white border rounded-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
        <p className="text-xs text-neutral-500">Published services appear in search. Inactive services stay hidden.</p>
        <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => submit(false)} data-testid="button-save-inactive-service">Save Inactive</Button><Button type="submit" disabled={save.isPending} data-testid="button-save-service">{save.isPending ? "Saving…" : "Save and Publish"}</Button></div>
      </div>
    </form>
  </div>;
}
