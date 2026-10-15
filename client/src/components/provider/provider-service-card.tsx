import { Link } from "wouter";
import { Copy } from "lucide-react";
import type { Employee, Service } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ProviderServiceCard({ service, employees, editable, copying, copyBusy, onCopy }: {
  service: Service; employees: Employee[]; editable: boolean; copying: boolean; copyBusy: boolean; onCopy: () => void;
}) {
  return <Card><CardContent className="p-4 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h2 className="font-semibold break-words">{service.name}</h2>
        {service.employeeId != null && <p className="text-sm text-neutral-600">Employee: {employees.find(employee => employee.id === service.employeeId)?.name || "Assigned employee"}</p>}
      </div>
      <Badge variant={service.isActive ? "default" : "outline"}>{service.isActive ? "Published" : "Inactive"}</Badge>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm"><span>${service.price}</span><span>{service.duration} min</span><span>{service.serviceType === "one_to_one" ? "One-to-One" : "Group"}</span></div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Badge variant="outline">{service.instantBooking ? "Instant Book" : "Approval Required"}</Badge>
      {editable && <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="min-h-11" disabled={copyBusy} onClick={onCopy} data-testid={`button-copy-service-${service.id}`}><Copy className="w-4 h-4 mr-1" />{copying ? "Copying…" : "Copy"}</Button>
        <Button asChild variant="outline" size="sm" className="min-h-11"><Link href={`/my-services/services/${service.id}/edit`} data-testid={`button-edit-service-${service.id}`}>Edit</Link></Button>
      </div>}
    </div>
  </CardContent></Card>;
}
