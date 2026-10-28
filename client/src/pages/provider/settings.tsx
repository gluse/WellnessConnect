import { Link, Route, Switch, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useProviderEmployees, useProviderWorkspace, WORKSPACE_CHANGE_KEY } from "@/hooks/use-provider-workspace";
import { useIsMutating } from "@tanstack/react-query";
import ProviderProfile from "@/components/provider-profile";
import CompanyTeam from "@/components/company-team";
import { Button } from "@/components/ui/button";
import StorefrontEditor from "@/components/provider/storefront-editor";
import { useTranslation } from "react-i18next";
import MonthlyBillingPanel from "@/components/provider/monthly-billing-panel";
import { useBillingRuntime } from "@/components/billing-runtime";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: context } = useProviderWorkspace();
  const employees = useProviderEmployees();
  const [location] = useLocation();
  const { subscriptionTransport } = useBillingRuntime();
  const switchingWorkspace = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  if (!user || !context) return <p role="status">Loading settings…</p>;
  const canViewTeam = Boolean(context.company && (context.permissions.manageTeam || context.permissions.isOwner));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Settings</h1><p className="mt-1 text-neutral-600">Manage your provider profile and company.</p></div>
    <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
      {context.permissions.manageServices && <Button asChild variant={location === "/my-services/settings" ? "default" : "outline"}><Link href="/my-services/settings" aria-current={location === "/my-services/settings" ? "page" : undefined}>Profile & employees</Link></Button>}
      {canViewTeam && <Button asChild variant={location === "/my-services/settings/team" ? "default" : "outline"}><Link href="/my-services/settings/team" aria-current={location === "/my-services/settings/team" ? "page" : undefined}>Team & access</Link></Button>}
      {context.permissions.manageServices && <Button asChild variant={location === "/my-services/settings/storefront" ? "default" : "outline"}><Link href="/my-services/settings/storefront" aria-current={location === "/my-services/settings/storefront" ? "page" : undefined}>{t("storefront.title")}</Link></Button>}
      <Button asChild variant={location === "/my-services/settings/billing" ? "default" : "outline"}><Link href="/my-services/settings/billing" aria-current={location === "/my-services/settings/billing" ? "page" : undefined}>{t("monthlyBilling.title")}</Link></Button>
    </nav>
    <Switch>
      <Route path="/my-services/settings/billing"><MonthlyBillingPanel actorId={user.id} target={context.company ? { kind: "company", id: context.company.id } : { kind: "user", id: user.id }} transport={switchingWorkspace ? undefined : subscriptionTransport} returned={new URLSearchParams(window.location.search).get("billing_return") === "1"} /></Route>
      <Route path="/my-services/settings/storefront">{context.permissions.manageServices ? <StorefrontEditor context={context} /> : <p role="alert">{t("storefront.denied")}</p>}</Route>
      <Route path="/my-services/settings/team">{canViewTeam ? employees.isLoading ? <p role="status">Loading employees…</p> : employees.isError ? <p role="alert">Unable to load employees.</p> : <CompanyTeam context={context} employees={employees.data ?? []} /> : <p role="alert">Team settings are available to company managers.</p>}</Route>
      <Route path="/my-services/settings">{context.permissions.manageServices ? <ProviderProfile user={{ ...user, providerType: context.company ? "company" : "individual", companyName: context.company?.name ?? null }} /> : canViewTeam ? <p>Open Team & access to manage your company.</p> : <p role="alert">Your access level does not allow changing settings.</p>}</Route>
      <Route><p role="alert">Settings page not found.</p></Route>
    </Switch>
  </div>;
}
