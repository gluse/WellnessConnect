import type { Dispatch, SetStateAction } from "react";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ServiceDetailsFields({ newService, setNewService, company, employees }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; company: boolean; employees: Employee[] }) {

  return <section className="space-y-4">
    {company && <div>
      <Label htmlFor="service-employee">Employee (optional)</Label>
      <select id="service-employee" className="w-full border rounded-md p-2 bg-white" value={newService.employeeId ?? "none"}
        onChange={event => setNewService(prev => ({ ...prev, employeeId: event.target.value === "none" ? null : Number(event.target.value) }))} data-testid="select-service-employee">
        <option value="none">No specific employee (shared schedule)</option>
        {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select>
      <p className="text-xs text-neutral-500 mt-1">Offers assigned to different employees can be booked at the same time. Customer name visibility is set in Employees.</p>
    </div>}
    <div>
      <Label htmlFor="serviceName">Service Name *</Label>
      <Input
        id="serviceName"
        required
        value={newService.name}
        onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
        placeholder="e.g., Deep Tissue Massage"
      />
    </div>

    <div>
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={newService.description}
        onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Describe your service..."
      />
    </div>

    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          value={newService.category}
          onValueChange={(value) => setNewService(prev => ({ ...prev, category: value as ServiceDraft["category"] }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="health_wellness">Health & Wellness</SelectItem>
            <SelectItem value="education">Education</SelectItem>
            <SelectItem value="entertainment">Entertainment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="serviceType">Service Type</Label>
        <Select
          value={newService.serviceType}
          onValueChange={(value) => setNewService(prev => ({ ...prev, serviceType: value as ServiceDraft["serviceType"], maxCapacity: value === "one_to_one" ? 1 : 10 }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one_to_one">One-to-One</SelectItem>
            <SelectItem value="group">Group</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </section>;
}
