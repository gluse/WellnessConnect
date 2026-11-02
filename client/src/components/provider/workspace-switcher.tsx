import { useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkspaceContext } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { roleLabels } from "./company-role-labels";

export default function WorkspaceSwitcher({ context, busy, onChange }: {
  context: WorkspaceContext; busy: boolean; onChange: (companyId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  // Personal is always available; this list contains the additional company workspaces.
  if (context.workspaces.length === 0) return null;

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button ref={trigger} type="button" disabled={busy} title={context.company?.name ?? t("providerNavigation.personalWorkspace")}
        className="min-h-12 min-w-0 flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-3 px-0 sm:px-1 lg:px-3 py-2 rounded-lg text-[10px] sm:text-[11px] lg:text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
        <Building2 className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 max-w-full text-center lg:text-start leading-tight">
          <span className="block break-words">{t("providerNavigation.workspace")}</span>
          <span className="hidden lg:block truncate text-xs font-normal">{context.company?.name ?? t("providerNavigation.personalWorkspace")}</span>
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" align="start" collisionPadding={8} className="w-72 max-w-[calc(100vw-1rem)]" aria-label={t("providerNavigation.workspace")}>
      <Label htmlFor="workspace">{t("providerNavigation.workspace")}</Label>
      <select id="workspace" className="mt-2 w-full min-w-0 border border-neutral-500 rounded-md p-2 bg-white min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" value={context.company?.id ?? "personal"} disabled={busy}
        onChange={event => {
          setOpen(false);
          // Draft confirmation must restore focus to the persistent navigation control.
          trigger.current?.focus();
          onChange(event.target.value === "personal" ? null : Number(event.target.value));
        }}>
        <option value="personal">{t("providerNavigation.personalWorkspace")}</option>
        {context.workspaces.map(company => <option key={company.id} value={company.id}>{company.name} · {roleLabels[company.role]}</option>)}
      </select>
    </PopoverContent>
  </Popover>;
}

export function WorkspaceNotice({ context }: { context: WorkspaceContext }) {
  if (!context.membership && (!context.company || context.company.isActive)) return null;
  return <div className="mb-4 text-sm text-neutral-600">
      {context.membership && <p>{roleLabels[context.membership.role]}</p>}
      {context.company && !context.company.isActive && <p>Company closed. Published offers are hidden.</p>}
      {context.membership?.role === "viewer" && <p>You can view appointments assigned to you.</p>}
      {context.membership?.role === "provider" && <p>You can manage appointments assigned to you.</p>}
  </div>;
}
