import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, useLocation } from "wouter";
import { Building2, Calendar, CalendarDays, Menu, Search } from "lucide-react";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { WorkspaceContext } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceChange } from "@/hooks/use-workspace-change";
import { cn } from "@/lib/utils";
import { providerSections } from "@/components/provider/navigation-sections";
import { requestServiceEditorExit } from "@/components/provider/service-navigation-guard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { roleLabels } from "@/components/provider/company-role-labels";

const controlClass = "flex min-h-14 min-w-[max(44px,1.75rem)] flex-auto flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-xs font-medium leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-disabled:opacity-50";

/** One signed-in mobile bar, with content clearance following its rendered height. */
export default function MobileNavigationLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const shell = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isAuthenticated || !bar.current) return;
    let frame = 0;
    const measure = () => {
      const height = `${bar.current?.getBoundingClientRect().height ?? 0}px`;
      if (shell.current?.style.getPropertyValue("--mobile-navigation-height") !== height) {
        shell.current?.style.setProperty("--mobile-navigation-height", height);
      }
    };
    // Write on the next frame, outside ResizeObserver's delivery cycle.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(bar.current);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [isAuthenticated, user?.id]);

  return <div ref={shell} className={isAuthenticated ? "mobile-navigation-layout pb-[var(--mobile-navigation-height,calc(7rem_+_env(safe-area-inset-bottom)))] lg:pb-0" : undefined}>
    {children}
    {isAuthenticated && <MobileNavigation key={user?.id} barRef={bar} />}
  </div>;
}

function MobileNavigation({ barRef }: { barRef: RefObject<HTMLElement> }) {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingNavigation = useRef<string>();
  const pendingWorkspace = useRef(false);
  const pendingCompany = useRef<number | null | undefined>();
  const mutations = useIsMutating();
  const change = useWorkspaceChange();
  const inProvider = location === "/my-services" || location.startsWith("/my-services/");
  const busy = (inProvider && mutations > 0) || change.isPending;
  const workspace = useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"], retry: false });
  const sections = providerSections(workspace.isError ? undefined : workspace.data).filter(section => section.path !== "/my-services/appointments");
  const menuActive = sections.some(section => location === section.path || location.startsWith(`${section.path}/`));
  const tabs = [
    { href: "/", label: t("mobileNavigation.explore"), icon: Search, active: location === "/" || location === "/search" },
    { href: "/my-bookings", label: t("nav.bookings"), icon: Calendar, active: location === "/my-bookings" },
    { href: "/my-services/appointments", label: t("appointmentAgenda.calendar"), icon: CalendarDays, active: location === "/my-services" || location === "/my-services/appointments" },
  ];
  useEffect(() => { setOpen(false); setWorkspaceOpen(false); }, [location]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) { setOpen(false); setWorkspaceOpen(false); } };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return <nav ref={barRef} aria-label={t("mobileNavigation.navigation")} data-mobile-navigation
    className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-neutral-600 lg:hidden">
    <div className="mx-auto flex max-w-3xl gap-1">
      {tabs.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-disabled={busy || undefined}
        onClick={event => { if (busy) event.preventDefault(); }}
        className={cn(controlClass, active ? "bg-[#efefff] text-primary" : "hover:bg-neutral-100")}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="max-w-full break-words">{label}</span>
      </Link>)}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button ref={trigger} type="button" disabled={busy} className={cn(controlClass, "disabled:opacity-50", menuActive ? "bg-[#efefff] text-primary" : "hover:bg-neutral-100")}>
            <Menu className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="max-w-full break-words">{t("mobileNavigation.menu")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={12} collisionPadding={8} aria-label={t("mobileNavigation.menu")}
          className="w-64 max-w-[calc(100vw-1rem)] lg:hidden"
          onCloseAutoFocus={event => {
            // Finish closing before handing focus to an unsaved-draft confirmation.
            const path = pendingNavigation.current;
            pendingNavigation.current = undefined;
            if (path) {
              event.preventDefault();
              trigger.current?.focus();
              requestServiceEditorExit(() => navigate(path));
            } else if (pendingWorkspace.current) {
              event.preventDefault();
              pendingWorkspace.current = false;
              setWorkspaceOpen(true);
            }
          }}>
          {sections.map(({ path, labelKey, icon: Icon }) => <DropdownMenuItem key={path} disabled={busy}
            aria-current={location === path || location.startsWith(`${path}/`) ? "page" : undefined}
            className="min-h-11 whitespace-normal break-words"
            onSelect={event => { event.preventDefault(); pendingNavigation.current = path; setOpen(false); }}>
            <Icon aria-hidden="true" />{t(labelKey)}
          </DropdownMenuItem>)}
          {!workspace.isError && !!workspace.data?.workspaces.length && <DropdownMenuItem disabled={busy} className="min-h-11 whitespace-normal break-words"
            onSelect={event => { event.preventDefault(); pendingWorkspace.current = true; setOpen(false); }}>
            <Building2 aria-hidden="true" />{t("providerNavigation.workspace")}
          </DropdownMenuItem>}
          {(workspace.isPending || workspace.isError) && <p role="status" className="px-2 py-2 text-sm text-muted-foreground">
            {t(workspace.isError ? "mobileNavigation.workspaceError" : "mobileNavigation.workspaceLoading")}
          </p>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
      <DialogContent aria-describedby={undefined} closeLabel={t("appointmentCollaboration.cancel")} className="w-[calc(100%_-_2rem)] max-h-[calc(100dvh_-_2rem)] overflow-y-auto rounded-lg"
        onCloseAutoFocus={event => {
          event.preventDefault();
          trigger.current?.focus();
          const companyId = pendingCompany.current;
          pendingCompany.current = undefined;
          if (companyId !== undefined) requestServiceEditorExit(() => change.mutateAsync(companyId));
        }}>
        <DialogHeader><DialogTitle>{t("providerNavigation.workspace")}</DialogTitle></DialogHeader>
        <Label htmlFor="mobile-workspace">{t("providerNavigation.workspace")}</Label>
        <select id="mobile-workspace" className="w-full min-w-0 min-h-11 rounded-md border border-neutral-500 bg-white p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          value={workspace.data?.company?.id ?? "personal"} disabled={busy}
          onChange={event => {
            pendingCompany.current = event.target.value === "personal" ? null : Number(event.target.value);
            setWorkspaceOpen(false);
          }}>
          <option value="personal">{t("providerNavigation.personalWorkspace")}</option>
          {workspace.data?.workspaces.map(company => <option key={company.id} value={company.id}>{company.name} · {roleLabels[company.role]}</option>)}
        </select>
      </DialogContent>
    </Dialog>
  </nav>;
}
