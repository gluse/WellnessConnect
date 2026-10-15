import { useState, type FormEvent } from "react";
import { adminUserFiltersSchema, defaultAdminUserFilters, type AdminUserFilters } from "@shared/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminUserFiltersForm({ filters, onApply }: {
  filters: AdminUserFilters; onApply: (filters: AdminUserFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState("");
  function change<Key extends keyof AdminUserFilters>(key: Key, value: AdminUserFilters[Key]) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = adminUserFiltersSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (draft.registeredFrom && draft.registeredTo && draft.registeredFrom > draft.registeredTo) {
      setError("The registration end date must be on or after the start date."); return;
    }
    setError(""); onApply(parsed.data);
  }
  const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-white px-3 text-sm";
  return <form aria-label="Filter registered users" onSubmit={submit} className="rounded-lg border bg-neutral-50 p-4 space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="admin-user-search">Name or email</Label><Input id="admin-user-search" type="search" maxLength={200} placeholder="Search users" value={draft.search} onChange={event => change("search", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-company-search">Company / organization</Label><Input id="admin-company-search" type="search" maxLength={150} placeholder="Search companies" value={draft.company} onChange={event => change("company", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-email-status">Email verification</Label><select id="admin-email-status" className={selectClass} value={draft.emailStatus} onChange={event => change("emailStatus", event.target.value as AdminUserFilters["emailStatus"])}><option value="all">All email statuses</option><option value="verified">Verified</option><option value="pending">Pending verification</option></select></div>
      <div className="space-y-2"><Label htmlFor="admin-account-status">Account status</Label><select id="admin-account-status" className={selectClass} value={draft.accountStatus} onChange={event => change("accountStatus", event.target.value as AdminUserFilters["accountStatus"])}><option value="all">All account statuses</option><option value="active">Active</option><option value="blocked">Blocked</option></select></div>
      <div className="space-y-2"><Label htmlFor="admin-registered-from">Registered from</Label><Input id="admin-registered-from" type="date" max={draft.registeredTo || undefined} value={draft.registeredFrom} onChange={event => change("registeredFrom", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-registered-to">Registered to</Label><Input id="admin-registered-to" type="date" min={draft.registeredFrom || undefined} value={draft.registeredTo} onChange={event => change("registeredTo", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="admin-sort-by">Sort by</Label><select id="admin-sort-by" className={selectClass} value={draft.sortBy} onChange={event => change("sortBy", event.target.value as AdminUserFilters["sortBy"])}><option value="registeredAt">Date registered</option><option value="name">Name</option></select></div>
      <div className="space-y-2"><Label htmlFor="admin-sort-direction">Sort direction</Label><select id="admin-sort-direction" className={selectClass} value={draft.sortDirection} onChange={event => change("sortDirection", event.target.value as AdminUserFilters["sortDirection"])}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
    </div>
    <p className="text-xs text-neutral-500">Registration dates include both selected days in {draft.timezone}. Account status shows whether sign-in is blocked, separately from email verification.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit">Apply filters</Button><Button type="button" variant="outline" onClick={() => {
      const reset = { ...defaultAdminUserFilters, timezone: filters.timezone };
      setDraft(reset); setError(""); onApply(reset);
    }}>Clear filters</Button></div>
  </form>;
}
