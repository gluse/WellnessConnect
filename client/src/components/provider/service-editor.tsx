import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Address, Employee, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { createServiceDraft } from "./service-draft";
import ServiceDetailsFields from "./service-details-fields";
import ServiceBookingFields, { ServiceAudienceFields, ServiceInstantBookingField } from "./service-booking-fields";
import ServiceLocationFields from "./service-location-fields";
import ServiceMediaFields from "./service-media-fields";
import ServiceReminderFields from "./service-reminder-fields";
import { serviceControlIds, validateServiceDraft, type ServiceErrors } from "./service-field-feedback";
import { registerServiceExitBlocker, requestServiceEditorExit } from "./service-navigation-guard";
import { parseMoneyInput } from "@/lib/money-input";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspacePricing } from "@/hooks/use-workspace-pricing";
import { resolveCurrencyDefault, type CurrencyDefaultSource } from "@shared/currency-defaults";
import { suggestedCurrency } from "@shared/currencies";

const actionClass = "min-h-11 h-auto whitespace-normal py-3 text-center";
const dialogClass = "service-editor max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl motion-reduce:animate-none";
const activeFocus = () => document.activeElement && "focus" in document.activeElement ? document.activeElement as HTMLElement : null;
function FormSection({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <section aria-labelledby={`service-section-${number}`} className="bg-card text-card-foreground border rounded-xl p-4 sm:p-6 space-y-5 min-w-0">
    <div className="flex items-center gap-3"><span aria-hidden="true" className="flex items-center justify-center shrink-0 rounded-lg border text-primary font-semibold w-8 h-8">{number}</span>
      <h2 id={`service-section-${number}`} className="text-lg font-semibold">{title}</h2></div>
    {children}
  </section>;
}
export default function ServiceEditor({ service, employees, company }: { service?: Service; employees: Employee[]; company: boolean }) {
  const { user, isLoading } = useAuth();
  const pricing = useWorkspacePricing(user?.id, !service);
  const { t } = useTranslation();
  if (isLoading || pricing.switching || pricing.context.isPending) return <p role="status">{t("currency.defaultsLoading")}</p>;
  if (pricing.context.isError) return <div role="alert">{t("currency.defaultsLoadError")} <Button onClick={pricing.retry}>{t("publicSearch.retry")}</Button></div>;
  if (!pricing.allowed || !user || !pricing.scope) return <p role="alert">{t("serviceForm.denied")}</p>;
  return <ServiceEditorContent key={`${user.id}:${pricing.scope}:${service?.id ?? "new"}`} service={service} employees={employees} company={company} pricing={pricing} actorId={user.id} />;
}
function ServiceEditorContent({ service, employees, company, pricing, actorId }: { service?: Service; employees: Employee[]; company: boolean; pricing: ReturnType<typeof useWorkspacePricing>; actorId: string }) {
  const { t, i18n } = useTranslation();
  const [newService, setNewService] = useState(() => createServiceDraft(service));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ServiceErrors>({});
  const [exit, setExit] = useState<{ proceed: () => unknown } | null>(null);
  const [hideConfirmation, setHideConfirmation] = useState(false);
  const [currencyConfirmation, setCurrencyConfirmation] = useState<boolean | null>(null);
  const [currencySelection, setCurrencySelection] = useState<{ currency: string; source: CurrencyDefaultSource } | null>(service ? { currency: service.currency, source: "saved" } : null);
  const addresses = useQuery<Address[]>({ queryKey: ["/api/addresses", actorId, pricing.scope], refetchOnWindowFocus: "always", gcTime: 0 });
  const selectedAddress = addresses.data?.find(address => address.id === newService.addressId);
  const resolved = resolveCurrencyDefault({ location: selectedAddress, settings: pricing.settings.data });
  const availableDefault = (!pricing.settings.data || pricing.settings.isError) && resolved.source !== "location" ? { currency: null, source: "none" as const } : resolved;
  const choice = currencySelection ?? availableDefault;
  const draft = { ...newService, currency: choice.currency ?? "" };
  const localSuggestion = suggestedCurrency(selectedAddress?.countryCode);
  const [savingAs, setSavingAs] = useState<boolean | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const lastExitTrigger = useRef<HTMLElement | null>(null);
  const lastHideTrigger = useRef<HTMLElement | null>(null);
  const bypassExit = useRef(false);
  const allowUnload = useRef(false);
  const submitting = useRef(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dirty = JSON.stringify(newService) !== JSON.stringify(createServiceDraft(service));
  const errors = Object.fromEntries(Object.entries(fieldErrors).map(([field, key]) => [field, t(key!)])) as ServiceErrors;
  // Isolate provider text without parsing interpolated user content as markup.
  const hideMessageParts = t("serviceForm.hideHelp", { name: "\uFFFC" }).split("\uFFFC");
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage || i18n.language;
    document.documentElement.dir = i18n.dir();
  }, [i18n, i18n.language, i18n.resolvedLanguage]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!allowUnload.current && !bypassExit.current && (dirty || submitting.current)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useLayoutEffect(() => {
    if (!dirty && !submitting.current) return;
    return registerServiceExitBlocker(proceed => {
      if (bypassExit.current) { proceed(); return; }
      if (submitting.current) return;
      lastExitTrigger.current = activeFocus();
      setExit(previous => previous ?? { proceed });
    });
  }, [dirty, savingAs]);
  useEffect(() => {
    // Catch ordinary anchors as well as router links before they can leave.
    const click = (event: MouseEvent) => {
      if (bypassExit.current || (!dirty && !submitting.current) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopImmediatePropagation();
      requestServiceEditorExit(() => { allowUnload.current = true; anchor.click(); });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async (isActive: boolean) => (await apiRequest(service ? "PATCH" : "POST", service ? `/api/services/${service.id}` : "/api/services", {
      ...draft, price: parseMoneyInput(draft.price, draft.currency, i18n.resolvedLanguage || i18n.language), isActive,
    })).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/services/") });
      toast({ title: t("serviceForm.saved") });
      bypassExit.current = true;
      navigate("/my-services/services", { state: { serviceSaved: true } });
    },
    onError: error => {
      if (isUnauthorizedError(error)) {
        // Authentication loss clears the in-memory editor; never recover across accounts.
        bypassExit.current = true;
        window.location.assign("/login?returnTo=" + encodeURIComponent(service ? `/my-services/services/${service.id}/edit` : "/my-services/services/new")); return;
      }
      setError(/^403:/.test(error.message) ? "serviceForm.denied" : "serviceForm.saveError");
      queueMicrotask(() => summary.current?.focus());
    },
    onSettled: () => { submitting.current = false; setSavingAs(null); },
  });
  const submit = (isActive: boolean, confirmed = false, currencyConfirmed = false) => {
    if (submitting.current || save.isPending) return;
    const nextErrors = validateServiceDraft(draft, i18n.resolvedLanguage || i18n.language);
    setFieldErrors(nextErrors); setError("");
    if (Object.keys(nextErrors).length) { queueMicrotask(() => summary.current?.focus()); return; }
    if (service && draft.currency !== service.currency && !currencyConfirmed) { setCurrencyConfirmation(isActive); return; }
    if (!isActive && service?.isActive && !confirmed) { lastHideTrigger.current = activeFocus(); setHideConfirmation(true); return; }
    submitting.current = true; setSavingAs(isActive); save.mutate(isActive);
  };
  const goBack = () => requestServiceEditorExit(() => { bypassExit.current = true; navigate("/my-services/services"); });
  return <div className="service-editor max-w-3xl mx-auto space-y-5 bg-background text-foreground" dir={i18n.dir()}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" variant="ghost" className={actionClass} disabled={save.isPending} onClick={goBack}>
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />{t("serviceForm.back")}
      </Button>
      {dirty && <p role="status" className="text-sm text-muted-foreground">{t("serviceForm.unsaved")}</p>}
    </div>
    <div><h1 className="text-2xl font-semibold">{t(service ? "provider.editService" : "provider.addService")}</h1>
      <p className="mt-2 text-muted-foreground">{t("serviceForm.intro")}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t("serviceForm.required")}</p>
    </div>
    <form noValidate onSubmit={event => { event.preventDefault(); submit(true); }} className="space-y-6" aria-busy={save.isPending}>
      {(error || Object.keys(errors).length > 0) && <div ref={summary} tabIndex={-1} role="alert" className="rounded-xl border border-red-700 dark:border-red-300 p-4 space-y-2 focus:outline focus:outline-2 focus:outline-offset-2">
        <h2 className="font-semibold">{t(error || "serviceForm.checkFields")}</h2>
        {Object.keys(errors).length > 0 && <ul className="list-disc ps-5">{Object.entries(errors).map(([field, message]) => <li key={field}>
          <a href={`#${serviceControlIds[field as keyof typeof serviceControlIds]}`} className="underline py-2 inline-block"
            onClick={event => { event.preventDefault(); document.getElementById(serviceControlIds[field as keyof typeof serviceControlIds]!)?.focus(); }}>{message}</a>
        </li>)}</ul>}
      </div>}
      <fieldset disabled={save.isPending} className="space-y-6 min-w-0">
        <FormSection number={1} title={t("serviceForm.details")}><ServiceDetailsFields newService={newService} setNewService={setNewService} employees={employees} company={company} errors={errors} /></FormSection>
        <FormSection number={2} title={t("serviceForm.sessionPrice")}>
          <ServiceBookingFields newService={draft} setNewService={setNewService} errors={errors}
            onCurrencyChoice={currency => setCurrencySelection({ currency, source: "manual" })}
            onPriceChange={price => {
              if (price.trim() && choice.currency) setCurrencySelection(previous => previous ?? { currency: choice.currency!, source: choice.source });
              if (!price.trim() && currencySelection && !["saved", "manual"].includes(currencySelection.source)) setCurrencySelection(null);
              setNewService(previous => ({ ...previous, price }));
            }} />
          {choice.currency && <p className="text-sm text-muted-foreground" data-testid="currency-default-source" role="status">{t(`currency.defaultSource_${choice.source}`, { currency: choice.currency })}</p>}
          {!service && pricing.settings.isPending && !currencySelection && <p role="status">{t("currency.defaultsLoading")}</p>}
          {!service && pricing.settings.isError && <p role="alert">{t("currency.defaultsLoadError")} <button type="button" className="underline min-h-11" onClick={pricing.retry}>{t("publicSearch.retry")}</button></p>}
          {!service && currencySelection && !["saved", "manual"].includes(currencySelection.source) && <p className="text-sm text-muted-foreground">{t("currency.amountLocked")}</p>}
          {localSuggestion && choice.currency && localSuggestion !== choice.currency && <div className="text-sm space-y-1"><p>{t("currency.suggestLocal", { currency: localSuggestion })}</p><Button type="button" variant="outline" className="max-w-full min-h-11 h-auto whitespace-normal" onClick={() => { setCurrencySelection({ currency: localSuggestion, source: "manual" }); setNewService(previous => ({ ...previous, currency: localSuggestion })); }}>{t("currency.useSuggested", { currency: localSuggestion })}</Button></div>}
        </FormSection>
        <FormSection number={3} title={t("serviceForm.audience")}><ServiceAudienceFields newService={newService} setNewService={setNewService} /></FormSection>
        <FormSection number={4} title={t("serviceForm.bookingLocation")}>
          <ServiceInstantBookingField newService={newService} setNewService={setNewService} />
          <ServiceLocationFields newService={draft} setNewService={setNewService} errors={errors} addresses={addresses} />
        </FormSection>
        <FormSection number={5} title={t("serviceForm.media")}><ServiceMediaFields newService={newService} setNewService={setNewService} errors={errors} /></FormSection>
        <FormSection number={6} title={t("notifications.reminderSettings")}><ServiceReminderFields draft={newService} setDraft={setNewService} errors={errors} /></FormSection>
      </fieldset>
      <div className="bg-card text-card-foreground border rounded-xl p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
        <p className="text-sm text-muted-foreground">{t("serviceForm.visibility")}</p>
        {service?.isActive && <p className="text-sm font-medium">{t("serviceForm.hideWarning")}</p>}
        <p role="status" aria-live="polite" className="text-sm">{save.isPending ? t(savingAs ? "serviceForm.publishing" : "serviceForm.savingInactive") : ""}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Button type="button" variant="outline" className={actionClass} disabled={save.isPending} onClick={goBack}>{t("common.cancel")}</Button>
          <Button type="button" variant="outline" className={actionClass} disabled={save.isPending} onClick={() => submit(false)} data-testid="button-save-inactive-service">{t("serviceForm.saveInactive")}</Button>
          <Button type="submit" className={actionClass} disabled={save.isPending} data-testid="button-save-service">{t("serviceForm.publish")}</Button>
        </div>
      </div>
    </form>
    <AlertDialog open={currencyConfirmation !== null} onOpenChange={open => { if (!open) setCurrencyConfirmation(null); }}>
      <AlertDialogContent dir={i18n.dir()} className={dialogClass} onCloseAutoFocus={event => { event.preventDefault(); document.getElementById("service-currency")?.focus(); }}>
        <AlertDialogHeader className="text-start sm:text-start"><AlertDialogTitle>{t("currency.changeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("currency.changeHelp", { currency: draft.currency, price: draft.price })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0"><AlertDialogCancel className={actionClass}>{t("serviceForm.keepEditing")}</AlertDialogCancel>
          <AlertDialogAction className={actionClass} onClick={() => { const active = currencyConfirmation; setCurrencyConfirmation(null); if (active !== null) submit(active, false, true); }}>{t("currency.confirmChange")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(exit)} onOpenChange={open => { if (!open) setExit(null); }}>
      <AlertDialogContent dir={i18n.dir()} className={dialogClass} onCloseAutoFocus={event => { event.preventDefault(); lastExitTrigger.current?.focus(); }}>
        <AlertDialogHeader className="text-start sm:text-start"><AlertDialogTitle>{t("serviceForm.discardTitle")}</AlertDialogTitle><AlertDialogDescription>{t("serviceForm.discardHelp")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0"><AlertDialogCancel className={actionClass}>{t("serviceForm.keepEditing")}</AlertDialogCancel>
          <AlertDialogAction className={actionClass} onClick={() => {
            const proceed = exit?.proceed; setExit(null); bypassExit.current = true;
            try {
              const result = proceed?.();
              if (result && typeof (result as PromiseLike<unknown>).then === "function") {
                void Promise.resolve(result).catch(() => {}).finally(() => { bypassExit.current = false; });
              } else bypassExit.current = false;
            } catch { bypassExit.current = false; }
          }}>{t("serviceForm.discard")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={hideConfirmation} onOpenChange={setHideConfirmation}>
      <AlertDialogContent dir={i18n.dir()} className={dialogClass} onCloseAutoFocus={event => { event.preventDefault(); lastHideTrigger.current?.focus(); }}>
        <AlertDialogHeader className="text-start sm:text-start"><AlertDialogTitle>{t("serviceForm.hideTitle")}</AlertDialogTitle><AlertDialogDescription>{hideMessageParts.map((part, index) => <Fragment key={index}>{index > 0 && <bdi>{newService.name}</bdi>}{part}</Fragment>)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0"><AlertDialogCancel className={actionClass}>{t("serviceForm.keepEditing")}</AlertDialogCancel>
          <AlertDialogAction className={actionClass} onClick={() => submit(false, true, true)}>{t("serviceForm.saveInactive")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
