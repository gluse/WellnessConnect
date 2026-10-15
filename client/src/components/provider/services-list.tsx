import { Link } from "wouter";
import type { Employee, Service } from "@shared/schema";
import ProviderServiceCard from "@/components/provider/provider-service-card";
import { Button } from "@/components/ui/button";

export default function ServicesList({ services, employees, editable, copyingId, copyBusy, onCopy }: {
  services: Service[]; employees: Employee[]; editable: boolean; copyingId?: number; copyBusy: boolean; onCopy: (id: number) => void;
}) {
  if (!services.length) return <div className="border rounded-xl bg-white p-8 text-center space-y-3">
    <p className="text-neutral-600">No services in this view.</p>
    <p className="text-sm text-neutral-500">{editable ? "Add a service or choose another status." : "An administrator can assign services to your employee profile."}</p>
    {editable && <Button asChild><Link href="/my-services/services/new">Add Service</Link></Button>}
  </div>;
  return <div className="grid xl:grid-cols-2 gap-4">{services.map(service => <ProviderServiceCard key={service.id} service={service} employees={employees} editable={editable} copying={copyBusy && copyingId === service.id} copyBusy={copyBusy} onCopy={() => onCopy(service.id)} />)}</div>;
}
