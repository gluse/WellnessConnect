import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { ServiceDraft } from "./service-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { fieldFeedback, ServiceFieldError, type ServiceErrors } from "./service-field-feedback";

export default function ServiceDetailsFields({ newService, setNewService, company, employees, errors = {} }: { newService: ServiceDraft; setNewService: Dispatch<SetStateAction<ServiceDraft>>; company: boolean; employees: Employee[]; errors?: ServiceErrors }) {
  const categories = useCategories();
  const { t, i18n } = useTranslation();
  return <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="serviceName">{t("serviceForm.name")} *</Label>
      <Input id="serviceName" className="min-h-11" required dir="auto" value={newService.name} {...fieldFeedback(errors, "name")}
        onChange={event => setNewService(prev => ({ ...prev, name: event.target.value }))} />
      <ServiceFieldError errors={errors} field="name" />
    </div>
    <div className="space-y-2">
      <Label htmlFor="category">{t("filters.category")} *</Label>
      <Select required dir={i18n.dir()} disabled={!categories.data?.length} value={newService.category}
        onValueChange={value => setNewService(prev => ({ ...prev, category: value as ServiceDraft["category"] }))}>
        <SelectTrigger id="category" className="min-h-11 h-auto text-start [&>span]:whitespace-normal" {...fieldFeedback(errors, "category", "category-status")}>
          <SelectValue placeholder={t("serviceForm.chooseCategory")} />
        </SelectTrigger>
        <SelectContent>{categories.data?.map(category => <SelectItem key={category.key} value={category.key}><bdi>{category.icon} {category.name}</bdi></SelectItem>)}</SelectContent>
      </Select>
      <ServiceFieldError errors={errors} field="category" />
      <div id="category-status" className="text-sm text-muted-foreground">
        {categories.isError ? <p role="alert">{t("serviceForm.categoriesError")} <button type="button" className="underline min-h-11" onClick={() => void categories.refetch()}>{t("publicSearch.retry")}</button></p>
          : categories.isPending ? <p role="status">{t("serviceForm.categoriesLoading")}</p> : !categories.data.length && <p>{t("serviceForm.categoriesEmpty")}</p>}
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="description">{t("serviceForm.description")}</Label>
      <Textarea id="description" dir="auto" value={newService.description} onChange={event => setNewService(prev => ({ ...prev, description: event.target.value }))} />
    </div>
    {company && <div className="space-y-2">
      <Label htmlFor="service-employee">{t("serviceForm.employee")}</Label>
      <select id="service-employee" className="w-full min-h-11 border rounded-md p-2 bg-background" value={newService.employeeId ?? "none"}
        aria-describedby="service-employee-help" onChange={event => setNewService(prev => ({ ...prev, employeeId: event.target.value === "none" ? null : Number(event.target.value) }))} data-testid="select-service-employee">
        <option value="none">{t("serviceForm.sharedSchedule")}</option>
        {employees.map(employee => <option key={employee.id} value={employee.id} dir="auto">{employee.name}</option>)}
      </select>
      <p id="service-employee-help" className="text-sm text-muted-foreground">{t("serviceForm.employeeHelp")}</p>
    </div>}
  </div>;
}
