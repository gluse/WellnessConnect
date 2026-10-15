import { Link, Route, Switch, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useProviderEmployees, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import ProviderProfile from "@/components/provider-profile";
import CompanyTeam from "@/components/company-team";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: context } = useProviderWorkspace();
  const employees = useProviderEmployees();
  const [location] = useLocation();
  if (!user || !context) return <p role="status">Loading settings…</p>;
  const canViewTeam = Boolean(context.company && (context.permissions.manageTeam || context.permissions.isOwner));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Settings</h1><p className="mt-1 text-neutral-600">Manage your provider profile and company.</p></div>
    <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
      {context.permissions.manageServices && <Button asChild variant={location === "/my-services/settings" ? "default" : "outline"}><Link href="/my-services/settings" aria-current={location === "/my-services/settings" ? "page" : undefined}>Profile & employees</Link></Button>}
      {canViewTeam && <Button asChild variant={location === "/my-services/settings/team" ? "default" : "outline"}><Link href="/my-services/settings/team" aria-current={location === "/my-services/settings/team" ? "page" : undefined}>Team & access</Link></Button>}
    </nav>
    <Switch>
      <Route path="/my-services/settings/team">{canViewTeam ? employees.isLoading ? <p role="status">Loading employees…</p> : employees.isError ? <p role="alert">Unable to load employees.</p> : <CompanyTeam context={context} employees={employees.data ?? []} /> : <p role="alert">Team settings are available to company managers.</p>}</Route>
      <Route path="/my-services/settings">{context.permissions.manageServices ? <ProviderProfile user={{ ...user, providerType: context.company ? "company" : "individual", companyName: context.company?.name ?? null }} /> : canViewTeam ? <p>Open Team & access to manage your company.</p> : <p role="alert">Your access level does not allow changing settings.</p>}</Route>
      <Route><p role="alert">Settings page not found.</p></Route>
    </Switch>
  </div>;
}
