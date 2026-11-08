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
import AccountPricingSettings from "@/components/account-pricing-settings";
import AccountAddresses from "@/components/account-addresses";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: context } = useProviderWorkspace();
  const employees = useProviderEmployees();
  const [location] = useLocation();
  const { subscriptionTransport } = useBillingRuntime();
  const switchingWorkspace = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  if (!user || !context) return <p role="status">{t("providerSettings.loading")}</p>;
  const canViewTeam = Boolean(context.company && (context.permissions.manageTeam || context.permissions.isOwner));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">{t("mobileNavigation.settings")}</h1><p className="mt-1 text-neutral-600">{t("providerSettings.description")}</p></div>
    <nav aria-label={t("providerSettings.sections")} className="flex flex-wrap gap-2 [&_a]:min-h-11 [&_a]:h-auto [&_a]:whitespace-normal">
      {context.permissions.manageServices && <Button asChild variant={location === "/my-services/settings" ? "default" : "outline"}><Link href="/my-services/settings" aria-current={location === "/my-services/settings" ? "page" : undefined}>{t("providerSettings.profileTab")}</Link></Button>}
      {canViewTeam && <Button asChild variant={location === "/my-services/settings/team" ? "default" : "outline"}><Link href="/my-services/settings/team" aria-current={location === "/my-services/settings/team" ? "page" : undefined}>{t("providerSettings.teamTab")}</Link></Button>}
      {context.permissions.manageServices && <Button asChild variant={location === "/my-services/settings/storefront" ? "default" : "outline"}><Link href="/my-services/settings/storefront" aria-current={location === "/my-services/settings/storefront" ? "page" : undefined}>{t("storefront.title")}</Link></Button>}
      {context.permissions.manageServices && [
        { path: "/my-services/settings/pricing", label: "pricingSettings.title" },
        { path: "/my-services/settings/addresses", label: "addressForm.title" },
      ].map(item => <Button key={item.path} asChild variant={location === item.path ? "default" : "outline"} className="min-h-11 h-auto whitespace-normal"><Link href={item.path} aria-current={location === item.path ? "page" : undefined}>{t(item.label)}</Link></Button>)}
      <Button asChild variant={location === "/my-services/settings/billing" ? "default" : "outline"}><Link href="/my-services/settings/billing" aria-current={location === "/my-services/settings/billing" ? "page" : undefined}>{t("monthlyBilling.title")}</Link></Button>
    </nav>
    <Switch>
      <Route path="/my-services/settings/pricing">{context.permissions.manageServices ? <AccountPricingSettings key={`pricing-${user.id}:${context.company?.id ?? "personal"}`} actorId={user.id} /> : <p role="alert">{t("pricingSettings.denied")}</p>}</Route>
      <Route path="/my-services/settings/addresses">{context.permissions.manageServices ? <AccountAddresses key={`addresses-${user.id}:${context.company?.id ?? "personal"}`} /> : <p role="alert">{t("addressForm.denied")}</p>}</Route>
      <Route path="/my-services/settings/billing"><MonthlyBillingPanel actorId={user.id} target={context.company ? { kind: "company", id: context.company.id } : { kind: "user", id: user.id }} transport={switchingWorkspace ? undefined : subscriptionTransport} returned={new URLSearchParams(window.location.search).get("billing_return") === "1"} /></Route>
      <Route path="/my-services/settings/storefront">{context.permissions.manageServices ? <StorefrontEditor context={context} /> : <p role="alert">{t("storefront.denied")}</p>}</Route>
      <Route path="/my-services/settings/team">{canViewTeam ? employees.isLoading ? <p role="status">{t("providerSettings.loadingEmployees")}</p> : employees.isError ? <p role="alert">{t("providerSettings.loadEmployeesError")}</p> : <CompanyTeam context={context} employees={employees.data ?? []} /> : <p role="alert">{t("providerSettings.teamDenied")}</p>}</Route>
      <Route path="/my-services/settings">{context.permissions.manageServices ? <ProviderProfile user={{ ...user, providerType: context.company ? "company" : "individual", companyName: context.company?.name ?? null }} /> : canViewTeam ? <p>{t("providerSettings.teamHint")}</p> : <p role="alert">{t("providerSettings.denied")}</p>}</Route>
      <Route><p role="alert">{t("providerSettings.notFound")}</p></Route>
    </Switch>
  </div>;
}
