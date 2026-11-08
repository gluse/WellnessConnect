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
import { Translation, useTranslation } from "react-i18next";

export default function ProviderProfile({ user }: { user: User }) {
  const { t } = useTranslation();
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
  const message = (key: string) => <Translation>{t => t(key)}</Translation>;
  const errorToast = () => {
    toast({ title: message("providerSettings.saveFailed"), description: message("operationsForm.saveError"), variant: "destructive" });
  };
  const profileMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/provider/profile", { providerType, companyName: companyName.trim() || null }),
    onSuccess: () => { invalidate(); toast({ title: message("providerSettings.profileSaved") }); },
    onError: errorToast,
  });
  const resetEmployee = () => { setEditingEmployee(null); setName(""); setShowName(false); };
  const employeeMutation = useMutation({
    mutationFn: () => apiRequest(editingEmployee ? "PATCH" : "POST", editingEmployee ? `/api/provider/employees/${editingEmployee.id}` : "/api/provider/employees", { name: name.trim(), showName }),
    onSuccess: () => { invalidate(); resetEmployee(); toast({ title: message("providerSettings.employeeSaved") }); },
    onError: errorToast,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/provider/employees/${id}`),
    onSuccess: () => { invalidate(); resetEmployee(); toast({ title: message("providerSettings.employeeRemoved") }); },
    onError: errorToast,
  });

  return <Card>
    <CardHeader><CardTitle>{t("providerSettings.profileTitle")}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); profileMutation.mutate(); }}>
        <div>
          <Label htmlFor="provider-type">{t("providerSettings.offerAs")}</Label>
          <select id="provider-type" className="w-full border rounded-md p-2 bg-white" value={providerType}
            onChange={event => setProviderType(event.target.value as User["providerType"])} data-testid="select-provider-type">
            <option value="individual">{t("providerSettings.individual")}</option><option value="company">{t("providerSettings.company")}</option>
          </select>
        </div>
        {providerType === "company" && <div>
          <Label htmlFor="company-name">{t("providerSettings.companyName")}</Label>
          <Input id="company-name" required maxLength={150} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder={t("providerSettings.companyPlaceholder")} data-testid="input-company-name" />
          <p className="text-xs text-neutral-500 mt-1">{t("providerSettings.companyHelp")}</p>
        </div>}
        <Button disabled={profileMutation.isPending} className="h-auto min-h-10 whitespace-normal" data-testid="button-save-provider-profile">{t(profileMutation.isPending ? "operationsForm.saving" : "providerSettings.saveProfile")}</Button>
      </form>
      {user.providerType === "company" && <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">{t("providerSettings.employees")}</h3>
        <p className="text-sm text-neutral-600">{t("providerSettings.employeesHelp")}</p>
        {isLoading ? <p role="status">{t("providerSettings.loadingEmployees")}</p> : isError ? <p role="alert">{t("providerSettings.loadEmployeesError")}</p> : employees.length === 0 ? <p className="text-sm text-neutral-500">{t("providerSettings.employeesEmpty")}</p> : <ul className="space-y-2">
          {employees.map(employee => <li key={employee.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
            <div><p className="font-medium">{employee.name}</p><p className="text-xs text-neutral-500">{t(employee.showName ? "providerSettings.nameVisible" : "providerSettings.nameHidden")}</p></div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditingEmployee(employee); setName(employee.name); setShowName(employee.showName); }}>{t("common.edit")}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={deleteMutation.isPending || employeeMutation.isPending} onClick={() => deleteMutation.mutate(employee.id)}>{t("operationsForm.remove")}</Button>
            </div>
          </li>)}
        </ul>}
        <form className="space-y-3 bg-neutral-50 rounded-md p-3" onSubmit={event => { event.preventDefault(); employeeMutation.mutate(); }}>
          <Label htmlFor="employee-name">{t(editingEmployee ? "providerSettings.editEmployee" : "providerSettings.addEmployee")}</Label>
          <Input id="employee-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder={t("providerSettings.employeePlaceholder")} data-testid="input-employee-name" />
          <div className="flex items-center gap-2"><Switch id="show-employee-name" checked={showName} onCheckedChange={setShowName} /><Label htmlFor="show-employee-name">{t("providerSettings.showName")}</Label></div>
          <div className="flex flex-wrap gap-2"><Button disabled={employeeMutation.isPending || deleteMutation.isPending} className="h-auto min-h-10 whitespace-normal" data-testid="button-save-employee">{t(employeeMutation.isPending ? "operationsForm.saving" : editingEmployee ? "providerSettings.saveEmployee" : "providerSettings.addEmployee")}</Button>
            {editingEmployee && <Button type="button" variant="outline" onClick={resetEmployee}>{t("common.cancel")}</Button>}
          </div>
        </form>
      </div>}
    </CardContent>
  </Card>;
}
