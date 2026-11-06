import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { workspacePricingSettingsViewSchema, samePricingWorkspace, type WorkspacePricingSettingsView } from "@shared/workspace-pricing";
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, isSupportedCountry, isSupportedCurrency, suggestedCurrency } from "@shared/currencies";
import { useWorkspacePricing } from "@/hooks/use-workspace-pricing";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

const endpoint = "/api/workspace/pricing-settings";
type Props = { actorId: string };
type Draft = { defaultCurrency: string; businessCountryCode: string };
const draftFrom = (value: WorkspacePricingSettingsView): Draft => ({ defaultCurrency: value.defaultCurrency ?? "", businessCountryCode: value.businessCountryCode ?? "" });

function PricingForm({ actorId, initial, reload }: Props & { initial: WorkspacePricingSettingsView; reload: () => Promise<{ data?: WorkspacePricingSettingsView; error?: unknown }> }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [base, setBase] = useState(initial);
  const [currencyEdited, setCurrencyEdited] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [denied, setDenied] = useState(false);
  const [reloading, setReloading] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  const language = i18n.resolvedLanguage || i18n.language;
  const currencies = new Intl.DisplayNames([language], { type: "currency" });
  const countries = new Intl.DisplayNames([language], { type: "region" });
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(base));
  const mutation = useMutation({
    mutationFn: async (): Promise<WorkspacePricingSettingsView> => {
      request.current = new AbortController();
      const data = workspacePricingSettingsViewSchema.parse(await (await apiRequest("PATCH", endpoint, { expectedWorkspace: base.workspace, expectedRevision: base.revision,
        defaultCurrency: draft.defaultCurrency || null, businessCountryCode: draft.businessCountryCode || null }, request.current.signal)).json());
      if (!samePricingWorkspace(data.workspace, base.workspace)) throw new Error("409: Workspace changed");
      return data;
    },
    onSuccess: data => {
      if (!alive.current) return;
      const key = [endpoint, actorId, data.workspace.kind === "company" ? data.workspace.id : "personal"];
      queryClient.setQueryData(key, data);
      setBase(data); setDraft(draftFrom(data)); setCurrencyEdited(false); setSaved(true); setError("");
    },
    onError: failure => {
      if (!alive.current) return;
      setError(/^409:/.test(failure.message) ? "pricingSettings.conflict" : /^403:/.test(failure.message) ? "pricingSettings.denied" : "pricingSettings.saveError");
      if (/^(401|403):/.test(failure.message)) setDenied(true);
      if (/^401:/.test(failure.message)) queryClient.setQueryData(["/api/auth/user"], null);
      queueMicrotask(() => form.current?.querySelector<HTMLElement>('[data-pricing-error]')?.focus());
    },
    onSettled: () => { submitting.current = false; request.current = null; },
  });
  const clearFeedback = () => { setError(""); setSaved(false); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || mutation.isPending || !initial.canEdit || reloading) return;
    const fields = [draft.defaultCurrency && !isSupportedCurrency(draft.defaultCurrency) ? "pricing-default-currency" : "", draft.businessCountryCode && !isSupportedCountry(draft.businessCountryCode) ? "pricing-business-country" : ""].filter(Boolean);
    setInvalid(fields); clearFeedback();
    if (fields.length) { queueMicrotask(() => document.getElementById(fields[0])?.focus()); return; }
    submitting.current = true; mutation.mutate();
  };
  const reloadSettings = async () => {
    if (reloading || mutation.isPending) return;
    setReloading(true);
    try {
      const result = await reload();
      if (!alive.current) return;
      if (result.error || !result.data) { setError("pricingSettings.loadError"); return; }
      setBase(result.data); setDraft(draftFrom(result.data)); setCurrencyEdited(false); setInvalid([]); setError(""); setSaved(false);
      queueMicrotask(() => document.getElementById("pricing-default-currency")?.focus());
    } catch { if (alive.current) setError("pricingSettings.loadError"); }
    finally { if (alive.current) setReloading(false); }
  };
  if (denied) return <p role="alert">{t("pricingSettings.denied")}</p>;
  return <form ref={form} id="workspace-pricing-settings-form" className="space-y-4" onSubmit={submit} noValidate aria-busy={mutation.isPending || reloading}>
    {!initial.canEdit && <p>{t("pricingSettings.readOnly")}</p>}
    <fieldset disabled={!initial.canEdit || mutation.isPending || reloading} className="space-y-4 min-w-0">
      <div className="space-y-2"><Label htmlFor="pricing-default-currency">{t("pricingSettings.defaultCurrency")}</Label>
        <select id="pricing-default-currency" className="w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base" value={draft.defaultCurrency}
          aria-invalid={invalid.includes("pricing-default-currency") || undefined} aria-describedby={"pricing-currency-help" + (invalid.includes("pricing-default-currency") ? " pricing-currency-error" : "")}
          onChange={event => { setDraft(previous => ({ ...previous, defaultCurrency: event.target.value })); setCurrencyEdited(true); setInvalid(previous => previous.filter(id => id !== "pricing-default-currency")); clearFeedback(); }}>
          <option value="">{t("pricingSettings.noDefault")}</option>
          {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{code} — {currencies.of(code) || code}</option>)}
        </select>
        <p id="pricing-currency-help" className="text-sm text-muted-foreground">{t("pricingSettings.currencyHelp")}</p>
        {invalid.includes("pricing-default-currency") && <p id="pricing-currency-error" className="text-sm text-red-700 dark:text-red-300">{t("pricingSettings.invalidCurrency")}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="pricing-business-country">{t("pricingSettings.businessCountry")}</Label>
        <select id="pricing-business-country" autoComplete="country" className="w-full min-h-11 rounded-md border bg-background px-3 py-2 text-base" value={draft.businessCountryCode}
          aria-invalid={invalid.includes("pricing-business-country") || undefined} aria-describedby={"pricing-business-country-help" + (invalid.includes("pricing-business-country") ? " pricing-country-error" : "")}
          onChange={event => { const country = event.target.value; setDraft(previous => ({ ...previous, businessCountryCode: country, defaultCurrency: !currencyEdited && !base.defaultCurrency ? suggestedCurrency(country) ?? "" : previous.defaultCurrency })); setInvalid(previous => previous.filter(id => id !== "pricing-business-country")); clearFeedback(); }}>
          <option value="">{t("pricingSettings.unknownCountry")}</option>
          {SUPPORTED_COUNTRIES.map(code => <option key={code} value={code}>{countries.of(code) || code}</option>)}
        </select>
        <p id="pricing-business-country-help" className="text-sm text-muted-foreground">{t("pricingSettings.countryHelp")}</p>
        {invalid.includes("pricing-business-country") && <p id="pricing-country-error" className="text-sm text-red-700 dark:text-red-300">{t("pricingSettings.invalidCountry")}</p>}
      </div>
    </fieldset>
    {error && <div data-pricing-error tabIndex={-1} role="alert" className="space-y-2 text-sm text-red-700 dark:text-red-300 focus:outline focus:outline-2 focus:outline-offset-2"><p>{t(error)}</p>
      {["pricingSettings.conflict", "pricingSettings.loadError"].includes(error) && <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={reloading || mutation.isPending} onClick={() => void reloadSettings()}>{t("pricingSettings.reload")}</Button>}
    </div>}
    {saved && <p role="status" className="text-sm">{t("pricingSettings.saved")}</p>}
    {initial.canEdit && <Button type="submit" className="w-full sm:w-auto min-h-11 h-auto whitespace-normal" disabled={mutation.isPending || reloading || !dirty}>{t(mutation.isPending ? "pricingSettings.saving" : "pricingSettings.save")}</Button>}
  </form>;
}

