import { useRef, useState, type FormEvent } from "react";
import { adminUserFiltersSchema, defaultAdminUserFilters, type AdminUserFilters } from "@shared/admin";
import { useFormLocale } from "@/components/forms-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminUserFiltersForm({ filters, onApply }: {
  filters: AdminUserFilters; onApply: (filters: AdminUserFilters) => void;
}) {
  const { t } = useFormLocale();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState("");
  function change<Key extends keyof AdminUserFilters>(key: Key, value: AdminUserFilters[Key]) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = adminUserFiltersSchema.safeParse(draft);
    if (!parsed.success) { setAdvancedOpen(true); setError(t("operationsForm.checkFields")); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    if (draft.registeredFrom && draft.registeredTo && draft.registeredFrom > draft.registeredTo) {
      setAdvancedOpen(true); setError(t("operationsForm.dateOrderError")); requestAnimationFrame(() => errorRef.current?.focus()); return;
    }
    setError(""); onApply(parsed.data);
  }
  const selectClass = "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  return <form noValidate aria-label={t("operationsForm.filterUsers")} onSubmit={submit} className="phase3-form rounded-lg border bg-muted p-4 space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="admin-user-search">{t("operationsForm.nameEmail")}</Label><Input id="admin-user-search" type="search" maxLength={200} placeholder={t("operationsForm.searchUsers")} value={draft.search} onChange={event => change("search", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-company-search">{t("operationsForm.company")}</Label><Input id="admin-company-search" type="search" maxLength={150} placeholder={t("operationsForm.searchCompanies")} value={draft.company} onChange={event => change("company", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-email-status">{t("operationsForm.emailVerification")}</Label><select id="admin-email-status" className={selectClass} value={draft.emailStatus} onChange={event => change("emailStatus", event.target.value as AdminUserFilters["emailStatus"])}><option value="all">{t("operationsForm.allEmail")}</option><option value="verified">{t("operationsForm.verified")}</option><option value="pending">{t("operationsForm.pendingVerification")}</option></select></div>
      <div className="space-y-2"><Label htmlFor="admin-account-status">{t("operationsForm.accountStatus")}</Label><select id="admin-account-status" className={selectClass} value={draft.accountStatus} onChange={event => change("accountStatus", event.target.value as AdminUserFilters["accountStatus"])}><option value="all">{t("operationsForm.allAccounts")}</option><option value="active">{t("operationsForm.active")}</option><option value="blocked">{t("operationsForm.blocked")}</option></select></div>
    </div>
    <details open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)} className="space-y-4"><summary className="font-semibold cursor-pointer min-h-11 py-3">{t("operationsForm.advanced")}</summary><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="admin-registered-from">{t("operationsForm.registeredFrom")}</Label><Input id="admin-registered-from" aria-invalid={Boolean(error)} aria-describedby={error ? "admin-filter-error" : undefined} type="date" max={draft.registeredTo || undefined} value={draft.registeredFrom} onChange={event => change("registeredFrom", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-registered-to">{t("operationsForm.registeredTo")}</Label><Input id="admin-registered-to" aria-invalid={Boolean(error)} aria-describedby={error ? "admin-filter-error" : undefined} type="date" min={draft.registeredFrom || undefined} value={draft.registeredTo} onChange={event => change("registeredTo", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-sort-by">{t("operationsForm.sortBy")}</Label><select id="admin-sort-by" className={selectClass} value={draft.sortBy} onChange={event => change("sortBy", event.target.value as AdminUserFilters["sortBy"])}><option value="registeredAt">{t("operationsForm.dateRegistered")}</option><option value="name">{t("operationsForm.name")}</option></select></div>
      <div className="space-y-2"><Label htmlFor="admin-sort-direction">{t("operationsForm.sortDirection")}</Label><select id="admin-sort-direction" className={selectClass} value={draft.sortDirection} onChange={event => change("sortDirection", event.target.value as AdminUserFilters["sortDirection"])}><option value="asc">{t("operationsForm.ascending")}</option><option value="desc">{t("operationsForm.descending")}</option></select></div>
    </div></details>
    <p className="text-sm text-muted-foreground">{t("operationsForm.filtersHelp", { timezone: draft.timezone })}</p>
    {error && <p id="admin-filter-error" ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit">{t("operationsForm.apply")}</Button><Button type="button" variant="outline" onClick={() => {
      const reset = { ...defaultAdminUserFilters, timezone: filters.timezone };
      setDraft(reset); setError(""); onApply(reset);
    }}>{t("operationsForm.clear")}</Button></div>
  </form>;
}
