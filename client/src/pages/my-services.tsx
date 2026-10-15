import { Link, Redirect, Route, Switch, useLocation } from "wouter";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkspaceContext } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useProviderWorkspace } from "@/hooks/use-provider-workspace";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ProviderNavigation from "@/components/provider/provider-navigation";
import WorkspaceSwitcher from "@/components/provider/workspace-switcher";
import AppointmentsPage from "@/pages/provider/appointments";
import ServicesPage from "@/pages/provider/services";
import ServiceEditPage from "@/pages/provider/service-edit";
import AvailabilityPage from "@/pages/provider/availability";
import SettingsPage from "@/pages/provider/settings";

export default function MyServices() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <main className="p-8 text-center" role="status">Loading your services…</main>;
  if (!isAuthenticated) return <Redirect to={`/login?returnTo=${encodeURIComponent(location)}`} />;

  return <ProviderLayout />;
}

const workspaceQueries = (key: unknown) => /^\/api\/(provider|company\/team|services\/provider|bookings\/provider|availability\/provider)/.test(String(key));

function ProviderLayout() {
  const workspace = useProviderWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const mutationCount = useIsMutating();
  const editing = /\/services\/(?:new|\d+\/edit)$/.test(location);
  const change = useMutation({
    onMutate: () => queryClient.cancelQueries({ predicate: query => workspaceQueries(query.queryKey[0]) }),
    mutationFn: async (companyId: number | null): Promise<WorkspaceContext> => (await apiRequest("POST", "/api/company/context", { companyId })).json(),
    onSuccess: async context => {
      await queryClient.resetQueries({ predicate: query => workspaceQueries(query.queryKey[0]) });
      queryClient.setQueryData(["/api/company/context"], context);
      if (editing) navigate("/my-services/services", { replace: true });
      else if ((location.startsWith("/my-services/availability") && !context.permissions.manageSchedules) || (location.startsWith("/my-services/settings") && !context.permissions.manageServices && !context.permissions.manageTeam && !context.permissions.isOwner)) navigate("/my-services/appointments", { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => toast({ title: "Unable to switch workspace", description: "Please try again.", variant: "destructive" }),
  });
  if (workspace.isLoading) return <main className="p-8 text-center" role="status">Loading workspace…</main>;
  if (workspace.isError || !workspace.data) return <main className="p-8" role="alert">Unable to load your workspace. Please refresh to try again.</main>;
  const context = workspace.data;
  return <div className="min-h-[calc(100dvh-4rem)] bg-neutral-50">
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      <WorkspaceSwitcher context={context} busy={mutationCount > 0} onChange={companyId => change.mutate(companyId)} />
      <div className="md:flex md:gap-5 lg:gap-6">
        <ProviderNavigation context={context} busy={mutationCount > 0} editing={editing} />
        <main key={context.company?.id ?? "personal"} className={`flex-1 min-w-0 ${editing ? "pb-6" : "pb-24 md:pb-6"}`}>
          {change.isPending && <p role="status" className="mb-4">Switching workspace…</p>}
          <fieldset disabled={change.isPending} className={`min-w-0 ${change.isPending ? "pointer-events-none opacity-50" : ""}`} aria-busy={change.isPending}>
          <Switch>
            <Route path="/my-services"><Redirect to="/my-services/appointments" replace /></Route>
            <Route path="/my-services/appointments" component={AppointmentsPage} />
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
