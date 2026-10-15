import { Link, useLocation } from "wouter";
import { CalendarDays, Clock, List, Settings } from "lucide-react";
import type { WorkspaceContext } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function ProviderNavigation({ context, busy, editing }: { context: WorkspaceContext; busy: boolean; editing: boolean }) {
  const [location] = useLocation();
  const sections = [
    { path: "/my-services/appointments", label: "Appointments", icon: CalendarDays, visible: true },
    { path: "/my-services/services", label: "Services", icon: List, visible: true },
    { path: "/my-services/availability", label: "Availability", icon: Clock, visible: context.permissions.manageSchedules },
    { path: "/my-services/settings", label: "Settings", icon: Settings, visible: context.permissions.manageServices || context.permissions.manageTeam || context.permissions.isOwner },
  ].filter(section => section.visible);

  return <nav aria-label="My Services sections" className={cn("shrink-0 md:w-20 lg:w-52", editing && "hidden md:block")}>
    <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-white flex justify-around px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:sticky md:top-24 md:inset-auto md:flex-col md:gap-2 md:border md:rounded-xl md:p-2">
      {sections.map(({ path, label, icon: Icon }) => {
        const active = location === path || location.startsWith(`${path}/`);
        return <Link key={path} href={path} aria-current={active ? "page" : undefined} aria-disabled={busy || undefined}
          onClick={event => { if (busy) event.preventDefault(); }}
          className={cn("min-h-12 min-w-0 flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-3 px-1 lg:px-3 py-2 rounded-lg text-[11px] lg:text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "bg-primary/10 text-primary" : "text-neutral-600 hover:bg-neutral-100", busy && "opacity-50")}>
          <Icon className="w-5 h-5 shrink-0" aria-hidden="true" /><span>{label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
