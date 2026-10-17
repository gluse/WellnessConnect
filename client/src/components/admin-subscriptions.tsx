import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hasPro, subscriptionUpdateSchema, type AdminSubscription, type SubscriptionOption, type SubscriptionTarget } from "@shared/storefront";
import SubscriptionTargetPicker from "@/components/subscription-target-picker";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function localDate(value: Date) { return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export default function AdminSubscriptions({ onAccessError }: { onAccessError: (error: Error) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"user" | "company">("user");
  const [selection, setSelection] = useState<SubscriptionOption | null>(null);
  const [target, setTarget] = useState<SubscriptionTarget | null>(null);
  const [record, setRecord] = useState<AdminSubscription | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("pro");
  const [until, setUntil] = useState(() => localDate(new Date(Date.now() + 30 * 86400_000)));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fail = useCallback((err: Error) => {
    setMessage(""); setError(t(err.message.startsWith("404:") ? "storefront.targetMissing" : "storefront.saveError"));
    if (/^(401|403):/.test(err.message)) { setRecord(null); onAccessError(err); }
  }, [t, onAccessError]);
  const load = useMutation({ mutationFn: async (selected: SubscriptionTarget): Promise<AdminSubscription> =>
    (await apiRequest("GET", `/api/admin/subscriptions?${new URLSearchParams({ kind: selected.kind, id: String(selected.id) })}`)).json(),
    onSuccess: (data, selected) => { setTarget(selected); setRecord(data); setPlan(data.subscription?.plan ?? "pro");
      setUntil(localDate(data.subscription?.proUntil ? new Date(data.subscription.proUntil) : new Date(Date.now() + 30 * 86400_000))); setError(""); }, onError: fail });
  const update = useMutation({ mutationFn: async (): Promise<AdminSubscription> => (await apiRequest("PUT", "/api/admin/subscriptions", subscriptionUpdateSchema.parse({ target, plan,
    proUntil: plan === "pro" ? new Date(until).toISOString() : null }))).json(),
    onSuccess: async data => { setRecord(data); setError(""); setMessage(t("storefront.subscriptionSaved"));
      await queryClient.invalidateQueries({ predicate: query => /^\/api\/(provider\/storefront|services|storefronts|admin\/users)/.test(String(query.queryKey[0])) }); }, onError: fail });
  const busy = load.isPending || update.isPending;
  const validExpiry = plan === "free" || (until && Number.isFinite(Date.parse(until)) && Date.parse(until) > Date.now());
  return <section className="rounded-xl border bg-white p-4 sm:p-6 space-y-5">
    <div><h2 className="text-lg font-semibold">{t("storefront.subscriptions")}</h2><p className="text-neutral-600 mt-1">{t("storefront.adminDescription")}</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setRecord(null); setMessage(""); setError(""); if (selection) load.mutate(selection.target); }}>
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
        <div><Label htmlFor="subscription-kind">{t("storefront.workspace")}</Label><select id="subscription-kind" className="h-10 border rounded-md px-3 block bg-white" value={kind} onChange={event => {
          setKind(event.target.value as typeof kind); setSelection(null); setRecord(null); setTarget(null); setMessage(""); setError("");
        }}>
          <option value="user">{t("storefront.individual")}</option><option value="company">{t("storefront.company")}</option></select></div>
        <div className="w-full sm:w-80"><Label htmlFor="subscription-target">{t(kind === "company" ? "storefront.company" : "storefront.provider")}</Label>
          <SubscriptionTargetPicker key={kind} kind={kind} value={selection} disabled={busy} onAccessError={fail}
            onChange={option => { setSelection(option); setRecord(null); setTarget(null); setMessage(""); setError(""); }} />
          <p id="subscription-target-help" className="text-sm text-neutral-600 mt-1">{t(kind === "company" ? "storefront.companySearchHelp" : "storefront.providerSearchHelp")}</p>
        </div>
        <Button disabled={!selection || busy}>{t("storefront.loadSubscription")}</Button>
      </fieldset>
    </form>
    {load.isPending && <p role="status">{t("storefront.loading")}</p>}
    {record && <form className="space-y-4 border-t pt-4" onSubmit={event => { event.preventDefault(); setMessage(""); setError(""); if (validExpiry) update.mutate(); }}>
      <p className="font-medium break-words">{record.name}</p><p>{t(hasPro(record.subscription) ? "storefront.proActive" : "storefront.noPro")}</p>
      <fieldset disabled={busy} className="space-y-4">
        <div><Label htmlFor="subscription-plan">{t("storefront.plan")}</Label><select id="subscription-plan" className="h-10 border rounded-md px-3 block bg-white" value={plan} onChange={event => setPlan(event.target.value as typeof plan)}><option value="free">{t("storefront.free")}</option><option value="pro">Pro</option></select></div>
        {plan === "pro" && <div><Label htmlFor="subscription-until">{t("storefront.expires")}</Label><Input id="subscription-until" type="datetime-local" value={until} required onChange={event => setUntil(event.target.value)} /><p className="text-sm text-neutral-500 mt-1">{t("storefront.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p></div>}
        <Button disabled={!validExpiry || busy}>{t(update.isPending ? "storefront.saving" : "storefront.saveSubscription")}</Button>
      </fieldset>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
