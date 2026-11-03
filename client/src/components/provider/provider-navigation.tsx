import { Link, useLocation } from "wouter";
import type { WorkspaceContext } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import WorkspaceSwitcher from "./workspace-switcher";
import { providerSections } from "./navigation-sections";

export default function ProviderNavigation({ context, busy, onWorkspaceChange }: { context: WorkspaceContext; busy: boolean; onWorkspaceChange: (companyId: number | null) => void }) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const sections = providerSections(context);

  return <nav aria-label={t("providerNavigation.sections")} className="hidden shrink-0 lg:block lg:w-52">
    <div className="flex flex-col gap-2 rounded-xl border bg-white p-2 lg:sticky lg:top-24">
      <WorkspaceSwitcher context={context} busy={busy} onChange={onWorkspaceChange} />
      {sections.map(({ path, labelKey, icon: Icon }) => {
        const active = location === path || location.startsWith(`${path}/`);
        return <Link key={path} href={path} aria-current={active ? "page" : undefined} aria-disabled={busy || undefined}
          onClick={event => { if (busy) event.preventDefault(); }}
          className={cn("hidden min-h-12 min-w-0 flex-1 items-center justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex", active ? "bg-primary/10 text-primary" : "text-neutral-600 hover:bg-neutral-100", busy && "opacity-50")}>
          <Icon className="w-5 h-5 shrink-0" aria-hidden="true" /><span className="max-w-full break-words text-center lg:text-start leading-tight tracking-tighter lg:tracking-normal">{t(labelKey)}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
