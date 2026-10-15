import type { WorkspaceContext } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { roleLabels } from "./company-role-labels";

export default function WorkspaceSwitcher({ context, busy, onChange }: {
  context: WorkspaceContext; busy: boolean; onChange: (companyId: number | null) => void;
}) {
  return <section className="flex flex-wrap items-center justify-between gap-3 border rounded-xl bg-white p-4" aria-label="Workspace">
    <div className="w-full sm:w-auto sm:min-w-64">
      <Label htmlFor="workspace">Workspace</Label>
      <select id="workspace" className="mt-1 w-full border rounded-md p-2 bg-white min-h-11" value={context.company?.id ?? "personal"} disabled={busy}
        onChange={event => onChange(event.target.value === "personal" ? null : Number(event.target.value))}>
        <option value="personal">Personal workspace</option>
        {context.workspaces.map(company => <option key={company.id} value={company.id}>{company.name} · {roleLabels[company.role]}</option>)}
      </select>
    </div>
    <div className="text-sm text-neutral-600">
      {context.membership && <p>{roleLabels[context.membership.role]}</p>}
      {context.company && !context.company.isActive && <p>Company closed. Published offers are hidden.</p>}
      {context.membership?.role === "viewer" && <p>You can view appointments assigned to you.</p>}
      {context.membership?.role === "provider" && <p>You can manage appointments assigned to you.</p>}
    </div>
  </section>;
}
