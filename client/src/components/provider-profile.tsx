import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ProviderProfile({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [providerType, setProviderType] = useState(user.providerType);
  const [companyName, setCompanyName] = useState(user.companyName || "");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState("");
  const [showName, setShowName] = useState(false);
  useEffect(() => {
    setProviderType(user.providerType);
    setCompanyName(user.companyName || "");
  }, [user.providerType, user.companyName]);
  const { data: employees = [], isLoading, isError } = useQuery<Employee[]>({ queryKey: ["/api/provider/employees"] });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/company/context"] });
    queryClient.invalidateQueries({ queryKey: ["/api/provider/employees"] });
    queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/services/") });
    queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
  };
  const errorToast = (error: Error) => {
    let message = error.message.replace(/^\d+:\s*/, "");
    try { message = JSON.parse(message).message || message; } catch {}
    toast({ title: "Unable to save", description: message, variant: "destructive" });
  };
  const profileMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/provider/profile", { providerType, companyName: companyName.trim() || null }),
    onSuccess: () => { invalidate(); toast({ title: "Provider profile saved" }); },
    onError: errorToast,
  });
  const resetEmployee = () => { setEditingEmployee(null); setName(""); setShowName(false); };
  const employeeMutation = useMutation({
    mutationFn: () => apiRequest(editingEmployee ? "PATCH" : "POST", editingEmployee ? `/api/provider/employees/${editingEmployee.id}` : "/api/provider/employees", { name: name.trim(), showName }),
    onSuccess: () => { invalidate(); resetEmployee(); toast({ title: "Employee saved" }); },
    onError: errorToast,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/provider/employees/${id}`),
    onSuccess: () => { invalidate(); resetEmployee(); toast({ title: "Employee removed" }); },
    onError: errorToast,
  });

  return <Card>
    <CardHeader><CardTitle>Provider profile</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); profileMutation.mutate(); }}>
        <div>
          <Label htmlFor="provider-type">Offer services as</Label>
          <select id="provider-type" className="w-full border rounded-md p-2 bg-white" value={providerType}
            onChange={event => setProviderType(event.target.value as User["providerType"])} data-testid="select-provider-type">
            <option value="individual">Individual</option><option value="company">Company</option>
          </select>
        </div>
        {providerType === "company" && <div>
          <Label htmlFor="company-name">Company name *</Label>
          <Input id="company-name" required maxLength={150} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="e.g., Riga Beauty Salon" data-testid="input-company-name" />
          <p className="text-xs text-neutral-500 mt-1">Customers see this name instead of the administrator's personal name on all your offers.</p>
        </div>}
        <Button disabled={profileMutation.isPending} data-testid="button-save-provider-profile">{profileMutation.isPending ? "Saving…" : "Save Profile"}</Button>
      </form>
      {user.providerType === "company" && <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">Employees</h3>
        <p className="text-sm text-neutral-600">Add your team, then assign an employee when editing a service. You manage their offers and bookings from this account.</p>
        {isLoading ? <p>Loading employees…</p> : isError ? <p role="alert">Unable to load employees. Refresh to try again.</p> : employees.length === 0 ? <p className="text-sm text-neutral-500">No employees added yet.</p> : <ul className="space-y-2">
          {employees.map(employee => <li key={employee.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
            <div><p className="font-medium">{employee.name}</p><p className="text-xs text-neutral-500">{employee.showName ? "Name visible to customers" : "Name hidden from customers"}</p></div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditingEmployee(employee); setName(employee.name); setShowName(employee.showName); }}>Edit</Button>
              <Button type="button" size="sm" variant="ghost" disabled={deleteMutation.isPending || employeeMutation.isPending} onClick={() => deleteMutation.mutate(employee.id)}>Remove</Button>
            </div>
          </li>)}
        </ul>}
        <form className="space-y-3 bg-neutral-50 rounded-md p-3" onSubmit={event => { event.preventDefault(); employeeMutation.mutate(); }}>
          <Label htmlFor="employee-name">{editingEmployee ? "Edit employee" : "Add employee"}</Label>
          <Input id="employee-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Name or internal label, e.g., Massage therapist" data-testid="input-employee-name" />
          <div className="flex items-center gap-2"><Switch id="show-employee-name" checked={showName} onCheckedChange={setShowName} /><Label htmlFor="show-employee-name">Show this name to customers</Label></div>
          <div className="flex gap-2"><Button disabled={employeeMutation.isPending || deleteMutation.isPending} data-testid="button-save-employee">{employeeMutation.isPending ? "Saving…" : editingEmployee ? "Save Employee" : "Add Employee"}</Button>
            {editingEmployee && <Button type="button" variant="outline" onClick={resetEmployee}>Cancel</Button>}
          </div>
        </form>
      </div>}
    </CardContent>
  </Card>;
}
