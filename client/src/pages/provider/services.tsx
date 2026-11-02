import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Plus, Sparkles, List, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getProviderName } from "@shared/provider";
import { useProviderEmployees, useProviderServices, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import { useServiceActions } from "@/hooks/use-service-actions";
import ServicesList from "@/components/provider/services-list";
import { Button } from "@/components/ui/button";

export default function ServicesPage() {
  const { t } = useTranslation();
  const [saved] = useState(() => Boolean(window.history.state?.serviceSaved));
  useEffect(() => {
    if (!saved) return;
    const state = { ...window.history.state }; delete state.serviceSaved;
    window.history.replaceState(state, "");
  }, [saved]);
  const services = useProviderServices();
  const employees = useProviderEmployees();
  const { data: context } = useProviderWorkspace();
  const { user } = useAuth();
  const { copy, search } = useServiceActions();
  const [status, setStatus] = useState<"all" | "published" | "inactive">("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const editable = context?.permissions.manageServices ?? false;
  const filtered = (services.data ?? []).filter(service => status === "all" || (status === "published" ? service.isActive : !service.isActive));
  const providerName = context?.company?.name || (user ? getProviderName({ ...user, providerType: "individual" }) : t("role.provider"));
  return <div className="search-design provider-services-page">
    {saved && <p role="status" className="border rounded-xl p-4 bg-card text-card-foreground">{t("serviceForm.saved")}</p>}
    <div className="provider-services-heading"><div><h1>{t("provider.myServices")}</h1><p>{t("providerServices.previewHelp")}</p></div>
      {editable && <Button asChild><Link href="/my-services/services/new"><Plus className="w-4 h-4 mr-2" aria-hidden="true" />{t("provider.addService")}</Link></Button>}
    </div>
    <div className="provider-services-toolbar">
      <div className="provider-services-status-filter" role="group" aria-label={t("providerServices.status")}>{(["all", "published", "inactive"] as const).map(value => <Button key={value} size="sm" variant={status === value ? "default" : "ghost"} data-testid={`provider-filter-${value}`} aria-pressed={status === value} onClick={() => setStatus(value)}>{t(`providerServices.${value}`)}</Button>)}</div>
      {editable && <Button variant="outline" disabled={search.isPending || !services.data?.length} onClick={() => search.mutate()} data-testid="button-generate-ai-search"><Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />{t(search.isPending ? "providerServices.updating" : "providerServices.updateSearch")}</Button>}
    </div>
    <div className="search-view-toggle provider-service-view-toggle" role="group" aria-label={t("searchPage.resultView")}>{(["list", "grid"] as const).map(value => <Button key={value} variant="ghost" type="button" data-testid={`provider-view-${value}`} aria-pressed={view === value} onClick={() => setView(value)}>{value === "list" ? <List aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}<span>{t(`views.${value}`)}</span></Button>)}</div>
    <section className="provider-service-results" aria-labelledby="provider-service-count" aria-busy={services.isLoading}>
      <h2 id="provider-service-count" className="provider-service-count" aria-live="polite">{services.isLoading ? t("providerServices.loading") : t("searchPage.resultsCount", { count: filtered.length })}</h2>
      {services.isLoading ? <p role="status">{t("providerServices.loading")}</p> : services.isError ? <div className="search-state" role="alert"><p>{t("providerServices.loadError")}</p><Button variant="outline" onClick={() => void services.refetch()}>{t("publicSearch.retry")}</Button></div>
        : <ServicesList services={filtered} view={view} providerName={providerName} employees={employees.data ?? []} editable={editable} copyingId={copy.variables} copyBusy={copy.isPending} onCopy={id => copy.mutate(id)} />}
    </section>
    <p className="provider-preview-note">{t("providerServices.previewNote")}</p>
  </div>;
}