export default function AccountPricingSettings({ actorId }: Props) {
  const { t } = useTranslation();
  const { context, settings, scope, loading, allowed, error, retry, switching } = useWorkspacePricing(actorId);
  const workspaceName = context.data?.company?.name || t("pricingSettings.personal");
  const denied = error instanceof Error && /^(401|403):/.test(error.message);
  return <Card id="pricing-settings" className="scroll-mt-6" aria-labelledby="pricing-settings-title">
    <CardHeader><h2 className="text-lg font-semibold" id="pricing-settings-title">{t("pricingSettings.title")}</h2><CardDescription>{t("pricingSettings.intro")}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {loading || switching ? <p role="status">{t("pricingSettings.loading")}</p> : denied ? <p role="alert">{t("pricingSettings.denied")}</p> : error && !settings.data ? <p role="alert">{t("pricingSettings.loadError")} <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={retry}>{t("pricingSettings.retry")}</Button></p> : !allowed ? <p>{t("pricingSettings.denied")}</p> : scope && settings.data ? <>
        <p className="text-sm break-words">{t("pricingSettings.workspace")}: <bdi>{workspaceName}</bdi></p>
        <PricingForm key={`${actorId}:${scope}:${settings.data.canEdit}`} actorId={actorId} initial={settings.data} reload={settings.refetch} />
      </> : <p role="status">{t("pricingSettings.loading")}</p>}
    </CardContent>
  </Card>;
}
