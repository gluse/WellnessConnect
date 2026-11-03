import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import { useIsMutating } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useProviderWorkspace, WORKSPACE_CHANGE_KEY } from "@/hooks/use-provider-workspace";
import { useWorkspaceChange } from "@/hooks/use-workspace-change";
import ProviderNavigation from "@/components/provider/provider-navigation";
import { WorkspaceNotice } from "@/components/provider/workspace-switcher";
import AppointmentsPage from "@/pages/provider/appointments";
import ServicesPage from "@/pages/provider/services";
import ServiceEditPage from "@/pages/provider/service-edit";
import AvailabilityPage from "@/pages/provider/availability";
import SettingsPage from "@/pages/provider/settings";
import { requestServiceEditorExit } from "@/components/provider/service-navigation-guard";

export default function MyServices() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <main className="p-8 text-center" role="status">Loading your services…</main>;
  if (!isAuthenticated) return <Redirect to={`/login?returnTo=${encodeURIComponent(location)}`} />;

  return <ProviderLayout />;
}

function ProviderLayout() {
  const workspace = useProviderWorkspace();
  const mutationCount = useIsMutating();
  const switching = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  const change = useWorkspaceChange();
  if (workspace.isLoading) return <main className="p-8 text-center" role="status">Loading workspace…</main>;
  if (workspace.isError || !workspace.data) return <main className="p-8" role="alert">Unable to load your workspace. Please refresh to try again.</main>;
  const context = workspace.data;
  return <div className="min-h-[calc(100dvh-4rem)] bg-[#F0EEFF]" data-appointment-area="provider">
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="lg:flex lg:gap-6">
        <ProviderNavigation context={context} busy={mutationCount > 0} onWorkspaceChange={companyId => requestServiceEditorExit(() => change.mutateAsync(companyId))} />
        <main key={context.company?.id ?? "personal"} className="flex-1 min-w-0 pb-6">
          <WorkspaceNotice context={context} />
          {switching && <p role="status" className="mb-4">Switching workspace…</p>}
          <fieldset disabled={switching} className={`min-w-0 ${switching ? "pointer-events-none opacity-50" : ""}`} aria-busy={switching}>
          <Switch>
            <Route path="/my-services"><Redirect to="/my-services/appointments" replace /></Route>
            <Route path="/my-services/appointments"><AppointmentsPage /></Route>
            <Route path="/my-services/upcoming-appointments"><AppointmentsPage view="upcoming" /></Route>
            <Route path="/my-services/past-appointments"><AppointmentsPage view="past" /></Route>
            <Route path="/my-services/services/new" component={ServiceEditPage} />
            <Route path="/my-services/services/:id/edit" component={ServiceEditPage} />
            <Route path="/my-services/services" component={ServicesPage} />
            <Route path="/my-services/availability" component={AvailabilityPage} />
            <Route path="/my-services/settings/*?" component={SettingsPage} />
            <Route><div className="space-y-3"><h1 className="text-2xl font-semibold">Page not found</h1><Link href="/my-services/appointments" className="text-primary underline">Back to appointments</Link></div></Route>
          </Switch>
          </fieldset>
        </main>
      </div>
    </div>
  </div>;
}
